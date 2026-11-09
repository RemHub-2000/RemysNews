(() => {
const categories=['Sydney & NSW','Apple','Tesla','AI','Technology','Australia & World'];
const state={editions:[],selected:'All',expanded:false,period:null};
const $=id=>document.getElementById(id);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {
    // Reading online does not depend on service worker support.
  }));
}
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const shortDate=date=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const checkedTime=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney'}).format(new Date(value));
const periods=['morning','afternoon'];
// These pre-tab archive cards are quiet notices, not news. Keep the source archive intact.
const legacyQuietCards=new Set(['ai-product-release-check-20261109','apple-quiet-check-20261108','ai-quiet-product-check-20261108']);
const tab=period=>$(`tab-${period}`);
function selectPeriod(period,focus=false){
  state.period=period;state.expanded=false;render();if(focus)tab(period).focus();
}
function buildCategories(available){
  const nav=$('categories');
  const focused=document.activeElement?.dataset.category;
  nav.hidden=available.length===0;
  nav.replaceChildren();
  for(const category of ['All',...available]){
    const b=node('button',category);b.type='button';b.dataset.category=category;
    b.setAttribute('aria-pressed',String(state.selected===category));
    b.onclick=()=>{state.selected=category;render()};nav.append(b);
    if(focused===category)b.focus();
  }
}
function updateExpandLabel(){const buttons=[...document.querySelectorAll('.detail-toggle')];state.expanded=buttons.length>0&&buttons.every(b=>b.getAttribute('aria-expanded')==='true');$('expand').textContent=state.expanded?'Hide all details':'Show all details';$('expand').hidden=!buttons.length;}
function render(){
const day=state.editions.find(e=>e.date===$('edition').value)||state.editions[0];if(!day)return;
const hasAfternoon=Boolean(day.afternoon?.stories?.length);
const period=hasAfternoon?(state.period||'afternoon'):'morning';
const edition=period==='afternoon'?day.afternoon:day;
const editionStories=edition.stories.filter(s=>!legacyQuietCards.has(s.id));
$('dayparts').hidden=!hasAfternoon;
for(const name of periods){tab(name).setAttribute('aria-selected',String(name===period));tab(name).tabIndex=name===period?0:-1;}
const panel=$('edition-panel');
if(hasAfternoon){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab(period).id);}
else{panel.removeAttribute('role');panel.removeAttribute('aria-labelledby');}
$('date').textContent=day.label;
$('checked').textContent=edition.checked?`${hasAfternoon?'':'Morning edition · '}Checked ${checkedTime(edition.checked)} Sydney time` : '';
const words=editionStories.reduce((n,s)=>n+[s.title,s.summary,s.detail].join(' ').split(/\s+/).length,0);
$('reading').textContent=words?`${Math.max(1,Math.round(words/200))} min read`:'';
$('note').textContent=edition.note||'';
const available=categories.filter(category=>editionStories.some(s=>s.category===category));
if(state.selected!=='All'&&!available.includes(state.selected))state.selected='All';
buildCategories(available);
const stories=editionStories.filter(s=>state.selected==='All'||s.category===state.selected);
$('count').textContent=`${stories.length} ${stories.length===1?'story':'stories'}${state.selected==='All'?'':` · ${state.selected}`}`;
$('stories').replaceChildren();
for(const [index,category] of categories.entries()){
const filtered=stories.filter(s=>s.category===category);if(!filtered.length)continue;
const section=node('section');const heading=node('div',null,'section-heading');const title=node('h2',category);title.id=`category-${index}`;section.setAttribute('aria-labelledby',title.id);heading.append(title);section.append(heading);
for(const [storyIndex,s] of filtered.entries()){
const article=node('article',null,'story');article.append(node('h3',s.title),node('p',s.summary,'summary'));
if(s.updatesStoryId)article.prepend(node('p','Updated since morning','story-update'));
const meta=node('div',null,'meta');meta.append(node('span',s.source,'source'),node('span',s.published,'published'));if(s.tag)meta.append(node('span',s.tag,'tag'));article.append(meta);
const actions=node('div',null,'story-actions');let detail;
if(s.detail){detail=node('p',s.detail,'detail');detail.id=`detail-${index}-${storyIndex}`;detail.hidden=!state.expanded;const b=node('button','More detail','detail-toggle');b.type='button';b.setAttribute('aria-controls',detail.id);b.setAttribute('aria-expanded',String(state.expanded));b.setAttribute('aria-label',`More detail: ${s.title}`);b.onclick=()=>{detail.hidden=!detail.hidden;b.setAttribute('aria-expanded',String(!detail.hidden));b.textContent=detail.hidden?'More detail':'Less detail';updateExpandLabel()};b.textContent=state.expanded?'Less detail':'More detail';actions.append(b);}
const link=node('a',`Read at ${s.source}`,'source-link');link.href=safeURL(s.url);link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`Read ${s.title} at ${s.source} (opens in a new tab)`);actions.append(link);article.append(actions);if(detail)article.append(detail);section.append(article);
}
$('stories').append(section);
}
updateExpandLabel();
}
for(const period of periods)tab(period).onclick=()=>selectPeriod(period);
$('dayparts').onkeydown=event=>{
  const i=periods.findIndex(period=>tab(period)===event.target);if(i<0)return;
  const next={ArrowLeft:1-i,ArrowRight:1-i,Home:0,End:1}[event.key];
  if(next===undefined)return;event.preventDefault();selectPeriod(periods[next],true);
};
$('expand').onclick=()=>{const expanded=!state.expanded;document.querySelectorAll('.detail-toggle').forEach(b=>{b.setAttribute('aria-expanded',String(expanded));b.textContent=expanded?'Less detail':'More detail';$(b.getAttribute('aria-controls')).hidden=!expanded});updateExpandLabel();};
$('edition').onchange=()=>{state.period=null;state.selected='All';state.expanded=false;render();};
fetch('editions.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('load');return r.json()}).then(data=>{if(!Array.isArray(data.editions)||!data.editions.length)throw Error('empty');state.editions=data.editions.sort((a,b)=>b.date.localeCompare(a.date));for(const e of state.editions){const o=node('option',shortDate(e.date));o.value=e.date;o.title=e.label;$('edition').append(o)}render()}).catch(()=>{$('date').textContent='Briefing unavailable';$('expand').hidden=true;$('stories').replaceChildren(node('p','This edition could not be loaded. Please reload the page to try again.'));});
})();
