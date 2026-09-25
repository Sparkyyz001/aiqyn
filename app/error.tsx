"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Сбой при отрисовке страницы: вместо пустого экрана — понятное сообщение и повтор.
// Язык интерфейса здесь недоступен (клиентская граница ошибок), поэтому текст на двух языках.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-[color:var(--warn)]/12 text-[color:var(--warn)]">
        <TriangleAlert className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Не удалось загрузить страницу</h1>
        <p className="mt-1 text-sm text-muted-foreground">Бетті жүктеу мүмкін болмады</p>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">
        Возможно, пропал интернет или сервер ненадолго недоступен. Ваши данные не потеряны — попробуйте ещё раз.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Попробовать снова · Қайталау
        </Button>
        <Button asChild variant="outline">
          <Link href="/">На главную · Басты бет</Link>
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Код: {error.digest}</p>}
    </div>
  );
}
