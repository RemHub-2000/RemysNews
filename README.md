# Remy's Morning Brief

This is the standalone PWA port of the existing Morning Brief reader. It keeps the category filters, expandable details, direct source links and rolling seven-day archive. There is no build step and no model call in the reader.

## Run and update

`python3 -m http.server 8000 --directory dist` serves the reader locally at http://localhost:8000/. Open it online once before using it offline. On a supported browser, install the app from the browser menu or use Add to Home Screen on iOS. The app prefers fresh editions online and can read the last successfully cached archive offline. Clearing site data removes that device's offline copy.

Run `node update-edition.mjs /path/to/edition.json` to replace an edition on the same Sydney date and keep that date and the previous six calendar dates. The existing ChatGPT schedule and Site are unchanged; this repository is not yet fed by that schedule.

## Hosting and privacy

`dist/` is the deployable directory. Use HTTPS in production. Paths and the service worker are scoped to the deployment directory, including a GitHub Pages project subpath.

The included archive is a snapshot from the private Site. Keep the repository private and do not publish this directory to public GitHub Pages without Remy's approval. GitHub Pages on a personal account is public even when its source repository is private. If the live briefing must remain private, use a host that enforces sign-in for both the HTML and the JSON. Offline access retains a local copy on the device.
