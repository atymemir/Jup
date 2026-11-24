"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { DraftFields } from "../authoring/DraftFields";
import { useState } from "react";
import {
  FB_SUBJECTS,
  FB_EXAMS,
  FB_LANGUAGES,
  money,
  type Tutor,
} from "../lib/findbuddy";
import { type Offering, type Member } from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
import st from "./platform.module.css";
export function Offerings({
  offerings,
  members,
  refresh,
}: {
  offerings: Offering[];
  members?: Member[];
  refresh: () => Promise<void>;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const [editing, setEditing] = useState<Offering | "new" | null>(null);
  const [format, setFormat] = useState("online");
  const [subject, setSubject] = useState<string>(FB_SUBJECTS[0]);
  const [exam, setExam] = useState<string>(FB_EXAMS[0]);
  const { run, busy, status } = usePlatformAction(refresh);
  const current = editing && editing !== "new" ? editing : null;
  return (
    <section className={st.stack}>
      <header className={st.sectionHead}>
        <div>
          <p className={st.eyebrow}>{tr("Ваши занятия")}</p>
          <h1>{tr("Направления преподавания")}</h1>
          <p>
            {tr(
              "У каждого направления свои предмет, экзамен, языки и цена. Расписание выбирает именно эти условия.",
            )}
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing("new");
            setSubject(FB_SUBJECTS[0]);
            setExam(FB_EXAMS[0]);
            setFormat("online");
          }}
        >
          {tr("Добавить направление")}
        </button>
      </header>
      {editing && (
        <form
          className={st.editor}
          key={typeof editing === "string" ? editing : editing.id}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await run("offering_save", {
              ...Object.fromEntries(f),
              id: current?.id ?? "",
              languages: f.getAll("languages"),
              price: Number(f.get("price")),
              active: f.get("active") === "on",
            });
            if (result) setEditing(null);
          }}
        >
          <fieldset disabled={busy} className={st.fields}>
            <h2>
              {tr(
                current ? tr("Изменить направление") : tr("Новое направление"),
              )}
            </h2>
            {members && (
              <label>
                {tr("Преподаватель команды")}
                <select
                  required
                  name="teacher_id"
                  disabled={!!current}
                  defaultValue={current?.teacher_id ?? ""}
                >
                  <option value="">{tr("Выберите преподавателя")}</option>
                  {members
                    .filter((m) => m.state === "active")
                    .map((m) => (
                      <option key={m.teacher_id} value={m.teacher_id}>
                        {m.name}
                        {tr(
                          m.verification !== "verified"
                            ? tr(" · на проверке")
                            : "",
                        )}
                      </option>
                    ))}
                </select>
                {current && (
                  <input
                    type="hidden"
                    name="teacher_id"
                    value={current.teacher_id}
                  />
                )}
                {current && (
                  <small>
                    {tr(
                      "Для другого преподавателя создайте отдельное направление.",
                    )}
                  </small>
                )}
              </label>
            )}
            <div className={st.formGrid}>
              <label>
                {tr("Предмет")}
                <select
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {FB_SUBJECTS.map((x) => (
                    <option key={x} value={x}>
                      {tr(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Экзамен")}
                <select
                  name="exam"
                  value={exam}
                  onChange={(e) => setExam(e.target.value)}
                >
                  {FB_EXAMS.map((x) => (
                    <option key={x} value={x}>
                      {tr(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Формат")}
                <select
                  name="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="online">{tr("Онлайн")}</option>
                  <option value="in_person">{tr("Очно")}</option>
                </select>
              </label>
              {format === "in_person" && (
                <label>
                  {tr("Город")}
                  <input
                    required
                    name="city"
                    maxLength={80}
                    defaultValue={current?.city}
                  />
                </label>
              )}
              <label>
                {tr("Цена за 60 минут, ₸")}
                <input
                  required
                  name="price"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  defaultValue={current?.price ?? 3000}
                />
                <small>
                  {tr("0 — бесплатно. Платное занятие — от 500 ₸.")}
                </small>
              </label>
            </div>
            <div>
              <p>{tr("Языки преподавания")}</p>
              <div className={st.checks}>
                {FB_LANGUAGES.map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      name="languages"
                      value={x}
                      defaultChecked={
                        current
                          ? current.languages.includes(x)
                          : x === "Русский"
                      }
                    />
                    {tr(x)}
                  </label>
                ))}
              </div>
            </div>
            <DraftFields
              kind="offering"
              subject={subject}
              exam={exam}
              initialTitle={current?.title}
              initialBody={current?.description}
              disabled={busy}
            />
            <label className={st.check}>
              <input
                type="checkbox"
                name="active"
                defaultChecked={current?.active ?? true}
              />
              {tr("Доступно для новых занятий")}
            </label>
            <div className={st.actions}>
              <button className="primary">{tr("Сохранить направление")}</button>
              <button
                type="button"
                className={st.textButton}
                onClick={() => setEditing(null)}
              >
                {tr("Отмена")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {status}
      {!offerings.length && !editing && (
        <div className={st.empty}>
          <h2>{tr("С чего начнём?")}</h2>
          <p>
            {tr(
              "Добавьте предмет и условия занятий. После проверки анкеты можно будет опубликовать свободное время.",
            )}
          </p>
        </div>
      )}
      <div className={st.list}>
        {offerings.map((o) => (
          <article key={o.id} className={st.listRow}>
            <div>
              <strong>{o.title}</strong>
              <p>
                {tr(o.subject)} · {tr(o.exam)} · {tr(o.languages.join(", "))} ·
                {tr(" ")}
                {tr(o.format === "online" ? tr("Онлайн") : o.city)}
              </p>
              <small>
                {tr(o.active ? tr("Активно") : tr("Скрыто для новых занятий"))}
              </small>
            </div>
            <div>
              <strong>
                {tr(o.price === 0 ? tr("Бесплатно") : money(o.price, uiLocale))}
              </strong>
              <button
                className={st.textButton}
                onClick={() => {
                  setEditing(o);
                  setSubject(o.subject);
                  setExam(o.exam);
                  setFormat(o.format);
                }}
              >
                {tr("Редактировать")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
