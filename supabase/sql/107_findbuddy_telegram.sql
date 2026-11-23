-- Run after 106. Telegram receives only summaries and links for the linked account.
begin;
alter table public.fb_telegram add column notices_enabled boolean not null default true;
alter table public.fb_telegram add column reminders_enabled boolean not null default true;

create function public.fb_telegram_bot(p_chat bigint,p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare account fb_telegram; u uuid; payload jsonb;
begin
  select * into account from fb_telegram where chat_id=p_chat;
  if not found then return jsonb_build_object('linked',false); end if;
  u:=account.user_id;
  if p_action='unlink' then
    delete from fb_telegram where user_id=u and chat_id=p_chat;
    return jsonb_build_object('linked',false);
  elsif p_action in ('notices_on','notices_off','reminders_on','reminders_off') then
    update fb_telegram set
      notices_enabled=case when p_action in ('notices_on','notices_off') then p_action='notices_on' else notices_enabled end,
      reminders_enabled=case when p_action in ('reminders_on','reminders_off') then p_action='reminders_on' else reminders_enabled end
    where user_id=u and chat_id=p_chat returning * into account;
    if not found then return jsonb_build_object('linked',false); end if;
  end if;
  payload:=jsonb_build_object('linked',true,'notices',account.notices_enabled,'reminders',account.reminders_enabled);
  if p_action='lessons' then
    return payload || jsonb_build_object('lessons',coalesce((
      select jsonb_agg(to_jsonb(lesson) order by lesson.starts_at) from (
        select id,title,starts_at from (
          select distinct on (case when tutor_id=u then coalesce(group_id,id) else id end)
            id,coalesce(lesson_title,subject) as title,starts_at
          from fb_bookings where u in(student_id,tutor_id) and status<>'cancelled' and starts_at>now()-interval '60 minutes'
          order by (case when tutor_id=u then coalesce(group_id,id) else id end),id
        ) unique_lessons order by starts_at limit 6
      ) lesson
    ),'[]'::jsonb));
  elsif p_action='inbox' then
    return payload || jsonb_build_object(
      'threads',coalesce((
        select jsonb_agg(to_jsonb(item)) from (
          select t.id,case when t.student_id=u then ft.display_name else coalesce(n.name,'Ученик') end as name,
            (select count(*) from fb_direct_messages m where m.thread_id=t.id and m.sender_id<>u and m.id>
            case when t.student_id=u then t.student_seen else t.tutor_seen end) as unread
          from fb_threads t join fb_tutors ft on ft.id=t.tutor_id left join fb_student_names n on n.id=t.student_id
          where u in(t.student_id,t.tutor_id) order by unread desc,t.created_at desc limit 5
        ) item
      ),'[]'::jsonb),
      'lesson_chats',coalesce((
        select jsonb_agg(to_jsonb(item)) from (
          select b.id,coalesce(b.lesson_title,b.subject) as title,b.starts_at from fb_bookings b
          where u in(b.student_id,b.tutor_id) and b.status<>'cancelled' order by b.created_at desc limit 4
        ) item
      ),'[]'::jsonb));
  end if;
  return payload;
end $$;
revoke all on function public.fb_telegram_bot(bigint,text) from public,anon,authenticated;
grant execute on function public.fb_telegram_bot(bigint,text) to service_role;

create table public.fb_telegram_reminders (
  user_id uuid not null references auth.users on delete cascade,
  lesson_key uuid not null,
  starts_at timestamptz not null,
  lead_minutes integer not null check(lead_minutes in (60,15)),
  claim uuid not null,
  lease_until timestamptz not null,
  delivered boolean not null default false,
  primary key(user_id,lesson_key,starts_at,lead_minutes)
);
alter table public.fb_telegram_reminders enable row level security;
revoke all on public.fb_telegram_reminders from public,anon,authenticated;
create index fb_telegram_reminders_start on public.fb_telegram_reminders(starts_at);
create index fb_active_bookings_reminder_window on public.fb_bookings(starts_at) where status<>'cancelled';

create function public.fb_telegram_claim_reminders() returns jsonb
language plpgsql security definer set search_path=public as $$
declare claimed jsonb; stamp timestamptz:=now();
begin
  delete from fb_telegram_reminders where starts_at<stamp-interval '7 days';
  with upcoming as (
    select b.* from fb_bookings b where status<>'cancelled' and starts_at>stamp and starts_at<=stamp+interval '60 minutes'
  ), unique_lessons as (
    select distinct on (recipient,lesson_key,starts_at)
      b.id as booking_id,b.starts_at,coalesce(b.lesson_title,b.subject) as title,recipient,lesson_key,tg.chat_id
    from upcoming b
    cross join lateral (values(b.student_id,b.id),(b.tutor_id,coalesce(b.group_id,b.id))) recipients(recipient,lesson_key)
    join fb_telegram tg on tg.user_id=recipient and tg.reminders_enabled and tg.chat_id is not null
    order by recipient,lesson_key,starts_at,b.id
  ), due as (
    select ul.*,case when ul.starts_at<=stamp+interval '15 minutes' then 15 else 60 end as lead
    from unique_lessons ul where (ul.starts_at<=stamp+interval '15 minutes' or ul.starts_at>stamp+interval '20 minutes')
  ), available as (
    select d.* from due d left join fb_telegram_reminders existing
      on (existing.user_id,existing.lesson_key,existing.starts_at,existing.lead_minutes)=(d.recipient,d.lesson_key,d.starts_at,d.lead)
    where existing.claim is null or (not existing.delivered and existing.lease_until<=stamp)
    order by d.starts_at,d.recipient limit 20
  ), leases as (
    insert into fb_telegram_reminders(user_id,lesson_key,starts_at,lead_minutes,claim,lease_until)
    select recipient,lesson_key,starts_at,lead,gen_random_uuid(),stamp+interval '4 minutes' from available
    on conflict(user_id,lesson_key,starts_at,lead_minutes) do update set claim=excluded.claim,lease_until=excluded.lease_until
      where not fb_telegram_reminders.delivered and fb_telegram_reminders.lease_until<=stamp
    returning user_id,lesson_key,starts_at,lead_minutes,claim
  )
  select coalesce(jsonb_agg(jsonb_build_object('claim',l.claim,'booking_id',a.booking_id,'chat_id',a.chat_id,'starts_at',a.starts_at,'title',a.title)),'[]'::jsonb)
  into claimed from leases l join available a
    on (l.user_id,l.lesson_key,l.starts_at,l.lead_minutes)=(a.recipient,a.lesson_key,a.starts_at,a.lead);
  return claimed;
end $$;
create unique index fb_telegram_reminder_claim on public.fb_telegram_reminders(claim);
create function public.fb_telegram_finish_reminder(p_claim uuid,p_delivered boolean) returns void
language sql security definer set search_path=public as $$
  update fb_telegram_reminders set delivered=p_delivered,lease_until=now()+interval '5 minutes' where claim=p_claim and not delivered
$$;
revoke all on function public.fb_telegram_claim_reminders(),public.fb_telegram_finish_reminder(uuid,boolean) from public,anon,authenticated;
grant execute on function public.fb_telegram_claim_reminders(),public.fb_telegram_finish_reminder(uuid,boolean) to service_role;

create or replace function public.fb_direct_notice(p_thread uuid,p_sender uuid) returns bigint
language sql stable security definer set search_path=public as $$
  select tg.chat_id from fb_threads t join fb_telegram tg
    on tg.user_id=case when t.student_id=p_sender then t.tutor_id else t.student_id end
  where t.id=p_thread and p_sender in(t.student_id,t.tutor_id) and tg.notices_enabled
$$;
commit;
