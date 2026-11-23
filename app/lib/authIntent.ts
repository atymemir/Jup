// Only known in-app actions are accepted; arbitrary redirect URLs are never followed.
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const patterns = [
  new RegExp(`^request/(?:${uuid})?$`, "i"),
  new RegExp(`^join/${uuid}$`, "i"),
  /^tab\/(tutors|groups|requests|account|teacher|messages)$/,
  new RegExp(`^tab/tutors/profile/${uuid}$`, "i"),
  new RegExp(`^tab/account/(lesson|chat|work)/${uuid}$`, "i"),
  /^tab\/account\/calendar$/,
  new RegExp(`^tab/messages/(new|thread)/${uuid}$`, "i"),
  /^tab\/teacher\/(overview|schedule|students|messages|requests|profile|wallet)$/,
  new RegExp(`^tab/teacher/slot/${uuid}$`, "i"),
];
export function parseAuthIntent(value: string | null | undefined) {
  return typeof value === "string" &&
    value.length < 160 &&
    patterns.some((pattern) => pattern.test(value))
    ? value.toLowerCase()
    : null;
}
export function storedSessionValue(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function forgetSessionValue(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* URL continuation also works without storage. */
  }
}
export function saveSessionValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Never block navigation on storage access. */
  }
}
export function currentAuthIntent(search: string) {
  const params = new URLSearchParams(search);
  return parseAuthIntent(
    params.has("continue")
      ? params.get("continue")
      : storedSessionValue("fb-intent"),
  );
}
export function consumeAuthIntent() {
  forgetSessionValue("fb-intent");
  const url = new URL(window.location.href);
  if (url.searchParams.has("continue")) {
    url.searchParams.delete("continue");
    window.history.replaceState(window.history.state, "", url);
  }
}
function contextParams(search: string, intent?: string | null) {
  const input = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "subject",
    "exam",
    "language",
    "city",
    "budget",
    "view",
    "sort",
    "available",
  ]) {
    const value = input.get(key);
    if (value) params.set(key, value.slice(0, 120));
  }
  const invite = input.get("invite");
  if (invite && /^[a-f0-9]{64}$/.test(invite)) params.set("invite", invite);
  const next = parseAuthIntent(intent);
  if (next) params.set("continue", next);
  return params;
}
export function authLoginHref(
  intent: string | null | undefined,
  search = "",
  teacher = false,
  signup = false,
) {
  const params = contextParams(search, intent);
  if (teacher) params.set("role", "teacher");
  if (signup) params.set("mode", "signup");
  return "/login" + (params.size ? "?" + params : "");
}
export function authDestination(
  role: string,
  intent: string | null | undefined,
  search = "",
) {
  const next = parseAuthIntent(intent);
  const teacher =
    next?.startsWith("tab/teacher") || (!next && role === "teacher");
  const params = contextParams(search, next);
  return (
    (teacher ? "/findbuddy/teacher" : "/findbuddy") +
    (params.size ? "?" + params : "") +
    (!teacher && !next ? "#account" : "")
  );
}
export function authEmailRedirect(
  origin: string,
  flow: "confirm" | "recovery",
  role: string,
  intent: string | null | undefined,
  search = "",
) {
  // Old algₐ links now use the same dedicated Jup Auth callback.
  const callbackOrigin = ["https://tryalga.app", "https://www.tryalga.app"].includes(origin)
    ? "https://jup-atymemirs-projects.vercel.app"
    : origin;
  const url = new URL("/findbuddy/login", callbackOrigin);
  url.searchParams.set("flow", flow);
  if (flow === "confirm")
    url.searchParams.set(
      "role",
      ["teacher", "business"].includes(role) ? role : "student",
    );
  for (const [key, value] of contextParams(search, intent))
    url.searchParams.set(key, value);
  return url.href;
}
