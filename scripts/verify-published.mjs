import {readFileSync, appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {latestChecked, validateArchive} from '../update-edition.mjs';

export function validatePublishingConfig(config) {
  const keys = ['archivePath', 'github', 'mode', 'schemaVersion', 'timezone'];
  if (!config || JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(keys)) throw Error('Expected one publishing destination and the standard configuration fields');
  if (config.schemaVersion !== 1 || config.mode !== 'github-only' || config.timezone !== 'Australia/Sydney' || config.archivePath !== 'dist/editions.json') throw Error('Invalid publishing configuration');
  const github = config.github;
  if (!github || typeof github.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(github.repository) || github.branch !== 'main' || github.workflowPath !== '.github/workflows/pages.yml') throw Error('Invalid repository publishing target');
  const url = new URL(github.url);
  if (url.protocol !== 'https:' || url.username || url.password || !url.pathname.endsWith('/')) throw Error('Expected an HTTPS app directory URL');
  return config;
}

export async function verifyPublished(expected, baseURL, {fetcher = fetch, attempts = 18, interval = 10000, pause = delay} = {}) {
  validateArchive(expected);
  const base = new URL(baseURL);
  if (base.protocol !== 'https:' || base.username || base.password) throw Error('Expected an HTTPS site URL');
  const endpoint = new URL('editions.json', base);
  let error;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('verify', `${latestChecked(expected.editions[0])}-${attempt}-${Date.now()}`);
      const response = await fetcher(url, {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const actual = await response.json();
      validateArchive(actual);
      if (!isDeepStrictEqual(actual, expected)) throw Error('Live JSON does not match the exact expected archive');
      return {verified: true, date: actual.editions[0].date, checked: latestChecked(actual.editions[0]), url: base.href};
    } catch (failure) {
      error = failure;
      if (attempt < attempts) await pause(interval);
    }
  }
  throw Error(`Publication verification failed after ${attempts} attempts: ${error?.message}`);
}

async function main() {
  const config = validatePublishingConfig(JSON.parse(readFileSync(new URL('../config/publishing.json', import.meta.url), 'utf8')));
  const expected = JSON.parse(readFileSync(new URL('../' + config.archivePath, import.meta.url), 'utf8'));
  const result = await verifyPublished(expected, process.argv[2] || config.github.url);
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Verified live archive for ${result.date}, checked ${result.checked}.\n\n[Open briefing](${result.url})\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
