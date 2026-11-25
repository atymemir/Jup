"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { DraftFields } from "../authoring/DraftFields";
import { FormattedText } from "../ui/FormattedText";
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  FB_SUBJECTS,
  FB_EXAMS,
  FB_LANGUAGES,
  FB_CITIES,
  lessonDate,
  money,
  type Tutor,
  type Group,
} from "../lib/findbuddy";
import { Icon } from "../ui/Icon";
import st from "./profile.module.css";
import { Qualifications } from "../platform/Qualifications";
import { ReportProfile } from "../platform/ReportProfile";
import { SetupProgress } from "../ui/SetupControls";
import { normalizePhoto } from "../lib/normalizePortrait";

function photoUrl(tutor?: Tutor) {
  return tutor?.photo_version
    ? "/findbuddy/api/photo/" + tutor.id + "/" + tutor.photo_version
    : "";
}
export function TutorPhoto({
  tutor,
  source,
}: {
  tutor?: Tutor;
  source?: string;
}) {
  const url = source ?? photoUrl(tutor);
  const [failed, setFailed] = useState("");
  return (
    <span className={st.avatar} aria-hidden="true">
      {url && url !== failed ? (
        // Uploads retain their aspect ratio; the frame fits the full portrait.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailed(url)} />
      ) : (
        tutor?.display_name.trim().slice(0, 1) || <Icon name="teacher" />
      )}
    </span>
  );
}
export function TutorPortrait({
  tutor,
  source,
  name,
}: {
  tutor?: Tutor;
  source?: string;
  name?: string;
}) {
  const { t } = useJupLocale();
  const url = source ?? photoUrl(tutor);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) dialog.current?.close();
  }, [open]);
  if (!url) return <TutorPhoto tutor={tutor} source={source} />;
  return (
    <>
      <button
        type="button"
        className={st.portraitPreview}
        aria-label={t("Открыть фото преподавателя")}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        <TutorPhoto tutor={tutor} source={source} />
        <span className={st.portraitExpand} aria-hidden="true">
          <Icon name="search" size={14} />
        </span>
      </button>
      <dialog
        ref={dialog}
        className={st.photoViewer}
        aria-labelledby={title}
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            setOpen(false);
        }}
      >
        <header>
          <strong id={title}>
            {name ?? tutor?.display_name ?? t("Фото преподавателя")}
          </strong>
          <button
            type="button"
            aria-label={t("Закрыть")}
            onClick={() => setOpen(false)}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        {open && failed ? (
          <div className={st.photoError} role="alert">
            <p>{t("Фото временно недоступно.")}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => setFailed(false)}
            >
              {t("Повторить")}
            </button>
          </div>
        ) : (
          open && (
            // Same verified or authorized photo as the preview; no extra public endpoint.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={name ?? tutor?.display_name ?? t("Фото преподавателя")}
              decoding="async"
              onError={() => setFailed(true)}
            />
          )
        )}
      </dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const { t: tr } = useJupLocale();

  const id = useId();
  return (
    <div className={st.field}>
      <label htmlFor={id}>{tr(label)}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
const options = {
  subject: FB_SUBJECTS,
  exam: FB_EXAMS,
  language: FB_LANGUAGES,
  city: FB_CITIES,
};

export function TutorForm({
  tutor,
  name,
  privatePhoto,
  busy,
  save,
}: {
  tutor?: Tutor;
  name?: string | null;
  privatePhoto?: string | null;
  busy: boolean;
  save: (data: Record<string, unknown>) => void;
}) {
  const { t: tr, locale } = useJupLocale();

  const [stage, setStage] = useState(1);
  const [subject, setSubject] = useState(tutor?.subject ?? "");
  const [exam, setExam] = useState(tutor?.exam ?? "Школьная программа");
  const photoInput = useId();
  const basics = useRef<HTMLDivElement>(null);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  function next() {
    const invalid = basics.current?.querySelector<
      HTMLInputElement | HTMLSelectElement
    >(":invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (!photo) {
      setError("Добавьте фото профиля.");
      return;
    }
    setError("");
    setStage(2);
    requestAnimationFrame(() => detailsHeading.current?.focus());
  }
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [delivery, setDelivery] = useState(
    tutor?.city && tutor.city !== "Онлайн" ? "in_person" : "online",
  );
  const source =
    photo ??
    (privatePhoto
      ? "data:image/jpeg;base64," + privatePhoto.replace(/\s/g, "")
      : undefined);
  async function choose(file?: File) {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      setPhoto(await normalizePhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото.");
    } finally {
      setProcessing(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || processing) return;
    if (!tutor && stage === 1) {
      next();
      return;
    }
    const form = e.currentTarget;
    const invalid = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(":invalid");
    if (invalid) {
      if (basics.current?.contains(invalid)) setStage(1);
      invalid.closest("details")?.setAttribute("open", "");
      requestAnimationFrame(() => invalid.reportValidity());
      return;
    }
    if (!tutor && !photo) {
      setError("Добавьте фото, которое будет видно в анкете.");
      return;
    }
    const data = Object.fromEntries(new FormData(e.currentTarget));
    save({
      ...data,
      education_entries: JSON.parse(String(data.education_entries ?? "[]")),
      certificates: JSON.parse(String(data.certificates ?? "[]")),
      spoken_languages: JSON.parse(String(data.spoken_languages ?? "[]")),
      mode: tutor ? "edit" : "create",
      price: Number(data.price),
      experience: Number(data.experience),
      adult_consent: data.adult_consent === "on",
      ...(photo !== undefined ? { photo: photo.split(",")[1] ?? "" } : {}),
    });
  }
  return (
    <form
      className={st.form}
      onSubmit={submit}
      noValidate
      aria-busy={busy || processing}
    >
      {!tutor && (
        <SetupProgress
          labels={[tr("Основное"), tr("Ваш подход")]}
          step={stage - 1}
          onBack={busy ? undefined : () => setStage(1)}
        />
      )}
      {error && (
        <p role="alert" className={st.error}>
          {tr(error)}
        </p>
      )}
      <div ref={basics} hidden={!tutor && stage === 2} className={st.stage}>
        <div className={st.upload}>
          <TutorPhoto tutor={tutor} source={source} />
          <div>
            <strong>{tr("Ваше фото")}</strong>
            <p className={st.photoHint}>
              {tr("Фото целиком, без обрезки и растягивания.")}
            </p>
            <label
              className={st.photoButton + " secondary"}
              htmlFor={photoInput}
            >
              {tr(
                processing
                  ? tr("Подготавливаем…")
                  : source || tutor?.photo_version
                    ? tr("Заменить фото")
                    : tr("Выбрать фото"),
              )}
            </label>
            <input
              id={photoInput}
              className="srOnly"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
              disabled={busy || processing}
            />
            <small>
              {tr(
                processing
                  ? tr("Подготавливаем фото…")
                  : tr("JPG, PNG или WebP · до 12 МБ"),
              )}
            </small>
            {tutor && (source || tutor.photo_version) && photo !== "" && (
              <button
                type="button"
                className={st.link}
                onClick={() => {
                  setPhoto("");
                  setError("");
                }}
              >
                {tr("Удалить фото")}
              </button>
            )}
          </div>
        </div>
        <Field label={tr("Имя в анкете")}>
          <input
            name="display_name"
            defaultValue={tutor?.display_name ?? name ?? ""}
            minLength={2}
            maxLength={70}
            required
            autoComplete="name"
          />
        </Field>
        {!tutor && (
          <div
            className={st.quickSubjects}
            role="group"
            aria-label={tr("Быстрый выбор предмета")}
          >
            {(["Математика", "Английский", "Физика", "География"] as const).map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={subject === item}
                  onClick={() => setSubject(item)}
                >
                  {tr(item)}
                </button>
              ),
            )}
          </div>
        )}
        <div hidden={!!tutor} className={st.formGrid}>
          {(
            [
              ["subject", "Предмет"],
              ["exam", "Экзамен"],
              ["language", "Язык занятий"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={tr(label)}>
              <select
                name={key}
                value={
                  key === "subject"
                    ? subject
                    : key === "exam"
                      ? exam
                      : undefined
                }
                defaultValue={
                  key === "language"
                    ? (tutor?.language ??
                      (locale === "kk"
                        ? "Қазақша"
                        : locale === "en"
                          ? "English"
                          : "Русский"))
                    : undefined
                }
                required
                onChange={(e) => {
                  if (key === "subject") setSubject(e.target.value);
                  if (key === "exam") setExam(e.target.value);
                }}
              >
                <option value="" disabled>
                  {tr("Выберите")}
                </option>
                {options[key].map((item) => (
                  <option key={item} value={item}>
                    {tr(item)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <Field label={tr("Формат первого направления")}>
            <select
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option value="online">{tr("Онлайн")}</option>
              <option value="in_person">{tr("Очно")}</option>
            </select>
          </Field>
          {delivery === "online" ? (
            <input type="hidden" name="city" value="Онлайн" />
          ) : (
            <Field label={tr("Город занятий")}>
              <select
                name="city"
                required
                defaultValue={tutor?.city !== "Онлайн" ? tutor?.city : ""}
              >
                <option value="" disabled>
                  {tr("Выберите город")}
                </option>
                {FB_CITIES.filter((city) => city !== "Онлайн").map((city) => (
                  <option key={city} value={city}>
                    {tr(city)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={tr("Цена за 60 минут, ₸")}>
            <input
              name="price"
              type="number"
              min={0}
              max={100000}
              required
              defaultValue={tutor?.price ?? 4000}
              placeholder="4 000"
            />
          </Field>
        </div>
        <Field label={tr("Опыт, лет")}>
          <input
            name="experience"
            type="number"
            min={0}
            max={60}
            required
            defaultValue={tutor?.experience ?? 0}
          />
        </Field>
      </div>
      <div hidden={!tutor && stage === 1} className={st.stage}>
        {!tutor && (
          <h3 tabIndex={-1} ref={detailsHeading}>
            {tr("Расскажите о ваших уроках")}
          </h3>
        )}
        <DraftFields
          kind="profile"
          subject={subject}
          exam={exam}
          initialTitle={tutor?.headline}
          initialBody={tutor?.bio}
          initialPlan={tutor?.lesson_plan}
          disabled={busy}
          initiallyOpen={!tutor}
        />
        <details className={st.extraDetails}>
          <summary>
            {tr("Образование и подтверждения")}
            <small>{tr("Можно дополнить позже")}</small>
          </summary>
          <Field label={tr("Образование или квалификация")}>
            <input
              name="education"
              maxLength={180}
              defaultValue={tutor?.education}
              placeholder={tr("Например, КазНУ, география")}
            />
          </Field>
          <Qualifications tutor={tutor} />
        </details>
        {!tutor && (
          <label className={st.consent}>
            <input type="checkbox" name="adult_consent" required />
            {tr(
              "Мне есть 18 лет. Я согласен на проверку личности перед публикацией анкеты.",
            )}
          </label>
        )}
      </div>
      {!tutor && stage === 1 ? (
        <button type="submit" className="primary" disabled={busy || processing}>
          {tr("Продолжить")}
        </button>
      ) : (
        <>
          <button className="primary" disabled={busy || processing}>
            {tr(
              busy
                ? tr("Сохраняем…")
                : tutor
                  ? tr("Сохранить анкету")
                  : tr("Отправить анкету"),
            )}
          </button>
          {!tutor && (
            <button
              type="button"
              className={st.link}
              disabled={busy}
              onClick={() => {
                setError("");
                setStage(1);
              }}
            >
              {tr("Назад к фото и цене")}
            </button>
          )}
        </>
      )}
    </form>
  );
}
export function ProfilePage({
  tutor,
  slots,
  groups,
  editable,
  example,
  local,
  photo,
  own,
  back,
  edit,
  book,
  request,
  contact,
  reviews,
}: {
  tutor: Tutor;
  slots: Group[];
  groups: Group[];
  editable: boolean;
  example: boolean;
  local: boolean;
  photo?: string;
  own: boolean;
  back: () => void;
  edit: () => void;
  book: (g: Group) => void;
  request: (offering?: import("../lib/platform").Offering) => void;
  contact?: () => void;
  reviews?: ReactNode;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const orderedSlots = [...slots].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );
  const [all, setAll] = useState(false);
  const [shared, setShared] = useState("");
  const firstPrice =
    orderedSlots[0]?.price ??
    (tutor.offerings?.length
      ? Math.min(...tutor.offerings.map((o) => o.price))
      : tutor.price);
  return (
    <section className={st.profile} aria-label={tr("Анкета преподавателя")}>
      <div className={st.profileNav}>
        <button className={st.link} onClick={back}>
          {tr(own ? tr("Кабинет преподавателя") : tr("Вернуться к поиску"))}
        </button>
        {tutor.verification === "verified" && !example && (
          <button
            className={st.link}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  location.origin + "/findbuddy#tutors/profile/" + tutor.id,
                );
                setShared("Ссылка скопирована.");
              } catch {
                setShared("Скопируйте адрес из строки браузера.");
              }
            }}
          >
            {tr("Поделиться анкетой")}
          </button>
        )}
      </div>
      {shared && (
        <p className={st.muted} role="status">
          {tr(shared)}
        </p>
      )}
      <div className={st.layout}>
        <div className={st.bioColumn}>
          <header className={st.identity}>
            <TutorPortrait tutor={tutor} source={photo} />
            <div>
              <p className={st.muted}>
                {tr(tutor.subject)} · {tr(tutor.exam)}
              </p>
              <h1>{tutor.display_name}</h1>
              <p>{tutor.headline}</p>
            </div>
          </header>
          <dl className={st.facts}>
            <div>
              <dt>{tr("Формат")}</dt>
              <dd>{tr(tutor.city)}</dd>
            </div>
            <div>
              <dt>{tr("Язык")}</dt>
              <dd>{tr(tutor.language)}</dd>
            </div>
            <div>
              <dt>{tr("Опыт")}</dt>
              <dd>
                {tutor.experience}
                {tr(" г.")}
              </dd>
            </div>
          </dl>
          <p className={st.status}>
            {tr(
              example
                ? tr("Демоанкета")
                : local
                  ? tr("Локальная анкета")
                  : tutor.verification === "verified"
                    ? tr("Личность подтверждена")
                    : tr("Анкета ожидает проверки"),
            )}
          </p>
          <div className={st.info}>
            <h2>{tr("О преподавателе")}</h2>
            <FormattedText value={tutor.bio} />
            {!!tutor.education_entries?.length && (
              <>
                <h3>{tr("Образование")}</h3>
                {tutor.education_entries.map((e, i) => (
                  <p key={i}>
                    <strong>{e.institution}</strong>
                    <br />
                    {[
                      e.degree,
                      e.field,
                      e.status === "studying"
                        ? tr("Продолжает учиться")
                        : e.year,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}
              </>
            )}
            {!!tutor.certificates?.length && (
              <>
                <h3>{tr("Сертификаты")}</h3>
                {tutor.certificates.map((c, i) => (
                  <p key={i}>
                    {[c.name, c.issuer, c.result, c.year]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}
                <small>{tr("Сведения указаны преподавателем.")}</small>
              </>
            )}
            {!!tutor.spoken_languages?.length && (
              <>
                <h3>{tr("Владение языками")}</h3>
                <p>
                  {tr(
                    tutor.spoken_languages
                      .map((l) => l.language + " · " + l.level)
                      .join(", "),
                  )}
                </p>
              </>
            )}
            {tutor.teaching_approach && (
              <>
                <h3>{tr("Подход к занятиям")}</h3>
                <p>{tutor.teaching_approach}</p>
              </>
            )}
            {tutor.audience && (
              <>
                <h3>{tr("С кем работает")}</h3>
                <p>{tr(tutor.audience)}</p>
              </>
            )}
            {tutor.education && (
              <>
                <h3>{tr("Образование и квалификация")}</h3>
                <p>{tutor.education}</p>
              </>
            )}
            {tutor.lesson_plan && (
              <>
                <h3>{tr("Первый урок")}</h3>
                <FormattedText value={tutor.lesson_plan} />
              </>
            )}
          </div>
          {!!tutor.offerings?.length && (
            <div className={st.info}>
              <h2>{tr("Направления занятий")}</h2>
              {tutor.offerings.map((o) => (
                <article
                  key={o.id}
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid rgb(var(--border))",
                  }}
                >
                  <h3>{o.title}</h3>
                  <p>
                    {tr(o.subject)} · {tr(o.exam)} ·{" "}
                    {tr(o.languages.join(", "))} ·{tr(" ")}
                    {tr(o.format === "online" ? tr("Онлайн") : o.city)}
                  </p>
                  <FormattedText value={o.description} />
                  <strong>
                    {tr(
                      o.price === 0
                        ? tr("Бесплатно")
                        : money(o.price, uiLocale),
                    )}
                  </strong>
                  {!own && !example && (
                    <button className={st.link} onClick={() => request(o)}>
                      {tr("Предложить время по этому направлению")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          {reviews}
          <ReportProfile kind="teacher" id={tutor.id} />
          {groups.length > 0 && (
            <div className={st.info}>
              <h2>{tr("Мини-группы")}</h2>
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={st.slot}
                  disabled={own || example}
                  onClick={() => book(g)}
                >
                  <span>
                    <strong>{g.title}</strong>
                    <small>
                      {tr(lessonDate(g.starts_at, uiLocale))}
                      {tr(" · UTC+5 · мест")}
                      {tr(" ")}
                      {g.capacity - g.reserved}
                    </small>
                  </span>
                  <strong>{tr(money(g.price, uiLocale))}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className={st.reserve}>
          <h2>{tr("Ваш первый урок")}</h2>
          <p className={st.rate}>
            <strong>
              {tr(
                firstPrice === 0
                  ? tr("Бесплатно")
                  : money(firstPrice, uiLocale),
              )}
            </strong>
            <span>{tr(" за 60 минут")}</span>
          </p>
          {!editable && (
            <p className={st.bookingNote}>
              {tr(
                "60 минут с преподавателем. Запись без списания денег; онлайн-оплата пока не подключена.",
              )}
            </p>
          )}
          {editable ? (
            <button className="primary" onClick={edit}>
              {tr("Редактировать анкету")}
            </button>
          ) : (
            <>
              {slots.length > 0 ? (
                <>
                  <h3>{tr("Ближайшие даты")}</h3>
                  <small>{tr("Время Казахстана · UTC+5")}</small>
                  {orderedSlots.slice(0, all ? undefined : 4).map((slot) => (
                    <button
                      className={st.slot}
                      key={slot.id}
                      disabled={example}
                      onClick={() => book(slot)}
                    >
                      <span>{tr(lessonDate(slot.starts_at, uiLocale))}</span>
                      <strong>{tr(money(slot.price, uiLocale))}</strong>
                    </button>
                  ))}
                  {slots.length > 4 && !all && (
                    <button className={st.link} onClick={() => setAll(true)}>
                      {tr("Показать все даты")}
                    </button>
                  )}
                </>
              ) : (
                <p>
                  {tr(
                    "Свободных дат в расписании пока нет. Предложите удобное время и бюджет.",
                  )}
                </p>
              )}
              {contact && (
                <button
                  className={slots.length ? "secondary" : "primary"}
                  onClick={contact}
                >
                  {tr("Написать преподавателю")}
                </button>
              )}
              <button
                className={slots.length || contact ? st.link : "primary"}
                onClick={() => request()}
                disabled={example}
              >
                {tr("Предложить время и цену")}
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
