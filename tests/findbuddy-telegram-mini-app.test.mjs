import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyTelegramInitData,
  issueMiniAppSession,
  signInLinkedTelegram,
  sameMiniAppOrigin,
  allowMiniAppAttempt,
} from "../app/server/telegramMiniApp.ts";
import {
  miniAppDestination,
  miniAppScreen,
  miniAppBackTarget,
  screenFromSuffix,
  telegramMiniAppUrl,
  telegramAppLink,
} from "../app/lib/telegramMiniApp.mjs";
const token = "12345:unit-test-only";
const now = Date.parse("2026-11-24T12:00:00Z");
function signed(values = {}) {
  const fields = {
    query_id: "test-query",
    user: JSON.stringify({ id: 42, first_name: "Аружан 🙂" }),
    auth_date: String(now / 1000),
    ...values,
  };
  const check = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([k, v]) => k + "=" + v)
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac("sha256", key).update(check).digest("hex"),
  }).toString();
}
test("Mini App accepts a fresh Telegram signature and rejects modified, duplicate and malformed credentials", () => {
  assert.deepEqual(verifyTelegramInitData(signed(), token, now), {
    id: 42,
    startParam: "",
  });
  assert.deepEqual(
    verifyTelegramInitData(
      signed({ start_param: "schedule", signature: "signed-additional-field" }),
      token,
      now,
    ),
    { id: 42, startParam: "schedule" },
  );
  const tampered = new URLSearchParams(signed());
  tampered.set("user", JSON.stringify({ id: 99 }));
  for (const raw of [
    tampered.toString(),
    signed() + "&user=%7B%22id%22%3A99%7D",
    signed() + "&hash=00",
    "hash=00",
    null,
    "x".repeat(17000),
    signed({ user: "not json" }),
    signed({ user: JSON.stringify({ id: -1 }) }),
    signed({ user: JSON.stringify({ id: 42, is_bot: true }) }),
  ])
    assert.throws(() => verifyTelegramInitData(raw, token, now));
  assert.throws(() => verifyTelegramInitData(signed(), "another-bot", now));
});
test("Mini App refuses old and future Telegram login data", () => {
  assert.throws(
    () =>
      verifyTelegramInitData(
        signed({ auth_date: String(now / 1000 - 301) }),
        token,
        now,
      ),
    (error) => error.code === "expired",
  );
  assert.throws(
    () =>
      verifyTelegramInitData(
        signed({ auth_date: String(now / 1000 + 31) }),
        token,
        now,
      ),
    (error) => error.code === "expired",
  );
});
function services() {
  const calls = [],
    s = {
      linkedUser: async () => "user-a",
      user: async (id) => ({
        id,
        email: "verified@example.test",
        confirmed: true,
      }),
      issue: async (user) => {
        calls.push(["issue", user.id]);
        return {
          userId: user.id,
          access_token: "test-access",
          refresh_token: "test-refresh",
        };
      },
      revoke: async () => {
        calls.push(["revoke"]);
      },
    };
  return { s, calls };
}
test("Telegram sign-in only issues a session for an explicitly linked, verified existing account", async () => {
  const { s, calls } = services();
  assert.deepEqual(await signInLinkedTelegram({ id: 42, startParam: "" }, s), {
    linked: true,
    session: { access_token: "test-access", refresh_token: "test-refresh" },
  });
  assert.deepEqual(calls, [["issue", "user-a"]]);
  s.linkedUser = async () => null;
  assert.deepEqual(await signInLinkedTelegram({ id: 42, startParam: "" }, s), {
    linked: false,
  });
  assert.equal(calls.length, 1);
  s.linkedUser = async () => "user-a";
  s.user = async (id) => ({
    id,
    email: "unverified@example.test",
    confirmed: false,
  });
  await assert.rejects(
    () => signInLinkedTelegram({ id: 42, startParam: "" }, s),
    (error) => error.code === "unverified",
  );
  assert.equal(calls.length, 1);
});
test("a changed Telegram link or mismatched provider identity revokes the new session", async () => {
  for (const mismatch of [false, true]) {
    const { s, calls } = services();
    let reads = 0;
    s.linkedUser = async () => (++reads === 1 ? "user-a" : "user-b");
    if (mismatch)
      s.issue = async () => ({
        userId: "user-b",
        access_token: "test-access",
        refresh_token: "test-refresh",
      });
    await assert.rejects(() =>
      signInLinkedTelegram({ id: 42, startParam: "" }, s),
    );
    assert.ok(calls.some(([action]) => action === "revoke"));
  }
});
test("Mini App login attempts are bounded and reset independently for another Telegram user", () => {
  for (let i = 0; i < 6; i++)
    assert.equal(allowMiniAppAttempt(9001, 1000 + i), true);
  assert.equal(allowMiniAppAttempt(9001, 1007), false);
  assert.equal(allowMiniAppAttempt(9002, 1007), true);
  assert.equal(allowMiniAppAttempt(9001, 62000), true);
});
const id = "11111111-1111-4111-8111-111111111111";
test("Mini App deep links stay within the viewer's role and preserve lesson and chat targets", () => {
  assert.equal(
    miniAppDestination("teacher", "lesson_" + id),
    "/teacher#account/lesson/" + id,
  );
  assert.equal(
    miniAppDestination("student", "chat_" + id),
    "/student#account/chat/" + id,
  );
  assert.equal(
    miniAppDestination("teacher", "work_" + id),
    "/teacher#account/work/" + id,
  );
  assert.equal(
    miniAppDestination("teacher", "thread_" + id),
    "/teacher#messages/thread/" + id,
  );
  assert.equal(miniAppDestination("business", "lesson_" + id), "/business");
  assert.equal(miniAppDestination("owner", "requests"), "/admin");
  assert.equal(
    miniAppDestination("student", "schedule"),
    "/student#account/calendar",
  );
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "javascript:alert(1)",
    "lesson_../../../admin",
    null,
  ]) {
    assert.equal(miniAppScreen(value), "home");
    assert.equal(miniAppDestination("student", value), "/student");
  }
  assert.equal(
    miniAppBackTarget("/teacher", "#account/chat/" + id),
    "/teacher#account/lesson/" + id,
  );
  for (const path of ["//evil.test", "https://evil.test", "/unknown"])
    assert.equal(
      miniAppBackTarget(path, "#messages/thread/" + id),
      "/telegram",
    );
  assert.equal(
    miniAppBackTarget("/teacher", "#messages/thread/" + id),
    "/teacher#messages",
  );
});
test("bot lesson URLs become HTTPS Mini App links without converting external destinations", () => {
  const base = "https://example.test/findbuddy";
  assert.equal(screenFromSuffix("#account/chat/" + id), "chat_" + id);
  assert.equal(
    telegramAppLink(base, base + "#account/chat/" + id),
    base + "/telegram?screen=chat_" + id,
  );
  assert.equal(
    telegramAppLink(base, "https://example.test/findbuddy-attacker"),
    null,
  );
  assert.equal(telegramAppLink(base, "https://other.test/findbuddy"), null);
  assert.equal(
    telegramMiniAppUrl(base, "//evil.test"),
    base + "/telegram?screen=home",
  );
  for (const base of [
    "http://example.test/findbuddy",
    "https://name:password@example.test/findbuddy",
    "https://example.test/findbuddy?secret=x",
  ])
    assert.throws(() => telegramMiniAppUrl(base, "home"));
});

test("Supabase exchange verifies the existing identity before redeeming a server-only token", async () => {
  const user = { id: "user-a", email: "verified@example.test" };
  let verifies = 0;
  const admin = {
    generateLink: async (input) => {
      assert.deepEqual(input, { type: "magiclink", email: user.email });
      return {
        error: null,
        data: {
          user: { id: user.id },
          properties: {
            hashed_token: "private-test-token",
            action_link: "https://do-not-return.example.test",
          },
        },
      };
    },
  };
  const auth = {
    verifyOtp: async (input) => {
      verifies++;
      assert.deepEqual(input, {
        type: "magiclink",
        token_hash: "private-test-token",
      });
      return {
        error: null,
        data: {
          user: { id: user.id },
          session: {
            access_token: "test-access",
            refresh_token: "test-refresh",
          },
        },
      };
    },
  };
  const result = await issueMiniAppSession(user, admin, auth);
  assert.deepEqual(result, {
    userId: user.id,
    access_token: "test-access",
    refresh_token: "test-refresh",
  });
  assert.ok(!JSON.stringify(result).includes("private-test-token"));
  await assert.rejects(() =>
    issueMiniAppSession(
      user,
      {
        generateLink: async () => ({
          error: null,
          data: {
            user: { id: "user-b" },
            properties: { hashed_token: "wrong-identity-token" },
          },
        }),
      },
      auth,
    ),
  );
  assert.equal(verifies, 1);
  await assert.rejects(
    () =>
      issueMiniAppSession(
        user,
        {
          generateLink: async () => ({
            error: { message: "private provider details" },
            data: null,
          }),
        },
        auth,
      ),
    (error) => !error.message.includes("private provider"),
  );
  await assert.rejects(() =>
    issueMiniAppSession(user, admin, {
      verifyOtp: async () => ({
        error: { message: "expired provider token" },
        data: { session: null, user: null },
      }),
    }),
  );
});

test("a failed final link lookup revokes the issued session and never returns it", async () => {
  const { s, calls } = services();
  let reads = 0;
  s.linkedUser = async () => {
    if (++reads === 1) return "user-a";
    throw new Error("Temporary database failure");
  };
  await assert.rejects(() =>
    signInLinkedTelegram({ id: 42, startParam: "" }, s),
  );
  assert.ok(calls.some(([action]) => action === "revoke"));
});

test("Mini App origin validation uses the public Host behind Next's internal origin", () => {
  const request = (headers) =>
    new Request("http://localhost:3000/findbuddy/api/telegram/session", {
      headers,
    });
  assert.equal(
    sameMiniAppOrigin(
      request({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }),
    ),
    true,
  );
  assert.equal(
    sameMiniAppOrigin(
      request({
        host: "findbuddy-kohl.vercel.app",
        origin: "https://findbuddy-kohl.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
  for (const headers of [
    {
      host: "example.test",
      origin: "https://other.test",
      "x-forwarded-proto": "https",
    },
    { host: "example.test", origin: "null" },
    {
      host: "example.test",
      origin: "http://example.test",
      "x-forwarded-proto": "https",
    },
    { host: "user:password@example.test", origin: "http://example.test" },
    { host: "example.test/path", origin: "http://example.test" },
  ])
    assert.equal(sameMiniAppOrigin(request(headers)), false);
});
