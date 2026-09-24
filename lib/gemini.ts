import "server-only";

// Вызов Gemini (бесплатный тариф Google AI Studio) со строгой JSON-схемой ответа.
// Бесплатные модели перегружаются в часы пик — при 503/429/404 пробуем следующую.
export const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"].filter(Boolean) as string[];

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/** Возвращает текст ответа (JSON по схеме) или бросает ошибку, если ни одна модель не ответила */
export async function geminiJSON(input: { system: string; parts: Part[]; schema: object; budgetMs?: number }): Promise<string> {
  const deadline = Date.now() + (input.budgetMs ?? 18000);
  let last = "";
  for (const model of GEMINI_MODELS) {
    const left = deadline - Date.now();
    if (left < 2000) break;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      signal: AbortSignal.timeout(Math.min(14000, left)),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: input.parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: input.schema, temperature: 0.2 },
      }),
    }).catch((e: Error) => e);
    if (r instanceof Error) {
      last = `${model}: ${r.message}`;
      continue;
    }
    if (r.ok) {
      const j = await r.json();
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (text) return text;
      last = `${model}: пустой ответ`;
      continue;
    }
    last = `${model} ${r.status}`;
    if (![404, 429, 500, 503].includes(r.status)) break;
  }
  throw new Error(`gemini: ${last}`);
}
