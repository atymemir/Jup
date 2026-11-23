import test from "node:test";
import assert from "node:assert/strict";
import {
  authLoginHref,
  authDestination,
  authEmailRedirect,
  parseAuthIntent,
  currentAuthIntent,
  consumeAuthIntent,
  saveSessionValue,
} from "../app/lib/authIntent.ts";
const id = "22222222-2222-4222-8222-222222222222";

test("auth continues booking and filters from an email opened in another tab without session storage", () => {
  const intent = "join/" + id;
  const login = new URL(
    authLoginHref(intent, "exam=SAT&budget=7000&language=Русский", false, true),
    "https://tryalga.app",
  );
  const email = new URL(
    authEmailRedirect(
      "https://tryalga.app",
      "confirm",
      "student",
      parseAuthIntent(login.searchParams.get("continue")),
      login.search,
    ),
  );
  assert.equal(email.pathname, "/findbuddy/login");
  assert.equal(email.searchParams.get("flow"), "confirm");
  const destination = new URL(
    authDestination(
      "student",
      parseAuthIntent(email.searchParams.get("continue")),
      email.search,
    ),
    email.origin,
  );
  assert.equal(destination.pathname, "/findbuddy");
  assert.equal(destination.searchParams.get("continue"), intent);
  assert.equal(destination.searchParams.get("exam"), "SAT");
  assert.equal(destination.searchParams.get("budget"), "7000");
  assert.equal(destination.searchParams.get("language"), "Русский");
  assert.equal(destination.searchParams.has("flow"), false);
});

test("only known in-app actions can be resumed, never external or script redirects", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "tab/teacher/../../admin",
    "tab/account/lesson/not-a-uuid",
    "join/",
    "request/" + "x".repeat(200),
    "tab/tutors/profile/" + id + "/extra",
  ]) {
    assert.equal(parseAuthIntent(value), null);
    assert.equal(authDestination("student", value), "/findbuddy#account");
  }
  for (const value of [
    "request/",
    "request/" + id,
    "tab/tutors",
    "tab/tutors/profile/" + id,
    "tab/account/chat/" + id,
    "tab/account/calendar",
    "tab/messages/new/" + id,
    "tab/teacher/wallet",
    "tab/teacher/slot/" + id,
  ])
    assert.equal(parseAuthIntent(value), value);
  assert.equal(
    parseAuthIntent("JOIN/ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF"),
    "join/abcdefab-abcd-abcd-abcd-abcdefabcdef",
  );
});

test("authentication links never forward tokens, passwords or arbitrary redirect parameters", () => {
  const search =
    "access_token=secret&refresh_token=secret2&password=secret3&redirect_to=https://evil.example&next=//evil.example&exam=SAT";
  for (const value of [
    authLoginHref("tab/account", search),
    authDestination("student", "tab/account", search),
    authEmailRedirect(
      "https://tryalga.app",
      "confirm",
      "teacher",
      "tab/account",
      search,
    ),
  ]) {
    const params = new URL(value, "https://tryalga.app").searchParams;
    for (const key of [
      "access_token",
      "refresh_token",
      "password",
      "redirect_to",
      "next",
    ])
      assert.equal(params.has(key), false);
    assert.equal(params.get("exam"), "SAT");
  }
});

test("auth works with blocked storage and consumes only the pending continuation", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const windowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  let replaced;
  try {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("Storage disabled");
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href:
            "https://tryalga.app/findbuddy?exam=SAT&continue=" +
            encodeURIComponent("join/" + id) +
            "#groups",
        },
        history: {
          state: { keep: true },
          replaceState(...args) {
            replaced = args;
          },
        },
      },
    });
    assert.doesNotThrow(() => saveSessionValue("fb-intent", "tab/account"));
    assert.equal(
      currentAuthIntent("?continue=" + encodeURIComponent("join/" + id)),
      "join/" + id,
    );
    assert.equal(currentAuthIntent(""), null);
    assert.doesNotThrow(consumeAuthIntent);
    assert.deepEqual(replaced[0], { keep: true });
    const url = new URL(replaced[2]);
    assert.equal(url.searchParams.has("continue"), false);
    assert.equal(url.searchParams.get("exam"), "SAT");
    assert.equal(url.hash, "#groups");
  } finally {
    if (storageDescriptor)
      Object.defineProperty(globalThis, "sessionStorage", storageDescriptor);
    else delete globalThis.sessionStorage;
    if (windowDescriptor)
      Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
  }
});

test("teacher signup resumes the selected teacher panel and default callbacks retain existing URL shape", () => {
  assert.equal(
    new URL(
      authDestination("teacher", "tab/teacher/schedule"),
      "https://tryalga.app",
    ).pathname,
    "/findbuddy/teacher",
  );
  assert.equal(authDestination("teacher", null), "/findbuddy/teacher");
  assert.equal(
    authEmailRedirect("https://tryalga.app", "confirm", "student", null),
    "https://tryalga.app/findbuddy/login?flow=confirm&role=student",
  );
  assert.equal(
    authEmailRedirect("https://tryalga.app", "recovery", "student", null),
    "https://tryalga.app/findbuddy/login?flow=recovery",
  );
});
