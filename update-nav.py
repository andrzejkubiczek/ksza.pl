#!/usr/bin/env python3
"""ksza.pl - jedno źródło prawdy dla menu głównego (site-nav).

Strona jest statyczna (bez backendu, bez includes), więc <nav class="site-nav">
był dotąd kopiowany ręcznie w każdym pliku HTML - dodanie nowej pozycji menu
oznaczało edycję kilkunastu plików naraz. Ten skrypt generuje ten fragment
z jednej listy (NAV_ITEMS) i wstawia go do wszystkich plików HTML w repo.

Użycie: edytuj NAV_ITEMS / FAMILY_MAP niżej, potem uruchom:
    python3 update-nav.py
Skrypt tylko podmienia zawartość <nav class="site-nav">...</nav> - nic
więcej w plikach nie rusza. Zawsze uruchom PRZED wdrożeniem po zmianie menu.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent

# (etykieta w menu, plik docelowy, czy plik leży w katalogu głównym repo)
NAV_ITEMS = [
    ("Start", "index.html", True),
    ("Interwały", "interwaly.html", False),
    ("Trójdźwięki", "trojdzwieki.html", False),
    ("Gamy", "gamy.html", False),
    ("Puzzle", "dyktanda.html", False),
    ("Dyktanda", "dyktanda-wysokosciowe.html", False),
    ("Rytm", "rytm.html", False),
    ("O projekcie", "o-projekcie.html", True),
]

# plik HTML -> etykieta pozycji menu, która dla niego dostaje aria-current="page"
FAMILY_MAP = {
    "index.html": "Start",
    "o-projekcie.html": "O projekcie",
    "interwaly.html": "Interwały",
    "interwaly-zapis.html": "Interwały",
    "interwaly-buduj.html": "Interwały",
    "trojdzwieki.html": "Trójdźwięki",
    "trojdzwieki-zapis.html": "Trójdźwięki",
    "trojdzwieki-buduj.html": "Trójdźwięki",
    "gamy.html": "Gamy",
    "gamy-stopnie.html": "Gamy",
    "dyktanda.html": "Puzzle",
    "dyktanda-zapis.html": "Puzzle",
    "dyktanda-wysokosciowe.html": "Dyktanda",
    "rytm.html": "Rytm",
    "rytm-zapis.html": "Rytm",
    "pamiec-melodyczna.html": "Dyktanda",
}

NAV_BLOCK_RE = re.compile(
    r'(<nav class="site-nav" id="site-menu" aria-label="Menu główne">\s*<ul>)'
    r'.*?'
    r'(</ul>\s*</nav>)',
    re.DOTALL,
)

LI_INDENT = " " * 16
UL_CLOSE_INDENT = " " * 12


def build_nav_html(current_file_name, is_root_file):
    current_family = FAMILY_MAP.get(current_file_name)
    lines = []
    for label, target, target_is_root in NAV_ITEMS:
        if target_is_root:
            href = target if is_root_file else "../" + target
        else:
            href = ("cwiczenia/" + target) if is_root_file else target
        current_attr = ' aria-current="page"' if label == current_family else ""
        lines.append(LI_INDENT + '<li><a href="' + href + '"' + current_attr + '>' + label + "</a></li>")
    return "\n".join(lines)


def process_file(path, is_root_file):
    text = path.read_text(encoding="utf-8")
    match = NAV_BLOCK_RE.search(text)
    if not match:
        print("POMINIĘTO (brak site-nav):", path.relative_to(ROOT))
        return False

    new_nav_items = build_nav_html(path.name, is_root_file)
    new_block = match.group(1) + "\n" + new_nav_items + "\n" + UL_CLOSE_INDENT + match.group(2)
    new_text = text[: match.start()] + new_block + text[match.end() :]

    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print("ZAKTUALIZOWANO:", path.relative_to(ROOT))
        return True
    print("bez zmian:", path.relative_to(ROOT))
    return False


def main():
    changed = 0
    for name in ("index.html", "o-projekcie.html"):
        if process_file(ROOT / name, is_root_file=True):
            changed += 1
    for path in sorted((ROOT / "cwiczenia").glob("*.html")):
        if process_file(path, is_root_file=False):
            changed += 1
    print("\nZmienionych plików:", changed)


if __name__ == "__main__":
    main()
