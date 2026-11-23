// Search criteria belong to the URL so a reload or shared link keeps the selection.
export const initialFilters = {
  query: "",
  subject: "",
  exam: "",
  language: "",
  city: "",
  maxPrice: 100000,
};
export type CatalogFilters = typeof initialFilters;
type Choices = Record<
  "subject" | "exam" | "language" | "city",
  readonly string[]
>;
export type CatalogSearch = {
  filters: CatalogFilters;
  view: "list" | "focus" | "saved";
  sortBy: "price" | "time";
  onlyAvailable: boolean;
};
const eventName = "findbuddy-catalog-search";
export function readCatalogSearch(
  search: string,
  choices?: Choices,
): CatalogSearch {
  const params = new URLSearchParams(search);
  const filters = {
    ...initialFilters,
    query: (params.get("q") || "").slice(0, 120),
  };
  for (const key of ["subject", "exam", "language", "city"] as const) {
    const value = (params.get(key) || "").slice(0, 120);
    filters[key] = !choices || choices[key].includes(value) ? value : "";
  }
  const budget = Number(params.get("budget"));
  if (
    params.get("budget") !== null &&
    params.get("budget") !== "" &&
    Number.isInteger(budget) &&
    (budget === 0 || (budget >= 500 && budget <= 100000))
  )
    filters.maxPrice = budget;
  const view = params.get("view");
  return {
    filters,
    view: view === "saved" || view === "focus" ? view : "list",
    sortBy: params.get("sort") === "time" ? "time" : "price",
    onlyAvailable: params.get("available") === "1",
  };
}
export function catalogSearchParams(
  search: string,
  next: Partial<CatalogSearch>,
) {
  const params = new URLSearchParams(search);
  function put(key: string, value: string) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  if (next.filters) {
    put("q", next.filters.query);
    for (const key of ["subject", "exam", "language", "city"] as const)
      put(key, next.filters[key]);
    put(
      "budget",
      next.filters.maxPrice === initialFilters.maxPrice
        ? ""
        : String(next.filters.maxPrice),
    );
  }
  if (next.view !== undefined)
    put("view", next.view === "list" ? "" : next.view);
  if (next.sortBy !== undefined)
    put("sort", next.sortBy === "price" ? "" : next.sortBy);
  if (next.onlyAvailable !== undefined)
    put("available", next.onlyAvailable ? "1" : "");
  return params.toString();
}
export function updateCatalogSearch(next: Partial<CatalogSearch>) {
  const url = new URL(window.location.href);
  url.search = catalogSearchParams(url.search, next);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(eventName));
}
export function setCatalogFilters(
  next: CatalogFilters | ((filters: CatalogFilters) => CatalogFilters),
) {
  updateCatalogSearch({
    filters:
      typeof next === "function"
        ? next(readCatalogSearch(window.location.search).filters)
        : next,
  });
}
export const catalogSnapshot = () => window.location.search;
export function watchCatalogSearch(update: () => void) {
  window.addEventListener("popstate", update);
  window.addEventListener(eventName, update);
  return () => {
    window.removeEventListener("popstate", update);
    window.removeEventListener(eventName, update);
  };
}
