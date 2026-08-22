window.KszaAudio = (() => {
    let audioCtx = null;
    let cacheStorage = null;
    const samplerCache = {};
    let currentSampler = null;
    let loadedName = '';
    let loadGeneration = 0;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        return audioCtx;
    }

    function getStorage() {
        if (!cacheStorage && typeof smplr !== 'undefined' && smplr.CacheStorage) {
            cacheStorage = new smplr.CacheStorage('ksza-audio-v2');
        }
        return cacheStorage || undefined;
    }

    async function ensureAudioStarted() {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (e) {}
        }
    }

    const makePlayerWrapper = (sampler) => ({
        play(note, time, opts) {
            const duration = (opts && opts.duration) || 0.5;
            sampler.start({ note, time: typeof time === 'number' ? time : undefined, duration });
        },
        stop() {
            sampler.stop();
        },
        raw: sampler
    });

    function createSamplerInstance(name, ctx) {
        const storage = getStorage();
        if (name === 'piano') {
            return new smplr.SplendidGrandPiano(ctx, {
                storage,
                decayTime: 0.28,
                volume: 95
            });
        }
        return new smplr.Soundfont(ctx, {
            instrument: name,
            kit: 'FluidR3_GM',
            storage,
            extraGain: 3.5,
            volume: 95
        });
    }

    async function loadInstrument(name, onStateChange = () => {}) {
        if (samplerCache[name]) {
            currentSampler = samplerCache[name];
            loadedName = name;
            await currentSampler.load;
            onStateChange('ready', '');
            return true;
        }

        await ensureAudioStarted();
        const ctx = getAudioContext();

        const myGeneration = ++loadGeneration;
        onStateChange('loading', `Ładowanie instrumentu: ${name}...`);

        try {
            if (typeof smplr === 'undefined') {
                throw new Error('Biblioteka smplr nie została wczytana.');
            }

            const sampler = createSamplerInstance(name, ctx);
            samplerCache[name] = sampler;

            await sampler.load;

            if (myGeneration !== loadGeneration) return false;

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
                currentSampler.stop();
            } catch (e) {}
        }
    }

    function playClick(accent = false) {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(accent ? 880 : 587.33, t);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.045);
    }

    function prewarmDefaultInstrument() {
        if (typeof smplr === 'undefined') return;
        const ctx = getAudioContext();
        if (!samplerCache['piano']) {
            samplerCache['piano'] = createSamplerInstance('piano', ctx);
        }
    }

    return {
        get context() {
            return getAudioContext();
        },
        loadInstrument,
        ensureReady,
        stopAll,
        playClick,
        prewarmDefaultInstrument,
        get player() {
            return currentSampler ? makePlayerWrapper(currentSampler) : null;
        }
    };
})();

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

    function range(instrumentKey) {
        const r = RANGES[instrumentKey] || RANGES.piano;
        return { min: toSemitone(r.min), max: toSemitone(r.max) };
    }

    function transposeNoteName(name, octaveShift) {
        return fromSemitone(toSemitone(name) + octaveShift * 12);
    }

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

document.addEventListener('DOMContentLoaded', () => {
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    }

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

    if (typeof KszaAudio !== 'undefined' && KszaAudio.prewarmDefaultInstrument) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(KszaAudio.prewarmDefaultInstrument);
        } else {
            setTimeout(KszaAudio.prewarmDefaultInstrument, 300);
        }
    }
});
