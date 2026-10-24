'use strict';
/* Reiter Wissen: Dokumente aus der Sammlung wissen, nur zum Lesen */
/* ---------- Wissen ----------
   Zentrale Sammlung wissen/<id>: Vorlieben, Regeln, Auswertung, Datenmodell. Jedes Dokument beschreibt sich selbst:
   {title,intro,order,fold?,layout?,updatedAt,items:[{key,group,label,kind,value,unit?,hint?,columns?}]}.
   kind: number, text, bool oder table (Spalten in columns, Zeilen in value).
   Die Seite enthält keine Werte, sie zeichnet nur, was in der Sammlung steht, und ändert nichts daran: Nur Claude schreibt
   in diese Dokumente (siehe ki/systemprompt). Das Datenmodell (layout 'model') ist für Claude und wird hier nicht gezeigt. */
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
function wzTable(it){
  const cols=it.columns||[],rows=Array.isArray(it.value)?it.value:[];
  if(!rows.length)return '<p class="wz-hint">Keine Einträge.</p>';
  const head='<tr>'+cols.map(c=>'<th scope="col">'+esc(c.label)+(c.unit?' <span class="wz-u">('+esc(c.unit)+')</span>':'')+'</th>').join('')+'</tr>';
  const body=rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(wzCellText(c,r[c.k]))+'</td>').join('')+'</tr>').join('');
  return '<div class="tablewrap"><table class="wz-tbl"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
}
function wzItem(it){
  const hint=it.hint?'<p class="wz-hint">'+esc(it.hint)+'</p>':'';
  if(it.kind==='table')return '<div class="wz-item wz-wide"><div class="wz-k">'+esc(it.label)+'</div>'+wzTable(it)+hint+'</div>';
  if(it.kind==='text')return '<div class="wz-item wz-wide"><div class="wz-k">'+esc(it.label)+'</div><p class="wz-p">'+esc(it.value||'')+'</p>'+hint+'</div>';
  const v=it.kind==='bool'?(it.value?'Ja':'Nein'):inputNum(it.value);
  return '<div class="wz-item"><div class="wz-line"><span class="wz-k">'+esc(it.label)+'</span><span class="wz-v"><b>'+esc(v)+'</b>'+(it.unit?' <span class="wz-unit">'+esc(it.unit)+'</span>':'')+'</span></div>'+hint+'</div>';
}
function wzGroups(items){
  const groups=[];
  items.forEach(it=>{const g=it.group||'Allgemein';let x=groups.find(y=>y.g===g);if(!x){x={g,items:[]};groups.push(x);}x.items.push(it);});
  return groups;
}
function wzBody(items){
  return wzGroups(items).map(g=>'<div class="wz-grp"><div class="kicker">'+esc(g.g)+'</div><div class="wz-items">'+g.items.map(wzItem).join('')+'</div></div>').join('');
}
function wzSection(d){
  const id=d.id,items=d.items||[],meta=items.length+(items.length===1?' Eintrag':' Einträge');
  const inner=(d.intro?'<p class="wz-sub">'+esc(d.intro)+'</p>':'')+wzBody(items)
    +(d.updatedAt?'<div class="wz-bar"><span class="wz-when">Zuletzt geändert '+esc(wzWhen(d.updatedAt))+'</span></div>':'');
  if(d.fold)return '<details class="card wz" data-wz="'+esc(id)+'"'+(UI.wOpen[id]?' open':'')+'><summary><h2 class="h3">'+esc(d.title)+'</h2><span class="wz-meta">'+meta+'</span></summary>'+inner+'</details>';
  return '<section class="card wz"><div class="wz-head"><h2 class="h2">'+esc(d.title)+'</h2><span class="wz-meta">'+meta+'</span></div>'+inner+'</section>';
}
function wissenHtml(){
  if(UI.wErr)return '<div class="empty wz"><b>Wissen konnte nicht geladen werden</b>Lade die Seite neu. Wenn es bleibt, melde dich ab und wieder an.</div>';
  if(!LOADED.wissen)return '<div class="empty wz"><b>Lade Wissen</b>Einen Moment.</div>';
  const docs=wzDocs();
  if(!docs.length)return '<div class="empty wz"><b>Noch kein Wissen angelegt</b>Hier erscheinen deine Vorlieben, die Regeln für Training und Ernährung und die Auswertung. Bitte Claude im Chat, sie anzulegen.</div>';
  return docs.map(wzSection).join('');
}
