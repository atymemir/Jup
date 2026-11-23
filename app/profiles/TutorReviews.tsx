"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
    <section className={st.info} aria-label="Отзывы об уроках">
      <h2>Отзывы об уроках</h2>
      {!!count && rating != null && (
        <p className={st.rating}>
          <Icon name="star" size={17} />
          <strong>{rating.toLocaleString("ru-KZ")}</strong>
          <span>· оценок {count}</span>
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
            {mine ? "Изменить свой отзыв" : "Оценить прошедший урок"}
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
              aria-label="Оценка от 1 до 5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  aria-label={n + " из 5"}
                  aria-pressed={score === n}
                  data-filled={n <= score}
                  onClick={() => setScore(n)}
                >
                  <Icon name="star" size={23} />
                </button>
              ))}
            </div>
            <label className={st.field}>
              Что помогло вам на занятии?
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
                Опубликовать отзыв
              </button>
              <button
                type="button"
                className={st.link}
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Отмена
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
                  Удалить отзыв
                </button>
              )}
            </div>
          </form>
        ))}
      {error && (
        <p className={st.error} role="alert">
          {error}
        </p>
      )}
      {feedback?.length === 0 && <p className={st.muted}>Отзывов пока нет.</p>}
      {feedback?.map((r, i) => (
        <article className={st.review} key={r.updated_at + i}>
          <strong>Ученик findbuddy</strong>
          <span>
            {r.score} из 5 ·{" "}
            {new Date(r.updated_at).toLocaleDateString("ru-KZ", {
              timeZone: "Asia/Almaty",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {r.body && <p>{r.body}</p>}
        </article>
      ))}
    </section>
  );
}
