'use strict';
/* Reiter Wissen: Deine Daten und Körpergewicht (nur Anzeige) */
/* ---------- Körper ----------
   Das Profil (profile/main) wird hier nur gezeigt. Ändern kann es allein Claude auf Wunsch im Chat. Das aktuelle Gewicht steht nicht
   im Profil: Es ist der jüngste Wert aus dem Daily Check-in (days/<Datum>.weight) und bleibt leer, solange noch nie gewogen wurde. */
const GOAL_NAME={build:'Muskelaufbau',cut:'Definition (Abnehmen)',hold:'Gewicht halten'};
const SEX_NAME={male:'Männlich',female:'Weiblich'};
function profRow(label,val,unit){
  const has=val!=null&&val!=='';
  return '<div class="wz-item"><div class="wz-line"><span class="wz-k">'+esc(label)+'</span><span class="wz-v">'+(has?'<b>'+esc(val)+'</b>'+(unit?' <span class="wz-unit">'+esc(unit)+'</span>':''):'–')+'</span></div></div>';
}
function currentWeight(){
  const s=weightSeries();
  return s.length?s[s.length-1].w:null;
}
function profileCard(){
  const p=S.profile||{},cw=currentWeight();
  return '<section class="card"><div class="kicker">Profil</div><h2 class="h2" style="margin:4px 0 14px">Deine Daten</h2><div class="wz-items">'
    +profRow('Ziel',GOAL_NAME[p.goal]||p.goal)
    +profRow('Geschlecht',SEX_NAME[p.sex]||p.sex)
    +profRow('Alter',p.age,'Jahre')
    +profRow('Größe',p.height>0?inputNum(p.height):null,'cm')
    +profRow('Aktuelles Gewicht',cw!=null?inputNum(cw):null,'kg')
    +profRow('Zielgewicht',p.goalWeight>0?inputNum(p.goalWeight):null,'kg')
    +'</div></section>';
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
  const pts=weightSeries(),goal=(S.profile&&S.profile.goalWeight)||0;
  let inner;
  if(!pts.length){
    inner='<div class="empty"><b>Noch keine Gewichtsdaten</b>Trage dein nüchternes Gewicht im Daily Check-in oben ein. Ab zwei Messungen erscheint hier der Verlauf.</div>';
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
  return '<div class="pagehead"><div class="kicker">'+esc(longDate(TODAY()))+'</div><h1 class="title">Wissen</h1></div>'
    +'<div class="grid2 even">'+profileCard()+'</div>'
    +wissenHtml();
};
AFTER.body=function(){
  $$('details[data-wz]').forEach(d=>d.addEventListener('toggle',()=>{UI.wOpen[d.dataset.wz]=d.open;}));
};
/* Kurzinfo beim Berühren eines Punkts im Gewichtsverlauf (der Verlauf steht auf der Übersicht) */
AFTER.overview=function(){
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
