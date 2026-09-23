"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setLang } from "@/lib/actions/session";
import type { Lang } from "@/lib/i18n/dict";

export function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      title={label}
      onClick={() =>
        start(async () => {
          await setLang(lang === "ru" ? "kz" : "ru");
          router.refresh();
        })
      }
      className="font-medium tabular-nums"
    >
      {lang === "ru" ? "ҚАЗ" : "РУС"}
    </Button>
  );
}
