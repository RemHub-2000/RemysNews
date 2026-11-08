# Remy's Morning Brief

[Read the PWA](https://remhub-2000.github.io/RemysNews/). Static, installable reader with category filters, expandable details, source links and a rolling seven-day archive. No build step, paid API or model call is needed by the browser or deployment workflow. The existing ChatGPT task still performs the research.

## Daily publishing

Research once, generate one edition, update `dist/editions.json`, commit that one file to `main`. GitHub Actions validates, deploys `dist/`, then fetches the public JSON and verifies it matches the exact committed archive. A green **Deploy Morning Brief to GitHub Pages** run for that commit includes this readback check, not just an accepted deployment.

`config/publishing.json` selects `dual` (GitHub plus the existing private ChatGPT Site) or `github-only`. GitHub is the canonical archive. In dual mode the task copies the same completed JSON to the Site, without researching or generating a second briefing. See [the publishing runbook](docs/DAILY_PROCESS.md) and [editorial requirements](docs/EDITORIAL.md).

```sh
node update-edition.mjs --recent
node update-edition.mjs /absolute/path/to/edition.json
node update-edition.mjs --validate
node --test
```

The updater replaces today's Sydney edition, keeps today and the previous six calendar dates, sorts newest first, rejects stale same-day writes and leaves the archive unchanged on invalid input. Identical retries are no-ops. `--recent` returns only titles, IDs, categories, URLs and verification timestamps for deduplication. `--archive /path/to/editions.json` selects a working copy when using GitHub's connector instead of a clone.

The edition schema remains `{date, label, note, checked, stories}`. Each story has `{id, category, title, summary, detail, source, url, published}` and an optional `tag`. `detail` may be empty. `checked` is the actual verification time with an explicit timezone offset, on the edition's Sydney calendar date. Use plain text and the six existing category labels in their established order. Never publish credentials, customer information or internal Braze material.

## Cutover and additional editions

After Remy approves cutover, change `mode` to `github-only`. The task reads this on every run and stops using Sites entirely. No reader, schema, research process or schedule needs replacing. The old private Site can remain as a fallback until Remy separately approves unpublishing it. Detailed proof and rollback checks are in the runbook.

Morning and afternoon updates can reuse the same task and updater. A later run replaces the day's edition and advances `checked`, rather than creating an eighth date or a second record for the day. No afternoon schedule is enabled by this setup.

## Local use, hosting and privacy

`python3 -m http.server 8000 --directory dist` serves the reader at http://localhost:8000/. Install from a supported browser or Add to Home Screen on iOS. The app prefers network data online and retains the last successfully cached archive offline. A page already open may need reloading after a publication. Clearing site data removes its offline copy.

This repository and GitHub Pages site are public, as approved by Remy during migration. The ChatGPT mirror remains owner-private. All files and news JSON sent to GitHub must therefore be suitable for public access. The seven-day limit applies to live JSON, not Git history, host backups or another device's offline cache. Do not rewrite history as part of a daily run.
