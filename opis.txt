=== ksza.pl - dedykowana strona statyczna ===

Kompletna witryna zastępująca WordPressa: strona główna, "O projekcie"
i cztery ćwiczenia słuchowe (interwały, trójdźwięki, gamy, dyktanda).
Zero backendu, zero bazy danych, zero logowania - tylko pliki.

WAŻNE - KROK WYMAGANY PRZED URUCHOMIENIEM DŹWIĘKU:
Strona używa Tone.js z próbkami dźwiękowymi, których nie mogłem sam
pobrać (brak internetu w środowisku, w którym pisałem kod) - musisz
je wgrać przez FTP. Pełna instrukcja: assets/samples/PRZECZYTAJ.txt -
przeczytaj to PRZED wdrożeniem, inaczej ćwiczenia wczytają się
poprawnie, ale dźwięk nie zagra.


WDROŻENIE (jednorazowe)
1. Wgraj przez FTP CAŁĄ zawartość folderu ksza-site do katalogu
   głównego domeny (zwykle public_html/ albo www/).
2. To wszystko. Strona działa od razu - nie ma nic do instalowania
   ani konfigurowania.

Uwaga przy przejściu z WordPressa: zanim usuniesz WordPressa, upewnij
się, że nowe pliki nie kolidują ze starymi (np. stary index.php vs nowy
index.html). Najbezpieczniej: najpierw wgraj nową stronę do podkatalogu
testowego, sprawdź czy wszystko działa, a dopiero potem przenieś pliki
na docelowe miejsce.


STRUKTURA PLIKÓW
index.html                    - strona główna
o-projekcie.html               - opis projektu
cwiczenia/interwaly.html       - trener interwałów (ze słuchu)
cwiczenia/interwaly-zapis.html - trener interwałów (zapis nutowy, Verovio)
cwiczenia/interwaly-buduj.html - trener interwałów (budowanie zapisu, Verovio)
cwiczenia/trojdzwieki.html     - trener trójdźwięków (ze słuchu)
cwiczenia/trojdzwieki-zapis.html - trener trójdźwięków (zapis nutowy, Verovio)
cwiczenia/trojdzwieki-buduj.html - trener trójdźwięków (budowanie zapisu, Verovio)
cwiczenia/gamy.html            - trener odmian gam
cwiczenia/dyktanda.html        - dyktanda-puzzle
assets/css/site.css            - style witryny (nagłówek, karty, stopka)
assets/css/widgets.css         - style widżetów ćwiczeń
assets/js/core.js              - rdzeń audio (Tone.js), tempo, nawigacja mobilna
assets/js/interwaly.js         - logika interwałów (ze słuchu)
assets/js/interwaly-zapis.js   - logika interwałów (zapis nutowy)
assets/js/interwaly-buduj.js   - logika interwałów (budowanie zapisu)
assets/js/trojdzwieki.js       - logika trójdźwięków (ze słuchu)
assets/js/trojdzwieki-zapis.js - logika trójdźwięków (zapis nutowy)
assets/js/trojdzwieki-buduj.js - logika trójdźwięków (budowanie zapisu)
assets/js/gamy.js              - logika gam
assets/js/dyktanda.js          - logika dyktand (parser MusicXML, pauza)
assets/vendor/Tonejs-Instruments.js  - DO WGRANIA - patrz PRZECZYTAJ.txt
assets/samples/                      - DO WGRANIA - próbki, patrz PRZECZYTAJ.txt
dyktanda/dyktanda.json         - LISTA dyktand (manifest - patrz niżej)
dyktanda/*.xml                 - pliki MusicXML dyktand (wgrywasz przez FTP)

Strony "zapis nutowy" korzystają z biblioteki Verovio (rysowanie nut w
przeglądarce), wczytywanej bezpośrednio z oficjalnego CDN verovio.org -
nic tu nie trzeba wgrywać przez FTP, wystarczy działające połączenie
internetowe u odwiedzającego.


DODAWANIE NOWEGO DYKTANDA (przez FTP)
1. Wyeksportuj dyktando z programu nutowego (MuseScore itd.) jako
   NIESKOMPRESOWANY MusicXML (.xml / .musicxml). Skompresowany .mxl
   nie zadziała.
2. Wgraj plik przez FTP do folderu dyktanda/, np. dyktanda/dyktando-01.xml
3. Otwórz dyktanda/dyktanda.json i dopisz wpis do listy:

   [
     { "title": "Dyktando 1 - gama C-dur", "file": "dyktando-01.xml" },
     { "title": "Dyktando 2 - tercje",     "file": "dyktando-02.xml" }
   ]

   WAŻNE - format JSON jest wrażliwy na szczegóły:
   - cudzysłowy proste ("), nie drukarskie („")
   - przecinek MIĘDZY wpisami, ale NIE po ostatnim
   - nazwa pliku dokładnie taka jak na serwerze (wielkość liter ma znaczenie)
4. Odśwież stronę Dyktanda - nowa pozycja pojawi się na liście.

Jeśli lista nie działa po edycji, najczęstszy powód to literówka w
JSON. Możesz sprawdzić poprawność pliku na https://jsonlint.com


TEMPO ODTWARZANIA
Każde ćwiczenie ma suwak tempa (50%-150%). Ustawienie jest zapamiętywane
w przeglądarce ucznia (localStorage) i obowiązuje na wszystkich stronach
- nie trzeba go ustawiać osobno dla każdego ćwiczenia. To jedyna rzecz
na stronie, która "pamięta" cokolwiek między wizytami; reszta jest
bezstanowa.


KOLEJNE ĆWICZENIA W PRZYSZŁOŚCI
1. Skopiuj jedną ze stron w cwiczenia/ jako szablon.
2. Napisz logikę w nowym pliku assets/js/<nazwa>.js - wspólny rdzeń
   audio (KszaAudio) i tempo (KszaTempo) są gotowe do użycia.
3. Dodaj link do nowej strony w menu KAŻDEJ strony (menu jest
   powtórzone w każdym pliku HTML - cena prostoty strony statycznej).


CO ZOSTAŁO ŚWIADOMIE POMINIĘTE
- Panel administracyjny - dyktanda dodaje się przez FTP.
- Statystyki/konta uczniów - wymagałyby backendu.
