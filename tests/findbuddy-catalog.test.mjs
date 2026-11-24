import test from "node:test";
import assert from "node:assert/strict";
import {
  initialFilters,
  readCatalogSearch,
  catalogSearchParams,
} from "../app/lib/catalogSearch.ts";
import {
  filterTutors,
  DEMO_CATALOG,
  FB_SUBJECTS,
  FB_EXAMS,
  FB_LANGUAGES,
  FB_CITIES,
} from "../app/lib/findbuddy.ts";
const choices = {
  subject: FB_SUBJECTS,
  exam: FB_EXAMS,
  language: FB_LANGUAGES,
  city: FB_CITIES,
};

test("shared catalog searches retain all criteria, view and unrelated URL parameters", () => {
  const next = {
    filters: {
      ...initialFilters,
      query: "SAT Math",
      subject: "Математика",
      exam: "SAT",
      language: "Русский",
      city: "Онлайн",
      maxPrice: 7000,
    },
    view: "saved",
    sortBy: "time",
    onlyAvailable: true,
  };
  const encoded = catalogSearchParams("ref=friend", next);
  assert.deepEqual(readCatalogSearch(encoded, choices), next);
  assert.equal(new URLSearchParams(encoded).get("ref"), "friend");
  const reset = catalogSearchParams(encoded, {
    filters: initialFilters,
    onlyAvailable: false,
    view: "list",
    sortBy: "price",
  });
  assert.equal(reset, "ref=friend");
});

test("malformed shared searches cannot install invalid budgets or filter options", () => {
  for (const budget of ["NaN", "-1", "499", "100001", "2000.5"]) {
    const parsed = readCatalogSearch(
      `budget=${budget}&subject=unknown&view=unknown&sort=unknown`,
      choices,
    );
    assert.deepEqual(parsed.filters, initialFilters);
    assert.equal(parsed.view, "list");
    assert.equal(parsed.sortBy, "price");
  }
});

test("search finds a tutor from words in any order and education, with ё/е equivalence", () => {
  assert.equal(
    filterTutors(DEMO_CATALOG.tutors, {
      ...initialFilters,
      query: "SAT математика",
    })[0]?.id,
    "demo-sat",
  );
  const tutor = {
    ...DEMO_CATALOG.tutors[0],
    education: "Университет",
    bio: "Разберём сложные задания",
  };
  assert.equal(
    filterTutors([tutor], { ...initialFilters, query: "университет разберем" })
      .length,
    1,
  );
  assert.equal(
    filterTutors([tutor], { ...initialFilters, query: "несуществующая тема" })
      .length,
    0,
  );
});

test("multi-direction filters match one actual offer and retain a free-only shared budget", () => {
  const tutor = {
    ...DEMO_CATALOG.tutors[0],
    offerings: [
      {
        id: "paid",
        subject: "География",
        exam: "ЕНТ",
        languages: ["Русский"],
        format: "in_person",
        city: "Алматы",
        price: 5000,
        title: "География ЕНТ",
        description: "Подготовка",
        active: true,
      },
      {
        id: "free",
        subject: "Математика",
        exam: "SAT",
        languages: ["English"],
        format: "online",
        city: "",
        price: 0,
        title: "SAT Math",
        description: "Вводный урок",
        active: true,
      },
    ],
  };
  const filters = {
    ...initialFilters,
    subject: "Математика",
    exam: "SAT",
    language: "English",
    city: "Онлайн",
    maxPrice: 0,
  };
  assert.equal(filterTutors([tutor], filters).length, 1);
  for (const mismatch of [
    { subject: "География" },
    { language: "Русский" },
    { city: "Алматы" },
  ])
    assert.equal(filterTutors([tutor], { ...filters, ...mismatch }).length, 0);
  const encoded = catalogSearchParams("", {
    filters,
    view: "list",
    sortBy: "price",
    onlyAvailable: false,
  });
  assert.equal(readCatalogSearch(encoded, choices).filters.maxPrice, 0);
  assert.equal(
    readCatalogSearch("", choices).filters.maxPrice,
    initialFilters.maxPrice,
  );
});

test("catalogue search accepts English and Kazakh subject, exam and language terms", () => {
  for (const query of ["SAT mathematics", "SAT math", "SAT орысша"])
    assert.equal(
      filterTutors(DEMO_CATALOG.tutors, { ...initialFilters, query })[0]?.id,
      "demo-sat",
    );
  for (const query of ["geography UNT", "география ҰБТ", "geography kazakh"])
    assert.equal(
      filterTutors(DEMO_CATALOG.tutors, { ...initialFilters, query })[0]?.id,
      "demo-geo",
    );
  for (const query of ["English IELTS", "ағылшын IELTS"])
    assert.equal(
      filterTutors(DEMO_CATALOG.tutors, { ...initialFilters, query })[0]?.id,
      "demo-ielts",
    );
});
