// What a nudge says. One voice: cheeky. Never streaks, never guilt.
//
// Two kinds of nudge:
//   • Wake-ups: the moment a parked loop's time comes. Loops that wake
//     together share one nudge.
//   • The daily check-in, at the time the phone picked, and only when there
//     is something to say: the Sunday recap, or one loop that has gone stale
//     (at most weekly).

export type Loop = {
  id: string;
  raw_text: string;
  kind: string | null;
  status: string;
  prompt_answer?: string | null;
  updated_at: string;
  completed_at: string | null;
  wake_at: string | null;
  details?: Record<string, unknown> | null;
};

export type Sub = {
  stale: boolean;
  recap: boolean;
  last_stale_at: string | null;
  recent_lines: string[] | null;
  local_dow: number; // 0 = Sunday, in the phone's time zone
};

export type Nudge = {
  kind: 'wake' | 'stale' | 'recap' | 'test';
  lineId: string;
  title: string;
  body: string;
  query: string; // where tapping it lands: sweep=1 · profile=1 · loop=<id>
  tag?: string;  // a fresh tag makes the phone ring again instead of quietly replacing
  loopId?: string;
  actions?: { action: string; title: string }[];
};

type Line = { id: string; title: string; body: string };

const LINES: Record<string, Line[]> = {
  wakeOne: [
    { id: 'w1a', title: '“{t}” is back.', body: 'You parked it until now. It’s in Up next.' },
    { id: 'w1b', title: 'Knock knock.', body: '“{t}” just woke up. Where does it go now?' },
    { id: 'w1c', title: 'Right on time.', body: '“{t}” is back in Up next. Thirty seconds to sort it?' },
  ],
  wakeAsk: [
    { id: 'wqa', title: 'Did {whoS} reply?', body: 'Time to check back on “{t}”.' },
    { id: 'wqb', title: 'Any word from {whoO}?', body: 'You said you’d check back on “{t}” about now.' },
  ],
  wakeMany: [
    { id: 'wNa', title: '{n} loops just woke up.', body: 'They’re in Up next. Thirty seconds to sort them?' },
    { id: 'wNb', title: 'Rise and sort.', body: '{n} loops are back. Pick a Now, send the rest where they belong.' },
    { id: 'wNc', title: '{n} loops, one sweep.', body: 'They’re awake. You decide where they go.' },
  ],
  stale: [
    { id: 'sa', title: 'Rent-free for {d} days.', body: '“{t}” has been living in your head. Evict it?' },
    { id: 'sb', title: 'This one’s drying out.', body: '“{t}” hasn’t been touched in {d} days. Still yours?' },
    { id: 'sc', title: '{d} days, no visitors.', body: '“{t}” is gathering dust. Keep it, park it, or let it go?' },
  ],
  recap: [
    { id: 'ra', title: '{n} thing{s} out of your head.', body: 'That’s this week. Come see your shelf.' },
    { id: 'rb', title: '{n} ring{s} on the shelf this week.', body: 'Not bad at all. Want a look?' },
  ],
};

const DAY = 86400000;
const STALE_DAYS = 21;

export function short(text: string, max = 48): string {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function fill(line: Line, vars: Record<string, string | number>): Line {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
  return { id: line.id, title: f(line.title), body: f(line.body) };
}

// Fresh copy every time: skip lines this phone saw recently, and vary the
// choice so it doesn't settle into one favourite.
export function pickLine(lines: Line[], recent: string[], seed: number): Line {
  const unseen = lines.filter(l => !recent.includes(l.id));
  const pool = unseen.length ? unseen : lines;
  return pool[Math.abs(seed) % pool.length];
}

// "Bilal: can he start before the 15th?" → "Bilal" (same rule as the app).
export function askWho(note: string | null | undefined): string {
  const s = String(note || '').trim();
  const m = /^([^:\n]{1,40}?)\s*(?::|\s[—–-]\s)\s*([\s\S]+)$/.exec(s);
  return m && m[2].trim() && m[1].trim().split(/\s+/).length <= 4 ? m[1].trim() : '';
}

// Loops that woke since this phone's last check (already picked by the
// caller), oldest wake first.
export function composeWake(sub: { recent_lines: string[] | null }, woke: Loop[], now: Date): Nudge | null {
  if (!woke.length) return null;
  const recent = sub.recent_lines || [];
  const seed = Math.floor(now.getTime() / 60000);
  if (woke.length === 1) {
    const l = woke[0];
    const d = l.details && typeof l.details === 'object' ? l.details : {};
    const t = short(l.raw_text);
    const waitingOnSomeone = l.kind === 'ask' && !!d.sentAt;
    const who = waitingOnSomeone ? askWho(l.prompt_answer) : '';
    const line = waitingOnSomeone
      ? fill(pickLine(LINES.wakeAsk, recent, seed), { t, whoS: who || 'they', whoO: who || 'them' })
      : fill(pickLine(LINES.wakeOne, recent, seed), { t });
    return {
      kind: 'wake', lineId: line.id, title: line.title, body: line.body, query: 'sweep=1',
      tag: `open-loops-wake-${l.id}`, loopId: l.id, actions: doneTomorrow(),
    };
  }
  const line = fill(pickLine(LINES.wakeMany, recent, seed), { n: woke.length });
  return { kind: 'wake', lineId: line.id, title: line.title, body: line.body, query: 'sweep=1', tag: 'open-loops-wake' };
}

// The daily check-in: Sunday recap first, then a weekly "Still yours?".
export function composeNudge(sub: Sub, loops: Loop[], now: Date): Nudge | null {
  const t = now.getTime();
  const recent = sub.recent_lines || [];
  const dayNumber = Math.floor(t / DAY);
  const time = (v: string | null) => (v ? new Date(v).getTime() : NaN);

  if (sub.recap && sub.local_dow === 0) {
    const week = loops.filter(l => l.status === 'released' && time(l.completed_at) > t - 7 * DAY);
    if (week.length) {
      const n = week.length;
      const line = fill(pickLine(LINES.recap, recent, dayNumber), { n, s: n === 1 ? '' : 's' });
      return { kind: 'recap', lineId: line.id, title: line.title, body: line.body, query: 'profile=1' };
    }
  }

  if (sub.stale && !(time(sub.last_stale_at) > t - 6.5 * DAY)) {
    const stale = loops
      .filter(l => (l.status === 'active' || (l.status === 'waiting' && !l.wake_at)) && time(l.updated_at) <= t - STALE_DAYS * DAY)
      .sort((a, b) => time(a.updated_at) - time(b.updated_at));
    if (stale.length) {
      const l = stale[0];
      const d = Math.floor((t - time(l.updated_at)) / DAY);
      const line = fill(pickLine(LINES.stale, recent, dayNumber), { t: short(l.raw_text), d });
      return { kind: 'stale', lineId: line.id, title: line.title, body: line.body, query: `loop=${encodeURIComponent(l.id)}`, loopId: l.id, actions: doneTomorrow() };
    }
  }

  return null;
}

export function composeTest(sub: { nudge_time?: string | null }): Nudge {
  const at = String(sub.nudge_time || '09:00').slice(0, 5);
  return {
    kind: 'test', lineId: 'test', title: 'Hello from your loops.',
    body: `This is what a nudge looks like. Wake-ups come right on time; check-ins around ${at}.`,
    query: 'sweep=1', tag: 'open-loops-test',
  };
}

function doneTomorrow() {
  return [{ action: 'done', title: 'Done' }, { action: 'tomorrow', title: 'Tomorrow' }];
}
