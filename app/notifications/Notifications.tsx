"use client";
import { dateFormatter } from "../lib/localeFormat.mjs";

import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import Link from "next/link";
import { roleHome, type Account } from "../lib/platform";
import { notificationContent } from "../lib/notifications";
import { Icon } from "../ui/Icon";
import { LoadingState } from "../ui/LoadingState";
import type { NotificationState } from "./useNotifications";
import st from "./notifications.module.css";
const date = (language: "ru" | "kk" | "en") =>
  dateFormatter(language, {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function Notifications({
  state,
  role,
}: {
  state: NotificationState;
  role: Account["role"];
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const { data, loading, error, marking, read, filter, setFilter } = state;
  const unread = data?.items.filter((item) => !item.read_at) ?? [];
  return (
    <section className={st.page}>
      <header className={st.heading}>
        <div>
          <p className={st.eyebrow}>{tr("Всё важное — здесь")}</p>
          <h1>
            {tr("Ваши уведомления")}
            <span
              aria-live="polite"
              aria-label={tr(tr("Непрочитанных: {0}", [data?.unread ?? 0]))}
            >
              {data?.unread ?? 0}
            </span>
          </h1>
          <p>
            {tr(
              "Заявки, сообщения и изменения занятий. Откройте событие, чтобы увидеть детали и следующий шаг.",
            )}
          </p>
        </div>
        <span className={st.bell}>
          <Icon name="bell" size={32} />
        </span>
      </header>
      <div className={st.toolbar}>
        <div role="group" aria-label={tr("Показать уведомления")}>
          <button
            aria-pressed={!filter}
            disabled={marking}
            onClick={() => setFilter(false)}
          >
            {tr("Все события")}
          </button>
          <button
            aria-pressed={filter}
            disabled={marking}
            onClick={() => setFilter(true)}
          >
            {tr("Непрочитанные")}
          </button>
        </div>
        <button onClick={() => void state.refresh()} disabled={marking}>
          {tr("Обновить")}
        </button>
        <button
          className={st.readAll}
          disabled={marking || !unread.length}
          onClick={() => void read(unread.slice(0, 100).map((item) => item.id))}
        >
          {tr(
            unread.length > 100
              ? tr("Прочитать первые 100")
              : tr("Прочитать показанные"),
          )}
        </button>
      </div>
      {error && (
        <div className="platformError" role="alert">
          <p>{tr(error)}</p>
          <button onClick={() => void state.refresh()}>
            {tr("Повторить загрузку")}
          </button>
        </div>
      )}
      {loading && !data ? (
        <LoadingState label={tr("Собираем ваши уведомления…")} />
      ) : !data?.items.length && !error ? (
        <div className={st.empty}>
          <Icon name="check" size={34} />
          <h2>
            {tr(
              filter
                ? tr("Всё прочитано")
                : tr("Здесь появятся важные события"),
            )}
          </h2>
          <p>
            {tr(
              filter
                ? tr(
                    "Вы ничего не пропустили. Новые события появятся здесь автоматически.",
                  )
                : tr(
                    "Когда вам напишут, предложат урок или изменят занятие, вы увидите уведомление и сможете сразу перейти к действию.",
                  ),
            )}
          </p>
          <Link
            className="secondary"
            href={role === "teacher" ? "/teacher#schedule" : "/"}
          >
            {tr(
              role === "teacher"
                ? tr("Настроить расписание")
                : tr("Найти преподавателя"),
            )}
          </Link>
        </div>
      ) : (
        <ol className={st.list} aria-label={tr("События")} aria-busy={marking}>
          {data?.items.map((item) => {
            const view = notificationContent(item, role, roleHome(role));
            return (
              <li
                key={item.id}
                className={!item.read_at ? st.unread : undefined}
              >
                <span className={st.eventIcon}>
                  <Icon name={view.icon} size={23} />
                </span>
                <div className={st.eventBody}>
                  {item.context && <p className={st.context}>{item.context}</p>}
                  <div className={st.eventTop}>
                    <h2>{tr(view.title)}</h2>
                    <time dateTime={item.created_at}>
                      {tr(date(uiLocale).format(new Date(item.created_at)))} ·
                      KZ
                    </time>
                  </div>
                  <p>{tr(view.description)}</p>
                  <div className={st.actions}>
                    <Link
                      href={view.href}
                      onClick={() => {
                        if (!item.read_at) void read([item.id]);
                      }}
                    >
                      {tr(view.action)} <Icon name="arrow" size={14} />
                    </Link>
                    {!item.read_at && (
                      <button
                        disabled={marking}
                        onClick={() => void read([item.id])}
                      >
                        {tr("Отметить прочитанным")}
                      </button>
                    )}
                  </div>
                </div>
                {!item.read_at && (
                  <span className={st.dot} aria-label={tr("Не прочитано")} />
                )}
              </li>
            );
          })}
        </ol>
      )}
      {state.more && (
        <button
          className="secondary"
          disabled={marking}
          onClick={() => void state.loadMore()}
        >
          {tr(marking ? tr("Загружаем…") : tr("Предыдущие события"))}
        </button>
      )}
      <p className={st.footnote}>
        {tr(
          "Время Казахстана · UTC+5. Уведомление о близком уроке появляется при открытии приложения. Прочтение уведомления не отмечает сообщения в чате прочитанными.",
        )}
      </p>
    </section>
  );
}
