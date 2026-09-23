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
  table?: "reports" | "report_events" | "incidents";
  filter?: string;
  toastText?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${table}-${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (toastText) toast.info(toastText);
          router.refresh();
        }, 400);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router, table, filter, toastText]);

  return null;
}
