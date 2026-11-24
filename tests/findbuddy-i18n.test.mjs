import test from "node:test";
import assert from "node:assert/strict";
import messages from "../app/i18n/messages.json" with { type: "json" };
import { translate, validLocale } from "../app/i18n/translate.ts";
import {
  makeTemplate,
  validDraftInput,
  validateTextDraft,
  lessonTimeSuggestions,
  topicsFor,
  SUBJECT_TOPICS,
} from "../app/lib/authoring.ts";
import { lessonDate, money } from "../app/lib/findbuddy.ts";

test("every interface message has Kazakh and English text with matching placeholders", () => {
  const placeholders = (text) =>
    [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
  assert.ok(Object.keys(messages).length > 1500);
  for (const [source, translations] of Object.entries(messages))
    for (const locale of ["kk", "en"]) {
      assert.ok(translations[locale].trim(), `${locale}: ${source}`);
      assert.deepEqual(
        placeholders(translations[locale]),
        placeholders(source),
        source,
      );
    }
});

test("translation handles variables, punctuation and whitespace without changing non-text values", () => {
  assert.equal(
    translate("2. Разбор темы: {0}.", "en", ["Algebra"]),
    "2. Explore the topic: Algebra.",
  );
  assert.equal(
    translate("Лимит — 1200 символов.", "en"),
    "Limit: 1200 characters.",
  );
  assert.equal(translate("  Математика  ", "en"), " Mathematics ");
  assert.equal(translate("Математика · SAT", "en"), "Mathematics · SAT");
  assert.equal(translate("My own description", "kk"), "My own description");
  assert.equal(
    translate("Русский · Родной, Английский · B2", "en"),
    "Russian · Native, English · B2",
  );
  assert.equal(translate(42, "en"), 42);
  assert.equal(translate(null, "kk"), null);
  assert.equal(translate("Тема: {0}.", "ru", ["Алгебра"]), "Тема: Алгебра.");
  for (const invalid of [null, "en-US", "<script>", undefined])
    assert.equal(validLocale(invalid), "ru");
  assert.equal(validLocale("kk"), "kk");
});

test("translated templates keep personal notes and canonical subjects unchanged", () => {
  for (const locale of ["ru", "kk", "en"])
    for (const subject of Object.keys(SUBJECT_TOPICS))
      for (const kind of ["lesson", "profile", "offering"]) {
        const input = {
          kind,
          subject,
          exam: "ЕНТ",
          topics: [...topicsFor(subject, "ЕНТ")],
          notes: "Мои личные заметки: 9 класс.",
          locale,
        };
        const original = structuredClone(input);
        const draft = makeTemplate(input, (text, params) =>
          translate(text, locale, params),
        );
        assert.ok(validDraftInput(input));
        assert.ok(validateTextDraft(draft));
        assert.ok(draft.body.includes(input.notes));
        assert.ok(draft.title.startsWith(translate(subject, locale)));
        assert.ok(draft.lessonPlan.includes("\n2."));
        assert.deepEqual(input, original);
      }
  assert.equal(
    validDraftInput({
      kind: "lesson",
      subject: "Математика",
      exam: "SAT",
      topics: [],
      notes: "",
      locale: "de",
    }),
    false,
  );
});

test("locale affects date labels while lesson times remain in Kazakhstan", () => {
  const now = Date.parse("2026-12-31T20:30:00Z");
  const ru = lessonTimeSuggestions(now),
    kk = lessonTimeSuggestions(now, "kk"),
    en = lessonTimeSuggestions(now, "en");
  assert.equal(kk[0].label, "Ертең, 17:00");
  assert.equal(en[0].label, "Tomorrow, 17:00");
  assert.deepEqual(
    ru.map((item) => item.value),
    en.map((item) => item.value),
  );
  assert.deepEqual(
    ru.map((item) => item.value),
    kk.map((item) => item.value),
  );
  const date = "2026-12-31T20:30:00Z";
  assert.match(lessonDate(date, "en"), /Jan|January/);
  assert.match(lessonDate(date, "en"), /01:30/);
});

test("Kazakh numbers and dates are stable without browser-specific Kazakh ICU data", () => {
  assert.equal(money(3000, "kk"), "3\u00a0000 ₸");
  assert.equal(lessonDate("2026-12-31T20:30:00Z", "kk"), "1 қаң., 01:30");
});
