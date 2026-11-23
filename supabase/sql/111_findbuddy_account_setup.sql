-- Run after 110. Verified owner identity, private account details and signup defaults.
begin;
alter table fb_student_profiles add column budget_max integer check(budget_max between 0 and 100000);
create table public.fb_account_details (
 user_id uuid primary key references auth.users on delete cascade,
 birth_date date check(birth_date <= current_date and birth_date >= current_date - interval '120 years')
);
alter table fb_account_details enable row level security;
create policy account_details_self on fb_account_details for select to authenticated using(user_id=auth.uid());
grant select on fb_account_details to authenticated;

-- Revoke every previous staff identity and pending moderator invitation.
update fb_accounts a set role='student' where role in ('owner','moderator') and not exists(
 select 1 from auth.users u where u.id=a.id and lower(trim(u.email))='dpsg2e@gmail.com' and u.email_confirmed_at is not null
);
update fb_accounts a set role='owner' from auth.users u where u.id=a.id and lower(trim(u.email))='dpsg2e@gmail.com' and u.email_confirmed_at is not null;
update fb_invitations set revoked=true where kind='moderator' and accepted_by is null;

create function public.fb_guard_staff_identity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.role in ('owner','moderator') and (new.role<>'owner' or not exists(
  select 1 from auth.users where id=new.id and lower(trim(email))='dpsg2e@gmail.com' and email_confirmed_at is not null
 )) then raise exception 'Служебный доступ закреплён за подтверждённой почтой владельца.' using errcode='42501';end if;
 return new;
end $$;
create trigger fb_staff_identity before insert or update of role on fb_accounts for each row execute function fb_guard_staff_identity();

create function public.fb_sync_account_identity() returns trigger language plpgsql security definer set search_path=public as $$
declare display_name text:=trim(coalesce(new.raw_user_meta_data->>'display_name',''));birth text:=nullif(new.raw_user_meta_data->>'birth_date','');
begin
 if lower(trim(new.email))='dpsg2e@gmail.com' and new.email_confirmed_at is not null then
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
create trigger fb_identity_sync after insert or update of email,email_confirmed_at on auth.users for each row execute function fb_sync_account_identity();

create or replace function public.fb_role() returns text language sql stable security definer set search_path=public as $$
 select case when a.role in ('owner','moderator') then case when lower(trim(u.email))='dpsg2e@gmail.com' and u.email_confirmed_at is not null then 'owner' else 'student' end else a.role end
 from fb_accounts a join auth.users u on u.id=a.id where a.id=auth.uid()
$$;
alter function public.fb_platform_action(text,jsonb) rename to fb_platform_action_before_account_setup;
revoke all on function public.fb_platform_action_before_account_setup(text,jsonb) from public,anon,authenticated;
create function public.fb_platform_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;budget integer;
begin
 if p_action='student_profile' then
  budget:=nullif(p_data->>'budget_max','')::integer;
  if budget is not null and budget not between 0 and 100000 then raise exception 'Проверьте бюджет.';end if;
 end if;
 if p_action='invite_moderator' then raise exception 'Модерацией управляет только владелец платформы.' using errcode='42501';end if;
 result:=fb_platform_action_before_account_setup(p_action,p_data);
 if p_action='student_profile' then update fb_student_profiles set budget_max=budget where user_id=auth.uid();end if;
 return result;
end $$;
revoke all on function public.fb_platform_action(text,jsonb) from public,anon;
grant execute on function public.fb_platform_action(text,jsonb) to authenticated;
revoke all on function public.fb_guard_staff_identity(),public.fb_sync_account_identity() from public,anon,authenticated;
commit;
