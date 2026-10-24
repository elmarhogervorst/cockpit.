#!/usr/bin/env python3
"""Browser-Tests für das Cockpit, ohne echtes Supabase.

Ein nachgebautes Supabase (tests/mock-supabase.js) ersetzt im Test die Bibliothek. Die Testdaten sind erfunden
und werden hier erzeugt. Optional kann ein Ordner mit echten Exportdaten übergeben werden (--echt <Ordner>); der Ordner
bleibt lokal und gehört nicht ins Repo.

Aufruf:  python3 tests/run_tests.py [--echt ORDNER]
Voraussetzung: Python-Paket playwright mit Chromium.
"""
import argparse, datetime as dt, functools, glob, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIL, PW = "test@example.invalid", "richtig-123"

# ---------- erfundene Testdaten ----------
def synthetic():
    today = dt.date.today()
    iso = lambda d: d.isoformat()
    dow = ["mo", "di", "mi", "do", "fr", "sa", "so"]
    ex = lambda i, n, g: {"collection": "exercises", "id": i, "data": {"name": n, "group": g, "desc": "", "timed": False}}
    sets = lambda kg, reps, n=3: [{"kg": kg, "reps": reps} for _ in range(n)]
    def plan(d, kind, name, exercises):
        return {"day": dow[d.weekday()], "kind": kind, "name": name, "exercises": exercises, "presetId": None, "source": "own", "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")}
    bench = {"exerciseId": "bank", "name": "Bankdrücken", "sets": sets(60, 8), "timed": False}
    rows = [
        {"collection": "profile", "id": "main", "data": {"sex": "male", "age": 30, "height": 180, "goalWeight": 85, "goal": "build", "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")}},
        {"collection": "targets", "id": "main", "data": {"waterGoalMl": 3000}},
        ex("bank", "Bankdrücken", "Brust"), ex("rudern", "Rudern", "Rücken"), ex("kniebeuge", "Kniebeuge", "Beine"),
        {"collection": "presets", "id": "push", "data": {"name": "Push", "order": 1, "exercises": [bench]}},
        {"collection": "days", "id": iso(today), "data": {"date": iso(today), "plan": plan(today, "training", "Push", [bench]), "targets": {"kcal": 2500, "protein": 150, "carbs": 300, "fat": 80}, "waterMl": 500,
            "meals": [{"id": "m1", "name": "Haferflocken", "at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"), "kcal": 400, "protein": 15, "carbs": 60, "fat": 8},
            # so legt die Datenbankfunktion log_meal einen Eintrag mit Zutaten an (siehe supabase/migrations/0003)
            {"id": "m9f78c1bdeb", "name": "Kartoffeln mit Hähnchen", "at": "2026-10-23T21:14:43.614Z", "kcal": 394, "protein": 39, "carbs": 50, "fat": 3.8,
             "ingredients": [{"id": "i45c2a0487", "name": "Kartoffeln, 300 g", "kcal": 230, "protein": 6, "carbs": 50, "fat": 0.3},
                             {"id": "ia9b0464f7", "name": "Hähnchen, 150 g", "kcal": 164, "protein": 33, "carbs": 0, "fat": 3.5}]}]}},
        {"collection": "days", "id": iso(today - dt.timedelta(days=1)), "data": {"date": iso(today - dt.timedelta(days=1)), "plan": plan(today - dt.timedelta(days=1), "rest", "Ruhetag", []), "waterMl": 1500, "weight": 82.5}},
        {"collection": "days", "id": iso(today + dt.timedelta(days=1)), "data": {"date": iso(today + dt.timedelta(days=1)), "plan": None}},
        {"collection": "wissen", "id": "vorlieben", "data": {"title": "Vorlieben", "intro": "Test", "order": 1, "updatedAt": "2026-01-01T00:00:00.000Z", "items": [
            {"group": "Ernährung", "key": "ernaehrung.alltagsfaktor", "kind": "number", "label": "Alltagsfaktor", "step": 0.025, "value": 1.375},
            {"group": "Training", "key": "training.sport_fest", "kind": "table", "label": "Sport", "editRows": True, "value": [{"name": "Tennis", "tag": "do", "von": "16:00", "bis": "17:00", "sicher": "fest", "hinweis": ""}],
             "columns": [{"k": "name", "kind": "text", "label": "Sport"}, {"k": "tag", "kind": "select", "label": "Tag", "options": [["do", "Donnerstag"]]}, {"k": "von", "kind": "time", "label": "von"}, {"k": "bis", "kind": "time", "label": "bis"}, {"k": "sicher", "kind": "select", "label": "Sicherheit", "options": [["fest", "fest"]]}, {"k": "hinweis", "kind": "text", "label": "Hinweis"}]}]}},
        {"collection": "wissen", "id": "regeln", "data": {"title": "Regeln", "intro": "Test", "order": 2, "updatedAt": "2026-01-01T00:00:00.000Z", "items": [
            {"group": "Training: Wochenaufbau", "key": "training.aufteilung", "kind": "text", "label": "Aufteilung der Einheiten", "value": "Bei 3 Einheiten Ganzkörper."},
            {"group": "Training: Volumen und Intensität", "key": "training.muskelversagen", "kind": "list", "label": "Nähe zum Muskelversagen", "value": ["Meist 1 bis 3 Wiederholungen Reserve.", "Letzter Satz darf näher ans Versagen."]}]}},
        {"collection": "ki", "id": "systemprompt", "data": {"title": "Claude-Anweisung", "updatedAt": "2026-01-01T00:00:00.000Z", "text": "Testanweisung: Lies zuerst wissen/datenmodell."}},
        {"collection": "wissen", "id": "datenmodell", "data": {"title": "Datenmodell", "intro": "Test", "order": 4, "layout": "model", "updatedAt": "2026-01-01T00:00:00.000Z", "items": [
            {"group": "Profil", "key": "profile.age", "kind": "model", "label": "Alter", "typ": "zahl", "pflicht": True}]}},
    ]
    return rows, iso(today)

def echt(ordner):
    rows = []
    for f in sorted(glob.glob(os.path.join(ordner, "*", "*.json"))):
        rows.append({"collection": os.path.basename(os.path.dirname(f)), "id": os.path.splitext(os.path.basename(f))[0], "data": json.load(open(f, encoding="utf-8"))})
    return rows, dt.date.today().isoformat()

# ---------- Mini-Testrahmen ----------
results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  ok   " if ok else "  FEHLT ") + name + (("  -> " + str(detail)) if (detail and not ok) else ""))

def wait_until(page, js, timeout=8000):
    """Wartet, bis der JavaScript-Ausdruck wahr ist. Fragt per evaluate ab (wait_for_function nutzt eval, das die strenge CSP der Seite verbietet)."""
    waited = 0
    while not page.evaluate("() => " + js):
        if waited >= timeout:
            raise TimeoutError("Bedingung nicht erfüllt: " + js)
        page.wait_for_timeout(100); waited += 100

def serve():
    class Leise(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Leise, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"

def run(rows, today, label, full):
    print(f"\n=== {label} ===")
    srv, base = serve()
    mock_js = open(os.path.join(ROOT, "tests", "mock-supabase.js"), encoding="utf-8").read()
    problems = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(timezone_id="Europe/Berlin", locale="de-DE", viewport={"width": 390, "height": 844}, accept_downloads=True)
        ctx.route("**/js/vendor/supabase.js", lambda r: r.fulfill(body=mock_js, content_type="application/javascript"))
        ctx.route(lambda u: not u.startswith(base) and not u.startswith("data:") and not u.startswith("blob:"), lambda r: r.abort())
        ctx.add_init_script("window.__FIXTURE__ = " + json.dumps(rows) + ";")
        page = ctx.new_page()
        page.on("pageerror", lambda e: problems.append("pageerror: " + str(e)))
        page.on("console", lambda m: problems.append("console." + m.type + ": " + m.text) if m.type in ("error",) and "fonts.g" not in m.text and "ERR_FAILED" not in m.text else None)
        page.goto(base + "index.html")
        page.wait_for_selector("#gate-form:not([hidden])")

        # 1. Ohne Anmeldung kein Inhalt, nur die Anmeldung
        check("Anmeldeseite sichtbar", page.is_visible("#gate"))
        check("kein „Passwort vergessen“ und keine Registrierung auf der Anmeldeseite", not any(w in page.inner_text("#gate").lower() for w in ("vergessen", "registr", "konto erstellen")))
        check("ohne Anmeldung keine Daten im Dokument", "Haferflocken" not in page.inner_text("body") and "Bankdrücken" not in page.inner_text("body"))
        page.fill("#gate-email", MAIL); page.fill("#gate-pw", "falsch"); page.click("#gate-submit")
        wait_until(page, "document.getElementById('gate-msg').textContent.length>0")
        check("falsches Passwort wird abgewiesen", "stimmt nicht" in page.inner_text("#gate-msg") and page.is_visible("#gate"), page.inner_text("#gate-msg"))
        check("nach Fehlversuch bleiben Daten unsichtbar", "Haferflocken" not in page.inner_text("body"))
        page.fill("#gate-pw", PW); page.click("#gate-submit")
        page.wait_for_selector("#gate", state="hidden")
        wait_until(page, "document.querySelector('#view .empty')===null || !/Lade deine Daten/.test(document.querySelector('#view').innerText)")
        check("nach Anmeldung verschwindet die Anmeldung", not page.is_visible("#gate"))

        # 2. Alle Reiter zeichnen ohne Fehler
        for tab, name in (("overview", "Übersicht"), ("training", "Training"), ("nutrition", "Ernährung"), ("body", "Wissen")):
            page.click(f'#nav button[data-tab="{tab}"]'); page.wait_for_timeout(250)
            txt = page.inner_text("#view")
            check(f"Reiter {name} zeichnet Inhalt", len(txt) > 40 and "Lade deine Daten" not in txt and "Keine Verbindung" not in txt, txt[:120])
        if full:
            for sub in ("Heute", "Plan", "Übungen"):
                page.click('#nav button[data-tab="training"]')
                loc = page.locator("#view button", has_text=sub).first
                if loc.count():
                    loc.click(); page.wait_for_timeout(200)
                    check(f"Training/{sub} zeichnet ohne Fehler", len(page.inner_text("#view")) > 40)

        # 2b. Ein von log_meal angelegter Eintrag mit Zutaten wird in der Ernährung richtig gezeigt
        if not full:
            page.click('#nav button[data-tab="nutrition"]'); page.wait_for_timeout(300)
            check("Ernährung zeigt den Eintrag mit Zutaten", "Kartoffeln mit Hähnchen" in page.inner_text("#view"))
            check("Ernährung rechnet die Tagessumme aus beiden Einträgen (794 kcal)", "794" in page.inner_text("#view"), page.inner_text("#view")[:300].replace("\n", " "))
            tg = page.locator('[data-act="meal-toggle"]').first
            if tg.count():
                tg.click(); page.wait_for_timeout(300)
            check("Zutaten lassen sich aufklappen", "Kartoffeln, 300 g" in page.inner_text("#view") and "Hähnchen, 150 g" in page.inner_text("#view"))
            # Der Hinweis „Noch keine Nährwerte geplant“ ist an einem künftigen Tag so groß wie an einem vergangenen Tag ohne Plan
            pad = "(()=>{const e=document.getElementById('np-empty');if(!e)return null;const s=getComputedStyle(e);return s.paddingTop+'/'+s.paddingBottom;})()"
            page.locator('[data-act="nut-next"]').click(); page.wait_for_timeout(250)
            pad_future = page.evaluate(pad)
            page.locator('[data-act="nut-today"]').click(); page.wait_for_timeout(150)
            page.locator('[data-act="nut-prev"]').click(); page.wait_for_timeout(250)
            pad_past = page.evaluate(pad)
            page.locator('[data-act="nut-today"]').click(); page.wait_for_timeout(150)
            check("Hinweis ohne Nährwerte ist in der Zukunft so groß wie an anderen Tagen", pad_future is not None and pad_future == pad_past, f"{pad_future} vs {pad_past}")

        # 3. Schreiben: Wasser (days/<heute>)
        page.click('#nav button[data-tab="overview"]'); page.wait_for_timeout(200)
        before = page.evaluate("(d)=>{const x=window.__MOCK_STORE__.get('days',d);return x&&x.waterMl||0}", today)
        btn = page.locator('[data-act="wt-add"][data-n="b"]').first
        if btn.count():
            btn.click(); page.wait_for_timeout(600)
            after = page.evaluate("(d)=>{const x=window.__MOCK_STORE__.get('days',d);return x&&x.waterMl||0}", today)
            check("Wasser wird in der Datenbank gespeichert", after > before, f"{before} -> {after}")
        else:
            check("Wasser-Knopf gefunden", False)

        # 4. Wissen ist nur lesbar, Datenmodell und Startgewicht werden nicht gezeigt
        if not full:
            page.click('#nav button[data-tab="body"]'); page.wait_for_timeout(250)
            check("Vorlieben, Regeln und Auswertung sind ein Block je Dokument und zu Beginn zugeklappt",
                  page.locator("#view details.wz").count() == 2 and page.locator("#view details.wz[open]").count() == 0)
            check("Zugeklappt steht der Inhalt nicht auf der Seite", "Alltagsfaktor" not in page.inner_text("#view") and "Bei 3 Einheiten" not in page.inner_text("#view"))
            page.locator('#view details.wz[data-wz="regeln"] > summary').click(); page.wait_for_timeout(200)
            check("Ein Klick klappt den Block auf", page.locator('#view details.wz[data-wz="regeln"][open]').count() == 1 and "Bei 3 Einheiten Ganzkörper." in page.inner_text("#view"))
            page.click('#nav button[data-tab="nutrition"]'); page.wait_for_timeout(200)
            page.click('#nav button[data-tab="body"]'); page.wait_for_timeout(250)
            check("Aufgeklappter Block bleibt beim Reiterwechsel offen", page.locator('#view details.wz[data-wz="regeln"][open]').count() == 1)
            page.locator('#view details.wz[data-wz="regeln"] > summary').click(); page.wait_for_timeout(200)
            check("Ein zweiter Klick klappt ihn wieder zu", page.locator('#view details.wz[open]').count() == 0)
            page.evaluate("document.querySelectorAll('#view details.wz').forEach(d=>{d.open=true;})"); page.wait_for_timeout(200)
            txt = page.inner_text("#view")
            check("Wissen zeigt den Vorlieben-Wert", "Alltagsfaktor" in txt and "1,375" in txt, txt[:200].replace("\n", " "))
            check("Wissen zeigt den Regeltext", "Bei 3 Einheiten Ganzkörper." in txt)
            check("Gruppen werden in Hauptüberschrift und Untergruppe gegliedert",
                  page.locator('#view details.wz[data-wz="regeln"] .wz-mh').count() == 1 and page.locator('#view details.wz[data-wz="regeln"] .wz-subgrp').count() == 2
                  and "wochenaufbau" in txt.lower() and "volumen und intensität" in txt.lower() and "training: wochenaufbau" not in txt.lower(),
                  page.locator('#view details.wz[data-wz="regeln"]').inner_text()[:200].replace("\n", " "))
            check("Listen werden als Aufzählung gezeigt", page.locator("#view .wz-list li").count() == 2 and "Meist 1 bis 3 Wiederholungen Reserve." in txt)
            check("Aktuelles Gewicht kommt aus dem Daily Check-in (82,5 kg)", "Aktuelles Gewicht" in txt and "82,5" in txt and "80" not in page.locator("#view .wz-item", has_text="Aktuelles Gewicht").first.inner_text(), txt[:300].replace("\n", " "))
            check("Wissen hat keine Eingabefelder und keinen Speichern-Knopf", page.locator("#view input, #view textarea, #view select, #view [data-act^='wz-'], #view [data-act^='pf-']").count() == 0)
            check("Datenmodell wird nicht angezeigt", "Datenmodell" not in txt)
            check("Startgewicht gibt es nicht mehr", "Startgewicht" not in txt)
            check("Deine Daten werden nur angezeigt (Alter 30, Ziel Muskelaufbau)", "Alter" in txt and "30" in txt and "Muskelaufbau" in txt and "Trainingsvorlieben" not in txt, txt[:300].replace("\n", " "))

        # 4b. Claude-Anweisung über den Knopf in der Kopfzeile
        if not full:
            check("Claude-Knopf steht vor dem Abmelden-Knopf", page.evaluate("document.querySelector('#btn-claude').nextElementSibling.id") == "btn-logout")
            page.click("#btn-claude"); page.wait_for_selector("#claude-dlg[open]")
            check("Claude-Fenster zeigt die gespeicherte Anweisung", "Lies zuerst wissen/datenmodell" in page.inner_text("#claude-text"), page.inner_text("#claude-text"))
            page.click("#claude-close"); page.wait_for_selector("#claude-dlg", state="hidden")
            check("Claude-Fenster lässt sich schließen", not page.evaluate("document.querySelector('#claude-dlg').open"))

        # 5. Änderung von einem anderen Gerät (Realtime) erscheint
        page.click('#nav button[data-tab="overview"]'); page.wait_for_timeout(200)
        marker = 1234
        page.evaluate("""([d,m])=>{const cur=window.__MOCK_STORE__.get('days',d)||{date:d};cur.waterMl=m;window.__MOCK_STORE__.remoteUpsert('days',d,cur);}""", [today, marker])
        page.wait_for_timeout(600)
        check("Änderung eines anderen Geräts erscheint live", "1.234" in page.inner_text("#view") or "1234" in page.inner_text("#view") or "1,2" in page.inner_text("#view"), page.inner_text("#view")[:200].replace("\n", " "))

        # Bis hierher darf die Konsole keine Fehler enthalten
        check("bisher keine Fehler in der Konsole (CSP, Skript)", not problems, "; ".join(problems[:4]))
        problems.clear()

        # 6. Fehler beim Speichern zeigt Hinweis, Seite bleibt benutzbar (die Störung ist gewollt)
        page.evaluate("window.__MOCK_STORE__.failNext={code:'42501',message:'permission denied'}")
        if btn.count():
            btn.click(); page.wait_for_timeout(500)
            check("Fehler beim Speichern zeigt Hinweis", page.is_visible("#toast") and "nicht" in page.inner_text("#toast").lower(), page.inner_text("#toast"))
            check("Seite bleibt nach Fehler benutzbar", len(page.inner_text("#view")) > 40)
        problems[:] = [x for x in problems if "permission denied" not in x]

        # 7. Es gibt keinen Backup-Knopf mehr (die Sicherung läuft nicht über die Seite)
        check("Kopfzeile hat keinen Backup-Knopf mehr", page.locator("#btn-export, [aria-label*='Backup'], [title*='Backup']").count() == 0)
        check("Kopfzeile hat noch Darstellung, Claude und Abmelden", all(page.locator(s).count() == 1 for s in ("#btn-theme", "#btn-claude", "#btn-logout")))

        # 8. Sitzung bleibt nach Neuladen, Abmelden sperrt wieder
        page.reload(); page.wait_for_selector("#gate", state="hidden", timeout=8000)
        check("nach Neuladen bleibt die Sitzung", not page.is_visible("#gate"))
        page.click("#btn-logout"); page.wait_for_selector("#confirm-ok", state="visible"); page.click("#confirm-ok")
        page.wait_for_selector("#gate-form:not([hidden])", timeout=8000)
        check("nach Abmelden erscheint wieder die Anmeldung", page.is_visible("#gate"))
        check("nach Abmelden keine Daten sichtbar", "Haferflocken" not in page.inner_text("body"))

        # 9. Kein Hinweis auf verbotene Quellen
        check("danach keine unerwarteten Fehler (CSP, Skript)", not problems, "; ".join(problems[:4]))
        b.close()
    srv.shutdown()

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--echt")
    a = ap.parse_args()
    rows, today = synthetic()
    run(rows, today, "erfundene Testdaten", full=False)
    if a.echt:
        rows, today = echt(a.echt)
        run(rows, today, "echte Daten (lokal)", full=True)
    bad = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(bad)} von {len(results)} Prüfungen bestanden")
    sys.exit(1 if bad else 0)
