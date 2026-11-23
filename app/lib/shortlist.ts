// Only public profile IDs are stored. useSyncExternalStore needs a stable primitive snapshot.
const key = "findbuddy.saved-tutors.v1";
export function shortlistSnapshot() {
  try {
    return localStorage.getItem(key) || "[]";
  } catch {
    return "[]";
  }
}
export function shortlistIds(snapshot: string): string[] {
  try {
    const value: unknown = JSON.parse(snapshot);
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
export function watchShortlist(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(key, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(key, callback);
  };
}
export function toggleShortlist(id: string) {
  const ids = shortlistIds(shortlistSnapshot());
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
      ),
    );
    window.dispatchEvent(new Event(key));
    return true;
  } catch {
    return false;
  }
}
