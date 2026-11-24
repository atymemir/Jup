/** @param {{verification?: string; status?: string; display_name?: string; name?: string; headline?: string; city?: string}[]} profiles
 * @param {string} status @param {string} query
 */
export function filterModeration(profiles, status, query = "") {
  const needle = query.trim().toLocaleLowerCase();
  return profiles.filter(
    (profile) =>
      (status === "all" ||
        (profile.verification ?? profile.status ?? "draft") === status) &&
      (!needle ||
        [profile.display_name, profile.name, profile.headline, profile.city]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle)),
  );
}
