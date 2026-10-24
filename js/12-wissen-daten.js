'use strict';
/* Reiter Wissen: Deine Daten und Körpergewicht */
/* ---------- Körper ---------- */
function profDraft(){
  if(!UI.profDraft){
    UI.profDraft=S.profile?clone(S.profile):{sex:'male',age:null,height:null,goalWeight:null};
    UI.profDirty=false;
  }
  return UI.profDraft;
}
function numField(k,label,unit,val,ph){
  return '<div class="fgroup"><label class="lbl" for="pf-'+k+'">'+label+'</label><div class="uw"><input class="field" id="pf-'+k+'" inputmode="decimal" data-live="pf" data-bind="pf" data-k="'+k+'" value="'+esc(inputNum(val))+'" placeholder="'+(ph||'')+'"><span class="un">'+unit+'</span></div></div>';
}
function pChips(k,list,cur){
  return '<div class="choices" role="group">'+list.map(([v,l])=>'<button type="button" class="chip" data-act="pf-set" data-k="'+k+'" data-v="'+v+'" aria-pressed="'+(String(cur)===String(v))+'">'+l+'</button>').join('')+'</div>';
}
function weightSeries(){
  return Object.values(S.days).filter(d=>d.weight>0).sort((a,b)=>a.date<b.date?-1:1).map(d=>({date:d.date,w:d.weight}));
}
function dLabel(s){const d=fromIso(s);return d.getDate()+'. '+MONTHS[d.getMonth()].slice(0,3);}
function chartHtml(pts,goal){
  const W=640,H=230,L=44,Rr=18,T=16,B=30;
  const ws=pts.map(p=>p.w).concat(goal>0?[goal]:[]);
  let lo=Math.floor(Math.min(...ws)-0.5),hi=Math.ceil(Math.max(...ws)+0.5);
  if(hi-lo<2){hi+=1;lo-=1;}
  const step=[0.5,1,2,5,10].find(s=>(hi-lo)/s<=5)||10;
  lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const t0=fromIso(pts[0].date).getTime(),t1=fromIso(pts[pts.length-1].date).getTime(),span=Math.max(1,t1-t0);
  const X=s=>L+(fromIso(s).getTime()-t0)/span*(W-L-Rr),Y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
  let grid='';
  for(let v=lo;v<=hi+1e-9;v+=step){grid+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="var(--line)" stroke-width="1"/><text class="ax" x="'+(L-8)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end">'+f1(v)+'</text>';}
  const path=pts.map((p,i)=>(i?'L':'M')+X(p.date).toFixed(1)+' '+Y(p.w).toFixed(1)).join(' ');
  const last=pts[pts.length-1];
  const gl=goal>0?'<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+Y(goal).toFixed(1)+'" y2="'+Y(goal).toFixed(1)+'" stroke="var(--blue)" stroke-width="1.5" stroke-dasharray="5 5"/><text class="ax" x="'+(W-Rr)+'" y="'+(Y(goal)-6).toFixed(1)+'" text-anchor="end" style="fill:var(--blue)">Ziel '+f1(goal)+' kg</text>':'';
  const dots=pts.length<=40?pts.map(p=>'<circle cx="'+X(p.date).toFixed(1)+'" cy="'+Y(p.w).toFixed(1)+'" r="3" fill="var(--accent)"/>').join(''):'';
  const hits=pts.map(p=>'<circle cx="'+X(p.date).toFixed(1)+'" cy="'+Y(p.w).toFixed(1)+'" r="13" fill="transparent" data-tip="'+esc(dLabel(p.date)+': '+f1(p.w)+' kg')+'"/>').join('');
  const xl=[0,pts.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  if(pts.length>2){xl.splice(1,0,Math.floor((pts.length-1)/2));}
  const xt=xl.map((i,n)=>'<text class="ax" x="'+X(pts[i].date).toFixed(1)+'" y="'+(H-8)+'" text-anchor="'+(n===0?'start':n===xl.length-1?'end':'middle')+'">'+dLabel(pts[i].date)+'</text>').join('');
  return '<div class="chartwrap"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Körpergewicht im Verlauf in Kilogramm">'+grid+gl
    +'<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'+dots
    +'<circle cx="'+X(last.date).toFixed(1)+'" cy="'+Y(last.w).toFixed(1)+'" r="6" fill="var(--accent)" stroke="var(--card)" stroke-width="2.5"/>'+xt+hits+'</svg><div class="tip" hidden></div></div>';
}
function weightCard(){
  const pts=weightSeries(),goal=(S.profile&&S.profile.goalWeight)||(UI.profDraft&&UI.profDraft.goalWeight)||0;
  let inner;
  if(!pts.length){
    inner='<div class="empty"><b>Noch keine Gewichtsdaten</b>Trage dein nüchternes Gewicht im Daily Check-in auf der Übersicht ein. Ab zwei Messungen erscheint hier der Verlauf.</div>';
  }else{
    const last=pts[pts.length-1];
    const ref=pts.filter(p=>p.date<=addDays(last.date,-7)).pop();
    const parts=['<b>'+f1(last.w)+' kg</b> am '+dLabel(last.date)];
    if(ref){const dl=last.w-ref.w;parts.push('<b>'+(dl>0?'+':dl<0?'−':'±')+f1(Math.abs(dl))+' kg</b> in '+Math.round((fromIso(last.date)-fromIso(ref.date))/864e5)+' Tagen');}
    if(goal>0){const r=goal-last.w;parts.push('Ziel '+f1(goal)+' kg, noch <b>'+(r>0?'+':r<0?'−':'')+f1(Math.abs(r))+' kg</b>');}
    inner='<div class="legend">'+parts.map(p=>'<span>'+p+'</span>').join('')+'</div>'
      +(pts.length>=2?chartHtml(pts,goal):'<div class="empty"><b>Eine Messung</b>Die Kurve erscheint ab der zweiten.</div>')
      +'<details style="margin-top:12px"><summary class="kicker" style="cursor:pointer">Werte als Tabelle</summary><div class="tablewrap"><table class="mt" style="margin-top:8px"><thead><tr><th>Datum</th><th>kg</th></tr></thead><tbody>'
      +pts.slice().reverse().map(p=>'<tr><td>'+esc(shortDate(p.date))+'</td><td>'+f1(p.w)+'</td></tr>').join('')+'</tbody></table></div></details>';
  }
  return '<section class="card chartcard"><div class="kicker">Verlauf</div><h2 class="h2" style="margin:4px 0 10px">Körpergewicht</h2>'+inner+'</section>';
}
VIEWS.body=function(){
  const p=profDraft(),FG='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px';
  const left='<section class="card"><div class="kicker">Profil</div><h2 class="h2" style="margin:4px 0 14px">Deine Daten</h2>'
    +'<div style="'+FG+'"><div class="fgroup"><span class="lbl">Geschlecht</span>'+pChips('sex',[['male','Männlich'],['female','Weiblich']],p.sex)+'</div>'
      +numField('age','Alter','Jahre',p.age,'28')+numField('height','Größe','cm',p.height,'182')+numField('goalWeight','Zielgewicht','kg',p.goalWeight,'85')+'</div>'
    +'<div class="fgroup"><label class="lbl" for="pf-notes">Trainingsvorlieben und Hinweise</label><textarea class="field" id="pf-notes" rows="5" maxlength="1500" data-live="pft" data-k="trainingNotes" placeholder="Zum Beispiel: Ziel Muskelaufbau. Im Alltag viel Sitzen, dazu 2 × Padel pro Woche. Ich möchte 4 Tage pro Woche trainieren, höchstens 60 Minuten, am liebsten Push/Pull/Legs. Sonntag ist immer frei. Schulter macht Probleme.">'+esc(p.trainingNotes||'')+'</textarea></div>'
    +'<div style="border-top:1px solid var(--line);padding-top:18px"><button type="button" class="btn pri" data-act="pf-save">Daten speichern</button></div></section>';
  return '<div class="pagehead"><div class="kicker">'+esc(longDate(TODAY()))+'</div><h1 class="title">Wissen</h1></div>'
    +'<p class="wz-intro">Hier steht, was das Cockpit über dich weiß: deine Daten, dein Gewicht, deine Vorlieben und die Regeln, nach denen Claude plant und auswertet. Claude liest diese Seite bei jeder Planung und Auswertung neu. Was du hier änderst, gilt ab dem nächsten Mal.</p>'
    +'<div class="grid2 even">'+left+weightCard()+'</div>'
    +wissenHtml();
};
AFTER.body=function(){
  $$('details[data-wz]').forEach(d=>d.addEventListener('toggle',()=>{UI.wOpen[d.dataset.wz]=d.open;}));
  const w=$('.chartwrap');if(!w)return;
  const tip=$('.tip',w);
  w.addEventListener('pointerover',e=>{
    const c=e.target.closest('[data-tip]');
    if(!c){tip.hidden=true;return;}
    const r=c.getBoundingClientRect(),wr=w.getBoundingClientRect();
    tip.textContent=c.dataset.tip;
    tip.style.left=(r.left+r.width/2-wr.left+w.scrollLeft)+'px';
    tip.style.top=(r.top+r.height/2-wr.top)+'px';
    tip.hidden=false;
  });
  w.addEventListener('pointerleave',()=>{tip.hidden=true;});
};
BIND.pf=(t,e,kind)=>{
  const k=t.dataset.k,p=profDraft();
  const v=toNum(t.value);
  p[k]=v==null?null:v;
  UI.profDirty=true;
  if(kind==='change'&&v!=null)t.value=inputNum(v);
};
BIND.pft=t=>{profDraft()[t.dataset.k]=t.value.slice(0,1500);UI.profDirty=true;};
ACT['pf-set']=t=>{
  const k=t.dataset.k,raw=t.dataset.v;
  profDraft()[k]=raw;
  UI.profDirty=true;render();
};
ACT['pf-save']=()=>{
  const p=profDraft();
  if(!(p.age>=10&&p.age<=100)||!(p.height>=100&&p.height<=250)){toast('Prüfe Alter und Größe');return;}
  const doc=Object.assign({},S.profile||{},p,{updatedAt:new Date().toISOString()});
  if(!(doc.weight>0))delete doc.weight;
  S.profile=doc;
  setDoc('profile/main',doc);
  UI.profDirty=false;
  toast('Daten gespeichert');
};
