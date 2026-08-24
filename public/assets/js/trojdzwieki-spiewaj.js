(() => {
    const MT = KszaMusicTheory;

    const TRIAD_TYPES = {
        'durowy_z':    { shape: 'durowy',      inversion: 0, level: 1, label: 'Trójdźwięk durowy',                 symbol: '+' },
        'molowy_z':    { shape: 'molowy',      inversion: 0, level: 1, label: 'Trójdźwięk molowy',                 symbol: 'o' },
        'zmniejszony': { shape: 'zmniejszony', inversion: 0, level: 1, label: 'Trójdźwięk zmniejszony',             symbol: '>' },
        'zwiekszony':  { shape: 'zwiekszony',  inversion: 0, level: 1, label: 'Trójdźwięk zwiększony',              symbol: '<' },
        'durowy_3':    { shape: 'durowy',      inversion: 1, level: 2, label: 'Trójdźwięk durowy – sekstowy',     symbol: '+₃' },
        'durowy_5':    { shape: 'durowy',      inversion: 2, level: 2, label: 'Trójdźwięk durowy – kwartsekstowy', symbol: '+₅' },
        'molowy_3':    { shape: 'molowy',      inversion: 1, level: 2, label: 'Trójdźwięk molowy – sekstowy',     symbol: 'o₃' },
        'molowy_5':    { shape: 'molowy',      inversion: 2, level: 2, label: 'Trójdźwięk molowy – kwartsekstowy', symbol: 'o₅' }
    };

    const INVERSION_NAMES = {
        0: 'Postać zasadnicza',
        1: 'I przewrót (sekstowy)',
        2: 'II przewrót (kwartsekstowy)'
    };

    const SOLMIZATION = MT.SOLMIZATION;

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;
    const MAX_ATTEMPTS = 3;
    const REQUIRED_HOLD_MS = 220; // Czas stabilnego podtrzymania dźwięku

    let currentShape = 'durowy';
    let currentInversion = 0;
    let triadNotes = []; // 3 obiekty nut: [n0, n1, n2]
    let triadSemitoneClasses = []; // [c0, c1, c2]
    let clef = 'treble';

    // Stan prób i 3-etapowego śpiewania składników trójdźwięku:
    let attemptCount = 1; // 1..3
    let currentStep = 0;   // 0 (składnik 1) -> 1 (składnik 2) -> 2 (składnik 3)
    let noteResults = [null, null, null]; // 'clean' | 'adjusted' | 'wrong'

    let isSinging = false;
    let isPlayingModel = false;
    let hasAnswered = false;

    let voiceOnsetMs = null;
    let holdDurationMs = 0;
    let lastFrameTime = null;

    let lastHeardSemitone = null;
    let wrongNoteHoldMs = 0;

    // Filtr medianowy:
    const pitchFilter = new KszaUI.PitchMedianFilter(5);

    // Kontrola nowego ataku i okna ochronnego:
    let sungMidis = [null, null, null];
    let stepCooldownUntil = 0;
    let waitingForStepOnset = false;
    let hasDetectedSilenceBeforeStep = false;

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

    function buildMeasureMusicXML(clefType, notes, step, answered) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';

        const n0 = buildNoteXml(notes[0], false);
        const n1 = (step >= 1 || answered) ? buildNoteXml(notes[1], false) : buildNoteXml(notes[1], true);
        const n2 = (step >= 2 || answered) ? buildNoteXml(notes[2], false) : buildNoteXml(notes[2], true);

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Trójdźwięk</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>3</beats><beat-type>2</beat-type></time>${clefTag}</attributes>${n0}${n1}${n2}</measure></part></score-partwise>`;
    }

    function renderScore(step = currentStep) {
        if (!triadNotes || triadNotes.length < 3) return;
        try {
            const svg = KszaVerovio.render(buildMeasureMusicXML(clef, triadNotes, step, hasAnswered), {
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

                noteEls.forEach((el, idx) => {
                    el.classList.remove('note-current-target', 'note-feedback-correct', 'note-feedback-warn', 'note-feedback-wrong');
                    if (noteResults[idx] === 'clean') el.classList.add('note-feedback-correct');
                    else if (noteResults[idx] === 'adjusted') el.classList.add('note-feedback-warn');
                    else if (noteResults[idx] === 'wrong') el.classList.add('note-feedback-wrong');
                    else if (idx === step && isSinging) el.classList.add('note-current-target');
                });
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
            playBtn.title = 'Odsłuchaj pełny trójdźwięk na fortepianie';
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

    function isSimpleNote(note) {
        if (!note || Math.abs(note.alter) > 1) return false;
        if (note.letter === 'F' && note.alter === -1) return false; // Fes
        if (note.letter === 'C' && note.alter === -1) return false; // Ces
        if (note.letter === 'B' && note.alter === 1) return false;  // His
        if (note.letter === 'E' && note.alter === 1) return false;  // Eis
        return true;
    }

    function updateTaskStepUI(step) {
        const stepTag = document.getElementById('task-step-tag');
        const attemptTag = document.getElementById('task-attempt-tag');
        const feedback = document.getElementById('feedback');

        if (attemptTag) {
            attemptTag.textContent = `Próba ${attemptCount}/${MAX_ATTEMPTS}`;
        }

        if (stepTag && triadNotes.length >= 3) {
            const targetNote = triadNotes[step];
            const targetLabel = `${MT.noteLabel(targetNote)}${targetNote.octave}`;
            stepTag.textContent = `Krok ${step + 1}/3: Dźwięk ${step + 1} (${targetLabel})`;
        }

        if (feedback && !hasAnswered && triadNotes.length >= 3) {
            const targetNote = triadNotes[step];
            const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
            const targetSolf = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
            const targetLabel = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

            if (isSinging) {
                if (step === 0) {
                    feedback.innerHTML = `Śpiewaj 1. dźwięk: <strong>${targetLabel} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                } else if (step === 1) {
                    feedback.innerHTML = `🎯 Dźwięk 1 zaliczony! Weź oddech i zaśpiewaj 2. składnik: <strong>${targetLabel} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                } else {
                    feedback.innerHTML = `🎯 Dźwięk 2 zaliczony! Weź oddech i zaśpiewaj 3. składnik (górę): <strong>${targetLabel} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                }
                feedback.className = 'feedback-msg';
            }
        }
    }

    function resetCurrentQuestionForRetry() {
        hasAnswered = false;
        attemptCount = 1;
        currentStep = 0;
        noteResults = [null, null, null];
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        sungMidis = [null, null, null];
        stepCooldownUntil = 0;
        waitingForStepOnset = false;
        hasDetectedSilenceBeforeStep = false;

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
        noteResults = [null, null, null];
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        sungMidis = [null, null, null];
        stepCooldownUntil = 0;
        waitingForStepOnset = false;
        hasDetectedSilenceBeforeStep = false;

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
        if (singText) singText.textContent = 'Zaśpiewaj trójdźwięk';

        clef = pickClef();
        const level = currentLevel();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const pool = Object.keys(TRIAD_TYPES).filter((k) => level === '2' || TRIAD_TYPES[k].level === 1);
        const safeAlters = level === '1' ? [0] : [-1, 0, 1];

        let selectedType = null;
        for (let i = 0; i < 100; i++) {
            const candKey = pool[Math.floor(Math.random() * pool.length)];
            const candType = TRIAD_TYPES[candKey];
            const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
            const rootAlter = safeAlters[Math.floor(Math.random() * safeAlters.length)];
            const candRoot = { letter: rootLetter, alter: rootAlter, octave: rootOctave };

            if (!MT.isCleanNote(candRoot)) continue;

            const candidateNotes = MT.buildTriadNotes(candRoot, candType.shape, candType.inversion);
            if (MT.isCleanTriad(candidateNotes)) {
                selectedType = candType;
                triadNotes = candidateNotes;
                break;
            }
        }

        if (!selectedType) {
            selectedType = TRIAD_TYPES['durowy_z'];
            triadNotes = MT.buildTriadNotes({ letter: 'C', alter: 0, octave: rootOctave }, 'durowy', 0);
        }

        currentShape = selectedType.shape;
        currentInversion = selectedType.inversion;

        triadSemitoneClasses = triadNotes.map(n => ((MT.LETTER_NATURAL_OFFSET[n.letter] + n.alter) % 12 + 12) % 12);

        const baseNote = triadNotes[0];
        const baseAccidental = baseNote.alter === 1 ? '#' : baseNote.alter === -1 ? 'b' : '';
        const baseSolf = SOLMIZATION[baseNote.letter + baseAccidental] || SOLMIZATION[baseNote.letter] || '';
        const baseLabelText = `${MT.noteLabel(baseNote)}${baseNote.octave}`;

        // Aktualizacja karty zadania
        const badgeEl = document.getElementById('task-badge');
        if (badgeEl) badgeEl.textContent = selectedType.symbol;

        const invTag = document.getElementById('task-inversion-tag');
        if (invTag) invTag.textContent = INVERSION_NAMES[currentInversion];

        const rootTag = document.getElementById('task-root-tag');
        if (rootTag) {
            rootTag.innerHTML = `od: <strong>${baseLabelText} ${baseSolf ? `(${baseSolf})` : ''}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            titleEl.innerHTML = `Zaśpiewaj: <strong>${selectedType.label}</strong>`;
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
        if (!triadNotes || triadNotes.length === 0) return;
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tones = triadNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = adaptPitch(tones[0], shift);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
        } catch (e) {
            console.error('Błąd odtwarzania dźwięku:', e);
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!triadNotes || triadNotes.length < 3 || isPlayingModel) return;
        const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
        if (!ok || !KszaAudio.player) return;

        isPlayingModel = true;
        const playBtn = document.getElementById('play-model-btn');
        if (playBtn) playBtn.disabled = true;

        try {
            const tones = triadNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = tones.map(t => adaptPitch(t, shift));

            renderScore(2);
            const noteEls = document.querySelectorAll('#notation-container g.note');

            // Nuta 1
            if (noteEls[0]) noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === 0));
            KszaAudio.player.play(adapted[0], undefined, { duration: 0.6 });

            setTimeout(() => {
                // Nuta 2
                if (noteEls[1]) noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === 1));
                if (KszaAudio.player) KszaAudio.player.play(adapted[1], undefined, { duration: 0.6 });

                setTimeout(() => {
                    // Nuta 3
                    if (noteEls[2]) noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === 2));
                    if (KszaAudio.player) KszaAudio.player.play(adapted[2], undefined, { duration: 1.2 });

                    setTimeout(() => {
                        isPlayingModel = false;
                        if (playBtn && (attemptCount >= 3 || hasAnswered)) playBtn.disabled = false;
                        renderScore(currentStep);
                    }, 1200);
                }, 650);
            }, 650);
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
        sungMidis = [null, null, null];
        stepCooldownUntil = 0;
        waitingForStepOnset = false;
        hasDetectedSilenceBeforeStep = false;

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
                singText.textContent = 'Zaśpiewaj trójdźwięk';
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

        // Śledzenie ciszy/oddechu
        if (!data || data.isSilent || !data.pitch || data.rms < 0.008) {
            holdDurationMs = Math.max(0, holdDurationMs - deltaMs * 2);
            updateHoldProgressBar((holdDurationMs / REQUIRED_HOLD_MS) * 100);
            updateTunerUI(null);

            if (currentStep > 0 && waitingForStepOnset) {
                hasDetectedSilenceBeforeStep = true;
            }
            return;
        }

        const filteredPitch = getFilteredPitch(data.pitch);
        const targetClass = triadSemitoneClasses[currentStep];

        // -------------------------------------------------------------
        // KROK 1/3 (Dźwięk wyjściowy / podstawa)
        // -------------------------------------------------------------
        if (currentStep === 0) {
            if (!voiceOnsetMs) {
                voiceOnsetMs = now;
            }

            const isMatch = (filteredPitch.semitoneClass === targetClass);
            updateTunerUI(data, isMatch);

            if (isMatch) {
                holdDurationMs += deltaMs;
                wrongNoteHoldMs = 0;
                const progressPct = Math.min(100, (holdDurationMs / REQUIRED_HOLD_MS) * 100);
                updateHoldProgressBar(progressPct);

                if (holdDurationMs >= REQUIRED_HOLD_MS) {
                    const timeToHit = now - voiceOnsetMs;
                    const isClean = timeToHit <= 750;
                    noteResults[0] = isClean ? 'clean' : 'adjusted';
                    sungMidis[0] = filteredPitch.midi;

                    currentStep = 1;
                    stepCooldownUntil = now + 300;
                    waitingForStepOnset = true;
                    hasDetectedSilenceBeforeStep = false;
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
        // KROK 2/3 i 3/3 (Kolejne składniki trójdźwięku)
        // -------------------------------------------------------------
        if (currentStep === 1 || currentStep === 2) {
            if (now < stepCooldownUntil) {
                updateTunerUI(data, false);
                return;
            }

            const prevSungMidi = sungMidis[currentStep - 1];

            // Wymóg rozdzielenia dźwięków oddechem lub zmianą wysokości
            if (waitingForStepOnset) {
                const isDifferentPitch = prevSungMidi && Math.abs(filteredPitch.midi - prevSungMidi) >= 1;
                if (hasDetectedSilenceBeforeStep || isDifferentPitch) {
                    waitingForStepOnset = false;
                    voiceOnsetMs = now;
                } else {
                    updateTunerUI(data, false);
                    return;
                }
            }

            if (!voiceOnsetMs) {
                voiceOnsetMs = now;
            }

            // 1. Zgodność klasy półtonowej
            const isSemitoneMatch = (filteredPitch.semitoneClass === targetClass);

            // 2. Weryfikacja rejestru (kolejne składniki w górę)
            const isRegisterMatch = prevSungMidi ? (filteredPitch.midi >= prevSungMidi - 1) : true;

            const isTargetMatch = isSemitoneMatch && isRegisterMatch;
            updateTunerUI(data, isTargetMatch);

            if (isTargetMatch) {
                holdDurationMs += deltaMs;
                wrongNoteHoldMs = 0;
                const progressPct = Math.min(100, (holdDurationMs / REQUIRED_HOLD_MS) * 100);
                updateHoldProgressBar(progressPct);

                if (holdDurationMs >= REQUIRED_HOLD_MS) {
                    const timeToHit = now - voiceOnsetMs;
                    const isClean = timeToHit <= 750;
                    noteResults[currentStep] = isClean ? 'clean' : 'adjusted';
                    sungMidis[currentStep] = filteredPitch.midi;

                    if (currentStep === 1) {
                        // Przejście do kroku 3/3
                        currentStep = 2;
                        stepCooldownUntil = now + 300;
                        waitingForStepOnset = true;
                        hasDetectedSilenceBeforeStep = false;
                        voiceOnsetMs = null;
                        holdDurationMs = 0;
                        wrongNoteHoldMs = 0;
                        lastHeardSemitone = null;
                        pitchFilter.reset();

                        updateHoldProgressBar(0);
                        playSuccessChime();
                        updateTaskStepUI(2);
                        renderScore(2);
                    } else if (currentStep === 2) {
                        // Sukces całego trójdźwięku!
                        hasAnswered = true;
                        stopSinging();
                        updateHoldProgressBar(100);
                        updateModelButtonState();
                        handleSuccess();
                    }
                }
            } else {
                holdDurationMs = Math.max(0, holdDurationMs - deltaMs * 1.5);
                updateHoldProgressBar((holdDurationMs / REQUIRED_HOLD_MS) * 100);

                if (filteredPitch.semitoneClass === lastHeardSemitone) {
                    wrongNoteHoldMs += deltaMs;
                    // Błąd przy stabilnym śpiewaniu innego dźwięku (min. 320 ms)
                    if (wrongNoteHoldMs >= 320 && filteredPitch.semitoneClass !== triadSemitoneClasses[0]) {
                        handleMistake(filteredPitch, currentStep);
                        wrongNoteHoldMs = 0;
                    }
                } else {
                    lastHeardSemitone = filteredPitch.semitoneClass;
                    wrongNoteHoldMs = deltaMs;
                }
            }
        }
    }

    function handleMistake(pitch, step) {
        if (hasAnswered) return;

        const expectedNote = triadNotes[step];
        const expectedAcc = expectedNote.alter === 1 ? '#' : expectedNote.alter === -1 ? 'b' : '';
        const expectedSolf = SOLMIZATION[expectedNote.letter + expectedAcc] || SOLMIZATION[expectedNote.letter] || '';
        const expectedLabel = `${MT.noteLabel(expectedNote)}${expectedNote.octave}`;

        const heardName = pitch.polishNoteName || pitch.noteName;
        const heardSolf = SOLMIZATION[pitch.noteName] ? `(${SOLMIZATION[pitch.noteName]})` : '';

        if (attemptCount < MAX_ATTEMPTS) {
            attemptCount++;
            stopSinging();
            updateModelButtonState();

            currentStep = 0;
            noteResults = [null, null, null];
            voiceOnsetMs = null;
            holdDurationMs = 0;
            lastHeardSemitone = null;
            wrongNoteHoldMs = 0;
            sungMidis = [null, null, null];
            waitingForStepOnset = false;
            hasDetectedSilenceBeforeStep = false;
            pitchFilter.reset();

            updateHoldProgressBar(0);
            updateTaskStepUI(0);
            renderScore(0);

            const feedback = document.getElementById('feedback');
            if (feedback) {
                feedback.className = 'feedback-msg feedback-warn';
                if (attemptCount === 3) {
                    feedback.innerHTML = `
                        Słyszę: <strong>${heardName} ${heardSolf}</strong> zamiast składnika <strong>${expectedLabel} ${expectedSolf ? `(${expectedSolf})` : ''}</strong> w trójdźwięku.<br>
                        <span style="color: var(--ink); font-weight: 600;">💡 Przed ostatnią (3.) próbą możesz kliknąć <strong>„Posłuchaj wzorca”</strong> na fortepianie!</span><br>
                        <small>Gdy będziesz gotowy, kliknij <em>„Rozpocznij próbę 3 z ${MAX_ATTEMPTS}”</em> lub wciśnij spację.</small>
                    `;
                } else {
                    feedback.innerHTML = `
                        Słyszę: <strong>${heardName} ${heardSolf}</strong> zamiast składnika <strong>${expectedLabel} ${expectedSolf ? `(${expectedSolf})` : ''}</strong>.<br>
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
            noteResults[step] = 'wrong';
            stopSinging();
            updateHoldProgressBar(0);
            updateModelButtonState();
            handleMaxAttemptsFailed();
        }
    }

    function handleSuccess() {
        renderScore(2);

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

        const labels = triadNotes.map(n => {
            const acc = n.alter === 1 ? '#' : n.alter === -1 ? 'b' : '';
            const solf = SOLMIZATION[n.letter + acc] || SOLMIZATION[n.letter] || '';
            return `<strong>${MT.noteLabel(n)}${n.octave}</strong> ${solf ? `(${solf})` : ''}`;
        });

        const isAllClean = noteResults.every(r => r === 'clean');
        let headline = '';
        let headlineClass = 'var(--green)';

        if (attemptCount === 1) {
            if (isAllClean) {
                headline = `🎯 Perfekcyjny słuch! Czyste wykonanie trójdźwięku za 1. razem.`;
            } else {
                headline = `⭐ Bardzo ładne wykonanie trójdźwięku za 1. razem.`;
                headlineClass = 'var(--gold)';
            }
        } else if (attemptCount === 2) {
            headline = `👍 Świetna autokorekta! Trójdźwięk poprawnie zaśpiewany w 2. próbie.`;
        } else {
            headline = `👍 Brawo! Właściwe dźwięki akordu trafione w 3. próbie.`;
        }

        if (feedback) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.innerHTML = `
                <div style="font-size: 1.18rem; font-weight: 700; color: ${headlineClass}; margin-bottom: 3px;">${headline}</div>
                <div style="font-size: 0.92rem; color: var(--ink);">
                    Dźwięki akordu: ${labels.join(' &bull; ')}
                </div>
            `;
        }
    }

    function handleMaxAttemptsFailed() {
        renderScore(2);

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

        const labels = triadNotes.map(n => {
            const acc = n.alter === 1 ? '#' : n.alter === -1 ? 'b' : '';
            const solf = SOLMIZATION[n.letter + acc] || SOLMIZATION[n.letter] || '';
            return `<strong>${MT.noteLabel(n)}${n.octave}</strong> ${solf ? `(${solf})` : ''}`;
        });

        if (feedback) {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.innerHTML = `
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--coral); margin-bottom: 3px;">💡 Ten trójdźwięk sprawił trudność po 3 próbach.</div>
                <div style="font-size: 0.92rem; color: var(--ink); margin-bottom: 4px;">
                    Poprawne składniki akordu to: ${labels.join(' &bull; ')}.
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
