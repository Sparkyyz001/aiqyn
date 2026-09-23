import path from "node:path";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { EscalationPayload } from "@/lib/escalation";

// PT Serif (OFL): кириллица + казахские буквы. Файлы — в assets/fonts, попадают в бандл
// функции через outputFileTracingIncludes в next.config.ts.
const FONTS = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "PTSerif",
  fonts: [
    { src: path.join(FONTS, "PT_Serif-Web-Regular.ttf") },
    { src: path.join(FONTS, "PT_Serif-Web-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const s = StyleSheet.create({
  page: { fontFamily: "PTSerif", fontSize: 10.5, padding: 40, lineHeight: 1.4, color: "#1b2330" },
  h1: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  muted: { color: "#5b6573" },
  h2: { fontSize: 11.5, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 2 },
  key: { width: 150, color: "#5b6573" },
  val: { flex: 1 },
  alert: { marginTop: 10, padding: 8, border: "1pt solid #d0452f", color: "#a02f1e" },
  tl: { flexDirection: "row", marginBottom: 3 },
  tlAt: { width: 105, color: "#5b6573" },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  photo: { width: 160 },
  img: { width: 160, height: 120, objectFit: "cover" },
  foot: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#8a94a3" },
});

const d = (x: string | null) =>
  x ? new Date(x).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function EscalationDoc({ p }: { p: EscalationPayload }) {
  const Row = ({ k, v }: { k: string; v: string }) => (
    <View style={s.row}>
      <Text style={s.key}>{k}</Text>
      <Text style={s.val}>{v}</Text>
    </View>
  );
  return (
    <Document title={`Эскалация ${p.report_no}`} author={p.applicant.full_name} subject="Пакет для eOtinish">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Жалоба на нарушение срока рассмотрения обращения</Text>
        <Text style={s.muted}>
          Обращение {p.report_no} · сформировано {d(p.generated_at)} · для подачи на eotinish.kz
        </Text>

        <Text style={s.h2}>Заявитель</Text>
        <Row k="ФИО" v={p.applicant.full_name} />
        {p.applicant.contact && <Row k="Контакт" v={p.applicant.contact} />}

        <Text style={s.h2}>Суть обращения</Text>
        <Row k="Проблема" v={p.title} />
        {p.description && <Row k="Описание" v={p.description} />}
        <Row k="Категория" v={p.category} />
        <Row k="Адрес" v={p.address} />
        <Row k="Координаты" v={`${p.coords.lat.toFixed(6)}, ${p.coords.lng.toFixed(6)}`} />

        <Text style={s.h2}>Ответственная организация</Text>
        <Row k="Наименование" v={p.service.name} />
        {p.service.address && <Row k="Адрес" v={p.service.address} />}
        {p.service.phone && <Row k="Телефон" v={p.service.phone} />}
        {!p.service.verified && <Text style={s.muted}>Реквизиты указаны по открытым источникам и требуют уточнения.</Text>}

        <Text style={s.h2}>Сроки и доказательства</Text>
        <Row k="Зарегистрировано" v={d(p.created_at)} />
        <Row k="Срок по ст. 76 АППК" v={d(p.sla_due_at)} />
        <Row k="Подтвердили жители" v={`${p.confirmations} чел.`} />
        <Row k="Переоткрыто жителями" v={`${p.reopen_count} раз(а)`} />
        {p.sla_breached_at && <Text style={s.alert}>Срок рассмотрения нарушен с {d(p.sla_breached_at)}.</Text>}

        <Text style={s.h2}>Хронология</Text>
        {p.timeline.map((t, i) => (
          <View key={i} style={s.tl} wrap={false}>
            <Text style={s.tlAt}>{d(t.at)}</Text>
            <Text style={s.val}>
              {t.what}
              {t.comment ? ` — ${t.comment}` : ""}
            </Text>
          </View>
        ))}

        {p.photos.length > 0 && (
          <>
            <Text style={s.h2}>Фотофиксация</Text>
            <View style={s.photos}>
              {p.photos.slice(0, 6).map((ph, i) => (
                <View key={i} style={s.photo} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={ph.url} style={s.img} />
                  <Text style={s.muted}>
                    {ph.kind === "before" ? "До" : "После"} · {ph.geo_verified ? "геометка совпала" : "без геоподтверждения"}
                    {ph.taken_at ? ` · ${d(ph.taken_at)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.h2}>Правовое основание</Text>
        {p.legal_basis.map((l, i) => (
          <Text key={i}>• {l}</Text>
        ))}

        <Text style={s.h2}>Требование</Text>
        <Text>Прошу рассмотреть жалобу, обеспечить устранение проблемы и сообщить конкретный срок и ответственного исполнителя.</Text>

        <Text style={s.foot} fixed>
          Публичная карточка с полной хронологией: <Link src={p.public_url}>{p.public_url}</Link> · Пакет подготовлен AIQYN, подаётся заявителем лично через eotinish.kz
        </Text>
      </Page>
    </Document>
  );
}
