"use server";

import { msg } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// «Мой двор»: житель подписывается на свой микрорайон. Пишется через RLS
// (колонка district_id разрешена клиенту, role/service_id/reputation — нет).
export async function setMyDistrict(districtId: number | null) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, error: await msg("login") };
  const { error } = await supabase.from("profiles").update({ district_id: districtId }).eq("id", data.user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/me");
  return { ok: true as const };
}
