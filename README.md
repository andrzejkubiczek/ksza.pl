# ksza.pl

Interaktywna, bezpłatna platforma internetowa do nauki **kształcenia słuchu** i czytania nut. Aplikacja działa w 100% po stronie klienta (statyczny frontend bez backendu, bazy danych i konieczności logowania) na komputerach, tabletach oraz smartfonach.

Opis idei projektu znajduje się na podstronie [O projekcie](o-projekcie.html). Szczegółowa dokumentacja techniczna i instrukcja utrzymania dostępna jest w pliku [opis.txt](opis.txt).

---

## Moduły i ćwiczenia

* **Interwały** – rozpoznawanie ze słuchu (tryb melodyczny w górę/dół, harmoniczny oraz mieszany), czytanie zapisu nutowego (klucz wiolinowy i basowy) oraz interaktywne budowanie interwałów.
* **Trójdźwięki** – durowy, molowy, zmniejszony i zwiększony w postaci zasadniczej oraz z przewrotami (sekstowy, kwartsekstowy); warianty: ze słuchu, zapis nutowy, budowanie na pięciolinii.
* **Gamy i stopnie** – rozpoznawanie gamy durowej oraz 4 odmian molowej (eolska, harmoniczna, dorycka, melodyczna) granych w obu kierunkach; osobny trening rozpoznawania stopni gamy (solmizacja I–VIII) w kontekście tonalnym.
* **Puzzle melodyczne** – układanie potasowanych fragmentów melodii we właściwej kolejności (ze słuchu lub z zapisu nutowego); pełny odsłuch poprzedzony jest odliczeniem jednego taktu metronomem w zadanym tempie.
* **Dyktanda** – dyktando wysokościowe (podany klucz, tonacja i pierwszy dźwięk, reszta wysokości do uzupełnienia ze słuchu i sprawdzenia z natychmiastowym kolorowaniem nut) oraz pamięć melodyczna (powtarzanie usłyszanej frazy na klawiaturze po dźwięku odniesienia $a^1 = 440\text{ Hz}$).
* **Rytm** – puzzle rytmiczne oparte na ksylofonie i pojedynczej linii z kluczem perkusyjnym.

---

## Stos technologiczny

* **Frontend:** Czysty, semantyczny HTML5, nowoczesny CSS3 (CSS Custom Properties, Grid, Flexbox, stylistyka *Kontrastowe karty*, RWD, a11y) oraz nowoczesny JavaScript (ES6+).
* **Silnik audio:** [smplr](https://github.com/danigb/smplr) (Splendid Grand Piano &middot; Versilian Studios VCSL &amp; VSCO2) + natywny Web Audio API.
* **Renderowanie nut:** [Verovio](https://www.verovio.org/) (WebAssembly/JS) generujące wektory SVG w czcionce Leland.
* **Interakcje Drag & Drop:** [SortableJS](https://sortablejs.github.io/Sortable/).

---

## Struktura projektu

```text
index.html, o-projekcie.html   Strony ogólne i informacyjne
cwiczenia/*.html               Strony poszczególnych wariantów ćwiczeń
assets/css/site.css            Główny arkusz stylów, layout, motyw, RWD
assets/css/widgets.css         Style widżetów ćwiczeń, notacji Verovio, klawiatur
assets/audio/                  Lokalne próbki akustyczne orkiestry Versilian VSCO2
assets/vendor/smplr.js         Lekki silnik samplera Web Audio API
assets/js/core.js              Moduł audio (KszaAudio), tempo, zakresy instrumentów
assets/js/music-theory.js      Matematyczny model teorii muzyki, enharmonia, MusicXML
assets/js/verovio-render.js    Wrapper silnika renderującego Verovio SVG
assets/js/gesture-layer.js     Obsługa gestów wskaźnikowych i dotykowych nad notacją
assets/js/puzzle-engine.js     Uniwersalny silnik układanek taktowych (audio timeline)
assets/js/scale-tonics.js      Baza tonik gam i algorytmy doboru oktaw
assets/js/klasa-filter.js      Obsługa filtrowania utworów według klas
assets/js/piano-keyboard.js    Generator pomocniczej klawiatury fortepianu
assets/js/*.js                 Kontrolery logiki poszczególnych ćwiczeń
dyktanda/puzzle/               Manifest (puzzle.json) i pliki MusicXML dyktand-puzzle
dyktanda/wysokosciowe/         Manifest (dyktanda.json) i pliki dyktand wysokościowych
dyktanda/rytm/                 Manifest (rytm.json) i pliki rytmów-puzzle
update-nav.py                  Skrypt automatycznie synchronizujący menu we wszystkich stronach
```

---

## Uruchomienie lokalne

Do uruchomienia wystarczy dowolny lokalny serwer HTTP:

```bash
python3 -m http.server 8000
```

Następnie otwórz w przeglądarce adres: [http://localhost:8000](http://localhost:8000).

---

## Licencja

* Próbki instrumentów: Splendid Grand Piano / Versilian Studios VCSL & VSCO2 (CC-BY / CC0 / Public Domain via smplr).
* Silnik nutowy: Verovio (LGPL, RISM Digital Center).
* Kod źródłowy: ksza.pl (&copy; aK).
