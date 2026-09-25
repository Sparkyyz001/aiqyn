"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n/dict";

function Seg<T extends string | number>({
  value,
  set,
  options,
}: {
  value: T;
  set: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => set(v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors duration-200",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Предпросмотр PDF-дайджеста: период и язык переключаются, документ пересобирается на сервере
export function DigestViewer({
  t,
  lang0,
}: {
  t: Dict["digest"];
  lang0: "ru" | "kz";
}) {
  const [days, setDays] = useState(7);
  const [lang, setLang] = useState<"ru" | "kz">(lang0);
  const [loading, setLoading] = useState(true);
  const src = `/api/documents/akimat-digest?days=${days}&lang=${lang}`;

  // встроенный просмотрщик PDF есть не везде — не держим заглушку вечно
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 6000);
    return () => clearTimeout(id);
  }, [loading, src]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.period}</span>
            <Seg
              value={days}
              set={(v) => {
                if (v !== days) setLoading(true);
                setDays(v);
              }}
              options={[
                [7, t.p7],
                [14, t.p14],
                [30, t.p30],
              ]}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t.lang}</span>
            <Seg
              value={lang}
              set={(v) => {
                if (v !== lang) setLoading(true);
                setLang(v);
              }}
              options={[
                ["ru", "Русский"],
                ["kz", "Қазақша"],
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="hidden md:inline-flex">
            <a href={`${src}&view=1`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> {t.open}
            </a>
          </Button>
          <Button asChild className="btn-shine">
            <a href={src}>
              <Download /> {t.download}
            </a>
          </Button>
        </div>
      </div>

      {/* «лист бумаги» с документом */}
      {/* на телефоне PDF во фрейме не показывается — даём открыть документ целиком */}
      <a
        href={src}
        download
        className="flex items-center gap-4 rounded-2xl border bg-card p-5 md:hidden"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.pageTitle}</span>
          <span className="block text-sm text-muted-foreground">
            PDF · A4 · {lang === "kz" ? "Қазақша" : "Русский"}
          </span>
        </span>
        <ExternalLink className="size-5 text-muted-foreground" />
      </a>

      <div className="relative hidden rounded-2xl border bg-muted/40 p-3 md:block md:p-6">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-background/60 backdrop-blur-sm">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t.building}
            </span>
          </div>
        )}
        <iframe
          key={src}
          src={`${src}&view=1#toolbar=0&navpanes=0&view=FitH`}
          title={t.pageTitle}
          onLoad={() => setLoading(false)}
          className="mx-auto block h-[78vh] w-full max-w-[900px] rounded-md bg-white shadow-[0_20px_60px_-20px_rgb(5_62_66/0.45)]"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t.auto}</p>
    </div>
  );
}
