import path from "node:path";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Digest } from "@/lib/digest";
import { fmt, type Dict } from "@/lib/i18n/dict";

// Дайджест для акима: A4, поля под подшивку (левое шире), чёрно-белая основа, красный — только
// на нарушенных сроках. Знак тенге в PDF не используем — пишем «тенге» словом (ADDON_4).
const FONTS = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "PTSerif",
  fonts: [
    { src: path.join(FONTS, "PT_Serif-Web-Regular.ttf") },
    { src: path.join(FONTS, "PT_Serif-Web-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.register({
  family: "PTSans",
  fonts: [
    { src: path.join(FONTS, "PT_Sans-Web-Regular.ttf") },
    { src: path.join(FONTS, "PT_Sans-Web-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const INK = "#161b22";
const MUTED = "#5b6573";
const LINE = "#d5dae0";
const RED = "#b3261e";
const TEAL = "#075458";

const s = StyleSheet.create({
  page: { fontFamily: "PTSans", fontSize: 9.5, paddingTop: 36, paddingBottom: 48, paddingLeft: 56, paddingRight: 36, lineHeight: 1.35, color: INK },
  band: { borderBottom: `2pt solid ${INK}`, paddingBottom: 8 },
  bandTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 9, fontWeight: "bold", color: TEAL, letterSpacing: 1.5 },
  title: { fontFamily: "PTSerif", fontSize: 15, fontWeight: "bold", marginTop: 3 },
  meta: { fontSize: 8.5, color: MUTED, textAlign: "right" },
  h2: { fontSize: 8.5, fontWeight: "bold", letterSpacing: 1, color: MUTED, marginTop: 16, marginBottom: 6, borderBottom: `0.5pt solid ${LINE}`, paddingBottom: 3 },
  kpis: { flexDirection: "row", gap: 6 },
  kpi: { flex: 1, border: `0.75pt solid ${LINE}`, borderRadius: 3, padding: 7 },
  kpiRed: { flex: 1, border: `1pt solid ${RED}`, borderRadius: 3, padding: 7 },
  kpiVal: { fontFamily: "PTSerif", fontSize: 18, fontWeight: "bold", height: 24, lineHeight: 1.2, marginBottom: 2 },
  kpiLab: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  num: { width: 14, color: MUTED },
  name: { width: 110, fontWeight: "bold" },
  barBox: { flex: 1, height: 6, backgroundColor: "#eef1f4", marginRight: 6 },
  note: { fontSize: 8.5, color: MUTED },
  alert: { border: `1pt solid ${RED}`, borderRadius: 3, padding: 8, marginTop: 4 },
  alertHead: { color: RED, fontWeight: "bold", fontSize: 9.5, marginBottom: 4 },
  small: { fontSize: 8.5 },
  item: { marginBottom: 5 },
  tRow: { flexDirection: "row", borderBottom: `0.5pt solid ${LINE}`, paddingVertical: 3 },
  tNo: { width: 78, fontFamily: "PTSerif", fontSize: 8 },
  tTitle: { flex: 1, fontSize: 8.5, paddingRight: 6 },
  tMeta: { width: 120, fontSize: 8, color: MUTED },
  tOver: { width: 70, fontSize: 8.5, color: RED, textAlign: "right", fontWeight: "bold" },
  foot: { position: "absolute", bottom: 20, left: 56, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#8a94a3", borderTop: `0.5pt solid ${LINE}`, paddingTop: 5 },
});

export function DigestDoc({ d, t, lang }: { d: Digest; t: Dict["digest"]; lang: "ru" | "kz" }) {
  const loc = lang === "kz" ? "kk-KZ" : "ru-RU";
  const day = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Aqtau" });
  const short = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", timeZone: "Asia/Aqtau" });
  const stamp = new Date(d.generated).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Aqtau" });
  const endDay = new Date(new Date(d.to).getTime() - 1).toISOString();
  const k = d.kpi;
  const maxSvc = Math.max(1, ...d.services.map((x) => x.n));

  const head = (
    <View style={s.band} fixed>
      <View style={s.bandTop}>
        <Text style={s.brand}>AIQYN · АҚТАУ</Text>
        <View>
          <Text style={s.meta}>{fmt(t.periodLine, { a: day(d.from), b: day(endDay) })}</Text>
          <Text style={s.meta}>{fmt(t.generated, { d: stamp })}</Text>
        </View>
      </View>
      <Text style={s.title}>{t.title}</Text>
    </View>
  );
  const foot = (
    <View style={s.foot} fixed>
      <Text>{t.footer}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={t.title} author="AIQYN" subject={t.title} language={lang === "kz" ? "kk" : "ru"}>
      <Page size="A4" style={s.page}>
        {head}

        <Text style={s.h2}>{t.secSummary}</Text>
        {!d.enough && <Text style={s.note}>{t.few}</Text>}
        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiVal}>{String(k.created)}</Text>
            <Text style={s.kpiLab}>{t.created}</Text>
            {k.createdDelta != null && <Text style={s.kpiLab}>{`${k.createdDelta > 0 ? "+" : ""}${k.createdDelta}% ${t.vsPrev}`}</Text>}
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiVal}>{String(k.resolved)}</Text>
            <Text style={s.kpiLab}>{t.resolved}</Text>
          </View>
          <View style={k.breached ? s.kpiRed : s.kpi}>
            <Text style={[s.kpiVal, k.breached ? { color: RED } : {}]}>{k.breached}</Text>
            <Text style={s.kpiLab}>{t.breached}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiVal}>{String(k.reopened)}</Text>
            <Text style={s.kpiLab}>{t.reopened}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiVal}>{String(k.avgDays ?? "—")}</Text>
            <Text style={s.kpiLab}>{`${t.avg}, ${t.days}`}</Text>
          </View>
        </View>

        <Text style={s.h2}>{t.secServices}</Text>
        {d.services.length === 0 && <Text style={s.note}>{t.none}</Text>}
        {d.services.map((x, i) => (
          <View key={x.name} style={s.row}>
            <Text style={s.num}>{i + 1}.</Text>
            <Text style={s.name}>{x.name}</Text>
            <View style={s.barBox}>
              <View style={{ width: `${(x.n / maxSvc) * 100}%`, height: 6, backgroundColor: RED }} />
            </View>
            <Text style={[s.small, { width: 170 }]}>{fmt(t.svcRow, { n: x.n, d: x.avgOver })}</Text>
          </View>
        ))}

        <Text style={s.h2}>{t.secPain}</Text>
        {d.painTop.map((x, i) => (
          <View key={x.name} style={s.row}>
            <Text style={s.num}>{i + 1}.</Text>
            <Text style={s.name}>{x.name}</Text>
            <View style={s.barBox}>
              <View style={{ width: `${x.index}%`, height: 6, backgroundColor: INK }} />
            </View>
            <Text style={[s.small, { width: 30, fontWeight: "bold", textAlign: "right" }]}>{x.index}</Text>
            <Text style={[s.small, { width: 140, textAlign: "right", color: x.delta != null && x.delta >= 50 ? RED : MUTED }]}>
              {x.delta == null ? "" : `${x.delta > 0 ? "+" : "-"}${Math.abs(x.delta)}%${x.delta >= 50 ? ` · ${t.sharp}` : ""}`}
            </Text>
          </View>
        ))}

        <Text style={s.h2}>{t.secRisk}</Text>
        <View style={s.alert}>
          <Text style={s.alertHead}>{fmt(t.riskIntro, { n: k.atRisk })}</Text>
          {d.riskList.map((x) => (
            <View key={x.no} style={s.item}>
              <Text style={s.small}>
                <Text style={{ fontWeight: "bold" }}>{x.no}</Text> · {x.title} · {x.district} · {x.service}
              </Text>
              <Text style={[s.small, { color: MUTED }]}>{fmt(t.riskRow, { d: short(x.due), p: x.p })}</Text>
            </View>
          ))}
        </View>
        {foot}
      </Page>

      <Page size="A4" style={s.page}>
        {head}

        <Text style={s.h2}>{t.secChronic}</Text>
        {d.chronic.length === 0 && <Text style={s.note}>{t.none}</Text>}
        {d.chronic.map((c, i) => (
          <View key={i} style={s.item}>
            <Text style={{ fontWeight: "bold" }}>
              • {c.district}, {c.label}
            </Text>
            <Text style={[s.small, { color: MUTED, marginLeft: 8 }]}>
              {c.category} · {fmt(t.chronicRow, { n: c.count, r: c.reopen, d: short(c.since) })}
            </Text>
          </View>
        ))}

        <Text style={s.h2}>{t.secMoney}</Text>
        {d.procurement.length === 0 && <Text style={s.note}>{t.none}</Text>}
        {d.procurement.map((m) => (
          <View key={m.name} style={s.item}>
            <Text>
              <Text style={{ fontWeight: "bold" }}>{m.name}: </Text>
              {fmt(t.moneyRow, { m: m.mln.toFixed(1), n: m.n, b: m.br })}
            </Text>
            {m.url && (
              <Link src={m.url} style={[s.small, { color: TEAL }]}>
                {t.source}
              </Link>
            )}
          </View>
        ))}
        <Text style={[s.note, { marginTop: 2 }]}>{d.modelMoney ? t.moneyModel : t.moneyReal}</Text>

        <Text style={s.h2}>{t.secList}</Text>
        {d.breachedList.length === 0 && <Text style={s.note}>{t.none}</Text>}
        {d.breachedList.map((x) => (
          <View key={x.no} style={s.tRow} wrap={false}>
            <Text style={s.tNo}>{x.no}</Text>
            <Text style={s.tTitle}>{x.title}</Text>
            <Text style={s.tMeta}>
              {x.district} · {x.service}
            </Text>
            <Text style={s.tOver}>{fmt(t.overdue, { d: x.over })}</Text>
          </View>
        ))}
        {foot}
      </Page>
    </Document>
  );
}
