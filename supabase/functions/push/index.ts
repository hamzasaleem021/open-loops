// Open Loops push sender (Supabase Edge Function, deployed with verify_jwt
// off because it checks every request itself).
//
//   { job: 'run' }               from the scheduler (pg_cron), with the
//                                x-cron-secret header. Sends today's nudge to
//                                every phone that is due.
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
import { composeNudge, composeTest, type Loop, type Nudge } from './compose.ts';

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
    tag: 'open-loops-nudge',
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
  endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; voice: string;
  wakeups: boolean; stale: boolean; recap: boolean; last_stale_at: string | null;
  recent_lines: string[] | null; local_date: string; local_dow: number;
};

async function run(req: Request, cfg: Config): Promise<Response> {
  if (!sameText(req.headers.get('x-cron-secret') || '', cfg.open_loops_cron_secret)) return json({ error: 'forbidden' }, 403);
  const { data, error } = await admin.rpc('push_due_subscriptions');
  if (error) throw error;
  const due = (data || []) as DueSub[];
  const byUser = new Map<string, DueSub[]>();
  for (const s of due) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);

  const results: { kind: string; status: number }[] = [];
  for (const [userId, subs] of byUser) {
    const { data: rows, error: loopsError } = await admin
      .from('loops')
      .select('id, raw_text, kind, status, prompt_answer, updated_at, completed_at, wake_at, details')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (loopsError) throw loopsError;
    const loops = (rows || []) as Loop[];
    for (const sub of subs) {
      const patch: Record<string, unknown> = { last_run_on: sub.local_date };
      const nudge = composeNudge(sub, loops, new Date());
      if (nudge) {
        const r = await sendWebPush(sub, await payloadFor(nudge, sub, cfg), vapid(cfg), { topic: 'nudge' });
        results.push({ kind: nudge.kind, status: r.status });
        if (r.gone) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          continue;
        }
        if (r.ok) {
          patch.recent_lines = [nudge.lineId, ...(sub.recent_lines || []).filter(id => id !== nudge.lineId)].slice(0, 12);
          if (nudge.kind === 'stale') patch.last_stale_at = new Date().toISOString();
        } else {
          console.warn('push failed', r.status, r.detail);
        }
      }
      await admin.from('push_subscriptions').update(patch).eq('endpoint', sub.endpoint);
    }
  }
  return json({ due: due.length, sent: results.filter(r => r.status < 300).length, results });
}

async function test(req: Request, body: Record<string, unknown>, cfg: Config): Promise<Response> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth, error } = await admin.auth.getUser(jwt);
  const user = auth && auth.user;
  if (error || !user) return json({ error: 'sign in first' }, 401);
  const { data: rows } = await admin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth, tz, voice, nudge_time')
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
