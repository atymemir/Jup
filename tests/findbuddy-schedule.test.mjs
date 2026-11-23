import assert from "node:assert/strict";
import test from "node:test";
import { calendarFile, enrollment } from "../app/lib/schedule.ts";
const now = Date.parse("2027-01-01T00:00:00Z");
const lesson = {
  id: "lesson",
  tutor_id: "tutor",
  starts_at: "2027-01-01T12:00:00Z",
  capacity: 1,
  reserved: 0,
};
test("booking controls reflect one's own seat, enrollment closure and the booking cutoff", () => {
  assert.equal(enrollment(lesson, "student", [], now), null);
  assert.equal(enrollment(lesson, "tutor", [], now), "Вы ведёте занятие");
  assert.equal(
    enrollment(
      { ...lesson, reserved: 1 },
      "student",
      [{ group_id: "lesson", status: "awaiting_payment" }],
      now,
    ),
    "Вы записаны",
  );
  assert.equal(
    enrollment({ ...lesson, enrollment_closed: true }, "student", [], now),
    "Запись закрыта",
  );
  assert.equal(
    enrollment(lesson, "student", [], Date.parse(lesson.starts_at) - 60000),
    "Запись закрыта",
  );
  assert.equal(
    enrollment({ ...lesson, starts_at: "invalid" }, "student", [], now),
    "Запись закрыта",
  );
  assert.equal(
    enrollment(
      lesson,
      "student",
      [],
      Date.parse(lesson.starts_at) - 30 * 60000,
    ),
    null,
  );
});
test("calendar export preserves Kazakhstan appointment time and escapes user-supplied event titles", () => {
  const contents = calendarFile({
    id: "booking",
    subject: "География",
    lesson_title: "География, ЕНТ; карты\n" + "Казахстан ".repeat(15),
    starts_at: "2027-01-01T18:00:00+05:00",
  });
  assert.match(contents, /DTSTART:20270101T130000Z/);
  assert.match(contents, /DTEND:20270101T140000Z/);
  assert.ok(contents.includes("География\\, ЕНТ\\; карты\\n"));
  for (const line of contents.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});

test("calendar subscription serializes moves and cancellations without reminders for cancelled lessons", () => {
  const base = { id: "a", subject: "SAT", starts_at: "2027-06-01T12:00:00Z" };
  const feed = calendarFile([
    { ...base, sequence: 2, cancelled: true },
    { ...base, id: "b", sequence: 1 },
  ]);
  assert.equal(feed.split("BEGIN:VEVENT").length - 1, 2);
  assert.equal(feed.split("BEGIN:VALARM").length - 1, 1);
  assert.match(feed, /SEQUENCE:2\r\nSTATUS:CANCELLED/);
  assert.match(feed, /TRIGGER:-PT15M/);
});
