"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createIncident } from "@/lib/actions/incidents";
import { INCIDENT_TYPES } from "@/lib/incidents";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dict";

export function IncidentForm({ districts, t }: { districts: { id: number; name: string }[]; t: Dict["incident"]; lang: Lang }) {
  const router = useRouter();
  const [type, setType] = useState<string>("water");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eta, setEta] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, start] = useTransition();

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = () =>
    start(async () => {
      const svc = INCIDENT_TYPES.find((x) => x.code === type)!.service;
      // datetime-local — время Актау (UTC+5)
      const etaIso = eta ? new Date(eta + ":00+05:00").toISOString() : null;
      const res = await createIncident({ type, title, description, serviceCode: svc, districtIds: selected, eta_at: etaIso });
      if (!res.ok) return void toast.error(res.error);
      toast.success(fmt(t.created, { n: res.data.linked }));
      setTitle("");
      setDescription("");
      setSelected([]);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 font-medium">
        <Siren className="size-4 text-[#b4447a]" /> {t.new}
      </div>
      <p className="text-xs text-muted-foreground">
        {t.hint}
      </p>
      <div className="grid gap-1.5">
        <Label>{t.type}</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[1300]">
            {INCIDENT_TYPES.map((x) => (
              <SelectItem key={x.code} value={x.code}>{t.types[x.code]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>{t.name}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.namePh} />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.desc}</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.eta}</Label>
        <Input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>{fmt(t.zone, { n: selected.length })}</Label>
        <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto rounded-md border p-2">
          {districts.map((d) => (
            <button
              type="button"
              key={d.id}
              onClick={() => toggle(d.id)}
              className={`rounded border px-2 py-0.5 text-xs ${selected.includes(d.id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <Button onClick={submit} disabled={pending || !title.trim() || !selected.length}>
        {t.declare}
      </Button>
    </div>
  );
}
