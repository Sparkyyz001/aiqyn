import path from "node:path";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Demand } from "@/lib/budget-demand";
import { fmt, type Dict } from "@/lib/i18n/dict";

// «Народный заказ к бюджету» — один-два листа A4 для депутатов маслихата.
// Та же вёрстка, что у отчёта акиму: чёрно-белая основа, красный — только сорванные сроки.
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
const AMBER = "#9a6700";

const s = StyleSheet.create({
  page: {
    fontFamily: "PTSans",
    fontSize: 9.5,
    paddingTop: 36,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 36,
    lineHeight: 1.35,
    color: INK,
  },
  band: { borderBottom: `2pt solid ${INK}`, paddingBottom: 8 },
  bandTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: { fontSize: 9, fontWeight: "bold", color: TEAL, letterSpacing: 1.5 },
  title: {
    fontFamily: "PTSerif",
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 3,
    lineHeight: 1.25,
  },
  sub: { fontSize: 8.5, color: MUTED, marginTop: 4 },
  meta: { fontSize: 8.5, color: MUTED, textAlign: "right" },
  h2: {
    fontSize: 8.5,
    fontWeight: "bold",
    letterSpacing: 1,
    color: MUTED,
    marginTop: 16,
    marginBottom: 6,
    borderBottom: `0.5pt solid ${LINE}`,
    paddingBottom: 3,
  },
  kpis: { flexDirection: "row", gap: 6, marginTop: 12 },
  kpi: { flex: 1, border: `0.75pt solid ${LINE}`, borderRadius: 3, padding: 7 },
  kpiVal: {
    fontFamily: "PTSerif",
    fontSize: 18,
    fontWeight: "bold",
    height: 24,
    lineHeight: 1.2,
    marginBottom: 2,
  },
  kpiLab: { fontSize: 7.5, color: MUTED },
  th: {
    flexDirection: "row",
    borderBottom: `0.75pt solid ${INK}`,
    paddingBottom: 3,
    fontSize: 7.5,
    color: MUTED,
    fontWeight: "bold",
  },
  tr: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LINE}`,
    paddingVertical: 4,
  },
  cDir: { flex: 1, paddingRight: 6 },
  cNum: { width: 50, textAlign: "right" },
  cMoney: { width: 64, textAlign: "right" },
  small: { fontSize: 8 },
  note: { fontSize: 8, color: MUTED },
  box: { borderRadius: 3, padding: 8, marginTop: 4 },
  item: { marginBottom: 4 },
  foot: {
    position: "absolute",
    bottom: 20,
    left: 56,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#8a94a3",
    borderTop: `0.5pt solid ${LINE}`,
    paddingTop: 5,
  },
});

export function DemandDoc({
  d,
  t,
  lang,
}: {
  d: Demand;
  t: Dict["budget"];
  lang: "ru" | "kz";
}) {
  const loc = lang === "kz" ? "kk-KZ" : "ru-RU";
  const stamp = new Date(d.generated).toLocaleString(loc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Aqtau",
  });
  const n = new Intl.NumberFormat("ru-RU");
  const mln = (x: number) => n.format(Math.round(x));

  const head = (
    <View style={s.band} fixed>
      <View style={s.bandTop}>
        <Text style={s.brand}>AIQYN · АҚТАУ</Text>
        <Text style={s.meta}>{fmt(t.docPeriod, { d: d.days, t: stamp })}</Text>
      </View>
      <Text style={s.title}>{t.docTitle}</Text>
      <Text style={s.sub}>{t.docSub}</Text>
    </View>
  );
  const foot = (
    <View style={s.foot} fixed>
      <Text>{t.docFooter}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );

  return (
    <Document
      title={t.docTitle}
      author="AIQYN"
      subject={t.docTitle}
      language={lang === "kz" ? "kk" : "ru"}
    >
      <Page size="A4" style={s.page}>
        {head}

        <View style={s.kpis}>
          {[
            [n.format(d.kpi.total), fmt(t.kpiTotal, { d: d.days }), INK],
            [n.format(d.kpi.people), t.kpiPeople, INK],
            [`${d.kpi.breachedPct}%`, t.kpiBreached, RED],
            [n.format(d.kpi.chronic), t.kpiChronic, INK],
          ].map(([v, l, c]) => (
            <View key={l} style={s.kpi}>
              <Text style={[s.kpiVal, { color: c }]}>{v}</Text>
              <Text style={s.kpiLab}>{l}</Text>
            </View>
          ))}
        </View>

        <View wrap={false}>
          <Text style={s.h2}>{fmt(t.stuckTitle, { n: d.stuck.total }).toUpperCase()}</Text>
          <Text style={s.note}>{t.stuckSub}</Text>
          <View style={[s.box, { border: `1pt solid ${RED}` }]}>
            {d.stuck.byDir.length === 0 && <Text style={s.note}>{t.stuckNone}</Text>}
            {d.stuck.byDir.map((x) => (
              <Text key={x.code} style={s.item}>
                <Text style={{ fontWeight: "bold" }}>{`${x.name}: ${x.n}`}</Text>
                <Text style={{ color: MUTED }}>{` · ${fmt(t.stuckRow, { a: x.noFunding, b: x.procurement })} · ${x.top.map((p) => `${p.name} (${p.n})`).join(", ")}`}</Text>
              </Text>
            ))}
          </View>
        </View>

        <Text style={s.h2}>{t.dirTitle.toUpperCase()}</Text>
        <View style={s.th}>
          <Text style={s.cDir}>{t.colDir}</Text>
          <Text style={s.cNum}>{t.colN}</Text>
          <Text style={s.cNum}>{t.colBr}</Text>
          <Text style={s.cNum}>{t.colRe}</Text>
          <Text style={s.cNum}>{t.colChronic}</Text>
          <Text style={s.cMoney}>{t.colMoney}</Text>
        </View>
        {d.directions.map((x) => (
          <View key={x.code} style={s.tr} wrap={false}>
            <View style={s.cDir}>
              <Text style={{ fontWeight: "bold" }}>{x.name}</Text>
              <Text style={[s.small, { color: MUTED }]}>
                {t.where}:{" "}
                {x.top.map((p) => `${p.name} (${p.n})`).join(", ") || t.none}
              </Text>
            </View>
            <Text style={[s.cNum, { fontWeight: "bold" }]}>
              {n.format(x.n)}
            </Text>
            <Text
              style={[s.cNum, { color: RED, fontWeight: "bold" }]}
            >{`${x.breachedPct}%`}</Text>
            <Text style={s.cNum}>{String(x.reopened)}</Text>
            <Text style={s.cNum}>{String(x.chronic)}</Text>
            <Text style={s.cMoney}>{x.mln ? mln(x.mln) : t.none}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={s.h2}>{t.needTitle.toUpperCase()}</Text>
          <Text style={s.note}>{t.needSub}</Text>
          <View style={[s.box, { border: `1pt solid ${RED}` }]}>
            {d.need.length === 0 && <Text style={s.note}>{t.none}</Text>}
            {d.need.map((r) => (
              <Text key={r.code} style={s.item}>
                <Text style={{ fontWeight: "bold" }}>{r.name}: </Text>
                {fmt(t.rowNeed, { n: r.n, b: r.br, m: mln(r.mln) })}
              </Text>
            ))}
          </View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>{t.paidTitle.toUpperCase()}</Text>
          <Text style={s.note}>{t.paidSub}</Text>
          <View style={[s.box, { border: `1pt solid ${AMBER}` }]}>
            {d.paid.length === 0 && <Text style={s.note}>{t.none}</Text>}
            {d.paid.map((r) => (
              <View
                key={r.code}
                style={[s.item, { flexDirection: "row", flexWrap: "wrap" }]}
              >
                <Text>
                  <Text style={{ fontWeight: "bold" }}>{r.name}: </Text>
                  {fmt(t.rowPaid, { m: mln(r.mln), n: r.n, r: r.re })}
                  {r.url ? "  " : ""}
                </Text>
                {r.url && (
                  <Link src={r.url} style={[s.small, { color: TEAL }]}>
                    goszakup.gov.kz
                  </Link>
                )}
              </View>
            ))}
          </View>
        </View>

        <Text style={s.h2}>{t.initTitle.toUpperCase()}</Text>
        <Text style={[s.note, { marginBottom: 4 }]}>{t.initSub}</Text>
        {d.initiatives.length === 0 && <Text style={s.note}>{t.none}</Text>}
        {d.initiatives.map((i, k) => (
          <Text key={i.id} style={s.item} wrap={false}>
            <Text style={{ color: MUTED }}>{`${k + 1}. `}</Text>
            <Text style={{ fontWeight: "bold" }}>{i.title}</Text>
            <Text
              style={{ color: MUTED }}
            >{` · ${[i.district, `${n.format(i.votes)} ${t.votes}`, i.fromReport ? fmt(t.fromReport, { no: i.fromReport }) : null].filter(Boolean).join(" · ")}`}</Text>
          </Text>
        ))}

        <Text style={s.h2}>{t.howTitle.toUpperCase()}</Text>
        {t.how.map(([h, p]) => (
          <Text key={h} style={s.item}>
            <Text style={{ fontWeight: "bold" }}>{h}. </Text>
            {p}
          </Text>
        ))}
        <Text style={[s.note, { marginTop: 4 }]}>{t.docHow}</Text>
        {d.modelMoney && (
          <Text style={[s.note, { marginTop: 4 }]}>{t.modelNote}</Text>
        )}
        {foot}
      </Page>
    </Document>
  );
}
