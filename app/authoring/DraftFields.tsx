"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeTemplate,
  topicsFor,
  type DraftKind,
  type TextDraft,
} from "../lib/authoring";
import { fetchJson } from "../lib/http";
import { getSupabase } from "../lib/supabase";
import { TextEditor } from "./TextEditor";
import { FormattedText } from "../ui/FormattedText";
import { Icon } from "../ui/Icon";
export function DraftFields({
  kind,
  subject,
  exam,
  initialTitle = "",
  initialBody = "",
  initialPlan = "",
  disabled = false,
}: {
  kind: DraftKind;
  subject: string;
  exam: string;
  initialTitle?: string;
  initialBody?: string;
  initialPlan?: string;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle),
    [body, setBody] = useState(initialBody),
    [plan, setPlan] = useState(initialPlan);
  const [notes, setNotes] = useState(""),
    [selection, setSelection] = useState<{
      subject: string;
      exam: string;
      topics: string[];
    }>({ subject, exam, topics: [] });
  const [draft, setDraft] = useState<{
    value: TextDraft;
    source: "template" | "ai";
    subject: string;
    exam: string;
  } | null>(null);
  const [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [previous, setPrevious] = useState<TextDraft | null>(null),
    [applied, setApplied] = useState(false);
  const details = useRef<HTMLDetailsElement>(null),
    titleField = useRef<HTMLInputElement>(null);
  const lock = useRef(false),
    owner = useRef({ subject, exam });
  useEffect(() => {
    owner.current = { subject, exam };
  }, [subject, exam]);
  const topics = topicsFor(subject, exam);
  const selected =
    selection.subject === subject && selection.exam === exam
      ? selection.topics
      : [];
  const currentDraft =
    draft?.subject === subject && draft?.exam === exam ? draft : null;
  useEffect(() => {
    let active = true;
    void fetchJson<{ available: boolean }>("/findbuddy/api/draft")
      .then((r) => {
        if (active) setAvailable(r.available);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function generate(ai = false) {
    if (disabled || lock.current) return;
    setError("");
    setApplied(false);
    const input = { kind, subject, exam, topics: selected, notes };
    if (!ai) {
      setDraft({
        value: makeTemplate(input),
        source: "template",
        subject,
        exam,
      });
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const token = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? (await getSupabase().auth.getSession()).data.session?.access_token
        : undefined;
      const result = await fetchJson<{ draft: TextDraft }>(
        "/findbuddy/api/draft",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(input),
        },
      );
      if (owner.current.subject === subject && owner.current.exam === exam)
        setDraft({ value: result.draft, source: "ai", subject, exam });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось собрать черновик.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="draftFields">
      <details ref={details} className="draftAssistant">
        <summary>
          <Icon name="wand" size={19} />
          <span>
            Заполнить быстрее<small>Темы, заметки и готовый черновик</small>
          </span>
        </summary>
        <div className="draftAssistantBody">
          <div className="draftContext">
            {subject || "Сначала выберите предмет"}
            {exam && ` · ${exam}`}
          </div>
          <div className="topicHeading">
            <strong>Темы</strong>
            <button
              type="button"
              disabled={disabled || busy || !topics.length}
              onClick={() =>
                setSelection({
                  subject,
                  exam,
                  topics: selected.length === topics.length ? [] : [...topics],
                })
              }
            >
              {selected.length === topics.length
                ? "Снять выбор"
                : "Выбрать все"}
            </button>
          </div>
          <div className="topicChips" role="group" aria-label="Темы занятия">
            {topics.map((topic) => (
              <button
                type="button"
                key={topic}
                disabled={disabled || busy}
                aria-pressed={selected.includes(topic)}
                onClick={() =>
                  setSelection({
                    subject,
                    exam,
                    topics: selected.includes(topic)
                      ? selected.filter((t) => t !== topic)
                      : [...selected, topic],
                  })
                }
              >
                {topic}
              </button>
            ))}
          </div>
          <label>
            Пара слов своими словами
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1200}
              rows={3}
              disabled={disabled || busy}
              placeholder={
                kind === "profile"
                  ? "С кем работаете, что объясняете и как ведёте уроки"
                  : "Для кого урок и что хотите разобрать"
              }
            />
          </label>
          <div className="draftButtons">
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy || !topics.length}
              onClick={() => void generate()}
            >
              Собрать по темам
            </button>
            {available && (
              <button
                type="button"
                className="primary"
                disabled={
                  disabled || busy || !topics.length || notes.trim().length < 5
                }
                onClick={() => void generate(true)}
              >
                {busy ? "Готовим черновик…" : "Заполнить с ИИ"}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="draftError">
              {error}
            </p>
          )}
          {currentDraft && (
            <div className="draftPreview">
              <div className="draftPreviewTop">
                <strong>
                  {currentDraft.source === "ai"
                    ? "Черновик ИИ"
                    : "Черновик по темам"}
                </strong>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Закрыть
                </button>
              </div>
              <h4>{currentDraft.value.title}</h4>
              <FormattedText value={currentDraft.value.body} />
              {kind === "profile" && (
                <>
                  <h4>Первый урок</h4>
                  <FormattedText value={currentDraft.value.lessonPlan} />
                </>
              )}
              <p>
                Проверьте текст. Подстановка заменит поля ниже; публикация —
                отдельно.
              </p>
              <button
                type="button"
                className="primary"
                disabled={disabled || busy}
                onClick={() => {
                  setPrevious({ title, body, lessonPlan: plan });
                  setTitle(currentDraft.value.title);
                  setBody(currentDraft.value.body);
                  setPlan(currentDraft.value.lessonPlan);
                  setDraft(null);
                  setApplied(true);
                  if (details.current) details.current.open = false;
                  requestAnimationFrame(() => titleField.current?.focus());
                }}
              >
                Подставить в форму
              </button>
            </div>
          )}
        </div>
      </details>
      {applied && (
        <div className="draftApplied" role="status">
          Черновик подставлен.
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (previous) {
                setTitle(previous.title);
                setBody(previous.body);
                setPlan(previous.lessonPlan);
              }
              setApplied(false);
            }}
          >
            Вернуть мой текст
          </button>
        </div>
      )}
      <label className="draftTitle">
        {kind === "profile"
          ? "Заголовок анкеты"
          : kind === "offering"
            ? "Название направления"
            : "Тема урока"}
        <input
          ref={titleField}
          name={kind === "profile" ? "headline" : "title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          required
          minLength={5}
          maxLength={120}
          placeholder={
            subject
              ? `${subject} · ${topics[0] ?? "первый урок"}`
              : "Короткое название"
          }
        />
      </label>
      <TextEditor
        label={kind === "profile" ? "О себе" : "Описание и план"}
        name={kind === "profile" ? "bio" : "description"}
        value={body}
        onChange={setBody}
        required={kind !== "offering"}
        minLength={kind !== "offering" ? 20 : undefined}
        maxLength={1500}
        disabled={disabled}
        placeholder="Кому подойдёт и что разберёте"
      />
      {kind === "profile" && (
        <TextEditor
          label="Первый урок"
          name="lesson_plan"
          value={plan}
          onChange={setPlan}
          maxLength={600}
          rows={3}
          disabled={disabled}
        />
      )}
    </div>
  );
}
