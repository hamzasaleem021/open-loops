// Web Push with no dependencies: only Web Crypto, so the same file runs in
// Supabase Edge Functions (Deno) and in Node for tests.
//   Payload encryption: RFC 8291 (Content-Encoding: aes128gcm)
//   Sender identity:    RFC 8292 (VAPID, ES256-signed JWT)

const enc = new TextEncoder();

export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str: string): Uint8Array {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8);
  return new Uint8Array(bits);
}

// Encrypts one message for one browser subscription (p256dh + auth from
// PushSubscription.toJSON().keys). Returns the full aes128gcm body.
export async function encryptPayload(
  p256dh: string,
  authSecret: string,
  plaintext: Uint8Array,
  opts: { salt?: Uint8Array; localKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublic = unb64u(p256dh);
  const auth = unb64u(authSecret);
  if (uaPublic.length !== 65 || auth.length < 16) throw new Error('bad subscription keys');

  const local = opts.localKeys ||
    (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record holds the whole message; 0x02 marks it as the last record.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// The Authorization header that proves who is sending (VAPID).
export async function vapidAuthorization(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKeyD: string,
  ttlSeconds = 12 * 3600,
): Promise<string> {
  const pub = unb64u(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKeyD, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    sub: subject,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${publicKey}`;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { subject: string; publicKey: string; privateKey: string };
export type PushResult = { ok: boolean; status: number; gone: boolean; detail: string };

export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  vapid: Vapid,
  opts: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string; fetchImpl?: typeof fetch } = {},
): Promise<PushResult> {
  const body = await encryptPayload(target.p256dh, target.auth, enc.encode(JSON.stringify(payload)));
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(opts.ttl ?? 6 * 3600),
    Urgency: opts.urgency || 'normal',
    Authorization: await vapidAuthorization(target.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey),
  };
  // A newer message with the same topic replaces one still waiting on an
  // offline phone, so it never wakes up to a pile of old nudges.
  if (opts.topic) headers.Topic = opts.topic;
  const res = await (opts.fetchImpl || fetch)(target.endpoint, { method: 'POST', headers, body });
  const detail = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 200);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, detail };
}
