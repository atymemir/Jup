-- In-app event history. Apply once after 20261123175841; no production Auth changes.
begin;
create table public.fb_notifications (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 context text not null default '' check(length(context)<=160),
 entity_id uuid not null,
 event_key text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,event_key)
);
create index fb_notifications_owner on public.fb_notifications(user_id,id desc);
create index fb_notifications_entity on public.fb_notifications(entity_id,kind);
create index fb_notifications_unread on public.fb_notifications(user_id,id desc) where read_at is null;
alter table public.fb_notifications enable row level security;
revoke all on public.fb_notifications from public,anon,authenticated;
revoke all on sequence public.fb_notifications_id_seq from public,anon,authenticated;

create function public.fb_record_notification(p_user uuid,p_kind text,p_entity uuid,p_event text) returns void
language sql security definer set search_path=public,pg_temp as $$
 insert into fb_notifications(user_id,kind,entity_id,event_key,context)
 select p_user,p_kind,p_entity,p_event,left(coalesce(case
  when p_kind in('booking_confirmed','booking_cancelled','booking_moved','lesson_message','move_requested','move_declined','move_withdrawn','homework_received','homework_feedback','lesson_updated','lesson_soon','lesson_outcome','lesson_problem') then (select coalesce(lesson_title,subject) from fb_bookings where id=p_entity)
  when p_kind in('request_received','offer_received','offer_declined') then (select subject from fb_requests where id=p_entity)
  when p_kind='direct_message' then (select case when t.student_id=p_user then teacher.display_name else student.name end from fb_threads t join fb_tutors teacher on teacher.id=t.tutor_id left join fb_student_names student on student.id=t.student_id where t.id=p_entity)
  when p_kind='organization_message' then (select o.name from fb_org_threads t join fb_organizations o on o.id=t.organization_id where t.id=p_entity)
  when p_kind in('teacher_review','profile_approved','profile_rejected','profile_pending') then (select display_name from fb_tutors where id=p_entity)
  when p_kind in('organization_review','organization_approved','organization_rejected','organization_pending') then (select name from fb_organizations where id=p_entity)
 end,''),160) where p_user is not null and exists(select 1 from auth.users where id=p_user)
 on conflict(user_id,event_key) do nothing;
$$;
revoke all on function public.fb_record_notification(uuid,text,uuid,text) from public,anon,authenticated;

create function public.fb_notification_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare b fb_bookings; peer uuid; kind text; event text; room uuid;
begin
 if tg_op='DELETE' and tg_table_name='fb_lesson_moves' then
  select * into b from fb_bookings where id=old.booking_id;
  update fb_notifications set read_at=coalesce(read_at,now()) where entity_id=old.booking_id and fb_notifications.kind='move_requested';
  if b.status<>'cancelled' and b.starts_at is distinct from old.starts_at then
   peer:=case when auth.uid()=old.proposed_by then case when b.student_id=old.proposed_by then b.tutor_id else b.student_id end else old.proposed_by end;
   kind:=case when auth.uid()=old.proposed_by then 'move_withdrawn' else 'move_declined' end;
   perform fb_record_notification(peer,kind,b.id,kind||':'||old.id);
  end if;
  return old;
 elsif tg_table_name='fb_reports' then
  if tg_op='INSERT' then
   for peer in select id from fb_accounts where role in('owner','moderator') loop
    perform fb_record_notification(peer,'report_received',new.id,'report:'||new.id);
   end loop;
  elsif new.resolved and not old.resolved then
   update fb_notifications set read_at=coalesce(read_at,now()) where entity_id=new.id and fb_notifications.kind='report_received';
   perform fb_record_notification(new.reporter,'report_resolved',new.id,'report-resolved:'||new.id);
  end if;
 elsif tg_table_name='fb_invitations' then
  if new.accepted_by is not null and old.accepted_by is null then
   perform fb_record_notification(new.created_by,'invitation_accepted',new.id,'invitation-accepted:'||new.id);
  end if;
 elsif tg_table_name='fb_bookings' then
  if tg_op='INSERT' then kind:='booking_confirmed';
  elsif new.status is distinct from old.status and new.status='cancelled' then kind:='booking_cancelled';
  elsif new.starts_at is distinct from old.starts_at then kind:='booking_moved';
  else return new; end if;
  if tg_op='UPDATE' then
   update fb_notifications set read_at=coalesce(read_at,now()) where fb_notifications.entity_id=new.id and fb_notifications.kind in('lesson_soon','move_requested');
  end if;
  event:='booking:'||new.id||':'||kind||':'||new.calendar_sequence;
  perform fb_record_notification(new.student_id,kind,new.id,event);
  perform fb_record_notification(new.tutor_id,kind,new.id,event);
 elsif tg_table_name='fb_requests' then
  if new.tutor_id is not null then perform fb_record_notification(new.tutor_id,'request_received',new.id,'request:'||new.id); end if;
 elsif tg_table_name='fb_offers' then
  select student_id into peer from fb_requests where id=new.request_id;
  if tg_op='INSERT' then
   perform fb_record_notification(peer,'offer_received',new.request_id,'offer:'||new.id);
  elsif new.status is distinct from old.status and new.status='declined' then
   perform fb_record_notification(new.tutor_id,'offer_declined',new.request_id,'offer-declined:'||new.id);
  end if;
 elsif tg_table_name='fb_org_messages' then
  select case when t.student_id=new.sender_id then o.owner_id else t.student_id end into peer from fb_org_threads t join fb_organizations o on o.id=t.organization_id where t.id=new.thread_id;
  perform fb_record_notification(peer,'organization_message',new.thread_id,'org-message:'||new.id);
 elsif tg_table_name='fb_organizations' then
  if tg_op='INSERT' or new.status is distinct from old.status then
   kind:=case new.status when 'verified' then 'organization_approved' when 'rejected' then 'organization_rejected' else 'organization_pending' end;
   perform fb_record_notification(new.owner_id,kind,new.id,'organization:'||new.id||':'||new.verification_revision||':'||new.status);
   if new.status<>'pending' then update fb_notifications set read_at=coalesce(read_at,now()) where entity_id=new.id and fb_notifications.kind='organization_review'; end if;
   if new.status='pending' then
    for peer in select id from fb_accounts where role in('owner','moderator') loop
     perform fb_record_notification(peer,'organization_review',new.id,'review-org:'||new.id||':'||new.verification_revision);
    end loop;
   end if;
  end if;
 elsif tg_table_name='fb_direct_messages' then
  select case when student_id=new.sender_id then tutor_id else student_id end into peer from fb_threads where id=new.thread_id;
  perform fb_record_notification(peer,'direct_message',new.thread_id,'direct:'||new.id);
 elsif tg_table_name='fb_messages' then
  select * into b from fb_bookings where id=new.booking_id;
  peer:=case when b.student_id=new.sender_id then b.tutor_id else b.student_id end;
  perform fb_record_notification(peer,'lesson_message',b.id,'message:'||new.id);
 elsif tg_table_name='fb_lesson_moves' then
  select * into b from fb_bookings where id=new.booking_id;
  peer:=case when b.student_id=new.proposed_by then b.tutor_id else b.student_id end;
  if tg_op='INSERT' or new.id is distinct from old.id or new.starts_at is distinct from old.starts_at then
   perform fb_record_notification(peer,'move_requested',b.id,'move:'||new.id||':'||extract(epoch from new.starts_at)::bigint);
  end if;
 elsif tg_table_name='fb_tutors' then
  if tg_op='INSERT' or new.verification is distinct from old.verification then
   kind:=case new.verification when 'verified' then 'profile_approved' when 'rejected' then 'profile_rejected' else 'profile_pending' end;
   perform fb_record_notification(new.id,kind,new.id,'profile:'||new.id||':'||new.verification_revision||':'||new.verification);
   if new.verification<>'pending' then update fb_notifications set read_at=coalesce(read_at,now()) where entity_id=new.id and fb_notifications.kind='teacher_review'; end if;
   if new.verification='pending' then
    for peer in select id from fb_accounts where role in('owner','moderator') loop
     perform fb_record_notification(peer,'teacher_review',new.id,'review-teacher:'||new.id||':'||new.verification_revision);
    end loop;
   end if;
  end if;
 elsif tg_table_name='fb_lesson_outcomes' then
  select * into b from fb_bookings where id=new.booking_id;
  if new.teacher_revision is distinct from old.teacher_revision and new.teacher_response<>'pending' then
   kind:=case when new.teacher_response='problem' then 'lesson_problem' else 'lesson_outcome' end;
   perform fb_record_notification(b.student_id,kind,b.id,'outcome-teacher:'||b.id||':'||new.teacher_revision);
  end if;
  if new.student_revision is distinct from old.student_revision and new.student_response<>'pending' then
   kind:=case when new.student_response='problem' then 'lesson_problem' else 'lesson_outcome' end;
   perform fb_record_notification(b.tutor_id,kind,b.id,'outcome-student:'||b.id||':'||new.student_revision);
  end if;
 elsif tg_table_name='fb_lesson_work' then
  select * into b from fb_bookings where id=new.booking_id;
  if tg_op='INSERT' or new.answer is distinct from old.answer then
   perform fb_record_notification(b.tutor_id,'homework_received',b.id,'homework:'||b.id||':'||new.revision);
  end if;
  if tg_op='UPDATE' and new.feedback is distinct from old.feedback and new.feedback<>'' then
   perform fb_record_notification(b.student_id,'homework_feedback',b.id,'feedback:'||b.id||':'||new.revision);
  end if;
 elsif tg_table_name='fb_lesson_rooms' then
  if tg_op='INSERT' or (new.plan,new.material,new.meeting,new.location,new.homework,new.recap) is distinct from (old.plan,old.material,old.meeting,old.location,old.homework,old.recap) then
   for b in select * from fb_bookings where status<>'cancelled' and (id=new.booking_id or group_id=new.slot_id) loop
    perform fb_record_notification(b.student_id,'lesson_updated',b.id,'room:'||new.id||':'||new.revision);
   end loop;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.fb_notification_event() from public,anon,authenticated;
create trigger fb_notify_report after insert or update on public.fb_reports for each row execute function fb_notification_event();
create trigger fb_notify_invitation after update on public.fb_invitations for each row execute function fb_notification_event();
create trigger fb_notify_booking after insert or update on public.fb_bookings for each row execute function fb_notification_event();
create trigger fb_notify_request after insert on public.fb_requests for each row execute function fb_notification_event();
create trigger fb_notify_offer after insert or update on public.fb_offers for each row execute function fb_notification_event();
create trigger fb_notify_org_message after insert on public.fb_org_messages for each row execute function fb_notification_event();
create trigger fb_notify_organization after insert or update on public.fb_organizations for each row execute function fb_notification_event();
create trigger fb_notify_direct after insert on public.fb_direct_messages for each row execute function fb_notification_event();
create trigger fb_notify_message after insert on public.fb_messages for each row execute function fb_notification_event();
create trigger fb_notify_move after insert or update or delete on public.fb_lesson_moves for each row execute function fb_notification_event();
create trigger fb_notify_profile after insert or update on public.fb_tutors for each row execute function fb_notification_event();
create trigger fb_notify_outcome after update on public.fb_lesson_outcomes for each row execute function fb_notification_event();
create trigger fb_notify_work after insert or update on public.fb_lesson_work for each row execute function fb_notification_event();
create trigger fb_notify_room after insert or update on public.fb_lesson_rooms for each row execute function fb_notification_event();

create function public.fb_notifications(p_action text default 'list',p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb; b fb_bookings;
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
 if p_action='read' then
  if jsonb_typeof(p_data->'ids') is distinct from 'array' then raise exception 'Выберите уведомления.'; end if;
  if jsonb_array_length(p_data->'ids')>100 then raise exception 'Слишком много уведомлений.'; end if;
  update fb_notifications set read_at=coalesce(read_at,now()) where user_id=u and id in(select value::bigint from jsonb_array_elements_text(p_data->'ids'));
 elsif p_action<>'list' then raise exception 'Неизвестное действие.'; end if;
 -- In-app reminders are prepared when the user checks their notifications.
 -- External scheduled delivery is a separate Telegram concern.
 for b in select * from fb_bookings where status<>'cancelled' and u in(student_id,tutor_id) and starts_at>now() and starts_at<=now()+interval '24 hours' loop
  perform fb_record_notification(u,'lesson_soon',b.id,'soon:'||b.id||':'||extract(epoch from b.starts_at)::bigint);
 end loop;
 select jsonb_build_object(
  'unread',(select count(*) from fb_notifications where user_id=u and read_at is null),
  'items',coalesce(jsonb_agg(to_jsonb(n)-'user_id'-'event_key' order by n.id desc),'[]'::jsonb)
 ) into result from (
  select * from fb_notifications where user_id=u
   and (not coalesce((p_data->>'unread')::boolean,false) or read_at is null)
   and (p_data->>'before' is null or id<(p_data->>'before')::bigint)
  order by id desc limit 50
 ) n;
 return result;
end $$;
revoke all on function public.fb_notifications(text,jsonb) from public,anon;
grant execute on function public.fb_notifications(text,jsonb) to authenticated;
commit;
