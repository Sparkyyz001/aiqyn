import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { DICTS, fmt, type Lang } from "@/lib/i18n/dict";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { isDemoNo } from "@/lib/demo-baseline";
import { flow, titleOf } from "@/lib/data";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";
import { slaState } from "@/lib/sla";
import { honestContext, honestForecast } from "@/lib/honest-deadline";

// Карточка-постер обращения для соцсетей (1080×1350, Instagram/WhatsApp/Telegram) с QR на публичную
// карточку. Житель кидает её в @112aktau или чат района — соседи сканируют QR и подтверждают проблему.
// Приватность: исходное фото на постер не идёт (распознавания лиц и номеров нет), только данные
// обращения — без имени и телефона автора.

export const revalidate = 60;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aiqyn-aktau.vercel.app";
const FONTS = path.join(process.cwd(), "assets", "fonts");

const STATUS_COLOR: Record<string, string> = {
  routed: "#9fd0ff",
  accepted: "#9fd0ff",
  in_progress: "#9fd0ff",
  awaiting_confirmation: "#f2c26b",
  reopened: "#ef8fb6",
  resolved: "#76cf6a",
  rejected: "#b8b8b8",
};

export async function GET(req: Request, ctx: RouteContext<"/api/og/report/[no]">) {
  const { no } = await ctx.params;
  const lang: Lang = new URL(req.url).searchParams.get("lang") === "kz" ? "kz" : "ru";
  const t = DICTS[lang];
  const p = t.share.poster;

  // Данные обращения: демо-подложка или реальное из базы
  type Card = { title: string; category: string; district: string | null; status: string; sla_due_at: string | null; confirmations: number; honest: ReturnType<typeof honestForecast> | null };
  let card: Card | null = null;
  const { all } = await flow();
  const hctx = honestContext(all);
  if (isDemoNo(no)) {
    const d = all.find((x) => x.public_no === no);
    if (d) card = { title: titleOf(d, lang), category: d.category, district: d.district, status: d.status, sla_due_at: d.sla_due_at, confirmations: d.confirmations, honest: honestForecast(d, hctx) };
  } else {
    const db = createAdminClient();
    const ref = await getReference();
    const { data: r } = await db
      .from("reports")
      .select("id, title, category_id, service_id, district_id, status, created_at, resolved_at, sla_due_at, confirmations_count")
      .eq("public_no", no)
      .maybeSingle();
    if (r) {
      const category = ref.categoryById.get(r.category_id)?.code ?? "other";
      const district = r.district_id ? ref.districtById.get(r.district_id)?.code ?? null : null;
      card = {
        title: r.title,
        category,
        district,
        status: r.status,
        sla_due_at: r.sla_due_at,
        confirmations: r.confirmations_count,
        honest: honestForecast({ id: r.id, category, service: r.service_id ? ref.serviceById.get(r.service_id)?.code ?? "akimat" : "akimat", district, status: r.status, created_at: r.created_at, resolved_at: r.resolved_at, sla_due_at: r.sla_due_at }, hctx),
      };
    }
  }
  if (!card) return new Response("Not found", { status: 404 });

  const [regular, bold, art, qr] = await Promise.all([
    readFile(path.join(FONTS, "PT_Sans-Web-Regular.ttf")),
    readFile(path.join(FONTS, "PT_Sans-Web-Bold.ttf")),
    readFile(path.join(process.cwd(), "assets", "og-landscape.jpg")),
    QRCode.toDataURL(`${SITE}/report/${no}`, { margin: 1, width: 300, color: { dark: "#053e42", light: "#f6f1dd" } }),
  ]);

  const closed = card.status === "resolved" || card.status === "rejected";
  const s = slaState(card.sla_due_at ? new Date(card.sla_due_at) : null, new Date(), closed);
  const slaText = closed ? p.closed : s.breached ? p.overdue : fmt(p.left, { n: Math.max(0, s.workingDaysLeft) });
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Aqtau" });
  const h = card.honest && card.honest.ok && !closed ? card.honest : null;
  const late = h && (h.lateBy ?? 0) > 1;
  const where = [nm(CATEGORY[card.category], lang), card.district && DISTRICT[card.district] ? nm(DISTRICT[card.district], lang) : null].filter(Boolean).join(" · ");
  const statusLabel = t.status[card.status as keyof typeof t.status] ?? card.status;
  const title = card.title.length > 90 ? card.title.slice(0, 88) + "…" : card.title;

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: "#053e42", color: "#f6f1dd", fontFamily: "PT Sans" }}>
        {/* пейзаж с плавным переходом в бирюзу */}
        <div style={{ position: "relative", width: 1080, height: 520, display: "flex", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={`data:image/jpeg;base64,${art.toString("base64")}`} width={1080} height={720} style={{ position: "absolute", top: -60, left: 0, width: 1080, height: 720, objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(180deg, rgba(5,62,66,0.35) 0%, rgba(5,62,66,0) 30%, rgba(5,62,66,0.2) 60%, #053e42 100%)" }} />
          <div style={{ position: "absolute", top: 56, left: 64, display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 44 44">
              <rect x="3" y="3" width="38" height="38" rx="11" fill="none" stroke="#c7e99d" strokeWidth="2.6" />
              <path d="M22 34V13" stroke="#c7e99d" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M22 20c-6.5 0-9.5-3.4-9.5-8.5 6 0 9.5 3 9.5 8.5Z" fill="#c7e99d" />
              <path d="M22 28c6.5 0 9.5-3.4 9.5-8.5-6 0-9.5 3-9.5 8.5Z" fill="#c7e99d" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>AIQYN</div>
              <div style={{ fontSize: 24, opacity: 0.8 }}>Ақтау</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "0 64px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#76cf6a" }}>
            <div style={{ width: 48, height: 3, background: "#76cf6a" }} />
            {where}
          </div>
          <div style={{ marginTop: 22, fontSize: 64, lineHeight: 1.08, fontWeight: 700, letterSpacing: -1.5 }}>{title}</div>

          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}>
            <div style={{ opacity: 0.75 }}>{`${p.no} ${no}`}</div>
            <div style={{ display: "flex", padding: "8px 20px", borderRadius: 999, background: "rgba(246,241,221,0.1)", color: STATUS_COLOR[card.status] ?? "#f6f1dd", fontWeight: 700 }}>{statusLabel}</div>
          </div>

          <div style={{ marginTop: 34, display: "flex", gap: 20 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 26, borderRadius: 24, background: "rgba(246,241,221,0.06)", border: "2px solid rgba(246,241,221,0.12)" }}>
              <div style={{ fontSize: 22, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>{p.sla}</div>
              <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: s.breached && !closed ? "#ff907d" : "#f6f1dd" }}>{slaText}</div>
            </div>
            {h ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 26, borderRadius: 24, background: late ? "rgba(255,144,125,0.14)" : "rgba(118,207,106,0.12)", border: `2px solid ${late ? "rgba(255,144,125,0.45)" : "rgba(118,207,106,0.4)"}` }}>
                <div style={{ fontSize: 22, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>{p.honest}</div>
                <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700, color: late ? "#ff907d" : "#b6ec9f" }}>{date(h.date)}</div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 26, borderRadius: 24, background: "rgba(246,241,221,0.06)", border: "2px solid rgba(246,241,221,0.12)" }}>
                <div style={{ fontSize: 22, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>{p.confirmed}</div>
                <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700 }}>{`${card.confirmations} ${p.people}`}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto", marginBottom: 64, display: "flex", alignItems: "center", gap: 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={qr} width={220} height={220} style={{ borderRadius: 20 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15 }}>{p.qr}</div>
              <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15, color: "#ff907d" }}>{p.qr2}</div>
              <div style={{ marginTop: 10, fontSize: 24, opacity: 0.6 }}>{SITE.replace(/^https?:\/\//, "")}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "PT Sans", data: regular, weight: 400, style: "normal" },
        { name: "PT Sans", data: bold, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    }
  );
}
