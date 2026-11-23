import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_CATALOG,
  filterTutors,
  kazakhstanDate,
  splitLessonPrice,
} from "../app/lib/findbuddy.ts";

test("findbuddy combines subject, exam, language, city and budget filters", () => {
  const defaults = {
    query: "",
    subject: "",
    exam: "",
    language: "",
    city: "",
    maxPrice: 100000,
  };
  assert.equal(
    filterTutors(DEMO_CATALOG.tutors, {
      ...defaults,
      subject: "География",
      exam: "ЕНТ",
      language: "Қазақша",
      city: "Онлайн",
      maxPrice: 3500,
    }).length,
    1,
  );
  assert.equal(
    filterTutors(DEMO_CATALOG.tutors, {
      ...defaults,
      subject: "География",
      maxPrice: 3000,
    }).length,
    0,
  );
  assert.equal(
    filterTutors(DEMO_CATALOG.tutors, { ...defaults, query: "  АЛИНА  " })[0]
      .id,
    "demo-ielts",
  );
});
test("findbuddy prices conserve the full payment and round half a tenge consistently with Postgres", () => {
  assert.deepEqual(splitLessonPrice(5010), {
    price: 5010,
    commission: 251,
    tutorNet: 4759,
  });
  assert.deepEqual(splitLessonPrice(5000), {
    price: 5000,
    commission: 250,
    tutorNet: 4750,
  });
  for (const price of [NaN, 499, 100001, 550.5])
    assert.throws(() => splitLessonPrice(price));
});
test("findbuddy interprets scheduling in Kazakhstan even on a device in another timezone", () => {
  assert.equal(kazakhstanDate("2099-06-01T18:30"), "2099-06-01T13:30:00.000Z");
  assert.throws(() => kazakhstanDate("2020-01-01T10:00"));
  assert.throws(() => kazakhstanDate("not-a-date"));
  assert.throws(() => kazakhstanDate("2099-02-31T10:00"));
});
