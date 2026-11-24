import type { Metadata } from "next";
import { getServerLocale, localizeMetadata } from "../i18n/server";
import MiniAppEntry from "./MiniAppEntry";
export default function Page() {
  return <MiniAppEntry />;
}
export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  return localizeMetadata(
    {
      title: "Jup edu · Telegram",
      description: "Расписание, ученики и переписка — в одном приложении.",
    },
    locale,
  );
}
