import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { commissionSummary, outcomeState } from "../app/lib/outcomes.ts";

const teacher = "22222222-2222-4222-8222-222222222222";
const student = "11111111-1111-4111-8111-111111111111";
const peer = "33333333-3333-4333-8333-333333333333";
const stranger = "44444444-4444-4444-8444-444444444444";

test("lesson outcomes keep independent statements, reject early/stale/foreign changes and protect group privacy", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon,service_role;`);
    for (const file of (
      await readdir(new URL("../supabase/sql/", import.meta.url))
    )
      .filter(
        (name) => name.endsWith(".sql") && Number.parseInt(name, 10) < 108,
      )
      .sort()) {
      await db.exec(
        await readFile(
          new URL("../supabase/sql/" + file, import.meta.url),
          "utf8",
        ),
      );
    }
    for (const user of [teacher, student, peer, stranger])
      await db.query("insert into auth.users values($1)", [user]);
    await db.query(
      `insert into fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience,verification)
      values($1,'Teacher','Test teacher','A teacher used for isolated lesson tests.','География','ЕНТ','Русский','Онлайн',5000,3,'verified')`,
      [teacher],
    );
    const slot = (
      await db.query(
        `insert into fb_groups(tutor_id,title,description,price,capacity,starts_at)
      values($1,'Shared lesson','Shared group for private outcome testing.',5000,3,now()+interval '3 days') returning id`,
        [teacher],
      )
    ).rows[0].id;
    async function booking(
      learner,
      time,
      group = null,
      status = "awaiting_payment",
    ) {
      if (!group) {
        group = (
          await db.query(
            `insert into fb_groups(tutor_id,title,description,price,capacity,starts_at)
           values($1,'Test lesson','Isolated outcome validation lesson.',5000,1,${time}) returning id`,
            [teacher],
          )
        ).rows[0].id;
      }
      return (
        await db.query(
          `insert into fb_bookings(student_id,tutor_id,group_id,subject,price,starts_at,status)
        values($1,$2,$3,'География',5000,${time},$4) returning id`,
          [learner, teacher, group, status],
        )
      ).rows[0].id;
    }
    const first = await booking(student, "now()+interval '3 days'", slot);
    const second = await booking(peer, "now()+interval '3 days'", slot);
    const future = await booking(student, "now()+interval '7 days'");
    const cancelled = await booking(
      student,
      "now()-interval '5 days'",
      null,
      "cancelled",
    );
    await db.query(
      "update fb_groups set starts_at=now()-interval '2 hours' where id=$1",
      [slot],
    );
    await db.query(
      "update fb_bookings set starts_at=now()-interval '2 hours' where id=any($1::uuid[])",
      [[first, second]],
    );
    async function as(user, role = "authenticated") {
      await db.exec(`reset role; set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user ?? "",
      ]);
    }
    async function respond(id, response, revision = 0, note = "", extra = {}) {
      return (
        await db.query("select fb_lesson_outcome($1::jsonb) v", [
          JSON.stringify({ id, response, revision, note, ...extra }),
        ])
      ).rows[0].v;
    }
    async function dashboard() {
      return (await db.query("select fb_profile_dashboard() v")).rows[0].v;
    }
    await as(student);
    const beforeUpgrade = await dashboard();
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../supabase/sql/108_findbuddy_outcomes.sql", import.meta.url),
        "utf8",
      ),
    );
    await as(student);
    const { outcomes: initialOutcomes, ...afterUpgrade } = await dashboard();
    assert.deepEqual(initialOutcomes, []);
    assert.deepEqual(afterUpgrade, beforeUpgrade);
    await as(null, "anon");
    await assert.rejects(
      () => respond(first, "completed"),
      /permission denied/,
    );
    await as(stranger);
    await assert.rejects(
      () => respond(first, "completed"),
      /Занятие недоступно/,
    );
    assert.deepEqual((await dashboard()).outcomes, []);
    await as(student);
    await assert.rejects(
      () => db.query("select * from fb_lesson_outcomes"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select fb_profile_dashboard_before_outcomes()"),
      /permission denied/,
    );
    await assert.rejects(() => respond(future, "completed"), /после окончания/);
    await assert.rejects(() => respond(cancelled, "completed"), /недоступно/);
    await assert.rejects(() => respond(first, "paid"), /Выберите результат/);
    await assert.rejects(
      () => respond(first, "problem", 0, "short"),
      /Опишите проблему/,
    );
    const learner = await respond(first, "completed", 0, "", {
      teacher_response: "completed",
      teacher_revision: 99,
    });
    assert.equal(learner.teacher_response, "pending");
    assert.equal(learner.student_response, "completed");
    assert.equal(outcomeState(learner), "pending");
    const repeated = await respond(first, "completed", 0);
    assert.equal(repeated.student_revision, 1);
    await assert.rejects(
      () => respond(first, "problem", 0, "The teacher did not join."),
      /другой вкладке/,
    );
    await as(teacher);
    const confirmed = await respond(first, "completed", 0);
    assert.equal(outcomeState(confirmed), "confirmed");
    const issue = await respond(
      first,
      "problem",
      1,
      "We need to discuss the lesson timing.",
    );
    assert.equal(outcomeState(issue), "problem");
    assert.equal(issue.student_response, "completed");
    await as(peer);
    assert.equal(
      (await dashboard()).outcomes.some((o) => o.booking_id === first),
      false,
    );
    await assert.rejects(() => respond(first, "completed"), /недоступно/);
    await as(student);
    assert.equal(
      (await dashboard()).outcomes[0].teacher_note,
      "We need to discuss the lesson timing.",
    );
    await assert.rejects(
      () =>
        db.query("select fb_action('cancel',$1::jsonb)", [
          JSON.stringify({ id: first }),
        ]),
      /Начавшееся занятие нельзя отменить/,
    );
    await as(teacher);
    const resolved = await respond(first, "completed", 2);
    assert.equal(outcomeState(resolved), "confirmed");
    assert.equal(resolved.teacher_note, "");
    const catalog = (await db.query("select fb_market_catalog() v")).rows[0].v;
    assert.equal(JSON.stringify(catalog).includes("teacher_response"), false);
    assert.equal((await dashboard()).outcomes.length, 1);
    await db.exec("reset role");
    const raw = (
      await db.query("select status,commission from fb_bookings where id=$1", [
        first,
      ])
    ).rows[0];
    assert.equal(raw.status, "awaiting_payment");
    assert.equal(raw.commission, 250);
  } finally {
    await db.close();
  }
});

test("5% summary excludes cancelled, future, disputed and one-sided lessons without claiming payment", () => {
  const now = Date.parse("2027-01-10T00:00:00Z");
  const base = {
    tutor_id: teacher,
    student_id: student,
    status: "awaiting_payment",
    starts_at: "2027-01-01T00:00:00Z",
    price: 5000,
    commission: 250,
    tutor_net: 4750,
  };
  const records = [
    { ...base, id: "confirmed" },
    { ...base, id: "pending" },
    { ...base, id: "disputed" },
    { ...base, id: "cancelled", status: "cancelled" },
    { ...base, id: "future", starts_at: "2027-01-20T00:00:00Z" },
    { ...base, id: "someone-else", tutor_id: stranger },
  ];
  const outcomes = [
    "confirmed",
    "pending",
    "disputed",
    "cancelled",
    "future",
  ].map((id) => ({
    booking_id: id,
    student_response: "completed",
    teacher_response:
      id === "pending"
        ? "pending"
        : id === "disputed"
          ? "problem"
          : "completed",
  }));
  const result = commissionSummary(records, outcomes, teacher, now);
  assert.equal(result.rows.length, 3);
  assert.equal(result.confirmed, 1);
  assert.equal(result.pending, 1);
  assert.equal(result.problems, 1);
  assert.equal(result.gross, 5000);
  assert.equal(result.commission, 250);
  assert.equal("paid" in result, false);
});
