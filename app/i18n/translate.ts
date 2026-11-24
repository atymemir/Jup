import messages from "./messages.json" with { type: "json" };
export type Locale = "ru" | "kk" | "en";
export const localeTags: Record<Locale, string> = {
  ru: "ru-KZ",
  kk: "kk-KZ",
  en: "en-GB",
};
export function validLocale(value: unknown): Locale {
  return value === "kk" || value === "en" ? value : "ru";
}
const catalog = messages as Record<string, { kk: string; en: string }>;
const normalized = new Map(
  Object.entries(catalog).map(([key, value]) => [
    key.replace(/\s+/g, " ").trim(),
    value,
  ]),
);
const patterns = Object.entries(catalog)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => ({
    key,
    value,
    expression: new RegExp(
      "^" +
        key
          .split(/\{\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("(.+?)") +
        "$",
    ),
  }));
export function translate<T>(
  value: T,
  locale: Locale,
  params?: readonly unknown[],
): T {
  if (typeof value !== "string") return value;
  const raw = value;
  const key = raw.replace(/\s+/g, " ").trim();
  let result =
    locale === "ru"
      ? raw
      : (catalog[key]?.[locale] ?? normalized.get(key)?.[locale] ?? raw);
  if (locale !== "ru" && result === raw) {
    const match = patterns.find((pattern) => pattern.expression.test(key));
    if (match) {
      const groups = match.expression.exec(key)!;
      result = match.value[locale].replace(
        /\{(\d+)\}/g,
        (_, index) => groups[Number(index) + 1] ?? "",
      );
    } else
      for (const separator of [" · ", ", ", " / "]) {
        if (key.includes(separator)) {
          const parts = key.split(separator);
          if (parts.some((part) => catalog[part])) {
            result = parts
              .map((part) => translate(part, locale))
              .join(separator);
            break;
          }
        }
      }
  }
  if (result !== raw) {
    if (/^\s/.test(raw)) result = " " + result;
    if (/\s$/.test(raw)) result += " ";
  }
  if (params)
    result = result.replace(/\{(\d+)\}/g, (_, index) =>
      String(params[Number(index)] ?? ""),
    );
  return result as T;
}
