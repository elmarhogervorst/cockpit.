'use strict';
/* Anmeldung und Verbindung zu Supabase.

   - Es gibt nur Anmelden mit E-Mail und Passwort. Eine Registrierung gibt es nicht, weder hier noch in der Datenbank.
   - Ohne Anmeldung wird nichts geladen. Die Daten kommen erst, wenn eine gültige Sitzung da ist.
   - Es gibt kein "Passwort vergessen". Das Passwort wird bei Bedarf im Supabase-Dashboard (Authentication → Users) neu gesetzt.
   Die Sitzung liegt im Speicher dieses Browsers (localStorage) und wird automatisch erneuert. */
window.CockpitAuth = (function(){
  const cfg = window.COCKPIT_CONFIG, lib = window.supabase;
  const $id = id => document.getElementById(id);
  const gate = $id('gate'), form = $id('gate-form'), msg = $id('gate-msg');
  const email = $id('gate-email'), pw = $id('gate-pw'), submit = $id('gate-submit');

  function show(text, bad){ msg.textContent = text || ''; msg.dataset.bad = bad ? '1' : ''; }
  function openGate(){
    gate.hidden = false; form.hidden = false;
    show('');
    setTimeout(() => { try { (email.value ? pw : email).focus(); } catch (e) {} }, 30);
  }
  const closeGate = () => { gate.hidden = true; show(''); pw.value = ''; };

  if (!lib || !cfg || !cfg.url || !cfg.key){
    openGate(); form.querySelectorAll('input,button').forEach(n => { n.disabled = true; });
    show('Die Verbindung ist nicht eingerichtet (config.js oder supabase.js fehlt).', true);
    return { ready: () => Promise.resolve(null), logout(){} };
  }

  const client = lib.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit', storageKey: 'cockpit.auth' }
  });

  let started = false, resolveDb;
  const ready = new Promise(r => { resolveDb = r; });

  function start(){
    if (started) return;
    started = true; closeGate();
    resolveDb(window.CockpitDb.create(client));
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT'){ if (started) location.reload(); return; }
    if (event === 'INITIAL_SESSION' && !session){ openGate(); return; }
    if (session) start();
  });

  const errText = e => {
    const m = String((e && e.message) || ''), s = e && e.status;
    if (s === 429 || /rate limit|too many/i.test(m)) return 'Zu viele Versuche. Warte einen Moment.';
    if (/invalid login|invalid credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/failed to fetch|network|load failed/i.test(m)) return 'Keine Verbindung. Prüfe das Netz.';
    return 'Das hat nicht geklappt. Versuche es noch einmal.';
  };

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true; show('');
    try {
      const mail = email.value.trim();
      if (!mail || !pw.value){ show('E-Mail und Passwort eingeben.', true); return; }
      const { error } = await client.auth.signInWithPassword({ email: mail, password: pw.value });
      if (error){ show(errText(error), true); pw.value = ''; return; }
      /* start() läuft über onAuthStateChange */
    } catch (e) { show(errText(e), true); }
    finally { submit.disabled = false; }
  });

  async function logout(){
    try { await client.auth.signOut(); } catch (e) { /* lokale Sitzung trotzdem verwerfen */ }
    try { Object.keys(localStorage).filter(k => k.indexOf('cockpit.auth') === 0 || /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    location.reload();
  }

  return { ready: () => ready, logout };
})();
