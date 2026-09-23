"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Props = {
  eyebrow: string;
  lines: string[];
  sub: string;
  cta: string;
  ctaMap: string;
};

// Первый экран лендинга: иллюстрированный пейзаж (Pixabay, свободная лицензия), холмы, листья,
// крупная фраза и кнопки на тёмно-бирюзовом переднем плане. Лёгкий параллакс за курсором.
export function LandscapeHero({ f }: { f: Props }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mouse-x", x.toFixed(3));
        el.style.setProperty("--mouse-y", y.toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--mouse-x", "0");
      el.style.setProperty("--mouse-y", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section ref={ref} className="vf-page" aria-labelledby="vf-title">
      <style>{styles}</style>

      <div className="vf-sky" aria-hidden />
      <div className="vf-landscape" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/landscape.webp" alt="" draggable={false} fetchPriority="high" decoding="async" />
        <div className="vf-landscape-tint" />
      </div>
      <div className="vf-sun" aria-hidden />

      <svg className="vf-birds" viewBox="0 0 190 70" aria-hidden>
        <path className="vf-bird vf-b1" d="M10 30 Q22 18 32 29 Q42 18 54 30" />
        <path className="vf-bird vf-b2" d="M78 14 Q88 4 96 13 Q104 4 114 14" />
        <path className="vf-bird vf-b3" d="M132 44 Q142 34 150 43 Q158 34 168 44" />
      </svg>

      <div className="vf-mist vf-mist-l" aria-hidden />
      <div className="vf-mist vf-mist-r" aria-hidden />

      <div className="vf-hill vf-hill-back" aria-hidden />
      <div className="vf-hill vf-hill-mid" aria-hidden />
      <div className="vf-hill vf-hill-front" aria-hidden />

      <div className="vf-leaves" aria-hidden>
        {LEAVES.map((l, i) => (
          <span key={i} className="vf-leaf" style={l as React.CSSProperties} />
        ))}
      </div>

      <div className="vf-scrim" aria-hidden />

      <div className="vf-content">
        <div className="vf-headline">
          <p className="vf-eyebrow vf-intro" style={{ "--d": "150ms" } as React.CSSProperties}>{f.eyebrow}</p>
          <h1 id="vf-title" className="vf-title">
            {f.lines.map((l, i) => (
              <span key={i} className="vf-intro" style={{ "--d": `${320 + i * 130}ms` } as React.CSSProperties}>
                {l}
              </span>
            ))}
          </h1>
          <p className="vf-sub vf-intro" style={{ "--d": "760ms" } as React.CSSProperties}>{f.sub}</p>
        </div>

        <div className="vf-actions vf-intro" style={{ "--d": "950ms" } as React.CSSProperties}>
          <Link href="/report/new" className="vf-cta">
            <span>{f.cta}</span>
            <span className="vf-arrow" aria-hidden>
              ↗
            </span>
          </Link>
          <Link href="/map" className="vf-ghost">
            {f.ctaMap}
          </Link>
        </div>
      </div>
    </section>
  );
}

const LEAVES = [
  { left: "24%", top: "43%", "--s": "26px", "--d": "14s", "--delay": "-3s", "--r": "20deg" },
  { left: "39%", top: "57%", "--s": "20px", "--d": "12s", "--delay": "-7s", "--r": "-35deg" },
  { left: "51%", top: "45%", "--s": "34px", "--d": "17s", "--delay": "-11s", "--r": "60deg" },
  { left: "64%", top: "56%", "--s": "24px", "--d": "13s", "--delay": "-5s", "--r": "-10deg" },
  { left: "75%", top: "47%", "--s": "42px", "--d": "18s", "--delay": "-14s", "--r": "35deg" },
  { left: "85%", top: "60%", "--s": "22px", "--d": "15s", "--delay": "-9s", "--r": "-50deg" },
];

const styles = `
.vf-page {
  --dark-teal: #075458;
  --deep-teal: #06494d;
  --cream: #f6f1dd;
  --green: #76cf6a;
  --coral: #ff907d;
  --mouse-x: 0;
  --mouse-y: 0;
  --pad: clamp(34px, 4.6vw, 90px);
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
  width: 100%;
  min-height: max(calc(100svh - 3.5rem), 720px);
  overflow: hidden;
  isolation: isolate;
  background: #ffd9c4;
  color: var(--cream);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/* небо и пейзаж */
.vf-sky {
  position: absolute; inset: 0 0 34% 0; z-index: -6;
  background:
    radial-gradient(circle at 50% 31%, rgba(255, 226, 140, 0.85), rgba(255, 214, 150, 0) 42%),
    linear-gradient(180deg, #fffaf4 0%, #ffe3cf 38%, #ffb59c 78%, #f59a84 100%);
}
.vf-landscape {
  position: absolute; top: 0; left: 0; width: 100%; height: 66%;
  overflow: hidden; z-index: -5;
  transform: translate3d(calc(var(--mouse-x) * -14px), calc(var(--mouse-y) * -8px), 0);
  transition: transform 950ms var(--ease);
}
.vf-landscape img {
  position: absolute; left: -3%; top: -6%;
  width: 106%; height: 112%; max-width: none;
  object-fit: cover; object-position: center 55%;
  user-select: none; pointer-events: none;
  filter: hue-rotate(318deg) saturate(0.72) brightness(1.14) contrast(0.88);
  animation: landscapeBreathing 18s ease-in-out infinite alternate;
  transform-origin: 50% 60%;
}
.vf-landscape-tint {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 246, 236, 0.35) 0%, rgba(255, 144, 125, 0.18) 45%, rgba(118, 207, 106, 0) 70%, rgba(6, 73, 77, 0.55) 100%),
    linear-gradient(90deg, rgba(255, 170, 190, 0.55) 0%, rgba(255, 222, 200, 0.45) 50%, rgba(118, 207, 106, 0.4) 100%);
  mix-blend-mode: color;
}
.vf-sun {
  position: absolute; left: 50%; top: calc(66% * 0.24);
  width: max(34vw, 470px); aspect-ratio: 1; border-radius: 50%;
  translate: -50% -50%;
  background: radial-gradient(circle, rgba(255, 244, 190, 0.55) 0%, rgba(255, 236, 170, 0.18) 45%, rgba(255, 236, 170, 0) 70%);
  filter: blur(28px); mix-blend-mode: screen; z-index: -4; pointer-events: none;
  animation: sunPulse 6s ease-in-out infinite alternate;
}

/* птицы */
.vf-birds {
  position: absolute; left: 38%; top: 17%;
  width: clamp(100px, 12vw, 190px); z-index: -3; overflow: visible;
  animation: birdsTravel 12s ease-in-out infinite alternate;
}
.vf-bird {
  fill: none; stroke: #4a2338; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
  transform-box: fill-box; transform-origin: center;
  animation: birdFlap 2.1s ease-in-out infinite;
}
.vf-b2 { animation-duration: 2.6s; animation-delay: -0.8s; }
.vf-b3 { animation-duration: 2.3s; animation-delay: -1.4s; }

/* туман */
.vf-mist {
  position: absolute; height: 64px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.8); filter: blur(22px); opacity: 0.45;
  z-index: -3; pointer-events: none;
}
.vf-mist-l { left: -4%; top: 24%; width: 42%; animation: mistMove 22s ease-in-out infinite alternate; }
.vf-mist-r { right: -4%; top: 33%; width: 37%; animation: mistMoveReverse 26s ease-in-out infinite alternate; }

/* холмы */
.vf-hill { position: absolute; left: -4%; width: 108%; pointer-events: none; }
.vf-hill-back {
  top: 42%; height: 30%; z-index: -2;
  background: rgba(63, 158, 98, 0.92);
  clip-path: polygon(0 58%, 6% 40%, 11% 48%, 17% 26%, 23% 44%, 29% 36%, 35% 52%, 42% 30%, 48% 42%, 55% 18%, 61% 38%, 67% 30%, 73% 46%, 80% 24%, 86% 40%, 92% 32%, 100% 48%, 100% 100%, 0 100%);
  transform: translate3d(calc(var(--mouse-x) * 18px), calc(var(--mouse-y) * 4px), 0);
  transition: transform 900ms var(--ease);
}
.vf-hill-mid {
  top: 47%; height: 29%; z-index: -2;
  background: #1f7a5a;
  clip-path: polygon(0 50%, 8% 36%, 15% 46%, 24% 30%, 33% 44%, 41% 38%, 50% 52%, 58% 34%, 66% 44%, 75% 28%, 84% 42%, 92% 34%, 100% 44%, 100% 100%, 0 100%);
  transform: translate3d(calc(var(--mouse-x) * -12px), calc(var(--mouse-y) * -3px), 0);
  transition: transform 850ms var(--ease);
}
.vf-hill-front {
  top: 50%; bottom: -2%; z-index: -1;
  background:
    radial-gradient(ellipse 40% 22% at 50% 18%, rgba(118, 207, 106, 0.14), rgba(118, 207, 106, 0) 70%),
    var(--dark-teal);
  clip-path: polygon(0 30%, 14% 24%, 30% 27%, 46% 18%, 62% 20%, 78% 12%, 90% 15%, 100% 10%, 100% 100%, 0 100%);
}

/* листья */
.vf-leaves { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.vf-leaf {
  position: absolute; width: var(--s); height: var(--s);
  border-radius: 100% 0 100% 0;
  background: linear-gradient(135deg, #b4ec8a 0%, #76cf6a 45%, #2f8f5b 100%);
  box-shadow: inset 2px 2px 3px rgba(255, 255, 255, 0.45), 0 6px 14px rgba(6, 73, 77, 0.28);
  opacity: 0;
  animation: leafFloat var(--d) ease-in-out infinite, leafOpacity var(--d) linear infinite;
  animation-delay: var(--delay);
}

/* мягкое затемнение под фразой, чтобы текст читался поверх солнца и гор */
.vf-scrim {
  position: absolute; left: 0; bottom: 0; width: 72%; height: 82%; z-index: 1; pointer-events: none;
  background: radial-gradient(ellipse 70% 60% at 18% 62%, rgba(6, 60, 64, 0.7) 0%, rgba(6, 60, 64, 0.38) 45%, rgba(6, 60, 64, 0) 75%);
}

/* вход первого экрана: строки поднимаются по очереди */
.vf-intro { animation: vfIntro 1s var(--ease) both; animation-delay: var(--d, 0ms); }
.vf-eyebrow::before { animation: vfLine 0.9s var(--ease) 0.3s both; }
@keyframes vfIntro { from { opacity: 0; transform: translateY(26px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes vfLine { from { width: 0; } to { width: 32px; } }

/* контент: фраза и кнопки идут потоком снизу — не могут наехать друг на друга */
.vf-content {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  padding: 0 var(--pad) clamp(48px, 9vh, 96px);
}
.vf-headline {
  max-width: 700px; pointer-events: none;
  margin-bottom: 34px;
  transform: translate3d(calc(var(--mouse-x) * 8px), calc(var(--mouse-y) * 5px), 0);
  transition: transform 900ms var(--ease);
}
.vf-eyebrow {
  display: flex; align-items: center; gap: 13px; margin: 0 0 22px;
  text-transform: uppercase; font-weight: 600; letter-spacing: 0.18em;
  font-size: clamp(10px, 0.9vw, 14px); color: rgba(246, 241, 221, 0.74);
}
.vf-eyebrow::before { content: ""; width: 32px; height: 2px; background: var(--green); flex: none; }
.vf-title {
  display: flex; flex-direction: column; align-items: flex-start; margin: 0;
  color: var(--cream); font-size: clamp(40px, 3.6vw, 64px); font-weight: 600;
  line-height: 0.98; letter-spacing: -0.045em;
  text-shadow: 0 2px 30px rgba(6, 60, 64, 0.55);
}
.vf-title span { white-space: nowrap; }
.vf-sub {
  margin: 22px 0 0; max-width: 520px;
  font-size: clamp(15px, 1.15vw, 18px); line-height: 1.5; color: rgba(246, 241, 221, 0.82);
  text-shadow: 0 1px 14px rgba(6, 73, 77, 0.45);
}
.vf-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.vf-ghost {
  display: inline-flex; align-items: center; justify-content: center; height: 58px; padding: 0 24px;
  border-radius: 7px; border: 1px solid rgba(246, 241, 221, 0.35); color: var(--cream); text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
  background: rgba(246, 241, 221, 0.06); backdrop-filter: blur(6px);
  transition: background 400ms var(--ease), border-color 400ms var(--ease), transform 600ms var(--ease);
}
.vf-ghost:hover, .vf-ghost:focus-visible { background: rgba(246, 241, 221, 0.14); border-color: rgba(246, 241, 221, 0.6); transform: translateY(-3px); }
.vf-cta {
  position: relative; overflow: hidden; isolation: isolate;
  display: inline-flex; align-items: center; justify-content: center; gap: 14px;
  min-width: 168px; height: 58px; padding: 0 22px; border-radius: 7px;
  background: var(--coral); color: var(--dark-teal); text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 14px 30px -12px rgba(3, 38, 40, 0.7);
  transition: transform 600ms var(--ease), box-shadow 600ms var(--ease);
}
.vf-cta::before {
  content: ""; position: absolute; inset: 0; z-index: -1; background: #ffe7a8;
  transform: translateY(101%); transition: transform 600ms var(--ease);
}
.vf-cta:hover, .vf-cta:focus-visible { transform: translateY(-5px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 24px 44px -14px rgba(3, 38, 40, 0.8); }
.vf-cta:hover::before, .vf-cta:focus-visible::before { transform: translateY(0); }
.vf-arrow { font-size: 15px; transition: transform 600ms var(--ease); }
.vf-cta:hover .vf-arrow, .vf-cta:focus-visible .vf-arrow { transform: translate(3px, -4px); }


.vf-page a:focus-visible { outline: 2px solid #c8f5b5; outline-offset: 4px; }

@keyframes landscapeBreathing { from { transform: scale(1.045); } to { transform: scale(1.09) translateY(-1%); } }
@keyframes sunPulse { from { opacity: 0.75; transform: scale(0.94); } to { opacity: 1; transform: scale(1.06); } }
@keyframes birdsTravel { 0% { transform: translate(0, 0); } 50% { transform: translate(34px, -10px); } 100% { transform: translate(64px, 4px); } }
@keyframes birdFlap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.55) translateY(2px); } }
@keyframes mistMove { from { transform: translateX(-4%); } to { transform: translateX(10%); } }
@keyframes mistMoveReverse { from { transform: translateX(4%); } to { transform: translateX(-10%); } }
@keyframes leafFloat {
  0% { transform: translate(0, -40px) rotate(var(--r)); }
  25% { transform: translate(34px, 20px) rotate(calc(var(--r) + 70deg)); }
  50% { transform: translate(-12px, 80px) rotate(calc(var(--r) + 150deg)); }
  75% { transform: translate(28px, 140px) rotate(calc(var(--r) + 230deg)); }
  100% { transform: translate(-6px, 200px) rotate(calc(var(--r) + 320deg)); }
}
@keyframes leafOpacity { 0% { opacity: 0; } 12% { opacity: 0.9; } 82% { opacity: 0.9; } 100% { opacity: 0; } }

@media (max-width: 1200px) {
  .vf-title { font-size: clamp(42px, 4.6vw, 60px); }
}

@media (max-width: 940px) {
  .vf-page { min-height: 1040px; }
  .vf-landscape { height: 53%; }
  .vf-sky { inset: 0 0 45% 0; }
  .vf-sun { top: calc(53% * 0.24); }
  .vf-hill-back { top: 33%; }
  .vf-hill-mid { top: 38%; }
  .vf-hill-front { top: 41%; }
  .vf-title { font-size: clamp(40px, 7vw, 58px); }
  .vf-title { display: block; text-wrap: balance; }
  .vf-title span { display: inline; white-space: normal; }
  .vf-title span:not(:last-child)::after { content: " "; }
  .vf-title span.vf-intro { animation: none; }
  .vf-title { animation: vfIntro 1s var(--ease) 0.32s both; }
}

@media (max-width: 600px) {
  .vf-page { min-height: 0; justify-content: flex-start; --pad: 24px; }
  .vf-content { padding-top: 236px; }
  .vf-landscape { height: 300px; }
  .vf-landscape img { object-position: 58% 40%; }
  .vf-sky { inset: 0 0 auto 0; height: 300px; }
  .vf-sun { top: 70px; width: 340px; }
  .vf-birds { left: 30%; top: 40px; }
  .vf-mist-l { top: 80px; }
  .vf-mist-r { top: 130px; }
  .vf-hill-back { top: 160px; height: 110px; }
  .vf-hill-mid { top: 180px; height: 100px; }
  .vf-hill-front { top: 205px; clip-path: polygon(0 1.5%, 22% 0.8%, 45% 1.8%, 70% 0.4%, 100% 1.2%, 100% 100%, 0 100%); }
  .vf-scrim { display: none; }
  .vf-headline { margin-bottom: 28px; }
  .vf-title { font-size: clamp(36px, 10.5vw, 48px); line-height: 1.02; }
  .vf-sub { margin-top: 16px; font-size: 16px; }
  .vf-cta, .vf-ghost { width: 100%; font-size: 12px; }
  .vf-leaf { display: none; }
}

@media (max-width: 380px) {
  .vf-page { min-height: 0; }
  .vf-title { font-size: 34px; }
}

@media (prefers-reduced-motion: reduce) {
  .vf-page *, .vf-page *::before, .vf-page *::after { animation: none !important; transition: none !important; }
  .vf-leaf { opacity: 0.85; }
  .vf-landscape, .vf-hill, .vf-headline { transform: none !important; }
}
`;
