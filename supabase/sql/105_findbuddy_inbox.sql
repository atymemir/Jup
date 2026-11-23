-- Run after 104. Direct contacts are scoped to their two participants.
begin;
create table public.fb_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users on delete cascade,
  tutor_id uuid not null references public.fb_tutors on delete cascade,
  created_at timestamptz not null default now(),
  student_seen bigint not null default 0,
  tutor_seen bigint not null default 0,
  student_blocked boolean not null default false,
  tutor_blocked boolean not null default false,
  unique(student_id,tutor_id),
  check(student_id<>tutor_id)
);
create index fb_threads_tutor on public.fb_threads(tutor_id);
create table public.fb_direct_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.fb_threads on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  client_id uuid not null,
  body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),
  unique(sender_id,client_id)
);
create index fb_direct_timeline on public.fb_direct_messages(thread_id,id desc);
create index fb_direct_sender on public.fb_direct_messages(sender_id,created_at desc);
alter table public.fb_threads enable row level security;
alter table public.fb_direct_messages enable row level security;
revoke all on public.fb_threads,public.fb_direct_messages from public,anon,authenticated;

create function public.fb_inbox(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  u uuid:=auth.uid(); thread fb_threads; peer uuid; body_text text; sent bigint; seen bigint; result jsonb; changed boolean;
begin
  if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
  if p_action='list' then
    select jsonb_build_object('unread',coalesce(sum(q.unread),0),'threads',coalesce(jsonb_agg(to_jsonb(q) order by q.last_at desc),'[]'::jsonb))
    into result from (
      select t.id, t.student_id=u as as_student,
        case when t.student_id=u then t.tutor_id else t.student_id end as peer_id,
        case when t.student_id=u then tutor.display_name else coalesce(s.name,'Ученик '||left(t.student_id::text,4)) end as peer_name,
        latest.body as last_body, latest.created_at as last_at,
        (select count(*) from fb_direct_messages m where m.thread_id=t.id and m.sender_id<>u
          and m.id>case when t.student_id=u then t.student_seen else t.tutor_seen end) as unread
      from fb_threads t
      join fb_tutors tutor on tutor.id=t.tutor_id
      left join fb_student_names s on s.id=t.student_id
      join lateral(select m.body,m.created_at from fb_direct_messages m where m.thread_id=t.id order by m.id desc limit 1) latest on true
      where u in(t.student_id,t.tutor_id)
    ) q;
    return result;
  end if;

  if p_action='send' then
    perform pg_advisory_xact_lock(hashtextextended(u::text,105));
  end if;
  if p_action='send' and (p_input->>'id') is null then
    peer:=(p_input->>'tutor_id')::uuid;
    if peer=u or not exists(select 1 from fb_tutors where id=peer and verification='verified') then
      raise exception 'Преподаватель недоступен для переписки.' using errcode='42501';
    end if;
    select * into thread from fb_threads where student_id=u and tutor_id=peer for update;
    if not found then
      if (select count(*) from fb_threads where student_id=u and created_at>now()-interval '1 day')>=12 then
        raise exception 'Сегодня вы открыли слишком много новых диалогов.';
      end if;
      insert into fb_threads(student_id,tutor_id) values(u,peer) returning * into thread;
    end if;
  elsif p_action in ('read','send','seen','block') then
    if p_action='read' then
      select * into thread from fb_threads where id=(p_input->>'id')::uuid and u in(student_id,tutor_id);
    else
      select * into thread from fb_threads where id=(p_input->>'id')::uuid and u in(student_id,tutor_id) for update;
    end if;
    if not found then raise exception 'Диалог недоступен.' using errcode='42501'; end if;
  else
    raise exception 'Неизвестное действие.';
  end if;

  if p_action='read' then
    select jsonb_build_object('messages',coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb),'more',count(*)=50)
      into result from(
        select d.id,d.sender_id,d.body,d.created_at from fb_direct_messages d
        where d.thread_id=thread.id and ((p_input->>'before') is null or d.id<(p_input->>'before')::bigint)
        order by d.id desc limit 50
      ) m;
    return result || jsonb_build_object('blocked',thread.student_blocked or thread.tutor_blocked,
      'blocked_by_me',case when u=thread.student_id then thread.student_blocked else thread.tutor_blocked end);
  elsif p_action='send' then
    select m.id into sent from fb_direct_messages m where m.thread_id=thread.id and m.sender_id=u and m.client_id=(p_input->>'client_id')::uuid;
    if found then return jsonb_build_object('id',thread.id,'message_id',sent); end if;
    if thread.student_blocked or thread.tutor_blocked then raise exception 'Переписка приостановлена.'; end if;
    body_text:=trim(p_input->>'body');
    if coalesce(length(body_text),0) not between 1 and 2000 then raise exception 'Введите сообщение до 2000 символов.'; end if;
    if (select count(*) from fb_direct_messages where sender_id=u and created_at>now()-interval '1 minute')>=12 then
      raise exception 'Слишком много сообщений. Попробуйте через минуту.';
    end if;
    insert into fb_direct_messages(thread_id,sender_id,client_id,body)
      values(thread.id,u,(p_input->>'client_id')::uuid,body_text) returning id into sent;
    return jsonb_build_object('id',thread.id,'message_id',sent,'new_message',true);
  elsif p_action='seen' then
    select id into seen from fb_direct_messages where id=(p_input->>'message_id')::bigint and thread_id=thread.id;
    if found then
      if u=thread.student_id then update fb_threads set student_seen=greatest(student_seen,seen) where id=thread.id;
      else update fb_threads set tutor_seen=greatest(tutor_seen,seen) where id=thread.id; end if;
    end if;
  elsif p_action='block' then
    changed:=(p_input->>'value')::boolean;
    if changed is null then raise exception 'Выберите действие для диалога.'; end if;
    if u=thread.student_id then update fb_threads set student_blocked=changed where id=thread.id;
    else update fb_threads set tutor_blocked=changed where id=thread.id; end if;
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.fb_inbox(text,jsonb) from public,anon,authenticated;
grant execute on function public.fb_inbox(text,jsonb) to authenticated;

-- These ids are only available to the app server when relaying a new-message notification.
create function public.fb_direct_notice(p_thread uuid,p_sender uuid) returns bigint
language sql stable security definer set search_path=public as $$
  select tg.chat_id from fb_threads t join fb_telegram tg
    on tg.user_id=case when t.student_id=p_sender then t.tutor_id else t.student_id end
  where t.id=p_thread and p_sender in(t.student_id,t.tutor_id)
$$;
revoke all on function public.fb_direct_notice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fb_direct_notice(uuid,uuid) to service_role;
commit;
