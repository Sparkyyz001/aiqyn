"use client";

import { usePathname } from "next/navigation";

// На главной подвал продолжает тёмно-бирюзовый фон лендинга
export function FooterShell({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/";
  return <footer className={`mt-auto ${home ? "dark theme-lagoon bg-background text-foreground" : ""}`}>{children}</footer>;
}
