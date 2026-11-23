import test from "node:test";
import assert from "node:assert/strict";
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
  assert.match(f.sent.at(-1).text, /Подключить Telegram/);
  await f.message("/start " + token);
  assert.match(f.sent.at(-1).text, /Аккаунт подключён/);
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
