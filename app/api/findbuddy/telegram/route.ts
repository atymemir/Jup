import { handleTelegram } from "../../../server/telegramBot";
import {
  acknowledgeTelegram,
  findbuddyUrl,
  sendTelegram,
  TelegramSendError,
  telegramService,
  validTelegramSecret,
} from "../../../server/telegramTransport";

export async function POST(req: Request) {
  if (
    !validTelegramSecret(
      process.env.FINDBUDDY_TELEGRAM_WEBHOOK_SECRET,
      req.headers.get("x-telegram-bot-api-secret-token"),
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = telegramService();
  if (!db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN)
    return Response.json({ error: "Not configured" }, { status: 503 });

  let update;
  try {
    update = await req.json();
  } catch {
    return Response.json({ error: "Invalid update" }, { status: 400 });
  }
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0)
    return Response.json({ error: "Invalid update" }, { status: 400 });

  try {
    await handleTelegram(update, {
      url: findbuddyUrl,
      send: sendTelegram,
      acknowledge: acknowledgeTelegram,
      async link(chat, token) {
        const { data, error } = await db.rpc("fb_link_telegram", {
          p_token: token,
          p_chat_id: chat,
        });
        if (error?.code === "23505") return false;
        if (error) throw error;
        return data === true;
      },
      async context(chat, action) {
        const { data, error } = await db.rpc("fb_telegram_bot", {
          p_chat: chat,
          p_action: action,
        });
        if (error) throw error;
        return data;
      },
      async reply(chat, booking, body, updateId) {
        const { data, error } = await db.rpc("fb_bot_message", {
          p_chat_id: chat,
          p_booking_id: booking,
          p_body: body,
          p_update_id: updateId,
        });
        if (error?.code === "P0001") return error.message;
        if (error) throw error;
        if (data) {
          const { data: recipient } = await db
            .from("fb_telegram")
            .select("chat_id")
            .eq("chat_id", data)
            .eq("notices_enabled", true)
            .maybeSingle();
          if (recipient?.chat_id)
            await sendTelegram(
              recipient.chat_id,
              "Новое сообщение в чате занятия.",
              [
                [
                  {
                    text: "Открыть чат",
                    url: findbuddyUrl("#account/chat/" + booking),
                  },
                ],
              ],
            ).catch(() => {});
        }
        return null;
      },
    });
  } catch (e) {
    if (
      !(e instanceof TelegramSendError) ||
      ![400, 403].includes(e.status ?? 0)
    )
      return Response.json(
        { error: "Bot temporarily unavailable" },
        { status: 503 },
      );
  }
  return Response.json({ ok: true });
}
