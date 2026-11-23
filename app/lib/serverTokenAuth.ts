import { createClient } from "@supabase/supabase-js";

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const [scheme, ...rest] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;

  const token = rest.join(" ").trim();
  return token || null;
}

export async function getUserFromAccessToken(authHeader: string | null) {
  const token = parseBearerToken(authHeader);

  if (!token) {
    return { user: null, error: "Missing bearer token." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: error?.message || "Unauthorized." };
  }

  return { user: data.user, token, error: null };
}
