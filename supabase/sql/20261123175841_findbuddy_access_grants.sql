-- Supabase may grant new public objects to API roles by default.
-- Private account details are read-only for their owner, through existing RLS.
begin;
revoke all on table public.fb_account_details from public,anon,authenticated;
grant select on table public.fb_account_details to authenticated;
grant all on table public.fb_account_details to service_role;

-- The dashboard requires a session; trigger helpers are never API endpoints.
revoke all on function public.fb_dashboard() from public,anon;
grant execute on function public.fb_dashboard() to authenticated;
revoke all on function public.fb_schedule_guard(),public.fb_booking_details(),
 public.fb_calendar_changed(),public.fb_preserve_past_booking()
 from public,anon,authenticated;
commit;
