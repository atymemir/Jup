import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("signup initializes private learning data and only a verified owner can moderate", async () => {
  const db = new PGlite();
  const person = "11111111-1111-4111-8111-111111111111";
  const owner = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;");
    const files = (await readdir(new URL("../supabase/sql/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort();
    // Existing staff lose their privilege when the new policy is applied.
    for (const file of files.filter((f) => f < "111")) await db.exec(await readFile(new URL("../supabase/sql/" + file, import.meta.url), "utf8"));
    await db.query("insert into auth.users(id,email) values($1,'former-owner@example.test')", [stranger]);
    await db.query("update fb_accounts set role='owner' where id=$1", [stranger]);
    await db.exec(await readFile(new URL("../supabase/sql/111_findbuddy_account_setup.sql", import.meta.url), "utf8"));
    assert.equal((await db.query("select role from fb_accounts where id=$1", [stranger])).rows[0].role, "student");
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'student@example.test',$2::jsonb)", [person, JSON.stringify({ display_name: "Аружан", account_type: "owner", birth_date: "2007-06-15" })]);
    assert.equal((await db.query("select role from fb_accounts where id=$1", [person])).rows[0].role, "student");
    assert.equal((await db.query("select name from fb_student_profiles where user_id=$1", [person])).rows[0].name, "Аружан");
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'DPSG2E@gmail.com','{}')", [owner]);
    assert.equal((await db.query("select role from fb_accounts where id=$1", [owner])).rows[0].role, "student");
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [owner]);
    assert.equal((await db.query("select role from fb_accounts where id=$1", [owner])).rows[0].role, "owner");
    await assert.rejects(() => db.query("update fb_accounts set role='moderator' where id=$1", [stranger]), /Служебный доступ/);
    const as = async (id) => { await db.exec("reset role;set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); };
    await as(person);
    assert.equal((await db.query("select birth_date::text birth from fb_account_details")).rows[0].birth, "2007-06-15");
    await db.query("select fb_platform_action('student_profile',$1::jsonb)", [JSON.stringify({ name: "Аружан", goal: "Подготовиться к экзамену", stage: "school", study_year: "11", languages: ["Русский"], format: "online", budget_max: 0 })]);
    assert.equal((await db.query("select fb_platform_dashboard() result")).rows[0].result.student_profile.goal, "Подготовиться к экзамену");
    assert.equal((await db.query("select fb_platform_dashboard() result")).rows[0].result.student_profile.budget_max, 0);
    await assert.rejects(() => db.query("select fb_platform_action('student_profile',$1::jsonb)", [JSON.stringify({ name: "Аружан", goal: "Подготовиться", stage: "adult", budget_max: -500 })]), /бюджет/);
    await assert.rejects(() => db.query("select fb_platform_action_before_account_setup('invite_moderator','{}')"), /permission denied/);
    await as(owner);
    assert.deepEqual((await db.query("select * from fb_account_details")).rows, []);
    await assert.rejects(() => db.query("select fb_platform_action('invite_moderator','{}')"), /только владелец/);
    await db.exec("reset role");
    await db.query("update auth.users set email='changed@example.test' where id=$1", [owner]);
    await as(owner);
    assert.equal((await db.query("select fb_viewer() result")).rows[0].result.account.role, "student");
  } finally { await db.close(); }
});
