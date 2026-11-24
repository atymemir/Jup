// Keep Kazakh dates readable on browsers whose ICU data omits Kazakh month names.
const months = [
  "қаңтар",
  "ақпан",
  "наурыз",
  "сәуір",
  "мамыр",
  "маусым",
  "шілде",
  "тамыз",
  "қыркүйек",
  "қазан",
  "қараша",
  "желтоқсан",
];
const shortMonths = [
  "қаң.",
  "ақп.",
  "нау.",
  "сәу.",
  "мам.",
  "мау.",
  "шіл.",
  "там.",
  "қыр.",
  "қаз.",
  "қар.",
  "жел.",
];
const weekdays = {
  Monday: ["дүйсенбі", "дс"],
  Tuesday: ["сейсенбі", "сс"],
  Wednesday: ["сәрсенбі", "ср"],
  Thursday: ["бейсенбі", "бс"],
  Friday: ["жұма", "жм"],
  Saturday: ["сенбі", "сб"],
  Sunday: ["жексенбі", "жс"],
};
/** @param {"ru"|"kk"|"en"} locale @param {Intl.DateTimeFormatOptions} options */
export function dateFormatter(locale, options) {
  if (locale !== "kk")
    return new Intl.DateTimeFormat(
      locale === "en" ? "en-GB" : "ru-KZ",
      options,
    );
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return {
    /** @param {Date|number} value */
    format(value) {
      const p = Object.fromEntries(
        parts.formatToParts(value).map((part) => [part.type, part.value]),
      );
      const date = [];
      if (options.year) date.push(`${p.year} ж.`);
      if (options.day)
        date.push(options.day === "2-digit" ? p.day : String(Number(p.day)));
      if (options.month)
        date.push(
          options.month === "long"
            ? months[Number(p.month) - 1]
            : options.month === "short"
              ? shortMonths[Number(p.month) - 1]
              : options.month === "2-digit"
                ? p.month
                : String(Number(p.month)),
        );
      let label = date.join(" ");
      if (options.weekday) {
        const name =
          weekdays[/** @type {keyof typeof weekdays} */ (p.weekday)][
            options.weekday === "long" ? 0 : 1
          ];
        label = name + (label ? `, ${label}` : "");
      }
      if (options.hour) label += `${label ? ", " : ""}${p.hour}:${p.minute}`;
      return label;
    },
  };
}
