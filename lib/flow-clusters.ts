import "server-only";
import { dbscan } from "@/lib/clustering";
import { nearestAddress } from "@/lib/address";
import type { FlowReport } from "@/lib/data";

// Системные узлы по всему потоку (подложка + реальные) — для карты и /akimat/clusters.
// Считаются тем же DBSCAN, что и узлы в БД (lib/clustering.ts).
export type FlowCluster = {
  key: string;
  category: string;
  district: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  count: number;
  reopen_total: number;
  breached: number;
  open: number;
  first_seen: string;
  last_seen: string;
  chronic_score: number;
  label: string | null;
  downtime_days: number;
  members: { id: number; no: string; status: string; demo: boolean; title: string; created_at: string }[];
};

export function flowClusters(all: FlowReport[]): FlowCluster[] {
  const byCat = new Map<string, FlowReport[]>();
  for (const r of all) if (r.status !== "rejected") byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);
  const out: FlowCluster[] = [];
  for (const [category, list] of byCat) {
    const clusters = dbscan(list.map((r) => ({ ...r, breached: r.sla_breached })));
    for (const c of clusters) {
      const now = Date.now();
      // Суммарное время простоя: сколько дней в сумме обращения узла ждали решения
      const downtime = c.members.reduce(
        (s, m) => s + ((m.resolved_at ? new Date(m.resolved_at).getTime() : now) - new Date(m.created_at).getTime()) / 86400_000,
        0
      );
      const districts = c.members.map((m) => m.district).filter(Boolean) as string[];
      const district = districts.sort((a, b) => districts.filter((x) => x === b).length - districts.filter((x) => x === a).length)[0] ?? null;
      out.push({
        key: `${category}:${c.center.lat.toFixed(5)}:${c.center.lng.toFixed(5)}`,
        category,
        district,
        lat: c.center.lat,
        lng: c.center.lng,
        radius_m: c.radius_m,
        count: c.members.length,
        reopen_total: c.reopen_total,
        breached: c.members.filter((m) => m.sla_breached).length,
        open: c.members.filter((m) => !["resolved", "rejected"].includes(m.status)).length,
        first_seen: c.first_seen,
        last_seen: c.last_seen,
        chronic_score: c.chronic_score,
        label: nearestAddress(c.center)?.label ?? null,
        downtime_days: Math.round(downtime),
        members: c.members
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((m) => ({ id: m.id, no: m.public_no, status: m.status, demo: m.demo, title: m.title, created_at: m.created_at })),
      });
    }
  }
  return out.sort((a, b) => b.chronic_score - a.chronic_score || b.count - a.count);
}
