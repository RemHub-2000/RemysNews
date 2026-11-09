import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {categories, sydneyDate, cutoffDate, validateEdition, validateArchive, mergeEdition, recentIndex} from '../update-edition.mjs';
import {verifyPublished, validatePublishingConfig} from '../scripts/verify-published.mjs';

test('publishing configuration permits only the single GitHub destination', () => {
  const config = JSON.parse(readFileSync(new URL('../config/publishing.json', import.meta.url), 'utf8'));
  assert.equal(validatePublishingConfig(config).mode, 'github-only');
  assert.throws(() => validatePublishingConfig({...config, mode: 'unsupported'}));
  assert.throws(() => validatePublishingConfig({...config, extraPublisher: {}}));
  assert.throws(() => validatePublishingConfig({...config, archivePath: '../unexpected.json'}));
  assert.throws(() => validatePublishingConfig({...config, github: {...config.github, url: 'http://example.com/'}}));
});

const now = new Date('2026-11-08T06:00:00Z');
const story = category => ({id: category, category, title: 'A verified story', summary: 'Key points.', detail: '', source: 'Official source', url: 'https://example.com/story', published: '8 Nov'});
const edition = (date = '2026-11-08', time = '08:20:00') => ({date, label: date, note: '', checked: `${date}T${time}+11:00`, stories: categories.map(story)});
const live = () => ({editions: [edition(sydneyDate())]});
const response = data => ({ok: true, json: async () => structuredClone(data)});
const morningEdition = () => ({...edition(), stories: [{...story('Apple'), id: 'am-apple', storyKey: 'apple-release', url: 'https://example.com/apple'}]});
const afternoonEdition = morning => ({...edition(morning.date, '16:30:00'), period: 'afternoon', morningChecked: morning.checked, stories: [{...story('Technology'), id: 'pm-tech', storyKey: 'browser-release', title: 'A new browser release', url: 'https://example.com/browser'}]});

test('afternoon adds a slot without changing the morning or earlier days', () => {
  const morning = morningEdition();
  const yesterday = edition('2026-11-07');
  const pm = afternoonEdition(morning);
  const before = {editions: [morning, yesterday]};
  const after = mergeEdition(before, pm, {now});
  const {afternoon, ...preserved} = after.editions[0];
  assert.deepEqual(preserved, morning);
  assert.equal(afternoon.checked, pm.checked);
  assert.deepEqual(after.editions[1], yesterday);
  assert.equal(before.editions[0].afternoon, undefined);
  assert.deepEqual(mergeEdition(after, pm, {now}), after);
  assert.deepEqual(mergeEdition(after, morning, {now}), after);
  const index = recentIndex(after, {today: morning.date});
  assert.deepEqual(index[0].afternoon.stories[0], {id: 'pm-tech', category: 'Technology', title: 'A new browser release', url: 'https://example.com/browser', storyKey: 'browser-release'});
});

test('afternoon rejects repeats by story key, headline or canonical source', () => {
  const morning = morningEdition();
  const before = {editions: [morning]};
  for (const change of [
    {storyKey: 'apple-release'},
    {title: 'A verified story!'},
    {url: 'https://www.example.com/apple/?utm_source=feed#intro'}
  ]) {
    const pm = afternoonEdition(morning);
    Object.assign(pm.stories[0], change);
    assert.throws(() => mergeEdition(before, pm, {now}), /repeats a morning story/);
  }
  const pm = afternoonEdition(morning);
  pm.stories.push({...pm.stories[0], id: 'pm-tech-2'});
  assert.throws(() => mergeEdition(before, pm, {now}), /Duplicate afternoon story/);
});

test('a material afternoon update links to its morning story and cannot repeat the summary', () => {
  const morning = morningEdition();
  const pm = afternoonEdition(morning);
  pm.stories = [{...morning.stories[0], id: 'pm-apple', summary: 'Australian release dates are now confirmed.', updatesStoryId: 'am-apple'}];
  const before = {editions: [morning]};
  const after = mergeEdition(before, pm, {now});
  assert.equal(after.editions[0].afternoon.stories[0].updatesStoryId, 'am-apple');
  assert.equal(recentIndex(after, {today: morning.date})[0].afternoon.stories[0].updatesStoryId, 'am-apple');
  pm.stories[0].summary = morning.stories[0].summary;
  assert.throws(() => mergeEdition(before, pm, {now}), /new information/);
  pm.stories[0].updatesStoryId = 'missing';
  assert.throws(() => mergeEdition(before, pm, {now}), /Invalid or duplicate morning story update/);
});

test('empty, stale or unanchored afternoon updates cannot change the archive', () => {
  const morning = morningEdition();
  const before = {editions: [morning]};
  const pm = afternoonEdition(morning);
  const after = mergeEdition(before, pm, {now});
  assert.throws(() => mergeEdition(before, {...pm, stories: []}, {now}), /at least one story/);
  assert.throws(() => mergeEdition({editions: []}, pm, {now}), /baseline/);
  assert.throws(() => mergeEdition(before, {...pm, morningChecked: 'outdated'}, {now}), /baseline/);
  assert.throws(() => mergeEdition(before, {...pm, checked: morning.checked}, {now}), /must follow/);
  assert.throws(() => mergeEdition(after, {...pm, checked: `${morning.date}T16:00:00+11:00`}, {now}), /newer/);
  assert.throws(() => mergeEdition(after, {...morning, checked: `${morning.date}T09:00:00+11:00`}, {now}), /locked/);
});

test('Sydney dates follow local midnight and daylight saving, not UTC', () => {
  assert.equal(sydneyDate(new Date('2026-11-07T13:01:00Z')), '2026-11-08');
  assert.equal(sydneyDate(new Date('2026-06-01T13:30:00Z')), '2026-06-01');
  assert.equal(sydneyDate(new Date('2026-06-01T14:01:00Z')), '2026-06-02');
  assert.equal(cutoffDate('2026-10-07'), '2026-10-01');
});

test('replace one date, retain six preceding days and preserve untouched editions', () => {
  const dates = Array.from({length: 8}, (_, i) => `2026-11-${String(8 - i).padStart(2, '0')}`);
  const before = {editions: dates.map(date => edition(date))};
  const snapshot = structuredClone(before);
  const afternoon = edition('2026-11-08', '15:00:00');
  afternoon.stories[0].summary = 'A material afternoon update.';
  const after = mergeEdition(before, afternoon, {now});
  assert.deepEqual(after.editions.map(e => e.date), dates.slice(0, 7));
  assert.deepEqual(after.editions.slice(1), before.editions.slice(1, 7));
  assert.deepEqual(before, snapshot);
  assert.equal(after.editions[0].checked, afternoon.checked);
  assert.deepEqual(mergeEdition(after, afternoon, {now}), after);
});

test('duplicate archive dates retain the latest verified edition', () => {
  const older = edition('2026-11-07', '08:00:00');
  const newer = edition('2026-11-07', '15:00:00');
  const after = mergeEdition({editions: [older, newer]}, edition(), {now});
  assert.equal(after.editions.length, 2);
  assert.deepEqual(after.editions[1], newer);
});

test('stale, future, backdated and conflicting same-time writes fail', () => {
  assert.throws(() => mergeEdition({editions: [edition('2026-11-08', '15:00:00')]}, edition(), {now}), /newer/);
  assert.throws(() => mergeEdition({editions: []}, edition('2026-11-07'), {now}), /today/);
  assert.throws(() => mergeEdition({editions: []}, edition('2026-11-08', '23:00:00'), {now}), /future/);
  assert.throws(() => mergeEdition({editions: [edition('2026-11-09')]}, edition(), {now}), /future/);
  const changed = edition();
  changed.stories[0].summary = 'Different content';
  assert.throws(() => mergeEdition({editions: [edition()]}, changed, {now}), /Conflicting/);
});

test('schema checks and stable category sorting', () => {
  const reversed = edition();
  reversed.stories.reverse();
  assert.deepEqual(mergeEdition({editions: []}, reversed, {now}).editions[0].stories.map(s => s.category), categories);
  for (const mutate of [
    e => e.stories.push(e.stories[0]),
    e => e.stories[0].url = 'http://example.com',
    e => e.stories[0].summary = 'Bad \u2014 punctuation',
    e => e.stories[0].category = 'Other',
    e => e.checked = '2026-11-08T08:00:00',
    e => e.checked = '2026-11-09T08:00:00+11:00',
    e => e.date = '2026-02-30'
  ]) {
    const invalid = edition(); mutate(invalid);
    assert.throws(() => validateEdition(invalid));
  }
  assert.throws(() => validateArchive({editions: [edition(), edition()]}, {today: '2026-11-08'}));
});

test('deduplication index omits old stories and all full prose', () => {
  const index = recentIndex({editions: [edition(), edition('2026-10-31')]}, {today: '2026-11-08'});
  assert.equal(index.length, 1);
  assert.deepEqual(Object.keys(index[0].stories[0]), ['id', 'category', 'title', 'url']);
});

test('CLI is idempotent and leaves bytes unchanged after an invalid update', () => {
  const dir = mkdtempSync(join(tmpdir(), 'remys-news-test-'));
  try {
    const archive = join(dir, 'archive.json');
    const input = join(dir, 'edition.json');
    const incoming = {...edition(sydneyDate()), checked: new Date().toISOString()};
    writeFileSync(archive, JSON.stringify({editions: []}));
    writeFileSync(input, JSON.stringify(incoming));
    const run = () => spawnSync(process.execPath, ['update-edition.mjs', input, '--archive', archive], {cwd: new URL('../', import.meta.url), encoding: 'utf8'});
    assert.equal(run().status, 0);
    const saved = readFileSync(archive, 'utf8');
    assert.equal(JSON.parse(run().stdout).changed, false);
    incoming.stories[0].url = 'http://example.com';
    writeFileSync(input, JSON.stringify(incoming));
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(archive, 'utf8'), saved);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('live verification checks content, timestamp and the complete archive', async () => {
  const expected = live();
  let requested;
  const result = await verifyPublished(expected, 'https://remhub-2000.github.io/RemysNews/', {attempts: 1, fetcher: async url => {requested = url; return response(expected);}});
  assert.equal(result.verified, true);
  assert.equal(requested.pathname, '/RemysNews/editions.json');
  assert.ok(requested.searchParams.has('verify'));
  const stale = structuredClone(expected);
  stale.editions[0].stories[0].summary = 'Older payload, same date';
  await assert.rejects(verifyPublished(expected, 'https://example.com/', {attempts: 1, fetcher: async () => response(stale)}), /exact expected/);
});

test('live verification tolerates propagation but fails on persistent HTTP errors', async () => {
  const expected = live();
  let count = 0;
  const result = await verifyPublished(expected, 'https://example.com/', {attempts: 2, pause: async () => {}, fetcher: async () => ++count === 1 ? {ok: false, status: 404} : response(expected)});
  assert.equal(result.verified, true);
  assert.equal(count, 2);
  await assert.rejects(verifyPublished(expected, 'https://example.com/', {attempts: 2, pause: async () => {}, fetcher: async () => ({ok: false, status: 503})}), /HTTP 503/);
});

test('live verification rejects a missing afternoon and reports the afternoon check time', async () => {
  const date = sydneyDate();
  const morning = {...morningEdition(), date, label: date, checked: `${date}T08:00:00+10:00`};
  const {date: ignoredDate, label, period, ...slot} = afternoonEdition(morning);
  const expected = {editions: [{...morning, afternoon: slot}]};
  await assert.rejects(verifyPublished(expected, 'https://example.com/', {attempts: 1, fetcher: async () => response({editions: [morning]})}), /exact expected/);
  const result = await verifyPublished(expected, 'https://example.com/', {attempts: 1, fetcher: async () => response(expected)});
  assert.equal(result.checked, slot.checked);
});
