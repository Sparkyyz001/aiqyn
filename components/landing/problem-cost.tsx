import { CountUp, Reveal } from "@/components/landing/motion";
import { fmt, type Dict } from "@/lib/i18n/dict";

type C = Dict["home"]["cost"];

// «Сколько стоит проблема» — первое, что видно после заголовка: огромная бегущая цифра
// реальных денег (лоты госзакупок) и рядом — сколько жалоб всё ещё открыто. Источник под цифрой
// снимает вопрос «откуда взяли» до того, как его зададут.
export function ProblemCost({ c, bn, lots, stats }: { c: C; bn: number; lots: number; stats: number[] }) {
  const [plain, bold] = c.text.split("**").filter(Boolean);
  return (
    <section className="relative overflow-hidden bg-lt-cream text-lt-deep">
      {/* мягкий фон из пейзажа первого экрана — связывает секцию с героем */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/landscape.webp" alt="" className="size-full object-cover [filter:hue-rotate(318deg)_saturate(0.6)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-lt-cream via-lt-cream/80 to-lt-cream" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.2em] text-lt-teal uppercase">{c.kicker}</p>
        </Reveal>
        <Reveal from="scale" delay={120}>
          <div className="mt-4 font-serif text-[clamp(3.6rem,13vw,9.5rem)] leading-[0.92] tracking-tight text-[#c8412f]">
            <CountUp value={bn} decimals={1} duration={2400} />
            <span className="ml-3 text-[0.42em] tracking-normal">{c.unit}</span>
          </div>
        </Reveal>
        <Reveal delay={260}>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-lt-deep/80 text-pretty md:text-xl">
            {plain}
            {bold && <b className="font-semibold text-lt-deep"> {bold}</b>}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-xs text-lt-deep/50">{fmt(c.source, { lots })}</p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 border-t border-lt-deep/15 pt-10 sm:grid-cols-3">
          {c.stats.map(([label, src], i) => (
            <Reveal key={label} delay={i * 140} from={i === 0 ? "left" : i === 2 ? "right" : "up"}>
              <div className={`font-serif text-5xl leading-none tracking-tight md:text-6xl ${i === 0 ? "text-lt-teal" : "text-[#c8412f]"}`}>
                <CountUp value={stats[i] ?? 0} delay={300 + i * 180} duration={2000} />
              </div>
              <div className="mt-2 text-sm font-semibold">{label}</div>
              <div className="mt-1 text-xs text-lt-deep/50 text-pretty">{src}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
