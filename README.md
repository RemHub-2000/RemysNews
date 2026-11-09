# Remy's News

[Read the PWA](https://remhub-2000.github.io/RemysNews/). A static, installable news reader with Morning and Afternoon tabs on days with two editions, category filters, expandable details, source links and a rolling seven-day archive.

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

The updater writes one slot on today's Sydney date and retains today plus the previous six calendar dates, newest first. It rejects stale same-slot writes and leaves the archive unchanged on invalid input. Identical retries are no-ops. `--recent` returns a compact story index for both slots without summaries or details. `--archive /path/to/editions.json` supports a temporary working copy when using the GitHub connector instead of a clone.

The date record retains its existing morning fields `{date, label, note, checked, stories}` and may add `afternoon: {note, checked, morningChecked, stories}`. An afternoon input is a normal edition with `period: "afternoon"` and `morningChecked` copied from the morning edition. Older dates require no migration. See the [runbook](docs/DAILY_PROCESS.md) for afternoon story keys and cutover.

## Operation and privacy

The reader and updater support two slots; scheduler cutover is separate. Keep the existing morning schedule until this version is deployed and checked. The intended cutover is 8 am and 5 pm Sydney time.

The repository, published app and JSON are public. Never include credentials, customer information or internal Braze material. Seven-day retention applies to live JSON, not Git history, hosting backups or another device's offline cache.

For a local preview, run `python3 -m http.server 8000 --directory dist` and open http://localhost:8000/. Install through a supported browser or Add to Home Screen on iOS. Online reading prefers fresh data; offline reading uses the last successfully cached archive. Reload an already-open page after publication. Clearing browser data removes that device's offline copy.
