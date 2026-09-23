"use client";

import { usePathname } from "next/navigation";

// На главной подвал продолжает тёмно-бирюзовый фон лендинга; на входе подвала нет — там только пейзаж и форма
export function FooterShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return null;
  const home = path === "/";
  return <footer className={`mt-auto ${home ? "dark theme-lagoon bg-background text-foreground" : ""}`}>{children}</footer>;
}
