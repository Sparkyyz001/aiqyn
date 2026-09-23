"use client";

import { useState } from "react";
import { Download, Link2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Dict } from "@/lib/i18n/dict";

// Поделиться обращением: на телефоне — системное меню с картинкой-постером (Instagram, WhatsApp,
// Telegram), где это не поддерживается — скачать картинку и скопировать ссылку.
export function ShareButton({ no, lang, t }: { no: string; lang: "ru" | "kz"; t: Dict["share"] }) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const img = `/api/og/report/${no}?lang=${lang}`;
  const url = typeof window === "undefined" ? `/report/${no}` : `${window.location.origin}/report/${no}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.copied);
    } catch {
      window.prompt(t.copy, url);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await fetch(img).then((r) => r.blob());
      const file = new File([blob], `aiqyn-${no}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], url, title: `AIQYN · ${no}` });
      } else if (navigator.share) {
        await navigator.share({ url, title: `AIQYN · ${no}` });
      } else {
        setFallback(true);
      }
    } catch (e) {
      // пользователь закрыл меню — это не ошибка
      if ((e as Error)?.name !== "AbortError") setFallback(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={share} disabled={busy} className="btn-shine">
          {busy ? <Loader2 className="animate-spin" /> : <Share2 />} {busy ? t.preparing : t.button}
        </Button>
        {fallback && (
          <>
            <Button asChild variant="outline">
              <a href={img} download={`aiqyn-${no}.png`}>
                <Download /> {t.download}
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={copy}>
              <Link2 /> {t.copy}
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
