import { getDict } from "@/lib/i18n/server";
import { flow } from "@/lib/data";
import { byKey } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { DISTRICT, nm } from "@/lib/meta";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.money };
}

// ФИШКА 2: сопоставление фактов — сколько выделено по контрактам и сколько жалоб в районе.
// Формулировки нейтральные: показываем факты рядом, выводы делает акимат.
export default async function MoneyPage() {
  const [{ lang, t }, { all }, ref] = await Promise.all([getDict(), flow(), getReference()]);
  const db = createAdminClient();
  const { data: contracts } = await db.from("procurements").select("contract_no, title, supplier, amount_kzt, signed_at, district_id, source_url").order("amount_kzt", { ascending: false });
  const byDistrict = byKey(all, (r) => r.district);

  const sums = new Map<string, { sum: number; n: number }>();
  for (const c of contracts ?? []) {
    const code = c.district_id ? ref.districtById.get(c.district_id)?.code : null;
    if (!code) continue;
    const e = sums.get(code) ?? { sum: 0, n: 0 };
    e.sum += Number(c.amount_kzt ?? 0);
    e.n++;
    sums.set(code, e);
  }
  const hasMoney = (contracts ?? []).length > 0;
  const fmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const mln = (x: number) => fmt.format(x / 1e6);

  const rows = byDistrict
    .map((d) => ({ ...d, money: sums.get(d.key) }))
    .sort((a, b) => (b.money?.sum ?? 0) - (a.money?.sum ?? 0) || b.total - a.total)
    .slice(0, 30);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.akimat.money.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t.akimat.money.intro}
        </p>
      </div>

      {!hasMoney && (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <div className="font-medium">{t.akimat.money.emptyTitle}</div>
          <p className="mt-1 text-muted-foreground">
            {t.akimat.money.emptyText}
          </p>
        </div>
      )}

      <section className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-normal">{t.akimat.money.district}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.money.contracts}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.money.reports}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.money.breached}</th>
              <th className="px-4 py-2 text-right font-normal">{t.akimat.money.perMln}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2">{nm(DISTRICT[r.key], lang)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.money ? `${mln(r.money.sum)} (${r.money.n})` : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.breached}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.money && r.money.sum > 0 ? (r.total / (r.money.sum / 1e6)).toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {hasMoney && (
        <section className="rounded-lg border">
          <h2 className="border-b px-4 py-2.5 font-medium">{t.akimat.money.biggest}</h2>
          <ul className="divide-y text-sm">
            {(contracts ?? []).slice(0, 15).map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2">
                <span className="w-28 shrink-0 text-right font-medium tabular-nums">{mln(Number(c.amount_kzt ?? 0))} {t.akimat.money.mln}</span>
                <a className="min-w-0 flex-1 text-primary hover:underline" href={c.source_url} target="_blank" rel="noopener noreferrer">{c.title}</a>
                <span className="text-xs text-muted-foreground">{c.contract_no} · {c.supplier} · {c.signed_at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
