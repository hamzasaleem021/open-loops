// What a nudge says. At most one a day per phone, and only when something is
// actually waiting. Priority: loops waking up → Sunday recap → one loop that
// has gone stale (at most weekly). Never streaks, never guilt.

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
  voice: string;
  wakeups: boolean;
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
  loopId?: string;
  actions?: { action: string; title: string }[];
};

type Line = { id: string; title: string; body: string };

const LINES: Record<string, { plain: Line[]; cheeky: Line[] }> = {
  wakeOne: {
    plain: [{ id: 'w1p', title: 'Back in Up next', body: '“{t}” is back today.' }],
    cheeky: [
      { id: 'w1a', title: '“{t}” is back.', body: 'You asked it to come back today. Here it is.' },
      { id: 'w1b', title: 'Knock knock.', body: '“{t}” woke up. Where does it go now?' },
      { id: 'w1c', title: 'Rise and shine.', body: '“{t}” is back in Up next. Thirty seconds to sort it?' },
    ],
  },
  wakeMany: {
    plain: [{ id: 'wNp', title: 'Morning sweep', body: '{n} parked loops are back in Up next today.' }],
    cheeky: [
      { id: 'wNa', title: '{n} loops woke up.', body: 'Thirty seconds to sort them?' },
      { id: 'wNb', title: 'Rise and sort.', body: '{n} loops are back. Pick a Now, send the rest where they belong.' },
      { id: 'wNc', title: '{n} loops, one sweep.', body: 'They’re awake. You decide where they go.' },
    ],
  },
  stale: {
    plain: [{ id: 'sp', title: 'Still yours?', body: '“{t}” hasn’t moved in {d} days.' }],
    cheeky: [
      { id: 'sa', title: 'Rent-free for {d} days.', body: '“{t}” has been living in your head. Evict it?' },
      { id: 'sb', title: 'This one’s drying out.', body: '“{t}” hasn’t been touched in {d} days. Still yours?' },
      { id: 'sc', title: '{d} days, no visitors.', body: '“{t}” is gathering dust. Keep it, park it, or let it go?' },
    ],
  },
  recap: {
    plain: [{ id: 'rp', title: 'Weekly recap', body: '{summary}' }],
    cheeky: [
      { id: 'ra', title: '{n} thing{s} out of your head.', body: 'That’s this week. Come see your shelf.' },
      { id: 'rb', title: '{n} ring{s} on the shelf this week.', body: 'Not bad at all. Want a look?' },
    ],
  },
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
// choice by day so it doesn't settle into one favourite.
export function pickLine(lines: Line[], recent: string[], dayNumber: number): Line {
  const unseen = lines.filter(l => !recent.includes(l.id));
  const pool = unseen.length ? unseen : lines;
  return pool[Math.abs(dayNumber) % pool.length];
}

function voiceOf(sub: Sub): 'plain' | 'cheeky' {
  return sub.voice === 'plain' ? 'plain' : 'cheeky';
}

export function composeNudge(sub: Sub, loops: Loop[], now: Date): Nudge | null {
  const t = now.getTime();
  const voice = voiceOf(sub);
  const recent = sub.recent_lines || [];
  const dayNumber = Math.floor(t / DAY);
  const time = (v: string | null) => (v ? new Date(v).getTime() : NaN);

  if (sub.wakeups) {
    // Waking within the next half hour, or woke in the last 12 hours (the
    // app on another device may already have moved them to Up next).
    const waking = loops.filter(l =>
      (l.status === 'waiting' && time(l.wake_at) <= t + 30 * 60000) ||
      (l.status === 'active' && time(l.wake_at) <= t && time(l.wake_at) > t - 12 * 3600000));
    if (waking.length === 1) {
      const l = waking[0];
      const line = fill(pickLine(LINES.wakeOne[voice], recent, dayNumber), { t: short(l.raw_text) });
      return { kind: 'wake', lineId: line.id, title: line.title, body: line.body, query: 'sweep=1', loopId: l.id, actions: doneTomorrow() };
    }
    if (waking.length > 1) {
      const line = fill(pickLine(LINES.wakeMany[voice], recent, dayNumber), { n: waking.length });
      return { kind: 'wake', lineId: line.id, title: line.title, body: line.body, query: 'sweep=1' };
    }
  }

  if (sub.recap && sub.local_dow === 0) {
    const week = loops.filter(l => l.status === 'released' && time(l.completed_at) > t - 7 * DAY);
    if (week.length) {
      const letGo = week.filter(isLetGo).length;
      const done = week.length - letGo;
      const n = week.length;
      const summary = letGo && done
        ? `You closed ${done} and let go of ${letGo} this week.`
        : letGo ? `You let go of ${letGo} loop${letGo === 1 ? '' : 's'} this week.` : `You closed ${done} loop${done === 1 ? '' : 's'} this week.`;
      const line = fill(pickLine(LINES.recap[voice], recent, dayNumber), { n, s: n === 1 ? '' : 's', summary });
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
      const line = fill(pickLine(LINES.stale[voice], recent, dayNumber), { t: short(l.raw_text), d });
      return { kind: 'stale', lineId: line.id, title: line.title, body: line.body, query: `loop=${encodeURIComponent(l.id)}`, loopId: l.id, actions: doneTomorrow() };
    }
  }

  return null;
}

export function composeTest(sub: { voice: string; nudge_time?: string | null }): Nudge {
  const at = String(sub.nudge_time || '09:00').slice(0, 5);
  return sub.voice === 'plain'
    ? { kind: 'test', lineId: 'test', title: 'Nudges are on', body: `At most one a day, around ${at}.`, query: 'sweep=1' }
    : { kind: 'test', lineId: 'test', title: 'Hello from your loops.', body: `This is what a nudge looks like. One a day at most, around ${at}.`, query: 'sweep=1' };
}

function doneTomorrow() {
  return [{ action: 'done', title: 'Done' }, { action: 'tomorrow', title: 'Tomorrow' }];
}

function isLetGo(l: Loop): boolean {
  const outcome = l.details && typeof l.details === 'object' ? (l.details as Record<string, unknown>).outcome : undefined;
  if (outcome === 'let_go' || outcome === 'done') return outcome === 'let_go';
  return l.kind === 'let_go';
}
