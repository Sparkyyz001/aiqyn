import { getProfile } from "@/lib/auth";
import { msg } from "@/lib/i18n/server";
import { geminiEnabled } from "@/lib/gemini";
import { analyzeVoice } from "@/lib/ai-voice";
import { allowAi } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Голосовая жалоба: тело запроса — WAV (моно, 16 кГц) до ~60 секунд.
// Отдельный маршрут, а не server action: у действий лимит тела 1 МБ.
const MAX_BYTES = 2.5 * 1024 * 1024;

export async function POST(req: Request) {
  const me = await getProfile();
  if (!me) return Response.json({ error: await msg("login") }, { status: 401 });
  if (!geminiEnabled()) return Response.json({ error: "voice_off" }, { status: 503 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 2000) return Response.json({ error: "empty" }, { status: 400 });
  if (buf.length > MAX_BYTES) return Response.json({ error: "too_long" }, { status: 413 });
  if (buf.subarray(0, 4).toString("ascii") !== "RIFF") return Response.json({ error: "format" }, { status: 400 });
  if (!(await allowAi(me.id, "voice"))) return Response.json({ error: "limit" }, { status: 429 });
  const voice = await analyzeVoice(buf);
  if (!voice) return Response.json({ error: "ai" }, { status: 502 });
  return Response.json({ voice });
}
