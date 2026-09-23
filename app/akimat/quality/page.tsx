import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow } from "@/lib/data";
import { serviceQuality } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { boilerplateScore, BOILERPLATE_THRESHOLD } from "@/lib/boilerplate";
import { SERVICE, nm } from "@/lib/meta";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.quality };
}


export default async function QualityPage() {
  const [{ lang, t }, { all }, ref] = await Promise.all([getDict(), flow(), getReference()]);
  const rows = serviceQuality(all);
  const db = createAdminClient();
  const { data: replies } = await db
    .from("service_replies")
    .select("id, text, boilerplate_score, service_id, created_at")
    .order("boilerplate_score", { ascending: false })
    .limit(6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.akimat.quality.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {tf(t.akimat.quality.intro, { p: Math.round(BOILERPLATE_THRESHOLD * 100) })}
        </p>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.service} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">{SERVICE[r.service]?.short}</div>
            <div className="text-xs text-muted-foreground">{nm(SERVICE[r.service], lang)}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">{t.akimat.quality.reports}</dt><dd className="text-right tabular-nums">{r.total}</dd>
              <dt className="text-muted-foreground">{t.akimat.quality.breached}</dt><dd className="text-right tabular-nums">{r.breachedShare}</dd>
              <dt className="text-muted-foreground">{t.akimat.quality.reopened}</dt><dd className="text-right tabular-nums">{r.reopenShare} ({r.reopenTotal})</dd>
              <dt className="text-muted-foreground">{t.akimat.quality.boiler}</dt><dd className="text-right tabular-nums">{r.boilerShare}</dd>
              <dt className="text-muted-foreground">{t.akimat.quality.unverified}</dt><dd className="text-right tabular-nums">{r.unverifiedPhotoShare}</dd>
              <dt className="text-muted-foreground">{t.akimat.quality.median}</dt><dd className="text-right tabular-nums">{r.medianDays}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <section className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-normal">{t.akimat.quality.service}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.quality.reports}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.quality.breached}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.quality.reopened}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.quality.boiler}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.quality.unverified}</th>
              <th className="px-4 py-2 text-right font-normal">{t.akimat.quality.median}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.service}>
                <td className="px-4 py-2">
                  <div className="font-medium">{SERVICE[r.service]?.short}</div>
                  <div className="text-xs text-muted-foreground">{nm(SERVICE[r.service], lang)}</div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.breachedShare}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.reopenShare} <span className="text-xs text-muted-foreground">({r.reopenTotal})</span></td>
                <td className="px-2 py-2 text-right tabular-nums">{r.boilerShare}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.unverifiedPhotoShare}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.medianDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-medium">{t.akimat.quality.examples}</h2>
        {(replies ?? []).length ? (
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {(replies ?? []).map((rep) => {
              const b = boilerplateScore(rep.text);
              return (
                <li key={rep.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{ref.serviceById.get(rep.service_id)?.short_name}</span>
                    <span className={`tabular-nums ${(rep.boilerplate_score ?? 0) >= BOILERPLATE_THRESHOLD ? "text-[color:var(--warn)]" : ""}`}>
                      {Math.round((rep.boilerplate_score ?? 0) * 100)}%
                    </span>
                  </div>
                  <p className="mt-1">«{rep.text}»</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs">
                    {b.markers.map((m) => <span key={m} className="rounded bg-warn/15 px-1.5 py-0.5">{m}</span>)}
                    {b.missing.map((m) => <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{t.akimat.quality.missing[m]}</span>)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t.akimat.quality.noReplies}</p>
        )}
      </section>
    </div>
  );
}
