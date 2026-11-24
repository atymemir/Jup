"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { lessonDate, money, kazakhstanDate } from "../lib/findbuddy";
import {
  statusLabels,
  stageLabels,
  type PlatformDashboard,
} from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
import { Offerings } from "./Offerings";
import { OrganizationChat } from "./OrganizationChat";
import { ChoiceCard } from "../ui/SetupControls";
import { Icon, type IconName } from "../ui/Icon";
import st from "./platform.module.css";
export function OrganizationDesk({
  data,
  panel,
  refresh,
}: {
  data: PlatformDashboard;
  panel: string;
  refresh: () => Promise<void>;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const g = data.organization;
  const [format, setFormat] = useState(g?.format ?? "online");
  const [logoBusy, setLogoBusy] = useState(false);
  const { run, busy, status } = usePlatformAction(refresh);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [offering, setOffering] = useState("");
  const selected =
    data.offerings.find((o) => o.id === offering) ?? data.offerings[0];
  if (panel === "offerings")
    return (
      <Offerings
        offerings={data.offerings}
        members={data.members}
        refresh={refresh}
      />
    );
  if (panel === "messages")
    return <OrganizationChat data={data} refresh={refresh} />;
  if (panel === "page" || !g)
    return (
      <section className={st.stack}>
        <header>
          <p className={st.eyebrow}>{tr("Публичная страница центра")}</p>
          <h1>
            {tr(
              g
                ? tr("Расскажите о вашем центре")
                : tr("Знакомство с учебным центром"),
            )}
          </h1>
          <p>
            {tr(
              "Сохраните страницу, пригласите команду и отправьте данные на ручную проверку.",
            )}
          </p>
        </header>
        {g && (
          <p className={st.notice}>
            {tr(statusLabels[g.status ?? "draft"])}
            {tr(g.review_note ? " · " + g.review_note : "")}
          </p>
        )}
        <form
          className={st.form + " " + st.organizationForm}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || logoBusy) return;
            const f = new FormData(e.currentTarget);
            const submit =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "submit";
            await run("organization_save", {
              ...Object.fromEntries(f),
              submit,
            });
          }}
        >
          <fieldset disabled={busy} className={st.fields}>
            <section className={st.formSection}>
              <header>
                <span>
                  <Icon name="teacher" size={21} />
                </span>
                <div>
                  <h2>{tr("Для учеников")}</h2>
                  <p>{tr("Так будет выглядеть знакомство с вашим центром.")}</p>
                </div>
              </header>
              <label>
                {tr("Название")}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={g?.name}
                  placeholder={tr("Название вашего центра")}
                />
              </label>
              <label>
                {tr("О центре")}
                <textarea
                  name="description"
                  rows={4}
                  maxLength={2000}
                  defaultValue={g?.description}
                  placeholder={tr(
                    "Кому помогаете, какие направления ведёте и что важно знать о ваших занятиях",
                  )}
                />
              </label>
              <fieldset className={st.formatChoices}>
                <legend>{tr("Как проходят занятия?")}</legend>
                {[
                  ["online", "Онлайн", "Из любого места", "calendar"],
                  ["in_person", "Очно", "В вашем центре", "pin"],
                  ["both", "Оба формата", "Онлайн и в центре", "groups"],
                ].map(([value, title, description, icon]) => (
                  <ChoiceCard
                    key={value}
                    name="format"
                    value={value}
                    title={tr(title)}
                    description={tr(description)}
                    icon={icon as IconName}
                    selected={format === value}
                    onChange={setFormat}
                  />
                ))}
              </fieldset>
              <div className={st.formGrid}>
                <label>
                  {tr("Город")}
                  <input
                    name="city"
                    maxLength={80}
                    defaultValue={g?.city}
                    placeholder={tr("Например, Алматы")}
                  />
                </label>
                <label>
                  {tr("Сайт · необязательно")}
                  <input
                    type="url"
                    name="website"
                    placeholder="https://"
                    defaultValue={g?.website}
                  />
                </label>
              </div>
              <LogoInput current={g?.logo ?? ""} onProcessing={setLogoBusy} />
            </section>
            <section className={st.formSection}>
              <header>
                <span>
                  <Icon name="check" size={21} />
                </span>
                <div>
                  <h2>{tr("Для проверки")}</h2>
                  <p>{tr("Эти сведения видны только вам и модератору.")}</p>
                </div>
              </header>
              <label>
                {tr("Контакт для модератора")}
                <input
                  name="contact"
                  maxLength={300}
                  defaultValue={g?.contact}
                  placeholder={tr("Рабочая почта или телефон представителя")}
                />
              </label>
              <label>
                {tr("Как подтвердить центр")}
                <textarea
                  name="evidence"
                  maxLength={1500}
                  rows={3}
                  defaultValue={g?.evidence}
                  placeholder={tr(
                    "Ссылки на официальный сайт, публичную страницу, сведения о представителе.",
                  )}
                />
                <small>
                  {tr(
                    "Контакт и сведения для проверки видны только вам и модераторам. Документы не загружаются.",
                  )}
                </small>
              </label>
            </section>
            <div className={st.actions}>
              <button className="primary" value="submit" disabled={logoBusy}>
                {tr(
                  busy
                    ? tr("Сохраняем…")
                    : logoBusy
                      ? tr("Подготавливаем логотип…")
                      : tr("Отправить на проверку"),
                )}
              </button>
              <button className="secondary" value="draft" disabled={logoBusy}>
                {tr("Сохранить черновик")}
              </button>
            </div>
          </fieldset>
          {status}
        </form>
      </section>
    );
  if (panel === "team")
    return (
      <section className={st.stack}>
        <header>
          <p className={st.eyebrow}>{g.name}</p>
          <h1>{tr("Команда преподавателей")}</h1>
          <p>
            {tr(
              "У каждого преподавателя свой аккаунт. Приглашение даёт центру право управлять его занятиями от имени центра.",
            )}
          </p>
        </header>
        <form
          className={st.form}
          onSubmit={async (e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email"));
            const result = await run<{ token: string }>(
              "invite_teacher",
              { email },
              "Приглашение создано.",
            );
            if (result)
              setLink(
                location.origin + "/findbuddy/invite?token=" + result.token,
              );
          }}
        >
          <div className={st.formGrid}>
            <label>
              {tr("Почта преподавателя")}
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                disabled={busy}
              />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            {tr("Создать приглашение")}
          </button>
        </form>
        {link && <InviteLink url={link} />} {status}
        <div className={st.list}>
          {data.members
            .filter((m) => m.state === "active")
            .map((m) => (
              <article key={m.teacher_id} className={st.listRow}>
                <div>
                  <strong>{m.name}</strong>
                  <p>{tr(statusLabels[m.verification])}</p>
                </div>
                <button
                  className={st.textButton}
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Исключить преподавателя? Новая запись на его занятия центра закроется. Существующие занятия сохранятся.",
                      )
                    )
                      void run(
                        "remove_member",
                        { teacher_id: m.teacher_id, organization_id: g.id },
                        "Преподаватель исключён.",
                      );
                  }}
                >
                  {tr("Исключить из команды")}
                </button>
              </article>
            ))}
        </div>
        <h2>{tr("Приглашения")}</h2>
        {data.invitations.map((i) => (
          <div key={i.id} className={st.listRow}>
            <div>
              <strong>{i.email}</strong>
              <p>
                {tr(
                  i.accepted_by
                    ? tr("Принято")
                    : i.revoked
                      ? tr("Отозвано")
                      : Date.parse(i.expires_at) < now
                        ? tr("Истекло")
                        : tr("До ") + lessonDate(i.expires_at, uiLocale),
                )}
              </p>
            </div>
            {!i.accepted_by && !i.revoked && (
              <button
                className={st.textButton}
                disabled={busy}
                onClick={() => void run("revoke_invite", { id: i.id })}
              >
                {tr("Отозвать")}
              </button>
            )}
          </div>
        ))}
      </section>
    );
  if (panel === "students")
    return (
      <section className={st.stack}>
        <header>
          <h1>{tr("Ученики центра")}</h1>
          <p>
            {tr(
              "Только записи вашего центра. Личные переписки и работы преподавателей сюда не передаются.",
            )}
          </p>
        </header>
        {!data.bookings.length && (
          <div className={st.empty}>
            {tr("Ученики появятся после первой записи.")}
          </div>
        )}
        {data.bookings.map((b) => (
          <article key={b.id} className={st.listRow}>
            <div>
              <strong>{b.student?.name ?? tr("Ученик")}</strong>
              <p>
                {tr(stageLabels[b.student?.stage ?? ""] ?? "")}
                {tr(
                  b.student?.study_year
                    ? " · " + b.student.study_year + tr(" класс/курс")
                    : "",
                )}
              </p>
              <p>{b.student?.goal}</p>
              <small>
                {b.teacher_name} · {tr(lessonDate(b.starts_at, uiLocale))} ·
                {tr(" ")}
                {tr(
                  b.status === "cancelled"
                    ? tr("Отменено")
                    : tr("Запись сохранена"),
                )}
              </small>
            </div>
            <strong>
              {tr(b.price === 0 ? tr("Бесплатно") : money(b.price, uiLocale))}
            </strong>
          </article>
        ))}
      </section>
    );
  if (panel === "schedule")
    return (
      <section className={st.stack}>
        <header>
          <h1>{tr("Расписание центра")}</h1>
          <p>
            {tr(
              "Одна дата — одно занятие. Занятость преподавателя проверяется также в других центрах и в его личном расписании.",
            )}
          </p>
        </header>
        {g.status !== "verified" && (
          <p className={st.notice}>
            {tr("Публикация откроется после проверки центра.")}
          </p>
        )}
        {!data.offerings.length ? (
          <p>
            {tr("Сначала")}
            {tr(" ")}
            <a className={st.textButton} href="#offerings">
              {tr("добавьте направление")}
            </a>
            {tr(" ")}
            {tr("и назначьте преподавателя команды.")}
          </p>
        ) : (
          <form
            className={st.editor}
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const starts = kazakhstanDate(String(f.get("starts_at")));
                await run(
                  "publish_slot",
                  {
                    ...Object.fromEntries(f),
                    offering_id: selected?.id,
                    price: Number(f.get("price")),
                    capacity: Number(f.get("capacity")),
                    starts_at: starts,
                  },
                  "Занятие опубликовано.",
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Проверьте дату.");
              }
            }}
          >
            <fieldset
              disabled={busy || g.status !== "verified"}
              className={st.fields}
            >
              <h2>{tr("Новое занятие")}</h2>
              <label>
                {tr("Направление")}
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setOffering(e.target.value)}
                >
                  {data.offerings
                    .filter((o) => o.active)
                    .map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {tr("Тема")}
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={120}
                  defaultValue={selected?.title}
                  key={selected?.id}
                />
              </label>
              <label>
                {tr("Описание")}
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={1500}
                  rows={3}
                  defaultValue={selected?.description}
                />
              </label>
              <div className={st.formGrid}>
                <label>
                  {tr("Дата и время · UTC+5")}
                  <input name="starts_at" type="datetime-local" required />
                </label>
                <label>
                  {tr("Язык")}
                  <select name="language" key={selected?.id}>
                    {selected?.languages.map((x) => (
                      <option key={x} value={x}>
                        {tr(x)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("Цена, ₸")}
                  <input
                    key={selected?.id}
                    name="price"
                    required
                    type="number"
                    min={0}
                    max={100000}
                    defaultValue={selected?.price}
                  />
                  <small>{tr("0 — бесплатное занятие.")}</small>
                </label>
                <label>
                  {tr("Мест")}
                  <input
                    name="capacity"
                    type="number"
                    required
                    min={1}
                    max={12}
                    defaultValue={1}
                  />
                  <small>{tr("1 — индивидуально, 2–12 — группа.")}</small>
                </label>
              </div>
              <button className="primary">{tr("Опубликовать занятие")}</button>
            </fieldset>
            {error && <p className={st.error}>{tr(error)}</p>}
          </form>
        )}
        {status}
        {data.slots.map((slot) => (
          <article key={slot.id} className={st.listRow}>
            <div>
              <strong>{slot.title}</strong>
              <p>
                {tr(lessonDate(slot.starts_at, uiLocale))} ·{tr(" ")}
                {data.members.find((m) => m.teacher_id === slot.tutor_id)?.name}
              </p>
              <small>
                {tr(
                  slot.enrollment_closed
                    ? tr("Набор закрыт")
                    : tr("Записались: {0}/{1}", [slot.reserved, slot.capacity]),
                )}
                {tr(" ")}·{" "}
                {tr(
                  slot.price === 0
                    ? tr("Бесплатно")
                    : money(slot.price, uiLocale),
                )}
              </small>
            </div>
            {!slot.enrollment_closed && Date.parse(slot.starts_at) > now && (
              <button
                className={st.textButton}
                disabled={busy}
                onClick={() =>
                  void run(
                    "close_slot",
                    { id: slot.id },
                    "Новая запись закрыта. Существующие брони сохранены.",
                  )
                }
              >
                {tr("Закрыть запись")}
              </button>
            )}
          </article>
        ))}
      </section>
    );
  const next = data.bookings
    .filter(
      (b) =>
        b.status !== "cancelled" && Date.parse(b.starts_at) + 3600000 > now,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  return (
    <section className={st.stack}>
      <header>
        <p className={st.eyebrow}>{tr("Кабинет учебного центра")}</p>
        <h1>{g.name}</h1>
        <p>
          {tr(statusLabels[g.status ?? "draft"])}
          {tr(g.review_note ? " · " + g.review_note : "")}
        </p>
      </header>
      <div className={st.stats}>
        <div>
          <strong>
            {data.members.filter((m) => m.state === "active").length}
          </strong>
          <span>{tr("Преподавателей в команде")}</span>
        </div>
        <div>
          <strong>
            {
              data.slots.filter(
                (s) => !s.enrollment_closed && Date.parse(s.starts_at) > now,
              ).length
            }
          </strong>
          <span>{tr("Будущих занятий")}</span>
        </div>
        <div>
          <strong>
            {
              new Set(
                data.bookings
                  .filter((b) => b.status !== "cancelled")
                  .map((b) => b.student_id),
              ).size
            }
          </strong>
          <span>{tr("Учеников центра")}</span>
        </div>
      </div>
      {g.status === "verified" ? (
        <div className={st.editor}>
          <h2>
            {tr(
              next ? tr("Ближайшее занятие") : tr("Откройте запись ученикам"),
            )}
          </h2>
          <p>
            {next
              ? `${next.lesson_title} · ${lessonDate(next.starts_at, uiLocale)} · ${next.teacher_name}`
              : tr("Опубликуйте время проверенного преподавателя команды.")}
          </p>
          <a href="#schedule" className="primary">
            {tr("Открыть расписание")}
          </a>
        </div>
      ) : (
        <div className={st.editor}>
          <h2>{tr("Подготовьте центр к публикации")}</h2>
          <p>
            {tr(
              "Заполните страницу и отправьте данные на проверку. Команду можно пригласить уже сейчас.",
            )}
          </p>
          <a className="primary" href="#page">
            {tr("Открыть страницу центра")}
          </a>
        </div>
      )}
      <div className={st.actions}>
        <a href="#team" className={st.textButton}>
          {tr("Пригласить преподавателя")}
        </a>
        <a href="#offerings" className={st.textButton}>
          {tr("Направления центра")}
        </a>
        <a href="#students" className={st.textButton}>
          {tr("Ученики и записи")}
        </a>
        <a href="#page" className={st.textButton}>
          {tr("Редактировать страницу")}
        </a>
        {g.status === "verified" && (
          <Link className={st.textButton} href={"/centers/" + g.id}>
            {tr("Публичная страница")}
          </Link>
        )}
      </div>
    </section>
  );
}
function LogoInput({
  current,
  onProcessing,
}: {
  current: string;
  onProcessing: (value: boolean) => void;
}) {
  const { t: tr } = useJupLocale();

  const id = useId();
  const [logo, setLogo] = useState(current);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  return (
    <div className={st.logoUpload}>
      <div className={st.logoPreview}>
        {logo ? (
          // Small, locally normalized preview; no external image request.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"data:image/jpeg;base64," + logo}
            alt={tr("Логотип центра")}
          />
        ) : (
          <Icon name="groups" size={28} />
        )}
      </div>
      <div>
        <strong>
          {tr("Логотип центра ")}
          <small>{tr("Необязательно")}</small>
        </strong>
        <p>{tr("Квадратное изображение · JPG, PNG или WebP")}</p>
        <label className="secondary" htmlFor={id}>
          {tr(
            processing
              ? tr("Подготавливаем…")
              : logo
                ? tr("Заменить логотип")
                : tr("Выбрать логотип"),
          )}
        </label>
        <input type="hidden" name="logo" value={logo} />
        <input
          id={id}
          className="srOnly"
          disabled={processing}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (file.size > 12000000) {
              setError("Выберите изображение до 12 МБ.");
              return;
            }
            const url = URL.createObjectURL(file);
            setProcessing(true);
            onProcessing(true);
            try {
              const img = new Image();
              img.src = url;
              await img.decode();
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 256;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw Error();
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, 256, 256);
              const scale = Math.min(256 / img.width, 256 / img.height);
              ctx.drawImage(
                img,
                (256 - img.width * scale) / 2,
                (256 - img.height * scale) / 2,
                img.width * scale,
                img.height * scale,
              );
              setLogo(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
            } catch {
              setError("Не удалось прочитать изображение.");
            } finally {
              URL.revokeObjectURL(url);
              setProcessing(false);
              onProcessing(false);
            }
          }}
        />
        {logo && (
          <>
            <button
              type="button"
              className={st.textButton}
              onClick={() => setLogo("")}
            >
              {tr("Удалить логотип")}
            </button>
          </>
        )}
        {error && <small role="alert">{tr(error)}</small>}
      </div>
    </div>
  );
}
export function InviteLink({ url }: { url: string }) {
  const { t: tr } = useJupLocale();

  const [message, setMessage] = useState("");
  return (
    <div className={st.notice}>
      <strong>{tr("Личное приглашение · 7 дней")}</strong>
      <p className={st.inviteUrl}>{tr(url)}</p>
      <button
        className={st.textButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Ссылка скопирована.");
          } catch {
            setMessage("Выделите и скопируйте ссылку выше.");
          }
        }}
      >
        {tr("Скопировать ссылку")}
      </button>
      <p role="status">{tr(message)}</p>
      <small>{tr("Передайте только указанному получателю.")}</small>
    </div>
  );
}
