"use client";
import { miniAppScreen } from "../lib/telegramMiniApp.mjs";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { LoadingState } from "../ui/LoadingState";
import { Brand } from "../ui/Brand";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FormEvent,
} from "react";
import { getSupabase } from "../lib/supabase";
import { api } from "../lib/api";
import { roleHome, type Account } from "../lib/platform";
import { fetchJson } from "../lib/http";
import { ChoiceCard, SetupProgress } from "../ui/SetupControls";
import { Icon, type IconName } from "../ui/Icon";
import {
  authDestination,
  authEmailRedirect,
  currentAuthIntent,
} from "../lib/authIntent";

type Mode = "login" | "signup" | "forgot" | "recovery";
function authError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  const labels: Record<string, string> = {
    invalid_credentials: "Проверьте почту и пароль.",
    email_not_confirmed: "Откройте письмо от Jup edu и подтвердите адрес.",
    over_email_send_rate_limit:
      "Подождите немного перед новым запросом письма.",
    weak_password: "Используйте более надёжный пароль.",
    user_already_exists: "Аккаунт уже существует. Войдите с паролем.",
  };
  return (
    labels[String(code)] ??
    (error instanceof Error && !code
      ? error.message
      : "Не удалось продолжить. Попробуйте ещё раз.")
  );
}

export default function Login() {
  const { t: tr } = useJupLocale();

  const [local, setLocal] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const stepTitle = [
    "Что вас сюда привело?",
    "Как вас называть?",
    "Сохраним ваш прогресс",
  ];
  const stepInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step > 0) stepInput.current?.focus();
  }, [step]);
  const [intent, setIntent] = useState<string | null>(null);
  const lock = useRef(false);

  const nextPage = useCallback(async () => {
    const viewer = await api<{ account: Account | null }>("viewer");
    if (!viewer.account)
      throw Error("Не удалось подтвердить вход. Попробуйте войти ещё раз.");
    const actual = viewer.account.role;
    const pending = currentAuthIntent(window.location.search);
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (
      !invite &&
      new URLSearchParams(window.location.search).get("returnTo") === "telegram"
    ) {
      location.assign(
        "/findbuddy/telegram?screen=" +
          encodeURIComponent(
            miniAppScreen(
              new URLSearchParams(window.location.search).get("screen"),
            ),
          ),
      );
      return;
    }
    if (invite && /^[a-f0-9]{64}$/.test(invite)) {
      location.assign("/findbuddy/invite?token=" + invite);
      return;
    }
    if (actual === "student" && pending && !pending.startsWith("tab/teacher"))
      location.assign(authDestination(actual, pending, window.location.search));
    else if (actual === "teacher" && pending?.startsWith("tab/teacher"))
      location.assign(authDestination(actual, pending, window.location.search));
    else location.assign(roleHome(actual));
  }, []);
  useEffect(() => {
    let active = true;
    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      const target =
        params.get("role") === "teacher"
          ? "teacher"
          : params.get("role") === "business"
            ? "business"
            : "student";
      setIntent(currentAuthIntent(window.location.search));
      setRole(target);
      setMode(params.get("mode") === "signup" ? "signup" : "login");
      const config = await fetchJson<{
        preview: boolean;
        authAvailable?: boolean;
      }>("/findbuddy/api/preview");
      if (!active) return;
      if (config.authAvailable === false) {
        setMessage(
          "Вход и регистрация временно недоступны. Подключение аккаунтов ещё не настроено.",
        );
        return;
      }
      if (config.preview) {
        setLocal(true);
        return;
      }
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (fragment.has("error")) {
        setMessage(
          "Ссылка истекла или уже была использована. Запросите новую.",
        );
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
        setLocal(false);
        return;
      }
      const session = await getSupabase().auth.getSession();
      if (!active) return;
      if (
        params.get("flow") === "recovery" &&
        fragment.get("type") === "recovery" &&
        session.data.session
      ) {
        setMode("recovery");
      } else if (
        params.get("flow") === "confirm" &&
        fragment.get("type") === "signup" &&
        session.data.session
      ) {
        const name = session.data.session.user.user_metadata.display_name;
        if (typeof name === "string")
          await api("", "initial_name", { name }).catch(() => {});
        if (!active) return;
        await nextPage();
        return;
      } else if (params.has("flow")) {
        setMessage("Войдите с паролем или запросите новую ссылку.");
      }
      setLocal(false);
    }
    void initialize().catch(() => {
      if (active) setMessage("Вход пока недоступен. Обновите страницу.");
    });
    return () => {
      active = false;
    };
  }, [nextPage]);

  function switchMode(next: Mode) {
    if (lock.current) return;
    setMode(next);
    setSent(false);
    setMessage("");
    setVisible(false);
    setStep(0);
    setPassword("");
  }
  const redirect = (flow: "confirm" | "recovery") =>
    authEmailRedirect(
      location.origin,
      flow,
      role,
      currentAuthIntent(window.location.search),
      window.location.search,
    );
  async function localRequest(data: object) {
    await fetchJson("/findbuddy/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (mode === "signup" && step < 2) {
      setMessage("");
      setStep(step + 1);
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup" && name.trim().length < 2)
        throw Error("Укажите имя от двух символов.");
      if (local) {
        await localRequest({
          action: mode,
          email,
          password,
          name: name.trim(),
          birth_date: birthDate || null,
          account_type: role,
        });
        return await nextPage();
      }
      const auth = getSupabase().auth;
      if (mode === "forgot") {
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: redirect("recovery"),
        });
        if (error) throw error;
        setSent(true);
      } else if (mode === "recovery") {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
        await nextPage();
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name.trim(),
              account_type: role,
              birth_date: birthDate || null,
            },
            emailRedirectTo: redirect("confirm"),
          },
        });
        if (error) throw error;
        if (data.session) {
          await api("", "initial_name", { name }).catch(() => {});
          await nextPage();
        } else setSent(true);
      } else {
        const { data, error } = await auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const name = data.user.user_metadata.display_name;
        if (typeof name === "string")
          await api("", "initial_name", { name }).catch(() => {});
        await nextPage();
      }
    } catch (e) {
      setMessage(authError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function resend() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await getSupabase().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirect("confirm") },
      });
      if (error) throw error;
      setMode("signup");
      setSent(true);
    } catch (e) {
      setMessage(authError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <header className="authHeader">
        <LanguageSwitcher />
        <Link
          className="authBrand"
          href="/"
          aria-label={tr("Jup edu — главная")}
        >
          <Brand />
        </Link>
        <Link href="/">{tr("К преподавателям")}</Link>
      </header>
      <div className="authLayout">
        <aside className="authCompanion">
          <p className="authEyebrow">{tr("Свой человек для учёбы")}</p>
          <h2>
            {role === "teacher" ? (
              <>
                {tr("Ваши знания.")}
                <br />
                {tr("Чей-то следующий шаг.")}
              </>
            ) : role === "business" ? (
              <>
                {tr("Ваша команда.")}
                <br />
                {tr("Всё в одном месте.")}
              </>
            ) : (
              <>
                {tr("Когда понятно,")}
                <br />
                {tr("учиться проще.")}
              </>
            )}
          </h2>
          <p>
            {tr(
              role === "teacher"
                ? tr(
                    "Расскажите о своём подходе, откройте свободное время и найдите учеников.",
                  )
                : role === "business"
                  ? tr(
                      "Соберите преподавателей, направления и расписание вашего центра.",
                    )
                  : tr(
                      "Найдите преподавателя, с которым можно задавать вопросы и двигаться к своей цели.",
                    ),
            )}
          </p>
          <div className="authBenefits">
            {(role === "teacher"
              ? [
                  [
                    "teacher",
                    "Анкета с вашим подходом",
                    "Покажите, чему и как вы учите.",
                  ],
                  [
                    "calendar",
                    "Расписание без переписок",
                    "Ученики выбирают свободное время.",
                  ],
                  [
                    "requests",
                    "Связь после урока",
                    "Чат, материалы и домашние задания рядом.",
                  ],
                ]
              : role === "business"
                ? [
                    [
                      "groups",
                      "Своя команда",
                      "Приглашайте преподавателей в центр.",
                    ],
                    [
                      "calendar",
                      "Общее расписание",
                      "Направления, занятия и записи учеников.",
                    ],
                    [
                      "requests",
                      "Прямой контакт",
                      "Обращения учеников в одном кабинете.",
                    ],
                  ]
                : [
                    [
                      "search",
                      "Выбираете вы",
                      "Подход, язык и цена видны заранее.",
                    ],
                    [
                      "calendar",
                      "Урок в удобное время",
                      "Запишитесь или обсудите свой вариант.",
                    ],
                    [
                      "requests",
                      "Дальше всё рядом",
                      "Занятия, чат и материалы в одном аккаунте.",
                    ],
                  ]
            ).map(([icon, title, description]) => (
              <div key={title}>
                <span>
                  <Icon name={icon as IconName} size={21} />
                </span>
                <div>
                  <strong>{tr(title)}</strong>
                  <p>{tr(description)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="authPilot">
            {tr("Бесплатный пилот · комиссия платформы 0%")}
          </p>
        </aside>
        <section
          className="auth authCard"
          aria-label={tr(
            mode === "signup" ? tr("Регистрация") : tr("Вход в аккаунт"),
          )}
        >
          {mode === "signup" && !sent && (
            <SetupProgress
              labels={[tr("Роль"), tr("О вас"), tr("Доступ")]}
              step={step}
              onBack={
                busy
                  ? undefined
                  : (next) => {
                      setStep(next);
                      setMessage("");
                    }
              }
            />
          )}
          <h1>
            {tr(
              sent
                ? tr("Проверьте почту")
                : mode === "signup"
                  ? stepTitle[step]
                  : mode === "forgot"
                    ? tr("Вернём вам доступ")
                    : mode === "recovery"
                      ? tr("Новый пароль")
                      : tr("С возвращением"),
            )}
          </h1>
          <p className="authSubtitle">
            {tr(
              sent
                ? tr("Остался один шаг.")
                : mode === "signup"
                  ? [
                      tr("Подстроим Jup edu под вашу задачу."),
                      tr("Укажите имя для общения на платформе."),
                      tr("Занятия и переписки будут в одном аккаунте."),
                    ][step]
                  : mode === "login"
                    ? tr("Войдите, чтобы продолжить с того же места.")
                    : tr("Укажите данные ниже, чтобы продолжить."),
            )}
          </p>
          {intent && !sent && (
            <p className="authContinuation">
              {tr("Ваш выбор сохранён. Вернёмся к нему после входа.")}
            </p>
          )}
          {sent ? (
            <div className="authSent">
              <p>
                {tr(
                  mode === "signup"
                    ? tr("Подтвердите адрес по ссылке в письме на")
                    : tr(
                        "Если аккаунт существует, ссылка для смены пароля придёт на",
                      ),
                )}{" "}
                <strong>{email}</strong>.
              </p>
              {mode === "signup" && (
                <button className="primary" disabled={busy} onClick={resend}>
                  {tr(
                    busy ? tr("Отправляем…") : tr("Отправить письмо ещё раз"),
                  )}
                </button>
              )}
              <button onClick={() => switchMode("login")}>
                {tr("Вернуться ко входу")}
              </button>
            </div>
          ) : (
            local !== null && (
              <form onSubmit={submit} aria-busy={busy}>
                {mode === "signup" && step === 0 && (
                  <fieldset className="setupChoices" disabled={busy}>
                    <legend className="srOnly">
                      {tr("Как будете пользоваться Jup edu")}
                    </legend>
                    {[
                      [
                        "student",
                        "Хочу учиться",
                        "Найти преподавателя под свою цель",
                        "teacher",
                      ],
                      [
                        "teacher",
                        "Хочу преподавать",
                        "Найти учеников и вести занятия",
                        "calendar",
                      ],
                      [
                        "business",
                        "У меня учебный центр",
                        "Собрать команду и расписание",
                        "groups",
                      ],
                    ].map(([value, title, description, icon]) => (
                      <ChoiceCard
                        key={value}
                        name="role"
                        value={value}
                        selected={role === value}
                        title={tr(title)}
                        description={tr(description)}
                        icon={icon as IconName}
                        onChange={setRole}
                      />
                    ))}
                  </fieldset>
                )}
                {mode === "signup" && step === 1 && (
                  <>
                    <label htmlFor="fb-name">
                      {tr("Ваше имя")}
                      <input
                        ref={stepInput}
                        id="fb-name"
                        name="name"
                        disabled={busy}
                        autoComplete="given-name"
                        placeholder={tr("Например, Аружан")}
                        minLength={2}
                        maxLength={50}
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <details className="authOptional">
                      <summary>
                        {tr("Добавить дату рождения ")}
                        <span>{tr("Необязательно")}</span>
                      </summary>
                      <label htmlFor="fb-birthday">
                        {tr("Дата рождения ")}
                        <small>{tr("Видна только вам")}</small>
                        <input
                          id="fb-birthday"
                          name="birth_date"
                          type="date"
                          autoComplete="bday"
                          disabled={busy}
                          min={`${new Date().getFullYear() - 120}-01-01`}
                          max={new Date().toLocaleDateString("en-CA", {
                            timeZone: "Asia/Almaty",
                          })}
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                        />
                      </label>
                    </details>
                  </>
                )}
                {(mode !== "signup" || step === 2) && (
                  <>
                    {mode === "signup" && (
                      <div className="authIdentity">
                        <span>
                          <Icon name="check" size={17} />
                        </span>
                        <div>
                          <strong>{name}</strong>
                          <small>
                            {tr(
                              role === "teacher"
                                ? tr("Преподаватель")
                                : role === "business"
                                  ? tr("Учебный центр")
                                  : tr("Ученик"),
                            )}
                          </small>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setStep(1)}
                        >
                          {tr("Изменить")}
                        </button>
                      </div>
                    )}
                    {mode !== "recovery" && (
                      <label htmlFor="fb-email">
                        {tr("Электронная почта")}
                        <input
                          ref={stepInput}
                          id="fb-email"
                          name="email"
                          disabled={busy}
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="you@example.com"
                          maxLength={254}
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </label>
                    )}
                    {mode !== "forgot" && (
                      <div className="authPassword">
                        <label htmlFor="fb-password">
                          {tr(
                            mode === "recovery"
                              ? tr("Новый пароль")
                              : tr("Пароль"),
                          )}
                        </label>
                        <span className="passwordField">
                          <input
                            id="fb-password"
                            name="password"
                            disabled={busy}
                            type={visible ? "text" : "password"}
                            autoComplete={
                              mode === "login"
                                ? "current-password"
                                : "new-password"
                            }
                            required
                            minLength={mode === "login" ? 1 : 8}
                            maxLength={128}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-describedby={
                              mode !== "login" ? "fb-password-hint" : undefined
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setVisible(!visible)}
                            aria-pressed={visible}
                          >
                            {tr(visible ? tr("Скрыть") : tr("Показать"))}
                          </button>
                        </span>
                        {mode !== "login" && (
                          <small id="fb-password-hint">
                            {tr(
                              "От 8 символов. Можно использовать менеджер паролей.",
                            )}
                          </small>
                        )}
                      </div>
                    )}
                  </>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoadingState compact label={tr("Подождите…")} />
                  ) : mode === "signup" ? (
                    step < 2 ? (
                      tr("Продолжить")
                    ) : (
                      tr("Создать аккаунт")
                    )
                  ) : mode === "forgot" ? (
                    tr("Получить ссылку")
                  ) : mode === "recovery" ? (
                    tr("Сохранить пароль")
                  ) : (
                    tr("Войти")
                  )}
                </button>
                {mode === "signup" && step > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep(step - 1);
                      setMessage("");
                    }}
                  >
                    {tr("Назад")}
                  </button>
                )}
                <div className="authLinks">
                  {mode === "login" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => switchMode("signup")}
                      >
                        {tr("Создать аккаунт")}
                      </button>
                      {!local && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => switchMode("forgot")}
                        >
                          {tr("Забыли пароль?")}
                        </button>
                      )}
                    </>
                  ) : (
                    mode !== "recovery" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => switchMode("login")}
                      >
                        {tr("Уже есть аккаунт? Войти")}
                      </button>
                    )
                  )}
                </div>
                {!local &&
                  mode === "login" &&
                  message.includes("подтвердите") && (
                    <button type="button" onClick={resend} disabled={busy}>
                      {tr("Отправить письмо подтверждения")}
                    </button>
                  )}
              </form>
            )
          )}
          {local === null && !message && (
            <div className="authPending">
              <LoadingState compact label={tr("Готовим безопасный вход…")} />
              <div aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {message && (
            <p className="authError" role="alert">
              {tr(message)}
            </p>
          )}
          {local === null && message && (
            <button
              className="secondary"
              onClick={() => window.location.reload()}
            >
              {tr("Повторить загрузку")}
            </button>
          )}
          {local && (
            <p className="authLocal">
              {tr(
                "Локальная версия: аккаунт сохраняется на этом компьютере. Подтверждение почты недоступно.",
              )}
            </p>
          )}
          <div className="authFoot">
            <Link href="/guide">{tr("Помощь")}</Link>
            <Link href="/privacy">{tr("Конфиденциальность")}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
