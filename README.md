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
  auth.js             Anmeldung mit E-Mail + Passwort (keine Registrierung), Passwort vergessen
  db-supabase.js      Dokumentspeicher: bildet die kleine Datenbank-Schnittstelle auf Supabase ab
  01-grundlagen.js    Konstanten, Hilfsfunktionen, Zustand (S, UI)
  02-datenbank.js     Laden aller Sammlungen, Live-Abo, Fehlertexte
  03-oberflaeche.js   Zeichnen, Reiter, Meldungen
  04-berechnungen.js  Kalorien, Makros, Fortschritt
  05-kopfzeile-dialoge.js  Wochenwahl, Darstellung, Backup, Abmelden, Bestätigungsdialog
  06-uebersicht.js    Reiter Übersicht
  07-ernaehrung.js    Reiter Ernährung
  08-aktivitaeten-wasser.js  Aktivitäten und Wasser
  09-training-heute.js  Training: heute
  10-training-plan.js   Training: Plan und Vorlagen
  11-uebungsbibliothek.js  Training: Übungen
  12-wissen-daten.js  Reiter Wissen: Daten und Beschreibung
  13-wissen-sammlung.js  Reiter Wissen: Anzeige und Bearbeiten
  14-start.js         Start
  vendor/supabase.js  Supabase-Bibliothek (supabase-js, MIT), Version in VERSION.txt
supabase/migrations/  Datenbankschema, Zugriffsregeln, Registrierungssperre
tests/                Browser-Tests mit nachgebautem Supabase
docs/AUFBAU.md        Ausführliche Beschreibung (Datenmodell, Datenfluss, Entscheidungen)
```

Die Skripte sind bewusst klassische Skripte ohne Module: sie teilen sich einen gemeinsamen Gültigkeitsbereich und werden in der
Reihenfolge der Nummern geladen. Details dazu in [docs/AUFBAU.md](docs/AUFBAU.md).

## Zugriff

- Adresse (GitHub Pages): `https://elmarhogervorst.github.io/cockpit./`
- Anmelden geht nur mit E-Mail und Passwort. **Registrieren gibt es nicht.** Wer den Link kennt, sieht nur die Anmeldeseite.
- Auf dem Handy: Seite öffnen, anmelden, dann „Zum Startbildschirm hinzufügen“. Die Sitzung bleibt auf dem Gerät erhalten.
- „Backup“ (Pfeil nach unten in der Kopfzeile) lädt alle Daten als JSON-Datei auf das Gerät. Diese Datei enthält persönliche Daten:
  nicht ins Repo legen (die `.gitignore` fängt `cockpit-backup-*.json` ab).

## Einrichtung (einmalig)

1. **Supabase-Projekt** anlegen, dann die Dateien aus `supabase/migrations/` der Reihe nach im SQL-Editor ausführen.
   Vorher genau **einen** Nutzer unter *Authentication → Users* anlegen (E-Mail + Passwort); `0002` macht ihn zum Eigentümer
   und sperrt jede weitere Registrierung.
2. *Authentication → Sign In / Providers → Email*: **„Allow new users to sign up“ ausschalten**.
3. *Authentication → URL Configuration*: **Site URL** auf die Pages-Adresse setzen und dieselbe Adresse unter *Redirect URLs*
   eintragen (sonst führt der Link in der „Passwort vergessen“-Mail nicht zurück).
4. In `js/config.js` die Projekt-Adresse und den **publishable** Schlüssel eintragen.
5. GitHub: *Settings → Pages → Deploy from a branch → `main` / `(root)`*.

Nie ins Repo gehören: `secret`-/`service_role`-Schlüssel, Passwörter, Backups.

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
erfundene Daten). Geprüft werden Anmeldung, alle Reiter, Speichern, Änderungen von einem anderen Gerät, Fehlerfall, Backup und
Abmelden. Mit `--echt <Ordner>` läuft zusätzlich ein Durchlauf mit eigenen Exportdaten (lokal, Ordner nicht einchecken).
Der Test gegen die echte Datenbank bleibt Handarbeit: anmelden, etwas ändern, auf einem zweiten Gerät nachsehen.

## Betrieb und Grenzen (Supabase Free)

- Ein Projekt ohne Aktivität wird nach etwa einer Woche pausiert; ein Aufruf im Dashboard weckt es wieder auf.
- Es gibt auf dem Free-Tarif **keine automatischen Backups**. Den Knopf „Backup“ regelmäßig benutzen.
