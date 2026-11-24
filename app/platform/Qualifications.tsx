"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useState } from "react";
import type { Tutor } from "../lib/findbuddy";
import type { Education, Certificate, SpokenLanguage } from "../lib/platform";
import st from "./platform.module.css";
export function Qualifications({ tutor }: { tutor?: Tutor }) {
  const { t: tr } = useJupLocale();

  const [education, setEducation] = useState<Education[]>(
    tutor?.education_entries ?? [],
  );
  const [certificates, setCertificates] = useState<Certificate[]>(
    tutor?.certificates ?? [],
  );
  const [languages, setLanguages] = useState<SpokenLanguage[]>(
    tutor?.spoken_languages ?? [],
  );
  return (
    <div className={st.stack}>
      <input
        type="hidden"
        name="education_entries"
        value={JSON.stringify(education)}
      />
      <input
        type="hidden"
        name="certificates"
        value={JSON.stringify(certificates)}
      />
      <input
        type="hidden"
        name="spoken_languages"
        value={JSON.stringify(languages)}
      />
      <details className={st.qualificationGroup}>
        <summary>
          <span>
            {tr("Образование")}
            <small>
              {tr(
                education.length
                  ? tr("Записей: {0}", [education.length])
                  : tr("Учебное заведение и специальность"),
              )}
            </small>
          </span>
        </summary>
        {education.map((x, i) => (
          <div key={i} className={st.editor}>
            <div className={st.formGrid}>
              {(
                [
                  ["institution", "Учебное заведение"],
                  ["degree", "Степень"],
                  ["field", "Специальность"],
                  ["year", "Год окончания"],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  {tr(label)}
                  <input
                    maxLength={180}
                    value={x[k]}
                    onChange={(e) =>
                      setEducation((a) =>
                        a.map((v, n) =>
                          n === i ? { ...v, [k]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <label>
                {tr("Статус")}
                <select
                  value={x.status}
                  onChange={(e) =>
                    setEducation((a) =>
                      a.map((v, n) =>
                        n === i ? { ...v, status: e.target.value } : v,
                      ),
                    )
                  }
                >
                  <option value="completed">{tr("Окончил(а)")}</option>
                  <option value="studying">{tr("Продолжаю учиться")}</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className={st.textButton}
              onClick={() => setEducation((a) => a.filter((_, n) => n !== i))}
            >
              {tr("Удалить запись")}
            </button>
          </div>
        ))}
        {education.length < 8 && (
          <button
            type="button"
            className={st.textButton}
            onClick={() =>
              setEducation((a) => [
                ...a,
                {
                  institution: "",
                  degree: "",
                  field: "",
                  year: "",
                  status: "completed",
                },
              ])
            }
          >
            {tr("Добавить образование")}
          </button>
        )}
      </details>
      <details className={st.qualificationGroup}>
        <summary>
          <span>
            {tr("Сертификаты и результаты")}
            <small>
              {tr(
                certificates.length
                  ? tr("Добавлено: {0}", [certificates.length])
                  : tr("Экзамены, курсы и квалификация"),
              )}
            </small>
          </span>
        </summary>
        {certificates.map((x, i) => (
          <div key={i} className={st.editor}>
            <div className={st.formGrid}>
              {(
                [
                  ["name", "Сертификат или экзамен"],
                  ["issuer", "Организация"],
                  ["result", "Результат"],
                  ["year", "Год"],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  {tr(label)}
                  <input
                    maxLength={180}
                    value={x[k]}
                    onChange={(e) =>
                      setCertificates((a) =>
                        a.map((v, n) =>
                          n === i ? { ...v, [k]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className={st.textButton}
              onClick={() =>
                setCertificates((a) => a.filter((_, n) => n !== i))
              }
            >
              {tr("Удалить сертификат")}
            </button>
          </div>
        ))}
        {certificates.length < 8 && (
          <button
            type="button"
            className={st.textButton}
            onClick={() =>
              setCertificates((a) => [
                ...a,
                { name: "", issuer: "", year: "", result: "" },
              ])
            }
          >
            {tr("Добавить сертификат")}
          </button>
        )}
      </details>
      <details className={st.qualificationGroup}>
        <summary>
          <span>
            {tr("Владение языками")}
            <small>
              {tr(
                languages.length
                  ? languages
                      .map((item) => item.language)
                      .filter(Boolean)
                      .join(", ")
                  : tr("Языки и ваш уровень"),
              )}
            </small>
          </span>
        </summary>
        {languages.map((x, i) => (
          <div className={st.formGrid} key={i}>
            <label>
              {tr("Язык")}
              <input
                value={x.language}
                maxLength={60}
                onChange={(e) =>
                  setLanguages((a) =>
                    a.map((v, n) =>
                      n === i ? { ...v, language: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <label>
              {tr("Уровень")}
              <select
                value={x.level}
                onChange={(e) =>
                  setLanguages((a) =>
                    a.map((v, n) =>
                      n === i ? { ...v, level: e.target.value } : v,
                    ),
                  )
                }
              >
                {["Родной", "A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                  <option key={l} value={l}>
                    {tr(l)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={st.textButton}
              onClick={() => setLanguages((a) => a.filter((_, n) => n !== i))}
            >
              {tr("Убрать язык")}
            </button>
          </div>
        ))}
        {languages.length < 8 && (
          <button
            type="button"
            className={st.textButton}
            onClick={() =>
              setLanguages((a) => [...a, { language: "", level: "Родной" }])
            }
          >
            {tr("Добавить язык")}
          </button>
        )}
        <small>
          {tr(
            "Языки, на которых вы ведёте конкретные занятия, указываются в направлениях.",
          )}
        </small>
      </details>
      <details className={st.qualificationGroup}>
        <summary>
          <span>
            {tr("Подробнее о занятиях")}
            <small>{tr("Ваш подход и аудитория")}</small>
          </span>
        </summary>
        <label className={st.fields}>
          {tr("Ваш подход")}
          <textarea
            name="teaching_approach"
            rows={3}
            maxLength={1500}
            defaultValue={tutor?.teaching_approach}
          />
        </label>
        <label className={st.fields}>
          {tr("С кем вы работаете")}
          <input
            name="audience"
            maxLength={300}
            defaultValue={tutor?.audience}
            placeholder={tr("Например, 9–11 классы, начинающие, взрослые")}
          />
        </label>
        <label className={st.fields}>
          {tr("Данные и ссылки для модератора")}
          <textarea
            name="verification_links"
            maxLength={1500}
            rows={3}
            defaultValue={tutor?.verification_links}
            placeholder={tr(
              "Сайт, публичная страница или ссылка на подтверждение квалификации",
            )}
          />
          <small>
            {tr(
              "Не публикуются. Укажите, как можно проверить вашу анкету. Не отправляйте паспортные данные.",
            )}
          </small>
        </label>
      </details>
    </div>
  );
}
