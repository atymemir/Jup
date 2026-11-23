import { classroomActions, videoTicket } from "../../server/classroom";
import {
  notifyOffer,
  notifyLesson,
  notifyDirect,
} from "../../server/offerNotice";
import { localOrigin, previewAllowed, previewData } from "../../server/preview";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserFromAccessToken } from "@/app/lib/serverTokenAuth";
import { mutationBodyLimit } from "../../lib/mutationLimits";

const headers = { "Cache-Control": "private, no-store" };
function client(token?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(token
        ? { global: { headers: { Authorization: `Bearer ${token}` } } }
        : {}),
    },
  );
}
const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
function failure(error: { code?: string; message: string }) {
  if (["PGRST202", "42P01", "42883"].includes(error.code ?? ""))
    return NextResponse.json(
      {
        error: "Каталог готовится к открытию. Попробуйте позже.",
        setup_required: true,
      },
      { status: 503, headers },
    );
  if (["23505"].includes(error.code ?? ""))
    return NextResponse.json(
      { error: "Такая запись или предложение уже существует." },
      { status: 409, headers },
    );
  if (
    ["23514", "23502", "22P02", "22007", "22008", "22003"].includes(
      error.code ?? "",
    )
  )
    return NextResponse.json(
      { error: "Проверьте обязательные поля, цену и дату." },
      { status: 400, headers },
    );
  if (error.code === "P0001" || error.code === "42501")
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "42501" ? 403 : 400, headers },
    );
  return NextResponse.json(
    { error: "Сервис временно недоступен. Попробуйте ещё раз." },
    { status: 503, headers },
  );
}
async function previewResponse(req: Request) {
  try {
    const view = new URL(req.url).searchParams.get("view") || "";
    if (req.method === "GET")
      return NextResponse.json(await previewData(req, view), { headers });
    if (!localOrigin(req)) return new Response(null, { status: 403 });
    const raw = await req.text();
    if (raw.length > 225000) return new Response(null, { status: 413 });
    const { action, data } = JSON.parse(raw);
    if (raw.length > mutationBodyLimit(action, data))
      return new Response(null, { status: 413 });
    if (typeof action !== "string" || !data || typeof data !== "object")
      return new Response(null, { status: 400 });
    return NextResponse.json(
      action === "video_access"
        ? await videoTicket(
            (await previewData(req, "", action, data)) as {
              identity: string;
              room: string;
              name: string;
            },
          )
        : await previewData(req, "", action, data),
      {
        headers,
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка запроса." },
      { status: 400, headers },
    );
  }
}

export async function GET(req: Request) {
  if (previewAllowed(req)) return previewResponse(req);
  if (!configured())
    return NextResponse.json(
      { error: "Supabase ещё не подключён.", setup_required: true },
      { status: 503, headers },
    );
  try {
    const view = new URL(req.url).searchParams.get("view") || "";
    if (
      ["dashboard", "platform", "viewer"].includes(view) ||
      view.startsWith("student/")
    ) {
      const { user, token } = await getUserFromAccessToken(
        req.headers.get("authorization"),
      );
      if ((!user || !token) && view === "viewer")
        return NextResponse.json({ account: null }, { headers });
      if (!user || !token)
        return NextResponse.json(
          { error: "Войдите в аккаунт." },
          { status: 401, headers },
        );
      const { data, error } = await client(token).rpc(
        view === "viewer"
          ? "fb_viewer"
          : view === "platform"
            ? "fb_platform_dashboard"
            : view.startsWith("student/")
              ? "fb_student_context"
              : "fb_pilot_dashboard",
        view.startsWith("student/") ? { p_user: view.slice(8) } : {},
      );
      if (error) return failure(error);
      return NextResponse.json(data, { headers });
    }
    const { data, error } = view.startsWith("reviews/")
      ? await client().rpc("fb_public_reviews", { p_tutor: view.slice(8) })
      : await client().rpc("fb_market_catalog");
    if (error) return failure(error);
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "Не удалось связаться с сервером." },
      { status: 503, headers },
    );
  }
}
export async function POST(req: Request) {
  if (previewAllowed(req)) return previewResponse(req);
  if (!configured())
    return NextResponse.json(
      { error: "Supabase ещё не подключён." },
      { status: 503, headers },
    );
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 225000)
      return NextResponse.json(
        { error: "Слишком большой запрос." },
        { status: 413, headers },
      );
    const { user, token } = await getUserFromAccessToken(
      req.headers.get("authorization"),
    );
    if (!user || !token)
      return NextResponse.json(
        { error: "Войдите в аккаунт." },
        { status: 401, headers },
      );
    const raw = await req.text();
    if (raw.length > 225000)
      return NextResponse.json(
        { error: "Слишком большой запрос." },
        { status: 413, headers },
      );
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Некорректный запрос." },
        { status: 400, headers },
      );
    }
    const actions = [
      ...classroomActions,
      "platform",
      "save_profile",
      "inbox",
      "review",
      "initial_name",
      "lesson_outcome",
      "apply",
      "request",
      "offer",
      "accept",
      "join",
      "group",
      "close_request",
      "close_enrollment",
      "edit_terms",
      "cancel",
      "message",
      "telegram_link",
      "telegram_unlink",
    ];
    if (
      !body ||
      !actions.includes(body.action) ||
      !body.data ||
      typeof body.data !== "object" ||
      Array.isArray(body.data)
    )
      return NextResponse.json(
        { error: "Неизвестное действие." },
        { status: 400, headers },
      );
    if (raw.length > mutationBodyLimit(body.action, body.data))
      return new Response(null, { status: 413 });
    if (body.action === "platform") {
      const { data, error } = await client(token).rpc("fb_platform_action", {
        p_action: body.data.action,
        p_data: body.data,
      });
      return error ? failure(error) : NextResponse.json(data, { headers });
    }
    if (body.action === "lesson_outcome") {
      const { data, error } = await client(token).rpc("fb_lesson_outcome", {
        p_data: body.data,
      });
      return error ? failure(error) : NextResponse.json(data, { headers });
    }
    if (body.action === "review") {
      const { data, error } = await client(token).rpc("fb_review", {
        p_action: body.data.action,
        p_data: body.data,
      });
      return error ? failure(error) : NextResponse.json(data, { headers });
    }
    if (body.action === "inbox") {
      const { data, error } = await client(token).rpc("fb_inbox", {
        p_action: body.data.action,
        p_input: body.data,
      });
      if (error) return failure(error);
      if (body.data.action === "send" && data.new_message)
        await notifyDirect(data.id, user.id).catch(() => {});
      return NextResponse.json(data, { headers });
    }
    if (body.action === "initial_name") {
      const { error } = await client(token).rpc("fb_initial_name", {
        p_name: body.data.name,
      });
      return error
        ? failure(error)
        : NextResponse.json({ ok: true }, { headers });
    }
    if (body.action === "save_profile") {
      const { data, error } = await client(token).rpc("fb_save_profile", {
        p_data: body.data,
      });
      return error ? failure(error) : NextResponse.json(data, { headers });
    }
    const botName = process.env.FINDBUDDY_TELEGRAM_BOT_USERNAME;
    if (
      body.action === "telegram_link" &&
      (!botName ||
        !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN ||
        !process.env.FINDBUDDY_TELEGRAM_WEBHOOK_SECRET ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY)
    )
      return NextResponse.json(
        {
          error:
            "Telegram-бот пока не подключён. Чат внутри приложения уже доступен.",
        },
        { status: 503, headers },
      );
    if (classroomActions.includes(body.action)) {
      const { data, error } = await client(token).rpc("fb_lesson_action", {
        p_action: body.action,
        p_data: body.data,
      });
      if (error) return failure(error);
      await notifyLesson(body.action, body.data.id, user.id).catch(() => {});
      return NextResponse.json(
        body.action === "video_access" ? await videoTicket(data) : data,
        { headers },
      );
    }
    if (body.action === "edit_terms") {
      const { error } = await client(token).rpc("fb_update_terms", {
        p_data: body.data,
      });
      return error
        ? failure(error)
        : NextResponse.json({ ok: true }, { headers });
    }
    if (body.action === "close_enrollment") {
      const { error } = await client(token).rpc("fb_close_enrollment", {
        p_id: body.data.id,
      });
      return error
        ? failure(error)
        : NextResponse.json({ ok: true }, { headers });
    }
    const { data, error } = await client(token).rpc("fb_action", {
      p_action: body.action,
      p_data: body.data,
    });
    if (error) return failure(error);
    if (["join", "accept", "cancel"].includes(body.action) && data?.id)
      await notifyLesson(body.action, data.id, user.id).catch(() => {});
    if (body.action === "message" && data?.id)
      await notifyLesson("message", body.data.booking_id, user.id).catch(
        () => {},
      );
    if (body.action === "offer" && data?.id)
      await notifyOffer(data.id, user.id).catch(() => {});
    return NextResponse.json(
      body.action === "telegram_link"
        ? { url: `https://t.me/${botName}?start=${data.token}` }
        : data,
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Не удалось выполнить действие. Обновите кабинет перед повторной отправкой.",
      },
      { status: 503, headers },
    );
  }
}
