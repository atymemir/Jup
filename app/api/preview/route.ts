import { videoConfigured } from "../../server/classroom";
import { hostedAccountsConfigured } from "../../server/accountStorage";
import {
  localOrigin,
  previewAllowed,
  previewAccount,
  previewData,
  switchRole,
} from "../../server/preview";
export async function GET(req: Request) {
  if (!previewAllowed(req))
    return Response.json(
      {
        preview: false,
        authAvailable: hostedAccountsConfigured(),
        videoAvailable: videoConfigured(),
        telegramAvailable: !!(
          process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN &&
          process.env.FINDBUDDY_TELEGRAM_BOT_USERNAME &&
          process.env.FINDBUDDY_TELEGRAM_WEBHOOK_SECRET &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    {
      ...(await previewData(req, "session")),
      authAvailable: true,
      videoAvailable: videoConfigured(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function POST(req: Request) {
  if (!previewAllowed(req) || !localOrigin(req))
    return new Response(null, { status: 403 });
  try {
    const raw = await req.text();
    if (raw.length > 4096) return new Response(null, { status: 413 });
    const body = JSON.parse(raw);
    if (body?.action === "signup" || body?.action === "login")
      return await previewAccount(req, body);
    const role = body?.role;
    if (role !== "logout")
      return Response.json({ error: "Войдите с почтой и паролем." }, { status: 403 });
    return await switchRole(req, role);
  } catch {
    return Response.json(
      { error: "Не удалось открыть аккаунт. Попробуйте ещё раз." },
      { status: 400 },
    );
  }
}
