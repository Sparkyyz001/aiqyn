"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveIncident } from "@/lib/actions/incidents";
import { INCIDENT_TYPES } from "@/lib/incidents";

type Row = { id: number; title: string; type: string; eta_at: string | null; started_at: string };

export function ActiveIncidents({ incidents }: { incidents: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-col gap-2">
      <div className="font-medium">Активные аварии</div>
      {incidents.length === 0 && <p className="text-sm text-muted-foreground">Нет</p>}
      {incidents.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div>
            <div className="font-medium">{i.title}</div>
            <div className="text-xs text-muted-foreground">
              {INCIDENT_TYPES.find((x) => x.code === i.type)?.ru} · с {fmt(i.started_at)}
              {i.eta_at && ` · до ${fmt(i.eta_at)}`}
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
                toast.success(`Авария закрыта. На подтверждение жителям: ${res.data.closed}`);
                router.refresh();
              })
            }
          >
            Устранена
          </Button>
        </div>
      ))}
    </div>
  );
}
