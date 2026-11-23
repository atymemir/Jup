-- Run after 109. All application roles and ownership are server-owned.
begin;
-- Supabase owns auth.users. Its existing columns are read, never altered here.
create table public.fb_accounts (
 id uuid primary key references auth.users on delete cascade,
 role text not null check(role in ('student','teacher','business','owner','moderator')),
 created_at timestamptz not null default now()
);
insert into fb_accounts(id,role) select u.id,case when exists(select 1 from fb_tutors t where t.id=u.id) then 'teacher'
 when u.raw_user_meta_data->>'account_type' in ('teacher','business') then u.raw_user_meta_data->>'account_type' else 'student' end from auth.users u;
create function public.fb_register_account() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into fb_accounts(id,role) values(new.id,case when new.raw_user_meta_data->>'account_type' in ('teacher','business') then new.raw_user_meta_data->>'account_type' else 'student' end);
 return new;
end $$;
create trigger fb_account_created after insert on auth.users for each row execute function public.fb_register_account();
create function public.fb_role() returns text language sql stable security definer set search_path=public as $$select role from fb_accounts where id=auth.uid()$$;
create function public.fb_viewer() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('account',(select to_jsonb(a) from fb_accounts a where a.id=auth.uid()))$$;
create table public.fb_student_profiles (
 user_id uuid primary key references auth.users on delete cascade,
 name text not null default '' check(length(name)<=50), stage text not null default '' check(stage in ('','school','college','university','adult')),
 study_year integer check(study_year between 1 and 12), goal text not null default '' check(length(goal)<=1000),
 institution text not null default '' check(length(institution)<=180), city text not null default '' check(length(city)<=80),
 exam text not null default '' check(length(exam)<=50), deadline date,
 languages text[] not null default '{}', format text not null default 'any' check(format in ('any','online','in_person')),
 updated_at timestamptz not null default now()
);
insert into fb_student_profiles(user_id,name) select a.id,coalesce(n.name,'') from fb_accounts a left join fb_student_names n on n.id=a.id where a.role='student';
create function public.fb_student_ready(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from fb_student_profiles where user_id=p_user and length(trim(name))>=2 and stage<>'' and length(trim(goal))>=5 and (stage='adult' or study_year is not null))
$$;
alter table fb_tutors add column education_entries jsonb not null default '[]',add column certificates jsonb not null default '[]',
 add column spoken_languages jsonb not null default '[]',add column teaching_approach text not null default '' check(length(teaching_approach)<=1500),
 add column audience text not null default '' check(length(audience)<=300),add column verification_links text not null default '' check(length(verification_links)<=1500),add column verification_revision integer not null default 0;
create table public.fb_organizations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users on delete cascade,
 name text not null check(length(name) between 2 and 100), description text not null default '' check(length(description)<=2000),
 city text not null default '' check(length(city)<=80), format text not null default 'online' check(format in ('online','in_person','both')),
 website text not null default '' check(website='' or website ~ '^https://[^[:space:]]+$'),
 contact text not null default '' check(length(contact)<=300), evidence text not null default '' check(length(evidence)<=1500),
 logo text not null default '' check(logo='' or (length(logo)<=213340 and logo ~ '^[A-Za-z0-9+/=[:space:]]+$')),
 verification_revision integer not null default 0,
 status text not null default 'draft' check(status in ('draft','pending','verified','rejected','hidden')),
 review_note text not null default '' check(length(review_note)<=1500), created_at timestamptz not null default now()
);
create table public.fb_members (
 organization_id uuid references fb_organizations on delete cascade,teacher_id uuid references fb_tutors on delete cascade,
 state text not null check(state in ('active','left')),primary key(organization_id,teacher_id)
);
create table public.fb_invitations (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('teacher','moderator')),
 organization_id uuid references fb_organizations on delete cascade,email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 fingerprint bytea not null unique,created_by uuid not null references auth.users,expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users,revoked boolean not null default false,
 check((kind='teacher')=(organization_id is not null))
);
create table public.fb_offerings (
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null references fb_tutors on delete cascade,
 organization_id uuid references fb_organizations on delete cascade,
 title text not null check(length(title) between 5 and 120),description text not null default '' check(length(description)<=1500),
 subject text not null check(subject in ('География','Математика','Английский','История Казахстана','Физика','Химия','Биология','Информатика')),
 exam text not null check(exam in ('ЕНТ','IELTS','SAT','Школьная программа')),
 languages text[] not null check(cardinality(languages) between 1 and 3 and languages <@ array['Русский','Қазақша','English']),
 format text not null check(format in ('online','in_person')),city text not null default '' check(length(city)<=80 and (format='online' or length(trim(city))>=2)),
 price integer not null check(price=0 or price between 500 and 100000),active boolean not null default true
);
insert into fb_offerings(teacher_id,title,description,subject,exam,languages,format,city,price)
 select id,headline,bio,subject,exam,array[language],case when city='Онлайн' then 'online' else 'in_person' end,case when city='Онлайн' then '' else city end,price from fb_tutors;
alter table fb_groups add column offering_id uuid references fb_offerings,add column organization_id uuid references fb_organizations,
 add column subject text,add column exam text,add column language text,add column city text;
update fb_groups g set offering_id=o.id,subject=o.subject,exam=o.exam,language=o.languages[1],city=case when o.format='online' then 'Онлайн' else o.city end from fb_offerings o where o.teacher_id=g.tutor_id and o.organization_id is null;
alter table fb_offers add column offering_id uuid references fb_offerings,add column organization_id uuid references fb_organizations;
alter table fb_bookings add column offering_id uuid references fb_offerings,add column organization_id uuid references fb_organizations,
 add column teacher_name text,add column organization_name text,add column exam text,add column language text,add column city text;
update fb_bookings b set teacher_name=t.display_name,exam=t.exam,language=t.language,city=t.city from fb_tutors t where t.id=b.tutor_id;
update fb_bookings b set offering_id=g.offering_id from fb_groups g where g.id=b.group_id;
create table public.fb_moderation_log (
 id bigint generated always as identity primary key,actor uuid not null references auth.users,kind text not null,target uuid,
 decision text not null,reason text not null check(length(trim(reason)) between 5 and 1500),created_at timestamptz not null default now()
);
create table public.fb_reports (
 id uuid primary key default gen_random_uuid(),reporter uuid not null references auth.users,kind text not null check(kind in ('teacher','organization')),
 target uuid not null,reason text not null check(length(trim(reason)) between 10 and 1500),resolved boolean not null default false,created_at timestamptz not null default now()
);
create table public.fb_org_threads (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references fb_organizations,student_id uuid not null references auth.users,
 student_seen bigint not null default 0,owner_seen bigint not null default 0,unique(organization_id,student_id)
);
create table public.fb_org_messages (
 id bigint generated always as identity primary key,thread_id uuid not null references fb_org_threads on delete cascade,
 sender_id uuid not null references auth.users,body text not null check(length(trim(body)) between 1 and 2000),client_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(sender_id,client_id)
);
do $$declare t text;begin
 foreach t in array array['fb_accounts','fb_student_profiles','fb_organizations','fb_members','fb_invitations','fb_offerings','fb_moderation_log','fb_reports','fb_org_threads','fb_org_messages'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Prices can be free or at least 500 tenge; old rows remain valid.
do $$declare t text; c text;begin
 foreach t in array array['fb_tutors','fb_groups','fb_bookings','fb_offers','fb_requests'] loop
 c:=case when t='fb_requests' then 'budget' else 'price' end;
 execute format('alter table %I drop constraint %I',t,t||'_'||c||'_check');
 execute format('alter table %I add check (%I=0 or %I between 500 and 100000)',t,c,c);
 end loop;
end $$;
create function public.fb_can_manage_offering(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from fb_offerings o where o.id=p_id and ((o.organization_id is null and o.teacher_id=auth.uid() and fb_role()='teacher') or
 (fb_role()='business' and exists(select 1 from fb_organizations g where g.id=o.organization_id and g.owner_id=auth.uid()))))
$$;
create function public.fb_offering_public(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from fb_offerings o join fb_tutors t on t.id=o.teacher_id where o.id=p_id and o.active and t.verification='verified' and
 (o.organization_id is null or exists(select 1 from fb_organizations g join fb_members m on m.organization_id=g.id where g.id=o.organization_id and g.status='verified' and m.teacher_id=o.teacher_id and m.state='active')))
$$;
create function public.fb_public_organizations() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'city',g.city,'format',g.format,'website',g.website,'logo',g.logo,
 'teachers',coalesce((select jsonb_agg(m.teacher_id) from fb_members m join fb_tutors t on t.id=m.teacher_id and t.verification='verified' where m.organization_id=g.id and m.state='active'),'[]'::jsonb)) order by g.name),'[]'::jsonb) from fb_organizations g where g.status='verified'
$$;
create function public.fb_student_context(p_user uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if p_user=auth.uid() and fb_role()='student' then return (select to_jsonb(p) from fb_student_profiles p where user_id=p_user); end if;
 if exists(select 1 from fb_bookings b where b.student_id=p_user and b.status<>'cancelled' and (b.tutor_id=auth.uid() or exists(select 1 from fb_organizations g where g.id=b.organization_id and g.owner_id=auth.uid())))
 or exists(select 1 from fb_requests r where r.student_id=p_user and r.tutor_id=auth.uid()) then
 return (select jsonb_build_object('name',name,'stage',stage,'study_year',study_year,'goal',goal,'exam',exam,'languages',languages,'format',format) from fb_student_profiles where user_id=p_user);
 end if;
 raise exception 'Профиль ученика недоступен.' using errcode='42501';
end $$;
create function public.fb_platform_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r text:=fb_role(); g fb_organizations; o fb_offerings; inv fb_invitations; th fb_org_threads; target uuid; key text; mail text; result jsonb; decision text; note text;
begin
 if u is null or r is null then raise exception 'Войдите в аккаунт.' using errcode='42501'; end if;
 if p_action='review_detail' then
  if r not in ('owner','moderator') then raise exception 'Недостаточно прав.' using errcode='42501';end if;
  return jsonb_build_object('photo',(select encode(jpeg,'base64') from fb_tutor_photos where tutor_id=(p_data->>'id')::uuid));
 elsif p_action='publish_slot' then return fb_action('group',p_data);
 elsif p_action='close_slot' then perform fb_close_enrollment((p_data->>'id')::uuid);return '{}'::jsonb;
 elsif p_action='student_profile' then
  if r<>'student' then raise exception 'Это кабинет ученика.' using errcode='42501'; end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 2 and 50 or p_data->>'stage' not in ('school','college','university','adult') or length(trim(coalesce(p_data->>'goal',''))) not between 5 and 1000 then raise exception 'Укажите имя, этап обучения и цель от 5 символов.'; end if;
  if p_data->>'stage'<>'adult' and nullif(p_data->>'study_year','') is null then raise exception 'Укажите класс или курс.'; end if;
  insert into fb_student_profiles(user_id,name,stage,study_year,goal,institution,city,exam,deadline,languages,format)
  values(u,trim(p_data->>'name'),p_data->>'stage',case when p_data->>'stage'='adult' then null else nullif(p_data->>'study_year','')::int end,trim(p_data->>'goal'),trim(coalesce(p_data->>'institution','')),trim(coalesce(p_data->>'city','')),coalesce(p_data->>'exam',''),nullif(p_data->>'deadline','')::date,
  array(select jsonb_array_elements_text(coalesce(p_data->'languages','[]'))),coalesce(p_data->>'format','any'))
  on conflict(user_id) do update set name=excluded.name,stage=excluded.stage,study_year=excluded.study_year,goal=excluded.goal,institution=excluded.institution,city=excluded.city,exam=excluded.exam,deadline=excluded.deadline,languages=excluded.languages,format=excluded.format,updated_at=now();
  insert into fb_student_names values(u,trim(p_data->>'name')) on conflict(id) do update set name=excluded.name;
 elsif p_action='organization_save' then
  if r<>'business' then raise exception 'Это кабинет учебного центра.' using errcode='42501'; end if;
  select * into g from fb_organizations where owner_id=u for update;
  decision:=case when coalesce((p_data->>'submit')::boolean,false) then 'pending' else coalesce(g.status,'draft') end;
  if decision='pending' and (length(trim(coalesce(p_data->>'contact','')))<5 or length(trim(coalesce(p_data->>'evidence','')))<10 or length(trim(coalesce(p_data->>'description','')))<20) then raise exception 'Для проверки добавьте описание, контакт и данные или ссылки для подтверждения центра.'; end if;
  if g.status='verified' and (g.name is distinct from trim(p_data->>'name') or g.website is distinct from coalesce(p_data->>'website','')) then decision:='pending'; end if;
  insert into fb_organizations(owner_id,name,description,city,format,website,contact,evidence,logo,status)
  values(u,trim(p_data->>'name'),trim(coalesce(p_data->>'description','')),trim(coalesce(p_data->>'city','')),coalesce(p_data->>'format','online'),trim(coalesce(p_data->>'website','')),trim(coalesce(p_data->>'contact','')),trim(coalesce(p_data->>'evidence','')),coalesce(p_data->>'logo',''),decision)
  on conflict(owner_id) do update set name=excluded.name,description=excluded.description,city=excluded.city,format=excluded.format,website=excluded.website,contact=excluded.contact,evidence=excluded.evidence,logo=excluded.logo,status=excluded.status,verification_revision=fb_organizations.verification_revision+1;
 elsif p_action in ('invite_teacher','invite_moderator') then
  if (p_action='invite_teacher' and r<>'business') or (p_action='invite_moderator' and r<>'owner') then raise exception 'Приглашение недоступно.' using errcode='42501'; end if;
  if p_action='invite_teacher' then select * into g from fb_organizations where owner_id=u; if not found then raise exception 'Сначала сохраните страницу центра.'; end if; end if;
  mail:=lower(trim(p_data->>'email'));key:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  if (select count(*) from fb_invitations where created_by=u and expires_at>now() and not revoked and accepted_by is null)>=30 then raise exception 'Сначала отзовите лишние приглашения.'; end if;
  insert into fb_invitations(kind,organization_id,email,fingerprint,created_by) values(case when p_action='invite_teacher' then 'teacher' else 'moderator' end,g.id,mail,sha256(convert_to(key,'UTF8')),u) returning id into target;
  return jsonb_build_object('id',target,'token',key);
 elsif p_action='accept_invite' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,110));
  select * into inv from fb_invitations where fingerprint=sha256(convert_to(coalesce(p_data->>'token',''),'UTF8')) for update;
  if not found or inv.revoked or inv.expires_at<=now() then raise exception 'Приглашение истекло или отозвано.'; end if;
  if inv.accepted_by=u then return '{}'::jsonb; end if;
  if inv.accepted_by is not null then raise exception 'Приглашение уже принято.'; end if;
  if not exists(select 1 from auth.users where id=u and lower(email)=inv.email and email_confirmed_at is not null) then raise exception 'Войдите с подтверждённой почтой, на которую выдано приглашение.' using errcode='42501'; end if;
  if inv.kind='teacher' then
   if r<>'teacher' or not exists(select 1 from fb_tutors where id=u) then raise exception 'Для приглашения нужен отдельный аккаунт преподавателя и сохранённая анкета.'; end if;
   insert into fb_members values(inv.organization_id,u,'active') on conflict(organization_id,teacher_id) do update set state='active';
  else
   if r<>'student' or exists(select 1 from fb_bookings where u in(student_id,tutor_id)) or exists(select 1 from fb_tutors where id=u) or exists(select 1 from fb_organizations where owner_id=u) then raise exception 'Для модерации используйте отдельный новый аккаунт.'; end if;
   if not exists(select 1 from fb_accounts where id=inv.created_by and role='owner') then raise exception 'Приглашение владельца недействительно.'; end if;
   update fb_accounts set role='moderator' where id=u;
   insert into fb_moderation_log(actor,kind,target,decision,reason) values(inv.created_by,'staff',u,'granted','Принято приглашение модератора');
  end if;
  update fb_invitations set accepted_by=u where id=inv.id;
 elsif p_action='revoke_invite' then
  update fb_invitations set revoked=true where id=(p_data->>'id')::uuid and created_by=u and accepted_by is null; if not found then raise exception 'Приглашение недоступно.' using errcode='42501'; end if;
 elsif p_action='remove_member' then
  target:=(p_data->>'teacher_id')::uuid;
  update fb_members m set state='left' where organization_id=(p_data->>'organization_id')::uuid and teacher_id=target and (target=u or exists(select 1 from fb_organizations where id=m.organization_id and owner_id=u));
  if not found then raise exception 'Участник недоступен.' using errcode='42501'; end if;
  update fb_groups set enrollment_closed=true where organization_id=(p_data->>'organization_id')::uuid and tutor_id=target and starts_at>now();
 elsif p_action='offering_save' then
  target:=nullif(p_data->>'id','')::uuid;
  if target is not null and not fb_can_manage_offering(target) then raise exception 'Направление недоступно.' using errcode='42501'; end if;
  if target is not null then select * into o from fb_offerings where id=target for update; end if;
  if r='teacher' then
   if not exists(select 1 from fb_tutors where id=u) or (target is not null and o.organization_id is not null) then raise exception 'Сначала сохраните личную анкету.'; end if;
   o.teacher_id:=u;o.organization_id:=null;
  elsif r='business' then
   select * into g from fb_organizations where owner_id=u;
   if target is not null and o.teacher_id is distinct from (p_data->>'teacher_id')::uuid then raise exception 'Для другого преподавателя создайте отдельное направление. Существующие занятия сохраняют своего преподавателя.';end if;
   o.organization_id:=g.id;o.teacher_id:=(p_data->>'teacher_id')::uuid;
   if g.id is null or not exists(select 1 from fb_members where organization_id=g.id and teacher_id=o.teacher_id and state='active') then raise exception 'Выберите действующего преподавателя команды.'; end if;
  else raise exception 'Недостаточно прав.' using errcode='42501'; end if;
  if target is null and (select count(*) from fb_offerings where teacher_id=o.teacher_id)>=30 then raise exception 'Лимит: 30 направлений на преподавателя.'; end if;
  if target is null then target:=gen_random_uuid(); end if;
  insert into fb_offerings(id,teacher_id,organization_id,title,description,subject,exam,languages,format,city,price,active)
  values(target,o.teacher_id,o.organization_id,trim(p_data->>'title'),trim(coalesce(p_data->>'description','')),p_data->>'subject',p_data->>'exam',array(select jsonb_array_elements_text(p_data->'languages')),p_data->>'format',trim(coalesce(p_data->>'city','')),(p_data->>'price')::int,coalesce((p_data->>'active')::boolean,true))
  on conflict(id) do update set teacher_id=excluded.teacher_id,title=excluded.title,description=excluded.description,subject=excluded.subject,exam=excluded.exam,languages=excluded.languages,format=excluded.format,city=excluded.city,price=excluded.price,active=excluded.active;
  return jsonb_build_object('id',target);
 elsif p_action='moderate' then
  if r not in ('owner','moderator') then raise exception 'Недостаточно прав.' using errcode='42501'; end if;
  target:=(p_data->>'id')::uuid;decision:=p_data->>'decision';note:=trim(p_data->>'reason');
  if decision not in ('verified','rejected','pending','hidden') or length(coalesce(note,'')) not between 5 and 1500 then raise exception 'Укажите решение и основание от 5 символов.'; end if;
  if p_data->>'kind'='teacher' then
   if (select verification_revision from fb_tutors where id=target for update) is distinct from (p_data->>'revision')::int then raise exception 'Анкета уже изменена. Обновите очередь проверки.';end if;
   update fb_tutors set verification_revision=verification_revision+1,verification=case when decision='hidden' then 'rejected' else decision end where id=target;
   if not found then raise exception 'Анкета не найдена.'; end if;
   insert into fb_verifications(tutor_id,operator_reference,decision) values(target,note,case when decision='verified' then 'verified' else 'rejected' end);
  elsif p_data->>'kind'='organization' then
   if (select verification_revision from fb_organizations where id=target for update) is distinct from (p_data->>'revision')::int then raise exception 'Анкета уже изменена. Обновите очередь проверки.';end if;
   update fb_organizations set verification_revision=verification_revision+1,status=decision,review_note=note where id=target;if not found then raise exception 'Центр не найден.'; end if;
  else raise exception 'Выберите тип анкеты.'; end if;
  insert into fb_moderation_log(actor,kind,target,decision,reason) values(u,p_data->>'kind',target,decision,note);
 elsif p_action='revoke_moderator' then
  if r<>'owner' then raise exception 'Только владелец управляет модераторами.' using errcode='42501'; end if;
  target:=(p_data->>'id')::uuid;update fb_accounts set role='student' where id=target and role='moderator';if not found then raise exception 'Модератор не найден.'; end if;
  insert into fb_moderation_log(actor,kind,target,decision,reason) values(u,'staff',target,'revoked','Владелец отозвал доступ модератора');
 elsif p_action='report' then
  if p_data->>'kind' not in ('teacher','organization') then raise exception 'Выберите профиль.'; end if;
  target:=(p_data->>'id')::uuid;
  if not exists(select 1 from fb_tutors where id=target and verification='verified') and not exists(select 1 from fb_organizations where id=target and status='verified') then raise exception 'Профиль недоступен.'; end if;
  if (select count(*) from fb_reports where reporter=u and created_at>now()-interval '1 day')>=10 then raise exception 'Лимит: 10 обращений в сутки.'; end if;
  insert into fb_reports(reporter,kind,target,reason) values(u,p_data->>'kind',target,trim(p_data->>'reason'));
 elsif p_action='resolve_report' then
  if r not in ('owner','moderator') then raise exception 'Недостаточно прав.' using errcode='42501'; end if;
  update fb_reports set resolved=true where id=(p_data->>'id')::uuid;
  insert into fb_moderation_log(actor,kind,target,decision,reason) values(u,'report',(p_data->>'id')::uuid,'resolved',trim(p_data->>'reason'));
 elsif p_action in ('org_send','org_read','org_seen') then
  if nullif(p_data->>'thread_id','') is not null then
   select * into th from fb_org_threads where id=(p_data->>'thread_id')::uuid and (student_id=u or exists(select 1 from fb_organizations where id=organization_id and owner_id=u)) for update;
   if not found then raise exception 'Диалог недоступен.' using errcode='42501'; end if;
  else
   if p_action<>'org_send' or r<>'student' then raise exception 'Диалог недоступен.' using errcode='42501'; end if;
   select * into g from fb_organizations where id=(p_data->>'organization_id')::uuid and status='verified';
   if not found then raise exception 'Центр недоступен.'; end if;
   perform pg_advisory_xact_lock(hashtextextended(u::text,110));
   if (select count(*) from fb_org_threads where student_id=u)>=100 then raise exception 'Лимит диалогов с центрами.'; end if;
   insert into fb_org_threads(organization_id,student_id) values(g.id,u) on conflict(organization_id,student_id) do nothing;
   select * into th from fb_org_threads where organization_id=g.id and student_id=u for update;
  end if;
  if p_action='org_send' then
   if (select count(*) from fb_org_messages where sender_id=u and created_at>now()-interval '1 minute')>=12 then raise exception 'Слишком много сообщений. Подождите минуту.'; end if;
   insert into fb_org_messages(thread_id,sender_id,body,client_id) values(th.id,u,trim(p_data->>'body'),(p_data->>'client_id')::uuid) on conflict(sender_id,client_id) do nothing;
   return jsonb_build_object('id',th.id);
  elsif p_action='org_seen' then
   select max(id)::text into key from fb_org_messages where thread_id=th.id;
   if u=th.student_id then update fb_org_threads set student_seen=coalesce(key::bigint,0) where id=th.id;else update fb_org_threads set owner_seen=coalesce(key::bigint,0) where id=th.id;end if;
  else
   select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into result from (select id,sender_id,body,created_at from fb_org_messages where thread_id=th.id order by id desc limit 100) m;
   return jsonb_build_object('id',th.id,'messages',result);
  end if;
 else raise exception 'Неизвестное действие.';
 end if;
 return '{}'::jsonb;
end $$;
create function public.fb_platform_dashboard() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare u uuid:=auth.uid();r text:=fb_role(); own_org uuid;result jsonb;
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501';end if;
 select id into own_org from fb_organizations where owner_id=u;
 result:=jsonb_build_object('account',(select to_jsonb(a) from fb_accounts a where id=u),
 'student_profile',(select to_jsonb(p) from fb_student_profiles p where user_id=u),
 'private_photo',(select encode(jpeg,'base64') from fb_tutor_photos where tutor_id=u),
 'account_name',(select name from fb_student_names where id=u),
 'tutor_review_note',(select reason from fb_moderation_log where kind='teacher' and target=u order by id desc limit 1),
 'tutor',(select to_jsonb(t) from fb_tutors t where id=u),
 'organization',(select to_jsonb(g) from fb_organizations g where owner_id=u),
 'offerings',coalesce((select jsonb_agg(to_jsonb(o) order by o.title) from fb_offerings o where (o.teacher_id=u and o.organization_id is null) or o.organization_id=own_org),'[]'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('teacher_id',m.teacher_id,'organization_id',m.organization_id,'state',m.state,'name',t.display_name,'verification',t.verification,'organization_name',g.name)) from fb_members m join fb_tutors t on t.id=m.teacher_id join fb_organizations g on g.id=m.organization_id where m.teacher_id=u or m.organization_id=own_org),'[]'),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i)-'fingerprint') from fb_invitations i where i.created_by=u),'[]'),
 'slots',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('reserved',(select count(*) from fb_bookings b where b.group_id=g.id and b.status<>'cancelled')) order by g.starts_at) from fb_groups g where g.organization_id=own_org),'[]'),
 'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'student_id',b.student_id,'tutor_id',b.tutor_id,'teacher_name',b.teacher_name,'lesson_title',b.lesson_title,'starts_at',b.starts_at,'price',b.price,'commission',b.commission,'status',b.status,'student',case when b.status<>'cancelled' then fb_student_context(b.student_id) else null end) order by b.starts_at) from fb_bookings b where b.organization_id=own_org),'[]'),
 'org_threads',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'organization_id',t.organization_id,'name',case when t.student_id=u then g.name else coalesce(n.name,'Ученик') end,'unread',(select count(*) from fb_org_messages m where m.thread_id=t.id and m.sender_id<>u and m.id>case when t.student_id=u then t.student_seen else t.owner_seen end))) from fb_org_threads t join fb_organizations g on g.id=t.organization_id left join fb_student_names n on n.id=t.student_id where t.student_id=u or g.owner_id=u),'[]'));
 if r in ('owner','moderator') then
  result:=result||jsonb_build_object('teacher_queue',coalesce((select jsonb_agg(to_jsonb(t)) from fb_tutors t),'[]'),
   'organization_queue',coalesce((select jsonb_agg(to_jsonb(g)) from fb_organizations g),'[]'),
   'reports',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from fb_reports q),'[]'),
   'audit',coalesce((select jsonb_agg(to_jsonb(q) order by q.id desc) from (select * from fb_moderation_log order by id desc limit 200) q),'[]'),
   'staff',case when r='owner' then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'role',a.role,'email',u.email)) from fb_accounts a join auth.users u on u.id=a.id where a.role in ('owner','moderator')),'[]') else '[]'::jsonb end);
 end if;
 return result;
end $$;
-- Public DTOs contain no verification contacts or student details.
create or replace function public.fb_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('tutors',coalesce((select jsonb_agg(to_jsonb(t)-'created_at'-'verification_links' || jsonb_build_object('offerings',coalesce((select jsonb_agg(to_jsonb(o)) from fb_offerings o where o.teacher_id=t.id and fb_offering_public(o.id)),'[]')) order by t.price) from fb_tutors t where verification='verified'),'[]'),
 'groups',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('reserved',(select count(*) from fb_bookings b where b.group_id=g.id and b.status<>'cancelled'),'organization_name',(select name from fb_organizations where id=g.organization_id)) order by g.starts_at) from fb_groups g join fb_tutors t on t.id=g.tutor_id where t.verification='verified' and g.starts_at>now() and (g.organization_id is null or exists(select 1 from fb_organizations z where z.id=g.organization_id and z.status='verified')) and (g.offering_id is null or fb_offering_public(g.offering_id))),'[]'),
 'organizations',fb_public_organizations())
$$;
-- Guard legacy entry points as well as the new platform API.
alter function public.fb_action(text,jsonb) rename to fb_action_before_roles;
revoke all on function public.fb_action_before_roles(text,jsonb) from public,anon,authenticated;
create function public.fb_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid();r text:=fb_role();o fb_offerings;g fb_groups;req fb_requests;target uuid;starts timestamptz;input jsonb:=p_data;
begin
 if u is null then raise exception 'Войдите в аккаунт.' using errcode='42501';end if;
 if p_action in ('apply','offer','group') and r not in ('teacher','business') then raise exception 'Для преподавания нужен отдельный аккаунт преподавателя.' using errcode='42501';end if;
 if p_action='apply' and r<>'teacher' then raise exception 'Используйте страницу учебного центра.' using errcode='42501';end if;
 if p_action in ('request','join','accept','close_request') and r<>'student' then raise exception 'Это действие доступно аккаунту ученика.' using errcode='42501';end if;
 if p_action in ('join','accept') and not fb_student_ready(u) then raise exception 'Сначала заполните короткий профиль ученика: имя, этап обучения, класс или курс и цель.';end if;
 if p_action in ('group','offer') then
  perform pg_advisory_xact_lock(hashtextextended(u::text,101));
  if nullif(input->>'offering_id','') is not null then select * into o from fb_offerings where id=(input->>'offering_id')::uuid;
  else select * into o from fb_offerings where teacher_id=u and organization_id is null and active order by id limit 1;end if;
  if o.id is null or not fb_can_manage_offering(o.id) or not fb_offering_public(o.id) then raise exception 'Выберите доступное направление проверенного преподавателя.' using errcode='42501';end if;
  starts:=(input->>'starts_at')::timestamptz;
  if starts is null or not isfinite(starts) or starts<now()+interval '30 minutes' then raise exception 'До занятия должно быть не менее 30 минут.';end if;
  if not coalesce(input->>'language',o.languages[1])=any(o.languages) then raise exception 'Выберите язык этого направления.';end if;
  if p_action='group' then
   if (select count(*) from fb_groups where tutor_id=o.teacher_id and starts_at>now() and not enrollment_closed)>=40 then raise exception 'Лимит: 40 опубликованных дат.';end if;
   insert into fb_groups(tutor_id,offering_id,organization_id,title,description,price,capacity,starts_at,subject,exam,language,city)
   values(o.teacher_id,o.id,o.organization_id,trim(input->>'title'),trim(input->>'description'),(input->>'price')::int,(input->>'capacity')::int,starts,o.subject,o.exam,coalesce(input->>'language',o.languages[1]),case when o.format='online' then 'Онлайн' else o.city end) returning id into target;
  else
   select * into req from fb_requests where id=(input->>'request_id')::uuid for update;
   if req.id is null or req.status<>'open' or (req.tutor_id is not null and req.tutor_id<>o.teacher_id) or req.student_id=u then raise exception 'Заявка недоступна.';end if;
   if req.subject<>o.subject or req.exam<>o.exam or not req.language=any(o.languages) or req.city<>(case when o.format='online' then 'Онлайн' else o.city end) then raise exception 'Направление не соответствует заявке.';end if;
   insert into fb_offers(request_id,tutor_id,offering_id,organization_id,price,starts_at,note) values(req.id,o.teacher_id,o.id,o.organization_id,(input->>'price')::int,starts,trim(input->>'note')) returning id into target;
  end if;
  return jsonb_build_object('id',target);
 end if;
 if p_action='request' and nullif(input->>'tutor_id','') is not null then
  -- The original function checks the primary direction; validate all directions here.
  select * into o from fb_offerings where teacher_id=(input->>'tutor_id')::uuid and subject=input->>'subject' and exam=input->>'exam' and (input->>'language')=any(languages) and (case when format='online' then 'Онлайн' else city end)=input->>'city' and fb_offering_public(id) limit 1;
  if o.id is null then raise exception 'Направление преподавателя недоступно.';end if;
  if (select count(*) from fb_requests where student_id=u and created_at>now()-interval '1 day')>=10 then raise exception 'Лимит: 10 заявок в сутки.';end if;
  insert into fb_requests(student_id,tutor_id,subject,exam,language,city,budget,goal) values(u,o.teacher_id,o.subject,o.exam,input->>'language',input->>'city',(input->>'budget')::int,trim(input->>'goal')) returning id into target;
  return jsonb_build_object('id',target);
 end if;
 if p_action='join' then
  select * into g from fb_groups where id=(input->>'id')::uuid;
  if g.offering_id is not null and not fb_offering_public(g.offering_id) then raise exception 'Центр или преподаватель недоступен для новой записи.';end if;
 elsif p_action='accept' then
  select * into o from fb_offerings where id=(select offering_id from fb_offers where id=(input->>'id')::uuid);
  if o.id is not null and not fb_offering_public(o.id) then raise exception 'Предложение больше недоступно.';end if;
 end if;
 return fb_action_before_roles(p_action,input);
end $$;
create or replace function public.fb_booking_details() returns trigger language plpgsql set search_path=public as $$
declare g fb_groups;o fb_offers;d fb_offerings;
begin
 if new.group_id is not null then
  select * into strict g from fb_groups where id=new.group_id for update;
  if g.enrollment_closed then raise exception 'Преподаватель закрыл запись.';end if;
  new.lesson_format:=case when g.capacity=1 then 'individual' else 'group' end;new.lesson_title:=g.title;new.offering_id:=g.offering_id;new.organization_id:=g.organization_id;
  new.subject:=g.subject;new.exam:=g.exam;new.language:=g.language;new.city:=g.city;
 else
  select * into o from fb_offers where id=new.offer_id;select * into d from fb_offerings where id=o.offering_id;
  new.offering_id:=d.id;new.organization_id:=d.organization_id;
  if d.id is not null then new.subject:=d.subject;new.exam:=d.exam;new.language:=(select language from fb_requests where id=o.request_id);new.city:=case when d.format='online' then 'Онлайн' else d.city end;end if;
 end if;
 new.teacher_name:=(select display_name from fb_tutors where id=new.tutor_id);new.organization_name:=(select name from fb_organizations where id=new.organization_id);
 if exists(select 1 from fb_groups x where not x.enrollment_closed and (x.tutor_id=new.student_id or (x.tutor_id=new.tutor_id and x.id is distinct from new.group_id)) and x.starts_at<new.starts_at+interval '1 hour' and new.starts_at<x.starts_at+interval '1 hour') then raise exception 'На этот час уже опубликовано другое занятие.';end if;
 return new;
end $$;
alter function public.fb_save_profile(jsonb) rename to fb_save_profile_before_roles;
revoke all on function public.fb_save_profile_before_roles(jsonb) from public,anon,authenticated;
create function public.fb_save_profile(p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;t fb_tutors;key text;v jsonb;
begin
 if fb_role()<>'teacher' then raise exception 'Для анкеты нужен аккаунт преподавателя.' using errcode='42501';end if;
 foreach key in array array['education_entries','certificates','spoken_languages'] loop
  v:=coalesce(p_data->key,'[]');if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>8 or length(v::text)>6000 then raise exception 'Проверьте список образования, сертификатов и языков.';end if;
  if exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'object') then raise exception 'Проверьте структуру сведений анкеты.';end if;
  if exists(select 1 from jsonb_array_elements(v) x cross join lateral jsonb_each(x) z where jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>300) then raise exception 'Поля анкеты должны содержать текст до 300 символов.';end if;
 end loop;
 select * into t from fb_tutors where id=auth.uid() for update;
 if t.verification='verified' and (t.display_name is distinct from trim(p_data->>'display_name') or p_data ? 'photo') then update fb_tutors set verification='pending' where id=auth.uid();end if;
 result:=fb_save_profile_before_roles(p_data);
 update fb_tutors set verification_revision=verification_revision+1,education_entries=coalesce(p_data->'education_entries',education_entries),certificates=coalesce(p_data->'certificates',certificates),spoken_languages=coalesce(p_data->'spoken_languages',spoken_languages),teaching_approach=coalesce(p_data->>'teaching_approach',teaching_approach),audience=coalesce(p_data->>'audience',audience),verification_links=coalesce(p_data->>'verification_links',verification_links) where id=auth.uid();
 if not exists(select 1 from fb_offerings where teacher_id=auth.uid()) then insert into fb_offerings(teacher_id,title,description,subject,exam,languages,format,city,price) select id,headline,bio,subject,exam,array[language],case when city='Онлайн' then 'online' else 'in_person' end,case when city='Онлайн' then '' else city end,price from fb_tutors where id=auth.uid();end if;
 return result;
end $$;
alter function public.fb_close_enrollment(uuid) rename to fb_close_enrollment_before_roles;
revoke all on function public.fb_close_enrollment_before_roles(uuid) from public,anon,authenticated;
create function public.fb_close_enrollment(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update fb_groups g set enrollment_closed=true where id=p_id and (tutor_id=auth.uid() or exists(select 1 from fb_organizations z where z.id=g.organization_id and z.owner_id=auth.uid()));
 if not found then raise exception 'Занятие недоступно.' using errcode='42501';end if;
end $$;
alter function public.fb_inbox(text,jsonb) rename to fb_inbox_before_roles;
revoke all on function public.fb_inbox_before_roles(text,jsonb) from public,anon,authenticated;
create function public.fb_inbox(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_action='send' and (p_input->>'id') is null and fb_role()<>'student' then raise exception 'Новый диалог с преподавателем открывает аккаунт ученика.' using errcode='42501';end if;
 return fb_inbox_before_roles(p_action,p_input);
end $$;
-- Remove broad direct catalog reads: all public data now goes through explicit DTOs.
revoke select on fb_tutors,fb_groups from anon,authenticated;
-- Existing lesson RPCs remain participant-scoped. Series publication calls guarded fb_action.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('fb_role','fb_register_account','fb_student_ready','fb_can_manage_offering','fb_offering_public','fb_student_context','fb_platform_action','fb_platform_dashboard','fb_viewer','fb_public_organizations','fb_action','fb_save_profile','fb_close_enrollment','fb_inbox') loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 end loop;
end $$;
grant execute on function fb_viewer(),fb_public_organizations() to anon,authenticated;
grant execute on function fb_platform_action(text,jsonb),fb_platform_dashboard(),fb_student_context(uuid),fb_action(text,jsonb),fb_save_profile(jsonb),fb_close_enrollment(uuid),fb_inbox(text,jsonb) to authenticated;
-- Extend the existing participant dashboard without exposing organization-private data.
alter function public.fb_pilot_dashboard() rename to fb_pilot_dashboard_before_platform;
revoke all on function public.fb_pilot_dashboard_before_platform() from public,anon,authenticated;
create function public.fb_pilot_dashboard() returns jsonb language sql stable security definer set search_path=public as $$
 select fb_pilot_dashboard_before_platform() || jsonb_build_object('account',(select to_jsonb(a) from fb_accounts a where id=auth.uid()),
 'student_profile',(select to_jsonb(p) from fb_student_profiles p where user_id=auth.uid()),
 'offerings',coalesce((select jsonb_agg(to_jsonb(o)) from fb_offerings o where o.teacher_id=auth.uid() and o.organization_id is null),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from fb_requests r where r.student_id=auth.uid() or
 exists(select 1 from fb_offers f where f.request_id=r.id and f.tutor_id=auth.uid()) or
 (r.status='open' and exists(select 1 from fb_offerings o where fb_offering_public(o.id) and fb_can_manage_offering(o.id) and (r.tutor_id is null or r.tutor_id=o.teacher_id) and o.subject=r.subject and o.exam=r.exam and r.language=any(o.languages) and (case when o.format='online' then 'Онлайн' else o.city end)=r.city))),'[]'))
$$;
revoke all on function fb_pilot_dashboard() from public,anon,authenticated;
grant execute on function fb_pilot_dashboard() to authenticated;
alter table fb_student_profiles add check(cardinality(languages)<=3 and languages <@ array['Русский','Қазақша','English']),add check(stage in ('','school','adult') or study_year<=6);
alter function public.fb_update_terms(jsonb) rename to fb_update_terms_before_roles;
revoke all on function public.fb_update_terms_before_roles(jsonb) from public,anon,authenticated;
create function public.fb_update_terms(p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
begin if fb_role()<>'teacher' then raise exception 'Недостаточно прав.' using errcode='42501';end if;perform fb_update_terms_before_roles(p_data);end $$;
revoke all on function public.fb_update_terms(jsonb) from public,anon,authenticated;
grant execute on function public.fb_update_terms(jsonb) to authenticated;
commit;
