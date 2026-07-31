# ksza.pl

Statyczna strona z ćwiczeniami wspierającymi naukę kształcenia słuchu -
bez logowania, bez bazy danych, bez backendu. Wszystko działa od razu w
przeglądarce, na komputerze, tablecie i telefonie.

Pełny opis projektu (dla ucznia/nauczyciela) jest na stronie ["O
projekcie"](o-projekcie.html). Instrukcja wdrożenia i utrzymania
(dodawanie dyktand, wgrywanie próbek dźwiękowych, struktura plików)
jest w [opis.txt](opis.txt).

## Ćwiczenia

- **Interwały** - ze słuchu, zapis nutowy (odczytywanie) i budowanie
  zapisu (ustawianie drugiego dźwięku strzałkami/przeciąganiem i
  znakiem chromatycznym).
- **Trójdźwięki** - durowy, molowy, zmniejszony, zwiększony; ze słuchu,
  zapis nutowy i budowanie zapisu; postać zasadnicza oraz przewroty.
- **Gamy** - durowa i cztery odmiany molowej (eolska, harmoniczna,
  dorycka, melodyczna), a także osobna zakładka "Stopnie gamy"
  (rozpoznawanie stopnia 1-8 w gamie durowej/harmonicznej).
- **Puzzle** - układanie fragmentów melodii we właściwej kolejności, ze
  słuchu albo czytając zapis nutowy.
- **Dyktanda** - dyktando wysokościowe (klucz, tonacja i pierwszy
  dźwięk są dane, uczeń uzupełnia wysokości kolejnych dźwięków - rytm
  jest wszędzie taki sam), docelowo też uzupełnianie całej melodii.
  Sprawdzenie koloruje własne dźwięki ucznia (zielony/czerwony) zamiast
  pokazywać poprawną odpowiedź - można poprawić i sprawdzić ponownie.
- **Rytm** - odwrotność dyktanda wysokościowego: wysokość dźwięku jest
  wszędzie taka sama (zawsze ksylofon - bez wyboru instrumentu), a
  uczeń układa fragmenty rytmiczne we właściwej kolejności, ze słuchu
  albo czytając zapis nutowy.

Puzzle, Dyktanda i Rytm to trzy osobne, choć pokrewne rodziny ćwiczeń
(osobne pozycje w menu, osobne listy plików w `dyktanda/puzzle/`,
`dyktanda/wysokosciowe/` i `dyktanda/rytm/`).

Ćwiczenia "zbuduj" (interwały/trójdźwięki) obsługuje się zarówno
przyciskami, jak i dotykiem/myszką: przeciągnięcie nuty zmienia jej
wysokość, stuknięcie zmienia znak chromatyczny.

## Stos technologiczny

- Czysty HTML/CSS/JS, bez frameworka i bez kroku budowania.
- [Tone.js](https://tonejs.github.io/) + próbki
  [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
  do odtwarzania dźwięku.
- [Verovio](https://www.verovio.org/) (z CDN) do rysowania zapisu
  nutowego z MusicXML.

## Struktura

```
index.html, o-projekcie.html      strony ogólne
cwiczenia/*.html                  po jednej stronie na wariant ćwiczenia
assets/css/                       style (site.css, widgets.css)
assets/js/core.js                 audio (Tone.js), tempo, nawigacja mobilna
assets/js/music-theory.js         wspólna pisownia enharmoniczna + MusicXML <pitch>/<accidental>
assets/js/verovio-render.js       wspólna inicjalizacja/render Verovio
assets/js/gesture-layer.js        wspólna obsługa przeciągnięcia/stuknięcia
assets/js/scale-tonics.js         wspólne toniki gam + budowanie nut od toniki
assets/js/puzzle-engine.js        wspólny silnik puzzli z taktami (dyktanda/rytm)
assets/js/<nazwa>.js              logika pojedynczego ćwiczenia (korzysta z modułów wyżej)
assets/samples/, assets/vendor/   próbki dźwiękowe i biblioteka instrumentów
dyktanda/puzzle/                  manifest i pliki dyktand-puzzle
dyktanda/wysokosciowe/            osobny manifest i pliki dyktanda wysokościowego
dyktanda/rytm/                     osobny manifest i pliki rytmów-puzzle
update-nav.py                     generuje menu główne we wszystkich HTML z jednej listy
```

Menu główne (`<nav class="site-nav">`) nie jest kopiowane ręcznie do
każdego pliku - jedno źródło prawdy to `update-nav.py`. Po zmianie menu
uruchom `python3 update-nav.py`, żeby rozesłać ją do wszystkich stron.

Szczegółowy opis każdego pliku, architektura wspólnych modułów, sposób
dodawania nowego dyktanda i instrukcja wdrożenia: [opis.txt](opis.txt).

## Podgląd lokalny

Dowolny prosty serwer statyczny, np.:

```
python3 -m http.server
```

i wejść na `localhost:8000`.

## Licencja

Próbki instrumentów: VSCO2 (CC-BY 3.0) via tonejs-instruments. Verovio:
LGPL (RISM Digital Center). Kod własny bez osobnej licencji.

&copy; ksza.pl (aK)
