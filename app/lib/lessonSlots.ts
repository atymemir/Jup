import { dateFormatter } from "./localeFormat.mjs";
import type { Group } from "./findbuddy";

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Almaty",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = (locale: "ru" | "kk" | "en") =>
  dateFormatter(locale, {
    timeZone: "Asia/Almaty",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const clock = (locale: "ru" | "kk" | "en") =>
  dateFormatter(locale, {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  });

export function lessonClock(value: string, locale: "ru" | "kk" | "en" = "ru") {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? clock(locale).format(date)
    : "Время уточняется";
}

export function lessonSlotDays(
  slots: Group[],
  locale: "ru" | "kk" | "en" = "ru",
) {
  const days = new Map<
    string,
    { key: string; label: string; slots: Group[] }
  >();
  for (const slot of [...slots]
    .filter((s) => Number.isFinite(Date.parse(s.starts_at)))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    const date = new Date(slot.starts_at),
      key = dayKey.format(date);
    const day = days.get(key) ?? {
      key,
      label: dayLabel(locale).format(date),
      slots: [],
    };
    day.slots.push(slot);
    days.set(key, day);
  }
  return [...days.values()];
}
