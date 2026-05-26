-- Meishi campus dining MVP schema for Supabase Postgres.
-- Recommended auth strategy: Supabase Auth + public.users extension table.

create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'restricted');
create type public.merchant_status as enum ('pending', 'approved', 'rejected', 'offline');
create type public.review_status as enum ('visible', 'hidden');
create type public.penalty_type as enum ('warning', 'restrict');
create type public.report_reason as enum ('abuse', 'ads', 'manipulation', 'irrelevant', 'other');
create type public.handle_status as enum ('pending', 'resolved', 'dismissed');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null unique check (student_id ~ '^202[0-9][0-9]{4}$'),
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_url text,
  nickname_updated_at timestamptz,
  account_status public.account_status not null default 'active',
  warning_count integer not null default 0,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_penalty_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  penalty_type public.penalty_type not null,
  reason text,
  operator_id uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  location text not null check (location in ('南苑一楼', '南苑二楼', '南苑三楼', '北苑一楼', '北苑二楼', '北苑三楼', '北苑侧楼', '青春集市')),
  cover_image_url text,
  description text,
  status public.merchant_status not null default 'pending',
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_images (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  dish_name text not null check (char_length(dish_name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.dish_images (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.review_status not null default 'visible',
  constraint reviews_one_per_user_per_merchant unique (user_id, merchant_id),
  constraint reviews_content_length check (content is null or char_length(content) <= 300)
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reason_type public.report_reason not null,
  reason_detail text,
  status public.handle_status not null default 'pending',
  handled_by uuid references public.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint review_reports_unique_reporter unique (review_id, reporter_user_id)
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  status public.handle_status not null default 'pending',
  created_at timestamptz not null default now(),
  handled_by uuid references public.users(id),
  handled_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid,
  action text not null,
  operator_id uuid references public.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings(key, value)
values ('bayesian_config', jsonb_build_object('m', 5))
on conflict (key) do nothing;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_review_report_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set report_count = report_count + 1 where id = new.review_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reviews set report_count = greatest(report_count - 1, 0) where id = old.review_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce((select role from public.users where id = auth.uid()), 'user'::public.app_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('admin', 'super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'super_admin';
$$;

create or replace function public.get_bayesian_score(target_merchant_id uuid)
returns numeric
language sql
stable
as $$
with merchant_review as (
  select avg(rating)::numeric as r, count(*)::numeric as v
  from public.reviews
  where merchant_id = target_merchant_id and status = 'visible'
),
platform_review as (
  select coalesce(avg(rating)::numeric, 0) as c
  from public.reviews
  where status = 'visible'
),
config as (
  select coalesce((value->>'m')::numeric, 5) as m
  from public.system_settings
  where key = 'bayesian_config'
)
select case
  when mr.v is null or mr.v = 0 then pr.c
  else ((mr.v / (mr.v + cfg.m)) * mr.r) + ((cfg.m / (mr.v + cfg.m)) * pr.c)
end
from merchant_review mr
cross join platform_review pr
cross join config cfg;
$$;

create trigger users_handle_updated_at
before update on public.users
for each row execute procedure public.handle_updated_at();

create trigger merchants_handle_updated_at
before update on public.merchants
for each row execute procedure public.handle_updated_at();

create trigger reviews_handle_updated_at
before update on public.reviews
for each row execute procedure public.handle_updated_at();

create trigger review_reports_insert_count
after insert on public.review_reports
for each row execute procedure public.handle_review_report_count();

create trigger review_reports_delete_count
after delete on public.review_reports
for each row execute procedure public.handle_review_report_count();

alter table public.users enable row level security;
alter table public.user_penalty_logs enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_images enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_images enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.feedbacks enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "users_self_read" on public.users
for select using (auth.uid() = id or public.is_admin());

create policy "users_self_update" on public.users
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "users_self_insert" on public.users
for insert with check (auth.uid() = id);

create policy "admins_read_penalty_logs" on public.user_penalty_logs
for select using (public.is_admin());

create policy "admins_manage_penalty_logs" on public.user_penalty_logs
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_approved_merchants" on public.merchants
for select using (status = 'approved' or public.is_admin() or auth.uid() = created_by);

create policy "users_create_merchants" on public.merchants
for insert with check (auth.uid() = created_by);

create policy "admins_update_merchants" on public.merchants
for update using (public.is_admin()) with check (public.is_admin());

create policy "public_read_merchant_images" on public.merchant_images
for select using (
  exists (select 1 from public.merchants m where m.id = merchant_id and (m.status = 'approved' or public.is_admin() or auth.uid() = m.created_by))
);

create policy "users_manage_merchant_images" on public.merchant_images
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_dishes" on public.dishes
for select using (
  exists (select 1 from public.merchants m where m.id = merchant_id and (m.status = 'approved' or public.is_admin() or auth.uid() = m.created_by))
);

create policy "admins_manage_dishes" on public.dishes
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_dish_images" on public.dish_images
for select using (true);

create policy "admins_manage_dish_images" on public.dish_images
for all using (public.is_admin()) with check (public.is_admin());

create policy "public_read_reviews" on public.reviews
for select using (
  status = 'visible' and exists (select 1 from public.merchants m where m.id = merchant_id and m.status = 'approved')
  or public.is_admin()
  or auth.uid() = user_id
);

create policy "users_manage_own_reviews" on public.reviews
for all using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "users_create_reports" on public.review_reports
for insert with check (auth.uid() = reporter_user_id);

create policy "users_read_own_reports" on public.review_reports
for select using (auth.uid() = reporter_user_id or public.is_admin());

create policy "admins_manage_reports" on public.review_reports
for update using (public.is_admin()) with check (public.is_admin());

create policy "users_manage_feedbacks" on public.feedbacks
for all using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "admins_read_audit_logs" on public.audit_logs
for select using (public.is_admin());

create policy "admins_write_audit_logs" on public.audit_logs
for insert with check (public.is_admin());

create policy "everyone_read_settings" on public.system_settings
for select using (true);

comment on function public.get_bayesian_score(uuid) is 'Bayesian ranking formula: score = (v / (v + m)) * R + (m / (v + m)) * C';
