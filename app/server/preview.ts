import { classroomActions } from "./classroom";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import {
  randomBytes,
  createHash,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { DEMO_CATALOG } from "../lib/findbuddy";
import { localAccountsAllowed } from "./accountStorage";

export const student = "11111111-1111-4111-8111-111111111111";
const teacher = "22222222-2222-4222-8222-222222222222";
const ids = [
  teacher,
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];
export function localOrigin(req: Request) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = req.headers.get("host");
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      [host, forwardedHost].includes(origin.host)
    );
  } catch {
    return false;
  }
}
export function previewAllowed(req: Request) {
  return localAccountsAllowed(req);
}
async function initialize() {
  const path = process.env.FINDBUDDY_DATA_DIR || ".data/local";
  await mkdir(path, { recursive: true });
  const db = new PGlite(path);
  const exists = await db.query<{ ready: string | null }>(
    "select to_regclass('public.preview_sessions') as ready",
  );
  if (!exists.rows[0].ready) {
    const migration = await readFile("supabase/sql/101_findbuddy.sql", "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(
        "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role;",
      );
      await tx.exec(
        migration.replace(/^begin;$/m, "").replace(/commit;\s*$/, ""),
      );
      await tx.exec(
        "create table preview_sessions(token text primary key, user_id uuid references auth.users, expires timestamptz not null); create table preview_payments(booking_id uuid primary key references fb_bookings, withdrawn boolean default false);",
      );
      for (const id of [student, ...ids])
        await tx.query("insert into auth.users values ($1)", [id]);
      for (const [index, t] of DEMO_CATALOG.tutors.entries()) {
        await tx.query(
          "insert into fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience,verification) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'verified')",
          [
            ids[index],
            t.display_name.split(" ·")[0],
            t.headline,
            t.bio,
            t.subject,
            t.exam,
            t.language,
            t.city,
            t.price,
            t.experience,
          ],
        );
      }
      await tx.query(
        "insert into fb_groups(tutor_id,title,description,price,capacity,starts_at) values($1,'Карты и климат Казахстана','Час практики по географии ЕНТ: читаем климатограммы и разбираем типичные ошибки.',1500,6,date_trunc('day',now())+interval '7 days 13 hours')",
        [teacher],
      );
    });
  }
  const version = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_close_enrollment(uuid)') as ready",
  );
  if (!version.rows[0].ready) {
    const sql = await readFile(
      "supabase/sql/102_findbuddy_schedule.sql",
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.exec(sql.replace(/^begin;$/m, "").replace(/commit;\s*$/, ""));
      await tx.query(
        "insert into fb_groups(tutor_id,title,description,price,capacity,starts_at) select t.id,t.headline,t.bio,t.price,1,date_trunc('day',now())+interval '3 days 12 hours' from fb_tutors t where not exists(select 1 from fb_groups g where g.tutor_id=t.id and g.starts_at between date_trunc('day',now())+interval '3 days 11 hours' and date_trunc('day',now())+interval '3 days 13 hours') and not exists(select 1 from fb_bookings b where (b.student_id=t.id or b.tutor_id=t.id) and b.status<>'cancelled' and b.starts_at between date_trunc('day',now())+interval '3 days 11 hours' and date_trunc('day',now())+interval '3 days 13 hours')",
      );
    });
  }
  const classroom = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_lesson_dashboard()') as ready",
  );
  if (!classroom.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/103_findbuddy_lessons.sql", "utf8"),
    );
  const profiles = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_save_profile(jsonb)') as ready",
  );
  if (!profiles.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/104_findbuddy_profiles.sql", "utf8"),
    );
  const inbox = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_inbox(text,jsonb)') as ready",
  );
  if (!inbox.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/105_findbuddy_inbox.sql", "utf8"),
    );
  const reviews = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_market_catalog()') as ready",
  );
  if (!reviews.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/106_findbuddy_reviews.sql", "utf8"),
    );
  const telegram = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_telegram_bot(bigint,text)') as ready",
  );
  if (!telegram.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/107_findbuddy_telegram.sql", "utf8"),
    );
  const outcomes = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_lesson_outcome(jsonb)') as ready",
  );
  if (!outcomes.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/108_findbuddy_outcomes.sql", "utf8"),
    );
  const pilot = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_pilot_dashboard()') as ready",
  );
  if (!pilot.rows[0].ready)
    await db.exec(
      await readFile("supabase/sql/109_findbuddy_free_pilot.sql", "utf8"),
    );
  const platform = await db.query<{ ready: string | null }>(
    "select to_regprocedure('public.fb_platform_dashboard()') as ready",
  );
  if (!platform.rows[0].ready) {
    // Only the local PGlite auth stub needs these columns. Production Auth is
    // owned by Supabase and must not be changed by an application migration.
    await db.exec(
      "alter table auth.users add column if not exists email text; alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb; alter table auth.users add column if not exists email_confirmed_at timestamptz default now();",
    );
    await db.exec(
      await readFile("supabase/sql/110_findbuddy_platform.sql", "utf8"),
    );
  }
  await db.exec(
    "create table if not exists preview_accounts(email text primary key,user_id uuid not null references auth.users on delete cascade,salt text not null,password_hash text not null)",
  );
  return db;
}
const state = globalThis as typeof globalThis & {
  findbuddyDb?: Promise<PGlite>;
  findbuddyAccountSetup?: Promise<PGlite>;
};
export function database() {
  const connection = (state.findbuddyDb ??= initialize().catch((e) => {
    delete state.findbuddyDb;
    throw e;
  }));
  // Upgrade an already-open local database as well as a fresh process.
  return (state.findbuddyAccountSetup ??= connection
    .then(async (db) => {
      const setup = await db.query<{ ready: string | null }>(
        "select to_regclass('public.fb_account_details') as ready",
      );
      if (!setup.rows[0].ready) {
        // Local passwords do not verify ownership of an email address.
        await db.exec("update auth.users set email_confirmed_at=null");
        await db.exec(
          await readFile("supabase/sql/111_findbuddy_account_setup.sql", "utf8"),
        );
      }
      await db.exec(await readFile("supabase/sql/20261123175841_findbuddy_access_grants.sql", "utf8"));
      return db;
    })
    .catch((error) => {
      delete state.findbuddyAccountSetup;
      throw error;
    }));
}
function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
function token(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.match(/(?:^|; )fb_preview=([0-9a-f]{64})(?:;|$)/)?.[1] || ""
  );
}
export async function identity(req: Request) {
  const db = await database();
  const result = await db.query<{ user_id: string }>(
    "select user_id from preview_sessions where token=$1 and expires>now()",
    [hash(token(req))],
  );
  return result.rows[0]?.user_id ?? null;
}
export function switchRole(req: Request, role: string) {
  if (role !== "logout") throw new Error("Войдите с почтой и паролем.");
  return startSession(req, null);
}
function passwordHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (error, digest) =>
      error ? reject(error) : resolve(digest),
    ),
  );
}
export async function previewAccount(
  req: Request,
  body: Record<string, unknown>,
) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 8 ||
    password.length > 128
  )
    return Response.json(
      { error: "Проверьте адрес почты и пароль из 8–128 символов." },
      { status: 400 },
    );
  const db = await database();
  if (body.action === "signup") {
    if (name.length < 2 || name.length > 50)
      return Response.json(
        { error: "Введите имя от 2 до 50 символов." },
        { status: 400 },
      );
    const accountType = body.account_type ?? "student";
    if (!["student", "teacher", "business"].includes(String(accountType)))
      return Response.json(
        { error: "Выберите тип аккаунта." },
        { status: 400 },
      );
    const salt = randomBytes(16).toString("hex");
    const digest = await passwordHash(password, salt);
    const user = randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx.query(
          "insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3::jsonb,null)",
          [
            user,
            email,
            JSON.stringify({ account_type: accountType, display_name: name, birth_date: body.birth_date || null }),
          ],
        );
        await tx.query("insert into preview_accounts values($1,$2,$3,$4)", [
          email,
          user,
          salt,
          digest.toString("hex"),
        ]);
        await tx.query("insert into fb_student_names values($1,$2) on conflict(id) do update set name=excluded.name", [
          user,
          name,
        ]);
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "23505")
        return Response.json(
          { error: "Аккаунт на эту почту уже есть. Войдите с паролем." },
          { status: 409 },
        );
      throw e;
    }
    return startSession(req, user);
  }
  const {
    rows: [account],
  } = await db.query<{ user_id: string; salt: string; password_hash: string }>(
    "select user_id,salt,password_hash from preview_accounts where email=$1",
    [email],
  );
  const digest = await passwordHash(password, account?.salt ?? "preview-login");
  if (
    !account ||
    !timingSafeEqual(digest, Buffer.from(account.password_hash, "hex"))
  )
    return Response.json(
      { error: "Проверьте почту и пароль." },
      { status: 401 },
    );
  return startSession(req, account.user_id);
}
async function startSession(req: Request, user: string | null) {
  const db = await database();
  const secret = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.query(
      "delete from preview_sessions where token=$1 or expires<=now()",
      [hash(token(req))],
    );
    if (user)
      await tx.query(
        "insert into preview_sessions values($1,$2,now()+interval '1 day')",
        [hash(secret), user],
      );
  });
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `fb_preview=${secret}; HttpOnly; SameSite=Strict; Path=/findbuddy; Max-Age=${user ? 86400 : 0}`,
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function previewData(
  req: Request,
  view: string,
  action?: string,
  data: Record<string, unknown> = {},
) {
  const db = await database();
  const user = await identity(req);
  if (view === "session") return { user, preview: true };
  if (!user && (action || view === "dashboard" || view === "platform"))
    throw Error("Войдите в аккаунт.");
  return db.transaction(async (tx) => {
    if (action === "test_pay" || action === "test_withdraw") {
      if (action === "test_pay") {
        const result = await tx.query(
          "insert into preview_payments(booking_id) select id from fb_bookings where id=$1 and student_id=$2 and status='awaiting_payment' and price>0 on conflict do nothing returning booking_id",
          [data.id, user],
        );
        if (!result.rows.length) throw Error("Тестовая оплата недоступна.");
      } else {
        const result = await tx.query(
          "update preview_payments p set withdrawn=true from fb_bookings b where p.booking_id=b.id and b.tutor_id=$1 and not p.withdrawn returning b.id",
          [user],
        );
        if (!result.rows.length)
          throw Error("Нет тестовых средств для вывода.");
      }
      return { ok: true };
    }
    if (
      action === "cancel" &&
      (
        await tx.query("select 1 from preview_payments where booking_id=$1", [
          data.id,
        ])
      ).rows.length
    )
      throw Error("Тестовый платёж уже проведён.");
    const wallet =
      view === "dashboard"
        ? (
            await tx.query(
              "select p.booking_id,p.withdrawn,b.tutor_net from preview_payments p join fb_bookings b on b.id=p.booking_id where b.student_id=$1 or b.tutor_id=$1",
              [user],
            )
          ).rows
        : [];
    await tx.exec(
      user ? "set local role authenticated" : "set local role anon",
    );
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    if (!action && view === "viewer")
      return (await tx.query<{ v: object }>("select fb_viewer() v")).rows[0].v;
    if (!action && view === "platform")
      return (await tx.query<{ v: object }>("select fb_platform_dashboard() v"))
        .rows[0].v;
    if (action === "platform")
      return (
        await tx.query<{ v: object }>(
          "select fb_platform_action($1,$2::jsonb) v",
          [data.action, JSON.stringify(data)],
        )
      ).rows[0].v;
    if (!action && view.startsWith("student/"))
      return (
        await tx.query<{ v: object }>("select fb_student_context($1) v", [
          view.slice(8),
        ])
      ).rows[0].v;
    if (action?.startsWith("telegram"))
      throw Error("Для Telegram нужен подключённый аккаунт findbuddy и бот.");
    if (action === "edit_terms") {
      await tx.query("select fb_update_terms($1::jsonb)", [
        JSON.stringify(data),
      ]);
      return { ok: true };
    }
    if (action === "close_enrollment") {
      await tx.query("select fb_close_enrollment($1)", [data.id]);
      return { ok: true };
    }
    if (action === "save_profile") {
      const result = await tx.query<{ value: object }>(
        "select fb_save_profile($1::jsonb) value",
        [JSON.stringify(data)],
      );
      return result.rows[0].value;
    }
    if (!action && view.startsWith("reviews/"))
      return (
        await tx.query<{ value: object }>(
          "select fb_public_reviews($1) value",
          [view.slice(8)],
        )
      ).rows[0].value;
    if (action === "review")
      return (
        await tx.query<{ value: object }>(
          "select fb_review($1,$2::jsonb) value",
          [data.action, JSON.stringify(data)],
        )
      ).rows[0].value;
    if (action === "inbox") {
      return (
        await tx.query<{ value: object }>(
          "select fb_inbox($1,$2::jsonb) value",
          [data.action, JSON.stringify(data)],
        )
      ).rows[0].value;
    }
    if (action === "lesson_outcome")
      return (
        await tx.query<{ value: object }>(
          "select fb_lesson_outcome($1::jsonb) value",
          [JSON.stringify(data)],
        )
      ).rows[0].value;
    if (action && classroomActions.includes(action)) {
      return (
        await tx.query<{ value: object }>(
          "select fb_lesson_action($1,$2::jsonb) as value",
          [action, JSON.stringify(data)],
        )
      ).rows[0].value;
    }
    const result = action
      ? await tx.query<{ v: object }>("select fb_action($1,$2::jsonb) v", [
          action,
          JSON.stringify(data),
        ])
      : await tx.query<{ v: object }>(
          view === "dashboard"
            ? "select fb_pilot_dashboard() v"
            : "select fb_market_catalog() v",
        );
    return view === "dashboard"
      ? { ...result.rows[0].v, payments: wallet }
      : result.rows[0].v;
  });
}
