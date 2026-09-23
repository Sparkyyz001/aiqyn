"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Шапка прячется при прокрутке вниз и возвращается при прокрутке вверх.
// На главной — тёмно-бирюзовая, в цвет первого экрана.
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/";
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) < 6) return;
        setHidden(y > last && y > 120);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-[1100] border-b backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${home ? "dark theme-lagoon bg-background/80 text-foreground" : "bg-background/95 supports-[backdrop-filter]:bg-background/80"}`}
    >
      {children}
    </header>
  );
}
