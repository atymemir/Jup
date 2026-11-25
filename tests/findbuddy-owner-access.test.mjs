import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

test("private owner configuration grants moderation only after email confirmation and preserves the original owner", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const co = "22222222-2222-4222-8222-222222222222";
  const pending = "33333333-3333-4333-8333-333333333333";
  const teacher = "44444444-4444-4444-8444-444444444444";
  const later = "55555555-5555-4555-8555-555555555555";
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;",
    );
    for (const file of (
      await readdir(new URL("../supabase/sql/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/sql/" + file, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, email, confirmed, type] of [
      [owner, "dpsg2e@gmail.com", true, "student"],
      [co, "Co-Owner@example.test", true, "student"],
      [pending, "pending@example.test", false, "student"],
      [teacher, "teacher@example.test", true, "teacher"],
    ])
      await db.query(
        "insert into auth.users values($1,$2,$3::jsonb,case when $4 then now() else null end)",
        [
          id,
          email,
          JSON.stringify({ account_type: type, display_name: "Test person" }),
          confirmed,
        ],
      );
    const role = async (id) =>
      (await db.query("select role from fb_accounts where id=$1", [id])).rows[0]
        .role;
    assert.equal(await role(owner), "owner");
    assert.equal(await role(co), "student");
    await db.exec(
      "insert into fb_owner_access values('co-owner@example.test'),('pending@example.test'),('later@example.test')",
    );
    assert.equal(await role(owner), "owner");
    assert.equal(await role(co), "owner");
    assert.equal(await role(pending), "student");
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [pending],
    );
    assert.equal(await role(pending), "owner");
    await db.query(
      "insert into auth.users values($1,'later@example.test','{}',now())",
      [later],
    );
    assert.equal(await role(later), "owner");
    await db.query(
      "insert into fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience,verification) values($1,'Teacher','Physics lessons','We study physics with practical examples.','Физика','ЕНТ','Русский','Онлайн',3000,3,'pending')",
      [teacher],
    );
    const as = async (id) => {
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    await as(co);
    assert.equal(
      (await db.query("select fb_viewer() data")).rows[0].data.account.role,
      "owner",
    );
    assert.ok(
      (
        await db.query("select fb_platform_dashboard() data")
      ).rows[0].data.teacher_queue.some((t) => t.id === teacher),
    );
    await db.query("select fb_platform_action('moderate',$1::jsonb)", [
      JSON.stringify({
        id: teacher,
        kind: "teacher",
        decision: "verified",
        revision: 0,
        reason: "Checked synthetic teacher details",
      }),
    ]);
    for (const sql of [
      "select * from fb_owner_access",
      "insert into fb_owner_access values('attacker@example.test')",
      "select fb_is_owner_identity(null)",
    ])
      await assert.rejects(() => db.exec(sql), /permission denied/);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query("select verification from fb_tutors where id=$1", [
          teacher,
        ])
      ).rows[0].verification,
      "verified",
    );
    await db.query(
      "update auth.users set email='changed@example.test' where id=$1",
      [co],
    );
    assert.equal(await role(co), "student");
    await db.query(
      "update auth.users set email='co-owner@example.test' where id=$1",
      [co],
    );
    assert.equal(await role(co), "owner");
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [co],
    );
    assert.equal(await role(co), "student");
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [co],
    );
    assert.equal(await role(co), "owner");
    await db.exec(
      "delete from fb_owner_access where email='co-owner@example.test'",
    );
    assert.equal(await role(co), "student");
    assert.equal(await role(owner), "owner");
    await assert.rejects(
      () =>
        db.query("update fb_accounts set role='owner' where id=$1", [teacher]),
      /Служебный доступ/,
    );
    assert.equal(
      (await db.query("select count(*)::int count from auth.users")).rows[0]
        .count,
      5,
    );
  } finally {
    await db.close();
  }
});
