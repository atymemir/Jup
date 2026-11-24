"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useRef, useState } from "react";
import { LoadingState } from "../ui/LoadingState";
import { api } from "../lib/api";
export function usePlatformAction(refresh: () => Promise<void>) {
  const { t: tr } = useJupLocale();

  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run<T = Record<string, unknown>>(
    action: string,
    data: Record<string, unknown>,
    message = "Сохранено.",
  ): Promise<T | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<T>("", "platform", { ...data, action });
      await refresh();
      setNotice(message);
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить. Попробуйте ещё раз.",
      );
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    notice,
    status: (
      <div className="platformFeedback">
        {busy && <LoadingState compact label={tr("Сохраняем изменения…")} />}
        {error && (
          <p className="platformError" role="alert">
            {tr(error)}
          </p>
        )}
        {notice && (
          <p className="platformNotice" role="status">
            {tr(notice)}
          </p>
        )}
      </div>
    ),
  };
}
