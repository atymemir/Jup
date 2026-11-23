import type { Metadata } from "next";
import "./base.css";
export const metadata: Metadata = {
  title: "Jup edu — преподаватели и группы",
  description: "Подберите занятие для ЕНТ, SAT и IELTS в Казахстане.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
