# Open Loops

**A calm place for unfinished things.**

Open Loops is a PWA for capturing the thoughts that occupy headspace — the half-decisions, the pending asks, the things you keep meaning to do. It gives each one a shape, surfaces only a few at a time, and gets out of the way.

![Open Loops](open-loops-icon-192.png)

---

## What it does

Most productivity tools want you to manage everything. Open Loops does one thing: it helps you stop holding things in your head.

You sign in, capture a thought, clarify it into one of five kinds, and keep only a few things in active focus. Supabase is the source of truth, so the same account shows the same loops across devices.

**Five kinds of loop:**

| Kind | What it means |
|------|--------------|
| **Do** | A concrete action you can start now |
| **Decide** | A decision that needs to be named and made |
| **Ask** | Something you need from a specific person |
| **Schedule** | Something that needs time on a calendar |
| **Let go** | Something you're choosing to release |

---

## Features

- **Capture** — Drop a thought as it arrives. Shape it later, or clarify it immediately.
- **Focus cap** — Only a handful of active loops are visible at once. Configurable (3, 5, or 7). The constraint is the feature.
- **Inline editing** — Click any loop title to edit it in place.
- **Primary actions** — Each loop kind has a contextual check-in: done, still in progress, or update the next step.
- **Waiting & Released** — Park things without losing them. Let go of things without deleting them.
- **Reorder active loops** — Drag on desktop, or use the up/down controls on mobile and keyboard. Order syncs across all your devices.
- **Sign-in required** — Sign in with a magic link before using the app. This keeps every device on the same source of truth.
- **Offline queue** — Signed-in edits made during brief connection drops are queued locally and sync automatically when you're back online.
- **Account-safe local storage** — Local cache and offline writes are tied to the signed-in account, so two accounts on the same browser do not inherit each other's loops.
- **Dark & light themes** — Toggle from the top bar. Preference persists across sessions.
- **PWA** — Installable on desktop and mobile. Works like a native app.

---

## Getting started

### Run locally

```bash
python -m http.server 8000
```

Then open: [http://localhost:8000/open-loops.html](http://localhost:8000/open-loops.html)

No build step. Sign-in requires Supabase configuration before the app can be used.

### Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Deploy from branch**.
3. Select your main branch, root folder.
4. Your app will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`.

---

## Sync setup

Open Loops uses Supabase for authentication and cross-device sync. Sign-in is required, and Supabase is the source of truth for loop data. You'll need your own Supabase project (the free tier is comfortable for dozens of users).

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project.

### 2. Run the SQL

In the Supabase SQL editor, paste and run the contents of `open-loops-supabase.sql`. This creates the `loops` table, row-level security policies, the `batch_upsert_loops` RPC, and registers the table for realtime subscriptions.

The SQL is idempotent — you can re-run it safely after pulling updates (it uses `if not exists` for columns and indexes, and `create or replace` for the trigger and RPC).

### 3. Configure the app

Edit `open-loops-config.js`:

```js
window.OL_CONFIG = Object.freeze({
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_KEY: 'YOUR_PUBLISHABLE_KEY',
  EMAIL_REDIRECT_TO: null, // auto-detects current URL — leave as null
  // ...
});
```

Leaving `EMAIL_REDIRECT_TO` as `null` is the right choice for most deployments. It auto-detects the current page URL, so magic links work correctly whether you're running locally or on your own GitHub Pages deployment.

### 4. Add redirect URLs in Supabase

In Supabase → **Authentication → URL Configuration**, add:

```
http://localhost:8000/open-loops.html
https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html
```

### 5. Sign in

Open the app, enter your email on the sign-in screen, and check your inbox for a magic link. No password needed.

---

## Upgrading an existing deployment

If you've already deployed Open Loops and are pulling updates, **run the SQL migration first, then deploy the new client**. Deploying the client before the migration will cause every write to fail until the schema catches up.

```
1. Supabase SQL editor → run open-loops-supabase.sql
2. Push open-loops.html + open-loops-sw.js to your host
```

The service worker detects updates automatically — existing users will see an "Updated — reloading…" toast on their next visit and land on the new version.

### GitHub upload checklist

For this sync-safety update, upload these changed files:

```
open-loops.html
open-loops-sw.js
README.md
```

No Supabase schema change is required for the account-safe local storage fix. If your deployed Supabase project has already run `open-loops-supabase.sql`, you do not need to run it again for this update. The service worker cache name was bumped so installed PWAs pick up the new client.

If users have old unscoped local data from a previous version, the app keeps it aside instead of silently importing it into whichever account signs in next. They may see a small sync note: "Older local data was found on this device and kept aside, so it was not mixed into this account."

---

## How sync works

Every edit is a single-row write to Supabase, protected by row-level security so users can only see and modify their own loops. The client keeps a signed-in local cache for speed and offline queueing, but Supabase is the shared source of truth. Postgres realtime broadcasts changes to every device logged into the same account.

Key pieces:

- **One row per loop.** Concurrent edits on different loops never collide. Concurrent edits on the same loop serialize at the database level.
- **Offline queue.** Signed-in edits made during connection drops are queued in `localStorage` and drained automatically when the device comes back online or the tab regains focus. Repeated edits to the same loop are coalesced so one typing burst doesn't become one hundred writes.
- **Per-account local cache.** Local cache, pending offline writes, onboarding state, reentry state, loop cap, and dead-lettered writes are scoped to the signed-in user. Signing out clears visible in-memory loops without deleting that user's saved local cache or pending writes.
- **Legacy safety quarantine.** Older local data created before account scoping is kept aside under legacy debug keys and is not uploaded automatically into the next account that signs in.
- **Position column for ordering.** Drag reorder and up/down move controls assign a fractional `position` value (midpoint between neighbors), so only the moved row needs a database update. Order syncs everywhere.
- **Realtime reconnection.** The realtime channel monitors its own connection state. On any drop (network blip, device sleep, token refresh, idle disconnect) the client re-subscribes and pulls to catch up on missed events.
- **Poison-pill handling.** If a single queued write fails repeatedly (bad data, permissions issue, etc.), after five attempts it's moved to a dead-letter queue so it can't block every edit behind it.
- **Echo suppression.** The client knows not to treat its own recent writes as incoming updates.
- **Timestamp-based last-writer-wins.** Incoming updates older than the local copy don't clobber newer state.

If something looks wrong, open the browser DevTools console and use:

```js
openLoopsDebug.queue()     // pending (not-yet-synced) operations
openLoopsDebug.dead()      // operations that failed more than 5 times
openLoopsDebug.legacy()    // old unscoped local data kept aside for safety
openLoopsDebug.clearDead() // clear the dead-letter queue
openLoopsDebug.retry()     // force a queue drain + full pull
```

---

## File structure

```
open-loops.html          ← The entire app (HTML + CSS + JS, single file)
open-loops-config.js     ← Supabase credentials and app config
open-loops-supabase.sql  ← Database schema, RLS policies, RPC, realtime setup
open-loops-sw.js         ← Service worker (offline cache, updates)
open-loops-manifest.json ← PWA manifest
open-loops-icon-192.png  ← App icon
open-loops-icon-512.png  ← App icon (large)
index.html               ← Marketing landing page
README.md                ← This file
```

---

## Design principles

- **One file.** The entire app is `open-loops.html`. No framework, no bundler, no node_modules.
- **Intentional constraints.** Five loops in active focus (by default). Five kinds. Four statuses. The limits are features.
- **No noise.** No notifications, no streaks, no gamification. Calm is the aesthetic and the function.
- **Sync-first, locally resilient.** Sign-in is required and Supabase is the source of truth. The local cache keeps the UI fast and protects pending edits during brief offline periods.

---

## Accessibility

Open Loops is designed for visual users. Screen-reader support is limited at present. Contributions that improve accessibility are welcome.

---

## License

MIT. Use it, fork it, make it yours.
