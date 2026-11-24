"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import { type Booking, lessonDate } from "../lib/findbuddy";
import { Icon } from "../ui/Icon";
import { lessonClock } from "../lib/lessonSlots";
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
  const { t: tr, locale: uiLocale } = useJupLocale();

  return (
    <section className={st.overview}>
      <div className={st.top}>
        <div>
          <p>{tr("Кабинет преподавателя")}</p>
          <h1>{name}</h1>
        </div>
        <div className={st.buttons}>
          <button className="primary" onClick={add}>
            <Icon name="plus" size={18} />
            {tr("Добавить урок")}
          </button>
          <button className="secondary" onClick={addGroup}>
            {tr("Мини-группа")}
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
            <span className={st.metricTop}>
              <Icon
                name={
                  panel === "schedule"
                    ? "calendar"
                    : panel === "students"
                      ? "groups"
                      : "requests"
                }
                size={19}
              />
              <Icon name="arrow" size={15} />
            </span>
            <strong>{count}</strong>
            <span>{tr(label)}</span>
          </button>
        ))}
      </div>
      <div className={st.dashboardMain}>
        <div className={st.next}>
          <div className={st.nextHeading}>
            <span className={st.liveDot} />
            <p>{tr("Ближайшее занятие")}</p>
            {next && (
              <span className={st.lessonTime}>
                {lessonClock(next.starts_at, uiLocale)}
              </span>
            )}
          </div>
          <div className={st.nextContent}>
            <h2>
              {next
                ? next.lesson_title || tr(next.subject)
                : tr("Ближайших записей пока нет")}
            </h2>
            <p>
              {next
                ? lessonDate(next.starts_at, uiLocale) +
                  tr(" · время Казахстана")
                : slots > 0
                  ? tr("Время опубликовано. Первые записи появятся здесь.")
                  : tr("Добавьте урок и выберите время для записи.")}
            </p>
          </div>
          <div className={st.nextActions}>
            {next ? (
              <button className="primary" onClick={() => openNext(next.id)}>
                {tr("Открыть занятие")}
                <Icon name="arrowRight" size={17} />
              </button>
            ) : (
              <button className="primary" onClick={add}>
                <Icon name="plus" size={17} />
                {tr("Добавить урок")}
              </button>
            )}
            <button onClick={() => openPanel("schedule")}>
              {tr("Расписание")}
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
        <aside className={st.quickActions}>
          <h2>{tr("Быстрые действия")}</h2>
          {(
            [
              ["calendar", "Открыть расписание", () => openPanel("schedule")],
              ["teacher", "Редактировать анкету", () => openPanel("profile")],
              ["requests", "Личные сообщения", () => openPanel("messages")],
            ] as const
          ).map(([icon, label, action]) => (
            <button type="button" key={label} onClick={action}>
              <span>
                <Icon name={icon} size={19} />
              </span>
              {tr(label)}
              <Icon name="chevron" size={15} />
            </button>
          ))}
        </aside>
      </div>
      {!!attention?.length && (
        <section className={st.attention}>
          <h2>
            {tr("Что требует внимания ")}
            <span>{tasks}</span>
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
                <strong>{tr(item.label)}</strong>
                <small>{item.peer}</small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </section>
      )}
      {!!unread && (
        <button className={st.task} onClick={() => openPanel("messages")}>
          {tr("Личные сообщения · ")}
          {unread}
        </button>
      )}
    </section>
  );
}
