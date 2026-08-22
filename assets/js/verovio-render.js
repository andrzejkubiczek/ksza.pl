/* ksza.pl - wspólna inicjalizacja i renderowanie Verovio.
   Używane przez każde ćwiczenie z zapisem nutowym. */
window.KszaVerovio = (() => {
    let toolkit = null;
    let readyPromise = null;

    // onRuntimeInitialized czasem nie odpala się w porę - zabezpieczenie
    // potrójne: próba od razu, oficjalny callback, odpytywanie co 50ms.
    function ensureReady() {
        if (readyPromise) return readyPromise;
        readyPromise = new Promise((resolve, reject) => {
            if (typeof verovio === 'undefined') {
                reject(new Error('Biblioteka Verovio nie została wczytana (sprawdź połączenie).'));
                return;
            }

            let settled = false;
            const tryInit = () => {
                if (settled) return;
                try {
                    toolkit = new verovio.toolkit();
                    toolkit.setOptions({ font: 'Leland' }); // domyślna czcionka Verovio to Leipzig
                    settled = true;
                    clearInterval(pollId);
                    clearTimeout(timeoutId);
                    resolve();
                } catch (e) {
                    /* Moduł jeszcze nie gotowy - kolejna próba nastąpi wkrótce */
                }
            };

            verovio.module.onRuntimeInitialized = tryInit;
            const pollId = setInterval(tryInit, 50);
            const timeoutId = setTimeout(() => {
                settled = true;
                clearInterval(pollId);
                reject(new Error('Przekroczono limit czasu ładowania Verovio.'));
            }, 20000);

            tryInit();
        });
        return readyPromise;
    }

    const render = (musicXml, options) => toolkit.renderData(musicXml, options);

    return { ensureReady, render };
})();
