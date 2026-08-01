/* ksza.pl - wspólny filtr "Klasa" dla list dyktand/rytmów (puzzle, wysokościowe,
   rytmiczne). Kolejność ODZWIERCIEDLA POSTĘP TRUDNOŚCI, nie numerację klas:
   końcówka cyklu 6-letniego (IV/6-VI/6) odpowiada mniej więcej początkowi
   cyklu 4-letniego (I/4), więc te dwie ścieżki nauki stykają się właśnie tu. */
window.KszaKlasaFilter = (function () {
    const ORDER = ['IV/6', 'V/6', 'VI/6', 'I/4', 'II/4', 'III/4', 'IV/4'];
    const ALL_VALUE = '';

    function populateSelect(selectEl) {
        if (!selectEl) return;
        selectEl.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = ALL_VALUE;
        allOpt.textContent = 'Wszystkie klasy';
        selectEl.appendChild(allOpt);

        ORDER.forEach((klasa) => {
            const opt = document.createElement('option');
            opt.value = klasa;
            opt.textContent = klasa;
            selectEl.appendChild(opt);
        });
    }

    // klasy: tablica z manifestu (brak / pusta = ćwiczenie "ogólne" - zawsze widoczne).
    function matches(klasy, selected) {
        if (!selected) return true; // "Wszystkie klasy"
        if (!klasy || klasy.length === 0) return true; // ogólne
        return klasy.indexOf(selected) !== -1;
    }

    return { ORDER: ORDER, populateSelect: populateSelect, matches: matches };
})();
