import { localizeMetadata } from "./i18n/server";
import type { Metadata } from "next";
import "./base.css";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { getServerLocale } from "./i18n/server";
const metadata: Metadata = {
  title: "Jup edu — преподаватели и группы",
  description: "Подберите занятие для ЕНТ, SAT и IELTS в Казахстане.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getServerLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}

export async function generateMetadata() {
  const { locale } = await getServerLocale();
  return localizeMetadata(metadata, locale);
}
