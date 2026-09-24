import { renderToBuffer } from "@react-pdf/renderer";
import { getProfile } from "@/lib/auth";
import { msg } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";
import { buildDigest } from "@/lib/digest";
import { DigestDoc } from "@/lib/pdf/digest-doc";

export const runtime = "nodejs";

const DAY = 86_400_000;

// Дайджест для акима (ADDON_4): ?view=1 — предпросмотр в браузере, иначе скачивание;
// ?days=7|14|30 или ?from=&to= (YYYY-MM-DD); ?lang=kz — казахская версия.
export async function GET(req: Request) {
  const me = await getProfile();
  if (!me) return new Response(await msg("login"), { status: 401 });
  if (!["akimat", "operator"].includes(me.role)) return new Response(await msg("noAccess"), { status: 403 });

  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "kz" ? "kz" : "ru";
  const view = url.searchParams.get("view") === "1";
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 7));
  const toParam = url.searchParams.get("to");
  const fromParam = url.searchParams.get("from");
  // конец периода — конец текущих суток по Актау (UTC+5)
  const now = new Date();
  const endLocal = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - 5 * 3600_000);
  const to = toParam ? new Date(`${toParam}T00:00:00+05:00`) : endLocal;
  const from = fromParam ? new Date(`${fromParam}T00:00:00+05:00`) : new Date(to.getTime() - days * DAY);
  if (!(from < to)) return new Response("bad period", { status: 400 });

  const d = await buildDigest(from, to, lang);
  const buf = await renderToBuffer(<DigestDoc d={d} t={DICTS[lang].digest} lang={lang} />);
  const name = `aiqyn-digest-${from.toISOString().slice(0, 10)}_${new Date(to.getTime() - 1).toISOString().slice(0, 10)}-${lang}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${view ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
