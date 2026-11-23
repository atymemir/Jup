type Environment = Record<string, string | undefined>;

export function hostedAccountsConfigured(env: Environment = process.env) {
  return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function loopback(host: string) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

export function localAccountsAllowed(req: Request, env: Environment = process.env) {
  // A serverless /tmp database disappears and is not shared between instances.
  // Local accounts are exclusively for a developer's own computer.
  if (env.VERCEL || env.FINDBUDDY_PREVIEW !== "1" ||
      env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  const url = new URL(req.url);
  return loopback(url.host) &&
    [req.headers.get("host"), req.headers.get("x-forwarded-host")]
      .every((host) => !host || loopback(host));
}
