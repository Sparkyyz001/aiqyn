import { createBrowserClient } from "@supabase/ssr";

// Браузерный клиент — для Realtime-подписок и загрузки фото в Storage.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
