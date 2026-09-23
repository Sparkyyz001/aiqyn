"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveIncident } from "@/lib/actions/incidents";
import type { Dict } from "@/lib/i18n/dict";
import { fmt as tf } from "@/lib/i18n/dict";

type Row = { id: number; title: string; type: string; eta_at: string | null; started_at: string };

export function ActiveIncidents({ incidents, t }: { incidents: Row[]; t: Dict["incident"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-col gap-2">
      <div className="font-medium">{t.active}</div>
      {incidents.length === 0 && <p className="text-sm text-muted-foreground">{t.none}</p>}
      {incidents.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div>
            <div className="font-medium">{i.title}</div>
            <div className="text-xs text-muted-foreground">
              {t.types[i.type as keyof Dict["incident"]["types"]]} · {t.since} {fmt(i.started_at)}
              {i.eta_at && ` · ${t.until} ${fmt(i.eta_at)}`}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await resolveIncident(i.id);
                if (!res.ok) return void toast.error(res.error);
                toast.success(tf(t.resolved, { n: res.data.closed }));
                router.refresh();
              })
            }
          >
            {t.resolve}
          </Button>
        </div>
      ))}
    </div>
  );
}
