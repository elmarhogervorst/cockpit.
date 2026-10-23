'use strict';
/* Hinweisleiste, Kopieren, Rendern der Seite */
/* ---------- Toast, Kopieren ---------- */
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},2800);}
async function copyText(txt,el){
  try{await navigator.clipboard.writeText(txt);toast('Kopiert');}
  catch(e){
    try{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Markiert. Kopiere mit Strg+C.');}
    catch(e2){toast('Kopieren nicht möglich');}
  }
}

/* ---------- Rendern ---------- */
const VIEWS={};
const AFTER={};
const ACT={};
const BIND={};
let renderQueued=false,renderDeferred=false,animT=null;
const typing=()=>{const a=document.activeElement;return !!(a&&a!==document.body&&$('#view').contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));};
function requestRender(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{
    renderQueued=false;
    if(typing()){renderDeferred=true;return;}
    /* Läuft gerade eine Einklapp-Animation, wird erst danach neu gezeichnet, damit sie nicht abreißt */
    const wait=UI.animUntil-Date.now();
    if(wait>0){clearTimeout(animT);animT=setTimeout(()=>{if(typing())renderDeferred=true;else render();},wait+30);return;}
    render();
  });
}
document.addEventListener('focusout',()=>{
  if(!renderDeferred)return;
  setTimeout(()=>{if(!typing()){renderDeferred=false;render();}},0);
});
function render(){
  const v=$('#view');
  $$('#nav button').forEach(b=>{if(b.dataset.tab===UI.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(UI.dbOff){v.innerHTML='<div class="empty"><b>Keine Verbindung zu deinen Daten</b>Prüfe das Netz und lade die Seite neu.</div>';return;}
  if(!isReady()){
    v.innerHTML=UI.dbErr
      ?'<div class="empty"><b>Daten konnten nicht geladen werden</b>Lade die Seite neu. Wenn es bleibt, melde dich ab und wieder an.</div>'
      :'<div class="empty"><b>Lade deine Daten</b>Einen Moment.</div>';
    return;
  }
  v.innerHTML=VIEWS[UI.tab]();
  if(AFTER[UI.tab])AFTER[UI.tab]();
  if(UI.focusSel){const f=$(UI.focusSel);UI.focusSel=null;if(f)try{f.focus({preventScroll:true});}catch(e){}}
}
$('#view').addEventListener('click',e=>{
  if(UI.confirmDel&&!e.target.closest('[data-confirm]')){UI.confirmDel=null;if(UI.tab==='training'||UI.tab==='overview')render();}
  const t=e.target.closest('[data-act]');
  if(!t)return;
  const f=ACT[t.dataset.act];
  if(f)f(t,e);
});
$('#view').addEventListener('change',e=>{const t=e.target.closest('[data-bind]');if(t&&BIND[t.dataset.bind])BIND[t.dataset.bind](t,e,'change');});
$('#view').addEventListener('input',e=>{const t=e.target.closest('[data-live]');if(t&&BIND[t.dataset.live])BIND[t.dataset.live](t,e,'input');});
$('#nav').addEventListener('click',e=>{
  const b=e.target.closest('button[data-tab]');
  if(!b)return;
  UI.tab=b.dataset.tab;
  try{localStorage.setItem('cockpit.tab',UI.tab);}catch(err){}
  render();window.scrollTo(0,0);
});
function goTab(tab,sub){
  UI.tab=tab;if(sub){UI.trainTab=sub;try{localStorage.setItem('cockpit.trainTab',sub);}catch(e){}}
  try{localStorage.setItem('cockpit.tab',tab);}catch(e){}
  render();window.scrollTo(0,0);
}
