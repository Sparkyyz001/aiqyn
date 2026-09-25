"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initiativeFromReport } from "@/lib/actions/initiatives";
import type { Dict } from "@/lib/i18n/dict";

// «В бюджет»: застрявшее обращение становится инициативой, за которую голосуют соседи
export function BudgetButton({ no, existing, loggedIn, t }: { no: string; existing: number | null; loggedIn: boolean; t: Dict["initiatives"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (existing)
    return (
      <Button asChild variant="outline">
        <a href={`/initiatives#i-${existing}`}>
          <Landmark /> {t.toBudgetOpen}
        </a>
      </Button>
    );
  return (
    <Button
      variant="outline"
      title={t.toBudgetHint}
      disabled={pending}
      onClick={() => {
        if (!loggedIn) return router.push(`/login?next=/report/${no}`);
        start(async () => {
          const r = await initiativeFromReport(no);
          if (!r.ok) return void toast.error(r.error);
          if (r.data.created) toast.success(t.toBudgetDone);
          router.push(`/initiatives#i-${r.data.id}`);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Landmark />} {t.toBudget}
    </Button>
  );
}
