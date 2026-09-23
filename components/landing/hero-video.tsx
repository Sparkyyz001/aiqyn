"use client";

import { useEffect, useRef, useState } from "react";

// Фон первого экрана: видео скалистого берега Каспия (Pexels, свободная лицензия).
// Телефону — облегчённая версия 720p, при «уменьшить движение» — только статичный кадр.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSrc(window.innerWidth < 768 ? "/hero/caspian-720.mp4" : "/hero/caspian-1280.mp4");
  }, []);
  useEffect(() => {
    if (src) ref.current?.play().catch(() => {});
  }, [src]);
  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      poster="/hero/caspian-poster.jpg"
      src={src ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}
