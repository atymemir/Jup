import test from "node:test";
import assert from "node:assert/strict";
import { fetchJson } from "../app/lib/http.ts";

test("API errors remain readable when a hosting proxy returns HTML or an empty body", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>Unavailable</html>", { status: 502 }),
  );
  await assert.rejects(fetchJson("/test"), /Сервис временно недоступен/);
});
test("API preserves actionable server validation and sign-in messages", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Мест нет" }, { status: 409 }),
  );
  await assert.rejects(fetchJson("/test"), /Мест нет/);
});
test("failed booking requests are never automatically retried", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network error");
  });
  await assert.rejects(
    fetchJson("/test", { method: "POST" }),
    /Проверьте результат в кабинете/,
  );
  assert.equal(mock.mock.callCount(), 1);
});
test("GET requests have a finite timeout and retain request headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, "Bearer test");
    return Response.json({ tutors: [] });
  });
  assert.deepEqual(
    await fetchJson("/test", { headers: { Authorization: "Bearer test" } }),
    { tutors: [] },
  );
});
