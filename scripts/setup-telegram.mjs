const token = process.env.FINDBUDDY_TELEGRAM_BOT_TOKEN;
const secret = process.env.FINDBUDDY_TELEGRAM_WEBHOOK_SECRET;
const base = (
  process.env.FINDBUDDY_PUBLIC_URL ||
  "https://findbuddy-kohl.vercel.app/findbuddy"
).replace(/\/$/, "");
const checkOnly = process.argv.includes("--check");
const missing = [
  ["FINDBUDDY_TELEGRAM_BOT_TOKEN", token],
  ["FINDBUDDY_TELEGRAM_WEBHOOK_SECRET", secret],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

async function deployedState() {
  try {
    const probe = await fetch(base + "/api/preview", {
      signal: AbortSignal.timeout(8000),
    });
    return probe.ok ? await probe.json() : null;
  } catch {
    return null;
  }
}

if (checkOnly) {
  console.log(
    missing.length
      ? "В .env.local или окружении отсутствуют: " + missing.join(", ")
      : "Локальные реквизиты для настройки найдены.",
  );
  if (missing.length) process.exit(1);
  const state = await deployedState();
  if (state?.preview === true)
    console.log(
      "На сайте включён деморежим. Подключите Supabase и перевыложите findbuddy.",
    );
  else if (state?.preview === false && state.telegramAvailable === true)
    console.log("Сайт готов к регистрации вебхука.");
  else if (state)
    console.log(
      "Проверьте параметры Telegram на хостинге и перевыложите findbuddy.",
    );
  else console.log("Не удалось проверить доступность сайта.");
  process.exitCode =
    missing.length ||
    state?.preview !== false ||
    state?.telegramAvailable !== true
      ? 1
      : 0;
} else {
  if (missing.length) {
    console.error("Откройте .env.local и заполните: " + missing.join(", "));
    process.exit(1);
  }
  if (!base.startsWith("https://") || !/^[-_a-zA-Z0-9]{1,256}$/.test(secret)) {
    console.error("Проверьте HTTPS-адрес сайта и формат секрета вебхука.");
    process.exit(1);
  }
}
async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await res.json();
  if (!res.ok || !result.ok)
    throw Error(method + " failed (HTTP " + res.status + ").");
  return result.result;
}
if (!checkOnly)
  try {
    const state = await deployedState();
    if (state?.preview === true)
      throw Error(
        "На сайте включён деморежим. Подключите Supabase и перевыложите findbuddy.",
      );
    if (state?.preview !== false || state?.telegramAvailable !== true)
      throw Error(
        "Проверьте доступность сайта и переменные Telegram на хостинге.",
      );
    const info = await call("getMe", {});
    const expected =
      process.env.FINDBUDDY_TELEGRAM_BOT_USERNAME || "jup_edu_app";
    if (
      expected &&
      info.username.toLowerCase() !== expected.replace(/^@/, "").toLowerCase()
    )
      throw Error("The bot username does not match the configured token.");
    const url = base + "/api/findbuddy/telegram";
    await call("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    });
    await call("setMyCommands", {
      commands: [
        { command: "app", description: "Открыть Jup" },
        { command: "menu", description: "Открыть меню" },
        { command: "lessons", description: "Ближайшие занятия" },
        { command: "chats", description: "Чаты и новые сообщения" },
        { command: "settings", description: "Настройки уведомлений" },
        { command: "help", description: "Помощь с ботом" },
      ],
    });
    await call("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Открыть Jup",
        web_app: { url: base + "/telegram" },
      },
    });
    const menu = await call("getChatMenuButton", {});
    if (menu.type !== "web_app" || menu.web_app?.url !== base + "/telegram")
      throw Error("Telegram returned a different Mini App menu.");
    const status = await call("getWebhookInfo", {});
    if (status.url !== url)
      throw Error("Telegram returned a different webhook URL.");
    console.log(
      `@${info.username} is ready at ${url}. Pending updates: ${status.pending_update_count}.`,
    );
  } catch (e) {
    console.error(
      "Setup failed. Check the bot token, public URL and connection.",
      e instanceof Error ? e.message : "",
    );
    process.exitCode = 1;
  }
