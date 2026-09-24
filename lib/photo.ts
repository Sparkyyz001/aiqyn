"use client";

import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import type { PhotoInput } from "@/lib/actions/reports";
import { measurePhoto } from "@/lib/report-quality";

// ФИШКА 6 (клиентская часть): читаем EXIF до сжатия (canvas стирает метаданные),
// сжимаем до 1600 px и грузим в Storage в папку пользователя. Координаты и время
// съёмки уходят на сервер отдельно — там идёт сверка с точкой обращения.

export type UploadedPhoto = PhotoInput & { preview: string };

async function readExif(file: File): Promise<{ lat: number | null; lng: number | null; taken_at: string | null }> {
  try {
    // GPS читаем отдельным вызовом: с опцией pick exifr отбрасывает сырые GPS-теги,
    // из которых вычисляются latitude/longitude
    const [gps, meta] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ["DateTimeOriginal", "CreateDate"]).catch(() => null),
    ]);
    const dt: Date | undefined = meta?.DateTimeOriginal ?? meta?.CreateDate;
    return {
      lat: typeof gps?.latitude === "number" ? gps.latitude : null,
      lng: typeof gps?.longitude === "number" ? gps.longitude : null,
      taken_at: dt instanceof Date && !isNaN(dt.getTime()) ? dt.toISOString() : null,
    };
  } catch {
    return { lat: null, lng: null, taken_at: null };
  }
}

// Декодируем через <img>: он учитывает EXIF-поворот во всех браузерах (Safari на iPhone
// через createImageBitmap иногда кладёт кадр набок). Safari сам читает HEIC.
function decode(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok: boolean) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (ok) res(img);
      else rej(new Error("decode"));
    };
    const timer = setTimeout(() => done(false), 15000);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

async function compress(file: File, max = 1600): Promise<Blob> {
  try {
    const img = await decode(file);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (blob && blob.size > 0) return blob;
  } catch {
    /* браузер не умеет этот формат — ниже грузим как есть */
  }
  return file;
}

// тип файла: iPhone иногда отдаёт HEIC с пустым file.type
function mimeOf(blob: Blob, name: string) {
  if (blob.type) return blob.type;
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif" ? "image/heic" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

export async function uploadPhoto(file: File, userId: string): Promise<UploadedPhoto> {
  const exif = await readExif(file);
  const blob = await compress(file);
  const type = mimeOf(blob, file.name);
  if (blob.size > 10 * 1024 * 1024) throw new Error("Фото больше 10 МБ — выберите другое или сделайте снимок камерой");
  const ext = type === "image/jpeg" ? "jpg" : type === "image/heic" ? "heic" : type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("report-photos").upload(path, blob, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const stats = await measurePhoto(blob);
  return { path, ...exif, stats, preview: URL.createObjectURL(blob) };
}
