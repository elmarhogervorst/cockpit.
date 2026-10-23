'use strict';
/* Reiter Übersicht */
/* ---------- Übersicht ---------- */
function remTile(label,cls,eaten,target,unit){
  const g=unit==='kcal'?'':' g';
  /* Einzelner Wert ohne Ziel (Tagesziel ohne diese Angabe): nur das Gegessene zeigen */
  if(!(target>0))return '<div class="tile '+cls+'"><div class="lab">'+label+' · gegessen</div><div class="big"><span class="num">'+f0(eaten)+'</span><span class="u">'+unit+'</span></div><div class="bar"><i style="width:0"></i></div><div class="sub">Kein Ziel geplant</div></div>';
  const rem=target-eaten,over=rem<0,pct=Math.min(100,eaten/target*100);
  return '<div class="tile '+cls+'"><div class="lab">'+label+(over?' · drüber':' · übrig')+'</div><div class="big"><span class="num">'+f0(Math.abs(rem))+'</span><span class="u">'+unit+'</span></div><div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div><div class="sub">'+f0(eaten)+' von '+f0(target)+g+' abgedeckt</div></div>';
}
VIEWS.overview=function(){
  const date=TODAY(),tg=targetsFor(date),tot=sumMeals(mealsOf(date)),si=sessionFor(date);
  let train='';
  if(si.none){
    train='<div class="today-head"><span class="badge quiet">Für heute ist nichts eingetragen</span></div><div class="today-title">Kein Eintrag</div>'
      +'<div class="empty"><b>Für heute fehlt ein Eintrag</b>Lege im Plan fest, was heute ansteht.</div>'
      +'<div style="margin-top:16px"><button type="button" class="btn" data-act="go-plan">Plan öffnen</button></div>';
  }else if(si.rest){
    train='<div class="today-head"><span class="badge quiet">Heute ist Ruhetag</span></div><div class="today-title">Ruhetag</div>'
      ;
  }else{
    const w=si.w,st=workoutStats(w),mins=Math.round(st.total*3.9);
    const rows=w.exercises.map(ex=>{
      const sets=ex.sets.filter(s=>!s.extra).map(s=>({reps:s.planReps!=null?s.planReps:s.reps,kg:s.planKg!=null?s.planKg:s.kg,warmup:!!s.warmup}));
      return '<li><span class="nm">'+esc(ex.name)+'</span><span class="kicker">'+esc(exSummary({sets,timed:ex.timed}))+'</span></li>';
    }).join('');
    const done=w.status==='done',s0=w.startedAt,e0=w.finishedAt;
    if(w.status==='skipped'){
      const n=w.skip&&w.skip.note?String(w.skip.note).trim():'';
      train='<div class="today-head"><span class="badge quiet">Nicht abgeschlossen</span></div>'
        +'<div class="today-title">'+esc(w.planName||'Training')+'</div>'
        +'<p class="skip-note"><b>Übersprungen.</b>'+(n?' '+esc(n):'')+'</p>'
        +'<div style="margin-top:18px"><button type="button" class="btn pri" data-act="go-today">Training ansehen</button></div>';
    }else if(done){
      /* Abgeschlossen: keine Übungsliste mehr, nur Name, Start, Ende, Dauer (ohne Zeiten: Volumen und Sätze) und der Weg zur Einheit */
      const val=(k,v)=>'<div><div class="tm-k">'+k+'</div><div class="tm-v">'+v+'</div></div>';
      const vals=s0&&e0
        ?val('Start',esc(hmOf(s0))+'<small> Uhr</small>')+val('Ende',esc(hmOf(e0))+'<small> Uhr</small>')+val('Dauer',esc(fmtDur(new Date(e0)-new Date(s0))))
        :val('Volumen',f0(st.vol)+'<small> kg</small>')+val('Sätze',st.done+'<small> / '+st.total+'</small>');
      train='<div class="today-head"><span class="badge quiet">Heute abgeschlossen</span></div>'
        +'<div class="today-title">'+esc(w.planName||'Training')+'</div>'
        +'<div class="tm-vals done-vals">'+vals+'</div>'
        +'<div style="margin-top:18px"><button type="button" class="btn pri" data-act="go-today">Training ansehen</button></div>';
    }else{
      train='<div class="today-head"><span class="badge">Heute ist Trainingstag</span><span class="kicker">'+w.exercises.length+' Übungen · ca. '+mins+' min</span></div>'
        +'<div class="today-title">'+esc(w.planName||'Training')+'</div>'
        +(rows?'<ul class="exlist">'+rows+'</ul>':'<div class="empty"><b>Keine Übungen im Plan</b>Füge im Plan Übungen hinzu.</div>')
        +'<div style="margin-top:18px"><button type="button" class="btn pri" data-act="go-today">'+'Training öffnen'+'</button></div>';
    }
  }
  const ws=weekStart(date);
  let trainDays=0,doneDays=0;
  const dots=DOW.map((k,i)=>{
    const d=addDays(ws,i),inf=dayInfo(d),isToday=d===date;
    if(inf.planned&&!inf.rest)trainDays++;
    if(inf.done)doneDays++;
    const none=!inf.rest&&!inf.name;
    let cls='dot',inner='',kind='tr';
    if(inf.done){cls+=' done';inner=I.check;}
    else if(inf.skipped){cls+=' skipped';inner=I.close;}
    else if(inf.rest){cls+=' rest';kind='rs';}
    else if(none){cls+=' none';kind='no';}
    const lab=inf.rest?'Ruhe':inf.name?shortName(inf.name):'–';
    const acts=((S.days[d]&&S.days[d].activities)||[]).filter(x=>x&&x.name);
    const act=acts.length?'<span class="wa" title="'+esc(acts.map(x=>x.name).join(', '))+'">+ '+esc(acts[0].name)+(acts.length>1?' +'+(acts.length-1):'')+'</span>':'';
    return '<div class="'+kind+(isToday?' today':'')+'"'+(isToday?' aria-current="date"':'')+'><span class="kicker">'+DOW_SHORT[k]+'</span><span class="dn">'+dayNum(d)+'</span><span class="'+cls+'">'+inner+'</span><span class="wl">'+esc(lab)+'</span>'+act+'</div>';
  }).join('');
  const week='<div class="kicker">Diese Woche</div><div class="wk">'+dots+'</div>'
    +'<div class="wk-key"><span><i class="dot"></i>Training</span><span><i class="dot done">'+I.check+'</i>Erledigt</span><span><i class="dot rest"></i>Ruhe</span><span><i class="today-key"></i>Heute</span></div>'
    +'<p style="margin-top:14px;font-size:13px;color:var(--ink-2)">'+(trainDays?doneDays+' von '+trainDays+' Einheiten erledigt':'Noch kein Training eingetragen')+'</p>';
  return '<div class="kicker datebar">'+esc(longDate(date))+'</div>'
    +(tg.set
      ?'<div class="tiles">'
        +remTile('Kalorien','t-card',tot.kcal,tg.kcal,'kcal')
        +remTile('Protein','t-accent',tot.protein,tg.protein,'g')
        +remTile('Kohlenhydrate','t-blue',tot.carbs,tg.carbs,'g')
        +remTile('Fett','t-panel',tot.fat,tg.fat,'g')
      +'</div>'
      :'<div class="empty np ov-np" id="ov-np" role="status"><b>Noch nichts geplant</b>Jetzt Kalorien planen.'
        +(tot.kcal>0?'<span class="np-eaten">Bisher eingetragen: '+f0(tot.kcal)+' kcal · P '+f0(tot.protein)+' g · KH '+f0(tot.carbs)+' g · F '+f0(tot.fat)+' g</span>':'')+'</div>')
    +'<div class="grid2"><div class="stack"><section class="card">'+train+'</section><section class="card">'+week+'</section></div>'+dailyCheckinHtml(UI.ciDate||date)+'</div>'
    +'<div class="grid2 row-b">'+waterHtml()+activitiesHtml()+'</div>';
};
ACT['go-plan']=()=>goTab('training','plan');
ACT['go-today']=()=>{UI.trainDate=null;UI.wk=null;goTab('training','today');};
