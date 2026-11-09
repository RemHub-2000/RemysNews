# Daily publishing runbook

## Scope and source of truth

Read `config/publishing.json`, `docs/EDITORIAL.md` and this runbook from the same current `main` commit of `RemHub-2000/RemysNews` at the start of every run. Publishing is GitHub-only. Stop if the configuration is invalid or names a different mode. A routine run must not change tasks, timings or deployment workflows.

`dist/editions.json` is the canonical archive and the only file changed by a routine news run. Code, design, configuration and workflow changes need a separate request. Use the connected GitHub account's normal repository access. Never store credentials in source or prompts, bypass protected branches, broaden permissions or force-push.

## 1. Research and prepare once

1. Determine today's calendar date and actual current time in `Australia/Sydney`, including daylight saving. Retrieve the branch head, current archive and its content blob SHA. Fast-forward a clone before editing, preserving unrelated work. If local files are missing, retrieve the required files through the GitHub connector rather than relying on yesterday's checkout.
2. Run `node update-edition.mjs --recent` on the current archive. Use only that compact index and essential short context for deduplication, not every historical briefing's full prose. Consult the previous `checked` time for material updates. Follow `docs/EDITORIAL.md` for sources, freshness, category order, availability, length and attribution.
3. Write one researched edition to a temporary path outside the repository. Preserve the schema. Set `date` to today's Sydney date and `checked` to the actual verification time, not a deployment or retry time. Do not regenerate earlier days or present old stories as new.
4. Run `node update-edition.mjs /absolute/path/to/edition.json`, adding `--archive /absolute/path/to/working-archive.json` when required. It writes one slot for the current date, keeps only today and the preceding six calendar days, sorts newest first and rejects stale writes. Run `--validate` and `node --test`. Retain the resulting exact payload for publication and retries.

## 2. Commit one JSON file

1. Commit only `dist/editions.json` to the configured `main` branch, for example `Update briefing for YYYY-MM-DD`. Prefer GitHub's connected `update_file` operation with the freshly read blob SHA. Ordinary non-forced Git push through configured credentials is also supported.
2. On a SHA conflict, reread the current archive and reapply the same researched edition using the updater. Retry only if it will not replace a newer verification timestamp. If the morning baseline for an afternoon payload changed, stop instead of changing its baseline or checked time to force a write. Preserve unrelated edits.
3. If the exact JSON is already committed, reuse its commit and verified publication rather than creating another commit. A failed publication does not justify changing `checked`, repeating research or duplicating an edition.

## 3. Deploy and verify

The existing `.github/workflows/pages.yml` runs tests and archive validation, deploys the static output, then executes `scripts/verify-published.mjs`. It has no model call or research job.

Find the workflow run for the exact committed `head_sha` on `main`, using the Actions runs GET endpoint. Inspect that run's latest attempt. Do not use an unrelated green run, a PR-only wrapper or combined commit status as proof of Pages publication.

Wait for terminal success, including the final exact-live-archive check. That check fetches a cache-busted public `editions.json` and compares the complete JSON structure with the committed payload, including the verification timestamp, stories and retained dates. A same-date but older payload must fail. The workflow summary records the verified date, timestamp and link.

Allow a bounded wait of up to ten minutes, with brief progress updates for interactive work. If still pending, report pending honestly. Inspect the failed step on failure. Retry transient deployment or propagation failures using the existing run and payload; invalid data requires a corrected one-file commit. A commit or deployment URL alone is not publication success.

Pushes using the connected GitHub App/user access trigger the workflow. If a future implementation writes with a workflow's own `GITHUB_TOKEN`, it must explicitly trigger deployment because such pushes do not normally start a second push workflow.

## 4. Notify

Only after verified morning publication, send exactly these two short elements, using the actual Sydney edition date:

Daily briefing is now available for [D Month YYYY].

[Open your briefing](https://remhub-2000.github.io/RemysNews/)

For a verified afternoon publication, use `Afternoon briefing is now available for [D Month YYYY].` with the same link. Do not send a publication notification when there was nothing worth publishing.

Do not repeat stories, generate inline visuals or send duplicate notifications. Keep the recurring task enabled after success. If publication fails or remains unverified, send a brief truthful notice that the app may still show an earlier edition. Keep the task enabled for transient failures and retain the exact payload and commit for recovery.

## Recovery and operational checks

Keep the latest successful deployment available while correcting a failed update. Do not delete archived data, rewrite Git history, regenerate historical briefings or roll back successful content just to retry a failed check. Stop for permission or connection blockers and report the required action.

The live archive holds at most seven unique Sydney dates, newest first. Verify date-boundary pruning, identical retries and stale-write rejection through `node --test`. The reader continues to serve stored JSON without making model calls. An already-open or offline PWA may show cached content until it reconnects and reloads.

## Morning and afternoon slots

- Leave the existing morning task in place until the two-slot reader is deployed and verified. At cutover, use the existing task if it can reliably distinguish both scheduled slots, or use explicit slot-specific schedules with this shared runbook. Target 8 am and 5 pm in `Australia/Sydney`, including daylight saving. Do not infer a retry's slot from its wall-clock time.
- Morning writes the existing `{date, label, note, checked, stories}` payload. `period: "morning"` is optional for compatibility. Give new stories a stable `storyKey` that identifies the underlying event independently of headline, source or edition. Preserve the existing story fields and IDs.
- Afternoon requires a verified morning baseline for the same date. If it is missing, skip the afternoon write and report the missing baseline rather than replacing or inventing a morning briefing. Check what materially changed after the morning verification. Use `--recent` for both slots and prior days, with only essential extra context to assess updates.
- Afternoon input uses `{date, label, note, checked, stories, period: "afternoon", morningChecked}`, with `morningChecked` copied from that day's morning record. The updater saves the new slot under `afternoon` without modifying the morning. Each afternoon card needs its own `id` and a stable `storyKey`.
- A material follow-up uses `updatesStoryId` pointing to the morning card and reuses that card's `storyKey`, or its `id` for legacy cards without a key. Lead with the verified change. Reuse the original link only if it actually substantiates the change. The updater catches repeated keys, headlines and canonical source URLs; editorial review still has to catch the same event with different wording or sources.
- Publish no quiet-category placeholders. If no noteworthy afternoon stories remain, do not write the archive, trigger a deployment or send an availability notification. The reader shows no Afternoon tab unless a non-empty slot exists.
- Keep one record per date, not AM/PM date keys. Retries preserve the original slot, checked time and research payload. Once an afternoon slot exists, the morning baseline is locked; an identical morning retry remains a no-op.
