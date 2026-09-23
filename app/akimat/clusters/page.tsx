import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow, titleOf } from "@/lib/data";
import { flowClusters } from "@/lib/flow-clusters";
import { CLUSTER_EPS_M, CLUSTER_MIN_PTS } from "@/lib/clustering";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";
import { CityMap } from "@/components/map/map";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.clusters };
}

const color = (s: number) => (s >= 0.8 ? "#d0452f" : s >= 0.5 ? "#d69a1b" : "#2f6fa3");

export default async function ClustersPage() {
  const [{ lang, t }, { all }] = await Promise.all([getDict(), flow()]);
  const clusters = flowClusters(all);
  const top = clusters.slice(0, 20);
  const fmt = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.akimat.clusters.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {tf(t.akimat.clusters.intro, { eps: CLUSTER_EPS_M, min: CLUSTER_MIN_PTS })}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CityMap
          className="h-[420px] w-full"
          circles={clusters.map((c) => ({
            lat: c.lat, lng: c.lng, radius: Math.max(50, c.radius_m) + c.count * 6, color: color(c.chronic_score),
            label: tf(t.akimat.clusters.popup, { label: c.label ?? "", cat: nm(CATEGORY[c.category], lang), n: c.count, s: c.chronic_score }),
          }))}
        />
      </div>
      <section className="overflow-x-auto rounded-lg border">
        <h2 className="border-b px-4 py-2.5 font-medium">{t.akimat.clusters.top}</h2>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-normal">{t.akimat.clusters.point}</th>
              <th className="px-2 py-2 font-normal">{t.akimat.clusters.category}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.clusters.reports}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.clusters.open}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.clusters.reopened}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.clusters.downtime}</th>
              <th className="px-2 py-2 font-normal">{t.akimat.clusters.period}</th>
              <th className="px-4 py-2 text-right font-normal">{t.akimat.clusters.chronic}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {top.map((c) => (
              <tr key={c.key} className="align-top">
                <td className="px-4 py-2">
                  <details>
                    <summary className="cursor-pointer font-medium">{c.label ?? nm(DISTRICT[c.district ?? ""], lang)}</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {c.members.slice(0, 8).map((m) => (
                        <li key={m.id}>
                          {m.demo ? m.no : <Link className="text-primary hover:underline" href={`/report/${m.no}`}>{m.no}</Link>} · {fmt(m.created_at)} · {titleOf(m, lang)}
                        </li>
                      ))}
                      {c.members.length > 8 && <li>{tf(t.akimat.clusters.more, { n: c.members.length - 8 })}</li>}
                    </ul>
                  </details>
                  <div className="text-xs text-muted-foreground">{nm(DISTRICT[c.district ?? ""], lang)}</div>
                </td>
                <td className="px-2 py-2">{nm(CATEGORY[c.category], lang)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{c.count}</td>
                <td className="px-2 py-2 text-right tabular-nums">{c.open}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${c.reopen_total ? "text-[color:var(--danger)]" : ""}`}>{c.reopen_total}</td>
                <td className="px-2 py-2 text-right tabular-nums">{c.downtime_days}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap text-muted-foreground">{fmt(c.first_seen)} — {fmt(c.last_seen)}</td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-1.5 tabular-nums font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: color(c.chronic_score) }} />
                    {c.chronic_score.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
