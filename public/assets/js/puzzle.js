(() => {
    KszaPuzzleEngine.init({
        notation: false,
        manifestUrl: '/dyktanda/puzzle/puzzle.json',
        fileBaseUrl: '/dyktanda/puzzle/',
        labels: {
            minFragments: 'Dyktando musi mieć co najmniej 2 takty z nutami, żeby dało się ułożyć puzzle.',
            manifestWarn: 'Nie udało się wczytać listy dyktand (puzzle.json):',
            emptyOption: 'Brak dostępnych dyktand',
            emptyHint: 'Nie dodano jeszcze żadnego dyktanda - patrz dyktanda/puzzle/puzzle.json.',
            loading: 'Wczytywanie dyktanda...',
            loadErrorConsole: 'Błąd wczytywania dyktanda:',
            loadErrorPrefix: 'Błąd wczytywania dyktanda: '
        }
    });
})();
