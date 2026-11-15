'use strict';
/* Reiter Ernährung: Tagesansicht und Mahlzeiten (Anzeige und Löschen; eingetragen und geändert wird von Claude per Datenbankfunktion) */
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
const numCells=t=>'<td>'+f0(t.kcal)+'</td><td>'+f0(t.protein)+'</td><td>'+f0(t.carbs)+'</td><td>'+f0(t.fat)+'</td>';

/* Mahlzeiten trägt Claude ein und ändert sie (log_meal, update_meal, delete_meal). In der Seite kann man eine ganze Mahlzeit nur löschen (mit Rückfrage), sonst nichts. */
function mealRows(m){
  const ing=hasIng(m),t=mealTot(m),open=ing&&!!UI.mealOpen[m.id];
  const nm=ing
    ?'<button type="button" class="mexp" data-act="meal-toggle" data-id="'+esc(m.id)+'" aria-expanded="'+open+'" aria-label="Zutaten von '+esc(m.name)+' '+(open?'einklappen':'aufklappen')+'">'+I.right+'<span class="mn">'+esc(m.name)+' <span class="tag">'+m.ingredients.length+(m.ingredients.length===1?' Zutat':' Zutaten')+'</span></span></button>'
    :esc(m.name);
  const armed=UI.confirmDel==='meal:'+m.id;
  const del=armed
    ?'<button type="button" class="iconb armed" data-confirm data-act="meal-del" data-id="'+esc(m.id)+'" aria-label="'+esc(m.name)+' wirklich löschen?" title="Wirklich löschen?"><span class="lt">Löschen?</span>'+I.trash+'</button>'
    :'<button type="button" class="iconb" data-confirm data-act="meal-del" data-id="'+esc(m.id)+'" aria-label="'+esc(m.name)+' löschen" title="Löschen">'+I.trash+'</button>';
  let html='<tr class="mrow"><td>'+nm+'</td>'+numCells(t)+'<td><div class="macts">'+del+'</div></td></tr>';
  if(open)html+=m.ingredients.map(it=>'<tr class="ing"><td>'+esc(it.name)+'</td>'+numCells(nums(it))+'<td></td></tr>').join('');
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
  const today=TODAY(),date=UI.nutDate||today,tg=targetsFor(date),ms=mealsOf(date),tot=sumMeals(ms);
  const minDate=firstDate(),maxDate=addDays(today,NUT_AHEAD_DAYS),future=date>today;
  const rows=ms.map(mealRows).join('');
  const list=ms.length
    ?'<div class="tablewrap"><table class="mt"><thead><tr><th>Eintrag</th><th>kcal</th><th>P</th><th>KH</th><th>F</th><th></th></tr></thead><tbody>'+rows+'</tbody>'
      +'</table></div>'
    :'<div class="empty"><b>Noch nichts eingetragen</b>Mahlzeiten trägt Claude für dich ein.</div>';
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
        +'</div>'+(tg.note?'<p class="tg-src">'+esc(tg.note)+'</p>':'')
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
    +(future&&!ms.length?'':'<section class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:14px"><div class="kicker">'+(date===today?'Heute gegessen':'Gegessen am '+esc(shortDate(date)))+'</div><span style="font-size:13px;color:var(--ink-2)">'+ms.length+(ms.length===1?' Eintrag':' Einträge')+'</span></div><p class="gram-hint">Alle Angaben in Gramm, nur die Kalorien in kcal.</p>'+list+'</section>');
};

const nutDate=()=>UI.nutDate||TODAY();
const focusId=id=>{const n=document.getElementById(id);if(n)n.focus();return n;};

/* Einziges Formular im Reiter: Grund für „ungenau getrackt“ */
$('#view').addEventListener('submit',e=>{
  if(e.target.dataset&&e.target.dataset.form==='nf'){e.preventDefault();ACT['nf-confirm']();}
});

/* Zutaten einer Mahlzeit auf- und zuklappen */
ACT['meal-toggle']=t=>{const id=t.dataset.id;UI.mealOpen[id]=!UI.mealOpen[id];render();};
/* Eine ganze Mahlzeit löschen: erster Klick fragt nach („Löschen?“), der zweite löscht */
ACT['meal-del']=t=>{
  const id=t.dataset.id,k='meal:'+id,date=nutDate();
  if(UI.confirmDel!==k){UI.confirmDel=k;render();return;}
  UI.confirmDel=null;
  const d=dayRef(date);
  d.meals=(d.meals||[]).filter(m=>m.id!==id);
  saveDay(date,{meals:d.meals});
  delete UI.mealOpen[id];
  render();toast('Eintrag gelöscht');
};

/* ---------- Tag wechseln ---------- */
const resetNutEdit=()=>{UI.nfDraft=null;UI.confirmDel=null;};
ACT['nut-prev']=()=>{resetNutEdit();const n=addDays(UI.nutDate||TODAY(),-1);UI.nutDate=n===TODAY()?null:n;render();};
ACT['nut-next']=()=>{const n=addDays(UI.nutDate||TODAY(),1);if(n>addDays(TODAY(),NUT_AHEAD_DAYS))return;resetNutEdit();UI.nutDate=n===TODAY()?null:n;render();};
ACT['nut-today']=()=>{resetNutEdit();UI.nutDate=null;render();};
