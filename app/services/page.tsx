import Link from "next/link";
import { ExternalLink, MapPin, Phone, Plus } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { StarRating } from "@/components/star-rating";
import { flow } from "@/lib/data";
import { serviceQuality } from "@/lib/stats";
import { CATEGORIES, SERVICES, nm } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.services.title };
}

const OPEN = ["routed", "accepted", "in_progress", "reopened", "awaiting_confirmation"];

// «Службы города» — справочник для жителя: кто за что отвечает, где находится, куда звонить
// в экстренном случае и как служба работает на самом деле (по потоку обращений).
export default async function ServicesPage() {
  const [{ lang, t }, { all }, me, ref] = await Promise.all([getDict(), flow(), getProfile(), getReference()]);
  const { data: ratings } = await createAdminClient().from("service_ratings").select("service_id, user_id, stars");
  const rate = new Map<number, { sum: number; n: number; mine: number | null }>();
  for (const r of ratings ?? []) {
    const a = rate.get(r.service_id) ?? { sum: 0, n: 0, mine: null };
    a.sum += r.stars;
    a.n++;
    if (me && r.user_id === me.id) a.mine = r.stars;
    rate.set(r.service_id, a);
  }
  const s = t.services;
  const q = new Map(serviceQuality(all).map((r) => [r.service, r]));
  const openBy = new Map<string, number>();
  for (const r of all) if (OPEN.includes(r.status)) openBy.set(r.service, (openBy.get(r.service) ?? 0) + 1);
  const n = new Intl.NumberFormat("ru-RU");

  const emergency: [string, string][] = [
    ["112", s.em112],
    ["101", s.em101],
    ["102", s.em102],
    ["103", s.em103],
    ["104", s.em104],
    ["109", s.em109],
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{s.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{s.sub}</p>
      </div>

      <section className="rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/[0.04] p-4">
        <h2 className="text-sm font-semibold">{s.emergency}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {emergency.map(([num, label]) => (
            <li key={num}>
              <a href={`tel:${num}`} className="flex h-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-[color:var(--danger)]/50">
                <span className="text-xl font-bold tabular-nums text-[color:var(--danger)]">{num}</span>
                <span className="text-xs leading-tight text-muted-foreground">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SERVICES.map((svc) => {
          const cats = CATEGORIES.filter((c) => c.default_service === svc.code);
          const m = q.get(svc.code);
          const open = openBy.get(svc.code) ?? 0;
          return (
            <li key={svc.code} className="flex flex-col rounded-2xl border bg-card p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgb(5_62_66/0.45)]">
              <div className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{svc.short}</div>
              <h2 className="mt-1 font-semibold leading-snug text-balance">{lang === "kz" ? svc.name_kz : svc.name_ru}</h2>
              {svc.description && <p className="mt-2 text-sm text-muted-foreground text-pretty">{svc.description}</p>}

              {cats.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cats.map((c) => (
                    <span key={c.code} className="rounded-md bg-muted px-2 py-0.5 text-xs">{nm(c, lang)}</span>
                  ))}
                </div>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-2xl font-semibold tabular-nums">{n.format(open)}</dt>
                  <dd className="text-xs text-muted-foreground">{s.open}</dd>
                </div>
                <div>
                  <dt className="text-2xl font-semibold tabular-nums">{m?.medianDays ?? "—"}</dt>
                  <dd className="text-xs text-muted-foreground">{s.median}</dd>
                </div>
                <div>
                  <dt className={cn("text-lg font-semibold tabular-nums", (m?.breachedShare ?? 0) > 20 && "text-[color:var(--danger)]")}>{m ? `${m.breachedShare}%` : "—"}</dt>
                  <dd className="text-xs text-muted-foreground">{s.breached}</dd>
                </div>
                <div>
                  <dt className={cn("text-lg font-semibold tabular-nums", (m?.boilerShare ?? 0) > 30 && "text-[color:var(--warn)]")}>{m ? `${m.boilerShare}%` : "—"}</dt>
                  <dd className="text-xs text-muted-foreground">{s.boiler}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
                {svc.address && (
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-px size-3.5 shrink-0" /> {svc.address}
                  </span>
                )}
                {svc.contact_phone && (
                  <a href={`tel:${svc.contact_phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Phone className="size-3.5" /> {svc.contact_phone}
                  </a>
                )}
                {svc.source_url && (
                  <a href={svc.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                    <ExternalLink className="size-3.5" /> {s.source}
                  </a>
                )}
              </div>

              {(() => {
                const id = ref.serviceByCode.get(svc.code)?.id;
                const r = id ? rate.get(id) : undefined;
                return (
                  <div className="mt-4 border-t pt-4">
                    <StarRating
                      code={svc.code}
                      avg={r ? r.sum / r.n : 0}
                      count={r?.n ?? 0}
                      mine={r?.mine ?? null}
                      canRate={!!me}
                      l={{ rate: s.rate, yours: s.yours, votes: s.votes, login: s.loginRate, thanks: s.thanks }}
                    />
                  </div>
                );
              })()}

              <Button asChild variant="outline" size="sm" className="mt-4 self-start">
                <Link href="/report/new">
                  <Plus /> {s.report}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t.akimat.flowNote}</p>
    </div>
  );
}
