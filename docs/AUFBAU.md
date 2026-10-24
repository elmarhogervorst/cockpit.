# Aufbau des Cockpits

Dieses Dokument beschreibt, wie das Cockpit zusammengesetzt ist, wo welche Daten liegen und warum einige Dinge so gebaut sind.

## 1. Überblick

```
Handy / Browser
   │  lädt statische Dateien
   ▼
GitHub Pages  ──────────────  index.html, css/, js/, assets/        (öffentlich, ohne Daten)
   │
   │  nach der Anmeldung: Daten per HTTPS + Websocket
   ▼
Supabase  ──  Auth (E-Mail + Passwort, ein Nutzer)
          └─  Postgres: Tabelle public.docs (RLS)  ← alle Daten
              Realtime: Änderungen kommen live auf alle Geräte
```

- **Seite:** reines HTML, CSS und JavaScript, kein Build-Schritt. Was im Repo liegt, wird ausgeliefert.
- **Daten:** in Supabase (Postgres). Das Repo enthält keine Daten.
- **Anmeldung:** nur E-Mail + Passwort. Es gibt keine Registrierung.

## 2. Wie die Seite geladen wird

`index.html` lädt die Skripte klassisch (ohne `type="module"`) in dieser Reihenfolge:

1. `js/vendor/supabase.js`, `js/config.js` (Bibliothek und Projektadresse)
2. `js/db-supabase.js` (`window.CockpitDb`) und `js/auth.js` (`window.CockpitAuth`)
3. `js/01-…` bis `js/14-…` (die eigentliche Anwendung)

Weil alle Skripte klassisch geladen werden, teilen sie sich einen gemeinsamen Gültigkeitsbereich: `const S`, `const UI`, `render()`
usw. aus `01`/`03` sind in allen späteren Dateien sichtbar. **Die Reihenfolge ist daher wichtig.** Jede Datei beginnt mit
`'use strict';`.

Die Anwendung stammt aus einer einzigen großen HTML-Datei und wurde an den Abschnittsmarken in Dateien zerlegt, ohne den Code
inhaltlich umzuschreiben. Geändert wurde nur: Datenbankzugriff (`02`), Fehlertexte (`02`, `03`, `13`), Abmelden (`05`),
ein zusätzliches Symbol (`01`).

## 3. Anmeldung (`js/auth.js`)

- `window.CockpitAuth.ready()` liefert erst eine Datenbank-Schnittstelle, wenn eine gültige Sitzung da ist. Bis dahin sieht man nur
  die Anmeldeseite (`#gate`), und es werden **keine** Daten angefragt.
- Anmelden: `signInWithPassword`. Falsche Eingaben zeigen eine Meldung, die Seite bleibt gesperrt.
- Es gibt bewusst kein „Passwort vergessen“ und keine E-Mails. Ein neues Passwort setzt der Eigentümer in Supabase (siehe README).
  `detectSessionInUrl` ist aus: Anmeldedaten in der Adresszeile (Links) werden ignoriert.
- Die Sitzung liegt im `localStorage` unter dem Schlüssel `cockpit.auth` und wird automatisch erneuert.
- Abmelden (Kopfzeile) beendet die Sitzung und lädt die Seite neu; danach ist wieder nur die Anmeldeseite sichtbar.

## 4. Datenspeicher (`js/db-supabase.js`)

Die Anwendung wurde für eine Datenbank mit „Sammlung / Dokument“-Modell geschrieben. Damit im Code nichts umgebaut werden muss,
bildet `db-supabase.js` genau diese Schnittstelle auf Supabase ab:

| Aufruf in der Anwendung                    | Wirkung in Supabase                                      |
|--------------------------------------------|----------------------------------------------------------|
| `DB.doc('days/2026-10-23').get()`          | `select` auf `docs` mit `collection` + `id`              |
| `.set(daten)`                              | `upsert` (ersetzt das Dokument)                          |
| `.update(teil)`                            | RPC `merge_doc` (Felder zusammenführen)                  |
| `.delete()`                                | `delete`                                                 |
| `.onSnapshot(cb)` / `collection().onSnapshot(cb)` | erst vollständig laden, dann Realtime-Änderungen einarbeiten |
| `collection('days').orderBy('date','desc')` | Sortierung im Browser                                   |

Details:

- **Eine Tabelle für alles:** `public.docs(collection, id, data jsonb, version, created_at, updated_at)`. Primärschlüssel ist
  `(collection, id)`. `data` muss ein JSON-Objekt sein.
- **Teil-Aktualisierung:** `merge_doc` führt `data || patch` aus. Ein Feld mit dem Wert `{"__delete__": true}` wird entfernt (Ersatz
  für das „Feld löschen“ der alten Datenbank). Fehlt das Dokument, kommt der Fehlercode `P0002`.
- **Version:** Ein Datenbank-Auslöser zählt `version` bei jeder Änderung hoch. Der Browser verwirft Realtime-Ereignisse, deren
  Version nicht neuer ist als die bekannte. So überschreibt ein verspätetes Ereignis keine neuere Änderung.
- **Seitenweises Laden:** Abfragen holen 1000 Zeilen pro Seite, damit auch viele Tage vollständig ankommen.
- **Wieder verbinden:** Bei Verbindungsabbruch, `online` und wenn der Tab wieder sichtbar wird, lädt jede Sammlung neu.
- **Fehler:** Netzfehler → `unavailable` (die Schreibwarteschlange versucht es einmal erneut), fehlende Rechte/abgelaufene Sitzung →
  `revoked` („Melde dich neu an“), `P0002` → `not-found`.

## 4b. Einträge von außen: `log_meal`

Damit Werkzeuge außerhalb der Seite (zum Beispiel der Claude-Skill „logge-essen“) Mahlzeiten eintragen können, ohne SQL für
das Dokumentformat zusammenzubauen, gibt es die Datenbankfunktion `public.log_meal(p_meal jsonb, p_day date default null)`
(`supabase/migrations/0003_mahlzeit_eintragen.sql`). Sie macht dasselbe wie das Formular im Reiter Ernährung:

- hängt die Mahlzeit an `days/<Datum>.meals` an und legt den Tag bei Bedarf an (ein Aufruf = ein atomarer Schritt),
- bei `ingredients` ergeben sich kcal und Makros aus der Summe der Zutaten (kcal ganzzahlig, Makros eine Nachkommastelle, wie in
  `js/04-berechnungen.js`), fehlende kcal werden aus den Makros gerechnet (4/4/9),
- ohne Datum gilt heute (Europe/Berlin), erlaubt sind Tage von einem Jahr zurück bis 14 Tage voraus,
- läuft mit den Rechten des Aufrufers: nur der Eigentümer kann sie ausführen, `anon` und fremde Konten werden abgewiesen,
- gibt Eintrag, Tagessumme und Tagesziel zurück. Offene Seiten zeigen den neuen Eintrag sofort (Realtime).

Eingabe, Beispiel: `{"name":"Kartoffeln mit Hähnchen","ingredients":[{"name":"Kartoffeln, 300 g","kcal":230,"protein":6,"carbs":50,"fat":0.3}, …]}`.

## 5. Daten (Sammlungen)

| Sammlung    | Dokument-IDs         | Inhalt (Felder)                                                                                                   |
|-------------|----------------------|-------------------------------------------------------------------------------------------------------------------|
| `profile`   | `main`               | Geschlecht, Alter, Größe, Zielgewicht, Ziel (das aktuelle Gewicht steht hier nicht, es kommt aus `days`)         |
| `targets`   | `main`               | Tagesziele, z. B. Wasser (`waterGoalMl`)                                                                          |
| `exercises` | beliebig             | Übungen: Name, Muskelgruppe, Beschreibung, zeitbasiert ja/nein                                                    |
| `presets`   | beliebig             | Trainingsvorlagen: Name, Reihenfolge, Übungen mit Sätzen                                                          |
| `days`      | Datum `JJJJ-MM-TT`   | Ein Tag: Plan, Training (`workout`), Mahlzeiten (`meals`), Aktivitäten, Check-in, Ziele des Tages, Wasser, Gewicht |
| `wissen`    | `vorlieben`, `regeln`, `auswertung`, `datenmodell` | Dokumente für den Reiter **Wissen** (siehe unten)                                    |
| `ki`        | `systemprompt`       | Anweisung an Claude (`title`, `text`, `updatedAt`), angezeigt über den Claude-Knopf in der Kopfzeile              |

Reiter in der Oberfläche: Übersicht (`overview`), Training (`training`), Ernährung (`nutrition`) und **Wissen** (Reiter-ID `body`,
historisch „Körper“).

### Reiter „Wissen“

Das feste Regelwerk, nach dem Claude plant und auswertet: Vorlieben, Regeln, Auswertung, dazu eine Beschreibung des
Datenmodells. Jedes Dokument hat `title`, `intro`, `order`, `items[]` (Felder mit `kind`: `number`, `text`, `bool`, `list`,
`table`) und optional `layout`. Bei `list` ist `value` eine Liste von Sätzen. Das Feld `group` darf `Hauptgruppe: Untergruppe`
heißen; die Seite macht daraus eine Überschrift mit einem Kasten je Untergruppe, Tabellen erscheinen als Karten je Zeile.
Jedes Dokument ist ein Block, der sich ein- und ausklappen lässt (zu Beginn zu, die Wahl bleibt beim Reiterwechsel erhalten).
Die Oberfläche zeichnet sie generisch und **nur lesend**: Sie bietet keine Eingabefelder und
schreibt nie in `wissen`. Geändert wird es allein von Claude (per SQL), auf Wunsch im Chat. Das Dokument `datenmodell`
(`layout: model`) ist für Claude gedacht und wird auf der Seite nicht angezeigt. Die Sperre gilt nur in der Oberfläche, nicht
in der Datenbank (der angemeldete Eigentümer dürfte technisch schreiben).

Der Reiter zeigt außerdem „Deine Daten“ (Ziel, Geschlecht, Alter, Größe, aktuelles und Zielgewicht aus `profile/main`) und den
Gewichtsverlauf, ebenfalls nur lesend. Das Profil ändert allein Claude auf Wunsch. Das aktuelle Gewicht wird nirgends
gespeichert: Es ist der jüngste Wert `days/<Datum>.weight` aus dem Daily Check-in und bleibt leer, solange noch nie
gewogen wurde.

### Claude-Anweisung

Der Knopf „Claude“ in der Kopfzeile öffnet ein Fenster mit dem Text aus `ki/systemprompt`: Ablauf (auswerten, Training planen,
Nährwerte planen), wo die Daten liegen (mit Verweis auf `wissen/datenmodell`), Schreibregeln (`log_meal`, `merge_doc`) und
Grundsätze. Das Fenster ist nur lesend und hat einen Kopieren-Knopf; der Text wird, wie alles andere, nur über die Datenbank
geändert.

## 6. Sicherheit

**Zugriff auf Daten** (`supabase/migrations/0001`, `0002`):

- Row Level Security auf `public.docs`. Einzige Regel: `docs_owner_all` für die Rolle `authenticated`, mit Prüfung
  `private.is_owner()`.
- `private.is_owner()` prüft, ob `auth.uid()` in `private.app_owner` steht. Das Schema `private` ist für den Browser nicht
  erreichbar; die Tabelle `app_owner` hat RLS ohne Regel, ist also nur über die `security definer`-Funktion lesbar.
- Rolle `anon` (nicht angemeldet) hat auf `docs` keinerlei Rechte (auch nicht lesen).
- Die Rolle `authenticated` hat auf `docs` nur lesen, einfügen, ändern, löschen (`0004` nimmt TRUNCATE, TRIGGER, REFERENCES weg;
  TRUNCATE wäre das eine Recht, das Row Level Security umgeht).
- `merge_doc` läuft als `security invoker`, unterliegt also denselben Regeln; `anon` darf sie nicht ausführen.
- Nach der Einrichtung geprüft: Eigentümer sieht alle Dokumente; ein fremdes angemeldetes Konto sieht 0 Zeilen und kann weder
  einfügen noch ändern; `anon` wird abgewiesen; eine Registrierung schlägt fehl.

**Bekannte Restgrenze (Realtime):** Supabase wendet Row Level Security bei Live-Ereignissen nur auf Einfügen und Ändern an, nicht
auf Löschen. Wer den (öffentlichen) publishable Schlüssel kennt, könnte sich theoretisch auf den Live-Kanal schalten und beim
Löschen eines Dokuments dessen Schlüssel (Sammlung und Kennung, z. B. ein Datum) sehen, aber nie Inhalte. Das ist im Alltag
bedeutungslos und wird bewusst hingenommen.

**Keine Registrierung:**

1. Im Supabase-Dashboard ist „Allow new users to sign up“ ausgeschaltet.
2. Zusätzlich verhindert der Auslöser `block_new_users` auf `auth.users` jedes neue Konto (`Registrierung ist deaktiviert`), auch
   wenn der Schalter versehentlich wieder angeht.

**Browser:**

- Content-Security-Policy in `index.html`: `default-src 'none'`, Skripte nur von der eigenen Seite, `connect-src` nur zum
  eigenen Supabase-Projekt (https + wss), Stile von der Seite und Google Fonts, `base-uri 'none'`, `form-action 'none'`.
- `robots` ist auf `noindex` gesetzt.
- Der publishable Schlüssel in `js/config.js` ist öffentlich gedacht. Der geheime Schlüssel (`service_role`/`secret`) wird nicht
  verwendet und darf nie ins Repo.

**Grenzen:** GitHub Pages ist öffentlich erreichbar. Wer den Link kennt, sieht den Code und die Anmeldeseite, aber keine Daten. Die
Stärke des Schutzes hängt am Passwort. Sicherungskopien enthalten persönliche Daten und gehören nicht ins Repo.

## 7. Betrieb

- **Backup:** Die Seite hat keinen Backup-Knopf. Der Free-Tarif von Supabase hat keine automatischen Backups. Kopien einzelner
  Dokumente legt bei Bedarf Claude in der Datenbank an (Schema `private`, nicht über die API erreichbar); eine vollständige
  Sicherung der Tabelle `docs` geht über das Supabase-Dashboard. Sicherungsdateien gehören nicht ins Repo.
- **Versionsstempel:** GitHub Pages lässt Dateien bis zu zehn Minuten im Browser zwischenspeichern. Damit nach einem Update nicht
  die neue `index.html` mit einer alten Skriptdatei zusammentrifft (Folge: Symbole fehlen, Teile der Seite sind tot), trägt jede
  lokale Skript- und Stildatei in `index.html` die Prüfsumme ihres Inhalts (`?v=…`). Vor jedem Commit `python3 tools/stempel.py`
  ausführen; `tests/run_tests.py` prüft das.
- **Pausierung:** Free-Projekte ohne Aktivität werden nach etwa einer Woche pausiert und im Dashboard wieder gestartet.
- **Schema ändern:** neue Datei in `supabase/migrations/` anlegen (fortlaufende Nummer) und im SQL-Editor ausführen; die Dateien
  sind das Protokoll, wie die Datenbank entstanden ist.
- **Supabase-Bibliothek aktualisieren:** neue UMD-Datei nach `js/vendor/supabase.js` legen, `VERSION.txt` anpassen und die Tests
  laufen lassen. Die CSP erlaubt nur eigene Skripte, daher keine CDN-Einbindung.
- **Pages-Adresse:** Das Repo heißt `cockpit.` (mit Punkt am Ende). Die Adresse auf Pages lautet dann
  `https://elmarhogervorst.github.io/cockpit./`. Alle Pfade in der Seite sind relativ, sie funktioniert unter jedem Unterpfad.
  Wenn der Punkt Probleme macht, hilft ein Umbenennen des Repos (z. B. `cockpit`); dann nur Pages-Adresse und die Supabase-URL-Einstellungen anpassen.

## 8. Tests (`tests/`)

`tests/run_tests.py` startet einen lokalen Webserver, öffnet die Seite in Chromium (Playwright, Handy-Format) und ersetzt
`js/vendor/supabase.js` durch `tests/mock-supabase.js`, ein kleines Nachbild von Auth, Tabelle, RPC und Realtime. Die Prüfungen:

- Ohne Anmeldung erscheint nur die Anmeldeseite, keine Daten im Dokument; falsches Passwort wird abgewiesen.
- Nach der Anmeldung zeichnen alle vier Reiter ohne Konsolen- oder CSP-Fehler.
- Wasser eintragen und ein Wissen-Feld speichern landen in der (nachgebauten) Datenbank.
- Eine Änderung „von einem anderen Gerät“ erscheint ohne Neuladen.
- Ein verweigertes Speichern zeigt eine Meldung, die Seite bleibt benutzbar.
- Die Kopfzeile hat keinen Backup-Knopf mehr, aber noch Darstellung, Claude und Abmelden.
- Die Sitzung überlebt ein Neuladen; Abmelden sperrt die Seite wieder.

Nicht abgedeckt, weil nur mit dem echten Projekt prüfbar: echte Netzwerkverbindung, die E-Mail zum Zurücksetzen des Passworts und das
Verhalten unter der echten Pages-Adresse.
