import {readFileSync, writeFileSync} from 'node:fs';

const categories = ['Sydney & NSW', 'Apple', 'Tesla', 'AI', 'Technology', 'Australia & World'];
const archive = new URL('./dist/editions.json', import.meta.url);
const input = process.argv[2];
if (!input) throw new Error('Usage: node update-edition.mjs /path/to/edition.json');
const edition = JSON.parse(readFileSync(input, 'utf8'));
const date = new Date(edition.date + 'T00:00:00Z');
const iso = value => value.toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.date) || !Number.isFinite(+date) || iso(date) !== edition.date) {
  throw new Error('Expected a valid Sydney calendar date in YYYY-MM-DD format');
}
if (!edition.label || !Number.isFinite(Date.parse(edition.checked)) || !Array.isArray(edition.stories) || !edition.stories.length) {
  throw new Error('Expected a label, verification timestamp and at least one story');
}
const ids = new Set();
for (const story of edition.stories) {
  const required = ['id', 'title', 'summary', 'detail', 'source', 'url', 'published'];
  if (!categories.includes(story.category) || required.some(key => typeof story[key] !== 'string' || !story[key].trim()) || ids.has(story.id) || new URL(story.url).protocol !== 'https:') {
    throw new Error('Invalid or duplicate story: ' + story.id);
  }
  ids.add(story.id);
}
edition.stories.sort((a,b) => categories.indexOf(a.category) - categories.indexOf(b.category));
const data = JSON.parse(readFileSync(archive, 'utf8'));
const newest = [edition.date, ...data.editions.map(item => item.date)].sort().at(-1);
const cutoff = new Date(newest + 'T00:00:00Z');
cutoff.setUTCDate(cutoff.getUTCDate() - 6);
if (edition.date < iso(cutoff)) throw new Error('Edition falls outside the active seven-day archive');
const days = new Map([[edition.date, edition]]);
for (const item of data.editions) {
  if (!days.has(item.date) && item.date >= iso(cutoff) && item.date <= newest) days.set(item.date, item);
}
data.editions = [...days.values()].sort((a,b) => b.date.localeCompare(a.date));
writeFileSync(archive, JSON.stringify(data, null, 2) + '\n');
