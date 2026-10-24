#!/usr/bin/env python3
"""Versionsstempel für index.html.

GitHub Pages lässt Dateien bis zu zehn Minuten im Browser zwischenspeichern. Nach einem Update kann der Browser dann die neue
index.html mit einer alten Skriptdatei mischen, und die Seite bricht teilweise (zum Beispiel fehlen Symbole). Dieses Skript hängt
darum an jede lokale Skript- und Stildatei in index.html die Prüfsumme ihres Inhalts: ?v=<Prüfsumme>. Ändert sich eine Datei,
ändert sich ihre Adresse, und der Browser holt sie neu. Unveränderte Dateien bleiben im Zwischenspeicher.

Aufruf (vor jedem Commit, der js/, css/ oder index.html ändert):
  python3 tools/stempel.py            schreibt die Stempel in index.html
  python3 tools/stempel.py --pruefen  ändert nichts, Rückgabewert 1 wenn ein Stempel veraltet ist (macht auch tests/run_tests.py)
"""
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
MUSTER = re.compile(r'(<(?:script src|link rel="stylesheet" href)=")((?:js|css)/[^"?]+)(?:\?v=[0-9a-f]+)?(")')


def stempel(pfad):
    with open(os.path.join(ROOT, pfad), "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def gestempelt(text):
    return MUSTER.sub(lambda m: m.group(1) + m.group(2) + "?v=" + stempel(m.group(2)) + m.group(3), text)


def main():
    with open(INDEX, encoding="utf-8") as f:
        alt = f.read()
    neu = gestempelt(alt)
    if "--pruefen" in sys.argv:
        if neu != alt:
            print("Die Versionsstempel in index.html sind veraltet. Bitte python3 tools/stempel.py ausführen.")
            return 1
        print("Versionsstempel in index.html sind aktuell.")
        return 0
    if neu != alt:
        with open(INDEX, "w", encoding="utf-8", newline="") as f:
            f.write(neu)
        print("index.html gestempelt.")
    else:
        print("Nichts zu tun, die Stempel sind aktuell.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
