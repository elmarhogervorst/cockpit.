'use strict';
/* Dokumentspeicher auf Supabase.

   Das Cockpit speichert Dokumente in Sammlungen (zum Beispiel days/2026-10-23). Diese Datei bildet genau die
   kleine Schnittstelle nach, die der Rest der Seite benutzt, damit dort nichts umgeschrieben werden muss:

     DB.doc('sammlung/id').get()            -> { id, exists, data() }
     DB.doc('sammlung/id').set(daten)       ersetzt das Dokument
     DB.doc('sammlung/id').update(teil)     führt Felder zusammen, {"__delete__": true} entfernt ein Feld
     DB.doc('sammlung/id').delete()
     DB.doc('sammlung/id').onSnapshot(cb, fehlerCb)
     DB.collection('name').orderBy(feld, 'asc'|'desc').get() / .onSnapshot(cb, fehlerCb)

   Alles liegt in einer Tabelle public.docs (collection, id, data jsonb, version). Änderungen anderer Geräte kommen
   über Realtime. Nach einem Verbindungsabbruch und wenn die Seite wieder sichtbar wird, lädt jede Sammlung neu. */
window.CockpitDb = (function(){
  const TABLE = 'docs', PAGE = 1000;
  const clone = v => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

  /* Fehler so aufbereiten, dass errText() in 02-datenbank.js sie versteht. */
  function asError(e){
    const err = new Error((e && e.message) || 'Fehler');
    const msg = String((e && e.message) || ''), c = e && (e.code || e.status);
    if (e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) err.code = 'unavailable';
    else if (c === '42501' || c === 'PGRST301' || c === 'PGRST303' || c === 401 || c === 403 || /jwt/i.test(msg)) err.code = 'revoked';
    else if (c === 'P0002') err.code = 'not-found';
    else if (c === '23514' || c === '22023') err.code = 'invalid_argument';
    else err.code = String(c || 'unknown');
    err.cause = e;
    return err;
  }

  function create(client){
    const feeds = new Map();   // Sammlung -> { coll, rows: Map(id -> {id,data,version}), subs, loaded, channel }

    function getFeed(coll){
      let f = feeds.get(coll);
      if (!f){ f = { coll, rows: new Map(), subs: new Set(), loaded: false, loading: null, channel: null, wasSubscribed: false }; feeds.set(coll, f); }
      return f;
    }

    async function fetchAll(coll){
      const out = [];
      for (let from = 0;; from += PAGE){
        const { data, error } = await client.from(TABLE).select('id,data,version')
          .eq('collection', coll).order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw asError(error);
        out.push(...data);
        if (data.length < PAGE) break;
      }
      return out;
    }

    async function load(f){
      const rows = await fetchAll(f.coll);
      f.rows = new Map(rows.map(r => [r.id, { id: r.id, data: r.data, version: r.version }]));
      f.loaded = true;
    }
    const emit = f => f.subs.forEach(s => s.emit());
    function resync(f){ load(f).then(() => emit(f)).catch(e => console.error('Neu laden fehlgeschlagen', e)); }

    /* Ältere Stände legen sich nie über neuere. */
    function applyRow(f, row){
      const cur = f.rows.get(row.id);
      if (cur && cur.version >= row.version) return false;
      f.rows.set(row.id, { id: row.id, data: row.data, version: row.version });
      return true;
    }
    const applyRemove = (f, id) => f.rows.delete(id);
    function localApply(coll, row){
      const f = feeds.get(coll);
      if (f && f.loaded && row && applyRow(f, row)) emit(f);
    }

    function ensureChannel(f){
      if (f.channel) return;
      f.channel = client.channel('docs-' + f.coll)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'collection=eq.' + f.coll }, p => {
          let changed = false;
          if (p.eventType === 'DELETE') changed = !!(p.old && applyRemove(f, p.old.id));
          else if (p.new && p.new.id) changed = applyRow(f, p.new);
          if (changed) emit(f);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED'){ if (f.wasSubscribed) resync(f); f.wasSubscribed = true; }
        });
    }

    function subscribe(coll, make, cb, errCb){
      const f = getFeed(coll);
      let dead = false;
      const sub = { emit: () => { if (!dead) { try { cb(make(f)); } catch (e) { console.error(e); } } } };
      f.subs.add(sub);
      ensureChannel(f);
      (async () => {
        try {
          if (!f.loaded) await (f.loading || (f.loading = load(f).finally(() => { f.loading = null; })));
          sub.emit();
        } catch (e) { if (!dead && errCb) errCb(e); }
      })();
      return () => { dead = true; f.subs.delete(sub); };
    }

    const docSnap = row => ({ id: row.id, exists: true, data: () => clone(row.data) });
    const noDoc = id => ({ id, exists: false, data: () => undefined });
    function collSnap(rows, order){
      rows = rows.slice();
      if (order){
        const key = r => { const v = r.data ? r.data[order.field] : undefined; return v == null ? '' : v; };
        const sign = order.dir === 'desc' ? -1 : 1;
        rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : a.id.localeCompare(b.id)) * sign; });
      } else rows.sort((a, b) => a.id.localeCompare(b.id));
      return { docs: rows.map(docSnap), size: rows.length, empty: !rows.length };
    }

    function doc(path){
      const i = path.indexOf('/'), coll = path.slice(0, i), id = path.slice(i + 1);
      return {
        async get(){
          const { data, error } = await client.from(TABLE).select('id,data,version')
            .eq('collection', coll).eq('id', id).maybeSingle();
          if (error) throw asError(error);
          return data ? docSnap(data) : noDoc(id);
        },
        async set(value){
          const { data, error } = await client.from(TABLE).upsert({ collection: coll, id, data: value }, { onConflict: 'collection,id' })
            .select('id,data,version').single();
          if (error) throw asError(error);
          localApply(coll, data);
        },
        async update(patch){
          const { data, error } = await client.rpc('merge_doc', { p_collection: coll, p_id: id, p_patch: patch });
          if (error) throw asError(error);
          localApply(coll, data);
        },
        async delete(){
          const { error } = await client.from(TABLE).delete().eq('collection', coll).eq('id', id);
          if (error) throw asError(error);
          const f = feeds.get(coll);
          if (f && applyRemove(f, id)) emit(f);
        },
        onSnapshot(cb, errCb){
          return subscribe(coll, f => { const r = f.rows.get(id); return r ? docSnap(r) : noDoc(id); }, cb, errCb);
        }
      };
    }

    function collection(name){
      const make = order => ({
        orderBy(field, dir){ return make({ field, dir: dir || 'asc' }); },
        async get(){ return collSnap(await fetchAll(name), order); },
        onSnapshot(cb, errCb){ return subscribe(name, f => collSnap([...f.rows.values()], order), cb, errCb); }
      });
      return make(null);
    }

    /* Handy: nach dem Aufwachen oder bei neuem Netz alles neu holen. */
    const refreshAll = () => feeds.forEach(f => { if (f.loaded && f.subs.size) resync(f); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
    window.addEventListener('online', refreshAll);

    return { doc, collection };
  }

  return { create };
})();
