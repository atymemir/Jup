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
}: {
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
            Добавить индивидуальный урок
          </button>
          <button className="secondary" onClick={addGroup}>
            Создать мини-группу
          </button>
        </div>
      </div>
      <div className={st.metrics}>
        {(
          [
            ["schedule", "Свободные даты", slots],
            ["students", "Ученики", students],
            ["requests", "Открытые заявки", requests],
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
              : "Опубликуйте время, чтобы ученики могли записаться."}
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
      {tasks > 0 && (
        <button className={st.task} onClick={() => openPanel("students")}>
          Требуют ответа · {tasks}
        </button>
      )}
      {!!unread && (
        <button className={st.task} onClick={() => openPanel("messages")}>
          Новые сообщения · {unread}
        </button>
      )}
      <button className={st.settlementLink} onClick={() => openPanel("wallet")}>
        Расчёты · пилот без комиссии
      </button>
    </section>
  );
}
