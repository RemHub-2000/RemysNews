# Remy's News

[Read the PWA](https://remhub-2000.github.io/RemysNews/). A static, installable news reader with category filters, expandable details, source links and a rolling seven-day archive.

## One daily publishing path

The existing scheduled research assistant writes the briefing once. It updates only `dist/editions.json` on `main`. GitHub Actions tests the update, deploys `dist/` and verifies that the exact committed archive is live. Only then does the task send the reading link.

`config/publishing.json` uses `mode: "github-only"` and contains one publishing destination. No build step, model call, paid API, content-writing token or additional research schedule is needed in the reader or deployment workflow. See [the runbook](docs/DAILY_PROCESS.md) and [editorial requirements](docs/EDITORIAL.md).

## Update and validate

```sh
node update-edition.mjs --recent
node update-edition.mjs /absolute/path/to/edition.json
node update-edition.mjs --validate
node --test
```

The updater replaces today's Sydney edition and retains today plus the previous six calendar dates, newest first. It rejects stale same-day writes and leaves the archive unchanged on invalid input. Identical retries are no-ops. `--recent` returns only dates, verification timestamps, story IDs, categories, titles and URLs for deduplication. `--archive /path/to/editions.json` supports a temporary working copy when using the GitHub connector instead of a clone.

The edition schema is `{date, label, note, checked, stories}`. Stories use `{id, category, title, summary, detail, source, url, published}` and optional `tag`. Detail may be empty. Verification timestamps include an explicit timezone offset and match the edition's Sydney date. Use plain text, HTTPS sources and the six established category labels.

## Operation and privacy

The existing morning schedule is unchanged. No afternoon update is enabled. The updater already supports a later same-day revision without introducing a duplicate date, but any new schedule requires Remy's approval.

The repository, published app and JSON are public. Never include credentials, customer information or internal Braze material. Seven-day retention applies to live JSON, not Git history, hosting backups or another device's offline cache.

For a local preview, run `python3 -m http.server 8000 --directory dist` and open http://localhost:8000/. Install through a supported browser or Add to Home Screen on iOS. Online reading prefers fresh data; offline reading uses the last successfully cached archive. Reload an already-open page after publication. Clearing browser data removes that device's offline copy.
