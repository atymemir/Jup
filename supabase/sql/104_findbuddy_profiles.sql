-- Run after 103. Photo bytes are stored separately from catalog responses.
begin;
alter table public.fb_tutors
  add column education text not null default '' check(length(education)<=180),
  add column lesson_plan text not null default '' check(length(lesson_plan)<=600),
  add column photo_version uuid;

create table public.fb_tutor_photos (
  tutor_id uuid primary key references public.fb_tutors on delete cascade,
  jpeg bytea not null check(octet_length(jpeg) between 64 and 160000 and substring(jpeg for 3)=decode('ffd8ff','hex'))
);
alter table public.fb_tutor_photos enable row level security;
revoke all on public.fb_tutor_photos from public,anon,authenticated;

create function public.fb_photo(p_id uuid,p_version uuid) returns text
language sql stable security definer set search_path=public as $$
  select encode(p.jpeg,'base64') from fb_tutor_photos p join fb_tutors t on p.tutor_id=t.id
  where t.id=p_id and t.photo_version=p_version and t.verification='verified'
$$;

create function public.fb_profile_dashboard() returns jsonb
language sql stable security definer set search_path=public as $$
  select fb_lesson_dashboard() || jsonb_build_object('private_photo',(
    select encode(p.jpeg,'base64') from fb_tutor_photos p join fb_tutors t on p.tutor_id=t.id
    where t.id=auth.uid() and t.verification<>'verified'
  ))
$$;

create function public.fb_initial_name(p_name text) returns void
language sql security definer set search_path=public as $$
  insert into fb_student_names(id,name)
  select auth.uid(),trim(p_name) where auth.uid() is not null and length(trim(p_name)) between 2 and 50
  on conflict(id) do nothing
$$;
revoke all on function public.fb_initial_name(text) from public,anon,authenticated;
grant execute on function public.fb_initial_name(text) to authenticated;

create function public.fb_save_profile(p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare owner_id uuid:=auth.uid(); profile fb_tutors; photo text;
begin
  if owner_id is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,101));
  select * into profile from fb_tutors where id=owner_id for update;
  if profile.id is null then
    if p_data->>'mode' is distinct from 'create' then raise exception 'Сначала создайте анкету.'; end if;
    if coalesce(p_data->>'photo','')='' then raise exception 'Добавьте фото профиля.'; end if;
    perform fb_action('apply',p_data);
  elsif p_data->>'mode' is distinct from 'edit' then
    raise exception 'Анкета уже создана. Обновите страницу.';
  end if;
  if profile.id is not null and profile.verification='verified'
     and (p_data->>'display_name') is distinct from profile.display_name then
    raise exception 'Для изменения публичного имени после проверки обратитесь к оператору.';
  end if;
  if profile.id is not null and
     (profile.subject,profile.exam,profile.language,profile.city) is distinct from
     (p_data->>'subject',p_data->>'exam',p_data->>'language',p_data->>'city') then
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text,102));
    if exists(select 1 from fb_groups where tutor_id=owner_id and starts_at>now()
       and (not enrollment_closed or exists(select 1 from fb_bookings b where b.group_id=fb_groups.id and b.status<>'cancelled')))
       or exists(select 1 from fb_offers where tutor_id=owner_id and starts_at>now() and status='pending') then
      raise exception 'Формат, предмет, экзамен и язык можно изменить после завершения опубликованных занятий и активных предложений.';
    end if;
  end if;
  photo:=p_data->>'photo';
  if length(photo)>213336 then raise exception 'Фото слишком большое.'; end if;
  update fb_tutors set display_name=trim(p_data->>'display_name'),headline=trim(p_data->>'headline'),bio=trim(p_data->>'bio'),
    education=trim(coalesce(p_data->>'education','')),lesson_plan=trim(coalesce(p_data->>'lesson_plan','')),
    subject=p_data->>'subject',exam=p_data->>'exam',language=p_data->>'language',city=p_data->>'city',
    experience=(p_data->>'experience')::integer,price=(p_data->>'price')::integer,
    photo_version=case when photo is null then photo_version when photo='' then null else gen_random_uuid() end
  where id=owner_id;
  if photo='' then delete from fb_tutor_photos where tutor_id=owner_id;
  elsif photo is not null then
    insert into fb_tutor_photos values(owner_id,decode(photo,'base64'))
      on conflict(tutor_id) do update set jpeg=excluded.jpeg;
  end if;
  return jsonb_build_object('id',owner_id);
end $$;
revoke all on function public.fb_photo(uuid,uuid),public.fb_profile_dashboard(),public.fb_save_profile(jsonb) from public,anon,authenticated;
grant execute on function public.fb_photo(uuid,uuid) to anon,authenticated;
grant execute on function public.fb_profile_dashboard(),public.fb_save_profile(jsonb) to authenticated;
commit;
