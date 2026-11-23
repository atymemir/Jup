-- Run after 108. The owner chose a free platform pilot, not free teacher lessons.
-- Keep the historical 5% model as a quote, never as an amount charged in the pilot.
begin;
do $$begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='fb_bookings' and column_name='model_commission') then
  alter table public.fb_bookings rename column commission to model_commission;
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='fb_bookings' and column_name='model_tutor_net') then
  alter table public.fb_bookings rename column tutor_net to model_tutor_net;
 end if;
end $$;
alter table public.fb_bookings
  add column if not exists commission_policy text not null default 'pilot_free' check(commission_policy='pilot_free'),
  add column if not exists commission integer generated always as (
    case when commission_policy='pilot_free' then 0 else round(price::numeric*0.05)::integer end
  ) stored,
  add column if not exists tutor_net integer generated always as (
    case when commission_policy='pilot_free' then price else price-round(price::numeric*0.05)::integer end
  ) stored;
comment on column public.fb_bookings.commission_policy is 'Terms captured for this booking. Future pricing must not change pilot_free records.';
comment on column public.fb_bookings.model_commission is 'Illustrative 5% model, not a payable fee during the free pilot.';
comment on column public.fb_bookings.model_tutor_net is 'Illustrative 5% model, not a payout or a payment confirmation.';

-- A distinct RPC ensures a deployment without this migration fails clearly instead
-- of silently presenting the old 5% calculations as current pilot charges.
do $migration$begin
 if to_regprocedure('public.fb_pilot_dashboard_before_platform()') is null then
  execute $function$create or replace function public.fb_pilot_dashboard() returns jsonb
  language sql stable security definer set search_path=public as $$
    select fb_profile_dashboard() || jsonb_build_object('free_pilot',true)
  $$$function$;
 end if;
end $migration$;
revoke all on function public.fb_pilot_dashboard() from public,anon,authenticated;
grant execute on function public.fb_pilot_dashboard() to authenticated;
commit;
