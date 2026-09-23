"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEscalation, saveEotinishRef } from "@/lib/actions/escalation";

type Prev = { id: number; created_at: string; eotinish_ref: string | null };

export function EscalateClient({ reportId, defaultName, previewText, previous }: { reportId: number; defaultName: string; previewText: string; previous: Prev[] }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState("");
  const [refs, setRefs] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();
  const text = previewText.replace(/^Заявитель: .*$/m, `Заявитель: ${name}${contact ? `, ${contact}` : ""}`);

  const create = () =>
    start(async () => {
      const res = await createEscalation(reportId, { full_name: name, contact });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Пакет сформирован");
      window.location.href = `/api/documents/escalation/${res.data.id}`;
      router.refresh();
    });

  return (
    <div className="mt-5 flex flex-col gap-5">
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {["Проверьте ФИО и текст", "Скачайте PDF-пакет", "Подайте на eotinish.kz и впишите номер"].map((s, i) => (
          <li key={s} className="rounded-lg border p-3">
            <span className="text-xs text-primary tabular-nums">0{i + 1}</span>
            <div>{s}</div>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="fio">ФИО заявителя</Label>
          <Input id="fio" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="contact">Телефон или email (необязательно)</Label>
          <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Текст для формы eOtinish</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Скопировано"))}
          >
            <Copy /> Копировать
          </Button>
        </div>
        <Textarea readOnly value={text} rows={14} className="font-mono text-xs" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={create} disabled={pending || !name.trim()}>
          <Download /> Сформировать и скачать PDF
        </Button>
        <Button asChild variant="outline">
          <a href="https://eotinish.kz" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Открыть eotinish.kz
          </a>
        </Button>
      </div>

      {previous.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Ваши пакеты</h2>
          <ul className="divide-y rounded-lg border">
            {previous.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <a href={`/api/documents/escalation/${p.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <FileText className="size-4" /> PDF от {new Date(p.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau" })}
                </a>
                {p.eotinish_ref ? (
                  <span className="ml-auto text-muted-foreground">eOtinish № {p.eotinish_ref}</span>
                ) : (
                  <span className="ml-auto flex gap-1">
                    <Input className="h-8 w-40" placeholder="№ в eOtinish" value={refs[p.id] ?? ""} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} />
                    <Button
                      size="sm"
                      disabled={pending || !refs[p.id]?.trim()}
                      onClick={() =>
                        start(async () => {
                          const res = await saveEotinishRef(p.id, refs[p.id]);
                          if (!res.ok) return void toast.error(res.error);
                          toast.success("Номер сохранён в хронологии");
                          router.refresh();
                        })
                      }
                    >
                      Сохранить
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
