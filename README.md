# Open Loops

**A calm place for unfinished things.**

Open Loops is a PWA for capturing the thoughts that occupy headspace — the half-decisions, the pending asks, the things you keep meaning to do. It gives each one a shape, surfaces only a few at a time, and gets out of the way.

![Open Loops](open-loops-icon-192.png)

---

## What it does

Most productivity tools want you to manage everything. Open Loops does one thing: it helps you stop holding things in your head.

You capture a thought. You clarify it into one of five kinds. You keep only five things in active focus. That's it.

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
- **5-loop focus cap** — Only 5 active loops visible at once. The constraint is the feature.
- **Inline editing** — Click any loop title to edit it in place.
- **Primary actions** — Each loop kind has a contextual check-in: done, still in progress, or update the next step.
- **Waiting & Released** — Park things without losing them. Let go of things without deleting them.
- **Cross-device sync** — Sign in with a magic link. Your loops sync across all your devices.
- **Dark & light themes** — Toggle from the top bar. Preference persists across sessions.
- **PWA** — Installable on desktop and mobile. Works like a native app.

---

## Getting started

### Run locally

```bash
python -m http.server 8000
```

Then open: [http://localhost:8000/open-loops.html](http://localhost:8000/open-loops.html)

No build step. No dependencies. One HTML file.

### Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Deploy from branch**.
3. Select your main branch, root folder.
4. Your app will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`.

---

## Sync setup

Open Loops uses Supabase for authentication and cross-device sync. You'll need your own Supabase project (the free tier is more than enough).

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project.

### 2. Run the SQL

In the Supabase SQL editor, paste and run the contents of `open-loops-supabase.sql`. This creates the `loops` table, row-level security policies, and realtime subscriptions.

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

## File structure

```
open-loops.html          ← The entire app (HTML + CSS + JS, single file)
open-loops-config.js     ← Supabase credentials and app config
open-loops-supabase.sql  ← Database schema + RLS policies
open-loops-sw.js         ← Service worker (offline cache, updates)
open-loops-manifest.json ← PWA manifest
open-loops-icon-192.png  ← App icon
open-loops-icon-512.png  ← App icon (large)
index.html               ← Marketing landing page
```

---

## Design principles

- **One file.** The entire app is `open-loops.html`. No framework, no bundler, no node_modules.
- **Intentional constraints.** Five loops in active focus. Five kinds. Three statuses. The limits are features.
- **No noise.** No notifications, no streaks, no gamification. Calm is the aesthetic and the function.

---

## Accessibility

Open Loops is designed for visual users. Screen-reader support is limited at present. Contributions that improve accessibility are welcome.

---

## License

MIT. Use it, fork it, make it yours.
