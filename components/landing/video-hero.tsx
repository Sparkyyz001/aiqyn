"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Props = {
  eyebrow: string;
  lines: string[];
  sub: string;
  cta: string;
  ctaMap: string;
  place: string;
  scroll: string;
};

// Первый экран: живое видео набережной Актау на весь экран, поверх — главная фраза и кнопки.
// Видео без звука и зациклено «туда-обратно» (без скачка на стыке). На телефоне — лёгкая
// версия 720p; при «уменьшить движение» видео не запускается, остаётся кадр-обложка.
export function VideoHero({ f }: { f: Props }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return v.pause();
    // iOS иногда не стартует autoplay до первого взаимодействия — пробуем явно
    v.play().catch(() => {});
    // вне экрана видео не крутим: экономим батарею и процессор
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section className="vh-page" aria-labelledby="vh-title">
      <style>{styles}</style>
      <video ref={video} className="vh-video" autoPlay muted loop playsInline preload="auto" poster="/hero/aktau-poster.jpg" aria-hidden>
        <source src="/hero/aktau-720.mp4" type="video/mp4" media="(max-width: 900px)" />
        <source src="/hero/aktau-1080.mp4" type="video/mp4" />
      </video>
      <div className="vh-shade" aria-hidden />

      <div className="vh-content">
        <p className="vh-eyebrow vh-intro" style={{ "--d": "150ms" } as React.CSSProperties}>{f.eyebrow}</p>
        <h1 id="vh-title" className="vh-title">
          {f.lines.map((l, i) => (
            <span key={i} className="vh-intro" style={{ "--d": `${300 + i * 130}ms` } as React.CSSProperties}>
              {l}
            </span>
          ))}
        </h1>
        <p className="vh-sub vh-intro" style={{ "--d": "740ms" } as React.CSSProperties}>{f.sub}</p>
        <div className="vh-actions vh-intro" style={{ "--d": "920ms" } as React.CSSProperties}>
          <Link href="/report/new" className="vh-cta">
            <span>{f.cta}</span>
            <span className="vh-arrow" aria-hidden>
              ↗
            </span>
          </Link>
          <Link href="/map" className="vh-ghost">
            {f.ctaMap}
          </Link>
        </div>
      </div>

      <div className="vh-foot vh-intro" style={{ "--d": "1200ms" } as React.CSSProperties} aria-hidden>
        <span className="vh-place">
          <span className="vh-dot" />
          {f.place} · 43.65° N, 51.16° E
        </span>
        <span className="vh-scroll">
          {f.scroll}
          <span className="vh-mouse" />
        </span>
      </div>
    </section>
  );
}

const styles = `
.vh-page {
  --cream: #f6f1dd;
  --coral: #ff907d;
  --teal: #075458;
  --green: #76cf6a;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --pad: clamp(24px, 4.6vw, 90px);
  position: relative; isolation: isolate; overflow: hidden;
  min-height: max(calc(100svh - 3.5rem), 640px);
  display: flex; flex-direction: column; justify-content: flex-end;
  background: #0b3a3d url("/hero/aktau-poster.jpg") center / cover no-repeat;
  color: var(--cream);
}
.vh-video {
  position: absolute; inset: 0; z-index: -2;
  width: 100%; height: 100%; max-width: none; object-fit: cover; object-position: 50% 45%;
  animation: vhZoom 22s ease-in-out infinite alternate;
}
/* затемнение: снизу и слева — под текстом, небо остаётся ярким */
.vh-shade {
  position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background:
    linear-gradient(0deg, rgba(4, 44, 47, 0.92) 0%, rgba(4, 44, 47, 0.55) 30%, rgba(4, 44, 47, 0) 62%),
    linear-gradient(90deg, rgba(4, 44, 47, 0.55) 0%, rgba(4, 44, 47, 0) 58%),
    linear-gradient(180deg, rgba(4, 44, 47, 0.28) 0%, rgba(4, 44, 47, 0) 18%);
}
.vh-content { position: relative; padding: 0 var(--pad) clamp(88px, 14vh, 150px); max-width: 860px; }
.vh-eyebrow {
  display: flex; align-items: center; gap: 13px; margin: 0 0 20px;
  text-transform: uppercase; font-weight: 600; letter-spacing: 0.18em;
  font-size: clamp(11px, 0.9vw, 14px); color: rgba(246, 241, 221, 0.82);
}
.vh-eyebrow::before { content: ""; width: 32px; height: 2px; background: var(--green); flex: none; }
.vh-title {
  display: flex; flex-direction: column; align-items: flex-start; margin: 0;
  font-size: clamp(42px, 5vw, 84px); font-weight: 600; line-height: 0.98; letter-spacing: -0.045em;
  text-shadow: 0 2px 34px rgba(3, 30, 32, 0.55);
}
.vh-title span { white-space: nowrap; }
.vh-sub {
  margin: 22px 0 0; max-width: 540px;
  font-size: clamp(15px, 1.15vw, 18px); line-height: 1.5; color: rgba(246, 241, 221, 0.88);
  text-shadow: 0 1px 14px rgba(3, 30, 32, 0.6);
}
.vh-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.vh-cta {
  position: relative; overflow: hidden; isolation: isolate;
  display: inline-flex; align-items: center; justify-content: center; gap: 14px;
  min-width: 168px; height: 58px; padding: 0 22px; border-radius: 7px;
  background: var(--coral); color: var(--teal); text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 14px 30px -12px rgba(3, 38, 40, 0.7);
  transition: transform 600ms var(--ease), box-shadow 600ms var(--ease);
}
.vh-cta::before { content: ""; position: absolute; inset: 0; z-index: -1; background: #ffe7a8; transform: translateY(101%); transition: transform 600ms var(--ease); }
.vh-cta:hover, .vh-cta:focus-visible { transform: translateY(-5px); }
.vh-cta:hover::before, .vh-cta:focus-visible::before { transform: translateY(0); }
.vh-arrow { font-size: 15px; transition: transform 600ms var(--ease); }
.vh-cta:hover .vh-arrow { transform: translate(3px, -4px); }
.vh-ghost {
  display: inline-flex; align-items: center; justify-content: center; height: 58px; padding: 0 24px;
  border-radius: 7px; border: 1px solid rgba(246, 241, 221, 0.4); color: var(--cream); text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
  background: rgba(246, 241, 221, 0.08); backdrop-filter: blur(8px);
  transition: background 400ms var(--ease), border-color 400ms var(--ease), transform 600ms var(--ease);
}
.vh-ghost:hover, .vh-ghost:focus-visible { background: rgba(246, 241, 221, 0.16); border-color: rgba(246, 241, 221, 0.7); transform: translateY(-3px); }
.vh-page a:focus-visible { outline: 2px solid #c8f5b5; outline-offset: 4px; }

.vh-foot {
  position: absolute; left: var(--pad); right: var(--pad); bottom: 26px;
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  font-size: 12px; letter-spacing: 0.06em; color: rgba(246, 241, 221, 0.72);
}
.vh-place { display: inline-flex; align-items: center; gap: 8px; }
.vh-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 0 rgba(118, 207, 106, 0.6); animation: vhPing 2.2s ease-out infinite; }
.vh-scroll { display: inline-flex; align-items: center; gap: 10px; text-transform: uppercase; }
.vh-mouse { position: relative; width: 18px; height: 28px; border: 1.5px solid rgba(246, 241, 221, 0.6); border-radius: 10px; }
.vh-mouse::after { content: ""; position: absolute; left: 50%; top: 5px; width: 3px; height: 6px; margin-left: -1.5px; border-radius: 2px; background: var(--cream); animation: vhWheel 1.8s ease-in-out infinite; }

.vh-intro { animation: vhIntro 1s var(--ease) both; animation-delay: var(--d, 0ms); }
@keyframes vhIntro { from { opacity: 0; transform: translateY(26px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes vhZoom { from { transform: scale(1.02); } to { transform: scale(1.08); } }
@keyframes vhPing { 0% { box-shadow: 0 0 0 0 rgba(118, 207, 106, 0.6); } 80%, 100% { box-shadow: 0 0 0 10px rgba(118, 207, 106, 0); } }
@keyframes vhWheel { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(9px); } }

@media (max-width: 940px) {
  .vh-title { display: block; text-wrap: balance; }
  .vh-title span { display: inline; white-space: normal; }
  .vh-title span:not(:last-child)::after { content: " "; }
  .vh-title span.vh-intro { animation: none; }
  .vh-title { animation: vhIntro 1s var(--ease) 0.3s both; }
}
@media (max-width: 600px) {
  .vh-page { min-height: calc(100svh - 3.5rem); }
  .vh-video { object-position: 64% 50%; }
  .vh-shade {
    background:
      linear-gradient(0deg, rgba(4, 44, 47, 0.95) 0%, rgba(4, 44, 47, 0.7) 42%, rgba(4, 44, 47, 0.1) 72%),
      linear-gradient(180deg, rgba(4, 44, 47, 0.3) 0%, rgba(4, 44, 47, 0) 20%);
  }
  .vh-content { padding-bottom: 76px; }
  .vh-title { font-size: clamp(36px, 10.5vw, 48px); line-height: 1.02; }
  .vh-sub { font-size: 16px; margin-top: 16px; }
  .vh-actions { margin-top: 26px; }
  .vh-cta, .vh-ghost { width: 100%; font-size: 12px; }
  .vh-scroll { display: none; }
  .vh-foot { bottom: 22px; font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .vh-page *, .vh-page *::before, .vh-page *::after { animation: none !important; transition: none !important; }
}
`;
