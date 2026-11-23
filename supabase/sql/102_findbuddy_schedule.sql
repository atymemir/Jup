-- Apply after 101. Existing groups keep their capacity and reservations.
begin;
alter table public.fb_groups drop constraint fb_groups_capacity_check,
  add constraint fb_groups_capacity_check check(capacity between 1 and 12),
  add column enrollment_closed boolean not null default false;
alter table public.fb_bookings add column lesson_title text,
  add column lesson_format text not null default 'individual' check(lesson_format in ('individual','group'));
update public.fb_bookings b set lesson_title=g.title, lesson_format='group'
from public.fb_groups g where g.id=b.group_id;

create function public.fb_schedule_guard() returns trigger
language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tutor_id::text,102));
  if exists(select 1 from public.fb_groups g where g.tutor_id=new.tutor_id and not g.enrollment_closed
    and g.starts_at < new.starts_at+interval '60 minutes' and new.starts_at < g.starts_at+interval '60 minutes') or
    exists(select 1 from public.fb_bookings b where (b.tutor_id=new.tutor_id or b.student_id=new.tutor_id) and b.status<>'cancelled'
    and b.starts_at < new.starts_at+interval '60 minutes' and new.starts_at < b.starts_at+interval '60 minutes') then
    raise exception 'Это время занято. Выберите другой час.';
  end if;
  return new;
end $$;
create trigger fb_check_publication before insert on public.fb_groups
for each row execute function public.fb_schedule_guard();

create function public.fb_booking_details() returns trigger
language plpgsql set search_path=public as $$
declare lesson public.fb_groups;
begin
  if new.group_id is not null then
    select * into strict lesson from public.fb_groups where id=new.group_id for update;
    if lesson.enrollment_closed then raise exception 'Преподаватель закрыл запись.'; end if;
    new.lesson_format:=case when lesson.capacity=1 then 'individual' else 'group' end;
    new.lesson_title:=lesson.title;
  end if;
  if exists(select 1 from public.fb_groups g where not g.enrollment_closed
    and (g.tutor_id=new.student_id or (g.tutor_id=new.tutor_id and g.id is distinct from new.group_id))
    and g.starts_at < new.starts_at+interval '60 minutes' and new.starts_at < g.starts_at+interval '60 minutes') then
    raise exception 'На этот час уже опубликовано другое занятие.';
  end if;
  return new;
end $$;
create trigger fb_fill_booking before insert on public.fb_bookings
for each row execute function public.fb_booking_details();

create function public.fb_close_enrollment(p_id uuid) returns void language plpgsql
security definer set search_path=public as $$
begin
  update public.fb_groups set enrollment_closed=true where id=p_id and tutor_id=auth.uid();
  if not found then raise exception 'Занятие недоступно.' using errcode='42501'; end if;
end $$;
revoke all on function public.fb_close_enrollment(uuid) from public,anon,authenticated;
grant execute on function public.fb_close_enrollment(uuid) to authenticated;
-- Public identity and verification remain operator-owned. Future bookings use
-- the published price for their slot; existing offers and bookings keep theirs.
create function public.fb_update_terms(p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  update public.fb_tutors set headline=trim(p_data->>'headline'),
    bio=trim(p_data->>'bio'), price=(p_data->>'price')::integer
    where id=auth.uid();
  if not found then raise exception 'Сначала создайте анкету.' using errcode='42501'; end if;
end $$;
revoke all on function public.fb_update_terms(jsonb) from public,anon,authenticated;
grant execute on function public.fb_update_terms(jsonb) to authenticated;
commit;
