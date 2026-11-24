"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, LanguageSwitcher } from "../i18n/LocaleProvider";
import { useTelegram } from "./TelegramProvider";
import { api } from "../lib/api";
import { getSupabase } from "../lib/supabase";
import { fetchJson } from "../lib/http";
import { miniAppDestination, miniAppScreen } from "../lib/telegramMiniApp.mjs";
import { type Account, roleLabels } from "../lib/platform";
import { Brand } from "../ui/Brand";
import { Icon } from "../ui/Icon";
import { LoadingState } from "../ui/LoadingState";
import st from "./telegram.module.css";
type Config = { available: boolean; botUsername: string };
type Bootstrap = {
  account: Account | null;
  config: Config;
  linked?: boolean;
  session?: { access_token: string; refresh_token: string };
  warning?: string;
};
async function requestSession(
  initData: string,
  action: string,
  token?: string,
) {
  return fetchJson<{
    linked: boolean;
    session?: { access_token: string; refresh_token: string };
    warning?: string;
  }>("/findbuddy/api/telegram/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ initData, action }),
  });
}
export default function MiniAppEntry() {
  const { t } = useLocale();
  const { app, status } = useTelegram();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [config, setConfig] = useState<Config>({
    available: false,
    botUsername: "jup_edu_app",
  });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const flight = useRef<Promise<Bootstrap> | null>(null);
  const lock = useRef(false);
  function screen() {
    return miniAppScreen(
      new URLSearchParams(location.search).get("screen") ||
        new URLSearchParams(app?.initData ?? "").get("start_param"),
    );
  }
  function destination(role: string) {
    return miniAppDestination(role, screen());
  }
  function loginHref(signup = false) {
    return (
      "/login?" +
      new URLSearchParams({
        returnTo: "telegram",
        screen: screen(),
        ...(signup ? { mode: "signup" } : {}),
      })
    );
  }
  useEffect(() => {
    if (status === "loading") return;
    let active = true;
    if (!flight.current)
      flight.current = (async () => {
        const config = await fetchJson<Config>(
          "/findbuddy/api/telegram/session",
        );
        const viewer = await api<{ account: Account | null }>("viewer");
        if (viewer.account) {
          let linked = false;
          let warning = "";
          if (app && config.available && process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const token = (await getSupabase().auth.getSession()).data.session
              ?.access_token;
            if (token) {
              try {
                linked = (await requestSession(app.initData, "status", token))
                  .linked;
              } catch (error) {
                warning =
                  error instanceof Error
                    ? error.message
                    : "Не удалось подключить Telegram.";
              }
            }
          }
          return { account: viewer.account, config, linked, warning };
        }
        if (app && config.available)
          return {
            ...(await requestSession(app.initData, "login")),
            account: null,
            config,
          };
        return { account: null, config };
      })();
    void flight.current
      .then(async (result) => {
        if (!active) return;
        setConfig(result.config);
        if (result.warning) setError(result.warning);
        if (result.session) {
          const saved = await getSupabase().auth.setSession(result.session);
          if (saved.error)
            throw new Error("Не удалось сохранить вход. Попробуйте ещё раз.");
          if (!active) return;
          const viewer = await api<{ account: Account | null }>("viewer");
          if (!viewer.account) throw new Error("Войдите в аккаунт Jup.");
          router.replace(
            miniAppDestination(
              viewer.account.role,
              miniAppScreen(
                new URLSearchParams(location.search).get("screen") ||
                  new URLSearchParams(app?.initData ?? "").get("start_param"),
              ),
            ),
          );
          return;
        }
        setAccount(result.account);
        if (result.account && result.linked)
          router.replace(
            miniAppDestination(
              result.account.role,
              miniAppScreen(
                new URLSearchParams(location.search).get("screen") ||
                  new URLSearchParams(app?.initData ?? "").get("start_param"),
              ),
            ),
          );
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Не удалось открыть приложение.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app, status, attempt, router]);
  async function link() {
    if (!app || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const token = (await getSupabase().auth.getSession()).data.session
        ?.access_token;
      if (!token) throw new Error("Войдите в аккаунт, чтобы продолжить.");
      await requestSession(app.initData, "link", token);
      router.replace(destination(account!.role));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось подключить Telegram.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const botName = /^[a-zA-Z0-9_]{5,32}$/.test(config.botUsername)
    ? config.botUsername
    : "jup_edu_app";
  return (
    <main className={st.page}>
      <header className={st.header}>
        <Link href="/" aria-label="Jup edu">
          <Brand />
        </Link>
        <LanguageSwitcher />
      </header>
      <section className={st.card}>
        <div className={st.mark}>
          <Icon name="send" size={30} />
        </div>
        <p className={st.eyebrow}>{t("Jup в Telegram")}</p>
        <h1>{t("Занятия всегда рядом.")}</h1>
        <p className={st.intro}>
          {t("Расписание, ученики и переписка — в одном приложении.")}
        </p>
        <div className={st.features}>
          {[
            ["calendar", "Расписание"],
            ["requests", "Сообщения"],
            ["teacher", "Мои занятия"],
          ].map(([icon, label]) => (
            <span key={label}>
              <Icon
                name={icon as "calendar" | "requests" | "teacher"}
                size={17}
              />
              {t(label)}
            </span>
          ))}
        </div>
        {loading ? (
          <div className={st.startup}>
            <LoadingState compact label={t("Открываем Jup…")} />
          </div>
        ) : (
          <div className={st.actions}>
            {!app && (
              <a
                className="primary"
                href={`https://t.me/${botName}?startapp`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Открыть в Telegram")}
                <Icon name="arrowRight" size={18} />
              </a>
            )}
            {account ? (
              <>
                <p className={st.account}>
                  <Icon name="check" size={17} />
                  {t("Аккаунт Jup подключён")}
                  <small>{t(roleLabels[account.role])}</small>
                </p>
                {app && config.available && (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void link()}
                    >
                      {busy ? t("Подключаем…") : t("Связать с Telegram")}
                      <Icon name="arrowRight" size={18} />
                    </button>
                    <p className={st.note}>
                      {t(
                        "После привязки вход будет без пароля. Подключайте только свой Telegram.",
                      )}
                    </p>
                  </>
                )}
                <Link
                  className={app && config.available ? st.quiet : "primary"}
                  href={destination(account.role)}
                >
                  {t("Открыть кабинет")}
                  <Icon name="arrowRight" size={18} />
                </Link>
              </>
            ) : (
              <>
                <Link
                  className={app ? "primary" : "secondary"}
                  href={loginHref()}
                >
                  {t("Войти в Jup")}
                </Link>
                <Link className={st.quiet} href={loginHref(true)}>
                  {t("Создать аккаунт")}
                </Link>
                {app && (
                  <p className={st.note}>
                    {t(
                      "Первый раз? Войдите по почте и свяжите аккаунт с Telegram. Анкеты и занятия сохранятся.",
                    )}
                  </p>
                )}
              </>
            )}
            {app && !config.available && !error && (
              <p className={st.note}>
                {t("Вход через Telegram пока не подключён. Войдите по почте.")}
              </p>
            )}
            {error && (
              <div className={st.error} role="alert">
                <p>{t(error)}</p>
                <button
                  onClick={() => {
                    flight.current = null;
                    setError("");
                    setLoading(true);
                    setAttempt((n) => n + 1);
                  }}
                >
                  {t("Повторить")}
                </button>
              </div>
            )}
            {status === "error" && (
              <p className={st.note}>
                {t("Telegram не ответил. Можно продолжить через обычный вход.")}
              </p>
            )}
          </div>
        )}
      </section>
      <footer className={st.footer}>
        <span>Jup edu</span>
        <Link href="/privacy">{t("Конфиденциальность")}</Link>
        <Link href="/guide">{t("Помощь")}</Link>
      </footer>
    </main>
  );
}
