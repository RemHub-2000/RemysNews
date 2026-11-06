(() => {
const categories=['Sydney & NSW','Apple','Tesla','AI','Technology','Australia & World'];
const state={editions:[],selected:'All',expanded:false};
const $=id=>document.getElementById(id);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {
    // Reading online does not depend on service worker support.
  }));
}
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const shortDate=date=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
function updateExpandLabel(){const buttons=[...document.querySelectorAll('.detail-toggle')];state.expanded=buttons.length>0&&buttons.every(b=>b.getAttribute('aria-expanded')==='true');$('expand').textContent=state.expanded?'Hide all details':'Show all details';$('expand').hidden=!buttons.length;}
function render(){
const edition=state.editions.find(e=>e.date===$('edition').value)||state.editions[0];if(!edition)return;
$('date').textContent=edition.label;
const words=edition.stories.reduce((n,s)=>n+[s.title,s.summary,s.detail].join(' ').split(/\s+/).length,0);
$('reading').textContent=`${Math.max(1,Math.round(words/200))} min read`;
$('note').textContent=edition.note||'';
const stories=edition.stories.filter(s=>state.selected==='All'||s.category===state.selected);
$('count').textContent=`${stories.length} stories${state.selected==='All'?'':` · ${state.selected}`}`;
$('categories').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(state.selected===b.dataset.category)));
$('stories').replaceChildren();
for(const [index,category] of categories.entries()){
const filtered=stories.filter(s=>s.category===category);if(!filtered.length)continue;
const section=node('section');const heading=node('div',null,'section-heading');const title=node('h2',category);title.id=`category-${index}`;section.setAttribute('aria-labelledby',title.id);heading.append(title);section.append(heading);
for(const [storyIndex,s] of filtered.entries()){
const article=node('article',null,'story');article.append(node('h3',s.title),node('p',s.summary,'summary'));
const meta=node('div',null,'meta');meta.append(node('span',s.source,'source'),node('span',s.published,'published'));if(s.tag)meta.append(node('span',s.tag,'tag'));article.append(meta);
const actions=node('div',null,'story-actions');let detail;
if(s.detail){detail=node('p',s.detail,'detail');detail.id=`detail-${index}-${storyIndex}`;detail.hidden=!state.expanded;const b=node('button','More detail','detail-toggle');b.type='button';b.setAttribute('aria-controls',detail.id);b.setAttribute('aria-expanded',String(state.expanded));b.setAttribute('aria-label',`More detail: ${s.title}`);b.onclick=()=>{detail.hidden=!detail.hidden;b.setAttribute('aria-expanded',String(!detail.hidden));b.textContent=detail.hidden?'More detail':'Less detail';updateExpandLabel()};b.textContent=state.expanded?'Less detail':'More detail';actions.append(b);}
const link=node('a',`Read at ${s.source}`,'source-link');link.href=safeURL(s.url);link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Read ${s.title} at ${s.source} (opens in a new tab)`);actions.append(link);article.append(actions);if(detail)article.append(detail);section.append(article);
}
$('stories').append(section);
}
if(!stories.length)$('stories').append(node('p','No significant new stories in this category for this edition.'));
updateExpandLabel();
}
for(const category of ['All',...categories]){const b=node('button',category);b.type='button';b.dataset.category=category;b.setAttribute('aria-pressed',String(state.selected===category));b.onclick=()=>{state.selected=category;render()};$('categories').append(b);}
$('expand').onclick=()=>{const expanded=!state.expanded;document.querySelectorAll('.detail-toggle').forEach(b=>{b.setAttribute('aria-expanded',String(expanded));b.textContent=expanded?'Less detail':'More detail';$(b.getAttribute('aria-controls')).hidden=!expanded});updateExpandLabel();};
$('edition').onchange=render;
fetch('editions.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('load');return r.json()}).then(data=>{if(!Array.isArray(data.editions)||!data.editions.length)throw Error('empty');state.editions=data.editions.sort((a,b)=>b.date.localeCompare(a.date));for(const e of state.editions){const o=node('option',shortDate(e.date));o.value=e.date;o.title=e.label;$('edition').append(o)}render()}).catch(()=>{$('date').textContent='Briefing unavailable';$('expand').hidden=true;$('stories').replaceChildren(node('p','This edition could not be loaded. Please reload the page to try again.'));});
})();
