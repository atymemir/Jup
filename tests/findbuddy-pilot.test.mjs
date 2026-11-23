import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("free pilot preserves 5% quotes but charges zero for existing and new bookings, with server-owned terms", async () => {
  const db = new PGlite();
  const teacher = "22222222-2222-4222-8222-222222222222";
  const student = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role;`,
    );
    for (const file of (
      await readdir(new URL("../supabase/sql/", import.meta.url))
    )
      .filter(
        (file) => file.endsWith(".sql") && Number.parseInt(file, 10) < 109,
      )
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/sql/" + file, import.meta.url),
          "utf8",
        ),
      );
    for (const id of [teacher, student])
      await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      `insert into fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience,verification) values($1,'Test teacher','Geography practice','A teacher for isolated free pilot verification.','География','ЕНТ','Русский','Онлайн',5010,2,'verified')`,
      [teacher],
    );
    const group = (
      await db.query(
        `insert into fb_groups(tutor_id,title,description,price,capacity,starts_at) values($1,'Pilot lesson','Isolated lesson used for pilot terms.',5010,3,now()+interval '4 days') returning id`,
        [teacher],
      )
    ).rows[0].id;
    const old = (
      await db.query(
        `insert into fb_bookings(student_id,tutor_id,group_id,subject,price,starts_at) values($1,$2,$3,'География',5010,now()+interval '4 days') returning *`,
        [student, teacher, group],
      )
    ).rows[0];
    assert.equal(old.commission, 251);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/sql/109_findbuddy_free_pilot.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    async function as(user, role = "authenticated") {
      await db.exec(`reset role; set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user ?? "",
      ]);
    }
    await as(null, "anon");
    await assert.rejects(
      () => db.query("select fb_pilot_dashboard()"),
      /permission denied/,
    );
    await as(student);
    const dashboard = (await db.query("select fb_pilot_dashboard() v")).rows[0]
      .v;
    assert.equal(dashboard.free_pilot, true);
    const migrated = dashboard.bookings.find((b) => b.id === old.id);
    assert.equal(migrated.commission, 0);
    assert.equal(migrated.tutor_net, 5010);
    assert.equal(migrated.commission_policy, "pilot_free");
    assert.equal(migrated.model_commission, 251);
    assert.equal(migrated.model_tutor_net, 4759);
    assert.equal(migrated.status, old.status);
    assert.equal(migrated.price, old.price);
    await assert.rejects(
      () =>
        db.query(
          "update fb_bookings set commission_policy='standard_5_percent' where id=$1",
          [old.id],
        ),
      /permission denied/,
    );
    await as(teacher);
    const next = (
      await db.query("select fb_action('group',$1::jsonb) v", [
        JSON.stringify({
          title: "Another pilot lesson",
          description: "A new lesson after the pilot migration.",
          capacity: 1,
          price: 6000,
          starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
      ])
    ).rows[0].v.id;
    await as(student);
    const created = (
      await db.query("select fb_action('join',$1::jsonb) v", [
        JSON.stringify({
          id: next,
          commission: 5000,
          tutor_net: 1,
          commission_policy: "standard_5_percent",
        }),
      ])
    ).rows[0].v.id;
    const after = (
      await db.query("select fb_pilot_dashboard() v")
    ).rows[0].v.bookings.find((b) => b.id === created);
    assert.equal(after.commission_policy, "pilot_free");
    assert.equal(after.commission, 0);
    assert.equal(after.tutor_net, 6000);
    assert.equal(after.model_commission, 300);
    await db.exec("reset role");
    await assert.rejects(
      () =>
        db.query(
          "update fb_bookings set commission_policy='standard_5_percent' where id=$1",
          [old.id],
        ),
      /check constraint/,
    );
    assert.equal(
      (
        await db.query("select commission from fb_bookings where id=$1", [
          old.id,
        ])
      ).rows[0].commission,
      0,
    );
    const pilotMigration = await readFile(
      new URL("../supabase/sql/109_findbuddy_free_pilot.sql", import.meta.url),
      "utf8",
    );
    await db.exec(pilotMigration);
    await db.exec(
      "alter table auth.users add column email text,add column raw_user_meta_data jsonb default '{}',add column email_confirmed_at timestamptz default now();",
    );
    await db.exec(
      await readFile(
        new URL("../supabase/sql/110_findbuddy_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(pilotMigration);
    await as(teacher);
    const upgraded = (await db.query("select fb_pilot_dashboard() v")).rows[0]
      .v;
    assert.equal(upgraded.account.role, "teacher");
    assert.equal(upgraded.offerings.length, 1);
    const preserved = upgraded.bookings.find((b) => b.id === old.id);
    assert.equal(preserved.id, old.id);
    assert.equal(preserved.price, old.price);
    assert.equal(preserved.status, old.status);
    assert.equal(preserved.commission, 0);
    assert.equal(preserved.model_commission, 251);
  } finally {
    await db.close();
  }
});
