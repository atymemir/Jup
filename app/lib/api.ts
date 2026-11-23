import { getSupabase } from "./supabase";
import { fetchJson } from "./http";
export async function api<T>(
  view: string,
  action?: string,
  data?: Record<string, unknown>,
): Promise<T> {
  let token: string | undefined;
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (view === "dashboard" ||
      view === "platform" ||
      view === "viewer" ||
      view.startsWith("student/") ||
      action)
  ) {
    const session = await getSupabase().auth.getSession();
    token = session.data.session?.access_token;
    if (!token && view !== "viewer")
      throw new Error("Войдите в аккаунт, чтобы продолжить.");
  }
  return fetchJson<T>(
    `/findbuddy/api/findbuddy${view ? `?view=${encodeURIComponent(view)}` : ""}`,
    {
      method: action ? "POST" : "GET",
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(action ? { "Content-Type": "application/json" } : {}),
      },
      ...(action ? { body: JSON.stringify({ action, data }) } : {}),
    },
  );
}
