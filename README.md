# Open Loops

**A calm place for unfinished things.**

Open Loops is a small PWA for getting unfinished thoughts out of your head, shaping them, and keeping only a few active commitments in view. It is intentionally simple: capture a loop, define what kind of attention it needs, park it if it is not for now, and close it when it is done or released.

![Open Loops](open-loops-icon-192-v4.png)

---

## What It Does

Open Loops is built around one personal workflow:

1. Capture a loop into **Inbox**.
2. Define and route it into **Active**, **Parked**, or **Closed**.
3. Keep Active small with a configurable focus cap.
4. Sync the same account across devices with Supabase.

**Five loop kinds:**

| Kind | Meaning |
| --- | --- |
| **Do** | A concrete action you can start now |
| **Decide** | A decision that needs to be named and made |
| **Ask** | Something you need from a specific person |
| **Schedule** | Something that needs time on a calendar |
| **Let go** | Something you are choosing to release |

---

## Features

- **Inbox capture** - Capture from the bottom Capture button. Only the text is required; kind is optional. Press Enter to add and write the next one.
- **Define and route** - Three short steps: pick a kind, answer that kind's next-step question (or skip), then choose Up next, Park, or Close. Schedule asks **When is it?** with a day and a time (read from your note when it says one, or Not sure yet). Let go skips straight to Close.
- **Active focus cap** - Show 3, 5, or 7 active loops before "Show more". Configure this in Settings. The Active view shows how many focus slots are in use.
- **Now card** - The top Active loop is shown as a large card in its kind's color, with the rest listed under "Up next".
- **Up next, not Now** - Loops entering Active (defined, reopened, or brought back from Parked) land in Up next. Only you promote a loop to Now, by reordering.
- **Motion and sound** - Every move shows where the loop went. Closing seals the loop into a ring that lands in the Closed archive in the header, and the focus meter fills or empties a slot with the move. On phones that support it, a light tap goes with each sound. Sounds (and taps) can be turned off in Settings.
- **Closed shelf** - The Closed view shows one ring per loop closed this week (a pebble for each loop you let go of); the archive button shows the weekly count.
- **Why Open Loops** - Tap the logo (or Settings → Why Open Loops) for a five-scene animated story: why unfinished things nag, the research behind next steps, how the app works, and who it's for. The landing page plays the same story. Music follows the Sounds setting; the voice-over is opt-in (Voice button in the sheet). On the landing page both start muted behind a Sound button.
- **Quiet feedback** - Moves that animate don't also show a toast. Screen readers still hear each change. Toasts remain for Undo, errors and sync.
- **Archive/Closed** - Closed loops live behind the small archive button in the header instead of taking a main tab.
- **Created and closed dates** - Loop cards show when they were captured. Closed loops also show when they were closed.
- **Inline editing** - Click a loop title to edit it in place.
- **Buttons that do what they say** - Each kind's main button does its job instead of only asking "did you?":
  - **Do → Done**: "All done, close it", or "Did the step, set the next one". A Do holds your next step, and finishing the step isn't always finishing the loop.
  - **Decide → I decided**: name the decision in a line (options like "Air 15 or X1" become one-tap choices), then optionally turn it into the next Do, which lands in Up next.
  - **Ask → Reach out**: the ask is drafted from your note and sent through your phone's share sheet (or copied). Sending doesn't close it; it parks until it's time to check back, then asks "Did Bilal reply?" with Got it / Nudge / Wait longer.
  - **Schedule → Add to calendar**: uses the time you gave it in Define (or reads one from your note, "Saturday 10am"), then opens a ready-made Google Calendar event or downloads an `.ics` file for Apple, Outlook and others. No sign-in. The loop remembers it was sent: its card asks **On your calendar?**, and when you come back to the app it asks right away. Yes closes it, because the calendar holds it now. **It's already on my calendar** closes it without sending anything.
  - **Let go → Let go**: its own ending. Finished loops sit on the Closed shelf as rings; loops you let go of sit there as pebbles.
- **Done, close it** - Any Active or Parked loop can be closed from its ⋯ menu, whatever its kind.
- **Not yet asks "when?"** - Every "not yet" and every Park asks when the loop should come back: tonight, tomorrow morning, this weekend, next week, a day you pick, or no date.
- **Wake-ups** - A parked loop with a wake time comes back to Up next on its own (never straight to Now) when the app opens, returns to the foreground, or is already open. Parked shows the soonest wake time first.
- **Reasons on cards** - A small label says why a card is where it is: "Woke today", "Waiting on Bilal · back Thu 9:00 AM", "Checking back", "From your decision".
- **The sweep** - The daily ritual. When loops wake up or dry out, a banner on Active offers a sweep: one card at a time, Make it Now / Up next / Park again / Let go, in about thirty seconds. Each choice plays the next note up; the last one resolves. "Later" hides the banner for the day unless something new comes up. Nothing else on the list moves.
- **Drying out** - Cards dry out when nobody touches them. A loop untouched for 10 days goes matte; after 21 days it cracks and asks **Still yours?** (Yes, keep it / Park it until… / Let it go). Keeping it makes it fresh again. Parked loops with a wake time are asleep on purpose and never dry.
- **Music that builds** - Each loop you close in one sitting adds a note on top of the landing chord. Clearing Active after two or more closes plays the whole chord and shows the mascot closed into a ring.
- **The mascot** - The open C from the logo, with a face. It is the logo in the header (it blinks, closes into a ring when you close a loop, goes calm when you let one go, and looks up when you capture), the home-screen icon, the picture on notifications, and the face on every empty screen (calm on a clear Active, asleep in an empty Parked, winking at Inbox zero, curious before your first close). It's still asleep when a nudge opens the sweep, and wakes up as you arrive.
- **Schedule loops: one question, when is it?** - A day and a time, both required, never pre-filled with a guess (a time in the note, like "Saturday 10am", is read in). The nudge comes at exactly that time, never before: the loop waits in Parked until then, and comes back to Up next with the nudge, however close the time is. "Not yet" means it moved, so it opens the same picker, never quick presets. Once its time has passed, the card asks **Did it happen?**. A calendar is optional: *Put it on my calendar too*.
- **Opens honestly** - The app never shows an empty list it hasn't confirmed. Your saved loops appear instantly, a logo covers only the moment before it knows who you are, loop bars show while a new phone loads, and offline with nothing saved it says it can't reach your loops. A fresh open always starts on Active. See [docs/loop-behavior.md](docs/loop-behavior.md).
- **A date in a new loop becomes an offer** - Type "call the bank friday" and Capture offers "Wake it Fri 9:00 AM?". Accept it and the loop goes to Parked until then instead of Inbox. Nothing changes unless you tap it. (A Schedule loop doesn't get the offer: its time is when it happens, which Define asks for.)
- **Your head** - Your profile, opened from the one account button in the header (your initial, with the sync status as a small dot: green synced, amber syncing, red stuck), the Closed shelf, or Settings. At the top: your email, sync status (Retry when it's stuck) and Sign out. Below it, a look back built from loops you've already closed: your shelf of rings and pebbles, the longest-held loop you finally closed, how long each kind typically takes, and the decisions you made.
- **Share card** - "Share your October" draws a 1080×1350 card of your month: counts and colours only, never what your loops say. Share it through the phone's share sheet or save the image.
- **Tell a friend** - Asked once, at a high point: after ten closes, clearing Active shows "Know someone with a crowded head?" with **Send them Open Loops** and **Not now**. Either answer retires it for good. Settings → Tell a friend shares the link any time, and Settings mentions Morning Brief, the other Auxila app. The share card carries `openloops.auxila.cc` small in a corner.
- **Nudges** - Optional web push, in one cheeky voice with copy that doesn't repeat and never streaks:
  - **When a loop wakes up**, right on time (within a minute): "Knock knock. “Call the bank” just woke up." with **Done** and **Tomorrow** buttons, or "Did Bilal reply?" for an Ask you're waiting on. Loops that wake together share one nudge.
  - **When a Schedule loop's time comes**, at exactly the time you picked: "“Dentist” is now.", on its own, with **Done**. If the phone was offline it can still arrive up to 15 minutes late; after that the card asks "Did it happen?" instead.
  - **A check-in** at a time you pick (any minute of the day, kept exactly), only when there's something to say: the Sunday recap or a weekly "Still yours?". At most one a day; a time that has already passed today starts tomorrow, and Settings says when the next one comes.
  - If the app is open on screen, the nudge shows inside the app instead of buzzing the phone (on iPhone and Safari it also shows briefly, because those browsers drop nudges that never show). Settings → Nudges has Send a test. On iPhone, nudges need Open Loops on the Home Screen.
  - **One switch.** Settings → Nudges → On this device. Every way it can fail says what happened and what to do, right under the switch: offline, still loading, the prompt dismissed, the server unreachable, a browser with push turned off (Brave says which setting). If the browser has blocked notifications, the page can't ask again, so the switch shows how to allow them in this browser (iPhone, Android app, Android Chrome, Chrome/Edge, Firefox, Safari) with Check again, and nudges turn on by themselves the moment notifications are allowed.
  - **Self-healing.** If the server drops this device (its push address expired), Send a test renews it and tries again, and an open app checks about once a day that the server still has it. Turning off while offline finishes on the server later. A notification permission taken away in the browser switches nudges off and says so once.
- **Reorder active loops** - Drag on desktop, or use the up/down controls. Order syncs across devices.
- **Magic-link sign-in** - Sign in with email; no password required.
- **Offline queue** - Signed-in edits made during brief connection drops are queued locally and retried.
- **Realtime sync** - Changes on one device update the other signed-in devices.
- **Light and night themes** - Clay cream by day, teal-black by night. Toggle from the header. Preference persists; first run follows the system setting.
- **Installable PWA** - Works as an installed desktop/mobile app.

---

## Run Locally

Serve the folder over HTTP:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/open-loops.html
```

Do not use `file://` for real sign-in testing. Supabase magic-link redirects need an HTTP/HTTPS URL.

---

## Deploy To GitHub Pages

1. Push this folder to GitHub.
2. Go to **Settings -> Pages**.
3. Choose **Deploy from branch**.
4. Select your main branch and root folder.
5. Open:

```text
https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html
```

For this repo, the deployed app path is expected to look like:

```text
https://hamzasaleem021.github.io/open-loops/open-loops.html
```

---

## Supabase Setup

Open Loops uses Supabase for authentication, data storage, and realtime updates.

### 1. Create A Supabase Project

Create a project at [supabase.com](https://supabase.com).

### 2. Run The SQL

In the Supabase SQL editor, run:

```text
open-loops-supabase.sql
```

This creates:

- `public.loops`
- Row-level security policies
- `completed_at`, `deleted_at`, `position`, and timestamp fields
- `wake_at` (when a parked loop comes back) and `details` (how a loop is moving or how it ended)
- `batch_upsert_loops`
- Realtime publication setup
- `public.push_subscriptions` (one row per phone that allowed nudges) and the helpers the push sender uses: `push_due_wakeups`, `push_due_subscriptions`, `push_apply_action`, `push_config` (service role only)
- The nudge schedule (`pg_cron` + `pg_net`, both on the free plan)

The SQL is written to be safe to re-run.

### 2b. Nudges (optional)

Nudges need the `push` Edge Function in `supabase/functions/push` and five values in Supabase Vault. Everything stays on the free plan: the schedule runs every minute inside Postgres (a tiny query) and only calls the function when a loop just woke or a phone's check-in time came, so it is a handful of calls per phone per day against the 500,000 a month the free plan allows.

1. Make a key pair for signing nudges: `npx web-push generate-vapid-keys`. Put the public key in `open-loops-config.js` as `VAPID_PUBLIC_KEY`.
2. Store the secrets in Vault (SQL editor), with your own values:

```sql
select vault.create_secret('https://YOUR_PROJECT.supabase.co/functions/v1/push', 'open_loops_push_url');
select vault.create_secret('<public key>',  'open_loops_vapid_public');
select vault.create_secret('<private key>', 'open_loops_vapid_private');
select vault.create_secret('<random string>', 'open_loops_cron_secret');
select vault.create_secret('<another random string>', 'open_loops_action_secret');
```

3. Deploy the function with JWT checks off (it checks every request itself: the scheduler's secret, a signed token for Done / Tomorrow, or the signed-in user for Send a test): `supabase functions deploy push --no-verify-jwt`.

Leave `VAPID_PUBLIC_KEY: null` to hide nudges entirely.

### 3. Configure The App

Edit `open-loops-config.js`:

```js
window.OL_CONFIG = Object.freeze({
  APP_NAME: 'Open Loops',
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_KEY: 'YOUR_PUBLISHABLE_KEY',
  EMAIL_REDIRECT_TO: null,
  VAPID_PUBLIC_KEY: null,   // see "2b. Nudges" above
  STORAGE_KEY: 'open_loops_data'
});
```

`EMAIL_REDIRECT_TO: null` auto-detects the current HTTP/HTTPS page URL. If you need to force a specific redirect, set it explicitly.

### 4. Add Redirect URLs

In Supabase, go to **Authentication -> URL Configuration** and add:

```text
http://localhost:8000/open-loops.html
https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html
```

---

## Upgrade / Upload Checklist

**Run `open-loops-supabase.sql` in the Supabase SQL editor first.** Version 28 has one idempotent update that sets open Schedule loops still ahead to nudge at their time (older versions saved no wake time, and version 27 set it 30 minutes early); deploy order for 28 is `supabase/functions/push`, then the SQL, then the app. Version 17 added two columns (`wake_at`, `details`); version 19 added `push_subscriptions` and the nudge schedule; version 20 adds wake-up nudges (`push_due_wakeups`, `wake_checked_at`), check-ins at any time of day (`quiet_on`, `last_run_at`), and runs the schedule every minute. Then redeploy `supabase/functions/push`. The statements are idempotent, so running the whole file again is safe. If the app is deployed before the SQL runs, it keeps syncing everything else; wake times stay on the device until the columns exist, and nudges can't be turned on until the table exists.

When deploying this version, upload the full app folder or at least:

```text
open-loops.html
open-loops-config.js
open-loops-manifest.json
open-loops-sw.js
open-loops-icon-192-v4.png
open-loops-icon-512-v4.png
open-loops-nudge-192.png
open-loops-badge-96.png
open-loops-supabase.sql
supabase/functions/push/
docs/loop-behavior.md
index.html
README.md
```

Keep the older icon files too if existing installed PWAs may still request them:

```text
open-loops-icon-192.png
open-loops-icon-512.png
open-loops-icon-192-v2.png
open-loops-icon-512-v2.png
open-loops-icon-192-v3.png
open-loops-icon-512-v3.png
```

The service worker cache is currently:

```js
open-loops-v28-on-time
```

**On every release, bump both** `CACHE` in `open-loops-sw.js` and `APP_VERSION` in `open-loops.html` (number and date). The new cache name is what tells installed apps there's a new version; `APP_VERSION` is what Settings → App version shows, so you can see which version a phone is running.

How installed apps pick up a release:

- The app checks for a new version whenever it's opened or brought back from the background, and once a minute while it stays open.
- The new version installs in the background, takes over, and the page reloads itself. It waits until no sheet is open and nothing is being typed, so a half-written loop is never lost.
- The page and config are always re-checked with the server, so GitHub Pages' 10-minute browser cache can't keep showing the old page after a release.
- Settings → App version shows the version number and has a **Check for update** button.

The icon filenames are versioned (`-v4`, the mascot) so browsers and installed PWAs have a clean cache break. Android refreshes an installed app's icon on its own within a day or so; if it still shows the old one, uninstall and reinstall the PWA (your loops stay in Supabase).

---

## How Sync Works

Every loop is one row in Supabase. The client keeps a signed-in local cache for speed and queues writes when the network is unreliable.

Key pieces:

- **One row per loop** - Different loops can sync independently.
- **Local queue** - Creates, updates, deletes, and restores are queued in `localStorage`.
- **Backoff retries** - Failed writes retry with backoff instead of hammering Supabase.
- **Dead queue** - A repeatedly failing write is moved aside so it does not block later edits.
- **Current sync vs history** - Historical dead-queue items do not permanently force the main UI into an error state.
- **Pending local protection** - A server pull does not erase local changes that are still queued.
- **Realtime health tracking** - The app tracks whether the realtime channel is connected, connecting, or stale.
- **Auth lock safety** - Supabase auth callbacks stay synchronous and defer heavier async work.
- **Account-safe local storage** - Local data, queue, onboarding, focus cap, and diagnostics are scoped to the signed-in user.
- **Completed dates** - Closing a loop writes `completed_at`; reopening clears it.
- **Wake times** - Parking writes `wake_at`. Whichever signed-in device is open when it passes moves the loop back to Up next; doing it twice is harmless.
- **Newer columns, older database** - If `wake_at`/`details` don't exist yet, writes retry without them instead of filling the dead queue, and pulls keep this device's copy of those two fields.

If something looks wrong, open DevTools and use:

```js
openLoopsDebug.queue()     // pending writes
openLoopsDebug.dead()      // writes that failed repeatedly
openLoopsDebug.legacy()    // old unscoped local data kept aside
openLoopsDebug.clearDead() // clear old failed-write diagnostics
openLoopsDebug.retry()     // force queue drain and pull
```

---

## Smoke Test Before Release

After deploying, test on the real URL:

1. Open the app on desktop and phone with the same account.
2. Capture a loop on phone.
3. Confirm it appears on desktop without clicking tabs.
4. Define and route it on desktop.
5. Confirm phone updates.
6. Close it.
7. Open Archive/Closed and confirm the Closed date appears.
8. Reopen it and confirm the Closed date disappears.
9. Confirm no stale "Still saving" banner remains when sync is healthy.
10. Park a loop with "Pick a day and time" set a minute or two ahead. Confirm it comes back to Up next (not Now) on both devices.
11. Ask: Reach out → Send… → In 3 days. Confirm it shows "Waiting on …" in Parked, and `wake_at` / `details.sentAt` are set in Supabase.
12. Schedule: Define asks "When is it?" with empty Day and Time (no default). Pick a time 3 minutes ahead: the note under it says it nudges right then, Park is suggested, and the loop lands in Parked with "Nudge today …". Lock the phone: "“…” is now." arrives within a minute of that time, and the loop is in Up next. Not yet on a Schedule loop shows only a day-and-time picker. From the card, Put it on my calendar too → Google Calendar opens with that day and time; the .ics file opens in Apple Calendar; back in the app it asks "On your calendar?" and Yes closes it.
13. Let go of a loop and confirm a pebble (not a ring) appears on the Closed shelf.
14. On the installed phone app, open Settings → App version and confirm it shows the version you just released (tap Check for update if not).
15. Park two loops for a minute ahead, wait, and open Active: the sweep banner appears. Sweep them; each card's choice lands where it says.
16. Capture "call the bank friday", accept "Wake it Fri 9:00 AM?" and confirm it lands in Parked with that wake time.
17. Tap your initial in the header: Your head opens with your email, a green Synced dot and Sign out at the top. Tap Share your month and save the image. It shows counts and colours only.
18. Settings → Nudges → flip **On this device**, allow the prompt, then Send a test. The test notification arrives on the phone within seconds.
18a. On a second browser, flip the switch and choose **Block** in the prompt: the switch stays off and shows the unblock steps for that browser. Allow notifications in its site settings and come back: nudges turn on by themselves.
19. Park a loop with "Pick a day and time" two minutes ahead and lock the phone. A wake-up nudge arrives within a minute of that time; Done closes the loop without opening the app.
20. Set the check-in time to a minute that has already passed: Settings says the next check-in is tomorrow, and nothing arrives today.
21. Opening: close the installed app completely and reopen it on a slow connection. Your loops appear at once, never "Your head is clear" first, and it opens on Active even if you last left it on Parked. On a browser where you've never signed in, signing in shows loop bars until your loops arrive.

---

## File Structure

```text
open-loops.html              Main app: HTML, CSS, and JS
open-loops-config.js         Supabase credentials and app config
open-loops-supabase.sql      Database schema, RLS policies, RPC, realtime, nudge table and schedule
open-loops-sw.js             Service worker: offline cache, updates, nudges (push + buttons)
open-loops-manifest.json     PWA manifest
open-loops-icon-192-v4.png   Current PWA icon (the mascot)
open-loops-icon-512-v4.png   Current large PWA icon (the mascot)
open-loops-nudge-192.png     The mascot (winking) shown on notifications
open-loops-badge-96.png      Small one-colour icon Android shows in the status bar for nudges
supabase/functions/push/     The nudge sender (Edge Function): what to say, when, and Web Push
docs/loop-behavior.md        How loops behave: lifecycle, kinds, times, nudges, opening the app
open-loops-icon-192-v3.png   Previous icon (Clay C) kept for cache compatibility
open-loops-icon-512-v3.png   Previous large icon kept for cache compatibility
open-loops-icon-192-v2.png   Older icon kept for cache compatibility
open-loops-icon-512-v2.png   Previous large icon kept for cache compatibility
open-loops-icon-192.png      Legacy icon kept for cache compatibility
open-loops-icon-512.png      Legacy large icon kept for cache compatibility
index.html                   Landing page
why-voice-1.mp3 … -5.mp3     Voice-over for the Why story (Kokoro "Heart" voice, ~190KB total)
README.md                    This file
```

---

## Design Principles

- **Local save is sacred.** The UI updates immediately and the cloud catches up.
- **Sync should be quiet when healthy.** Errors should be visible only when they matter now.
- **Closed is archive, not a main lane.** Active, Parked, and Inbox are the daily surfaces.
- **Constraints are features.** The focus cap is there to reduce noise.
- **No build step.** The app stays inspectable and deployable as static files.

---

## Visual Design: Clay

The app and landing page use a Clay-inspired system.

- **Canvas:** cream `#fffaf0` by day, teal-black `#0a1a1a` at night. Primary buttons are near-black by day and cream at night.
- **Type:** Inter throughout. Display headings use weight 500 with tight negative tracking.
- **Kinds map to the six card colors:** Do = teal, Decide = ochre, Ask = pink, Schedule = lavender, Let go = peach, Inbox = cream.
- **One loud thing per screen:** only the top Active loop gets a saturated card. Everything else uses quiet cream cards with a colored kind pill, because Open Loops is meant to lower pressure.
- **Clay illustrations:** the soft 3D shapes are plain SVG with a lighting filter. The mascot (`mascotSvg()`, moods sleepy · awake · curious · cheeky · proud · calm) draws the header logo, empty screens and sheets; `mascotSvg(mood, { mark: true })` is the square crop used at logo size. The PNG icons are renders of the same SVG.
- **Radii:** 12px buttons and inputs, 16px cards, 24px focus cards and sheets, pills for chips and tabs.
- **Motion:** `Motion` and `Sound` modules in `open-loops.html`. `renderMain()` snapshots card positions before each render and plays the change after, so every action animates without touching its handler. Flights and sounds run only for this device's own taps, never for realtime updates from another device. "Reduce motion" turns flights into fades.
- **Sound:** synthesized with Web Audio (no audio files). One soft pluck, notes from D major pentatonic. An open loop is an unresolved interval; closing resolves it.
- Tokens live at the top of the `<style>` block in `open-loops.html`. Component treatments sit in the `CLAY COMPONENT LAYER` at the end of it.

---

## License

MIT. Use it, fork it, make it yours.
