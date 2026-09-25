import ExcelJS from "exceljs";
import { getProfile } from "@/lib/auth";
import { msg } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";
import { flow, titleOf } from "@/lib/data";
import { getReference } from "@/lib/reference";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";

export const runtime = "nodejs";

const OPEN = ["new", "routed", "accepted", "in_progress", "reopened", "awaiting_confirmation"];

// Выгрузка обращений для акимата и служб: Excel (.xlsx) с фильтрами и подсветкой просрочек или CSV.
// ?format=xlsx|csv  ?scope=open|breached|risk|all  ?lang=kz
// Служба получает только свои обращения. Персональных данных заявителей в выгрузке нет.
export async function GET(req: Request) {
  const me = await getProfile();
  if (!me) return new Response(await msg("login"), { status: 401 });
  if (!["akimat", "operator", "service"].includes(me.role)) return new Response(await msg("noAccess"), { status: 403 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const scope = url.searchParams.get("scope") ?? "open";
  const lang = url.searchParams.get("lang") === "kz" ? "kz" : "ru";
  const L = DICTS[lang].export;

  const [{ all }, ref] = await Promise.all([flow(), getReference()]);
  const svcCode = me.role === "service" && me.service_id != null ? ref.serviceById.get(me.service_id)?.code : null;
  const now = new Date();
  const hctx = honestContext(all);

  const rows = all
    .filter((r) => (!svcCode || r.service === svcCode) && r.status !== "rejected")
    .map((r) => {
      const open = OPEN.includes(r.status);
      const f = open && !r.sla_breached ? honestForecast(r, hctx, now) : null;
      return { r, open, risk: r.sla_breached && open ? 1 : f && f.ok ? f.pBreach ?? null : null, forecast: f && f.ok ? f.date : null };
    })
    .filter((x) => (scope === "all" ? true : scope === "breached" ? x.open && x.r.sla_breached : scope === "risk" ? x.open && !x.r.sla_breached && (x.risk ?? 0) >= 0.5 : x.open))
    .sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0) || b.r.priority - a.r.priority);

  const d = (iso: string | null) => (iso ? new Date(iso) : null);
  const table = rows.map(({ r, risk, forecast }) => [
    r.public_no,
    titleOf(r, lang),
    nm(CATEGORY[r.category], lang),
    r.district && DISTRICT[r.district] ? nm(DISTRICT[r.district], lang) : "",
    SERVICE[r.service] ? nm(SERVICE[r.service], lang) : r.service,
    (DICTS[lang].status as Record<string, string>)[r.status] ?? r.status,
    d(r.created_at),
    d(r.sla_due_at),
    d(forecast),
    r.sla_breached ? L.yes : L.no,
    risk == null ? null : Math.round(risk * 100) / 100,
    Math.round(r.priority),
    r.confirmations,
    r.reopen_count,
    r.delay_reason ? (DICTS[lang].card.delayReasons as Record<string, string>)[r.delay_reason] ?? r.delay_reason : "",
    r.demo ? L.model : L.real,
    `${url.origin}/report/${r.public_no}`,
  ]);
  const stamp = now.toISOString().slice(0, 10);
  const file = `aiqyn-${scope}-${stamp}`;

  if (format === "csv") {
    // «;» и BOM — Excel с русской локалью открывает кириллицу и колонки без мастера импорта
    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "﻿" + [L.cols, ...table].map((row) => row.map(esc).join(";")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"`, "Cache-Control": "private, no-store" } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "AIQYN";
  wb.created = now;
  const ws = wb.addWorksheet(L.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = L.cols.map((h, i) => ({ header: h, width: [16, 44, 26, 16, 34, 22, 12, 12, 12, 11, 10, 10, 10, 10, 26, 12, 40][i] ?? 14 }));
  ws.addRows(table);
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF075458" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  for (const c of [7, 8, 9]) ws.getColumn(c).numFmt = "dd.mm.yyyy";
  ws.getColumn(11).numFmt = "0%";
  ws.getColumn(17).font = { color: { argb: "FF075458" }, underline: true };
  ws.eachRow((row, i) => {
    if (i === 1) return;
    if (row.getCell(10).value === L.yes) row.getCell(10).font = { bold: true, color: { argb: "FFB3261E" } };
    const risk = Number(row.getCell(11).value ?? 0);
    if (risk >= 0.5) row.getCell(11).font = { bold: true, color: { argb: "FFB3261E" } };
    const link = row.getCell(17).value;
    if (typeof link === "string") row.getCell(17).value = { text: link, hyperlink: link };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: L.cols.length } };

  // второй лист — пояснения: откуда данные и что модельное
  const info = wb.addWorksheet(L.infoSheet);
  info.columns = [{ width: 110 }];
  for (const line of [L.infoTitle, `${L.generated}: ${now.toLocaleString(lang === "kz" ? "kk-KZ" : "ru-RU", { timeZone: "Asia/Aqtau" })}`, `${L.rows}: ${table.length}`, "", ...L.info]) info.addRow([line]);
  info.getRow(1).font = { bold: true, size: 14 };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
