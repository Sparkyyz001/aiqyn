"use client";

import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import type { PhotoInput } from "@/lib/actions/reports";

// ФИШКА 6 (клиентская часть): читаем EXIF до сжатия (canvas стирает метаданные),
// сжимаем до 1600 px и грузим в Storage в папку пользователя. Координаты и время
// съёмки уходят на сервер отдельно — там идёт сверка с точкой обращения.

export type UploadedPhoto = PhotoInput & { preview: string };

async function readExif(file: File): Promise<{ lat: number | null; lng: number | null; taken_at: string | null }> {
  try {
    const data = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
    const dt: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    return {
      lat: typeof data?.latitude === "number" ? data.latitude : null,
      lng: typeof data?.longitude === "number" ? data.longitude : null,
      taken_at: dt instanceof Date && !isNaN(dt.getTime()) ? dt.toISOString() : null,
    };
  } catch {
    return { lat: null, lng: null, taken_at: null };
  }
}

async function compress(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.82));
  } catch {
    return file; // браузер не умеет этот формат (напр. HEIC) — грузим как есть
  }
}

export async function uploadPhoto(file: File, userId: string): Promise<UploadedPhoto> {
  const exif = await readExif(file);
  const blob = await compress(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("report-photos").upload(path, blob, {
    contentType: blob.type || file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, ...exif, preview: URL.createObjectURL(blob) };
}
