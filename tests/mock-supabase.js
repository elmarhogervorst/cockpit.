/* Nachgebautes Supabase für Browser-Tests (ersetzt js/vendor/supabase.js nur im Test).
   Bildet genau die Teile nach, die js/auth.js und js/db-supabase.js benutzen:
   auth.* (Anmelden, Abmelden, Passwort), from('docs') mit select/upsert/delete, rpc('merge_doc'), channel(...).on(...).subscribe(...).
   Die Daten liefert der Test über window.__FIXTURE__ (Liste von {collection,id,data}). Es gibt keine echten Zugangsdaten. */
var supabase = (function(){
  const GOOD_MAIL = 'test@example.invalid', GOOD_PW = 'richtig-123';
  const S = window.__MOCK_STORE__ = { rows: new Map(), calls: [], channels: [], authCbs: [], loggedIn: false, failNext: null };
  const key = (c, i) => c + '/' + i;
  const clone = v => JSON.parse(JSON.stringify(v));
  (window.__FIXTURE__ || []).forEach(r => S.rows.set(key(r.collection, r.id), { collection: r.collection, id: r.id, data: clone(r.data), version: r.version || 1 }));
  try { S.loggedIn = localStorage.getItem('mock.loggedIn') === '1'; } catch (e) {}
  const session = () => S.loggedIn ? { access_token: 'x', user: { id: 'u1', email: GOOD_MAIL } } : null;
  const fireAuth = (ev) => setTimeout(() => S.authCbs.forEach(cb => cb(ev, session())), 0);

  function notify(type, row, old){
    setTimeout(() => S.channels.forEach(ch => ch.handlers.forEach(h => {
      if (h.coll !== (row || old).collection) return;
      h.cb({ eventType: type, new: row ? clone(row) : {}, old: old ? clone(old) : {} });
    })), 0);
  }
  S.remoteUpsert = (c, i, data) => {          // Änderung "von einem anderen Gerät"
    const cur = S.rows.get(key(c, i)), row = { collection: c, id: i, data: clone(data), version: cur ? cur.version + 1 : 1 };
    S.rows.set(key(c, i), row); notify(cur ? 'UPDATE' : 'INSERT', row);
  };
  S.get = (c, i) => { const r = S.rows.get(key(c, i)); return r ? clone(r.data) : undefined; };
  const denied = () => ({ data: null, error: { code: '42501', message: 'permission denied for table docs' } });
  const publicRow = r => ({ id: r.id, data: clone(r.data), version: r.version });

  function builder(){
    const q = { op: 'select', f: [], ord: null, rng: null, payload: null };
    const run = (single) => new Promise(resolve => setTimeout(() => {
      S.calls.push({ op: q.op, filters: q.f.slice(), payload: q.payload && clone(q.payload) });
      if (S.failNext){ const e = S.failNext; S.failNext = null; return resolve({ data: null, error: e }); }
      if (!S.loggedIn) return resolve(denied());
      const match = r => q.f.every(([k, v]) => r[k] === v);
      if (q.op === 'select'){
        let rows = [...S.rows.values()].filter(match).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        if (q.rng) rows = rows.slice(q.rng[0], q.rng[1] + 1);
        const out = rows.map(publicRow);
        return resolve(single ? { data: out[0] || null, error: null } : { data: out, error: null });
      }
      if (q.op === 'upsert'){
        const p = q.payload, cur = S.rows.get(key(p.collection, p.id));
        const row = { collection: p.collection, id: p.id, data: clone(p.data), version: cur ? cur.version + 1 : 1 };
        S.rows.set(key(p.collection, p.id), row); notify(cur ? 'UPDATE' : 'INSERT', row);
        return resolve({ data: publicRow(row), error: null });
      }
      if (q.op === 'delete'){
        [...S.rows.values()].filter(match).forEach(r => { S.rows.delete(key(r.collection, r.id)); notify('DELETE', null, { collection: r.collection, id: r.id }); });
        return resolve({ data: null, error: null });
      }
      resolve({ data: null, error: { message: 'unbekannt' } });
    }, 5));
    const api = {
      select(){ return api; },
      upsert(p){ q.op = 'upsert'; q.payload = p; return api; },
      delete(){ q.op = 'delete'; return api; },
      eq(k, v){ q.f.push([k, v]); return api; },
      order(){ return api; },
      range(a, b){ q.rng = [a, b]; return api; },
      maybeSingle(){ return run(true); },
      single(){ return run(true); },
      then(res, rej){ return run(false).then(res, rej); }
    };
    return api;
  }

  function rpc(name, args){
    return new Promise(resolve => setTimeout(() => {
      S.calls.push({ op: 'rpc:' + name, payload: clone(args) });
      if (S.failNext){ const e = S.failNext; S.failNext = null; return resolve({ data: null, error: e }); }
      if (!S.loggedIn) return resolve(denied());
      const cur = S.rows.get(key(args.p_collection, args.p_id));
      if (!cur) return resolve({ data: null, error: { code: 'P0002', message: 'merge_doc: Dokument fehlt' } });
      const data = clone(cur.data);
      Object.keys(args.p_patch).forEach(k => {
        const v = args.p_patch[k];
        if (v && typeof v === 'object' && v.__delete__ === true) delete data[k]; else data[k] = clone(v);
      });
      const row = { collection: cur.collection, id: cur.id, data, version: cur.version + 1 };
      S.rows.set(key(cur.collection, cur.id), row); notify('UPDATE', row);
      resolve({ data: clone(row), error: null });
    }, 5));
  }

  function channel(name){
    const ch = { name, handlers: [] };
    S.channels.push(ch);
    ch.on = (type, opts, cb) => { const m = /collection=eq\.(.+)$/.exec(opts.filter || ''); ch.handlers.push({ coll: m && m[1], cb }); return ch; };
    ch.subscribe = (cb) => { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; };
    return ch;
  }

  const auth = {
    onAuthStateChange(cb){ S.authCbs.push(cb); setTimeout(() => cb('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe(){} } } }; },
    async getSession(){ return { data: { session: session() }, error: null }; },
    async signInWithPassword({ email, password }){
      S.calls.push({ op: 'signIn', email });
      if (email === GOOD_MAIL && password === GOOD_PW){
        S.loggedIn = true; try { localStorage.setItem('mock.loggedIn', '1'); } catch (e) {}
        fireAuth('SIGNED_IN'); return { data: { session: session() }, error: null };
      }
      return { data: null, error: { message: 'Invalid login credentials', status: 400 } };
    },
    async signOut(){ S.loggedIn = false; try { localStorage.removeItem('mock.loggedIn'); } catch (e) {} fireAuth('SIGNED_OUT'); return { error: null }; }
  };

  return { createClient: () => ({ auth, from: () => builder(), rpc, channel }) };
})();
