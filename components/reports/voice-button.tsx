"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VoiceResult = {
  is_city_problem: boolean;
  transcript: string;
  language: string;
  category: string;
  title_ru: string;
  title_kz: string;
  description_ru: string;
  description_kz: string;
  severity: number;
  place_hint: string | null;
  district: { code: string; name_ru: string; name_kz: string; lat: number; lng: number } | null;
};

type L = { cta: string; hint: string; rec: string; stop: string; cancel: string; busy: string; heard: string; denied: string; fail: string; off: string; short: string };

const MAX_SEC = 60;
const RATE = 16000;

// Запись голоса в WAV (моно, 16 кГц) прямо в браузере: формат, который одинаково понимают
// Chrome, Android и Safari на iPhone, а Gemini принимает без перекодирования.
export function VoiceButton({ l, onResult }: { l: L; onResult: (v: VoiceResult) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [sec, setSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState<string | null>(null);
  const rec = useRef<{ ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode; chunks: Float32Array[]; rate: number; timer: number; raf: number } | null>(null);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    cancelAnimationFrame(r.raf);
    r.node.disconnect();
    r.stream.getTracks().forEach((t) => t.stop());
    r.ctx.close().catch(() => {});
    rec.current = null;
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      src.connect(analyser);
      src.connect(node);
      node.connect(ctx.destination);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let s = 0;
        for (const x of buf) s += ((x - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(s / buf.length) * 4));
        if (rec.current) rec.current.raf = requestAnimationFrame(tick);
      };
      const began = new Date().getTime();
      const timer = window.setInterval(() => {
        const t = Math.floor((new Date().getTime() - began) / 1000);
        setSec(t);
        if (t >= MAX_SEC) void stop();
      }, 250);
      rec.current = { ctx, stream, node, chunks, rate: ctx.sampleRate, timer, raf: requestAnimationFrame(tick) };
      setSec(0);
      setHeard(null);
      setState("rec");
    } catch {
      toast.error(l.denied);
    }
  };

  const cancel = () => {
    cleanup();
    setState("idle");
  };

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    const { chunks, rate } = r;
    cleanup();
    const samples = chunks.reduce((n, c) => n + c.length, 0);
    if (samples / rate < 1.2) {
      setState("idle");
      return void toast.error(l.short);
    }
    setState("busy");
    try {
      const res = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: toWav(chunks, rate) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 503) return void toast.error(l.off);
      if (!res.ok || !j.voice) return void toast.error(j.error && res.status === 401 ? j.error : l.fail);
      setHeard(j.voice.transcript);
      onResult(j.voice as VoiceResult);
    } catch {
      toast.error(l.fail);
    } finally {
      setState("idle");
    }
  };

  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-2">
      {state === "rec" ? (
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/[0.06] p-3">
          <span className="relative grid size-10 shrink-0 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--danger)]/30" />
            <span className="relative grid size-10 place-items-center rounded-full bg-[color:var(--danger)] text-white">
              <Mic className="size-5" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{l.rec}</div>
            <div className="mt-1 flex h-5 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-[color:var(--danger)] transition-[height] duration-100"
                  style={{ height: `${Math.max(3, level * 20 * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + sec))))}px` }}
                />
              ))}
              <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                {mm} / 1:00
              </span>
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => void stop()}>
            <Square className="fill-current" /> {l.stop}
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={cancel} aria-label={l.cancel}>
            <X />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className={cn("h-auto justify-start gap-3 py-3 text-left", state === "busy" && "opacity-80")} onClick={() => void start()} disabled={state === "busy"}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{state === "busy" ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}</span>
          <span className="min-w-0 whitespace-normal">
            <span className="block font-medium">{state === "busy" ? l.busy : l.cta}</span>
            <span className="block text-xs font-normal text-muted-foreground">{l.hint}</span>
          </span>
        </Button>
      )}
      {heard && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-pretty">
          <span className="text-xs text-muted-foreground">{l.heard}: </span>«{heard}»
        </p>
      )}
    </div>
  );
}

// Float32 (частота микрофона) → WAV 16 бит, 16 кГц, моно
function toWav(chunks: Float32Array[], rate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  const ratio = rate / RATE;
  const len = Math.floor(total / ratio);
  const pcm = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    // усреднение по окну — простой фильтр от наложения частот при понижении частоты
    const a = Math.floor(i * ratio);
    const b = Math.min(total, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += all[j];
    const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const head = new DataView(new ArrayBuffer(44));
  const str = (off: number, s: string) => [...s].forEach((ch, i) => head.setUint8(off + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  head.setUint32(4, 36 + pcm.byteLength, true);
  str(8, "WAVE");
  str(12, "fmt ");
  head.setUint32(16, 16, true);
  head.setUint16(20, 1, true);
  head.setUint16(22, 1, true);
  head.setUint32(24, RATE, true);
  head.setUint32(28, RATE * 2, true);
  head.setUint16(32, 2, true);
  head.setUint16(34, 16, true);
  str(36, "data");
  head.setUint32(40, pcm.byteLength, true);
  return new Blob([head.buffer, pcm.buffer], { type: "audio/wav" });
}
