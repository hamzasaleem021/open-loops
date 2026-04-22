# Open Loops Setup

## Run locally

Serve this folder over HTTP so the PWA and magic-link redirects can work:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/open-loops.html
```

## Supabase

1. Create a Supabase project.
2. On the project-creation screen:
   - keep `Enable Data API` checked
   - leave `Enable automatic RLS` checked
   - for `Automatically expose new tables and functions`, prefer turning it off
     because `open-loops-supabase.sql` now adds the needed grants explicitly
3. In the SQL editor, run `open-loops-supabase.sql`.
4. In `Authentication -> URL Configuration`, add:
   - `http://localhost:8000/open-loops.html`
   - your future deployed app URL when you have one, for example `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`
5. `open-loops-config.js` is already populated with your project URL and publishable key.
   `EMAIL_REDIRECT_TO` is intentionally `null`, so the app uses the current page URL on localhost or GitHub Pages automatically.

## GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub, go to `Settings -> Pages`.
3. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: your main branch
   - `Folder`: `/ (root)`
4. Your app URL will look like one of these:
   - project site: `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`
   - user site: `https://YOUR_USERNAME.github.io/open-loops.html`
5. Add that exact `open-loops.html` URL to Supabase Auth redirect URLs.
6. Add the base GitHub Pages URL as a valid Site URL too.

## Notes

- Sync is local-first. The app works without Supabase, then upgrades to cross-device sync when configured.
- The current sync model stores the full loop state as one JSON document per user.
- PWA install and service worker features do not work from `file://` URLs.
