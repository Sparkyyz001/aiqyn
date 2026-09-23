"use client";

import { usePathname } from "next/navigation";

// На главной подвал встроен в финальный блок лендинга — общий подвал там не нужен
export function FooterGate({ children }: { children: React.ReactNode }) {
  return usePathname() === "/" ? null : children;
}
