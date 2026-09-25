import Link from "next/link";
import { PushToggle } from "@/components/notifications/push-toggle";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";
import { MarkAllRead } from "./mark-all";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.notify.title };
}

const TONE = { info: "bg-[#5aa9e6]", ok: "bg-[color:var(--ok)]", warn: "bg-[color:var(--warn)]", danger: "bg-[color:var(--danger)]" } as const;

// Все уведомления пользователя: история того, что происходило с его обращениями
// (или, для акимата и служб, — с обращениями города).
export default async function NotificationsPage() {
  await requireRole();
  const [{ lang, t }, db] = await Promise.all([getDict(), createClient()]);
  const { data } = await db
    .from("notifications")
    .select("id, title, title_kz, body, body_kz, link, tone, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).map((n) => n.id);
  const dt = (iso: string) => new Date(iso).toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Aqtau" });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <LiveRefresh table="notifications" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.notify.title}</h1>
        {unread.length > 0 && <MarkAllRead ids={unread} label={t.notify.markAll} />}
      </div>
      <div className="mt-4">
        <PushToggle l={t.notify.push} />
      </div>
      <ul className="mt-5 overflow-hidden rounded-xl border">
        {items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t.notify.empty}</li>}
        {items.map((n) => (
          <li key={n.id} className="border-b last:border-b-0">
            <Link href={n.link ?? "#"} className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-accent/50", !n.read_at && "bg-accent/25")}>
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.read_at ? "bg-muted-foreground/30" : TONE[n.tone as keyof typeof TONE])} />
              <span className="min-w-0 flex-1">
                <span className={cn("block leading-snug", !n.read_at && "font-semibold")}>{lang === "kz" && n.title_kz ? n.title_kz : n.title}</span>
                {(n.body || n.body_kz) && <span className="mt-1 block text-sm text-muted-foreground text-pretty">{lang === "kz" && n.body_kz ? n.body_kz : n.body}</span>}
                <span className="mt-1 block text-xs text-muted-foreground/80 tabular-nums">{dt(n.created_at)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
