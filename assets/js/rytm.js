/* ksza.pl - rytmy (puzzle), ze słuchu.
   Odwrotność dyktanda: stała wysokość dźwięku, zmienny rytm.
   Lista rytmów: ../dyktanda/rytm/rytm.json (manifest - patrz opis.txt).
   Zawsze ksylofon - najlepiej oddaje rytm, bez wyboru instrumentu.
   Silnik: assets/js/puzzle-engine.js. */
(() => {
    KszaPuzzleEngine.init({
        notation: false,
        manifestUrl: '../dyktanda/rytm/rytm.json',
        fileBaseUrl: '../dyktanda/rytm/',
        fixedInstrument: 'xylophone',
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
