"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Crosshair, Loader2, MapPin, ShieldAlert, ThumbsUp, X } from "lucide-react";
import { CityMap } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { previewReport, createReport, confirmReport, type Preview } from "@/lib/actions/reports";
import { uploadPhoto, type UploadedPhoto } from "@/lib/photo";
import { AKTAU_CENTER, inAktau } from "@/lib/geo";
import { AMENITY, CATEGORIES, nm } from "@/lib/meta";
import type { CategoryCode } from "@/lib/classify";
import type { Dict, Lang } from "@/lib/i18n/dict";

type Source = "app" | "operator" | "call109" | "instagram";

export function ReportForm({
  userId, lang, t, operator = false,
}: {
  userId: string;
  lang: Lang;
  t: Pick<Dict, "report" | "common" | "card" | "status" | "operator" | "routing">;
  operator?: boolean;
}) {
  const router = useRouter();
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<CategoryCode | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [skipDup, setSkipDup] = useState(false);
  const [confirmedId, setConfirmedId] = useState<number | null>(null);
  const [source, setSource] = useState<Source>(operator ? "call109" : "app");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Предпросмотр категории/службы/дублей — с небольшой задержкой после ввода
  useEffect(() => {
    if (!point || title.trim().length < 3) return;
    const id = setTimeout(async () => {
      const res = await previewReport({ text: `${title} ${description}`, lat: point.lat, lng: point.lng, category });
      if (res.ok) setPreview(res.data);
    }, 450);
    return () => clearTimeout(id);
  }, [point, title, description, category]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inAktau(p)) return toast.error(t.report.outside);
        setPoint(p);
        setFlyTo({ ...p, zoom: 17 });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pick = (p: { lat: number; lng: number }) => {
    if (!inAktau(p)) return toast.error(t.report.outside);
    setPoint(p);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 5 - photos.length)) {
        const ph = await uploadPhoto(f, userId);
        setPhotos((prev) => [...prev, ph]);
        // Если точка ещё не выбрана, а в фото есть GPS в пределах Актау — ставим точку по фото
        if (!point && ph.lat != null && ph.lng != null && inAktau({ lat: ph.lat, lng: ph.lng })) {
          const p = { lat: ph.lat, lng: ph.lng };
          setPoint(p);
          setFlyTo({ ...p, zoom: 17 });
        }
      }
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () =>
    start(async () => {
      if (!point || !preview) return;
      const res = await createReport({
        title, description, lat: point.lat, lng: point.lng,
        category: preview.category,
        photos: photos.map(({ path, lat, lng, taken_at }) => ({ path, lat, lng, taken_at })),
        source, source_url: sourceUrl || undefined,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${t.report.created}: ${res.data.public_no}`);
      router.push(`/report/${res.data.public_no}`);
    });

  const confirmDup = (id: number) =>
    start(async () => {
      const res = await confirmReport(id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmedId(id);
      toast.success(`${t.report.confirmed} · ${res.data.count} ${t.card.people}`);
    });

  const dups = !skipDup ? (preview?.duplicates ?? []) : [];
  const canSubmit = !!point && title.trim().length >= 3 && !!preview && !pending && !uploading && (source !== "instagram" || /^https:\/\/(www\.)?instagram\.com\//.test(sourceUrl));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{t.report.newTitle}</h1>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium">1. {t.report.step1}</div>
            <div className="text-sm text-muted-foreground">{t.report.step1Hint}</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
            <span className="hidden sm:inline">{locating ? t.report.locating : t.report.locate}</span>
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <CityMap className="h-[42vh] w-full lg:h-[520px]" center={AKTAU_CENTER} zoom={13} picked={point} onPick={pick} flyTo={flyTo} />
        </div>
        {point && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <MapPin className="size-3.5" /> {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            {preview?.district && ` · ${nm(preview.district, lang)}`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="font-medium lg:mt-9">2. {t.report.step2}</div>

        {operator && (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <Label>{t.operator.source}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[1300]">
                <SelectItem value="call109">{t.operator.srcCall}</SelectItem>
                <SelectItem value="instagram">{t.operator.srcInsta}</SelectItem>
                <SelectItem value="operator">{t.operator.srcOther}</SelectItem>
              </SelectContent>
            </Select>
            {source === "instagram" && (
              <Input placeholder="https://www.instagram.com/p/…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} inputMode="url" />
            )}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="title">{t.report.titleLabel}</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.report.titlePh} maxLength={140} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="desc">{t.report.descLabel}</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
        </div>

        <div className="grid gap-2">
          <Label>{t.report.photo}</Label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={p.path} className="relative size-20 overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 text-[10px] text-white">
                  {p.lat != null ? t.report.photoGeo : t.report.photoNoGeo}
                </span>
                <button type="button" className="absolute top-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="×">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <Button type="button" variant="outline" className="size-20 flex-col gap-1 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                {t.report.addPhoto}
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
        </div>

        {preview && (
          <div className="grid gap-3 rounded-lg border p-3 text-sm">
            <div className="text-xs font-medium text-muted-foreground uppercase">{t.report.detected}</div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">{t.report.categoryLabel}</Label>
              <Select value={preview.category} onValueChange={(v) => setCategory(v as CategoryCode)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[1300]">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{nm(c, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!category && preview.matched.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.report.because}: {preview.matched.join(", ")} · {Math.round(preview.confidence * 100)}%
                </p>
              )}
              {preview.needsManual && !category && <p className="text-xs text-[color:var(--warn)]">{t.report.lowConfidence}</p>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{t.report.service}</dt>
              <dd className="font-medium">{nm(preview.service, lang)}</dd>
              {preview.routingRule && (
                <dd className="col-span-2 text-xs text-muted-foreground">{t.routing[preview.routingRule as keyof Dict["routing"]] ?? preview.routingReason}</dd>
              )}
              <dt className="text-muted-foreground">{t.report.district}</dt>
              <dd>{preview.district ? nm(preview.district, lang) : "—"}</dd>
              <dt className="text-muted-foreground">{t.report.sla}</dt>
              <dd>15 {t.report.workingDays}</dd>
              {preview.nearSocial && (
                <>
                  <dt className="text-muted-foreground">{t.report.nearSocial}</dt>
                  <dd>
                    {AMENITY[preview.nearSocial.amenity]?.[lang]} {preview.nearSocial.name ?? ""} · {preview.nearSocial.distance_m} m ({t.report.priorityUp})
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {dups.length > 0 && (
          <div className="grid gap-3 rounded-lg border border-[color:var(--warn)] bg-warn/5 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[color:var(--warn)]" />
              <div>
                <div className="font-medium">{t.report.dupTitle}</div>
                <p className="text-sm text-muted-foreground">{t.report.dupText}</p>
              </div>
            </div>
            {dups.map((d) => (
              <div key={d.id} className="flex gap-3 rounded-md border bg-card p-2">
                {d.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo} alt="" className="size-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`/report/${d.public_no}`} target="_blank" className="line-clamp-1 text-sm font-medium hover:underline">{d.title}</a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusBadge status={d.status} label={t.status[d.status as keyof Dict["status"]] ?? d.status} />
                    {d.distance_m} m · {d.confirmations_count} {t.card.confirmations}
                  </div>
                  <Button size="sm" className="mt-2" onClick={() => confirmDup(d.id)} disabled={pending || confirmedId === d.id}>
                    <ThumbsUp /> {confirmedId === d.id ? t.report.confirmed : t.report.confirm}
                  </Button>
                </div>
              </div>
            ))}
            {confirmedId ? (
              <Button variant="outline" onClick={() => router.push(`/report/${dups.find((d) => d.id === confirmedId)?.public_no}`)}>
                → {dups.find((d) => d.id === confirmedId)?.public_no}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSkipDup(true)}>{t.report.stillNew}</Button>
            )}
          </div>
        )}

        {dups.length === 0 && (
          <Button size="lg" onClick={submit} disabled={!canSubmit}>
            {pending ? <><Loader2 className="animate-spin" /> {t.report.sending}</> : t.report.submit}
          </Button>
        )}
      </div>
    </div>
  );
}
