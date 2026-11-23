import type { Booking, Group } from "./findbuddy";

export function enrollment(
  lesson: Group,
  userId: string | null,
  bookings: Booking[],
  now: number,
) {
  if (lesson.tutor_id === userId) return "Вы ведёте занятие";
  if (
    bookings.some((b) => b.group_id === lesson.id && b.status !== "cancelled")
  )
    return "Вы записаны";
  if (
    lesson.enrollment_closed ||
    !Number.isFinite(Date.parse(lesson.starts_at)) ||
    Date.parse(lesson.starts_at) < now + 30 * 60000
  )
    return "Запись закрыта";
  if (lesson.reserved >= lesson.capacity) return "Мест нет";
  return null;
}

export type CalendarItem = Pick<
  Booking,
  "id" | "starts_at" | "subject" | "lesson_title"
> & { bookingId?: string; sequence?: number; cancelled?: boolean };
export function calendarFile(
  input: CalendarItem | CalendarItem[],
  origin?: string,
) {
  const stamp = (ms: number) =>
    new Date(ms)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replace(/\r\n|\n|\r/g, "\\n")
      .replace(/[,;]/g, (char) => "\\" + char);

  // Fold by UTF-8 octets so Cyrillic titles import correctly in calendar clients.
  const fold = (line: string) => {
    let out = "",
      used = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (used + size > 75) {
        out += "\r\n ";
        used = 1;
      }
      used += size;
      out += char;
    }
    return out;
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:findbuddy",
    "PRODID:-//findbuddy//Lessons//RU",
    ...(Array.isArray(input) ? input : [input]).flatMap((booking) => {
      const start = Date.parse(booking.starts_at);
      return [
        "BEGIN:VEVENT",
        "UID:" + booking.id + "@findbuddy",
        "DTSTAMP:" + stamp(Date.now()),
        "SEQUENCE:" + (booking.sequence ?? 0),
        "STATUS:" + (booking.cancelled ? "CANCELLED" : "CONFIRMED"),
        "DTSTART:" + stamp(start),
        "DTEND:" + stamp(start + 3600000),
        "SUMMARY:" + escape(booking.lesson_title || booking.subject),
        ...(origin
          ? [
              "URL:" +
                origin +
                "/findbuddy#" +
                (booking.bookingId
                  ? "account/lesson/" + booking.bookingId
                  : "teacher"),
            ]
          : []),
        ...(booking.cancelled
          ? []
          : [
              "BEGIN:VALARM",
              "TRIGGER:-PT15M",
              "ACTION:DISPLAY",
              "DESCRIPTION:Занятие в findbuddy через 15 минут",
              "END:VALARM",
            ]),
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
export function downloadCalendar(booking: Booking | CalendarItem[]) {
  const url = URL.createObjectURL(
    new Blob(
      [
        calendarFile(
          Array.isArray(booking)
            ? booking
            : { ...booking, bookingId: booking.id },
          window.location.origin,
        ),
      ],
      { type: "text/calendar;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = Array.isArray(booking)
    ? "findbuddy-week.ics"
    : "findbuddy-lesson.ics";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
