"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Dict } from "@/lib/i18n/dict";

// Кнопка «Выгрузить»: Excel с фильтрами и подсветкой просрочек (открытые / просроченные / под угрозой / все) или CSV
export function ExportButton({ l, lang }: { l: Dict["export"]; lang: "ru" | "kz" }) {
  const href = (scope: string, format = "xlsx") => `/api/export/reports?scope=${scope}&format=${format}&lang=${lang}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download /> {l.button}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[1300] w-60">
        <DropdownMenuLabel>{l.title}</DropdownMenuLabel>
        {(["open", "breached", "risk", "all"] as const).map((s) => (
          <DropdownMenuItem key={s} asChild>
            <a href={href(s)} download>
              <FileSpreadsheet className="text-[#1d6f42]" /> {l[s]}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={href("open", "csv")} download>
            <FileText /> {l.csv}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
