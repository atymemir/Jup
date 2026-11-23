import { telegramLessonTime } from "../../../../server/telegramBot";
import {
  findbuddyUrl,
  sendTelegram,
  TelegramSendError,
  telegramService,
  validTelegramSecret,
} from "../../../../server/telegramTransport";

type Reminder = {
  claim: string;
  booking_id: string;
  chat_id: number;
  starts_at: string;
  title: string;
};
export const maxDuration = 30;
export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !validTelegramSecret(
      process.env.CRON_SECRET,
      req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    ) ||
    !req.headers.get("authorization")?.startsWith("Bearer ")
  )
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const db = telegramService();
  if (!db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN)
    return Response.json({ error: "Not configured" }, { status: 503, headers });
  const { data, error } = await db.rpc("fb_telegram_claim_reminders");
  if (error)
    return Response.json(
      { error: "Reminders unavailable" },
      { status: 503, headers },
    );
  const queue = data as Reminder[];
  let sent = 0,
    failed = 0;
  for (let i = 0; i < queue.length; i += 5) {
    await Promise.all(
      queue.slice(i, i + 5).map(async (item) => {
        let delivered = false;
        try {
          const minutes = Math.max(
            1,
            Math.ceil((Date.parse(item.starts_at) - Date.now()) / 60000),
          );
          await sendTelegram(
            item.chat_id,
            `Занятие через ${minutes} мин.\n${item.title}\n${telegramLessonTime(item.starts_at)}`,
            [
              [
                {
                  text: "Открыть занятие",
                  url: findbuddyUrl("#account/lesson/" + item.booking_id),
                },
              ],
            ],
            3300,
          );
          delivered = true;
          sent++;
        } catch (e) {
          failed++;
          delivered =
            e instanceof TelegramSendError &&
            [400, 403].includes(e.status ?? 0);
        }
        if (
          (
            await db.rpc("fb_telegram_finish_reminder", {
              p_claim: item.claim,
              p_delivered: delivered,
            })
          ).error
        )
          failed++;
      }),
    );
  }
  return Response.json({ claimed: queue.length, sent, failed }, { headers });
}
