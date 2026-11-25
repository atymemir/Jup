"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TutorPortrait } from "../profiles/TutorProfile";
import { lessonDate, type Tutor } from "../lib/findbuddy";
import {
  statusLabels,
  type PlatformDashboard,
  type Organization,
} from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
import { filterModeration } from "../lib/moderation.mjs";
import { Icon } from "../ui/Icon";
import { LoadingState } from "../ui/LoadingState";
import st from "./platform.module.css";
export function Moderation({
  data,
  panel,
  refresh,
}: {
  data: PlatformDashboard;
  panel: string;
  refresh: () => Promise<void>;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const { run, busy, status } = usePlatformAction(refresh);
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    kind: "teacher" | "organization";
    profile: Tutor | Organization;
  } | null>(null);
  if (panel === "staff") return <StaffPanel data={data} refresh={refresh} />;
  if (panel === "audit")
    return (
      <section className={st.stack}>
        <header>
          <h1>{tr("История решений")}</h1>
          <p>
            {tr(
              "Последние 200 действий. История доступна только команде модерации.",
            )}
          </p>
        </header>
        {data.audit?.map((a) => (
          <article className={st.listRow} key={a.id}>
            <div>
              <strong>
                {tr(a.kind)} · {tr(statusLabels[a.decision] ?? a.decision)}
              </strong>
              <p>{tr(a.reason)}</p>
              <small>
                {tr(lessonDate(a.created_at, uiLocale))}
                {tr(" · Сотрудник ")}
                {tr(a.actor.slice(0, 8))}
                {tr(" · Объект ")}
                {tr(a.target?.slice(0, 8))}
              </small>
            </div>
          </article>
        ))}
        {!data.audit?.length && <p>{tr("Решений пока нет.")}</p>}
      </section>
    );
  if (panel === "reports")
    return (
      <section className={st.stack}>
        <header>
          <h1>{tr("Обращения")}</h1>
          <p>
            {tr(
              "Только сведения, которые пользователь передал в обращении. Личные чаты не открываются.",
            )}
          </p>
        </header>
        {data.reports?.map((report) => (
          <article className={st.editor} key={report.id}>
            <strong>
              {tr(
                report.kind === "teacher" ? tr("Преподаватель") : tr("Центр"),
              )}{" "}
              ·{tr(" ")}
              {tr(report.target.slice(0, 8))}
            </strong>
            <p>{tr(report.reason)}</p>
            <small>
              {tr(lessonDate(report.created_at, uiLocale))} ·{tr(" ")}
              {tr(
                report.resolved ? tr("Рассмотрено") : tr("Ждёт рассмотрения"),
              )}
            </small>
            {!report.resolved && (
              <form
                className={st.form}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run(
                    "resolve_report",
                    {
                      id: report.id,
                      reason: new FormData(e.currentTarget).get("reason"),
                    },
                    "Обращение рассмотрено.",
                  );
                }}
              >
                <label>
                  {tr("Результат рассмотрения")}
                  <input
                    name="reason"
                    required
                    minLength={5}
                    maxLength={1500}
                    disabled={busy}
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  {tr("Завершить рассмотрение")}
                </button>
              </form>
            )}
          </article>
        ))}
        {!data.reports?.length && <p>{tr("Обращений пока нет.")}</p>}
        {status}
      </section>
    );
  const teacherSource =
    panel === "organizations" ? [] : (data.teacher_queue ?? []);
  const orgSource = panel === "teachers" ? [] : (data.organization_queue ?? []);
  const teachers = filterModeration(teacherSource, filter, query) as Tutor[];
  const orgs = filterModeration(orgSource, filter, query) as Organization[];
  const total = teacherSource.length + orgSource.length;
  const current =
    selected &&
    (selected.kind === "teacher"
      ? data.teacher_queue
      : data.organization_queue
    )?.find((p) => p.id === selected.profile.id);
  const stale =
    selected &&
    (!current ||
      current.verification_revision !== selected.profile.verification_revision);
  return (
    <section className={st.stack}>
      <header>
        <p className={st.eyebrow}>{tr("Ручная проверка")}</p>
        <h1>
          {tr(
            panel === "teachers"
              ? tr("Преподаватели")
              : panel === "organizations"
                ? tr("Учебные центры")
                : tr("Очередь проверки"),
          )}
        </h1>
        <p>{tr("Анкеты, подтверждения и решения — в одном месте.")}</p>
      </header>
      <label className={st.moderationSearch}>
        <Icon name="search" size={18} />
        <span className="srOnly">{tr("Поиск по имени или названию")}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Поиск по имени или названию")}
        />
      </label>
      <div className={st.tabs}>
        {[
          ["pending", "На проверке"],
          ["rejected", "Доработка"],
          ["verified", "Проверенные"],
          ["hidden", "Скрытые"],
          ["all", "Все"],
        ].map(([k, l]) => (
          <button
            key={k}
            aria-pressed={filter === k}
            onClick={() => {
              setFilter(k);
              setSelected(null);
            }}
          >
            {tr(l)}
            <span className={st.filterCount}>
              {filterModeration([...teacherSource, ...orgSource], k).length}
            </span>
          </button>
        ))}
      </div>
      {!selected && (
        <div className={st.list}>
          {panel !== "organizations" &&
            teachers.map((t) => (
              <article className={st.listRow} key={t.id}>
                <div>
                  <strong>{t.display_name}</strong>
                  <p>{t.headline}</p>
                  <small>
                    {tr("Преподаватель · ")}
                    {tr(statusLabels[t.verification])}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => setSelected({ kind: "teacher", profile: t })}
                >
                  {tr("Открыть проверку")}
                </button>
              </article>
            ))}
          {panel !== "teachers" &&
            orgs.map((g) => (
              <article className={st.listRow} key={g.id}>
                <div>
                  <strong>{g.name}</strong>
                  <p>
                    {tr(g.city)} · {tr(g.website)}
                  </p>
                  <small>
                    {tr("Учебный центр · ")}
                    {tr(statusLabels[g.status ?? "draft"])}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    setSelected({ kind: "organization", profile: g })
                  }
                >
                  {tr("Открыть проверку")}
                </button>
              </article>
            ))}
          {!teachers.length && !orgs.length && (
            <div className={st.empty}>
              <h2>
                {tr(total ? "Нет анкет по этим условиям" : "Очередь разобрана")}
              </h2>
              <p>
                {tr(
                  total
                    ? "Измените поиск или откройте все анкеты."
                    : "Новые заявки появятся после отправки анкеты преподавателем или центром.",
                )}
              </p>
              {total > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  {tr("Показать все анкеты")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {selected && (
        <div className={st.editor}>
          <button className={st.textButton} onClick={() => setSelected(null)}>
            {tr("К списку")}
          </button>
          {selected.kind === "teacher" && (
            <ReviewPhoto
              key={
                selected.profile.id +
                ":" +
                (selected.profile.verification_revision ?? 0)
              }
              id={selected.profile.id}
            />
          )}
          <h2>
            {selected.kind === "teacher"
              ? (selected.profile as Tutor).display_name
              : (selected.profile as Organization).name}
          </h2>
          {stale && (
            <div className={st.notice} role="status">
              <p>
                {tr(
                  "Анкета изменилась. Проверьте актуальную версию перед решением.",
                )}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  current
                    ? setSelected({ ...selected, profile: current })
                    : setSelected(null)
                }
              >
                {tr("Обновить проверку")}
              </button>
            </div>
          )}
          {selected.kind === "teacher" ? (
            <>
              <p>{(selected.profile as Tutor).bio}</p>
              <h3>{tr("Образование")}</h3>
              <p>{(selected.profile as Tutor).education}</p>
              {(selected.profile as Tutor).education_entries?.map((e, i) => (
                <p key={i}>
                  {[e.institution, e.degree, e.field, e.year, e.status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ))}
              <h3>{tr("Сертификаты")}</h3>
              {(selected.profile as Tutor).certificates?.map((c, i) => (
                <p key={i}>
                  {[c.name, c.issuer, c.result, c.year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ))}
              <h3>{tr("Основания для проверки")}</h3>
              <p>
                {tr(
                  (selected.profile as Tutor).verification_links ||
                    tr(
                      "Ссылки не указаны. Запросите подтверждение до одобрения.",
                    ),
                )}
              </p>
            </>
          ) : (
            <>
              <p>{(selected.profile as Organization).description}</p>
              <p>
                {tr("Контакт представителя:")}
                {tr(" ")}
                {tr((selected.profile as Organization).contact)}
              </p>
              <p>{tr((selected.profile as Organization).website)}</p>
              <p>{tr((selected.profile as Organization).evidence)}</p>
            </>
          )}
          <form
            className={st.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await run(
                "moderate",
                {
                  id: selected.profile.id,
                  kind: selected.kind,
                  decision: f.get("decision"),
                  revision: selected.profile.verification_revision ?? 0,
                  reason: f.get("reason"),
                },
                "Решение сохранено в истории.",
              );
              if (result) setSelected(null);
            }}
          >
            <fieldset className={st.fields} disabled={busy || !!stale}>
              <label>
                {tr("Решение")}
                <select name="decision">
                  <option value="pending">{tr("Запросить уточнение")}</option>
                  <option value="verified">
                    {tr("Одобрить после проверки")}
                  </option>
                  <option value="rejected">{tr("Вернуть на доработку")}</option>
                  <option value="hidden">{tr("Скрыть публикацию")}</option>
                </select>
              </label>
              <label>
                {tr("Основание решения")}
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={1500}
                  rows={3}
                  placeholder={tr(
                    "Что проверено, источник и что требуется исправить.",
                  )}
                />
              </label>
              <button className="primary">{tr("Сохранить решение")}</button>
            </fieldset>
          </form>
        </div>
      )}
      {status}
    </section>
  );
}

function ReviewPhoto({ id }: { id: string }) {
  const { t: tr } = useJupLocale();
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void api<{ photo: string | null }>("", "platform", {
      action: "review_detail",
      id,
    })
      .then((r) => {
        if (live) setPhoto(r.photo ?? "");
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);
  if (loading) return <LoadingState compact label={tr("Загружаем фото…")} />;
  if (error)
    return (
      <p role="alert">
        {tr("Не удалось загрузить фото.")}{" "}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setError(false);
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        >
          {tr("Повторить")}
        </button>
      </p>
    );
  return photo ? (
    <TutorPortrait
      source={"data:image/jpeg;base64," + photo.replace(/\s/g, "")}
    />
  ) : (
    <p>{tr("Фото не добавлено")}</p>
  );
}

function StaffPanel({
  data,
  refresh,
}: {
  data: PlatformDashboard;
  refresh: () => Promise<void>;
}) {
  const { t: tr } = useJupLocale();
  const [loading, setLoading] = useState(false);
  return (
    <section className={st.stack}>
      <header>
        <h1>{tr("Доступ к модерации")}</h1>
        <p>
          {tr(
            "Административный доступ закреплён за подтверждёнными аккаунтами владельцев.",
          )}
        </p>
      </header>
      <div className={st.list}>
        {data.staff?.map((staff) => (
          <article className={st.listRow} key={staff.id}>
            <div>
              <strong>{staff.email}</strong>
              <p>{tr(staff.role === "owner" ? "Владелец" : "Модератор")}</p>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className="secondary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await refresh();
          } finally {
            setLoading(false);
          }
        }}
      >
        {tr(loading ? "Обновляем…" : "Обновить данные")}
      </button>
    </section>
  );
}
