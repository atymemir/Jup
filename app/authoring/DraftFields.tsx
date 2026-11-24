"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

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
  initiallyOpen = false,
}: {
  kind: DraftKind;
  subject: string;
  exam: string;
  initialTitle?: string;
  initialBody?: string;
  initialPlan?: string;
  disabled?: boolean;
  initiallyOpen?: boolean;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

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
    locale: string;
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
    owner = useRef({ subject, exam, locale: uiLocale });
  useEffect(() => {
    owner.current = { subject, exam, locale: uiLocale };
  }, [subject, exam, uiLocale]);
  const topics = topicsFor(subject, exam);
  const selected =
    selection.subject === subject && selection.exam === exam
      ? selection.topics
      : [];
  const currentDraft =
    draft?.subject === subject &&
    draft?.exam === exam &&
    draft?.locale === uiLocale
      ? draft
      : null;
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
    const input = {
      kind,
      subject,
      exam,
      topics: selected,
      notes,
      locale: uiLocale,
    };
    if (!ai) {
      setDraft({
        value: makeTemplate(input, tr),
        locale: uiLocale,
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
      if (
        owner.current.subject === subject &&
        owner.current.exam === exam &&
        owner.current.locale === uiLocale
      )
        setDraft({
          value: result.draft,
          source: "ai",
          subject,
          exam,
          locale: uiLocale,
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось собрать черновик.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="draftFields">
      {!title.trim() && !body.trim() && subject && (
        <button
          type="button"
          className="secondary draftQuickFill"
          disabled={disabled || busy}
          onClick={() => {
            const next = makeTemplate(
              {
                kind,
                subject,
                exam,
                topics: selected,
                notes,
                locale: uiLocale,
              },
              tr,
            );
            setPrevious({ title, body, lessonPlan: plan });
            setTitle(next.title);
            setBody(next.body);
            setPlan(next.lessonPlan);
            setApplied(true);
            if (details.current) details.current.open = false;
          }}
        >
          <Icon name="wand" size={18} />
          {tr("Заполнить основу")}
        </button>
      )}
      <details
        ref={details}
        className="draftAssistant"
        open={initiallyOpen || undefined}
      >
        <summary>
          <Icon name="wand" size={19} />
          <span>
            {tr("Заполнить быстрее")}
            <small>{tr("Темы, заметки и готовый черновик")}</small>
          </span>
        </summary>
        <div className="draftAssistantBody">
          <div className="draftContext">
            {tr(subject || tr("Сначала выберите предмет"))}
            {tr(exam && ` · ${exam}`)}
          </div>
          <div className="topicHeading">
            <strong>{tr("Темы")}</strong>
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
              {tr(
                selected.length === topics.length
                  ? tr("Снять выбор")
                  : tr("Выбрать все"),
              )}
            </button>
          </div>
          <div
            className="topicChips"
            role="group"
            aria-label={tr("Темы занятия")}
          >
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
                {tr(topic)}
              </button>
            ))}
          </div>
          <label>
            {tr("Пара слов своими словами")}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1200}
              rows={3}
              disabled={disabled || busy}
              placeholder={tr(
                kind === "profile"
                  ? tr("С кем работаете, что объясняете и как ведёте уроки")
                  : tr("Для кого урок и что хотите разобрать"),
              )}
            />
          </label>
          <div className="draftButtons">
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy || !topics.length}
              onClick={() => void generate()}
            >
              {tr("Собрать по темам")}
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
                {tr(busy ? tr("Готовим черновик…") : tr("Заполнить с ИИ"))}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="draftError">
              {tr(error)}
            </p>
          )}
          {currentDraft && (
            <div className="draftPreview">
              <div className="draftPreviewTop">
                <strong>
                  {tr(
                    currentDraft.source === "ai"
                      ? tr("Черновик ИИ")
                      : tr("Черновик по темам"),
                  )}
                </strong>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  {tr("Закрыть")}
                </button>
              </div>
              <h4>{currentDraft.value.title}</h4>
              <FormattedText value={currentDraft.value.body} />
              {kind === "profile" && (
                <>
                  <h4>{tr("Первый урок")}</h4>
                  <FormattedText value={currentDraft.value.lessonPlan} />
                </>
              )}
              <p>
                {tr(
                  "Проверьте текст. Подстановка заменит поля ниже; публикация — отдельно.",
                )}
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
                {tr("Подставить в форму")}
              </button>
            </div>
          )}
        </div>
      </details>
      {applied && (
        <div className="draftApplied" role="status">
          {tr("Черновик подставлен.")}
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
            {tr("Вернуть мой текст")}
          </button>
        </div>
      )}
      <label className="draftTitle">
        {tr(
          kind === "profile"
            ? tr("Заголовок анкеты")
            : kind === "offering"
              ? tr("Название направления")
              : tr("Тема урока"),
        )}
        <input
          ref={titleField}
          name={kind === "profile" ? "headline" : "title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          required
          minLength={5}
          maxLength={120}
          placeholder={tr(
            subject
              ? `${subject} · ${topics[0] ?? tr("первый урок")}`
              : tr("Короткое название"),
          )}
        />
      </label>
      <TextEditor
        label={tr(kind === "profile" ? tr("О себе") : tr("Описание и план"))}
        name={kind === "profile" ? "bio" : "description"}
        value={body}
        onChange={setBody}
        required={kind !== "offering"}
        minLength={kind !== "offering" ? 20 : undefined}
        maxLength={1500}
        disabled={disabled}
        placeholder={tr("Кому подойдёт и что разберёте")}
      />
      {kind === "profile" && (
        <TextEditor
          label={tr("Первый урок")}
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
