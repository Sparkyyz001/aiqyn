"use client";

import { useEffect, useRef } from "react";

/** Крупный текст, слова которого «загораются» по мере прокрутки — от тусклых к полностью видимым */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [...el.querySelectorAll<HTMLSpanElement>("span")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spans.forEach((s) => (s.style.opacity = "1"));
      return;
    }
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 — верх блока входит снизу экрана, 1 — середина блока дошла до центра экрана
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height * 0.5 + vh * 0.35)));
      const lit = p * spans.length;
      spans.forEach((s, i) => (s.style.opacity = String(0.16 + 0.84 * Math.min(1, Math.max(0, lit - i)))));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [text]);

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className="transition-opacity duration-300" style={{ opacity: 0.16 }}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}
