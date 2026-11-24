"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

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
  const { t: tr, locale: uiLocale } = useJupLocale();

  const [failed, setFailed] = useState(false);
  const source = tutorPortrait(tutor, local);
  return (
    <article className={st.card} aria-label={tutor.display_name}>
      <div className={st.cover} data-portrait={!!source && !failed}>
        <button
          type="button"
          className={st.portrait}
          onClick={open}
          aria-label={tr("Анкета преподавателя ") + tutor.display_name}
        >
          {source && !failed ? (
            // Uploaded portraits are normalized on the server.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              width={400}
              height={400}
              decoding="async"
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <span className={st.initial}>{tutor.display_name.slice(0, 1)}</span>
          )}
        </button>
        <span className={st.subject}>
          {tr(tutor.subject)}
          <span>{tr(tutor.exam)}</span>
        </span>
        {save && (
          <button
            type="button"
            className={st.save}
            aria-label={tr(saved ? "Убрать из избранного" : "Сохранить анкету")}
            aria-pressed={saved}
            onClick={save}
          >
            <Icon name="bookmark" size={19} />
          </button>
        )}
      </div>
      <div className={st.cardBody}>
        <div className={st.identity}>
          <h3>
            <button type="button" onClick={open}>
              {tutor.display_name}
            </button>
          </h3>
          {!local && tutor.verification === "verified" && (
            <span className={st.verified} title={tr("Личность подтверждена")}>
              <Icon name="check" size={15} />
            </span>
          )}
          {local && <span className={st.example}>{tr("Демоанкета")}</span>}
        </div>
        <p className={st.headline}>{tutor.headline}</p>
        <p className={st.bio}>{tutor.bio}</p>
        <dl className={st.facts}>
          <div>
            <dt>{tr("Язык")}</dt>
            <dd>{tr(tutor.language)}</dd>
          </div>
          <div>
            <dt>{tr("Формат")}</dt>
            <dd>{tr(tutor.city)}</dd>
          </div>
          <div>
            <dt>{tr("Опыт")}</dt>
            <dd>
              {tutor.experience}
              {tr(" г.")}
            </dd>
          </div>
        </dl>
        <p className={st.rating}>
          {!!tutor.review_count && tutor.rating != null ? (
            <>
              <Icon name="star" size={15} />
              {tr(" ")}
              {tr(
                tutor.rating.toLocaleString(
                  uiLocale === "en" ? "en-GB" : "ru-KZ",
                ),
              )}
              {tr(" · оценок ")}
              {tutor.review_count}
            </>
          ) : (
            tr("Пока без отзывов")
          )}
        </p>
        <div className={st.booking}>
          <div className={st.rate}>
            <strong>
              {tr(
                (next?.price ?? tutor.price) === 0
                  ? tr("Бесплатно")
                  : money(next?.price ?? tutor.price, uiLocale),
              )}
            </strong>
            <span>{tr("за урок · 60 минут")}</span>
          </div>
          <p className={st.availability}>
            <Icon name="calendar" size={16} />
            {tr(
              next
                ? lessonDate(next.starts_at, uiLocale) + " · UTC+5"
                : tr("Время по договорённости"),
            )}
          </p>
          <button type="button" className="primary" onClick={book ?? open}>
            {tr(book ? "Записаться на урок" : "Открыть анкету")}
            <Icon name="arrowRight" size={17} />
          </button>
          <div className={st.links}>
            {book && (
              <button type="button" onClick={open}>
                {tr("Об уроках и преподавателе")}
              </button>
            )}
            {contact && (
              <button type="button" onClick={contact}>
                {tr("Задать вопрос")}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
