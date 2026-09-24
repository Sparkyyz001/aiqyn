"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, ImageUp, CircleAlert, CircleX, Crosshair, Loader2, MapPin, ShieldAlert, Sparkles, ThumbsUp, X } from "lucide-react";
import { CityMap } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { VoiceButton, type VoiceResult } from "@/components/reports/voice-button";
import { previewReport, createReport, confirmReport, analyzePhoto, type Preview } from "@/lib/actions/reports";
import { textChecks, photoChecks, worst, type Check as QCheck } from "@/lib/report-quality";
import type { Vision } from "@/lib/ai-vision";
import { uploadPhoto, type UploadedPhoto } from "@/lib/photo";
import { AKTAU_CENTER, inAktau } from "@/lib/geo";
import { AMENITY, CATEGORIES, nm } from "@/lib/meta";
import type { CategoryCode } from "@/lib/classify";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dict";

type Source = "app" | "operator" | "call109" | "instagram";

export function ReportForm({
  userId, lang, t, operator = false,
}: {
  userId: string;
  lang: Lang;
  t: Pick<Dict, "report" | "common" | "card" | "status" | "operator" | "routing" | "quality">;
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
  // камера и галерея — два разных поля: с capture Android открывает только камеру
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // «Сканирование» последнего фото: что удалось прочитать из EXIF
  const [scan, setScan] = useState<{ gps: "ok" | "outside" | "none" | "device"; taken: string | null } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  // ИИ-зрение по первому фото: off — ключа нет, работаем на собственных проверках
  const [ai, setAi] = useState<{ status: "idle" | "checking" | "done" | "off"; vision: Vision | null }>({ status: "idle", vision: null });

  // Предпросмотр категории/службы/дублей — с небольшой задержкой после ввода
  useEffect(() => {
    if (!point || title.trim().length < 3) return;
    const id = setTimeout(async () => {
      const res = await previewReport({ text: `${title} ${description}`, lat: point.lat, lng: point.lng, category });
      if (res.ok) setPreview(res.data);
    }, 450);
    return () => clearTimeout(id);
  }, [point, title, description, category]);

  const locate = (silent = false) => {
    if (!navigator.geolocation) return void (!silent && toast.error(t.report.locFailed));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inAktau(p)) return void toast.error(`${t.report.outside}. ${t.report.locFailed}`);
        setPoint(p);
        setFlyTo({ ...p, zoom: 17 });
        toast.success(t.report.locOk);
        setScan((s) => (s && s.gps !== "ok" ? { ...s, gps: "device" } : s));
      },
      () => {
        setLocating(false);
        toast.error(t.report.locFailed);
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const runAi = async (ph: UploadedPhoto) => {
    setAi({ status: "checking", vision: null });
    const res = await analyzePhoto({ path: ph.path, text: `${title} ${description}`.trim(), lat: ph.lat, lng: ph.lng, taken_at: ph.taken_at }).catch(() => null);
    if (!res || !res.ok || !res.data.enabled) return setAi({ status: "off", vision: null });
    const v = res.data.vision;
    setAi({ status: "done", vision: v });
    // ИИ сам заполняет карточку — житель может поправить
    if (v?.is_city_problem) {
      setTitle((cur) => cur.trim() || (lang === "kz" ? v.title_kz : v.title_ru));
      setDescription((cur) => cur.trim() || (lang === "kz" ? v.description_kz : v.description_ru));
      setCategory((cur) => cur ?? (v.category as CategoryCode));
    }
  };

  // Голос: ИИ расшифровал рассказ и заполнил карточку; названный микрорайон — точка на карте
  const onVoice = (v: VoiceResult) => {
    if (!v.is_city_problem) toast.warning(t.report.voice.notProblem);
    else toast.success(t.report.voice.filled);
    setTitle(lang === "kz" ? v.title_kz : v.title_ru);
    setDescription(lang === "kz" ? v.description_kz : v.description_ru);
    if (v.is_city_problem) setCategory(v.category as CategoryCode);
    if (v.district && !point) {
      const p = { lat: v.district.lat, lng: v.district.lng };
      setPoint(p);
      setFlyTo({ ...p, zoom: 15 });
    }
    if (v.place_hint) toast.info(fmt(t.report.voice.place, { p: v.place_hint }));
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
        if (photos.length === 0 && ai.status === "idle") void runAi(ph);
        const hasGps = ph.lat != null && ph.lng != null;
        const gpsIn = hasGps && inAktau({ lat: ph.lat!, lng: ph.lng! });
        setScan({ gps: gpsIn ? "ok" : hasGps ? "outside" : "none", taken: ph.taken_at });
        if (gpsIn) {
          // Геометка есть и она в Актау — точка по фото (приоритетнее ручной, если ещё не выбрана)
          if (!point) {
            const p = { lat: ph.lat!, lng: ph.lng! };
            setPoint(p);
            setFlyTo({ ...p, zoom: 17 });
          }
        } else if (!point) {
          // Телефоны часто удаляют геометку при загрузке — берём местоположение устройства
          locate(true);
        }
      }
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const checks: QCheck[] = [
    ...(point ? [{ id: "place_ok", level: "ok" } as QCheck] : [{ id: "place_none", level: "warn" } as QCheck]),
    ...photoChecks(photos[0] ?? null, point),
    ...textChecks(title, description),
    ...(ai.status === "done" && ai.vision
      ? ai.vision.is_city_problem
        ? [{ id: "ai_ok", level: "ok" } as QCheck, ...(ai.vision.prompt_injection_suspected ? [{ id: "ai_injection", level: "warn" } as QCheck] : []), ...(ai.vision.photo_of_screen_suspected ? [{ id: "ai_screen", level: "warn" } as QCheck] : [])]
        : [{ id: "ai_not_problem", level: "fail" } as QCheck]
      : []),
  ];
  const blocking = checks.filter((c) => c.level === "fail");

  const missing = [
    !point && t.report.needPoint,
    title.trim().length < 3 && t.report.needTitle,
    source === "instagram" && !/^https:\/\/(www\.)?instagram\.com\//.test(sourceUrl) && t.report.needInstagram,
    ...blocking.map((c) => fmt(t.quality[c.id as keyof Dict["quality"]] as string, c.vars ?? {})),
  ].filter(Boolean) as string[];

  const submit = () =>
    start(async () => {
      if (missing.length) {
        setShowMissing(true);
        if (!point) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        else titleRef.current?.focus();
        return;
      }
      // Предпросмотр мог ещё не прийти (задержка после ввода) — считаем сейчас
      let pv = preview;
      if (!pv) {
        const r = await previewReport({ text: `${title} ${description}`, lat: point!.lat, lng: point!.lng, category });
        if (!r.ok) return void toast.error(r.error);
        pv = r.data;
        setPreview(pv);
      }
      const res = await createReport({
        title, description, lat: point!.lat, lng: point!.lng,
        category: pv.category,
        photos: photos.map(({ path, lat, lng, taken_at, stats }) => ({ path, lat, lng, taken_at, stats })),
        ai: ai.vision,
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
  const canSubmit = !pending && !uploading;

  const stepHead = (n: number, title: string, hint?: string, done?: boolean) => (
    <div className="flex items-start gap-3">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-[color:var(--ok)] text-white" : "bg-primary/10 text-primary"}`}>{done ? <Check className="size-4" /> : n}</span>
      <div>
        <div className="font-medium">{title}</div>
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.report.newTitle}</h1>

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

        {/* 1. Фото */}
        <section className="flex flex-col gap-3 rounded-2xl border p-4">
          {stepHead(1, t.report.stepPhoto, t.report.stepPhotoHint, photos.length > 0)}
          <div className="grid gap-2">
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
            {photos.length === 0 && (
              <div className="grid w-full grid-cols-2 gap-2">
                <Button type="button" className="btn-shine h-28 flex-col gap-2 text-base" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
                  {t.report.photoCamera}
                </Button>
                <Button type="button" variant="outline" className="h-28 flex-col gap-2 text-base" onClick={() => galleryRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImageUp className="size-6" />}
                  {t.report.photoGallery}
                </Button>
              </div>
            )}
            {photos.length > 0 && photos.length < 5 && (
              <>
                <Button type="button" variant="outline" className="h-20 min-w-20 flex-col gap-1 px-3 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                  {t.report.photoCamera}
                </Button>
                <Button type="button" variant="outline" className="h-20 min-w-20 flex-col gap-1 px-3 text-xs" onClick={() => galleryRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
                  {t.report.photoGallery}
                </Button>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
          {scan && (
            <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
              <div className="mb-1 font-medium">{t.report.scanTitle}</div>
              <ul className="space-y-1">
                <li className="flex items-center gap-1.5 text-[color:var(--ok)]"><Check className="size-3.5" />{t.report.scanUploaded}</li>
                <li className={`flex items-start gap-1.5 ${scan.gps === "ok" || scan.gps === "device" ? "text-[color:var(--ok)]" : "text-[color:var(--warn)]"}`}>
                  {scan.gps === "ok" || scan.gps === "device" ? <Check className="mt-px size-3.5 shrink-0" /> : <CircleAlert className="mt-px size-3.5 shrink-0" />}
                  {scan.gps === "ok" ? t.report.scanGps : scan.gps === "device" ? t.report.locOk : scan.gps === "outside" ? t.report.scanGpsOutside : t.report.scanNoGps}
                  {locating && <Loader2 className="size-3.5 animate-spin" />}
                </li>
                <li className="flex items-center gap-1.5 text-muted-foreground">
                  {scan.taken ? fmt(t.report.scanTime, { t: new Date(scan.taken).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) }) : t.report.scanNoTime}
                </li>
              </ul>
            </div>
          )}
        </div>
          {ai.status === "checking" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {t.quality.aiChecking}</p>
          )}
          {ai.status === "done" && ai.vision?.is_city_problem && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{t.quality.aiSuggest}</div>
                <div className="font-medium">{lang === "kz" ? ai.vision.title_kz : ai.vision.title_ru}</div>
                <div className="text-xs text-muted-foreground">{fmt(t.quality.severity, { n: ai.vision.severity })}</div>
              </div>
            </div>
          )}
        </section>

        {/* 2. Место */}
        <section className="flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-2">
            {stepHead(2, t.report.stepPlace, t.report.stepPlaceHint, !!point)}
            <Button type="button" variant="outline" size="sm" onClick={() => locate()} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
              <span>{locating ? t.report.locating : t.report.locate}</span>
            </Button>
          </div>
          <div ref={mapRef} className={`overflow-hidden rounded-lg border ${showMissing && !point ? "ring-2 ring-[color:var(--danger)]" : ""}`}>
            <CityMap fullTouch className="h-[38vh] w-full lg:h-[380px]" center={AKTAU_CENTER} zoom={13} picked={point} onPick={pick} flyTo={flyTo} />
          </div>
          {point && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <MapPin className="size-3.5" /> {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              {preview?.district && ` · ${nm(preview.district, lang)}`}
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-4 lg:pt-12">
        {/* 3. Что случилось */}
        <section className="flex flex-col gap-3 rounded-2xl border p-4">
          {stepHead(3, t.report.stepText, undefined, title.trim().length >= 3)}
          <VoiceButton l={t.report.voice} onResult={onVoice} />
          <div className="grid gap-2">
            <Label htmlFor="title">{t.report.titleLabel}</Label>
            <Input ref={titleRef} id="title" aria-invalid={showMissing && title.trim().length < 3} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.report.titlePh} maxLength={140} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">{t.report.descLabel}</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </div>
        </section>

        {/* Проверка обращения: собственная модель AIQYN (+ ИИ-зрение, если подключено) */}
        {(photos.length > 0 || point || title.trim()) && (
          <section className="rounded-2xl border p-4">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-primary" /> {t.quality.title}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.quality.sub}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {checks.map((c, i) => (
                <li key={`${c.id}-${i}`} className={`flex items-start gap-2 ${c.level === "fail" ? "text-[color:var(--danger)]" : c.level === "warn" ? "text-[color:var(--warn)]" : "text-[color:var(--ok)]"}`}>
                  {c.level === "fail" ? <CircleX className="mt-0.5 size-4 shrink-0" /> : c.level === "warn" ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
                  <span className={c.level === "ok" ? "text-foreground" : ""}>{fmt(t.quality[c.id as keyof Dict["quality"]] as string, c.vars ?? {})}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
          <div className="flex flex-col gap-2">
            {showMissing && missing.length > 0 && (
              <div className="rounded-md border border-[color:var(--danger)]/50 bg-danger/5 p-2.5 text-sm">
                <div className="font-medium">{t.report.toSend}</div>
                <ul className="mt-1 list-disc pl-5">
                  {missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}
            <Button size="lg" onClick={submit} disabled={!canSubmit}>
              {pending || uploading ? <><Loader2 className="animate-spin" /> {t.report.sending}</> : t.report.submit}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
