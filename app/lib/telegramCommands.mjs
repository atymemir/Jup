// Shared by the bot, its setup script and the copyable BotFather command list.
export const telegramCommands = [
  { command: "app", description: "Открыть Jup" },
  { command: "menu", description: "Главное меню" },
  { command: "lessons", description: "Ближайшие занятия" },
  { command: "schedule", description: "Расписание" },
  { command: "chats", description: "Сообщения и чаты занятий" },
  { command: "requests", description: "Заявки" },
  { command: "profile", description: "Моя анкета" },
  { command: "catalog", description: "Найти преподавателя" },
  { command: "settings", description: "Уведомления и напоминания" },
  { command: "help", description: "Помощь" },
];

export const telegramShortcuts = new Map([
  ["/app", {
    text: "Занятия, расписание и сообщения — в Jup.",
    button: "Открыть Jup",
    suffix: "/telegram",
  }],
  ["/schedule", {
    text: "Ваше расписание в Jup.",
    button: "Открыть расписание",
    suffix: "#account/calendar",
  }],
  ["/requests", {
    text: "Ваши заявки в Jup.",
    button: "Открыть заявки",
    suffix: "#requests",
  }],
  ["/profile", {
    text: "Ваша анкета в Jup.",
    button: "Открыть анкету",
    suffix: "#profile",
  }],
  ["/catalog", {
    text: "Выберите предмет и найдите своего преподавателя.",
    button: "Открыть каталог",
    suffix: "",
  }],
]);

export function telegramCommandsText() {
  return telegramCommands
    .map(({ command, description }) => `${command} - ${description}`)
    .join("\n");
}

export function telegramHelpText() {
  return (
    "Команды Jup\n\n" +
    telegramCommands
      .map(({ command, description }) => `/${command} — ${description}`)
      .join("\n") +
    "\n\nДля занятий и переписки войдите в приложение и нажмите «Связать с Telegram»."
  );
}
