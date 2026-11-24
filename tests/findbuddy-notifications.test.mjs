import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { roleHome } from "../app/lib/platform.ts";
import { notificationContent as view } from "../app/lib/notifications.ts";

const notificationContent=(item,role)=>view(item,role,roleHome(role));

test("notification links stay inside the current role's cabinet and point to the required action", () => {
 const item = { id: 1, kind: "direct_message", entity_id: "11111111-1111-4111-8111-111111111111", created_at: "2026-11-24T00:00:00Z", read_at: null };
 assert.equal(notificationContent(item,"student").href,"/student#messages/thread/"+item.entity_id);
 assert.equal(notificationContent({ ...item, kind: "homework_received" },"teacher").href,"/teacher#account/work/"+item.entity_id);
 assert.equal(notificationContent({ ...item, entity_id: "javascript:alert(1)" },"student").href,"/student");
 assert.equal(notificationContent({ ...item, kind: "unknown" },"teacher").href,"/teacher");
});

test("durable notifications isolate owners, deduplicate events, paginate, and preserve unread items across acknowledgement", async () => {
 const db = new PGlite();
 const owner = "44444444-4444-4444-8444-444444444444";
 const student = "11111111-1111-4111-8111-111111111111", teacher = "22222222-2222-4222-8222-222222222222", other = "33333333-3333-4333-8333-333333333333";
 try {
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant execute on functions to anon,authenticated;");
  for (const file of (await readdir(new URL('../supabase/sql/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../supabase/sql/'+file,import.meta.url),'utf8'));
  for(const [id,role] of [[student,'student'],[teacher,'teacher'],[other,'student']]) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",[id,role+id.slice(0,2)+'@example.test',JSON.stringify({account_type:role})]);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'dpsg2e@gmail.com',now())",[owner]);
  await db.query("insert into fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience,verification) values($1,'Teacher','Qualified teacher','A sufficiently detailed biography for the test profile.','Математика','SAT','Русский','Онлайн',3000,3,'pending')",[teacher]);
  await db.query("update fb_tutors set verification='verified',verification_revision=verification_revision+1 where id=$1",[teacher]);
  const slot=(await db.query("insert into fb_groups(tutor_id,title,description,price,capacity,starts_at,subject,exam,language,city) values($1,'Test lesson','Detailed description of a scheduled lesson',3000,2,now()+interval '3 hours','Математика','SAT','Русский','Онлайн') returning id",[teacher])).rows[0].id;
  const booking=(await db.query("insert into fb_bookings(student_id,tutor_id,group_id,subject,price,starts_at) values($1,$2,$3,'Математика',3000,now()+interval '3 hours') returning id",[student,teacher,slot])).rows[0].id;
  const as = async (id,role='authenticated')=>{ await db.exec('reset role;set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']); };
  const list=async(action='list',data={})=>(await db.query('select fb_notifications($1,$2::jsonb) v',[action,JSON.stringify(data)])).rows[0].v;
  await as(owner);let adminFeed=await list();assert.ok(adminFeed.items.some(n=>n.kind==='teacher_review'&&n.read_at),'review tasks stop being unread once moderation is complete');
  await as(student);
  let feed=await list();
  assert.ok(feed.items.some(n=>n.kind==='booking_confirmed'&&n.context==='Test lesson'));
  assert.equal(feed.items.filter(n=>n.kind==='lesson_soon').length,1);
  const unread=feed.unread;
  assert.equal((await list()).unread,unread,'opening the feed must not create duplicate reminders');
  assert.ok(feed.items.every(n=>!('user_id' in n)&&!('event_key' in n)));
  await assert.rejects(()=>db.query('select * from fb_notifications'),/permission denied/);
  await assert.rejects(()=>db.query("select fb_record_notification($1,'forged',$2,'forged')",[other,booking]),/permission denied/);
  const mine=feed.items[0].id;
  await as(teacher);const theirs=await list();assert.ok(theirs.items.some(n=>n.kind==='profile_approved'));
  await list('read',{ids:[mine]});
  await as(student);assert.equal((await list()).items.find(n=>n.id===mine).read_at,null,'another user cannot acknowledge my notifications');
  await list('read',{ids:[mine]});assert.ok((await list()).items.find(n=>n.id===mine).read_at);
  await list('read',{ids:[mine]});assert.equal((await list()).unread,unread-1);
  await as(other);assert.deepEqual((await list()).items,[]);
  await as(null,'anon');await assert.rejects(()=>list(),/permission denied/);
  await db.exec('reset role');
  await db.query("insert into fb_messages(booking_id,sender_id,body) values($1,$2,'Private content must not appear in notifications')",[booking,teacher]);
  await db.query("insert into fb_lesson_moves(booking_id,proposed_by,starts_at) values($1,$2,now()+interval '5 hours')",[booking,teacher]);
  await db.query("insert into fb_lesson_work(booking_id,task_version,revision,answer) values($1,0,1,'My answer')",[booking]);
  await db.query("update fb_lesson_work set feedback='Good work',revision=2 where booking_id=$1",[booking]);
  await db.query("insert into fb_lesson_outcomes(booking_id) values($1)",[booking]);
  await db.query("update fb_lesson_outcomes set teacher_response='completed',teacher_revision=1 where booking_id=$1",[booking]);
  await as(student);feed=await list();
  assert.ok(feed.items.some(n=>n.kind==='lesson_outcome'));
  assert.ok(feed.items.some(n=>n.kind==='lesson_message'));assert.ok(feed.items.some(n=>n.kind==='move_requested'));assert.ok(feed.items.some(n=>n.kind==='homework_feedback'));
  assert.ok(!JSON.stringify(feed).includes('Private content'));
  await db.exec('reset role');await db.query("delete from fb_lesson_moves where booking_id=$1",[booking]);
  await as(teacher);assert.ok((await list()).items.some(n=>n.kind==='move_declined'));
  await as(student);assert.ok(!(await list()).items.some(n=>n.kind==='move_requested'&&!n.read_at));
  await db.exec('reset role');
  for(let i=0;i<65;i++) await db.query("select fb_record_notification($1,'direct_message',$2,$3)",[student,booking,'test:'+i]);
  await as(student);const first=await list();assert.equal(first.items.length,50);
  const second=await list('list',{before:first.items.at(-1).id});assert.ok(second.items.length>0);assert.ok(second.items.every(n=>n.id<first.items.at(-1).id));
  await db.exec('reset role');await db.query("select fb_record_notification($1,'direct_message',$2,'arrived-after-snapshot')",[student,booking]);
  await as(student);await list('read',{ids:first.items.map(n=>n.id)});
  const remaining=await list('list',{unread:true});assert.ok(remaining.items.length>0);assert.ok(remaining.items.every(n=>!n.read_at));assert.ok(remaining.items.some(n=>n.id>first.items[0].id),'acknowledge only the displayed snapshot, not a newly arrived event');
  await db.exec('reset role');await db.query("update fb_bookings set status='cancelled' where id=$1",[booking]);
  await as(student);feed=await list();assert.ok(feed.items.some(n=>n.kind==='booking_cancelled'));
  assert.ok(!feed.items.some(n=>n.kind==='lesson_soon'&&!n.read_at));
 } finally { await db.close(); }
});
