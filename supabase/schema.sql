-- CourierFlow initial schema. Apply in a fresh Supabase project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'dispatcher', 'courier', 'client');
create type public.order_status as enum ('new', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled');

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
  updated_at timestamptz not null default now()
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
create index courier_shifts_courier_idx on public.courier_shifts(courier_id, starts_at desc);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','dispatcher') and is_active); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active); $$;

alter table public.profiles enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.order_events enable row level security;
alter table public.courier_shifts enable row level security;
alter table public.courier_reviews enable row level security;

create policy "profiles read self or staff" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_staff() or exists (
  select 1 from public.delivery_orders o where o.customer_id = auth.uid() and o.courier_id = profiles.id
));
create policy "profile update self safe fields" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
create policy "staff manage profiles" on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "customer create own order" on public.delivery_orders for insert to authenticated
with check (customer_id = auth.uid() and courier_id is null and status = 'new');
create policy "customer courier staff read order" on public.delivery_orders for select to authenticated
using (customer_id = auth.uid() or courier_id = auth.uid() or public.is_staff() or (status = 'new' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'courier' and p.is_active)));
create policy "staff update orders" on public.delivery_orders for update to authenticated
using (public.is_staff()) with check (public.is_staff());
create policy "assigned courier update order status" on public.delivery_orders for update to authenticated
using (courier_id = auth.uid()) with check (courier_id = auth.uid() and customer_id = (select o.customer_id from public.delivery_orders o where o.id = id));

create policy "order events visible to participants" on public.order_events for select to authenticated
using (exists (select 1 from public.delivery_orders o where o.id = order_id and (o.customer_id = auth.uid() or o.courier_id = auth.uid() or public.is_staff())));
create policy "participants add order events" on public.order_events for insert to authenticated
with check (actor_id = auth.uid() and exists (select 1 from public.delivery_orders o where o.id = order_id and (o.customer_id = auth.uid() or o.courier_id = auth.uid() or public.is_staff())));

create policy "courier reads own shifts or staff" on public.courier_shifts for select to authenticated
using (courier_id = auth.uid() or public.is_staff());
create policy "staff manages shifts" on public.courier_shifts for all to authenticated
using (public.is_staff()) with check (public.is_staff());

create policy "reviews visible to participants or staff" on public.courier_reviews for select to authenticated
using (customer_id = auth.uid() or courier_id = auth.uid() or public.is_staff());
create policy "customer reviews delivered order" on public.courier_reviews for insert to authenticated
with check (customer_id = auth.uid() and exists (
  select 1 from public.delivery_orders o where o.id = order_id and o.customer_id = auth.uid() and o.courier_id = courier_id and o.status = 'delivered'
));

grant usage on type public.app_role, public.order_status to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.delivery_orders to authenticated;
grant select, insert on public.order_events to authenticated;
grant select, insert, update on public.courier_shifts to authenticated;
grant select, insert on public.courier_reviews to authenticated;
