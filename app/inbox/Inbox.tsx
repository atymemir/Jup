"use client";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { lessonDate, type Booking, type Tutor } from "../lib/findbuddy";
import { TutorPhoto } from "../profiles/TutorProfile";
import { tutorPortrait } from "../profiles/TutorCard";
import { Icon } from "../ui/Icon";
import { inboxApi, type Thread } from "./useInbox";
import st from "./inbox.module.css";
import { lessonClock } from "../lib/lessonSlots";
import { messageDraftKey, readMessageDraft, writeMessageDraft, type MessageDraft } from "../lib/messageDraft";

const messageDates = new Intl.DateTimeFormat("ru-KZ", { timeZone: "Asia/Almaty", day: "numeric", month: "long", year: "numeric" });
const compactQuery = "(max-width: 735px)";
function watchCompact(update: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}

type Message = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};
type Timeline = {
  messages: Message[];
  more: boolean;
  blocked: boolean;
  blocked_by_me: boolean;
};
type LessonContact = { booking: Booking; label: string; unread: number };

function ThreadPanel({
  thread,
  tutor,
  user,
  name,
  local,
  teacherView,
  openThread,
  profile,
  book,
  lesson,
  refresh,
  back,
}: {
  thread?: Thread;
  tutor?: Tutor;
  user: string;
  name: string;
  local: boolean;
  teacherView: boolean;
  openThread: (id: string) => void;
  profile?: () => void;
  book?: () => void;
  lesson?: () => void;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const id = thread?.id;
  const [page, setPage] = useState<Timeline | null>(null);
  const [older, setOlder] = useState<Message[]>([]);
  const [olderMore, setOlderMore] = useState(true);
  const [paging, setPaging] = useState(false);
  const draftKey = messageDraftKey(user, id, tutor?.id);
  const [draft, setDraft] = useState<MessageDraft>(() => readMessageDraft(draftKey) ?? { body: "", clientId: "" });
  const currentDraft = useRef(draft);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(false);
  const activePanel = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const timeline = useRef<HTMLDivElement>(null);
  const bottom = useRef(true);
  const seen = useRef(0);
  const isSending = useRef(false);
  useEffect(() => {
    activePanel.current = true;
    return () => { activePanel.current = false; };
  }, []);
  function changeDraft(body: string) {
    const previous = currentDraft.current;
    const next = { body, clientId: body.trim() === previous.body.trim() ? previous.clientId : crypto.randomUUID() };
    currentDraft.current = next;
    setDraft(next);
    setStorageBlocked(!writeMessageDraft(draftKey, next));
  }
  function prompt(text: string) {
    const body = currentDraft.current.body;
    const next = body.trim() ? body + "\n" + text : text;
    if (next.length > 2000) { setError("В сообщении может быть до 2000 символов."); return; }
    changeDraft(next);
    composer.current?.focus();
  }

  useEffect(() => {
    if (!id) return;
    let active = true,
      timer: number;
    async function poll() {
      if (!document.hidden)
        try {
          const data = await inboxApi<Timeline>("read", { id });
          if (!active) return;
          setPage(data);
          setError((old) =>
            old === "Переписка пока не загрузилась." ? "" : old,
          );
          const last = data.messages.at(-1);
          if (last && last.id > seen.current && !bottom.current) setUnreadBelow(true);
          if (last && last.id > seen.current && bottom.current) {
            await inboxApi("seen", { id, message_id: last.id });
            if (active) {
              seen.current = last.id;
              setUnreadBelow(false);
              void refresh();
            }
          }
        } catch {
          if (active)
            setError((old) => old || "Переписка пока не загрузилась.");
        }
      if (active) timer = window.setTimeout(poll, 3300);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, retry, refresh]);
  const messageList = [
    ...new Map(
      [...older, ...(page?.messages ?? [])].map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.id - b.id);
  const end = messageList.at(-1)?.id;
  useEffect(() => {
    if (end && bottom.current && timeline.current)
      timeline.current.scrollTop = timeline.current.scrollHeight;
  }, [end]);
  async function loadOlder() {
    if (!id || !messageList.length || paging) return;
    setPaging(true);
    const el = timeline.current,
      offset = el?.scrollHeight ?? 0;
    try {
      const data = await inboxApi<Timeline>("read", {
        id,
        before: messageList[0].id,
      });
      bottom.current = false;
      setOlder((m) => [...data.messages, ...m]);
      setOlderMore(data.more);
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - offset;
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось открыть предыдущие сообщения.",
      );
    } finally {
      setPaging(false);
    }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const snapshot = currentDraft.current;
    const text = snapshot.body.trim();
    if (!text || isSending.current || page?.blocked || (id && !page)) return;
    isSending.current = true;
    setBusy(true);
    setError("");
    const clientId = snapshot.clientId || crypto.randomUUID();
    currentDraft.current = { ...snapshot, clientId };
    setStorageBlocked(!writeMessageDraft(draftKey, currentDraft.current));
    try {
      const result = await inboxApi<{ id: string }>("send", {
        id, tutor_id: tutor?.id, client_id: clientId, body: text,
      });
      if (!activePanel.current) return;
      if (!id) await refresh(); else void refresh();
      if (!activePanel.current) return;
      const remaining = currentDraft.current.body.trim() === text ? { body: "", clientId: "" } : currentDraft.current;
      writeMessageDraft(draftKey, { body: "", clientId: "" });
      setStorageBlocked(!writeMessageDraft(messageDraftKey(user, result.id), remaining));
      currentDraft.current = remaining;
      setDraft(remaining);
      bottom.current = true;
      if (id) setRetry((n) => n + 1);
      else openThread(result.id);
    } catch (e) {
      if (activePanel.current) setError(
        e instanceof Error
          ? e.message.includes("Проверьте результат в кабинете")
            ? "Нет подтверждения отправки. Текст остался в поле — повторите отправку, когда появится соединение."
            : e.message
          : "Сообщение не отправлено. Текст сохранён в поле.",
      );
    } finally {
      isSending.current = false;
      if (activePanel.current) setBusy(false);
    }
  }
  return (
    <div className={st.dialogue}>
      <header className={st.threadHead}>
        <button
          className={st.back}
          type="button"
          onClick={back}
          aria-label="К списку диалогов"
        >
          ‹
        </button>
        <TutorPhoto
          tutor={tutor}
          source={tutor ? tutorPortrait(tutor, local) : undefined}
        />
        <div className={st.person}>
          <h2>{name}</h2>
          <p>
            {tutor
              ? tutor.subject + " · " + tutor.exam
              : teacherView
                ? "Ученик"
                : "Личная переписка"}
          </p>
        </div>
        <div className={st.headActions}>
          {book && (
            <button className="primary" onClick={book}>
              Выбрать время
            </button>
          )}
          {lesson && (
            <button className="secondary" onClick={lesson}>
              К занятию
            </button>
          )}
          {profile && (
            <button className={st.quiet} onClick={profile}>
              Анкета
            </button>
          )}
          {thread && page && (
            <details className={st.menu}>
              <summary aria-label="Настройки диалога">•••</summary>
              <button
                onClick={async () => {
                  const value = !page.blocked_by_me;
                  if (
                    value &&
                    !confirm(
                      "Приостановить переписку? История сообщений сохранится.",
                    )
                  )
                    return;
                  try {
                    await inboxApi("block", { id, value });
                    setRetry((n) => n + 1);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Не удалось изменить настройки.",
                    );
                  }
                }}
              >
                {page.blocked_by_me
                  ? "Возобновить переписку"
                  : "Приостановить переписку"}
              </button>
            </details>
          )}
        </div>
      </header>
      <div
        className={st.timeline}
        ref={timeline}
        onScroll={(e) => {
          const el = e.currentTarget;
          bottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          if (bottom.current && unreadBelow) { setUnreadBelow(false); setRetry((n) => n + 1); }
        }}
        role="log"
        aria-label="Сообщения диалога"
      >
        {page?.more && olderMore && (
          <button className={st.quiet} onClick={loadOlder} disabled={paging}>
            Более ранние сообщения
          </button>
        )}
        {!thread && (
          <div className={st.blank}>
            <Icon name="requests" size={29} />
            <h3>Начните разговор</h3>
            <p>Напишите, к чему готовитесь, или задайте вопрос о занятиях.</p>
            <div className={st.prompts}>
              {[
                "Как проходит первый урок?",
                "Можно подобрать время на этой неделе?",
                "Вы работаете с начинающими?",
              ].map((text) => (
                <button type="button" key={text} onClick={() => prompt(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {thread && !page && !error && (
          <p className={st.loading} role="status">
            Загружаем переписку…
          </p>
        )}
        {messageList.map((m, index) => {
          const day = messageDates.format(new Date(m.created_at));
          const previous = messageList[index - 1];
          return <Fragment key={m.id}>
            {(!previous || messageDates.format(new Date(previous.created_at)) !== day) && <div className={st.dayDivider}><span>{day}</span></div>}
            <div className={st.bubble} data-mine={m.sender_id === user}><p>{m.body}</p><time dateTime={m.created_at} aria-label={lessonDate(m.created_at)}>{lessonClock(m.created_at)}</time></div>
          </Fragment>;
        })}
      </div>
      {unreadBelow && <button type="button" className={st.newMessages} onClick={() => { bottom.current = true; if (timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight; setUnreadBelow(false); setRetry((n) => n + 1); }}>К новым сообщениям</button>}
      {error && (
        <div className={st.error} role="alert">
          {error}{" "}
          {id && !page && (
            <button onClick={() => setRetry((n) => n + 1)}>Повторить</button>
          )}
        </div>
      )}
      {page?.blocked ? (
        <p className={st.blocked}>
          Переписка приостановлена. История доступна.
        </p>
      ) : (
        <form className={st.composer} onSubmit={send} aria-busy={busy}>
          <div className={st.composerField}>
          <textarea
            ref={composer}
            aria-label="Сообщение"
            placeholder="Написать сообщение…"
            rows={2}
            maxLength={2000}
            value={draft.body}
            onChange={(e) => changeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 &&
                  (!window.matchMedia("(pointer: coarse)").matches || e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className={st.composerHint}><span>{storageBlocked ? "Черновик останется в поле до закрытия диалога" : draft.body ? "Черновик сохранён в этой вкладке" : "Личная переписка"}</span>{draft.body.length > 1600 && <span>{draft.body.length}/2000</span>}</div>
          </div>
          <button className="primary" aria-label={busy ? "Отправляем…" : "Отправить"} disabled={busy || !draft.body.trim() || (!!id && !page)}><Icon name="send" size={20} /><span>{busy ? "Отправляем…" : "Отправить"}</span></button>
        </form>
      )}
    </div>
  );
}

export function Inbox({
  threads,
  pending,
  error,
  selected,
  newTutor,
  user,
  catalog,
  local,
  teacherView,
  lessons,
  requests,
  refresh,
  openThread,
  openLesson,
  openProfile,
  bookTutor,
  canBook,
  back,
  browse,
  openRequests,
}: {
  threads: Thread[];
  pending: boolean;
  error: string;
  selected?: string;
  newTutor?: Tutor;
  user: string;
  catalog: Tutor[];
  local: boolean;
  teacherView: boolean;
  lessons: LessonContact[];
  requests: number;
  refresh: () => Promise<void>;
  openThread: (id: string) => void;
  openLesson: (id: string) => void;
  openProfile: (id: string) => void;
  bookTutor: (id: string) => void;
  canBook: (id: string) => boolean;
  back: () => void;
  browse: () => void;
  openRequests: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "lessons">("all");
  const selectedThread =
    threads.find((t) => t.id === selected) ??
    threads.find((t) => t.as_student && t.peer_id === newTutor?.id);
  const tutor =
    newTutor ??
    (selectedThread?.as_student
      ? catalog.find((t) => t.id === selectedThread.peer_id)
      : undefined);
  const recent =
    selectedThread && !selectedThread.as_student
      ? lessons.find((l) => l.booking.student_id === selectedThread.peer_id)
      : undefined;
  const open = !!(selected || newTutor);
  const compact = useSyncExternalStore(watchCompact, () => window.matchMedia(compactQuery).matches, () => false);
  const workspace = useRef<HTMLElement>(null);
  const visiblePeer = selectedThread?.peer_id ?? newTutor?.id;
  useEffect(() => {
    if (!compact || !open) return;
    const element = workspace.current;
    const viewport = window.visualViewport;
    const update = () => {
      element?.style.setProperty("--inbox-height", `${viewport?.height ?? window.innerHeight}px`);
      element?.style.setProperty("--inbox-top", `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    const previous = document.activeElement;
    const focus = element?.querySelector<HTMLButtonElement>('button[aria-label="К списку диалогов"]') ?? [...(element?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])].find((node) => node.getClientRects().length);
    focus?.focus({ preventScroll: true });
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      element?.style.removeProperty("--inbox-height");
      element?.style.removeProperty("--inbox-top");
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [compact, open, visiblePeer]);
  const matches = (value: string) =>
    value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const rows = threads.filter(
    (t) =>
      (filter !== "unread" || t.unread > 0) &&
      matches(t.peer_name + " " + t.last_body),
  );
  return (
    <section className={st.workspace} ref={workspace} data-thread-open={open}
      role={compact && open ? "dialog" : undefined} aria-modal={compact && open ? true : undefined} aria-label={compact && open ? "Личная переписка" : undefined}
      onKeyDown={(event) => {
        if (!compact || !open) return;
        if (event.key === "Escape") { event.preventDefault(); back(); return; }
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter((node) => node.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <div className={st.title}>
        <div>
          <h1>Сообщения</h1>
          <p>
            {teacherView
              ? "Вопросы учеников и переписка по урокам"
              : "Личные диалоги и чаты занятий"}
          </p>
        </div>
        {!teacherView && (
          <button className="secondary" onClick={openRequests}>
            Заявки{requests ? " · " + requests : ""}
          </button>
        )}
      </div>
      {error && (
        <div className={st.error} role="alert">
          {error}
          <button onClick={() => void refresh()}>Повторить</button>
        </div>
      )}
      <div className={st.shell} data-open={open}>
        <aside className={st.sidebar} aria-label="Список диалогов">
          <div className={st.sideTools}>
            <label className={st.search}>
              <Icon name="search" size={17} />
              <input
                type="search"
                aria-label="Поиск по диалогам"
                placeholder="Поиск по диалогам"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className={st.filters}>
              {(
                [
                  ["all", "Все"],
                  ["unread", "Новые"],
                  ["lessons", "По урокам"],
                ] as const
              ).map(([key, label]) => (
                <button
                  aria-pressed={filter === key}
                  key={key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={st.threadList}>
            {filter === "lessons" ? (
              <>
                {lessons
                  .filter((l) =>
                    matches(
                      l.label +
                        " " +
                        (l.booking.lesson_title ?? l.booking.subject),
                    ),
                  )
                  .map((l) => (
                    <button
                      className={st.thread}
                      key={l.booking.id}
                      onClick={() => openLesson(l.booking.id)}
                    >
                      <span className={st.lessonIcon}>
                        <Icon name="calendar" size={19} />
                      </span>
                      <span className={st.threadWords}>
                        <strong>{l.label}</strong>
                        <span>
                          {l.booking.lesson_title || l.booking.subject}
                        </span>
                      </span>
                      {l.unread > 0 && <b className={st.badge}>{l.unread}</b>}
                    </button>
                  ))}
                {lessons.length === 0 && (
                  <p className={st.emptyList}>
                    Чаты появятся после записи на урок.
                  </p>
                )}
              </>
            ) : (
              rows.map((t) => {
                const person = t.as_student
                  ? catalog.find((c) => c.id === t.peer_id)
                  : undefined;
                return (
                  <button
                    className={st.thread}
                    key={t.id}
                    aria-current={selectedThread?.id === t.id}
                    onClick={() => openThread(t.id)}
                  >
                    <TutorPhoto
                      tutor={person}
                      source={person ? tutorPortrait(person, local) : undefined}
                    />
                    <span className={st.threadWords}>
                      <strong>{t.peer_name}</strong>
                      <span>{t.last_body}</span>
                    </span>
                    {t.unread > 0 && (
                      <b
                        className={st.badge}
                        aria-label={"Непрочитанных " + t.unread}
                      >
                        {t.unread}
                      </b>
                    )}
                  </button>
                );
              })
            )}
            {filter !== "lessons" && !rows.length && (
              <p className={st.emptyList}>
                {pending
                  ? "Загружаем диалоги…"
                  : search
                    ? "Совпадений нет."
                    : filter === "unread"
                      ? "Новых сообщений нет."
                      : "Пока нет личных диалогов."}
              </p>
            )}
            {!teacherView &&
              !threads.length &&
              !pending &&
              !search &&
              filter === "all" && (
                <button className={st.emptyAction} onClick={browse}>
                  Найти преподавателя
                </button>
              )}
          </div>
        </aside>
        {selectedThread || newTutor ? (
          <ThreadPanel
            key={`${user}:${selectedThread?.as_student === false ? "teacher" : "student"}:${selectedThread?.peer_id ?? newTutor?.id}`}
            thread={selectedThread}
            tutor={tutor}
            user={user}
            name={selectedThread?.peer_name ?? newTutor?.display_name ?? ""}
            local={local}
            teacherView={teacherView}
            openThread={openThread}
            refresh={refresh}
            back={back}
            profile={tutor ? () => openProfile(tutor.id) : undefined}
            book={
              tutor && canBook(tutor.id) ? () => bookTutor(tutor.id) : undefined
            }
            lesson={recent ? () => openLesson(recent.booking.id) : undefined}
          />
        ) : (
          <div className={st.blankPane}>
            <div className={st.blank}>
              <Icon name="requests" size={32} />
              <h2>
                {selected && !pending
                  ? "Диалог недоступен"
                  : threads.length
                    ? "Откройте диалог"
                    : "Переписка начинается здесь"}
              </h2>
              <p>
                {threads.length
                  ? "Выберите собеседника из списка."
                  : teacherView
                    ? "Когда ученик напишет с вашей анкеты, диалог появится здесь."
                    : "Откройте анкету преподавателя и задайте вопрос до записи."}
              </p>
              {selected ? (
                <button className="secondary" onClick={back}>
                  К диалогам
                </button>
              ) : (
                !teacherView &&
                !threads.length && (
                  <button className="primary" onClick={browse}>
                    Найти преподавателя
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
