"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TutorPhoto } from "../profiles/TutorProfile";
import { lessonDate, type Tutor } from "../lib/findbuddy";
import {
  statusLabels,
  type PlatformDashboard,
  type Organization,
} from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
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
  const [selected, setSelected] = useState<{
    kind: "teacher" | "organization";
    profile: Tutor | Organization;
  } | null>(null);
  if (panel === "staff")
    return (
      <section className={st.stack}>
        <h1>{tr("Владелец и модерация")}</h1>
        <p>{tr("Проверкой анкет и обращений управляет владелец платформы.")}</p>
        <div className={st.list}>
          {data.staff?.map((staff) => (
            <div className={st.listRow} key={staff.id}>
              <div>
                <strong>{staff.email}</strong>
                <p>{tr("Владелец · модератор")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
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
  const teachers = (data.teacher_queue ?? []).filter(
    (t) => filter === "all" || t.verification === filter,
  );
  const orgs = (data.organization_queue ?? []).filter(
    (g) => filter === "all" || g.status === filter,
  );
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
        <p>
          {tr(
            "Сверьте данные и ссылки перед решением. Одного описания анкеты недостаточно для подтверждения личности или центра.",
          )}
        </p>
      </header>
      <div className={st.tabs}>
        {[
          ["pending", "На проверке"],
          ["rejected", "Доработка"],
          ["verified", "Проверенные"],
          ["all", "Все"],
        ].map(([k, l]) => (
          <button
            key={k}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {tr(l)}
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
              <h2>{tr("Очередь разобрана")}</h2>
              <p>
                {tr(
                  "Новые заявки появятся после отправки анкеты преподавателем или центром.",
                )}
              </p>
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
            <ReviewPhoto id={selected.profile.id} />
          )}
          <h2>
            {selected.kind === "teacher"
              ? (selected.profile as Tutor).display_name
              : (selected.profile as Organization).name}
          </h2>
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
            <fieldset className={st.fields} disabled={busy}>
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
  const [photo, setPhoto] = useState("");
  useEffect(() => {
    let live = true;
    void api<{ photo: string | null }>("", "platform", {
      action: "review_detail",
      id,
    })
      .then((r) => {
        if (live) setPhoto(r.photo ?? "");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return photo ? (
    <TutorPhoto source={"data:image/jpeg;base64," + photo.replace(/\s/g, "")} />
  ) : null;
}
