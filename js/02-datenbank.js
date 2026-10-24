'use strict';
/* Zugriff auf die Datenbank: Schreibwarteschlange, Speichern, Abonnements */
/* ---------- Datenbank ---------- */
let DB=null;
const queues={};
const pend={};
const timers={};
function errText(e){
  const c=e&&e.code;
  if(c==='quota_exceeded')return 'Speicher voll. Lösche alte Einträge.';
  if(c==='invalid_argument'||c==='revoked')return 'Speichern nicht erlaubt. Melde dich neu an.';
  return 'Speichern fehlgeschlagen. Versuche es noch einmal.';
}
function enqueue(key,fn){
  const prev=queues[key]||Promise.resolve();
  const run=async()=>{
    try{return await fn();}
    catch(e){
      if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,500+Math.random()*400));return await fn();}
      throw e;
    }
  };
  const p=prev.then(run).catch(e=>{console.error(e);toast(errText(e));});
  queues[key]=p;
  return p;
}
const setDoc=(path,data)=>DB?enqueue(path,()=>DB.doc(path).set(data)):Promise.resolve();
const patchDoc=(path,data)=>DB?enqueue(path,()=>DB.doc(path).update(data)):Promise.resolve();
const delDoc=path=>DB?enqueue(path,()=>DB.doc(path).delete()):Promise.resolve();
const dayRef=date=>S.days[date]||(S.days[date]={date});

function saveDay(date,patch){
  if(!DB)return Promise.resolve();
  pend[date]=(pend[date]||0)+1;
  const path='days/'+date;
  return enqueue(path,async()=>{
    const ref=DB.doc(path);
    const snap=await ref.get();
    if(snap.exists)await ref.update(patch);else await ref.set(Object.assign({date},patch));
  }).finally(()=>{pend[date]--;});
}
function saveDayLater(date,field,ms){
  const k=date+':'+field;
  if(!timers[k])pend[date]=(pend[date]||0)+1;
  clearTimeout(timers[k]);
  timers[k]=setTimeout(async()=>{
    delete timers[k];
    try{await saveDay(date,{[field]:S.days[date]?S.days[date][field]:null});}
    finally{pend[date]--;}
  },ms||500);
}

function subscribe(){
  const on=(ref,key,apply)=>ref.onSnapshot(s=>{apply(s);LOADED[key]=true;requestRender();},e=>{console.error(e);UI.dbErr=e;requestRender();});
  on(DB.doc('profile/main'),'profile',s=>{S.profile=s.exists?clone(s.data()):null;});
  on(DB.doc('targets/main'),'targets',s=>{S.targets=s.exists?clone(s.data()):null;});
  on(DB.collection('exercises'),'exercises',s=>{
    S.exercises=s.docs.map(d=>Object.assign({id:d.id},clone(d.data()))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  });
  on(DB.collection('presets'),'presets',s=>{
    S.presets=s.docs.map(d=>Object.assign({id:d.id},clone(d.data()))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  });
  DB.collection('wissen').onSnapshot(s=>{
    const next={};s.docs.forEach(d=>{next[d.id]=clone(d.data());});
    S.wissen=next;UI.wErr=false;
    LOADED.wissen=true;requestRender();
  },e=>{console.error(e);UI.wErr=true;requestRender();});
  /* Claude-Anweisung (ki/systemprompt): wird nur im Fenster der Kopfzeile gezeigt und blockiert den Start nicht */
  DB.doc('ki/systemprompt').onSnapshot(s=>{
    S.ki=s.exists?clone(s.data()):null;S.kiLoaded=true;
    if(typeof fillClaude==='function')fillClaude();
  },e=>{console.error(e);S.kiLoaded=true;S.kiErr=true;if(typeof fillClaude==='function')fillClaude();});
  on(DB.collection('days').orderBy('date','desc'),'days',s=>{
    const next={};
    s.docs.forEach(d=>{next[d.id]=clone(d.data());});
    Object.keys(pend).forEach(k=>{if(pend[k]>0&&S.days[k])next[k]=S.days[k];});
    S.days=next;
    maybeResetPlanDraft();
  });
}
async function initDb(){
  /* Die Daten kommen erst nach der Anmeldung (js/auth.js); db-supabase.js liefert die Schnittstelle. */
  let db=null;
  try{db=window.CockpitAuth?await window.CockpitAuth.ready():null;}catch(e){db=null;}
  if(!db){UI.dbOff=true;render();return;}
  DB=db;
  subscribe();
}
