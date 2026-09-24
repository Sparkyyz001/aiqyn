import { renderToBuffer } from "@react-pdf/renderer";
import { DICTS } from "@/lib/i18n/dict";
import { buildDemand } from "@/lib/budget-demand";
import { DemandDoc } from "@/lib/pdf/demand-doc";

export const runtime = "nodejs";

// «Народный заказ к бюджету» — публичный документ (только агрегаты, без личных данных):
// его должен получить любой депутат или житель без аккаунта. ?lang=kz, ?view=1 — открыть в браузере.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "kz" ? "kz" : "ru";
  const view = url.searchParams.get("view") === "1";
  const d = await buildDemand(lang);
  const buf = await renderToBuffer(<DemandDoc d={d} t={DICTS[lang].budget} lang={lang} />);
  const name = `aiqyn-budget-demand-${d.generated.slice(0, 10)}-${lang}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${view ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
