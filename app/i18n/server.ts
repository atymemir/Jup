import { cookies } from "next/headers";
import { cache } from "react";
import { translate, validLocale } from "./translate";
export const getServerLocale = cache(async () => {
  const locale = validLocale((await cookies()).get("jup-locale")?.value);
  return {
    locale,
    t: <T>(value: T, params?: readonly unknown[]) =>
      translate(value, locale, params),
  };
});
export function localizeMetadata<T>(
  value: T,
  locale: import("./translate").Locale,
): T {
  if (typeof value === "string") return translate(value, locale);
  if (Array.isArray(value))
    return value.map((item) => localizeMetadata(item, locale)) as T;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        localizeMetadata(item, locale),
      ]),
    ) as T;
  return value;
}
