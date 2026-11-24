import { getSupabase } from "./supabase";
import { fetchJson } from "./http";
import { sharedRequest } from "./requestPool.mjs";
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
      view === "notifications" ||
      view.startsWith("student/") ||
      action)
  ) {
    const session = await getSupabase().auth.getSession();
    token = session.data.session?.access_token;
    if (!token && view !== "viewer")
      throw new Error("Войдите в аккаунт, чтобы продолжить.");
  }
  const request = () =>
    fetchJson<T>(
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
  // Different sessions never share a response; writes always make a new request.
  // HttpOnly local-preview cookies cannot be used as a safe client identity key.
  return !action && (!view || token)
    ? sharedRequest(JSON.stringify([view, token ?? ""]), request)
    : request();
}
