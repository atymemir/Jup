import { createClient } from "@supabase/supabase-js";
import { getUserFromAccessToken } from "../../../lib/serverTokenAuth";
import { telegramService } from "../../../server/telegramTransport";
import {
  allowMiniAppAttempt,
  issueMiniAppSession,
  MiniAppAuthError,
  signInLinkedTelegram,
  sameMiniAppOrigin,
  verifyTelegramInitData,
} from "../../../server/telegramMiniApp";
const headers = { "Cache-Control": "private, no-store" };
const configured = () =>
  !!(
    process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
export function GET() {
  return json({
    available: configured(),
    botUsername:
      process.env.FINDBUDDY_TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ||
      "jup_edu_app",
  });
}
export async function POST(req: Request) {
  if (!sameMiniAppOrigin(req))
    return json({ error: "Откройте помощника из приложения." }, 403);
  if (!configured())
    return json(
      { error: "Вход через Telegram пока не подключён. Войдите по почте." },
      503,
    );
  let raw;
  try {
    raw = await req.text();
    if (raw.length > 20000)
      return json({ error: "Слишком большой запрос." }, 413);
    raw = JSON.parse(raw);
  } catch {
    return json({ error: "Некорректный запрос." }, 400);
  }
  if (!raw || !["login", "link", "status"].includes(raw.action))
    return json({ error: "Неизвестное действие." }, 400);
  try {
    const identity = verifyTelegramInitData(
      raw.initData,
      process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN!,
    );
    const db = telegramService()!;
    const linkedUser = async (id: number) => {
      const r = await db
        .from("fb_telegram")
        .select("user_id")
        .eq("chat_id", id)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data?.user_id ?? null;
    };
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    if (raw.action !== "login") {
      const viewer = await getUserFromAccessToken(
        req.headers.get("authorization"),
      );
      if (!viewer.user || !viewer.token)
        return json({ error: "Войдите в аккаунт, чтобы продолжить." }, 401);
      const authed = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${viewer.token}` } },
        },
      );
      const account = await authed.rpc("fb_viewer");
      if (account.error || !account.data?.account)
        return json({ error: "Войдите в аккаунт Jup." }, 403);
      const linked = await linkedUser(identity.id);
      if (raw.action === "status")
        return json({ linked: linked === viewer.user.id });
      if (linked === viewer.user.id) return json({ linked: true });
      if (linked)
        return json(
          { error: "Этот Telegram уже связан с другим аккаунтом Jup." },
          409,
        );
      if (!allowMiniAppAttempt(identity.id))
        return json(
          {
            error: "Слишком много запросов. Попробуйте через несколько минут.",
          },
          429,
        );
      const token = await authed.rpc("fb_action", {
        p_action: "telegram_link",
        p_data: {},
      });
      if (token.error || typeof token.data?.token !== "string")
        throw new Error("Link failed");
      const result = await db.rpc("fb_link_telegram", {
        p_token: token.data.token,
        p_chat_id: identity.id,
      });
      if (result.error?.code === "23505")
        return json(
          { error: "Этот Telegram уже связан с другим аккаунтом Jup." },
          409,
        );
      if (result.error || result.data !== true) throw new Error("Link failed");
      return json({ linked: true });
    }
    if (!allowMiniAppAttempt(identity.id))
      return json(
        { error: "Слишком много запросов. Попробуйте через несколько минут." },
        429,
      );
    const result = await signInLinkedTelegram(identity, {
      linkedUser,
      async user(id) {
        const r = await db.auth.admin.getUserById(id);
        if (r.error) throw r.error;
        const u = r.data.user;
        return u
          ? {
              id: u.id,
              email: u.email ?? null,
              confirmed: !!u.email_confirmed_at,
            }
          : null;
      },
      issue(user) {
        return issueMiniAppSession(user, db.auth.admin, client.auth);
      },
      async revoke() {
        await client.auth.signOut({ scope: "local" });
      },
    });
    return json(result);
  } catch (error) {
    if (error instanceof MiniAppAuthError)
      return json(
        { error: error.message, code: error.code },
        error.code === "unverified" ? 403 : 401,
      );
    return json(
      {
        error:
          "Не удалось войти через Telegram. Попробуйте ещё раз или войдите по почте.",
      },
      503,
    );
  }
}
