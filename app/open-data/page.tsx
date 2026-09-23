import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { realReports } from "@/lib/data";
import { kpis } from "@/lib/stats";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.openData };
}

export default async function OpenDataPage() {
  const [{ t }, real] = await Promise.all([getDict(), realReports()]);
  const k = kpis(real);
  const o = t.openData;
  const base = "/api/public/v1/reports";
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-xl font-semibold">{t.nav.openData}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{fmt(o.intro, { n: k.total })}</p>

      <section className="mt-6">
        <h2 className="font-medium">{o.api}</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
          <div>GET {base}</div>
          <div>GET {base}?status=open&amp;category=road_pit&amp;district=mkr-3</div>
          <div>GET {base}?since=2026-09-01&amp;limit=500</div>
          <div>GET {base}?format=geojson</div>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          <li><code className="text-xs">status</code> — {o.pStatus}</li>
          <li><code className="text-xs">category</code> — {o.pCategory}</li>
          <li><code className="text-xs">district</code> — {o.pDistrict}</li>
          <li><code className="text-xs">format=geojson</code> — {o.pGeojson}</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a className="text-primary hover:underline" href={base} target="_blank">JSON →</a>
          <a className="text-primary hover:underline" href={`${base}?format=geojson`} target="_blank">GeoJSON →</a>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">{o.sources}</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-normal">{o.what}</th>
                <th className="px-3 py-2 font-normal">{o.source}</th>
                <th className="px-3 py-2 font-normal">{o.license}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {o.rows.map(([what, src, lic, url]) => (
                <tr key={url + what}>
                  <td className="px-3 py-2">{what}</td>
                  <td className="px-3 py-2"><a className="text-primary hover:underline" href={url} target="_blank" rel="noopener noreferrer">{src}</a></td>
                  <td className="px-3 py-2 text-muted-foreground">{lic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{o.synthNote}</p>
      </section>
    </div>
  );
}
