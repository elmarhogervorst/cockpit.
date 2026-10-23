-- Rechte auf das Nötige beschränken (Prinzip der geringsten Rechte).
--
-- Supabase vergibt an neue Tabellen automatisch auch TRUNCATE, TRIGGER und REFERENCES an die Rolle "authenticated".
-- Die Seite braucht nur lesen, einfügen, ändern und löschen. TRUNCATE wäre außerdem das eine Recht, das Row Level Security
-- umgeht. Der Zähler-Auslöser (docs_touch) feuert unabhängig von diesen Rechten.
revoke truncate, references, trigger on public.docs from authenticated;

-- Die Auslöser-Funktion wird nur vom Auslöser aufgerufen, nicht von Nutzern.
revoke all on function private.docs_touch() from public, anon, authenticated;
