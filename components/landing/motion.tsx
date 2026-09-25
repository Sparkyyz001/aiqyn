"use client";

import { useEffect, useRef, useState } from "react";

/** Блок плавно появляется, когда доходит до экрана (уважает prefers-reduced-motion через CSS).
 *  from: откуда выходит — снизу (по умолчанию), слева, справа или с увеличением */
export function Reveal({ children, className = "", delay = 0, from = "up" }: { children: React.ReactNode; className?: string; delay?: number; from?: "up" | "left" | "right" | "scale" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Нет IntersectionObserver — показываем сразу, чтобы контент никогда не остался невидимым
    if (typeof IntersectionObserver === "undefined") return void setInView(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal reveal-${from} ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Число с плавным отсчётом от 0 при появлении на экране */
export function CountUp({ value, decimals = 0, delay = 0, duration = 2000 }: { value: number; decimals?: number; delay?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return void setShown(value);
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        timer = setTimeout(() => {
          const t0 = performance.now();
          const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / duration);
            setShown(value * (1 - Math.pow(1 - k, 4)));
            if (k < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }, delay);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, delay, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(shown)}
    </span>
  );
}
