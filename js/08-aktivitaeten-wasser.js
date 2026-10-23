'use strict';
/* Übersicht: sonstige Aktivitäten und Wasser */
/* ---------- Übersicht: Sonstige Aktivitäten (getrennt vom Krafttraining) ----------
   Tennis, Kondi-Training und Ähnliches. Pro Tag eine Liste in days/<Datum>.activities [{id,name,note,min,time,at}].
   Name, Beschreibung, Startuhrzeit (HH:MM) und Dauer (Minuten) sind Pflicht (ältere Einträge ohne Uhrzeit bleiben lesbar). Planbar bis 12 Wochen voraus.
   Hat nichts mit den Gym-Einheiten zu tun. Die Karte ist standardmäßig eingeklappt; das Formular klappt nur auf Bedarf auf. */
const actDate=()=>UI.actDate||TODAY();
const actList=date=>((S.days[date]&&S.days[date].activities)||[]).filter(a=>a&&a.name);
const actBlank=()=>({name:'',note:'',min:'',time:'',id:null});
/* Anzeige: nach Startuhrzeit sortiert (ohne Uhrzeit danach, dann nach Anlegezeit) */
const actSorted=date=>actList(date).slice().sort((a,b)=>(a.time?0:1)-(b.time?0:1)||String(a.time||'').localeCompare(String(b.time||''))||String(a.at||'').localeCompare(String(b.at||'')));
/* Vorschau: die nächsten geplanten Aktivitäten (ab jetzt, heute noch nicht Vergangenes), höchstens 3, über alle Tage hinweg */
function actUpcoming(){
  const t=TODAY(),now=new Date(),hm=pad2(now.getHours())+':'+pad2(now.getMinutes()),out=[];
  Object.keys(S.days).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k>=t).sort().forEach(k=>{
    actSorted(k).forEach(a=>{if(k>t||!validHm(a.time)||a.time>=hm)out.push({date:k,a});});
  });
  return out.slice(0,3);
}
const actWhen=d=>{const t=TODAY();return d===t?'Heute':d===addDays(t,1)?'Morgen':DOW_LONG[dowKey(d)]+', '+dayNum(d)+' '+MONTHS[fromIso(d).getMonth()].slice(0,3);};
function actNextHtml(){
  const up=actUpcoming();
  if(!up.length)return '';
  return '<div class="act-next"><div class="kicker">Als Nächstes geplant</div><ul class="an-list">'
    +up.map(u=>{const a=u.a,meta=(validHm(a.time)?a.time+' Uhr':'')+(validHm(a.time)&&a.min>0?' · ':'')+(a.min>0?f0(a.min)+' min':'');
      return '<li><button type="button" class="an-row" data-act="act-goto" data-d="'+u.date+'" title="Zu diesem Tag springen"><span class="an-when">'+esc(actWhen(u.date))+'</span><span class="an-name">'+esc(a.name)+'</span>'+(meta?'<em class="dur">'+esc(meta)+'</em>':'')+'</button></li>';}).join('')
    +'</ul></div>';
}
ACT['act-goto']=t=>{const d=t.dataset.d;UI.actDate=d===TODAY()?null:d;UI.actForm=actBlank();render();};
function activitiesHtml(){
  const date=actDate(),list=actSorted(date),f=UI.actForm,editing=!!f.id,open=!!UI.actOpen;
  const items=list.map(a=>{
    const armed=UI.confirmDel==='act:'+a.id,ed=f.id===a.id;
    const meta=(a.time?a.time+' Uhr':'')+(a.time&&a.min>0?' · ':'')+(a.min>0?f0(a.min)+' min':'');
    return '<li class="act-item'+(ed?' editing':'')+'"><div class="ai"><b>'+esc(a.name)+(meta?'<em class="dur">'+esc(meta)+'</em>':'')+'</b>'+(a.note?'<span>'+esc(a.note)+'</span>':'')+'</div><div class="macts">'
      +'<button type="button" class="iconb" data-act="act-edit" data-id="'+esc(a.id)+'" aria-label="Aktivität '+esc(a.name)+' bearbeiten" title="Bearbeiten">'+I.edit+'</button>'
      +(armed?'<button type="button" class="iconb armed" data-confirm data-act="act-del" data-id="'+esc(a.id)+'">Löschen?</button>'
        :'<button type="button" class="iconb" data-confirm data-act="act-del" data-id="'+esc(a.id)+'" aria-label="Aktivität '+esc(a.name)+' löschen" title="Löschen">'+I.trash+'</button>')+'</div></li>';
  }).join('');
  const form='<form class="act-form" data-form="act" novalidate>'
      +'<label class="lbl" for="act-name">Name</label><input class="field" id="act-name" data-live="actf" data-k="name" maxlength="60" autocomplete="off" aria-required="true" placeholder="Zum Beispiel: Tennis" value="'+esc(f.name)+'">'
      +'<label class="lbl" for="act-note">Kurze Beschreibung</label><textarea class="field" id="act-note" data-live="actf" data-k="note" maxlength="200" rows="2" aria-required="true" placeholder="Zum Beispiel: Einzel, intensiv">'+esc(f.note)+'</textarea>'
      +'<div class="act-row"><div><label class="lbl" for="act-time">Startuhrzeit</label><input class="field" type="time" id="act-time" data-live="actf" data-k="time" aria-required="true" value="'+esc(f.time)+'"></div>'
      +'<div><label class="lbl" for="act-min">Dauer</label><div class="uw"><input class="field" id="act-min" inputmode="numeric" data-live="actf" data-k="min" autocomplete="off" aria-required="true" placeholder="90" value="'+esc(f.min)+'"><span class="un">min</span></div></div></div>'
      +'<div class="act-btns"><button type="submit" class="btn pri">'+(editing?'Speichern':'Hinzufügen')+'</button>'
        +(editing?'<button type="button" class="btn" data-act="act-cancel">Abbrechen</button>':'')+'</div></form>';
  return '<section class="card foldcard act" id="act-card"'+(open?' data-open':'')+'><div class="ci-head"><div><div class="kicker">Neben dem Krafttraining</div><h2 class="h2" style="margin:4px 0 0">Sonstige Aktivitäten</h2></div>'+stepNavHtml('act',date,maxPlanDate())+'</div>'
    +'<div class="act-top'+(items?'':' none')+'"><div class="act-sum">'+(items?'<ul class="act-list">'+items+'</ul>':'<p class="act-none">Keine sonstigen Aktivitäten</p>')+'</div>'
      +'<button type="button" class="btn sm fold-toggle" id="act-toggle" data-act="act-toggle" aria-expanded="'+open+'" aria-controls="act-formwrap">'
        +'<span class="ico">'+I.plus+'</span><span class="t-add">Aktivität hinzufügen</span><span class="t-close">Schließen</span></button></div>'
    +actNextHtml()
    +'<div class="ci-fold fold"><div class="ci-in" id="act-formwrap"'+(open?'':' inert')+'>'+form+'</div></div></section>';
}
const setActOpen=(open,focus)=>{UI.actOpen=open;setFold('#act-card','#act-formwrap','#act-toggle',open,focus);};
const actRedrawThen=(open,focus)=>{redrawThenFold('#act-card','#act-formwrap','#act-toggle',open,focus);UI.actOpen=open;};
BIND.actf=t=>{UI.actForm[t.dataset.k]=t.value;};
ACT['act-toggle']=()=>{
  if(UI.actOpen){if(UI.actForm.id)UI.actForm=actBlank();actRedrawThen(false);keepFocus('#act-toggle');}
  else setActOpen(true,'#act-name');
};
ACT['act-prev']=()=>{const n=addDays(actDate(),-1);if(n>=firstDate()){UI.actDate=n===TODAY()?null:n;UI.actForm=actBlank();render();}};
ACT['act-next']=()=>{const n=addDays(actDate(),1);if(n<=maxPlanDate()){UI.actDate=n===TODAY()?null:n;UI.actForm=actBlank();render();}};
ACT['act-today']=()=>{UI.actDate=null;UI.actForm=actBlank();render();};
ACT['act-edit']=t=>{
  const a=actList(actDate()).find(x=>x.id===t.dataset.id);if(!a)return;
  UI.actForm={name:a.name,note:a.note||'',min:a.min>0?String(a.min):'',time:validHm(a.time)?a.time:'',id:a.id};
  if(UI.actOpen){render();focusId('act-name');return;}
  actRedrawThen(true,'#act-name');
};
ACT['act-cancel']=()=>{UI.actForm=actBlank();actRedrawThen(false);keepFocus('#act-toggle');};
ACT['act-del']=t=>{
  const k='act:'+t.dataset.id,date=actDate();
  if(UI.confirmDel!==k){UI.confirmDel=k;render();return;}
  UI.confirmDel=null;
  const d=dayRef(date);
  d.activities=(d.activities||[]).filter(a=>a.id!==t.dataset.id);
  if(UI.actForm.id===t.dataset.id)UI.actForm=actBlank();
  saveDay(date,{activities:d.activities});
  render();toast('Aktivität gelöscht');
};
$('#view').addEventListener('submit',e=>{
  if(!e.target.dataset||e.target.dataset.form!=='act')return;
  e.preventDefault();
  const date=actDate(),f=UI.actForm,name=(f.name||'').trim().slice(0,60),note=(f.note||'').trim().slice(0,200);
  const minRaw=String(f.min==null?'':f.min).replace(/\s/g,'').replace(',','.'),min=Math.round(Number(minRaw));
  const time=validHm(f.time)?f.time:'';
  if(!name){toast('Gib der Aktivität einen Namen');focusId('act-name');return;}
  if(!note){toast('Beschreibe die Aktivität kurz');focusId('act-note');return;}
  if(!time){toast('Gib die Startuhrzeit an');focusId('act-time');return;}
  if(!minRaw||!isFinite(min)||min<1||min>1440){toast('Gib die Dauer in Minuten an (1 bis 1.440)');focusId('act-min');return;}
  const d=dayRef(date),cur=(d.activities||[]).slice();
  if(f.id){
    const i=cur.findIndex(a=>a.id===f.id);
    if(i<0){toast('Die Aktivität existiert nicht mehr');UI.actForm=actBlank();actRedrawThen(false);return;}
    cur[i]=Object.assign({},cur[i],{name,note,min,time});
  }else{
    cur.push({id:uid(),name,note,min,time,at:new Date().toISOString()});
  }
  d.activities=cur;
  saveDay(date,{activities:cur});
  UI.actForm=actBlank();
  actRedrawThen(false);
  keepFocus('#act-toggle');
  toast(f.id?'Aktivität gespeichert':date>TODAY()?'Aktivität geplant':'Aktivität hinzugefügt');
});
/* ---------- Übersicht: Wasser ----------
   Pro Tag die getrunkene Menge in days/<Datum>.waterMl (Zahl, ml). 0 ml gilt als „nicht eingetragen“ und wird als null
   gespeichert (oder gar nicht geschrieben). Das Tagesziel steht in targets/main.waterGoalMl; die Flaschengröße ist fest (750 ml).
   Dargestellt als Flaschen (Foto der eigenen Flasche, freigestellt): so viele wie das Ziel verlangt, die getrunkene Menge ist
   deckend, der Rest grau und durchsichtig. */
const WATER_DEF={goal:3000,bottle:750},WATER_MAX_BOTTLES=12,WATER_MAX_ML=20000;
/* Lage des Flaschenkörpers im Foto in Prozent der Bildhöhe: unterhalb von BT_TOP beginnt der Körper (darüber Deckel und Schlaufe) */
const BT_TOP=27.6,BT_BOT=99.6;
const nfL=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2});
const waterDate=()=>UI.waterDate||TODAY();
const waterOf=date=>{const v=S.days[date]&&S.days[date].waterMl;return v>0?Math.round(v):0;};
function waterCfg(){
  const t=S.targets||{},g=Math.round(+t.waterGoalMl),b=WATER_DEF.bottle;
  const ok=g>=250&&Math.ceil(g/b)<=WATER_MAX_BOTTLES;
  return {goal:ok?g:WATER_DEF.goal,bottle:b};
}
const litres=ml=>ml>=1000?nfL.format(ml/1000)+' l':f0(ml)+' ml';
/* Oberkante des sichtbaren (deckenden) Teils in % der Bildhöhe; voll = ganze Flasche samt Deckel */
const btInset=frac=>frac>=.999?0:frac<=0?100:BT_BOT-frac*(BT_BOT-BT_TOP);
/* frac = gefüllter Anteil 0..1; tick = Anteil (0..1) der Zielmarke auf der letzten Zielflasche, sonst null */
function bottleHtml(frac,tick){
  return '<span class="bt" style="--t:'+btInset(frac).toFixed(2)+'%"><i class="bt-g"></i><i class="bt-s"></i>'
    +(tick!=null?'<i class="bt-tick" style="top:'+(BT_BOT-tick*(BT_BOT-BT_TOP)).toFixed(2)+'%"></i>':'')+'</span>';
}
function waterState(amt,cfg){
  if(!(amt>0))return 'Noch nichts eingetragen';
  if(amt>=cfg.goal)return amt>cfg.goal?'Ziel erreicht, '+f0(amt-cfg.goal)+' ml drüber':'Ziel erreicht';
  return 'Noch '+f0(cfg.goal-amt)+' ml bis zum Ziel';
}
const waterNum=amt=>amt>0?f0(amt):'–';
const waterCount=(amt,cfg)=>Math.max(Math.ceil(cfg.goal/cfg.bottle),Math.ceil(amt/cfg.bottle));
function bottlesHtml(amt,cfg){
  const gb=Math.ceil(cfg.goal/cfg.bottle),n=waterCount(amt,cfg),rest=cfg.goal-(gb-1)*cfg.bottle;
  let h='';
  for(let i=0;i<n;i++){
    const frac=Math.max(0,Math.min(1,(amt-i*cfg.bottle)/cfg.bottle));
    const tick=(i===gb-1&&rest<cfg.bottle)?rest/cfg.bottle:null;
    const upto=(i+1)*cfg.bottle;
    h+='<button type="button" class="wbtl'+(i>=gb?' ex':'')+'" data-act="wt-bottle" data-i="'+i+'" aria-label="Flasche '+(i+1)+' von '+n+': setzt die Menge auf '+f0(upto)+' ml" title="'+f0(upto)+' ml">'
      +bottleHtml(frac,tick)+'<span class="wl">'+litres(upto)+'</span></button>';
  }
  return h;
}
function waterHtml(){
  const date=waterDate(),cfg=waterCfg(),amt=waterOf(date),f=UI.waterForm;
  const chips='<button type="button" class="chip sm" data-act="wt-add" data-n="-b">− Flasche ('+f0(cfg.bottle)+' ml)</button>'
    +'<button type="button" class="chip sm" data-act="wt-add" data-n="b">+ Flasche ('+f0(cfg.bottle)+' ml)</button>';
  const cfgForm=UI.waterSet&&f
    ?'<form class="wt-cfg" data-form="watercfg" novalidate><div class="wt-cfgrow">'
      +'<div><label class="lbl" for="wt-goal">Tagesziel</label><div class="uw"><input class="field" id="wt-goal" inputmode="numeric" autocomplete="off" data-live="wtf" data-k="goal" value="'+esc(f.goal)+'"><span class="un">ml</span></div></div>'
      +'</div>'
      +'<div class="act-btns"><button type="submit" class="btn pri">Speichern</button><button type="button" class="btn" data-act="wt-cfg-close">Abbrechen</button></div></form>'
    :'';
  return '<section class="card water" id="water-card" data-n="'+waterCount(amt,cfg)+'"><div class="ci-head"><div><div class="kicker">Trinken</div><h2 class="h2" style="margin:4px 0 0">Wasser</h2></div>'+stepNavHtml('wt',date)+'</div>'
    +'<div class="wt-main"><div class="wt-l"><div class="wt-sum"><span class="wt-num" id="wt-num">'+waterNum(amt)+'</span><span class="wt-u" id="wt-u"'+(amt>0?'':' hidden')+'>ml</span><span class="wt-of">von '+f0(cfg.goal)+' ml</span></div>'
    +'<p class="wt-state" id="wt-state" aria-live="polite">'+waterState(amt,cfg)+'</p>'
    +'<div class="bottles" id="wt-bottles" role="group" aria-label="Flaschen. Tippe auf eine Flasche, um die getrunkene Menge zu setzen.">'+bottlesHtml(amt,cfg)+'</div></div>'
    +'<div class="wt-r"><div class="wt-quick">'+chips+'</div>'
    +'<form class="wt-form" data-form="water" novalidate><div class="uw"><input class="field" id="wt-ml" inputmode="numeric" autocomplete="off" placeholder="Menge" aria-label="Menge in Millilitern"><span class="un">ml</span></div>'
      +'<button type="submit" class="btn pri">Hinzufügen</button></form></div></div>'
    +'<div class="wt-foot"><button type="button" class="linkb" data-act="wt-cfg-open">'+(UI.waterSet?'Einstellung schließen':'Ziel ändern')+'</button>'
      +'<button type="button" class="linkb" id="wt-reset" data-act="wt-reset"'+(amt>0?'':' hidden')+'>Auf 0 setzen</button></div>'+cfgForm+'</section>';
}
/* Menge setzen. 0 ml = nicht eingetragen: das Feld wird auf null gesetzt. Bleibt die Zahl der Flaschen gleich, werden nur
   Füllstand und Zahlen verändert, damit die Füllung animiert. */
function setWater(date,ml){
  ml=Math.max(0,Math.min(WATER_MAX_ML,Math.round(ml)));
  const had=waterOf(date)>0;
  if(ml>0){dayRef(date).waterMl=ml;saveDay(date,{waterMl:ml});}
  else if(had){S.days[date].waterMl=null;saveDay(date,{waterMl:null});}
  const card=$('#water-card'),cfg=waterCfg();
  if(!card||+card.dataset.n!==waterCount(ml,cfg)){render();return;}
  UI.animUntil=Date.now()+700;
  $$('#wt-bottles .wbtl').forEach((b,i)=>{
    const frac=Math.max(0,Math.min(1,(ml-i*cfg.bottle)/cfg.bottle));
    b.querySelector('.bt').style.setProperty('--t',btInset(frac).toFixed(2)+'%');
  });
  $('#wt-num').textContent=waterNum(ml);
  $('#wt-u').hidden=!(ml>0);
  $('#wt-state').textContent=waterState(ml,cfg);
  $('#wt-reset').hidden=!(ml>0);
}
BIND.wtf=t=>{if(UI.waterForm)UI.waterForm[t.dataset.k]=t.value;};
const waterStep=n=>{UI.waterDate=n>=TODAY()?null:n;render();};
ACT['wt-prev']=()=>{const n=addDays(waterDate(),-1);if(n>=firstDate())waterStep(n);};
ACT['wt-next']=()=>waterStep(addDays(waterDate(),1));
ACT['wt-today']=()=>waterStep(TODAY());
ACT['wt-bottle']=t=>{
  const date=waterDate(),cfg=waterCfg(),i=+t.dataset.i,cur=waterOf(date),target=(i+1)*cfg.bottle;
  setWater(date,cur===target?i*cfg.bottle:target);
};
ACT['wt-add']=t=>{
  const date=waterDate(),cfg=waterCfg(),k=t.dataset.n,n=k==='b'?cfg.bottle:k==='-b'?-cfg.bottle:+k;
  setWater(date,waterOf(date)+n);
};
ACT['wt-reset']=()=>setWater(waterDate(),0);
ACT['wt-cfg-open']=()=>{
  if(UI.waterSet){UI.waterSet=false;UI.waterForm=null;render();return;}
  const c=waterCfg();
  UI.waterSet=true;UI.waterForm={goal:String(c.goal)};
  render();focusId('wt-goal');
};
ACT['wt-cfg-close']=()=>{UI.waterSet=false;UI.waterForm=null;render();};
/* Wasserziel in targets/main ablegen; das Dokument existiert vielleicht noch nicht */
function saveTargetsPatch(patch){
  S.targets=Object.assign({},S.targets||{},patch);
  if(!DB)return Promise.resolve();
  return enqueue('targets/main',async()=>{
    const ref=DB.doc('targets/main'),snap=await ref.get();
    if(snap.exists)await ref.update(patch);else await ref.set(patch);
  });
}
$('#view').addEventListener('submit',e=>{
  const kind=e.target.dataset&&e.target.dataset.form;
  if(kind==='water'){
    e.preventDefault();
    const inp=$('#wt-ml'),raw=(inp.value||'').replace(/[\s.]/g,'').replace('−','-').replace(',','.'),n=Math.round(Number(raw));
    if(!raw||!isFinite(n)||n===0){toast('Gib eine Menge in ml ein');return;}
    if(Math.abs(n)>5000){toast('So viel auf einmal? Bitte höchstens 5.000 ml');return;}
    setWater(waterDate(),waterOf(waterDate())+n);
    const f=$('#wt-ml');if(f){f.value='';}
  }else if(kind==='watercfg'){
    e.preventDefault();
    const f=UI.waterForm||{},g=Math.round(Number(String(f.goal).replace(/[\s.]/g,'').replace(',','.'))),maxG=WATER_MAX_BOTTLES*WATER_DEF.bottle;
    if(!(g>=250&&g<=maxG)){toast('Das Tagesziel liegt zwischen 250 und '+f0(maxG)+' ml');return;}
    saveTargetsPatch({waterGoalMl:g});
    UI.waterSet=false;UI.waterForm=null;
    render();toast('Wasserziel gespeichert');
  }
});
