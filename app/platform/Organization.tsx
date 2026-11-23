"use client";
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
          <p className={st.eyebrow}>Публичная страница центра</p>
          <h1>
            {g ? "Расскажите о вашем центре" : "Знакомство с учебным центром"}
          </h1>
          <p>
            Сохраните страницу, пригласите команду и отправьте данные на ручную
            проверку.
          </p>
        </header>
        {g && (
          <p className={st.notice}>
            {statusLabels[g.status ?? "draft"]}
            {g.review_note ? " · " + g.review_note : ""}
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
            <section className={st.formSection}><header><span><Icon name="teacher" size={21} /></span><div><h2>Для учеников</h2><p>Так будет выглядеть знакомство с вашим центром.</p></div></header>
            <label>
              Название
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={g?.name}
                placeholder="Название вашего центра"
              />
            </label>
            <label>
              О центре
              <textarea
                name="description"
                rows={4}
                maxLength={2000}
                defaultValue={g?.description}
                placeholder="Кому помогаете, какие направления ведёте и что важно знать о ваших занятиях"
              />
            </label>
            <fieldset className={st.formatChoices}><legend>Как проходят занятия?</legend>
              {[["online", "Онлайн", "Из любого места", "calendar"], ["in_person", "Очно", "В вашем центре", "pin"], ["both", "Оба формата", "Онлайн и в центре", "groups"]].map(([value, title, description, icon]) => <ChoiceCard key={value} name="format" value={value} title={title} description={description} icon={icon as IconName} selected={format === value} onChange={setFormat} />)}
            </fieldset>
            <div className={st.formGrid}>
              <label>
                Город
                <input name="city" maxLength={80} defaultValue={g?.city} placeholder="Например, Алматы" />
              </label>
              <label>
                Сайт · необязательно
                <input type="url" name="website" placeholder="https://" defaultValue={g?.website} />
              </label>
            </div>
            <LogoInput current={g?.logo ?? ""} onProcessing={setLogoBusy} />
            </section>
            <section className={st.formSection}><header><span><Icon name="check" size={21} /></span><div><h2>Для проверки</h2><p>Эти сведения видны только вам и модератору.</p></div></header>
              <label>
                Контакт для модератора
                <input
                  name="contact"
                  maxLength={300}
                  defaultValue={g?.contact}
                  placeholder="Рабочая почта или телефон представителя"
                />
              </label>
            <label>
              Как подтвердить центр
              <textarea
                name="evidence"
                maxLength={1500}
                rows={3}
                defaultValue={g?.evidence}
                placeholder="Ссылки на официальный сайт, публичную страницу, сведения о представителе."
              />
              <small>
                Контакт и сведения для проверки видны только вам и модераторам.
                Документы не загружаются.
              </small>
            </label>
            </section>
            <div className={st.actions}>
              <button className="primary" value="submit" disabled={logoBusy}>
                {busy ? "Сохраняем…" : logoBusy ? "Подготавливаем логотип…" : "Отправить на проверку"}
              </button>
              <button className="secondary" value="draft" disabled={logoBusy}>
                Сохранить черновик
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
          <h1>Команда преподавателей</h1>
          <p>
            У каждого преподавателя свой аккаунт. Приглашение даёт центру право
            управлять его занятиями от имени центра.
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
              Почта преподавателя
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
            Создать приглашение
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
                  <p>{statusLabels[m.verification]}</p>
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
                  Исключить из команды
                </button>
              </article>
            ))}
        </div>
        <h2>Приглашения</h2>
        {data.invitations.map((i) => (
          <div key={i.id} className={st.listRow}>
            <div>
              <strong>{i.email}</strong>
              <p>
                {i.accepted_by
                  ? "Принято"
                  : i.revoked
                    ? "Отозвано"
                    : Date.parse(i.expires_at) < now
                      ? "Истекло"
                      : "До " + lessonDate(i.expires_at)}
              </p>
            </div>
            {!i.accepted_by && !i.revoked && (
              <button
                className={st.textButton}
                disabled={busy}
                onClick={() => void run("revoke_invite", { id: i.id })}
              >
                Отозвать
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
          <h1>Ученики центра</h1>
          <p>
            Только записи вашего центра. Личные переписки и работы
            преподавателей сюда не передаются.
          </p>
        </header>
        {!data.bookings.length && (
          <div className={st.empty}>Ученики появятся после первой записи.</div>
        )}
        {data.bookings.map((b) => (
          <article key={b.id} className={st.listRow}>
            <div>
              <strong>{b.student?.name ?? "Ученик"}</strong>
              <p>
                {stageLabels[b.student?.stage ?? ""] ?? ""}
                {b.student?.study_year
                  ? " · " + b.student.study_year + " класс/курс"
                  : ""}
              </p>
              <p>{b.student?.goal}</p>
              <small>
                {b.teacher_name} · {lessonDate(b.starts_at)} ·{" "}
                {b.status === "cancelled" ? "Отменено" : "Запись сохранена"}
              </small>
            </div>
            <strong>{b.price === 0 ? "Бесплатно" : money(b.price)}</strong>
          </article>
        ))}
      </section>
    );
  if (panel === "schedule")
    return (
      <section className={st.stack}>
        <header>
          <h1>Расписание центра</h1>
          <p>
            Одна дата — одно занятие. Занятость преподавателя проверяется также
            в других центрах и в его личном расписании.
          </p>
        </header>
        {g.status !== "verified" && (
          <p className={st.notice}>
            Публикация откроется после проверки центра.
          </p>
        )}
        {!data.offerings.length ? (
          <p>
            Сначала{" "}
            <a className={st.textButton} href="#offerings">
              добавьте направление
            </a>{" "}
            и назначьте преподавателя команды.
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
              <h2>Новое занятие</h2>
              <label>
                Направление
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
                Тема
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
                Описание
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
                  Дата и время · UTC+5
                  <input name="starts_at" type="datetime-local" required />
                </label>
                <label>
                  Язык
                  <select name="language" key={selected?.id}>
                    {selected?.languages.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Цена, ₸
                  <input
                    key={selected?.id}
                    name="price"
                    required
                    type="number"
                    min={0}
                    max={100000}
                    defaultValue={selected?.price}
                  />
                  <small>0 — бесплатное занятие.</small>
                </label>
                <label>
                  Мест
                  <input
                    name="capacity"
                    type="number"
                    required
                    min={1}
                    max={12}
                    defaultValue={1}
                  />
                  <small>1 — индивидуально, 2–12 — группа.</small>
                </label>
              </div>
              <button className="primary">Опубликовать занятие</button>
            </fieldset>
            {error && <p className={st.error}>{error}</p>}
          </form>
        )}
        {status}
        {data.slots.map((slot) => (
          <article key={slot.id} className={st.listRow}>
            <div>
              <strong>{slot.title}</strong>
              <p>
                {lessonDate(slot.starts_at)} ·{" "}
                {data.members.find((m) => m.teacher_id === slot.tutor_id)?.name}
              </p>
              <small>
                {slot.enrollment_closed
                  ? "Набор закрыт"
                  : `Записались: ${slot.reserved}/${slot.capacity}`}{" "}
                · {slot.price === 0 ? "Бесплатно" : money(slot.price)}
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
                Закрыть запись
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
        <p className={st.eyebrow}>Кабинет учебного центра</p>
        <h1>{g.name}</h1>
        <p>
          {statusLabels[g.status ?? "draft"]}
          {g.review_note ? " · " + g.review_note : ""}
        </p>
      </header>
      <div className={st.stats}>
        <div>
          <strong>
            {data.members.filter((m) => m.state === "active").length}
          </strong>
          <span>Преподавателей в команде</span>
        </div>
        <div>
          <strong>
            {
              data.slots.filter(
                (s) => !s.enrollment_closed && Date.parse(s.starts_at) > now,
              ).length
            }
          </strong>
          <span>Будущих занятий</span>
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
          <span>Учеников центра</span>
        </div>
      </div>
      {g.status === "verified" ? (
        <div className={st.editor}>
          <h2>{next ? "Ближайшее занятие" : "Откройте запись ученикам"}</h2>
          <p>
            {next
              ? `${next.lesson_title} · ${lessonDate(next.starts_at)} · ${next.teacher_name}`
              : "Опубликуйте время проверенного преподавателя команды."}
          </p>
          <a href="#schedule" className="primary">
            Открыть расписание
          </a>
        </div>
      ) : (
        <div className={st.editor}>
          <h2>Подготовьте центр к публикации</h2>
          <p>
            Заполните страницу и отправьте данные на проверку. Команду можно
            пригласить уже сейчас.
          </p>
          <a className="primary" href="#page">
            Открыть страницу центра
          </a>
        </div>
      )}
      <div className={st.actions}>
        <a href="#team" className={st.textButton}>
          Пригласить преподавателя
        </a>
        <a href="#offerings" className={st.textButton}>
          Направления центра
        </a>
        <a href="#students" className={st.textButton}>
          Ученики и записи
        </a>
        <a href="#page" className={st.textButton}>
          Редактировать страницу
        </a>
        {g.status === "verified" && (
          <Link className={st.textButton} href={"/centers/" + g.id}>
            Публичная страница
          </Link>
        )}
      </div>
    </section>
  );
}
function LogoInput({ current, onProcessing }: { current: string; onProcessing: (value: boolean) => void }) {
  const id = useId();
  const [logo, setLogo] = useState(current);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  return (
    <div className={st.logoUpload}>
      <div className={st.logoPreview}>{logo ? (
        // Small, locally normalized preview; no external image request.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={"data:image/jpeg;base64," + logo} alt="Логотип центра" />
      ) : <Icon name="groups" size={28} />}</div>
      <div><strong>Логотип центра <small>Необязательно</small></strong><p>Квадратное изображение · JPG, PNG или WebP</p>
      <label className="secondary" htmlFor={id}>{processing ? "Подготавливаем…" : logo ? "Заменить логотип" : "Выбрать логотип"}</label>
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
            Удалить логотип
          </button>
        </>
      )}
      {error && <small role="alert">{error}</small>}
      </div>
    </div>
  );
}
export function InviteLink({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className={st.notice}>
      <strong>Личное приглашение · 7 дней</strong>
      <p className={st.inviteUrl}>{url}</p>
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
        Скопировать ссылку
      </button>
      <p role="status">{message}</p>
      <small>Передайте только указанному получателю.</small>
    </div>
  );
}
