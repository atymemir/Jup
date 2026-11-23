import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Никаких browser-only проверок. Next build импортит файлы на сервере.
  if (!url || !key) {
    // не ломаем build локально из-за env — но в проде env обязателен
    throw new Error("Вход пока недоступен. Попробуйте позже.");
  }

  _client = createClient(url, key, {
    // The MVP shares a Supabase project with algₐ, but each app keeps its
    // own browser session. Signing out here must not sign out the main app.
    auth: { storageKey: "findbuddy-auth" },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
    },
  });
  return _client;
}
