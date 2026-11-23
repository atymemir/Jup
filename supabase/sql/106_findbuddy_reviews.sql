-- Run after 105. Public reviews never expose student ids or booking details.
begin;
create table public.fb_reviews (
  student_id uuid not null references auth.users on delete cascade,
  tutor_id uuid not null references public.fb_tutors on delete cascade,
  booking_id uuid not null references public.fb_bookings on delete cascade,
  score smallint not null check(score between 1 and 5),
  body text not null check(length(body)<=700),
  updated_at timestamptz not null default now(),
  primary key(student_id,tutor_id)
);
create index fb_reviews_tutor on public.fb_reviews(tutor_id,updated_at desc);
alter table public.fb_reviews enable row level security;
revoke all on public.fb_reviews from public,anon,authenticated;

create function public.fb_market_catalog() returns jsonb
language sql stable security definer set search_path=public as $$
  with base as (select fb_catalog() as payload),
  grades as (select fb_reviews.tutor_id,count(*) as total,round(avg(score),1) as rating from fb_reviews
    join fb_bookings b on b.id=fb_reviews.booking_id and b.status<>'cancelled' and b.starts_at+interval '60 minutes'<=now()
    group by fb_reviews.tutor_id)
  select payload || jsonb_build_object('tutors',(
    select coalesce(jsonb_agg(t || jsonb_build_object('review_count',coalesce(g.total,0),'rating',g.rating) order by ord),'[]'::jsonb)
    from jsonb_array_elements(payload->'tutors') with ordinality as tutors(t,ord)
    left join grades g on g.tutor_id=(t->>'id')::uuid
  )) from base
$$;

create function public.fb_public_reviews(p_tutor uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc),'[]'::jsonb) from (
    select score,body,updated_at from fb_reviews rv join fb_tutors t on t.id=rv.tutor_id and t.verification='verified'
    join fb_bookings b on b.id=rv.booking_id and b.status<>'cancelled' and b.starts_at+interval '60 minutes'<=now()
    where rv.tutor_id=p_tutor order by updated_at desc limit 20
  ) r
$$;

create function public.fb_review(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); tutor uuid:=(p_data->>'tutor_id')::uuid; booking uuid; result jsonb;
begin
  if u is null or u=tutor then raise exception 'Отзыв недоступен.' using errcode='42501'; end if;
  if p_action='mine' then
    select jsonb_build_object('score',r.score,'body',r.body) into result from fb_reviews r where student_id=u and tutor_id=tutor;
    return result;
  elsif p_action='remove' then
    delete from fb_reviews where student_id=u and tutor_id=tutor;
  elsif p_action='save' then
    select b.id into booking from fb_bookings b where b.student_id=u and b.tutor_id=tutor
      and b.status<>'cancelled' and b.starts_at+interval '60 minutes'<=now() order by b.starts_at desc limit 1 for share;
    if not found then raise exception 'Оставить отзыв можно после занятия.' using errcode='42501'; end if;
    insert into fb_reviews(student_id,tutor_id,booking_id,score,body) values(u,tutor,booking,(p_data->>'score')::smallint,trim(coalesce(p_data->>'body','')))
      on conflict(student_id,tutor_id) do update set booking_id=excluded.booking_id,score=excluded.score,body=excluded.body,updated_at=now();
  else
    raise exception 'Неизвестное действие.';
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.fb_market_catalog(),public.fb_public_reviews(uuid),public.fb_review(text,jsonb) from public,anon,authenticated;
grant execute on function public.fb_market_catalog(),public.fb_public_reviews(uuid) to anon,authenticated;
grant execute on function public.fb_review(text,jsonb) to authenticated;
commit;
