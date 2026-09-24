// Проверка ключа ИИ-зрения перед показом: node --env-file=.env.local scripts/check-vision.mjs photo.jpg
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const file = process.argv[2];
if (!process.env.ANTHROPIC_API_KEY) throw new Error("нет ANTHROPIC_API_KEY в .env.local");
if (!file) throw new Error("укажите путь к фото: node --env-file=.env.local scripts/check-vision.mjs photo.jpg");

const type = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const t0 = Date.now();
const res = await new Anthropic({ timeout: 15000 }).messages.create({
  model: "claude-sonnet-5",
  max_tokens: 400,
  output_config: { effort: "low" },
  messages: [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: type, data: fs.readFileSync(file).toString("base64") } },
        { type: "text", text: "Одной строкой: какая городская проблема на фото и насколько она серьёзна (0–100)?" },
      ],
    },
  ],
});
const text = res.content.find((b) => b.type === "text")?.text;
console.log(`OK за ${Date.now() - t0} мс:`, text);
