import {readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

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
    if (ids.has(story.id)) throw Error('Duplicate story ID: ' + story.id);
    ids.add(story.id);
    const url = new URL(story.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Source must be a credential-free HTTPS URL');
    if (/[\u2013\u2014]/.test([story.title, story.summary, story.detail].join(' '))) throw Error('Use plain punctuation, not em or en dashes');
  }
  return edition;
}

export function validateArchive(data, {today = sydneyDate()} = {}) {
  if (!Array.isArray(data?.editions) || !data.editions.length || data.editions.length > 7) throw Error('Expected one to seven editions');
  const cutoff = cutoffDate(today);
  let previous = '9999-99-99';
  for (const edition of data.editions) {
    validateEdition(edition);
    if (edition.date < cutoff || edition.date > today || edition.date >= previous) throw Error('Archive must be unique, newest first and inside the current seven Sydney days');
    previous = edition.date;
    let category = -1;
    for (const story of edition.stories) {
      const index = categories.indexOf(story.category);
      if (index < category) throw Error('Stories must follow category order');
      category = index;
    }
  }
  return data;
}

export function mergeEdition(data, incoming, {now = new Date()} = {}) {
  const today = sydneyDate(now);
  const edition = structuredClone(validateEdition(incoming));
  if (edition.date !== today) throw Error('Only today\'s Sydney edition may be updated');
  if (Date.parse(edition.checked) > +now + 60000) throw Error('Verification timestamp is in the future');
  edition.stories.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  if (!Array.isArray(data?.editions)) throw Error('Invalid existing archive');
  const days = new Map();
  const cutoff = cutoffDate(today);
  for (const item of data.editions) {
    if (!validDate(item.date) || item.date > today) throw Error('Invalid or future date in existing archive');
    if (item.date < cutoff) continue;
    validateEdition(item);
    const current = days.get(item.date);
    if (!current || Date.parse(item.checked) > Date.parse(current.checked)) days.set(item.date, item);
  }
  const existing = days.get(today);
  if (existing && Date.parse(existing.checked) > Date.parse(edition.checked)) throw Error('Refusing to overwrite a newer same-day edition');
  if (existing && existing.checked === edition.checked && JSON.stringify(existing) !== JSON.stringify(edition)) throw Error('Conflicting content at the same verification timestamp');
  days.set(today, edition);
  return validateArchive({...data, editions: [...days.values()].sort((a, b) => b.date.localeCompare(a.date))}, {today});
}

export function recentIndex(data, {today = sydneyDate()} = {}) {
  const cutoff = cutoffDate(today);
  return data.editions.filter(e => e.date >= cutoff && e.date <= today).map(e => ({date: e.date, checked: e.checked, stories: e.stories.map(({id, category, title, url}) => ({id, category, title, url}))}));
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
    return console.log(JSON.stringify({valid: true, dates: data.editions.map(e => e.date), latestChecked: data.editions[0].checked}));
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
  console.log(JSON.stringify({changed, date: next.editions[0].date, checked: next.editions[0].checked, dates: next.editions.map(e => e.date)}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
