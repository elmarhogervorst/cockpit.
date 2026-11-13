'use strict';
/* Reiter Training, Unterreiter Heute: Einheit, Zeit, Check-in, Überspringen */
/* ---------- Training: Rahmen ---------- */
VIEWS.training=function(){
  const sub=UI.trainTab;
  const kick=sub==='plan'?'Trainingswoche planen':sub==='library'?'Deine Übungsbibliothek · '+S.exercises.length+(S.exercises.length===1?' Übung':' Übungen'):esc(longDate(TODAY()));
  const ttl=sub==='plan'?'Plan':sub==='library'?'Übungen':'Einheiten';
  const seg='<div class="seg" role="group" aria-label="Ansicht">'+[['today','Einheiten'],['plan','Plan'],['library','Übungen']]
    .map(([k,l])=>'<button type="button" data-act="train-sub" data-k="'+k+'" aria-pressed="'+(sub===k)+'">'+l+'</button>').join('')+'</div>';
  return '<div class="pagehead"><div class="kicker">'+kick+'</div><h1 class="title">'+ttl+'</h1>'+seg+'</div>'
    +(sub==='plan'?planView():sub==='library'?libView():todayView());
};
ACT['train-sub']=t=>{
  /* gewählten Tag mitnehmen: Einheiten und Plan teilen sich den Tag */
  const from=UI.trainTab;
  if(from==='today'||from==='plan'){
    const d=from==='plan'?planDateNow():(UI.trainDate||TODAY());
    if(weekStart(d)===viewWeek()){
      UI.trainDate=d===TODAY()?null:d;
      if(d!==planDateNow())switchPlanDate(d);
    }
  }
  UI.trainTab=t.dataset.k;
  try{localStorage.setItem('cockpit.trainTab',UI.trainTab);}catch(e){}
  render();
};

/* ---------- Training: Heute ---------- */
const inputNum=v=>v==null?'':String(v).replace('.',',');
const RATE=[1,2,3,4,5];
function wk(date){return ensureWorkout(date);}
/* Bezugsgewicht für Aufwärmsätze: erster nicht übersprungener Arbeitssatz */
function refKg(ex){
  const s=ex.sets.find(x=>!x.warmup&&!x.removed);
  if(!s)return null;
  const k=toNum(s.kg),p=toNum(s.planKg);
  return k>0?k:p>0?p:null;
}
function awPct(ex,s){
  const ref=refKg(ex),kg=toNum(s.kg);
  return ref>0&&kg>0?Math.round(kg/ref*100)+' %':'AW';
}
function setRowHtml(ex,s,i,j,ro){
  const warm=!!s.warmup,num=workNo(ex.sets,j),nm=warm?'Aufwärmsatz '+(j+1):'Satz '+num;
  const pk=s.planKg!=null?s.planKg:s.kg,pr=s.planReps!=null?s.planReps:s.reps;
  const ptxt=s.extra?'Extra':ex.timed?f1(pr)+' s':(pk!=null&&pk>0?f1(pk):'–')+' × '+f1(pr);
  const lab='<span class="sn'+(warm?' aw':'')+'">'+(warm?'AW':num)+'</span><span class="pl">'+esc(ptxt)+'</span>';
  if(s.removed){
    return '<div class="setrow skipped">'+lab+'<span class="skiptxt">Übersprungen</span>'
      +(ro?'':'<button type="button" class="btn sm rst" data-act="set-restore" data-i="'+i+'" data-j="'+j+'" aria-label="'+nm+' wiederherstellen">Zurück</button>')+'</div>';
  }
  const inp=(f,val,lbl)=>'<input class="field" inputmode="decimal" data-bind="set" data-f="'+f+'" data-i="'+i+'" data-j="'+j+'"'+(ro?' readonly tabindex="-1"':'')+' value="'+esc(inputNum(val))+'" placeholder="–" aria-label="'+lbl+' '+nm+'">';
  const rpe=warm
    ?'<span class="awp" data-aw="'+i+':'+j+'" title="Anteil am Arbeitsgewicht">'+awPct(ex,s)+'</span>'
    :inp('rpe',s.rpe,'RPE');
  return '<div class="setrow'+(warm?' warm':'')+(s.done?' done':'')+(ro?' ro':'')+'">'+lab
    +inp('kg',s.kg,'Gewicht')+inp('reps',s.reps,ex.timed?'Sekunden':'Wiederholungen')+rpe
    +'<button type="button" class="chk" data-act="set-done" data-i="'+i+'" data-j="'+j+'" aria-pressed="'+(!!s.done)+'" aria-label="'+nm+' fertig"'+(ro?' disabled':'')+'>'+I.check+'</button>'
    +(ro?'<span></span>':'<button type="button" class="iconb rm" data-act="set-rm" data-i="'+i+'" data-j="'+j+'" aria-label="'+nm+' entfernen" title="Satz entfernen">'+I.close+'</button>')+'</div>';
}
/* Ist das Training schon abgeschlossen, bleiben die gespeicherten Summen im Takt mit den Sätzen */
function syncDone(w){
  if(!w||w.status!=='done')return;
  const st=workoutStats(w);
  w.volume=Math.round(st.vol);w.setsDone=st.done;w.setsTotal=st.total;
}
function todayView(){
  const real=TODAY(),date=UI.trainDate||real,ws=viewWeek();
  const chips=DOW.map((k,i)=>{
    const d=addDays(ws,i),inf=dayInfo(d),isT=d===real;
    const none=!inf.rest&&!inf.name;
    const lab=inf.rest?'Ruhetag':(inf.name||'Kein Eintrag');
    /* Status eines Trainingstags: fertig, übersprungen, nicht fertig (vergangen) oder offen/geplant */
    const stt=none||inf.rest?null:inf.done?['done','Fertig',I.check]:inf.skipped?['skip','Übersprungen',I.close]:d<real?['miss','Nicht fertig','']:[ 'open',isT?'Offen':'Geplant',''];
    const ic=stt?'<span class="dcic '+stt[0]+'" aria-hidden="true">'+stt[2]+'</span>':'';
    return '<button type="button" class="dc'+(isT?' today':'')+(none?' none':'')+(stt?' st-'+stt[0]:'')+'" data-act="train-day" data-d="'+d+'" aria-pressed="'+(d===date)+'"><span class="kicker">'+DOW_LONG[k]+' '+dayNum(d)+'</span><b>'+esc(lab)+'</b>'
      +(stt?'<span class="dcs">'+ic+'<span>'+stt[1]+'</span></span>':'<span class="dcs" aria-hidden="true">&nbsp;</span>')+'</button>';
  }).join('');
  const si=sessionFor(date);
  let left='';
  if(si.none||si.rest){
    left='<section class="card"><div class="h3" style="margin-bottom:8px">'+(si.rest?'Ruhetag':'Kein Eintrag')+'</div><p style="color:var(--ink-2);margin-bottom:'+(si.rest?'0':'16px')+'">'
      +(si.rest?'Für diesen Tag ist kein Training geplant.':'Für diesen Tag ist nichts eingetragen. Lege im Plan fest, was an diesem Tag ansteht.')
      +'</p>'+(si.rest?'':'<button type="button" class="btn" data-act="go-plan">Plan öffnen</button>')+'</section>';
  }else{
    const w=si.w,st=workoutStats(w),fin=w.status==='done',skp=w.status==='skipped',lock=fin||skp;
    let oe=UI.openEx[date];
    if(!oe){oe={};if(!lock){const idx=w.exercises.findIndex(ex=>ex.sets.some(s=>!s.done&&!s.warmup&&!s.removed));oe[idx>=0?idx:0]=true;}UI.openEx[date]=oe;}
    const anyOpen=w.exercises.some((ex,i)=>oe[i]);
    const dur=fin&&w.startedAt&&w.finishedAt?fmtDur(new Date(w.finishedAt)-new Date(w.startedAt)):'';
    const head='<div class="sess'+(lock?' done':'')+(skp?' skipped':'')+'" id="sess"><div><div class="kicker">'+(date===real?'Heutiges Training':'Training am '+esc(shortDate(date)))+(!si.logged&&date<real?' · nicht protokolliert':'')+(date>real?' · geplant':'')
      +'</div><div class="sname">'+esc(w.planName||'Training')+(fin?'<span class="sess-ok">'+I.check+'Abgeschlossen</span>':skp?'<span class="sess-ok">'+I.close+'Nicht abgeschlossen</span>':'')+'</div></div>'
      +'<div class="stats"><div><div class="kicker">Volumen</div><div class="sv" id="st-vol">'+f0(st.vol)+'<small>kg</small></div></div>'
      +'<div><div class="kicker">Sätze</div><div class="sv" id="st-sets">'+st.done+'<small>/ '+st.total+'</small></div></div>'
      +(dur?'<div class="st-dur"><div class="kicker">Dauer</div><div class="sv sv-dur">'+esc(dur)+'</div></div>':'')
      +sessToggleHtml(anyOpen)+'</div></div>';
    const cards=w.exercises.map((ex,i)=>{
      const open=!!oe[i];
      /* Plan = nur die ursprünglich geplanten Sätze (ohne Zusatzsätze vom Tag) */
      const psets=ex.sets.filter(s=>!s.extra).map(s=>({reps:s.planReps!=null?s.planReps:s.reps,kg:s.planKg!=null?s.planKg:s.kg,warmup:!!s.warmup}));
      const work=ex.sets.filter(s=>!s.warmup&&!s.removed),done=work.filter(s=>s.done).length;
      /* Abgeschlossen: das Ergebnis zählt (Sätze und bester Satz). Sonst der Plan, zugeklappt mit Fortschritt. */
      const kOpen=fin?exResult(ex):'Plan '+exSummary({sets:psets,timed:ex.timed});
      const kClosed=fin?kOpen:kOpen+(done?' · '+done+'/'+work.length+' fertig':'');
      const rows=ex.sets.map((s,j)=>setRowHtml(ex,s,i,j,lock)).join('');
      const anyWarm=ex.sets.some(s=>s.warmup&&!s.removed);
      const grip=lock||w.exercises.length<2?'':'<button type="button" class="exdrag" data-drag="'+i+'" aria-label="'+esc(ex.name)+' verschieben" title="Zum Verschieben ziehen (oder Pfeil hoch/runter)">'+I.grip+'</button>';
      return '<article class="exc'+(open?' open':'')+(grip?' sortable':'')+'" data-i="'+i+'"><div class="exhw">'+grip+'<button type="button" class="exh" data-act="ex-toggle" data-i="'+i+'" aria-expanded="'+open+'">'
        +'<span><span class="h3">'+esc(ex.name)+'</span><span class="kicker" data-ko="'+esc(kOpen)+'" data-kc="'+esc(kClosed)+'">'+esc(open?kOpen:kClosed)+'</span></span>'
        +'<span class="open-l"><span class="t-o">Öffnen</span><span class="t-c">Schließen</span></span></button></div>'
        +'<div class="exfold"><div class="exin"'+(open?'':' inert')+'><div class="exbody"><div class="sethead"><span>Satz</span><span class="c-plan">Plan</span><span>kg</span><span>'+(ex.timed?'Sek':'Wdh')+'</span><span>RPE</span><span>Fertig</span><span></span></div>'+rows
        +(lock?'':'<div class="addset" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="set-add" data-i="'+i+'">+ Satz hinzufügen</button>'
        +'<button type="button" class="btn sm" data-act="warm-add" data-i="'+i+'">+ Aufwärmsatz</button></div>')
        +(anyWarm?'<p class="awnote">AW = Aufwärmsatz. Statt RPE steht der Anteil am Arbeitsgewicht. Aufwärmsätze zählen nicht zu Volumen und Sätzen.</p>':'')+'</div></div></div></article>';
    }).join('');
    const mm=si.logged?planMismatch(date):null;
    const note=mm?'<section class="card syncnote"><div><b>Plan und Einheit weichen ab.</b> '+esc(mm.txt)+' Hier sind schon Sätze eingetragen, deshalb bleibt die Einheit unverändert.</div>'
      +'<button type="button" class="btn sm" data-act="plan-adopt">'+(mm.kind==='changed'?'Plan übernehmen':'Einheit verwerfen')+'</button></section>':'';
    left=note+head+(cards?'<div class="stack" id="exc-list">'+cards+'</div>':'<section class="card"><div class="empty"><b>Keine Übungen im Plan</b>Füge im Plan Übungen für diesen Tag hinzu.</div></section>');
  }
  const right=(si.none||si.rest||!si.w)?'':'<div class="stack">'+(date<=real&&si.w.status!=='skipped'?timerHtml(date,si.w):'')+checkinHtml(date,true)+'</div>';
  return weekNavHtml()+'<div class="daychips" role="group" aria-label="Wochentage">'+chips+'</div>'
    +'<div class="grid2"><div class="stack">'+left+'</div>'+right+'</div>';
}
/* ---------- Trainingszeit (workout.startedAt / finishedAt als ISO) ----------
   Ablauf: zuerst nur „Start“. Läuft die Zeit, stehen „Stopp“ und die verstrichene Zeit da. Nach „Stopp“ stehen Start, Ende und
   Dauer fest da; erst dann erscheint „Falsch eingetragen? …“ mit „Korrigieren“ (Start und Ende bearbeiten, dann bestätigen).
   Für Tage in der Vergangenheit gibt es keinen Start-Knopf: dort trägt man die Zeiten über „Zeiten eintragen“ ein. */
function timerHtml(date,w){
  const st=w&&w.startedAt,en=w&&w.finishedAt,isToday=date===TODAY(),run=isToday&&!!st&&!en,edit=UI.tmEdit===date&&UI.tmDraft;
  const kick='<div class="kicker">Trainingszeit</div>';
  const vals='<div class="tm-vals"><div><div class="tm-k">Start</div><div class="tm-v">'+(st?esc(hmOf(st))+'<small> Uhr</small>':'–')+'</div></div>'
    +'<div><div class="tm-k">Ende</div><div class="tm-v">'+(en?esc(hmOf(en))+'<small> Uhr</small>':'–')+'</div></div>'
    +'<div><div class="tm-k">Dauer</div><div class="tm-v">'+(st&&en?esc(fmtDur(new Date(en)-new Date(st))):'–')+'</div></div></div>';
  /* Abgeschlossenes Training: Zeiten stehen fest, ändern geht nur über „Abschluss zurücknehmen“ */
  if(w&&w.status==='done')return '<section class="card tm" id="tm-card" data-state="locked">'+kick+vals+'</section>';
  if(edit){
    const d=UI.tmDraft;
    return '<section class="card tm" id="tm-card" data-state="edit"><form data-form="tm" novalidate>'+kick
      +'<div class="tm-times"><div><label class="lbl" for="tm-start">Start</label><input class="field" type="time" id="tm-start" data-live="tmf" data-k="s" aria-required="true" value="'+esc(d.s)+'"></div>'
      +'<div><label class="lbl" for="tm-end">Ende</label><input class="field" type="time" id="tm-end" data-live="tmf" data-k="e" aria-required="true" value="'+esc(d.e)+'"></div></div>'
      +'<div class="act-btns"><button type="submit" class="btn pri sm">Bestätigen</button><button type="button" class="btn sm" data-act="tm-cancel">Abbrechen</button>'
      +(st||en?'<button type="button" class="linkb" data-act="tm-reset">Zeiten löschen</button>':'')+'</div></form></section>';
  }
  if(run){
    return '<section class="card tm" id="tm-card" data-state="run"><div class="tm-top"><div>'+kick
      +'<div class="tm-dur" id="tm-dur" data-run="'+esc(st)+'" role="timer" aria-label="Verstrichene Trainingszeit">'+esc(fmtDurS(Date.now()-Date.parse(st)))+'</div></div>'
      +'<button type="button" class="btn pri" data-act="tm-stop">Stopp</button></div></section>';
  }
  if(!st&&!en){
    return '<section class="card tm" id="tm-card" data-state="idle"><div class="tm-top"><div>'+kick
      +(isToday?'':'<div class="tm-cap">Für diesen Tag ist noch keine Zeit eingetragen.</div>')+'</div>'
      +(isToday?'<button type="button" class="btn pri" data-act="tm-start">Start</button>':'<button type="button" class="btn sm" data-act="tm-edit">Zeiten eintragen</button>')+'</div></section>';
  }
  return '<section class="card tm" id="tm-card" data-state="done">'+kick+vals
    +'<div class="tm-fix"><p class="tm-hint">Falsch eingetragen? Korrigiere Start und Ende hier.</p><button type="button" class="btn sm" data-act="tm-edit">Korrigieren</button></div></section>';
}
const trainDateNow=()=>UI.trainDate||TODAY();
ACT['tm-start']=()=>{
  const date=trainDateNow();if(date!==TODAY())return;
  const w=ensureWorkout(date);
  w.startedAt=new Date().toISOString();w.finishedAt=null;
  saveDay(date,{workout:w});render();
};
ACT['tm-stop']=()=>{
  const date=trainDateNow(),w=ensureWorkout(date);
  if(!w.startedAt)return;
  w.finishedAt=new Date().toISOString();
  saveDay(date,{workout:w});render();toast('Zeit gestoppt: '+fmtDur(new Date(w.finishedAt)-new Date(w.startedAt)));
};
ACT['tm-edit']=()=>{
  const date=trainDateNow(),d=S.days[date],w=d&&d.workout;
  UI.tmEdit=date;UI.tmDraft={s:hmOf(w&&w.startedAt),e:hmOf(w&&w.finishedAt)};
  render();focusId('tm-start');
};
ACT['tm-cancel']=()=>{UI.tmEdit=null;UI.tmDraft=null;render();};
ACT['tm-reset']=()=>{
  const date=trainDateNow(),w=ensureWorkout(date);
  w.startedAt=null;w.finishedAt=null;
  UI.tmEdit=null;UI.tmDraft=null;
  saveDay(date,{workout:w});render();toast('Zeiten gelöscht');
};
BIND.tmf=t=>{if(UI.tmDraft)UI.tmDraft[t.dataset.k]=t.value;};
$('#view').addEventListener('submit',e=>{
  if(!e.target.dataset||e.target.dataset.form!=='tm')return;
  e.preventDefault();
  const date=trainDateNow(),dr=UI.tmDraft;if(!dr)return;
  if(!validHm(dr.s)){toast('Gib die Startzeit an');focusId('tm-start');return;}
  if(!validHm(dr.e)){toast('Gib die Endzeit an');focusId('tm-end');return;}
  if(dr.s===dr.e){toast('Start und Ende sind gleich');focusId('tm-end');return;}
  const w=ensureWorkout(date),s=isoAt(date,dr.s),en=isoAt(date,dr.e,s);
  if(new Date(en)-new Date(s)>12*3600000){toast('Das wären mehr als 12 Stunden. Prüfe Start und Ende.');focusId('tm-end');return;}
  w.startedAt=s;w.finishedAt=en;
  UI.tmEdit=null;UI.tmDraft=null;
  saveDay(date,{workout:w});render();toast('Zeiten gespeichert: '+fmtDur(new Date(en)-new Date(s)));
});
/* Läuft die Zeit, zählt die Anzeige jede Sekunde mit */
setInterval(()=>{const e=document.getElementById('tm-dur');if(e&&e.dataset.run)e.textContent=fmtDurS(Date.now()-Date.parse(e.dataset.run));},1000);
/* Begonnene Einheit verwerfen: danach folgt der Tag wieder dem Plan (oder zeigt Ruhetag / Kein Eintrag) */
ACT['plan-adopt']=async()=>{
  const date=UI.trainDate||TODAY(),d=S.days[date],w=d&&d.workout,mm=planMismatch(date);
  if(!w||!mm)return;
  const ok=await askConfirm({
    title:'Eingetragene Sätze verwerfen?',
    text:mm.kind==='changed'?'Die Einheit wird neu aus dem Plan aufgebaut. Alles, was du an diesem Tag schon eingetragen hast, geht verloren.':'Die Einheit dieses Tages wird gelöscht. Alles, was du schon eingetragen hast, geht verloren.',
    list:w.exercises.map(ex=>{const work=ex.sets.filter(x=>!x.warmup&&!x.removed);return [ex.name,work.filter(x=>x.done).length+' von '+work.length+' Sätzen erledigt'];}),
    ok:mm.kind==='changed'?'Plan übernehmen':'Verwerfen'
  });
  if(!ok)return;
  dayRef(date).workout=null;
  saveDay(date,{workout:null});
  delete UI.openEx[date];
  render();toast(mm.kind==='changed'?'Einheit folgt jetzt dem Plan':'Einheit verworfen');
};
ACT['train-day']=t=>{UI.trainDate=t.dataset.d===TODAY()?null:t.dataset.d;render();};
/* Eine Übung auf- oder zuklappen, ohne neu zu zeichnen (die CSS-Übergänge laufen). Beschriftungen ziehen mit. */
function setExState(card,open){
  if(!card)return;
  card.classList.toggle('open',open);
  const h=card.querySelector('.exh');if(h)h.setAttribute('aria-expanded',String(open));
  const n=card.querySelector('.exin');if(n)n.toggleAttribute('inert',!open);
  const k=card.querySelector('.exh .kicker');if(k)k.textContent=open?k.dataset.ko:k.dataset.kc;
}
/* Schaltfläche im Kopf: „Schließen“ solange eine Übung offen ist (alle offenen klappen zu, die Karten bleiben sichtbar), sonst „Öffnen“ */
function sessToggleHtml(anyOpen){
  return '<button type="button" class="sess-tg" id="tb-toggle" data-act="tb-toggle" data-mode="'+(anyOpen?'close':'open')+'"><span class="ico">'+I.chev+'</span><span class="t-open">Öffnen</span><span class="t-close">Schließen</span></button>';
}
function syncSessToggle(date){
  const w=(sessionFor(date)||{}).w,oe=UI.openEx[date]||{},b=$('#tb-toggle');
  if(b&&w)b.dataset.mode=w.exercises.some((ex,i)=>oe[i])?'close':'open';
}
ACT['tb-toggle']=()=>{
  const date=UI.trainDate||TODAY(),w=(sessionFor(date)||{}).w;if(!w)return;
  const oe=UI.openEx[date]||(UI.openEx[date]={}),any=w.exercises.some((ex,i)=>oe[i]);
  UI.animUntil=Date.now()+650;
  w.exercises.forEach((ex,i)=>{oe[i]=!any;});
  $$('.exc').forEach(c=>setExState(c,!any));
  syncSessToggle(date);
};
ACT['ex-toggle']=t=>{
  const date=UI.trainDate||TODAY(),oe=UI.openEx[date]||(UI.openEx[date]={}),i=+t.dataset.i;
  oe[i]=!oe[i];
  UI.animUntil=Date.now()+650;
  setExState(t.closest('.exc'),oe[i]);
  syncSessToggle(date);
};
/* Ergebnis einer Übung für die zugeklappte Karte eines abgeschlossenen Trainings: Sätze und bester Satz */
function exResult(ex){
  const work=ex.sets.filter(s=>!s.warmup&&!s.removed),done=work.filter(s=>s.done);
  if(!work.length)return 'Keine Sätze';
  if(!done.length)return 'Nicht gemacht';
  const top=done.slice().sort((a,b)=>(toNum(b.kg)||0)-(toNum(a.kg)||0)||(toNum(b.reps)||0)-(toNum(a.reps)||0))[0];
  const kg=toNum(top.kg),reps=toNum(top.reps);
  return done.length+'/'+work.length+' Sätze · '+(kg>0?f1(kg)+' kg × ':'')+(reps!=null?f1(reps)+(ex.timed?' s':''):'–');
}
function refreshStats(date){
  const w=S.days[date]&&S.days[date].workout;if(!w)return;
  const st=workoutStats(w),v=$('#st-vol'),s=$('#st-sets');
  if(v)v.innerHTML=f0(st.vol)+'<small>kg</small>';
  if(s)s.innerHTML=st.done+'<small>/ '+st.total+'</small>';
  return st;
}
/* Abgeschlossenes Training ist schreibgeschützt (erst „Abschluss zurücknehmen“ macht es wieder änderbar) */
const wLocked=date=>{const d=S.days[date],w=d&&d.workout;return !!w&&(w.status==='done'||w.status==='skipped');};
BIND.set=(t)=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),s=w.exercises[+t.dataset.i]&&w.exercises[+t.dataset.i].sets[+t.dataset.j];
  if(!s)return;
  let v=toNum(t.value);
  if(t.dataset.f==='rpe'&&v!=null)v=Math.min(10,Math.max(1,v));
  if(v!=null&&v<0)v=0;
  s[t.dataset.f]=v;
  t.value=inputNum(v);
  syncDone(w);
  saveDayLater(date,'workout',400);
  refreshStats(date);
  if(t.dataset.f==='kg')refreshWarm(+t.dataset.i,w.exercises[+t.dataset.i]);
};
/* Anteil am Arbeitsgewicht der Aufwärmzeilen live nachziehen */
function refreshWarm(i,ex){
  document.querySelectorAll('[data-aw^="'+i+':"]').forEach(el=>{
    const s=ex.sets[+el.dataset.aw.split(':')[1]];
    if(s)el.textContent=awPct(ex,s);
  });
}
ACT['set-done']=t=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),s=w.exercises[+t.dataset.i].sets[+t.dataset.j];
  s.done=!s.done;
  const row=t.closest('.setrow');
  if(row)row.classList.toggle('done',s.done);
  t.setAttribute('aria-pressed',String(s.done));
  syncDone(w);
  saveDayLater(date,'workout',300);
  const st=refreshStats(date);
  if(s.done&&!s.warmup&&st&&st.total>0&&st.done===st.total)toast('Alle Sätze erledigt. Stoppe die Zeit und schließe das Training ab.');
};
/* Zusatzsatz: ohne Plan-Werte und mit extra:true markiert, damit die Auswertung ihn vom Plan unterscheiden kann */
ACT['set-add']=t=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),ex=w.exercises[+t.dataset.i];
  const work=ex.sets.filter(s=>!s.warmup),live=work.filter(s=>!s.removed),last=live[live.length-1]||work[work.length-1]||{};
  ex.sets.push({planReps:null,planKg:null,reps:last.reps!=null?last.reps:null,kg:last.kg!=null?last.kg:null,rpe:null,done:false,extra:true});
  syncDone(w);saveDayLater(date,'workout',200);render();
};
/* Aufwärmsatz: kommt hinter die vorhandenen Aufwärmsätze, Vorschlag 50 / 70 / 85 % des Arbeitsgewichts */
ACT['warm-add']=t=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),ex=w.exercises[+t.dataset.i];
  const k=leadWarm(ex.sets),n=ex.sets.slice(0,k).filter(s=>!s.removed).length,d=warmDefaults(ex.timed,refKg(ex),n);
  ex.sets.splice(k,0,{planReps:null,planKg:null,reps:d.reps,kg:d.kg,rpe:null,done:false,warmup:true,extra:true});
  saveDayLater(date,'workout',200);render();
};
/* Entfernen: Zusatzsätze verschwinden ganz, geplante Sätze bleiben als „übersprungen“ erhalten (removed:true) */
ACT['set-rm']=t=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),ex=w.exercises[+t.dataset.i],j=+t.dataset.j,s=ex.sets[j];
  if(!s)return;
  if(s.extra)ex.sets.splice(j,1);
  else{s.removed=true;s.done=false;}
  syncDone(w);saveDayLater(date,'workout',200);render();
  if(!s.extra)toast('Satz übersprungen. Mit „Zurück“ holst du ihn wieder.');
};
ACT['set-restore']=t=>{
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const w=wk(date),s=w.exercises[+t.dataset.i].sets[+t.dataset.j];
  if(!s)return;
  delete s.removed;
  syncDone(w);saveDayLater(date,'workout',200);render();
};

/* ---------- Reihenfolge der Übungen (nur für diese Einheit, nicht im Plan) ----------
   Am Griff ziehen: solange gezogen wird, klappen alle Übungen zu, damit die Blöcke gleich hoch sind. Mit Pfeil hoch/runter geht es
   auch per Tastatur. Danach steht die neue Reihenfolge in workout.exercises. */
function moveExercise(date,from,to){
  if(wLocked(date)||from===to)return false;
  const w=wk(date);
  if(from<0||to<0||from>=w.exercises.length||to>=w.exercises.length)return false;
  const oe=UI.openEx[date]||{},open=w.exercises.map((x,i)=>!!oe[i]);
  w.exercises.splice(to,0,w.exercises.splice(from,1)[0]);
  open.splice(to,0,open.splice(from,1)[0]);
  UI.openEx[date]=open.reduce((o,v,i)=>{o[i]=v;return o;},{});
  saveDay(date,{workout:w});
  return true;
}
$('#view').addEventListener('keydown',e=>{
  const h=e.target.closest&&e.target.closest('.exdrag');
  if(!h||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;
  e.preventDefault();
  const date=UI.trainDate||TODAY(),i=+h.dataset.drag,to=i+(e.key==='ArrowUp'?-1:1);
  if(moveExercise(date,i,to)){
    const sel='.exdrag[data-drag="'+to+'"]';
    keepFocus(sel);render();
    /* ein Neuzeichnen durch die Synchronisierung darf den Fokus nicht verschlucken */
    [150,500].forEach(ms=>setTimeout(()=>{const a=document.activeElement;if(UI.tab==='training'&&!(a&&a.matches&&a.matches(sel))&&(!a||a===document.body||a.closest('#view'))){const n=$(sel);if(n)n.focus({preventScroll:true});}},ms));
  }
});
$('#view').addEventListener('pointerdown',e=>{
  const h=e.target.closest&&e.target.closest('.exdrag');
  if(!h||(e.pointerType==='mouse'&&e.button!==0))return;
  const date=UI.trainDate||TODAY();if(wLocked(date))return;
  const card=h.closest('.exc'),list=$('#exc-list');if(!card||!list)return;
  e.preventDefault();
  const from=+card.dataset.i,pid=e.pointerId;
  UI.animUntil=Date.now()+120000;
  list.classList.add('sorting');card.classList.add('lift');
  let last=e.clientY;
  const mid=el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;};
  const place=()=>{
    let n=card.nextElementSibling;
    while(n&&last>mid(n)){card.before(n);n=card.nextElementSibling;}
    let p=card.previousElementSibling;
    while(p&&last<mid(p)){card.after(p);p=card.previousElementSibling;}
  };
  const move=ev=>{
    if(ev.pointerId!==pid)return;
    last=ev.clientY;
    if(last<70)window.scrollBy(0,-14);else if(last>innerHeight-70)window.scrollBy(0,14);
    place();
  };
  const end=ev=>{
    if(ev.pointerId!==pid)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
    const order=[...list.querySelectorAll('.exc')].map(c=>+c.dataset.i),to=order.indexOf(from);
    UI.animUntil=0;
    list.classList.remove('sorting');card.classList.remove('lift');
    if(moveExercise(date,from,to)){render();toast('Reihenfolge geändert');}
    else render();
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
});

/* ---------- Check-in & Abschluss ---------- */
function choiceRow(key,opts,cur,round){
  return '<div class="choices" role="group">'+opts.map(([v,l])=>'<button type="button" class="chip'+(round?' rd':'')+'" data-act="ci-set" data-k="'+key+'" data-v="'+v+'" aria-pressed="'+(cur===v)+'">'+l+'</button>').join('')+'</div>';
}
/* Datum, auf das sich Check-in-Eingaben beziehen: in der Übersicht das dort gewählte, im Training der gewählte Trainingstag */
const ciDate=()=>UI.tab==='overview'?(UI.ciDate||TODAY()):(UI.trainDate||TODAY());
/* Daily Check-in (Übersicht, jeden Tag): Wohlbefinden, Schlaf, Muskelkater, Stress, Körpergewicht, Anmerkungen (optional).
   „Bestätigen“ klappt die Karte zu einer Zusammenfassung ein (checkin.confirmedAt), „Bearbeiten“ klappt sie wieder auf. */
const SEV_LABEL={none:'keiner',light:'leicht',medium:'mittel',strong:'stark'};
const SLEEPQ={bad:'schlecht',ok:'okay',good:'gut'},STRESSQ={low:'niedrig',mid:'mittel',high:'hoch'};
function ciSummaryHtml(date){
  const d=S.days[date]||{},c=d.checkin||{};
  const sel=(Array.isArray(c.sorenessAreas)||!c.sorenessAreas)?{}:c.sorenessAreas;
  const set=SORE_AREAS.filter(a=>sel[a]),act=set.filter(a=>sel[a]!=='none');
  const sore=!set.length?'–':act.length?act.map(a=>a+' '+SEV_LABEL[sel[a]]).join(', '):'Keiner';
  const sleep=c.sleepH!=null?f1(c.sleepH)+' Std'+(c.sleepQuality?' · '+SLEEPQ[c.sleepQuality]:''):(c.sleepQuality?SLEEPQ[c.sleepQuality]:'–');
  const rows=[['Wohlbefinden',c.wellbeing?c.wellbeing+' von 5':'–'],['Schlaf',sleep],['Muskelkater',sore],['Stress',c.stress?STRESSQ[c.stress]:'–'],['Körpergewicht',d.weight!=null?f1(d.weight)+' kg':'–']];
  /* Anmerkungen (checkin.context) stehen mit ihren Zeilenumbrüchen als eigener Block unter den Werten, nur wenn etwas drinsteht */
  const ctx=c.context&&c.context.trim()?'<div class="ci-note"><dt>Anmerkungen</dt><dd>'+esc(c.context.trim())+'</dd></div>':'';
  return '<p class="ci-ok">'+I.check+'<span>Check-in bestätigt</span></p><dl class="ci-dl">'+rows.map(r=>'<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd></div>').join('')+ctx+'</dl>'
    +'<button type="button" class="btn sm" data-act="ci-edit">Bearbeiten</button>';
}
/* Tageswechsel (zurück, vor, Heute) für Karten in der Übersicht; pre = Präfix der Aktionen (ci-, act-, wt-).
   „Heute“ ist immer da (am heutigen Tag ausgegraut), damit der Wähler beim Blättern nicht springt.
   max = letzter wählbarer Tag (Standard: heute). */
function stepNavHtml(pre,date,max){
  const today=TODAY(),last=max||today,ic=n=>I[n].replace('<svg','<svg width="18" height="18"');
  return '<div class="ci-nav"><div class="datenav"><button type="button" data-act="'+pre+'-prev" aria-label="Vorheriger Tag"'+(date<=firstDate()?' disabled':'')+'>'+ic('left')+'</button>'
    +fixedLab(date===today?'Heute':shortDate(date),['Mi, 30. September','Do, 31. Oktober','Fr, 28. November'])
    +'<button type="button" data-act="'+pre+'-next" aria-label="Nächster Tag"'+(date>=last?' disabled':'')+'>'+ic('right')+'</button></div>'
    +'<button type="button" class="btn sm" data-act="'+pre+'-today"'+(date===today?' disabled':'')+'>Heute</button></div>';
}
function dailyCheckinHtml(date){
  const today=TODAY(),d=S.days[date]||{},c=d.checkin||{},done=!!c.confirmedAt;
  const rate=RATE.map(n=>[n,String(n)]);
  const sel=(Array.isArray(c.sorenessAreas)||!c.sorenessAreas)?{}:c.sorenessAreas;
  const sev=[['none','Keiner'],['light','Leicht'],['medium','Mittel'],['strong','Stark']];
  const nav=stepNavHtml('ci',date);
  const form='<div class="q"><span class="lbl">Allgemeines Wohlbefinden</span>'+choiceRow('wellbeing',rate,c.wellbeing,true)+'<div class="scale"><span>schlecht</span><span>sehr gut</span></div></div>'
    +'<div class="q"><label class="lbl" for="ci-sleep">Schlaf letzte Nacht</label><div class="row2"><div class="uw"><input class="field" id="ci-sleep" inputmode="decimal" data-bind="ci-sleep" value="'+esc(inputNum(c.sleepH))+'" placeholder="7,5"><span class="un">Std</span></div>'
      +choiceRow('sleepQuality',[['bad','Schlecht'],['ok','Okay'],['good','Gut']],c.sleepQuality)+'</div></div>'
    +'<div class="q"><span class="lbl">Muskelkater</span><div class="sore">'+SORE_AREAS.map(a=>'<div class="sorerow" role="group" aria-label="Muskelkater '+a+'"><span class="nm">'+a+'</span><div class="choices">'
        +sev.map(([v,l])=>'<button type="button" class="chip sm" data-act="sore-area" data-a="'+a+'" data-v="'+v+'" aria-pressed="'+(sel[a]===v)+'">'+l+'</button>').join('')+'</div></div>').join('')+'</div></div>'
    +'<div class="q"><span class="lbl">Stress</span>'+choiceRow('stress',[['low','Niedrig'],['mid','Mittel'],['high','Hoch']],c.stress)+'</div>'
    +'<div class="q"><label class="lbl" for="ci-weight">Körpergewicht (nüchtern, morgens)</label><div class="row2"><div class="uw"><input class="field" id="ci-weight" inputmode="decimal" data-bind="ci-weight" value="'+esc(inputNum(d.weight))+'"><span class="un">kg</span></div></div></div>'
    +'<div class="q"><label class="lbl" for="ci-ctx">Anmerkungen (optional)</label><textarea class="field" id="ci-ctx" data-live="ci-ctx" maxlength="500">'+esc(c.context||'')+'</textarea></div>'
    +'<button type="button" class="btn pri block" data-act="ci-confirm">Bestätigen</button>';
  return '<section class="card ci" id="ci-daily"'+(done?' data-done':'')+'><div class="ci-head"><div><div class="kicker">Jeden Tag</div><h2 class="h2" style="margin:4px 0 0">Daily Check-in</h2></div>'+nav+'</div>'
    +'<div class="ci-fold ci-sumfold"><div class="ci-in" id="ci-sum"'+(done?'':' inert')+'>'+ciSummaryHtml(date)+'</div></div>'
    +'<div class="ci-fold ci-formfold"><div class="ci-in" id="ci-form"'+(done?' inert':'')+'>'+form+'</div></div></section>';
}
/* Ein- und Ausklappen ohne Neuzeichnen, damit die CSS-Übergänge laufen */
function foldCi(done,date){
  const card=$('#ci-daily');
  if(!card){render();return;}
  UI.animUntil=Date.now()+650;
  if(done)$('#ci-sum').innerHTML=ciSummaryHtml(date);
  if(done)card.setAttribute('data-done','');else card.removeAttribute('data-done');
  $('#ci-form').toggleAttribute('inert',done);
  $('#ci-sum').toggleAttribute('inert',!done);
  /* Fokus auf den neuen Hauptknopf; bleibt auch nach einem späteren Neuzeichnen erhalten */
  UI.focusSel=done?'#ci-sum [data-act="ci-edit"]':'#ci-form .chip';
  const f=$(UI.focusSel);
  if(f)try{f.focus({preventScroll:true});}catch(e){}
  setTimeout(()=>{UI.focusSel=null;},1200);
}
ACT['ci-confirm']=()=>{
  const date=ciDate(),d=dayRef(date),c=ciPatch(date);
  const any=d.weight!=null||['wellbeing','sleepH','sleepQuality','stress'].some(k=>c[k]!=null)||Object.values(soreAreas(c)).some(Boolean);
  if(!any){toast('Trage mindestens einen Wert ein');return;}
  c.confirmedAt=new Date().toISOString();
  saveDay(date,{checkin:c});
  foldCi(true,date);
};
ACT['ci-edit']=()=>{
  const date=ciDate(),c=ciPatch(date);
  c.confirmedAt=null;
  saveDay(date,{checkin:c});
  foldCi(false,date);
};
ACT['ci-prev']=()=>{const n=addDays(UI.ciDate||TODAY(),-1);if(n>=firstDate()){UI.ciDate=n;render();}};
ACT['ci-next']=()=>{const n=addDays(UI.ciDate||TODAY(),1);UI.ciDate=n>=TODAY()?null:n;render();};
ACT['ci-today']=()=>{UI.ciDate=null;render();};
/* „Wie war’s heute?“ (Einheiten, nur an Trainingstagen): Gefühl im Training, Energie, Notiz, Abschluss.
   Gefühl und Energie sind Pflicht, die Notiz ist optional. Ist das Training abgeschlossen, klappt die Karte zu einer Zusammenfassung
   zusammen; ändern geht dann nur über „Abschluss zurücknehmen“. */
const tcDone=date=>{const w=S.days[date]&&S.days[date].workout;return !!(w&&w.status==='done');};
function tcSummaryHtml(date){
  const c=(S.days[date]&&S.days[date].checkin)||{};
  const rows=[['Gefühl im Training',c.feeling?c.feeling+' von 5':'–'],['Energie',c.energy?c.energy+' von 5':'–']];
  /* Die Notiz steht mit ihren Zeilenumbrüchen als eigener Block unter den Werten */
  const note=c.note&&c.note.trim()?'<div class="ci-note"><dt>Notiz</dt><dd>'+esc(c.note.trim())+'</dd></div>':'';
  return '<p class="ci-ok">'+I.check+'<span>Training abgeschlossen</span></p><dl class="ci-dl">'+rows.map(r=>'<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd></div>').join('')+note+'</dl>'
    +'<div class="act-btns"><button type="button" class="btn sm" data-act="finish">Abschluss zurücknehmen</button></div>';
}
/* ---------- Training überspringen (workout.status 'skipped', workout.skip {note, at}) ----------
   Statt „Wie war’s heute?“ steht dann „Training nicht abgeschlossen“ mit der Notiz (Pflicht): warum übersprungen und, falls
   verschoben, auf welchen Tag. Gefühl und Energie entfallen. „Überspringen zurücknehmen“ macht die Einheit wieder offen. */
const isSkipped=date=>{const w=S.days[date]&&S.days[date].workout;return !!(w&&w.status==='skipped');};
const SKIP_PH='Zum Beispiel: Erkältet, auf Samstag verschoben.';
function skipFormHtml(date){
  const dr=UI.skipDraft;
  return '<section class="card ci" id="sk-card"><form data-form="skip" novalidate><div class="kicker">Training überspringen</div>'
    +'<label class="lbl" for="sk-note" style="display:block;margin:14px 0 6px">Notiz</label>'
    +'<textarea class="field" id="sk-note" data-live="sk-note" maxlength="500" aria-required="true" placeholder="Warum übersprungen? Falls verschoben: auf welchen Tag? '+esc(SKIP_PH)+'">'+esc(dr.note)+'</textarea>'
    +'<div class="act-btns" style="margin-top:14px"><button type="submit" class="btn pri">Bestätigen</button><button type="button" class="btn" data-act="skip-cancel">Abbrechen</button></div></form></section>';
}
function skipSummaryHtml(date){
  const w=S.days[date]&&S.days[date].workout,n=w&&w.skip&&w.skip.note?String(w.skip.note).trim():'';
  return '<section class="card ci" id="sk-card"><div class="kicker">Training übersprungen</div>'
    +'<p class="ci-ok no" style="margin-top:12px">'+I.close+'<span>Training nicht abgeschlossen</span></p>'
    +'<dl class="ci-dl">'+(n?'<div class="ci-note"><dt>Notiz</dt><dd>'+esc(n)+'</dd></div>':'')+'</dl>'
    +'<div class="act-btns"><button type="button" class="btn sm" data-act="skip-edit">Notiz ändern</button><button type="button" class="btn sm" data-act="skip-undo">Überspringen zurücknehmen</button></div></section>';
}
ACT['skip-open']=()=>{const date=UI.trainDate||TODAY();UI.skipDraft={date,note:''};render();focusId('sk-note');};
ACT['skip-edit']=()=>{
  const date=UI.trainDate||TODAY(),w=S.days[date]&&S.days[date].workout;
  UI.skipDraft={date,note:(w&&w.skip&&w.skip.note)||''};render();focusId('sk-note');
};
ACT['skip-cancel']=()=>{UI.skipDraft=null;render();};
ACT['skip-undo']=()=>{
  const date=UI.trainDate||TODAY(),w=wk(date);
  if(w.status!=='skipped')return;
  w.status='open';w.skip=null;
  UI.skipDraft=null;UI.openEx[date]=undefined;delete UI.openEx[date];
  saveDay(date,{workout:w});render();toast('Überspringen zurückgenommen');
};
BIND['sk-note']=t=>{if(UI.skipDraft)UI.skipDraft.note=t.value.slice(0,500);};
$('#view').addEventListener('submit',e=>{
  if(!e.target.dataset||e.target.dataset.form!=='skip')return;
  e.preventDefault();
  const dr=UI.skipDraft;if(!dr)return;
  const date=dr.date,note=(dr.note||'').trim().slice(0,500);
  if(!note){toast('Erkläre kurz, warum du überspringst');focusId('sk-note');return;}
  const w=wk(date),was=w.status==='skipped';
  w.status='skipped';w.skip={note,at:was&&w.skip&&w.skip.at?w.skip.at:new Date().toISOString()};
  saveDay(date,{workout:w});
  UI.skipDraft=null;UI.openEx[date]={};
  render();toast(was?'Notiz gespeichert':'Training übersprungen');
});
function checkinHtml(date,canFinish){
  if(isSkipped(date)&&!(UI.skipDraft&&UI.skipDraft.date===date))return skipSummaryHtml(date);
  if(UI.skipDraft&&UI.skipDraft.date===date)return skipFormHtml(date);
  const d=S.days[date]||{},c=d.checkin||{},done=tcDone(date);
  const rate=RATE.map(n=>[n,String(n)]);
  const form='<div class="q"><span class="lbl">Gefühl im Training</span>'+choiceRow('feeling',rate,c.feeling,true)+'<div class="scale"><span>schwach</span><span>stark</span></div></div>'
    +'<div class="q"><span class="lbl">Energie</span>'+choiceRow('energy',rate,c.energy,true)+'</div>'
    +'<div class="q"><label class="lbl" for="ci-note">Notiz (optional)</label><textarea class="field" id="ci-note" data-live="ci-note" placeholder="Zum Beispiel: Schulter fühlte sich bei Satz 3 steif an.">'+esc(c.note||'')+'</textarea></div>'
    +'<button type="button" class="btn pri block" data-act="finish">Training abschließen</button>'
    +'<button type="button" class="btn block skipb" data-act="skip-open">Training überspringen</button>';
  return '<section class="card ci" id="tc-card"'+(done?' data-done':'')+'><div class="kicker">Nach dem Training</div><h2 class="h2" style="margin:4px 0 20px">Wie war’s heute?</h2>'
    +'<div class="ci-fold ci-sumfold"><div class="ci-in" id="tc-sum"'+(done?'':' inert')+'>'+tcSummaryHtml(date)+'</div></div>'
    +'<div class="ci-fold ci-formfold"><div class="ci-in" id="tc-form"'+(done?' inert':'')+'>'+form+'</div></div></section>';
}
/* Karte „Wie war’s heute?“ ohne Neuzeichnen zu- oder aufklappen (die CSS-Übergänge laufen) */
function foldTc(done,date){
  const card=$('#tc-card');
  if(!card){render();return;}
  UI.animUntil=Date.now()+650;
  if(done)$('#tc-sum').innerHTML=tcSummaryHtml(date);
  card.toggleAttribute('data-done',done);
  $('#tc-form').toggleAttribute('inert',done);
  $('#tc-sum').toggleAttribute('inert',!done);
  UI.focusSel=done?'#tc-sum [data-act="finish"]':'#tc-form .chip';
  const f=$(UI.focusSel);if(f)try{f.focus({preventScroll:true});}catch(e){}
  setTimeout(()=>{UI.focusSel=null;},1200);
}
function ciPatch(date){const d=dayRef(date);if(!d.checkin)d.checkin={};return d.checkin;}
ACT['ci-set']=t=>{
  const date=ciDate(),c=ciPatch(date),k=t.dataset.k;
  const v=['feeling','energy','wellbeing'].includes(k)?+t.dataset.v:t.dataset.v;
  c[k]=c[k]===v?null:v;
  saveDayLater(date,'checkin',300);render();
};
const SORE_AREAS=['Brust','Schultern','Bizeps','Trizeps','Rücken','Beine'];
const SEV_RANK={light:1,medium:2,strong:3};
function soreAreas(c){if(Array.isArray(c.sorenessAreas)||!c.sorenessAreas)c.sorenessAreas={};return c.sorenessAreas;}
ACT['sore-area']=t=>{
  const date=ciDate(),c=ciPatch(date),a=soreAreas(c),g=t.dataset.a,v=t.dataset.v;
  a[g]=a[g]===v?null:v;
  /* Gesamtstufe: stärkste Gruppe; "none" nur, wenn alle Gruppen auf Keiner stehen */
  let max=null,nones=0;
  SORE_AREAS.forEach(k=>{
    if(a[k]==='none')nones++;
    else if(a[k]&&(!max||SEV_RANK[a[k]]>SEV_RANK[max]))max=a[k];
  });
  c.soreness=max||(nones===SORE_AREAS.length?'none':null);
  saveDayLater(date,'checkin',300);render();
};
BIND['ci-sleep']=t=>{
  const date=ciDate(),c=ciPatch(date),v=toNum(t.value);
  c.sleepH=v!=null&&v>=0&&v<=24?v:null;t.value=inputNum(c.sleepH);
  saveDayLater(date,'checkin',300);
};
BIND['ci-note']=t=>{
  const date=ciDate(),c=ciPatch(date);
  c.note=t.value;saveDayLater(date,'checkin',800);
};
/* Anmerkungen im Daily Check-in: eigener Schlüssel checkin.context, getrennt von checkin.note (Notiz nach dem Training) */
BIND['ci-ctx']=t=>{
  const date=ciDate(),c=ciPatch(date);
  c.context=t.value.slice(0,500);saveDayLater(date,'checkin',800);
};
BIND['ci-weight']=t=>{
  const date=ciDate(),d=dayRef(date),v=toNum(t.value);
  d.weight=v!=null&&v>20&&v<400?v:null;t.value=inputNum(d.weight);
  saveDayLater(date,'weight',300);
};
ACT.finish=()=>{
  const date=UI.trainDate||TODAY();if(isSkipped(date))return;
  const w=wk(date);
  if(w.status==='done'){
    w.status='open';
    saveDay(date,{workout:w});
    toast('Abschluss zurückgenommen');
    if(!$('#tc-card')||!$('#sess')){render();return;}
    /* Rückwärts zum Abschluss: Kopf wird wieder groß, die erste offene Übung klappt auf, „Wie war’s heute?“ zeigt wieder das Formular */
    const oe=UI.openEx[date]={},idx=w.exercises.findIndex(ex=>ex.sets.some(s=>!s.done&&!s.warmup&&!s.removed));
    oe[idx>=0?idx:0]=true;
    UI.animUntil=Date.now()+900;
    $$('.exc').forEach(c=>setExState(c,!!oe[+c.dataset.i]));
    syncSessToggle(date);
    foldTc(false,date);
    const sess=$('#sess');sess.classList.remove('done');
    sess.querySelectorAll('.sess-ok').forEach(e=>{e.style.opacity='0';e.style.maxWidth='0';e.style.marginLeft='-14px';});
    sess.querySelectorAll('.st-dur').forEach(e=>{e.style.opacity='0';e.style.maxWidth='0';e.style.marginLeft='-26px';});
    setTimeout(()=>{if(UI.tab==='training'&&UI.trainTab==='today')render();},700);
    return;
  }
  const st=workoutStats(w),c=(S.days[date]&&S.days[date].checkin)||{},isToday=date===TODAY();
  if(st.done===0){toast('Hake zuerst mindestens einen Satz ab');return;}
  if(!w.startedAt||!w.finishedAt){
    toast(w.startedAt&&!w.finishedAt&&isToday?'Stoppe zuerst die Trainingszeit':isToday?'Starte und stoppe zuerst die Trainingszeit':'Trage zuerst die Trainingszeit ein');
    return;
  }
  if(!c.feeling){toast('Wähle dein Gefühl im Training');return;}
  if(!c.energy){toast('Wähle deine Energie');return;}
  w.status='done';w.volume=Math.round(st.vol);w.setsDone=st.done;w.setsTotal=st.total;
  const patch={workout:w};
  const d=S.days[date];if(d&&d.checkin)patch.checkin=d.checkin;
  if(d&&d.weight!=null)patch.weight=d.weight;
  saveDay(date,patch);
  /* Alles klappt zusammen: Übungen zu, Karte „Wie war’s heute?“ wird zur Zusammenfassung; danach sauber neu zeichnen
     (Kopf mit Dauer, Ergebnisse statt Plan, Zeit-Karte) */
  UI.openEx[date]={};
  toast('Training gespeichert');
  if(!$('#tc-card')||!$('#sess')){render();return;}
  $$('.exc').forEach(c=>setExState(c,false));
  foldTc(true,date);
  $('#sess').classList.add('done');
  UI.animUntil=Date.now()+900;
  setTimeout(()=>{if(UI.tab==='training'&&UI.trainTab==='today')render();},700);
};
