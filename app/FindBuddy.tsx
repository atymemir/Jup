"use client";
import { NotificationBell } from "./notifications/NotificationBell";
import { useNotifications } from "./notifications/useNotifications";
import { LoadingState } from "./ui/LoadingState";
import { Brand } from "./ui/Brand";

import { CalendarSubscription } from "./lessons/CalendarSubscription";
import { Calendar } from "./lessons/Calendar";
import { BookingSummary } from "./lessons/BookingSummary";
import { Workspace, RoomEditor, StudentName } from "./lessons/Workspace";
import { api } from "./lib/api";
import { fetchJson } from "./lib/http";
import Link from "next/link";
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
  return (
    <label className={styles.field}>
      <span>{label}</span>
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
  return (
    <select
      name={name}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      required={!all}
    >
      {all && <option value="">{all}</option>}
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
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
  const search = useSyncExternalStore(
    watchCatalogSearch,
    catalogSnapshot,
    () => "",
  );
  return (
    <Card
      title={
        intent === "tab/teacher"
          ? "Откройте кабинет преподавателя"
          : intent.startsWith("tab/messages")
            ? "Войдите, чтобы написать"
            : intent === "tab/account"
              ? "Ваши занятия и переписка"
              : intent === "tab/requests"
                ? "Заявки и ответы преподавателей"
                : "Войдите, чтобы продолжить"
      }
      subtitle={
        intent.startsWith("tab/messages")
          ? "Ваш диалог откроется сразу после входа."
          : intent.startsWith("join/")
            ? "После входа вы вернётесь к подтверждению этой записи."
            : intent === "tab/teacher"
              ? "Создайте анкету и пройдите проверку личности, чтобы принимать учеников."
              : intent === "tab/account"
                ? "Войдите, чтобы посмотреть свои записи и написать преподавателю."
                : "Войдите, чтобы отправить заявку и согласовать условия урока."
      }
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
          Войти или зарегистрироваться
        </Link>
      </div>
    </Card>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon name="search" size={25} /></span>
      <h3>{title}</h3>
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
        setLoadError(err instanceof Error ? err.message : "Каталог недоступен.");
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
      if (document.hidden || pending) return;
      pending = true;
      try {
        const version = refreshNumber.current;
        const next = await api<Dashboard>("dashboard");
        if (alive && refreshNumber.current === version) setDashboard(next);
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
  const existingBooking = modal?.kind === "join" ? dashboard.bookings.find((booking) => booking.group_id === modal.group.id && booking.status !== "cancelled") : undefined;
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
  function openModal(next: Modal) {
    setError("");
    setNotice("");
    if (next.kind === "group")
      setPublicationOffering(dashboard.offerings?.[0]?.id ?? "");
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
            if (result && typeof result === "object" && "id" in result && typeof result.id === "string") bookingId = result.id;
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
    { label: filters.maxPrice < initialFilters.maxPrice
      ? filters.maxPrice === 0
        ? "Бесплатно"
        : "до " + money(filters.maxPrice)
      : "", clear: () => filter("maxPrice", initialFilters.maxPrice) },
    { label: onlyAvailable ? "Открыта запись" : "", clear: () => updateCatalogSearch({ onlyAvailable: false }) },
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
              {booking.subject} ·{" "}
              {booking.lesson_format === "group" ||
              (!booking.lesson_format && booking.group_id)
                ? "Группа"
                : "Индивидуально"}
            </h3>
            {booking.lesson_title && <strong>{booking.lesson_title}</strong>}
            <p>{lessonDate(booking.starts_at)} · 60 минут · Казахстан, UTC+5</p>
            <p>
              {booking.tutor_id === userId
                ? "Ученик: " +
                  (dashboard.seats?.find((s) => s.id === booking.id)?.name ??
                    "имя не указано")
                : tutorName(booking.tutor_id)}{" "}
              · {money(booking.price)}
            </p>
          </div>
          <Pill
            text={
              booking.status === "cancelled"
                ? "Отменено"
                : past
                  ? outcomeLabel(
                      dashboard.outcomes?.find(
                        (o) => o.booking_id === booking.id,
                      ),
                    )
                  : paid
                    ? "Тестовая оплата прошла"
                    : preview
                      ? "Демо-бронь"
                      : "Место забронировано"
            }
          />
        </div>
        {booking.tutor_id === userId && (
          <p className={styles.meta}>
            Комиссия Jup edu в пилоте: {money(booking.commission)} · После
            комиссии платформы: {money(booking.tutor_net)}.
          </p>
        )}
        {booking.status !== "cancelled" && (
          <>
            <button className="primary" onClick={() => openBooking(booking.id)}>
              Открыть занятие
            </button>
            {dashboard.seats?.find((s) => s.id === booking.id)?.move && (
              <p className={styles.meta}>Предложен перенос времени</p>
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
                  Оплатить в деморежиме · {money(booking.price)}
                </button>
              )
            ) : (
              <p className={styles.meta}>
                {booking.price === 0
                  ? "Бесплатное занятие. Оплата не требуется."
                  : "Jup edu не принимает оплату уроков в пилоте. Условия расчёта согласуются с преподавателем."}
              </p>
            )}
            <div className={styles.quietActions}>
              {!past && (
                <button onClick={() => downloadCalendar(booking)}>
                  В календарь
                </button>
              )}
              <button onClick={() => openBooking(booking.id, "chat")}>
                Открыть чат ({messages.length})
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
                Отменить запись
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
                  Оценить преподавателя
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
      lang="ru"
    >
      <header className={styles.topline}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Jup edu — главная"
        >
          <Brand />
        </Link>
        <nav className={styles.tabs} aria-label="Разделы Jup edu">
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
                  {label}
                  {panel === "messages" && !!unread && (
                    <b className={styles.navBadge}>{Math.min(unread, 99)}</b>
                  )}
                </span>
              </button>
            ))
          ) : (
            <>
              <Link className={styles.publicNavLink} href="/" aria-current={tab === "tutors" ? "page" : undefined}><Icon name="search" size={19} /><span>Преподаватели</span></Link>
              <button
                className={styles.publicNavLink}
                aria-current={tab === "groups" ? "page" : undefined}
                onClick={() => setTab("groups")}
              >
                <Icon name="groups" size={19} /><span>Группы</span>
              </button>
              <Link className={styles.publicNavLink} href="/centers"><Icon name="teacher" size={19} /><span>Учебные центры</span></Link>
            </>
          )}
        </nav>
        <div className={styles.accountLinks}>
          {!embedded && userId && <NotificationBell role={dashboard.account?.role ?? "student"} state={notifications} />}
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
                Начать
              </Link>
              <Link
                href={authLoginHref(
                  "tab/" + (path || "tutors"),
                  search,
                  teacherMode,
                )}
              >
                Войти
              </Link>
            </>
          ) : (
            <details className={styles.accountMenu}>
              <summary>
                {dashboard.student_name ||
                  dashboard.tutor?.display_name ||
                  "Аккаунт"}
              </summary>
              <div>
                <a href={roleHome(dashboard.account?.role ?? "student")}>
                  Мой кабинет
                </a>
                {preview && <Link href="/login">Войти в другой аккаунт</Link>}
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
                        const { error } = await getSupabase().auth.signOut({ scope: "local" });
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
                  Выйти
                </button>
              </div>
            </details>
          )}
        </div>
      </header>
      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
      {error && !modal && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {loadError && (
        <div className={styles.setup}>
          <strong>Каталог временно недоступен</strong>
          <p>{loadError}</p>
          <button onClick={() => void refresh()}>
            Повторить загрузку
          </button> ·{" "}
          <button onClick={() => setDemo((v) => !v)}>
            {demo ? "Закрыть пример" : "Посмотреть пример продукта"}
          </button>
        </div>
      )}
      {demo && (
        <div className={styles.notice}>
          <strong>Демонстрация.</strong> Анкеты, дата и группа вымышлены.
          Записаться и отправить им заявку нельзя.{" "}
          <button className={styles.textAction} onClick={() => setDemo(false)}>
            Вернуться к реальным данным
          </button>
        </div>
      )}
      {(loading || busy) && <div className="requestProgress" role="status"><span className="srOnly">{busy ? "Сохраняем изменения…" : "Загружаем занятия…"}</span></div>}
      {loading && (teacherMode || (tab !== "tutors" && tab !== "groups") || subpage === "profile") && <LoadingState label="Открываем ваши занятия…" />}
      {!demo && (
        <div className={styles.previewBanner} role="note">
          <strong>Бесплатный пилот</strong>
          <span>Jup edu объединяет учеников и преподавателей. Комиссия платформы — 0%.</span>
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
            <Empty title="Анкета недоступна">
              <button className="secondary" onClick={() => setTab("tutors")}>
                Открыть каталог
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
                  Найдите своего человека для учёбы
                </p>
                <h1>
                  {tab === "tutors" ? (
                    <>
                      Сложное станет
                      <br />
                      <em>понятным.</em>
                    </>
                  ) : (
                    <>
                      Занятия <em>в мини-группе.</em>
                    </>
                  )}
                </h1>
                <p className={styles.intro}>
                  {tab === "tutors"
                    ? "Выберите преподавателя под вашу цель, язык и бюджет. Знакомство, запись и всё после урока — в одном месте."
                    : "Выберите тему и дату. Одно место — для одного ученика."}
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
                            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                            block: "start",
                          });
                      }}
                    >
                      Найти преподавателя
                    </button>
                    <a
                      href="#how-it-works"
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("how-it-works")
                          ?.scrollIntoView({
                            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                            block: "center",
                          });
                      }}
                    >
                      Как это работает
                    </a>
                  </div>
                )}
                <div
                  className={styles.examChoices}
                  role="group"
                  aria-label="Выберите экзамен"
                >
                  {["", ...FB_EXAMS].map((exam) => (
                    <button
                      key={exam}
                      aria-pressed={filters.exam === exam}
                      onClick={() => filter("exam", exam)}
                    >
                      {exam === "Школьная программа" ? "Школа" : exam || "Все"}
                    </button>
                  ))}
                </div>
              </div>
              {tab === "tutors" && (
                <aside
                  className={styles.feature}
                  id="how-it-works"
                  aria-label="Как это работает"
                >
                  <div className={styles.featureTop}>
                    <span>
                      <Icon name="calendar" size={18} /> Твой следующий шаг
                    </span>
                  </div>
                  <ol className={styles.bookingSteps}>
                    <li>
                      <strong>Тот, с кем понятно</strong>
                      <span>Сначала подход и цена. Потом решение.</span>
                    </li>
                    <li>
                      <strong>Время, которое подходит</strong>
                      <span>
                        Забронируйте время или напишите преподавателю.
                      </span>
                    </li>
                    <li>
                      <strong>Дальше — учиться</strong>
                      <span>
                        Расписание, переписка, материалы и домашняя работа.
                      </span>
                    </li>
                  </ol>
                  <div className={styles.featureBottom}>
                    <small>
                      Запись без списания денег. Онлайн-оплата пока не
                      подключена.
                    </small>
                  </div>
                </aside>
              )}
            </header>
            <section
              id="fb-search-panel"
              aria-label="Фильтры поиска"
              className={styles.searchPanel}
            >
              <div className={styles.searchPanelHeader}><span><Icon name="filters" size={20} /></span><div><h2>Какой урок вам нужен?</h2><p>Выберите условия — подходящие анкеты появятся ниже.</p></div></div>
              <div className={styles.quickFilters}>
                <Field label="Что изучаем?">
                  <Select
                    name="subject"
                    values={FB_SUBJECTS}
                    value={filters.subject}
                    onChange={(v) => filter("subject", v)}
                    all="Все предметы"
                  />
                </Field>
                <Field label="Бюджет за 60 минут">
                  <select
                    aria-label="Бюджет за 60 минут"
                    value={String(filters.maxPrice)}
                    onChange={(e) => filter("maxPrice", Number(e.target.value))}
                  >
                    <option value="100000">Любой бюджет</option>
                    <option value="0">Бесплатные занятия</option>
                    {[3000, 5000, 7000, 10000].map((price) => (
                      <option key={price} value={price}>
                        До {money(price)}
                      </option>
                    ))}
                    {![0, 3000, 5000, 7000, 10000, 100000].includes(
                      filters.maxPrice,
                    ) && (
                      <option value={filters.maxPrice}>
                        До {money(filters.maxPrice)}
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
                    aria-label="Поиск"
                    type="search"
                    placeholder={
                      tab === "tutors"
                        ? "Предмет, тема или имя"
                        : "Предмет или тема группы"
                    }
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
                  Фильтры
                  {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
                </button>
              </div>
              {activeFilters.length > 0 && (
                <div className={styles.filterSummary}>
                  {activeFilters.map((item) => <button className={styles.filterChip} key={item.label} aria-label={"Убрать фильтр: " + item.label} onClick={item.clear}>{item.label}<Icon name="close" size={14} /></button>)}
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
                    Сбросить
                  </button>
                </div>
              )}
              <div id="fb-more" hidden={!filtersOpen} className={styles.more}>
                <div className={styles.formGrid}>
                  <Field label="Язык">
                    <Select
                      name="language"
                      values={FB_LANGUAGES}
                      value={filters.language}
                      onChange={(v) => filter("language", v)}
                      all="Любой язык"
                    />
                  </Field>
                  <Field label="Формат / город">
                    <Select
                      name="city"
                      values={FB_CITIES}
                      value={filters.city}
                      onChange={(v) => filter("city", v)}
                      all="Все города"
                    />
                  </Field>
                  <Field label="До, ₸ за занятие">
                    <input
                      key={filters.maxPrice}
                      type="number"
                      min={0}
                      max={100000}
                      step={1}
                      placeholder="Без ограничения"
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
                  Только со свободными местами
                </label>
              </div>
            </section>
            <div className={styles.resultsHeader}>
              <div>
                <h2>
                  {tab === "tutors"
                    ? view === "saved"
                      ? "Избранные преподаватели"
                      : "Преподаватели"
                    : "Расписание групп"}{" "}
                  <small aria-live="polite">
                    {loading
                      ? "…"
                      : tab === "tutors"
                        ? tutors.length
                        : groups.length}
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
                      Сравнить избранных · {savedTutors.length}
                    </button>
                  )}
              </div>
              {tab === "tutors" && (
                <div className={styles.resultTools}>
                  <select
                    aria-label="Сортировка преподавателей"
                    value={sortBy}
                    onChange={(e) =>
                      updateCatalogSearch({
                        sortBy: e.target.value === "time" ? "time" : "price",
                      })
                    }
                  >
                    <option value="price">По цене</option>
                    <option value="time">По времени</option>
                  </select>
                  <div className={styles.viewSwitch} role="group" aria-label="Отображение анкет">
                    {([["list", "Все анкеты"], ["focus", "По одной"], ["saved", "Избранное"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => updateCatalogSearch({ view: value })}>{label}{value === "saved" && saved.length > 0 && <span>{saved.length}</span>}</button>)}
                  </div>
                </div>
              )}
            </div>
            {tab === "tutors" && (
              <section
                className={
                  view === "focus" ? styles.focusList : styles.tutorGrid
                }
                aria-label="Преподаватели"
                aria-busy={loading}
              >
                {loading && <span className="srOnly" role="status">Подбираем преподавателей…</span>}
                {loading &&
                  (view === "focus" ? [0] : [0, 1]).map((id) => (
                    <div
                      className={styles.skeleton}
                      key={id}
                      aria-hidden="true"
                    >
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                  ))}
                {view === "saved" && !demo && savedTutors.length >= 2 && (
                  <div className={styles.compareControl}>
                    <button
                      className="secondary"
                      aria-expanded={compare}
                      onClick={() => setCompare(!compare)}
                    >
                      {compare ? "Скрыть сравнение" : "Сравнить избранных"}
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
                {!loading && (view !== "focus"
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
                                (c) => (c + tutors.length - 1) % tutors.length,
                              )
                            }
                          >
                            Назад
                          </button>
                          <span role="status">
                            {(cursor % tutors.length) + 1} из {tutors.length}
                          </span>
                          <button
                            disabled={tutors.length < 2}
                            onClick={() =>
                              setCursor((c) => (c + 1) % tutors.length)
                            }
                          >
                            Дальше
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
                            Сохранить и дальше
                          </button>
                        )}
                      </div>
                    ))}
                {!loading && !loadError && tutors.length === 0 && (
                  <Empty
                    title={
                      view === "saved"
                        ? saved.length
                          ? "Избранные не подходят под эти фильтры"
                          : "Сохраните тех, кто вам подходит"
                        : shown.tutors.length
                          ? "По этим фильтрам никого нет"
                          : "Здесь будет ваш преподаватель"
                    }
                  >
                    {view === "saved" ? (
                      <>
                        <span>
                          {saved.length
                            ? "Сбросьте условия поиска или вернитесь ко всем преподавателям. "
                            : "Нажмите на закладку в анкете. Сохранённых преподавателей можно сравнить по цене, опыту и времени. "}
                        </span>
                        {saved.length > 0 && (
                          <button
                            className={styles.textAction}
                            onClick={clearFilters}
                          >
                            Сбросить фильтры
                          </button>
                        )}{" "}
                        <button
                          className={styles.textAction}
                          onClick={() => updateCatalogSearch({ view: "list" })}
                        >
                          Открыть список
                        </button>
                      </>
                    ) : shown.tutors.length ? (
                      <>
                        <p>
                          Попробуйте другой бюджет или язык. Если условия важны
                          — оставьте заявку преподавателям.
                        </p>
                        <button className="secondary" onClick={clearFilters}>
                          Сбросить фильтры
                        </button>{" "}
                        <button
                          className={styles.textAction}
                          disabled={demo}
                          onClick={() => openModal({ kind: "request" })}
                        >
                          Оставить заявку
                        </button>
                      </>
                    ) : (
                      <>
                        <p>Первые анкеты появятся после проверки. Пока расскажите, с чем нужна помощь: цель и бюджет сохранятся в вашей заявке.</p>
                        <button
                          className="primary"
                          onClick={() => openModal({ kind: "request" })}
                        >
                          Оставить заявку
                        </button>{" "}
                        <button
                          className={styles.textAction}
                          onClick={() => setDemo(true)}
                        >
                          Посмотреть пример продукта
                        </button>
                      </>
                    )}
                  </Empty>
                )}
              </section>
            )}
            {tab === "groups" && (
              <section className={styles.groupList} aria-label="Учебные группы" aria-busy={loading}>
                {loading && <LoadingState label="Подбираем занятия в группе…" />}
                {!loading && groups.map((g) => (
                  <article key={g.id} className={styles.group}>
                    <time className={styles.dateTile} dateTime={g.starts_at}>
                      <strong>
                        {new Intl.DateTimeFormat("ru", {
                          day: "numeric",
                          timeZone: "Asia/Almaty",
                        }).format(new Date(g.starts_at))}
                      </strong>
                      <span>
                        {new Intl.DateTimeFormat("ru", {
                          month: "short",
                          timeZone: "Asia/Almaty",
                        }).format(new Date(g.starts_at))}
                      </span>
                    </time>
                    <div>
                      <Pill
                        text={
                          g.capacity === g.reserved
                            ? "Набор заполнен"
                            : `Свободно мест: ${g.capacity - g.reserved} из ${g.capacity}`
                        }
                      />
                      <h3>{g.title}</h3>
                      <p>{g.description}</p>
                      <div className={styles.meta}>
                        {g.exam} · {g.language} · {g.city}
                        <br />
                        {lessonDate(g.starts_at)} · Казахстан, UTC+5 · 60 минут
                      </div>
                      <div className={styles.groupContact}>
                        <button
                          className={styles.textAction}
                          onClick={() => openProfile(g.tutor_id)}
                        >
                          {shown.tutors.find((t) => t.id === g.tutor_id)
                            ?.display_name ?? "Анкета преподавателя"}
                        </button>
                        {!demo && userId !== g.tutor_id && (
                          <button
                            className={styles.textAction}
                            onClick={() => openConversation(g.tutor_id, "new")}
                          >
                            Задать вопрос
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.tutorAction}>
                      <strong>
                        {g.price === 0 ? "Бесплатно" : money(g.price)}
                      </strong>
                      <span>за участника</span>
                      <button
                        className="primary"
                        disabled={
                          demo ||
                          !!enrollment(g, userId, dashboard.bookings, now)
                        }
                        onClick={() => openModal({ kind: "join", group: g })}
                      >
                        {enrollment(g, userId, dashboard.bookings, now) ??
                          "Занять место"}
                      </button>
                    </div>
                  </article>
                ))}
                {!loading && !loadError && groups.length === 0 && (
                  <Empty title="Групп по этим условиям пока нет">
                    <button className="secondary" onClick={clearFilters}>
                      Сбросить фильтры
                    </button>{" "}
                    <button
                      className={styles.textAction}
                      onClick={() => openModal({ kind: "request" })}
                    >
                      Оставить заявку по своей теме
                    </button>
                  </Empty>
                )}
              </section>
            )}
            <aside className={styles.requestAside}>
              <div>
                <h3>Хотите предложить свой бюджет?</h3>
                <p>Опишите задачу один раз и сравните ответы преподавателей.</p>
              </div>
              <button
                className="secondary"
                onClick={() => openModal({ kind: "request" })}
              >
                Оставить заявку
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
              <h2>{teacherMode ? "Заявки учеников" : "Заявки на занятия"}</h2>
              {!teacherMode && (
                <button
                  className="primary"
                  onClick={() => openModal({ kind: "request" })}
                >
                  Новая заявка
                </button>
              )}
              <p>
                {teacherMode
                  ? "Отправьте ученику цену, время и короткий план занятия."
                  : "Заявку видят подтверждённые преподаватели. Пишите учебную задачу без телефона и адреса."}
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
                      {r.subject} · {r.exam}
                    </h3>
                    <Pill
                      text={
                        r.status === "open"
                          ? "Открыта"
                          : r.status === "matched"
                            ? "Преподаватель выбран"
                            : "Закрыта"
                      }
                    />
                  </div>
                  <div className={styles.meta}>
                    {mine ? "Ваша заявка" : "Запрос ученика"}
                    {mine &&
                      r.status === "open" &&
                      (offers.length
                        ? " · Предложений: " + offers.length
                        : " · Ожидаем ответ преподавателя")}
                  </div>
                  <p className={styles.goal}>{r.goal}</p>
                  <div className={styles.meta}>
                    Бюджет: {money(r.budget)} за 60 минут · {r.language} ·{" "}
                    {r.city}
                    {r.tutor_id && ` · Для: ${tutorName(r.tutor_id)}`}
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
                      Закрыть заявку
                    </button>
                  )}
                  {!mine &&
                    r.status === "open" &&
                    !offers.some((o) => o.tutor_id === userId) && (
                      <button
                        className={styles.textAction}
                        onClick={() => openModal({ kind: "offer", request: r })}
                      >
                        Предложить занятие
                      </button>
                    )}
                  {offers.map((o) => (
                    <div className={styles.offer} key={o.id}>
                      <strong>
                        {tutorName(o.tutor_id)} · {money(o.price)}
                      </strong>
                      <p>{o.note}</p>
                      <small>
                        {o.price === r.budget
                          ? "В пределах указанного бюджета"
                          : money(Math.abs(o.price - r.budget)) +
                            (o.price > r.budget
                              ? " выше бюджета"
                              : " ниже бюджета")}
                      </small>
                      <p>
                        {lessonDate(o.starts_at)} · Казахстан, UTC+5 · 60 минут
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
                          {Date.parse(o.starts_at) < now + 1800000
                            ? "Время предложения истекло"
                            : o.price === 0
                              ? "Записаться бесплатно"
                              : "Принять за " + money(o.price)}
                        </button>
                      ) : (
                        <span className={styles.meta}>
                          {o.status === "accepted"
                            ? "Принято"
                            : o.status === "declined"
                              ? "Не выбрано"
                              : "Ожидает ответа"}
                        </span>
                      )}
                    </div>
                  ))}
                </article>
              );
            })}
            {(teacherMode ? teacherRequests : dashboard.requests).length ===
              0 && (
              <Empty title="Пока нет заявок">
                {teacherMode
                  ? "Здесь появятся заявки, подходящие по предмету, экзамену, языку и формату."
                  : "Опишите свою цель и бюджет, чтобы получить предложения."}
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
            <Empty title="Занятие недоступно">
              <button className="secondary" onClick={() => setTab("account")}>
                Вернуться к своим записям
              </button>
            </Empty>
          )
        ) : (
          <section>
            <div className={styles.accountHead}>
              <div>
                <h2>Ваши занятия</h2>
                <p>
                  Записи и чат с преподавателем.{" "}
                  <button
                    className={styles.textAction}
                    disabled={loading}
                    onClick={() => void refresh()}
                  >
                    Обновить
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
                  {dashboard.telegram_connected
                    ? "Переподключить Telegram"
                    : "Подключить Telegram"}
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
                    Отключить
                  </button>
                )}
              </div>
            </div>
            {nextStudentLesson && !showHistory && (
              <section
                className={styles.nextLesson}
                aria-label="Ближайшее занятие"
              >
                <div>
                  <p className={styles.eyebrow}>
                    {Date.parse(nextStudentLesson.starts_at) <= now
                      ? "Занятие уже идёт"
                      : "Ваш следующий урок"}
                  </p>
                  <h2>
                    {nextStudentLesson.lesson_title ||
                      nextStudentLesson.subject}
                  </h2>
                  <p>
                    {tutorName(nextStudentLesson.tutor_id)} ·{" "}
                    {lessonDate(nextStudentLesson.starts_at)} · UTC+5
                  </p>
                  <small>
                    Материалы, связь с преподавателем и домашняя работа — в
                    комнате занятия.
                  </small>
                </div>
                <button
                  className="primary"
                  onClick={() => openBooking(nextStudentLesson.id)}
                >
                  Открыть занятие
                </button>
              </section>
            )}
            {telegramUrl && (
              <div className={styles.notice}>
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                  Открыть Telegram и нажать Start
                </a>
                <p>
                  Личная ссылка действует 10 минут. Не передавайте её другим.
                  После подключения: /lessons — занятия, /chats — переписка. Чат
                  также доступен в записи.
                </p>
              </div>
            )}
            {attention.length > 0 && (
              <section className={styles.attention}>
                <h3>Ждут вашего ответа</h3>
                <ul>
                  {attention.map((item) => (
                    <li key={item.id + item.pane}>
                      <button onClick={() => openBooking(item.id, item.pane)}>
                        {item.label} · {item.peer} · {lessonDate(item.starts)}
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
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {visibleBookings.map(bookingRow)}
              {!!dashboard.bookings.length && !visibleBookings.length && (
                <Empty
                  title={
                    showHistory
                      ? "История пока пуста"
                      : "Нет предстоящих занятий"
                  }
                >
                  {showHistory ? (
                    "Здесь появятся прошедшие и отменённые записи."
                  ) : (
                    <button
                      className={styles.textAction}
                      onClick={() => setTab("tutors")}
                    >
                      Выбрать преподавателя
                    </button>
                  )}
                </Empty>
              )}
              {dashboard.bookings.length === 0 && (
                <Empty title="У вас пока нет записей">
                  <button
                    className={styles.textAction}
                    onClick={() => setTab("tutors")}
                  >
                    Найти преподавателя
                  </button>{" "}
                  или{" "}
                  <button
                    className={styles.textAction}
                    onClick={() => setTab("groups")}
                  >
                    выбрать мини-группу
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
              <summary>Календарь и настройки</summary>
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
                  <h1>Кабинет преподавателя</h1>
                  <p>
                    Создайте анкету с фото, чтобы открыть расписание и принимать
                    записи.
                  </p>
                </div>
                <a className="primary" href="#profile">
                  Создать анкету преподавателя
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
                      unread={unread}
                      tasks={
                        attention.filter((x) =>
                          teaching.some((b) => b.id === x.id),
                        ).length
                      }
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
                      text={
                        dashboard.tutor.verification === "verified"
                          ? preview
                            ? "Опубликовано в локальном режиме"
                            : "Личность подтверждена"
                          : dashboard.tutor.verification === "rejected"
                            ? "Требуется повторная проверка"
                            : "Ожидает проверки личности"
                      }
                      tone={
                        dashboard.tutor.verification === "verified"
                          ? "success"
                          : "warning"
                      }
                    />
                    <p className="mt-4">
                      {dashboard.tutor.verification === "verified"
                        ? "Анкета опубликована. Отвечайте на заявки или соберите мини-группу."
                        : "Анкета скрыта из каталога. Оператор должен отдельно подтвердить личность; не отправляйте удостоверение в публичную анкету или чат."}
                    </p>
                    <button
                      className={styles.textAction}
                      onClick={() => {
                        if (dashboard.tutor)
                          openModal({ kind: "edit", tutor: dashboard.tutor });
                      }}
                    >
                      Редактировать анкету
                    </button>
                    {dashboard.tutor.verification === "verified" && (
                      <button
                        className={styles.textAction}
                        onClick={() => openProfile(dashboard.tutor!.id)}
                      >
                        Посмотреть публичную анкету
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
                    <h1>Ученики</h1>
                    <p>
                      Откройте занятие, чтобы написать ученику, провести встречу
                      или проверить работу.
                    </p>
                  </div>
                  {attention.filter((item) =>
                    teaching.some((b) => b.id === item.id),
                  ).length > 0 && (
                    <section className={styles.attention}>
                      <h3>Ждут вашего ответа</h3>
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
                                {item.label} · {item.peer}
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
                              {lessonDate(next.starts_at)} ·{" "}
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
                              Чат
                            </button>
                            <button
                              className="secondary"
                              onClick={() => openBooking(next.id)}
                            >
                              Занятие
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!teachingStudents.length && (
                      <Empty title="Пока нет учеников">
                        Записи появятся здесь, когда ученик забронирует время.
                      </Empty>
                    )}
                  </div>
                  {teaching.length > 0 && (
                    <details className={styles.lessonTools}>
                      <summary>
                        Все занятия с учениками · {teaching.length}
                      </summary>
                      {teaching.map(bookingRow)}
                    </details>
                  )}
                  {telegramAvailable && (
                    <button
                      className={styles.textAction}
                      onClick={() => void connectTelegram()}
                    >
                      Подключить Telegram
                    </button>
                  )}
                  {telegramUrl && (
                    <a
                      className="secondary"
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть Telegram и нажать Start
                    </a>
                  )}
                </>
              )}
            {currentPanel === "schedule" &&
              dashboard.tutor?.verification === "verified" && (
                <section>
                  <div className={desk.top}>
                    <h1>Расписание</h1>
                    <div className={desk.buttons}>
                      <button
                        className="primary"
                        onClick={() =>
                          openModal({ kind: "group", individual: true })
                        }
                      >
                        Добавить индивидуальный урок
                      </button>
                      <button
                        className="secondary"
                        onClick={() => openModal({ kind: "group" })}
                      >
                        Создать мини-группу
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
                  <h3>Опубликованное расписание</h3>
                  {catalog.groups.filter((g) => g.tutor_id === userId)
                    .length === 0 && (
                    <p>
                      Добавьте дату и цену, чтобы ученики могли записаться
                      сразу.
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
                            {lessonDate(g.starts_at)} ·{" "}
                            {g.price === 0 ? "Бесплатно" : money(g.price)} ·{" "}
                            {g.capacity === 1 ? "Индивидуально" : "Группа"} ·
                            Записались: {g.reserved}/{g.capacity}
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
                          <summary>Материалы занятия</summary>
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
                                  Открыть индивидуальное занятие
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
                          <Pill text="Набор закрыт" />
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
                            Закрыть набор
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
                <Card title="Тестовые выплаты">
                  <strong>Тестовый остаток · {money(balance)}</strong>
                  <p>
                    Демооперации используют условные тенге. В бесплатном пилоте
                    комиссия платформы — 0%.
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
                    Тестовый вывод
                  </button>
                </Card>
              )}
          </section>
        ))}

      {!embedded && !teacherMode && tab === "tutors" && subpage !== "profile" && (
        <section className="landingFaq" aria-labelledby="fb-faq-title">
          <p className={styles.eyebrow}>Без лишних вопросов</p>
          <h2 id="fb-faq-title">Сначала понятно. Потом — первый урок.</h2>
          <details><summary>С чего начать, если не знаю, кого выбрать?</summary><p>Выберите предмет и бюджет. В анкете преподавателя посмотрите подход и опыт. Можно написать ему до записи и коротко рассказать о своей цели.</p></details>
          <details><summary>За что нужно платить?</summary><p>В пилоте Jup edu бесплатен. Стоимость занятия указана в анкете. Онлайн-оплата не подключена: способ оплаты обсудите с преподавателем.</p></details>
          <details><summary>Где будут занятия и домашняя работа?</summary><p>После записи откройте «Мои занятия»: там расписание, чат, материалы и домашняя работа. Формат и место урока согласуйте с преподавателем.</p></details>
        </section>
      )}
      <SiteFooter />
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
                    ? `Заявка: ${modal.tutor.display_name}`
                    : "Какое занятие вы ищете?"
                  : modal.kind === "edit"
                    ? "Редактирование анкеты"
                    : modal.kind === "apply"
                      ? "Анкета преподавателя"
                      : modal.kind === "offer"
                        ? "Предложить занятие"
                        : modal.kind === "group"
                          ? modal.individual
                            ? "Новый индивидуальный урок"
                            : "Новая мини-группа"
                          : modal.group.capacity === 1
                            ? "Запись на индивидуальный урок"
                            : "Место в мини-группе"}
              </h2>
              <button
                type="button"
                className={styles.textAction}
                disabled={busy}
                onClick={() => setModal(null)}
                aria-label="Закрыть окно"
              >
                <Icon name="close" />
              </button>
            </div>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            {modal.kind === "join" && <BookingSummary
              lesson={selectedLesson ?? modal.group}
              slots={profileSlots}
              tutor={shown.tutors.find((tutor) => tutor.id === modal.group.tutor_id)}
              tutorName={tutorName(modal.group.tutor_id)}
              local={preview}
              busy={busy}
              blocked={bookingBlocked || null}
              choose={(group) => { setError(""); setModal({ kind: "join", group }); }}
              booked={existingBooking ? () => { setModal(null); setError(""); openBooking(existingBooking.id); } : undefined}
            />}
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
                title="Для записи нужен аккаунт ученика"
                subtitle="Тип аккаунта определяется при регистрации. Ваш преподавательский или рабочий кабинет остаётся отдельным."
              >
                <Link
                  className="primary"
                  href="/login?role=student&mode=signup"
                >
                  Регистрация ученика
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
                          {modal.tutor.subject} · {modal.tutor.exam} ·{" "}
                          {modal.tutor.city}
                        </p>
                      ) : (
                        <>
                          <Field label="Предмет">
                            <select
                              name="subject"
                              defaultValue={filters.subject || "География"}
                            >
                              {FB_SUBJECTS.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Экзамен">
                            <select
                              name="exam"
                              defaultValue={filters.exam || "ЕНТ"}
                            >
                              {FB_EXAMS.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Язык">
                            <select
                              name="language"
                              defaultValue={filters.language || "Русский"}
                            >
                              {FB_LANGUAGES.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Формат / город">
                            <select
                              name="city"
                              defaultValue={filters.city || "Онлайн"}
                            >
                              {FB_CITIES.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                    {modal.tutor && (
                      <Field label="Язык занятия">
                        <select
                          name="language"
                          defaultValue={modal.tutor.language}
                        >
                          {(
                            modal.offering?.languages ?? [modal.tutor.language]
                          ).map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Бюджет за 60 минут, ₸">
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
                    <Field label="Цель и удобное время">
                      <textarea
                        name="goal"
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={4}
                        placeholder="Готовлюсь к ЕНТ. Нужно разобрать карты и климат. Удобно в будни вечером."
                      />
                    </Field>
                  </>
                )}
                {modal.kind === "offer" && (
                  <>
                    <p>{modal.request.goal}</p>
                    <Field label="Направление">
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
                    <Field label="Цена за 60 минут, ₸">
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
                    <Field label="Дата и время · Казахстан, UTC+5">
                      <input type="datetime-local" name="starts_at" required />
                    </Field>
                    <Field label="Как вы поможете">
                      <textarea
                        name="note"
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={3}
                      />
                    </Field>
                    <p className={styles.meta}>
                      В пилоте комиссия Jup edu — 0%. Ученик увидит вашу цену
                      и сможет принять предложение.
                    </p>
                  </>
                )}
                {modal.kind === "group" && (
                  <>
                    <Field label="Направление">
                      <select
                        name="offering_id"
                        required
                        value={
                          publicationOffering ||
                          dashboard.offerings?.[0]?.id ||
                          ""
                        }
                        onChange={(e) => setPublicationOffering(e.target.value)}
                      >
                        {dashboard.offerings
                          ?.filter((o) => o.active)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title} · {o.languages.join(", ")}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <p>
                      Предмет, экзамен и формат берутся из выбранного
                      направления. Продолжительность занятия — 60 минут. Укажите
                      начало минимум через 30 минут.
                    </p>
                    <Field label="Язык занятия">
                      <select name="language" key={publicationOffering}>
                        {(
                          dashboard.offerings?.find(
                            (o) =>
                              o.id ===
                              (publicationOffering ||
                                dashboard.offerings?.[0]?.id),
                          )?.languages ?? []
                        ).map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Название / тема">
                      <input
                        name="title"
                        required
                        minLength={5}
                        maxLength={120}
                        placeholder="География · климат и природные зоны"
                      />
                    </Field>
                    <Field label="План занятия и кому подойдёт">
                      <textarea
                        name="description"
                        required
                        minLength={20}
                        maxLength={1500}
                        rows={3}
                      />
                    </Field>
                    <Field label="Дата и время · Казахстан, UTC+5">
                      <input name="starts_at" type="datetime-local" required />
                    </Field>
                    <Field label="Повторение">
                      <select name="weeks" defaultValue="1">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n === 1
                              ? "Одно занятие"
                              : "Каждую неделю · занятий: " + n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className={styles.formGrid}>
                      <Field label="Цена за участника, ₸">
                        <input
                          key={publicationOffering}
                          name="price"
                          type="number"
                          required
                          min={0}
                          max={100000}
                          step={1}
                          defaultValue={
                            dashboard.offerings?.find(
                              (o) =>
                                o.id ===
                                (publicationOffering ||
                                  dashboard.offerings?.find((d) => d.active)
                                    ?.id),
                            )?.price ??
                            dashboard.tutor?.price ??
                            1500
                          }
                        />
                      </Field>
                      {modal.individual ? (
                        <input type="hidden" name="capacity" value="1" />
                      ) : (
                        <Field label="Размер группы, 2–12">
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
                    <p className={styles.meta}>
                      Запись резервирует место сразу, даже до подключения
                      оплаты. Отмена учеником освобождает место.
                    </p>
                  </>
                )}
                <PrimaryButton
                  disabled={busy || loading || !!loadError || !!bookingBlocked}
                >
                  {busy
                    ? "Сохраняем…"
                    : modal.kind === "request"
                      ? "Отправить заявку"
                      : modal.kind === "offer"
                        ? "Отправить предложение"
                        : modal.kind === "group"
                          ? modal.individual
                            ? "Опубликовать урок"
                            : "Опубликовать группу"
                          : bookingBlocked || "Подтвердить запись"}
                </PrimaryButton>
              </form>
            )}
          </>
        )}
      </dialog>
    </Root>
  );
}
