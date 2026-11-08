# Daily publishing runbook

## Source of truth and boundaries

Read `config/publishing.json` and `docs/EDITORIAL.md` from the current `main` branch of `RemHub-2000/RemysNews` at the start of every run. Accept only `dual` or `github-only`; stop on an unknown mode rather than choosing destinations. Keep the existing task and its timing. Do not create a second research schedule, a GitHub research cron or another Site.

GitHub's `dist/editions.json` is the canonical archive. Routine runs change only that file in GitHub. Publishing controls, scripts, design and workflow files change only when Remy requests a process or application change. There is no API key in this repository and no model call in GitHub Actions. Use the configured GitHub connection for writes, not credentials copied into source or prompts. Stop for permission or connection blockers; do not bypass protected branches.

## A. Research and prepare once

1. Determine today's date and current time in `Australia/Sydney`, including daylight saving. Retrieve the current GitHub branch head, archive file content and its blob SHA. When using a clone, fast-forward before preparing changes and preserve any unrelated work. When local files have been removed, retrieve current repository files through the GitHub connector instead of depending on yesterday's checkout.
2. Run `node update-edition.mjs --recent` on that working archive. Pass only this compact index and essential short context to the research stage, not all historical briefing prose. Use the actual previous `checked` time to recognise material updates. Follow `docs/EDITORIAL.md` for research, freshness, availability, source attribution and word limits.
3. Write one edition JSON to a temporary path outside the repo. Preserve the existing schema. Set `date` to today's Sydney date and `checked` to the actual verification time, not a deployment or retry time. Do not copy previous news and present it as fresh. For same-day refreshes, keep a coherent day's briefing, deduplicate by underlying event and add or revise only material developments. No artificial AM/PM date keys.
4. Run `node update-edition.mjs /absolute/path/to/edition.json`, or use `--archive /absolute/path/to/working-archive.json`. This keeps today plus six previous calendar dates, at most one edition per date, newest first. It prevents an older run from replacing a newer same-day payload. Run `--validate` and `node --test`. Retain this exact completed archive for both publishers.

## B. Publish and verify GitHub

1. Commit only `dist/editions.json` to the configured `main` branch, with a message such as `Update briefing for YYYY-MM-DD`. Prefer the GitHub `update_file` operation using the file's freshly read blob SHA; it creates the one-file commit and is suitable for a task with no persisted Git clone. Alternatively use ordinary non-forced Git push with the normal configured credentials.
2. If a SHA/branch conflict occurs, reread the current archive, reapply the same researched edition with the updater, and retry only if it does not overwrite a newer edition. Never regenerate the news just to retry publishing. Never force-push. If the exact JSON is already committed, reuse that commit and its verification result rather than making a duplicate commit.
3. Find the run of `.github/workflows/pages.yml` with the exact `head_sha` just committed, on `main`. Use the GitHub Actions runs GET endpoint and inspect that run's latest attempt. Do not use an unrelated green run, a PR-only workflow wrapper or a combined commit status as proof of Pages publication.
4. Wait for that run to complete successfully. It runs tests and archive validation, deploys, then calls `scripts/verify-published.mjs` against the deployment URL. The script fetches a cache-busted public `editions.json` and compares the entire JSON structure to the committed archive, including `checked`, stories and all retained dates. A same-date old edition must fail. It retries propagation delays for a bounded period. Workflow logs and the run summary show the verified date and timestamp.
5. If the workflow fails, inspect the failed step. Retain the expected payload and commit. Retry only transient deployment/propagation failures through the existing run; malformed data needs a corrected one-file commit. Do not report publication success merely because the commit exists or deploy-pages returned a URL. Allow a bounded wait of up to ten minutes, with brief status updates in interactive work; if still pending, report pending honestly rather than claiming it is live.

The workflow intentionally has no scheduled research job and no content-writing token. Pushes through the connected GitHub App/user credentials trigger it. A future process writing with a workflow's own `GITHUB_TOKEN` would need an explicit deployment trigger, since those pushes do not normally trigger another push workflow.

## C. Optional ChatGPT Site mirror

Execute this entire section only when `mode` is `dual`. In `github-only` mode do not call Sites, retrieve Site credentials, open its repository or package/deploy it. A Site outage must not block preparation of the GitHub edition.

1. Read the Sites building/hosting instructions and get the existing Site identified by `chatgptSite.projectId`. Preserve its exact identity, owner-private audience, design, filters, expandable details and source links. Open its current registered source with the supported Sites workflow and read its README. This runbook supersedes older Site-only delivery instructions.
2. Copy the exact completed canonical `dist/editions.json` from stage A/B into the Site source. Do not run separate research or rebuild earlier editions. Compare canonical JSON structures to confirm parity before publishing. If the Site already has that exact archive and a verified successful deployment of it, reuse it without another deployment.
3. Use supported Sites source preparation, push the exact source, package the static output, save/deploy privately and verify terminal success. Retain a returned saved-version/deployment ID when retrying instead of creating repeated versions. Never create a replacement Site or broaden its audience.

The publishers are independent destinations, not an atomic cross-host transaction. If one fails, keep the successful destination and repair the failed destination from the same canonical payload. Do not roll back a successful host just to make them equally stale. When GitHub publication is blocked but the researched payload is ready, the mirror may still be updated safely; clearly report which destination succeeded.

## D. Notification and failures

On complete success, send exactly two short elements, using the actual Sydney edition date and the GitHub link as the primary reading destination:

Daily briefing is now available for [D Month YYYY].

[Open your briefing](https://remhub-2000.github.io/RemysNews/)

In `dual` mode complete success means both destinations are verified, or one was already verified with the identical archive. In `github-only` mode GitHub verification is sufficient. Do not repeat stories or send a separate success notification per host. Do not disable the recurring task after success.

For a partial success, name the successful destination and link it, then state that the other may show an earlier edition. For a failure or unverified deployment, send a short truthful notice, never the success template. Keep the task enabled for transient failures. Do not delete any host, archive, backups or Git history during recovery.

## Cutover checklist

Run dual publishing until Remy is satisfied. Suggested evidence: three consecutive scheduled successes with identical date/checked/content on both hosts; correct seven-day pruning at a date boundary; a repeated update creating no duplicate; and a same-day newer revision replacing rather than appending. Confirm the PWA loads the latest edition after reload and still opens the last cached content offline. These are acceptance checks, not a claim that all future runs have already passed.

After Remy's explicit approval:

1. Change only `config/publishing.json` from `dual` to `github-only` and commit it. The existing task dynamically reads the mode, so no new task or instruction rewrite is required.
2. Verify the next scheduled GitHub publication without invoking Sites. The primary notification link already points to GitHub, so it does not need changing.
3. Keep the private Site as a temporary fallback if desired. Unpublish/delete it only after separate explicit approval, never as an automatic side effect of changing mode.
4. Once the fallback is no longer wanted, its config entry and this optional adapter section can be removed. Core editorial rules, updater, schema, reader and GitHub workflow are unchanged.

Rollback: set the mode back to `dual` while the private Site still exists, then mirror the current GitHub archive through the supported Sites workflow. Do not use a stale Site archive to overwrite newer GitHub data.

## Optional afternoon refresh

No afternoon run is enabled yet. If requested, add the agreed Sydney afternoon time to the same task's schedule rather than duplicating the research workflow. Reuse the current day's compact index, check only for new/material developments and replace the same date with a later `checked` timestamp. Previous days remain unchanged; a late morning retry is rejected if an afternoon payload is already newer. The current schema intentionally retains only the latest revision per calendar date, not separate morning and afternoon archives.
