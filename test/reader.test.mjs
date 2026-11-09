import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

async function runReader(editions) {
  const document = {activeElement: null, elements: new Map()};
  function element() {
    return {
      children: [], dataset: {}, attrs: {}, hidden: false, value: '',
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; },
      removeAttribute(key) { delete this.attrs[key]; },
      append(...children) { this.children.push(...children); },
      prepend(...children) { this.children.unshift(...children); },
      replaceChildren(...children) { this.children = children; },
      focus() { document.activeElement = this; }
    };
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) document.elements.set(id, {...element(), id});
  document.getElementById = id => document.elements.get(id);
  document.createElement = element;
  document.querySelectorAll = () => [];
  runInNewContext(app, {document, navigator: {}, URL, fetch: async () => ({ok: true, json: async () => structuredClone({editions})})});
  await new Promise(resolve => setImmediate(resolve));
  return document;
}

const story = (id, category, title) => ({id, category, title, summary: title, source: 'Test source', published: '9 Nov', url: 'https://example.com/story'});
const morning = {
  date: '2026-11-09', label: 'Monday, 9 November', checked: '2026-11-09T08:00:00+11:00',
  stories: [story('morning-trains', 'Sydney & NSW', 'Rail closure proposed'), story('ai-product-release-check-20261109', 'AI', 'Quiet notice')]
};
const afternoon = {checked: '2026-11-09T17:00:00+11:00', stories: [{...story('afternoon-trains', 'Sydney & NSW', 'Closure dates confirmed'), updatesStoryId: 'morning-trains'}, story('pm-apple', 'Apple', 'Apple update available')]};

test('reader opens afternoon, supports keyboard switching, and hides quiet categories', async () => {
  const doc = await runReader([{...morning, afternoon}]);
  const $ = doc.getElementById;
  const filters = () => $('categories').children.map(c => c.textContent);
  assert.equal($('dayparts').hidden, false);
  assert.equal($('tab-afternoon').attrs['aria-selected'], 'true');
  assert.equal($('edition-panel').attrs['aria-labelledby'], 'tab-afternoon');
  assert.deepEqual(filters(), ['All', 'Sydney & NSW', 'Apple']);
  assert.equal($('stories').children[0].children[1].children[0].textContent, 'Updated since morning');
  $('categories').children[2].onclick();
  let prevented = false;
  $('dayparts').onkeydown({key: 'ArrowLeft', target: $('tab-afternoon'), preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(doc.activeElement, $('tab-morning'));
  assert.equal($('tab-morning').attrs['aria-selected'], 'true');
  assert.deepEqual(filters(), ['All', 'Sydney & NSW']);
  assert.equal($('count').textContent, '1 story');
  assert.equal($('stories').children[0].children[1].children[0].textContent, 'Rail closure proposed');
});

test('reader hides tabs on a legacy day and restores the newest slot when switching back', async () => {
  const yesterday = {...morning, date: '2026-11-08', checked: '2026-11-08T08:00:00+11:00'};
  const $ = (await runReader([{...morning, afternoon}, yesterday])).getElementById;
  $('edition').value = yesterday.date;
  $('edition').onchange();
  assert.equal($('dayparts').hidden, true);
  assert.equal($('edition-panel').attrs.role, undefined);
  assert.match($('checked').textContent, /^Morning edition/);
  $('edition').value = morning.date;
  $('edition').onchange();
  assert.equal($('dayparts').hidden, false);
  assert.equal($('tab-afternoon').attrs['aria-selected'], 'true');
});
