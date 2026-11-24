"use client";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Notifications } from "../notifications/Notifications";
import { NotificationBell } from "../notifications/NotificationBell";
import { useNotifications } from "../notifications/useNotifications";
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
import { Icon, type IconName } from "../ui/Icon";
import { StudentProfile } from "./StudentProfile";
import { usePlatformAction } from "./usePlatformAction";
import st from "./platform.module.css";
import { WorkspaceSearch } from "../ui/WorkspaceSearch";
function SectionLoading() {
  const { t } = useJupLocale();
  return <LoadingState label={t("Открываем раздел…")} />;
}
const FindBuddy = dynamic(() => import("../FindBuddy"), {
  loading: SectionLoading,
});
const Offerings = dynamic(
  () => import("./Offerings").then((m) => m.Offerings),
  { loading: SectionLoading },
);
const OrganizationDesk = dynamic(
  () => import("./Organization").then((m) => m.OrganizationDesk),
  { loading: SectionLoading },
);
const Moderation = dynamic(
  () => import("./Moderation").then((m) => m.Moderation),
  { loading: SectionLoading },
);
const OrganizationChat = dynamic(
  () => import("./OrganizationChat").then((m) => m.OrganizationChat),
  { loading: SectionLoading },
);
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
    ["overview", "Главная", "home", true],
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
    ["overview", "Главная", "home", true],
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
  const { t: tr } = useJupLocale();

  const [account, setAccount] = useState<Account | null>(null);
  const notifications = useNotifications(account?.id ?? null);
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
        setAccount((current) =>
          current?.id === viewer.account?.id &&
          current?.role === viewer.account?.role
            ? current
            : viewer.account,
        );
        if (viewer.account) {
          const p = await api<PlatformDashboard>("platform");
          if (!live.current || version.current !== n) return;
          setData((current) =>
            JSON.stringify(current) === JSON.stringify(p) ? current : p,
          );
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
      if (
        pending ||
        document.hidden ||
        document.activeElement?.closest("form") ||
        Date.now() - lastRefresh < 10000
      )
        return;
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
    }, 30000);
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
  if (loading) return <WorkspaceLoading area={area} panel={panel} />;
  if (!account || !expected)
    return (
      <main className={st.public}>
        <header className={st.publicHeader}>
          <Link className={st.brand} href="/">
            <Brand />
          </Link>
          <LanguageSwitcher />
        </header>
        <section className={st.hero}>
          <div>
            <p className={st.eyebrow}>
              {tr(
                area === "teacher"
                  ? tr("Для преподавателей")
                  : area === "business"
                    ? tr("Для учебных центров")
                    : area === "admin"
                      ? tr("Команда Jup edu")
                      : tr("Кабинет ученика"),
              )}
            </p>
            <h1>
              {tr(
                account
                  ? tr("У этого аккаунта другой кабинет")
                  : tr("Войдите в свой кабинет"),
              )}
            </h1>
            <p>
              {tr(
                account
                  ? tr(
                      "Вы зарегистрированы как \u00AB{0}\u00BB. Откройте свой кабинет, чтобы продолжить.",
                      [roleLabels[account.role]],
                    )
                  : tr(
                      "Ученики, преподаватели и учебные центры работают в отдельных кабинетах.",
                    ),
              )}
            </p>
            <div className={st.actions}>
              {account && (
                <a className="primary" href={roleHome(account.role)}>
                  {tr("В свой кабинет")}
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
                {tr("Войти")}
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
                  {tr("Создать аккаунт")}
                </Link>
              )}
            </div>
            {error && (
              <p className={st.error}>
                {tr(error)}
                <button onClick={() => void refresh()}>
                  {tr("Повторить")}
                </button>
              </p>
            )}
          </div>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className={st.public}>
        <p className={st.error}>
          {tr(error || tr("Кабинет пока не загрузился."))}
        </p>
        <button className="secondary" onClick={() => void refresh()}>
          {tr("Повторить загрузку")}
        </button>
      </main>
    );
  if (
    area === "student" &&
    panel === "account" &&
    !studentReady(data.student_profile)
  )
    return (
      <main className="onboardingPage">
        <header>
          <Link className={st.brand} href="/">
            <Brand />
          </Link>
          <LanguageSwitcher />
          <Link href="/#tutors">{tr("К поиску")}</Link>
        </header>
        <StudentProfile
          key={account.id}
          profile={data.student_profile}
          refresh={refresh}
          onComplete={(search) => {
            location.assign("/findbuddy?" + search + "#tutors");
          }}
        />
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
  if (panel === "notifications")
    content = <Notifications state={notifications} role={account.role} />;
  else if (area === "business")
    content = <OrganizationDesk data={data} panel={panel} refresh={refresh} />;
  else if (area === "admin")
    content = (
      <Moderation key={panel} data={data} panel={panel} refresh={refresh} />
    );
  else if (area === "student" && panel === "profile")
    content = (
      <StudentProfile
        key={account.id}
        profile={data.student_profile}
        refresh={refresh}
        onComplete={
          !studentReady(data.student_profile)
            ? (search) => {
                location.assign("/findbuddy?" + search + "#tutors");
              }
            : undefined
        }
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
          <p className={st.roleLabel}>{tr(roleLabels[account.role])}</p>
        </div>
        <nav className={st.nav} aria-label={tr("Ваш кабинет")}>
          <span className={st.navCaption}>{tr("Рабочее пространство")}</span>
          <a
            href="#notifications"
            aria-current={panel === "notifications" ? "page" : undefined}
          >
            <Icon name="bell" size={19} />
            {tr("События")}
            {(notifications.data?.unread ?? 0) > 0 && (
              <span className="notificationBadge">
                {tr(
                  notifications.data!.unread > 99
                    ? "99+"
                    : notifications.data!.unread,
                )}
              </span>
            )}
          </a>
          {nav.map(([id, label, icon, mobile]) => (
            <a
              key={id}
              href={"#" + id}
              className={mobile ? undefined : st.desktopOnly}
              aria-current={panel === id ? "page" : undefined}
            >
              <Icon name={icon} size={19} />
              {tr(label)}
            </a>
          ))}
        </nav>
        <div className={st.sidebarFoot}>
          <Link href="/">
            <Icon name="globe" size={18} />
            {tr("Публичный каталог")}
            <Icon name="arrow" size={15} />
          </Link>
          <p>{tr("Бесплатный пилот · комиссия 0%")}</p>
        </div>
      </aside>
      <div className={st.body}>
        <header className={st.topbar}>
          <Link href="/" className={st.mobileBrand} aria-label="Jup edu">
            <Brand />
          </Link>
          <div className={st.breadcrumb}>
            <span>{tr(roleLabels[account.role])}</span>
            <Icon name="chevron" size={13} />
            <strong>
              {tr(
                panel === "notifications"
                  ? "Уведомления"
                  : (nav.find(([id]) => id === panel)?.[1] ?? "Мой кабинет"),
              )}
            </strong>
          </div>
          <WorkspaceSearch
            active={
              !nav
                .filter(([, , , mobile]) => mobile)
                .slice(0, 3)
                .some(([id]) => id === panel)
            }
            items={[
              ...nav.map(([id, label, icon]) => ({
                href: "#" + id,
                label,
                icon,
              })),
              { href: "#notifications", label: "Уведомления", icon: "bell" },
              { href: "/", label: "Публичный каталог", icon: "globe" },
              { href: "/telegram", label: "Jup в Telegram", icon: "send" },
            ]}
          />
          <LanguageSwitcher />
          <NotificationBell role={account.role} state={notifications} />
          <button
            className={st.exitButton}
            aria-label={tr("Выйти")}
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
                  const r = await getSupabase().auth.signOut({
                    scope: "local",
                  });
                  if (r.error) throw r.error;
                }
                location.assign("/findbuddy");
              } catch {
                setError("Не удалось выйти. Проверьте соединение.");
                setExiting(false);
              }
            }}
          >
            <Icon name="logout" size={18} />
            <span>{tr(exiting ? tr("Выходим…") : tr("Выйти"))}</span>
          </button>
        </header>
        <div className={st.content}>
          {error && (
            <div className={st.error} role="alert">
              {tr(error)}
              <button className={st.textButton} onClick={() => void refresh()}>
                {tr("Повторить загрузку")}
              </button>
            </div>
          )}
          {content}
        </div>
        <nav className={st.mobileDock} aria-label={tr("Основная навигация")}>
          {nav
            .filter(([, , , mobile]) => mobile)
            .slice(0, 3)
            .map(([id, label, icon]) => (
              <a
                key={id}
                href={"#" + id}
                aria-current={panel === id ? "page" : undefined}
              >
                <Icon name={icon} size={21} />
                <span>{tr(label)}</span>
              </a>
            ))}
        </nav>
      </div>
    </div>
  );
}
function WorkspaceLoading({
  area,
  panel,
}: {
  area: Exclude<Area, "public">;
  panel: string;
}) {
  const { t } = useJupLocale();
  const nav = navigation[area].filter(([id]) => id !== "staff");
  const role = area === "admin" ? "Владелец" : roleLabels[area];
  return (
    <div className={st.root} aria-busy="true">
      <aside className={st.sidebar}>
        <div>
          <Link className={st.brand} href="/">
            <Brand />
          </Link>
          <p className={st.roleLabel}>{t(role)}</p>
        </div>
        <nav className={st.nav} aria-label={t("Ваш кабинет")}>
          <span className={st.navCaption}>{t("Рабочее пространство")}</span>
          <a href="#notifications">
            <Icon name="bell" size={19} />
            {t("События")}
          </a>
          {nav.map(([id, label, icon, mobile]) => (
            <a
              key={id}
              href={"#" + id}
              className={mobile ? undefined : st.desktopOnly}
              aria-current={id === panel ? "page" : undefined}
            >
              <Icon name={icon} size={19} />
              {t(label)}
            </a>
          ))}
        </nav>
        <div className={st.sidebarFoot}>
          <Link href="/">
            <Icon name="globe" size={18} />
            {t("Публичный каталог")}
            <Icon name="arrow" size={15} />
          </Link>
          <p>{t("Бесплатный пилот · комиссия 0%")}</p>
        </div>
      </aside>
      <div className={st.body}>
        <header className={st.topbar}>
          <Link href="/" className={st.mobileBrand} aria-label="Jup edu">
            <Brand />
          </Link>
          <div className={st.breadcrumb}>
            <span>{t(role)}</span>
            <Icon name="chevron" size={13} />
            <strong>
              {t(nav.find(([id]) => id === panel)?.[1] ?? "Мой кабинет")}
            </strong>
          </div>
          <WorkspaceSearch
            items={nav.map(([id, label, icon]) => ({
              href: "#" + id,
              label,
              icon,
            }))}
          />
          <LanguageSwitcher />
          <button
            className="notificationBell"
            aria-label={t("Уведомления")}
            disabled
          >
            <Icon name="bell" size={21} />
          </button>
          <button className={st.exitButton} aria-label={t("Выйти")} disabled>
            <Icon name="logout" size={18} />
          </button>
        </header>
        <main className={st.content}>
          <LoadingState />
        </main>
        <nav className={st.mobileDock} aria-label={t("Основная навигация")}>
          {nav
            .filter(([, , , mobile]) => mobile)
            .slice(0, 3)
            .map(([id, label, icon]) => (
              <a
                key={id}
                href={"#" + id}
                aria-current={id === panel ? "page" : undefined}
              >
                <Icon name={icon} size={21} />
                <span>{t(label)}</span>
              </a>
            ))}
        </nav>
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
  const { t: tr } = useJupLocale();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  return (
    <main className={st.stack}>
      <header>
        <p className={st.eyebrow}>{tr("Личная анкета преподавателя")}</p>
        <h1>
          {tr(
            data.tutor
              ? tr("Ваш опыт и подход")
              : tr("Познакомим учеников с вами"),
          )}
        </h1>
        <p>
          {tr(
            "Образование, языки и первый урок. Отдельные предметы и цены настраиваются в направлениях.",
          )}
        </p>
        <div className={st.actions}>
          <a className={st.textButton} href="#offerings">
            {tr("Предметы и цены")}
          </a>
          <a className={st.textButton} href="#centers">
            {tr("Мои учебные центры")}
          </a>
        </div>
        {data.tutor && (
          <p className={st.notice}>
            {tr("Статус:")}
            {tr(" ")}
            {tr(
              data.tutor.verification === "verified"
                ? tr("Профиль проверен")
                : data.tutor.verification === "pending"
                  ? tr("На проверке")
                  : tr("Нужна доработка"),
            )}
            {tr(". Изменение имени или фото требует повторной проверки.")}
          </p>
        )}
      </header>
      {data.tutor_review_note && (
        <p className={st.notice}>
          {tr("Комментарий модератора: ")}
          {tr(data.tutor_review_note)}
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
          {tr(error)}
        </p>
      )}
      {notice && (
        <p className={st.notice} role="status">
          {tr(notice)} <a href="#offerings">{tr("Открыть направления")}</a>
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
  const { t: tr } = useJupLocale();

  const { run, busy, status } = usePlatformAction(refresh);
  return (
    <main className={st.stack}>
      <header>
        <h1>{tr("Учебные центры")}</h1>
        <p>
          {tr(
            "Вы принимаете каждое приглашение самостоятельно. Центр управляет только занятиями от своего имени, ваши личные диалоги остаются закрытыми.",
          )}
        </p>
      </header>
      {data.members
        .filter((m) => m.state === "active")
        .map((m) => (
          <div className={st.listRow} key={m.organization_id}>
            <strong>{tr(m.organization_name)}</strong>
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
              {tr("Выйти из команды")}
            </button>
          </div>
        ))}
      {!data.members.some((m) => m.state === "active") && (
        <p>
          {tr(
            "Пока нет подключённых центров. Владелец центра может прислать вам личное приглашение.",
          )}
        </p>
      )}
      {status}
    </main>
  );
}
