// Optional, isolated real Postgres engine: see docs/findbuddy.md. No production connection.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modulePath = "@electric-sql/pglite";
test(
  "findbuddy database: authorization, matching, capacity, cancellation, chat and commission",
  { skip: !modulePath },
  async () => {
    const { PGlite } = await import(modulePath);
    const db = new PGlite();
    const student = "11111111-1111-4111-8111-111111111111";
    const teacher = "22222222-2222-4222-8222-222222222222";
    const stranger = "33333333-3333-4333-8333-333333333333";
    const fourth = "44444444-4444-4444-8444-444444444444";
    try {
      await db.exec(
        `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated,service_role; insert into auth.users values ('${student}'),('${teacher}'),('${stranger}'),('${fourth}');`,
      );
      await db.exec(
        await readFile(
          new URL("../supabase/sql/101_findbuddy.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL(
            "../supabase/sql/102_findbuddy_schedule.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL("../supabase/sql/103_findbuddy_lessons.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL(
            "../supabase/sql/104_findbuddy_profiles.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL("../supabase/sql/105_findbuddy_inbox.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL("../supabase/sql/106_findbuddy_reviews.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.exec(
        await readFile(
          new URL(
            "../supabase/sql/107_findbuddy_telegram.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      async function inbox(action, data = {}) {
        return (
          await db.query("select fb_inbox($1,$2::jsonb) v", [
            action,
            JSON.stringify(data),
          ])
        ).rows[0].v;
      }
      async function classroom(action, data = {}) {
        return (
          await db.query("select fb_lesson_action($1,$2::jsonb) as value", [
            action,
            JSON.stringify(data),
          ])
        ).rows[0].value;
      }
      async function lessons() {
        return (await db.query("select fb_lesson_dashboard() as value")).rows[0]
          .value;
      }
      async function as(id, role = "authenticated") {
        await db.exec(
          `reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ""}',false);`,
        );
      }
      async function rpc(action, data = {}) {
        return (
          await db.query("select public.fb_action($1,$2::jsonb) as value", [
            action,
            JSON.stringify(data),
          ])
        ).rows[0].value;
      }
      async function dashboard() {
        return (await db.query("select public.fb_dashboard() as value")).rows[0]
          .value;
      }
      async function catalog() {
        return (await db.query("select public.fb_catalog() as value")).rows[0]
          .value;
      }
      await as(null, "anon");
      assert.equal((await catalog()).tutors.length, 0);
      await assert.rejects(() => rpc("request"));
      await as(teacher);
      const profile = {
        display_name: "Test teacher",
        headline: "Geography tutor",
        bio: "Clear explanation and immediate feedback.",
        subject: "География",
        exam: "ЕНТ",
        language: "Русский",
        city: "Онлайн",
        price: 5010,
        experience: 2,
        adult_consent: true,
        verification: "verified",
      };
      await rpc("apply", profile);
      assert.equal((await dashboard()).tutor.verification, "pending");
      assert.equal((await catalog()).tutors.length, 0);
      await assert.rejects(() =>
        db.query(
          "update public.fb_tutors set verification='verified' where id=$1",
          [teacher],
        ),
      );
      await assert.rejects(() => rpc("group", {}));
      await db.exec("reset role");
      await db.query(
        "update public.fb_tutors set verification='verified' where id=$1",
        [teacher],
      );
      await as(student);
      assert.equal((await catalog()).tutors.length, 1);
      const photoFixture = Buffer.concat([
        Buffer.from("ffd8ff", "hex"),
        Buffer.alloc(96),
      ]).toString("base64");
      const saveProfile = async (data) =>
        (
          await db.query("select fb_save_profile($1::jsonb) v", [
            JSON.stringify(data),
          ])
        ).rows[0].v;
      const readPhoto = async (id, version) =>
        (await db.query("select fb_photo($1,$2) v", [id, version])).rows[0].v;
      await as(stranger);
      await assert.rejects(() =>
        saveProfile({ ...profile, mode: "create", photo: "invalid" }),
      );
      assert.equal((await dashboard()).tutor, null);
      await saveProfile({
        ...profile,
        mode: "create",
        photo: photoFixture,
        education: "Local university",
        lesson_plan: "Assess the student's level.",
      });
      const pending = (await dashboard()).tutor;
      assert.equal(pending.verification, "pending");
      assert.equal(await readPhoto(stranger, pending.photo_version), null);
      assert.match(
        (await db.query("select fb_profile_dashboard() v")).rows[0].v
          .private_photo,
        /^\/9j\//,
      );
      await as(student);
      assert.equal(
        (await db.query("select fb_profile_dashboard() v")).rows[0].v
          .private_photo,
        null,
      );
      assert.equal(await readPhoto(stranger, pending.photo_version), null);
      await as(teacher);
      await assert.rejects(() =>
        saveProfile({
          ...profile,
          mode: "edit",
          display_name: "Another tutor",
          photo: photoFixture,
        }),
      );
      await saveProfile({ ...profile, mode: "edit", photo: photoFixture });
      const verified = (await dashboard()).tutor;
      assert.equal(
        (await readPhoto(teacher, verified.photo_version)) !== null,
        true,
      );
      await saveProfile({ ...profile, mode: "edit", photo: "" });
      assert.equal(await readPhoto(teacher, verified.photo_version), null);
      await as(student);
      const messageKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await assert.rejects(() =>
        inbox("send", {
          tutor_id: stranger,
          body: "Pending tutor",
          client_id: messageKey,
        }),
      );
      const dm = await inbox("send", {
        tutor_id: teacher,
        body: "Can I join your lessons?",
        client_id: messageKey,
      });
      assert.equal(dm.new_message, true);
      assert.equal(
        (
          await inbox("send", {
            tutor_id: teacher,
            body: "Can I join your lessons?",
            client_id: messageKey,
          })
        ).message_id,
        dm.message_id,
      );
      assert.equal((await inbox("read", { id: dm.id })).messages.length, 1);
      await as(fourth);
      assert.equal((await inbox("list")).threads.length, 0);
      await assert.rejects(() => inbox("read", { id: dm.id }));
      await assert.rejects(() =>
        inbox("seen", { id: dm.id, message_id: dm.message_id }),
      );
      await assert.rejects(() => db.query("select * from fb_direct_messages"));
      await as(teacher);
      assert.equal((await inbox("list")).unread, 1);
      assert.equal(
        (await inbox("read", { id: dm.id })).messages[0].body,
        "Can I join your lessons?",
      );
      await inbox("seen", { id: dm.id, message_id: dm.message_id });
      assert.equal((await inbox("list")).unread, 0);
      const reply = await inbox("send", {
        id: dm.id,
        body: "Yes, let's discuss the schedule.",
        client_id: messageKey,
      });
      await inbox("block", { id: dm.id, value: true });
      await as(student);
      assert.equal((await inbox("list")).unread, 1);
      assert.equal(
        (await inbox("read", { id: dm.id, before: reply.message_id })).messages
          .length,
        1,
      );
      await assert.rejects(() =>
        inbox("send", {
          id: dm.id,
          body: "Blocked",
          client_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      );
      await inbox("block", { id: dm.id, value: false });
      assert.equal((await inbox("read", { id: dm.id })).blocked, true);
      await as(teacher);
      await inbox("block", { id: dm.id, value: false });
      assert.equal((await inbox("read", { id: dm.id })).blocked, false);
      await as(student);
      const request = await rpc("request", {
        subject: "География",
        exam: "ЕНТ",
        language: "Русский",
        city: "Онлайн",
        budget: 5010,
        goal: "Help me understand climate and maps.",
      });
      await as(teacher);
      const offer = await rpc("offer", {
        request_id: request.id,
        price: 5010,
        starts_at: "2099-06-01T13:00:00Z",
        note: "We will cover climate with targeted retrieval practice.",
      });
      await as(stranger);
      await assert.rejects(() => rpc("accept", { id: offer.id }));
      assert.equal((await dashboard()).requests.length, 0);
      await as(student);
      const booking = await rpc("accept", {
        id: offer.id,
        price: 500,
        status: "paid",
        commission: 0,
      });
      let state = await dashboard();
      assert.equal(state.bookings[0].price, 5010);
      assert.equal(state.bookings[0].commission, 251);
      assert.equal(state.bookings[0].tutor_net, 4759);
      assert.equal(state.bookings[0].status, "awaiting_payment");
      await assert.rejects(() => rpc("accept", { id: offer.id }));
      await rpc("message", {
        booking_id: booking.id,
        body: "Can we focus on climate?",
      });
      await as(stranger);
      assert.equal((await dashboard()).bookings.length, 0);
      assert.equal((await dashboard()).messages.length, 0);
      await assert.rejects(() =>
        rpc("message", { booking_id: booking.id, body: "Unauthorized" }),
      );
      await assert.rejects(() => rpc("cancel", { id: booking.id }));
      await as(teacher);
      assert.equal((await dashboard()).messages.length, 1);
      const group = await rpc("group", {
        title: "Geography climate",
        description: "One hour of practice with immediate feedback.",
        starts_at: "2099-06-02T13:00:00Z",
        price: 1500,
        capacity: 2,
      });
      await assert.rejects(() => rpc("join", { id: group.id })); // no self-bookings
      await as(student);
      const seat = await rpc("join", { id: group.id });
      await assert.rejects(() => rpc("join", { id: group.id }));
      await as(stranger);
      await rpc("join", { id: group.id });
      await as(fourth);
      await assert.rejects(() => rpc("join", { id: group.id })); // capacity enforced by DB
      await as(teacher);
      await classroom("save_room", {
        slot_id: group.id,
        revision: 0,
        plan: "Group plan",
        homework: "Explain a climate zone",
        meeting: "https://meet.example.org/geo",
      });
      await assert.rejects(() =>
        classroom("save_room", {
          slot_id: group.id,
          revision: 0,
          plan: "Outdated draft",
        }),
      );
      await as(student);
      await classroom("student_name", { name: "Student A" });
      await assert.rejects(() =>
        classroom("save_room", {
          id: seat.id,
          revision: 1,
          plan: "Unauthorised",
        }),
      );
      await assert.rejects(() =>
        classroom("save_room", { slot_id: group.id, revision: 1 }),
      );
      await classroom("send_work", {
        id: seat.id,
        revision: 0,
        task_version: 1,
        answer: "My private answer",
      });
      await as(teacher);
      assert.equal(
        (await lessons()).seats.find((s) => s.id === seat.id).name,
        "Student A",
      );
      await classroom("review_work", {
        id: seat.id,
        revision: 1,
        task_version: 1,
        feedback: "Good analysis",
      });
      await as(stranger);
      assert.equal((await lessons()).rooms[0].plan, "Group plan");
      assert.equal(
        (await lessons()).seats.some((s) => s.id === seat.id),
        false,
      );
      await as(fourth);
      assert.equal((await lessons()).rooms.length, 0);
      await assert.rejects(() => classroom("video_access", { id: seat.id }));
      await as(student);
      assert.equal(
        (await lessons()).seats.find((s) => s.id === seat.id).work.feedback,
        "Good analysis",
      );
      await assert.rejects(() => classroom("video_access", { id: seat.id }));
      await assert.rejects(() =>
        classroom("propose_move", {
          id: seat.id,
          starts_at: "2099-07-01T13:00:00Z",
        }),
      );
      await as(student);
      await rpc("cancel", { id: seat.id });
      assert.equal((await lessons()).rooms.length, 0);
      assert.equal((await catalog()).groups[0].reserved, 1);
      await as(fourth);
      await rpc("join", { id: group.id });
      assert.equal((await catalog()).groups[0].reserved, 2);
      await as(teacher);
      await assert.rejects(() =>
        rpc("group", {
          title: "Overlapping group",
          description: "Cannot overlap with an individual lesson.",
          starts_at: "2099-06-01T13:30:00Z",
          price: 1500,
          capacity: 2,
        }),
      );
      const lesson = await rpc("group", {
        title: "Individual geography",
        description: "Working with climate maps for the ENT exam.",
        price: 4200,
        capacity: 1,
        starts_at: "2099-06-08T12:00:00Z",
      });
      await db.query("select fb_update_terms($1::jsonb)", [
        JSON.stringify({
          headline: "Updated geography tutor",
          bio: profile.bio,
          price: 6000,
          verification: "rejected",
          id: student,
        }),
      ]);
      assert.equal((await dashboard()).tutor.verification, "verified");
      assert.equal((await dashboard()).tutor.price, 6000);
      await as(student);
      await assert.rejects(() =>
        db.query("select fb_update_terms($1::jsonb)", [
          JSON.stringify({
            id: teacher,
            headline: profile.headline,
            bio: profile.bio,
            price: 7200,
          }),
        ]),
      );
      const individual = await rpc("join", { id: lesson.id });
      assert.equal(
        (await dashboard()).bookings.find((b) => b.id === individual.id).price,
        4200,
      );
      assert.equal(
        (await dashboard()).bookings.find((b) => b.id === individual.id)
          .lesson_format,
        "individual",
      );
      await as(fourth);
      await assert.rejects(() => rpc("join", { id: lesson.id }));
      await assert.rejects(() =>
        db.query("select fb_close_enrollment($1)", [lesson.id]),
      );
      await as(teacher);
      await db.query("select fb_close_enrollment($1)", [lesson.id]);
      await as(student);
      assert.equal(
        (await dashboard()).bookings.find((b) => b.id === individual.id).status,
        "awaiting_payment",
      );
      await classroom("propose_move", {
        id: individual.id,
        starts_at: "2099-06-15T13:00:00Z",
      });
      const move = (await lessons()).seats.find(
        (s) => s.id === individual.id,
      ).move;
      await assert.rejects(() =>
        classroom("accept_move", { id: individual.id, move_id: move.id }),
      );
      await as(teacher);
      await classroom("accept_move", { id: individual.id, move_id: move.id });
      assert.equal(
        Date.parse(
          (await lessons()).bookings.find((b) => b.id === individual.id)
            .starts_at,
        ),
        Date.parse(move.starts_at),
      );
      assert.equal(
        Date.parse(
          (await catalog()).groups.find((g) => g.id === lesson.id).starts_at,
        ),
        Date.parse(move.starts_at),
      );
      const series = {
        title: "Lesson series",
        description: "Weekly practice with individual feedback.",
        capacity: 1,
        price: 1500,
        weeks: 3,
        starts_at: "2099-07-01T13:00:00Z",
      };
      await classroom("publish_series", series);
      assert.equal(
        (await catalog()).groups.filter((g) => g.title === series.title).length,
        3,
      );
      await assert.rejects(() =>
        classroom("publish_series", {
          ...series,
          starts_at: "2099-06-24T13:00:00Z",
        }),
      );
      assert.equal(
        (await catalog()).groups.filter((g) => g.title === series.title).length,
        3,
      );
      await as(student);
      const { key } = await classroom("calendar_enable");
      const feed = async (k) =>
        (await db.query("select fb_calendar_feed($1) as items", [k])).rows[0]
          .items;
      await as(null, "anon");
      const entry = (await feed(key)).find((e) => e.id === individual.id);
      assert.equal(entry.sequence, 1);
      assert.equal(Date.parse(entry.starts_at), Date.parse(move.starts_at));
      assert.deepEqual(
        Object.keys(entry).sort(),
        [
          "id",
          "starts_at",
          "lesson_title",
          "subject",
          "sequence",
          "cancelled",
        ].sort(),
      );
      assert.equal(await feed("0".repeat(64)), null);
      await assert.rejects(() => db.query("select * from fb_calendar_keys"));
      await as(student);
      const second = await classroom("calendar_enable");
      assert.equal(await feed(key), null);
      await rpc("cancel", { id: individual.id });
      assert.equal(
        (await feed(second.key)).find((e) => e.id === individual.id).cancelled,
        true,
      );
      await classroom("calendar_disable");
      assert.equal(await feed(second.key), null);
      await as(fourth);
      await assert.rejects(() => rpc("join", { id: lesson.id }));

      await rpc("apply", profile);
      await db.exec("reset role");
      await db.query(
        "update public.fb_tutors set verification='verified' where id=$1",
        [fourth],
      );
      await as(student);
      const privateRequest = await rpc("request", {
        subject: "География",
        exam: "ЕНТ",
        language: "Русский",
        city: "Онлайн",
        budget: 3500,
        goal: "Private request to one particular teacher.",
        tutor_id: teacher,
      });
      await as(fourth);
      assert.equal(
        (await dashboard()).requests.some((r) => r.id === privateRequest.id),
        false,
      );
      await assert.rejects(() =>
        rpc("offer", {
          request_id: privateRequest.id,
          price: 3500,
          starts_at: "2099-06-03T13:00:00Z",
          note: "Not allowed to respond to a private request.",
        }),
      );
      // Chat linking is single use, user-bound and inaccessible to ordinary clients.
      await as(student);
      const link = await rpc("telegram_link");
      await assert.rejects(() =>
        db.query("select public.fb_link_telegram($1,101)", [link.token]),
      );
      await as(null, "service_role");
      assert.equal(
        (
          await db.query("select public.fb_link_telegram($1,101) as value", [
            link.token,
          ])
        ).rows[0].value,
        true,
      );
      assert.equal(
        (
          await db.query("select public.fb_link_telegram($1,102) as value", [
            link.token,
          ])
        ).rows[0].value,
        false,
      );
      await db.query("select public.fb_bot_message(101,$1,$2,1001)", [
        booking.id,
        "Message through Telegram",
      ]);
      await db.query("select public.fb_bot_message(101,$1,$2,1001)", [
        booking.id,
        "Message through Telegram",
      ]); // retry: no duplicate
      await as(teacher);
      assert.equal((await dashboard()).messages.length, 2);
      await as(student);
      await rpc("cancel", { id: booking.id });
      await assert.rejects(() =>
        rpc("message", { booking_id: booking.id, body: "Too late" }),
      );
      await assert.rejects(() =>
        db.query("select * from public.fb_verifications"),
      );
      await assert.rejects(() => db.query("select * from public.fb_telegram"));
      const review = async (action, data = {}) =>
        (
          await db.query("select fb_review($1,$2::jsonb) v", [
            action,
            JSON.stringify({ tutor_id: teacher, ...data }),
          ])
        ).rows[0].v;
      const publicReviews = async () =>
        (await db.query("select fb_public_reviews($1) v", [teacher])).rows[0].v;
      await assert.rejects(() =>
        review("save", { score: 5, body: "Too early" }),
      );
      await db.exec("reset role");
      await db.query(
        "with slot as (insert into fb_groups(tutor_id,title,description,price,capacity,starts_at) values($2,'Past lesson','An earlier lesson for reviews.',5000,1,now()-interval '2 days') returning id,starts_at) insert into fb_bookings(student_id,tutor_id,group_id,subject,price,starts_at) select $1,$2,id,'География',5000,starts_at from slot",
        [student, teacher],
      );
      await as(student);
      await review("save", { score: 4, body: "Good practice" });
      await review("save", { score: 5, body: "Map exercise helped" });
      assert.equal((await review("mine")).score, 5);
      await as(null, "anon");
      const published = await publicReviews();
      assert.equal(published.length, 1);
      assert.deepEqual(
        Object.keys(published[0]).sort(),
        ["body", "score", "updated_at"].sort(),
      );
      assert.equal(
        (await db.query("select fb_market_catalog() v")).rows[0].v.tutors.find(
          (t) => t.id === teacher,
        ).rating,
        5,
      );
      await assert.rejects(() => review("mine"));
      await as(fourth);
      await assert.rejects(() =>
        review("save", { score: 5, body: "No booking" }),
      );
      assert.equal(await review("mine"), null);
      await review("remove");
      assert.equal((await publicReviews()).length, 1);
      await as(student);
      await review("remove");
      assert.equal((await publicReviews()).length, 0);
      const bot = async (chat, action) =>
        (await db.query("select fb_telegram_bot($1,$2) v", [chat, action]))
          .rows[0].v;
      const reminders = async () =>
        (await db.query("select fb_telegram_claim_reminders() v")).rows[0].v;
      await assert.rejects(() => bot(101, "lessons"));
      await assert.rejects(reminders);
      await db.exec("reset role");
      await db.query(
        "insert into fb_telegram(user_id,chat_id) values($1,202),($2,404)",
        [teacher, fourth],
      );
      await db.query(
        `with slot as (
        insert into fb_groups(tutor_id,title,description,price,capacity,starts_at) values($2,'Group reminder','A scheduled group for reminder checks.',5000,3,now()+interval '48 minutes') returning id,starts_at
      )
      insert into fb_bookings(student_id,tutor_id,group_id,subject,price,starts_at) select learner,$2,id,'География',5000,starts_at from slot cross join unnest(array[$1::uuid,$3::uuid]) learners(learner)`,
        [student, teacher, fourth],
      );
      await as(null, "service_role");
      assert.deepEqual(await bot(909, "lessons"), { linked: false });
      const studentContext = await bot(101, "inbox");
      assert.equal(studentContext.threads[0].id, dm.id);
      assert.equal("body" in studentContext.threads[0], false);
      assert.equal(
        (await bot(202, "lessons")).lessons.filter(
          (l) => l.title === "Group reminder",
        ).length,
        1,
      );
      assert.equal((await bot(202, "notices_off")).notices, false);
      assert.equal(
        (await db.query("select fb_direct_notice($1,$2) v", [dm.id, student]))
          .rows[0].v,
        null,
      );
      assert.equal((await bot(202, "notices_on")).notices, true);
      const firstWave = await reminders();
      assert.deepEqual(
        firstWave.map((r) => r.chat_id).sort((a, b) => a - b),
        [101, 202, 404],
      );
      assert.equal((await reminders()).length, 0);
      for (const item of firstWave)
        await db.query("select fb_telegram_finish_reminder($1,true)", [
          item.claim,
        ]);
      assert.equal((await reminders()).length, 0);
      await bot(404, "reminders_off");
      await db.exec("reset role");
      await db.query(
        "update fb_bookings set starts_at=now()+interval '12 minutes' where group_id=(select id from fb_groups where title='Group reminder')",
      );
      await as(null, "service_role");
      assert.deepEqual(
        (await reminders()).map((r) => r.chat_id).sort((a, b) => a - b),
        [101, 202],
      );
      assert.deepEqual(await bot(202, "unlink"), { linked: false });
      assert.deepEqual(await bot(202, "inbox"), { linked: false });
    } finally {
      await db.close();
    }
  },
);
