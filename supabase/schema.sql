-- CourierFlow database schema (PostgreSQL 17 / Supabase).
-- Applied to the hosted CourierFlow project on 2026-11-06.
-- For a fresh project, run this file once from the Supabase SQL Editor.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

do $$ begin
  create type public.app_role as enum ('admin', 'dispatcher', 'courier', 'client');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('new', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'client',
  rating numeric(3,2) not null default 5.00 check (rating between 0 and 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references public.profiles(id),
  courier_id uuid references public.profiles(id),
  pickup_address text not null,
  delivery_address text not null,
  customer_note text,
  price numeric(10,2) not null default 0 check (price >= 0),
  status public.order_status not null default 'new',
  scheduled_for timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_orders_different_parties check (courier_id is null or courier_id <> customer_id)
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.courier_shifts (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.courier_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.delivery_orders(id),
  customer_id uuid not null references public.profiles(id),
  courier_id uuid not null references public.profiles(id),
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index delivery_orders_customer_idx on public.delivery_orders(customer_id, created_at desc);
create index delivery_orders_courier_idx on public.delivery_orders(courier_id, status);
create index delivery_orders_status_idx on public.delivery_orders(status, created_at desc);
create index order_events_order_idx on public.order_events(order_id, created_at);
create index order_events_actor_idx on public.order_events(actor_id);
create index courier_shifts_courier_idx on public.courier_shifts(courier_id, starts_at desc);
create index courier_reviews_courier_idx on public.courier_reviews(courier_id, created_at desc);
create index courier_reviews_customer_idx on public.courier_reviews(customer_id);

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','dispatcher') and p.is_active
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;

create or replace function private.is_active_courier()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'courier' and p.is_active
  );
$$;

create or replace function private.can_view_profile(target_profile_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.delivery_orders o
    where (o.customer_id = (select auth.uid()) and o.courier_id = target_profile_id)
       or (o.courier_id = (select auth.uid()) and o.customer_id = target_profile_id)
  );
$$;

create or replace function private.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
     and auth.uid() is not null and not private.is_admin() then
    raise exception 'Only an administrator can change account role or active status';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'client')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger profiles_guard_privileges before update on public.profiles
for each row execute function private.guard_profile_privileges();
create trigger delivery_orders_set_updated_at before update on public.delivery_orders
for each row execute function private.set_updated_at();
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.order_events enable row level security;
alter table public.courier_shifts enable row level security;
alter table public.courier_reviews enable row level security;

create policy "profiles read self staff or counterpart"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_staff()) or (select private.can_view_profile(id)));

create policy "profile update self or admin"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "customer create own order"
on public.delivery_orders for insert to authenticated
with check (customer_id = (select auth.uid()) and courier_id is null and status = 'new');

create policy "customer courier staff read order"
on public.delivery_orders for select to authenticated
using (
  customer_id = (select auth.uid()) or courier_id = (select auth.uid())
  or (select private.is_staff()) or (status = 'new' and (select private.is_active_courier()))
);

create policy "staff update orders"
on public.delivery_orders for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "order events visible to participants"
on public.order_events for select to authenticated
using (exists (
  select 1 from public.delivery_orders o
  where o.id = order_id and (
    o.customer_id = (select auth.uid()) or o.courier_id = (select auth.uid()) or (select private.is_staff())
  )
));

create policy "staff add order events"
on public.order_events for insert to authenticated
with check (actor_id = (select auth.uid()) and (select private.is_staff())
  and exists (select 1 from public.delivery_orders o where o.id = order_id));

create policy "courier reads own shifts or staff"
on public.courier_shifts for select to authenticated
using (courier_id = (select auth.uid()) or (select private.is_staff()));

create policy "staff inserts shifts"
on public.courier_shifts for insert to authenticated
with check ((select private.is_staff()));

create policy "staff updates shifts"
on public.courier_shifts for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "staff deletes shifts"
on public.courier_shifts for delete to authenticated
using ((select private.is_staff()));

create policy "reviews visible to participants or staff"
on public.courier_reviews for select to authenticated
using (customer_id = (select auth.uid()) or courier_id = (select auth.uid()) or (select private.is_staff()));

create policy "customer reviews delivered order"
on public.courier_reviews for insert to authenticated
with check (customer_id = (select auth.uid()) and exists (
  select 1 from public.delivery_orders o
  where o.id = order_id and o.customer_id = (select auth.uid())
    and o.courier_id = courier_id and o.status = 'delivered'
));

grant usage on type public.app_role, public.order_status to authenticated;
grant select on public.profiles to authenticated;
revoke update on table public.profiles from authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;
grant select, insert, update on public.delivery_orders to authenticated;
grant select, insert on public.order_events to authenticated;
grant select, insert, update on public.courier_shifts to authenticated;
grant select, insert on public.courier_reviews to authenticated;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_active_courier() from public, anon;
revoke all on function private.can_view_profile(uuid) from public, anon;
revoke all on function private.guard_profile_privileges() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_courier() to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;


-- Realtime subscriptions for dispatcher, courier and customer order tracking.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_orders') then
    alter publication supabase_realtime add table public.delivery_orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events') then
    alter publication supabase_realtime add table public.order_events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courier_shifts') then
    alter publication supabase_realtime add table public.courier_shifts;
  end if;
end $$;
