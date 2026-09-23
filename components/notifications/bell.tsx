"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n/dict";

export type Note = {
  id: number;
  title: string;
  title_kz: string | null;
  body: string | null;
  body_kz: string | null;
  link: string | null;
  tone: "info" | "ok" | "warn" | "danger";
  read_at: string | null;
  created_at: string;
};

const TONE = {
  info: "bg-[#5aa9e6]",
  ok: "bg-[color:var(--ok)]",
  warn: "bg-[color:var(--warn)]",
  danger: "bg-[color:var(--danger)]",
};

export const noteText = (n: Note, lang: "ru" | "kz") => ({
  title: lang === "kz" && n.title_kz ? n.title_kz : n.title,
  body: lang === "kz" && n.body_kz ? n.body_kz : n.body,
});

export function timeAgo(iso: string, lang: "ru" | "kz") {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === "kz" ? "kk" : "ru", {
    numeric: "auto",
  });
  if (s < 60) return rtf.format(-Math.round(s), "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

// Колокольчик: последние уведомления пользователя, счётчик непрочитанных и
// всплывающее сообщение, как только в базе появляется новое (Supabase Realtime).
export function NotificationBell({
  userId,
  lang,
  t,
}: {
  userId: string;
  lang: "ru" | "kz";
  t: Dict["notify"];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, title, title_kz, body, body_kz, link, tone, read_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Note[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    // Realtime отдаёт строки с учётом RLS — поэтому сначала передаём токен входа, потом подписываемся
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (!alive) return;
      ch = supabase
        .channel(`notes-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (p) => {
            const n = p.new as Note;
            setItems((prev) => [n, ...prev].slice(0, 20));
            const { title, body } = noteText(n, lang);
            toast(title, {
              description: body ?? undefined,
              duration: 9000,
              action: n.link
                ? { label: t.open, onClick: () => router.push(n.link!) }
                : undefined,
            });
            router.refresh();
          },
        )
        .subscribe();
    })();
    return () => {
      alive = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, [userId, lang, t.open, router, load]);

  const markRead = async (ids: number[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n,
      ),
    );
    await createClient()
      .from("notifications")
      .update({ read_at: now })
      .in("id", ids);
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t.title}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff907d] px-1 text-[10px] font-bold text-[#063c40] tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[1300] w-[min(24rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">{t.title}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() =>
                markRead(items.filter((n) => !n.read_at).map((n) => n.id))
              }
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> {t.markAll}
            </button>
          )}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t.empty}
            </li>
          )}
          {items.map((n) => {
            const { title, body } = noteText(n, lang);
            return (
              <li key={n.id} className="border-b last:border-b-0">
                <Link
                  href={n.link ?? "/notifications"}
                  onClick={() => markRead([n.id])}
                  className={cn(
                    "flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/60",
                    !n.read_at && "bg-accent/30",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read_at ? "bg-muted-foreground/30" : TONE[n.tone],
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm leading-snug",
                        !n.read_at && "font-semibold",
                      )}
                    >
                      {title}
                    </span>
                    {body && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {body}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                      {timeAgo(n.created_at, lang)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/notifications"
          className="block border-t px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t.all}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
