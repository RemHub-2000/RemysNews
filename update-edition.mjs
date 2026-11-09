import {readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const categories = ['Sydney & NSW', 'Apple', 'Tesla', 'AI', 'Technology', 'Australia & World'];
const defaultArchive = new URL('./dist/editions.json', import.meta.url);
const iso = value => value.toISOString().slice(0, 10);

export function sydneyDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(value);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validDate(value) {
  const date = new Date(value + 'T00:00:00Z');
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+date) && iso(date) === value;
}

export function cutoffDate(today) {
  if (!validDate(today)) throw Error('Invalid archive date');
  return iso(new Date(Date.parse(today + 'T00:00:00Z') - 6 * 86400000));
}

export function validateEdition(edition) {
  if (!edition || !validDate(edition.date)) throw Error('Expected a valid Sydney calendar date');
  if (typeof edition.label !== 'string' || !edition.label.trim() || (edition.note !== undefined && typeof edition.note !== 'string')) throw Error('Invalid edition label or note');
  if (typeof edition.checked !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(edition.checked) || !Number.isFinite(Date.parse(edition.checked)) || sydneyDate(new Date(edition.checked)) !== edition.date) throw Error('Verification timestamp must include an offset and match the Sydney edition date');
  if (!Array.isArray(edition.stories) || !edition.stories.length) throw Error('Expected at least one story');
  const ids = new Set();
  for (const story of edition.stories) {
    if (!story || !categories.includes(story.category)) throw Error('Invalid category');
    for (const key of ['id', 'title', 'summary', 'source', 'url', 'published']) {
      if (typeof story[key] !== 'string' || !story[key].trim()) throw Error('Missing story field: ' + key);
    }
    if (typeof story.detail !== 'string' || (story.tag !== undefined && typeof story.tag !== 'string')) throw Error('Invalid story detail or tag');
    for (const key of ['storyKey', 'updatesStoryId']) {
      if (story[key] !== undefined && (typeof story[key] !== 'string' || !story[key].trim())) throw Error('Invalid story field: ' + key);
    }
    if (ids.has(story.id)) throw Error('Duplicate story ID: ' + story.id);
    ids.add(story.id);
    const url = new URL(story.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Source must be a credential-free HTTPS URL');
    if (/[\u2013\u2014]/.test([story.title, story.summary, story.detail].join(' '))) throw Error('Use plain punctuation, not em or en dashes');
  }
  return edition;
}

const headline = title => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function sourceKey(value) {
  const url = new URL(value);
  url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/\/$/, '');
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.*|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}
const storyKeys = story => [`id:${story.id}`, `topic:${story.storyKey || story.id}`, `headline:${headline(story.title)}`, `url:${sourceKey(story.url)}`];

function validateDay(day) {
  validateEdition(day);
  if (day.period !== undefined || day.morningChecked !== undefined || day.stories.some(s => s.updatesStoryId !== undefined)) throw Error('Unexpected afternoon fields on the morning edition');
  if (day.afternoon === undefined) return day;
  const pm = day.afternoon;
  if (!pm || typeof pm !== 'object' || pm.date !== undefined || pm.label !== undefined || pm.period !== undefined || pm.afternoon !== undefined) throw Error('Invalid afternoon edition');
  validateEdition({...pm, date: day.date, label: day.label});
  if (pm.morningChecked !== day.checked || Date.parse(pm.checked) <= Date.parse(day.checked)) throw Error('Afternoon must follow the morning edition it was researched against');
  const morning = new Map(day.stories.map(s => [s.id, s]));
  const amKeys = new Map();
  for (const s of day.stories) for (const key of storyKeys(s)) {
    if (!amKeys.has(key)) amKeys.set(key, new Set());
    amKeys.get(key).add(s.id);
  }
  const used = new Set();
  const updated = new Set();
  for (const s of pm.stories) {
    if (!s.storyKey) throw Error('Afternoon stories require a stable storyKey');
    if (morning.has(s.id)) throw Error('Afternoon cards need their own story ID: ' + s.id);
    const keys = storyKeys(s);
    const matches = new Set(keys.flatMap(key => [...(amKeys.get(key) || [])]));
    if (s.updatesStoryId !== undefined) {
      const prior = morning.get(s.updatesStoryId);
      if (!prior || updated.has(prior.id) || s.storyKey !== (prior.storyKey || prior.id) || [...matches].some(id => id !== prior.id)) throw Error('Invalid or duplicate morning story update: ' + s.id);
      if (headline(s.summary) === headline(prior.summary)) throw Error('An afternoon update must lead with new information: ' + s.id);
      updated.add(prior.id);
    } else if (matches.size) throw Error('Afternoon repeats a morning story: ' + s.id);
    if (keys.some(key => used.has(key))) throw Error('Duplicate afternoon story: ' + s.id);
    keys.forEach(key => used.add(key));
  }
  return day;
}

export const latestChecked = day => day.afternoon?.checked ?? day.checked;

export function validateArchive(data, {today = sydneyDate()} = {}) {
  if (!Array.isArray(data?.editions) || !data.editions.length || data.editions.length > 7) throw Error('Expected one to seven editions');
  const cutoff = cutoffDate(today);
  let previous = '9999-99-99';
  for (const edition of data.editions) {
    validateDay(edition);
    if (edition.date < cutoff || edition.date > today || edition.date >= previous) throw Error('Archive must be unique, newest first and inside the current seven Sydney days');
    previous = edition.date;
    for (const slot of [edition, edition.afternoon].filter(Boolean)) {
      let category = -1;
      for (const story of slot.stories) {
        const index = categories.indexOf(story.category);
        if (index < category) throw Error('Stories must follow category order');
        category = index;
      }
    }
  }
  return data;
}

export function mergeEdition(data, incoming, {now = new Date()} = {}) {
  const today = sydneyDate(now);
  const edition = structuredClone(validateEdition(incoming));
  const {period = 'morning', morningChecked, ...payload} = edition;
  if (!['morning', 'afternoon'].includes(period) || payload.afternoon !== undefined) throw Error('Supply exactly one edition slot');
  if (period === 'morning' && morningChecked !== undefined) throw Error('Only afternoon editions accept morningChecked');
  if (edition.date !== today) throw Error('Only today\'s Sydney edition may be updated');
  if (Date.parse(edition.checked) > +now + 60000) throw Error('Verification timestamp is in the future');
  edition.stories.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  if (!Array.isArray(data?.editions)) throw Error('Invalid existing archive');
  const days = new Map();
  const cutoff = cutoffDate(today);
  for (const item of data.editions) {
    if (!validDate(item.date) || item.date > today) throw Error('Invalid or future date in existing archive');
    if (item.date < cutoff) continue;
    validateDay(item);
    const current = days.get(item.date);
    if (!current || Date.parse(latestChecked(item)) > Date.parse(latestChecked(current))) days.set(item.date, item);
  }
  const existing = days.get(today);
  if (period === 'afternoon') {
    if (!existing || morningChecked !== existing.checked) throw Error('The afternoon baseline is missing or the morning edition changed');
    const {date, label, ...slot} = payload;
    const afternoon = {...slot, morningChecked};
    assertFresh(existing.afternoon, afternoon);
    days.set(today, {...existing, afternoon});
  } else {
    if (existing) {
      const {afternoon, ...morning} = existing;
      assertFresh(morning, payload);
      if (afternoon && !isDeepStrictEqual(morning, payload)) throw Error('Morning is locked after the afternoon has been published');
      days.set(today, afternoon ? existing : payload);
    } else days.set(today, payload);
  }
  return validateArchive({...data, editions: [...days.values()].sort((a, b) => b.date.localeCompare(a.date))}, {today});
}

function assertFresh(existing, incoming) {
  if (!existing) return;
  const difference = Date.parse(incoming.checked) - Date.parse(existing.checked);
  if (difference < 0) throw Error('Refusing to overwrite a newer same-day edition');
  if (difference === 0 && !isDeepStrictEqual(existing, incoming)) throw Error('Conflicting content at the same verification timestamp');
}

export function recentIndex(data, {today = sydneyDate()} = {}) {
  const cutoff = cutoffDate(today);
  const compact = stories => stories.map(({id, category, title, url, storyKey, updatesStoryId}) => ({id, category, title, url, ...(storyKey ? {storyKey} : {}), ...(updatesStoryId ? {updatesStoryId} : {})}));
  return data.editions.filter(e => e.date >= cutoff && e.date <= today).map(e => ({date: e.date, checked: e.checked, stories: compact(e.stories), ...(e.afternoon ? {afternoon: {checked: e.afternoon.checked, stories: compact(e.afternoon.stories)}} : {})}));
}

function main(args) {
  const archiveFlag = args.indexOf('--archive');
  let archive = defaultArchive;
  if (archiveFlag >= 0) {
    if (!args[archiveFlag + 1]) throw Error('--archive requires a path');
    archive = pathToFileURL(resolve(args[archiveFlag + 1]));
    args.splice(archiveFlag, 2);
  }
  if (args.length !== 1) throw Error('Usage: node update-edition.mjs <edition.json|--recent|--validate> [--archive path]');
  const data = JSON.parse(readFileSync(archive, 'utf8'));
  if (args[0] === '--recent') return console.log(JSON.stringify(recentIndex(data), null, 2));
  if (args[0] === '--validate') {
    validateArchive(data);
    return console.log(JSON.stringify({valid: true, dates: data.editions.map(e => e.date), latestChecked: latestChecked(data.editions[0])}));
  }
  if (args[0].startsWith('--')) throw Error('Unknown option');
  const next = mergeEdition(data, JSON.parse(readFileSync(args[0], 'utf8')));
  const content = JSON.stringify(next, null, 2) + '\n';
  const changed = content !== readFileSync(archive, 'utf8');
  if (changed) {
    const temporary = new URL(archive.href + '.' + randomUUID() + '.tmp');
    try {
      writeFileSync(temporary, content, {flag: 'wx'});
      renameSync(temporary, archive);
    } finally { rmSync(temporary, {force: true}); }
  }
  console.log(JSON.stringify({changed, date: next.editions[0].date, checked: latestChecked(next.editions[0]), dates: next.editions.map(e => e.date)}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
