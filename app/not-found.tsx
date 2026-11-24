"use client";
import Link from "next/link";
import { LanguageSwitcher, useLocale } from "./i18n/LocaleProvider";
import { Brand } from "./ui/Brand";
import { Icon } from "./ui/Icon";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="notFoundPage">
      <header>
        <Link href="/" aria-label="Jup edu">
          <Brand />
        </Link>
        <LanguageSwitcher />
      </header>
      <section className="notFoundCard" aria-labelledby="not-found-title">
        <p className="notFoundCode" aria-hidden="true">
          404
        </p>
        <h1 id="not-found-title">{t("Страница не найдена")}</h1>
        <p>{t("Возможно, ссылка устарела или в адресе опечатка.")}</p>
        <div className="notFoundActions">
          <Link href="/" className="primary">
            {t("В каталог")}
            <Icon name="arrowRight" size={18} />
          </Link>
          <Link href="/guide" className="secondary">
            {t("Помощь")}
          </Link>
        </div>
      </section>
    </main>
  );
}
