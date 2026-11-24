"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { localeTags, translate, type Locale } from "./translate";
type LanguageContext = {
  locale: Locale;
  t: <T>(value: T, params?: readonly unknown[]) => T;
  setLocale: (value: Locale) => void;
};
const Context = createContext<LanguageContext>({
  locale: "ru",
  t: (value) => value,
  setLocale: () => {},
});
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, changeLocale] = useState(initialLocale);
  const router = useRouter();
  const value = useMemo(
    () => ({
      locale,
      t: <T,>(text: T, params?: readonly unknown[]) =>
        translate(text, locale, params),
      setLocale: (next: Locale) => {
        changeLocale(next);
        document.cookie = `jup-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        document.documentElement.lang = next;
        router.refresh();
      },
    }),
    [locale, router],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  return useContext(Context);
}
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="languageSwitcher">
      <span className="srOnly">
        {locale === "kk"
          ? "Интерфейс тілі"
          : locale === "en"
            ? "Interface language"
            : "Язык интерфейса"}
      </span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="ru">RU · Русский</option>
        <option value="kk">KZ · Қазақша</option>
        <option value="en">EN · English</option>
      </select>
    </label>
  );
}
export function useLocaleTag() {
  return localeTags[useLocale().locale];
}
