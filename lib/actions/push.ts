"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Подписка этого браузера/телефона на push-уведомления пользователя
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua?: string) {
  const me = await getProfile();
  if (!me) return { ok: false as const };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false as const };
  await createAdminClient()
    .from("push_subscriptions")
    .upsert({ user_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: ua?.slice(0, 200) ?? null }, { onConflict: "endpoint" });
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const me = await getProfile();
  if (!me) return { ok: false as const };
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", me.id);
  return { ok: true as const };
}

// Проверка: прислать себе тестовое уведомление
export async function sendTestPush() {
  const me = await getProfile();
  if (!me) return { ok: false as const };
  const { sendPush } = await import("@/lib/push");
  await sendPush([
    {
      user_id: me.id,
      title: "AIQYN: уведомления включены",
      title_kz: "AIQYN: хабарламалар қосылды",
      body: "Так будут приходить новости по вашим обращениям.",
      body_kz: "Өтініштеріңіз бойынша жаңалықтар осылай келеді.",
      link: "/notifications",
    },
  ]);
  return { ok: true as const };
}
