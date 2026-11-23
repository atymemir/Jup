"use client";
import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api } from "../lib/api";
import { fetchJson } from "../lib/http";
import { getSupabase } from "../lib/supabase";
import {
  roleHome,
  studentReady,
  roleLabels,
  type Account,
  type PlatformDashboard,
} from "../lib/platform";
import { TutorForm } from "../profiles/TutorProfile";
import FindBuddy from "../FindBuddy";
import { Icon, type IconName } from "../ui/Icon";
import { StudentProfile } from "./StudentProfile";
import { Offerings } from "./Offerings";
import { OrganizationDesk } from "./Organization";
import { Moderation } from "./Moderation";
import { OrganizationChat } from "./OrganizationChat";
import { usePlatformAction } from "./usePlatformAction";
import st from "./platform.module.css";
type Area = "public" | "student" | "teacher" | "business" | "admin";
type Nav = [string, string, IconName, boolean];
const navigation: Record<Exclude<Area, "public">, Nav[]> = {
  student: [
    ["account", "Занятия", "calendar", true],
    ["tutors", "Поиск", "search", true],
    ["messages", "Сообщения", "requests", true],
    ["profile", "Мой профиль", "teacher", true],
    ["requests", "Заявки", "requests", false],
    ["centers", "Чаты центров", "groups", false],
  ],
  teacher: [
    ["overview", "Главная", "teacher", true],
    ["schedule", "Расписание", "calendar", true],
    ["students", "Ученики", "groups", false],
    ["requests", "Заявки", "requests", false],
    ["messages", "Сообщения", "requests", true],
    ["profile", "Моя анкета", "teacher", true],
    ["offerings", "Направления", "search", false],
    ["centers", "Учебные центры", "groups", false],
    ["wallet", "Расчёты в пилоте", "calendar", false],
  ],
  business: [
    ["overview", "Главная", "teacher", true],
    ["team", "Команда", "groups", true],
    ["schedule", "Расписание", "calendar", true],
    ["messages", "Сообщения", "requests", true],
    ["offerings", "Направления", "search", false],
    ["students", "Ученики", "groups", false],
    ["page", "Страница центра", "teacher", false],
  ],
  admin: [
    ["queue", "Проверки", "requests", true],
    ["teachers", "Преподаватели", "teacher", false],
    ["organizations", "Центры", "groups", false],
    ["reports", "Обращения", "requests", true],
    ["audit", "История", "calendar", true],
    ["staff", "Модераторы", "groups", true],
  ],
};
function watchHash(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
export default function AppEntry({ area = "public" }: { area?: Area }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exiting, setExiting] = useState(false);
  const version = useRef(0);
  const initial =
    area === "teacher" || area === "business"
      ? "overview"
      : area === "admin"
        ? "queue"
        : "account";
  const hash = useSyncExternalStore(
    watchHash,
    () => window.location.hash.slice(1),
    () => "",
  );
  const panel = hash.split("/")[0] || initial;
  const live = useRef(false);
  const refresh = useCallback(() => {
    const n = ++version.current;
    return api<{ account: Account | null }>("viewer")
      .then(async (viewer) => {
        if (!live.current || version.current !== n) return;
        setAccount(viewer.account);
        if (viewer.account) {
          const p = await api<PlatformDashboard>("platform");
          if (!live.current || version.current !== n) return;
          setData(p);
        } else setData(null);
        setError("");
      })
      .catch((e) => {
        if (live.current && version.current === n)
          setError(
            e instanceof Error ? e.message : "Не удалось открыть кабинет.",
          );
      })
      .finally(() => {
        if (live.current && version.current === n) setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (area === "public") return;
    live.current = true;
    void refresh();
    let lastRefresh = Date.now();
    let pending = false;
    const update = async () => {
      if (pending || document.hidden || Date.now() - lastRefresh < 10000) return;
      lastRefresh = Date.now();
      pending = true;
      try {
        await refresh();
      } finally {
        pending = false;
      }
    };
    window.addEventListener("focus", update);
    const timer = setInterval(() => {
      update();
    }, 15000);
    return () => {
      live.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [area, refresh]);
  if (area === "public") return <FindBuddy />;
  const expected =
    area === "admin"
      ? account?.role === "owner" || account?.role === "moderator"
      : account?.role === area;
  if (loading)
    return (
      <main className={st.public}>
        <LoadingState label="Открываем ваш кабинет…" />
      </main>
    );
  if (!account || !expected)
    return (
      <main className={st.public}>
        <header className={st.publicHeader}>
          <Link className={st.brand} href="/">
            <Brand />
          </Link>
        </header>
        <section className={st.hero}>
          <div>
            <p className={st.eyebrow}>
              {area === "teacher"
                ? "Для преподавателей"
                : area === "business"
                  ? "Для учебных центров"
                  : area === "admin"
                    ? "Команда Jup edu"
                    : "Кабинет ученика"}
            </p>
            <h1>
              {account
                ? "У этого аккаунта другой кабинет"
                : "Войдите в свой кабинет"}
            </h1>
            <p>
              {account
                ? `Вы зарегистрированы как «${roleLabels[account.role]}». Откройте свой кабинет, чтобы продолжить.`
                : "Ученики, преподаватели и учебные центры работают в отдельных кабинетах."}
            </p>
            <div className={st.actions}>
              {account && (
                <a className="primary" href={roleHome(account.role)}>
                  В свой кабинет
                </a>
              )}
              <Link
                className={account ? "secondary" : "primary"}
                href={
                  "/login?role=" +
                  (area === "teacher"
                    ? "teacher"
                    : area === "business"
                      ? "business"
                      : "student")
                }
              >
                Войти
              </Link>
              {area !== "admin" && (
                <Link
                  className={st.textButton}
                  href={
                    "/login?mode=signup&role=" +
                    (area === "teacher"
                      ? "teacher"
                      : area === "business"
                        ? "business"
                        : "student")
                  }
                >
                  Создать аккаунт
                </Link>
              )}
            </div>
            {error && (
              <p className={st.error}>
                {error}
                <button onClick={() => void refresh()}>Повторить</button>
              </p>
            )}
          </div>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className={st.public}>
        <p className={st.error}>{error || "Кабинет пока не загрузился."}</p>
        <button className="secondary" onClick={() => void refresh()}>
          Повторить загрузку
        </button>
      </main>
    );
  if (area === "student" && panel === "account" && !studentReady(data.student_profile))
    return (
      <main className="onboardingPage">
        <header><Link className={st.brand} href="/"><Brand /></Link><Link href="/#tutors">К поиску</Link></header>
        <StudentProfile key={account.id} profile={data.student_profile} refresh={refresh} onComplete={(search) => { location.assign("/findbuddy?" + search + "#tutors"); }} />
      </main>
    );
  const name =
    account.role === "business"
      ? data.organization?.name
      : account.role === "teacher"
        ? data.tutor?.display_name
        : data.student_profile?.name;
  const nav = navigation[area].filter(
    ([key]) => key !== "staff" || account.role === "owner",
  );
  let content;
  if (area === "business")
    content = <OrganizationDesk data={data} panel={panel} refresh={refresh} />;
  else if (area === "admin")
    content = <Moderation data={data} panel={panel} refresh={refresh} />;
  else if (area === "student" && panel === "profile")
    content = (
      <StudentProfile
        key={account.id}
        profile={data.student_profile}
        refresh={refresh}
        onComplete={!studentReady(data.student_profile) ? (search) => { location.assign("/findbuddy?" + search + "#tutors"); } : undefined}
      />
    );
  else if (area === "student" && panel === "centers")
    content = <OrganizationChat data={data} refresh={refresh} />;
  else if (area === "teacher" && panel === "profile")
    content = <TeacherProfile data={data} refresh={refresh} />;
  else if (area === "teacher" && panel === "offerings")
    content = <Offerings offerings={data.offerings} refresh={refresh} />;
  else if (area === "teacher" && panel === "centers")
    content = <TeacherCenters data={data} refresh={refresh} />;
  else
    content = (
      <FindBuddy
        teacherMode={area === "teacher" && panel !== "account"}
        embedded
      />
    );
  return (
    <div className={st.root}>
      <aside className={st.sidebar}>
        <div>
          <Link className={st.brand} href="/">
            <Brand />
          </Link>
          <p className={st.roleLabel}>{roleLabels[account.role]}</p>
        </div>
        <nav className={st.nav} aria-label="Ваш кабинет">
          {nav.map(([id, label, icon, mobile]) => (
            <a
              key={id}
              href={"#" + id}
              className={mobile ? undefined : st.desktopOnly}
              aria-current={panel === id ? "page" : undefined}
            >
              <Icon name={icon} size={19} />
              {label}
            </a>
          ))}
        </nav>
        <div className={st.sidebarFoot}>
          <Link href="/">Публичный каталог</Link>
          <p>Бесплатный пилот · комиссия 0%</p>
        </div>
      </aside>
      <div className={st.body}>
        <header className={st.topbar}>
          <div>
            <strong>{name || roleLabels[account.role]}</strong>
            <p>
              {account.role === "teacher"
                ? "Ваши ученики и занятия"
                : account.role === "business"
                  ? "Команда и занятия центра"
                  : account.role === "owner" || account.role === "moderator"
                    ? "Проверка анкет и обращений"
                    : "Ваш путь к учебной цели"}
            </p>
          </div>
          <button
            className={st.textButton}
            disabled={exiting}
            onClick={async () => {
              setExiting(true);
              try {
                const m = await fetchJson<{ preview: boolean }>(
                  "/findbuddy/api/preview",
                );
                if (m.preview)
                  await fetchJson("/findbuddy/api/preview", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "logout" }),
                  });
                else {
                  const r = await getSupabase().auth.signOut({ scope: "local" });
                  if (r.error) throw r.error;
                }
                location.assign("/findbuddy");
              } catch {
                setError("Не удалось выйти. Проверьте соединение.");
                setExiting(false);
              }
            }}
          >
            {exiting ? "Выходим…" : "Выйти"}
          </button>
        </header>
        <div className={st.content}>
          {error && (
            <div className={st.error} role="alert">
              {error}
              <button className={st.textButton} onClick={() => void refresh()}>
                Повторить загрузку
              </button>
            </div>
          )}
          {content}
        </div>
      </div>
    </div>
  );
}
function TeacherProfile({
  data,
  refresh,
}: {
  data: PlatformDashboard;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  return (
    <main className={st.stack}>
      <header>
        <p className={st.eyebrow}>Личная анкета преподавателя</p>
        <h1>
          {data.tutor ? "Ваш опыт и подход" : "Познакомим учеников с вами"}
        </h1>
        <p>
          Образование, языки и первый урок. Отдельные предметы и цены
          настраиваются в направлениях.
        </p>
        <div className={st.actions}>
          <a className={st.textButton} href="#offerings">
            Предметы и цены
          </a>
          <a className={st.textButton} href="#centers">
            Мои учебные центры
          </a>
        </div>
        {data.tutor && (
          <p className={st.notice}>
            Статус:{" "}
            {data.tutor.verification === "verified"
              ? "Профиль проверен"
              : data.tutor.verification === "pending"
                ? "На проверке"
                : "Нужна доработка"}
            . Изменение имени или фото требует повторной проверки.
          </p>
        )}
      </header>
      {data.tutor_review_note && (
        <p className={st.notice}>
          Комментарий модератора: {data.tutor_review_note}
        </p>
      )}
      <TutorForm
        key={formVersion}
        tutor={data.tutor ?? undefined}
        name={data.account_name ?? undefined}
        privatePhoto={data.private_photo}
        busy={busy}
        save={async (values) => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await api("", "save_profile", values);
            await refresh();
            setFormVersion((v) => v + 1);
            setNotice(
              "Анкета сохранена. После проверки станут доступны новые записи.",
            );
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Не удалось сохранить анкету.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && (
        <p className={st.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={st.notice} role="status">
          {notice} <a href="#offerings">Открыть направления</a>
        </p>
      )}
    </main>
  );
}
function TeacherCenters({
  data,
  refresh,
}: {
  data: PlatformDashboard;
  refresh: () => Promise<void>;
}) {
  const { run, busy, status } = usePlatformAction(refresh);
  return (
    <main className={st.stack}>
      <header>
        <h1>Учебные центры</h1>
        <p>
          Вы принимаете каждое приглашение самостоятельно. Центр управляет
          только занятиями от своего имени, ваши личные диалоги остаются
          закрытыми.
        </p>
      </header>
      {data.members
        .filter((m) => m.state === "active")
        .map((m) => (
          <div className={st.listRow} key={m.organization_id}>
            <strong>{m.organization_name}</strong>
            <button
              className={st.textButton}
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Выйти из команды? Существующие занятия сохранятся, новая запись закроется.",
                  )
                )
                  void run(
                    "remove_member",
                    {
                      teacher_id: data.account.id,
                      organization_id: m.organization_id,
                    },
                    "Вы вышли из команды.",
                  );
              }}
            >
              Выйти из команды
            </button>
          </div>
        ))}
      {!data.members.some((m) => m.state === "active") && (
        <p>
          Пока нет подключённых центров. Владелец центра может прислать вам
          личное приглашение.
        </p>
      )}
      {status}
    </main>
  );
}
