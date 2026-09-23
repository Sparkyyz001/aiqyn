import Link from "next/link";
import { flow } from "@/lib/data";
import { getReference } from "@/lib/reference";
import { painIndex, MIN_REPORTS } from "@/lib/pain-index";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { PainSwatch } from "@/components/akimat/pain-parts";

// Как это обращение сдвинуло индекс боли своего района: считаем индекс с ним и без него.
// Так видно, что индекс живой: новая жалоба сразу меняет цифру района.
export async function PainContribution({ reportId, district, t }: { reportId: number; district: string | null; t: Dict["pain"] }) {
  if (!district) return null;
  const [{ all }, ref] = await Promise.all([flow(), getReference()]);
  const districts = ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, population: d.population }));
  const withIt = painIndex(all, districts).find((r) => r.district === district);
  const without = painIndex(all.filter((r) => r.id !== reportId), districts).find((r) => r.district === district);
  if (!withIt) return null;

  return (
    <section className="rounded-lg border p-3 text-sm">
      <div className="text-xs text-muted-foreground">{t.contribution}</div>
      {withIt.insufficient ? (
        <p className="mt-1">{fmt(t.needMore, { n: Math.max(1, MIN_REPORTS - withIt.reports90) })}</p>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2">
            <PainSwatch index={withIt.index} />
            <span className="font-medium tabular-nums">{fmt(t.withWithout, { a: without?.index ?? "—", b: withIt.index ?? "—" })}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {fmt(t.rawWithWithout, { a: Math.round(without?.raw ?? 0), b: Math.round(withIt.raw ?? 0) })}
          </div>
        </>
      )}
      <Link href={`/district/${district}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">{t.openDistrict} →</Link>
    </section>
  );
}
