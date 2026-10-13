# Nirmaan – Road Inspector

Real-time road deformation detection as an installable PWA. Point a camera (or upload a photo), get an instant
safe/unsafe verdict from the on-device model, geo-tag it, and alert the right people.

Repo: `technovation` · Live URL: `https://<your-github-username>.github.io/technovation/`

## Deploy to GitHub Pages (one-time setup)

1. Create a repo named **`technovation`** and push the contents of this folder to the `main` branch.
2. In the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds `frontend/` and publishes it on every push to `main`.

> The site is served from `/technovation/`. That path is set in `frontend/vite.config.js` (`base`) and in
> `frontend/public/manifest.json` (`start_url`, `scope`, `id`). If you ever rename the repo, change all of them.

## PWA

- `frontend/public/manifest.json` – name, icons (incl. maskable), colours, scope
- `frontend/public/sw.js` – offline app shell (network-first pages, cache-first assets)
- `frontend/src/pwa.js` + `PwaInstallPrompt.jsx` – install popup (native prompt on Android/desktop Chrome/Edge,
  step-by-step guide on iOS Safari). It appears a few seconds after launch, snoozes for 7 days when dismissed, and can be
  reopened from the **Install app** button.

## Run locally

```bash
cd frontend
npm ci --legacy-peer-deps
npm run dev          # http://localhost:5173/technovation/
```

Optional email alerts / shared database need the Node backend:

```bash
cd backend
cp .env.example .env   # add Gmail address + app password
npm ci && npm start    # http://localhost:5000
```

GitHub Pages has no server, so in production detections are stored in the browser (`localStorage`) and email alerts
are disabled unless you host the backend elsewhere and build with `VITE_API_URL=https://your-backend`.

## Google sign-in

The Google OAuth client must list your Pages origin (`https://<your-github-username>.github.io`) under
**Authorized JavaScript origins** in Google Cloud Console, otherwise "Continue with Google" will fail.

## Notes

- Detection logic (model, classes, thresholds, auto-alert/save flow) and the BMC officer access codes are unchanged
  from the original app; only the interface was redesigned.
- Accounts are stored in the browser for demo/testing purposes and are not secure authentication.
