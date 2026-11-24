"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { api } from "../lib/api";
import { roleHome, type Account } from "../lib/platform";
import { usePlatformAction } from "./usePlatformAction";
import st from "./platform.module.css";
export function Invite() {
  const { t: tr } = useJupLocale();

  const [account, setAccount] = useState<Account | null>(null);
  const search = useSyncExternalStore(
    watchSearch,
    () => window.location.search,
    () => "",
  );
  const token = new URLSearchParams(search).get("token") ?? "";
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    const r = await api<{ account: Account | null }>("viewer");
    setAccount(r.account);
  };
  const { run, busy, status } = usePlatformAction(refresh);
  useEffect(() => {
    void api<{ account: Account | null }>("viewer")
      .then((v) => setAccount(v.account))
      .catch(() => setError("Не удалось проверить аккаунт. Обновите страницу."))
      .finally(() => setLoading(false));
  }, []);
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
          <p className={st.eyebrow}>{tr("Личное приглашение")}</p>
          <h1>
            {tr(accepted ? tr("Вы в команде") : tr("Присоединиться к команде"))}
          </h1>
          <p>
            {tr(
              "Ссылка действует 7 дней и только для указанной отправителем почты. Приглашение в учебный центр принимается аккаунтом преподавателя с сохранённой анкетой. Для модерации используется отдельный новый аккаунт.",
            )}
          </p>
          {loading ? (
            <LoadingState label={tr("Проверяем приглашение…")} />
          ) : !token ? (
            <p className={st.error}>
              {tr(
                "В ссылке нет приглашения. Попросите отправителя создать новую.",
              )}
            </p>
          ) : !account ? (
            <div className={st.actions}>
              <Link
                className="primary"
                href={"/login?invite=" + encodeURIComponent(token)}
              >
                {tr("Войти по указанной почте")}
              </Link>
              <Link
                className={st.textButton}
                href={
                  "/login?role=teacher&mode=signup&invite=" +
                  encodeURIComponent(token)
                }
              >
                {tr("Регистрация преподавателя")}
              </Link>
              <Link
                className={st.textButton}
                href={"/login?mode=signup&invite=" + encodeURIComponent(token)}
              >
                {tr("Регистрация модератора")}
              </Link>
            </div>
          ) : accepted ? (
            <a className="primary" href={roleHome(account.role)}>
              {tr("Открыть кабинет")}
            </a>
          ) : (
            <div className={st.actions}>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await run(
                      "accept_invite",
                      { token },
                      "Приглашение принято.",
                    )
                  )
                    setAccepted(true);
                }}
              >
                {tr("Принять приглашение")}
              </button>
              <a className={st.textButton} href={roleHome(account.role)}>
                {tr("Сначала открыть свой кабинет")}
              </a>
            </div>
          )}
          {error && <p className={st.error}>{tr(error)}</p>}
          {status}
        </div>
      </section>
    </main>
  );
}

function watchSearch(update: () => void) {
  window.addEventListener("popstate", update);
  return () => window.removeEventListener("popstate", update);
}
