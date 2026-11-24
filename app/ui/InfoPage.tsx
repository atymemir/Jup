"use client";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import { Brand } from "./Brand";
import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
export function InfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  const { t: tr } = useJupLocale();

  return (
    <main className="infoPage">
      <header>
        <Link className="footerBrand" href="/">
          <Brand />
        </Link>
        <LanguageSwitcher />
        <Link href="/">{tr("Найти преподавателя ↗")}</Link>
      </header>
      <article>
        <p className="infoEyebrow">{tr("Помощь и документы")}</p>
        <h1>{tr(title)}</h1>
        <p className="infoIntro">{tr(intro)}</p>
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}
