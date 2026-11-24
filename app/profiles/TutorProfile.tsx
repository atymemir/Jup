"use client";
import { DraftFields } from "../authoring/DraftFields";
import { FormattedText } from "../ui/FormattedText";
import {
  cloneElement,
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
        // The app normalizes uploads to small JPEGs and already serves cached thumbnail bytes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" onError={() => setFailed(url)} />
      ) : (
        tutor?.display_name.trim().slice(0, 1) || <Icon name="teacher" />
      )}
    </span>
  );
}
async function normalizePhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw Error("Выберите JPG, PNG или WebP размером до 12 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw Error();
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) throw Error();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 384, 384);
    context.drawImage(
      img,
      (img.naturalWidth - size) / 2,
      (img.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      384,
      384,
    );
    const output = canvas.toDataURL("image/jpeg", 0.82);
    if (!output.startsWith("data:image/jpeg;base64,") || output.length > 213350)
      throw Error();
    return output;
  } catch {
    throw Error("Фото не удалось открыть. Попробуйте другой файл.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className={st.field}>
      <label htmlFor={id}>{label}</label>
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
  const [stage, setStage] = useState(1);
  const [subject,setSubject] = useState(tutor?.subject ?? "");
  const [exam,setExam] = useState(tutor?.exam ?? "");
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
    <form className={st.form} onSubmit={submit}>
      {!tutor && <SetupProgress labels={["Основное", "Ваш подход"]} step={stage - 1} onBack={busy ? undefined : () => setStage(1)} />}
      {error && (
        <p role="alert" className={st.error}>
          {error}
        </p>
      )}
      <div ref={basics} hidden={!tutor && stage === 2} className={st.stage}>
        <div className={st.upload}>
          <TutorPhoto tutor={tutor} source={source} />
          <div>
            <strong>Ваше фото</strong>
            <p className={st.photoHint}>Помогите ученику узнать вас до первого урока.</p>
            <label className={st.photoButton + " secondary"} htmlFor={photoInput}>{processing ? "Подготавливаем…" : source || tutor?.photo_version ? "Заменить фото" : "Выбрать фото"}</label>
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
              {processing
                ? "Подготавливаем фото…"
                : "JPG, PNG или WebP · до 12 МБ"}
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
                Удалить фото
              </button>
            )}
          </div>
        </div>
        <Field label="Имя в анкете">
          <input
            name="display_name"
            defaultValue={tutor?.display_name ?? name ?? ""}
            minLength={2}
            maxLength={70}
            required
            autoComplete="name"
          />
        </Field>
        <div hidden={!!tutor} className={st.formGrid}>
          {(
            [
              ["subject", "Предмет"],
              ["exam", "Экзамен"],
              ["language", "Язык занятий"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <select name={key} defaultValue={tutor?.[key] ?? ""} required onChange={e => { if(key === "subject") setSubject(e.target.value); if(key === "exam") setExam(e.target.value); }}>
                <option value="" disabled>
                  Выберите
                </option>
                {options[key].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          ))}
          <Field label="Формат первого направления">
            <select
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option value="online">Онлайн</option>
              <option value="in_person">Очно</option>
            </select>
          </Field>
          {delivery === "online" ? (
            <input type="hidden" name="city" value="Онлайн" />
          ) : (
            <Field label="Город занятий">
              <select
                name="city"
                required
                defaultValue={tutor?.city !== "Онлайн" ? tutor?.city : ""}
              >
                <option value="" disabled>
                  Выберите город
                </option>
                {FB_CITIES.filter((city) => city !== "Онлайн").map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Цена за 60 минут, ₸">
            <input
              name="price"
              type="number"
              min={0}
              max={100000}
              required
              defaultValue={tutor?.price}
              placeholder="4 000"
            />
          </Field>
        </div>
        <Field label="Опыт, лет">
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
            Расскажите о ваших уроках
          </h3>
        )}
        <DraftFields kind="profile" subject={subject} exam={exam} initialTitle={tutor?.headline} initialBody={tutor?.bio} initialPlan={tutor?.lesson_plan} disabled={busy} />
        <Field label="Образование или квалификация">
          <input
            name="education"
            maxLength={180}
            defaultValue={tutor?.education}
            placeholder="Например, КазНУ, география"
          />
        </Field>
        <Qualifications tutor={tutor} />
        {!tutor && (
          <label className={st.consent}>
            <input type="checkbox" name="adult_consent" required />
            Мне есть 18 лет. Я согласен на проверку личности перед публикацией
            анкеты.
          </label>
        )}
      </div>
      {!tutor && stage === 1 ? (
        <button
          type="button"
          className="primary"
          disabled={processing}
          onClick={next}
        >
          Продолжить
        </button>
      ) : (
        <>
          <button className="primary" disabled={busy || processing}>
            {busy
              ? "Сохраняем…"
              : tutor
                ? "Сохранить анкету"
                : "Отправить анкету"}
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
              Назад к фото и цене
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
    <section className={st.profile} aria-label="Анкета преподавателя">
      <div className={st.profileNav}>
        <button className={st.link} onClick={back}>
          {own ? "Кабинет преподавателя" : "Вернуться к поиску"}
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
            Поделиться анкетой
          </button>
        )}
      </div>
      {shared && (
        <p className={st.muted} role="status">
          {shared}
        </p>
      )}
      <div className={st.layout}>
        <div className={st.bioColumn}>
          <header className={st.identity}>
            <TutorPhoto tutor={tutor} source={photo} />
            <div>
              <p className={st.muted}>
                {tutor.subject} · {tutor.exam}
              </p>
              <h1>{tutor.display_name}</h1>
              <p>{tutor.headline}</p>
            </div>
          </header>
          <dl className={st.facts}>
            <div>
              <dt>Формат</dt>
              <dd>{tutor.city}</dd>
            </div>
            <div>
              <dt>Язык</dt>
              <dd>{tutor.language}</dd>
            </div>
            <div>
              <dt>Опыт</dt>
              <dd>{tutor.experience} г.</dd>
            </div>
          </dl>
          <p className={st.status}>
            {example
              ? "Демоанкета"
              : local
                ? "Локальная анкета"
                : tutor.verification === "verified"
                  ? "Личность подтверждена"
                  : "Анкета ожидает проверки"}
          </p>
          <div className={st.info}>
            <h2>О преподавателе</h2>
            <FormattedText value={tutor.bio} />
            {!!tutor.education_entries?.length && (
              <>
                <h3>Образование</h3>
                {tutor.education_entries.map((e, i) => (
                  <p key={i}>
                    <strong>{e.institution}</strong>
                    <br />
                    {[
                      e.degree,
                      e.field,
                      e.status === "studying" ? "Продолжает учиться" : e.year,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}
              </>
            )}
            {!!tutor.certificates?.length && (
              <>
                <h3>Сертификаты</h3>
                {tutor.certificates.map((c, i) => (
                  <p key={i}>
                    {[c.name, c.issuer, c.result, c.year]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}
                <small>Сведения указаны преподавателем.</small>
              </>
            )}
            {!!tutor.spoken_languages?.length && (
              <>
                <h3>Владение языками</h3>
                <p>
                  {tutor.spoken_languages
                    .map((l) => l.language + " · " + l.level)
                    .join(", ")}
                </p>
              </>
            )}
            {tutor.teaching_approach && (
              <>
                <h3>Подход к занятиям</h3>
                <p>{tutor.teaching_approach}</p>
              </>
            )}
            {tutor.audience && (
              <>
                <h3>С кем работает</h3>
                <p>{tutor.audience}</p>
              </>
            )}
            {tutor.education && (
              <>
                <h3>Образование и квалификация</h3>
                <p>{tutor.education}</p>
              </>
            )}
            {tutor.lesson_plan && (
              <>
                <h3>Первый урок</h3>
                <FormattedText value={tutor.lesson_plan} />
              </>
            )}
          </div>
          {!!tutor.offerings?.length && (
            <div className={st.info}>
              <h2>Направления занятий</h2>
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
                    {o.subject} · {o.exam} · {o.languages.join(", ")} ·{" "}
                    {o.format === "online" ? "Онлайн" : o.city}
                  </p>
                  <FormattedText value={o.description} />
                  <strong>
                    {o.price === 0 ? "Бесплатно" : money(o.price)}
                  </strong>
                  {!own && !example && (
                    <button className={st.link} onClick={() => request(o)}>
                      Предложить время по этому направлению
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
              <h2>Мини-группы</h2>
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
                      {lessonDate(g.starts_at)} · UTC+5 · мест{" "}
                      {g.capacity - g.reserved}
                    </small>
                  </span>
                  <strong>{money(g.price)}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className={st.reserve}>
          <h2>Ваш первый урок</h2>
          <p className={st.rate}>
            <strong>
              {firstPrice === 0 ? "Бесплатно" : money(firstPrice)}
            </strong>
            <span> за 60 минут</span>
          </p>
          {!editable && (
            <p className={st.bookingNote}>
              60 минут с преподавателем. Запись без списания денег;
              онлайн-оплата пока не подключена.
            </p>
          )}
          {editable ? (
            <button className="primary" onClick={edit}>
              Редактировать анкету
            </button>
          ) : (
            <>
              {slots.length > 0 ? (
                <>
                  <h3>Ближайшие даты</h3>
                  <small>Время Казахстана · UTC+5</small>
                  {orderedSlots.slice(0, all ? undefined : 4).map((slot) => (
                    <button
                      className={st.slot}
                      key={slot.id}
                      disabled={example}
                      onClick={() => book(slot)}
                    >
                      <span>{lessonDate(slot.starts_at)}</span>
                      <strong>{money(slot.price)}</strong>
                    </button>
                  ))}
                  {slots.length > 4 && !all && (
                    <button className={st.link} onClick={() => setAll(true)}>
                      Показать все даты
                    </button>
                  )}
                </>
              ) : (
                <p>
                  Свободных дат в расписании пока нет. Предложите удобное время
                  и бюджет.
                </p>
              )}
              {contact && (
                <button
                  className={slots.length ? "secondary" : "primary"}
                  onClick={contact}
                >
                  Написать преподавателю
                </button>
              )}
              <button
                className={slots.length || contact ? st.link : "primary"}
                onClick={() => request()}
                disabled={example}
              >
                Предложить время и цену
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
