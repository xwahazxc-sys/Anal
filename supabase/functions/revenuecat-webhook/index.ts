// Supabase Edge Function (Deno). Receives RevenueCat webhooks and keeps `subscriptions` / premium_until in sync.
// Secrets (set with `supabase secrets set`): REVENUECAT_WEBHOOK_AUTH, SUPABASE_SERVICE_ROLE_KEY (provided), SUPABASE_URL (provided).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const ACTIVE = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
const GRACE = new Set(['BILLING_ISSUE']);

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  // RevenueCat sends the configured value in the Authorization header.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
  if (!expected || !timingSafeEqual(req.headers.get('authorization') ?? '', expected)) {
    return new Response('unauthorized', { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const ev = body?.event;
  if (!ev?.id || !ev?.type) return new Response('bad event', { status: 400 });

  // Idempotency: a repeated event id is acknowledged and ignored.
  const ins = await db.from('webhook_events').insert({ provider: 'revenuecat', event_id: ev.id });
  if (ins.error) {
    if (ins.error.code === '23505') return new Response('duplicate', { status: 200 });
    return new Response('db error', { status: 500 });
  }

  const uid: string | undefined = ev.app_user_id;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return new Response('ignored (anonymous user)', { status: 200 });

  let status: 'active' | 'grace' | 'expired' | 'cancelled' | null = null;
  if (ACTIVE.has(ev.type)) status = 'active';
  else if (GRACE.has(ev.type)) status = 'grace';
  else if (ev.type === 'EXPIRATION') status = 'expired';
  else if (ev.type === 'CANCELLATION') status = 'cancelled'; // still active until period end; expiry event follows
  if (!status) return new Response('ignored', { status: 200 });

  const end = new Date(ev.expiration_at_ms ?? Date.now()).toISOString();
  const store = String(ev.store ?? '').toUpperCase() === 'PLAY_STORE' ? 'google' : String(ev.store ?? '').toUpperCase() === 'STRIPE' ? 'stripe' : 'apple';
  const up = await db.from('subscriptions').upsert(
    { user_id: uid, provider: store, provider_ref: String(ev.original_transaction_id ?? ev.transaction_id ?? ev.id),
      status, current_period_end: end, updated_at: new Date().toISOString() },
    { onConflict: 'provider,provider_ref' },
  );
  const rf = up.error ? up : await db.rpc('refresh_premium', { uid });
  if (up.error || rf.error) {
    // Let RevenueCat's retry reprocess this event instead of dropping it as a duplicate.
    await db.from('webhook_events').delete().match({ provider: 'revenuecat', event_id: ev.id });
    return new Response('db error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
