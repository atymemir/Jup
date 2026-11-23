"use client";
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
  const [editing, setEditing] = useState<Offering | "new" | null>(null);
  const [format, setFormat] = useState("online");
  const { run, busy, status } = usePlatformAction(refresh);
  const current = editing && editing !== "new" ? editing : null;
  return (
    <section className={st.stack}>
      <header className={st.sectionHead}>
        <div>
          <p className={st.eyebrow}>Ваши занятия</p>
          <h1>Направления преподавания</h1>
          <p>
            У каждого направления свои предмет, экзамен, языки и цена.
            Расписание выбирает именно эти условия.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing("new");
            setFormat("online");
          }}
        >
          Добавить направление
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
            <h2>{current ? "Изменить направление" : "Новое направление"}</h2>
            <label>
              Название
              <input
                required
                name="title"
                minLength={5}
                maxLength={120}
                defaultValue={current?.title}
                placeholder="Математика · подготовка к ЕНТ"
              />
            </label>
            {members && (
              <label>
                Преподаватель команды
                <select
                  required
                  name="teacher_id"
                  disabled={!!current}
                  defaultValue={current?.teacher_id ?? ""}
                >
                  <option value="">Выберите преподавателя</option>
                  {members
                    .filter((m) => m.state === "active")
                    .map((m) => (
                      <option key={m.teacher_id} value={m.teacher_id}>
                        {m.name}
                        {m.verification !== "verified" ? " · на проверке" : ""}
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
                    Для другого преподавателя создайте отдельное направление.
                  </small>
                )}
              </label>
            )}
            <div className={st.formGrid}>
              <label>
                Предмет
                <select name="subject" defaultValue={current?.subject}>
                  {FB_SUBJECTS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Экзамен
                <select name="exam" defaultValue={current?.exam}>
                  {FB_EXAMS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Формат
                <select
                  name="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="online">Онлайн</option>
                  <option value="in_person">Очно</option>
                </select>
              </label>
              {format === "in_person" && (
                <label>
                  Город
                  <input
                    required
                    name="city"
                    maxLength={80}
                    defaultValue={current?.city}
                  />
                </label>
              )}
              <label>
                Цена за 60 минут, ₸
                <input
                  required
                  name="price"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  defaultValue={current?.price ?? 3000}
                />
                <small>0 — бесплатно. Платное занятие — от 500 ₸.</small>
              </label>
            </div>
            <div>
              <p>Языки преподавания</p>
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
                    {x}
                  </label>
                ))}
              </div>
            </div>
            <label>
              О занятиях
              <textarea
                name="description"
                rows={3}
                maxLength={1500}
                defaultValue={current?.description}
              />
            </label>
            <label className={st.check}>
              <input
                type="checkbox"
                name="active"
                defaultChecked={current?.active ?? true}
              />
              Доступно для новых занятий
            </label>
            <div className={st.actions}>
              <button className="primary">Сохранить направление</button>
              <button
                type="button"
                className={st.textButton}
                onClick={() => setEditing(null)}
              >
                Отмена
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {status}
      {!offerings.length && !editing && (
        <div className={st.empty}>
          <h2>С чего начнём?</h2>
          <p>
            Добавьте предмет и условия занятий. После проверки анкеты можно
            будет опубликовать свободное время.
          </p>
        </div>
      )}
      <div className={st.list}>
        {offerings.map((o) => (
          <article key={o.id} className={st.listRow}>
            <div>
              <strong>{o.title}</strong>
              <p>
                {o.subject} · {o.exam} · {o.languages.join(", ")} ·{" "}
                {o.format === "online" ? "Онлайн" : o.city}
              </p>
              <small>{o.active ? "Активно" : "Скрыто для новых занятий"}</small>
            </div>
            <div>
              <strong>{o.price === 0 ? "Бесплатно" : money(o.price)}</strong>
              <button
                className={st.textButton}
                onClick={() => {
                  setEditing(o);
                  setFormat(o.format);
                }}
              >
                Редактировать
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
