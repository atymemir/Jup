export const FB_SUBJECTS = [
  "География",
  "Математика",
  "Английский",
  "История Казахстана",
  "Физика",
  "Химия",
  "Биология",
  "Информатика",
] as const;
export const FB_EXAMS = ["ЕНТ", "IELTS", "SAT", "Школьная программа"] as const;
export const FB_LANGUAGES = ["Русский", "Қазақша", "English"] as const;
export const FB_CITIES = [
  "Онлайн",
  "Алматы",
  "Астана",
  "Шымкент",
  "Караганда",
  "Другой город",
] as const;
export type Tutor = {
  verification_revision?: number;
  education_entries?: import("./platform").Education[];
  certificates?: import("./platform").Certificate[];
  spoken_languages?: import("./platform").SpokenLanguage[];
  teaching_approach?: string;
  audience?: string;
  verification_links?: string;
  offerings?: import("./platform").Offering[];
  review_count?: number;
  rating?: number | null;
  education?: string;
  lesson_plan?: string;
  photo_version?: string | null;
  id: string;
  display_name: string;
  headline: string;
  bio: string;
  subject: string;
  exam: string;
  language: string;
  city: string;
  price: number;
  experience: number;
  verification: "pending" | "verified" | "rejected";
};
export type Group = {
  offering_id?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  enrollment_closed?: boolean;
  id: string;
  tutor_id: string;
  title: string;
  subject: string;
  exam: string;
  language: string;
  city: string;
  price: number;
  capacity: number;
  reserved: number;
  starts_at: string;
  description: string;
};
export type StudyRequest = {
  id: string;
  student_id: string;
  tutor_id: string | null;
  subject: string;
  exam: string;
  language: string;
  city: string;
  budget: number;
  goal: string;
  status: "open" | "matched" | "closed";
  created_at: string;
};
export type Offer = {
  id: string;
  request_id: string;
  tutor_id: string;
  price: number;
  starts_at: string;
  note: string;
  status: "pending" | "accepted" | "declined";
};
export type Booking = {
  organization_id?: string | null;
  organization_name?: string | null;
  teacher_name?: string | null;
  exam?: string;
  language?: string;
  city?: string;
  lesson_title?: string | null;
  lesson_format?: "group" | "individual";
  id: string;
  student_id: string;
  tutor_id: string;
  group_id: string | null;
  subject: string;
  price: number;
  commission: number;
  commission_policy?: "pilot_free";
  model_commission?: number;
  model_tutor_net?: number;
  tutor_net: number;
  starts_at: string;
  status: "awaiting_payment" | "cancelled";
};
export type Message = {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type Catalog = {
  tutors: Tutor[];
  groups: Group[];
  organizations?: import("./platform").Organization[];
};
export type LessonRoom = {
  id: string;
  revision: number;
  task_version: number;
  plan: string;
  material: string;
  meeting: string;
  location: string;
  homework: string;
  recap: string;
};
export type LessonSeat = {
  unread: number;
  id: string;
  name: string;
  work: {
    answer: string;
    feedback: string;
    task_version: number;
    revision: number;
  } | null;
  move: { id: string; proposed_by: string; starts_at: string } | null;
};
export type Dashboard = {
  account?: import("./platform").Account;
  student_profile?: import("./platform").StudentProfile | null;
  offerings?: import("./platform").Offering[];
  free_pilot?: boolean;
  outcomes?: LessonOutcome[];
  private_photo?: string | null;
  rooms?: LessonRoom[];
  seats?: LessonSeat[];
  student_name?: string | null;
  calendar_enabled?: boolean;
  payments?: { booking_id: string; withdrawn: boolean; tutor_net: number }[];
  tutor: Tutor | null;
  requests: StudyRequest[];
  offers: Offer[];
  bookings: Booking[];
  messages: Message[];
  telegram_connected: boolean;
};
export type LessonOutcome = {
  booking_id: string;
  teacher_response: "pending" | "completed" | "problem";
  student_response: "pending" | "completed" | "problem";
  teacher_note: string;
  student_note: string;
  teacher_revision: number;
  student_revision: number;
  teacher_updated_at: string | null;
  student_updated_at: string | null;
};
export function roomForBooking(rooms: LessonRoom[] | undefined, b: Booking) {
  return (
    rooms?.find((r) => r.id === b.id) ?? rooms?.find((r) => r.id === b.group_id)
  );
}
export const EMPTY_DASHBOARD: Dashboard = {
  tutor: null,
  requests: [],
  offers: [],
  bookings: [],
  messages: [],
  telegram_connected: false,
};
export const money = (amount: number) =>
  `${new Intl.NumberFormat("ru-KZ").format(amount)} ₸`;
export const lessonDate = (value: string) =>
  new Intl.DateTimeFormat("ru-KZ", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
// A datetime-local field always represents Kazakhstan time, independent of the device.
export function kazakhstanDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Укажите дату и время занятия.");
  const result = new Date(`${value}:00+05:00`);
  if (
    !Number.isFinite(result.getTime()) ||
    result.getTime() <= Date.now() ||
    new Date(result.getTime() + 5 * 3600000).toISOString().slice(0, 16) !==
      value
  )
    throw new Error("Выберите существующую дату в будущем (Казахстан, UTC+5).");
  return result.toISOString();
}
// Future 5% pricing model. Actual pilot fees come from server-owned booking terms.
export function splitLessonPrice(price: number) {
  if (
    !Number.isInteger(price) ||
    (price !== 0 && price < 500) ||
    price > 100000
  )
    throw new Error("Цена: бесплатно или от 500 до 100 000 ₸, целое число.");
  const commission = Math.floor((price * 5 + 50) / 100);
  return { price, commission, tutorNet: price - commission };
}
export function filterTutors(
  tutors: Tutor[],
  filters: {
    query: string;
    subject: string;
    exam: string;
    language: string;
    city: string;
    maxPrice: number;
  },
) {
  const normalize = (text: string) =>
    text.toLocaleLowerCase().replaceAll("ё", "е");
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  return tutors
    .filter((t) => {
      const entries = t.offerings;
      const matches = entries
        ? entries.filter(
            (o) =>
              o.active &&
              (!filters.subject || o.subject === filters.subject) &&
              (!filters.exam || o.exam === filters.exam) &&
              (!filters.language || o.languages.includes(filters.language)) &&
              (!filters.city ||
                (o.format === "online" ? "Онлайн" : o.city) === filters.city) &&
              o.price <= filters.maxPrice,
          )
        : null;
      const wordsMatch = words.every((word) =>
        normalize(
          `${t.display_name} ${t.subject} ${t.exam} ${t.headline} ${t.bio} ${t.education ?? ""} ${t.language} ${t.city} ${entries?.map((o) => `${o.title} ${o.subject} ${o.exam} ${o.languages.join(" ")} ${o.description}`).join(" ") ?? ""}`,
        ).includes(word),
      );
      return (
        wordsMatch &&
        (matches
          ? matches.length > 0
          : (!filters.subject || t.subject === filters.subject) &&
            (!filters.exam || t.exam === filters.exam) &&
            (!filters.language || t.language === filters.language) &&
            (!filters.city || t.city === filters.city) &&
            t.price <= filters.maxPrice)
      );
    })
    .sort((a, b) => a.price - b.price);
}
export function matchingOfferings(
  t: Tutor,
  filters: { subject: string; exam: string; language: string; city: string },
) {
  return (
    t.offerings
      ?.filter(
        (o) =>
          o.active &&
          (!filters.subject || o.subject === filters.subject) &&
          (!filters.exam || o.exam === filters.exam) &&
          (!filters.language || o.languages.includes(filters.language)) &&
          (!filters.city ||
            (o.format === "online" ? "Онлайн" : o.city) === filters.city),
      )
      .sort((a, b) => a.price - b.price) ?? []
  );
}
// Illustrative profiles are never written to Supabase and cannot receive requests.
export const DEMO_CATALOG: Catalog = {
  tutors: [
    {
      id: "demo-geo",
      display_name: "Аружан · пример",
      headline: "География: понять связи, а не заучивать карты",
      bio: "Разберём климат, экономическую географию и задания ЕНТ. После занятия — список ошибок и короткая практика.",
      subject: "География",
      exam: "ЕНТ",
      language: "Қазақша",
      city: "Онлайн",
      price: 3500,
      experience: 2,
      verification: "verified",
    },
    {
      id: "demo-sat",
      display_name: "Данияр · пример",
      headline: "SAT Math с разбором ваших ошибок",
      bio: "Линейные уравнения, функции и геометрия. Начинаем с тем, которые мешают вашему прогрессу.",
      subject: "Математика",
      exam: "SAT",
      language: "Русский",
      city: "Онлайн",
      price: 6000,
      experience: 3,
      verification: "verified",
    },
    {
      id: "demo-ielts",
      display_name: "Алина · пример",
      headline: "IELTS: разговорная практика и обратная связь",
      bio: "Структура ответа, аргументация и словарь. Практика на уроке, понятный следующий шаг после него.",
      subject: "Английский",
      exam: "IELTS",
      language: "Русский",
      city: "Алматы",
      price: 5000,
      experience: 4,
      verification: "verified",
    },
  ],
  groups: [
    {
      id: "demo-group",
      tutor_id: "demo-geo",
      title: "География · климат и природные зоны",
      subject: "География",
      exam: "ЕНТ",
      language: "Қазақша",
      city: "Онлайн",
      price: 1500,
      capacity: 6,
      reserved: 0,
      starts_at: "2027-01-16T13:00:00+05:00",
      description:
        "Пример мини-группы: 60 минут разбора заданий, практика и работа над ошибками. Дата и места демонстрационные.",
    },
  ],
};
