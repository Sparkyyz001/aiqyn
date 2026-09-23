"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setMyDistrict } from "@/lib/actions/profile";

export function DistrictPicker({ value, options, placeholder }: { value: number | null; options: { id: number; name: string }[]; placeholder: string }) {
  const [pending, start] = useTransition();
  return (
    <Select
      value={value ? String(value) : undefined}
      disabled={pending}
      onValueChange={(v) =>
        start(async () => {
          const res = await setMyDistrict(Number(v));
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      <SelectTrigger className="w-56"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="z-[1300] max-h-80">
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
