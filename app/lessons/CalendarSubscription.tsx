"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import st from "./lessons.module.css";
export function CalendarSubscription({
  enabled,
  refresh,
}: {
  enabled: boolean;
  refresh: () => Promise<void>;
}) {
  const { t: tr } = useJupLocale();

  const [url, setUrl] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function change(enable: boolean) {
    if (lock.current) return;
    if (
      enabled &&
      !window.confirm(
        enable
          ? "Заменить личную ссылку? Для старых подписок понадобится новый адрес."
          : "Отключить подписку? Календари больше не смогут обновлять расписание по этой ссылке.",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await api<{ key?: string }>(
        "",
        enable ? "calendar_enable" : "calendar_disable",
        {},
      );
      setUrl(
        result.key
          ? location.origin + "/findbuddy/api/calendar/" + result.key + ".ics"
          : "",
      );
      await refresh();
      setNotice(
        enable
          ? "Добавьте ссылку в календаре как подписку по URL."
          : "Подписка отключена.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Не удалось изменить подписку.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className={st.tools}>
      <summary>{tr("Подписка на расписание")}</summary>
      <p>
        {tr(
          "Apple Calendar, Google Календарь и Outlook могут обновлять даты по личной ссылке. Обладатель ссылки увидит темы и время занятий.",
        )}
      </p>
      <div className={st.actions}>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => change(true)}
        >
          {tr(enabled ? tr("Заменить ссылку") : tr("Создать личную ссылку"))}
        </button>
        {enabled && (
          <button disabled={busy} onClick={() => change(false)}>
            {tr("Отключить подписку")}
          </button>
        )}
      </div>
      {url && enabled && (
        <div className={st.form}>
          <label className={st.field}>
            {tr("Адрес подписки")}
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className={st.actions}>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setNotice("Ссылка скопирована.");
                } catch {
                  setNotice("Выделите адрес и скопируйте его вручную.");
                }
              }}
            >
              {tr("Скопировать")}
            </button>
            <a className="secondary" href={url.replace(/^https?:/, "webcal:")}>
              {tr("Открыть в календаре")}
            </a>
          </div>
        </div>
      )}
      {notice && <p role="status">{tr(notice)}</p>}
    </details>
  );
}
