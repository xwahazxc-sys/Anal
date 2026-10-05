-- Schema for the Yuka-style scanner. Postgres (Supabase). Access rules: RLS.
create extension if not exists pg_trgm;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  premium_until timestamptz,
  preferences jsonb not null default '{}',  -- vegetarian, vegan, palm_oil, gluten, lactose
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique,
  type text not null check (type in ('food','cosmetic')),
  name text not null,
  brand text,
  photo_url text,
  nutrition jsonb not null default '{}',    -- per 100 g
  organic boolean not null default false,
  source text not null default 'open_data'
    check (source in ('open_data','user','brand','manual')),
  score smallint check (score between 0 and 100),
  color text check (color in ('green','yellow','orange','red')),
  score_version int not null default 1,     -- bump when the formula changes, recompute
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (type, score);
create index products_name_trgm on products using gin (name gin_trgm_ops);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('additive','cosmetic')),
  risk_level text not null check (risk_level in ('none','low','moderate','high')),
  note text,                                -- own wording, own sources
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, name)
);

create table product_ingredients (
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  position smallint not null,
  primary key (product_id, ingredient_id)
);
create index on product_ingredients (ingredient_id);

create table scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on scan_events (user_id, scanned_at desc);
create index on scan_events (product_id);

create table favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index on favorites (product_id);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,  -- keep data after account deletion
  barcode text not null,
  photo_urls text[] not null default '{}',
  ocr_text text,
  status text not null default 'pending'
    check (status in ('pending','auto_ok','manual_review','published','rejected')),
  product_id uuid references products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on submissions (user_id);
create index on submissions (status, created_at);
create index on submissions (barcode);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('apple','google','stripe')),
  provider_ref text not null,
  status text not null check (status in ('active','grace','expired','cancelled')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index on subscriptions (user_id);

-- Access rules (RLS): users read/write only their own rows;
-- products and ingredients are readable by everyone, writable by service role only.
alter table profiles enable row level security;
alter table scan_events enable row level security;
alter table favorites enable row level security;
alter table submissions enable row level security;
alter table subscriptions enable row level security;
alter table products enable row level security;
alter table ingredients enable row level security;
alter table product_ingredients enable row level security;

create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own_scans on scan_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_favs on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_submissions on submissions for select using (user_id = auth.uid());
create policy new_submission on submissions for insert with check (user_id = auth.uid());
create policy own_subs on subscriptions for select using (user_id = auth.uid());
create policy read_products on products for select using (true);
create policy read_ingredients on ingredients for select using (true);
create policy read_pi on product_ingredients for select using (true);
-- subscriptions are written only by the webhook (service role); no insert/update policy.
