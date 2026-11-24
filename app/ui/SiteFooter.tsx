"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import Link from "next/link";
export function SiteFooter() {
  const { t: tr } = useJupLocale();

  return (
    <footer className="siteFooter">
      <div>
        <Link className="footerBrand" href="/">
          Jup edu
        </Link>
        <p>
          {tr("От казахского «жұп» — пара. Найди своего человека для учёбы.")}
        </p>
        <small>{tr("Казахстан · ₸ · UTC+5")}</small>
      </div>
      <nav aria-label={tr("О сервисе")}>
        <span>{tr("Разобраться")}</span>
        <Link href="/landing">{tr("О Jup edu")}</Link>
        <Link href="/guide">{tr("Как пользоваться")}</Link>
        <Link href="/guide#questions">{tr("Вопросы и ответы")}</Link>
        <a
          href="https://www.instagram.com/fin.dbuddy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram ↗
        </a>
      </nav>
      <nav aria-label={tr("Партнёрам")}>
        <span>{tr("Развиваться вместе")}</span>
        <Link href="/teach">{tr("Преподавателям")}</Link>
        <Link href="/for-centers">{tr("Учебным центрам")}</Link>
        <a href="mailto:dpsg2e@gmail.com">{tr("Связаться с командой")}</a>
      </nav>
      <div className="footerLegal">
        <span>{tr("Jup edu · Учёба начинается с контакта.")}</span>
        <Link href="/privacy">{tr("Конфиденциальность")}</Link>
        <Link href="/terms">{tr("Правила сервиса")}</Link>
      </div>
    </footer>
  );
}
