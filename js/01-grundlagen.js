'use strict';
/* Konstanten, Hilfsfunktionen und der Zustand der Seite */
/* Konstanten & Helfer */
const DOW=['mo','di','mi','do','fr','sa','so'];
const DOW_LONG={mo:'Montag',di:'Dienstag',mi:'Mittwoch',do:'Donnerstag',fr:'Freitag',sa:'Samstag',so:'Sonntag'};
const DOW_SHORT={mo:'MO',di:'DI',mi:'MI',do:'DO',fr:'FR',sa:'SA',so:'SO'};
const GROUPS=['Brust','Rücken','Schultern','Arme','Beine','Core','Cardio'];
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WD_LONG=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const WD_SHORT=['So','Mo','Di','Mi','Do','Fr','Sa'];
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const nf0=new Intl.NumberFormat('de-DE',{maximumFractionDigits:0});
const nf1=new Intl.NumberFormat('de-DE',{maximumFractionDigits:1});
const f0=n=>(n==null||!isFinite(n))?'–':nf0.format(Math.round(n));
const f1=n=>(n==null||!isFinite(n))?'–':nf1.format(n);
const toNum=v=>{if(v==null)return null;const s=String(v).trim().replace(',','.');if(s==='')return null;const n=Number(s);return isFinite(n)?n:null;};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fromIso=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const TODAY=()=>iso(new Date());
const addDays=(s,n)=>{const d=fromIso(s);d.setDate(d.getDate()+n);return iso(d);};
const dowKey=s=>DOW[(fromIso(s).getDay()+6)%7];
const weekStart=s=>{const d=fromIso(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);};
const longDate=s=>{const d=fromIso(s);return WD_LONG[d.getDay()]+' · '+d.getDate()+'. '+MONTHS[d.getMonth()];};
const shortDate=s=>{const d=fromIso(s);return WD_SHORT[d.getDay()]+', '+d.getDate()+'. '+MONTHS[d.getMonth()];};
const dayNum=s=>fromIso(s).getDate()+'.';
const shortName=n=>String(n||'').split(' ')[0];

const SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const I={
  dl:SVG+'<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg>',
  edit:SVG+'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash:SVG+'<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7l1 13h9l1-13"/></svg>',
  check:SVG+'<path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  left:SVG+'<path d="m14.5 5-7 7 7 7"/></svg>',
  right:SVG+'<path d="m9.5 5 7 7-7 7"/></svg>',
  close:SVG+'<path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus:SVG+'<path d="M12 5v14M5 12h14"/></svg>',
  chev:SVG+'<path d="m6 15 6-6 6 6"/></svg>',
  grip:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
  sun:SVG+'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>',
  moon:SVG+'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  auto:SVG+'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  copy:SVG+'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  out:SVG+'<path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4"/><path d="m15 8 4 4-4 4"/><path d="M19 12H9"/></svg>',
  claude:SVG+'<path d="M11 3.5l1.7 5.3 5.3 1.7-5.3 1.7L11 17.5l-1.7-5.3L4 10.5l5.3-1.7z"/><path d="M18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>'
};

/* ---------- Zustand ---------- */
const S={profile:null,targets:null,exercises:[],plan:{},presets:[],days:{},wissen:{},ki:null,kiLoaded:false,kiErr:false};
const UI={
  tab:'overview',trainTab:'today',trainDate:null,nutDate:null,openEx:{},
  planDate:null,planDraft:null,planDirty:false,planSrc:'own',planScope:null,planBase:'',editingPreset:null,wk:null,
  exFilter:'Alle',exSearch:'',exEdit:null,exForm:null,confirmDel:null,
  wOpen:{},wErr:false,
  mealForm:{name:'',kcal:'',protein:'',carbs:'',fat:'',ing:null},mealEdit:null,mealOpen:{},ingNew:{},ingAddOpen:{},ingEdit:null,repeatN:3,
  ciDate:null,actDate:null,actForm:{name:'',note:'',min:'',time:'',id:null},actOpen:false,nfDraft:null,tmEdit:null,tmDraft:null,actInfo:false,skipDraft:null,waterDate:null,waterSet:false,waterForm:null,animUntil:0,focusSel:null,dbOff:false,dbErr:null
};
const LOADED={};
const KEYS=['profile','targets','exercises','presets','days'];
const isReady=()=>KEYS.every(k=>LOADED[k]);
try{const t=localStorage.getItem('cockpit.tab');if(['overview','training','nutrition','body'].includes(t))UI.tab=t;const tt=localStorage.getItem('cockpit.trainTab');if(['today','plan','library'].includes(tt))UI.trainTab=tt;}catch(e){}
