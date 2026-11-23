import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { hostedAccountsConfigured, localAccountsAllowed } from "../app/server/accountStorage.ts";

test("local accounts work on loopback, including the main app proxy", () => {
  const env = { FINDBUDDY_PREVIEW: "1" };
  for (const host of ["localhost:3100", "127.0.0.1:3100", "[::1]:3100"]) {
    assert.equal(localAccountsAllowed(new Request(`http://${host}/findbuddy/api/preview`), env), true);
  }
  assert.equal(localAccountsAllowed(new Request("http://localhost:3100/findbuddy/api/preview", {
    headers: { host: "localhost:3100", "x-forwarded-host": "localhost:3000" },
  }), env), true);
});

test("serverless and public requests can never create temporary accounts", () => {
  const request = new Request("http://localhost:3100/findbuddy/api/preview");
  assert.equal(localAccountsAllowed(request, { FINDBUDDY_PREVIEW: "1", VERCEL: "1" }), false);
  assert.equal(localAccountsAllowed(new Request("https://tryalga.app/findbuddy/api/preview"), { FINDBUDDY_PREVIEW: "1" }), false);
  assert.equal(localAccountsAllowed(new Request(request, {
    headers: { "x-forwarded-host": "tryalga.app" },
  }), { FINDBUDDY_PREVIEW: "1" }), false);
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }]) {
    assert.equal(localAccountsAllowed(request, { FINDBUDDY_PREVIEW: "1", ...env, ...(Object.keys(env).length ? {} : { FINDBUDDY_PREVIEW: "0" }) }), false);
    assert.equal(hostedAccountsConfigured(env), false);
  }
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" };
  assert.equal(hostedAccountsConfigured(env), true);
  assert.equal(localAccountsAllowed(request, { FINDBUDDY_PREVIEW: "1", ...env }), false);
});

test("Vercel refuses a build without permanent account storage", () => {
  const run = (extra) => spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./next.config.mjs')"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, VERCEL: "1", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ...extra },
    encoding: "utf8",
  });
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }]) {
    const result = run(env);
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Local preview accounts cannot persist/);
  }
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }).status, 0);
});
