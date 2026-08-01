# ksza.pl

Statyczna strona z ćwiczeniami do nauki kształcenia słuchu - bez
logowania, bez bazy danych, bez backendu. Działa od razu w
przeglądarce, na komputerze, tablecie i telefonie.

Pełny opis projektu jest na stronie ["O projekcie"](o-projekcie.html).
Instrukcja wdrożenia i utrzymania jest w [opis.txt](opis.txt).

## Ćwiczenia

- **Interwały** - ze słuchu, zapis nutowy i budowanie zapisu.
- **Trójdźwięki** - durowy, molowy, zmniejszony, zwiększony; ze słuchu,
  zapis nutowy i budowanie zapisu; postać zasadnicza i przewroty.
- **Gamy** - durowa i cztery odmiany molowej, plus osobne ćwiczenie na
  stopnie gamy (I-VIII).
- **Puzzle** - układanie fragmentów melodii we właściwej kolejności, ze
  słuchu albo z zapisu nutowego.
- **Dyktanda** - dyktando wysokościowe: klucz, tonacja i pierwszy
  dźwięk są dane, reszta wysokości do uzupełnienia ze słuchu.
- **Rytm** - to samo co Puzzle, ale odwrotnie: wysokość dźwięku jest
  stała (zawsze ksylofon), liczy się tylko rytm.

Puzzle, Dyktanda i Rytm mają osobne listy plików i można każdy utwór
przypisać do jednej lub dwóch klas (np. `I/4`, `IV/6`) - selektor
"Klasa" wtedy filtruje listę; utwory bez klasy są widoczne zawsze.

## Stos technologiczny

- Czysty HTML/CSS/JS, bez frameworka i bez kroku budowania.
- [Tone.js](https://tonejs.github.io/) + próbki
  [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
  do dźwięku.
- [Verovio](https://www.verovio.org/) (z jsDelivr, wersja przypięta,
  czcionka Leland) do rysowania zapisu nutowego.

## Struktura

```
index.html, o-projekcie.html   strony ogólne
cwiczenia/*.html               po jednej stronie na wariant ćwiczenia
assets/css/                    style
assets/js/core.js              audio, tempo, menu mobilne
assets/js/*.js                 logika ćwiczeń + kilka wspólnych modułów
dyktanda/puzzle/                manifest i pliki dyktand-puzzle
dyktanda/wysokosciowe/          manifest i pliki dyktanda wysokościowego
dyktanda/rytm/                  manifest i pliki rytmów-puzzle
update-nav.py                  generuje menu we wszystkich stronach naraz
```

Szczegóły (każdy plik, dodawanie nowego dyktanda, wdrożenie) są w
[opis.txt](opis.txt).

## Podgląd lokalny

```
python3 -m http.server
```

i wejść na `localhost:8000`.

## Licencja

Próbki instrumentów: VSCO2 (CC-BY 3.0) via tonejs-instruments. Verovio:
LGPL (RISM Digital Center). Kod własny bez osobnej licencji.

&copy; ksza.pl (aK)
