# Open Loops — Setup

## Run locally

```bash
python -m http.server 8000
```

Open: `http://localhost:8000/open-loops.html`

## Supabase sync (optional)

1. Create a Supabase project.
2. In the SQL editor, run `open-loops-supabase.sql`.
3. In **Authentication → URL Configuration**, add:
   - `http://localhost:8000/open-loops.html`
   - Your deployed URL (e.g. `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`)
4. Edit `open-loops-config.js` with your project URL and publishable key.

## GitHub Pages

1. Push this folder to a GitHub repository.
2. **Settings → Pages → Deploy from branch** → select your main branch, root folder.
3. Your app URL: `https://YOUR_USERNAME.github.io/REPO_NAME/open-loops.html`
4. Add that URL to Supabase Auth redirect URLs.

## Notes

- App works fully offline without Supabase — local-first by default.
- Supabase adds cross-device sync on top when configured.
- PWA install and service worker require HTTPS or localhost (not `file://`).
