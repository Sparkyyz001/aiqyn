import Link from "next/link";
import { ArrowUp, ArrowUpRight, CheckCircle2, Clock, Siren, Sun, Wind } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { flow, titleOf } from "@/lib/data";
import { today } from "@/lib/today";
import { AKTAU_CENTER, pointInPolygon, type GeoPolygon } from "@/lib/geo";
import { CATEGORY, DISTRICT, nm, isOpen } from "@/lib/meta";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dict";
import type { RowReport } from "@/components/reports/report-row";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

// «Сегодня в Актау» — утренняя сводка жителя по его микрорайону: аварии и отключения рядом,
// прогноз запаха по ветру на 12 часов, что город решил за сутки и сколько дней осталось по его обращениям.
export async function TodayAktau({ districtId, mine, lang, t }: { districtId: number | null; mine: RowReport[]; lang: Lang; t: Dict["today"] }) {
  const ref = await getReference();
  const d = districtId ? ref.districtById.get(districtId) : null;
  const home = d ? { lat: d.center_lat, lng: d.center_lng } : AKTAU_CENTER;
  const place = d ? (lang === "kz" ? d.name_kz : d.name_ru) : t.city;
  const db = createAdminClient();
  const now = new Date().getTime();

  const [w, { all }, { data: inc }] = await Promise.all([
    today(home),
    flow(),
    db.from("incidents").select("id, type, title, polygon, eta_at, service_id").eq("status", "active").order("started_at", { ascending: false }).limit(10),
  ]);

  // аварии: сначала те, что задевают мой микрорайон
  const incidents = (inc ?? [])
    .map((i) => ({ ...i, mine: !!i.polygon && pointInPolygon(home, i.polygon as GeoPolygon) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine));

  // решено за сутки по городу; если за сутки пусто — последние решённые
  const resolved = all.filter((r) => r.status === "resolved" && r.resolved_at).sort((a, b) => +new Date(b.resolved_at!) - +new Date(a.resolved_at!));
  const day = resolved.filter((r) => now - +new Date(r.resolved_at!) < DAY);
  const shown = (day.length ? day : resolved).slice(0, 3);
  const inMine = d ? all.filter((r) => r.district === d.code && isOpen(r.status)).length : null;
  const { data: after } = shown.length
    ? await db.from("report_photos").select("report_id, url").eq("kind", "after").in("report_id", shown.map((r) => r.id))
    : { data: [] as { report_id: number; url: string }[] };
  const photoOf = new Map((after ?? []).map((p) => [p.report_id, p.url]));

  // мои сроки: сколько дней до срока по закону
  const deadlines = mine
    .filter((r) => isOpen(r.status) && r.sla_due_at)
    .map((r) => ({ r, days: Math.ceil((+new Date(r.sla_due_at!) - now) / DAY) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  // первое непрерывное окно «ветер со стороны промзоны»: с какого часа и до какого
  const hours = w?.hours ?? [];
  const s0 = hours.findIndex((h) => h.smell);
  let s1 = s0;
  while (s0 >= 0 && s1 + 1 < hours.length && hours[s1 + 1].smell) s1++;
  const hh = (iso: string) => iso.slice(11, 16);
  const until = s0 < 0 ? "" : s1 + 1 < hours.length ? hh(hours[s1 + 1].t) : `${String((Number(hh(hours[s1].t).slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`;
  const smellHours = s0 < 0 ? [] : hours.slice(s0, s1 + 1);
  const dir = (deg: number) => t.dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  const dateStr = new Date().toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Aqtau" });

  const tile = "min-w-0 rounded-2xl border bg-card p-4";
  const head = (icon: React.ReactNode, title: string, tone = "bg-primary/10 text-primary") => (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}>{icon}</span>
      <h3 className="font-semibold">{title}</h3>
    </div>
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {dateStr} · {place}
            {inMine != null && ` · ${fmt(t.openHere, { n: inMine })}`}
          </p>
        </div>
        {w && (
          <div className="flex items-center gap-3 rounded-full border bg-card px-3 py-1.5 text-sm tabular-nums">
            <span className="flex items-center gap-1">
              <Sun className="size-4 text-[#e0a526]" /> {w.temp}°
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <ArrowUp className="size-3.5" style={{ transform: `rotate(${w.deg + 180}deg)` }} aria-hidden /> {dir(w.deg)}, {w.speed} {t.ms}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 [&>*]:min-w-0">
        {/* аварии и отключения */}
        <div className={cn(tile, incidents.some((i) => i.mine) && "border-[#b4447a]/50 bg-[#b4447a]/[0.04]")}>
          {head(<Siren className="size-4" />, t.incidents, incidents.length ? "bg-[#b4447a]/12 text-[#b4447a]" : "bg-[color:var(--ok)]/12 text-[color:var(--ok)]")}
          {incidents.length ? (
            <ul className="flex flex-col gap-2">
              {incidents.slice(0, 3).map((i) => (
                <li key={i.id} className="text-sm">
                  <div className="font-medium">
                    {i.mine && <span className="mr-1.5 rounded bg-[#b4447a] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">{t.nearYou}</span>}
                    {i.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.service_id ? ref.serviceById.get(i.service_id)?.short_name : ""}
                    {i.eta_at && ` · ${fmt(t.eta, { t: new Date(i.eta_at).toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", { timeZone: "Asia/Aqtau", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}`}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-[color:var(--ok)]" /> {t.noIncidents}
            </p>
          )}
          <Link href="/incidents" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t.incidentsLink} <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* прогноз запаха по ветру */}
        <div className={cn(tile, smellHours.length > 0 && "border-[#c2410c]/40 bg-[#f97316]/[0.05]")}>
          {head(<Wind className="size-4" />, t.smell, smellHours.length ? "bg-[#f97316]/15 text-[#c2410c]" : undefined)}
          {w ? (
            <>
              <p className="text-sm text-pretty">
                {smellHours.length ? fmt(s0 === 0 ? t.smellNow : t.smellYes, { from: hh(smellHours[0].t), to: until }) : t.smellNo}
              </p>
              {/* 12 часов: оранжевый — ветер со стороны промзоны */}
              <div className="mt-3 flex h-10 items-end gap-1" role="img" aria-label={t.smellStrip}>
                {w.hours.map((h, i) => (
                  <div key={h.t} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className={cn("w-full rounded-sm", h.smell ? "bg-[#f97316]" : "bg-primary/20")}
                      style={{ height: `${Math.max(4, Math.min(28, h.speed * 4))}px` }}
                      title={`${hh(h.t)} · ${dir(h.deg)} ${Math.round(h.speed)} ${t.ms}`}
                    />
                    <span className="h-3 text-[10px] leading-3 text-muted-foreground tabular-nums">{i % 3 === 0 ? hh(h.t).slice(0, 2) : ""}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.smellHint}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noWeather}</p>
          )}
        </div>

        {/* решено за сутки */}
        <div className={tile}>
          {head(<CheckCircle2 className="size-4" />, day.length ? fmt(t.resolvedDay, { n: day.length }) : t.resolvedLast, "bg-[color:var(--ok)]/12 text-[color:var(--ok)]")}
          {shown.length ? (
            <ul className="flex flex-col gap-2">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link href={`/report/${r.public_no}`} className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-accent/50">
                    {photoOf.get(r.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoOf.get(r.id)} alt="" className="size-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[color:var(--ok)]/10 text-[color:var(--ok)]">
                        <CheckCircle2 className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{titleOf(r, lang)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {nm(CATEGORY[r.category], lang)}
                        {r.district && DISTRICT[r.district] ? ` · ${nm(DISTRICT[r.district], lang)}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        {/* мои сроки */}
        <div className={tile}>
          {head(<Clock className="size-4" />, t.deadlines)}
          {deadlines.length ? (
            <ul className="flex flex-col gap-2">
              {deadlines.map(({ r, days }) => (
                <li key={r.id}>
                  <Link href={`/report/${r.public_no}`} className="flex items-center justify-between gap-3 rounded-lg p-1 -m-1 hover:bg-accent/50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">{r.public_no}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                        days < 0 ? "bg-[color:var(--danger)]/12 text-[color:var(--danger)]" : days <= 3 ? "bg-[color:var(--warn)]/15 text-[color:var(--warn)]" : "bg-primary/10 text-primary"
                      )}
                    >
                      {days < 0 ? fmt(t.overdue, { n: -days }) : days === 0 ? t.dueToday : fmt(t.daysLeft, { n: days })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noDeadlines}</p>
          )}
        </div>
      </div>
    </section>
  );
}
