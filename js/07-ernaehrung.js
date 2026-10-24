'use strict';
/* Reiter Ernährung: Tagesansicht, Eingabe, Mahlzeiten */
/* ---------- Ernährung ---------- */
function nutTile(label,cls,fillCls,eaten,target,unit){
  const pct=target>0?Math.min(100,eaten/target*100):0;
  return '<div class="tile '+cls+' '+fillCls+'"><div class="lab">'+label+'</div><div class="big"><span class="num">'+f0(eaten)+'</span><span class="u dim">/ '+(target>0?f0(target):'–')+(unit==='g'?' g':'')+'</span></div><div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div></div>';
}
const NUT_AHEAD_DAYS=14;
/* Kachel für einen zukünftigen, geplanten Tag: nur das Ziel, es kann ja noch nichts gegessen sein */
function planTile(label,cls,fillCls,target,unit){
  return '<div class="tile '+cls+' '+fillCls+'"><div class="lab">'+label+' · Ziel</div><div class="big"><span class="num">'+f0(target)+'</span><span class="u dim">'+(unit==='g'?'g':unit)+'</span></div></div>';
}
const blankMeal=()=>({name:'',kcal:'',protein:'',carbs:'',fat:'',ing:null});
const blankIng=()=>({name:'',kcal:'',protein:'',carbs:'',fat:''});
const nonBlank=it=>!!(((it.name||'')+'').trim()||toNum(it.kcal)||toNum(it.protein)||toNum(it.carbs)||toNum(it.fat));
const sumTxt=t=>'<b>'+f0(t.kcal)+' kcal</b> · P '+f0(t.protein)+' g · KH '+f0(t.carbs)+' g · F '+f0(t.fat)+' g';
const mfSumHtml=list=>'Summe: '+sumTxt(sumIng((list||[]).filter(nonBlank)));

/* Name + vier Zahlenfelder (für Zutat hinzufügen / bearbeiten) */
function fieldsHtml(pfx,live,o,nameLbl,extra){
  const f=(k,lbl,id)=>'<div><label class="lbl" for="'+pfx+'-'+id+'">'+lbl+'</label><input class="field" id="'+pfx+'-'+id+'" data-live="'+live+'" data-k="'+k+'"'+extra+' inputmode="decimal" placeholder="0" value="'+esc(o[k])+'"></div>';
  return '<div class="nm"><label class="lbl" for="'+pfx+'-name">'+nameLbl+'</label><input class="field" id="'+pfx+'-name" data-live="'+live+'" data-k="name"'+extra+' autocomplete="off" placeholder="Zum Beispiel: Lachs, 150 g" value="'+esc(o.name)+'"></div>'
    +f('kcal','kcal','kcal')+f('protein','Protein g','p')+f('carbs','Carbs g','c')+f('fat','Fett g','f');
}
/* Zeile für eine Zutat im Formular „Essen eintragen“ */
function mfIngRow(it,i){
  const f=(k,lbl,id)=>'<div><label class="lbl" for="mi-'+id+'-'+i+'">'+lbl+'</label><input class="field" id="mi-'+id+'-'+i+'" data-live="mealing" data-i="'+i+'" data-k="'+k+'" inputmode="decimal" placeholder="0" value="'+esc(it[k])+'"></div>';
  return '<div class="meal-form ing-row"><div class="nm"><label class="lbl" for="mi-name-'+i+'">Zutat '+(i+1)+'</label><div class="nmrow">'
    +'<input class="field" id="mi-name-'+i+'" data-live="mealing" data-i="'+i+'" data-k="name" autocomplete="off" placeholder="Zum Beispiel: Lachs, 150 g" value="'+esc(it.name)+'">'
    +'<button type="button" class="iconb" data-act="mf-ing-rm" data-i="'+i+'" aria-label="Zutat '+(i+1)+' entfernen" title="Zutat entfernen">'+I.close+'</button></div></div>'
    +f('kcal','kcal','kcal')+f('protein','Protein g','p')+f('carbs','Carbs g','c')+f('fat','Fett g','f')+'</div>';
}
const numCells=t=>'<td>'+f0(t.kcal)+'</td><td>'+f0(t.protein)+'</td><td>'+f0(t.carbs)+'</td><td>'+f0(t.fat)+'</td>';

function mealRows(m,date){
  const ing=hasIng(m),t=mealTot(m),open=ing&&!!UI.mealOpen[m.id];
  const ed=UI.mealEdit&&UI.mealEdit.date===date&&UI.mealEdit.id===m.id?UI.mealEdit:null;
  let html;
  if(ed){
    if(ed.ing){
      /* Mit Zutaten: nur der Name ist änderbar, kcal und Makros kommen aus den Zutaten */
      html='<tr class="editing"><td colspan="6"><form id="meal-edit-form" class="meal-form edit ing-meal" novalidate>'
        +'<div class="nm"><label class="lbl" for="e-name">Name bearbeiten</label><input class="field" id="e-name" data-live="mealedit" data-k="name" autocomplete="off" value="'+esc(ed.name)+'"></div>'
        +'<div class="go"><button type="submit" class="btn pri">Speichern</button><button type="button" class="btn" data-act="meal-edit-cancel">Abbrechen</button></div>'
        +'<p class="hint">Kalorien und Makros ('+sumTxt(t)+') ergeben sich aus den Zutaten. Ändere sie im Dropdown dieses Eintrags.</p>'
        +'</form></td></tr>';
    }else{
      const fld=(id,k,lbl)=>'<div><label class="lbl" for="'+id+'">'+lbl+'</label><input class="field" id="'+id+'" data-live="mealedit" data-k="'+k+'" inputmode="decimal" placeholder="0" value="'+esc(ed[k])+'"></div>';
      html='<tr class="editing"><td colspan="6"><form id="meal-edit-form" class="meal-form edit" novalidate>'
        +'<div class="nm"><label class="lbl" for="e-name">Eintrag bearbeiten</label><input class="field" id="e-name" data-live="mealedit" data-k="name" autocomplete="off" value="'+esc(ed.name)+'"></div>'
        +fld('e-kcal','kcal','kcal')+fld('e-p','protein','Protein g')+fld('e-c','carbs','Carbs g')+fld('e-f','fat','Fett g')
        +'<div class="go"><button type="submit" class="btn pri">Speichern</button><button type="button" class="btn" data-act="meal-edit-cancel">Abbrechen</button></div>'
        +'<div class="ing-tg"><button type="button" class="linkb" data-act="meal-split">In Zutaten aufteilen</button></div>'
        +'</form></td></tr>';
    }
  }else{
    const nm=ing
      ?'<button type="button" class="mexp" data-act="meal-toggle" data-id="'+esc(m.id)+'" aria-expanded="'+open+'" aria-label="Zutaten von '+esc(m.name)+' '+(open?'einklappen':'aufklappen')+'">'+I.right+'<span class="mn">'+esc(m.name)+' <span class="tag">'+m.ingredients.length+(m.ingredients.length===1?' Zutat':' Zutaten')+'</span></span></button>'
      :esc(m.name);
    html='<tr class="mrow"><td>'+nm+'</td>'+numCells(t)
      +'<td><div class="macts"><button type="button" class="iconb" data-act="meal-edit" data-id="'+esc(m.id)+'" aria-label="'+esc(m.name)+' bearbeiten" title="'+(ing?'Namen bearbeiten':'Bearbeiten')+'">'+I.edit+'</button>'
      +'<button type="button" class="iconb" data-act="meal-del" data-id="'+esc(m.id)+'" aria-label="'+esc(m.name)+' löschen" title="Löschen">'+I.trash+'</button></div></td></tr>';
  }
  if(open){
    const ie=UI.ingEdit&&UI.ingEdit.mealId===m.id&&UI.ingEdit.date===date?UI.ingEdit:null,last=m.ingredients.length<2;
    html+=m.ingredients.map(it=>{
      if(ie&&ie.id===it.id){
        return '<tr class="ing-edit"><td colspan="6"><form class="meal-form edit" data-form="ing-edit" novalidate>'
          +fieldsHtml('ie','ingedit',ie,'Zutat bearbeiten','')
          +'<div class="go"><button type="submit" class="btn pri">Speichern</button><button type="button" class="btn" data-act="ing-edit-cancel">Abbrechen</button></div></form></td></tr>';
      }
      return '<tr class="ing"><td>'+esc(it.name)+'</td>'+numCells(nums(it))
        +'<td><div class="macts"><button type="button" class="iconb" data-act="ing-edit" data-mid="'+esc(m.id)+'" data-id="'+esc(it.id)+'" aria-label="Zutat '+esc(it.name)+' bearbeiten" title="Bearbeiten">'+I.edit+'</button>'
        +'<button type="button" class="iconb" data-act="ing-del" data-mid="'+esc(m.id)+'" data-id="'+esc(it.id)+'" aria-label="Zutat '+esc(it.name)+' löschen" title="'+(last?'Eine Zutat muss bleiben. Lösche sonst den ganzen Eintrag.':'Löschen')+'"'+(last?' disabled':'')+'>'+I.trash+'</button></div></td></tr>';
    }).join('');
    if(UI.ingAddOpen[m.id]){
      const d=UI.ingNew[m.id]||(UI.ingNew[m.id]=blankIng());
      html+='<tr class="ing-add"><td colspan="6"><form class="meal-form" data-form="ing-add" data-mid="'+esc(m.id)+'" novalidate>'
        +fieldsHtml('in-'+m.id,'ingnew',d,'Zutat hinzufügen',' data-mid="'+esc(m.id)+'"')
        +'<div class="go"><button type="submit" class="btn pri">Hinzufügen</button><button type="button" class="btn" data-act="ing-add-close" data-mid="'+esc(m.id)+'">Schließen</button></div></form></td></tr>';
    }else{
      /* Dezent: nur ein kleiner Link, das Formular erscheint erst auf Klick */
      html+='<tr class="ing-more"><td colspan="6"><button type="button" class="linkb" data-act="ing-add-open" data-mid="'+esc(m.id)+'">+ Zutat hinzufügen</button></td></tr>';
    }
  }
  return html;
}

/* ---------- Tag als ungenau/unvollständig getrackt markieren (days/<Datum>.nutritionFlag {note, at}; ältere Einträge haben zusätzlich reason lazy|hard) ---------- */
const flagOf=date=>{const d=S.days[date],f=d&&d.nutritionFlag;return f&&typeof f==='object'?f:null;};
/* Ablauf: Markieren, Grund angeben (Pflicht) und bestätigen. Erst dann wird der Tag markiert. */
function flagHtml(date){
  const fl=flagOf(date),dr=UI.nfDraft;
  if(dr){
    return '<section class="card nf on" id="nf-card"><form data-form="nf" novalidate><div class="kicker">Tracking-Status</div>'
      +'<label class="lbl" for="nf-note">Grund</label><input class="field" id="nf-note" data-live="nf-note" maxlength="140" autocomplete="off" aria-required="true" placeholder="Zum Beispiel: Geburtstagsfeier, Speisekarte ohne Nährwerte" value="'+esc(dr.note)+'">'
      +'<div class="act-btns"><button type="submit" class="btn pri">Bestätigen</button><button type="button" class="btn" data-act="nf-cancel">Abbrechen</button></div></form></section>';
  }
  if(!fl){
    return '<section class="card nf"><div class="nf-row"><div><div class="kicker">Tracking-Status</div><p>Tag ungenau oder nicht vollständig erfasst?</p></div><div class="choices"><button type="button" class="chip" data-act="nf-start" aria-pressed="false">Als ungenau markieren</button></div></div></section>';
  }
  return '<section class="card nf on"><div class="nf-row"><div><span class="badge">Ungenau getrackt</span><p class="nf-why">'+esc(fl.note||'')+'</p></div>'
    +'<div class="nf-acts"><button type="button" class="btn sm" data-act="nf-edit">Ändern</button><button type="button" class="linkb" data-act="nf-clear">Markierung entfernen</button></div></div></section>';
}
ACT['nf-start']=()=>{UI.nfDraft={note:''};render();focusId('nf-note');};
ACT['nf-edit']=()=>{
  const fl=flagOf(nutDate());if(!fl)return;
  UI.nfDraft={note:fl.note||''};
  render();focusId('nf-note');
};
ACT['nf-cancel']=()=>{UI.nfDraft=null;render();};
ACT['nf-confirm']=()=>{
  const dr=UI.nfDraft;if(!dr)return;
  const note=(dr.note||'').trim().slice(0,140);
  if(!note){toast('Gib den Grund an');focusId('nf-note');return;}
  const date=nutDate(),d=dayRef(date),cur=flagOf(date);
  d.nutritionFlag={note,at:cur&&cur.at?cur.at:new Date().toISOString()};
  saveDay(date,{nutritionFlag:d.nutritionFlag});
  UI.nfDraft=null;
  render();toast('Tag als ungenau markiert');
};
ACT['nf-clear']=()=>{const date=nutDate();dayRef(date).nutritionFlag=null;saveDay(date,{nutritionFlag:null});render();toast('Markierung entfernt');};
BIND['nf-note']=t=>{if(UI.nfDraft)UI.nfDraft.note=t.value.slice(0,140);};

VIEWS.nutrition=function(){
  const today=TODAY(),date=UI.nutDate||today,tg=targetsFor(date),ms=mealsOf(date),tot=sumMeals(ms),mf=UI.mealForm;
  const minDate=firstDate(),maxDate=addDays(today,NUT_AHEAD_DAYS),future=date>today;
  const rows=ms.map(m=>mealRows(m,date)).join('');
  const list=ms.length
    ?'<div class="tablewrap"><table class="mt"><thead><tr><th>Eintrag</th><th>kcal</th><th>P</th><th>KH</th><th>F</th><th></th></tr></thead><tbody>'+rows+'</tbody>'
      +'</table></div>'
    :'<div class="empty"><b>Noch nichts eingetragen</b>Trage oben deine erste Mahlzeit für diesen Tag ein.</div>';
  const ingMode=Array.isArray(mf.ing);
  const formBody=ingMode
    ?'<div class="ing-wrap"><div class="ing-list">'+mf.ing.map(mfIngRow).join('')+'</div>'
      +'<div class="ing-bar"><button type="button" class="btn sm" data-act="mf-ing-add">+ Zutat</button><span class="ing-sum" id="mf-sum">'+mfSumHtml(mf.ing)+'</span></div>'
      +'<button type="button" class="linkb" data-act="mf-ing-off">Stattdessen nur die Summe eintragen</button></div>'
      +'<div class="go"><button type="submit" class="btn pri" style="width:100%">Hinzufügen</button></div>'
    :'<div><label class="lbl" for="m-kcal">kcal</label><input class="field" id="m-kcal" data-live="mealf" data-k="kcal" inputmode="decimal" placeholder="0" value="'+esc(mf.kcal)+'"></div>'
      +'<div><label class="lbl" for="m-p">Protein g</label><input class="field" id="m-p" data-live="mealf" data-k="protein" inputmode="decimal" placeholder="0" value="'+esc(mf.protein)+'"></div>'
      +'<div><label class="lbl" for="m-c">Carbs g</label><input class="field" id="m-c" data-live="mealf" data-k="carbs" inputmode="decimal" placeholder="0" value="'+esc(mf.carbs)+'"></div>'
      +'<div><label class="lbl" for="m-f">Fett g</label><input class="field" id="m-f" data-live="mealf" data-k="fat" inputmode="decimal" placeholder="0" value="'+esc(mf.fat)+'"></div>'
      +'<div class="go"><button type="submit" class="btn pri" style="width:100%">Hinzufügen</button></div>'
      +'<div class="ing-tg"><button type="button" class="linkb" data-act="mf-ing-on">Zutaten einzeln eintragen</button></div>';
  return '<div class="pagehead"><div class="kicker">'+esc(longDate(TODAY()))+'</div><h1 class="title">Ernährung</h1>'
      +'<div class="navrow"><div class="datenav"><button type="button" data-act="nut-prev" aria-label="Vorheriger Tag"'+(date<=minDate?' disabled':'')+'>'+I.left.replace('<svg','<svg width="18" height="18"')+'</button>'+fixedLab(shortDate(date),['Mi, 30. September','Do, 31. Oktober','Fr, 28. November'])+'<button type="button" data-act="nut-next" aria-label="Nächster Tag"'+(date>=maxDate?' disabled':'')+'>'+I.right.replace('<svg','<svg width="18" height="18"')+'</button></div>'
      +'<button type="button" class="btn sm" data-act="nut-today"'+(date===today?' disabled':'')+'>Heute</button>'
      +(!future&&flagOf(date)?'<span class="flagpill" title="'+esc(flagOf(date).note||'')+'">Ungenau</span>':'<span class="flagpill ghost" aria-hidden="true">Ungenau</span>')+'</div></div>'
    +(future
      ?(tg.set
        ?'<div class="tiles compact">'
          +planTile('Kalorien','t-panel','',tg.kcal,'kcal')
          +planTile('Protein','t-card','f-accent',tg.protein,'g')
          +planTile('Kohlenhydrate','t-card','f-blue',tg.carbs,'g')
          +planTile('Fett','t-card','f-ink',tg.fat,'g')
        +'</div><p class="tg-src">'+(tg.note?esc(tg.note)+'<br>':'')+'Essen trägst du erst an diesem Tag ein.</p>'
        :'<div class="empty np ov-np" id="np-empty" role="status"><b>Noch keine Nährwerte geplant</b></div>')
      :(tg.set?'':'<div class="empty np ov-np" id="np-empty" role="status"><b>Noch keine Nährwerte geplant</b></div>')
        +'<div class="tiles compact">'
        +nutTile('Kalorien gegessen','t-panel','',tot.kcal,tg.kcal,'kcal')
        +nutTile('Protein','t-card','f-accent',tot.protein,tg.protein,'g')
        +nutTile('Kohlenhydrate','t-card','f-blue',tot.carbs,tg.carbs,'g')
        +nutTile('Fett','t-card','f-ink',tot.fat,tg.fat,'g')
      +'</div>'
      +(tg.set&&tg.note?'<p class="tg-src">'+esc(tg.note)+'</p>':''))
    +(future?'':flagHtml(date))
    +(future?'':'<section class="card meal-card" id="meal-card" style="margin-bottom:16px"><div class="kicker">Neuer Eintrag</div><h2 class="h2" style="margin:4px 0 16px">Essen eintragen</h2>'
      +'<form id="meal-form" class="meal-form" novalidate>'
        +'<div class="nm"><label class="lbl" for="m-name">Was hast du gegessen?</label><input class="field" id="m-name" data-live="mealf" data-k="name" autocomplete="off" placeholder="Zum Beispiel: Lachs mit Kartoffeln" value="'+esc(mf.name)+'"></div>'
        +formBody
      +'</form>'
    +'</section>')
    +(future&&!ms.length?'':'<section class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:14px"><div class="kicker">'+(date===today?'Heute gegessen':'Gegessen am '+esc(shortDate(date)))+'</div><span style="font-size:13px;color:var(--ink-2)">'+ms.length+(ms.length===1?' Eintrag':' Einträge')+'</span></div><p class="gram-hint">Alle Angaben in Gramm, nur die Kalorien in kcal.</p>'+list+'</section>');
};

/* ---------- Eingabe-Zustand ---------- */
BIND.mealf=(t)=>{UI.mealForm[t.dataset.k]=t.value;};
BIND.mealedit=(t)=>{if(UI.mealEdit)UI.mealEdit[t.dataset.k]=t.value;};
BIND.ingnew=(t)=>{const d=UI.ingNew[t.dataset.mid];if(d)d[t.dataset.k]=t.value;};
BIND.ingedit=(t)=>{if(UI.ingEdit)UI.ingEdit[t.dataset.k]=t.value;};
BIND.mealing=(t)=>{
  const it=UI.mealForm.ing&&UI.mealForm.ing[+t.dataset.i];
  if(!it)return;
  it[t.dataset.k]=t.value;
  const s=$('#mf-sum');if(s)s.innerHTML=mfSumHtml(UI.mealForm.ing);
};

/* Eintrag prüfen: fehlende kcal werden aus den Makros berechnet (4/4/9) */
function parseMeal(f){
  const name=(f.name||'').trim();
  if(!name)return {err:'Schreibe dazu, was du gegessen hast'};
  const n=nums(f);
  if(!(n.kcal>0))return {err:'Trage Kalorien oder Makros ein'};
  return {name,kcal:Math.round(n.kcal),protein:r1(n.protein),carbs:r1(n.carbs),fat:r1(n.fat)};
}
/* Zutatenliste aus dem Formular prüfen; leere Zeilen werden ignoriert */
function buildIngredients(list){
  const out=[];
  for(const it of list){
    if(!nonBlank(it))continue;
    const nm=(it.name||'').trim();
    if(!nm)return {err:'Gib jeder Zutat einen Namen'};
    const r=parseMeal(it);
    if(r.err)return {err:'Trage bei „'+nm+'“ Kalorien oder Makros ein'};
    out.push({id:uid(),name:r.name,kcal:r.kcal,protein:r.protein,carbs:r.carbs,fat:r.fat});
  }
  if(!out.length)return {err:'Trage mindestens eine Zutat ein'};
  return {ingredients:out};
}
/* Eine Mahlzeit ändern und speichern. Hat sie Zutaten, werden kcal/Makros aus deren Summe neu berechnet.
   fn kann false zurückgeben, um abzubrechen. */
function patchMeal(date,id,fn){
  const d=dayRef(date),i=(d.meals||[]).findIndex(m=>m.id===id);
  if(i<0)return false;
  const m=Object.assign({},d.meals[i]);
  if(fn(m)===false)return false;
  if(hasIng(m))Object.assign(m,sumIng(m.ingredients));
  d.meals=d.meals.slice();d.meals[i]=m;
  saveDay(date,{meals:d.meals});
  return true;
}
const nutDate=()=>UI.nutDate||TODAY();
const focusId=id=>{const n=document.getElementById(id);if(n)n.focus();return n;};

$('#view').addEventListener('submit',e=>{
  const fm=e.target.dataset&&e.target.dataset.form,date=nutDate();
  if(fm==='nf'){e.preventDefault();ACT['nf-confirm']();return;}
  if(fm==='ing-add'){
    e.preventDefault();
    const mid=e.target.dataset.mid,d=UI.ingNew[mid];
    if(!d)return;
    if(!(d.name||'').trim()){toast('Gib der Zutat einen Namen');return;}
    const r=parseMeal(d);
    if(r.err){toast(r.err);return;}
    const ok=patchMeal(date,mid,m=>{m.ingredients=(m.ingredients||[]).concat([{id:uid(),name:r.name,kcal:r.kcal,protein:r.protein,carbs:r.carbs,fat:r.fat}]);});
    if(!ok){toast('Der Eintrag existiert nicht mehr');return;}
    UI.ingNew[mid]=blankIng();UI.mealOpen[mid]=true;UI.ingAddOpen[mid]=true;
    render();focusId('in-'+mid+'-name');
    return;
  }
  if(fm==='ing-edit'){
    e.preventDefault();
    const ed=UI.ingEdit;if(!ed)return;
    if(!(ed.name||'').trim()){toast('Gib der Zutat einen Namen');return;}
    const r=parseMeal(ed);
    if(r.err){toast(r.err);return;}
    const ok=patchMeal(ed.date,ed.mealId,m=>{m.ingredients=(m.ingredients||[]).map(it=>it.id===ed.id?Object.assign({},it,r):it);});
    UI.ingEdit=null;render();
    toast(ok?'Zutat geändert':'Der Eintrag existiert nicht mehr');
    return;
  }
  if(e.target.id==='meal-edit-form'){
    e.preventDefault();
    const ed=UI.mealEdit;if(!ed)return;
    let ok;
    if(ed.ing){
      const name=(ed.name||'').trim();
      if(!name){toast('Schreibe dazu, was du gegessen hast');return;}
      ok=patchMeal(ed.date,ed.id,m=>{m.name=name;});
    }else{
      const r=parseMeal(ed);
      if(r.err){toast(r.err);return;}
      ok=patchMeal(ed.date,ed.id,m=>{Object.assign(m,r);});
    }
    UI.mealEdit=null;render();
    toast(ok?'Eintrag geändert':'Der Eintrag existiert nicht mehr');
    return;
  }
  if(e.target.id!=='meal-form')return;
  e.preventDefault();
  const f=UI.mealForm;
  let r;
  if(Array.isArray(f.ing)){
    const name=(f.name||'').trim();
    if(!name){toast('Schreibe dazu, was du gegessen hast');return;}
    const b=buildIngredients(f.ing);
    if(b.err){toast(b.err);return;}
    r=Object.assign({name,ingredients:b.ingredients},sumIng(b.ingredients));
  }else{
    r=parseMeal(f);
    if(r.err){toast(r.err);return;}
  }
  const d=dayRef(date);
  d.meals=(d.meals||[]).concat([Object.assign({id:uid()},r,{at:new Date().toISOString()})]);
  saveDay(date,{meals:d.meals});
  UI.mealForm=blankMeal();
  render();focusId('m-name');
  toast('Eintrag hinzugefügt');
});
/* Enter in einer Zutat des Formulars: nächste Zutat statt Speichern */
$('#view').addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  const t=e.target;
  if(!t||!t.dataset||t.dataset.live!=='mealing')return;
  e.preventDefault();
  const i=+t.dataset.i,list=UI.mealForm.ing||[];
  if(i===list.length-1){if(list[i]&&nonBlank(list[i]))ACT['mf-ing-add']();}
  else focusId('mi-name-'+(i+1));
});

/* ---------- Formular „Essen eintragen“: Zutaten ---------- */
ACT['mf-ing-on']=()=>{
  const f=UI.mealForm,first=blankIng();
  if(toNum(f.kcal)||toNum(f.protein)||toNum(f.carbs)||toNum(f.fat)){
    first.kcal=f.kcal;first.protein=f.protein;first.carbs=f.carbs;first.fat=f.fat;
    f.kcal=f.protein=f.carbs=f.fat='';
  }
  f.ing=[first];
  render();focusId('mi-name-0');
};
ACT['mf-ing-off']=()=>{
  const f=UI.mealForm,list=(f.ing||[]).filter(nonBlank);
  if(list.length){const s=sumIng(list);f.kcal=inputNum(s.kcal);f.protein=inputNum(s.protein);f.carbs=inputNum(s.carbs);f.fat=inputNum(s.fat);}
  f.ing=null;render();
};
ACT['mf-ing-add']=()=>{
  const f=UI.mealForm;if(!f.ing)return;
  f.ing.push(blankIng());
  render();focusId('mi-name-'+(f.ing.length-1));
};
ACT['mf-ing-rm']=t=>{
  const f=UI.mealForm;if(!f.ing)return;
  f.ing.splice(+t.dataset.i,1);
  if(!f.ing.length)f.ing.push(blankIng());
  render();
};

/* ---------- Bereits eingetragene Mahlzeiten ---------- */
ACT['meal-edit']=t=>{
  const date=nutDate(),m=mealsOf(date).find(x=>x.id===t.dataset.id);
  if(!m)return;
  UI.mealEdit={id:m.id,date,ing:hasIng(m),name:m.name||'',kcal:inputNum(m.kcal),protein:inputNum(m.protein),carbs:inputNum(m.carbs),fat:inputNum(m.fat)};
  render();
  const n=focusId('e-name');if(n&&n.select)n.select();
};
ACT['meal-edit-cancel']=()=>{UI.mealEdit=null;render();};
/* Eine Mahlzeit ohne Zutaten wird zu einer mit Zutaten: die bisherigen Werte werden die erste Zutat, die Summe bleibt gleich */
ACT['meal-split']=()=>{
  const ed=UI.mealEdit;if(!ed||ed.ing)return;
  const r=parseMeal(ed);
  if(r.err){toast(r.err);return;}
  const ok=patchMeal(ed.date,ed.id,m=>{
    m.name=r.name;
    m.ingredients=[{id:uid(),name:r.name,kcal:r.kcal,protein:r.protein,carbs:r.carbs,fat:r.fat}];
  });
  UI.mealEdit=null;
  if(ok){UI.mealOpen[ed.id]=true;UI.ingAddOpen[ed.id]=true;UI.ingNew[ed.id]=blankIng();}
  render();
  if(ok){toast('Werte als erste Zutat übernommen. Füge weitere hinzu.');focusId('in-'+ed.id+'-name');}
};
ACT['meal-toggle']=t=>{
  const id=t.dataset.id;
  UI.mealOpen[id]=!UI.mealOpen[id];
  if(!UI.mealOpen[id])delete UI.ingAddOpen[id];
  render();
};
ACT['ing-add-open']=t=>{UI.ingAddOpen[t.dataset.mid]=true;render();focusId('in-'+t.dataset.mid+'-name');};
ACT['ing-add-close']=t=>{delete UI.ingAddOpen[t.dataset.mid];UI.ingNew[t.dataset.mid]=blankIng();render();};
ACT['meal-del']=t=>{
  const date=nutDate(),d=dayRef(date);
  d.meals=(d.meals||[]).filter(m=>m.id!==t.dataset.id);
  saveDay(date,{meals:d.meals});
  if(UI.mealEdit&&UI.mealEdit.id===t.dataset.id)UI.mealEdit=null;
  if(UI.ingEdit&&UI.ingEdit.mealId===t.dataset.id)UI.ingEdit=null;
  delete UI.mealOpen[t.dataset.id];delete UI.ingNew[t.dataset.id];delete UI.ingAddOpen[t.dataset.id];
  render();toast('Eintrag gelöscht');
};
ACT['ing-edit']=t=>{
  const date=nutDate(),m=mealsOf(date).find(x=>x.id===t.dataset.mid),it=m&&(m.ingredients||[]).find(x=>x.id===t.dataset.id);
  if(!it)return;
  UI.ingEdit={mealId:m.id,id:it.id,date,name:it.name||'',kcal:inputNum(it.kcal),protein:inputNum(it.protein),carbs:inputNum(it.carbs),fat:inputNum(it.fat)};
  render();
  const n=focusId('ie-name');if(n&&n.select)n.select();
};
ACT['ing-edit-cancel']=()=>{UI.ingEdit=null;render();};
ACT['ing-del']=t=>{
  const ok=patchMeal(nutDate(),t.dataset.mid,m=>{
    if(!hasIng(m)||m.ingredients.length<2)return false;
    m.ingredients=m.ingredients.filter(it=>it.id!==t.dataset.id);
  });
  if(UI.ingEdit&&UI.ingEdit.id===t.dataset.id)UI.ingEdit=null;
  render();
  toast(ok?'Zutat gelöscht':'Eine Zutat muss bleiben. Lösche sonst den ganzen Eintrag.');
};

/* ---------- Tag wechseln ---------- */
const resetNutEdit=()=>{UI.mealEdit=null;UI.ingEdit=null;UI.nfDraft=null;};
ACT['nut-prev']=()=>{resetNutEdit();const n=addDays(UI.nutDate||TODAY(),-1);UI.nutDate=n===TODAY()?null:n;render();};
ACT['nut-next']=()=>{const n=addDays(UI.nutDate||TODAY(),1);if(n>addDays(TODAY(),NUT_AHEAD_DAYS))return;resetNutEdit();UI.nutDate=n===TODAY()?null:n;render();};
ACT['nut-today']=()=>{resetNutEdit();UI.nutDate=null;render();};
