// Проверка ключа ИИ-зрения перед показом: node --env-file=.env.local scripts/check-vision.mjs photo.jpg
// Берёт тот же провайдер, что и приложение: GEMINI_API_KEY → GROQ_API_KEY → ANTHROPIC_API_KEY.
import fs from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("укажите путь к фото: node --env-file=.env.local scripts/check-vision.mjs photo.jpg");
const mime = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const b64 = fs.readFileSync(file).toString("base64");
const ask = "Одной строкой по-русски: какая городская проблема на фото и насколько она серьёзна (0–100)?";
const env = process.env;
const t0 = Date.now();
let who, text;

if (env.GEMINI_API_KEY) {
  who = `Gemini ${env.GEMINI_MODEL || "gemini-2.5-flash"}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: ask }] }], generationConfig: { thinkingConfig: { thinkingBudget: 0 } } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j.error ?? j)}`);
  text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
} else if (env.GROQ_API_KEY) {
  who = `Groq ${env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"}`;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }, { type: "text", text: ask }] }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j.error ?? j)}`);
  text = j.choices?.[0]?.message?.content;
} else if (env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  who = "Claude";
  const res = await new Anthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: b64 } }, { type: "text", text: ask }] }],
  });
  text = res.content.find((b) => b.type === "text")?.text;
} else {
  throw new Error("в .env.local нет ни GEMINI_API_KEY, ни GROQ_API_KEY, ни ANTHROPIC_API_KEY");
}
console.log(`OK · ${who} · ${Date.now() - t0} мс:\n${text}`);
