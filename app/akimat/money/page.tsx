import { Banknote, FileText, Scale, TriangleAlert } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { flow } from "@/lib/data";
import { byKey } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";
import { Kpi } from "@/components/kpi";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.money };
}

// ФИШКА 2: сопоставление фактов — сколько выделено по контрактам и сколько жалоб в районе.
// Формулировки нейтральные: показываем факты рядом, выводы делает акимат.
export default async function MoneyPage() {
  const [{ lang, t }, { all }, ref] = await Promise.all([getDict(), flow(), getReference()]);
  const m = t.akimat.money;
  const db = createAdminClient();
  const { data: contracts } = await db
    .from("procurements")
    .select("contract_no, title, supplier, amount_kzt, signed_at, district_id, source_url, category_hint, raw")
    .order("amount_kzt", { ascending: false });
  const list = contracts ?? [];
  const modelled = list.some((c) => (c.raw as { model?: boolean } | null)?.model);
  const byDistrict = byKey(all, (r) => r.district);

  const sums = new Map<string, { sum: number; n: number }>();
  for (const c of list) {
    const code = c.district_id ? ref.districtById.get(c.district_id)?.code : null;
    if (!code) continue;
    const e = sums.get(code) ?? { sum: 0, n: 0 };
    e.sum += Number(c.amount_kzt ?? 0);
    e.n++;
    sums.set(code, e);
  }
  const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const mln = (x: number) => fmt.format(x / 1e6);
  const total = list.reduce((s, c) => s + Number(c.amount_kzt ?? 0), 0);

  const rows = byDistrict
    .map((d) => ({ ...d, money: sums.get(d.key) }))
    .sort((a, b) => (b.money?.sum ?? 0) - (a.money?.sum ?? 0) || b.total - a.total)
    .slice(0, 30);
  const points = rows.filter((r) => r.money && DISTRICT[r.key]).map((r) => ({ name: nm(DISTRICT[r.key], lang), mln: Math.round(r.money!.sum / 1e6), reports: r.total, breached: r.breached }));
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
  const mx = med(points.map((p) => p.mln));
  const my = med(points.map((p) => p.reports));
  const gap = points.filter((p) => p.mln > mx && p.reports > my).length;
  const everyone = byDistrict
    .filter((r) => DISTRICT[r.key])
    .map((r) => ({ name: nm(DISTRICT[r.key], lang), mln: Math.round((sums.get(r.key)?.sum ?? 0) / 1e6), reports: r.total }));
  const gapList = everyone.filter((p) => p.mln > mx && p.reports > my).sort((a, b) => b.reports / b.mln - a.reports / a.mln).slice(0, 6);
  const needList = everyone.filter((p) => p.mln < mx && p.reports > my).sort((a, b) => b.reports - a.reports).slice(0, 6);
  const maxMln = Math.max(1, ...everyone.map((p) => p.mln));
  const maxRep = Math.max(1, ...everyone.map((p) => p.reports));
  const cityReports = rows.filter((r) => r.money).reduce((s, r) => s + r.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{m.intro}</p>
        {modelled && <p className="mt-2 max-w-3xl text-xs text-muted-foreground">{m.modelNote}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={m.kpiTotal} value={(total / 1e9).toFixed(2)} icon={<Banknote />} />
        <Kpi label={m.kpiContracts} value={fmt.format(list.length)} icon={<FileText />} />
        <Kpi label={m.kpiPerMln} value={total ? (cityReports / (total / 1e6)).toFixed(2) : "—"} icon={<Scale />} />
        <Kpi label={m.kpiGap} value={gap} tone="warn" icon={<TriangleAlert />} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-[#1f7a8c]" />{m.legendMoney}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-[color:var(--danger)]" />{m.legendReports}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: m.gapTitle, sub: m.gapSub, list: gapList, tone: "border-[color:var(--warn)]/40" },
          { title: m.needTitle, sub: m.needSub, list: needList, tone: "border-[color:var(--danger)]/35" },
        ].map((box) => (
          <section key={box.title} className={cn("rounded-xl border-2 bg-card p-4", box.tone)}>
            <h2 className="font-semibold">{box.title}</h2>
            <p className="mb-4 text-xs text-muted-foreground text-pretty">{box.sub}</p>
            <ol className="flex flex-col gap-3">
              {box.list.map((p) => (
                <li key={p.name} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 rounded-full bg-[#1f7a8c] transition-[width] duration-700" style={{ width: `${Math.max(2, (p.mln / maxMln) * 100)}%` }} />
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt.format(p.mln)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 rounded-full bg-[color:var(--danger)] transition-[width] duration-700" style={{ width: `${Math.max(2, (p.reports / maxRep) * 100)}%` }} />
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.reports}</span>
                    </span>
                  </span>
                </li>
              ))}
              {box.list.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
            </ol>
          </section>
        ))}
      </div>

      <h2 className="-mb-3 font-semibold">{m.allTitle}</h2>
      <section className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{m.district}</th>
              <th className="px-2 py-2 text-right font-medium">{m.contracts}</th>
              <th className="px-2 py-2 text-right font-medium">{m.reports}</th>
              <th className="px-2 py-2 text-right font-medium">{m.breached}</th>
              <th className="px-4 py-2 text-right font-medium">{m.perMln}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const hot = r.money && r.money.sum / 1e6 > mx && r.total > my;
              return (
                <tr key={r.key} className={cn("transition-colors hover:bg-accent/40", hot && "bg-[color:var(--warn)]/[0.06]")}>
                  <td className="px-4 py-2 font-medium">{nm(DISTRICT[r.key], lang)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.money ? `${mln(r.money.sum)} (${r.money.n})` : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[color:var(--danger)]">{r.breached}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.money && r.money.sum > 0 ? (r.total / (r.money.sum / 1e6)).toFixed(2) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {list.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 font-semibold">{m.biggest}</h2>
          <ul className="divide-y text-sm">
            {list.slice(0, 12).map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{mln(Number(c.amount_kzt ?? 0))} {m.mln}</span>
                <a className="min-w-0 flex-1 text-primary hover:underline" href={c.source_url} target="_blank" rel="noopener noreferrer">{c.title}</a>
                <span className="text-xs text-muted-foreground">
                  {[c.contract_no, c.supplier, c.category_hint && CATEGORY[c.category_hint] ? nm(CATEGORY[c.category_hint], lang) : null, c.signed_at].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
