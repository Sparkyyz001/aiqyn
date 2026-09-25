import { flow, titleOf } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { roadRisk, distToLine, type RoadVotes } from "@/lib/road-risk";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference, districtAt } from "@/lib/reference";
import daily from "@/data/weather_daily.json";
import { RoadExplorer, type RoadSeg } from "./road-explorer";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.forecast };
}

type Seg = { osm_id: string; name: string | null; highway: string; geometry: { coordinates: [number, number][] } };

// Переходы через 0 °C за последний холодный сезон (ноябрь–март) по Open-Meteo
function lastWinterFreezeThaw() {
  const items = daily.items as { date: string; tmin: number; tmax: number }[];
  const lastDate = items[items.length - 1].date;
  const y = Number(lastDate.slice(0, 4)) - (Number(lastDate.slice(5, 7)) >= 11 ? 0 : 1);
  return items.filter((d) => d.date >= `${y}-11-01` && d.date <= `${y + 1}-03-31` && d.tmin < 0 && d.tmax > 0).length;
}

export default async function ForecastPage() {
  const db = createAdminClient();
  // значимые сегменты (именованные + primary…tertiary) залиты seed-скриптом из OSM;
  // отзывы о состоянии с места — входят в риск и показываются в карточке участка
  const [{ lang, t }, { all }, ref, me, { data }, { data: fbRows }] = await Promise.all([
    getDict(),
    flow(),
    getReference(),
    getProfile(),
    db.from("road_segments").select("osm_id, name, highway_class, geometry").limit(2000),
    db.from("road_feedback").select("osm_id, user_id, verdict"),
  ]);
  const segs: Seg[] = (data ?? []).map((r) => ({ osm_id: r.osm_id, name: r.name, highway: r.highway_class, geometry: r.geometry }));
  const now = new Date().getTime();
  const complaints = all.filter((r) => ["road_pit", "excavation"].includes(r.category) && now - new Date(r.created_at).getTime() < 90 * 86400_000);
  const ft = lastWinterFreezeThaw();
  const votes = new Map<string, RoadVotes>();
  const mine = new Map<string, keyof RoadVotes>();
  for (const f of fbRows ?? []) {
    const v = votes.get(f.osm_id) ?? { potholes: 0, cracks: 0, ok: 0, repaired: 0 };
    v[f.verdict as keyof RoadVotes]++;
    votes.set(f.osm_id, v);
    if (me && f.user_id === me.id) mine.set(f.osm_id, f.verdict as keyof RoadVotes);
  }
  const top = roadRisk(segs, complaints, ft, votes).slice(0, 30);
  const d = (iso: string) => new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Aqtau" });

  // у многих магистралей в OSM нет названия — подписываем классом дороги и микрорайоном
  const CLASS: Record<string, [string, string]> = {
    trunk: ["Трасса", "Тас жол"], primary: ["Магистраль", "Магистраль"], secondary: ["Городская улица", "Қала көшесі"],
    tertiary: ["Улица", "Көше"], residential: ["Внутриквартальный проезд", "Квартал ішіндегі жол"],
  };
  const label = (s: (typeof top)[number]) => {
    if (s.name) return s.name;
    const mid = s.coords[Math.floor(s.coords.length / 2)];
    const d = districtAt({ lat: mid[1], lng: mid[0] }, ref.districts);
    const cls = CLASS[s.highway]?.[lang === "kz" ? 1 : 0] ?? s.highway;
    return d ? `${cls} · ${lang === "kz" ? d.name_kz : d.name_ru}` : cls;
  };
  // для каждого участка — обращения, которые на нём лежат (≤40 м), чтобы показать их в разборе
  const view: RoadSeg[] = top.map((s) => ({
    ...s,
    name: label(s),
    votes: votes.get(s.osm_id) ?? { potholes: 0, cracks: 0, ok: 0, repaired: 0 },
    mine: mine.get(s.osm_id) ?? null,
    nearby: complaints
      .filter((r) => distToLine(r, s.coords) <= 40)
      .slice(0, 6)
      .map((r) => ({ no: r.public_no, title: titleOf(r, lang), status: r.status, statusLabel: t.status[r.status as keyof typeof t.status] ?? r.status, date: d(r.created_at) })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.akimat.forecast.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{tf(t.akimat.forecast.intro, { n: segs.length, ft })}</p>
        <p className="mt-2 text-xs font-medium text-primary">{t.akimat.forecast.pick}</p>
      </div>
      <RoadExplorer segs={view} ft={ft} loggedIn={!!me} t={t.akimat.forecast} />
    </div>
  );
}
