"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, MapPin, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { CityMap } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { previewReport, createReport, type Preview } from "@/lib/actions/reports";
import { AKTAU_CENTER, inAktau } from "@/lib/geo";
import { nm } from "@/lib/meta";
import { cn } from "@/lib/utils";
import type { Dict, Lang } from "@/lib/i18n/dict";

// Карточка звонка оператора 109: без фото — только что сказал житель, адрес с его слов и точка.
// Категорию, службу и район система определяет сама; для поста Instagram — ещё ссылка на оригинал.
export function CallForm({ lang, t }: { lang: Lang; t: Dict["operator"] }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"call109" | "instagram">("call109");
  const [text, setText] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!point || text.trim().length < 5) return;
    const id = setTimeout(async () => {
      const r = await previewReport({ text, lat: point.lat, lng: point.lng });
      if (r.ok) setPreview(r.data);
    }, 400);
    return () => clearTimeout(id);
  }, [point, text]);

  const title = text.trim().split(/[.!?\n]/)[0].slice(0, 120);
  const ready = !!point && title.length >= 5 && (channel === "call109" || /^https:\/\/(www\.)?instagram\.com\//.test(url));

  const submit = () =>
    start(async () => {
      const r = await createReport({
        title,
        description: [text.trim() !== title ? text.trim() : "", address.trim()].filter(Boolean).join("\n"),
        address_text: address.trim() || undefined,
        lat: point!.lat,
        lng: point!.lng,
        category: preview?.category ?? "other",
        photos: [],
        source: channel,
        source_url: channel === "instagram" ? url : undefined,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${t.created}: ${r.data.public_no}`, { action: { label: "→", onClick: () => router.push(`/report/${r.data.public_no}`) } });
      setText("");
      setAddress("");
      setUrl("");
      setPoint(null);
      setPreview(null);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex self-start rounded-lg border p-0.5">
        {(["call109", "instagram"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors", channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {c === "call109" ? <PhoneCall className="size-4" /> : <Camera className="size-4" />} {c === "call109" ? t.call : t.post}
          </button>
        ))}
      </div>

      {channel === "instagram" && (
        <div className="grid gap-2">
          <Label htmlFor="op-url">{t.postUrl}</Label>
          <Input id="op-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" inputMode="url" />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="op-what">{t.what}</Label>
        <Textarea id="op-what" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.whatPh} rows={3} maxLength={1500} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="op-addr">{t.address}</Label>
        <Input id="op-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.addressPh} />
      </div>
      <div className="grid gap-2">
        <Label className="flex items-center justify-between">
          {t.point}
          {point && (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground tabular-nums">
              <MapPin className="size-3" /> {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
            </span>
          )}
        </Label>
        <div className="overflow-hidden rounded-lg border">
          <CityMap fullTouch className="h-56 w-full" center={AKTAU_CENTER} zoom={13} picked={point} onPick={(p) => inAktau(p) && setPoint(p)} />
        </div>
        {!point && <p className="text-xs text-muted-foreground">{t.pointHint}</p>}
      </div>

      {preview && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground">{t.detected}</div>
          <div className="mt-1">
            <b>{nm(preview.service, lang)}</b> · {preview.district ? nm(preview.district, lang) : "—"}
          </div>
        </div>
      )}

      <Button onClick={submit} disabled={!ready || pending} className="btn-shine self-start">
        {pending && <Loader2 className="animate-spin" />} {t.submit}
      </Button>
    </div>
  );
}
