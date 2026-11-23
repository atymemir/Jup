"use client";
import { lessonDate, money, type Group, type Tutor } from "../lib/findbuddy";
import { lessonClock, lessonSlotDays } from "../lib/lessonSlots";
import { TutorPhoto } from "../profiles/TutorProfile";
import { tutorPortrait } from "../profiles/TutorCard";
import { Icon } from "../ui/Icon";
import st from "./booking.module.css";

export function BookingSummary({ lesson, slots, tutor, tutorName, local, busy, blocked, choose, booked }: {
  lesson: Group; slots: Group[]; tutor?: Tutor; tutorName: string; local: boolean; busy: boolean;
  blocked?: string | null; choose: (lesson: Group) => void; booked?: () => void;
}) {
  const days = lessonSlotDays(slots);
  return <section className={st.summary} aria-label="Условия выбранного занятия">
    <div className={st.teacher}><TutorPhoto tutor={tutor} source={tutor ? tutorPortrait(tutor, local) : undefined} /><div><strong>{tutorName}</strong><p>{lesson.subject} · {lesson.exam}</p></div></div>
    <h3>{lesson.title}</h3>
    {lesson.capacity === 1 && slots.length > 1 ? <fieldset className={st.choices} disabled={busy}><legend>Выберите удобное время<span>Казахстан · UTC+5</span></legend><div className={st.dayList}>
      {days.map((day) => <div key={day.key} className={st.day}><h4>{day.label}</h4><div className={st.timeGrid}>{day.slots.map((slot) => {
        const unavailable = !!slot.enrollment_closed || slot.reserved >= slot.capacity;
        return <label key={slot.id} className={st.time} data-selected={lesson.id === slot.id} data-unavailable={unavailable}><input type="radio" name="booking-time" value={slot.id} checked={lesson.id === slot.id} disabled={unavailable} onChange={() => choose(slot)} /><span><strong>{lessonClock(slot.starts_at)}</strong><small>{unavailable ? slot.enrollment_closed ? "Запись закрыта" : "Мест нет" : slot.price === 0 ? "Бесплатно" : money(slot.price)}</small></span><span className={st.selected} aria-hidden="true">{lesson.id === slot.id && <Icon name="check" size={13} />}</span></label>;
      })}</div></div>)}
    </div></fieldset> : <div className={st.date}><Icon name="calendar" size={20} /><div><strong>{lessonDate(lesson.starts_at)}</strong><small>Время Казахстана · UTC+5</small></div></div>}
    <dl className={st.details}><div><dt>Длительность</dt><dd>60 минут</dd></div><div><dt>Формат</dt><dd>{lesson.city}</dd></div><div><dt>Язык</dt><dd>{lesson.language}</dd></div></dl>
    <div className={st.total}><div><span>Стоимость урока</span><small>{lesson.capacity > 1 ? "За одно место в мини-группе" : "Индивидуально с преподавателем"}</small></div><strong>{lesson.price === 0 ? "Бесплатно" : money(lesson.price)}</strong></div>
    <div className={st.note}><Icon name="check" size={17} /><p>{lesson.price === 0 ? "Бесплатное занятие. Оплата не требуется." : local ? "Сейчас деньги не списываются. Это локальная тестовая запись." : "Сейчас деньги не списываются. Оплату урока согласуйте с преподавателем."}</p></div>
    {booked && <button className="secondary" type="button" onClick={booked}>Открыть моё занятие</button>}
    {blocked && <p className={st.blocked} role="status">{blocked}. {booked ? "Эта запись уже есть в вашем кабинете." : slots.some((slot) => slot.id !== lesson.id) ? "Выберите другое время выше." : "Вернитесь к анкете и выберите другое занятие."}</p>}
  </section>;
}
