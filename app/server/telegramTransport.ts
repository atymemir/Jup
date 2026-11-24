import { telegramAppLink } from "../lib/telegramMiniApp.mjs";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type BotButton =
  | { text: string; url: string }
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };
export function findbuddyUrl(suffix = "") {
  const configured =
    process.env.FINDBUDDY_PUBLIC_URL ||
    "https://findbuddy-kohl.vercel.app/findbuddy";
  return configured.replace(/\/$/, "") + suffix;
}
export function validTelegramSecret(
  expected: string | undefined,
  supplied: string | null,
) {
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function telegramService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
type TelegramResult = {
  ok: boolean;
  error_code?: number;
  parameters?: { retry_after?: number };
};
export class TelegramSendError extends Error {
  constructor(readonly status?: number) {
    super("Telegram delivery failed");
  }
}
async function telegramCall(
  method: string,
  body: Record<string, unknown>,
  timeout = 4500,
) {
  const token = process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramSendError();
  // Only the transport needs the bot token. Remote error bodies may contain request details.
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    },
  );
  const data: TelegramResult = await response.json();
  if (!response.ok || !data.ok)
    throw new TelegramSendError(data.error_code ?? response.status);
}
export function sendTelegram(
  chat: number | string,
  text: string,
  buttons: BotButton[][] = [],
  timeout?: number,
) {
  return telegramCall(
    "sendMessage",
    {
      chat_id: chat,
      text,
      link_preview_options: { is_disabled: true },
      ...(buttons.length
        ? {
            reply_markup: {
              inline_keyboard: buttons.map((row) =>
                row.map((button) => {
                  if (!("url" in button)) return button;
                  const url = telegramAppLink(findbuddyUrl(), button.url);
                  return url ? { text: button.text, web_app: { url } } : button;
                }),
              ),
            },
          }
        : {}),
    },
    timeout,
  );
}
export function acknowledgeTelegram(id: string) {
  return telegramCall("answerCallbackQuery", { callback_query_id: id }, 2500);
}
