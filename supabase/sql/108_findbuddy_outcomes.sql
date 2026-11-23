-- Run after 107. Attendance statements are separate from payments and balances.
begin;
create table public.fb_lesson_outcomes (
  booking_id uuid primary key references public.fb_bookings on delete cascade,
  teacher_response text not null default 'pending' check(teacher_response in ('pending','completed','problem')),
  student_response text not null default 'pending' check(student_response in ('pending','completed','problem')),
  teacher_note text not null default '' check(length(teacher_note)<=1000),
  student_note text not null default '' check(length(student_note)<=1000),
  teacher_revision integer not null default 0,
  student_revision integer not null default 0,
  teacher_updated_at timestamptz,
  student_updated_at timestamptz,
  check((teacher_response='problem')=(length(teacher_note)>0)),
  check((student_response='problem')=(length(student_note)>0))
);
alter table public.fb_lesson_outcomes enable row level security;
revoke all on public.fb_lesson_outcomes from public,anon,authenticated;

create function public.fb_lesson_outcome(p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  u uuid:=auth.uid(); b fb_bookings; current_outcome fb_lesson_outcomes;
  response text:=p_data->>'response'; note text:=trim(coalesce(p_data->>'note',''));
  revision integer:=(p_data->>'revision')::integer;
begin
  if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
  select * into b from fb_bookings where id=(p_data->>'id')::uuid and u in(student_id,tutor_id) and status<>'cancelled' for update;
  if not found then raise exception 'Занятие недоступно.' using errcode='42501'; end if;
  if not isfinite(b.starts_at) or b.starts_at+interval '60 minutes'>now() then
    raise exception 'Подтвердить проведение можно после окончания занятия.';
  end if;
  if response is null or response not in ('pending','completed','problem') then
    raise exception 'Выберите результат занятия.';
  end if;
  if response='problem' and length(note) not between 10 and 1000 then
    raise exception 'Опишите проблему: от 10 до 1000 символов.';
  end if;
  if response<>'problem' then note:=''; end if;
  insert into fb_lesson_outcomes(booking_id) values(b.id) on conflict do nothing;
  select * into current_outcome from fb_lesson_outcomes where booking_id=b.id for update;
  if u=b.tutor_id then
    if current_outcome.teacher_response=response and current_outcome.teacher_note=note then return to_jsonb(current_outcome); end if;
    if revision is distinct from current_outcome.teacher_revision then
      raise exception 'Ваш ответ уже изменён в другой вкладке. Обновите занятие.';
    end if;
    update fb_lesson_outcomes set teacher_response=response,teacher_note=note,
      teacher_revision=teacher_revision+1,teacher_updated_at=now() where booking_id=b.id returning * into current_outcome;
  else
    if current_outcome.student_response=response and current_outcome.student_note=note then return to_jsonb(current_outcome); end if;
    if revision is distinct from current_outcome.student_revision then
      raise exception 'Ваш ответ уже изменён в другой вкладке. Обновите занятие.';
    end if;
    update fb_lesson_outcomes set student_response=response,student_note=note,
      student_revision=student_revision+1,student_updated_at=now() where booking_id=b.id returning * into current_outcome;
  end if;
  return to_jsonb(current_outcome);
end $$;
revoke all on function public.fb_lesson_outcome(jsonb) from public,anon,authenticated;
grant execute on function public.fb_lesson_outcome(jsonb) to authenticated;

-- Preserve the existing profile payload and add private statements for participants only.
alter function public.fb_profile_dashboard() rename to fb_profile_dashboard_before_outcomes;
revoke all on function public.fb_profile_dashboard_before_outcomes() from public,anon,authenticated;
create function public.fb_profile_dashboard() returns jsonb
language sql stable security definer set search_path=public as $$
  select fb_profile_dashboard_before_outcomes() || jsonb_build_object('outcomes',coalesce((
    select jsonb_agg(to_jsonb(o)) from fb_lesson_outcomes o join fb_bookings b on b.id=o.booking_id
    where auth.uid() in(b.student_id,b.tutor_id) and b.status<>'cancelled'
  ),'[]'::jsonb))
$$;
revoke all on function public.fb_profile_dashboard() from public,anon,authenticated;
grant execute on function public.fb_profile_dashboard() to authenticated;

-- Closing a past booking must not erase an attendance disagreement or its history.
-- The check also applies to direct RPC calls, not only the application UI.
create function public.fb_preserve_past_booking() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.status<>'cancelled' and new.status='cancelled' and old.starts_at<=now() then
    raise exception 'Начавшееся занятие нельзя отменить. Укажите результат в комнате занятия.';
  end if;
  return new;
end $$;
create trigger fb_keep_past_booking before update of status on public.fb_bookings
for each row execute function public.fb_preserve_past_booking();
commit;
