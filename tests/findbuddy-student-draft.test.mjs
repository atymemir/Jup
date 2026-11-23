import test from "node:test";
import assert from "node:assert/strict";
import { studentDraftKey, readStudentDraft, writeStudentDraft, clearStudentDraft } from "../app/lib/studentDraft.ts";

test("an unfinished profile survives reload, is isolated by account and expires after a day", (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  } });
  t.after(() => prior ? Object.defineProperty(globalThis, "sessionStorage", prior) : delete globalThis.sessionStorage);
  const one = studentDraftKey({ user_id: "student-one" });
  const two = studentDraftKey({ user_id: "student-two" });
  const profile = { name: "Аружан", goal: "Подготовиться к экзамену", stage: "school", study_year: 11, exam: "SAT", languages: ["Русский"], format: "online", city: "", budget_max: 0 };
  assert.equal(writeStudentDraft(one, profile), true);
  assert.deepEqual(readStudentDraft(one), profile);
  assert.equal(readStudentDraft(two), null);
  assert.equal(studentDraftKey(null), null);
  data.set(one, JSON.stringify({ savedAt: Date.now() - 86400001, profile }));
  assert.equal(readStudentDraft(one), null);
  for (const raw of ["{broken", JSON.stringify({ profile }), JSON.stringify({ savedAt: Date.now(), profile: null })]) {
    data.set(one, raw);
    assert.equal(readStudentDraft(one), null);
  }
  writeStudentDraft(one, profile);
  clearStudentDraft(one);
  assert.equal(readStudentDraft(one), null);
});

test("blocked browser storage never prevents profile editing or saving", (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw Error("Storage blocked"); } });
  t.after(() => prior ? Object.defineProperty(globalThis, "sessionStorage", prior) : delete globalThis.sessionStorage);
  assert.equal(readStudentDraft("student-one"), null);
  assert.equal(writeStudentDraft("student-one", { name: "Аружан" }), false);
  assert.doesNotThrow(() => clearStudentDraft("student-one"));
});
