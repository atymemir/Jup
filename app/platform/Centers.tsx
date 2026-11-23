"use client";
import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { lessonDate, money, type Catalog } from "../lib/findbuddy";
import { type PlatformDashboard, type Account } from "../lib/platform";
import { OrganizationChat } from "./OrganizationChat";
import { ReportProfile } from "./ReportProfile";
import st from "./platform.module.css";
export function Centers({ id }: { id?: string }) {
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
        <nav>
          <Link href="/">Преподаватели и занятия</Link>
          <Link href="/for-centers">Для центров</Link>
          <Link href={data ? "/student" : "/login"}>
            {data ? "Мои занятия" : "Войти"}
          </Link>
        </nav>
      </header>
      {loading ? (
        <LoadingState label="Загружаем учебные центры…" />
      ) : error ? (
        <p className={st.error} role="alert">
          {error}
          <button onClick={() => void refresh()}>Повторить</button>
        </p>
      ) : id && !g ? (
        <section className={st.empty}>
          <h1>Страница пока недоступна</h1>
          <p>Центр может проходить проверку или временно скрыть публикацию.</p>
          <Link className="secondary" href="/centers">
            Другие центры
          </Link>
        </section>
      ) : g ? (
        <section className={st.stack} style={{ padding: "32px 0" }}>
          <Link className={st.textButton} href="/centers">
            Все учебные центры
          </Link>
          <header>
            <Logo name={g.name} image={g.logo} />
            <p className={st.eyebrow}>Учебный центр · профиль проверен</p>
            <h1>{g.name}</h1>
            <p>
              {g.city} ·{" "}
              {g.format === "online"
                ? "Онлайн"
                : g.format === "both"
                  ? "Онлайн и очно"
                  : "Очно"}
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
              Сайт центра
            </a>
          )}
          <div className={st.actions}>
            <button className="primary" onClick={() => setChat(!chat)}>
              {chat ? "Скрыть переписку" : "Задать вопрос центру"}
            </button>
            <a className={st.textButton} href="#center-slots">
              Выбрать занятие
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
                Для переписки нужен аккаунт ученика.{" "}
                <Link href="/login?role=student">Войти</Link>
              </p>
            ))}
          <section className={st.stack}>
            <h2>Преподаватели команды</h2>
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
                      Открыть анкету
                    </Link>
                  </article>
                ))}
            </div>
            {!g.teachers?.length && <p>Команда готовится к публикации.</p>}
          </section>
          <section className={st.stack}>
            <h2>Направления</h2>
            {offerings.map((o) => (
              <article className={st.listRow} key={o.id}>
                <div>
                  <strong>{o.title}</strong>
                  <p>
                    {o.subject} · {o.exam} · {o.languages.join(", ")}
                  </p>
                </div>
                <strong>{o.price === 0 ? "Бесплатно" : money(o.price)}</strong>
              </article>
            ))}
          </section>
          <section id="center-slots" className={st.stack}>
            <h2>Ближайшие занятия</h2>
            {slots.length ? (
              slots.map((s) => (
                <article key={s.id} className={st.listRow}>
                  <div>
                    <strong>{s.title}</strong>
                    <p>
                      {lessonDate(s.starts_at)} · UTC+5 · {s.language}
                    </p>
                    <small>
                      {s.capacity === 1
                        ? "Индивидуально"
                        : `В группе · мест ${s.capacity - s.reserved}`}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {s.price === 0 ? "Бесплатно" : money(s.price)}
                    </strong>
                    <Link
                      className="primary"
                      href={"/?continue=" + encodeURIComponent("join/" + s.id)}
                    >
                      Записаться
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p>Открытых дат пока нет. Уточните расписание у центра.</p>
            )}
          </section>
          <ReportProfile kind="organization" id={g.id} />
        </section>
      ) : (
        <section className={st.stack} style={{ padding: "40px 0" }}>
          <header>
            <p className={st.eyebrow}>Проверенные учебные центры</p>
            <h1>Занимайтесь с целой командой</h1>
            <p>
              Посмотрите направления, преподавателей и открытые даты центра.
            </p>
          </header>
          <label className={st.fields}>
            Поиск центра
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, город или направление"
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
                  <span className={st.pill}>Профиль проверен</span>
                  <h2>{g.name}</h2>
                  <p>
                    {g.city} · {g.description.slice(0, 180)}
                  </p>
                  <Link className="primary" href={"/centers/" + g.id}>
                    Страница центра
                  </Link>
                </article>
              ))}
          </div>
          {!catalog.organizations?.length && (
            <div className={st.empty}>
              <h2>Первые центры проходят проверку</h2>
              <p>Пока можно выбрать личного преподавателя.</p>
              <Link href="/" className="secondary">
                Найти преподавателя
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
function Logo({ name, image }: { name: string; image: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={st.logo}
      src={"data:image/jpeg;base64," + image}
      alt={"Логотип " + name}
      width={72}
      height={72}
    />
  ) : (
    <div className={st.logo} aria-hidden="true">
      {name.slice(0, 1)}
    </div>
  );
}
