// Open Loops push sender (Supabase Edge Function, deployed with verify_jwt
// off because it checks every request itself).
//
//   { job: 'run' }               from the scheduler (pg_cron, every minute,
//                                only when something is due), with the
//                                x-cron-secret header. Sends wake-up nudges for
//                                loops whose time just came, and the daily
//                                check-in to phones whose time it is.
//   { job: 'test', endpoint }    from the app, with the signed-in user's JWT.
//                                Sends a sample nudge to that phone.
//   { job: 'action', token, action: 'done' | 'tomorrow' }
//                                from a notification button. The token was
//                                signed when the nudge was sent.
//
// Secrets live in Supabase Vault and are read through push_config(), which
// only the service role may call.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { b64u, sendWebPush, unb64u, type Vapid } from './webpush.ts';
import { composeNudge, composeTest, composeWake, type Loop, type Nudge } from './compose.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = 'https://hamzasaleem021.github.io/open-loops/open-loops.html';
const SUBJECT = 'https://hamzasaleem021.github.io/open-loops/';
const ACTION_URL = `${SUPABASE_URL}/functions/v1/push`;
const TOKEN_DAYS = 3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();

type Config = Record<string, string>;
let configCache: Config | null = null;
async function config(): Promise<Config> {
  if (configCache) return configCache;
  const { data, error } = await admin.rpc('push_config');
  if (error || !data) throw new Error('push_config unavailable');
  configCache = data as Config;
  return configCache;
}

function vapid(cfg: Config): Vapid {
  return { subject: SUBJECT, publicKey: cfg.open_loops_vapid_public, privateKey: cfg.open_loops_vapid_private };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function sameText(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

async function signToken(claims: Record<string, unknown>, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(claims)));
  return `${body}.${await hmac(secret, body)}`;
}

async function readToken(token: unknown, secret: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !sameText(sig, await hmac(secret, body))) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { return null; }
}

async function payloadFor(nudge: Nudge, sub: { user_id: string; tz: string }, cfg: Config) {
  const payload: Record<string, unknown> = {
    title: nudge.title,
    body: nudge.body,
    url: `${APP_URL}?${nudge.query}`,
    tag: nudge.tag || 'open-loops-nudge',
    renotify: !!nudge.tag,
  };
  if (nudge.loopId && nudge.actions) {
    payload.actions = nudge.actions;
    payload.actionUrl = ACTION_URL;
    payload.token = await signToken(
      { u: sub.user_id, l: nudge.loopId, t: sub.tz, e: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 },
      cfg.open_loops_action_secret,
    );
  }
  return payload;
}

type DueSub = {
  endpoint: string; user_id: string; p256dh: string; auth: string; tz: string;
  stale: boolean; recap: boolean; last_stale_at: string | null;
  recent_lines: string[] | null; local_date: string; local_dow: number;
};
type WakeDue = {
  endpoint: string; user_id: string; p256dh: string; auth: string; tz: string;
  recent_lines: string[] | null; checked_from: string; checked_to: string;
};

async function run(req: Request, cfg: Config): Promise<Response> {
  if (!sameText(req.headers.get('x-cron-secret') || '', cfg.open_loops_cron_secret)) return json({ error: 'forbidden' }, 403);
  const [dailyRes, wakeRes] = await Promise.all([admin.rpc('push_due_subscriptions'), admin.rpc('push_due_wakeups')]);
  if (dailyRes.error) throw dailyRes.error;
  if (wakeRes.error) throw wakeRes.error;
  const daily = (dailyRes.data || []) as DueSub[];
  const wakes = (wakeRes.data || []) as WakeDue[];

  const loopsByUser = new Map<string, Loop[]>();
  for (const userId of new Set([...daily, ...wakes].map(s => s.user_id))) {
    const { data: rows, error } = await admin
      .from('loops')
      .select('id, raw_text, kind, status, prompt_answer, updated_at, completed_at, wake_at, details')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;
    loopsByUser.set(userId, (rows || []) as Loop[]);
  }

  const results: { kind: string; status: number }[] = [];
  const recent = new Map<string, string[]>();
  const gone = new Set<string>();
  const send = async (sub: { endpoint: string; p256dh: string; auth: string; user_id: string; tz: string; recent_lines: string[] | null }, nudge: Nudge, opts: Parameters<typeof sendWebPush>[3]) => {
    const r = await sendWebPush(sub, await payloadFor(nudge, sub, cfg), vapid(cfg), opts);
    results.push({ kind: nudge.kind, status: r.status });
    if (r.gone) {
      gone.add(sub.endpoint);
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    } else if (r.ok) {
      const seen = recent.get(sub.endpoint) ?? sub.recent_lines ?? [];
      recent.set(sub.endpoint, [nudge.lineId, ...seen.filter(id => id !== nudge.lineId)].slice(0, 12));
    } else {
      console.warn('push failed', r.status, r.detail);
    }
    return r;
  };

  // Wake-ups: whatever woke since this phone last checked, in one nudge.
  for (const sub of wakes) {
    const from = Date.parse(sub.checked_from);
    const to = Date.parse(sub.checked_to);
    const woke = (loopsByUser.get(sub.user_id) || [])
      .filter(l => (l.status === 'waiting' || l.status === 'active') && l.wake_at &&
        Date.parse(l.wake_at) > from && Date.parse(l.wake_at) <= to)
      .sort((a, b) => Date.parse(a.wake_at as string) - Date.parse(b.wake_at as string));
    const nudge = composeWake({ recent_lines: recent.get(sub.endpoint) ?? sub.recent_lines }, woke, new Date());
    if (nudge) await send(sub, nudge, { ttl: 3 * 3600, urgency: 'high' });
    if (gone.has(sub.endpoint)) continue;
    const patch: Record<string, unknown> = { wake_checked_at: sub.checked_to };
    if (recent.has(sub.endpoint)) patch.recent_lines = recent.get(sub.endpoint);
    await admin.from('push_subscriptions').update(patch).eq('endpoint', sub.endpoint);
  }

  // The daily check-in: Sunday recap or a weekly "Still yours?".
  for (const sub of daily) {
    if (gone.has(sub.endpoint)) continue;
    const patch: Record<string, unknown> = { last_run_on: sub.local_date, last_run_at: new Date().toISOString() };
    const nudge = composeNudge({ ...sub, recent_lines: recent.get(sub.endpoint) ?? sub.recent_lines }, loopsByUser.get(sub.user_id) || [], new Date());
    if (nudge) {
      const r = await send(sub, nudge, { topic: 'nudge' });
      if (r.gone) continue;
      if (r.ok && nudge.kind === 'stale') patch.last_stale_at = new Date().toISOString();
    }
    if (recent.has(sub.endpoint)) patch.recent_lines = recent.get(sub.endpoint);
    await admin.from('push_subscriptions').update(patch).eq('endpoint', sub.endpoint);
  }

  return json({ due: daily.length, woke: wakes.length, sent: results.filter(r => r.status < 300).length, results });
}

async function test(req: Request, body: Record<string, unknown>, cfg: Config): Promise<Response> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth, error } = await admin.auth.getUser(jwt);
  const user = auth && auth.user;
  if (error || !user) return json({ error: 'sign in first' }, 401);
  const { data: rows } = await admin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth, tz, nudge_time')
    .eq('user_id', user.id)
    .eq('endpoint', String(body.endpoint || ''));
  const sub = rows && rows[0];
  if (!sub) return json({ error: 'this phone is not set up for nudges' }, 404);
  const r = await sendWebPush(sub, await payloadFor(composeTest(sub), sub, cfg), vapid(cfg), { ttl: 600, urgency: 'high' });
  if (r.gone) {
    await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    return json({ error: 'this phone stopped accepting nudges' }, 410);
  }
  return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
}

async function act(body: Record<string, unknown>, cfg: Config): Promise<Response> {
  const claims = await readToken(body.token, cfg.open_loops_action_secret);
  if (!claims || Number(claims.e) < Date.now() / 1000) return json({ error: 'expired' }, 401);
  const action = String(body.action || '');
  if (action !== 'done' && action !== 'tomorrow') return json({ error: 'unknown action' }, 400);
  const { data, error } = await admin.rpc('push_apply_action', {
    p_user: claims.u, p_loop: claims.l, p_action: action, p_tz: claims.t,
  });
  if (error) throw error;
  return json({ ok: !!data });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: 'expected JSON' }, 400); }
  try {
    const cfg = await config();
    if (body.job === 'run') return await run(req, cfg);
    if (body.job === 'test') return await test(req, body, cfg);
    if (body.job === 'action') return await act(body, cfg);
    return json({ error: 'unknown job' }, 400);
  } catch (e) {
    console.error('push error', e);
    return json({ error: 'something went wrong' }, 500);
  }
});
