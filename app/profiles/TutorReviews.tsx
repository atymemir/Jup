"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { dateFormatter } from "../lib/localeFormat.mjs";
import { api } from "../lib/api";
import { Icon } from "../ui/Icon";
import st from "./profile.module.css";
type Feedback = { score: number; body: string; updated_at: string };
export function TutorReviews({
  id,
  editable,
  count,
  rating,
  changed,
}: {
  id: string;
  editable: boolean;
  count?: number;
  rating?: number | null;
  changed: () => Promise<void>;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [mine, setMine] = useState<{ score: number; body: string } | null>(
    null,
  );
  const [score, setScore] = useState(0),
    [body, setBody] = useState("");
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const load = useCallback(
    () =>
      Promise.all([
        api<Feedback[]>("reviews/" + id),
        editable
          ? api<{ score: number; body: string } | null>("", "review", {
              action: "mine",
              tutor_id: id,
            })
          : Promise.resolve(null),
      ])
        .then(([published, personal]) => {
          setFeedback(published);
          setMine(personal);
        })
        .catch(() => {
          setError("Не удалось загрузить отзывы.");
        }),
    [id, editable],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(action: string) {
    if (lock.current || (action === "save" && !score)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("", "review", { tutor_id: id, action, score, body });
      setEditing(false);
      await Promise.all([load(), changed()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить отзыв.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section className={st.info} aria-label={tr("Отзывы об уроках")}>
      <h2>{tr("Отзывы об уроках")}</h2>
      {!!count && rating != null && (
        <p className={st.rating}>
          <Icon name="star" size={17} />
          <strong>
            {tr(rating.toLocaleString(uiLocale === "en" ? "en-GB" : "ru-KZ"))}
          </strong>
          <span>
            {tr("· оценок ")}
            {count}
          </span>
        </p>
      )}
      {editable &&
        feedback &&
        (!editing ? (
          <button
            className="secondary"
            onClick={() => {
              setScore(mine?.score ?? 0);
              setBody(mine?.body ?? "");
              setEditing(true);
            }}
          >
            {tr(
              mine ? tr("Изменить свой отзыв") : tr("Оценить прошедший урок"),
            )}
          </button>
        ) : (
          <form
            className={st.form}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void submit("save");
            }}
          >
            <div
              className={st.score}
              role="group"
              aria-label={tr("Оценка от 1 до 5")}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  aria-label={tr(n + tr(" из 5"))}
                  aria-pressed={score === n}
                  data-filled={n <= score}
                  onClick={() => setScore(n)}
                >
                  <Icon name="star" size={23} />
                </button>
              ))}
            </div>
            <label className={st.field}>
              {tr("Что помогло вам на занятии?")}
              <textarea
                disabled={busy}
                rows={3}
                value={body}
                maxLength={700}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <div className={st.reviewActions}>
              <button className="primary" disabled={!score || busy}>
                {tr("Опубликовать отзыв")}
              </button>
              <button
                type="button"
                className={st.link}
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                {tr("Отмена")}
              </button>
              {mine && (
                <button
                  type="button"
                  className={st.link}
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Удалить ваш отзыв?")) void submit("remove");
                  }}
                >
                  {tr("Удалить отзыв")}
                </button>
              )}
            </div>
          </form>
        ))}
      {error && (
        <p className={st.error} role="alert">
          {tr(error)}
        </p>
      )}
      {feedback?.length === 0 && (
        <p className={st.muted}>{tr("Отзывов пока нет.")}</p>
      )}
      {feedback?.map((r, i) => (
        <article className={st.review} key={r.updated_at + i}>
          <strong>{tr("Ученик Jup edu")}</strong>
          <span>
            {r.score}
            {tr(" из 5 ·")}
            {tr(" ")}
            {tr(
              dateFormatter(uiLocale, {
                timeZone: "Asia/Almaty",
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(r.updated_at)),
            )}
          </span>
          {r.body && <p>{r.body}</p>}
        </article>
      ))}
    </section>
  );
}
