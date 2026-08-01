/* ksza.pl - rytmy (puzzle), zapis nutowy.
   Ta sama lista i pliki co wersja "ze słuchu" - dodatkowo każdy takt jest
   rysowany przez Verovio (patrz assets/js/verovio-render.js), jako
   standardowy zapis rytmiczny: bez klucza wysokościowego i tonacji, samo
   metrum, pięciolinia jednolinijkowa z kluczem perkusyjnym.
   Zawsze ksylofon - najlepiej oddaje rytm, bez wyboru instrumentu.
   Silnik: assets/js/puzzle-engine.js. */
(function () {
    KszaPuzzleEngine.init({
        notation: true,
        partNameLabel: 'Rytm',
        manifestUrl: '../dyktanda/rytm/rytm.json',
        fileBaseUrl: '../dyktanda/rytm/',
        fixedInstrument: 'xylophone',
        rhythmStaff: true,
        labels: {
            minFragments: 'Rytm musi mieć co najmniej 2 takty, żeby dało się ułożyć puzzle.',
            manifestWarn: 'Nie udało się wczytać listy rytmów (rytm.json):',
            emptyOption: 'Brak dostępnych rytmów',
            emptyHint: 'Nie dodano jeszcze żadnego rytmu - patrz dyktanda/rytm/rytm.json.',
            loading: 'Wczytywanie rytmu...',
            loadErrorConsole: 'Błąd wczytywania rytmu:',
            loadErrorPrefix: 'Błąd wczytywania rytmu: '
        }
    });
})();
