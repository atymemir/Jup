import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
export class MiniAppAuthError extends Error {
  code: "invalid" | "expired" | "unverified" | "unavailable";
  constructor(
    code: "invalid" | "expired" | "unverified" | "unavailable",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}
export type TelegramIdentity = { id: number; startParam: string };
export function verifyTelegramInitData(
  raw: unknown,
  botToken: string,
  now = Date.now(),
): TelegramIdentity {
  const invalid = () =>
    new MiniAppAuthError(
      "invalid",
      "Не удалось подтвердить Telegram. Откройте приложение из бота.",
    );
  if (typeof raw !== "string" || !raw || raw.length > 16384 || !botToken)
    throw invalid();
  const params = new URLSearchParams(raw);
  const keys = [...params.keys()];
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key) => !/^[a-z_]+$/.test(key))
  )
    throw invalid();
  const hash = params.get("hash");
  if (!hash || !/^[a-f\d]{64}$/i.test(hash)) throw invalid();
  const check = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = createHmac("sha256", secret).update(check).digest();
  if (!timingSafeEqual(signature, Buffer.from(hash, "hex"))) throw invalid();
  const authDate = Number(params.get("auth_date"));
  if (
    !/^\d+$/.test(params.get("auth_date") ?? "") ||
    !Number.isSafeInteger(authDate) ||
    authDate * 1000 > now + 30000 ||
    now - authDate * 1000 > 300000
  )
    throw new MiniAppAuthError(
      "expired",
      "Время входа истекло. Закройте приложение и откройте его заново из Telegram.",
    );
  let user;
  try {
    user = JSON.parse(params.get("user") ?? "null");
  } catch {
    throw invalid();
  }
  if (
    !user ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0 ||
    user.is_bot === true
  )
    throw invalid();
  return { id: user.id, startParam: params.get("start_param") ?? "" };
}
export type MiniAppSession = { access_token: string; refresh_token: string };
export type MiniAppServices = {
  linkedUser: (telegramId: number) => Promise<string | null>;
  user: (
    id: string,
  ) => Promise<{ id: string; email: string | null; confirmed: boolean } | null>;
  issue: (user: {
    id: string;
    email: string;
  }) => Promise<MiniAppSession & { userId: string }>;
  revoke: (session: MiniAppSession) => Promise<void>;
};
export async function signInLinkedTelegram(
  identity: TelegramIdentity,
  services: MiniAppServices,
) {
  const id = await services.linkedUser(identity.id);
  if (!id) return { linked: false as const };
  const user = await services.user(id);
  if (!user || user.id !== id || !user.email || !user.confirmed)
    throw new MiniAppAuthError(
      "unverified",
      "Сначала войдите в Jup по почте и подтвердите адрес.",
    );
  const session = await services.issue({ id, email: user.email });
  try {
    if (
      session.userId !== id ||
      (await services.linkedUser(identity.id)) !== id
    )
      throw new MiniAppAuthError(
        "invalid",
        "Привязка Telegram изменилась. Войдите в свой аккаунт ещё раз.",
      );
    return {
      linked: true as const,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    };
  } catch (error) {
    await services.revoke(session).catch(() => {});
    throw error;
  }
}

const attempts = new Map<number, { start: number; count: number }>();
export function allowMiniAppAttempt(id: number, now = Date.now()) {
  for (const [key, state] of attempts)
    if (now - state.start > 60000) attempts.delete(key);
  const state = attempts.get(id) ?? { start: now, count: 0 };
  if (state.count >= 6 || (attempts.size >= 5000 && !attempts.has(id)))
    return false;
  state.count++;
  attempts.set(id, state);
  return true;
}

export async function issueMiniAppSession(
  user: { id: string; email: string },
  admin: Pick<SupabaseClient["auth"]["admin"], "generateLink">,
  auth: Pick<SupabaseClient["auth"], "verifyOtp">,
) {
  const link = await admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (
    link.error ||
    link.data.user?.id !== user.id ||
    !link.data.properties?.hashed_token
  )
    throw new Error("Session unavailable");
  const verified = await auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (verified.error || !verified.data.session || !verified.data.user)
    throw new Error("Session unavailable");
  return {
    userId: verified.data.user.id,
    access_token: verified.data.session.access_token,
    refresh_token: verified.data.session.refresh_token,
  };
}

export function sameMiniAppOrigin(req: Request) {
  try {
    const url = new URL(req.url);
    const scheme =
      req.headers
        .get("x-forwarded-proto")
        ?.split(",")[0]
        .trim()
        .toLowerCase() || url.protocol.slice(0, -1);
    if (!["http", "https"].includes(scheme)) return false;
    const expected = new URL(
      scheme + "://" + (req.headers.get("host") || url.host),
    );
    if (
      expected.username ||
      expected.password ||
      expected.pathname !== "/" ||
      expected.search ||
      expected.hash
    )
      return false;
    return req.headers.get("origin") === expected.origin;
  } catch {
    return false;
  }
}
