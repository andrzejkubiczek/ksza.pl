window.KszaKlasaFilter = (() => {
    // Kolejność odzwierciedla postęp trudności dydaktycznej (IV/6 odpowiada początkowi cyklu 4-letniego I/4)
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

    function matches(klasy, selected) {
        if (!selected) return true;
        if (!klasy || klasy.length === 0) return true;
        return klasy.includes(selected);
    }

    return { ORDER, populateSelect, matches };
})();
