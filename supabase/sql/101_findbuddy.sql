-- findbuddy: isolated marketplace. No payment state can be changed by a client.
begin;
create table public.fb_tutors (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 2 and 70),
  headline text not null check (length(headline) between 5 and 120),
  bio text not null check (length(bio) between 20 and 1500),
  subject text not null check (subject in ('География','Математика','Английский','История Казахстана','Физика','Химия','Биология','Информатика')),
  exam text not null check (exam in ('ЕНТ','IELTS','SAT','Школьная программа')),
  language text not null check (language in ('Русский','Қазақша','English')),
  city text not null check (city in ('Онлайн','Алматы','Астана','Шымкент','Караганда','Другой город')),
  price integer not null check (price between 500 and 100000),
  experience integer not null check (experience between 0 and 60),
  verification text not null default 'pending' check (verification in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);
-- Verification evidence stays private. Only operators may write this audit trail.
create table public.fb_verifications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.fb_tutors(id) on delete cascade,
  operator_reference text not null,
  decision text not null check (decision in ('verified','rejected')),
  created_at timestamptz not null default now()
);
create table public.fb_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  tutor_id uuid references public.fb_tutors(id) on delete cascade,
  subject text not null check (subject in ('География','Математика','Английский','История Казахстана','Физика','Химия','Биология','Информатика')),
  exam text not null check (exam in ('ЕНТ','IELTS','SAT','Школьная программа')),
  language text not null check (language in ('Русский','Қазақша','English')),
  city text not null check (city in ('Онлайн','Алматы','Астана','Шымкент','Караганда','Другой город')),
  budget integer not null check (budget between 500 and 100000),
  goal text not null check (length(goal) between 10 and 1000),
  status text not null default 'open' check (status in ('open','matched','closed')),
  created_at timestamptz not null default now()
);
create table public.fb_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fb_requests(id) on delete cascade,
  tutor_id uuid not null references public.fb_tutors(id) on delete cascade,
  price integer not null check (price between 500 and 100000),
  starts_at timestamptz not null,
  note text not null check (length(note) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  unique(request_id, tutor_id)
);
create table public.fb_groups (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.fb_tutors(id) on delete cascade,
  title text not null check (length(title) between 5 and 120),
  description text not null check (length(description) between 20 and 1500),
  price integer not null check (price between 500 and 100000),
  capacity integer not null check (capacity between 2 and 12),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.fb_bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  tutor_id uuid not null references public.fb_tutors(id) on delete cascade,
  offer_id uuid unique references public.fb_offers(id) on delete cascade,
  group_id uuid references public.fb_groups(id) on delete cascade,
  subject text not null,
  price integer not null check (price between 500 and 100000),
  commission integer generated always as (round(price::numeric * 0.05)::integer) stored,
  tutor_net integer generated always as (price - round(price::numeric * 0.05)::integer) stored,
  starts_at timestamptz not null,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','cancelled')),
  created_at timestamptz not null default now(),
  check (student_id <> tutor_id),
  check ((offer_id is null) <> (group_id is null))
);
create unique index fb_group_student_active on public.fb_bookings(group_id,student_id) where group_id is not null and status <> 'cancelled';
create index fb_booking_teacher_time on public.fb_bookings(tutor_id, starts_at) where status <> 'cancelled';
create index fb_requests_student on public.fb_requests(student_id, created_at desc);
create index fb_offers_teacher on public.fb_offers(tutor_id);
create table public.fb_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.fb_bookings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  telegram_update_id bigint unique,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index fb_messages_booking on public.fb_messages(booking_id, created_at);
create table public.fb_telegram (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint unique,
  link_token uuid unique,
  expires_at timestamptz
);
-- No direct DML grants: all writes go through the guarded RPC below.
alter table public.fb_tutors enable row level security;
alter table public.fb_verifications enable row level security;
alter table public.fb_requests enable row level security;
alter table public.fb_offers enable row level security;
alter table public.fb_groups enable row level security;
alter table public.fb_bookings enable row level security;
alter table public.fb_messages enable row level security;
alter table public.fb_telegram enable row level security;
revoke all on public.fb_tutors,public.fb_verifications,public.fb_requests,public.fb_offers,public.fb_groups,public.fb_bookings,public.fb_messages,public.fb_telegram from anon,authenticated;
grant select on public.fb_tutors,public.fb_groups to anon,authenticated;
create policy fb_tutors_read on public.fb_tutors for select using (verification = 'verified' or id = auth.uid());
create policy fb_groups_read on public.fb_groups for select using (exists(select 1 from public.fb_tutors t where t.id=tutor_id and t.verification='verified'));

create function public.fb_catalog() returns jsonb language sql stable security definer set search_path = public as $$
 select jsonb_build_object(
 'tutors',coalesce((select jsonb_agg(to_jsonb(t) - 'created_at' order by t.price) from public.fb_tutors t where verification='verified'),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g) || jsonb_build_object('subject',t.subject,'exam',t.exam,'language',t.language,'city',t.city,'reserved',(select count(*) from public.fb_bookings b where b.group_id=g.id and b.status<>'cancelled')) order by g.starts_at) from public.fb_groups g join public.fb_tutors t on t.id=g.tutor_id where t.verification='verified' and g.starts_at>now()),'[]'::jsonb));
$$;
revoke all on function public.fb_catalog() from public;
grant execute on function public.fb_catalog() to anon,authenticated;

create function public.fb_dashboard() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
 return jsonb_build_object(
 'tutor',(select to_jsonb(t) from public.fb_tutors t where t.id=u),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.fb_requests r where r.student_id=u or exists(select 1 from public.fb_offers o where o.request_id=r.id and o.tutor_id=u) or (exists(select 1 from public.fb_tutors t where t.id=u and t.verification='verified' and t.subject=r.subject and t.exam=r.exam and t.language=r.language and t.city=r.city) and (r.tutor_id=u or (r.tutor_id is null and r.status='open')))),'[]'::jsonb),
 'offers',coalesce((select jsonb_agg(to_jsonb(o)) from public.fb_offers o join public.fb_requests r on r.id=o.request_id where o.tutor_id=u or r.student_id=u),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.starts_at) from public.fb_bookings b where b.student_id=u or b.tutor_id=u),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.fb_messages m join public.fb_bookings b on b.id=m.booking_id where b.student_id=u or b.tutor_id=u),'[]'::jsonb),
 'telegram_connected',exists(select 1 from public.fb_telegram where user_id=u and chat_id is not null));
end $$;
revoke all on function public.fb_dashboard() from public;
grant execute on function public.fb_dashboard() to authenticated;

create function public.fb_action(p_action text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
 u uuid := auth.uid(); t public.fb_tutors; r public.fb_requests; o public.fb_offers; g public.fb_groups; b public.fb_bookings;
 result_id uuid; starts timestamptz; amount integer; target uuid; token uuid;
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
 -- Serialize per user for limits and idempotent state transitions.
 perform pg_advisory_xact_lock(hashtextextended(u::text,101));
 select * into t from public.fb_tutors where id=u;
 if p_action='apply' then
  if p_data->>'adult_consent' is distinct from 'true' then raise exception 'Преподаватель должен быть старше 18 лет.'; end if;
  if t.id is not null then raise exception 'Анкета уже отправлена. Изменения через поддержку.'; end if;
  insert into public.fb_tutors(id,display_name,headline,bio,subject,exam,language,city,price,experience)
  values(u,trim(p_data->>'display_name'),trim(p_data->>'headline'),trim(p_data->>'bio'),p_data->>'subject',p_data->>'exam',p_data->>'language',p_data->>'city',(p_data->>'price')::integer,(p_data->>'experience')::integer) returning id into result_id;
 elsif p_action='request' then
  if (select count(*) from public.fb_requests where student_id=u and created_at>now()-interval '1 day') >= 10 then raise exception 'Лимит: 10 заявок в сутки.'; end if;
  target := nullif(p_data->>'tutor_id','')::uuid;
  if target=u then raise exception 'Выберите другого преподавателя.'; end if;
  if target is not null and not exists(select 1 from public.fb_tutors where id=target and verification='verified') then raise exception 'Преподаватель недоступен.'; end if;
  if target is not null and not exists(select 1 from public.fb_tutors where id=target and subject=p_data->>'subject' and exam=p_data->>'exam' and language=p_data->>'language' and city=p_data->>'city') then raise exception 'Предмет, экзамен, язык и город должны соответствовать анкете преподавателя.'; end if;
  insert into public.fb_requests(student_id,tutor_id,subject,exam,language,city,budget,goal)
  values(u,target,p_data->>'subject',p_data->>'exam',p_data->>'language',p_data->>'city',(p_data->>'budget')::integer,trim(p_data->>'goal')) returning id into result_id;
 elsif p_action='offer' then
  if t.verification is distinct from 'verified' then raise exception 'Сначала подтвердите личность.' using errcode='42501'; end if;
  select * into r from public.fb_requests where id=(p_data->>'request_id')::uuid for update;
  if r.id is null or r.status<>'open' or r.student_id=u or (r.tutor_id is not null and r.tutor_id<>u) then raise exception 'Заявка недоступна.'; end if;
  if t.subject<>r.subject or t.exam<>r.exam or t.language<>r.language or t.city<>r.city then raise exception 'Заявка не соответствует вашей анкете.'; end if;
  starts := (p_data->>'starts_at')::timestamptz;
  if starts is null or starts<now()+interval '30 minutes' then raise exception 'До занятия должно быть не менее 30 минут.'; end if;
  insert into public.fb_offers(request_id,tutor_id,price,starts_at,note) values(r.id,u,(p_data->>'price')::integer,starts,trim(p_data->>'note')) returning id into result_id;
 elsif p_action in ('accept','join') then
  if (select count(*) from public.fb_bookings where student_id=u and status='awaiting_payment' and starts_at>now())>=10 then raise exception 'Лимит: 10 будущих записей. Отмените лишние записи.'; end if;
  if p_action='accept' then
   select * into o from public.fb_offers where id=(p_data->>'id')::uuid;
   -- Always acquire request lock before offer lock (same order as offer creation).
   select * into r from public.fb_requests where id=o.request_id for update;
   select * into o from public.fb_offers where id=o.id for update;
   if r.student_id is distinct from u or r.status<>'open' or o.status<>'pending' then raise exception 'Предложение недоступно.'; end if;
   target:=o.tutor_id; starts:=o.starts_at; amount:=o.price;
  else
   select * into g from public.fb_groups where id=(p_data->>'id')::uuid for update;
   if g.id is null then raise exception 'Группа недоступна.'; end if;
   if (select count(*) from public.fb_bookings where group_id=g.id and status<>'cancelled')>=g.capacity then raise exception 'В группе нет свободных мест.'; end if;
   target:=g.tutor_id; starts:=g.starts_at; amount:=g.price;
  end if;
  if target=u or starts<now()+interval '30 minutes' then raise exception 'Занятие недоступно.'; end if;
  -- Serialize both participants in a stable order, including users who both teach and study.
  perform pg_advisory_xact_lock(hashtextextended(least(target,u)::text,102));
  perform pg_advisory_xact_lock(hashtextextended(greatest(target,u)::text,102));
  select * into t from public.fb_tutors where id=target;
  if t.verification is distinct from 'verified' then raise exception 'Преподаватель недоступен.'; end if;
  if exists(select 1 from public.fb_bookings x where x.status<>'cancelled' and x.starts_at<starts+interval '60 minutes' and x.starts_at+interval '60 minutes'>starts and (x.student_id=u or x.tutor_id=u or x.student_id=target or (x.tutor_id=target and (g.id is null or x.group_id is distinct from g.id)))) then raise exception 'Это время уже занято. Выберите другое занятие.'; end if;
  insert into public.fb_bookings(student_id,tutor_id,offer_id,group_id,subject,price,starts_at) values(u,target,o.id,g.id,t.subject,amount,starts) returning id into result_id;
  if p_action='accept' then
   update public.fb_offers set status=case when id=o.id then 'accepted' else 'declined' end where request_id=r.id;
   update public.fb_requests set status='matched' where id=r.id;
  end if;
 elsif p_action='group' then
  if t.verification is distinct from 'verified' then raise exception 'Сначала подтвердите личность.' using errcode='42501'; end if;
  starts := (p_data->>'starts_at')::timestamptz;
  if starts is null or starts<now()+interval '30 minutes' then raise exception 'До занятия должно быть не менее 30 минут.'; end if;
  if (select count(*) from public.fb_groups where tutor_id=u and starts_at>now())>=20 then raise exception 'Лимит: 20 будущих групп.'; end if;
  insert into public.fb_groups(tutor_id,title,description,price,capacity,starts_at) values(u,trim(p_data->>'title'),trim(p_data->>'description'),(p_data->>'price')::integer,(p_data->>'capacity')::integer,starts) returning id into result_id;
 elsif p_action='close_request' then
  update public.fb_requests set status='closed' where id=(p_data->>'id')::uuid and student_id=u and status='open' returning id into result_id;
  if result_id is null then raise exception 'Заявка недоступна.'; end if;
  update public.fb_offers set status='declined' where request_id=result_id;
 elsif p_action='cancel' then
  select * into b from public.fb_bookings where id=(p_data->>'id')::uuid for update;
  if b.id is null or (b.student_id<>u and b.tutor_id<>u) or b.status<>'awaiting_payment' then raise exception 'Запись недоступна.' using errcode='42501'; end if;
  update public.fb_bookings set status='cancelled' where id=b.id returning id into result_id;
 elsif p_action='message' then
  select * into b from public.fb_bookings where id=(p_data->>'booking_id')::uuid;
  if b.id is null or (b.student_id<>u and b.tutor_id<>u) or b.status='cancelled' then raise exception 'Чат недоступен.' using errcode='42501'; end if;
  if (select count(*) from public.fb_messages where sender_id=u and created_at>now()-interval '1 minute')>=10 then raise exception 'Не более 10 сообщений в минуту.'; end if;
  insert into public.fb_messages(booking_id,sender_id,body) values(b.id,u,trim(p_data->>'body')) returning id into result_id;
 elsif p_action='telegram_link' then
  token:=gen_random_uuid();
  insert into public.fb_telegram(user_id,link_token,expires_at) values(u,token,now()+interval '10 minutes') on conflict(user_id) do update set link_token=excluded.link_token,expires_at=excluded.expires_at;
  return jsonb_build_object('token',token);
 elsif p_action='telegram_unlink' then
  delete from public.fb_telegram where user_id=u;
 else raise exception 'Неизвестное действие.';
 end if;
 return jsonb_build_object('id',result_id);
end $$;
revoke all on function public.fb_action(text,jsonb) from public;
grant execute on function public.fb_action(text,jsonb) to authenticated;
-- Only the server's webhook can consume a link token. Never expose chat IDs.
create function public.fb_link_telegram(p_token uuid,p_chat_id bigint) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 update public.fb_telegram set chat_id=p_chat_id,link_token=null,expires_at=null where link_token=p_token and expires_at>now();
 get diagnostics changed = row_count;
 return changed=1;
end $$;
revoke all on function public.fb_link_telegram(uuid,bigint) from public,anon,authenticated;
grant execute on function public.fb_link_telegram(uuid,bigint) to service_role;
create function public.fb_bot_message(p_chat_id bigint,p_booking_id uuid,p_body text,p_update_id bigint) returns bigint language plpgsql security definer set search_path=public as $$
declare u uuid; b public.fb_bookings; recipient bigint; changed integer;
begin
 select user_id into u from public.fb_telegram where chat_id=p_chat_id;
 if u is null then raise exception 'Подключите аккаунт в findbuddy.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,101));
 select * into b from public.fb_bookings where id=p_booking_id;
 if b.id is null or (b.student_id<>u and b.tutor_id<>u) or b.status='cancelled' then raise exception 'Чат недоступен.'; end if;
 if p_update_id is null or p_update_id<0 then raise exception 'Некорректный Telegram update.'; end if;
 if (select count(*) from public.fb_messages where sender_id=u and created_at>now()-interval '1 minute')>=10 then raise exception 'Не более 10 сообщений в минуту.'; end if;
 insert into public.fb_messages(booking_id,sender_id,body,telegram_update_id) values(b.id,u,trim(p_body),p_update_id) on conflict(telegram_update_id) do nothing;
 get diagnostics changed = row_count;
 if changed=0 then return null; end if;
 select chat_id into recipient from public.fb_telegram where user_id=case when b.student_id=u then b.tutor_id else b.student_id end;
 return recipient;
end $$;
revoke all on function public.fb_bot_message(bigint,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.fb_bot_message(bigint,uuid,text,bigint) to service_role;
grant all on public.fb_tutors,public.fb_verifications,public.fb_requests,public.fb_offers,public.fb_groups,public.fb_bookings,public.fb_messages,public.fb_telegram to service_role;
commit;
