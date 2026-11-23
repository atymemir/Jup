import type { Metadata } from "next";
import AppEntry from "../platform/AppEntry";
export const metadata: Metadata = {
  title: "Кабинет преподавателя · findbuddy",
};
export default function Page() {
  return <AppEntry area="teacher" />;
}
