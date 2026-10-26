window.KszaIntervalFilter = (() => {
    const STORAGE_KEY = 'ksza_interval_filter_v1';

    const ALL_SYMBOLS = ['1', '2>', '2', '3>', '3', '4', '4<', '5', '6>', '6', '7', '7<', '8'];

    const PRESETS = {
        'all': {
            label: 'Wszystkie',
            symbols: ['1', '2>', '2', '3>', '3', '4', '4<', '5', '6>', '6', '7', '7<', '8']
        },
        'perfect': {
            label: 'Czyste',
            symbols: ['1', '4', '5', '8']
        },
        'perfect-2-3': {
            label: '+ Sekundy i tercje',
            symbols: ['1', '2>', '2', '3>', '3', '4', '5', '8']
        },
        'without-sevenths': {
            label: 'Bez septymy',
            symbols: ['1', '2>', '2', '3>', '3', '4', '4<', '5', '6>', '6', '8']
        }
    };

    let activeSymbols = [...ALL_SYMBOLS];
    let changeCallbacks = [];
    let rootEl = null;
    let hintTimeout = null;

    function areSetsEqual(a, b) {
        if (a.length !== b.length) return false;
        const setB = new Set(b);
        return a.every((x) => setB.has(x));
    }

    function detectPreset(symbols) {
        for (const [key, preset] of Object.entries(PRESETS)) {
            if (areSetsEqual(symbols, preset.symbols)) {
                return key;
            }
        }
        return 'custom';
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSymbols));
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length >= 2) {
                const valid = parsed.filter((s) => ALL_SYMBOLS.includes(s));
                if (valid.length >= 2) return valid;
            }
        } catch (e) {}
        return null;
    }

    function updateUI() {
        if (!rootEl) return;

        const presetKey = detectPreset(activeSymbols);
        const count = activeSymbols.length;

        // Aktualizacja przycisków presetów
        rootEl.querySelectorAll('.preset-btn').forEach((btn) => {
            const isActive = btn.dataset.preset === presetKey;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        // Aktualizacja chipów przełączników
        rootEl.querySelectorAll('.interval-toggle-chip').forEach((chip) => {
            const isActive = activeSymbols.includes(chip.dataset.symbol);
            chip.classList.toggle('is-active', isActive);
            chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        // Aktualizacja etykiety w nagłówku
        const badge = rootEl.querySelector('.interval-filter-badge');
        if (badge) {
            if (presetKey === 'all') {
                badge.textContent = `Wszystkie (${count})`;
            } else if (PRESETS[presetKey]) {
                badge.textContent = `${PRESETS[presetKey].label} (${count})`;
            } else {
                badge.textContent = `Własny (${count}/${ALL_SYMBOLS.length})`;
            }
        }
    }

    function showHint(msg) {
        if (!rootEl) return;
        const hintEl = rootEl.querySelector('.interval-filter-hint');
        if (!hintEl) return;
        hintEl.textContent = msg;
        hintEl.style.display = 'block';
        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(() => {
            hintEl.style.display = 'none';
        }, 2600);
    }

    function setSymbols(symbols, notify = true) {
        if (!symbols || symbols.length < 2) return;
        activeSymbols = symbols.filter((s) => ALL_SYMBOLS.includes(s));
        saveToStorage();
        updateUI();
        if (notify) {
            changeCallbacks.forEach((cb) => {
                try { cb([...activeSymbols]); } catch (e) {}
            });
        }
    }

    function applyPreset(presetId) {
        const preset = PRESETS[presetId];
        if (!preset) return;
        setSymbols([...preset.symbols]);
    }

    function toggleSymbol(symbol) {
        if (!ALL_SYMBOLS.includes(symbol)) return;

        const isCurrentlyActive = activeSymbols.includes(symbol);
        if (isCurrentlyActive) {
            if (activeSymbols.length <= 2) {
                showHint('Wybierz co najmniej 2 interwały do ćwiczenia.');
                return;
            }
            const next = activeSymbols.filter((s) => s !== symbol);
            setSymbols(next);
        } else {
            const next = ALL_SYMBOLS.filter((s) => activeSymbols.includes(s) || s === symbol);
            setSymbols(next);
        }
    }

    function init(options = {}) {
        const elementId = options.filterId || 'interval-filter';
        rootEl = document.getElementById(elementId);
        if (!rootEl) return;

        if (typeof options.onChange === 'function') {
            changeCallbacks.push(options.onChange);
        }

        // Odczyt z pamięci podręcznej
        const saved = loadFromStorage();
        if (saved) {
            activeSymbols = saved;
        } else {
            activeSymbols = [...ALL_SYMBOLS];
        }

        // Obsługa kliknięć w presety
        rootEl.querySelectorAll('.preset-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                applyPreset(btn.dataset.preset);
            });
        });

        // Obsługa kliknięć w poszczególne chipy
        rootEl.querySelectorAll('.interval-toggle-chip').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                toggleSymbol(chip.dataset.symbol);
            });
        });

        updateUI();

        // Powiadomienie na start
        changeCallbacks.forEach((cb) => {
            try { cb([...activeSymbols]); } catch (e) {}
        });
    }

    return {
        init,
        getActiveSymbols: () => [...activeSymbols],
        isIntervalActive: (symbol) => activeSymbols.includes(symbol),
        PRESETS
    };
})();

