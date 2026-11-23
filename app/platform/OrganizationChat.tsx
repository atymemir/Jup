"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { lessonDate } from "../lib/findbuddy";
import type { PlatformDashboard } from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
import st from "./platform.module.css";
type Message = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};
export function OrganizationChat({
  data,
  refresh,
  organizationId,
}: {
  data: PlatformDashboard;
  refresh: () => Promise<void>;
  organizationId?: string;
}) {
  const [selected, setSelected] = useState(
    data.org_threads.find((t) => t.organization_id === organizationId)?.id ??
      "",
  );
  const [page, setPage] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const { run, busy, status } = usePlatformAction(refresh);
  const signing = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (!document.hidden)
        try {
          const p = await api<{ messages: Message[] }>("", "platform", {
            action: "org_read",
            thread_id: selected,
          });
          if (!live) return;
          setPage(p.messages);
          setError("");
          await api("", "platform", {
            action: "org_seen",
            thread_id: selected,
          });
        } catch (e) {
          if (live)
            setError(
              e instanceof Error
                ? e.message
                : "Не удалось загрузить сообщения.",
            );
        }
      if (live) timer = setTimeout(load, 5000);
    }
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [selected]);
  return (
    <section className={st.stack}>
      <header>
        <h1>
          {data.account.role === "student"
            ? "Связаться с центром"
            : "Сообщения центра"}
        </h1>
        <p>
          Этот диалог видят только ученик и владелец центра. Личные чаты
          преподавателей отделены.
        </p>
      </header>
      {data.org_threads.length > 0 && (
        <div className={st.tabs}>
          {data.org_threads.map((t) => (
            <button
              key={t.id}
              aria-pressed={selected === t.id}
              onClick={() => setSelected(t.id)}
            >
              {t.name}
              {t.unread ? ` · ${t.unread}` : ""}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className={st.error} role="alert">
          {error}
        </p>
      )}
      {selected && (
        <div
          className={st.timeline}
          role="log"
          aria-label="Переписка с центром"
        >
          {page.map((m) => (
            <div
              className={st.message}
              data-mine={m.sender_id === data.account.id}
              key={m.id}
            >
              <small>
                {m.sender_id === data.account.id ? "Вы" : "Собеседник"} ·{" "}
                {lessonDate(m.created_at)}
              </small>
              <p>{m.body}</p>
            </div>
          ))}
        </div>
      )}
      {selected || organizationId ? (
        <form
          className={st.form}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const body = String(new FormData(form).get("body")).trim();
            if (signing.current?.body !== body)
              signing.current = { body, id: crypto.randomUUID() };
            const result = await run<{ id: string }>(
              "org_send",
              {
                thread_id: selected || null,
                organization_id: organizationId,
                body,
                client_id: signing.current.id,
              },
              "Сообщение отправлено.",
            );
            if (result) {
              signing.current = null;
              form.reset();
              setSelected(result.id);
              try {
                const latest = await api<{ messages: Message[] }>(
                  "",
                  "platform",
                  { action: "org_read", thread_id: result.id },
                );
                setPage(latest.messages);
                setError("");
              } catch {
                setError(
                  "Сообщение отправлено. Переписка обновится после восстановления связи.",
                );
              }
            }
          }}
        >
          <label>
            Сообщение
            <textarea
              required
              name="body"
              maxLength={2000}
              rows={3}
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy}>
            Отправить
          </button>
          {status}
        </form>
      ) : (
        <div className={st.empty}>
          Выберите диалог. Новые обращения появятся после сообщения ученика на
          странице центра.
        </div>
      )}
    </section>
  );
}
