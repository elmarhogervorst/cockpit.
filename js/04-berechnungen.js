'use strict';
/* Tagesziele und Berechnungen für Ernährung und Training */
/* ---------- Tagesziele ----------
   Die Seite rechnet keine Ziele und kennt keine Standardziele. Pro Tag steht das Ziel in days/<Datum>.targets {kcal, protein, carbs, fat, note?}; es wird mit dem Agenten im Chat
   geplant. Fehlt es für einen Tag, ist für diesen Tag nichts geplant (set:false). targets/main.applied und .overrides werden nicht mehr gelesen. */
function targetsFor(date){
  const t=S.days[date]&&S.days[date].targets;
  if(t&&t.kcal>0)return {kcal:t.kcal,protein:t.protein||0,carbs:t.carbs||0,fat:t.fat||0,set:true,day:true,note:t.note||''};
  return {kcal:0,protein:0,carbs:0,fat:0,set:false,day:false,note:''};
}

/* ---------- Berechnungen: Ernährung ---------- */
const mealsOf=date=>{const d=S.days[date];return (d&&d.meals)||[];};
/* Zahlen eines Eintrags (Mahlzeit oder Zutat); fehlende kcal werden aus den Makros berechnet (4/4/9) */
function nums(f){
  const p=toNum(f.protein)||0,c=toNum(f.carbs)||0,fa=toNum(f.fat)||0;
  let kcal=toNum(f.kcal)||0;
  if(!kcal&&(p||c||fa))kcal=4*p+4*c+9*fa;
  return {kcal,protein:p,carbs:c,fat:fa};
}
const r1=v=>Math.round(v*10)/10;
/* Summe einer Zutatenliste, gerundet wie ein normaler Eintrag */
function sumIng(list){
  const t=(list||[]).reduce((a,it)=>{const n=nums(it);return {kcal:a.kcal+n.kcal,protein:a.protein+n.protein,carbs:a.carbs+n.carbs,fat:a.fat+n.fat};},{kcal:0,protein:0,carbs:0,fat:0});
  return {kcal:Math.round(t.kcal),protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat)};
}
const hasIng=m=>!!(m&&Array.isArray(m.ingredients)&&m.ingredients.length);
/* Hat eine Mahlzeit Zutaten, ergeben sich kcal und Makros aus deren Summe; sonst gelten die eigenen Werte */
const mealTot=m=>hasIng(m)?sumIng(m.ingredients):{kcal:+m.kcal||0,protein:+m.protein||0,carbs:+m.carbs||0,fat:+m.fat||0};
const sumMeals=ms=>ms.reduce((a,m)=>{const t=mealTot(m);return {kcal:a.kcal+t.kcal,protein:a.protein+t.protein,carbs:a.carbs+t.carbs,fat:a.fat+t.fat};},{kcal:0,protein:0,carbs:0,fat:0});

/* ---------- Berechnungen: Training ---------- */
function exSummary(ex){
  const all=(ex&&ex.sets)||[],warm=all.filter(s=>s.warmup).length,sets=all.filter(s=>!s.warmup);
  if(!sets.length)return warm?warm+(warm===1?' Aufwärmsatz':' Aufwärmsätze'):'Keine Sätze';
  const t=ex.timed?' s':'';
  const reps=sets.map(s=>toNum(s.reps)).filter(v=>v!=null);
  const kgs=sets.map(s=>toNum(s.kg)).filter(v=>v!=null&&v>0);
  const uniq=a=>[...new Set(a)];
  const rr=uniq(reps),kk=uniq(kgs);
  const rtxt=!rr.length?'':rr.length===1?f1(rr[0])+t:f1(Math.min(...rr))+'–'+f1(Math.max(...rr))+t;
  const ktxt=!kk.length?'':' · '+(kk.length===1?f1(kk[0]):f1(Math.min(...kk))+'–'+f1(Math.max(...kk)))+' KG';
  const head=(rr.length<=1&&kk.length<=1)?sets.length+' × ':sets.length+' Sätze · ';
  return head+rtxt+ktxt+(warm?' · +'+warm+' AW':'');
}
const planSets=d=>(d&&d.exercises||[]).reduce((a,e)=>a+(e.sets||[]).filter(s=>!s.warmup).length,0);
/* Aufwärmsätze (warmup:true) stehen immer vor den Arbeitssätzen, haben kein RPE und zählen nicht in Volumen/Sätze.
   Nummer eines Arbeitssatzes = Position unter den Arbeitssätzen (übersprungene zählen mit, damit die Nummern stabil bleiben). */
const workNo=(sets,j)=>sets.slice(0,j+1).filter(s=>!s.warmup).length;
const leadWarm=sets=>{let k=0;while(k<sets.length&&sets[k].warmup)k++;return k;};
const WARM_PCT=[0.5,0.7,0.85],WARM_REPS=[8,5,3];
function warmDefaults(timed,refKg,n){
  const k=Math.min(n,2);
  let kg=refKg>0?Math.round(refKg*WARM_PCT[k]/2.5)*2.5:null;
  if(kg!=null)kg=Math.max(2.5,Math.min(kg,refKg));
  return {reps:timed?20:WARM_REPS[k],kg};
}
/* Eintrag eines Datums: nur ein eigener Eintrag (days/<Datum>.plan) zählt. Ohne ihn gilt der Tag als leer („Kein Eintrag“). */
function planFor(date){
  const d=S.days[date];
  return (d&&d.plan)||null;
}
/* Eine unberührte Einheit ist nur eine Momentaufnahme des Plans. Ändert sich der Plan, bleibt sie nicht als Altlast liegen:
   bei Ruhetag oder „Kein Eintrag“ wird sie entfernt, bei einem anderen Training nur, solange kein Start gesetzt ist (sonst übernimmt ensureWorkout sie).
   Begonnene, übersprungene und abgeschlossene Einheiten bleiben immer erhalten. Liefert die Ergänzung für den Speichervorgang des Plans. */
function staleWorkoutPatch(date,doc){
  const d=S.days[date],w=d&&d.workout;
  if(!w||!isPristine(w))return {};
  const pw=planWorkout(doc);
  if(!pw||(!w.startedAt&&wSig(w)!==wSig(pw))){d.workout=null;return {workout:null};}
  return {};
}
/* Eintrag für einen Tag speichern */
function putPlan(date,doc){
  const extra=staleWorkoutPatch(date,doc);
  dayRef(date).plan=doc;
  saveDay(date,Object.assign({plan:doc},extra));
}
/* Eintrag eines Tages löschen: der Tag zeigt wieder „Kein Eintrag“ */
function clearPlan(date){
  const extra=staleWorkoutPatch(date,null);
  dayRef(date).plan=null;
  saveDay(date,Object.assign({plan:null},extra));
}
function maybeResetPlanDraft(){
  if(UI.planDirty||UI.editingPreset||!UI.planDraft)return;
  if(JSON.stringify(planFor(UI.planDate||TODAY()))!==UI.planBase)UI.planDraft=null;
}
function virtualWorkout(pd){
  return {planName:pd.name,status:'open',exercises:(pd.exercises||[]).map(e=>({exerciseId:e.exerciseId||null,name:e.name,timed:!!e.timed,
    sets:(e.sets||[]).map(s=>Object.assign({planReps:s.reps,planKg:s.kg,reps:s.reps,kg:s.kg,rpe:null,done:false},s.warmup?{warmup:true}:{}))}))};
}
/* Unberührt = noch nichts eingetragen: kein Satz erledigt, übersprungen oder ergänzt, keine Werte geändert, nicht abgeschlossen.
   Eine unberührte Einheit folgt dem Plan des Tages; sobald etwas eingetragen ist, bleibt das Protokoll bestehen. */
function isPristine(w){
  if(!w||w.status==='done'||w.status==='skipped'||w.finishedAt)return false;
  const num=v=>v==null||v===''?null:toNum(v),same=(a,b)=>num(a)===num(b);
  return (w.exercises||[]).every(ex=>(ex.sets||[]).every(s=>!s.done&&!s.extra&&!s.removed&&s.rpe==null&&same(s.planReps,s.reps)&&same(s.planKg,s.kg)));
}
/* Fingerabdruck dessen, was eine Einheit vom Plan übernommen hat (Name, Übungen, geplante Sätze ohne Zusatzsätze) */
function wSig(w){
  /* Die Reihenfolge der Übungen zählt nicht: sie lässt sich im Training spontan ändern, ohne dass die Einheit vom Plan „abweicht“ */
  return JSON.stringify([w.planName||'',(w.exercises||[]).map(e=>JSON.stringify([e.exerciseId||e.name,!!e.timed,
    (e.sets||[]).filter(s=>!s.extra).map(s=>[toNum(s.planReps!=null?s.planReps:s.reps),toNum(s.planKg!=null?s.planKg:s.kg),!!s.warmup])])).sort()]);
}
const planWorkout=pd=>pd&&pd.kind!=='rest'?virtualWorkout(pd):null;
function sessionFor(date){
  const d=S.days[date],w=d&&d.workout,pd=planFor(date),pw=planWorkout(pd);
  if(w&&(!isPristine(w)||(pw&&wSig(w)===wSig(pw))))return {w,logged:true,rest:false,none:false};
  if(!pd)return {w:null,logged:false,rest:false,none:true};
  if(!pw)return {w:null,logged:false,rest:true,none:false};
  return {w:pw,logged:false,rest:false,none:false};
}
/* Weicht eine begonnene Einheit vom Plan ab, wird das gemeldet (abgeschlossene Einheiten sind Verlauf und bleiben still) */
function planMismatch(date){
  const d=S.days[date],w=d&&d.workout;
  if(!w||isPristine(w)||w.status==='done'||w.status==='skipped')return null;
  const pd=planFor(date),pw=planWorkout(pd);
  if(!pd)return {kind:'none',txt:'Im Plan ist für diesen Tag nichts eingetragen.'};
  if(!pw)return {kind:'rest',txt:'Im Plan steht für diesen Tag jetzt Ruhetag.'};
  if(wSig(w)!==wSig(pw))return {kind:'changed',txt:'Der Plan für diesen Tag wurde geändert, jetzt „'+(pd.name||'Training')+'“.'};
  return null;
}
function ensureWorkout(date){
  const d=dayRef(date),pd=planFor(date),pw=planWorkout(pd);
  if(!d.workout||(isPristine(d.workout)&&pw&&wSig(d.workout)!==wSig(pw))){
    const st=d.workout&&d.workout.startedAt;
    d.workout=pw||virtualWorkout({name:'Training',exercises:[]});
    if(st)d.workout.startedAt=st;
  }
  return d.workout;
}
function workoutStats(w){
  let vol=0,done=0,total=0;
  (w&&w.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{
    if(s.removed||s.warmup)return;
    total++;
    if(s.done){done++;if(!ex.timed)vol+=(toNum(s.kg)||0)*(toNum(s.reps)||0);}
  }));
  return {vol,done,total};
}
function dayInfo(date){
  const d=S.days[date],pd=planFor(date),w=d&&d.workout,live=!!w&&!isPristine(w);
  const rest=!live&&!!pd&&pd.kind==='rest';
  return {date,key:dowKey(date),name:rest?'Ruhetag':((live&&w.planName)||(pd&&pd.name)||''),rest,planned:!!pd,done:!!(w&&w.status==='done'),skipped:!!(w&&w.status==='skipped')};
}
