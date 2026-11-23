import { useState } from "react";
import { type Booking, type Group } from "../lib/findbuddy";
import { downloadCalendar, type CalendarItem } from "../lib/schedule";
import st from "./lessons.module.css";

const day = 86400000;
const dateKey = (time: number) =>
  new Date(time + 5 * 3600000).toISOString().slice(0, 10);
const dayLabel = (value: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ru-KZ", { ...options, timeZone: "UTC" }).format(
    value,
  );
type Event = CalendarItem & { detail: string; slotId?: string };
export function Calendar({
  now,
  bookings,
  slots,
  user,
  openBooking,
  openSlot,
}: {
  now: number;
  bookings: Booking[];
  slots: Group[];
  user: string;
  openBooking: (id: string) => void;
  openSlot: (id: string) => void;
}) {
  const today = Date.parse(dateKey(now) + "T00:00:00Z");
  const [selected, setSelected] = useState(today);
  const start = selected - ((new Date(selected).getUTCDay() + 6) % 7) * day;
  const events = new Map<string, Event>();
  for (const g of slots)
    if (g.tutor_id === user)
      events.set(g.id, {
        id: g.id,
        slotId: g.id,
        lesson_title: g.title,
        subject: g.subject,
        starts_at: g.starts_at,
        detail: g.enrollment_closed
          ? "Набор закрыт"
          : g.reserved
            ? "Записались: " + g.reserved + " из " + g.capacity
            : "Открыта запись",
      });
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const key = b.tutor_id === user ? (b.group_id ?? b.id) : b.id;
    const entry = events.get(key);
    if (entry) {
      entry.bookingId ??= b.id;
      continue;
    }
    events.set(key, {
      ...b,
      id: key,
      bookingId: b.id,
      detail: b.tutor_id === user ? "Вы преподаёте" : "Вы записаны",
    });
  }
  const ordered = [...events.values()].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );
  const week = ordered.filter((e) => {
    const d = Date.parse(dateKey(Date.parse(e.starts_at)));
    return d >= start && d < start + 7 * day;
  });
  const forDay = (t: number) =>
    week.filter(
      (e) =>
        dateKey(Date.parse(e.starts_at)) ===
        new Date(t).toISOString().slice(0, 10),
    );
  const upcoming = ordered.find((e) => Date.parse(e.starts_at) + 3600000 > now);
  return (
    <section className={st.calendar} aria-label="Календарь занятий">
      <div className={st.row}>
        <div>
          <h3>Календарь занятий</h3>
          <small>Время Казахстана · UTC+5</small>
        </div>
        <div className={st.actions}>
          <button
            aria-label="Предыдущая неделя"
            onClick={() => setSelected(selected - 7 * day)}
          >
            ‹
          </button>
          <button onClick={() => setSelected(today)}>Сегодня</button>
          <button
            aria-label="Следующая неделя"
            onClick={() => setSelected(selected + 7 * day)}
          >
            ›
          </button>
        </div>
      </div>
      <p className={st.weekTitle}>
        {dayLabel(start, { day: "numeric", month: "short" })} —{" "}
        {dayLabel(start + 6 * day, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <div className={st.days}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = start + i * day;
          const count = forDay(d).length;
          return (
            <button
              key={d}
              aria-pressed={d === selected}
              aria-label={
                dayLabel(d, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }) +
                ", занятий: " +
                count
              }
              onClick={() => setSelected(d)}
            >
              <span>{dayLabel(d, { weekday: "short" })}</span>
              <strong>{dayLabel(d, { day: "numeric" })}</strong>
              <i data-events={count > 0} />
            </button>
          );
        })}
      </div>
      {forDay(selected).map((e) => (
        <button
          className={st.event}
          key={e.id}
          onClick={() =>
            e.bookingId
              ? openBooking(e.bookingId)
              : e.slotId && openSlot(e.slotId)
          }
        >
          <time>
            {new Intl.DateTimeFormat("ru-KZ", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Almaty",
            }).format(new Date(e.starts_at))}
          </time>
          <span>
            <strong>{e.lesson_title || e.subject}</strong>
            <small>{e.detail}</small>
          </span>
        </button>
      ))}
      {!forDay(selected).length && (
        <p className={st.muted}>В этот день занятий нет.</p>
      )}
      <div className={st.actions}>
        {upcoming && (
          <button
            onClick={() =>
              setSelected(Date.parse(dateKey(Date.parse(upcoming.starts_at))))
            }
          >
            К ближайшему занятию
          </button>
        )}
        {week.length > 0 && (
          <button onClick={() => downloadCalendar(week)}>
            Скачать неделю (.ics)
          </button>
        )}
      </div>
    </section>
  );
}
