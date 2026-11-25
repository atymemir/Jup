"use client";
import { useLocale as useJupLocale } from "./i18n/LocaleProvider";

import { Brand } from "./ui/Brand";

import Link from "next/link";
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const { t: tr } = useJupLocale();

  return (
    <main className="auth authCard">
      <Link className="authBrand" href="/">
        <Brand />
      </Link>
      <h1>{tr("Не получилось открыть страницу")}</h1>
      <p>
        {tr(
          "Попробуйте ещё раз. Перед повторной записью проверьте «Мои занятия» — действие могло сохраниться.",
        )}
      </p>
      <button className="primary" onClick={() => retry()}>
        {tr("Повторить загрузку")}
      </button>
      <div className="authFoot">
        <Link href="/student">{tr("Мои занятия")}</Link>
        <Link href="/guide#questions">{tr("Помощь")}</Link>
      </div>
    </main>
  );
}
