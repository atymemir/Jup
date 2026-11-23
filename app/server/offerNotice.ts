import {
  findbuddyUrl,
  sendTelegram,
  telegramService,
} from "./telegramTransport";

async function notifyUser(
  userId: string,
  text: string,
  action: string,
  path: string,
) {
  const db = telegramService();
  if (!db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN) return;
  const { data: target } = await db
    .from("fb_telegram")
    .select("chat_id")
    .eq("user_id", userId)
    .eq("notices_enabled", true)
    .maybeSingle();
  if (target?.chat_id)
    await sendTelegram(
      target.chat_id,
      text,
      [[{ text: action, url: findbuddyUrl(path) }]],
      3000,
    );
}
export async function notifyOffer(offerId: string, tutorId: string) {
  const db = telegramService();
  if (!db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN) return;
  const { data: offer } = await db
    .from("fb_offers")
    .select("request_id,price")
    .eq("id", offerId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (!offer) return;
  const { data: request } = await db
    .from("fb_requests")
    .select("student_id,subject")
    .eq("id", offer.request_id)
    .maybeSingle();
  if (request)
    await notifyUser(
      request.student_id,
      `Новое предложение · ${request.subject} · ${offer.price} ₸`,
      "Открыть заявки",
      "#requests",
    );
}

const events: Record<string, { text: string; label: string; page: string }> = {
  join: {
    text: "Ученик записался на занятие.",
    label: "Открыть занятие",
    page: "lesson",
  },
  accept: {
    text: "Ученик принял предложение о занятии.",
    label: "Открыть занятие",
    page: "lesson",
  },
  cancel: {
    text: "Запись на занятие отменена.",
    label: "Открыть занятия",
    page: "",
  },
  message: {
    text: "Новое сообщение в чате занятия.",
    label: "Открыть чат",
    page: "chat",
  },
  send_work: {
    text: "Ученик отправил домашнюю работу.",
    label: "Проверить работу",
    page: "work",
  },
  review_work: {
    text: "Преподаватель проверил домашнюю работу.",
    label: "Открыть комментарий",
    page: "work",
  },
  propose_move: {
    text: "Предложено новое время занятия.",
    label: "Проверить время",
    page: "lesson",
  },
  accept_move: {
    text: "Перенос занятия подтверждён.",
    label: "Открыть занятие",
    page: "lesson",
  },
  dismiss_move: {
    text: "Сохранено прежнее время занятия.",
    label: "Открыть занятие",
    page: "lesson",
  },
};
export async function notifyLesson(
  action: string,
  bookingId: string,
  sender: string,
) {
  const event = events[action],
    db = telegramService();
  if (!event || !bookingId || !db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN)
    return;
  const { data: b } = await db
    .from("fb_bookings")
    .select("student_id,tutor_id,status")
    .eq("id", bookingId)
    .maybeSingle();
  if (
    !b ||
    ![b.student_id, b.tutor_id].includes(sender) ||
    (action === "cancel") !== (b.status === "cancelled")
  )
    return;
  await notifyUser(
    sender === b.student_id ? b.tutor_id : b.student_id,
    event.text,
    event.label,
    "#account" + (event.page ? "/" + event.page + "/" + bookingId : ""),
  );
}
export async function notifyDirect(threadId: string, senderId: string) {
  const db = telegramService();
  if (!db || !process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN) return;
  const { data: chat } = await db.rpc("fb_direct_notice", {
    p_thread: threadId,
    p_sender: senderId,
  });
  if (chat)
    await sendTelegram(
      chat,
      "Новое личное сообщение в findbuddy.",
      [
        [
          {
            text: "Открыть диалог",
            url: findbuddyUrl("#messages/thread/" + threadId),
          },
        ],
      ],
      3000,
    );
}
