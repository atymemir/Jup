import { type Booking, lessonDate } from "../lib/findbuddy";
import { Icon } from "../ui/Icon";
import st from "./teacher.module.css";

export function TeacherOverview({
  name,
  next,
  slots,
  students,
  requests,
  tasks,
  unread,
  openNext,
  openPanel,
  add,
  addGroup,
  attention,
  openAttention,
}: {
  attention?: {
    id: string;
    pane: "lesson" | "chat" | "work";
    label: string;
    peer: string;
  }[];
  openAttention?: (id: string, pane: "lesson" | "chat" | "work") => void;
  name: string;
  next?: Booking;
  slots: number;
  students: number;
  requests: number;
  tasks: number;
  unread: number;
  openNext: (id: string) => void;
  openPanel: (panel: string) => void;
  add: () => void;
  addGroup: () => void;
}) {
  return (
    <section className={st.overview}>
      <div className={st.top}>
        <div>
          <p>Кабинет преподавателя</p>
          <h1>{name}</h1>
        </div>
        <div className={st.buttons}>
          <button className="primary" onClick={add}>
            Добавить урок
          </button>
          <button className="secondary" onClick={addGroup}>
            Мини-группа
          </button>
        </div>
      </div>
      <div className={st.metrics}>
        {(
          [
            ["schedule", "Уроки для записи", slots],
            ["students", "Ученики", students],
            ["requests", "Заявки", requests],
          ] as const
        ).map(([panel, label, count]) => (
          <button key={panel} onClick={() => openPanel(panel)}>
            <strong>{count}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className={st.next}>
        <div>
          <p>
            <Icon name="calendar" size={17} /> Ближайшее занятие
          </p>
          <h2>
            {next
              ? next.lesson_title || next.subject
              : "Ближайших записей пока нет"}
          </h2>
          <p>
            {next
              ? lessonDate(next.starts_at) + " · время Казахстана"
              : slots > 0
                ? "Время опубликовано. Первые записи появятся здесь."
                : "Добавьте урок и выберите время для записи."}
          </p>
        </div>
        {next && (
          <button className="primary" onClick={() => openNext(next.id)}>
            Открыть занятие
          </button>
        )}
        {!next && slots > 0 && (
          <button className="secondary" onClick={() => openPanel("schedule")}>
            Открыть расписание
          </button>
        )}
      </div>
      {!!attention?.length && (
        <section className={st.attention}>
          <h2>
            Что требует внимания <span>{tasks}</span>
          </h2>
          {attention.slice(0, 3).map((item) => (
            <button
              key={`${item.id}:${item.pane}:${item.label}`}
              onClick={() => openAttention?.(item.id, item.pane)}
            >
              <span className={st.attentionIcon}>
                <Icon
                  name={
                    item.pane === "work"
                      ? "teacher"
                      : item.pane === "chat"
                        ? "requests"
                        : "calendar"
                  }
                  size={19}
                />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.peer}</small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </section>
      )}
      {!!unread && (
        <button className={st.task} onClick={() => openPanel("messages")}>
          Личные сообщения · {unread}
        </button>
      )}
    </section>
  );
}
