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
  dorycka, melodyczna).
- **Puzzle** - układanie fragmentów melodii we właściwej kolejności, ze
  słuchu albo czytając zapis nutowy.
- **Dyktanda** - dyktando wysokościowe (klucz, tonacja i pierwszy
  dźwięk są dane, uczeń uzupełnia wysokości kolejnych dźwięków - rytm
  jest wszędzie taki sam), docelowo też uzupełnianie całej melodii.
  Sprawdzenie koloruje własne dźwięki ucznia (zielony/czerwony) zamiast
  pokazywać poprawną odpowiedź - można poprawić i sprawdzić ponownie.

Puzzle i Dyktanda to dwie osobne, choć pokrewne rodziny ćwiczeń (osobne
pozycje w menu, osobne listy plików w `dyktanda/puzzle/` i
`dyktanda/wysokosciowe/`).

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
assets/js/                        logika ćwiczeń + core.js (audio, tempo)
assets/samples/, assets/vendor/   próbki dźwiękowe i biblioteka instrumentów
dyktanda/puzzle/                  manifest i pliki dyktand-puzzle
dyktanda/wysokosciowe/            osobny manifest i pliki dyktanda wysokościowego
```

Szczegółowy opis każdego pliku, sposób dodawania nowego dyktanda i
instrukcja wdrożenia: [opis.txt](opis.txt).

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
