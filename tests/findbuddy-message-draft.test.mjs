import test from "node:test";
import assert from "node:assert/strict";
import { messageDraftKey, readMessageDraft, writeMessageDraft } from "../app/lib/messageDraft.ts";

test("message text and retry identity survive reload without leaking into another account or thread", (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage"), data = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) } });
  t.after(() => prior ? Object.defineProperty(globalThis, "sessionStorage", prior) : delete globalThis.sessionStorage);
  const key = messageDraftKey("one", "conversation"), draft = { body: "Мой вопрос\nк первому уроку", clientId: "11111111-1111-4111-8111-111111111111" };
  assert.equal(writeMessageDraft(key, draft), true);
  assert.deepEqual(readMessageDraft(key), draft);
  assert.equal(readMessageDraft(messageDraftKey("two", "conversation")), null);
  assert.equal(readMessageDraft(messageDraftKey("one", "other-conversation")), null);
  assert.notEqual(messageDraftKey("one", undefined, "tutor"), messageDraftKey("one", "tutor"));
  data.set(key, JSON.stringify({ ...draft, savedAt: Date.now() - 86400001 }));
  assert.equal(readMessageDraft(key), null);
  data.set(key, JSON.stringify({ ...draft, clientId: "broken", savedAt: Date.now() }));
  assert.equal(readMessageDraft(key), null);
  writeMessageDraft(key, draft);
  writeMessageDraft(key, { body: "", clientId: "" });
  assert.equal(readMessageDraft(key), null);
});

test("blocked draft storage does not throw or prevent sending", (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw Error("Blocked storage"); } });
  t.after(() => prior ? Object.defineProperty(globalThis, "sessionStorage", prior) : delete globalThis.sessionStorage);
  assert.equal(readMessageDraft("draft"), null);
  assert.equal(writeMessageDraft("draft", { body: "Вопрос", clientId: "11111111-1111-4111-8111-111111111111" }), false);
});
