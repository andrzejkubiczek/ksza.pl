(() => {
    const MT = KszaMusicTheory;

    const INTERVAL_DEFS = {
        '1':  { steps: 0, semitones: 0,  label: 'Pryma czysta' },
        '2>': { steps: 1, semitones: 1,  label: 'Sekunda mała' },
        '2':  { steps: 1, semitones: 2,  label: 'Sekunda wielka' },
        '3>': { steps: 2, semitones: 3,  label: 'Tercja mała' },
        '3':  { steps: 2, semitones: 4,  label: 'Tercja wielka' },
        '4':  { steps: 3, semitones: 5,  label: 'Kwarta czysta' },
        '4<': { steps: 3, semitones: 6,  label: 'Tryton' },
        '5':  { steps: 4, semitones: 7,  label: 'Kwinta czysta' },
        '6>': { steps: 5, semitones: 8,  label: 'Seksta mała' },
        '6':  { steps: 5, semitones: 9,  label: 'Seksta wielka' },
        '7':  { steps: 6, semitones: 10, label: 'Septyma mała' },
        '7<': { steps: 6, semitones: 11, label: 'Septyma wielka' },
        '8':  { steps: 7, semitones: 12, label: 'Oktawa czysta' }
    };

    // Zbiory interwałów dla poziomów:
    const LEVEL_1_SYMBOLS = ['1', '2>', '2', '3>', '3', '4', '5', '8'];
    const LEVEL_2_SYMBOLS = ['1', '2>', '2', '3>', '3', '4', '4<', '5', '6>', '6', '7', '7<', '8'];

    const SOLMIZATION = MT.SOLMIZATION;

    const SEMITONES_TO_INTERVAL_NAME = {
        0: 'Pryma czysta',
        1: 'Sekunda mała',
        2: 'Sekunda wielka',
        3: 'Tercja mała',
        4: 'Tercja wielka',
        5: 'Kwarta czysta',
        6: 'Tryton',
        7: 'Kwinta czysta',
        8: 'Seksta mała',
        9: 'Seksta wielka',
        10: 'Septyma mała',
        11: 'Septyma wielka',
        12: 'Oktawa czysta'
    };

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;
    const MAX_ATTEMPTS = 3;
    const REQUIRED_HOLD_MS = 220; // Wymagany czas stabilnego podtrzymania dźwięku

    let currentSymbol = null;
    let direction = 1;
    let rootNote = null;
    let targetNote = null;
    let targetSemitoneClass = 0;
    let rootSemitoneClass = 0;
    let clef = 'treble';

    // Stan prób i dwuetapowego śpiewania:
    let attemptCount = 1; // 1..3
    let currentStep = 0;   // 0 (baza) -> 1 (skok)
    let noteResults = [null, null]; // 'clean' | 'adjusted' | 'wrong'

    let isSinging = false;
    let isPlayingModel = false;
    let hasAnswered = false;

    let voiceOnsetMs = null;
    let holdDurationMs = 0;
    let lastFrameTime = null;

    let lastHeardSemitone = null;
    let wrongNoteHoldMs = 0;

    // Filtr medianowy wygładzający wibrato i mikrofluktuacje:
    const pitchFilter = new KszaUI.PitchMedianFilter(5);

    // Kontrola nowego ataku i okna ochronnego dla Kroku 2:
    let sungRootMidi = null;
    let step1CooldownUntil = 0;
    let waitingForStep1Onset = false;
    let hasDetectedSilenceBeforeStep1 = false;

    const currentLevel = () => document.getElementById('level-select')?.value || '1';

    const setStatus = (msg, type) => KszaUI.setStatus(msg, type);

    function onAudioState(state, message) {
        const playBtn = document.getElementById('play-model-btn');
        const refBtn = document.getElementById('ref-pitch-btn');
        if (playBtn && (attemptCount >= 3 || hasAnswered)) playBtn.disabled = state === 'loading';
        if (refBtn) refBtn.disabled = state === 'loading';

        if (state === 'error') setStatus(message, 'error');
        else if (state === 'loading') setStatus(message, null);
        else setStatus('', null);
    }

    const playSuccessChime = () => KszaUI.playSuccessChime();

    function noteToToneName(note) {
        const accidental = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === 2 ? '##' : note.alter === -2 ? 'bb' : '';
        return `${note.letter}${accidental}${note.octave}`;
    }

    function getOctaveShift(tones) {
        if (!tones || typeof KszaInstrumentRange === 'undefined') return 0;
        return KszaInstrumentRange.fitOctaveShift(tones, 'piano');
    }

    function adaptPitch(pitch, shift = 0) {
        if (!pitch || typeof KszaInstrumentRange === 'undefined') return pitch;
        return shift !== 0 ? KszaInstrumentRange.transposeNoteName(pitch, shift) : pitch;
    }

    function buildNoteXml(note, isGhost = false) {
        if (isGhost) {
            return `<note><rest/><duration>2</duration><type>half</type></note>`;
        }
        return `<note>${MT.noteToPitchXml(note)}<duration>2</duration><type>half</type>${MT.accidentalTag(note)}</note>`;
    }

    function buildMeasureMusicXML(clefType, note1, note2, step, answered) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        
        const note2Xml = (step >= 1 || answered)
            ? buildNoteXml(note2, false)
            : buildNoteXml(note2, true);

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Interwał</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>${buildNoteXml(note1, false)}${note2Xml}</measure></part></score-partwise>`;
    }

    function renderScore(step = currentStep) {
        try {
            const svg = KszaVerovio.render(buildMeasureMusicXML(clef, rootNote, targetNote, step, hasAnswered), {
                pageWidth: 900,
                pageHeight: 260,
                scale: 60,
                adjustPageHeight: true,
                breaks: 'none'
            });
            const container = document.getElementById('notation-container');
            if (container) {
                container.innerHTML = svg;
                const noteEls = container.querySelectorAll('g.note');

                if (noteEls.length >= 1) {
                    const el0 = noteEls[0];
                    el0.classList.remove('note-current-target', 'note-feedback-correct', 'note-feedback-warn', 'note-feedback-wrong');
                    if (noteResults[0] === 'clean') el0.classList.add('note-feedback-correct');
                    else if (noteResults[0] === 'adjusted') el0.classList.add('note-feedback-warn');
                    else if (step === 0 && isSinging) el0.classList.add('note-current-target');
                }

                if (noteEls.length >= 2) {
                    const el1 = noteEls[1];
                    el1.classList.remove('note-current-target', 'note-feedback-correct', 'note-feedback-warn', 'note-feedback-wrong');
                    if (noteResults[1] === 'clean') el1.classList.add('note-feedback-correct');
                    else if (noteResults[1] === 'adjusted') el1.classList.add('note-feedback-warn');
                    else if (noteResults[1] === 'wrong') el1.classList.add('note-feedback-wrong');
                    else if (step === 1 && isSinging) el1.classList.add('note-current-target');
                }
            }
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus(`Błąd renderowania nut: ${e.message}`, 'error');
        }
    }

    function updateHoldProgressBar(progressPct) {
        const bar = document.getElementById('tuner-hold-progress');
        if (bar) {
            bar.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
        }
    }

    function updateTunerUI(data, isMatchingTarget = false) {
        const tunerNote = document.getElementById('tuner-note');
        const tunerSolfege = document.getElementById('tuner-solfege');
        const tunerStatus = document.getElementById('tuner-status');
        const tunerIndicator = document.getElementById('tuner-indicator');

        if (!data || data.isSilent || !data.pitch) {
            if (tunerNote) tunerNote.textContent = '—';
            if (tunerSolfege) tunerSolfege.textContent = '';
            if (tunerStatus) {
                tunerStatus.textContent = isSinging ? 'Śpiewaj...' : 'Mikrofon wyłączony';
                tunerStatus.className = 'tuner-status';
            }
            if (tunerIndicator) tunerIndicator.style.left = '50%';
            updateHoldProgressBar(0);
            return;
        }

        const p = data.pitch;
        const solf = SOLMIZATION[p.noteName] || '';
        const displayName = p.polishNoteName || p.noteName;
        if (tunerNote) tunerNote.textContent = displayName;
        if (tunerSolfege) tunerSolfege.textContent = solf ? `(${solf})` : '';

        const cents = p.cents;
        if (tunerStatus) {
            if (isMatchingTarget) {
                tunerStatus.textContent = 'Trzymaj dźwięk... 🎯';
                tunerStatus.className = 'tuner-status is-holding';
            } else if (Math.abs(cents) <= 22) {
                tunerStatus.textContent = 'W punkt! 🎯';
                tunerStatus.className = 'tuner-status is-in-tune';
            } else if (cents < -22) {
                tunerStatus.textContent = 'Podciągnij wyżej 🔼';
                tunerStatus.className = 'tuner-status is-flat';
            } else {
                tunerStatus.textContent = 'Troszkę za wysoko 🔽';
                tunerStatus.className = 'tuner-status is-sharp';
            }
        }

        const pct = Math.max(0, Math.min(100, 50 + cents));
        if (tunerIndicator) tunerIndicator.style.left = `${pct}%`;
    }

    function updateModelButtonState() {
        const playBtn = document.getElementById('play-model-btn');
        if (!playBtn) return;
        
        if (attemptCount >= 3 || hasAnswered) {
            playBtn.disabled = false;
            playBtn.title = 'Odsłuchaj pełny interwał na fortepianie';
        } else {
            playBtn.disabled = true;
            playBtn.title = 'Wzorzec odblokuje się przed 3. próbą lub po zakończeniu zadania';
        }
    }

    function pickClef() {
        const selected = document.getElementById('clef-select')?.value || 'random';
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }

    /**
     * Sprawdza, czy nuta nie jest egzotyczną enharmonią (Fes, Ces, His, Eis)
     */
    function isSimpleNote(note) {
        if (!note || Math.abs(note.alter) > 1) return false;
        if (note.letter === 'F' && note.alter === -1) return false; // Fes
        if (note.letter === 'C' && note.alter === -1) return false; // Ces
        if (note.letter === 'B' && note.alter === 1) return false;  // His
        if (note.letter === 'E' && note.alter === 1) return false;  // Eis
        return true;
    }

    function pickRootAlter(letter, symbol, dir) {
        const safeAlters = [-1, 0, 1].filter((alter) => {
            const probe = { letter, alter, octave: TREBLE_ROOT_OCTAVE };
            const result = MT.spellByShape(probe, INTERVAL_DEFS[symbol], dir);
            return Math.abs(result.alter) <= 1;
        });
        return safeAlters.length ? safeAlters[Math.floor(Math.random() * safeAlters.length)] : 0;
    }

    function updateTaskStepUI(step) {
        const stepTag = document.getElementById('task-step-tag');
        const attemptTag = document.getElementById('task-attempt-tag');
        const feedback = document.getElementById('feedback');

        const rootAccidental = rootNote.alter === 1 ? '#' : rootNote.alter === -1 ? 'b' : '';
        const rootSolf = SOLMIZATION[rootNote.letter + rootAccidental] || SOLMIZATION[rootNote.letter] || '';
        const rootLabelText = `${MT.noteLabel(rootNote)}${rootNote.octave}`;

        const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
        const targetSolf = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
        const targetLabelText = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

        if (attemptTag) {
            attemptTag.textContent = `Próba ${attemptCount}/${MAX_ATTEMPTS}`;
        }

        if (stepTag) {
            if (step === 0) {
                stepTag.textContent = `Krok 1/2: Dźwięk wyjściowy (${rootLabelText})`;
            } else {
                stepTag.textContent = `Krok 2/2: Weź oddech i skocz na dźwięk docelowy (${targetLabelText})`;
            }
        }

        if (feedback && !hasAnswered) {
            if (isSinging) {
                if (step === 0) {
                    feedback.innerHTML = `Śpiewaj 1. dźwięk: <strong>${rootLabelText} ${rootSolf ? `(${rootSolf})` : ''}</strong>...`;
                } else {
                    feedback.innerHTML = `🎯 Dźwięk 1 zaliczony! Weź oddech i skocz na dźwięk docelowy: <strong>${targetLabelText} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                }
                feedback.className = 'feedback-msg';
            }
        }
    }

    function resetCurrentQuestionForRetry() {
        hasAnswered = false;
        attemptCount = 1;
        currentStep = 0;
        noteResults = [null, null];
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        sungRootMidi = null;
        step1CooldownUntil = 0;
        waitingForStep1Onset = false;
        hasDetectedSilenceBeforeStep1 = false;

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }
        const legend = document.getElementById('feedback-legend');
        if (legend) legend.style.display = 'none';

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.style.display = 'none';

        updateHoldProgressBar(0);
        updateModelButtonState();
        updateTaskStepUI(0);
        renderScore(0);
    }

    async function generateNewQuestion() {
        stopSinging();
        hasAnswered = false;
        attemptCount = 1;
        currentStep = 0;
        noteResults = [null, null];
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        sungRootMidi = null;
        step1CooldownUntil = 0;
        waitingForStep1Onset = false;
        hasDetectedSilenceBeforeStep1 = false;

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }
        const legend = document.getElementById('feedback-legend');
        if (legend) legend.style.display = 'none';

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.style.display = 'none';

        const singBtn = document.getElementById('sing-btn');
        if (singBtn) {
            singBtn.disabled = false;
            singBtn.classList.remove('btn-active');
        }
        const singText = document.getElementById('sing-btn-text');
        if (singText) singText.textContent = 'Zaśpiewaj interwał';

        clef = pickClef();
        const level = currentLevel();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;

        if (level === '1') {
            // Poziom 1: Podstawowe interwały, naturalne dźwięki, bez skomplikowanych znaków
            const pool = LEVEL_1_SYMBOLS;
            let found = false;
            let candRoot, candTarget, candSymbol, candDir;

            for (let i = 0; i < 50; i++) {
                const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
                candSymbol = pool[Math.floor(Math.random() * pool.length)];
                candDir = Math.random() < 0.5 ? 1 : -1;
                candRoot = { letter: rootLetter, alter: 0, octave: rootOctave };
                candTarget = MT.spellByShape(candRoot, INTERVAL_DEFS[candSymbol], candDir);

                if (isSimpleNote(candTarget)) {
                    found = true;
                    break;
                }
            }

            currentSymbol = candSymbol;
            direction = candDir;
            rootNote = candRoot;
            targetNote = candTarget;
        } else {
            // Poziom 2: Wszystkie interwały, chromatyka w obu kierunkach (wyłącznie czyste nuty)
            let found = false;
            const safeAlters = [-1, 0, 1];

            for (let i = 0; i < 100; i++) {
                const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
                const candSymbol = LEVEL_2_SYMBOLS[Math.floor(Math.random() * LEVEL_2_SYMBOLS.length)];
                const candDir = Math.random() < 0.5 ? -1 : 1;
                const rootAlter = safeAlters[Math.floor(Math.random() * safeAlters.length)];
                const candRoot = { letter: rootLetter, alter: rootAlter, octave: rootOctave };

                if (!MT.isCleanNote(candRoot)) continue;

                const candTarget = MT.spellByShape(candRoot, INTERVAL_DEFS[candSymbol], candDir);
                if (MT.isCleanNote(candTarget)) {
                    currentSymbol = candSymbol;
                    direction = candDir;
                    rootNote = candRoot;
                    targetNote = candTarget;
                    found = true;
                    break;
                }
            }

            if (!found) {
                currentSymbol = '1';
                direction = 1;
                rootNote = { letter: 'C', alter: 0, octave: rootOctave };
                targetNote = { letter: 'C', alter: 0, octave: rootOctave };
            }
        }

        rootSemitoneClass = ((MT.LETTER_NATURAL_OFFSET[rootNote.letter] + rootNote.alter) % 12 + 12) % 12;
        targetSemitoneClass = ((MT.LETTER_NATURAL_OFFSET[targetNote.letter] + targetNote.alter) % 12 + 12) % 12;

        const rootAccidental = rootNote.alter === 1 ? '#' : rootNote.alter === -1 ? 'b' : '';
        const rootSolf = SOLMIZATION[rootNote.letter + rootAccidental] || SOLMIZATION[rootNote.letter] || '';
        const rootLabelText = `${MT.noteLabel(rootNote)}${rootNote.octave}`;

        // Karta zadania
        const badgeEl = document.getElementById('task-badge');
        if (badgeEl) badgeEl.textContent = currentSymbol;

        const dirTag = document.getElementById('task-direction-tag');
        if (dirTag) {
            if (direction === 1) {
                dirTag.className = 'sing-tag tag-direction-up';
                dirTag.textContent = 'w górę ↑';
            } else {
                dirTag.className = 'sing-tag tag-direction-down';
                dirTag.textContent = 'w dół ↓';
            }
        }

        const rootTag = document.getElementById('task-root-tag');
        if (rootTag) {
            rootTag.innerHTML = `od: <strong>${rootLabelText} ${rootSolf ? `(${rootSolf})` : ''}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            titleEl.innerHTML = `Zaśpiewaj: <strong>${INTERVAL_DEFS[currentSymbol].label}</strong>`;
        }

        updateHoldProgressBar(0);
        updateModelButtonState();
        updateTaskStepUI(0);

        try {
            await KszaVerovio.ensureReady();
            renderScore(0);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
        }
    }

    async function playRootPitch() {
        if (!rootNote) return;
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tone = noteToToneName(rootNote);
            const shift = getOctaveShift([tone, noteToToneName(targetNote)]);
            const adapted = adaptPitch(tone, shift);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
        } catch (e) {
            console.error('Błąd odtwarzania dźwięku:', e);
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!rootNote || !targetNote || isPlayingModel) return;
        const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
        if (!ok || !KszaAudio.player) return;

        isPlayingModel = true;
        const playBtn = document.getElementById('play-model-btn');
        if (playBtn) playBtn.disabled = true;

        try {
            const rootTone = noteToToneName(rootNote);
            const targetTone = noteToToneName(targetNote);
            const shift = getOctaveShift([rootTone, targetTone]);

            const adaptedRoot = adaptPitch(rootTone, shift);
            const adaptedTarget = adaptPitch(targetTone, shift);

            renderScore(1);
            const noteEls = document.querySelectorAll('#notation-container g.note');
            if (noteEls.length >= 1) {
                noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === 0));
            }
            KszaAudio.player.play(adaptedRoot, undefined, { duration: 0.8 });

            setTimeout(() => {
                if (noteEls.length >= 2) {
                    noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === 1));
                }
                if (KszaAudio.player) {
                    KszaAudio.player.play(adaptedTarget, undefined, { duration: 1.2 });
                }

                setTimeout(() => {
                    isPlayingModel = false;
                    if (playBtn && (attemptCount >= 3 || hasAnswered)) playBtn.disabled = false;
                    renderScore(currentStep);
                }, 1300);
            }, 850);
        } catch (e) {
            console.error('Błąd odtwarzania wzorca:', e);
            setStatus(`Błąd audio: ${e.message}`, 'error');
            isPlayingModel = false;
            if (playBtn && (attemptCount >= 3 || hasAnswered)) playBtn.disabled = false;
        }
    }

    async function startSinging() {
        if (isSinging) return;
        if (hasAnswered) {
            resetCurrentQuestionForRetry();
        }

        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        sungRootMidi = null;
        step1CooldownUntil = 0;
        waitingForStep1Onset = false;
        hasDetectedSilenceBeforeStep1 = false;

        const micBadge = document.getElementById('mic-status-badge');
        const singBtn = document.getElementById('sing-btn');
        const singText = document.getElementById('sing-btn-text');

        try {
            await KszaPitchDetector.start(onPitchDetected);
            isSinging = true;

            if (micBadge) {
                micBadge.className = 'mic-status-badge is-active';
                micBadge.textContent = '● Mikrofon aktywny';
            }
            if (singBtn) {
                singBtn.classList.add('btn-active');
            }
            if (singText) {
                singText.textContent = 'Zatrzymaj mikrofon';
            }

            updateHoldProgressBar(0);
            updateTaskStepUI(currentStep);
            renderScore(currentStep);
        } catch (e) {
            console.error('Błąd uruchamiania mikrofonu:', e);
            setStatus(e.message, 'error');
            stopSinging();
        }
    }

    function stopSinging() {
        if (!isSinging) return;
        isSinging = false;
        KszaPitchDetector.stop();

        const micBadge = document.getElementById('mic-status-badge');
        if (micBadge) {
            micBadge.className = 'mic-status-badge';
            micBadge.textContent = '○ Mikrofon wyłączony';
        }
        const singBtn = document.getElementById('sing-btn');
        if (singBtn) {
            singBtn.classList.remove('btn-active');
        }
        const singText = document.getElementById('sing-btn-text');
        if (singText) {
            if (hasAnswered) {
                singText.textContent = 'Zaśpiewaj ponownie';
            } else if (attemptCount > 1) {
                singText.textContent = `Rozpocznij próbę ${attemptCount} z ${MAX_ATTEMPTS}`;
            } else {
                singText.textContent = 'Zaśpiewaj interwał';
            }
        }

        updateHoldProgressBar(0);
        updateTunerUI(null);
        renderScore(currentStep);
    }

    function toggleSinging() {
        if (isSinging) {
            stopSinging();
        } else {
            startSinging();
        }
    }

    const getFilteredPitch = (pitch) => pitchFilter.push(pitch);

    function onPitchDetected(data) {
        const now = performance.now();
        const deltaMs = lastFrameTime ? Math.min(100, now - lastFrameTime) : 16;
        lastFrameTime = now;

        if (!isSinging || hasAnswered) return;

        // Śledzenie ciszy/przerwy oddechu
        if (!data || data.isSilent || !data.pitch || data.rms < 0.008) {
            holdDurationMs = Math.max(0, holdDurationMs - deltaMs * 2);
            updateHoldProgressBar((holdDurationMs / REQUIRED_HOLD_MS) * 100);
            updateTunerUI(null);

            if (currentStep === 1 && waitingForStep1Onset) {
                hasDetectedSilenceBeforeStep1 = true;
            }
            return;
        }

        const filteredPitch = getFilteredPitch(data.pitch);

        // -------------------------------------------------------------
        // KROK 1: Dźwięk wyjściowy (Pryma / Podstawa)
        // -------------------------------------------------------------
        if (currentStep === 0) {
            if (!voiceOnsetMs) {
                voiceOnsetMs = now;
            }

            // Klasyfikacja półtonowa (Semitone bucket)
            const isMatch = (filteredPitch.semitoneClass === rootSemitoneClass);
            updateTunerUI(data, isMatch);

            if (isMatch) {
                holdDurationMs += deltaMs;
                wrongNoteHoldMs = 0;
                const progressPct = Math.min(100, (holdDurationMs / REQUIRED_HOLD_MS) * 100);
                updateHoldProgressBar(progressPct);

                if (holdDurationMs >= REQUIRED_HOLD_MS) {
                    const timeToHit = now - voiceOnsetMs;
                    const isClean = timeToHit <= 750;
                    const quality = isClean ? 'clean' : 'adjusted';

                    noteResults[0] = quality;
                    sungRootMidi = filteredPitch.midi;
                    currentStep = 1;
                    
                    // Aktywacja okna ochronnego i wymogu nowego ataku:
                    step1CooldownUntil = now + 300;
                    waitingForStep1Onset = true;
                    hasDetectedSilenceBeforeStep1 = false;
                    voiceOnsetMs = null;
                    holdDurationMs = 0;
                    wrongNoteHoldMs = 0;
                    lastHeardSemitone = null;
                    pitchFilter.reset();

                    updateHoldProgressBar(0);
                    playSuccessChime();
                    updateTaskStepUI(1);
                    renderScore(1);
                }
            } else {
                holdDurationMs = Math.max(0, holdDurationMs - deltaMs * 1.5);
                updateHoldProgressBar((holdDurationMs / REQUIRED_HOLD_MS) * 100);
            }
            return;
        }

        // -------------------------------------------------------------
        // KROK 2: Dźwięk docelowy (Skok interwałowy)
        // -------------------------------------------------------------
        if (currentStep === 1) {
            if (now < step1CooldownUntil) {
                updateTunerUI(data, false);
                return;
            }

            // Wymóg rozdzielenia dźwięków oddechem lub zmianą wysokości
            if (waitingForStep1Onset) {
                const isDifferentPitch = sungRootMidi && Math.abs(filteredPitch.midi - sungRootMidi) >= 1;
                if (hasDetectedSilenceBeforeStep1 || isDifferentPitch) {
                    waitingForStep1Onset = false;
                    voiceOnsetMs = now;
                } else {
                    updateTunerUI(data, false);
                    return;
                }
            }

            if (!voiceOnsetMs) {
                voiceOnsetMs = now;
            }

            // 1. Klasyfikacja półtonowa dźwięku docelowego
            const isSemitoneMatch = (filteredPitch.semitoneClass === targetSemitoneClass);

            // 2. Weryfikacja kierunku rejestru (ochrona przed odwróceniem interwału)
            let isIntervalDirectionMatch = true;
            if (sungRootMidi) {
                if (currentSymbol === '8') {
                    isIntervalDirectionMatch = (direction === 1)
                        ? (filteredPitch.midi >= sungRootMidi + 10)
                        : (filteredPitch.midi <= sungRootMidi - 10);
                } else if (currentSymbol !== '1') {
                    isIntervalDirectionMatch = (direction === 1)
                        ? (filteredPitch.midi >= sungRootMidi - 1)
                        : (filteredPitch.midi <= sungRootMidi + 1);
                }
            }

            const isTargetMatch = isSemitoneMatch && isIntervalDirectionMatch;
            updateTunerUI(data, isTargetMatch);

            if (isTargetMatch) {
                holdDurationMs += deltaMs;
                wrongNoteHoldMs = 0;
                const progressPct = Math.min(100, (holdDurationMs / REQUIRED_HOLD_MS) * 100);
                updateHoldProgressBar(progressPct);

                if (holdDurationMs >= REQUIRED_HOLD_MS) {
                    const timeToHit = now - voiceOnsetMs;
                    const isClean = timeToHit <= 750;
                    const quality = isClean ? 'clean' : 'adjusted';

                    noteResults[1] = quality;
                    hasAnswered = true;
                    stopSinging();
                    updateHoldProgressBar(100);
                    updateModelButtonState();
                    handleSuccess();
                }
            } else {
                holdDurationMs = Math.max(0, holdDurationMs - deltaMs * 1.5);
                updateHoldProgressBar((holdDurationMs / REQUIRED_HOLD_MS) * 100);

                if (filteredPitch.semitoneClass === lastHeardSemitone) {
                    wrongNoteHoldMs += deltaMs;
                    if (wrongNoteHoldMs >= 320 && filteredPitch.semitoneClass !== rootSemitoneClass) {
                        handleStep2Mistake(filteredPitch);
                        wrongNoteHoldMs = 0;
                    }
                } else {
                    lastHeardSemitone = filteredPitch.semitoneClass;
                    wrongNoteHoldMs = deltaMs;
                }
            }
        }
    }

    function handleStep2Mistake(pitch) {
        if (hasAnswered) return;

        const semitoneDiff = direction === 1
            ? ((pitch.semitoneClass - rootSemitoneClass) % 12 + 12) % 12
            : ((rootSemitoneClass - pitch.semitoneClass) % 12 + 12) % 12;

        const heardName = SEMITONES_TO_INTERVAL_NAME[semitoneDiff] || 'Inny dźwięk';
        const targetSemitoneDiff = INTERVAL_DEFS[currentSymbol].semitones;

        let hintDir = '';
        if (direction === 1) {
            hintDir = semitoneDiff < targetSemitoneDiff ? 'zaśpiewaj wyżej 🔼' : 'zaśpiewaj niżej 🔽';
        } else {
            hintDir = semitoneDiff < targetSemitoneDiff ? 'zaśpiewaj niżej 🔽' : 'zaśpiewaj wyżej 🔼';
        }

        if (attemptCount < MAX_ATTEMPTS) {
            attemptCount++;
            stopSinging();
            updateModelButtonState();

            currentStep = 0;
            noteResults = [null, null];
            voiceOnsetMs = null;
            holdDurationMs = 0;
            lastHeardSemitone = null;
            wrongNoteHoldMs = 0;
            sungRootMidi = null;
            waitingForStep1Onset = false;
            hasDetectedSilenceBeforeStep1 = false;
            pitchFilter.reset();

            updateHoldProgressBar(0);
            updateTaskStepUI(0);
            renderScore(0);

            const feedback = document.getElementById('feedback');
            if (feedback) {
                feedback.className = 'feedback-msg feedback-warn';
                if (attemptCount === 3) {
                    feedback.innerHTML = `
                        Słyszę: <strong>${pitch.polishNoteName || pitch.noteName}</strong> (${heardName}) zamiast ${INTERVAL_DEFS[currentSymbol].label}. <strong>${hintDir}</strong>!<br>
                        <span style="color: var(--ink); font-weight: 600;">💡 Przed ostatnią (3.) próbą możesz kliknąć <strong>„Posłuchaj wzorca”</strong> na fortepianie!</span><br>
                        <small>Gdy będziesz gotowy, kliknij <em>„Rozpocznij próbę 3 z ${MAX_ATTEMPTS}”</em> lub wciśnij spację.</small>
                    `;
                } else {
                    feedback.innerHTML = `
                        Słyszę: <strong>${pitch.polishNoteName || pitch.noteName}</strong> (${heardName}) zamiast ${INTERVAL_DEFS[currentSymbol].label}. <strong>${hintDir}</strong>!<br>
                        <small>Kliknij <em>„Rozpocznij próbę ${attemptCount} z ${MAX_ATTEMPTS}”</em> lub wciśnij spację, gdy będziesz gotowy.</small>
                    `;
                }
            }

            const singText = document.getElementById('sing-btn-text');
            if (singText) {
                singText.textContent = `Rozpocznij próbę ${attemptCount} z ${MAX_ATTEMPTS}`;
            }

        } else {
            hasAnswered = true;
            noteResults[1] = 'wrong';
            stopSinging();
            updateHoldProgressBar(0);
            updateModelButtonState();
            handleMaxAttemptsFailed(pitch, heardName);
        }
    }

    function handleSuccess() {
        renderScore(1);

        const feedback = document.getElementById('feedback');
        const legend = document.getElementById('feedback-legend');
        if (legend) legend.style.display = 'flex';

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.style.display = 'inline-flex';
            nextBtn.focus();
        }

        const singText = document.getElementById('sing-btn-text');
        if (singText) {
            singText.textContent = 'Zaśpiewaj ponownie';
        }

        const rootAccidental = rootNote.alter === 1 ? '#' : rootNote.alter === -1 ? 'b' : '';
        const rootSolf = SOLMIZATION[rootNote.letter + rootAccidental] || SOLMIZATION[rootNote.letter] || '';
        const rootLabelStr = `${MT.noteLabel(rootNote)}${rootNote.octave}`;

        const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
        const targetSolf = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
        const targetLabelStr = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

        const isBothClean = noteResults[0] === 'clean' && noteResults[1] === 'clean';

        let headline = '';
        let headlineClass = 'var(--green)';

        if (attemptCount === 1) {
            if (isBothClean) {
                headline = '🎯 Perfekcyjny słuch wewnętrzny! Czysty atak obu dźwięków za 1. razem.';
            } else {
                headline = '⭐ Bardzo ładne wykonanie interwału za 1. razem (dźwięk dociągany).';
                headlineClass = 'var(--gold)';
            }
        } else if (attemptCount === 2) {
            headline = '👍 Świetna autokorekta! Właściwy interwał odnaleziony w 2. próbie.';
        } else {
            headline = '👍 Brawo! Właściwy interwał trafiony w 3. próbie.';
        }

        if (feedback) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.innerHTML = `
                <div style="font-size: 1.18rem; font-weight: 700; color: ${headlineClass}; margin-bottom: 3px;">${headline}</div>
                <div style="font-size: 0.92rem; color: var(--ink);">
                    1. dźwięk: <strong>${rootLabelStr}</strong> ${rootSolf ? `(${rootSolf})` : ''} &bull; 
                    2. dźwięk: <strong>${targetLabelStr}</strong> ${targetSolf ? `(${targetSolf})` : ''}
                </div>
            `;
        }
    }

    function handleMaxAttemptsFailed(pitch, heardName) {
        renderScore(1);

        const feedback = document.getElementById('feedback');
        const legend = document.getElementById('feedback-legend');
        if (legend) legend.style.display = 'flex';

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.style.display = 'inline-flex';
            nextBtn.focus();
        }

        const singText = document.getElementById('sing-btn-text');
        if (singText) {
            singText.textContent = 'Zaśpiewaj ponownie';
        }

        const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
        const targetSolf = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
        const targetLabelStr = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

        if (feedback) {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.innerHTML = `
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--coral); margin-bottom: 3px;">💡 Ten interwał sprawił trudność po 3 próbach.</div>
                <div style="font-size: 0.92rem; color: var(--ink); margin-bottom: 4px;">
                    Poprawny dźwięk docelowy to: <strong>${targetLabelStr}</strong> ${targetSolf ? `(${targetSolf})` : ''}.
                </div>
                <small style="color: var(--muted);">Włącz <em>„Posłuchaj wzorca”</em>, zaśpiewaj razem z fortepianem i przejdź do kolejnego zadania.</small>
            `;
        }
    }

    function setupEventListeners() {
        document.getElementById('ref-pitch-btn')?.addEventListener('click', playRootPitch);
        document.getElementById('sing-btn')?.addEventListener('click', toggleSinging);
        document.getElementById('play-model-btn')?.addEventListener('click', playModel);
        document.getElementById('next-btn')?.addEventListener('click', generateNewQuestion);

        document.getElementById('level-select')?.addEventListener('change', generateNewQuestion);
        document.getElementById('clef-select')?.addEventListener('change', generateNewQuestion);

        // Klawisze skrótów
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                toggleSinging();
            } else if (e.code === 'Enter' && hasAnswered) {
                e.preventDefault();
                generateNewQuestion();
            } else if (e.key === 'r' || e.key === 'R') {
                playRootPitch();
            } else if (e.key === 'p' || e.key === 'P') {
                if (attemptCount >= 3 || hasAnswered) playModel();
            }
        });
    }

    // Inicjalizacja modułu
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        generateNewQuestion();
    });
})();
