# cockpit.

Persönliches Cockpit für Training, Ernährung und Fortschritt. Eine statische Webseite (kein Build-Schritt), die ihre Daten in
Supabase speichert. Sie läuft auf GitHub Pages und lässt sich auf dem Handy wie eine App zum Startbildschirm hinzufügen.

> Dieses Repo ist **öffentlich**, enthält aber **keine persönlichen Daten**. Der Code ist offen, die Daten liegen in der Datenbank
> und sind nur nach Anmeldung des einen Eigentümers lesbar (siehe [Sicherheit](#sicherheit)).

## Aufbau auf einen Blick

```
index.html            Seitengerüst, Anmeldung (#gate), Reiter, Dialoge
css/
  cockpit.css         Darstellung der Oberfläche (hell/dunkel)
  basis.css           Handy-Ränder, Anmeldeseite
js/
  config.js           Adresse und öffentlicher Schlüssel des Supabase-Projekts
  auth.js             Anmeldung mit E-Mail + Passwort (keine Registrierung, kein „Passwort vergessen“)
  db-supabase.js      Dokumentspeicher: bildet die kleine Datenbank-Schnittstelle auf Supabase ab
  01-grundlagen.js    Konstanten, Hilfsfunktionen, Zustand (S, UI)
  02-datenbank.js     Laden aller Sammlungen, Live-Abo, Fehlertexte
  03-oberflaeche.js   Zeichnen, Reiter, Meldungen
  04-berechnungen.js  Kalorien, Makros, Fortschritt
  05-kopfzeile-dialoge.js  Wochenwahl, Darstellung, Claude-Anweisung, Abmelden, Bestätigungsdialog
  06-uebersicht.js    Reiter Übersicht
  07-ernaehrung.js    Reiter Ernährung
  08-aktivitaeten-wasser.js  Aktivitäten und Wasser
  09-training-heute.js  Training: heute
  10-training-plan.js   Training: Plan und Vorlagen
  11-uebungsbibliothek.js  Training: Übungen
  12-wissen-daten.js  Reiter Wissen: Deine Daten (aktuelles Gewicht aus dem Check-in) und Gewichtsverlauf, nur Anzeige
  13-wissen-sammlung.js  Reiter Wissen: Regelwerk von Claude als ein- und ausklappbare Blöcke, nur lesen
  14-start.js         Start
  vendor/supabase.js  Supabase-Bibliothek (supabase-js, MIT), Version in VERSION.txt
supabase/migrations/  Datenbankschema, Zugriffsregeln, Registrierungssperre, Funktion log_meal (Mahlzeit von außen eintragen)
tests/                Browser-Tests mit nachgebautem Supabase
tools/stempel.py      Versionsstempel (?v=…) an den Skript- und Stildateien in index.html
docs/AUFBAU.md        Ausführliche Beschreibung (Datenmodell, Datenfluss, Entscheidungen)
```

Die Skripte sind bewusst klassische Skripte ohne Module: sie teilen sich einen gemeinsamen Gültigkeitsbereich und werden in der
Reihenfolge der Nummern geladen. Details dazu in [docs/AUFBAU.md](docs/AUFBAU.md).

**Vor jedem Commit, der `js/`, `css/` oder `index.html` ändert:** `python3 tools/stempel.py` ausführen. GitHub Pages lässt Dateien bis
zu zehn Minuten im Browser zwischenspeichern; ohne Stempel kann der Browser nach einem Update die neue Seite mit einer alten
Skriptdatei mischen (dann fehlen zum Beispiel Symbole). Der Stempel ist die Prüfsumme der Datei und ändert die Adresse nur, wenn
sich die Datei ändert. `tests/run_tests.py` schlägt fehl, wenn ein Stempel veraltet ist.

## Zugriff

- Adresse (GitHub Pages): `https://elmarhogervorst.github.io/cockpit./`
- Anmelden geht nur mit E-Mail und Passwort. **Registrieren gibt es nicht.** Wer den Link kennt, sieht nur die Anmeldeseite.
- Auf dem Handy: Seite öffnen, anmelden, dann „Zum Startbildschirm hinzufügen“. Die Sitzung bleibt auf dem Gerät erhalten.
- „Claude“ (Funkeln in der Kopfzeile, links neben Abmelden) zeigt die Anweisung, nach der Claude im Cockpit arbeitet. Sie liegt in
  der Datenbank (`ki/systemprompt`) und lässt sich kopieren.

## Einrichtung (einmalig)

1. **Supabase-Projekt** anlegen, dann die Dateien aus `supabase/migrations/` der Reihe nach im SQL-Editor ausführen.
   Vorher genau **einen** Nutzer unter *Authentication → Users* anlegen (E-Mail + Passwort); `0002` macht ihn zum Eigentümer
   und sperrt jede weitere Registrierung.
2. *Authentication → Sign In / Providers → Email*: **„Allow new users to sign up“ ausschalten**.
3. In `js/config.js` die Projekt-Adresse und den **publishable** Schlüssel eintragen.
4. GitHub: *Settings → Pages → Deploy from a branch → `main` / `(root)`*.

Es werden keine E-Mails verschickt (kein „Passwort vergessen“, keine Einladung). Die Einstellungen *Site URL* und *Redirect URLs*
in Supabase spielen deshalb keine Rolle.

Nie ins Repo gehören: `secret`-/`service_role`-Schlüssel, Passwörter, Backups.

## Passwort ändern

Da es kein „Passwort vergessen“ gibt, wird das Passwort in Supabase gesetzt: *SQL Editor*, dann (E-Mail und Passwort einsetzen):

```sql
update auth.users
   set encrypted_password = extensions.crypt('NEUES-LANGES-PASSWORT', extensions.gen_salt('bf'))
 where email = 'deine@mail.de';
```

Danach in der Seite abmelden und neu anmelden. Das Passwort steht dabei im Verlauf des SQL-Editors; nicht in Dateien oder ins Repo schreiben.

## Weiteren Nutzer anlegen

Absichtlich schwer gemacht. Zuerst den Auslöser entfernen, den Nutzer im Dashboard anlegen, ihn in `private.app_owner`
eintragen und den Auslöser danach wieder anlegen:

```sql
drop trigger block_new_users on auth.users;
-- Nutzer im Dashboard anlegen, danach:
insert into private.app_owner (user_id) values ('<neue user id>');
create trigger block_new_users before insert on auth.users
  for each row execute function private.block_new_users();
```

Alle Eigentümer sehen dieselben Daten (es gibt nur eine gemeinsame Datenmenge).

## Sicherheit

- Der **publishable Schlüssel** in `js/config.js` ist für Browser gedacht und darf öffentlich sein. Er erlaubt allein nichts.
- Jede Zeile der Tabelle `public.docs` ist durch Row Level Security geschützt. Lesen und Schreiben darf nur, wer angemeldet
  **und** in `private.app_owner` eingetragen ist. Ohne Anmeldung (Rolle `anon`) ist die Tabelle gesperrt, auch lesend.
- Neue Konten sind doppelt gesperrt: im Dashboard (Registrierung aus) und per Datenbank-Auslöser auf `auth.users`.
- Die Seite hat eine strenge Content-Security-Policy (`index.html`): Skripte nur von der eigenen Seite, Verbindungen nur zum
  eigenen Supabase-Projekt, keine fremden Inhalte außer Google Fonts.
- Das Passwort wird nie im Code oder Repo gespeichert; die Sitzung liegt im `localStorage` des Geräts. Auf fremden Geräten
  abmelden (Kopfzeile).
- Die Seite ist im Internet erreichbar (Pages-Seiten sind öffentlich). Geschützt sind die **Daten**, nicht die Seite.
  Wähle deshalb ein langes, einmaliges Passwort.

## Tests

```
pip install playwright && playwright install chromium
python3 tests/run_tests.py
```

Die Tests laden die Seite in einem echten Browser und ersetzen Supabase durch `tests/mock-supabase.js` (erfundene Zugangsdaten,
erfundene Daten). Geprüft werden Anmeldung, alle Reiter, Speichern, Änderungen von einem anderen Gerät, Fehlerfall und
Abmelden. Mit `--echt <Ordner>` läuft zusätzlich ein Durchlauf mit eigenen Exportdaten (lokal, Ordner nicht einchecken).
Der Test gegen die echte Datenbank bleibt Handarbeit: anmelden, etwas ändern, auf einem zweiten Gerät nachsehen.

## Betrieb und Grenzen (Supabase Free)

- Ein Projekt ohne Aktivität wird nach etwa einer Woche pausiert; ein Aufruf im Dashboard weckt es wieder auf.
- Es gibt auf dem Free-Tarif **keine automatischen Backups**, und die Seite hat keinen Backup-Knopf. Kopien einzelner Dokumente
  legt bei Bedarf Claude in der Datenbank an (Schema `private`); eine vollständige Sicherung der Tabelle `docs` geht über das
  Supabase-Dashboard.
