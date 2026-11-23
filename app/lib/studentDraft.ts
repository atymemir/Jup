import type { StudentProfile } from "./platform";

export function studentDraftKey(profile?: StudentProfile | null) {
  return profile?.user_id ? `findbuddy-student-draft:${profile.user_id}` : null;
}

export function readStudentDraft(key: string | null): Partial<StudentProfile> | null {
  if (!key) return null;
  try {
    const item = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!item || typeof item !== "object" || !Number.isFinite(item.savedAt) || Date.now() - item.savedAt > 86400000) return null;
    const d = item.profile;
    if (!d || typeof d !== "object" || typeof d.name !== "string" || typeof d.goal !== "string") return null;
    return {
      name: d.name.slice(0, 50), goal: d.goal.slice(0, 1000),
      stage: ["school", "college", "university", "adult"].includes(d.stage) ? d.stage : "school",
      study_year: Number.isInteger(d.study_year) && d.study_year >= 1 && d.study_year <= 12 ? d.study_year : 11,
      exam: typeof d.exam === "string" ? d.exam : "",
      languages: Array.isArray(d.languages) && d.languages.every((v: unknown) => typeof v === "string") ? d.languages : [],
      format: ["any", "online", "in_person"].includes(d.format) ? d.format : "any",
      city: typeof d.city === "string" ? d.city : "",
      budget_max: Number.isInteger(d.budget_max) && d.budget_max >= 0 && d.budget_max <= 100000 ? d.budget_max : null,
    };
  } catch { return null; }
}

export function writeStudentDraft(key: string | null, profile: Partial<StudentProfile>) {
  if (!key) return false;
  try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), profile })); return true; }
  catch { return false; }
}

export function clearStudentDraft(key: string | null) {
  if (!key) return;
  try { sessionStorage.removeItem(key); } catch { /* Editing works without browser storage. */ }
}
