import { createClient } from "@supabase/supabase-js";
import { validDraftInput, validateTextDraft } from "../../lib/authoring";
import { getUserFromAccessToken } from "../../lib/serverTokenAuth";
import { previewAllowed, previewData } from "../../server/preview";
import { generateAIDraft, reserveDraft } from "../../server/aiDraft";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
export function GET() {
  return json({ available: !!process.env.JUP_AI_API_KEY });
}
export async function POST(req: Request) {
  let release: (() => void) | undefined;
  try {
    const origin = req.headers.get("origin");
    if (
      !origin ||
      ![
        new URL(req.url).host,
        req.headers.get("host"),
        req.headers.get("x-forwarded-host"),
      ].includes(new URL(origin).host)
    )
      return json({ error: "Откройте помощника из приложения." }, 403);
    const raw = await req.text();
    if (raw.length > 8000) return json({ error: "Сократите заметки." }, 413);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: "Проверьте данные для черновика." }, 400);
    }
    if (!validDraftInput(input))
      return json(
        {
          error:
            "Выберите предмет, экзамен и темы из списка. Заметки — до 1200 символов.",
        },
        400,
      );
    let account: { id: string; role: string } | null = null;
    if (previewAllowed(req))
      account = (
        (await previewData(req, "viewer")) as {
          account: { id: string; role: string } | null;
        }
      ).account;
    else if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      const session = await getUserFromAccessToken(
        req.headers.get("authorization"),
      );
      if (session.user && session.token) {
        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${session.token}` } },
          },
        );
        const viewer = await client.rpc("fb_viewer");
        if (!viewer.error) account = viewer.data?.account ?? null;
      }
    }
    if (!account)
      return json(
        { error: "Войдите в аккаунт преподавателя или центра." },
        401,
      );
    if (
      !["teacher", "business"].includes(account.role) ||
      (input.kind === "profile" && account.role !== "teacher")
    )
      return json(
        { error: "Помощник доступен преподавателям и учебным центрам." },
        403,
      );
    const key = process.env.JUP_AI_API_KEY;
    if (!key)
      return json(
        {
          error:
            "ИИ пока не подключён. Быстрое заполнение по темам уже доступно.",
        },
        503,
      );
    release = reserveDraft(account.id) ?? undefined;
    if (!release)
      return json(
        { error: "Слишком много запросов. Попробуйте через несколько минут." },
        429,
      );
    const draft = await generateAIDraft(
      input,
      key,
      process.env.JUP_AI_MODEL || "gpt-4.1-mini",
    );
    if (!validateTextDraft(draft))
      return json(
        {
          error:
            "Черновик не подошёл по длине. Сократите заметки и попробуйте снова.",
        },
        502,
      );
    return json({ draft });
  } catch {
    return json(
      {
        error:
          "Не удалось подготовить черновик. Используйте шаблон или попробуйте позже.",
      },
      502,
    );
  } finally {
    release?.();
  }
}
