\set ON_ERROR_STOP on
-- two users, one product
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','a@test'), ('22222222-2222-2222-2222-222222222222','b@test');
insert into products (id, barcode, type, name, category, score, color) values ('aaaaaaaa-0000-0000-0000-000000000001','4600000000011','food','Овсяные хлопья','cereal',94,'green');
insert into products (id, barcode, type, name, category, score, color) values ('aaaaaaaa-0000-0000-0000-000000000002','4600000000035','food','Подушечки','cereal',33,'orange');
create or replace function _as(uid text, r text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claim.role', r, false);
  execute format('set role %I', r);
end $$;
grant execute on function _as(text, text) to public;

-- profile auto-created by trigger
do $$ begin assert (select count(*) from profiles) = 2, 'profiles trigger'; end $$;

-- user A writes own data
select _as('11111111-1111-1111-1111-111111111111');
insert into favorites values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001');
insert into scan_events (user_id, product_id) values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin assert (select count(*) from favorites) = 1, 'A sees own favorite'; end $$;

-- user B gets nothing back
reset role; select _as('22222222-2222-2222-2222-222222222222');
do $$ begin assert (select count(*) from favorites) = 0, 'B must not see A favorites'; end $$;
do $$ begin assert (select count(*) from scan_events) = 0, 'B must not see A scans'; end $$;
do $$ begin assert (select count(*) from profiles) = 1, 'B sees only own profile'; end $$;
-- B cannot write for A
do $$ begin
  begin insert into favorites values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002'); assert false, 'B inserted for A';
  exception when insufficient_privilege then null; end;
end $$;
-- B cannot read products directly, only through functions
do $$ begin assert (select count(*) from products) = 0, 'products hidden from direct select'; end $$;
do $$ begin assert product_by_barcode('4600000000011') ->> 'name' = 'Овсяные хлопья', 'by_barcode works'; end $$;
do $$ begin assert product_by_barcode('0000000000000') is null, 'unknown barcode is null'; end $$;
do $$ begin assert (select count(*) from product_alternatives('aaaaaaaa-0000-0000-0000-000000000002')) = 1, 'alternatives'; end $$;
-- search is premium only
do $$ begin
  begin perform search_products('овс'); assert false, 'free user searched';
  exception when insufficient_privilege then null; end;
end $$;
-- user cannot grant themselves premium
update profiles set premium_until = now() + interval '1 year' where id = '22222222-2222-2222-2222-222222222222';
do $$ begin assert (select premium_until from profiles) is null, 'premium_until is protected'; end $$;
-- submissions: only pending, own
insert into submissions (user_id, barcode) values ('22222222-2222-2222-2222-222222222222','4609999999991');
do $$ begin
  begin insert into submissions (user_id, barcode, status) values ('22222222-2222-2222-2222-222222222222','1','published'); assert false, 'published insert';
  exception when insufficient_privilege then null; end;
end $$;
-- subscriptions not writable by client
do $$ begin
  begin insert into subscriptions (user_id, provider, provider_ref, status, current_period_end) values ('22222222-2222-2222-2222-222222222222','apple','x','active', now()+interval '1 day'); assert false, 'client wrote subscription';
  exception when insufficient_privilege then null; end;
end $$;
-- anon gets nothing
reset role; select _as('', 'anon');
do $$ begin
  begin perform product_by_barcode('4600000000011'); assert false, 'anon called rpc';
  exception when insufficient_privilege then null; end;
end $$;

-- webhook (service role) grants premium -> search works for B
reset role; select _as('', 'service_role');
insert into subscriptions (user_id, provider, provider_ref, status, current_period_end) values ('22222222-2222-2222-2222-222222222222','apple','tx1','active', now()+interval '30 days');
select refresh_premium('22222222-2222-2222-2222-222222222222');
reset role; select _as('22222222-2222-2222-2222-222222222222');
do $$ begin assert (select count(*) from search_products('овс')) = 1, 'premium search'; end $$;

-- account deletion removes everything of B, keeps submissions detached
select delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from profiles where id='22222222-2222-2222-2222-222222222222') = 0, 'profile deleted';
  assert (select count(*) from subscriptions) = 0, 'subs deleted';
  assert (select count(*) from submissions where user_id is null) = 1, 'submission kept detached';
end $$;
\echo ALL RLS TESTS PASSED
