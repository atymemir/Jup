"use client";
import { dateFormatter } from "./lib/localeFormat.mjs";
import { LanguageSwitcher } from "./i18n/LocaleProvider";
import { useLocale as useJupLocale } from "./i18n/LocaleProvider";

import { FormattedText } from "./ui/FormattedText";
import { lessonTimeSuggestions } from "./lib/authoring";
import { DraftFields } from "./authoring/DraftFields";
import { NotificationBell } from "./notifications/NotificationBell";
import { useNotifications } from "./notifications/useNotifications";
import { LoadingState } from "./ui/LoadingState";
import { Brand } from "./ui/Brand";

import { CalendarSubscription } from "./lessons/CalendarSubscription";
import { Calendar } from "./lessons/Calendar";
import { BookingSummary } from "./lessons/BookingSummary";
import { api } from "./lib/api";
import { fetchJson } from "./lib/http";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Card, Pill, PrimaryButton } from "@/app/ui/ui";
import { getSupabase } from "@/app/lib/supabase";
import {
  DEMO_CATALOG,
  EMPTY_DASHBOARD,
  FB_CITIES,
  FB_EXAMS,
  FB_LANGUAGES,
  FB_SUBJECTS,
  filterTutors,
  matchingOfferings,
  kazakhstanDate,
  lessonDate,
  money,
  roomForBooking,
  type Booking,
  type Catalog,
  type Dashboard,
  type Group,
  type StudyRequest,
  type Tutor,
} from "@/app/lib/findbuddy";
import { enrollment, downloadCalendar } from "./lib/schedule";
import {
  initialFilters,
  readCatalogSearch,
  updateCatalogSearch,
  setCatalogFilters as setFilters,
  catalogSnapshot,
  watchCatalogSearch,
} from "./lib/catalogSearch";
import {
  watchShortlist,
  shortlistSnapshot,
  shortlistIds,
  toggleShortlist,
} from "./lib/shortlist";
import { Inbox } from "./inbox/Inbox";
import { useInbox } from "./inbox/useInbox";
import { TeacherOverview } from "./teacher/TeacherOverview";
import { CommissionSummary } from "./teacher/CommissionSummary";
import { outcomeLabel } from "./lib/outcomes";
import { StudentProfile } from "./platform/StudentProfile";
import { studentReady, roleHome } from "./lib/platform";
import {
  authLoginHref,
  currentAuthIntent,
  consumeAuthIntent,
  storedSessionValue,
  forgetSessionValue,
  saveSessionValue,
} from "./lib/authIntent";
import desk from "./teacher/teacher.module.css";
import { TutorReviews } from "./profiles/TutorReviews";
import { SavedComparison } from "./profiles/SavedComparison";
import { TutorCard, tutorPortrait } from "./profiles/TutorCard";
import { TutorPhoto, TutorForm, ProfilePage } from "./profiles/TutorProfile";
import { Icon, type IconName } from "./ui/Icon";
import styles from "./findbuddy.module.css";
import { SiteFooter } from "./ui/SiteFooter";
const Workspace = dynamic(
  () => import("./lessons/Workspace").then((m) => m.Workspace),
  { loading: () => <LoadingState /> },
);
const RoomEditor = dynamic(
  () => import("./lessons/Workspace").then((m) => m.RoomEditor),
  { loading: () => <LoadingState compact /> },
);
const StudentName = dynamic(() =>
  import("./lessons/Workspace").then((m) => m.StudentName),
);

type Tab =
  | "tutors"
  | "groups"
  | "requests"
  | "account"
  | "teacher"
  | "messages";
type Modal =
  | {
      kind: "request";
      tutor?: Tutor;
      offering?: import("./lib/platform").Offering;
    }
  | { kind: "apply" }
  | { kind: "edit"; tutor: Tutor }
  | { kind: "offer"; request: StudyRequest }
  | { kind: "group"; individual?: boolean }
  | { kind: "join"; group: Group };
const tabs: [Tab, string][] = [
  ["tutors", "Каталог"],
  ["groups", "Группы"],
  ["requests", "Заявки"],
  ["messages", "Сообщения"],
  ["account", "Мои занятия"],
  ["teacher", "Я преподаю"],
];

const navIcons: Record<Tab, IconName> = {
  tutors: "search",
  groups: "groups",
  requests: "requests",
  account: "calendar",
  teacher: "teacher",
  messages: "requests",
};

function watchTab(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
const teacherUrl = "/findbuddy/teacher";
const teacherPanels = [
  ["overview", "Обзор", "teacher"],
  ["schedule", "Расписание", "calendar"],
  ["students", "Ученики", "groups"],
  ["messages", "Сообщения", "requests"],
  ["requests", "Заявки", "requests"],
] as const;
function onTeacherRoute() {
  return window.location.pathname.replace(/\/$/, "") === teacherUrl;
}
function currentPath() {
  const hash = window.location.hash.slice(1);
  if (!onTeacherRoute())
    return (
      hash ||
      (window.location.pathname.replace(/\/$/, "").endsWith("/student")
        ? "account"
        : "tutors")
    );
  if (
    ["requests", "messages"].includes(hash) ||
    hash.startsWith("account/") ||
    hash.startsWith("messages/")
  )
    return hash;
  return "teacher/" + (hash || "overview");
}
function openTeacher(panel = "overview") {
  const hash = panel === "overview" ? "" : "#" + panel;
  if (!onTeacherRoute()) window.location.assign(teacherUrl + hash);
  else if (currentPath() !== "teacher/" + panel && currentPath() !== panel)
    window.location.hash = hash;
  window.scrollTo({ top: 0 });
}
function setTab(tab: Tab) {
  if (tab === "teacher") {
    openTeacher();
    return;
  }
  if (onTeacherRoute() && tab !== "requests" && tab !== "messages") {
    if (tab === "account") openTeacher("students");
    else
      window.location.assign(
        "/findbuddy" + (tab === "tutors" ? "" : "#" + tab),
      );
    return;
  }
  if (currentPath() !== tab) window.location.hash = tab;
  window.scrollTo({ top: 0 });
}
function openBooking(id: string, pane: "lesson" | "chat" | "work" = "lesson") {
  window.location.hash = "account/" + pane + "/" + id;
  window.scrollTo({ top: 0 });
}
function openConversation(id: string, mode: "new" | "thread" = "thread") {
  window.location.hash = "messages/" + mode + "/" + id;
  window.scrollTo({ top: 0 });
}
function openProfile(id: string) {
  if (onTeacherRoute()) {
    window.location.assign("/findbuddy#tutors/profile/" + id);
    return;
  }
  window.location.hash = "tutors/profile/" + id;
  window.scrollTo({ top: 0 });
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t: tr } = useJupLocale();

  return (
    <label className={styles.field}>
      <span>{tr(label)}</span>
      {children}
    </label>
  );
}
function Select({
  name,
  values,
  value,
  onChange,
  all,
}: {
  name: string;
  values: readonly string[];
  value?: string;
  onChange?: (value: string) => void;
  all?: string;
}) {
  const { t: tr } = useJupLocale();

  return (
    <select
      name={name}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      required={!all}
    >
      {all && <option value="">{tr(all)}</option>}
      {values.map((v) => (
        <option key={v} value={v}>
          {tr(v)}
        </option>
      ))}
    </select>
  );
}
function LoginPrompt({
  intent = "",
  filters,
}: {
  intent?: string;
  filters?: typeof initialFilters;
}) {
  const { t: tr } = useJupLocale();

  const search = useSyncExternalStore(
    watchCatalogSearch,
    catalogSnapshot,
    () => "",
  );
  return (
    <Card
      title={tr(
        intent === "tab/teacher"
          ? tr("Откройте кабинет преподавателя")
          : intent.startsWith("tab/messages")
            ? tr("Войдите, чтобы написать")
            : intent === "tab/account"
              ? tr("Ваши занятия и переписка")
              : intent === "tab/requests"
                ? tr("Заявки и ответы преподавателей")
                : tr("Войдите, чтобы продолжить"),
      )}
      subtitle={tr(
        intent.startsWith("tab/messages")
          ? tr("Ваш диалог откроется сразу после входа.")
          : intent.startsWith("join/")
            ? tr("После входа вы вернётесь к подтверждению этой записи.")
            : intent === "tab/teacher"
              ? tr(
                  "Создайте анкету и пройдите проверку личности, чтобы принимать учеников.",
                )
              : intent === "tab/account"
                ? tr(
                    "Войдите, чтобы посмотреть свои записи и написать преподавателю.",
                  )
                : tr(
                    "Войдите, чтобы отправить заявку и согласовать условия урока.",
                  ),
      )}
    >
      <div className="max-w-xs">
        <Link
          className="primary"
          href={authLoginHref(
            intent,
            search,
            intent.startsWith("tab/teacher"),
            true,
          )}
          onClick={() => {
            saveSessionValue("fb-intent", intent);
            if (filters && intent === "request/")
              saveSessionValue("fb-request-filters", JSON.stringify(filters));
            else forgetSessionValue("fb-request-filters");
          }}
        >
          {tr("Войти или зарегистрироваться")}
        </Link>
      </div>
    </Card>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  const { t: tr } = useJupLocale();

  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name="search" size={25} />
      </span>
      <h3>{tr(title)}</h3>
      <div className={styles.emptyBody}>{children}</div>
    </div>
  );
}

export default function FindBuddy({
  teacherMode = false,
  embedded = false,
}: {
  teacherMode?: boolean;
  embedded?: boolean;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const path = useSyncExternalStore(watchTab, currentPath, () =>
    teacherMode ? "teacher/overview" : "tutors",
  );
  const [section, subpage, itemId] = path.split("/");
  const tab = tabs.find(([key]) => key === section)?.[0] ?? "tutors";
  const [catalog, setCatalog] = useState<Catalog>({ tutors: [], groups: [] });
  const [dashboard, setDashboard] = useState<Dashboard>(EMPTY_DASHBOARD);
  const [userId, setUserId] = useState<string | null>(null);
  const activeUser = useRef<string | null>(null);
  const notifications = useNotifications(embedded ? null : userId);
  const [loading, setLoading] = useState(true);
  const inbox = useInbox(userId, tab === "messages");
  const refreshNumber = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [preview, setPreview] = useState(false);
  const [demo, setDemo] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [compare, setCompare] = useState(false);
  const search = useSyncExternalStore(
    watchCatalogSearch,
    catalogSnapshot,
    () => "",
  );
  const { filters, view, onlyAvailable, sortBy } = useMemo(
    () =>
      readCatalogSearch(search, {
        subject: FB_SUBJECTS,
        exam: FB_EXAMS,
        language: FB_LANGUAGES,
        city: FB_CITIES,
      }),
    [search],
  );
  const savedSnapshot = useSyncExternalStore(
    watchShortlist,
    shortlistSnapshot,
    () => "[]",
  );
  const saved = useMemo(() => shortlistIds(savedSnapshot), [savedSnapshot]);
  const [now, setNow] = useState(Date.now);
  const [showHistory, setShowHistory] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [publicationOffering, setPublicationOffering] = useState("");
  const [publicationStarts, setPublicationStarts] = useState("");
  const [video, setVideo] = useState(false);
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(() => {
    const version = ++refreshNumber.current;
    let latest: Catalog = { tutors: [], groups: [] };
    let catalogReady = false;
    const catalogRequest = api<Catalog>("")
      .then((result) => {
        latest = result;
        if (version !== refreshNumber.current) return;
        catalogReady = true;
        setLoadError("");
        setCatalog(result);
      })
      .catch((err) => {
        if (version !== refreshNumber.current) return;
        setLoadError(
          err instanceof Error ? err.message : "Каталог недоступен.",
        );
      });
    const modeRequest = fetchJson<{
      preview: boolean;
      user?: string;
      videoAvailable?: boolean;
      telegramAvailable?: boolean;
    }>("/findbuddy/api/preview", { cache: "no-store" });
    return Promise.all([catalogRequest, modeRequest])
      .then(async ([, mode]) => {
        if (version !== refreshNumber.current) return;
        setPreview(mode.preview);
        setVideo(mode.videoAvailable === true);
        setTelegramAvailable(mode.telegramAvailable === true);
        const id = mode.preview
          ? mode.user
          : (await getSupabase().auth.getSession()).data.session?.user.id;
        if (version !== refreshNumber.current) return;
        if (activeUser.current !== (id ?? null)) {
          activeUser.current = id ?? null;
          setDashboard(EMPTY_DASHBOARD);
          setTelegramUrl("");
        }
        setUserId(id ?? null);
        if (!id) {
          setDashboard(EMPTY_DASHBOARD);
          setTelegramUrl("");
        } else {
          const next = await api<Dashboard>("dashboard");
          if (version !== refreshNumber.current) return;
          setDashboard(next);
        }
        const intent = catalogReady
          ? currentAuthIntent(window.location.search)
          : null;
        if (intent) {
          if (id) consumeAuthIntent();
          const [kind, key] = intent.split("/");
          if (kind === "request") {
            const snapshot = storedSessionValue("fb-request-filters");
            forgetSessionValue("fb-request-filters");
            if (!key && snapshot) {
              try {
                const f = JSON.parse(snapshot);
                setFilters({
                  ...initialFilters,
                  exam: FB_EXAMS.includes(f.exam) ? f.exam : "",
                  subject: FB_SUBJECTS.includes(f.subject) ? f.subject : "",
                  language: FB_LANGUAGES.includes(f.language) ? f.language : "",
                  city: FB_CITIES.includes(f.city) ? f.city : "",
                  maxPrice:
                    Number.isInteger(f.maxPrice) &&
                    (f.maxPrice === 0 || f.maxPrice >= 500) &&
                    f.maxPrice <= 100000
                      ? f.maxPrice
                      : initialFilters.maxPrice,
                });
              } catch {
                /* An older browser snapshot can be discarded. */
              }
            }
            const tutor = latest.tutors.find((t) => t.id === key);
            if (key && !tutor)
              setError(
                "Анкета больше недоступна. Выберите другого преподавателя.",
              );
            else setModal({ kind, tutor });
          }
          if (kind === "join") {
            const group = latest.groups.find((g) => g.id === key);
            if (group) {
              setTab(group.capacity === 1 ? "tutors" : "groups");
              setModal({ kind, group });
            } else
              setError(
                "Запись на это занятие уже закрыта. Выберите другое время.",
              );
          }
          if (kind === "tab" && tabs.some(([tab]) => tab === key)) {
            const [, , pane, id] = intent.split("/");
            if (key === "teacher")
              openTeacher(
                pane === "slot" && id ? "slot/" + id : pane || "overview",
              );
            else if (key === "tutors" && pane === "profile" && id)
              openProfile(id);
            else if (key === "account" && pane === "calendar")
              window.location.hash = "account/calendar";
            else if (
              key === "account" &&
              (pane === "lesson" || pane === "chat" || pane === "work") &&
              /^[a-f0-9-]{36}$/i.test(id ?? "")
            )
              openBooking(id, pane);
            else if (
              key === "messages" &&
              (pane === "new" || pane === "thread") &&
              /^[a-f0-9-]{36}$/i.test(id ?? "")
            )
              openConversation(id, pane);
            else setTab(key as Tab);
          }
        }
      })
      .catch((err) => {
        if (version !== refreshNumber.current) return;
        setError(err instanceof Error ? err.message : "Кабинет недоступен.");
      })
      .finally(() => {
        if (version === refreshNumber.current) setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (
      !embedded &&
      dashboard.account &&
      ["account", "messages", "requests"].includes(tab)
    )
      location.replace(roleHome(dashboard.account.role) + "#" + path);
  }, [embedded, dashboard.account, tab, path]);
  useEffect(() => {
    if (!teacherMode && section === "teacher")
      openTeacher(
        subpage === "slot" && itemId ? "slot/" + itemId : subpage || "overview",
      );
  }, [teacherMode, section, subpage, itemId]);
  useEffect(() => {
    void refresh();
    let lastFocus = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFocus < 10000 || document.hidden) return;
      lastFocus = Date.now();
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (
      !userId ||
      (tab !== "requests" &&
        tab !== "account" &&
        tab !== "messages" &&
        !teacherMode)
    )
      return;
    let alive = true;
    let pending = false;
    const timer = window.setInterval(async () => {
      if (document.hidden || pending || document.activeElement?.closest("form"))
        return;
      pending = true;
      try {
        const version = refreshNumber.current;
        const next = await api<Dashboard>("dashboard");
        if (alive && refreshNumber.current === version)
          setDashboard((current) =>
            JSON.stringify(current) === JSON.stringify(next) ? current : next,
          );
      } catch {
        /* Keep the last readable messages when the network is unavailable. */
      } finally {
        pending = false;
      }
    }, 12000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tab, userId, teacherMode]);
  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);

  const shown = demo ? DEMO_CATALOG : catalog;
  const savedTutors = shown.tutors.filter(
    (t) => saved.includes(t.id) && t.id !== userId,
  );
  const availableSlotsByTutor = useMemo(() => {
    const byTutor = new Map<string, Group[]>();
    for (const slot of [...shown.groups].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )) {
      if (
        slot.capacity !== 1 ||
        enrollment(slot, userId, dashboard.bookings, now)
      )
        continue;
      const slots = byTutor.get(slot.tutor_id) ?? [];
      slots.push(slot);
      byTutor.set(slot.tutor_id, slots);
    }
    return byTutor;
  }, [shown.groups, userId, dashboard.bookings, now]);
  const slotsByTutor = useMemo(() => {
    const result = new Map<string, Group[]>();
    for (const [id, slots] of availableSlotsByTutor) {
      const affordable = slots.filter(
        (slot) =>
          slot.price <= filters.maxPrice &&
          (!filters.subject || slot.subject === filters.subject) &&
          (!filters.exam || slot.exam === filters.exam) &&
          (!filters.language || slot.language === filters.language) &&
          (!filters.city || slot.city === filters.city),
      );
      if (affordable.length) result.set(id, affordable);
    }
    return result;
  }, [availableSlotsByTutor, filters]);
  const tutors = useMemo(() => {
    const matches = filterTutors(shown.tutors, {
      ...filters,
      maxPrice: initialFilters.maxPrice,
    }).filter(
      (t) =>
        ((matchingOfferings(t, filters)[0]?.price ?? t.price) <=
          filters.maxPrice ||
          slotsByTutor.has(t.id)) &&
        (view !== "saved" || saved.includes(t.id)) &&
        (!onlyAvailable || slotsByTutor.has(t.id)),
    );
    const first = (t: Tutor) => slotsByTutor.get(t.id)?.[0];
    const start = (t: Tutor) =>
      Date.parse(first(t)?.starts_at ?? "") || Number.MAX_SAFE_INTEGER;
    if (sortBy === "time") return matches.sort((a, b) => start(a) - start(b));
    return matches.sort(
      (a, b) =>
        (first(a)?.price ??
          matchingOfferings(a, filters)[0]?.price ??
          a.price) -
        (first(b)?.price ?? matchingOfferings(b, filters)[0]?.price ?? b.price),
    );
  }, [shown.tutors, filters, view, saved, slotsByTutor, onlyAvailable, sortBy]);
  const focusTutor = tutors.length ? tutors[cursor % tutors.length] : null;
  const groups = shown.groups
    .filter(
      (g) =>
        g.capacity > 1 &&
        !g.enrollment_closed &&
        Number.isFinite(Date.parse(g.starts_at)) &&
        Date.parse(g.starts_at) >= now + 30 * 60000 &&
        (!filters.subject || g.subject === filters.subject) &&
        (!filters.exam || g.exam === filters.exam) &&
        (!filters.language || g.language === filters.language) &&
        (!filters.city || g.city === filters.city) &&
        g.price <= filters.maxPrice &&
        (!onlyAvailable || !enrollment(g, userId, dashboard.bookings, now)) &&
        (!filters.query.trim() ||
          `${g.title} ${g.description} ${g.subject} ${g.exam}`
            .toLowerCase()
            .includes(filters.query.trim().toLowerCase())),
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const selectedLesson =
    modal?.kind === "join"
      ? shown.groups.find((g) => g.id === modal.group.id)
      : undefined;
  const existingBooking =
    modal?.kind === "join"
      ? dashboard.bookings.find(
          (booking) =>
            booking.group_id === modal.group.id &&
            booking.status !== "cancelled",
        )
      : undefined;
  const bookingBlocked =
    modal?.kind === "join" &&
    (selectedLesson
      ? enrollment(selectedLesson, userId, dashboard.bookings, now)
      : "Запись закрыта");
  const tutorName = (id: string) =>
    catalog.tutors.find((t) => t.id === id)?.display_name ??
    (dashboard.tutor?.id === id
      ? dashboard.tutor.display_name
      : "Преподаватель");
  const selectedOffering =
    dashboard.offerings?.find(
      (o) => o.id === publicationOffering && o.active,
    ) ?? dashboard.offerings?.find((o) => o.active);
  function openModal(next: Modal) {
    setError("");
    setNotice("");
    if (next.kind === "group") {
      setPublicationOffering(
        dashboard.offerings?.find((o) => o.active)?.id ?? "",
      );
      setPublicationStarts("");
    }
    setModal(next);
  }
  async function mutate(
    action: string,
    data: Record<string, unknown>,
    message: string,
    completed?: (result: unknown) => void,
  ): Promise<boolean> {
    if (busy || mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("", action, data);
      setModal(null);
      setNotice(message);
      await refresh();
      completed?.(result);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить.");
      if (action === "join") await refresh();
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      if (modal.kind === "request") {
        if (
          await mutate(
            "request",
            {
              ...data,
              ...(modal.tutor
                ? {
                    subject: modal.tutor.subject,
                    exam: modal.tutor.exam,
                    language: data.language || modal.tutor.language,
                    city: modal.tutor.city,
                  }
                : {}),
              budget: Number(data.budget),
              tutor_id: modal.tutor?.id ?? null,
            },
            "Заявка опубликована. Предложения появятся во вкладке «Заявки».",
          )
        )
          setTab("requests");
      } else if (modal.kind === "offer") {
        await mutate(
          "offer",
          {
            ...data,
            request_id: modal.request.id,
            price: Number(data.price),
            starts_at: kazakhstanDate(String(data.starts_at)),
          },
          "Предложение отправлено ученику.",
        );
      } else if (modal.kind === "group") {
        await mutate(
          "publish_series",
          {
            ...data,
            price: Number(data.price),
            capacity: Number(data.capacity),
            starts_at: kazakhstanDate(String(data.starts_at)),
          },
          Number(data.weeks) > 1
            ? "Серия опубликована. Каждая дата доступна для отдельной записи."
            : "Занятие опубликовано. Ученики могут выбрать его в каталоге.",
        );
      } else if (modal.kind === "join") {
        let bookingId = "";
        const ok = await mutate(
          "join",
          { id: modal.group.id },
          "Вы записаны на урок. Время, чат и материалы — в этой записи.",
          (result) => {
            if (
              result &&
              typeof result === "object" &&
              "id" in result &&
              typeof result.id === "string"
            )
              bookingId = result.id;
          },
        );
        if (ok) {
          setShowHistory(false);
          if (bookingId) openBooking(bookingId);
          else setTab("account");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверьте дату.");
    }
  }
  async function connectTelegram() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("", "telegram_link", {});
      setTelegramUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Telegram недоступен.");
    } finally {
      setBusy(false);
    }
  }
  const filter = (key: keyof typeof filters, value: string | number) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setCursor(0);
  };
  function clearFilters() {
    updateCatalogSearch({ filters: initialFilters, onlyAvailable: false });
    setCursor(0);
  }
  const activeFilters = [
    { label: filters.subject, clear: () => filter("subject", "") },
    { label: filters.language, clear: () => filter("language", "") },
    { label: filters.city, clear: () => filter("city", "") },
    {
      label:
        filters.maxPrice < initialFilters.maxPrice
          ? filters.maxPrice === 0
            ? "Бесплатно"
            : "до " + money(filters.maxPrice, uiLocale)
          : "",
      clear: () => filter("maxPrice", initialFilters.maxPrice),
    },
    {
      label: onlyAvailable ? "Открыта запись" : "",
      clear: () => updateCatalogSearch({ onlyAvailable: false }),
    },
  ].filter((item) => item.label);
  const profileSlots =
    modal?.kind === "join" && modal.group.capacity === 1
      ? shown.groups.filter(
          (g) =>
            g.capacity === 1 &&
            g.tutor_id === modal.group.tutor_id &&
            (g.id === modal.group.id ||
              !enrollment(g, userId, dashboard.bookings, now)),
        )
      : [];
  const profile =
    tab === "tutors" && subpage === "profile"
      ? (shown.tutors.find((t) => t.id === itemId) ??
        (dashboard.tutor?.id === itemId ? dashboard.tutor : undefined))
      : undefined;
  function toggleSaved(id: string) {
    if (!toggleShortlist(id))
      setError(
        "Избранное недоступно. Разрешите браузеру сохранять данные сайта.",
      );
  }
  function tutorRow(tutor: Tutor) {
    const next = slotsByTutor.get(tutor.id)?.[0];
    const direction = matchingOfferings(tutor, filters)[0];
    const displayTutor = direction
      ? {
          ...tutor,
          subject: direction.subject,
          exam: direction.exam,
          language: direction.languages.join(", "),
          city: direction.format === "online" ? "Онлайн" : direction.city,
          price: direction.price,
        }
      : tutor;
    return (
      <TutorCard
        key={tutor.id + String(tutor.photo_version)}
        tutor={displayTutor}
        next={next}
        local={preview || demo}
        saved={saved.includes(tutor.id)}
        save={demo ? undefined : () => toggleSaved(tutor.id)}
        open={() => openProfile(tutor.id)}
        contact={
          tutor.id === userId || demo
            ? undefined
            : () => openConversation(tutor.id, "new")
        }
        book={
          next && !demo
            ? () => openModal({ kind: "join", group: next })
            : undefined
        }
      />
    );
  }
  const balance = (dashboard.payments ?? [])
    .filter(
      (p) =>
        !p.withdrawn &&
        dashboard.bookings.some(
          (b) => b.id === p.booking_id && b.tutor_id === userId,
        ),
    )
    .reduce((sum, p) => sum + p.tutor_net, 0);
  const visibleBookings = dashboard.bookings.filter(
    (b) =>
      showHistory ===
      (b.status === "cancelled" || Date.parse(b.starts_at) + 3600000 <= now),
  );
  const nextStudentLesson = dashboard.bookings
    .filter(
      (b) =>
        b.student_id === userId &&
        b.status !== "cancelled" &&
        Date.parse(b.starts_at) + 3600000 > now,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  if (showHistory) visibleBookings.reverse();
  const selectedBooking = dashboard.bookings.find(
    (b) =>
      b.id === itemId &&
      b.status !== "cancelled" &&
      (!teacherMode || b.tutor_id === userId),
  );
  const selectedTutor = catalog.tutors.find(
    (t) => t.id === selectedBooking?.tutor_id,
  );
  function openSlot(id: string) {
    openTeacher("slot/" + id);
  }
  const attention = dashboard.bookings.flatMap((b) => {
    const seat = dashboard.seats?.find((s) => s.id === b.id);
    if (!seat || b.status === "cancelled") return [];
    const room = roomForBooking(dashboard.rooms, b);
    const teacher = b.tutor_id === userId;
    const items: {
      starts: string;
      id: string;
      pane: "chat" | "lesson" | "work";
      label: string;
      peer: string;
    }[] = [];
    const add = (pane: "chat" | "lesson" | "work", label: string) =>
      items.push({
        id: b.id,
        starts: b.starts_at,
        pane,
        label,
        peer: teacher ? seat.name : tutorName(b.tutor_id),
      });
    if (seat.unread) add("chat", "Новые сообщения · " + seat.unread);
    if (Date.parse(b.starts_at) + 3600000 <= now) {
      const outcome = dashboard.outcomes?.find((o) => o.booking_id === b.id);
      const own = teacher
        ? outcome?.teacher_response
        : outcome?.student_response;
      if (!own || own === "pending") add("lesson", "Подтвердить проведение");
    }
    if (
      seat.move &&
      seat.move.proposed_by !== userId &&
      Date.parse(seat.move.starts_at) > now &&
      Date.parse(b.starts_at) > now
    )
      add("lesson", "Подтвердить перенос");
    if (room?.homework) {
      const submitted = seat.work?.task_version === room.task_version;
      if (teacher && submitted && !seat.work?.feedback)
        add("work", "Проверить работу");
      if (!teacher && !submitted) add("work", "Ответить на задание");
    }
    return items;
  });
  const teaching = dashboard.bookings.filter(
    (b) => b.tutor_id === userId && b.status !== "cancelled",
  );
  const teachingSlots = catalog.groups.filter((g) => g.tutor_id === userId);
  const teachingStudents = [
    ...new Map(teaching.map((b) => [b.student_id, b])).values(),
  ];
  const nextTeaching = teaching
    .filter((b) => Date.parse(b.starts_at) + 3600000 > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const teacherRequests = dashboard.requests.filter(
    (r) => r.student_id !== userId,
  );
  const currentPanel =
    tab === "requests"
      ? "requests"
      : tab === "account"
        ? "students"
        : subpage === "slot"
          ? "schedule"
          : subpage || "overview";
  const studentSwipe = useRef<{ x: number; y: number } | null>(null);
  const directThreads = (inbox.list?.threads ?? []).filter(
    (t) => !teacherMode || !t.as_student,
  );
  const lessonContacts = dashboard.bookings
    .filter(
      (b) =>
        b.status !== "cancelled" && (!teacherMode || b.tutor_id === userId),
    )
    .map((b) => ({
      booking: b,
      label:
        b.tutor_id === userId
          ? (dashboard.seats?.find((s) => s.id === b.id)?.name ?? "Ученик")
          : tutorName(b.tutor_id),
      unread: dashboard.seats?.find((s) => s.id === b.id)?.unread ?? 0,
    }))
    .sort(
      (a, b) =>
        b.unread - a.unread ||
        Date.parse(b.booking.starts_at) - Date.parse(a.booking.starts_at),
    );
  const unread =
    directThreads.reduce((total, t) => total + t.unread, 0) +
    lessonContacts.reduce((total, l) => total + l.unread, 0);
  function bookingRow(booking: Booking) {
    const past = Date.parse(booking.starts_at) + 3600000 <= now;
    const paid = dashboard.payments?.some((p) => p.booking_id === booking.id);
    const messages = dashboard.messages.filter(
      (m) => m.booking_id === booking.id,
    );
    return (
      <article className={styles.booking} key={booking.id}>
        <div className={styles.spread}>
          <div>
            <h3>
              {tr(booking.subject)} ·{tr(" ")}
              {tr(
                booking.lesson_format === "group" ||
                  (!booking.lesson_format && booking.group_id)
                  ? tr("Группа")
                  : tr("Индивидуально"),
              )}
            </h3>
            {booking.lesson_title && <strong>{booking.lesson_title}</strong>}
            <p>
              {tr(lessonDate(booking.starts_at, uiLocale))}
              {tr(" · 60 минут · Казахстан, UTC+5")}
            </p>
            <p>
              {tr(
                booking.tutor_id === userId
                  ? tr("Ученик: ") +
                      (dashboard.seats?.find((s) => s.id === booking.id)
                        ?.name ?? tr("имя не указано"))
                  : tutorName(booking.tutor_id),
              )}
              {tr(" ")}· {tr(money(booking.price, uiLocale))}
            </p>
          </div>
          <Pill
            text={tr(
              booking.status === "cancelled"
                ? tr("Отменено")
                : past
                  ? outcomeLabel(
                      dashboard.outcomes?.find(
                        (o) => o.booking_id === booking.id,
                      ),
                    )
                  : paid
                    ? tr("Тестовая оплата прошла")
                    : preview
                      ? tr("Демо-бронь")
                      : tr("Место забронировано"),
            )}
          />
        </div>
        {booking.tutor_id === userId && (
          <p className={styles.meta}>
            {tr("Комиссия Jup edu в пилоте: ")}
            {tr(money(booking.commission, uiLocale))}
            {tr(" · После комиссии платформы: ")}
            {tr(money(booking.tutor_net, uiLocale))}.
          </p>
        )}
        {booking.status !== "cancelled" && (
          <>
            <button className="primary" onClick={() => openBooking(booking.id)}>
              {tr("Открыть занятие")}
            </button>
            {dashboard.seats?.find((s) => s.id === booking.id)?.move && (
              <p className={styles.meta}>{tr("Предложен перенос времени")}</p>
            )}
            {preview ? (
              booking.price > 0 &&
              !past &&
              !paid &&
              booking.student_id === userId && (
                <button
                  className={styles.textAction}
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      "test_pay",
                      { id: booking.id },
                      "Тестовый платёж проведён.",
                    )
                  }
                >
                  {tr("Оплатить в деморежиме · ")}
                  {tr(money(booking.price, uiLocale))}
                </button>
              )
            ) : (
              <p className={styles.meta}>
                {tr(
                  booking.price === 0
                    ? tr("Бесплатное занятие. Оплата не требуется.")
                    : tr(
                        "Jup edu не принимает оплату уроков в пилоте. Условия расчёта согласуются с преподавателем.",
                      ),
                )}
              </p>
            )}
            <div className={styles.quietActions}>
              {!past && (
                <button onClick={() => downloadCalendar(booking)}>
                  {tr("В календарь")}
                </button>
              )}
              <button onClick={() => openBooking(booking.id, "chat")}>
                {tr("Открыть чат (")}
                {messages.length})
              </button>
              <button
                disabled={busy || paid || Date.parse(booking.starts_at) <= now}
                onClick={() =>
                  window.confirm(
                    "Отменить запись на это занятие? Место освободится для другого ученика.",
                  ) &&
                  void mutate(
                    "cancel",
                    { id: booking.id },
                    "Запись отменена, место освобождено.",
                  )
                }
              >
                {tr("Отменить запись")}
              </button>
            </div>
            {!teacherMode &&
              past &&
              booking.student_id === userId &&
              catalog.tutors.some((t) => t.id === booking.tutor_id) && (
                <button
                  className={styles.textAction}
                  onClick={() => openProfile(booking.tutor_id)}
                >
                  {tr("Оценить преподавателя")}
                </button>
              )}
          </>
        )}
      </article>
    );
  }

  const Root = embedded ? "section" : "main";
  return (
    <Root
      className={styles.page + (embedded ? " " + styles.embedded : "")}
      lang={uiLocale}
    >
      <header className={styles.topline}>
        <Link
          href="/"
          className={styles.brand}
          aria-label={tr("Jup edu — главная")}
        >
          <Brand />
        </Link>
        <nav className={styles.tabs} aria-label={tr("Разделы Jup edu")}>
          {teacherMode ? (
            teacherPanels.map(([panel, label, icon]) => (
              <button
                key={panel}
                aria-current={
                  (tab === "messages" ? "messages" : currentPanel) === panel
                    ? "page"
                    : undefined
                }
                onClick={() => {
                  setNotice("");
                  setError("");
                  openTeacher(panel);
                }}
              >
                <Icon name={icon} size={18} />
                <span>
                  {tr(label)}
                  {panel === "messages" && !!unread && (
                    <b className={styles.navBadge}>{Math.min(unread, 99)}</b>
                  )}
                </span>
              </button>
            ))
          ) : (
            <>
              <Link
                className={styles.publicNavLink}
                href="/"
                aria-current={tab === "tutors" ? "page" : undefined}
              >
                <Icon name="search" size={19} />
                <span>{tr("Преподаватели")}</span>
              </Link>
              <button
                className={styles.publicNavLink}
                aria-current={tab === "groups" ? "page" : undefined}
                onClick={() => setTab("groups")}
              >
                <Icon name="groups" size={19} />
                <span>{tr("Группы")}</span>
              </button>
              <Link className={styles.publicNavLink} href="/centers">
                <Icon name="teacher" size={19} />
                <span>{tr("Учебные центры")}</span>
              </Link>
            </>
          )}
        </nav>
        <div
          className={styles.accountLinks}
          style={{ visibility: loading ? "hidden" : undefined }}
          aria-busy={loading}
        >
          <LanguageSwitcher />
          {!embedded && userId && (
            <NotificationBell
              role={dashboard.account?.role ?? "student"}
              state={notifications}
            />
          )}
          {!userId ? (
            <>
              <Link
                className={styles.registerLink}
                href={authLoginHref(
                  "tab/" + (path || "tutors"),
                  search,
                  teacherMode,
                  true,
                )}
              >
                {tr("Начать")}
              </Link>
              <Link
                href={authLoginHref(
                  "tab/" + (path || "tutors"),
                  search,
                  teacherMode,
                )}
              >
                {tr("Войти")}
              </Link>
            </>
          ) : (
            <details className={styles.accountMenu}>
              <summary>
                {dashboard.student_name ||
                  dashboard.tutor?.display_name ||
                  tr("Аккаунт")}
              </summary>
              <div>
                <a href={roleHome(dashboard.account?.role ?? "student")}>
                  {tr("Мой кабинет")}
                </a>
                {preview && (
                  <Link href="/login">{tr("Войти в другой аккаунт")}</Link>
                )}
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      if (preview) {
                        await fetchJson("/findbuddy/api/preview", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: "logout" }),
                        });
                      } else {
                        const { error } = await getSupabase().auth.signOut({
                          scope: "local",
                        });
                        if (error) throw error;
                      }
                      window.location.assign("/findbuddy");
                    } catch {
                      setError(
                        "Не удалось выйти. Проверьте соединение и попробуйте ещё раз.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {tr("Выйти")}
                </button>
              </div>
            </details>
          )}
        </div>
      </header>
      {notice && (
        <div className={styles.notice} role="status">
          {tr(notice)}
        </div>
      )}
      {error && !modal && (
        <div className={styles.error} role="alert">
          {tr(error)}
        </div>
      )}
      {loadError && (
        <div className={styles.setup}>
          <strong>{tr("Каталог временно недоступен")}</strong>
          <p>{tr(loadError)}</p>
          <button onClick={() => void refresh()}>
            {tr("Повторить загрузку")}
          </button>{" "}
          ·{tr(" ")}
          <button onClick={() => setDemo((v) => !v)}>
            {tr(demo ? tr("Закрыть пример") : tr("Посмотреть пример продукта"))}
          </button>
        </div>
      )}
      {demo && (
        <div className={styles.notice}>
          <strong>{tr("Демонстрация.")}</strong>
          {tr(
            " Анкеты, дата и группа вымышлены. Записаться и отправить им заявку нельзя.",
          )}
          {tr(" ")}
          <button className={styles.textAction} onClick={() => setDemo(false)}>
            {tr("Вернуться к реальным данным")}
          </button>
        </div>
      )}
      {busy && (
        <div className="requestProgress" role="status">
          <span className="srOnly">
            {tr(busy ? tr("Сохраняем изменения…") : tr("Загружаем занятия…"))}
          </span>
        </div>
      )}
      {loading &&
        (teacherMode ||
          (tab !== "tutors" && tab !== "groups") ||
          subpage === "profile") && (
          <LoadingState label={tr("Открываем ваши занятия…")} />
        )}
      {!demo && !embedded && (
        <div className={styles.previewBanner} role="note">
          <strong>{tr("Бесплатный пилот")}</strong>
          <span>{tr("Комиссия платформы — 0%.")}</span>
        </div>
      )}

      {tab === "tutors" &&
        subpage === "profile" &&
        (profile ? (
          <ProfilePage
            key={profile.id}
            tutor={profile}
            slots={shown.groups.filter(
              (g) =>
                g.capacity === 1 &&
                g.tutor_id === profile.id &&
                !enrollment(g, userId, dashboard.bookings, now),
            )}
            groups={shown.groups.filter(
              (g) =>
                g.capacity > 1 &&
                g.tutor_id === profile.id &&
                !g.enrollment_closed &&
                g.reserved < g.capacity &&
                g.starts_at &&
                Date.parse(g.starts_at) > now + 1800000,
            )}
            editable={profile.id === userId}
            example={demo}
            local={preview}
            photo={tutorPortrait(profile, preview || demo)}
            own={profile.id === userId}
            back={() =>
              profile.id === userId ? openTeacher("profile") : setTab("tutors")
            }
            edit={() => openModal({ kind: "edit", tutor: profile })}
            book={(group) => openModal({ kind: "join", group })}
            request={(offering) =>
              openModal({
                kind: "request",
                offering,
                tutor: offering
                  ? {
                      ...profile,
                      subject: offering.subject,
                      exam: offering.exam,
                      language: offering.languages[0],
                      city:
                        offering.format === "online" ? "Онлайн" : offering.city,
                      price: offering.price,
                    }
                  : profile,
              })
            }
            reviews={
              !demo && profile.verification === "verified" ? (
                <TutorReviews
                  key={profile.id}
                  id={profile.id}
                  count={profile.review_count}
                  rating={profile.rating}
                  changed={refresh}
                  editable={dashboard.bookings.some(
                    (b) =>
                      b.student_id === userId &&
                      b.tutor_id === profile.id &&
                      b.status !== "cancelled" &&
                      Date.parse(b.starts_at) + 3600000 <= now,
                  )}
                />
              ) : undefined
            }
            contact={
              profile.id === userId || demo
                ? undefined
                : () => openConversation(profile.id, "new")
            }
          />
        ) : (
          !loading && (
            <Empty title={tr("Анкета недоступна")}>
              <button className="secondary" onClick={() => setTab("tutors")}>
                {tr("Открыть каталог")}
              </button>
            </Empty>
          )
        ))}
      {!teacherMode &&
        ((tab === "tutors" && subpage !== "profile") || tab === "groups") && (
          <div className={styles.catalogSurface}>
            <header
              className={tab === "tutors" ? styles.hero : styles.groupHero}
            >
              <div>
                <p className={styles.eyebrow}>
                  {tr("Преподаватели в Казахстане")}
                </p>
                <h1>
                  {tab === "tutors" ? (
                    <>
                      {tr("Ваш предмет.")}
                      <br />
                      <em>{tr("Ваш преподаватель.")}</em>
                    </>
                  ) : (
                    <>
                      {tr("Занятия ")}
                      <em>{tr("в мини-группе.")}</em>
                    </>
                  )}
                </h1>
                <p className={styles.intro}>
                  {tr(
                    tab === "tutors"
                      ? tr(
                          "Сравните предметы, стоимость и свободное время. Напишите преподавателю или выберите урок.",
                        )
                      : tr(
                          "Выберите тему и дату. Одно место — для одного ученика.",
                        ),
                  )}
                </p>
                {tab === "tutors" && (
                  <div className={styles.heroActions}>
                    <button
                      className="primary"
                      onClick={() => {
                        document.getElementById("fb-search")?.focus();
                        document
                          .getElementById("fb-search-panel")
                          ?.scrollIntoView({
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "instant"
                              : "smooth",
                            block: "start",
                          });
                      }}
                    >
                      {tr("Найти преподавателя")}
                    </button>
                    <a href="/findbuddy/guide">{tr("Как это работает")}</a>
                  </div>
                )}
              </div>
              {tab === "tutors" && (
                <aside
                  className={styles.goalPanel}
                  aria-label={tr("Быстрый подбор")}
                >
                  <div className={styles.goalPanelTop}>
                    <span>
                      <Icon name="teacher" size={24} />
                    </span>
                    <span>JUP / EDU</span>
                  </div>
                  <h2>{tr("С чего начнём?")}</h2>
                  <div className={styles.goalOptions}>
                    {(
                      [
                        [
                          "",
                          "ЕНТ",
                          "Подготовиться к ЕНТ",
                          "Темы экзамена и практика",
                          "01",
                        ],
                        [
                          "Английский",
                          "IELTS",
                          "Сдать IELTS",
                          "Reading, Writing, Listening, Speaking",
                          "02",
                        ],
                        [
                          "",
                          "Школьная программа",
                          "Разобраться в предмете",
                          "Школьная программа без пробелов",
                          "03",
                        ],
                      ] as const
                    ).map(([subject, exam, label, description, number]) => (
                      <button
                        type="button"
                        key={number}
                        onClick={() => {
                          updateCatalogSearch({
                            filters: { ...filters, subject, exam, query: "" },
                            view: "list",
                          });
                          document
                            .getElementById("fb-search-panel")
                            ?.scrollIntoView({
                              behavior: window.matchMedia(
                                "(prefers-reduced-motion: reduce)",
                              ).matches
                                ? "instant"
                                : "smooth",
                              block: "start",
                            });
                        }}
                      >
                        <span className={styles.goalNumber}>{number}</span>
                        <span>
                          <strong>{tr(label)}</strong>
                          <small>{tr(description)}</small>
                        </span>
                        <Icon name="arrowRight" size={19} />
                      </button>
                    ))}
                  </div>
                  <p>
                    <Icon name="globe" size={15} />
                    {tr("Онлайн и в вашем городе")}
                  </p>
                </aside>
              )}
            </header>
            <div
              className={styles.examChoices}
              role="group"
              aria-label={tr("Выберите экзамен")}
            >
              {["", ...FB_EXAMS].map((exam) => (
                <button
                  key={exam}
                  aria-pressed={filters.exam === exam}
                  onClick={() => filter("exam", exam)}
                >
                  {tr(
                    exam === "Школьная программа"
                      ? tr("Школа")
                      : exam || tr("Все"),
                  )}
                </button>
              ))}
            </div>
            <section
              id="fb-search-panel"
              aria-label={tr("Фильтры поиска")}
              className={styles.searchPanel}
            >
              <div className={styles.searchPanelHeader}>
                <span>
                  <Icon name="filters" size={20} />
                </span>
                <div>
                  <h2>{tr("Какой урок вам нужен?")}</h2>
                </div>
              </div>
              <div className={styles.quickFilters}>
                <Field label={tr("Что изучаем?")}>
                  <Select
                    name="subject"
                    values={FB_SUBJECTS}
                    value={filters.subject}
                    onChange={(v) => filter("subject", v)}
                    all={tr("Все предметы")}
                  />
                </Field>
                <Field label={tr("Бюджет за 60 минут")}>
                  <select
                    aria-label={tr("Бюджет за 60 минут")}
                    value={String(filters.maxPrice)}
                    onChange={(e) => filter("maxPrice", Number(e.target.value))}
                  >
                    <option value="100000">{tr("Любой бюджет")}</option>
                    <option value="0">{tr("Бесплатные занятия")}</option>
                    {[3000, 5000, 7000, 10000].map((price) => (
                      <option key={price} value={price}>
                        {tr("До ")}
                        {tr(money(price, uiLocale))}
                      </option>
                    ))}
                    {![0, 3000, 5000, 7000, 10000, 100000].includes(
                      filters.maxPrice,
                    ) && (
                      <option value={filters.maxPrice}>
                        {tr("До ")}
                        {tr(money(filters.maxPrice, uiLocale))}
                      </option>
                    )}
                  </select>
                </Field>
              </div>
              <div className={styles.searchRow}>
                <label className={styles.searchBox}>
                  <Icon name="search" />
                  <input
                    id="fb-search"
                    aria-label={tr("Поиск")}
                    type="search"
                    placeholder={tr(
                      tab === "tutors"
                        ? tr("Предмет, тема или имя")
                        : tr("Предмет или тема группы"),
                    )}
                    value={filters.query}
                    onChange={(e) => filter("query", e.target.value)}
                  />
                </label>
                <button
                  className={styles.filterToggle}
                  aria-expanded={filtersOpen}
                  aria-controls="fb-more"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <Icon name="filters" size={18} />
                  {tr("Фильтры")}
                  {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
                </button>
              </div>
              {activeFilters.length > 0 && (
                <div className={styles.filterSummary}>
                  {activeFilters.map((item) => (
                    <button
                      className={styles.filterChip}
                      key={item.label}
                      aria-label={tr(tr("Убрать фильтр: ") + item.label)}
                      onClick={item.clear}
                    >
                      {tr(item.label)}
                      <Icon name="close" size={14} />
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setFilters((f) => ({
                        ...initialFilters,
                        query: f.query,
                        exam: f.exam,
                      }));
                      updateCatalogSearch({ onlyAvailable: false });
                    }}
                  >
                    {tr("Сбросить")}
                  </button>
                </div>
              )}
              <div id="fb-more" hidden={!filtersOpen} className={styles.more}>
                <div className={styles.formGrid}>
                  <Field label={tr("Язык")}>
                    <Select
                      name="language"
                      values={FB_LANGUAGES}
                      value={filters.language}
                      onChange={(v) => filter("language", v)}
                      all={tr("Любой язык")}
                    />
                  </Field>
                  <Field label={tr("Формат / город")}>
                    <Select
                      name="city"
                      values={FB_CITIES}
                      value={filters.city}
                      onChange={(v) => filter("city", v)}
                      all={tr("Все города")}
                    />
                  </Field>
                  <Field label={tr("До, ₸ за занятие")}>
                    <input
                      key={filters.maxPrice}
                      type="number"
                      min={0}
                      max={100000}
                      step={1}
                      placeholder={tr("Без ограничения")}
                      defaultValue={
                        filters.maxPrice === initialFilters.maxPrice
                          ? ""
                          : filters.maxPrice
                      }
                      onBlur={(e) => {
                        if (!e.currentTarget.validity.valid) {
                          e.currentTarget.reportValidity();
                          return;
                        }
                        filter(
                          "maxPrice",
                          e.target.value === ""
                            ? initialFilters.maxPrice
                            : Number(e.target.value),
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </Field>
                </div>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) =>
                      updateCatalogSearch({ onlyAvailable: e.target.checked })
                    }
                  />
                  {tr("Только со свободными местами")}
                </label>
              </div>
            </section>
            <div className={styles.resultsHeader}>
              <div>
                <h2>
                  {tr(
                    tab === "tutors"
                      ? view === "saved"
                        ? tr("Избранные преподаватели")
                        : tr("Преподаватели")
                      : tr("Расписание групп"),
                  )}
                  {tr(" ")}
                  <small aria-live="polite">
                    {tr(
                      loading
                        ? "…"
                        : tab === "tutors"
                          ? tutors.length
                          : groups.length,
                    )}
                  </small>
                </h2>
                {tab === "tutors" &&
                  view !== "saved" &&
                  savedTutors.length >= 2 && (
                    <button
                      className={styles.textAction}
                      onClick={() => {
                        updateCatalogSearch({ view: "saved" });
                        setCompare(true);
                      }}
                    >
                      {tr("Сравнить избранных · ")}
                      {savedTutors.length}
                    </button>
                  )}
              </div>
              {tab === "tutors" && (
                <div className={styles.resultTools}>
                  <select
                    aria-label={tr("Сортировка преподавателей")}
                    value={sortBy}
                    onChange={(e) =>
                      updateCatalogSearch({
                        sortBy: e.target.value === "time" ? "time" : "price",
                      })
                    }
                  >
                    <option value="price">{tr("По цене")}</option>
                    <option value="time">{tr("По времени")}</option>
                  </select>
                  <div
                    className={styles.viewSwitch}
                    role="group"
                    aria-label={tr("Отображение анкет")}
                  >
                    {(
                      [
                        ["list", "Все"],
                        ["focus", "По одной"],
                        ["saved", "Избранное"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={view === value}
                        onClick={() => updateCatalogSearch({ view: value })}
                      >
                        <Icon
                          name={
                            value === "saved"
                              ? "bookmark"
                              : value === "focus"
                                ? "teacher"
                                : "grid"
                          }
                          size={16}
                        />
                        <span className={styles.viewLabel} title={tr(label)}>
                          {tr(label)}
                        </span>
                        {value === "saved" && saved.length > 0 && (
                          <span>{saved.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {tab === "tutors" && (
              <section
                className={
                  view === "focus" ? styles.focusList : styles.tutorGrid
                }
                aria-label={tr("Преподаватели")}
                aria-busy={loading}
              >
                {loading && (
                  <div className={styles.catalogLoading}>
                    <LoadingState label={tr("Загружаем преподавателей…")} />
                  </div>
                )}
                {view === "saved" && !demo && savedTutors.length >= 2 && (
                  <div className={styles.compareControl}>
                    <button
                      className="secondary"
                      aria-expanded={compare}
                      onClick={() => setCompare(!compare)}
                    >
                      {tr(
                        compare
                          ? tr("Скрыть сравнение")
                          : tr("Сравнить избранных"),
                      )}
                    </button>
                    {compare && (
                      <SavedComparison
                        tutors={savedTutors}
                        local={preview}
                        available={(id) => availableSlotsByTutor.get(id)?.[0]}
                        profile={openProfile}
                        write={(id) => openConversation(id, "new")}
                      />
                    )}
                  </div>
                )}
                {!loading &&
                  (view !== "focus"
                    ? tutors.map(tutorRow)
                    : focusTutor && (
                        <div
                          className={styles.deck}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            studentSwipe.current =
                              e.touches.length === 1
                                ? { x: touch.clientX, y: touch.clientY }
                                : null;
                          }}
                          onTouchEnd={(e) => {
                            const start = studentSwipe.current;
                            studentSwipe.current = null;
                            if (!start || tutors.length < 2) return;
                            const point = e.changedTouches[0];
                            const dx = point.clientX - start.x,
                              dy = point.clientY - start.y;
                            if (
                              Math.abs(dx) > 65 &&
                              Math.abs(dx) > Math.abs(dy) * 1.5
                            )
                              setCursor(
                                (i) =>
                                  (i + (dx < 0 ? 1 : tutors.length - 1)) %
                                  tutors.length,
                              );
                          }}
                        >
                          {tutorRow(focusTutor)}
                          <div className={styles.focusActions}>
                            <button
                              disabled={tutors.length < 2}
                              onClick={() =>
                                setCursor(
                                  (c) =>
                                    (c + tutors.length - 1) % tutors.length,
                                )
                              }
                            >
                              {tr("Назад")}
                            </button>
                            <span role="status">
                              {(cursor % tutors.length) + 1}
                              {tr(" из ")}
                              {tutors.length}
                            </span>
                            <button
                              disabled={tutors.length < 2}
                              onClick={() =>
                                setCursor((c) => (c + 1) % tutors.length)
                              }
                            >
                              {tr("Дальше")}
                            </button>
                          </div>
                          {!demo && !saved.includes(focusTutor.id) && (
                            <button
                              className="secondary"
                              onClick={() => {
                                toggleSaved(focusTutor.id);
                                if (tutors.length > 1)
                                  setCursor((c) => (c + 1) % tutors.length);
                              }}
                            >
                              {tr("Сохранить и дальше")}
                            </button>
                          )}
                        </div>
                      ))}
                {!loading && !loadError && tutors.length === 0 && (
                  <Empty
                    title={tr(
                      view === "saved"
                        ? saved.length
                          ? tr("Избранные не подходят под эти фильтры")
                          : tr("Сохраните тех, кто вам подходит")
                        : shown.tutors.length
                          ? tr("По этим фильтрам никого нет")
                          : tr("Здесь будет ваш преподаватель"),
                    )}
                  >
                    {view === "saved" ? (
                      <>
                        <span>
                          {tr(
                            saved.length
                              ? tr(
                                  "Сбросьте условия поиска или вернитесь ко всем преподавателям. ",
                                )
                              : tr(
                                  "Нажмите на закладку в анкете. Сохранённых преподавателей можно сравнить по цене, опыту и времени. ",
                                ),
                          )}
                        </span>
                        {saved.length > 0 && (
                          <button
                            className={styles.textAction}
                            onClick={clearFilters}
                          >
                            {tr("Сбросить фильтры")}
                          </button>
                        )}
                        {tr(" ")}
                        <button
                          className={styles.textAction}
                          onClick={() => updateCatalogSearch({ view: "list" })}
                        >
                          {tr("Открыть список")}
                        </button>
                      </>
                    ) : shown.tutors.length ? (
                      <>
                        <p>
                          {tr(
                            "Попробуйте другой бюджет или язык. Если условия важны — оставьте заявку преподавателям.",
                          )}
                        </p>
                        <button className="secondary" onClick={clearFilters}>
                          {tr("Сбросить фильтры")}
                        </button>
                        {tr(" ")}
                        <button
                          className={styles.textAction}
                          disabled={demo}
                          onClick={() => openModal({ kind: "request" })}
                        >
                          {tr("Оставить заявку")}
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          {tr(
                            "Первые анкеты появятся после проверки. Пока расскажите, с чем нужна помощь: цель и бюджет сохранятся в вашей заявке.",
                          )}
                        </p>
                        <button
                          className="primary"
                          onClick={() => openModal({ kind: "request" })}
                        >
                          {tr("Оставить заявку")}
                        </button>
                        {tr(" ")}
                        <button
                          className={styles.textAction}
                          onClick={() => setDemo(true)}
                        >
                          {tr("Посмотреть пример продукта")}
                        </button>
                      </>
                    )}
                  </Empty>
                )}
              </section>
            )}
            {tab === "groups" && (
              <section
                className={styles.groupList}
                aria-label={tr("Учебные группы")}
                aria-busy={loading}
              >
                {loading && (
                  <LoadingState label={tr("Подбираем занятия в группе…")} />
                )}
                {!loading &&
                  groups.map((g) => (
                    <article key={g.id} className={styles.group}>
                      <time className={styles.dateTile} dateTime={g.starts_at}>
                        <strong>
                          {tr(
                            dateFormatter(uiLocale, {
                              day: "numeric",
                              timeZone: "Asia/Almaty",
                            }).format(new Date(g.starts_at)),
                          )}
                        </strong>
                        <span>
                          {tr(
                            dateFormatter(uiLocale, {
                              month: "short",
                              timeZone: "Asia/Almaty",
                            }).format(new Date(g.starts_at)),
                          )}
                        </span>
                      </time>
                      <div>
                        <Pill
                          text={tr(
                            g.capacity === g.reserved
                              ? tr("Набор заполнен")
                              : tr("Свободно мест: {0} из {1}", [
                                  g.capacity - g.reserved,
                                  g.capacity,
                                ]),
                          )}
                        />
                        <h3>{g.title}</h3>
                        <FormattedText value={g.description} />
                        <div className={styles.meta}>
                          {tr(g.exam)} · {tr(g.language)} · {tr(g.city)}
                          <br />
                          {tr(lessonDate(g.starts_at, uiLocale))}
                          {tr(" · Казахстан, UTC+5 · 60 минут")}
                        </div>
                        <div className={styles.groupContact}>
                          <button
                            className={styles.textAction}
                            onClick={() => openProfile(g.tutor_id)}
                          >
                            {shown.tutors.find((t) => t.id === g.tutor_id)
                              ?.display_name ?? tr("Анкета преподавателя")}
                          </button>
                          {!demo && userId !== g.tutor_id && (
                            <button
                              className={styles.textAction}
                              onClick={() =>
                                openConversation(g.tutor_id, "new")
                              }
                            >
                              {tr("Задать вопрос")}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={styles.tutorAction}>
                        <strong>
                          {tr(
                            g.price === 0
                              ? tr("Бесплатно")
                              : money(g.price, uiLocale),
                          )}
                        </strong>
                        <span>{tr("за участника")}</span>
                        <button
                          className="primary"
                          disabled={
                            demo ||
                            !!enrollment(g, userId, dashboard.bookings, now)
                          }
                          onClick={() => openModal({ kind: "join", group: g })}
                        >
                          {tr(
                            enrollment(g, userId, dashboard.bookings, now) ??
                              tr("Занять место"),
                          )}
                        </button>
                      </div>
                    </article>
                  ))}
                {!loading && !loadError && groups.length === 0 && (
                  <Empty title={tr("Групп по этим условиям пока нет")}>
                    <button className="secondary" onClick={clearFilters}>
                      {tr("Сбросить фильтры")}
                    </button>
                    {tr(" ")}
                    <button
                      className={styles.textAction}
                      onClick={() => openModal({ kind: "request" })}
                    >
                      {tr("Оставить заявку по своей теме")}
                    </button>
                  </Empty>
                )}
              </section>
            )}
            <aside className={styles.requestAside}>
              <div>
                <h3>{tr("Хотите предложить свой бюджет?")}</h3>
                <p>
                  {tr(
                    "Опишите задачу один раз и сравните ответы преподавателей.",
                  )}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => openModal({ kind: "request" })}
              >
                {tr("Оставить заявку")}
              </button>
            </aside>
          </div>
        )}

      {tab === "messages" &&
        (loading ? null : !userId ? (
          <LoginPrompt intent={"tab/" + path} />
        ) : (
          <Inbox
            threads={directThreads}
            pending={!inbox.list && !inbox.error}
            error={inbox.error}
            selected={subpage === "thread" ? itemId : undefined}
            newTutor={
              subpage === "new"
                ? catalog.tutors.find((t) => t.id === itemId && t.id !== userId)
                : undefined
            }
            user={userId}
            catalog={catalog.tutors}
            local={preview}
            teacherView={teacherMode}
            lessons={lessonContacts}
            requests={
              dashboard.requests.filter(
                (r) =>
                  r.status === "open" &&
                  (teacherMode
                    ? r.student_id !== userId
                    : r.student_id === userId),
              ).length
            }
            refresh={inbox.refresh}
            openThread={openConversation}
            openLesson={(id) => openBooking(id, "chat")}
            openProfile={openProfile}
            bookTutor={(id) => {
              const slot = availableSlotsByTutor.get(id)?.[0];
              if (slot) openModal({ kind: "join", group: slot });
              else openProfile(id);
            }}
            canBook={(id) => !!availableSlotsByTutor.get(id)?.length}
            back={() => setTab("messages")}
            browse={() => setTab("tutors")}
            openRequests={() => setTab("requests")}
          />
        ))}

      {tab === "requests" &&
        (loading ? null : !userId ? (
          <LoginPrompt intent={"tab/" + tab} />
        ) : (
          <section className={styles.list}>
            <div className={styles.sectionHead}>
              <h2>
                {tr(
                  teacherMode ? tr("Заявки учеников") : tr("Заявки на занятия"),
                )}
              </h2>
              {!teacherMode && (
                <button
                  className="primary"
                  onClick={() => openModal({ kind: "request" })}
                >
                  {tr("Новая заявка")}
                </button>
              )}
              <p>
                {tr(
                  teacherMode
                    ? tr(
                        "Отправьте ученику цену, время и короткий план занятия.",
                      )
                    : tr(
                        "Заявку видят подтверждённые преподаватели. Пишите учебную задачу без телефона и адреса.",
                      ),
                )}
              </p>
            </div>
            {(teacherMode ? teacherRequests : dashboard.requests).map((r) => {
              const mine = r.student_id === userId;
              const offers = dashboard.offers.filter(
                (o) => o.request_id === r.id,
              );
              return (
                <article className={styles.request} key={r.id}>
                  <div className={styles.spread}>
                    <h3>
                      {tr(r.subject)} · {tr(r.exam)}
                    </h3>
                    <Pill
                      text={tr(
                        r.status === "open"
                          ? tr("Открыта")
                          : r.status === "matched"
                            ? tr("Преподаватель выбран")
                            : tr("Закрыта"),
                      )}
                    />
                  </div>
                  <div className={styles.meta}>
                    {tr(mine ? tr("Ваша заявка") : tr("Запрос ученика"))}
                    {tr(
                      mine &&
                        r.status === "open" &&
                        (offers.length
                          ? tr(" · Предложений: ") + offers.length
                          : tr(" · Ожидаем ответ преподавателя")),
                    )}
                  </div>
                  <p className={styles.goal}>{r.goal}</p>
                  <div className={styles.meta}>
                    {tr("Бюджет: ")}
                    {tr(money(r.budget, uiLocale))}
                    {tr(" за 60 минут · ")}
                    {tr(r.language)} ·{tr(" ")}
                    {tr(r.city)}
                    {tr(
                      r.tutor_id &&
                        tr(" \u00B7 Для: {0}", [tutorName(r.tutor_id)]),
                    )}
                  </div>
                  {mine && r.status === "open" && (
                    <button
                      className={styles.textAction}
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          "close_request",
                          { id: r.id },
                          "Заявка закрыта.",
                        )
                      }
                    >
                      {tr("Закрыть заявку")}
                    </button>
                  )}
                  {!mine &&
                    r.status === "open" &&
                    !offers.some((o) => o.tutor_id === userId) && (
                      <button
                        className={styles.textAction}
                        onClick={() => openModal({ kind: "offer", request: r })}
                      >
                        {tr("Предложить занятие")}
                      </button>
                    )}
                  {offers.map((o) => (
                    <div className={styles.offer} key={o.id}>
                      <strong>
                        {tutorName(o.tutor_id)} · {tr(money(o.price, uiLocale))}
                      </strong>
                      <p>{o.note}</p>
                      <small>
                        {tr(
                          o.price === r.budget
                            ? tr("В пределах указанного бюджета")
                            : money(Math.abs(o.price - r.budget), uiLocale) +
                                (o.price > r.budget
                                  ? tr(" выше бюджета")
                                  : tr(" ниже бюджета")),
                        )}
                      </small>
                      <p>
                        {tr(lessonDate(o.starts_at, uiLocale))}
                        {tr(" · Казахстан, UTC+5 · 60 минут")}
                      </p>
                      {mine && r.status === "open" && o.status === "pending" ? (
                        <button
                          className={styles.textAction}
                          disabled={
                            busy || Date.parse(o.starts_at) < now + 1800000
                          }
                          onClick={async () => {
                            if (!studentReady(dashboard.student_profile)) {
                              window.location.assign(
                                "/findbuddy/student#profile",
                              );
                              return;
                            }
                            if (
                              await mutate(
                                "accept",
                                { id: o.id },
                                "Вы записаны. В чате занятия можно обсудить материалы и место встречи.",
                              )
                            ) {
                              setShowHistory(false);
                              setTab("account");
                            }
                          }}
                        >
                          {tr(
                            Date.parse(o.starts_at) < now + 1800000
                              ? tr("Время предложения истекло")
                              : o.price === 0
                                ? tr("Записаться бесплатно")
                                : tr("Принять за ") + money(o.price, uiLocale),
                          )}
                        </button>
                      ) : (
                        <span className={styles.meta}>
                          {tr(
                            o.status === "accepted"
                              ? tr("Принято")
                              : o.status === "declined"
                                ? tr("Не выбрано")
                                : tr("Ожидает ответа"),
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </article>
              );
            })}
            {(teacherMode ? teacherRequests : dashboard.requests).length ===
              0 && (
              <Empty title={tr("Пока нет заявок")}>
                {tr(
                  teacherMode
                    ? tr(
                        "Здесь появятся заявки, подходящие по предмету, экзамену, языку и формату.",
                      )
                    : tr(
                        "Опишите свою цель и бюджет, чтобы получить предложения.",
                      ),
                )}
              </Empty>
            )}
          </section>
        ))}

      {tab === "account" &&
        (loading ? null : !userId ? (
          <LoginPrompt intent={"tab/" + path} />
        ) : subpage === "lesson" || subpage === "chat" || subpage === "work" ? (
          selectedBooking ? (
            <Workspace
              key={
                (selectedBooking.tutor_id === userId &&
                selectedBooking.lesson_format === "group"
                  ? selectedBooking.group_id
                  : selectedBooking.id) + subpage
              }
              initialPane={subpage}
              booking={selectedBooking}
              dashboard={dashboard}
              user={userId}
              tutor={
                selectedBooking.teacher_name ||
                tutorName(selectedBooking.tutor_id)
              }
              now={now}
              video={video}
              refresh={refresh}
              openSeat={(id) => openBooking(id, subpage)}
              back={() => setTab("account")}
              rebook={
                selectedTutor && selectedTutor.id !== userId
                  ? () => openModal({ kind: "request", tutor: selectedTutor })
                  : undefined
              }
            />
          ) : (
            <Empty title={tr("Занятие недоступно")}>
              <button className="secondary" onClick={() => setTab("account")}>
                {tr("Вернуться к своим записям")}
              </button>
            </Empty>
          )
        ) : (
          <section>
            <div className={styles.accountHead}>
              <div>
                <h2>{tr("Ваши занятия")}</h2>
                <p>
                  {tr("Записи и чат с преподавателем.")}
                  {tr(" ")}
                  <button
                    className={styles.textAction}
                    disabled={loading}
                    onClick={() => void refresh()}
                  >
                    {tr("Обновить")}
                  </button>
                </p>
              </div>
              <div>
                <button
                  className={styles.textAction}
                  disabled={busy}
                  hidden={!telegramAvailable}
                  onClick={() => void connectTelegram()}
                >
                  {tr(
                    dashboard.telegram_connected
                      ? tr("Переподключить Telegram")
                      : tr("Подключить Telegram"),
                  )}
                </button>
                {dashboard.telegram_connected && (
                  <button
                    className={styles.textAction}
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await mutate(
                          "telegram_unlink",
                          {},
                          "Telegram отключён.",
                        )
                      )
                        setTelegramUrl("");
                    }}
                  >
                    {tr("Отключить")}
                  </button>
                )}
              </div>
            </div>
            {nextStudentLesson && !showHistory && (
              <section
                className={styles.nextLesson}
                aria-label={tr("Ближайшее занятие")}
              >
                <div>
                  <p className={styles.eyebrow}>
                    {tr(
                      Date.parse(nextStudentLesson.starts_at) <= now
                        ? tr("Занятие уже идёт")
                        : tr("Ваш следующий урок"),
                    )}
                  </p>
                  <h2>
                    {nextStudentLesson.lesson_title ||
                      nextStudentLesson.subject}
                  </h2>
                  <p>
                    {tutorName(nextStudentLesson.tutor_id)} ·{tr(" ")}
                    {tr(lessonDate(nextStudentLesson.starts_at, uiLocale))} ·
                    UTC+5
                  </p>
                  <small>
                    {tr(
                      "Материалы, связь с преподавателем и домашняя работа — в комнате занятия.",
                    )}
                  </small>
                </div>
                <button
                  className="primary"
                  onClick={() => openBooking(nextStudentLesson.id)}
                >
                  {tr("Открыть занятие")}
                </button>
              </section>
            )}
            {telegramUrl && (
              <div className={styles.notice}>
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                  {tr("Открыть Telegram и нажать Start")}
                </a>
                <p>
                  {tr(
                    "Личная ссылка действует 10 минут. Не передавайте её другим. После подключения: /lessons — занятия, /chats — переписка. Чат также доступен в записи.",
                  )}
                </p>
              </div>
            )}
            {attention.length > 0 && (
              <section className={styles.attention}>
                <h3>{tr("Ждут вашего ответа")}</h3>
                <ul>
                  {attention.map((item) => (
                    <li key={item.id + item.pane}>
                      <button onClick={() => openBooking(item.id, item.pane)}>
                        {tr(item.label)} · {item.peer} ·{" "}
                        {tr(lessonDate(item.starts, uiLocale))}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className={styles.list}>
              {!!dashboard.bookings.length && (
                <div className={styles.viewSwitch}>
                  {["Предстоящие", "История"].map((label, i) => (
                    <button
                      key={label}
                      aria-pressed={showHistory === Boolean(i)}
                      onClick={() => setShowHistory(Boolean(i))}
                    >
                      {tr(label)}
                    </button>
                  ))}
                </div>
              )}
              {visibleBookings.map(bookingRow)}
              {!!dashboard.bookings.length && !visibleBookings.length && (
                <Empty
                  title={tr(
                    showHistory
                      ? tr("История пока пуста")
                      : tr("Нет предстоящих занятий"),
                  )}
                >
                  {showHistory ? (
                    tr("Здесь появятся прошедшие и отменённые записи.")
                  ) : (
                    <button
                      className={styles.textAction}
                      onClick={() => setTab("tutors")}
                    >
                      {tr("Выбрать преподавателя")}
                    </button>
                  )}
                </Empty>
              )}
              {dashboard.bookings.length === 0 && (
                <Empty title={tr("У вас пока нет записей")}>
                  <button
                    className={styles.textAction}
                    onClick={() => setTab("tutors")}
                  >
                    {tr("Найти преподавателя")}
                  </button>
                  {tr(" ")}
                  {tr("или")}
                  {tr(" ")}
                  <button
                    className={styles.textAction}
                    onClick={() => setTab("groups")}
                  >
                    {tr("выбрать мини-группу")}
                  </button>
                  .
                </Empty>
              )}
            </div>
            <details
              className={styles.lessonTools}
              key={subpage}
              open={subpage === "calendar" || undefined}
            >
              <summary>{tr("Календарь и настройки")}</summary>
              <Calendar
                now={now}
                bookings={dashboard.bookings}
                slots={catalog.groups}
                user={userId}
                openBooking={openBooking}
                openSlot={openSlot}
              />
              <CalendarSubscription
                key={userId}
                enabled={!!dashboard.calendar_enabled}
                refresh={refresh}
              />
              <StudentName name={dashboard.student_name} refresh={refresh} />
            </details>
          </section>
        ))}

      {teacherMode &&
        tab === "teacher" &&
        (loading ? null : !userId ? (
          <LoginPrompt intent="tab/teacher" />
        ) : (
          <section className={styles.teacher}>
            {!dashboard.tutor ? (
              <div className={desk.next}>
                <div>
                  <h1>{tr("Кабинет преподавателя")}</h1>
                  <p>
                    {tr(
                      "Создайте анкету с фото, чтобы открыть расписание и принимать записи.",
                    )}
                  </p>
                </div>
                <a className="primary" href="#profile">
                  {tr("Создать анкету преподавателя")}
                </a>
              </div>
            ) : (
              <>
                {currentPanel === "overview" &&
                  dashboard.tutor.verification === "verified" && (
                    <TeacherOverview
                      name={dashboard.tutor.display_name}
                      next={nextTeaching}
                      slots={
                        teachingSlots.filter(
                          (g) =>
                            !g.enrollment_closed &&
                            g.reserved < g.capacity &&
                            Date.parse(g.starts_at) > now + 1800000,
                        ).length
                      }
                      students={teachingStudents.length}
                      requests={
                        teacherRequests.filter((r) => r.status === "open")
                          .length
                      }
                      unread={directThreads.reduce(
                        (total, thread) => total + thread.unread,
                        0,
                      )}
                      tasks={
                        attention.filter((x) =>
                          teaching.some((b) => b.id === x.id),
                        ).length
                      }
                      attention={attention.filter((item) =>
                        teaching.some((booking) => booking.id === item.id),
                      )}
                      openAttention={openBooking}
                      openNext={openBooking}
                      openPanel={openTeacher}
                      add={() => openModal({ kind: "group", individual: true })}
                      addGroup={() => openModal({ kind: "group" })}
                    />
                  )}
                {(currentPanel === "profile" ||
                  dashboard.tutor.verification !== "verified") && (
                  <Card
                    title={dashboard.tutor.display_name}
                    subtitle={dashboard.tutor.headline}
                  >
                    <TutorPhoto
                      tutor={dashboard.tutor}
                      source={
                        dashboard.private_photo
                          ? "data:image/jpeg;base64," +
                            dashboard.private_photo.replace(/\s/g, "")
                          : undefined
                      }
                    />
                    <Pill
                      text={tr(
                        dashboard.tutor.verification === "verified"
                          ? preview
                            ? tr("Опубликовано в локальном режиме")
                            : tr("Личность подтверждена")
                          : dashboard.tutor.verification === "rejected"
                            ? tr("Требуется повторная проверка")
                            : tr("Ожидает проверки личности"),
                      )}
                      tone={
                        dashboard.tutor.verification === "verified"
                          ? "success"
                          : "warning"
                      }
                    />
                    <p className="mt-4">
                      {tr(
                        dashboard.tutor.verification === "verified"
                          ? tr(
                              "Анкета опубликована. Отвечайте на заявки или соберите мини-группу.",
                            )
                          : tr(
                              "Анкета скрыта из каталога. Оператор должен отдельно подтвердить личность; не отправляйте удостоверение в публичную анкету или чат.",
                            ),
                      )}
                    </p>
                    <button
                      className={styles.textAction}
                      onClick={() => {
                        if (dashboard.tutor)
                          openModal({ kind: "edit", tutor: dashboard.tutor });
                      }}
                    >
                      {tr("Редактировать анкету")}
                    </button>
                    {dashboard.tutor.verification === "verified" && (
                      <button
                        className={styles.textAction}
                        onClick={() => openProfile(dashboard.tutor!.id)}
                      >
                        {tr("Посмотреть публичную анкету")}
                      </button>
                    )}
                  </Card>
                )}
              </>
            )}
            {currentPanel === "students" &&
              dashboard.tutor?.verification === "verified" && (
                <>
                  <div>
                    <h1>{tr("Ученики")}</h1>
                    <p>
                      {tr(
                        "Откройте занятие, чтобы написать ученику, провести встречу или проверить работу.",
                      )}
                    </p>
                  </div>
                  {attention.filter((item) =>
                    teaching.some((b) => b.id === item.id),
                  ).length > 0 && (
                    <section className={styles.attention}>
                      <h3>{tr("Ждут вашего ответа")}</h3>
                      <ul>
                        {attention
                          .filter((item) =>
                            teaching.some((b) => b.id === item.id),
                          )
                          .map((item) => (
                            <li key={item.id + item.pane}>
                              <button
                                onClick={() => openBooking(item.id, item.pane)}
                              >
                                {tr(item.label)} · {item.peer}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </section>
                  )}
                  <div className={desk.studentList}>
                    {teachingStudents.map((b) => {
                      const next =
                        teaching.find(
                          (item) =>
                            item.student_id === b.student_id &&
                            Date.parse(item.starts_at) + 3600000 > now,
                        ) ?? b;
                      const seat = dashboard.seats?.find(
                        (item) => item.id === next.id,
                      );
                      const peer = seat?.name ?? "Ученик";
                      return (
                        <article key={b.student_id} className={desk.student}>
                          <div>
                            <strong>{peer}</strong>
                            <small>
                              {tr(lessonDate(next.starts_at, uiLocale))} ·
                              {tr(" ")}
                              {next.lesson_title || next.subject}
                            </small>
                          </div>
                          <div className={desk.buttons}>
                            <button
                              className="secondary"
                              onClick={() => {
                                const thread = directThreads.find(
                                  (t) =>
                                    !t.as_student && t.peer_id === b.student_id,
                                );
                                if (thread) openConversation(thread.id);
                                else openBooking(next.id, "chat");
                              }}
                            >
                              {tr("Чат")}
                            </button>
                            <button
                              className="secondary"
                              onClick={() => openBooking(next.id)}
                            >
                              {tr("Занятие")}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!teachingStudents.length && (
                      <Empty title={tr("Пока нет учеников")}>
                        {tr(
                          "Записи появятся здесь, когда ученик забронирует время.",
                        )}
                      </Empty>
                    )}
                  </div>
                  {teaching.length > 0 && (
                    <details className={styles.lessonTools}>
                      <summary>
                        {tr("Все занятия с учениками · ")}
                        {teaching.length}
                      </summary>
                      {teaching.map(bookingRow)}
                    </details>
                  )}
                  {telegramAvailable && (
                    <button
                      className={styles.textAction}
                      onClick={() => void connectTelegram()}
                    >
                      {tr("Подключить Telegram")}
                    </button>
                  )}
                  {telegramUrl && (
                    <a
                      className="secondary"
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tr("Открыть Telegram и нажать Start")}
                    </a>
                  )}
                </>
              )}
            {currentPanel === "schedule" &&
              dashboard.tutor?.verification === "verified" && (
                <section>
                  <div className={desk.top}>
                    <h1>{tr("Расписание")}</h1>
                    <div className={desk.buttons}>
                      <button
                        className="primary"
                        onClick={() =>
                          openModal({ kind: "group", individual: true })
                        }
                      >
                        {tr("Добавить индивидуальный урок")}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => openModal({ kind: "group" })}
                      >
                        {tr("Создать мини-группу")}
                      </button>
                    </div>
                  </div>
                  <Calendar
                    now={now}
                    bookings={teaching}
                    slots={teachingSlots}
                    user={userId}
                    openBooking={openBooking}
                    openSlot={openSlot}
                  />
                  <CalendarSubscription
                    enabled={!!dashboard.calendar_enabled}
                    refresh={refresh}
                  />
                  <h3>{tr("Опубликованное расписание")}</h3>
                  {catalog.groups.filter((g) => g.tutor_id === userId)
                    .length === 0 && (
                    <p>
                      {tr(
                        "Добавьте дату и цену, чтобы ученики могли записаться сразу.",
                      )}
                    </p>
                  )}
                  {catalog.groups
                    .filter((g) => g.tutor_id === userId)
                    .map((g) => (
                      <article
                        className={styles.scheduleRow}
                        key={g.id}
                        id={"slot-" + g.id}
                      >
                        <div>
                          <strong>{g.title}</strong>
                          <p>
                            {tr(lessonDate(g.starts_at, uiLocale))} ·{tr(" ")}
                            {tr(
                              g.price === 0
                                ? tr("Бесплатно")
                                : money(g.price, uiLocale),
                            )}{" "}
                            ·{tr(" ")}
                            {tr(
                              g.capacity === 1
                                ? tr("Индивидуально")
                                : tr("Группа"),
                            )}
                            {tr(" · Записались: ")}
                            {g.reserved}/{g.capacity}
                          </p>
                        </div>
                        <details
                          key={
                            g.id + String(subpage === "slot" && itemId === g.id)
                          }
                          ref={(el) => {
                            if (
                              el &&
                              subpage === "slot" &&
                              itemId === g.id &&
                              !el.open
                            ) {
                              el.open = true;
                              el.scrollIntoView({ block: "center" });
                            }
                          }}
                        >
                          <summary>{tr("Материалы занятия")}</summary>
                          {g.capacity === 1 &&
                          dashboard.bookings.some(
                            (b) =>
                              b.group_id === g.id && b.status !== "cancelled",
                          ) ? (
                            dashboard.bookings
                              .filter(
                                (b) =>
                                  b.group_id === g.id &&
                                  b.status !== "cancelled",
                              )
                              .map((b) => (
                                <button
                                  key={b.id}
                                  className={styles.textAction}
                                  onClick={() => openBooking(b.id)}
                                >
                                  {tr("Открыть индивидуальное занятие")}
                                </button>
                              ))
                          ) : (
                            <RoomEditor
                              target={{ slot_id: g.id }}
                              room={dashboard.rooms?.find((r) => r.id === g.id)}
                              refresh={refresh}
                            />
                          )}
                        </details>
                        {g.enrollment_closed ? (
                          <Pill text={tr("Набор закрыт")} />
                        ) : (
                          <button
                            className={styles.textAction}
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Закрыть набор? Существующие записи сохранятся.",
                                )
                              )
                                void mutate(
                                  "close_enrollment",
                                  { id: g.id },
                                  "Набор закрыт. Записи учеников сохранены.",
                                );
                            }}
                          >
                            {tr("Закрыть набор")}
                          </button>
                        )}
                      </article>
                    ))}
                </section>
              )}
            {currentPanel === "wallet" &&
              dashboard.tutor?.verification === "verified" && (
                <CommissionSummary
                  dashboard={dashboard}
                  user={userId}
                  now={now}
                  open={openBooking}
                />
              )}
            {preview &&
              (currentPanel === "profile" || currentPanel === "wallet") &&
              dashboard.tutor?.verification === "verified" && (
                <Card title={tr("Тестовые выплаты")}>
                  <strong>
                    {tr("Тестовый остаток · ")}
                    {tr(money(balance, uiLocale))}
                  </strong>
                  <p>
                    {tr(
                      "Демооперации используют условные тенге. В бесплатном пилоте комиссия платформы — 0%.",
                    )}
                  </p>
                  <button
                    className="secondary"
                    disabled={busy || !balance}
                    onClick={() =>
                      void mutate(
                        "test_withdraw",
                        {},
                        "Тестовый вывод проведён.",
                      )
                    }
                  >
                    {tr("Тестовый вывод")}
                  </button>
                </Card>
              )}
          </section>
        ))}

      {!embedded &&
        !teacherMode &&
        tab === "tutors" &&
        subpage !== "profile" && (
          <section className="landingFaq" aria-labelledby="fb-faq-title">
            <p className={styles.eyebrow}>{tr("Без лишних вопросов")}</p>
            <h2 id="fb-faq-title">
              {tr("Сначала понятно. Потом — первый урок.")}
            </h2>
            <details>
              <summary>
                {tr("С чего начать, если не знаю, кого выбрать?")}
              </summary>
              <p>
                {tr(
                  "Выберите предмет и бюджет. В анкете преподавателя посмотрите подход и опыт. Можно написать ему до записи и коротко рассказать о своей цели.",
                )}
              </p>
            </details>
            <details>
              <summary>{tr("За что нужно платить?")}</summary>
              <p>
                {tr(
                  "В пилоте Jup edu бесплатен. Стоимость занятия указана в анкете. Онлайн-оплата не подключена: способ оплаты обсудите с преподавателем.",
                )}
              </p>
            </details>
            <details>
              <summary>{tr("Где будут занятия и домашняя работа?")}</summary>
              <p>
                {tr(
                  "После записи откройте «Мои занятия»: там расписание, чат, материалы и домашняя работа. Формат и место урока согласуйте с преподавателем.",
                )}
              </p>
            </details>
          </section>
        )}
      {!embedded && !teacherMode && <SiteFooter />}
      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => {
          if (!busy) setModal(null);
        }}
        aria-labelledby="fb-dialog-title"
      >
        {modal && (
          <>
            <div className={styles.spread}>
              <h2 id="fb-dialog-title">
                {modal.kind === "request"
                  ? modal.tutor
                    ? tr("Заявка: {0}", [modal.tutor.display_name])
                    : tr("Какое занятие вы ищете?")
                  : modal.kind === "edit"
                    ? tr("Редактирование анкеты")
                    : modal.kind === "apply"
                      ? tr("Анкета преподавателя")
                      : modal.kind === "offer"
                        ? tr("Предложить занятие")
                        : modal.kind === "group"
                          ? modal.individual
                            ? tr("Новый индивидуальный урок")
                            : tr("Новая мини-группа")
                          : modal.group.capacity === 1
                            ? tr("Запись на индивидуальный урок")
                            : tr("Место в мини-группе")}
              </h2>
              <button
                type="button"
                className={styles.textAction}
                disabled={busy}
                onClick={() => setModal(null)}
                aria-label={tr("Закрыть окно")}
              >
                <Icon name="close" />
              </button>
            </div>
            {error && (
              <div className={styles.error} role="alert">
                {tr(error)}
              </div>
            )}
            {modal.kind === "join" && (
              <BookingSummary
                lesson={selectedLesson ?? modal.group}
                slots={profileSlots}
                tutor={shown.tutors.find(
                  (tutor) => tutor.id === modal.group.tutor_id,
                )}
                tutorName={tutorName(modal.group.tutor_id)}
                local={preview}
                busy={busy}
                blocked={bookingBlocked || null}
                choose={(group) => {
                  setError("");
                  setModal({ kind: "join", group });
                }}
                booked={
                  existingBooking
                    ? () => {
                        setModal(null);
                        setError("");
                        openBooking(existingBooking.id);
                      }
                    : undefined
                }
              />
            )}
            {!userId ? (
              <LoginPrompt
                filters={filters}
                intent={
                  modal.kind === "request"
                    ? "request/" + (modal.tutor?.id ?? "")
                    : modal.kind === "join"
                      ? "join/" + modal.group.id
                      : "tab/teacher"
                }
              />
            ) : modal.kind === "join" &&
              dashboard.account?.role !== "student" ? (
              <Card
                title={tr("Для записи нужен аккаунт ученика")}
                subtitle={tr(
                  "Тип аккаунта определяется при регистрации. Ваш преподавательский или рабочий кабинет остаётся отдельным.",
                )}
              >
                <Link
                  className="primary"
                  href="/login?role=student&mode=signup"
                >
                  {tr("Регистрация ученика")}
                </Link>
              </Card>
            ) : modal.kind === "join" &&
              !studentReady(dashboard.student_profile) ? (
              <StudentProfile
                compact
                profile={dashboard.student_profile}
                refresh={refresh}
              />
            ) : modal.kind === "apply" || modal.kind === "edit" ? (
              <TutorForm
                key={modal.kind}
                tutor={modal.kind === "edit" ? modal.tutor : undefined}
                name={dashboard.student_name}
                privatePhoto={dashboard.private_photo}
                busy={busy}
                save={(data) =>
                  void mutate(
                    "save_profile",
                    data,
                    modal.kind === "edit"
                      ? "Анкета обновлена."
                      : preview
                        ? "Анкета опубликована. Добавьте время для записи."
                        : "Анкета отправлена на проверку личности.",
                  )
                }
              />
            ) : (
              <form
                key={
                  modal.kind +
                  (modal.kind === "request" ? (modal.tutor?.id ?? "") : "")
                }
                className={styles.form}
                data-purpose={modal.kind}
                onSubmit={submit}
              >
                {modal.kind === "request" && (
                  <>
                    <div className={styles.formGrid}>
                      {modal.tutor ? (
                        <p>
                          {tr(modal.tutor.subject)} · {tr(modal.tutor.exam)} ·
                          {tr(" ")}
                          {tr(modal.tutor.city)}
                        </p>
                      ) : (
                        <>
                          <Field label={tr("Предмет")}>
                            <select
                              name="subject"
                              defaultValue={filters.subject || "География"}
                            >
                              {FB_SUBJECTS.map((v) => (
                                <option key={v} value={v}>
                                  {tr(v)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={tr("Экзамен")}>
                            <select
                              name="exam"
                              defaultValue={filters.exam || "ЕНТ"}
                            >
                              {FB_EXAMS.map((v) => (
                                <option key={v} value={v}>
                                  {tr(v)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={tr("Язык")}>
                            <select
                              name="language"
                              defaultValue={filters.language || "Русский"}
                            >
                              {FB_LANGUAGES.map((v) => (
                                <option key={v} value={v}>
                                  {tr(v)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={tr("Формат / город")}>
                            <select
                              name="city"
                              defaultValue={filters.city || "Онлайн"}
                            >
                              {FB_CITIES.map((v) => (
                                <option key={v} value={v}>
                                  {tr(v)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                    {modal.tutor && (
                      <Field label={tr("Язык занятия")}>
                        <select
                          name="language"
                          defaultValue={modal.tutor.language}
                        >
                          {(
                            modal.offering?.languages ?? [modal.tutor.language]
                          ).map((l) => (
                            <option key={l} value={l}>
                              {tr(l)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label={tr("Бюджет за 60 минут, ₸")}>
                      <input
                        type="number"
                        name="budget"
                        required
                        min={0}
                        max={100000}
                        defaultValue={
                          modal.tutor?.price ??
                          (filters.maxPrice < 100000
                            ? filters.maxPrice === 0
                              ? 0
                              : Math.max(500, filters.maxPrice)
                            : 3000)
                        }
                      />
                    </Field>
                    <Field label={tr("Цель и удобное время")}>
                      <textarea
                        name="goal"
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={4}
                        placeholder={tr(
                          "Готовлюсь к ЕНТ. Нужно разобрать карты и климат. Удобно в будни вечером.",
                        )}
                      />
                    </Field>
                  </>
                )}
                {modal.kind === "offer" && (
                  <>
                    <p>{modal.request.goal}</p>
                    <Field label={tr("Направление")}>
                      <select name="offering_id" required>
                        {dashboard.offerings
                          ?.filter(
                            (o) =>
                              o.active &&
                              o.subject === modal.request.subject &&
                              o.exam === modal.request.exam &&
                              o.languages.includes(modal.request.language),
                          )
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label={tr("Цена за 60 минут, ₸")}>
                      <input
                        type="number"
                        name="price"
                        required
                        min={0}
                        max={100000}
                        step={1}
                        defaultValue={modal.request.budget}
                      />
                    </Field>
                    <Field label={tr("Дата и время · Казахстан, UTC+5")}>
                      <input type="datetime-local" name="starts_at" required />
                    </Field>
                    <Field label={tr("Как вы поможете")}>
                      <textarea
                        name="note"
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={3}
                      />
                    </Field>
                    <p className={styles.meta}>
                      {tr(
                        "В пилоте комиссия Jup edu — 0%. Ученик увидит вашу цену и сможет принять предложение.",
                      )}
                    </p>
                  </>
                )}
                {modal.kind === "group" && (
                  <>
                    <Field label={tr("Направление")}>
                      <select
                        name="offering_id"
                        required
                        value={selectedOffering?.id ?? ""}
                        onChange={(e) => setPublicationOffering(e.target.value)}
                      >
                        {dashboard.offerings
                          ?.filter((o) => o.active)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title} · {tr(o.languages.join(", "))}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <p className={styles.meta}>
                      {tr("60 минут · начало минимум через 30 минут.")}
                    </p>
                    {(selectedOffering?.languages.length ?? 0) > 1 ? (
                      <Field label={tr("Язык занятия")}>
                        <select name="language" key={publicationOffering}>
                          {selectedOffering?.languages.map((language) => (
                            <option key={language} value={language}>
                              {tr(language)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <input
                        type="hidden"
                        name="language"
                        value={
                          selectedOffering?.languages[0] ??
                          dashboard.tutor?.language ??
                          "Русский"
                        }
                      />
                    )}
                    <DraftFields
                      kind="lesson"
                      subject={
                        selectedOffering?.subject ??
                        dashboard.tutor?.subject ??
                        ""
                      }
                      exam={
                        selectedOffering?.exam ?? dashboard.tutor?.exam ?? ""
                      }
                      disabled={busy}
                    />
                    <Field label={tr("Дата и время · Казахстан, UTC+5")}>
                      <input
                        name="starts_at"
                        type="datetime-local"
                        required
                        value={publicationStarts}
                        onChange={(e) => setPublicationStarts(e.target.value)}
                      />
                    </Field>
                    <div
                      className="quickTimes"
                      role="group"
                      aria-label={tr("Быстрый выбор времени")}
                    >
                      {lessonTimeSuggestions(now, uiLocale).map((time) => (
                        <button
                          type="button"
                          key={time.value}
                          onClick={() => setPublicationStarts(time.value)}
                        >
                          {tr(time.label)}
                        </button>
                      ))}
                    </div>
                    <div className={styles.formGrid}>
                      <Field label={tr("Цена за участника, ₸")}>
                        <input
                          key={publicationOffering}
                          name="price"
                          type="number"
                          required
                          min={0}
                          max={100000}
                          step={1}
                          defaultValue={
                            selectedOffering?.price ??
                            dashboard.tutor?.price ??
                            1500
                          }
                        />
                      </Field>
                    </div>
                    <details className="lessonAdvanced">
                      <summary>
                        {tr("Повторение")}
                        {tr(!modal.individual && tr(" и размер группы"))}
                      </summary>
                      <div>
                        <Field label={tr("Повторение")}>
                          <select name="weeks" defaultValue="1">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                              <option key={n} value={n}>
                                {tr(
                                  n === 1
                                    ? tr("Одно занятие")
                                    : tr("Каждую неделю · занятий: ") + n,
                                )}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {modal.individual ? (
                          <input type="hidden" name="capacity" value="1" />
                        ) : (
                          <Field label={tr("Размер группы, 2–12")}>
                            <input
                              name="capacity"
                              type="number"
                              required
                              min={2}
                              max={12}
                              step={1}
                              defaultValue={6}
                            />
                          </Field>
                        )}
                      </div>
                    </details>
                  </>
                )}
                <PrimaryButton
                  disabled={busy || loading || !!loadError || !!bookingBlocked}
                >
                  {tr(
                    busy
                      ? tr("Сохраняем…")
                      : modal.kind === "request"
                        ? tr("Отправить заявку")
                        : modal.kind === "offer"
                          ? tr("Отправить предложение")
                          : modal.kind === "group"
                            ? modal.individual
                              ? tr("Опубликовать урок")
                              : tr("Опубликовать группу")
                            : bookingBlocked || tr("Подтвердить запись"),
                  )}
                </PrimaryButton>
              </form>
            )}
          </>
        )}
      </dialog>
    </Root>
  );
}
