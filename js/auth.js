'use strict';
/* Anmeldung und Verbindung zu Supabase.

   - Es gibt nur Anmelden mit E-Mail und Passwort. Eine Registrierung gibt es nicht, weder hier noch in der Datenbank.
   - Ohne Anmeldung wird nichts geladen. Die Daten kommen erst, wenn eine gültige Sitzung da ist.
   - "Passwort vergessen" schickt eine E-Mail an den vorhandenen Nutzer. Der Link führt hierher zurück und fragt nach
     einem neuen Passwort.
   Die Sitzung liegt im Speicher dieses Browsers (localStorage) und wird automatisch erneuert. */
window.CockpitAuth = (function(){
  const cfg = window.COCKPIT_CONFIG, lib = window.supabase;
  const $id = id => document.getElementById(id);
  const gate = $id('gate'), form = $id('gate-form'), msg = $id('gate-msg'), title = $id('gate-t');
  const emailW = $id('gate-email-wrap'), pwW = $id('gate-pw-wrap'), pw2W = $id('gate-pw2-wrap');
  const email = $id('gate-email'), pw = $id('gate-pw'), pw2 = $id('gate-pw2');
  const submit = $id('gate-submit'), resetBtn = $id('gate-reset');

  function show(text, bad){ msg.textContent = text || ''; msg.dataset.bad = bad ? '1' : ''; }
  function openGate(mode){
    gate.hidden = false; form.hidden = false; form.dataset.mode = mode;
    const nu = mode === 'newpw';
    title.textContent = nu ? 'Neues Passwort' : 'Anmelden';
    submit.textContent = nu ? 'Passwort speichern' : 'Anmelden';
    emailW.hidden = nu; pwW.hidden = nu; pw2W.hidden = !nu; resetBtn.hidden = nu;
    show('');
    setTimeout(() => { try { (nu ? pw2 : (email.value ? pw : email)).focus(); } catch (e) {} }, 30);
  }
  const closeGate = () => { gate.hidden = true; show(''); pw.value = ''; pw2.value = ''; };

  if (!lib || !cfg || !cfg.url || !cfg.key){
    openGate('login'); form.querySelectorAll('input,button').forEach(n => { n.disabled = true; });
    show('Die Verbindung ist nicht eingerichtet (config.js oder supabase.js fehlt).', true);
    return { ready: () => Promise.resolve(null), logout(){} };
  }

  const client = lib.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'cockpit.auth' }
  });

  let recovering = /type=recovery/.test(location.hash);   // Link aus der Passwort-E-Mail
  let started = false, resolveDb;
  const ready = new Promise(r => { resolveDb = r; });

  function start(){
    if (started || recovering) return;
    started = true; closeGate();
    resolveDb(window.CockpitDb.create(client));
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY'){ recovering = true; openGate('newpw'); return; }
    if (event === 'SIGNED_OUT'){ if (started) location.reload(); return; }
    if (event === 'INITIAL_SESSION' && !session && !recovering){ openGate('login'); return; }
    if (session) start();
  });

  const errText = e => {
    const m = String((e && e.message) || ''), s = e && e.status;
    if (s === 429 || /rate limit|too many/i.test(m)) return 'Zu viele Versuche. Warte einen Moment.';
    if (/invalid login|invalid credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/failed to fetch|network|load failed/i.test(m)) return 'Keine Verbindung. Prüfe das Netz.';
    if (/same password|different from the old/i.test(m)) return 'Das neue Passwort muss sich vom alten unterscheiden.';
    if (/at least|weak|short/i.test(m)) return 'Das Passwort ist zu kurz oder zu einfach (mindestens 8 Zeichen).';
    return 'Das hat nicht geklappt. Versuche es noch einmal.';
  };

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true; show('');
    try {
      if (form.dataset.mode === 'newpw'){
        if (pw2.value.length < 8){ show('Mindestens 8 Zeichen.', true); return; }
        const { error } = await client.auth.updateUser({ password: pw2.value });
        if (error){ show(errText(error), true); return; }
        recovering = false; history.replaceState(null, '', location.pathname + location.search);
        start();
      } else {
        const mail = email.value.trim();
        if (!mail || !pw.value){ show('E-Mail und Passwort eingeben.', true); return; }
        const { error } = await client.auth.signInWithPassword({ email: mail, password: pw.value });
        if (error){ show(errText(error), true); pw.value = ''; return; }
        /* start() läuft über onAuthStateChange */
      }
    } catch (e) { show(errText(e), true); }
    finally { submit.disabled = false; }
  });

  resetBtn.addEventListener('click', async () => {
    const mail = email.value.trim();
    if (!mail){ show('Gib oben deine E-Mail ein, dann schicke ich dir einen Link.', true); try { email.focus(); } catch (e) {} return; }
    resetBtn.disabled = true;
    try {
      await client.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname });
      show('Wenn die Adresse bekannt ist, ist eine E-Mail unterwegs.');
    } catch (e) { show(errText(e), true); }
    finally { resetBtn.disabled = false; }
  });

  async function logout(){
    try { await client.auth.signOut(); } catch (e) { /* lokale Sitzung trotzdem verwerfen */ }
    try { Object.keys(localStorage).filter(k => k.indexOf('cockpit.auth') === 0 || /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    location.reload();
  }

  return { ready: () => ready, logout };
})();
