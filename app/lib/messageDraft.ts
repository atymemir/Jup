export type MessageDraft = { body: string; clientId: string };

export function messageDraftKey(user: string, thread?: string, tutor?: string) {
  return thread ? `findbuddy-message:v1:${user}:thread:${thread}` : tutor ? `findbuddy-message:v1:${user}:new:${tutor}` : null;
}
export function readMessageDraft(key: string | null): MessageDraft | null {
  if (!key) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 86400000 ||
        typeof value.body !== "string" || value.body.length > 2000 || typeof value.clientId !== "string" ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.clientId)) return null;
    return { body: value.body, clientId: value.clientId };
  } catch { return null; }
}
export function writeMessageDraft(key: string | null, draft: MessageDraft) {
  if (!key) return false;
  try {
    if (!draft.body) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}
