import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { telegramCommands, telegramCommandsText } from "../app/lib/telegramCommands.mjs";
import { miniAppDestination, telegramAppLink } from "../app/lib/telegramMiniApp.mjs";
import {
  handleTelegram,
  telegramLessonTime,
} from "../app/server/telegramBot.ts";

const token = "11111111-1111-4111-8111-111111111111";
const lesson = {
  id: token,
  title: "География ЕНТ",
  starts_at: "2027-01-09T11:15:00Z",
};
function fixture() {
  const chat = { id: 42, type: "private" },
    sent = [],
    actions = [],
    acknowledged = [];
  let linked = false,
    notices = true,
    reminders = true;
  const bot = {
    url: (path = "") => "https://example.test/findbuddy" + path,
    context: async (id, action) => {
      assert.equal(id, 42);
      actions.push(action);
      if (action === "notices_off") notices = false;
      if (action === "reminders_off") reminders = false;
      if (action === "unlink") linked = false;
      return {
        linked,
        notices,
        reminders,
        lessons: [lesson],
        threads: [{ id: token, name: "Аружан", unread: 2 }],
        lesson_chats: [lesson],
      };
    },
    link: async (_chat, key) => {
      if (linked || key !== token) return false;
      linked = true;
      return true;
    },
    reply: async (_chat, id, body, update) => {
      assert.deepEqual([id, body, update], [token, "Привет", 1]);
      return null;
    },
    send: async (_chat, text, buttons = []) =>
      sent.push({ text, buttons: buttons.flat() }),
    acknowledge: async (id) => acknowledged.push(id),
  };
  return {
    bot,
    chat,
    sent,
    actions,
    acknowledged,
    message: (text) =>
      handleTelegram({ update_id: 1, message: { chat, text } }, bot),
    button: (data) =>
      handleTelegram(
        {
          update_id: 2,
          callback_query: {
            id: "x",
            data,
            from: { id: 42 },
            message: { chat },
          },
        },
        bot,
      ),
  };
}
test("Telegram onboarding, lesson links, unread messages and settings", async () => {
  const f = fixture();
  await f.message("/start");
  assert.match(f.sent.at(-1).text, /Связать с Telegram/);
  await f.message("/start " + token);
  assert.match(f.sent.at(-1).text, /Аккаунт подключён/);
  await f.message("/start");
  assert.match(f.sent.at(-1).text, /Что откроем/);
  assert.equal(
    f.sent.at(-1).buttons.some((b) => b.callback_data === "/lessons"),
    true,
  );
  await f.button("/lessons");
  assert.match(f.sent.at(-1).text, /География ЕНТ/);
  assert.match(telegramLessonTime(lesson.starts_at), /16:15/);
  assert.ok(
    f.sent.at(-1).buttons.some((b) => b.url?.endsWith("/lesson/" + token)),
  );
  await f.message("/chats");
  assert.ok(
    f.sent
      .at(-1)
      .buttons.some(
        (b) => b.text.includes("2 новых") && b.url?.includes("#messages/"),
      ),
  );
  await f.button("notices_off");
  assert.match(f.sent.at(-1).text, /изменениях · выключены/);
  await f.button("reminders_off");
  assert.match(f.sent.at(-1).text, /перед уроками · выключены/);
  await f.message("/reply " + token + " Привет");
  assert.match(f.sent.at(-1).text, /сохранён/);
  await f.button("unlink_confirm");
  assert.match(f.sent.at(-1).text, /отключён/);
  assert.equal(f.acknowledged.length, 4);
});
test("Bot ignores group chat and callbacks from another account", async () => {
  const f = fixture();
  await handleTelegram(
    { message: { chat: { id: -9, type: "group" }, text: "/chats" } },
    f.bot,
  );
  await handleTelegram(
    {
      callback_query: {
        id: "unexpected",
        data: "unlink_confirm",
        from: { id: 88 },
        message: { chat: f.chat },
      },
    },
    f.bot,
  );
  assert.deepEqual(f.sent, []);
  assert.deepEqual(f.actions, []);
});

test("the Mini App command works before an account is linked", async () => {
  const f = fixture();
  await f.message("/app");
  assert.ok(
    f.sent.at(-1).buttons.some((button) => button.url?.endsWith("/telegram")),
  );
  assert.deepEqual(f.actions, []);
});

test("public shortcuts open the requested Mini App screen for each role without fetching private data", async () => {
  const f = fixture();
  const destinations = [
    ["/schedule", "schedule", "/student#account/calendar", "/teacher#schedule", "/business#schedule"],
    ["/requests", "requests", "/student#requests", "/teacher#requests", "/business"],
    ["/profile", "profile", "/student#profile", "/teacher#profile", "/business#page"],
    ["/catalog", "catalog", "/", "/", "/"],
  ];
  for (const [command, screen, ...paths] of destinations) {
    await f.message(command + "@jup_edu_app");
    const link = telegramAppLink(f.bot.url(), f.sent.at(-1).buttons[0].url);
    assert.equal(new URL(link).searchParams.get("screen"), screen);
    ["student", "teacher", "business"].forEach((role, i) => {
      assert.equal(miniAppDestination(role, screen), paths[i]);
    });
  }
  assert.deepEqual(f.actions, []);
});

test("every advertised command responds and public help lists the same command registry", async () => {
  const f = fixture();
  await f.message("/help");
  const help = f.sent.at(-1).text;
  await f.message("/menu");
  assert.deepEqual(f.actions, []);
  for (const { command, description } of telegramCommands) {
    assert.ok(help.includes(`/${command} — ${description}`));
    assert.match(command, /^[a-z0-9_]{1,32}$/);
    assert.ok(description.length >= 1 && description.length <= 256);
    const count = f.sent.length;
    await f.message("/" + command);
    assert.equal(f.sent.length, count + 1);
    assert.doesNotMatch(f.sent.at(-1).text, /Такой команды нет/);
  }
  assert.equal(new Set(telegramCommands.map((c) => c.command)).size, telegramCommands.length);
});

test("unlinked lesson and message commands preserve their destination without exposing private records", async () => {
  const f = fixture();
  for (const [command, suffix] of [["/lessons", "#account"], ["/chats", "#messages"]]) {
    await f.message(command);
    assert.match(f.sent.at(-1).text, /Связать с Telegram/);
    assert.doesNotMatch(f.sent.at(-1).text, /Аружан|География/);
    assert.equal(f.sent.at(-1).buttons[0].url, f.bot.url(suffix));
  }
});

test("message alias supports bot mentions and unlink still needs confirmation", async () => {
  const f = fixture();
  await f.message("/start " + token);
  await f.message("/messages@jup_edu_app");
  assert.equal(f.actions.at(-1), "inbox");
  await f.message("/unlink");
  assert.match(f.sent.at(-1).text, /Отключить Telegram/);
  assert.ok(f.sent.at(-1).buttons.some((b) => b.callback_data === "unlink_confirm"));
  assert.ok(!f.actions.includes("unlink"));
  await f.message("/unknown");
  assert.match(f.sent.at(-1).text, /Такой команды нет/);
});

test("BotFather list can be printed without credentials or network setup", () => {
  const output = execFileSync(process.execPath, ["scripts/setup-telegram.mjs", "--commands"], {
    cwd: new URL("..", import.meta.url),
    env: {},
    encoding: "utf8",
  });
  assert.equal(output.trim(), telegramCommandsText());
});
