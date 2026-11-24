"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { TextEditor } from "../authoring/TextEditor";
import { FormattedText } from "../ui/FormattedText";
import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import {
  roomForBooking,
  lessonDate,
  kazakhstanDate,
  type Booking,
  type Dashboard,
  type LessonRoom,
  type LessonSeat,
  type Message,
} from "../lib/findbuddy";
import { downloadCalendar } from "../lib/schedule";
import { LessonOutcome } from "./LessonOutcome";
import { StudentContext } from "../platform/StudentContext";
import st from "./lessons.module.css";
const VideoCall = dynamic(() => import("./VideoCall"), {
  ssr: false,
  loading: () => <p>Подключаем видеосвязь…</p>,
});
type Refresh = () => Promise<void>;
function useAction(refresh: Refresh) {
  const { t: tr } = useJupLocale();

  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(
    action: string,
    data: Record<string, unknown>,
    message: string,
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("", action, data);
      await refresh();
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить изменения.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    status: (
      <>
        {error && (
          <p className={st.error} role="alert">
            {tr(error)}
          </p>
        )}
        {notice && (
          <p className={st.status} role="status">
            {tr(notice)}
          </p>
        )}
      </>
    ),
  };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t: tr } = useJupLocale();

  return (
    <label className={st.field}>
      <span>{tr(label)}</span>
      {children}
    </label>
  );
}
export function StudentName({
  name,
  refresh,
}: {
  name?: string | null;
  refresh: Refresh;
}) {
  const { t: tr } = useJupLocale();

  const { run, busy, status } = useAction(refresh);
  return (
    <details className={st.tools}>
      <summary>
        {tr(
          name
            ? tr("Имя для преподавателя · ") + name
            : tr("Как вас называть на занятиях?"),
        )}
      </summary>
      <form
        className={st.form}
        onSubmit={async (e) => {
          e.preventDefault();
          await run(
            "student_name",
            { name: new FormData(e.currentTarget).get("name") },
            "Имя сохранено.",
          );
        }}
      >
        <Field label={tr("Имя или псевдоним")}>
          <input
            name="name"
            required
            minLength={2}
            maxLength={50}
            defaultValue={name ?? ""}
          />
        </Field>
        <button className="secondary" disabled={busy}>
          {tr("Сохранить имя")}
        </button>
        {status}
      </form>
    </details>
  );
}
export function RoomEditor({
  room,
  target,
  refresh,
}: {
  room?: LessonRoom;
  target: { id: string } | { slot_id: string };
  refresh: Refresh;
}) {
  const { t: tr } = useJupLocale();

  const [draft, setDraft] = useState<{ room?: LessonRoom } | null>(null);
  const { run, busy, status } = useAction(refresh);
  return (
    <div>
      {draft ? (
        <form
          className={st.form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                "save_room",
                {
                  ...target,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                  revision: draft.room?.revision ?? 0,
                },
                "Материалы сохранены для участников занятия.",
              )
            )
              setDraft(null);
          }}
        >
          <TextEditor
            label={tr("План занятия")}
            name="plan"
            maxLength={2000}
            rows={3}
            defaultValue={draft.room?.plan}
            disabled={busy}
          />
          <Field label={tr("Ссылка на материалы")}>
            <input
              type="url"
              name="material"
              placeholder="https://…"
              maxLength={1500}
              defaultValue={draft.room?.material}
            />
          </Field>
          <Field label={tr("Ссылка на внешнюю встречу")}>
            <input
              type="url"
              name="meeting"
              placeholder="https://…"
              maxLength={1500}
              defaultValue={draft.room?.meeting}
            />
          </Field>
          <Field label={tr("Аудитория или адрес для очной встречи")}>
            <input
              name="location"
              maxLength={240}
              defaultValue={draft.room?.location}
            />
          </Field>
          <TextEditor
            label={tr("Домашнее задание")}
            name="homework"
            maxLength={2000}
            rows={3}
            defaultValue={draft.room?.homework}
            disabled={busy}
          />
          <TextEditor
            label={tr("Что разобрали на занятии")}
            name="recap"
            maxLength={2000}
            rows={2}
            defaultValue={draft.room?.recap}
            disabled={busy}
          />
          <div className={st.actions}>
            <button className="primary" disabled={busy}>
              {tr("Сохранить материалы")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              {tr("Закрыть редактор")}
            </button>
          </div>
        </form>
      ) : (
        <button className="secondary" onClick={() => setDraft({ room })}>
          {tr("Подготовить материалы и встречу")}
        </button>
      )}
      {status}
    </div>
  );
}
function Homework({
  room,
  seat,
  teacher,
  booking,
  refresh,
}: {
  room?: LessonRoom;
  seat?: LessonSeat;
  teacher: boolean;
  booking: Booking;
  refresh: Refresh;
}) {
  const { t: tr } = useJupLocale();

  const work = seat?.work;
  const [edit, setEdit] = useState<{
    revision: number;
    task: number;
    value: string;
  } | null>(null);
  const { run, busy, status } = useAction(refresh);
  const old = work && work.task_version !== room?.task_version;
  return (
    <section className={st.panel}>
      <h3>{tr("Домашняя работа")}</h3>
      <FormattedText value={room?.homework || "Задание пока не добавлено."} />
      {work && (
        <div className={st.answer}>
          <strong>
            {tr(
              old
                ? tr("Ответ на предыдущую версию задания")
                : teacher
                  ? tr("Ответ ученика")
                  : tr("Ваш ответ"),
            )}
          </strong>
          <p>{work.answer}</p>
          {work.feedback && (
            <>
              <strong>{tr("Комментарий преподавателя")}</strong>
              <p>{work.feedback}</p>
            </>
          )}
        </div>
      )}
      {room?.homework &&
        (!teacher || (work && !old)) &&
        (!edit ? (
          <button
            className="secondary"
            onClick={() =>
              setEdit({
                revision: work?.revision ?? 0,
                task: room.task_version,
                value:
                  (teacher ? work?.feedback : old ? "" : work?.answer) ?? "",
              })
            }
          >
            {tr(
              teacher
                ? tr("Проверить работу")
                : work
                  ? tr("Обновить ответ")
                  : tr("Ответить на задание"),
            )}
          </button>
        ) : (
          <form
            className={st.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("value");
              if (
                await run(
                  teacher ? "review_work" : "send_work",
                  {
                    id: booking.id,
                    revision: edit.revision,
                    task_version: edit.task,
                    ...(teacher ? { feedback: value } : { answer: value }),
                  },
                  teacher
                    ? "Комментарий доступен ученику."
                    : "Ответ отправлен преподавателю.",
                )
              )
                setEdit(null);
            }}
          >
            <Field
              label={tr(teacher ? tr("Комментарий к работе") : tr("Ваш ответ"))}
            >
              <textarea
                disabled={busy}
                required
                name="value"
                rows={3}
                maxLength={teacher ? 2000 : 2500}
                defaultValue={edit.value}
              />
            </Field>
            <div className={st.actions}>
              <button className="primary" disabled={busy}>
                {tr(
                  teacher
                    ? tr("Отправить комментарий")
                    : tr("Отправить работу"),
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                {tr("Отмена")}
              </button>
            </div>
          </form>
        ))}
      {status}
    </section>
  );
}
function Move({
  booking,
  user,
  seat,
  refresh,
}: {
  booking: Booking;
  user: string;
  seat?: LessonSeat;
  refresh: Refresh;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const { run, busy, status } = useAction(refresh),
    move = seat?.move;
  async function propose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = String(new FormData(form).get("start") ?? "");
    let iso: string;
    try {
      iso = kazakhstanDate(raw);
    } catch {
      const input = form.elements.namedItem("start") as HTMLInputElement;
      input.setCustomValidity("Выберите дату в будущем.");
      input.reportValidity();
      return;
    }
    if (
      await run(
        "propose_move",
        { id: booking.id, starts_at: iso, move_id: move?.id },
        "Предложение отправлено. Пока действует прежнее время.",
      )
    )
      form.reset();
  }
  return (
    <div className={st.tools}>
      {move ? (
        <>
          <strong>
            {tr("Предложен перенос на ")}
            {tr(lessonDate(move.starts_at, uiLocale))} · UTC+5
          </strong>
          <p>
            {tr(
              move.proposed_by === user
                ? tr("Ждём подтверждения другой стороны.")
                : tr("Подтвердите, чтобы изменить запись в обоих календарях."),
            )}
          </p>
          <div className={st.actions}>
            {move.proposed_by !== user && (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    "accept_move",
                    { id: booking.id, move_id: move.id },
                    "Оба календаря обновлены.",
                  )
                }
              >
                {tr("Подтвердить перенос")}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                run(
                  "dismiss_move",
                  { id: booking.id, move_id: move.id },
                  "Сохранено прежнее время.",
                )
              }
            >
              {tr(
                move.proposed_by === user
                  ? tr("Отозвать предложение")
                  : tr("Оставить прежнее время"),
              )}
            </button>
          </div>
        </>
      ) : (
        <details>
          <summary>{tr("Предложить другое время")}</summary>
          <form className={st.form} onSubmit={propose}>
            <Field label={tr("Новое время · Казахстан, UTC+5")}>
              <input
                name="start"
                type="datetime-local"
                required
                onInput={(e) => e.currentTarget.setCustomValidity("")}
              />
            </Field>
            <button className="secondary" disabled={busy}>
              {tr("Предложить перенос")}
            </button>
          </form>
        </details>
      )}
      {status}
    </div>
  );
}
function Chat({
  messages,
  booking,
  user,
  peer,
  refresh,
}: {
  messages: Message[];
  booking: string;
  user: string;
  peer: string;
  refresh: Refresh;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const { run, busy, status } = useAction(refresh);
  return (
    <section className={st.panel}>
      <h3>{tr("Переписка")}</h3>
      <small>
        {tr("Личный чат · ")}
        {peer}
      </small>
      <div
        className={st.messages}
        role="log"
        aria-label={tr("Сообщения занятия")}
      >
        {!messages.length && (
          <p>
            {tr(
              "Здесь можно договориться о подготовке и задать вопрос по уроку.",
            )}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} data-mine={m.sender_id === user}>
            <small>
              {tr(m.sender_id === user ? tr("Вы") : peer)} ·{" "}
              {tr(lessonDate(m.created_at, uiLocale))}
            </small>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
      <form
        className={st.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const body = new FormData(form).get("body");
          if (
            await run(
              "message",
              { booking_id: booking, body },
              "Сообщение отправлено.",
            )
          )
            form.reset();
        }}
      >
        <Field label={tr("Ваше сообщение")}>
          <textarea
            required
            disabled={busy}
            maxLength={2000}
            rows={2}
            name="body"
          />
        </Field>
        <button className="primary" disabled={busy}>
          {tr("Отправить сообщение")}
        </button>
        {status}
      </form>
    </section>
  );
}
export function Workspace({
  booking,
  dashboard,
  user,
  tutor,
  now,
  video,
  refresh,
  openSeat,
  back,
  rebook,
  initialPane,
}: {
  booking: Booking;
  dashboard: Dashboard;
  user: string;
  tutor: string;
  now: number;
  video: boolean;
  refresh: Refresh;
  openSeat: (id: string) => void;
  back: () => void;
  rebook?: () => void;
  initialPane: "lesson" | "chat" | "work";
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const teacher = booking.tutor_id === user;
  const room = roomForBooking(dashboard.rooms, booking);
  const seat = dashboard.seats?.find((s) => s.id === booking.id);
  const groupSeats =
    teacher && booking.lesson_format === "group"
      ? dashboard.bookings.filter(
          (b) => b.group_id === booking.group_id && b.status !== "cancelled",
        )
      : [];
  const [pane, setPane] = useState<"lesson" | "chat" | "work">(initialPane);
  const [ticket, setTicket] = useState<{ url: string; token: string } | null>(
      null,
    ),
    [connecting, setConnecting] = useState(false),
    [error, setError] = useState("");
  const starts = Date.parse(booking.starts_at),
    callOpen = now >= starts - 900000 && now < starts + 4500000;
  const messages = dashboard.messages.filter(
    (m) => m.booking_id === booking.id,
  );
  const latestIncoming = messages
    .filter((m) => m.sender_id !== user)
    .at(-1)?.id;
  useEffect(() => {
    if (pane !== "chat" || !seat?.unread || !latestIncoming) return;
    let alive = true;
    const mark = () => {
      if (!document.hidden)
        void api("", "read_chat", {
          id: booking.id,
          message_id: latestIncoming,
        })
          .then(() => {
            if (alive) void refresh();
          })
          .catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", mark);
    };
  }, [booking.id, pane, seat?.unread, latestIncoming, refresh]);
  const peer = teacher ? (seat?.name ?? "Ученик") : tutor;
  return (
    <section className={st.workspace}>
      <button className={st.back} onClick={back}>
        {tr("Все занятия")}
      </button>
      <div className={st.row}>
        <div>
          <small>
            {tr(
              booking.lesson_format === "group"
                ? tr("Мини-группа")
                : tr("Индивидуальный урок"),
            )}
            {tr(" ")}· {peer}
          </small>
          <h2>{booking.lesson_title || booking.subject}</h2>
          <p>
            {tr(lessonDate(booking.starts_at, uiLocale))}
            {tr(" · 60 минут · UTC+5")}
          </p>
        </div>
        <button className="secondary" onClick={() => downloadCalendar(booking)}>
          {tr("В календарь")}
        </button>
      </div>
      {teacher && (
        <StudentContext key={booking.student_id} id={booking.student_id} />
      )}
      {groupSeats.length > 1 && (
        <Field label={tr("Ученик для личной переписки и проверки работы")}>
          <select value={booking.id} onChange={(e) => openSeat(e.target.value)}>
            {groupSeats.map((b) => (
              <option key={b.id} value={b.id}>
                {dashboard.seats?.find((s) => s.id === b.id)?.name ??
                  tr("Ученик")}
              </option>
            ))}
          </select>
        </Field>
      )}
      {ticket && callOpen && (
        <VideoCall
          ticket={ticket}
          leave={() => setTicket(null)}
          onError={(e) => setError(e.message)}
        />
      )}
      {error && (
        <p className={st.error} role="alert">
          {tr(error)}
        </p>
      )}
      <div className={st.panes} aria-label={tr("Разделы занятия")}>
        {(
          [
            ["lesson", "Занятие"],
            ["chat", "Чат"],
            ["work", "Домашняя работа"],
          ] as const
        ).map(([id, title]) => (
          <button
            key={id}
            aria-pressed={pane === id}
            onClick={() => setPane(id)}
          >
            {tr(title)}
            {tr(
              id === "chat" && messages.length ? " · " + messages.length : "",
            )}
          </button>
        ))}
      </div>
      {pane === "lesson" && (
        <>
          {now >= starts + 3600000 && (
            <LessonOutcome
              key={booking.id}
              id={booking.id}
              teacher={teacher}
              outcome={dashboard.outcomes?.find(
                (o) => o.booking_id === booking.id,
              )}
              refresh={refresh}
            />
          )}
          <section className={st.panel}>
            <h3>{tr("Где встречаемся")}</h3>
            {room?.location && <p>{tr(room.location)}</p>}
            {video && (
              <>
                <p>
                  {tr(
                    now < starts - 900000
                      ? tr(
                          "Вход в видеокомнату откроется за 15 минут до начала.",
                        )
                      : now >= starts + 4500000
                        ? tr("Время видеовстречи закончилось.")
                        : tr(
                            "Можно присоединиться. Камера и микрофон при входе выключены.",
                          ),
                  )}
                </p>
                {callOpen && !ticket && (
                  <button
                    disabled={connecting}
                    className="primary"
                    onClick={async () => {
                      setConnecting(true);
                      setError("");
                      try {
                        setTicket(
                          await api("", "video_access", { id: booking.id }),
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Не удалось начать звонок.",
                        );
                      } finally {
                        setConnecting(false);
                      }
                    }}
                  >
                    {tr(
                      connecting
                        ? tr("Подключаемся…")
                        : tr("Войти в видеокомнату"),
                    )}
                  </button>
                )}
              </>
            )}
            {room?.meeting && (
              <a
                className="secondary"
                href={room.meeting}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("Открыть ссылку на встречу")}
              </a>
            )}
            {!video && !room?.meeting && !room?.location && (
              <p>
                {tr(
                  teacher
                    ? tr(
                        "Добавьте ссылку на видеовстречу или адрес аудитории в материалах ниже.",
                      )
                    : tr(
                        "Преподаватель пока не указал место встречи. Уточните его в чате занятия.",
                      ),
                )}
              </p>
            )}
          </section>
          <section className={st.panel}>
            <h3>{tr("План и материалы")}</h3>
            <FormattedText value={room?.plan || "План пока не добавлен."} />
            {room?.material && (
              <a
                className="secondary"
                href={room.material}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("Открыть материал")}
              </a>
            )}
            {room?.recap && (
              <>
                <h4>{tr("Итоги урока")}</h4>
                <FormattedText value={room.recap} />
              </>
            )}
            {teacher && (
              <RoomEditor
                room={room}
                target={{ id: booking.id }}
                refresh={refresh}
              />
            )}
          </section>
          {booking.lesson_format === "individual" && now < starts && (
            <Move booking={booking} user={user} seat={seat} refresh={refresh} />
          )}
          {rebook && now >= starts + 3600000 && (
            <button className="secondary" onClick={rebook}>
              {tr("Договориться о следующем уроке")}
            </button>
          )}
        </>
      )}
      {pane === "work" && (
        <Homework
          key={booking.id}
          booking={booking}
          teacher={teacher}
          room={room}
          seat={seat}
          refresh={refresh}
        />
      )}
      {pane === "chat" && (
        <Chat
          key={booking.id}
          messages={messages}
          booking={booking.id}
          user={user}
          peer={peer}
          refresh={refresh}
        />
      )}
    </section>
  );
}
