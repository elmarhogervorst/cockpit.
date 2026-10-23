'use strict';
/* Reiter Wissen: Dokumente aus der Sammlung wissen */
/* ---------- Wissen ----------
   Zentrale Sammlung wissen/<id>: Vorlieben, Regeln, Auswertung, Datenmodell. Jedes Dokument beschreibt sich selbst:
   {title,intro,order,fold?,layout?,updatedAt,items:[{key,group,label,kind,value,unit?,hint?,step?,min?,max?,review?,columns?,editRows?,addLabel?}]}.
   kind: number, text, bool, table (Spalten in columns, Zeilen in value) oder model (nur Datenmodell, layout 'model').
   Die Seite enthält keine Werte, sie zeichnet nur, was in der Sammlung steht. Claude liest dieselben Dokumente bei jeder Planung und Auswertung. */
const wzSlug=k=>String(k).replace(/[^A-Za-z0-9]/g,'_');
function wzDocs(){
  return Object.keys(S.wissen).map(id=>Object.assign({id},S.wissen[id])).sort((a,b)=>((a.order==null?99:a.order)-(b.order==null?99:b.order))||a.id.localeCompare(b.id));
}
function wzItems(id){
  if(!UI.wDraft[id]){
    UI.wDraft[id]=clone((S.wissen[id]&&S.wissen[id].items)||[]);
    UI.wDirty[id]=false;UI.wBase[id]=(S.wissen[id]&&S.wissen[id].updatedAt)||null;
  }
  return UI.wDraft[id];
}
const wzItem=(id,key)=>wzItems(id).find(i=>i.key===key);
function wzTouch(id){
  UI.wDirty[id]=true;
  $$('[data-wz-bar="'+id+'"] button').forEach(b=>{b.disabled=false;});
}
function wzWhen(s){
  try{return new Date(s).toLocaleString('de-DE',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}
}
function wzCell(id,it,c,r,ri){
  const v=r[c.k];
  if(c.readonly)return '<span class="wz-ro">'+esc(c.kind==='text'?v:inputNum(v))+'</span>';
  const at=' data-live="wzc" data-bind="wzc" data-doc="'+id+'" data-key="'+esc(it.key)+'" data-row="'+ri+'" data-col="'+esc(c.k)+'" aria-label="'+esc(c.label+', Zeile '+(ri+1))+'"';
  if(c.kind==='select')return '<select class="field wz-cell"'+at+'>'+(c.options||[]).map(o=>'<option value="'+esc(o[0])+'"'+(String(v)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
  if(c.kind==='time')return '<input class="field wz-cell wz-celltime" type="time"'+at+' value="'+esc(v||'')+'">';
  if(c.kind==='text')return '<input class="field wz-cell wz-celltxt" type="text" maxlength="120" autocomplete="off"'+at+' value="'+esc(v||'')+'">';
  return '<input class="field wz-cell wz-cellnum" inputmode="decimal"'+at+' value="'+esc(inputNum(v))+'">';
}
function wzTable(id,it,fid){
  const cols=it.columns||[],rows=Array.isArray(it.value)?it.value:[];
  const head='<tr>'+cols.map(c=>'<th scope="col">'+esc(c.label)+(c.unit?' <span class="wz-u">('+esc(c.unit)+')</span>':'')+'</th>').join('')+(it.editRows?'<th scope="col" aria-label="Zeile entfernen"></th>':'')+'</tr>';
  const body=rows.map((r,ri)=>'<tr>'+cols.map(c=>'<td>'+wzCell(id,it,c,r,ri)+'</td>').join('')
    +(it.editRows?'<td><button type="button" class="iconb" data-act="wz-row-del" data-doc="'+id+'" data-key="'+esc(it.key)+'" data-row="'+ri+'" aria-label="Zeile '+(ri+1)+' entfernen" title="Zeile entfernen">'+I.trash+'</button></td>':'')+'</tr>').join('');
  return '<div class="tablewrap" id="'+fid+'"><table class="wz-tbl"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'
    +(it.editRows?'<button type="button" class="btn sm" style="margin-top:10px" data-act="wz-row-add" data-doc="'+id+'" data-key="'+esc(it.key)+'">'+esc(it.addLabel||'Zeile hinzufügen')+'</button>':'');
}
function wzField(id,it){
  const fid='wz-'+id+'-'+wzSlug(it.key),ak=' data-doc="'+id+'" data-key="'+esc(it.key)+'"';
  const rev=it.review?'<span class="tag wz-rev">bitte prüfen</span>':'';
  let ctl='',focusable=false;
  if(it.kind==='number'){
    focusable=true;
    ctl='<div class="wz-nw"><input class="field wz-num" id="'+fid+'" inputmode="decimal" data-live="wz" data-bind="wz"'+ak+' value="'+esc(inputNum(it.value))+'">'+(it.unit?'<span class="wz-unit">'+esc(it.unit)+'</span>':'')+'</div>';
  }else if(it.kind==='bool'){
    ctl='<div class="choices" role="group" aria-labelledby="'+fid+'-l">'+[[true,'Ja'],[false,'Nein']].map(o=>'<button type="button" class="chip" data-act="wz-bool"'+ak+' data-v="'+o[0]+'" aria-pressed="'+(!!it.value===o[0])+'">'+o[1]+'</button>').join('')+'</div>';
  }else if(it.kind==='text'){
    focusable=true;
    ctl='<textarea class="field wz-txt" id="'+fid+'" rows="2" maxlength="600" data-live="wz"'+ak+'>'+esc(it.value||'')+'</textarea>';
  }else if(it.kind==='table'){
    ctl=wzTable(id,it,fid);
  }
  const wide=it.kind==='table'||it.kind==='text';
  const lbl=focusable?'<label class="lbl" id="'+fid+'-l" for="'+fid+'">':'<div class="lbl" id="'+fid+'-l">';
  return '<div class="fgroup wz-f'+(wide?' wz-wide':'')+'">'+lbl+esc(it.label)+rev+(focusable?'</label>':'</div>')+ctl
    +(it.hint?'<p class="wz-hint">'+esc(it.hint)+'</p>':'')
    +(it.review?'<button type="button" class="btn sm" style="margin-top:10px" data-act="wz-ok"'+ak+'>Passt so</button>':'')+'</div>';
}
function wzGroups(items){
  const groups=[];
  items.forEach(it=>{const g=it.group||'Allgemein';let x=groups.find(y=>y.g===g);if(!x){x={g,items:[]};groups.push(x);}x.items.push(it);});
  return groups;
}
function wzBody(id,items){
  return wzGroups(items).map(g=>'<div class="wz-grp"><div class="kicker">'+esc(g.g)+'</div><div class="wz-grid">'+g.items.map(it=>wzField(id,it)).join('')+'</div></div>').join('');
}
function wzModelBody(items){
  return wzGroups(items).map(g=>'<div class="wz-grp"><div class="kicker">'+esc(g.g)+'</div><div class="tablewrap"><table class="wz-model"><thead><tr><th scope="col">Feld</th><th scope="col">Typ</th><th scope="col">Bedeutung</th></tr></thead><tbody>'
    +g.items.map(it=>'<tr><td class="wz-path">'+esc(String(it.key).replace(/^[a-z]+\./,''))+'</td><td>'+esc(it.typ||'')+(it.pflicht?' <span class="tag">Pflicht</span>':'')+'</td><td>'+esc(it.label||'')
      +(it.werte&&it.werte.length?'<div class="wz-vals">'+esc(it.werte.join(', '))+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div></div>').join('');
}
function wzBar(id,d){
  const dirty=!!UI.wDirty[id];
  return '<div class="wz-bar" data-wz-bar="'+id+'"><button type="button" class="btn pri" data-act="wz-save" data-doc="'+id+'"'+(dirty?'':' disabled')+'>Speichern</button>'
    +'<button type="button" class="btn" data-act="wz-reset" data-doc="'+id+'"'+(dirty?'':' disabled')+'>Verwerfen</button>'
    +(d.updatedAt?'<span class="wz-when">Zuletzt geändert '+esc(wzWhen(d.updatedAt))+'</span>':'')+'</div>';
}
function wzSection(d){
  const id=d.id,model=d.layout==='model',items=model?(d.items||[]):wzItems(id);
  const nrev=model?0:items.filter(i=>i.review).length;
  const meta=items.length+(model?' Felder':' Einträge')+(nrev?' · '+nrev+' zu prüfen':'');
  const inner=(d.intro?'<p class="wz-sub">'+esc(d.intro)+'</p>':'')+(model?wzModelBody(items)+(d.updatedAt?'<div class="wz-bar"><span class="wz-when">Zuletzt geändert '+esc(wzWhen(d.updatedAt))+'</span></div>':''):wzBody(id,items)+wzBar(id,d));
  if(d.fold)return '<details class="card wz" data-wz="'+id+'"'+(UI.wOpen[id]?' open':'')+'><summary><h2 class="h3">'+esc(d.title)+'</h2><span class="wz-meta">'+meta+'</span></summary>'+inner+'</details>';
  return '<section class="card wz"><div class="wz-head"><h2 class="h2">'+esc(d.title)+'</h2><span class="wz-meta">'+meta+'</span></div>'+inner+'</section>';
}
function wissenHtml(){
  if(UI.wErr)return '<div class="empty wz"><b>Wissen konnte nicht geladen werden</b>Lade die Seite neu. Wenn es bleibt, melde dich ab und wieder an.</div>';
  if(!LOADED.wissen)return '<div class="empty wz"><b>Lade Wissen</b>Einen Moment.</div>';
  const docs=wzDocs();
  if(!docs.length)return '<div class="empty wz"><b>Noch kein Wissen angelegt</b>Hier erscheinen deine Vorlieben, die Regeln für Training und Ernährung und das Datenmodell. Bitte Claude im Chat, sie anzulegen.</div>';
  return docs.map(wzSection).join('');
}
BIND.wz=(t,e,kind)=>{
  const it=wzItem(t.dataset.doc,t.dataset.key);if(!it)return;
  if(it.kind==='number'){const v=toNum(t.value);it.value=v;if(kind==='change'&&v!=null)t.value=inputNum(v);}
  else it.value=t.value.slice(0,600);
  wzTouch(t.dataset.doc);
};
BIND.wzc=(t,e,kind)=>{
  const it=wzItem(t.dataset.doc,t.dataset.key);if(!it||!Array.isArray(it.value))return;
  const r=it.value[+t.dataset.row],c=(it.columns||[]).find(x=>x.k===t.dataset.col);if(!r||!c)return;
  if(c.kind==='select'||c.kind==='time'||c.kind==='text')r[c.k]=t.value;
  else{const v=toNum(t.value);r[c.k]=v;if(kind==='change'&&v!=null)t.value=inputNum(v);}
  wzTouch(t.dataset.doc);
};
ACT['wz-bool']=t=>{const it=wzItem(t.dataset.doc,t.dataset.key);if(!it)return;it.value=t.dataset.v==='true';wzTouch(t.dataset.doc);render();};
ACT['wz-row-add']=t=>{
  const it=wzItem(t.dataset.doc,t.dataset.key);if(!it)return;
  const r={};
  (it.columns||[]).forEach(c=>{r[c.k]=c.kind==='select'?((c.options&&c.options[0])?c.options[0][0]:''):(c.kind==='text'||c.kind==='time')?'':null;});
  it.value=(it.value||[]).concat([r]);wzTouch(t.dataset.doc);render();
  focusId('wz-'+t.dataset.doc+'-'+wzSlug(it.key));
};
ACT['wz-row-del']=t=>{
  const it=wzItem(t.dataset.doc,t.dataset.key);if(!it||!Array.isArray(it.value))return;
  it.value.splice(+t.dataset.row,1);wzTouch(t.dataset.doc);render();
};
ACT['wz-reset']=t=>{const id=t.dataset.doc;UI.wDraft[id]=null;UI.wDirty[id]=false;render();toast('Änderungen verworfen');};
ACT['wz-save']=t=>wzSave(t.dataset.doc);
ACT['wz-ok']=t=>{const it=wzItem(t.dataset.doc,t.dataset.key);if(!it)return;delete it.review;wzSave(t.dataset.doc,'Bestätigt');};
function wzCheck(items){
  for(const it of items){
    if(it.kind==='number'){
      if(it.value==null||!isFinite(it.value))return 'Bei „'+it.label+'“ fehlt eine Zahl';
      if((it.min!=null&&it.value<it.min)||(it.max!=null&&it.value>it.max))return '„'+it.label+'“: erlaubt sind '+f1(it.min)+' bis '+f1(it.max);
    }
    if(it.kind==='table'){
      const cols=it.columns||[];
      for(const r of it.value||[]){
        for(const c of cols){
          if(c.readonly)continue;
          if((c.kind==null||c.kind==='number')&&(r[c.k]==null||!isFinite(r[c.k])))return 'In „'+it.label+'“ fehlt eine Zahl bei '+c.label;
          if(c.k==='name'&&!String(r[c.k]||'').trim())return 'In „'+it.label+'“ fehlt ein Name';
          if(c.kind==='time'&&!r[c.k])return 'In „'+it.label+'“ fehlt eine Uhrzeit';
        }
        if(r.von&&r.bis&&typeof r.von==='string'&&typeof r.bis==='string'&&r.bis<=r.von)return 'In „'+it.label+'“ muss „bis“ nach „von“ liegen';
      }
    }
  }
  return '';
}
function wzSave(id,msg){
  const items=wzItems(id),cur=S.wissen[id];
  if(!cur){toast('Dokument nicht gefunden');return;}
  if(UI.wBase[id]!==(cur.updatedAt||null)){toast('Das Dokument wurde inzwischen geändert, zum Beispiel von Claude. Verwirf deine Änderungen und trage sie neu ein.');return;}
  const err=wzCheck(items);
  if(err){toast(err);return;}
  const orig=cur.items||[];
  items.forEach(it=>{const o=orig.find(x=>x.key===it.key);if(it.review&&o&&JSON.stringify(o.value)!==JSON.stringify(it.value))delete it.review;});
  const doc=Object.assign({},cur,{items:clone(items),updatedAt:new Date().toISOString()});
  S.wissen[id]=doc;UI.wDirty[id]=false;UI.wDraft[id]=null;
  patchDoc('wissen/'+id,{items:doc.items,updatedAt:doc.updatedAt});
  toast(msg||'Gespeichert');render();
}
