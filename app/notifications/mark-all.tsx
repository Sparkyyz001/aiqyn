"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function MarkAllRead({ ids, label }: { ids: number[]; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
          router.refresh();
        })
      }
    >
      <CheckCheck /> {label}
    </Button>
  );
}
