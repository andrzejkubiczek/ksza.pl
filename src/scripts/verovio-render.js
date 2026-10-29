export const KszaVerovio = (() => {
    let toolkit = null;
    let readyPromise = null;

    function ensureReady() {
        if (readyPromise) return readyPromise;
        readyPromise = new Promise((resolve, reject) => {
            if (typeof verovio === 'undefined') {
                reject(new Error('Biblioteka Verovio nie została wczytana (sprawdź połączenie).'));
                return;
            }

            let settled = false;
            let pollId;
            let timeoutId;
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

            if (verovio.module) {
                verovio.module.onRuntimeInitialized = tryInit;
            }
            pollId = setInterval(tryInit, 50);
            timeoutId = setTimeout(() => {
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
