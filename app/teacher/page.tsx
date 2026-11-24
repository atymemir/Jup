import { localizeMetadata } from "../i18n/server";
import { getServerLocale } from "../i18n/server";
import type { Metadata } from "next";
import AppEntry from "../platform/AppEntry";
const metadata: Metadata = {
  title: "Кабинет преподавателя · Jup edu",
};
export default function Page() {
  return <AppEntry area="teacher" />;
}

export async function generateMetadata() {
  const { locale } = await getServerLocale();
  return localizeMetadata(metadata, locale);
}
