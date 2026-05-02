# Open Loops

**A calm place for unfinished things.**

Open Loops is a small PWA for getting unfinished thoughts out of your head, shaping them, and keeping only a few active commitments in view. It is intentionally simple: capture a loop, define what kind of attention it needs, park it if it is not for now, and close it when it is done or released.

![Open Loops](open-loops-icon-192-v2.png)

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

- **Inbox capture** - Capture once from the bottom Capture button. New loops land in Inbox.
- **Define and route** - Pick a kind, add an optional detail or next step, then send the loop to Active, Parked, or Closed.
- **Active focus cap** - Show 3, 5, or 7 active loops before "Show more". Configure this in Settings.
- **Archive/Closed** - Closed loops live behind the small archive button in the header instead of taking a main tab.
- **Created and closed dates** - Loop cards show when they were captured. Closed loops also show when they were closed.
- **Inline editing** - Click a loop title to edit it in place.
- **Primary actions** - Each kind has a contextual check-in for completion, progress, or updating the next step.
- **Reorder active loops** - Drag on desktop, or use the up/down controls. Order syncs across devices.
- **Magic-link sign-in** - Sign in with email; no password required.
- **Offline queue** - Signed-in edits made during brief connection drops are queued locally and retried.
- **Realtime sync** - Changes on one device update the other signed-in devices.
- **Dark and light themes** - Toggle from the header. Preference persists.
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
- `batch_upsert_loops`
- Realtime publication setup

The SQL is written to be safe to re-run.

### 3. Configure The App

Edit `open-loops-config.js`:

```js
window.OL_CONFIG = Object.freeze({
  APP_NAME: 'Open Loops',
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_KEY: 'YOUR_PUBLISHABLE_KEY',
  EMAIL_REDIRECT_TO: null,
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

When deploying this version, upload the full app folder or at least:

```text
open-loops.html
open-loops-config.js
open-loops-manifest.json
open-loops-sw.js
open-loops-icon-192-v2.png
open-loops-icon-512-v2.png
open-loops-supabase.sql
README.md
```

Keep the older icon files too if existing installed PWAs may still request them:

```text
open-loops-icon-192.png
open-loops-icon-512.png
```

The service worker cache is currently:

```js
open-loops-v10-icons
```

The icon filenames are versioned (`-v2`) so browsers and installed PWAs have a clean cache break. If an installed PWA still shows an old icon after deployment, uninstall and reinstall the PWA.

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

---

## File Structure

```text
open-loops.html              Main app: HTML, CSS, and JS
open-loops-config.js         Supabase credentials and app config
open-loops-supabase.sql      Database schema, RLS policies, RPC, realtime setup
open-loops-sw.js             Service worker and offline cache
open-loops-manifest.json     PWA manifest
open-loops-icon-192-v2.png   Current PWA icon
open-loops-icon-512-v2.png   Current large PWA icon
open-loops-icon-192.png      Legacy icon kept for cache compatibility
open-loops-icon-512.png      Legacy large icon kept for cache compatibility
index.html                   Landing page
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

## License

MIT. Use it, fork it, make it yours.
