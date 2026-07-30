/* ksza.pl - wspólny rdzeń audio (Tone.js)
   Wymaga w kolejności PRZED tym plikiem: Tone.js (CDN),
   assets/vendor/Tonejs-Instruments.js, oraz window.KSZA_SAMPLES_BASE
   ustawione w danej stronie (ścieżka do assets/samples/).
   Nazwy instrumentów muszą odpowiadać kluczom tonejs-instruments.
   API zgodne ze starą wersją (soundfont-player), żeby pliki ćwiczeń
   nie musiały się przepisywać: player.play(nuta, czas, {duration}). */
window.KszaAudio = (function () {
    const samplerCache = {};
    let currentSampler = null;
    let loadedName = '';
    let loadGeneration = 0;
    let audioStarted = false;
    let effectsChainPromise = null;

    function makePlayerWrapper(sampler) {
        return {
            play: function (note, time, opts) {
                const duration = (opts && opts.duration) || 0.5;
                const when = typeof time === 'number' ? time : Tone.now();
                sampler.triggerAttackRelease(note, duration, when);
            },
            stop: function () {
                sampler.releaseAll(Tone.now());
            },
            raw: sampler
        };
    }

    async function ensureAudioStarted() {
        if (!audioStarted) {
            try { await Tone.start(); } catch (e) { /* wymaga gestu użytkownika */ }
            audioStarted = true;
        }
    }

    /* Wspólny łańcuch efektów dla wszystkich instrumentów: filtr górnoprzepustowy
       (tnie dudnienie) -> pogłos (mniej "sucho") -> limiter (bezpiecznik głośności),
       plus obniżona głośność bazowa - margines bezpieczeństwa dla słuchawek. */
    async function getEffectsChain() {
        if (!effectsChainPromise) {
            effectsChainPromise = (async () => {
                Tone.Destination.volume.value = -8;

                const limiter = new Tone.Limiter(-6).toDestination();
                const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.16, preDelay: 0.01 }).connect(limiter);
                await reverb.ready; // Tone.Reverb jest asynchroniczny
                const highpass = new Tone.Filter({ frequency: 100, type: 'highpass', rolloff: -24 }).connect(reverb);

                return highpass;
            })();
        }
        return effectsChainPromise;
    }

    function withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Przekroczono limit czasu ładowania (' + label + ')')), ms)
            )
        ]);
    }

    /** Ładuje instrument (z cache jeśli już pobrany). onStateChange(state, message). */
    async function loadInstrument(name, onStateChange) {
        const notify = onStateChange || function () {};

        if (samplerCache[name]) {
            currentSampler = samplerCache[name];
            loadedName = name;
            notify('ready', '');
            return true;
        }

        await ensureAudioStarted();

        const myGeneration = ++loadGeneration;
        notify('loading', 'Ładowanie instrumentu: ' + name + '...');

        try {
            const baseUrl = window.KSZA_SAMPLES_BASE || 'assets/samples/';
            const sampler = await withTimeout(
                new Promise((resolve, reject) => {
                    let settled = false;
                    const instrument = SampleLibrary.load({
                        instruments: name,
                        baseUrl: baseUrl,
                        onload: function () {
                            if (settled) return;
                            settled = true;
                            resolve(instrument);
                        }
                    });
                    // Nie wszystkie wersje SampleLibrary wspierają onload - fallback na Tone.loaded().
                    Tone.loaded().then(function () {
                        if (settled) return;
                        settled = true;
                        resolve(instrument);
                    }).catch(reject);
                }),
                20000,
                name
            );

            if (myGeneration !== loadGeneration) return false;

            const chainInput = await getEffectsChain();
            sampler.connect(chainInput);
            samplerCache[name] = sampler;
            currentSampler = sampler;
            loadedName = name;
            notify('ready', '');
            return true;
        } catch (e) {
            console.error('Błąd ładowania instrumentu "' + name + '":', e);
            if (myGeneration === loadGeneration) {
                notify('error', 'Błąd ładowania instrumentu: ' + e.message);
            }
            return false;
        }
    }

    async function ensureReady(selectEl, onStateChange) {
        const selected = selectEl.value;
        if (loadedName !== selected || !currentSampler) {
            return await loadInstrument(selected, onStateChange);
        }
        return true;
    }

    function stopAll() {
        if (currentSampler) {
            try { currentSampler.releaseAll(Tone.now()); } catch (e) { /* nic nie grało */ }
        }
    }

    return {
        now: function () { return Tone.now(); },
        loadInstrument: loadInstrument,
        ensureReady: ensureReady,
        stopAll: stopAll,
        get player() { return currentSampler ? makePlayerWrapper(currentSampler) : null; }
    };
})();

/* Wspólne tempo odtwarzania (suwak 50%-150%), zapamiętywane w localStorage.
   1.0 = normalna prędkość. Wartość DZIELI bazowe czasy trwania w każdym
   ćwiczeniu: mniejszy mnożnik = dłużej = wolniej, większy = szybciej. */
window.KszaTempo = (function () {
    const STORAGE_KEY = 'ksza-tempo-multiplier';
    const DEFAULT = 1.0;
    let current = DEFAULT;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            const parsed = parseFloat(stored);
            if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 1.5) current = parsed;
        }
    } catch (e) { /* localStorage niedostępny - zostajemy przy domyślnej wartości */ }

    return {
        DEFAULT: DEFAULT,
        get: function () { return current; },
        set: function (value) {
            current = value;
            try { localStorage.setItem(STORAGE_KEY, String(value)); } catch (e) { /* ignorujemy */ }
        }
    };
})();

/* Nawigacja mobilna + suwak tempa - wspólne dla wszystkich stron. */
document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    const slider = document.getElementById('tempo-slider');
    const valueLabel = document.getElementById('tempo-value');
    if (slider) {
        const initialPercent = Math.round(KszaTempo.get() * 100);
        slider.value = initialPercent;
        if (valueLabel) valueLabel.textContent = initialPercent + '%';

        slider.addEventListener('input', function () {
            const percent = parseInt(slider.value, 10);
            KszaTempo.set(percent / 100);
            if (valueLabel) valueLabel.textContent = percent + '%';
        });
    }
});
