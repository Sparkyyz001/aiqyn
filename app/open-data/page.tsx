import { getDict } from "@/lib/i18n/server";
import { realReports } from "@/lib/data";
import { kpis } from "@/lib/stats";

export const metadata = { title: "Открытые данные" };

const SOURCES = [
  { what: "Микрорайоны (84, с границами), дороги, 18 тыс. адресов, школы, садики, больницы, остановки, промзона, пляжи", src: "OpenStreetMap через Overpass API", lic: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright" },
  { what: "Почасовой ветер и температура за 90 дней, суточные температуры за 3 года", src: "Open-Meteo Historical Weather API", lic: "CC BY 4.0", url: "https://open-meteo.com/" },
  { what: "Реестр ответственных организаций", src: "goszakup.gov.kz (реестр поставщиков), mrek.kz, lada.kz, 2ГИС", lic: "факты со ссылками", url: "https://www.goszakup.gov.kz/" },
  { what: "Кейсы жителей Актау", src: "lada.kz, inaktau.kz, newsroom.kz, tengrinews.kz, time.kz", lic: "цитирование со ссылкой", url: "https://www.lada.kz/" },
  { what: "Госзакупки по благоустройству", src: "goszakup.gov.kz OWS v2/v3 (токен выдаёт ЦЭФ по заявке)", lic: "открытые данные", url: "https://ows.goszakup.gov.kz/help/" },
];

export default async function OpenDataPage() {
  const [{ t }, real] = await Promise.all([getDict(), realReports()]);
  const k = kpis(real);
  const base = "/api/public/v1/reports";
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-xl font-semibold">{t.nav.openData}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Прозрачность — суть AIQYN: все обращения публичны, а данные можно забрать машинно. Персональные данные заявителей
        в открытый API не попадают. Демо-подложка в API не входит — только реальные обращения ({k.total} сейчас).
      </p>

      <section className="mt-6">
        <h2 className="font-medium">Открытый API</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
          <div>GET {base}</div>
          <div>GET {base}?status=open&amp;category=road_pit&amp;district=mkr-3</div>
          <div>GET {base}?since=2026-09-01&amp;limit=500</div>
          <div>GET {base}?format=geojson</div>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          <li><code className="text-xs">status</code> — new, routed, accepted, in_progress, awaiting_confirmation, resolved, rejected, reopened или open</li>
          <li><code className="text-xs">category</code> — road_pit, excavation, water_outage, sewage, heating, power_outage, lighting, garbage, smell, yard, transport, beach, other</li>
          <li><code className="text-xs">district</code> — код микрорайона (mkr-3, mkr-15, samal, shygys-1…)</li>
          <li><code className="text-xs">format=geojson</code> — FeatureCollection для ГИС (QGIS, ArcGIS, 2ГИС)</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a className="text-primary hover:underline" href={base} target="_blank">JSON →</a>
          <a className="text-primary hover:underline" href={`${base}?format=geojson`} target="_blank">GeoJSON →</a>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Источники данных</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-normal">Что</th>
                <th className="px-3 py-2 font-normal">Источник</th>
                <th className="px-3 py-2 font-normal">Лицензия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SOURCES.map((s) => (
                <tr key={s.what}>
                  <td className="px-3 py-2">{s.what}</td>
                  <td className="px-3 py-2"><a className="text-primary hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.src}</a></td>
                  <td className="px-3 py-2 text-muted-foreground">{s.lic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Синтетика используется только в демо-подложке потока обращений для аналитики и посажена на реальную географию и реальные
          службы. На карте демо-точки отличаются от реальных обращений.
        </p>
      </section>
    </div>
  );
}
