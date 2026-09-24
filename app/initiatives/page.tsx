import Link from "next/link";
import { Landmark } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { INITIATIVE_THRESHOLD } from "@/lib/initiatives";
import { LiveRefresh } from "@/components/live-refresh";
import { cn } from "@/lib/utils";
import { VoteBlock, ProposeForm, DecideForm } from "./parts";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.initiatives.title };
}

const STATUS_TONE: Record<string, string> = {
  voting: "bg-[#5aa9e6]/12 text-[#2b77b3] dark:text-[#8cc6f2]",
  review: "bg-[color:var(--warn)]/15 text-[color:var(--warn)]",
  planned: "bg-primary/12 text-primary",
  done: "bg-[color:var(--ok)]/15 text-[color:var(--ok)]",
  declined: "bg-muted text-muted-foreground",
};
const ORDER = ["voting", "review", "planned", "done", "declined"];

// Инициативы жителей — «что сделать лучше», а не только «что сломалось».
export default async function InitiativesPage({ searchParams }: PageProps<"/initiatives">) {
  const [{ lang, t }, me, ref, sp] = await Promise.all([getDict(), getProfile(), getReference(), searchParams]);
  const tt = t.initiatives;
  const filter = typeof sp.s === "string" && ORDER.includes(sp.s) ? sp.s : null;
  const db = createAdminClient();
  const [{ data: list }, { data: mine }] = await Promise.all([
    db.from("initiatives").select("*").order("votes_count", { ascending: false }).limit(200),
    me ? db.from("initiative_votes").select("initiative_id").eq("user_id", me.id) : Promise.resolve({ data: [] as { initiative_id: number }[] }),
  ]);
  const voted = new Set((mine ?? []).map((v) => v.initiative_id));
  const items = (list ?? [])
    .filter((i) => !filter || i.status === filter)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.votes_count - a.votes_count);
  const counts = Object.fromEntries(ORDER.map((s) => [s, (list ?? []).filter((i) => i.status === s).length]));
  const staff = !!me && ["akimat", "operator"].includes(me.role);
  const n = new Intl.NumberFormat("ru-RU");
  const districts = ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, name: lang === "kz" ? d.name_kz : d.name_ru }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <LiveRefresh table="initiatives" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{tt.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{tt.sub}</p>
          <p className="mt-2 text-xs font-medium text-primary">{fmt(tt.threshold, { n: INITIATIVE_THRESHOLD })}</p>
        </div>
        {me ? (
          <ProposeForm t={tt} districts={districts} />
        ) : (
          <Link href="/login?next=/initiatives" className="text-sm text-primary hover:underline">
            {tt.loginToVote}
          </Link>
        )}
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {[null, ...ORDER].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/initiatives?s=${s}` : "/initiatives"}
            className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {s ? tt.status[s as keyof typeof tt.status] : tt.all}
            <span className="ml-1.5 tabular-nums opacity-70">{s ? counts[s] : (list ?? []).length}</span>
          </Link>
        ))}
      </nav>

      <ul className="flex flex-col gap-3">
        {items.map((i) => {
          const d = i.district_id ? ref.districtById.get(i.district_id) : null;
          return (
            <li key={i.id} id={`i-${i.id}`} className="scroll-mt-20 rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cn("rounded-full px-2.5 py-0.5 font-medium", STATUS_TONE[i.status])}>{tt.status[i.status as keyof typeof tt.status]}</span>
                <span className="text-muted-foreground">{tt.kind[i.kind as keyof typeof tt.kind]}</span>
                {d && <span className="text-muted-foreground">· {lang === "kz" ? d.name_kz : d.name_ru}</span>}
                {i.demo && <span className="rounded border px-1.5 text-[10px] text-muted-foreground uppercase">{tt.demo}</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-balance">{lang === "kz" && i.title_kz ? i.title_kz : i.title}</h2>
              {(i.description || i.description_kz) && <p className="mt-1 text-sm text-muted-foreground text-pretty">{lang === "kz" && i.description_kz ? i.description_kz : i.description}</p>}

              <div className="mt-4">
                <VoteBlock id={i.id} votes={i.votes_count} voted={voted.has(i.id)} canVote={i.status === "voting" || i.status === "review"} loggedIn={!!me} threshold={INITIATIVE_THRESHOLD} t={tt} />
              </div>

              {(i.akimat_reply || i.budget_kzt) && (
                <div className="mt-4 flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-sm">
                  <Landmark className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs font-semibold text-primary">{tt.akimat}</div>
                    {i.akimat_reply && <p className="mt-0.5 text-pretty">{lang === "kz" && i.akimat_reply_kz ? i.akimat_reply_kz : i.akimat_reply}</p>}
                    {i.budget_kzt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tt.budget}: <span className="font-medium text-foreground tabular-nums">{n.format(i.budget_kzt)} ₸</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {staff && <DecideForm id={i.id} status={i.status} reply={i.akimat_reply ?? ""} budget={i.budget_kzt} t={tt} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
