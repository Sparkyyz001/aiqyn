import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role клиент: обходит RLS. Только на сервере и только после проверки
// прав пользователя в server action (пересчёт приоритета, кластеров, итога голосования).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
