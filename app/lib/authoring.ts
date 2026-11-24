export type DraftKind = "lesson" | "profile" | "offering";
export type DraftInput = {
  kind: DraftKind;
  subject: string;
  exam: string;
  topics: string[];
  notes: string;
  locale?: "ru" | "kk" | "en";
};
export type TextDraft = { title: string; body: string; lessonPlan: string };
export const SUBJECT_TOPICS: Record<string, readonly string[]> = {
  Математика: [
    "Дроби и проценты",
    "Уравнения",
    "Неравенства",
    "Функции и графики",
    "Текстовые задачи",
    "Планиметрия",
    "Стереометрия",
    "Тригонометрия",
    "Производные",
    "Вероятность и статистика",
  ],
  География: [
    "Карта и координаты",
    "Литосфера",
    "Атмосфера и климат",
    "Гидросфера",
    "Природные зоны",
    "География Казахстана",
    "Население и миграция",
    "Мировое хозяйство",
    "Экология",
    "Работа с картами",
  ],
  Английский: [
    "Времена глагола",
    "Артикли",
    "Условные предложения",
    "Словарный запас",
    "Разговорная практика",
    "Чтение",
    "Аудирование",
    "Письмо",
    "Произношение",
    "Деловое общение",
  ],
  "История Казахстана": [
    "Древний Казахстан",
    "Тюркские государства",
    "Казахское ханство",
    "Казахстан в XVIII–XIX веках",
    "Движение Алаш",
    "Советский период",
    "Независимый Казахстан",
    "Исторические даты",
    "Работа с источниками",
  ],
  Физика: [
    "Кинематика",
    "Законы Ньютона",
    "Работа и энергия",
    "Импульс",
    "Термодинамика",
    "Электричество",
    "Магнетизм",
    "Колебания и волны",
    "Оптика",
    "Атомная физика",
  ],
  Химия: [
    "Строение атома",
    "Периодический закон",
    "Химическая связь",
    "Реакции и уравнения",
    "Расчётные задачи",
    "Растворы",
    "Кислоты и основания",
    "Окисление и восстановление",
    "Органическая химия",
  ],
  Биология: [
    "Строение клетки",
    "Обмен веществ",
    "Ботаника",
    "Зоология",
    "Анатомия человека",
    "Генетика",
    "Эволюция",
    "Экология",
    "Биотехнологии",
  ],
  Информатика: [
    "Системы счисления",
    "Логика",
    "Алгоритмы",
    "Python: основы",
    "Циклы и условия",
    "Массивы и строки",
    "Функции",
    "Базы данных и SQL",
    "Компьютерные сети",
    "Информационная безопасность",
  ],
};
export function topicsFor(subject: string, exam: string): readonly string[] {
  if (subject === "Английский" && exam === "IELTS")
    return [
      "IELTS Speaking",
      "Listening: стратегии",
      "Reading: типы заданий",
      "Writing Task 1: графики",
      "Writing Task 2: эссе",
      "Академическая лексика",
      "Пробный Speaking",
      "Разбор пробного теста",
    ];
  if (subject === "Математика" && exam === "SAT")
    return [
      "SAT Algebra",
      "Advanced Math",
      "Problem Solving and Data Analysis",
      "Geometry and Trigonometry",
      "Работа с Desmos",
      "Разбор пробного SAT",
    ];
  if (subject === "Английский" && exam === "SAT")
    return [
      "Reading and Writing",
      "Information and Ideas",
      "Craft and Structure",
      "Expression of Ideas",
      "Standard English Conventions",
      "Разбор пробного SAT",
    ];
  return SUBJECT_TOPICS[subject] ?? [];
}
export function validDraftInput(value: unknown): value is DraftInput {
  if (!value || typeof value !== "object") return false;
  const v = value as DraftInput;
  return (
    ["lesson", "profile", "offering"].includes(v.kind) &&
    Object.hasOwn(SUBJECT_TOPICS, v.subject) &&
    ["ЕНТ", "IELTS", "SAT", "Школьная программа"].includes(v.exam) &&
    typeof v.notes === "string" &&
    v.notes.length <= 1200 &&
    (v.locale === undefined || ["ru", "kk", "en"].includes(v.locale)) &&
    Array.isArray(v.topics) &&
    v.topics.length <= 12 &&
    v.topics.every(
      (topic) =>
        typeof topic === "string" &&
        topicsFor(v.subject, v.exam).includes(topic),
    )
  );
}
type DraftTranslator = (text: string, params?: readonly unknown[]) => string;
export function makeTemplate(
  input: DraftInput,
  translate?: DraftTranslator,
): TextDraft {
  const tr: DraftTranslator =
    translate ??
    ((text, params) =>
      text.replace(/\{(\d+)\}/g, (_, index) =>
        String(params?.[Number(index)] ?? ""),
      ));
  const subject = tr(input.subject);
  const focus = input.topics.length
    ? input.topics.map((topic) => tr(topic)).join(", ")
    : subject;
  const exam = tr(
    input.exam === "Школьная программа" ? "школьная программа" : input.exam,
  );
  const title =
    input.kind === "lesson"
      ? `${subject} · ${tr(input.topics[0] ?? "первый урок")}`
      : `${subject} · ${exam}`;
  const plan = [
    tr("1. Знакомство и короткая проверка уровня."),
    tr("2. Разбор темы: {0}.", [tr(input.topics[0] ?? input.subject)]),
    tr("3. Практика с объяснением каждого шага."),
    tr("4. Обратная связь и план дальнейшей работы."),
  ].join("\n");
  const body = (
    input.kind === "profile"
      ? [
          input.notes.trim(),
          tr("Помогаю разобраться в предмете «{0}». Направление: {1}.", [
            subject,
            exam,
          ]),
          tr("Темы, с которыми можно обратиться: {0}.", [focus]),
          tr(
            "На первом уроке обсудим вашу цель, определим сложные места и подберём план занятий.",
          ),
        ]
      : [
          input.notes.trim(),
          tr("Тема: {0}.", [focus]),
          tr("Предмет: {0}. Подготовка: {1}.", [subject, exam]),
          [
            "План занятия:",
            "• Короткая диагностика и вопросы.",
            "• Объяснение на примерах.",
            "• Самостоятельная практика с разбором.",
            "• Итоги и следующий шаг.",
          ]
            .map((text) => tr(text))
            .join("\n"),
        ]
  )
    .filter(Boolean)
    .join("\n\n");
  return {
    title: title.slice(0, 120),
    body: body.slice(0, 1500),
    lessonPlan: plan.slice(0, 600),
  };
}
export function validateTextDraft(value: unknown): value is TextDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as TextDraft;
  return (
    typeof v.title === "string" &&
    v.title.trim().length >= 5 &&
    v.title.length <= 120 &&
    typeof v.body === "string" &&
    v.body.trim().length >= 20 &&
    v.body.length <= 1500 &&
    typeof v.lessonPlan === "string" &&
    v.lessonPlan.length <= 600
  );
}
export type TextEdit = { value: string; start: number; end: number };
export function editText(
  value: string,
  start: number,
  end: number,
  action: "bold" | "bullet" | "number",
): TextEdit {
  start = Math.max(0, Math.min(start, value.length));
  end = Math.max(start, Math.min(end, value.length));
  if (action === "bold") {
    const text = value.slice(start, end) || "выделенный текст";
    return {
      value: value.slice(0, start) + `**${text}**` + value.slice(end),
      start: start + 2,
      end: start + 2 + text.length,
    };
  }
  const from = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const next = value.indexOf("\n", end);
  const to = next < 0 ? value.length : next;
  const lines = value.slice(from, to).split("\n");
  const text = lines
    .map(
      (line, i) =>
        `${action === "bullet" ? "•" : `${i + 1}.`} ${line.replace(/^(?:[•*-]|\d+\.)\s+/, "")}`,
    )
    .join("\n");
  return {
    value: value.slice(0, from) + text + value.slice(to),
    start: from,
    end: from + text.length,
  };
}
export type TextBlock = {
  kind: "paragraph" | "bullet" | "number";
  lines: string[];
  start?: number;
};
export function textBlocks(value: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const line of value.split("\n")) {
    const kind = /^[•*-]\s+/.test(line)
      ? "bullet"
      : /^\d{1,4}\.\s+/.test(line)
        ? "number"
        : "paragraph";
    const clean =
      kind === "paragraph" ? line : line.replace(/^(?:[•*-]|\d+\.)\s+/, "");
    const last = blocks.at(-1);
    const number = kind === "number" ? parseInt(line, 10) : 1;
    if (
      last?.kind === kind &&
      (kind !== "number" || number === (last.start ?? 1) + last.lines.length)
    )
      last.lines.push(clean);
    else
      blocks.push({
        kind,
        lines: [clean],
        ...(kind === "number" && number !== 1 ? { start: number } : {}),
      });
  }
  return blocks;
}

export function lessonTimeSuggestions(
  now: number,
  locale: "ru" | "kk" | "en" = "ru",
) {
  const local = new Date(now + 5 * 3600000);
  return [
    [1, 17],
    [1, 19],
    [2, 17],
  ].map(([day, hour]) => {
    const date = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() + day,
        hour,
      ),
    );
    return {
      label: `${{ ru: ["Завтра", "Послезавтра"], kk: ["Ертең", "Бүрсігүні"], en: ["Tomorrow", "Day after tomorrow"] }[locale][day === 1 ? 0 : 1]}, ${hour}:00`,
      value: date.toISOString().slice(0, 16),
    };
  });
}
