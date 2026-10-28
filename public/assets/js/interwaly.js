(() => {
    // -------------------------------------------------------------------------
    // 1. STAŁE I DANE MUZYCZNE
    // -------------------------------------------------------------------------
    const NOTES_ARRAY = [
        'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
        'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
        'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
    ];

    const INTERVALS = [
        { semitones: 0, symbol: '1' },
        { semitones: 1, symbol: '2>' },
        { semitones: 2, symbol: '2' },
        { semitones: 3, symbol: '3>' },
        { semitones: 4, symbol: '3' },
        { semitones: 5, symbol: '4' },
        { semitones: 6, symbol: '4<' },
        { semitones: 7, symbol: '5' },
        { semitones: 8, symbol: '6>' },
        { semitones: 9, symbol: '6' },
        { semitones: 10, symbol: '7' },
        { semitones: 11, symbol: '7<' },
        { semitones: 12, symbol: '8' }
    ];

    const ARRAY_BASE_SEMITONE = KszaInstrumentRange.toSemitone(NOTES_ARRAY[0]);
    const LEVEL_STORAGE_KEY = 'ksza_interval_level';

    // -------------------------------------------------------------------------
    // 2. CZASY ODSŁUCHU (STAŁE TEMPO 95%)
    // -------------------------------------------------------------------------
    const FIXED_TEMPO_SPEED = 0.95;
    const NOTE_DURATION = 0.9375 / FIXED_TEMPO_SPEED;
    const GAP_BEFORE_SECOND = 1.1875 / FIXED_TEMPO_SPEED;
    const SECOND_NOTE_DURATION = 1.75 / FIXED_TEMPO_SPEED;
    const HARMONIC_DURATION = 1.75 / FIXED_TEMPO_SPEED;
    const MIXED_GAP = 1.0 / FIXED_TEMPO_SPEED;

    // -------------------------------------------------------------------------
    // 3. STAN APLIKACJI
    // -------------------------------------------------------------------------
    const state = {
        currentInterval: null,
        firstNoteName: '',
        secondNoteName: '',
        hasAnswered: false,
        isPlaying: false,
        scheduledTimeouts: []
    };

    // -------------------------------------------------------------------------
    // 4. ELEMENTY DOM I POMOCNIKI
    // -------------------------------------------------------------------------
    const dom = {
        instrumentSelect: () => document.getElementById('instrument-select'),
        modeSelect: () => document.getElementById('mode-select'),
        levelSelect: () => document.getElementById('level-select'),
        directionHint: () => document.getElementById('direction-hint'),
        playBtn: () => document.getElementById('play-btn'),
        nextBtn: () => document.getElementById('next-btn'),
        feedback: () => document.getElementById('feedback'),
        choiceButtons: () => document.querySelectorAll('.interval-choice')
    };

    const onAudioState = KszaUI.createAudioStateHandler('play-btn');

    // -------------------------------------------------------------------------
    // 5. OBSŁUGA POZIOMU (KIERUNKU)
    // -------------------------------------------------------------------------
    function getLevel() {
        return dom.levelSelect()?.value || '1';
    }

    function updateDirectionHint() {
        const hint = dom.directionHint();
        if (!hint) return;
        hint.textContent = getLevel() === '1'
            ? 'Poziom 1: dźwięki grane są w górę.'
            : 'Poziom 2: dźwięki grane są losowo w górę albo w dół.';
    }

    function initLevel() {
        const select = dom.levelSelect();
        if (!select) return;
        try {
            const saved = localStorage.getItem(LEVEL_STORAGE_KEY);
            if (saved === '1' || saved === '2') {
                select.value = saved;
            }
        } catch (e) {}
        updateDirectionHint();
    }

    // -------------------------------------------------------------------------
    // 6. FILTROWANIE INTERWAŁÓW I PRZYCISKI ODPOWIEDZI
    // -------------------------------------------------------------------------
    function getActiveIntervalPool() {
        if (window.KszaIntervalFilter) {
            const activeSymbols = KszaIntervalFilter.getActiveSymbols();
            const filtered = INTERVALS.filter((it) => activeSymbols.includes(it.symbol));
            if (filtered.length >= 2) return filtered;
        }
        return INTERVALS;
    }

    function updateChoiceButtonsState() {
        const activeSymbols = window.KszaIntervalFilter
            ? window.KszaIntervalFilter.getActiveSymbols()
            : INTERVALS.map((it) => it.symbol);

        dom.choiceButtons().forEach((btn) => {
            const symbol = btn.dataset.symbol;
            const isActive = activeSymbols.includes(symbol);
            if (isActive) {
                btn.classList.remove('interval-excluded');
                btn.removeAttribute('aria-disabled');
                if (!state.hasAnswered) {
                    btn.removeAttribute('disabled');
                }
            } else {
                btn.classList.add('interval-excluded');
                btn.setAttribute('aria-disabled', 'true');
                btn.setAttribute('disabled', 'true');
            }
        });
    }

    // -------------------------------------------------------------------------
    // 7. LOSOWANIE I GENEROWANIE INTERWAŁU
    // -------------------------------------------------------------------------
    function pickStartIndex(semitones) {
        const instrument = dom.instrumentSelect()?.value || 'piano';
        const range = KszaInstrumentRange.range(instrument);
        const arrayMaxIdx = NOTES_ARRAY.length - 1 - semitones;
        let minIdx = Math.max(0, range.min - ARRAY_BASE_SEMITONE);
        let maxIdx = Math.min(arrayMaxIdx, range.max - ARRAY_BASE_SEMITONE - semitones);
        if (maxIdx < minIdx) {
            minIdx = Math.max(0, Math.min(minIdx, arrayMaxIdx));
            maxIdx = minIdx;
        }
        return minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1));
    }

    function generateNewInterval() {
        stopScheduledPlayback();
        state.hasAnswered = false;

        const feedback = dom.feedback();
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }

        const nextBtn = dom.nextBtn();
        const playBtn = dom.playBtn();
        if (nextBtn) nextBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'inline-flex';

        updateChoiceButtonsState();

        const pool = getActiveIntervalPool();
        state.currentInterval = pool[Math.floor(Math.random() * pool.length)];
        const startIndex = pickStartIndex(state.currentInterval.semitones);

        const lowerNote = NOTES_ARRAY[startIndex];
        const higherNote = NOTES_ARRAY[startIndex + state.currentInterval.semitones];
        const playAscending = getLevel() === '1' ? true : Math.random() > 0.5;

        if (playAscending || state.currentInterval.semitones === 0) {
            state.firstNoteName = lowerNote;
            state.secondNoteName = higherNote;
        } else {
            state.firstNoteName = higherNote;
            state.secondNoteName = lowerNote;
        }
    }

    // -------------------------------------------------------------------------
    // 8. ODTWARZANIE DŹWIĘKÓW (AUDIO)
    // -------------------------------------------------------------------------
    function stopScheduledPlayback() {
        state.scheduledTimeouts.forEach((id) => clearTimeout(id));
        state.scheduledTimeouts = [];
        state.isPlaying = false;
        const playBtn = dom.playBtn();
        if (playBtn) playBtn.disabled = false;
    }

    async function playCurrentInterval() {
        if (state.isPlaying) return;

        const ok = await KszaAudio.ensureReady(dom.instrumentSelect(), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopScheduledPlayback();
        state.isPlaying = true;
        const playBtn = dom.playBtn();
        if (playBtn) playBtn.disabled = true;
        KszaAudio.stopAll();

        const scheduleNote = (note, delaySeconds, duration) => {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration });
            }, delaySeconds * 1000);
            state.scheduledTimeouts.push(id);
        };

        const mode = dom.modeSelect()?.value || 'melodic';
        let totalSeconds;

        if (mode === 'harmonic') {
            scheduleNote(state.firstNoteName, 0, HARMONIC_DURATION);
            scheduleNote(state.secondNoteName, 0, HARMONIC_DURATION);
            totalSeconds = HARMONIC_DURATION;
        } else if (mode === 'mixed') {
            scheduleNote(state.firstNoteName, 0, NOTE_DURATION);
            scheduleNote(state.secondNoteName, GAP_BEFORE_SECOND, SECOND_NOTE_DURATION);
            const harmonicStart = GAP_BEFORE_SECOND + SECOND_NOTE_DURATION + MIXED_GAP;
            scheduleNote(state.firstNoteName, harmonicStart, HARMONIC_DURATION);
            scheduleNote(state.secondNoteName, harmonicStart, HARMONIC_DURATION);
            totalSeconds = harmonicStart + HARMONIC_DURATION;
        } else {
            scheduleNote(state.firstNoteName, 0, NOTE_DURATION);
            scheduleNote(state.secondNoteName, GAP_BEFORE_SECOND, SECOND_NOTE_DURATION);
            totalSeconds = GAP_BEFORE_SECOND + SECOND_NOTE_DURATION;
        }

        const endId = setTimeout(() => {
            state.isPlaying = false;
            if (playBtn) playBtn.disabled = false;
        }, totalSeconds * 1000 + 150);
        state.scheduledTimeouts.push(endId);
    }

    // -------------------------------------------------------------------------
    // 9. SPRAWDZANIE ODPOWIEDZI
    // -------------------------------------------------------------------------
    function checkAnswer(selectedSymbol) {
        if (state.hasAnswered) return;
        if (window.KszaIntervalFilter && !KszaIntervalFilter.isIntervalActive(selectedSymbol)) return;
        state.hasAnswered = true;

        dom.choiceButtons().forEach((b) => b.setAttribute('disabled', 'true'));

        const feedback = dom.feedback();
        if (feedback) {
            if (selectedSymbol === state.currentInterval.symbol) {
                feedback.className = 'feedback-msg feedback-correct';
                feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
            } else {
                feedback.className = 'feedback-msg feedback-wrong';
                feedback.textContent = `Niestety nie. Poprawna odpowiedź: ${state.currentInterval.symbol}.`;
            }
        }

        const playBtn = dom.playBtn();
        const nextBtn = dom.nextBtn();
        if (playBtn) playBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'inline-flex';
    }

    function nextInterval() {
        generateNewInterval();
        setTimeout(playCurrentInterval, 250);
    }

    // -------------------------------------------------------------------------
    // 10. INICJALIZACJA I OBSŁUGA ZDARZEŃ
    // -------------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        initLevel();

        if (window.KszaIntervalFilter) {
            KszaIntervalFilter.init({
                filterId: 'interval-filter',
                onChange: (symbols) => {
                    updateChoiceButtonsState();
                    if (state.currentInterval && !symbols.includes(state.currentInterval.symbol)) {
                        generateNewInterval();
                    }
                }
            });
        }

        generateNewInterval();

        dom.playBtn()?.addEventListener('click', playCurrentInterval);
        dom.nextBtn()?.addEventListener('click', nextInterval);

        dom.levelSelect()?.addEventListener('change', (e) => {
            try {
                localStorage.setItem(LEVEL_STORAGE_KEY, e.target.value);
            } catch (err) {}
            updateDirectionHint();
            generateNewInterval();
        });

        dom.instrumentSelect()?.addEventListener('change', (e) => {
            KszaAudio.stopAll();
            stopScheduledPlayback();
            const shift = KszaInstrumentRange.fitOctaveShift([state.firstNoteName, state.secondNoteName], e.target.value);
            if (shift !== 0) {
                state.firstNoteName = KszaInstrumentRange.transposeNoteName(state.firstNoteName, shift);
                state.secondNoteName = KszaInstrumentRange.transposeNoteName(state.secondNoteName, shift);
            }
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });

        dom.choiceButtons().forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.symbol));
        });
    });
})();
