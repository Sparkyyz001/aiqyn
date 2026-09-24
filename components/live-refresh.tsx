"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Подписка на Supabase Realtime: любое изменение обращений → перерисовать страницу.
// Используется на лендинге, карте, дашборде и в очередях — цифры двигаются вживую.
export function LiveRefresh({
  table = "reports",
  filter,
  toastText,
}: {
  table?: "reports" | "report_events" | "incidents" | "notifications" | "initiatives";
  filter?: string;
  toastText?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    // Realtime фильтрует строки по RLS: сначала передаём токен входа (если есть), потом подписываемся
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (!alive) return;
      channel = supabase
        .channel(`live-${table}-${filter ?? "all"}`)
        .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (toastText) toast.info(toastText);
            router.refresh();
          }, 400);
        })
        .subscribe();
    })();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, table, filter, toastText]);

  return null;
}
