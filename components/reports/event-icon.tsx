import { Ban, Camera, Check, CheckCheck, Clock, FilePlus2, FileWarning, MessageSquare, RotateCcw, Send, Siren, Sparkles, ThumbsUp, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// Иконка события в хронологии: по типу и новому статусу — чтобы историю можно было «прочитать глазами»
export function EventIcon({ type, to, tone }: { type: string; to?: string | null; tone?: "ok" | "danger" | null }) {
  const k = type === "status_change" && to ? to : type;
  const [Icon, color] = (
    {
      created: [FilePlus2, "bg-primary/12 text-primary"],
      new: [FilePlus2, "bg-primary/12 text-primary"],
      routed: [Send, "bg-primary/12 text-primary"],
      accepted: [Check, "bg-primary/12 text-primary"],
      in_progress: [Wrench, "bg-[color:var(--warn)]/15 text-[color:var(--warn)]"],
      awaiting_confirmation: [Camera, "bg-[color:var(--warn)]/15 text-[color:var(--warn)]"],
      resolved: [CheckCheck, "bg-[color:var(--ok)]/15 text-[color:var(--ok)]"],
      rejected: [Ban, "bg-[color:var(--danger)]/12 text-[color:var(--danger)]"],
      reopened: [RotateCcw, "bg-[color:var(--danger)]/12 text-[color:var(--danger)]"],
      reply: [MessageSquare, "bg-primary/12 text-primary"],
      confirmed: [Users, "bg-primary/12 text-primary"],
      verification: [ThumbsUp, "bg-[color:var(--ok)]/15 text-[color:var(--ok)]"],
      escalated: [FileWarning, "bg-[color:var(--danger)]/12 text-[color:var(--danger)]"],
      ai_analysis: [Sparkles, "bg-[#7c5cff]/12 text-[#6a4ce0]"],
      ai_after_check: [Sparkles, "bg-[color:var(--danger)]/12 text-[color:var(--danger)]"],
      delay_reason: [Clock, "bg-[color:var(--warn)]/15 text-[color:var(--warn)]"],
      incident_linked: [Siren, "bg-[#b4447a]/12 text-[#b4447a]"],
    } as Record<string, [typeof Check, string]>
  )[k] ?? [Check, "bg-muted text-muted-foreground"];
  const toneCls = tone === "ok" ? "bg-[color:var(--ok)]/15 text-[color:var(--ok)]" : tone === "danger" ? "bg-[color:var(--danger)]/12 text-[color:var(--danger)]" : color;
  return (
    <span className={cn("absolute top-0 -left-[38px] grid size-7 place-items-center rounded-full ring-4 ring-background", toneCls)}>
      <Icon className="size-3.5" />
    </span>
  );
}
