"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useState } from "react";
import { api } from "../lib/api";
import st from "./platform.module.css";
export function ReportProfile({
  kind,
  id,
}: {
  kind: "teacher" | "organization";
  id: string;
}) {
  const { t: tr } = useJupLocale();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details>
      <summary className={st.textButton}>
        {tr("Сообщить о проблеме с анкетой")}
      </summary>
      <form
        className={st.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("", "platform", {
              action: "report",
              kind,
              id,
              reason: new FormData(e.currentTarget).get("reason"),
            });
            setMessage("Обращение передано модераторам.");
          } catch (e) {
            setMessage(
              e instanceof Error
                ? e.message
                : "Не удалось отправить обращение.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tr("Что нужно проверить")}
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1500}
            rows={3}
            disabled={busy}
          />
        </label>
        <small>
          {tr(
            "Обращение видят только модераторы. Личная переписка не прикладывается автоматически.",
          )}
        </small>
        <button className="secondary" disabled={busy}>
          {tr("Отправить обращение")}
        </button>
        {message && <p role="status">{tr(message)}</p>}
      </form>
    </details>
  );
}
