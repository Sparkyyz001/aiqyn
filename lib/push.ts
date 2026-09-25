import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Web Push: уведомление всплывает на телефоне как у приложения, даже когда сайт закрыт.
// Текст — на языке пользователя; просроченные подписки (410/404) удаляем.
const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const pushEnabled = () => !!PUB && !!PRIV;
if (PUB && PRIV) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@aiqyn.kz", PUB, PRIV);

export type PushMsg = { user_id: string; title: string; title_kz: string; body: string | null; body_kz: string | null; link: string; tone?: string };

export async function sendPush(msgs: PushMsg[]) {
  if (!pushEnabled() || !msgs.length) return;
  const db = createAdminClient();
  const users = [...new Set(msgs.map((m) => m.user_id))];
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users),
    db.from("profiles").select("id, lang").in("id", users),
  ]);
  if (!subs?.length) return;
  const lang = new Map((profiles ?? []).map((p) => [p.id, p.lang === "kz" ? "kz" : "ru"]));
  const dead: number[] = [];
  await Promise.all(
    msgs.flatMap((m) =>
      subs
        .filter((s) => s.user_id === m.user_id)
        .map(async (s) => {
          const kz = lang.get(m.user_id) === "kz";
          const payload = JSON.stringify({ title: kz ? m.title_kz : m.title, body: (kz ? m.body_kz : m.body) ?? "", url: m.link, tag: m.link, tone: m.tone });
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) dead.push(s.id);
            else console.error("push", code, (e as Error).message);
          }
        })
    )
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
}
