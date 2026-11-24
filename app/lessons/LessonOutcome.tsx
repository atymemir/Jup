"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useRef, useState } from "react";
import { api } from "../lib/api";
import { outcomeLabel, outcomeState } from "../lib/outcomes";
import type { LessonOutcome as Outcome } from "../lib/findbuddy";
import st from "./lessons.module.css";

export function LessonOutcome({
  id,
  teacher,
  outcome,
  refresh,
}: {
  id: string;
  teacher: boolean;
  outcome?: Outcome;
  refresh: () => Promise<void>;
}) {
  const { t: tr } = useJupLocale();

  const own = teacher ? outcome?.teacher_response : outcome?.student_response;
  const ownNote = teacher ? outcome?.teacher_note : outcome?.student_note;
  const revision =
    (teacher ? outcome?.teacher_revision : outcome?.student_revision) ?? 0;
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function save(response: "completed" | "problem", note = "") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("", "lesson_outcome", { id, response, note, revision });
      await refresh();
      setEditing(false);
      setProblem(false);
      setNotice(
        response === "problem"
          ? "Описание сохранено и видно другому участнику занятия."
          : "Ваше подтверждение сохранено.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить ответ.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={st.outcome} aria-label={tr("Результат занятия")}>
      <p className={st.muted}>{tr("После урока")}</p>
      <h3>{tr(outcomeLabel(outcome))}</h3>
      <p>
        {tr(
          outcomeState(outcome) === "confirmed"
            ? tr("Вы и второй участник подтвердили, что занятие состоялось.")
            : tr(
                "Подтвердите, что урок состоялся, или опишите проблему. Ваш ответ увидит второй участник.",
              ),
        )}
      </p>
      {outcome?.teacher_note && (
        <p>
          <strong>{tr("Преподаватель:")}</strong> {tr(outcome.teacher_note)}
        </p>
      )}
      {outcome?.student_note && (
        <p>
          <strong>{tr("Ученик:")}</strong> {tr(outcome.student_note)}
        </p>
      )}
      {!own || own === "pending" || editing ? (
        <>
          {!problem ? (
            <div className={st.outcomeActions}>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save("completed")}
              >
                {tr(busy ? tr("Сохраняем…") : tr("Занятие состоялось"))}
              </button>
              <button
                className={st.back}
                disabled={busy}
                onClick={() => setProblem(true)}
              >
                {tr("Сообщить о проблеме")}
              </button>
            </div>
          ) : (
            <form
              className={st.form}
              onSubmit={(e) => {
                e.preventDefault();
                const note = String(
                  new FormData(e.currentTarget).get("note") ?? "",
                );
                void save("problem", note);
              }}
            >
              <label className={st.field}>
                {tr("Что случилось на занятии?")}
                <textarea
                  name="note"
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                  defaultValue={ownNote ?? ""}
                  placeholder={tr(
                    "Например, не удалось встретиться в назначенное время.",
                  )}
                />
              </label>
              <small>
                {tr(
                  "Описание доступно только вам и второму участнику. Оно не публикуется в отзывах.",
                )}
              </small>
              <div className={st.outcomeActions}>
                <button className="primary" disabled={busy}>
                  {tr(busy ? tr("Сохраняем…") : tr("Сохранить описание"))}
                </button>
                <button
                  type="button"
                  className={st.back}
                  disabled={busy}
                  onClick={() => setProblem(false)}
                >
                  {tr("Назад")}
                </button>
              </div>
            </form>
          )}
          {editing && (
            <button
              className={st.back}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setProblem(false);
              }}
            >
              {tr("Отмена изменения")}
            </button>
          )}
        </>
      ) : (
        <button
          className={st.back}
          onClick={() => {
            setEditing(true);
            setProblem(own === "problem");
          }}
        >
          {tr("Изменить свой ответ")}
        </button>
      )}
      {error && (
        <p className={st.error} role="alert">
          {tr(error)}
        </p>
      )}
      {notice && (
        <p className={st.status} role="status">
          {tr(notice)}
        </p>
      )}
      <small>
        {tr(
          "Подтверждение проведения не подтверждает оплату и не списывает деньги.",
        )}
      </small>
    </section>
  );
}
