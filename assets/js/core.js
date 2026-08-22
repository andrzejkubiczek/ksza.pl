/* ksza.pl - wspólny rdzeń audio (Tone.js). Wymaga PRZED tym plikiem: Tone.js,
   assets/vendor/Tonejs-Instruments.js, window.KSZA_SAMPLES_BASE. */
window.KszaAudio = (() => {
    const samplerCache = {};
    let currentSampler = null;
    let loadedName = '';
    let loadGeneration = 0;
    let audioStarted = false;
    let effectsChainPromise = null;

    const makePlayerWrapper = (sampler) => ({
        play(note, time, opts) {
            const duration = (opts && opts.duration) || 0.5;
            const when = typeof time === 'number' ? time : Tone.now();
            sampler.triggerAttackRelease(note, duration, when);
        },
        stop() {
            sampler.releaseAll(Tone.now());
        },
        raw: sampler
    });

    async function ensureAudioStarted() {
        if (!audioStarted) {
            try {
                await Tone.start();
            } catch (e) {
                /* Wymaga gestu użytkownika */
            }
            audioStarted = true;
        }
    }

    // Wspólny łańcuch: highpass (tnie dudnienie) -> pogłos -> limiter, plus obniżona głośność bazowa.
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
                setTimeout(() => reject(new Error(`Przekroczono limit czasu ładowania (${label})`)), ms)
            )
        ]);
    }

    /** Ładuje instrument (z cache jeśli już pobrany). onStateChange(state, message). */
    async function loadInstrument(name, onStateChange = () => {}) {
        if (samplerCache[name]) {
            currentSampler = samplerCache[name];
            loadedName = name;
            onStateChange('ready', '');
            return true;
        }

        await ensureAudioStarted();

        const myGeneration = ++loadGeneration;
        onStateChange('loading', `Ładowanie instrumentu: ${name}...`);

        try {
            const baseUrl = window.KSZA_SAMPLES_BASE || 'assets/samples/';
            const sampler = await withTimeout(
                new Promise((resolve, reject) => {
                    let settled = false;
                    const instrument = SampleLibrary.load({
                        instruments: name,
                        baseUrl,
                        onload() {
                            if (settled) return;
                            settled = true;
                            resolve(instrument);
                        }
                    });
                    // Nie wszystkie wersje SampleLibrary wspierają onload - fallback na Tone.loaded().
                    Tone.loaded().then(() => {
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
            onStateChange('ready', '');
            return true;
        } catch (e) {
            console.error(`Błąd ładowania instrumentu "${name}":`, e);
            if (myGeneration === loadGeneration) {
                onStateChange('error', `Błąd ładowania instrumentu: ${e.message}`);
            }
            return false;
        }
    }

    async function ensureReady(selectEl, onStateChange) {
        const selected = selectEl ? selectEl.value : 'piano';
        if (loadedName !== selected || !currentSampler) {
            return await loadInstrument(selected, onStateChange);
        }
        return true;
    }

    function stopAll() {
        if (currentSampler) {
            try {
                currentSampler.releaseAll(Tone.now());
            } catch (e) {
                /* Nic nie grało */
            }
        }
    }

    // Klik metronomu (odliczenie taktu przed pełnym odsłuchem) - osobny
    // syntezator, niezależny od wybranego instrumentu.
    let clickSynth = null;
    function getClickSynth() {
        if (!clickSynth) {
            clickSynth = new Tone.Synth({
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
            }).toDestination();
            clickSynth.volume.value = -4;
        }
        return clickSynth;
    }

    function playClick(accent = false) {
        getClickSynth().triggerAttackRelease(accent ? 'C6' : 'G5', 0.05, Tone.now());
    }

    return {
        loadInstrument,
        ensureReady,
        stopAll,
        playClick,
        get player() {
            return currentSampler ? makePlayerWrapper(currentSampler) : null;
        }
    };
})();

// Wspólne tempo (suwak 50%-150%). 1.0 = normalna prędkość. Resetuje się do
// 100% przy każdym wejściu na stronę - ćwiczenia zbyt się różnią, żeby
// jedno zapamiętane tempo miało sens między nimi.
window.KszaTempo = (() => {
    const DEFAULT = 1.0;
    let current = DEFAULT;

    return {
        DEFAULT,
        get() {
            return current;
        },
        set(value) {
            current = value;
        }
    };
})();

// Zakres brzmieniowy każdego instrumentu - żeby losowe ćwiczenia nie prosiły np. fagotu o dźwięk poza jego skalą.
window.KszaInstrumentRange = (() => {
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const RANGES = {
        piano:     { min: 'C3',  max: 'F6'  },
        flute:     { min: 'C4',  max: 'C7'  },
        clarinet:  { min: 'D3',  max: 'F6'  },
        violin:    { min: 'G3',  max: 'F6'  },
        xylophone: { min: 'C5',  max: 'F6'  },
        trumpet:   { min: 'F#3', max: 'D6'  },
        bassoon:   { min: 'G2',  max: 'D#5' }
    };

    function toSemitone(name) {
        const m = /^([A-G]#?)(-?\d+)$/.exec(name);
        return m ? parseInt(m[2], 10) * 12 + CHROMATIC.indexOf(m[1]) : 0;
    }

    function fromSemitone(abs) {
        const pc = ((abs % 12) + 12) % 12;
        const octave = Math.floor(abs / 12);
        return `${CHROMATIC[pc]}${octave}`;
    }

    // {min, max} jako absolutne półtony; nieznany instrument -> zakres fortepianu.
    function range(instrumentKey) {
        const r = RANGES[instrumentKey] || RANGES.piano;
        return { min: toSemitone(r.min), max: toSemitone(r.max) };
    }

    function transposeNoteName(name, octaveShift) {
        return fromSemitone(toSemitone(name) + octaveShift * 12);
    }

    // Przesuwa wszystkie dźwięki o tyle samo oktaw, żeby zmieściły się w zakresie instrumentu; 0, gdy już się mieszczą.
    function fitOctaveShift(noteNames, instrumentKey) {
        const r = range(instrumentKey);
        const semis = noteNames.map(toSemitone);
        const lo = Math.min(...semis);
        const hi = Math.max(...semis);
        let best = 0;
        let bestOverflow = Infinity;
        for (let shift = -8; shift <= 8; shift++) {
            const newLo = lo + shift * 12;
            const newHi = hi + shift * 12;
            const overflow = Math.max(0, r.min - newLo) + Math.max(0, newHi - r.max);
            if (overflow < bestOverflow) {
                bestOverflow = overflow;
                best = shift;
            }
            if (overflow === 0) break;
        }
        return best;
    }

    return {
        toSemitone,
        fromSemitone,
        range,
        transposeNoteName,
        fitOctaveShift
    };
})();

/* Nawigacja mobilna + suwak tempa + stopka - wspólne dla wszystkich stron. */
document.addEventListener('DOMContentLoaded', () => {
    // Aktualizacja roku w stopce (jeśli element istnieje)
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    // Menu mobilne
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    }

    // Suwak tempa
    const slider = document.getElementById('tempo-slider');
    const valueLabel = document.getElementById('tempo-value');
    if (slider) {
        const initialPercent = Math.round(KszaTempo.get() * 100);
        slider.value = initialPercent;
        if (valueLabel) valueLabel.textContent = `${initialPercent}%`;

        slider.addEventListener('input', () => {
            const percent = parseInt(slider.value, 10);
            KszaTempo.set(percent / 100);
            if (valueLabel) valueLabel.textContent = `${percent}%`;
        });
    }
});
