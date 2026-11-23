import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("platform roles, multi-direction lessons, organizations, invitations, moderation and student privacy", async () => {
  const db = new PGlite();
  let phase = "schema";
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz default now());create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;",
    );
    // Supabase's migration role can reference/read Auth and attach the signup
    // trigger, but does not own auth.users and cannot ALTER that table.
    await db.exec(
      "create role migration_operator; grant usage on schema auth to migration_operator; grant usage,create on schema public to migration_operator; grant select,references,trigger on auth.users to migration_operator; set role migration_operator;",
    );
    // Model hosted Supabase defaults, which grant new public objects to API roles.
    await db.exec("alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;");
    for (const f of (
      await readdir(new URL("../supabase/sql/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/sql/" + f, import.meta.url),
          "utf8",
        ),
      );
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        assert.equal((await db.query("select has_table_privilege($1,'public.fb_account_details',$2) allowed", [role, privilege])).rows[0].allowed, false);
      }
      assert.equal((await db.query("select has_table_privilege($1,'public.fb_account_details','SELECT') allowed", [role])).rows[0].allowed, role === "authenticated");
      for (const helper of ["fb_schedule_guard()", "fb_booking_details()", "fb_calendar_changed()", "fb_preserve_past_booking()"]) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, "public." + helper])).rows[0].allowed, false);
      }
    }
    assert.equal((await db.query("select has_function_privilege('anon','public.fb_dashboard()','EXECUTE') allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.fb_dashboard()','EXECUTE') allowed")).rows[0].allowed, true);
    const ids = {
      student: "11111111-1111-4111-8111-111111111111",
      teacher: "22222222-2222-4222-8222-222222222222",
      business: "33333333-3333-4333-8333-333333333333",
      other: "44444444-4444-4444-8444-444444444444",
      owner: "55555555-5555-4555-8555-555555555555",
      moderator: "66666666-6666-4666-8666-666666666666",
    };
    for (const [role, id] of Object.entries(ids))
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",
        [
          id,
          role === "owner" ? "dpsg2e@gmail.com" : role + "@example.test",
          JSON.stringify({
            account_type: role === "other" ? "business" : role,
          }),
        ],
      );
    const as = async (id, role = "authenticated") => {
      await db.exec("reset role;set role " + role);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id ?? "",
      ]);
    };
    const rpc = async (name, args = [], values = []) => {
      return (
        await db.query("select " + name + "(" + args.join(",") + ") v", values)
      ).rows[0].v;
    };
    const action = (name, data = {}) =>
      rpc(
        "fb_platform_action",
        ["$1", "$2::jsonb"],
        [name, JSON.stringify(data)],
      );
    const legacy = (name, data = {}) =>
      rpc("fb_action", ["$1", "$2::jsonb"], [name, JSON.stringify(data)]);
    const dashboard = () => rpc("fb_platform_dashboard");
    phase = "roles";
    await as(ids.student);
    assert.equal((await rpc("fb_viewer")).account.role, "student");
    await assert.rejects(() => legacy("apply", {}));
    await assert.rejects(() =>
      action("organization_save", { name: "A center" }),
    );
    await assert.rejects(() =>
      action("invite_moderator", { email: "x@example.test" }),
    );
    await assert.rejects(
      () =>
        db.query("update fb_accounts set role='owner' where id=$1", [
          ids.student,
        ]),
      /permission denied/,
    );
    await assert.rejects(
      () => rpc("fb_action_before_roles", ["'apply'", "'{}'::jsonb"]),
      /permission denied/,
    );
    await action("student_profile", {
      name: "Student",
      stage: "school",
      study_year: 11,
      goal: "Improve geography",
      institution: "Private institution",
      languages: ["Русский"],
      format: "online",
    });
    phase = "teacher";
    await as(ids.teacher);
    const profile = {
      mode: "create",
      display_name: "Test teacher",
      headline: "Geography teacher",
      bio: "Detailed geography practice and feedback.",
      subject: "География",
      exam: "ЕНТ",
      language: "Русский",
      city: "Онлайн",
      price: 5000,
      experience: 3,
      adult_consent: true,
      photo: Buffer.concat([
        Buffer.from([255, 216, 255]),
        Buffer.alloc(80),
      ]).toString("base64"),
      education_entries: [
        {
          institution: "University",
          degree: "Bachelor",
          field: "Geography",
          year: "2022",
          status: "completed",
        },
      ],
      spoken_languages: [{ language: "Русский", level: "Родной" }],
    };
    await rpc("fb_save_profile", ["$1::jsonb"], [JSON.stringify(profile)]);
    assert.equal((await dashboard()).tutor.verification, "pending");
    await assert.rejects(() => legacy("group", { title: "Early publication" }));
    phase = "moderation";
    await as(ids.owner);
    let queue = await dashboard();
    const t = queue.teacher_queue[0];
    await action("moderate", {
      kind: "teacher",
      id: ids.teacher,
      decision: "verified",
      reason: "Checked public references",
      revision: t.verification_revision,
    });
    await assert.rejects(
      () =>
        action("moderate", {
          kind: "teacher",
          id: ids.teacher,
          decision: "rejected",
          reason: "Stale decision",
          revision: t.verification_revision,
        }),
      /изменена/,
    );
    await assert.rejects(() => action("invite_moderator", { email: "moderator@example.test" }), /только владелец/);
    await as(ids.moderator);
    assert.equal((await rpc("fb_viewer")).account.role, "student");
    await assert.rejects(() => action("review_detail", { id: ids.teacher }), /Недостаточно прав/);
    phase = "directions";
    await as(ids.teacher);
    const own = await action("offering_save", {
      title: "SAT mathematics",
      description: "Clear practice for SAT mathematics.",
      subject: "Математика",
      exam: "SAT",
      languages: ["English", "Русский"],
      format: "online",
      city: "",
      price: 0,
      active: true,
    });
    const slot = await legacy("group", {
      offering_id: own.id,
      title: "Free SAT lesson",
      description: "A free mathematics lesson for beginners.",
      price: 0,
      capacity: 1,
      starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      language: "English",
    });
    for (const price of [1, 499, 100001])
      await assert.rejects(() =>
        action("offering_save", {
          id: own.id,
          title: "Invalid price",
          subject: "Математика",
          exam: "SAT",
          languages: ["English"],
          format: "online",
          price,
          active: true,
        }),
      );
    await assert.rejects(() => legacy("join", { id: slot.id }));
    phase = "booking";
    await as(ids.student);
    const incomplete = await rpc("fb_viewer");
    assert.equal(incomplete.account.role, "student");
    await db.exec("reset role");
    await db.query("update fb_student_profiles set goal='' where user_id=$1", [
      ids.student,
    ]);
    await as(ids.student);
    await assert.rejects(
      () => legacy("join", { id: slot.id }),
      /профиль ученика/,
    );
    await action("student_profile", {
      name: "Student",
      stage: "school",
      study_year: 11,
      goal: "Improve geography",
      institution: "Private institution",
      languages: ["Русский"],
      format: "online",
    });
    const b = await legacy("join", { id: slot.id });
    let personal = await rpc("fb_pilot_dashboard");
    let booking = personal.bookings.find((x) => x.id === b.id);
    assert.equal(booking.price, 0);
    assert.equal(booking.subject, "Математика");
    assert.equal(booking.exam, "SAT");
    assert.equal(booking.language, "English");
    assert.equal(booking.commission, 0);
    await assert.rejects(() => legacy("join", { id: slot.id }));
    await as(ids.other);
    await assert.rejects(() =>
      rpc("fb_student_context", ["$1"], [ids.student]),
    );
    await as(ids.teacher);
    let context = await rpc("fb_student_context", ["$1"], [ids.student]);
    assert.equal(context.study_year, 11);
    assert.equal("institution" in context, false);
    phase = "center";
    await as(ids.business);
    await action("organization_save", {
      name: "Test center",
      description: "A team of teachers for exam preparation.",
      city: "Алматы",
      format: "both",
      website: "https://example.test",
      contact: "center@example.test",
      evidence: "Public references and representative contact.",
      submit: true,
    });
    let org = (await dashboard()).organization;
    const invite = await action("invite_teacher", {
      email: "teacher@example.test",
    });
    const revoked = await action("invite_teacher", {
      email: "teacher@example.test",
    });
    await action("revoke_invite", { id: revoked.id });
    const expired = await action("invite_teacher", {
      email: "teacher@example.test",
    });
    await db.exec("reset role");
    await db.query(
      "update fb_invitations set expires_at=now()-interval '1 second' where id=$1",
      [expired.id],
    );
    await as(ids.student);
    await assert.rejects(() =>
      action("accept_invite", { token: invite.token }),
    );
    await as(ids.teacher);
    await assert.rejects(
      () => action("accept_invite", { token: revoked.token }),
      /отозвано/,
    );
    await assert.rejects(
      () => action("accept_invite", { token: expired.token }),
      /истекло/,
    );
    await action("accept_invite", { token: invite.token });
    await action("accept_invite", { token: invite.token });
    await as(ids.owner);
    await action("moderate", {
      kind: "organization",
      id: org.id,
      decision: "verified",
      reason: "Representative and center checked",
      revision: org.verification_revision,
    });
    await as(ids.business);
    const direction = await action("offering_save", {
      teacher_id: ids.teacher,
      title: "Center geography",
      description: "Geography preparation from the center.",
      subject: "География",
      exam: "ЕНТ",
      languages: ["Русский"],
      format: "online",
      price: 3000,
      active: true,
    });
    const centerSlot = await action("publish_slot", {
      offering_id: direction.id,
      title: "Center group lesson",
      description: "An in-depth lesson with the center teacher.",
      price: 3000,
      capacity: 3,
      starts_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
    await as(ids.other);
    await assert.rejects(() =>
      action("publish_slot", {
        offering_id: direction.id,
        title: "Wrong owner",
        description: "Another company should never publish this.",
        price: 1000,
        capacity: 1,
        starts_at: new Date(Date.now() + 6 * 86400000).toISOString(),
      }),
    );
    phase = "center booking";
    await as(ids.student);
    const centerBooking = await legacy("join", { id: centerSlot.id });
    await as(ids.business);
    await assert.rejects(
      () =>
        action("publish_slot", {
          offering_id: direction.id,
          title: "Overlapping center slot",
          description: "Should conflict with a personal lesson.",
          price: 3000,
          capacity: 2,
          starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        }),
      /время занято/,
    );
    const ownDesk = await dashboard();
    assert.equal(ownDesk.bookings[0].id, centerBooking.id);
    assert.equal(ownDesk.bookings[0].student.goal, "Improve geography");
    assert.equal("messages" in ownDesk, false);
    phase = "org chat";
    await as(ids.student);
    const chat = await action("org_send", {
      organization_id: org.id,
      body: "Question about the center lesson.",
      client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    await action("org_send", {
      organization_id: org.id,
      body: "Question about the center lesson.",
      client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(
      (await action("org_read", { thread_id: chat.id })).messages.length,
      1,
    );
    await as(ids.teacher);
    await assert.rejects(() => action("org_read", { thread_id: chat.id }));
    await as(ids.moderator);
    await assert.rejects(() => action("org_read", { thread_id: chat.id }));
    await as(ids.owner);
    await assert.rejects(() => action("org_read", { thread_id: chat.id }));
    await as(ids.business);
    assert.equal(
      (await action("org_read", { thread_id: chat.id })).messages.length,
      1,
    );
    phase = "leave";
    await action("remove_member", {
      organization_id: org.id,
      teacher_id: ids.teacher,
    });
    await as(ids.student);
    await assert.rejects(() => legacy("join", { id: centerSlot.id }));
    assert.equal(
      (await rpc("fb_pilot_dashboard")).bookings.find(
        (x) => x.id === centerBooking.id,
      ).status,
      "awaiting_payment",
    );
    await legacy("cancel", { id: centerBooking.id });
    await as(ids.business);
    const cancelledDesk = await dashboard();
    assert.equal(
      cancelledDesk.bookings.find((b) => b.id === centerBooking.id).student,
      null,
    );
    phase = "public privacy";
    await as(null, "anon");
    const catalog = await rpc("fb_market_catalog");
    assert.equal(JSON.stringify(catalog).includes("verification_links"), false);
    assert.equal(
      JSON.stringify(catalog).includes("Private institution"),
      false,
    );
    await assert.rejects(() => dashboard());
    await assert.rejects(() => db.query("select * from fb_accounts"));
    phase = "revoke";
    await as(ids.owner);
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at=null where id=$1", [ids.owner]);
    await as(ids.owner);
    assert.equal((await rpc("fb_viewer")).account.role, "student");
    await assert.rejects(() =>
      action("moderate", {
        kind: "teacher",
        id: ids.teacher,
        decision: "verified",
        reason: "No longer staff",
        revision: 99,
      }),
    );
  } catch (e) {
    e.message = "[" + phase + "] " + e.message;
    throw e;
  } finally {
    await db.close();
  }
});
