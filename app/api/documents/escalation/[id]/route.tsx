import { renderToBuffer } from "@react-pdf/renderer";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EscalationDoc } from "@/lib/pdf/escalation-doc";
import type { EscalationPayload } from "@/lib/escalation";

export const runtime = "nodejs";

// PDF пакета эскалации. Содержит ФИО заявителя — отдаём только создателю, акимату и оператору.
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/escalation/[id]">) {
  const { id } = await ctx.params;
  const me = await getProfile();
  if (!me) return new Response("Нужно войти", { status: 401 });
  const db = createAdminClient();
  const { data: e } = await db.from("escalations").select("id, created_by, payload").eq("id", Number(id)).single();
  if (!e) return new Response("Не найдено", { status: 404 });
  if (e.created_by !== me.id && !["akimat", "operator"].includes(me.role)) return new Response("Нет доступа", { status: 403 });

  const p = e.payload as EscalationPayload;
  const buf = await renderToBuffer(<EscalationDoc p={p} />);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="eotinish-${p.report_no}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
