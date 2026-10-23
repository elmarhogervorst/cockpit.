'use strict';
/* Reiter Training, Unterreiter Plan */
/* ---------- Training: Plan ---------- */
const planDateNow=()=>UI.planDate||(UI.planDate=TODAY());
/* Geltungsbereich: nur dieser Tag ('week') oder wiederholt über mehrere Wochen ('repeat') */
function scopeNow(){return UI.planScope==='repeat'?'repeat':'week';}
const wksFromNow=date=>Math.round((fromIso(weekStart(date))-fromIso(curWeek()))/(7*864e5));
/* Höchstens so viele Wiederholungen, wie die Planung (12 Wochen ab der aktuellen Woche) zulässt */
const repeatMax=date=>Math.max(0,Math.min(PLAN_AHEAD_WEEKS,PLAN_AHEAD_WEEKS-wksFromNow(date)));
function repeatN(date){const m=repeatMax(date);return Math.max(m?1:0,Math.min(m,Math.round(+UI.repeatN)||1));}
/* Zieltage: der gewählte Tag plus n weitere Wochen, nur heute und Zukunft (die Vergangenheit bleibt unverändert) */
function repeatDates(date){
  const n=repeatN(date);
  return Array.from({length:n+1},(_,k)=>addDays(date,7*k)).filter(d=>d>=TODAY());
}
const planSig=p=>p.kind==='rest'?'rest':JSON.stringify([p.name||'',cleanExercises(p.exercises||[])]);
/* Zieltage (ohne den gewählten Tag selbst), an denen schon ein anderer Plan gilt */
function repeatConflicts(date,doc){
  const sig=planSig(doc);
  return repeatDates(date).filter(d=>d!==date).map(d=>({d,cur:planFor(d)})).filter(x=>x.cur&&planSig(x.cur)!==sig);
}
function draftDoc(dr,key){
  if(dr.kind==='rest')return {day:key,kind:'rest',name:'Ruhetag',source:'own',presetId:null,exercises:[]};
  const fromPreset=dr.source==='preset';
  return {day:key,kind:'training',name:(dr.name||'').trim()||'Training',source:fromPreset?'preset':'own',presetId:fromPreset?(dr.presetId||null):null,exercises:cleanExercises(dr.exercises)};
}
function planDraft(){
  if(!UI.planDraft){
    if(UI.editingPreset){
      const p=S.presets.find(x=>x.id===UI.editingPreset);
      if(p)UI.planDraft={kind:'training',name:p.name,exercises:clone(p.exercises||[])};
      else UI.editingPreset=null;
    }
    if(!UI.planDraft){
      const p=planFor(planDateNow());
      UI.planDraft=p?clone(p):{kind:'training',name:'',exercises:[]};
      UI.planBase=JSON.stringify(p||null);
      UI.planSrc='own';
    }
    UI.planDirty=false;
  }
  return UI.planDraft;
}
function switchPlanDate(date){
  if(UI.planDirty)toast('Ungespeicherte Änderungen verworfen');
  UI.editingPreset=null;UI.planDate=date;UI.planDraft=null;UI.planDirty=false;UI.planScope=null;
}
function cleanExercises(list){
  const one=s=>Object.assign({reps:toNum(s.reps)||0,kg:toNum(s.kg)},s.warmup?{warmup:true}:{});
  return list.map(e=>({exerciseId:e.exerciseId||null,name:e.name,timed:!!e.timed,
    sets:e.sets.filter(s=>s.warmup).map(one).concat(e.sets.filter(s=>!s.warmup).map(one))}));
}
function exOptions(ex){
  let found=false;
  const opts=S.exercises.map(e=>{
    const sel=ex.exerciseId?e.id===ex.exerciseId:e.name===ex.name;
    if(sel)found=true;
    return '<option value="'+esc(e.id)+'"'+(sel?' selected':'')+'>'+esc(e.name)+'</option>';
  }).join('');
  return found?opts:'<option value="__cur" selected>'+esc(ex.name)+'</option>'+opts;
}
function planView(){
  const ws=viewWeek();
  let date=planDateNow();
  if(weekStart(date)!==ws){
    UI.planDate=date=addDays(ws,DOW.indexOf(dowKey(date)));UI.planScope=null;
    if(!UI.editingPreset){UI.planDraft=null;UI.planDirty=false;}
  }
  const key=dowKey(date),dr=planDraft(),editing=!!UI.editingPreset,rest=!editing&&dr.kind==='rest',locked=!editing&&!rest&&dr.source==='preset';
  const hasEntry=!!planFor(date),missing=!editing&&!hasEntry&&!UI.planDirty;
  const scope=editing?'week':scopeNow(),nRep=repeatN(date),maxRep=repeatMax(date),ds=scope==='repeat'?repeatDates(date):[date];
  const dateTxt=DOW_LONG[key]+', '+fromIso(date).getDate()+'. '+MONTHS[fromIso(date).getMonth()];
  const chips=DOW.map((k,i)=>{
    const d=addDays(ws,i),p=planFor(d),nm=p?(p.kind==='rest'?'Ruhetag':p.name):'Kein Eintrag';
    return '<button type="button" class="dc'+(d===TODAY()?' today':'')+(p?'':' none')+'" data-act="plan-day" data-d="'+d+'" aria-pressed="'+(d===date)+'"><span class="kicker">'+DOW_LONG[k]+' '+dayNum(d)+'</span><b>'+esc(nm)+'</b></button>';
  }).join('');
  const modeBtn=(a,l,on)=>'<button type="button" data-act="'+a+'" aria-pressed="'+on+'">'+l+'</button>';
  let top;
  if(editing){
    top='<section class="pe"><div class="kicker" style="margin-bottom:10px">Vorlage bearbeiten</div><label class="lbl" for="pe-name">Name der Vorlage</label><input class="field" id="pe-name" data-live="pname" value="'+esc(dr.name)+'" placeholder="Zum Beispiel: Push Day B"></section>';
  }else{
    let hint;
    if(scope==='week')hint='Gilt nur für '+esc(dateTxt)+'.';
    else if(!ds.length)hint='Alle gewählten Tage liegen in der Vergangenheit. Dort wird nichts geändert.';
    else hint='Gilt für '+esc(shortDate(ds[0]))+' bis '+esc(shortDate(ds[ds.length-1]))+' ('+ds.length+(ds.length===1?' Woche':' Wochen')+', jeweils '+DOW_LONG[key]+'). '
      +(date<TODAY()?'Vergangene Tage bleiben unverändert. ':'')+'Vorhandene Pläne an diesen Tagen werden überschrieben, das bestätigst du beim Speichern.';
    top='<section class="pe"><div style="display:flex;flex-wrap:wrap;gap:12px 14px;align-items:flex-end">'
      +'<div style="flex:1 1 240px;min-width:0"><label class="lbl" for="pe-name">Name des Trainings am '+esc(dateTxt)+'</label><input class="field" id="pe-name" data-live="pname" value="'+esc(rest?'Ruhetag':dr.name)+'" placeholder="Zum Beispiel: Push Day A"'+(rest||locked||missing?' disabled':'')+'></div>'
      +'<div class="seg" role="group" aria-label="Art des Tages">'+modeBtn('pe-mode-preset','Vorlage',locked)+modeBtn('pe-mode-own','Eigenes Training',!rest&&!locked&&!missing)+modeBtn('pe-mode-rest','Ruhetag',rest)+'</div></div>'
      +'<div class="scope"><span class="kicker">Gilt für</span><div class="seg" role="group" aria-label="Geltungsbereich">'
        +'<button type="button" data-act="plan-scope" data-v="week" aria-pressed="'+(scope==='week')+'">Nur diese Woche</button>'
        +'<button type="button" data-act="plan-scope" data-v="repeat" aria-pressed="'+(scope==='repeat')+'"'+(maxRep<1?' disabled title="Weiter als 12 Wochen im Voraus kann nicht geplant werden"':'')+'>Wiederholen</button></div>'
        +(scope==='repeat'&&maxRep>=1?'<div class="rep"><button type="button" class="iconb" data-act="rep-dec" aria-label="Eine Wiederholung weniger"'+(nRep<=1?' disabled':'')+'>–</button>'
          +'<input class="field" id="rep-n" inputmode="numeric" data-bind="rep-n" value="'+nRep+'" aria-label="Anzahl Wiederholungen (maximal '+maxRep+')">'
          +'<button type="button" class="iconb" data-act="rep-inc" aria-label="Eine Wiederholung mehr"'+(nRep>=maxRep?' disabled':'')+'>+</button><span class="repl">mal wiederholen</span></div>':'')
        +'<p class="hint">'+hint+'</p></div>'
      +(locked?'<div class="lockbanner"><span>Aus der Vorlage „'+esc(dr.name)+'“ übernommen und gesperrt. Zum Ändern tippst du auf „Anpassen“ und bestätigst.</span><button type="button" class="btn sm" data-act="plan-unlock">Anpassen</button></div>':'')+'</section>';
  }
  let body='';
  if(missing){
    body='<section class="pe"><div class="empty"><b>Kein Eintrag</b>An diesem Tag fehlt ein Eintrag. Sobald du etwas wählst, erscheint hier der Plan.</div></section>';
  }else if(rest){
    body='<section class="pe"><div class="empty"><b>Ruhetag</b>An diesem Tag steht kein Training im Plan. Wähle „Eigenes Training“ oder eine Vorlage, um das zu ändern.</div></section>';
  }else if(locked){
    body=dr.exercises.map(ex=>'<section class="pe"><div class="h3" style="margin-bottom:4px">'+esc(ex.name)+'</div><span class="kicker">'+esc(exSummary(ex))+'</span><div style="margin-top:10px">'
      +ex.sets.map((s,j)=>'<div class="lockrow"><span>'+(s.warmup?'Aufwärmen':'Satz '+workNo(ex.sets,j))+'</span><b>'+(ex.timed?f1(s.reps)+' s':f1(s.reps)+' Wdh')+(s.kg!=null&&s.kg>0?' · '+f1(s.kg)+' kg':'')+'</b></div>').join('')
      +'</div></section>').join('');
  }else{
    body=dr.exercises.map((ex,i)=>{
      const nWork=ex.sets.filter(x=>!x.warmup).length,nWarm=ex.sets.length-nWork;
      const sets=ex.sets.map((s,j)=>{
        const nm=s.warmup?'Aufwärmsatz '+(j+1):'Satz '+workNo(ex.sets,j);
        return (s.warmup?'<span class="sn aw" title="Aufwärmsatz">AW</span>':'<span class="sn">'+workNo(ex.sets,j)+'</span>')
        +'<input class="field" inputmode="decimal" aria-label="'+(ex.timed?'Sekunden':'Wiederholungen')+' '+nm+'" data-bind="pe-set" data-f="reps" data-i="'+i+'" data-j="'+j+'" value="'+esc(inputNum(s.reps))+'">'
        +'<input class="field" inputmode="decimal" aria-label="Gewicht '+nm+'" data-bind="pe-set" data-f="kg" data-i="'+i+'" data-j="'+j+'" value="'+esc(inputNum(s.kg))+'" placeholder="–">'
        +'<button type="button" class="iconb" data-act="pe-set-rm" data-i="'+i+'" data-j="'+j+'" aria-label="'+nm+' entfernen"'+(!s.warmup&&nWork<2?' disabled':'')+'>–</button>';
      }).join('');
      return '<section class="pe"><div class="pe-h"><div class="ord"><button type="button" data-act="pe-up" data-i="'+i+'" aria-label="Nach oben"'+(i===0?' disabled':'')+'>▲</button><button type="button" data-act="pe-down" data-i="'+i+'" aria-label="Nach unten"'+(i===dr.exercises.length-1?' disabled':'')+'>▼</button></div>'
        +'<div class="gr"><span class="kicker">Übung '+(i+1)+'</span><select class="field" data-bind="pe-ex" data-i="'+i+'" aria-label="Übung '+(i+1)+'">'+exOptions(ex)+'</select></div>'
        +'<button type="button" class="iconb" data-act="pe-ex-rm" data-i="'+i+'" aria-label="Übung entfernen">'+I.close+'</button></div>'
        +'<div class="pe-sets"><span class="hd">Satz</span><span class="hd">'+(ex.timed?'Sekunden':'Wiederholungen')+'</span><span class="hd">Gewicht kg</span><span></span>'+sets+'</div>'
        +'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="pe-set-add" data-i="'+i+'">+ Satz</button>'
        +'<button type="button" class="btn sm" data-act="pe-warm-add" data-i="'+i+'">+ Aufwärmsatz</button></div>'
        +(nWarm?'<p class="awnote">AW = Aufwärmsatz. Im Training bekommt er statt RPE den Anteil am Arbeitsgewicht und zählt nicht zu Volumen und Sätzen.</p>':'')+'</section>';
    }).join('');
    body+='<button type="button" class="btn dash" data-act="pe-ex-add">+ Übung aus der Bibliothek hinzufügen</button>';
  }
  const nEx=rest||missing?0:dr.exercises.length,nSets=rest||missing?0:planSets(dr),nWarmAll=rest||missing?0:dr.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.warmup).length,0);
  const sum=missing?'':'<span class="sum" id="pe-sum">'+nEx+(nEx===1?' Übung':' Übungen')+' · '+nSets+(nSets===1?' Satz':' Sätze')+(nWarmAll?' + '+nWarmAll+' AW':'')+'</span>';
  const foot=editing
    ?'<div class="pe-foot"><button type="button" class="btn pri" data-act="preset-save">Vorlage speichern</button><button type="button" class="btn" data-act="preset-cancel">Abbrechen</button>'+sum+'</div>'
    :'<div class="pe-foot"><button type="button" class="btn pri" data-act="plan-save"'+(missing||(scope==='repeat'&&!ds.length)?' disabled':'')+'>'+(scope==='repeat'?'Plan für '+DOW_LONG[key]+' speichern ('+ds.length+(ds.length===1?' Woche':' Wochen')+')':'Plan für '+DOW_LONG[key]+' speichern')+'</button>'
      +(rest||locked||missing?'':'<button type="button" class="btn" data-act="plan-preset">Als Vorlage speichern</button>')
      +(hasEntry?(UI.confirmDel==='plan:'+date?'<button type="button" class="btn armed" data-confirm data-act="plan-del">Eintrag wirklich löschen?</button>':'<button type="button" class="btn" data-confirm data-act="plan-del">Eintrag löschen</button>'):'')+sum+'</div>';
  const presets=S.presets.map(p=>{
    const armed=UI.confirmDel==='preset:'+p.id,ed=UI.editingPreset===p.id;
    return '<div class="prow'+(ed?' editing':'')+'" data-pid="'+esc(p.id)+'"><div class="gp"><b>'+esc(p.name)+'</b><span class="kicker">'+(p.exercises||[]).length+' Übungen · '+planSets(p)+' Sätze</span></div>'
      +'<div class="pacts"><button type="button" class="btn sm" data-act="preset-apply" data-id="'+esc(p.id)+'">Hinzufügen</button>'
      +'<button type="button" class="iconb" data-act="preset-dup" data-id="'+esc(p.id)+'" aria-label="Vorlage '+esc(p.name)+' duplizieren" title="Duplizieren">'+I.copy+'</button>'
      +'<button type="button" class="iconb" data-act="preset-edit" data-id="'+esc(p.id)+'" aria-label="Vorlage '+esc(p.name)+' bearbeiten" title="Bearbeiten">'+I.edit+'</button>'
      +(armed?'<button type="button" class="iconb armed" data-confirm data-act="preset-del" data-id="'+esc(p.id)+'">Löschen?</button>':'<button type="button" class="iconb" data-confirm data-act="preset-del" data-id="'+esc(p.id)+'" aria-label="Vorlage '+esc(p.name)+' löschen" title="Löschen">'+I.trash+'</button>')+'</div></div>';
  }).join('');
  const side='<section class="card" id="presets-card"><span class="pickhint" aria-hidden="true">Hier auswählen</span><div class="kicker">Vorlagen</div><h2 class="h2" style="margin:4px 0 8px">Preset-Trainings</h2>'
    +'<p style="color:var(--ink-2);font-size:13px;margin-bottom:10px">'+(editing?'Du bearbeitest gerade eine Vorlage. Speichere oder brich links ab.':'Mit „Hinzufügen“ übernimmst du eine Vorlage für den gewählten Tag. Duplizieren und Bearbeiten über die Symbole.')+'</p>'
    +(presets||'<div class="empty"><b>Noch keine Vorlagen</b>Speichere ein Training als Vorlage.</div>')+'</section>';
  return weekNavHtml()+'<div class="daychips" role="group" aria-label="Wochentage">'+chips+'</div>'
    +'<div class="grid2"><div class="stack">'+top+body+foot+'</div><div class="stack">'+side+'</div></div>';
}
const dirty=()=>{UI.planDirty=true;};
ACT['plan-day']=t=>{switchPlanDate(t.dataset.d);render();};
ACT['plan-scope']=t=>{UI.planScope=t.dataset.v==='repeat'?'repeat':'week';render();};
ACT['rep-dec']=()=>{UI.repeatN=repeatN(planDateNow())-1;render();};
ACT['rep-inc']=()=>{UI.repeatN=repeatN(planDateNow())+1;render();};
BIND['rep-n']=t=>{UI.repeatN=Math.round(toNum(t.value))||1;render();};
ACT['plan-del']=()=>{
  const date=planDateNow(),k='plan:'+date;
  if(UI.confirmDel!==k){UI.confirmDel=k;render();return;}
  UI.confirmDel=null;
  clearPlan(date);
  UI.planDraft=null;UI.planDirty=false;UI.planScope=null;
  render();toast('Eintrag für '+DOW_LONG[dowKey(date)]+', '+fromIso(date).getDate()+'. '+MONTHS[fromIso(date).getMonth()]+' gelöscht');
};
/* Vorlage wählen: der Vorlagen-Kasten leuchtet kurz auf und zeigt „Hier auswählen“ (nur solange noch keine Vorlage gewählt ist) */
ACT['pe-mode-preset']=()=>{
  const dr=planDraft();
  if(dr.kind!=='rest'&&dr.source==='preset'){toast('Vorlage „'+dr.name+'“ ist schon gewählt. Eine andere findest du im Kasten Vorlagen.');return;}
  const c=$('#presets-card');if(!c)return;
  const calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  c.scrollIntoView({behavior:calm?'auto':'smooth',block:'center'});
  c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');
  clearTimeout(ACT['pe-mode-preset'].t);
  ACT['pe-mode-preset'].t=setTimeout(()=>c.classList.remove('flash'),2400);
};
/* Plan aus einer Vorlage ist gesperrt. Ändern geht nur nach ausdrücklicher Bestätigung; die Vorlage selbst bleibt unverändert. */
async function unlockPreset(){
  const dr=planDraft();
  if(dr.kind==='rest'||dr.source!=='preset')return true;
  const ok=await askConfirm({
    title:'Plan aus Vorlage anpassen?',
    text:'Der Plan für diesen Tag wird zu einem eigenen Training, und du kannst Übungen, Sätze und Gewichte ändern. Die Vorlage „'+dr.name+'“ selbst bleibt unverändert.',
    ok:'Anpassen'
  });
  if(!ok||planDraft()!==dr)return false;
  dr.source='own';dr.presetId=null;dirty();render();
  toast('Jetzt kannst du die Übungen ändern');
  return true;
}
ACT['plan-unlock']=()=>{unlockPreset();};
ACT['pe-mode-own']=async()=>{
  if(!(await unlockPreset()))return;
  const dr=planDraft();
  if(dr.kind==='rest'){dr.kind='training';if(dr.name==='Ruhetag')dr.name='';}
  dr.source='own';dr.presetId=null;dirty();render();
};
ACT['pe-mode-rest']=()=>{const dr=planDraft();dr.kind='rest';dr.name='Ruhetag';dr.exercises=[];dr.source='own';dr.presetId=null;dirty();render();};
BIND.pname=t=>{planDraft().name=t.value;dirty();};
BIND['pe-ex']=t=>{
  const dr=planDraft(),ex=dr.exercises[+t.dataset.i];
  if(!ex||t.value==='__cur')return;
  const lib=S.exercises.find(e=>e.id===t.value);
  if(lib){ex.exerciseId=lib.id;ex.name=lib.name;const was=ex.timed;ex.timed=!!lib.timed;
    if(ex.timed!==was)ex.sets.forEach(s=>{s.reps=ex.timed?(s.warmup?20:45):(s.warmup?8:10);});}
  dirty();render();
};
BIND['pe-set']=t=>{
  const dr=planDraft(),s=dr.exercises[+t.dataset.i].sets[+t.dataset.j];
  const v=toNum(t.value);
  s[t.dataset.f]=v!=null&&v>=0?v:null;t.value=inputNum(s[t.dataset.f]);dirty();
};
ACT['pe-set-add']=t=>{
  const ex=planDraft().exercises[+t.dataset.i],work=ex.sets.filter(s=>!s.warmup),last=work[work.length-1]||{reps:ex.timed?45:10,kg:null};
  ex.sets.push({reps:last.reps,kg:last.kg});dirty();render();
};
ACT['pe-warm-add']=t=>{
  const ex=planDraft().exercises[+t.dataset.i],k=leadWarm(ex.sets),first=ex.sets.find(s=>!s.warmup);
  const d=warmDefaults(ex.timed,toNum(first&&first.kg),k);
  ex.sets.splice(k,0,{reps:d.reps,kg:d.kg,warmup:true});dirty();render();
};
ACT['pe-set-rm']=t=>{
  const ex=planDraft().exercises[+t.dataset.i],s=ex.sets[+t.dataset.j];
  if(!s)return;
  if(!s.warmup&&ex.sets.filter(x=>!x.warmup).length<2)return;
  ex.sets.splice(+t.dataset.j,1);dirty();render();
};
ACT['pe-ex-rm']=t=>{planDraft().exercises.splice(+t.dataset.i,1);dirty();render();};
function moveEx(i,d){
  const a=planDraft().exercises,j=i+d;
  if(j<0||j>=a.length)return;
  const x=a[i];a[i]=a[j];a[j]=x;dirty();render();
}
ACT['pe-up']=t=>moveEx(+t.dataset.i,-1);
ACT['pe-down']=t=>moveEx(+t.dataset.i,1);
ACT['pe-ex-add']=()=>{
  if(!S.exercises.length){toast('Lege zuerst Übungen in der Bibliothek an');UI.trainTab='library';render();return;}
  const dr=planDraft(),used=new Set(dr.exercises.map(e=>e.name));
  const lib=S.exercises.find(e=>!used.has(e.name))||S.exercises[0];
  dr.exercises.push({exerciseId:lib.id,name:lib.name,timed:!!lib.timed,sets:[1,2,3].map(()=>({reps:lib.timed?45:10,kg:null}))});
  dirty();render();
};
ACT['plan-save']=async()=>{
  const date=planDateNow(),key=dowKey(date),dr=planDraft(),scope=scopeNow();
  if(dr.kind!=='rest'&&!dr.exercises.length){toast('Füge mindestens eine Übung hinzu');return;}
  const doc=draftDoc(dr,key);
  doc.updatedAt=new Date().toISOString();
  const label=DOW_LONG[key]+', '+fromIso(date).getDate()+'. '+MONTHS[fromIso(date).getMonth()];
  if(scope==='repeat'){
    const ds=repeatDates(date);
    if(!ds.length){toast('Alle gewählten Tage liegen in der Vergangenheit');return;}
    const cf=repeatConflicts(date,doc);
    if(cf.length){
      const nm=p=>p.kind==='rest'?'Ruhetag':(p.name||'Training');
      const ok=await askConfirm({
        title:'Vorhandene Pläne überschreiben?',
        text:(cf.length===1?'An 1 Tag gilt schon ein anderer Plan.':'An '+cf.length+' Tagen gilt schon ein anderer Plan.')+' Beim Speichern werden diese ersetzt. Vergangene Tage bleiben unverändert.',
        list:cf.map(x=>[shortDate(x.d),nm(x.cur)+' → '+nm(doc)]),
        ok:'Überschreiben'
      });
      if(!ok)return;
    }
    ds.forEach(d=>{const x=clone(doc);x.day=dowKey(d);putPlan(d,x);});
    UI.planDraft=null;UI.planDirty=false;
    render();toast('Plan für '+DOW_LONG[key]+' gespeichert: '+ds.length+(ds.length===1?' Woche':' Wochen')+' bis '+shortDate(ds[ds.length-1]));
    return;
  }
  putPlan(date,doc);
  UI.planDraft=null;UI.planDirty=false;
  render();toast('Plan für '+label+' gespeichert');
};
ACT['plan-preset']=()=>{
  const dr=planDraft(),name=(dr.name||'').trim();
  if(!name){toast('Gib dem Training einen Namen');return;}
  if(!dr.exercises.length){toast('Füge mindestens eine Übung hinzu');return;}
  const same=S.presets.find(p=>p.name.trim().toLowerCase()===name.toLowerCase());
  const id=same?same.id:uid();
  const doc={name,order:same?same.order:1000+S.presets.length,exercises:cleanExercises(dr.exercises)};
  const i=S.presets.findIndex(p=>p.id===id);
  if(i>=0)S.presets[i]=Object.assign({id},doc);else S.presets.push(Object.assign({id},doc));
  S.presets.sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  setDoc('presets/'+id,doc);
  render();toast(same?'Vorlage aktualisiert':'Vorlage gespeichert');
};
function applyPreset(pid,date){
  if(UI.editingPreset){toast('Beende zuerst die Bearbeitung der Vorlage');return;}
  const p=S.presets.find(x=>x.id===pid);if(!p)return;
  if(date&&date!==planDateNow())switchPlanDate(date);
  UI.planDraft={kind:'training',name:p.name,source:'preset',presetId:p.id,exercises:clone(p.exercises||[])};
  UI.planDirty=true;
  render();toast('Vorlage übernommen. Speichere den Plan, um sie zu behalten.');
}
ACT['preset-apply']=t=>applyPreset(t.dataset.id);
ACT['preset-edit']=t=>{
  const p=S.presets.find(x=>x.id===t.dataset.id);if(!p)return;
  if(UI.planDirty&&!UI.editingPreset)toast('Ungespeicherte Planänderungen verworfen');
  UI.editingPreset=p.id;UI.planDraft=null;UI.planDirty=false;
  render();window.scrollTo({top:0,behavior:'smooth'});
};
ACT['preset-dup']=t=>{
  const p=S.presets.find(x=>x.id===t.dataset.id);if(!p)return;
  const id=uid(),doc={name:p.name+' (Kopie)',order:(p.order||0)+0.5,exercises:clone(p.exercises||[])};
  S.presets.push(Object.assign({id},doc));
  S.presets.sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  setDoc('presets/'+id,doc);
  UI.editingPreset=id;UI.planDraft=null;UI.planDirty=false;
  render();window.scrollTo({top:0,behavior:'smooth'});
  toast('Vorlage dupliziert. Passe Namen und Übungen an.');
};
ACT['preset-save']=()=>{
  const dr=planDraft(),name=(dr.name||'').trim(),p=S.presets.find(x=>x.id===UI.editingPreset);
  if(!p){UI.editingPreset=null;UI.planDraft=null;render();return;}
  if(!name){toast('Gib der Vorlage einen Namen');return;}
  if(!dr.exercises.length){toast('Füge mindestens eine Übung hinzu');return;}
  if(S.presets.some(x=>x.id!==p.id&&x.name.trim().toLowerCase()===name.toLowerCase())){toast('Eine Vorlage mit diesem Namen gibt es schon');return;}
  const doc={name,order:p.order||0,exercises:cleanExercises(dr.exercises)};
  const i=S.presets.findIndex(x=>x.id===p.id);
  S.presets[i]=Object.assign({id:p.id},doc);
  S.presets.sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  setDoc('presets/'+p.id,doc);
  UI.editingPreset=null;UI.planDraft=null;UI.planDirty=false;
  render();toast('Vorlage gespeichert');
};
ACT['preset-cancel']=()=>{UI.editingPreset=null;UI.planDraft=null;UI.planDirty=false;render();};
ACT['preset-del']=t=>{
  const k='preset:'+t.dataset.id;
  if(UI.confirmDel!==k){UI.confirmDel=k;render();return;}
  UI.confirmDel=null;
  if(UI.editingPreset===t.dataset.id){UI.editingPreset=null;UI.planDraft=null;UI.planDirty=false;}
  S.presets=S.presets.filter(p=>p.id!==t.dataset.id);
  delDoc('presets/'+t.dataset.id);
  render();toast('Vorlage gelöscht');
};
