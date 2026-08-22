window.KszaVerovio = (() => {
    let toolkit = null;
    let readyPromise = null;

    // Potrójne zabezpieczenie inicjalizacji: sprawdzenie natychmiastowe, callback onRuntimeInitialized, polling co 50ms
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
                    toolkit.setOptions({ font: 'Leland' });
                    settled = true;
                    clearInterval(pollId);
                    clearTimeout(timeoutId);
                    resolve();
                } catch (e) {}
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
