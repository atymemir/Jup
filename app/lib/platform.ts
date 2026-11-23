import type { Booking, Group, Tutor } from "./findbuddy";
export type AccountRole =
  | "student"
  | "teacher"
  | "business"
  | "owner"
  | "moderator";
export type Account = { id: string; role: AccountRole };
export type StudentProfile = {
  user_id?: string;
  name: string;
  budget_max?: number | null;
  stage: string;
  study_year: number | null;
  goal: string;
  institution?: string;
  city?: string;
  exam?: string;
  deadline?: string | null;
  languages?: string[];
  format?: string;
};
export type Education = {
  institution: string;
  degree: string;
  field: string;
  year: string;
  status: string;
};
export type Certificate = {
  name: string;
  issuer: string;
  year: string;
  result: string;
};
export type SpokenLanguage = { language: string; level: string };
export type Offering = {
  id: string;
  teacher_id: string;
  organization_id: string | null;
  title: string;
  description: string;
  subject: string;
  exam: string;
  languages: string[];
  format: "online" | "in_person";
  city: string;
  price: number;
  active: boolean;
};
export type Organization = {
  id: string;
  owner_id?: string;
  name: string;
  description: string;
  city: string;
  format: string;
  website: string;
  logo: string;
  status?: string;
  contact?: string;
  evidence?: string;
  review_note?: string;
  verification_revision?: number;
  teachers?: string[];
};
export type Member = {
  teacher_id: string;
  organization_id: string;
  name: string;
  organization_name: string;
  state: string;
  verification: string;
};
export type Invitation = {
  id: string;
  kind: string;
  email: string;
  expires_at: string;
  accepted_by: string | null;
  revoked: boolean;
};
export type OrgThread = {
  id: string;
  organization_id: string;
  name: string;
  unread: number;
};
export type Audit = {
  id: number;
  actor: string;
  kind: string;
  target: string;
  decision: string;
  reason: string;
  created_at: string;
};
export type Report = {
  id: string;
  kind: string;
  target: string;
  reason: string;
  resolved: boolean;
  created_at: string;
};
export type PlatformDashboard = {
  account: Account;
  private_photo?: string | null;
  account_name?: string | null;
  tutor_review_note?: string | null;
  student_profile: StudentProfile | null;
  tutor: Tutor | null;
  organization: Organization | null;
  offerings: Offering[];
  members: Member[];
  invitations: Invitation[];
  slots: Group[];
  bookings: (Booking & { student: StudentProfile | null })[];
  org_threads: OrgThread[];
  teacher_queue?: Tutor[];
  organization_queue?: Organization[];
  reports?: Report[];
  audit?: Audit[];
  staff?: { id: string; role: string; email: string }[];
};
export const roleHome = (role: AccountRole) =>
  role === "teacher"
    ? "/findbuddy/teacher"
    : role === "business"
      ? "/findbuddy/business"
      : role === "owner" || role === "moderator"
        ? "/findbuddy/admin"
        : "/findbuddy/student";
export const roleLabels: Record<AccountRole, string> = {
  student: "Ученик",
  teacher: "Преподаватель",
  business: "Учебный центр",
  owner: "Владелец",
  moderator: "Модератор",
};
export const stageLabels: Record<string, string> = {
  school: "Школа",
  college: "Колледж",
  university: "Университет",
  adult: "Учусь для себя",
};
export const statusLabels: Record<string, string> = {
  draft: "Черновик",
  pending: "На проверке",
  verified: "Профиль проверен",
  rejected: "Нужна доработка",
  hidden: "Публикация скрыта",
};
export function studentReady(profile?: StudentProfile | null) {
  return Boolean(
    profile &&
      profile.name.trim().length >= 2 &&
      profile.stage &&
      profile.goal.trim().length >= 5 &&
      (profile.stage === "adult" || profile.study_year),
  );
}
