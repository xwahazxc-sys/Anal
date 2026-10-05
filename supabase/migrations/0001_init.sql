-- Scanner schema. Postgres (Supabase). Access rules: RLS.
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
  category text not null default 'other',
  tags text[] not null default '{}',
  source text not null default 'open_data'
    check (source in ('open_data','user','brand','manual')),
  score smallint check (score between 0 and 100),
  color text check (color in ('green','yellow','orange','red')),
  score_version int not null default 1,     -- bump when the formula changes, recompute
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (type, category, score);
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
  type text not null default 'food' check (type in ('food','cosmetic')),
  name text,
  brand text,
  ingredients_text text,
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
-- products and ingredients are reachable only through the functions below; writes: service role only.
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
create policy new_submission on submissions for insert
  with check (user_id = auth.uid() and status = 'pending' and product_id is null);
create policy own_subs on subscriptions for select using (user_id = auth.uid());
-- products, ingredients, product_ingredients have RLS on and no policies: clients read them
-- only through the security-definer functions below, so name search stays a Premium feature.
-- subscriptions are written only by the webhook (service role); no insert/update policy.

-- Webhook idempotency: every provider event id is stored once.
create table webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table webhook_events enable row level security; -- no policies: service role only

-- A profile row appears for every new auth user.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- premium_until is derived from subscriptions, never trusted from the client.
create or replace function refresh_premium(uid uuid) returns void
language sql security definer set search_path = public as $$
  update profiles set premium_until = (
    select max(current_period_end) from subscriptions
    where user_id = uid and status in ('active','grace','cancelled') -- cancelled = auto-renew off, paid until period end
  ), updated_at = now() where id = uid;
$$;
revoke all on function refresh_premium(uuid) from public, anon, authenticated;

-- Users may not change premium_until themselves.
create or replace function protect_premium() returns trigger
language plpgsql as $$
begin
  if new.premium_until is distinct from old.premium_until and coalesce(auth.role(), '') <> 'service_role' then
    new.premium_until := old.premium_until;
  end if;
  return new;
end $$;
create trigger profiles_protect_premium before update on profiles
  for each row execute function protect_premium();

-- Account deletion that really deletes. Submissions stay, detached from the user.
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- Read API. Product JSON includes its ingredients; scoring is done by the client from this data.
create or replace function product_json(p products) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'barcode', p.barcode, 'type', p.type, 'name', p.name, 'brand', p.brand,
    'organic', p.organic, 'nutrition', p.nutrition, 'category', coalesce(p.category, 'other'),
    'tags', p.tags,
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'risk', i.risk_level, 'note', i.note) order by pi.position)
      from product_ingredients pi join ingredients i on i.id = pi.ingredient_id where pi.product_id = p.id
    ), '[]'::jsonb));
$$;
revoke all on function product_json(products) from public, anon, authenticated;

create or replace function product_by_barcode(code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p products;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into p from products where barcode = regexp_replace(code, '\D', '', 'g');
  if not found then return null; end if;
  return product_json(p);
end $$;

create or replace function product_alternatives(pid uuid) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
declare base products;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into base from products where id = pid;
  if not found then return; end if;
  return query
    select product_json(x) from products x
    where x.type = base.type and x.category = base.category and x.id <> base.id and x.score > coalesce(base.score, 0)
    order by x.score desc limit 5;
end $$;

create or replace function product_json_by_ids(ids uuid[]) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query select product_json(x) from products x where x.id = any(ids);
end $$;

-- Name search is Premium-only, enforced here and not in the client.
create or replace function search_products(q text) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and premium_until > now()) then
    raise exception 'premium required' using errcode = '42501';
  end if;
  return query select product_json(x) from products x
    where x.name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%' order by x.name limit 30;
end $$;

revoke all on function product_by_barcode(text), product_alternatives(uuid), product_json_by_ids(uuid[]), search_products(text) from public, anon;
grant execute on function product_by_barcode(text), product_alternatives(uuid), product_json_by_ids(uuid[]), search_products(text) to authenticated;
