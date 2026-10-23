'use strict';
/* Reiter Training, Unterreiter Übungsbibliothek */
/* ---------- Training: Übungsbibliothek ---------- */
const blankForm=()=>({id:null,name:'',group:'Brust',desc:''});
function libRows(){
  const q=UI.exSearch.trim().toLowerCase(),f=UI.exFilter;
  const list=S.exercises.filter(e=>(f==='Alle'||e.group===f)&&(!q||(String(e.name)+' '+String(e.desc||'')).toLowerCase().includes(q)));
  if(!list.length){
    return S.exercises.length
      ?'<div class="empty"><b>Keine Treffer</b>Ändere Suche oder Filter.</div>'
      :'<div class="empty"><b>Die Bibliothek ist leer</b>Lege links deine erste Übung an.</div>';
  }
  return list.map(e=>{
    const armed=UI.confirmDel==='ex:'+e.id;
    return '<div class="librow"><div class="nm">'+esc(e.name)+'<span class="tag">'+esc(e.group||'')+'</span></div><div class="ds">'+esc(e.desc||'')+'</div>'
      +'<div class="ac"><button type="button" class="iconb" data-act="ex-edit" data-id="'+esc(e.id)+'" aria-label="'+esc(e.name)+' bearbeiten">'+I.edit+'</button>'
      +(armed?'<button type="button" class="iconb armed" data-confirm data-act="ex-del" data-id="'+esc(e.id)+'">Löschen?</button>'
        :'<button type="button" class="iconb" data-confirm data-act="ex-del" data-id="'+esc(e.id)+'" aria-label="'+esc(e.name)+' löschen">'+I.trash+'</button>')+'</div></div>';
  }).join('');
}
function libView(){
  const f=UI.exForm||(UI.exForm=blankForm()),editing=!!f.id;
  const gchips=GROUPS.map(g=>'<button type="button" class="chip" data-act="exf-group" data-g="'+g+'" aria-pressed="'+(f.group===g)+'">'+g+'</button>').join('');
  const filt=['Alle'].concat(GROUPS).map(g=>'<button type="button" class="chip" data-act="ex-filter" data-g="'+g+'" aria-pressed="'+(UI.exFilter===g)+'">'+g+'</button>').join('');
  const form='<section class="card"><div class="kicker">'+(editing?'Bearbeiten':'Neu anlegen')+'</div><h2 class="h2" style="margin:4px 0 20px">'+(editing?'Übung bearbeiten':'Neue Übung')+'</h2>'
    +'<div class="fgroup"><label class="lbl" for="exf-name">Name</label><input class="field" id="exf-name" data-live="exf" data-k="name" autocomplete="off" placeholder="Zum Beispiel: Rudern am Kabel" value="'+esc(f.name)+'"></div>'
    +'<div class="fgroup"><span class="lbl">Art der Übung</span><div class="choices" role="group">'+gchips+'</div></div>'
    +'<div class="fgroup"><label class="lbl" for="exf-desc">Kurzbeschreibung</label><textarea class="field" id="exf-desc" maxlength="140" data-live="exf" data-k="desc" placeholder="Ein bis zwei Sätze: Ausgangsposition, Bewegung, worauf du achtest." style="min-height:110px">'+esc(f.desc)+'</textarea><div class="cnt" id="exf-cnt">'+f.desc.length+' / 140 Zeichen</div></div>'
    +'<button type="button" class="btn pri block" data-act="exf-save">'+(editing?'Änderung speichern':'Übung speichern')+'</button>'
    +(editing?'<button type="button" class="btn block" style="margin-top:10px" data-act="exf-cancel">Abbrechen</button>':'')+'</section>';
  const list='<section class="card"><div class="libtop"><input class="field" id="ex-search" data-live="exsearch" type="search" placeholder="Übung suchen" aria-label="Übung suchen" value="'+esc(UI.exSearch)+'"><div class="choices" role="group" aria-label="Filter">'+filt+'</div></div><div id="lib-list">'+libRows()+'</div></section>';
  return '<div class="grid2 lib">'+form+list+'</div>';
}
BIND.exf=t=>{
  const f=UI.exForm||(UI.exForm=blankForm());
  f[t.dataset.k]=t.value;
  if(t.dataset.k==='desc'){const c=$('#exf-cnt');if(c)c.textContent=t.value.length+' / 140 Zeichen';}
};
BIND.exsearch=t=>{UI.exSearch=t.value;const l=$('#lib-list');if(l)l.innerHTML=libRows();};
ACT['exf-group']=t=>{(UI.exForm||(UI.exForm=blankForm())).group=t.dataset.g;render();};
ACT['ex-filter']=t=>{UI.exFilter=t.dataset.g;render();};
ACT['ex-edit']=t=>{
  const e=S.exercises.find(x=>x.id===t.dataset.id);if(!e)return;
  UI.exForm={id:e.id,name:e.name||'',group:e.group||'Brust',desc:e.desc||''};
  render();window.scrollTo({top:0,behavior:'smooth'});
};
ACT['exf-cancel']=()=>{UI.exForm=blankForm();render();};
ACT['exf-save']=()=>{
  const f=UI.exForm||(UI.exForm=blankForm()),name=f.name.trim();
  if(!name){toast('Gib der Übung einen Namen');return;}
  const dup=S.exercises.find(e=>e.name.trim().toLowerCase()===name.toLowerCase()&&e.id!==f.id);
  if(dup){toast('Diese Übung gibt es schon');return;}
  const id=f.id||uid();
  const doc={name,group:f.group,desc:f.desc.trim().slice(0,140),timed:false};
  const i=S.exercises.findIndex(e=>e.id===id);
  if(i>=0)S.exercises[i]=Object.assign({id},doc);else S.exercises.push(Object.assign({id},doc));
  S.exercises.sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
  setDoc('exercises/'+id,doc);
  const edited=!!f.id;
  UI.exForm=blankForm();
  render();toast(edited?'Übung aktualisiert':'Übung gespeichert');
};
ACT['ex-del']=t=>{
  const k='ex:'+t.dataset.id;
  if(UI.confirmDel!==k){UI.confirmDel=k;render();return;}
  UI.confirmDel=null;
  S.exercises=S.exercises.filter(e=>e.id!==t.dataset.id);
  delDoc('exercises/'+t.dataset.id);
  render();toast('Übung gelöscht');
};
