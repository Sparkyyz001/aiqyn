import Link from "next/link";
import { Copy, Inbox, PhoneCall, Radio, Siren } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { getReference } from "@/lib/reference";
import { createAdminClient } from "@/lib/supabase/admin";
import { flow, titleOf } from "@/lib/data";
import { haversine } from "@/lib/geo";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kpi } from "@/components/kpi";
import { LiveRefresh } from "@/components/live-refresh";
import { IncidentForm } from "./incident-form";
import { ActiveIncidents } from "./active-incidents";
import { CallForm } from "./call-form";
import { OperatorFeed, type FeedItem } from "./feed";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.operator };
}

const DAY = 86_400_000;
const OPEN = ["routed", "accepted", "in_progress", "reopened"];

// Пульт оператора 109: входящий поток всех каналов, звонок/пост за минуту (без фото),
// подозрения на дубли и аварии — то, что по ТЗ делает оператор-модератор.
export default async function OperatorPage() {
  await requireRole("operator", "akimat");
  const [{ lang, t }, ref, { all }] = await Promise.all([getDict(), getReference(), flow()]);
  const o = t.operator;
  const db = createAdminClient();
  const { data: incidents } = await db.from("incidents").select("id, title, type, eta_at, started_at").eq("status", "active").order("started_at", { ascending: false });

  const now = new Date().getTime();
  const day = all.filter((r) => now - new Date(r.created_at).getTime() < DAY);
  const feed: FeedItem[] = [...all]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 200)
    .map((r) => ({
      no: r.public_no,
      title: titleOf(r, lang),
      meta: [nm(CATEGORY[r.category], lang), r.district && DISTRICT[r.district] ? nm(DISTRICT[r.district], lang) : null, SERVICE[r.service]?.short].filter(Boolean).join(" · "),
      source: r.source,
      status: r.status,
      statusLabel: t.status[r.status as keyof typeof t.status] ?? r.status,
      created: r.created_at,
      breached: r.sla_breached && !["resolved", "rejected"].includes(r.status),
      due: r.sla_due_at,
    }));

  // дубли: открытые обращения одной категории ближе 120 м, поданные в пределах 30 дней
  const open = all.filter((r) => OPEN.includes(r.status));
  const dups: { a: (typeof open)[number]; b: (typeof open)[number]; d: number }[] = [];
  for (let i = 0; i < open.length; i++)
    for (let j = i + 1; j < open.length; j++) {
      const a = open[i];
      const b = open[j];
      if (a.category !== b.category) continue;
      if (Math.abs(+new Date(a.created_at) - +new Date(b.created_at)) > 30 * DAY) continue;
      const d = haversine(a, b);
      if (d <= 120) dups.push({ a, b, d: Math.round(d) });
    }
  dups.sort((x, y) => x.d - y.d);

  const n = new Intl.NumberFormat("ru-RU");

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 lg:px-6">
      <LiveRefresh />
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.nav.operator}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{o.console}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{o.consoleSub}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={o.kpiToday} value={n.format(day.length)} hint={`${n.format(day.filter((r) => r.source === "call109" || r.source === "instagram").length)} ${o.kpiChannels}`} icon={<Radio />} />
        <Kpi label={o.kpiNew} value={n.format(all.filter((r) => r.status === "routed").length)} tone="warn" icon={<Inbox />} />
        <Kpi label={o.kpiDups} value={n.format(dups.length)} icon={<Copy />} />
        <Kpi label={o.kpiIncidents} value={n.format(incidents?.length ?? 0)} tone={incidents?.length ? "danger" : undefined} icon={<Siren />} />
      </div>

      {/* на телефоне — переходы между частями пульта, чтобы не теряться в длинной странице */}
      <nav className="sticky top-14 z-20 -mx-4 flex gap-1.5 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        {[["#feed", o.ff.jump[0]], ["#call", o.ff.jump[1]], ["#dups", o.ff.jump[2]]].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium active:bg-accent">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
        {/* Входящий поток */}
        <section id="feed" className="scroll-mt-28 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-semibold">{o.feed}</h2>
              <p className="text-xs text-muted-foreground">{o.feedSub}</p>
            </div>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--ok)] opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[color:var(--ok)]" />
            </span>
          </div>
          <OperatorFeed
            items={feed}
            lang={lang}
            l={{ ch: o.ch as Record<string, string>, all: o.ff.all, fNew: o.ff.fNew, fWork: o.ff.fWork, fLate: o.ff.fLate, today: o.ff.today, yesterday: o.ff.yesterday, earlier: o.ff.earlier, more: o.ff.more, empty: o.ff.empty, late: o.ff.late, due: o.ff.due }}
          />
        </section>

        {/* Звонок / пост / авария */}
        <section id="call" className="scroll-mt-28 rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:self-start">
          <Tabs defaultValue="call">
            <TabsList className="mb-4">
              <TabsTrigger value="call">
                <PhoneCall className="size-4" /> {o.tabReport}
              </TabsTrigger>
              <TabsTrigger value="incident">
                <Siren className="size-4" /> {o.tabIncident}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="call">
              <CallForm lang={lang} t={o} />
            </TabsContent>
            <TabsContent value="incident" className="flex flex-col gap-6">
              <IncidentForm t={t.incident} lang={lang} districts={ref.districts.filter((d) => d.polygon && d.kind !== "zone").map((d) => ({ id: d.id, name: lang === "kz" ? d.name_kz : d.name_ru }))} />
              <ActiveIncidents t={t.incident} incidents={incidents ?? []} />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      {/* Подозрения на дубли */}
      <section id="dups" className="scroll-mt-28 overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">{o.dups}</h2>
          <p className="text-xs text-muted-foreground">{o.dupsSub}</p>
        </div>
        <ul className="divide-y">
          {dups.slice(0, 8).map(({ a, b, d }) => (
            <li key={`${a.id}-${b.id}`} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <Link href={`/report/${a.public_no}`} className="min-w-0 hover:underline">
                <span className="line-clamp-1 font-medium">{titleOf(a, lang)}</span>
                <span className="font-mono text-xs text-muted-foreground">{a.public_no}</span>
              </Link>
              <span className="justify-self-start rounded-full border px-2 py-0.5 text-xs text-muted-foreground tabular-nums sm:justify-self-center">{fmt(o.distance, { n: d })}</span>
              <Link href={`/report/${b.public_no}`} className="min-w-0 hover:underline sm:text-right">
                <span className="line-clamp-1 font-medium">{titleOf(b, lang)}</span>
                <span className="font-mono text-xs text-muted-foreground">{b.public_no}</span>
              </Link>
            </li>
          ))}
          {dups.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">{o.empty}</li>}
        </ul>
      </section>
    </div>
  );
}
