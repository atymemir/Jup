"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import Link from "next/link";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { lessonDate, money, type Catalog } from "../lib/findbuddy";
import { type PlatformDashboard, type Account } from "../lib/platform";
import { OrganizationChat } from "./OrganizationChat";
import { ReportProfile } from "./ReportProfile";
import st from "./platform.module.css";
export function Centers({ id }: { id?: string }) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const [catalog, setCatalog] = useState<Catalog>({ tutors: [], groups: [] });
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chat, setChat] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now);
  const refresh = useCallback(
    () =>
      api<Catalog>("")
        .then(async (catalog) => {
          setCatalog(catalog);
          const v = await api<{ account: Account | null }>("viewer");
          if (v.account?.role === "student")
            setData(await api<PlatformDashboard>("platform"));
          else setData(null);
          setError("");
        })
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить центры.",
          ),
        )
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const g = catalog.organizations?.find((g) => g.id === id);
  const slots = catalog.groups.filter(
    (s) =>
      s.organization_id === id &&
      !s.enrollment_closed &&
      s.reserved < s.capacity &&
      Date.parse(s.starts_at) > now + 1800000,
  );
  const offerings = catalog.tutors
    .flatMap((t) => t.offerings ?? [])
    .filter((o) => o.organization_id === id);
  return (
    <main className={st.public}>
      <header className={st.publicHeader}>
        <Link className={st.brand} href="/">
          <Brand />
        </Link>
        <LanguageSwitcher />
        <nav>
          <Link href="/">{tr("Преподаватели и занятия")}</Link>
          <Link href="/for-centers">{tr("Для центров")}</Link>
          <Link href={data ? "/student" : "/login"}>
            {tr(data ? tr("Мои занятия") : tr("Войти"))}
          </Link>
        </nav>
      </header>
      {loading ? (
        <LoadingState label={tr("Загружаем учебные центры…")} />
      ) : error ? (
        <p className={st.error} role="alert">
          {tr(error)}
          <button onClick={() => void refresh()}>{tr("Повторить")}</button>
        </p>
      ) : id && !g ? (
        <section className={st.empty}>
          <h1>{tr("Страница пока недоступна")}</h1>
          <p>
            {tr(
              "Центр может проходить проверку или временно скрыть публикацию.",
            )}
          </p>
          <Link className="secondary" href="/centers">
            {tr("Другие центры")}
          </Link>
        </section>
      ) : g ? (
        <section className={st.stack} style={{ padding: "32px 0" }}>
          <Link className={st.textButton} href="/centers">
            {tr("Все учебные центры")}
          </Link>
          <header>
            <Logo name={g.name} image={g.logo} />
            <p className={st.eyebrow}>
              {tr("Учебный центр · профиль проверен")}
            </p>
            <h1>{g.name}</h1>
            <p>
              {tr(g.city)} ·{tr(" ")}
              {tr(
                g.format === "online"
                  ? tr("Онлайн")
                  : g.format === "both"
                    ? tr("Онлайн и очно")
                    : tr("Очно"),
              )}
            </p>
          </header>
          <p style={{ whiteSpace: "pre-wrap" }}>{g.description}</p>
          {g.website && (
            <a
              className={st.textButton}
              href={g.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tr("Сайт центра")}
            </a>
          )}
          <div className={st.actions}>
            <button className="primary" onClick={() => setChat(!chat)}>
              {tr(chat ? tr("Скрыть переписку") : tr("Задать вопрос центру"))}
            </button>
            <a className={st.textButton} href="#center-slots">
              {tr("Выбрать занятие")}
            </a>
          </div>
          {chat &&
            (data ? (
              <OrganizationChat
                data={data}
                refresh={refresh}
                organizationId={g.id}
              />
            ) : (
              <p className={st.notice}>
                {tr("Для переписки нужен аккаунт ученика.")}
                {tr(" ")}
                <Link href="/login?role=student">{tr("Войти")}</Link>
              </p>
            ))}
          <section className={st.stack}>
            <h2>{tr("Преподаватели команды")}</h2>
            <div className={st.tileGrid}>
              {catalog.tutors
                .filter((t) => g.teachers?.includes(t.id))
                .map((t) => (
                  <article className={st.tile} key={t.id}>
                    <h3>{t.display_name}</h3>
                    <p>{t.headline}</p>
                    <Link
                      className={st.textButton}
                      href={"/#tutors/profile/" + t.id}
                    >
                      {tr("Открыть анкету")}
                    </Link>
                  </article>
                ))}
            </div>
            {!g.teachers?.length && (
              <p>{tr("Команда готовится к публикации.")}</p>
            )}
          </section>
          <section className={st.stack}>
            <h2>{tr("Направления")}</h2>
            {offerings.map((o) => (
              <article className={st.listRow} key={o.id}>
                <div>
                  <strong>{o.title}</strong>
                  <p>
                    {tr(o.subject)} · {tr(o.exam)} ·{" "}
                    {tr(o.languages.join(", "))}
                  </p>
                </div>
                <strong>
                  {tr(
                    o.price === 0 ? tr("Бесплатно") : money(o.price, uiLocale),
                  )}
                </strong>
              </article>
            ))}
          </section>
          <section id="center-slots" className={st.stack}>
            <h2>{tr("Ближайшие занятия")}</h2>
            {slots.length ? (
              slots.map((s) => (
                <article key={s.id} className={st.listRow}>
                  <div>
                    <strong>{s.title}</strong>
                    <p>
                      {tr(lessonDate(s.starts_at, uiLocale))} · UTC+5 ·{" "}
                      {tr(s.language)}
                    </p>
                    <small>
                      {tr(
                        s.capacity === 1
                          ? tr("Индивидуально")
                          : tr("В группе \u00B7 мест {0}", [
                              s.capacity - s.reserved,
                            ]),
                      )}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {tr(
                        s.price === 0
                          ? tr("Бесплатно")
                          : money(s.price, uiLocale),
                      )}
                    </strong>
                    <Link
                      className="primary"
                      href={"/?continue=" + encodeURIComponent("join/" + s.id)}
                    >
                      {tr("Записаться")}
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p>
                {tr("Открытых дат пока нет. Уточните расписание у центра.")}
              </p>
            )}
          </section>
          <ReportProfile kind="organization" id={g.id} />
        </section>
      ) : (
        <section className={st.stack} style={{ padding: "40px 0" }}>
          <header>
            <p className={st.eyebrow}>{tr("Проверенные учебные центры")}</p>
            <h1>{tr("Занимайтесь с целой командой")}</h1>
            <p>
              {tr(
                "Посмотрите направления, преподавателей и открытые даты центра.",
              )}
            </p>
          </header>
          <label className={st.fields}>
            {tr("Поиск центра")}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Название, город или направление")}
            />
          </label>
          <div className={st.tileGrid}>
            {catalog.organizations
              ?.filter((g) =>
                (g.name + " " + g.city + " " + g.description)
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
              )
              .map((g) => (
                <article className={st.tile} key={g.id}>
                  <Logo name={g.name} image={g.logo} />
                  <span className={st.pill}>{tr("Профиль проверен")}</span>
                  <h2>{g.name}</h2>
                  <p>
                    {tr(g.city)} · {g.description.slice(0, 180)}
                  </p>
                  <Link className="primary" href={"/centers/" + g.id}>
                    {tr("Страница центра")}
                  </Link>
                </article>
              ))}
          </div>
          {!catalog.organizations?.length && (
            <div className={st.empty}>
              <h2>{tr("Первые центры проходят проверку")}</h2>
              <p>{tr("Пока можно выбрать личного преподавателя.")}</p>
              <Link href="/" className="secondary">
                {tr("Найти преподавателя")}
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
function Logo({ name, image }: { name: string; image: string }) {
  const { t: tr } = useJupLocale();

  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={st.logo}
      src={"data:image/jpeg;base64," + image}
      alt={tr(tr("Логотип ") + name)}
      width={72}
      height={72}
    />
  ) : (
    <div className={st.logo} aria-hidden="true">
      {name.slice(0, 1)}
    </div>
  );
}
