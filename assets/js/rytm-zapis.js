/* ksza.pl - rytmy (puzzle), zapis nutowy. Ta sama lista i pliki co wersja
   "ze słuchu", dodatkowo każdy takt jest rysowany (bez klucza/tonacji, patrz
   rhythmStaff w puzzle-engine.js). Zawsze ksylofon, bez wyboru instrumentu. */
(() => {
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
