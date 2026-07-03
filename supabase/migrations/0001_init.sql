-- Ma Zone — Schéma initial
-- Plateforme de livraison locale en moins d'une heure.

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('consumer', 'merchant', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending', 'preparing', 'ready', 'assigned',
    'picked_up', 'delivering', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fulfillment_type as enum ('delivery', 'pickup');
exception when duplicate_object then null; end $$;

-- ── profiles ──────────────────────────────────────────────────────────────
-- Étend auth.users avec le rôle et les infos publiques.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'consumer',
  full_name text,
  phone text,
  rating numeric(2,1) default 5.0,
  created_at timestamptz not null default now()
);

-- ── stores ────────────────────────────────────────────────────────────────
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references profiles (id) on delete set null,
  name text not null,
  store_type text,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- ── products ──────────────────────────────────────────────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  image_url text,
  sku text,
  created_at timestamptz not null default now()
);

-- ── inventory ─────────────────────────────────────────────────────────────
-- Lien commerce <-> produit avec prix et stock local.
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  price numeric(10,2) not null,
  stock integer not null default 0,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);

-- ── orders ────────────────────────────────────────────────────────────────
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references profiles (id) on delete set null,
  store_id uuid not null references stores (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  driver_id uuid references profiles (id) on delete set null,
  status order_status not null default 'pending',
  fulfillment fulfillment_type not null default 'delivery',
  price numeric(10,2) not null,
  delivery_address text,
  eta_minutes integer,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── driver_sessions ───────────────────────────────────────────────────────
create table if not exists driver_sessions (
  driver_id uuid primary key references profiles (id) on delete cascade,
  is_online boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_product on inventory (product_id);
create index if not exists idx_orders_store on orders (store_id);
create index if not exists idx_orders_driver on orders (driver_id);
create index if not exists idx_orders_status on orders (status);

-- ── Trigger : créer un profil à l'inscription ─────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'consumer'),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table inventory enable row level security;
alter table orders enable row level security;
alter table driver_sessions enable row level security;

-- Catalogue public en lecture
drop policy if exists "read products" on products;
create policy "read products" on products for select using (true);

drop policy if exists "read stores" on stores;
create policy "read stores" on stores for select using (true);

drop policy if exists "read inventory" on inventory;
create policy "read inventory" on inventory for select using (true);

-- Profils : chacun lit/écrit le sien
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- Commerçant gère son inventaire
drop policy if exists "merchant writes inventory" on inventory;
create policy "merchant writes inventory" on inventory for all
  using (exists (
    select 1 from stores s where s.id = inventory.store_id and s.merchant_id = auth.uid()
  ));

-- Commandes : consommateur, commerçant du store, ou livreur assigné
drop policy if exists "read related orders" on orders;
create policy "read related orders" on orders for select using (
  auth.uid() = consumer_id
  or auth.uid() = driver_id
  or exists (select 1 from stores s where s.id = orders.store_id and s.merchant_id = auth.uid())
);

drop policy if exists "consumer creates order" on orders;
create policy "consumer creates order" on orders for insert with check (auth.uid() = consumer_id);

drop policy if exists "update related orders" on orders;
create policy "update related orders" on orders for update using (
  auth.uid() = consumer_id
  or auth.uid() = driver_id
  or exists (select 1 from stores s where s.id = orders.store_id and s.merchant_id = auth.uid())
);

-- Sessions livreur
drop policy if exists "driver manages session" on driver_sessions;
create policy "driver manages session" on driver_sessions for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);
