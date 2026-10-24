'use strict';
/* Reiter Wissen: Dokumente aus der Sammlung wissen, nur zum Lesen */
/* ---------- Wissen ----------
   Zentrale Sammlung wissen/<id>: Vorlieben, Regeln, Auswertung, Datenmodell. Jedes Dokument beschreibt sich selbst:
   {title,intro,order,layout?,updatedAt,items:[{key,group,label,kind,value,unit?,hint?,columns?}]}.
   kind: number, text, bool, list (value = Liste von Sätzen) oder table (Spalten in columns, Zeilen in value).
   group darf "Hauptgruppe: Untergruppe" heißen; die Seite gliedert danach in eine Überschrift und darunter Felder je Untergruppe.
   Die Seite enthält keine Werte, sie zeichnet nur, was in der Sammlung steht, und ändert nichts daran: Nur Claude schreibt
   in diese Dokumente (siehe ki/systemprompt). Jedes Dokument ist ein Block, der sich ein- und ausklappen lässt (zu Beginn zu).
   Das Datenmodell (layout 'model') ist für Claude und wird hier nicht gezeigt. */
function wzDocs(){
  return Object.keys(S.wissen).map(id=>Object.assign({id},S.wissen[id])).filter(d=>d.layout!=='model')
    .sort((a,b)=>((a.order==null?99:a.order)-(b.order==null?99:b.order))||a.id.localeCompare(b.id));
}
function wzWhen(s){
  try{return new Date(s).toLocaleString('de-DE',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}
}
function wzCellText(c,v){
  if(c.kind==='select'){const o=(c.options||[]).find(x=>String(x[0])===String(v));return o?o[1]:(v==null?'':String(v));}
  if(c.kind==='text'||c.kind==='time')return v==null?'':String(v);
  return inputNum(v);
}
/* Tabellen werden je Zeile als kleine Karte gezeigt: erste Spalte als Titel, die übrigen als Felder mit Beschriftung.
   Das bleibt auch auf dem Handy lesbar, ohne seitlich zu scrollen. Bei nur zwei Spalten steht der Wert rechts neben dem Titel. */
function wzCellHtml(c,r){
  const t=wzCellText(c,r[c.k]);
  return t===''?'':esc(t)+(c.unit?' <span class="wz-unit">'+esc(c.unit)+'</span>':'');
}
function wzTable(it){
  const cols=it.columns||[],rows=Array.isArray(it.value)?it.value:[];
  if(!rows.length||!cols.length)return '<p class="wz-hint">Keine Einträge.</p>';
  const first=cols[0],rest=cols.slice(1);
  return '<div class="wz-rows">'+rows.map(r=>{
    const title=esc(wzCellText(first,r[first.k]));
    if(rest.length===1){
      const v=wzCellHtml(rest[0],r);
      return '<div class="wz-row wz-row2"><span class="wz-rt">'+title+'</span><span class="wz-v">'+(v?'<b>'+v+'</b>':'–')+'</span></div>';
    }
    const cells=rest.map(c=>{
      const v=wzCellHtml(c,r);
      return v?'<div'+(c.kind==='text'?' class="wz-dw"':'')+'><dt>'+esc(c.label)+'</dt><dd>'+v+'</dd></div>':'';
    }).join('');
    return '<div class="wz-row"><div class="wz-rt">'+title+'</div>'+(cells?'<dl class="wz-dl">'+cells+'</dl>':'')+'</div>';
  }).join('')+'</div>';
}
function wzList(it){
  const rows=(Array.isArray(it.value)?it.value:[]).filter(x=>x!=null&&String(x).trim()!=='');
  if(!rows.length)return '<p class="wz-hint">Keine Einträge.</p>';
  return '<ul class="wz-list">'+rows.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
}
function wzItem(it){
  const hint=it.hint?'<p class="wz-hint">'+esc(it.hint)+'</p>':'';
  if(it.kind==='table')return '<div class="wz-item wz-wide"><div class="wz-k">'+esc(it.label)+'</div>'+wzTable(it)+hint+'</div>';
  if(it.kind==='list')return '<div class="wz-item wz-wide"><div class="wz-k">'+esc(it.label)+'</div>'+wzList(it)+hint+'</div>';
  if(it.kind==='text')return '<div class="wz-item wz-wide"><div class="wz-k">'+esc(it.label)+'</div><p class="wz-p">'+esc(it.value||'')+'</p>'+hint+'</div>';
  const v=it.kind==='bool'?(it.value?'Ja':'Nein'):typeof it.value==='string'?it.value:inputNum(it.value); /* Text wie "60 bis 90" bleibt, wie er ist */
  return '<div class="wz-item"><div class="wz-line"><span class="wz-k">'+esc(it.label)+'</span><span class="wz-v"><b>'+esc(v)+'</b>'+(it.unit?' <span class="wz-unit">'+esc(it.unit)+'</span>':'')+'</span></div>'+hint+'</div>';
}
/* "Training: Wochenaufbau" -> Hauptgruppe "Training", Untergruppe "Wochenaufbau" */
function wzSplit(g){
  const i=g.indexOf(': ');
  return i<0?{main:g,sub:''}:{main:g.slice(0,i),sub:g.slice(i+2)};
}
function wzGroups(items){
  const mains=[];
  items.forEach(it=>{
    const p=wzSplit(it.group||'Allgemein');
    let m=mains.find(x=>x.main===p.main);if(!m){m={main:p.main,subs:[]};mains.push(m);}
    let s=m.subs.find(x=>x.sub===p.sub);if(!s){s={sub:p.sub,items:[]};m.subs.push(s);}
    s.items.push(it);
  });
  return mains;
}
function wzBody(items){
  return wzGroups(items).map(m=>'<div class="wz-main"><h3 class="wz-mh">'+esc(m.main)+'</h3>'
    +m.subs.map(s=>'<div class="wz-subgrp">'+(s.sub?'<div class="kicker">'+esc(s.sub)+'</div>':'')
      +'<div class="wz-items">'+s.items.map(wzItem).join('')+'</div></div>').join('')
    +'</div>').join('');
}
function wzSection(d){
  const id=d.id,items=d.items||[],meta=items.length+(items.length===1?' Eintrag':' Einträge');
  const inner=(d.intro?'<p class="wz-sub">'+esc(d.intro)+'</p>':'')+wzBody(items)
    +(d.updatedAt?'<div class="wz-bar"><span class="wz-when">Zuletzt geändert '+esc(wzWhen(d.updatedAt))+'</span></div>':'');
  return '<details class="card wz" data-wz="'+esc(id)+'"'+(UI.wOpen[id]?' open':'')+'><summary><h2 class="h3">'+esc(d.title)+'</h2><span class="wz-meta">'+meta+'</span></summary>'+inner+'</details>';
}
function wissenHtml(){
  if(UI.wErr)return '<div class="empty wz"><b>Wissen konnte nicht geladen werden</b>Lade die Seite neu. Wenn es bleibt, melde dich ab und wieder an.</div>';
  if(!LOADED.wissen)return '<div class="empty wz"><b>Lade Wissen</b>Einen Moment.</div>';
  const docs=wzDocs();
  if(!docs.length)return '<div class="empty wz"><b>Noch kein Wissen angelegt</b>Hier erscheinen deine Vorlieben, die Regeln für Training und Ernährung und die Auswertung. Bitte Claude im Chat, sie anzulegen.</div>';
  return docs.map(wzSection).join('');
}
