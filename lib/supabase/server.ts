import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Клиент от имени текущего пользователя (anon key + его сессия) — RLS работает как для него.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Вызов из Server Component: куки обновит proxy.ts
          }
        },
      },
    }
  );
}
