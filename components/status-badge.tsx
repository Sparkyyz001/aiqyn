import { cn } from "@/lib/utils";
import { STATUS_BADGE } from "@/lib/meta";

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_BADGE[status], className)}>
      {label}
    </span>
  );
}
