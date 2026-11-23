"use client";

import { useState } from "react";
import { lessonDate, money, type Group, type Tutor } from "../lib/findbuddy";
import { Icon } from "../ui/Icon";
import st from "./tutor-card.module.css";

const samplePhotos: Record<string, string> = {
  "demo-geo": "geography",
  "demo-sat": "sat",
  "demo-ielts": "ielts",
  "22222222-2222-4222-8222-222222222222": "geography",
  "33333333-3333-4333-8333-333333333333": "sat",
  "44444444-4444-4444-8444-444444444444": "ielts",
};
export function tutorPortrait(tutor: Tutor, local: boolean) {
  if (tutor.photo_version)
    return "/findbuddy/api/photo/" + tutor.id + "/" + tutor.photo_version;
  const sample = local && samplePhotos[tutor.id];
  return sample ? "/findbuddy/demo-tutors/" + sample + ".webp" : undefined;
}

export function TutorCard({
  tutor,
  next,
  local,
  saved,
  save,
  open,
  book,
  contact,
}: {
  tutor: Tutor;
  next?: Group;
  local: boolean;
  saved: boolean;
  save?: () => void;
  open: () => void;
  book?: () => void;
  contact?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const source = tutorPortrait(tutor, local);
  return (
    <article className={st.card} aria-label={tutor.display_name}>
      <div className={st.identity}>
        <button
          type="button"
          className={st.portrait}
          onClick={open}
          aria-label={"Анкета преподавателя " + tutor.display_name}
        >
          {source && !failed ? (
            // Uploaded portraits are normalized on the server.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              width={112}
              height={112}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <span className={st.initial}>{tutor.display_name.slice(0, 1)}</span>
          )}
        </button>
        <div className={st.person}>
          <p className={st.subject}>
            {tutor.exam} · {tutor.subject}
          </p>
          <h3>
            <button type="button" onClick={open}>
              {tutor.display_name}
            </button>
          </h3>
          <p className={st.muted}>
            {local
              ? "Демоанкета"
              : tutor.verification === "verified"
                ? "Личность подтверждена"
                : "Анкета на проверке"}
          </p>
        </div>
        {save && (
          <button
            type="button"
            className={st.save}
            aria-label={saved ? "Убрать из избранного" : "Сохранить анкету"}
            aria-pressed={saved}
            onClick={save}
          >
            <Icon name="bookmark" size={19} />
          </button>
        )}
      </div>
      <p className={st.headline}>{tutor.headline}</p>
      <p className={st.bio}>{tutor.bio}</p>
      <dl className={st.facts}>
        <div>
          <dt>Язык</dt>
          <dd>{tutor.language}</dd>
        </div>
        <div>
          <dt>Формат</dt>
          <dd>{tutor.city}</dd>
        </div>
        <div>
          <dt>Опыт</dt>
          <dd>{tutor.experience} г.</dd>
        </div>
      </dl>
      <p className={st.rating}>
        {!!tutor.review_count && tutor.rating != null ? (
          <>
            <Icon name="star" size={15} />{" "}
            {tutor.rating.toLocaleString("ru-KZ")} · оценок {tutor.review_count}
          </>
        ) : (
          "Пока без отзывов"
        )}
      </p>
      <div className={st.booking}>
        <div className={st.rate}>
          <strong>
            {(next?.price ?? tutor.price) === 0
              ? "Бесплатно"
              : money(next?.price ?? tutor.price)}
          </strong>
          <span>за урок · 60 минут</span>
        </div>
        <p className={st.availability}>
          <Icon name="calendar" size={16} />
          {next
            ? lessonDate(next.starts_at) + " · UTC+5"
            : "Время по договорённости"}
        </p>
        <button type="button" className="primary" onClick={book ?? open}>
          {book ? "Записаться на урок" : "Открыть анкету"}
        </button>
        <div className={st.links}>
          {book && (
            <button type="button" onClick={open}>
              Об уроках и преподавателе
            </button>
          )}
          {contact && (
            <button type="button" onClick={contact}>
              Задать вопрос
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
