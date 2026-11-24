"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { lessonDate, money, type Group, type Tutor } from "../lib/findbuddy";
import { lessonClock, lessonSlotDays } from "../lib/lessonSlots";
import { TutorPhoto } from "../profiles/TutorProfile";
import { tutorPortrait } from "../profiles/TutorCard";
import { Icon } from "../ui/Icon";
import st from "./booking.module.css";

export function BookingSummary({
  lesson,
  slots,
  tutor,
  tutorName,
  local,
  busy,
  blocked,
  choose,
  booked,
}: {
  lesson: Group;
  slots: Group[];
  tutor?: Tutor;
  tutorName: string;
  local: boolean;
  busy: boolean;
  blocked?: string | null;
  choose: (lesson: Group) => void;
  booked?: () => void;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const days = lessonSlotDays(slots, uiLocale);
  return (
    <section
      className={st.summary}
      aria-label={tr("Условия выбранного занятия")}
    >
      <div className={st.teacher}>
        <TutorPhoto
          tutor={tutor}
          source={tutor ? tutorPortrait(tutor, local) : undefined}
        />
        <div>
          <strong>{tutorName}</strong>
          <p>
            {tr(lesson.subject)} · {tr(lesson.exam)}
          </p>
        </div>
      </div>
      <h3>{lesson.title}</h3>
      {lesson.capacity === 1 && slots.length > 1 ? (
        <fieldset className={st.choices} disabled={busy}>
          <legend>
            {tr("Выберите удобное время")}
            <span>{tr("Казахстан · UTC+5")}</span>
          </legend>
          <div className={st.dayList}>
            {days.map((day) => (
              <div key={day.key} className={st.day}>
                <h4>{tr(day.label)}</h4>
                <div className={st.timeGrid}>
                  {day.slots.map((slot) => {
                    const unavailable =
                      !!slot.enrollment_closed ||
                      slot.reserved >= slot.capacity;
                    return (
                      <label
                        key={slot.id}
                        className={st.time}
                        data-selected={lesson.id === slot.id}
                        data-unavailable={unavailable}
                      >
                        <input
                          type="radio"
                          name="booking-time"
                          value={slot.id}
                          checked={lesson.id === slot.id}
                          disabled={unavailable}
                          onChange={() => choose(slot)}
                        />
                        <span>
                          <strong>
                            {tr(lessonClock(slot.starts_at, uiLocale))}
                          </strong>
                          <small>
                            {tr(
                              unavailable
                                ? slot.enrollment_closed
                                  ? tr("Запись закрыта")
                                  : tr("Мест нет")
                                : slot.price === 0
                                  ? tr("Бесплатно")
                                  : money(slot.price, uiLocale),
                            )}
                          </small>
                        </span>
                        <span className={st.selected} aria-hidden="true">
                          {lesson.id === slot.id && (
                            <Icon name="check" size={13} />
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className={st.date}>
          <Icon name="calendar" size={20} />
          <div>
            <strong>{tr(lessonDate(lesson.starts_at, uiLocale))}</strong>
            <small>{tr("Время Казахстана · UTC+5")}</small>
          </div>
        </div>
      )}
      <dl className={st.details}>
        <div>
          <dt>{tr("Длительность")}</dt>
          <dd>{tr("60 минут")}</dd>
        </div>
        <div>
          <dt>{tr("Формат")}</dt>
          <dd>{tr(lesson.city)}</dd>
        </div>
        <div>
          <dt>{tr("Язык")}</dt>
          <dd>{tr(lesson.language)}</dd>
        </div>
      </dl>
      <div className={st.total}>
        <div>
          <span>{tr("Стоимость урока")}</span>
          <small>
            {tr(
              lesson.capacity > 1
                ? tr("За одно место в мини-группе")
                : tr("Индивидуально с преподавателем"),
            )}
          </small>
        </div>
        <strong>
          {tr(
            lesson.price === 0
              ? tr("Бесплатно")
              : money(lesson.price, uiLocale),
          )}
        </strong>
      </div>
      <div className={st.note}>
        <Icon name="check" size={17} />
        <p>
          {tr(
            lesson.price === 0
              ? tr("Бесплатное занятие. Оплата не требуется.")
              : local
                ? tr(
                    "Сейчас деньги не списываются. Это локальная тестовая запись.",
                  )
                : tr(
                    "Сейчас деньги не списываются. Оплату урока согласуйте с преподавателем.",
                  ),
          )}
        </p>
      </div>
      {booked && (
        <button className="secondary" type="button" onClick={booked}>
          {tr("Открыть моё занятие")}
        </button>
      )}
      {blocked && (
        <p className={st.blocked} role="status">
          {tr(blocked)}.{" "}
          {tr(
            booked
              ? tr("Эта запись уже есть в вашем кабинете.")
              : slots.some((slot) => slot.id !== lesson.id)
                ? tr("Выберите другое время выше.")
                : tr("Вернитесь к анкете и выберите другое занятие."),
          )}
        </p>
      )}
    </section>
  );
}
