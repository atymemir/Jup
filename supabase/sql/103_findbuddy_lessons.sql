-- Run after 102. Meeting details and student work never live in the public catalog.
begin;
create table public.fb_lesson_rooms (
  id uuid primary key,
  slot_id uuid unique references public.fb_groups on delete cascade,
  booking_id uuid unique references public.fb_bookings on delete cascade,
  check(num_nonnulls(slot_id, booking_id)=1 and id=coalesce(slot_id,booking_id)),
  revision integer not null default 1,
  task_version integer not null default 0,
  plan text not null check(length(plan)<=2000),
  material text not null check(material='' or (length(material)<=1500 and material ~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^[:space:]]*)?$')),
  meeting text not null check(meeting='' or (length(meeting)<=1500 and meeting ~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^[:space:]]*)?$')),
  location text not null check(length(location)<=240),
  homework text not null check(length(homework)<=2000),
  recap text not null check(length(recap)<=2000)
);
create table public.fb_lesson_work (
  booking_id uuid primary key references public.fb_bookings on delete cascade,
  task_version integer not null,
  revision integer not null,
  answer text not null check(length(answer) between 1 and 2500),
  feedback text not null default '' check(length(feedback)<=2000)
);
create table public.fb_lesson_moves (
  booking_id uuid primary key references public.fb_bookings on delete cascade,
  id uuid not null default gen_random_uuid(),
  proposed_by uuid not null references auth.users on delete cascade,
  starts_at timestamptz not null
);
create table public.fb_student_names (
  id uuid primary key references auth.users on delete cascade,
  name text not null check(length(name) between 2 and 50)
);
alter table public.fb_lesson_rooms enable row level security;
alter table public.fb_lesson_work enable row level security;
alter table public.fb_lesson_moves enable row level security;
alter table public.fb_student_names enable row level security;
revoke all on public.fb_lesson_rooms,public.fb_lesson_work,public.fb_lesson_moves,public.fb_student_names from public,anon,authenticated;

create table public.fb_lesson_reads (
  booking_id uuid references public.fb_bookings on delete cascade,
  user_id uuid references auth.users on delete cascade,
  seen_at timestamptz not null,
  primary key(booking_id,user_id)
);
alter table public.fb_lesson_reads enable row level security;
revoke all on public.fb_lesson_reads from public,anon,authenticated;

create table public.fb_calendar_keys (
 user_id uuid primary key references auth.users on delete cascade, fingerprint bytea not null unique
);
alter table public.fb_calendar_keys enable row level security;
revoke all on public.fb_calendar_keys from public,anon,authenticated;
alter table public.fb_groups add column calendar_sequence integer not null default 0;
alter table public.fb_bookings add column calendar_sequence integer not null default 0;
create function public.fb_calendar_changed() returns trigger language plpgsql set search_path=public as $$
begin new.calendar_sequence:=old.calendar_sequence+1;return new;end $$;
create trigger fb_booking_calendar_change before update of starts_at,status on public.fb_bookings for each row execute function fb_calendar_changed();
create trigger fb_slot_calendar_change before update of starts_at,title,enrollment_closed on public.fb_groups for each row execute function fb_calendar_changed();

-- The opaque feed key grants read-only access to dates and lesson titles.
create function public.fb_calendar_feed(p_key text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare owner_id uuid; items jsonb;
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then return null; end if;
 select user_id into owner_id from fb_calendar_keys where fingerprint=sha256(convert_to(p_key,'UTF8'));
 if owner_id is null then return null; end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at),'[]'::jsonb) into items from (
  select b.id,b.starts_at,b.subject,b.lesson_title,b.calendar_sequence as sequence,b.status='cancelled' as cancelled
  from fb_bookings b where (b.student_id=owner_id or (b.tutor_id=owner_id and b.group_id is null)) and b.starts_at > now()-interval '90 days'
  union all
  select g.id,g.starts_at,t.subject,g.title,g.calendar_sequence,false from fb_groups g join fb_tutors t on t.id=g.tutor_id
  where g.tutor_id=owner_id and g.starts_at > now()-interval '90 days' and (not g.enrollment_closed or exists(select 1 from fb_bookings b where b.group_id=g.id and b.status<>'cancelled'))
 ) e;
 return items;
end $$;
revoke all on function public.fb_calendar_feed(text) from public;
grant execute on function public.fb_calendar_feed(text) to anon,authenticated;

create function public.fb_lesson_dashboard() returns jsonb language sql stable security definer set search_path=public as $$
 with mine as (select * from fb_bookings b where auth.uid() in (b.student_id,b.tutor_id) and status <> 'cancelled')
 select fb_dashboard() || jsonb_build_object(
  'calendar_enabled',exists(select 1 from fb_calendar_keys where user_id=auth.uid()),
  'student_name',(select name from fb_student_names where id=auth.uid()),
  'rooms',coalesce((select jsonb_agg(to_jsonb(r)) from fb_lesson_rooms r where exists
    (select 1 from mine b where r.id in(b.id,b.group_id)) or exists(select 1 from fb_groups g where g.id=r.slot_id and g.tutor_id=auth.uid())), '[]'::jsonb),
  'seats',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',coalesce(n.name,'Ученик '||left(b.student_id::text,4)), 'unread',(select count(*) from fb_messages msg where msg.booking_id=b.id and msg.sender_id<>auth.uid() and msg.created_at>coalesce(seen.seen_at,'-infinity'::timestamptz)),'work',to_jsonb(w),'move',to_jsonb(m))) from mine b
    left join fb_lesson_reads seen on seen.booking_id=b.id and seen.user_id=auth.uid() left join fb_student_names n on n.id=b.student_id left join fb_lesson_work w on w.booking_id=b.id left join fb_lesson_moves m on m.booking_id=b.id),'[]'::jsonb)
 );
$$;

create function public.fb_lesson_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 u uuid:=auth.uid(); b fb_bookings; g fb_groups; room fb_lesson_rooms; work fb_lesson_work; move fb_lesson_moves;
 key_id uuid; slot uuid; owner_id uuid; starts timestamptz; repeats int; i int; task text; note text;
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
 if p_action='calendar_enable' then
   note:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   insert into fb_calendar_keys values(u,sha256(convert_to(note,'UTF8'))) on conflict(user_id) do update set fingerprint=excluded.fingerprint;
   return jsonb_build_object('key',note);
 elsif p_action='calendar_disable' then
   delete from fb_calendar_keys where user_id=u;return '{}'::jsonb;
 end if;
 if p_action='student_name' then
   insert into fb_student_names values(u,trim(p_data->>'name')) on conflict(id) do update set name=excluded.name;
   return '{}'::jsonb;
 end if;
 if p_action='publish_series' then
   repeats:=(p_data->>'weeks')::int;
   if repeats is null or repeats not between 1 and 8 then raise exception 'Выберите от 1 до 8 занятий.'; end if;
   starts:=(p_data->>'starts_at')::timestamptz;
   if starts is null or not isfinite(starts) then raise exception 'Выберите дату занятия.'; end if;
   for i in 0..repeats-1 loop
     perform fb_action('group',p_data || jsonb_build_object('starts_at',starts + i * interval '168 hours'));
   end loop;
   return jsonb_build_object('count',repeats);
 end if;

 if p_action='save_room' and p_data ? 'slot_id' then
   select * into g from fb_groups where id=(p_data->>'slot_id')::uuid and tutor_id=u for update;
   if not found then raise exception 'Это занятие недоступно.' using errcode='42501'; end if;
   slot:=g.id; owner_id:=g.tutor_id;
 else
   select * into b from fb_bookings where id=(p_data->>'id')::uuid and u in(student_id,tutor_id) and status<>'cancelled' for update;
   if not found then raise exception 'Это занятие недоступно.' using errcode='42501'; end if;
   slot:=b.group_id; owner_id:=b.tutor_id;
 end if;
 -- A rebooked individual time never inherits a previous student's personal notes.
 key_id:=case when b.id is not null and b.lesson_format='individual' then b.id else coalesce(slot,b.id) end;
 perform pg_advisory_xact_lock(hashtextextended(key_id::text,103));
 select * into room from fb_lesson_rooms where id=key_id;
 if not found and slot is not null and key_id<>slot then
   select * into room from fb_lesson_rooms where id=slot;
 end if;

 if p_action='read_chat' then
   insert into fb_lesson_reads(booking_id,user_id,seen_at)
   select b.id,u,m.created_at from fb_messages m where m.booking_id=b.id and m.id=(p_data->>'message_id')::uuid and m.sender_id<>u
   on conflict(booking_id,user_id) do update set seen_at=greatest(fb_lesson_reads.seen_at,excluded.seen_at);
 elsif p_action='video_access' then
   if now()<b.starts_at-interval '15 minutes' or now()>=b.starts_at+interval '75 minutes' then raise exception 'Видеокомната открывается за 15 минут до занятия и закрывается через 15 минут после него.'; end if;
   return jsonb_build_object('room',key_id,'identity',u,'name',case when owner_id=u then coalesce((select display_name from fb_tutors where id=u),'Преподаватель') else coalesce((select name from fb_student_names where id=u),'Ученик '||left(u::text,4)) end);
 elsif p_action='save_room' then
   if u<>owner_id then raise exception 'Материалы меняет преподаватель.' using errcode='42501'; end if;
   if coalesce(room.revision,0) is distinct from (p_data->>'revision')::int then raise exception 'Материалы изменились. Обновите кабинет и откройте форму заново.'; end if;
   task:=trim(coalesce(p_data->>'homework',''));
   insert into fb_lesson_rooms(id,slot_id,booking_id,revision,task_version,plan,material,meeting,location,homework,recap)
   values(key_id,case when key_id=slot then slot end,case when key_id=b.id then b.id end,coalesce(room.revision,0)+1,
     coalesce(room.task_version,0)+(task<>coalesce(room.homework,''))::int,trim(coalesce(p_data->>'plan','')),trim(coalesce(p_data->>'material','')),
     trim(coalesce(p_data->>'meeting','')),trim(coalesce(p_data->>'location','')),task,trim(coalesce(p_data->>'recap','')))
   on conflict(id) do update set revision=excluded.revision,task_version=excluded.task_version,plan=excluded.plan,material=excluded.material,
     meeting=excluded.meeting,location=excluded.location,homework=excluded.homework,recap=excluded.recap;
 elsif p_action in ('send_work','review_work') then
   select * into work from fb_lesson_work where booking_id=b.id;
   if coalesce(work.revision,0) is distinct from (p_data->>'revision')::int or room.task_version is distinct from (p_data->>'task_version')::int
     then raise exception 'Задание или ответ изменились. Обновите кабинет и снова откройте форму.'; end if;
   if p_action='send_work' then
     if b.student_id<>u or coalesce(room.homework,'')='' then raise exception 'Ответ сейчас недоступен.' using errcode='42501'; end if;
     insert into fb_lesson_work(booking_id,task_version,revision,answer) values(b.id,room.task_version,coalesce(work.revision,0)+1,trim(p_data->>'answer'))
       on conflict(booking_id) do update set task_version=excluded.task_version,revision=excluded.revision,answer=excluded.answer,feedback='';
   else
     if owner_id<>u or work.booking_id is null or work.task_version<>room.task_version then raise exception 'Ответ недоступен для проверки.' using errcode='42501'; end if;
     note:=trim(p_data->>'feedback');
     if coalesce(note,'')='' then raise exception 'Напишите комментарий ученику.'; end if;
     update fb_lesson_work set feedback=note,revision=revision+1 where booking_id=b.id;
   end if;
 elsif p_action in ('propose_move','accept_move','dismiss_move') then
   if b.lesson_format<>'individual' or b.starts_at<=now() then raise exception 'Перенос возможен для предстоящего индивидуального урока.'; end if;
   select * into move from fb_lesson_moves where booking_id=b.id;
   if move.id is distinct from nullif(p_data->>'move_id','')::uuid then raise exception 'Предложение изменилось. Обновите кабинет.'; end if;
   if p_action='dismiss_move' then
     delete from fb_lesson_moves where booking_id=b.id;
     return '{}'::jsonb;
   end if;
   starts:=case when p_action='propose_move' then (p_data->>'starts_at')::timestamptz else move.starts_at end;
   if starts is null or not isfinite(starts) or starts<now()+interval '30 minutes' or starts=b.starts_at then raise exception 'Выберите другое время минимум через 30 минут.'; end if;
   if p_action='accept_move' and move.proposed_by=u then raise exception 'Другая сторона должна подтвердить перенос.'; end if;
   if slot is not null then perform 1 from fb_groups where id=slot for update; end if;
   perform pg_advisory_xact_lock(hashtextextended(least(b.student_id,owner_id)::text,102));
   perform pg_advisory_xact_lock(hashtextextended(greatest(b.student_id,owner_id)::text,102));
   if exists(select 1 from fb_bookings x where x.id<>b.id and x.status<>'cancelled' and
     (x.student_id in(b.student_id,owner_id) or x.tutor_id in(b.student_id,owner_id)) and x.starts_at<starts+interval '1 hour' and x.starts_at+interval '1 hour'>starts)
     or exists(select 1 from fb_groups x where x.id is distinct from slot and x.tutor_id in(b.student_id,owner_id) and not x.enrollment_closed
       and x.starts_at<starts+interval '1 hour' and x.starts_at+interval '1 hour'>starts) then raise exception 'Это время уже занято.'; end if;
   if p_action='propose_move' then
     insert into fb_lesson_moves(booking_id,proposed_by,starts_at) values(b.id,u,starts)
      on conflict(booking_id) do update set id=excluded.id,proposed_by=u,starts_at=starts;
   else
     update fb_bookings set starts_at=starts where id=b.id;
     update fb_groups set starts_at=starts where id=slot;
     delete from fb_lesson_moves where booking_id=b.id;
   end if;
 else raise exception 'Неизвестное действие.'; end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.fb_lesson_dashboard(),public.fb_lesson_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.fb_lesson_dashboard(),public.fb_lesson_action(text,jsonb) to authenticated;
commit;
