"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useRef, useState } from "react";
import { FB_CITIES, FB_EXAMS, FB_LANGUAGES, money } from "../lib/findbuddy";
import {
  stageLabels,
  studentReady,
  type StudentProfile as Profile,
} from "../lib/platform";
import {
  clearStudentDraft,
  readStudentDraft,
  studentDraftKey,
  writeStudentDraft,
} from "../lib/studentDraft";
import { ChoiceCard, SetupProgress } from "../ui/SetupControls";
import { Icon, type IconName } from "../ui/Icon";
import { usePlatformAction } from "./usePlatformAction";
import st from "./student-profile.module.css";

const goals: [string, string, IconName][] = [
  [
    "Подготовиться к экзамену",
    "Разобрать темы и уверенно подойти к сдаче",
    "teacher",
  ],
  [
    "Разобраться со сложной темой",
    "Закрыть конкретный пробел в знаниях",
    "search",
  ],
  [
    "Подтянуть оценки",
    "Понимать программу и справляться с заданиями",
    "calendar",
  ],
  ["Учиться для себя", "Освоить новое в своём темпе", "bookmark"],
];
const labels = ["Цель", "О вас", "Условия"];
export function StudentProfile({
  profile,
  refresh,
  compact = false,
  onComplete,
}: {
  profile: Profile | null | undefined;
  refresh: () => Promise<void>;
  compact?: boolean;
  onComplete?: (search: string) => void;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const draftKey = studentDraftKey(profile);
  const savedValues = {
    name: profile?.name ?? "",
    goal: profile?.goal || goals[0][0],
    stage: profile?.stage || "school",
    study_year: profile?.study_year || 11,
    exam: profile?.exam || "",
    languages: profile?.languages?.length ? profile.languages : ["Русский"],
    format: profile?.format || "any",
    city: profile?.city || "",
    budget_max: profile?.budget_max ?? null,
  };
  const [initial] = useState(() => readStudentDraft(draftKey));
  const [values, setValues] = useState(() => ({
    ...savedValues,
    ...initial,
  }));
  const [editing, setEditing] = useState(!studentReady(profile) || !!initial);
  const [step, setStep] = useState(0);
  const [custom, setCustom] = useState(
    !goals.some(([goal]) => goal === values.goal),
  );
  const [draftStatus, setDraftStatus] = useState(
    initial ? "Продолжим с вашего черновика" : "",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const { run, busy, status } = usePlatformAction(refresh);
  const update = (patch: Partial<typeof values>) => {
    const next = { ...values, ...patch };
    setValues(next);
    setDraftStatus(
      writeStudentDraft(draftKey, next)
        ? "Черновик сохранён в этой вкладке"
        : "Изменения ещё не сохранены",
    );
  };
  const move = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };
  const search = () => {
    const params = new URLSearchParams();
    if (values.exam) params.set("exam", values.exam);
    if (values.languages?.[0]) params.set("language", values.languages[0]);
    if (values.budget_max != null)
      params.set("budget", String(values.budget_max));
    if (values.format === "online") params.set("city", "Онлайн");
    if (values.format === "in_person" && values.city)
      params.set("city", values.city);
    return params.toString();
  };
  const summary = (
    <dl className={st.summaryList}>
      <div>
        <dt>{tr("Цель")}</dt>
        <dd>
          {values.goal || tr("Пока не указана")}
          {values.exam && <span>{tr(values.exam)}</span>}
        </dd>
      </div>
      <div>
        <dt>{tr("Этап обучения")}</dt>
        <dd>
          {tr(stageLabels[values.stage || "school"])}
          {tr(
            values.stage !== "adult" &&
              ` · ${values.study_year} ${values.stage === "school" ? tr("класс") : tr("курс")}`,
          )}
        </dd>
      </div>
      <div>
        <dt>{tr("Занятия")}</dt>
        <dd>
          {tr(
            values.format === "online"
              ? tr("Онлайн")
              : values.format === "in_person"
                ? values.city || tr("Очно · город не выбран")
                : tr("Онлайн или очно"),
          )}
          <span>{tr(values.languages?.join(", "))}</span>
        </dd>
      </div>
      <div>
        <dt>{tr("Бюджет за 60 минут")}</dt>
        <dd>
          {tr(
            values.budget_max == null
              ? tr("Обсудим с преподавателем")
              : values.budget_max === 0
                ? tr("Бесплатные занятия")
                : tr("До ") + money(values.budget_max, uiLocale),
          )}
        </dd>
      </div>
    </dl>
  );
  if (!editing)
    return (
      <section className={st.saved}>
        <header className={st.savedHeading}>
          <span className={st.avatar}>
            {values.name?.slice(0, 1) || <Icon name="teacher" />}
          </span>
          <div>
            <p className={st.eyebrow}>{tr("Учебный профиль")}</p>
            <h1>{values.name}</h1>
            <p>{tr("Ваша отправная точка для подходящего урока.")}</p>
          </div>
        </header>
        <div className={st.savedBody}>
          {summary}
          <div className={st.privacy}>
            <Icon name="check" size={18} />
            <p>
              {tr("Профиль сохранён в аккаунте. Он не публикуется в каталоге.")}
            </p>
          </div>
        </div>
        <div className={st.savedActions}>
          <button
            className="primary"
            onClick={() => {
              setEditing(true);
              move(0);
            }}
          >
            {tr("Изменить профиль")}
          </button>
          <a href={"/findbuddy?" + search() + "#tutors"}>
            {tr("Найти преподавателя по моим условиям")}
          </a>
        </div>
        {status}
      </section>
    );
  return (
    <section className={st.setup} data-compact={compact}>
      <div className={st.main}>
        <header className={st.heading}>
          <p className={st.eyebrow}>
            {tr(
              compact ? tr("Перед первым уроком") : tr("Ваш учебный маршрут"),
            )}
            {studentReady(profile) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  clearStudentDraft(draftKey);
                  setValues(savedValues);
                  setCustom(!goals.some(([goal]) => goal === savedValues.goal));
                  setDraftStatus("");
                  setEditing(false);
                }}
              >
                {tr("Отменить изменения")}
              </button>
            ) : (
              <span>{tr("Около 2 минут")}</span>
            )}
          </p>
          <SetupProgress
            labels={labels}
            step={step}
            onBack={busy ? undefined : move}
          />
          <h1 ref={heading} tabIndex={-1}>
            {tr(
              [
                tr("Что хотите изменить?"),
                tr("Давайте познакомимся"),
                tr("Уроки на ваших условиях"),
              ][step],
            )}
          </h1>
          <p>
            {tr(
              [
                tr(
                  "Выберите цель. Это поможет найти человека, который понимает вашу задачу.",
                ),
                tr("Преподаватель сможет подготовить занятие под ваш уровень."),
                tr(
                  "Укажите, как вам удобно учиться. Всё можно изменить позже.",
                ),
              ][step],
            )}
          </p>
        </header>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            if (step < 2) {
              move(step + 1);
              return;
            }
            const result = await run(
              "student_profile",
              {
                ...values,
                name: values.name?.trim(),
                study_year:
                  values.stage === "adult" ? "" : String(values.study_year),
                institution: profile?.institution ?? "",
                deadline: profile?.deadline ?? "",
              },
              "Учебный профиль сохранён.",
            );
            if (result) {
              clearStudentDraft(draftKey);
              setDraftStatus("");
              if (onComplete) onComplete(search());
              else setEditing(false);
            }
          }}
        >
          <fieldset className={st.fields} disabled={busy}>
            {step === 0 && (
              <>
                <fieldset className={st.group}>
                  <legend className="srOnly">{tr("Учебная цель")}</legend>
                  <div className={st.goalGrid}>
                    {goals.map(([title, description, icon]) => (
                      <ChoiceCard
                        key={title}
                        name="goal-choice"
                        value={title}
                        title={tr(title)}
                        description={tr(description)}
                        icon={icon}
                        selected={!custom && values.goal === title}
                        onChange={(goal) => {
                          setCustom(false);
                          update({ goal });
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  className={st.textButton}
                  aria-expanded={custom}
                  onClick={() => {
                    setCustom(!custom);
                    if (!custom) update({ goal: "" });
                    else update({ goal: goals[0][0] });
                  }}
                >
                  {tr(
                    custom
                      ? tr("Выбрать готовую цель")
                      : tr("У меня другая цель"),
                  )}
                </button>
                {custom && (
                  <label>
                    {tr("Ваша цель")}
                    <textarea
                      name="goal"
                      required
                      minLength={5}
                      maxLength={1000}
                      rows={3}
                      placeholder={tr(
                        "Например, разобраться с геометрией перед экзаменом",
                      )}
                      value={values.goal}
                      onChange={(e) => update({ goal: e.target.value })}
                    />
                  </label>
                )}
                <fieldset className={st.group}>
                  <legend>{tr("Готовитесь к экзамену?")}</legend>
                  <div className={st.chips}>
                    {["", ...FB_EXAMS].map((exam) => (
                      <button
                        type="button"
                        key={exam}
                        aria-pressed={values.exam === exam}
                        onClick={() => update({ exam })}
                      >
                        {tr(exam || tr("Без экзамена"))}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            {step === 1 && (
              <>
                <label>
                  {tr("Как вас называть")}
                  <input
                    name="name"
                    autoComplete="given-name"
                    required
                    minLength={2}
                    maxLength={50}
                    placeholder={tr("Ваше имя")}
                    value={values.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                  <small>
                    {tr("Так к вам будет обращаться преподаватель.")}
                  </small>
                </label>
                <fieldset className={st.group}>
                  <legend>{tr("Сейчас вы…")}</legend>
                  <div className={st.twoColumns}>
                    {Object.entries(stageLabels).map(([value, title]) => (
                      <ChoiceCard
                        key={value}
                        name="study-stage"
                        value={value}
                        title={tr(title)}
                        selected={values.stage === value}
                        onChange={(stage) =>
                          update({
                            stage,
                            study_year: stage === "school" ? 11 : 1,
                          })
                        }
                      />
                    ))}
                  </div>
                </fieldset>
                {values.stage !== "adult" && (
                  <fieldset className={st.group}>
                    <legend>
                      {tr(
                        values.stage === "school"
                          ? tr("В каком классе?")
                          : tr("На каком курсе?"),
                      )}
                    </legend>
                    <div className={st.years}>
                      {Array.from(
                        { length: values.stage === "school" ? 12 : 6 },
                        (_, i) => i + 1,
                      ).map((year) => (
                        <button
                          type="button"
                          key={year}
                          aria-pressed={values.study_year === year}
                          onClick={() => update({ study_year: year })}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <fieldset className={st.group}>
                  <legend>{tr("Где будем заниматься?")}</legend>
                  <div className={st.formats}>
                    {[
                      ["online", "Онлайн", "Из любого места", "calendar"],
                      ["in_person", "Очно", "В вашем городе", "pin"],
                      ["any", "Неважно", "Рассмотрю оба варианта", "groups"],
                    ].map(([value, title, description, icon]) => (
                      <ChoiceCard
                        key={value}
                        name="lesson-format"
                        value={value}
                        title={tr(title)}
                        description={tr(description)}
                        icon={icon as IconName}
                        selected={values.format === value}
                        onChange={(format) => update({ format })}
                      />
                    ))}
                  </div>
                </fieldset>
                {values.format === "in_person" && (
                  <label>
                    {tr("Город для очных занятий")}
                    <select
                      required
                      value={values.city}
                      onChange={(e) => update({ city: e.target.value })}
                    >
                      <option value="">{tr("Выберите город")}</option>
                      {FB_CITIES.filter((value) => value !== "Онлайн").map(
                        (value) => (
                          <option key={value} value={value}>
                            {tr(value)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                <fieldset className={st.group}>
                  <legend>{tr("На каком языке вам удобнее?")}</legend>
                  <div className={st.chips}>
                    {FB_LANGUAGES.map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={values.languages?.[0] === value}
                        onClick={() => update({ languages: [value] })}
                      >
                        {tr(value)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className={st.budget}>
                  <legend>{tr("Бюджет за урок · 60 минут")}</legend>
                  <div className={st.chips}>
                    {[null, 0, 3000, 5000, 10000].map((value) => (
                      <button
                        type="button"
                        key={String(value)}
                        aria-pressed={values.budget_max === value}
                        onClick={() => update({ budget_max: value })}
                      >
                        {tr(
                          value == null
                            ? tr("Пока не знаю")
                            : value === 0
                              ? tr("Бесплатно")
                              : tr("До ") + money(value, uiLocale),
                        )}
                      </button>
                    ))}
                  </div>
                  {values.budget_max != null && (
                    <label className={st.range}>
                      <span>
                        {tr("Ваша граница")}
                        <strong>
                          {tr(
                            values.budget_max === 0
                              ? tr("Бесплатно")
                              : money(values.budget_max, uiLocale),
                          )}
                        </strong>
                      </span>
                      <input
                        aria-label={tr("Максимальный бюджет за урок")}
                        type="range"
                        min={0}
                        max={Math.max(20000, values.budget_max)}
                        step={500}
                        value={values.budget_max}
                        onChange={(e) =>
                          update({ budget_max: Number(e.target.value) })
                        }
                      />
                      <small>
                        {tr(
                          "Это ориентир для поиска. Оплата на этом шаге не нужна.",
                        )}
                      </small>
                    </label>
                  )}
                </fieldset>
              </>
            )}
            <footer className={st.actions}>
              <div className={st.actionButtons}>
                <button className="primary">
                  {tr(
                    busy
                      ? tr("Сохраняем…")
                      : step < 2
                        ? tr("Продолжить")
                        : compact
                          ? tr("Продолжить запись")
                          : onComplete
                            ? tr("Найти преподавателя")
                            : tr("Сохранить профиль"),
                  )}
                </button>
                {step > 0 && (
                  <button
                    type="button"
                    className={st.textButton}
                    onClick={() => move(step - 1)}
                  >
                    {tr("Назад")}
                  </button>
                )}
              </div>
              <p className={st.draft} role="status">
                {tr(draftStatus || tr("Профиль не публикуется в каталоге"))}
              </p>
            </footer>
          </fieldset>
          {status}
        </form>
      </div>
      <aside className={st.summary} aria-label={tr("Ваши условия обучения")}>
        <div className={st.summaryTitle}>
          <Icon name="bookmark" size={20} />
          <span>{tr("Собираем ваш маршрут")}</span>
        </div>
        {summary}
        <div className={st.privacy}>
          <Icon name="check" size={18} />
          <p>
            {tr(
              "Имя, цель и уровень доступны вашему преподавателю после личной заявки или записи, а центру — после записи на его занятие. Дата рождения остаётся личной.",
            )}
          </p>
        </div>
      </aside>
    </section>
  );
}
