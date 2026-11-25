-- Run once after the existing application migrations. Owner identities are
-- private configuration, rather than personal email addresses in public code.
begin;

create table public.fb_owner_access (
 email text primary key check(email=lower(trim(email)) and length(email) between 3 and 254)
);
alter table public.fb_owner_access enable row level security;
revoke all on public.fb_owner_access from public,anon,authenticated;
grant select,insert,update,delete on public.fb_owner_access to service_role;

-- Preserve the previously configured owner; do not change Auth users or email verification.
insert into fb_owner_access(email) values('dpsg2e@gmail.com');

create function public.fb_is_owner_identity(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u join public.fb_owner_access a on a.email=lower(trim(u.email))
  where u.id=p_user and u.email_confirmed_at is not null)
$$;
revoke all on function public.fb_is_owner_identity(uuid) from public,anon,authenticated;

create or replace function public.fb_guard_staff_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.role in ('owner','moderator') and (new.role<>'owner' or not fb_is_owner_identity(new.id)) then
  raise exception 'Служебный доступ закреплён за подтверждённой почтой владельца.' using errcode='42501';
 end if;
 return new;
end $$;

create or replace function public.fb_sync_account_identity() returns trigger
language plpgsql security definer set search_path=public as $$
declare display_name text:=trim(coalesce(new.raw_user_meta_data->>'display_name',''));birth text:=nullif(new.raw_user_meta_data->>'birth_date','');
begin
 if fb_is_owner_identity(new.id) then
  update fb_accounts set role='owner' where id=new.id;
 else
  update fb_accounts set role='student' where id=new.id and role in ('owner','moderator');
 end if;
 if tg_op='INSERT' then
  if length(display_name) between 2 and 50 then
   insert into fb_student_names(id,name) values(new.id,display_name) on conflict(id) do nothing;
  end if;
  insert into fb_student_profiles(user_id,name) select new.id,case when length(display_name) between 2 and 50 then display_name else '' end
   where exists(select 1 from fb_accounts where id=new.id and role='student') on conflict(user_id) do nothing;
  if birth is not null then
   if birth !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Проверьте дату рождения.';end if;
   insert into fb_account_details(user_id,birth_date) values(new.id,birth::date);
  end if;
 end if;
 return new;
end $$;

create or replace function public.fb_role() returns text
language sql stable security definer set search_path=public as $$
 select case when a.role in ('owner','moderator') then
  case when fb_is_owner_identity(a.id) then 'owner' else 'student' end else a.role end
 from fb_accounts a where a.id=auth.uid()
$$;

create function public.fb_sync_owner_access() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op<>'DELETE' then
  update fb_accounts a set role='owner' from auth.users u
   where a.id=u.id and lower(trim(u.email))=new.email and u.email_confirmed_at is not null;
 end if;
 if tg_op<>'INSERT' then
  update fb_accounts a set role='student' from auth.users u
   where a.id=u.id and lower(trim(u.email))=old.email and a.role in ('owner','moderator')
    and not fb_is_owner_identity(a.id);
 end if;
 return null;
end $$;
create trigger fb_owner_access_sync after insert or update or delete on public.fb_owner_access
 for each row execute function fb_sync_owner_access();
revoke all on function public.fb_guard_staff_identity(),public.fb_sync_account_identity(),public.fb_sync_owner_access() from public,anon,authenticated;

commit;
