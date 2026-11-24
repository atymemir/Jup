const uuid = "[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}";
/** @param {unknown} value */
export function miniAppScreen(value) {
  if (typeof value !== "string") return "home";
  if (
    [
      "home",
      "catalog",
      "lessons",
      "schedule",
      "messages",
      "requests",
      "profile",
    ].includes(value)
  )
    return value;
  return new RegExp(`^(?:lesson|chat|work|thread|tutor)_${uuid}$`, "i").test(
    value,
  )
    ? value.toLowerCase()
    : "home";
}
/** @param {string} suffix */
export function screenFromSuffix(suffix = "") {
  if (!suffix || suffix === "/") return "catalog";
  if (suffix === "#account/calendar") return "schedule";
  if (suffix === "#account") return "lessons";
  if (suffix === "#messages") return "messages";
  if (suffix === "#requests") return "requests";
  for (const [prefix, screen] of [
    ["#account/lesson/", "lesson"],
    ["#account/chat/", "chat"],
    ["#account/work/", "work"],
    ["#messages/thread/", "thread"],
    ["#tutors/profile/", "tutor"],
  ])
    if (suffix.startsWith(prefix))
      return miniAppScreen(screen + "_" + suffix.slice(prefix.length));
  return "home";
}
/** @param {string} role @param {unknown} screen */
export function miniAppDestination(role, screen) {
  const home =
    role === "teacher"
      ? "/teacher"
      : role === "business"
        ? "/business"
        : ["owner", "moderator"].includes(role)
          ? "/admin"
          : "/student";
  const target = miniAppScreen(screen);
  if (target === "catalog") return "/";
  if (target.startsWith("tutor_")) return "/#tutors/profile/" + target.slice(6);
  if (target === "home") return home;
  if (
    target.startsWith("lesson_") ||
    target.startsWith("chat_") ||
    target.startsWith("work_")
  ) {
    if (!["teacher", "student"].includes(role)) return home;
    return (
      home +
      "#account/" +
      target.slice(0, target.indexOf("_")) +
      "/" +
      target.slice(target.indexOf("_") + 1)
    );
  }
  if (target.startsWith("thread_"))
    return ["teacher", "student"].includes(role)
      ? home + "#messages/thread/" + target.slice(7)
      : home + "#messages";
  if (target === "schedule")
    return (
      home +
      (role === "student"
        ? "#account/calendar"
        : ["teacher", "business"].includes(role)
          ? "#schedule"
          : "")
    );
  if (target === "lessons")
    return (
      home +
      (role === "student"
        ? "#account"
        : role === "teacher"
          ? "#schedule"
          : role === "business"
            ? "#schedule"
            : "")
    );
  if (target === "profile")
    return (
      home +
      (role === "business"
        ? "#page"
        : ["teacher", "student"].includes(role)
          ? "#profile"
          : "")
    );
  if (target === "requests" && !["student", "teacher"].includes(role))
    return home;
  return home + "#" + target;
}
/** @param {string} pathname @param {string} hash */
export function miniAppBackTarget(pathname, hash) {
  const path = pathname.replace(/^\/findbuddy(?=\/|$)/, "") || "/";
  if (!["/", "/teacher", "/student", "/business", "/admin"].includes(path))
    return "/telegram";
  const lesson = hash.match(
    new RegExp(`^#account/(?:chat|work)/(${uuid})$`, "i"),
  );
  if (lesson) return path + "#account/lesson/" + lesson[1];
  if (hash.startsWith("#messages/")) return path + "#messages";
  if (hash.startsWith("#tutors/")) return path + "#tutors";
  if (
    ["/teacher", "/student", "/business", "/admin"].includes(path) &&
    hash &&
    !["#overview", "#account", "#queue"].includes(hash)
  )
    return path;
  return "/telegram";
}
/** @param {string} base @param {unknown} screen */
export function telegramMiniAppUrl(base, screen = "home") {
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Mini App requires an HTTPS public URL.");
  url.pathname = url.pathname.replace(/\/$/, "") + "/telegram";
  url.searchParams.set("screen", miniAppScreen(screen));
  return url.toString();
}
/** @param {string} base @param {string} target */
export function telegramAppLink(base, target) {
  const root = base.replace(/\/$/, "");
  if (
    target !== root &&
    !target.startsWith(root + "#") &&
    !target.startsWith(root + "/")
  )
    return null;
  try {
    return telegramMiniAppUrl(
      root,
      screenFromSuffix(target.slice(root.length)),
    );
  } catch {
    return null;
  }
}
