// The command handler is transport-independent so it can run with a local test bot.
type Button =
  | { text: string; url: string }
  | { text: string; callback_data: string };
type Context = {
  linked: boolean;
  notices?: boolean;
  reminders?: boolean;
  lessons?: { id: string; title: string; starts_at: string }[];
  threads?: { id: string; name: string; unread: number }[];
  lesson_chats?: { id: string; title: string; starts_at: string }[];
};
export type BotServices = {
  url: (suffix?: string) => string;
  context: (chat: number, action: string) => Promise<Context>;
  link: (chat: number, token: string) => Promise<boolean>;
  reply: (
    chat: number,
    booking: string,
    body: string,
    update: number,
  ) => Promise<string | null>;
  send: (chat: number, text: string, buttons?: Button[][]) => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
};
type Chat = { id?: number; type?: string };
type Update = {
  update_id?: number;
  message?: { chat?: Chat; text?: string };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number };
    message?: { chat?: Chat };
  };
};
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const settings = new Set([
  "notices_on",
  "notices_off",
  "reminders_on",
  "reminders_off",
]);
const dayFormat = new Intl.DateTimeFormat("ru-KZ", {
  timeZone: "Asia/Almaty",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export const telegramLessonTime = (iso: string) =>
  dayFormat.format(new Date(iso)) + " · UTC+5";

export async function handleTelegram(update: Update, bot: BotServices) {
  const callback = update.callback_query;
  const chat = (callback?.message ?? update.message)?.chat;
  const id = chat?.id;
  if (
    chat?.type !== "private" ||
    typeof id !== "number" ||
    !Number.isSafeInteger(id)
  )
    return;
  if (callback && (callback.from?.id !== id || typeof callback.id !== "string"))
    return;
  if (callback?.id) await bot.acknowledge(callback.id).catch(() => {});

  const [input = "", ...args] =
    typeof update.message?.text === "string"
      ? update.message.text.trim().split(/\s+/)
      : [];
  const command = callback?.data ?? input.split("@")[0];
  const chatId = id;
  const linkTo = (text: string, suffix = ""): Button => ({
    text,
    url: bot.url(suffix),
  });
  const commandButton = (text: string, key: string): Button => ({
    text,
    callback_data: key,
  });
  const menu: Button[][] = [
    [linkTo("Открыть Jup", "/telegram")],
    [
      commandButton("Мои занятия", "/lessons"),
      commandButton("Сообщения", "/chats"),
    ],
    [linkTo("Заявки", "#requests"), commandButton("Уведомления", "/settings")],
    [linkTo("Каталог")],
  ];
  async function welcome(message?: string) {
    await bot.send(
      chatId,
      message ??
        "Откройте Jup edu, войдите в аккаунт и нажмите «Подключить Telegram» в «Моих занятиях». Затем вернитесь сюда по личной ссылке и нажмите Start.",
      [
        [linkTo("Открыть Jup", "/telegram")],
        [linkTo("Открыть мои занятия", "#account")],
        [linkTo("Найти преподавателя")],
      ],
    );
  }
  if (command === "/app") {
    await bot.send(id, "Jup в Telegram · занятия, расписание и сообщения.", [
      [linkTo("Открыть Jup", "/telegram")],
    ]);
    return;
  }
  if (command === "/start" && args.length) {
    if (
      args.length === 1 &&
      uuid.test(args[0]) &&
      (await bot.link(id, args[0]))
    ) {
      await bot.send(
        id,
        "Аккаунт подключён. Здесь можно посмотреть занятия, открыть сообщения и настроить напоминания.",
        menu,
      );
    } else if ((await bot.context(id, "status")).linked) {
      await bot.send(id, "Этот Telegram уже связан с аккаунтом Jup edu.", menu);
    } else
      await welcome(
        "Ссылка привязки истекла, уже использована или недоступна. Откройте «Мои занятия» и получите новую ссылку.",
      );
    return;
  }
  const action =
    command === "/lessons"
      ? "lessons"
      : command === "/chats"
        ? "inbox"
        : command === "unlink_confirm"
          ? "unlink"
          : settings.has(command)
            ? command
            : "status";
  const ctx = await bot.context(id, action);
  if (command === "unlink_confirm" && !ctx.linked) {
    await welcome(
      "Telegram отключён от Jup edu. Чтобы подключить снова, откройте «Мои занятия».",
    );
    return;
  }
  if (!ctx.linked) {
    await welcome();
    return;
  }
  if (command === "/lessons") {
    const lessons = ctx.lessons ?? [];
    await bot.send(
      id,
      lessons.length
        ? "Ближайшие занятия\n\n" +
            lessons
              .map(
                (l, i) =>
                  `${i + 1}. ${l.title}\n${telegramLessonTime(l.starts_at)}`,
              )
              .join("\n\n")
        : "Ближайших занятий пока нет.",
      [
        ...lessons.map((l, i) => [
          linkTo("Открыть занятие " + (i + 1), "#account/lesson/" + l.id),
        ]),
        [
          linkTo("Календарь в Jup edu", "#account/calendar"),
          commandButton("Меню", "/menu"),
        ],
      ],
    );
  } else if (command === "/chats") {
    const threads = ctx.threads ?? [],
      lessons = ctx.lesson_chats ?? [];
    const buttons = [
      ...threads.map((t) => [
        linkTo(
          t.name.slice(0, 50) + (t.unread ? ` · ${t.unread} новых` : ""),
          "#messages/thread/" + t.id,
        ),
      ]),
      ...lessons.map((l) => [
        linkTo("Урок · " + l.title.slice(0, 48), "#account/chat/" + l.id),
      ]),
    ];
    await bot.send(
      id,
      buttons.length
        ? "Выберите диалог. Переписка откроется в Jup edu."
        : "Диалогов пока нет. Можно написать преподавателю из его анкеты.",
      [
        ...buttons,
        [linkTo("Все сообщения", "#messages"), commandButton("Меню", "/menu")],
      ],
    );
  } else if (command === "/settings" || settings.has(command)) {
    await bot.send(
      id,
      `Уведомления о сообщениях, заявках и изменениях · ${ctx.notices ? "включены" : "выключены"}\nНапоминания перед уроками · ${ctx.reminders ? "включены" : "выключены"}`,
      [
        [
          commandButton(
            ctx.notices ? "Выключить уведомления" : "Включить уведомления",
            ctx.notices ? "notices_off" : "notices_on",
          ),
        ],
        [
          commandButton(
            ctx.reminders ? "Выключить напоминания" : "Включить напоминания",
            ctx.reminders ? "reminders_off" : "reminders_on",
          ),
        ],
        [
          commandButton("Отключить Telegram", "/unlink"),
          commandButton("Меню", "/menu"),
        ],
      ],
    );
  } else if (command === "/unlink") {
    await bot.send(id, "Отключить Telegram от аккаунта Jup edu?", [
      [
        commandButton("Да, отключить", "unlink_confirm"),
        commandButton("Отмена", "/settings"),
      ],
    ]);
  } else if (command === "/reply") {
    const booking = args[0];
    const body =
      update.message?.text
        ?.trim()
        .match(/^\/reply(?:@\w+)?\s+[\da-f-]+\s+([\s\S]+)$/i)?.[1]
        .trim() ?? "";
    const error =
      booking &&
      uuid.test(booking) &&
      body.length >= 1 &&
      body.length <= 2000 &&
      typeof update.update_id === "number"
        ? await bot.reply(id, booking, body, update.update_id)
        : "Укажите ID занятия и текст до 2000 символов.";
    await bot.send(id, error ?? "Ответ сохранён в чате занятия.", [
      [
        linkTo(
          error ? "Открыть сообщения" : "Открыть чат занятия",
          error ? "#messages" : "#account/chat/" + booking,
        ),
      ],
    ]);
  } else {
    await bot.send(
      id,
      command === "/help"
        ? "Используйте кнопки или команды /lessons, /chats и /settings."
        : "Jup edu · выберите действие",
      menu,
    );
  }
}
