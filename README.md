# ksza.pl

Interaktywna, bezpłatna platforma internetowa do nauki **kształcenia słuchu** i czytania nut. Aplikacja działa w 100% po stronie klienta (statyczny frontend bez backendu, bazy danych i konieczności logowania) na komputerach, tabletach oraz smartfonach.

Opis idei projektu znajduje się na podstronie [O projekcie](o-projekcie.html). Szczegółowa dokumentacja techniczna i instrukcja utrzymania dostępna jest w pliku [opis.txt](opis.txt).

---

## Moduły i ćwiczenia

* **Interwały** – rozpoznawanie ze słuchu (tryb melodyczny w górę/dół, harmoniczny oraz mieszany), czytanie zapisu nutowego (klucz wiolinowy i basowy), interaktywne budowanie interwałów na pięciolinii oraz śpiewanie interwałów do mikrofonu z natychmiastową oceną intonacji głosu.
* **Trójdźwięki** – durowy, molowy, zmniejszony i zwiększony w postaci zasadniczej oraz z przewrotami (sekstowy, kwartsekstowy); warianty: ze słuchu, zapis nutowy, budowanie na pięciolinii oraz śpiewanie składników akordu do mikrofonu.
* **Puzzle melodyczne** – układanie potasowanych fragmentów melodii we właściwej kolejności (ze słuchu lub z zapisu nutowego); pełny odsłuch poprzedzony jest odliczeniem jednego taktu metronomem w zadanym tempie.
* **Dyktanda** – dyktando wysokościowe (podany klucz, tonacja i pierwszy dźwięk, reszta wysokości do uzupełnienia ze słuchu i sprawdzenia z natychmiastowym kolorowaniem nut) oraz pamięć melodyczna (powtarzanie usłyszanej frazy na klawiaturze po dźwięku odniesienia $a^1 = 440\text{ Hz}$).
* **Rytm** – puzzle rytmiczne oparte na ksylofonie i pojedynczej linii z kluczem perkusyjnym.

---

## Stos technologiczny

* **Generator i architektura:** [Astro](https://astro.build/) (Static Site Generation, modułowe komponenty, zerowy narzut w runtime).
* **Frontend:** Semantyczny HTML5, nowoczesny CSS3 (CSS Custom Properties, Grid, Flexbox, stylistyka *Kontrastowe karty*, RWD, a11y) oraz nowoczesny JavaScript (ES6+).
* **Silnik audio:** [smplr](https://github.com/danigb/smplr) (Splendid Grand Piano &middot; Versilian Studios VCSL &amp; VSCO2) + natywny Web Audio API.
* **Renderowanie nut:** [Verovio](https://www.verovio.org/) (WebAssembly/JS) generujące wektory SVG w czcionce Leland.
* **Interakcje Drag & Drop:** [SortableJS](https://sortablejs.github.io/Sortable/).

---

## Struktura projektu

```text
src/layouts/Layout.astro       Główny szablon layoutu (head, fonts, nawigacja, stopka)
src/components/*.astro         Reużywalne komponenty (NavMenu, SubNav, Footer)
src/pages/index.astro          Strona główna (Start)
src/pages/o-projekcie.astro    Strona informacyjna o projekcie
src/pages/cwiczenia/*.astro    Podstrony poszczególnych ćwiczeń
public/assets/css/             Arkusze stylów (site.css, widgets.css)
public/assets/audio/           Lokalne próbki akustyczne orkiestry Versilian VSCO2
public/assets/vendor/          Lekki silnik samplera Web Audio API (smplr.js)
public/assets/js/              Moduły logiki, teorii muzyki, Verovio i kontrolery ćwiczeń
public/dyktanda/               Manifesty JSON i pliki MusicXML dyktand
dist/                          Wygenerowane statyczne pliki produkcyjne (po npm run build)
```

---

## Uruchomienie i rozwój lokalny

Wymagane środowisko: [Node.js](https://nodejs.org/) (np. wersja LTS).

1. Zainstaluj zależności:
```bash
npm install
```

2. Uruchom serwer deweloperski (z automatycznym odświeżaniem HMR):
```bash
npm run dev
```
Otwórz w przeglądarce adres: [http://localhost:4321](http://localhost:4321).

3. Zbuduj zoptymalizowaną wersję produkcyjną (do folderu `dist/`):
```bash
npm run build
```

4. Podgląd wygenerowanej wersji produkcyjnej:
```bash
npm run preview
```

---

## Licencja

* Próbki instrumentów: Splendid Grand Piano / Versilian Studios VCSL & VSCO2 (CC-BY / CC0 / Public Domain via smplr).
* Silnik nutowy: Verovio (LGPL, RISM Digital Center).
* Kod źródłowy: ksza.pl (&copy; aK).
