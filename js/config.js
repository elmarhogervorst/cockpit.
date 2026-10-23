'use strict';
/* Verbindung zu Supabase.
   Beides ist für Browser gedacht und darf öffentlich im Repo stehen:
   - url: Adresse des Projekts
   - key: der "publishable" Schlüssel. Er erlaubt allein nichts. Ohne Anmeldung lehnt die Datenbank jeden
     Zugriff ab, und eingeloggt darf nur der eine eingetragene Eigentümer lesen und schreiben (siehe supabase/migrations).
   Geheime Schlüssel ("secret", "service_role") gehören NIE in dieses Repo. */
window.COCKPIT_CONFIG = {
  url: 'https://qwgzimxbbfaprdbucgyx.supabase.co',
  key: 'sb_publishable_sS_eiEd_RCvvk_ZS1UMEUg_gyODRoYy'
};
