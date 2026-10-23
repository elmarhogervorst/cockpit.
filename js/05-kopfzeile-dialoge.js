'use strict';
/* Start und Grenzen, Wochenwahl, Darstellung, Backup, Bestätigungsfenster */
/* ---------- Start und Grenzen ---------- */
/* Ab diesem Tag zählt das Cockpit. Gibt es ältere Dokumente, bleiben sie erreichbar. */
const START_DATE='2026-10-20';
const PLAN_AHEAD_WEEKS=12;
/* Letzter Tag, der geplant werden darf: Ende der Woche, die PLAN_AHEAD_WEEKS Wochen nach der aktuellen liegt */
const maxPlanDate=()=>addDays(weekStart(TODAY()),PLAN_AHEAD_WEEKS*7+6);
/* Uhrzeiten: HH:MM <-> ISO (lokale Zeit), Dauer als Text */
const pad2=n=>String(n).padStart(2,'0');
const hmOf=iso=>{if(!iso)return '';const d=new Date(iso);return isNaN(d)?'':pad2(d.getHours())+':'+pad2(d.getMinutes());};
const validHm=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
function isoAt(date,hm,after){
  const [h,m]=hm.split(':').map(Number),d=fromIso(date);
  d.setHours(h,m,0,0);
  if(after&&d<=new Date(after))d.setDate(d.getDate()+1);
  return d.toISOString();
}
/* Laufende Zeit mit Sekunden: „1 Std 12 min 05 s“, „12 min 05 s“, „45 s“ */
const fmtDurS=ms=>{const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;
  return h?h+' Std '+pad2(m)+' min '+pad2(s)+' s':m?m+' min '+pad2(s)+' s':s+' s';};
const fmtDur=ms=>{const m=Math.max(0,Math.round(ms/60000)),h=Math.floor(m/60);return h?h+' Std'+(m%60?' '+(m%60)+' min':''):m+' min';};
/* Einklappbare Karte: data-open an der Karte, inert am Inhalt. Ohne Neuzeichnen, damit die CSS-Animation läuft. */
function setFold(cardSel,wrapSel,toggleSel,open,focus){
  const card=$(cardSel);
  if(!card)return;
  UI.animUntil=Date.now()+650;
  card.toggleAttribute('data-open',open);
  const w=$(wrapSel);if(w)w.toggleAttribute('inert',!open);
  const t=$(toggleSel);if(t)t.setAttribute('aria-expanded',String(open));
  if(open&&focus){const n=$(focus);if(n)try{n.focus({preventScroll:true});}catch(e){}}
}
/* Neu zeichnen (alter Zustand bleibt) und danach animiert in den gewünschten Zustand wechseln */
function redrawThenFold(cardSel,wrapSel,toggleSel,open,focus){
  render();
  const c=$(cardSel);if(c)void c.offsetHeight;
  setFold(cardSel,wrapSel,toggleSel,open,focus);
}
/* Fokus setzen und über ein späteres Neuzeichnen hinweg halten */
function keepFocus(sel){
  UI.focusSel=sel;
  const f=$(sel);if(f)try{f.focus({preventScroll:true});}catch(e){}
  setTimeout(()=>{UI.focusSel=null;},1200);
}
function firstDate(){
  const ks=Object.keys(S.days).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  return ks.length&&ks[0]<START_DATE?ks[0]:START_DATE;
}

/* ---------- Wochenwahl (Training & Plan) ---------- */
const curWeek=()=>weekStart(TODAY());
const viewWeek=()=>UI.wk||curWeek();
function isoWeekNo(s){
  const d=fromIso(s),t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),dn=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-dn);
  const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return Math.ceil(((t-y0)/864e5+1)/7);
}
function weekRange(ws){
  const a=fromIso(ws),b=fromIso(addDays(ws,6));
  if(a.getMonth()===b.getMonth())return a.getDate()+'.–'+b.getDate()+'. '+MONTHS[b.getMonth()];
  return a.getDate()+'. '+MONTHS[a.getMonth()].slice(0,3)+' – '+b.getDate()+'. '+MONTHS[b.getMonth()].slice(0,3);
}
function setWeek(ws){
  const cur=curWeek(),i=DOW.indexOf(dowKey(UI.trainDate||TODAY())),j=DOW.indexOf(dowKey(UI.planDate||TODAY()));
  UI.wk=ws===cur?null:ws;
  UI.trainDate=ws===cur?null:addDays(ws,i);
  const np=addDays(ws,j);
  if(np!==UI.planDate){
    UI.planDate=np;UI.planScope=null;
    if(!UI.editingPreset){
      if(UI.planDirty)toast('Ungespeicherte Änderungen verworfen');
      UI.planDraft=null;UI.planDirty=false;
    }
  }
}
/* Beschriftung mit fester Breite: unsichtbare Platzhalter mit den längsten möglichen Texten bestimmen die Breite in der echten Schrift */
const fixedLab=(txt,sizers)=>'<span class="fixlab">'+sizers.map(t=>'<i aria-hidden="true">'+esc(t)+'</i>').join('')+'<b>'+esc(txt)+'</b></span>';
const WK_SIZERS=['KW 38 · 20.–26. September','KW 39 · 27.–30. September','KW 44 · 26. Okt – 1. Nov','KW 48 · 30. Nov – 6. Dez','KW 31 · 27. Jul – 2. Aug'];
function weekNavHtml(){
  const ws=viewWeek(),cur=curWeek(),diff=Math.round((fromIso(ws)-fromIso(cur))/(7*864e5));
  const rel=diff===0?'Diese Woche':diff===1?'Nächste Woche':diff===-1?'Letzte Woche':diff>1?'In '+diff+' Wochen':'Vor '+(-diff)+' Wochen';
  const ic=n=>I[n].replace('<svg','<svg width="18" height="18"');
  return '<div class="weeknav"><div class="datenav"><button type="button" data-act="wk-prev" aria-label="Vorherige Woche"'+(addDays(ws,-7)<weekStart(firstDate())?' disabled':'')+'>'+ic('left')+'</button>'
    +fixedLab('KW '+isoWeekNo(ws)+' · '+weekRange(ws),WK_SIZERS)
    +'<button type="button" data-act="wk-next" aria-label="Nächste Woche"'+(diff>=PLAN_AHEAD_WEEKS?' disabled':'')+'>'+ic('right')+'</button></div>'
    +'<span class="rel">'+rel+'</span>'+(diff!==0?'<button type="button" class="btn sm" data-act="wk-today">Zur aktuellen Woche</button>':'')+'</div>';
}
ACT['wk-prev']=()=>{setWeek(addDays(viewWeek(),-7));render();};
ACT['wk-next']=()=>{setWeek(addDays(viewWeek(),7));render();};
ACT['wk-today']=()=>{setWeek(curWeek());render();};

/* ---------- Darstellung: Hell, Dunkel, Automatisch (pro Gerät) ---------- */
const THEMES=['light','dark','auto'];
const THEME_NAME={light:'Hell',dark:'Dunkel',auto:'Automatisch'};
function getTheme(){try{const t=localStorage.getItem('cockpit.theme');if(THEMES.includes(t))return t;}catch(e){}return 'light';}
function applyTheme(t){
  const r=document.documentElement;
  if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);
  const b=$('#btn-theme');
  b.innerHTML=t==='light'?I.sun:t==='dark'?I.moon:I.auto;
  b.setAttribute('aria-label','Darstellung: '+THEME_NAME[t]+'. Tippen zum Wechseln');
  b.title='Darstellung: '+THEME_NAME[t];
}
$('#btn-theme').addEventListener('click',()=>{
  const next=THEMES[(THEMES.indexOf(getTheme())+1)%THEMES.length];
  try{localStorage.setItem('cockpit.theme',next);}catch(e){}
  applyTheme(next);
  toast(next==='light'?'Heller Modus':next==='dark'?'Dunkler Modus':'Darstellung folgt deinem Gerät');
});
applyTheme(getTheme());

/* ---------- Kopfzeile: Export ---------- */
$('#btn-export').innerHTML=I.dl;
$('#btn-export').addEventListener('click',async()=>{
  if(!DB){toast('Keine Verbindung zu deinen Daten');return;}
  try{
    const all=await DB.collection('days').get();
    const days={};all.docs.forEach(d=>{days[d.id]=d.data();});
    const out={exportiert:new Date().toISOString(),profile:S.profile,targets:S.targets,exercises:S.exercises,presets:S.presets,wissen:S.wissen,days};
    /* Als Datei auf dem Gerät speichern. Das Backup enthält deine persönlichen Daten: nicht ins Repo legen. */
    const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='cockpit-backup-'+TODAY()+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('Backup gespeichert');
  }catch(e){toast('Backup nicht möglich');}
});
/* ---------- Kopfzeile: Abmelden ---------- */
$('#btn-logout').innerHTML=I.out;
$('#btn-logout').addEventListener('click',async()=>{
  const ok=await askConfirm({title:'Abmelden?',text:'Du musst dich danach mit E-Mail und Passwort wieder anmelden.',ok:'Abmelden'});
  if(ok&&window.CockpitAuth)window.CockpitAuth.logout();
});
/* ---------- Bestätigungs-Popup (eigenes Dialogfenster, gibt true/false zurück) ---------- */
let confirmResolve=null;
function askConfirm(o){
  const d=$('#confirm-dlg');
  $('#confirm-t').textContent=o.title||'Sicher?';
  $('#confirm-p').textContent=o.text||'';
  $('#confirm-list').innerHTML=(o.list||[]).map(r=>'<li><span>'+esc(r[0])+'</span><span>'+esc(r[1])+'</span></li>').join('');
  $('#confirm-ok').textContent=o.ok||'OK';
  d.returnValue='';
  return new Promise(res=>{
    confirmResolve=res;
    try{d.showModal();}catch(e){d.setAttribute('open','');}
  });
}
(function(){
  const d=$('#confirm-dlg');
  const done=v=>{d.returnValue=v?'ok':'no';try{d.close();}catch(e){d.removeAttribute('open');d.dispatchEvent(new Event('close'));}};
  $('#confirm-ok').addEventListener('click',()=>done(true));
  $('#confirm-cancel').addEventListener('click',()=>done(false));
  d.addEventListener('click',e=>{if(e.target===d)done(false);});
  d.addEventListener('close',()=>{const r=confirmResolve;confirmResolve=null;if(r)r(d.returnValue==='ok');});
})();
