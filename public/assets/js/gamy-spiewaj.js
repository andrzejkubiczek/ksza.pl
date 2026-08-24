(() => {
    const MT = KszaMusicTheory;

    const SCALE_TYPES = {
        'durowa': {
            label: 'Gama durowa',
            shortName: 'durowa',
            isMinor: false,
            up: [0, 2, 4, 5, 7, 9, 11, 12],
            down: [12, 11, 9, 7, 5, 4, 2, 0]
        },
        'eolska': {
            label: 'Gama molowa naturalna (eolska)',
            shortName: 'molowa naturalna',
            isMinor: true,
            up: [0, 2, 3, 5, 7, 8, 10, 12],
            down: [12, 10, 8, 7, 5, 3, 2, 0]
        },
        'harmoniczna': {
            label: 'Gama molowa harmoniczna',
            shortName: 'molowa harmoniczna',
            isMinor: true,
            up: [0, 2, 3, 5, 7, 8, 11, 12],
            down: [12, 11, 8, 7, 5, 3, 2, 0]
        },
        'dorycka': {
            label: 'Gama molowa dorycka',
            shortName: 'molowa dorycka',
            isMinor: true,
            up: [0, 2, 3, 5, 7, 9, 11, 12],
            down: [12, 11, 9, 7, 5, 3, 2, 0]
        },
        'melodyczna': {
            label: 'Gama molowa melodyczna',
            shortName: 'molowa melodyczna',
            isMinor: true,
            up: [0, 2, 3, 5, 7, 9, 11, 12],
            down: [12, 10, 8, 7, 5, 3, 2, 0] // w dół naturalna (kasowniki)
        }
    };

    const LEVEL_1_MAJOR_TONICS = [
        { name: 'C-dur', letter: 'C', alter: 0, fifths: 0 },
        { name: 'G-dur', letter: 'G', alter: 0, fifths: 1 },
        { name: 'D-dur', letter: 'D', alter: 0, fifths: 2 },
        { name: 'F-dur', letter: 'F', alter: 0, fifths: -1 }
    ];

    const LEVEL_1_MINOR_TONICS = [
        { name: 'a-moll', letter: 'A', alter: 0, fifths: 0 },
        { name: 'e-moll', letter: 'E', alter: 0, fifths: 1 },
        { name: 'd-moll', letter: 'D', alter: 0, fifths: -1 },
        { name: 'h-moll', letter: 'B', alter: 0, fifths: 2 }
    ];

    const LEVEL_2_MAJOR_TONICS = [
        { name: 'C-dur', letter: 'C', alter: 0, fifths: 0 },
        { name: 'G-dur', letter: 'G', alter: 0, fifths: 1 },
        { name: 'D-dur', letter: 'D', alter: 0, fifths: 2 },
        { name: 'A-dur', letter: 'A', alter: 0, fifths: 3 },
        { name: 'E-dur', letter: 'E', alter: 0, fifths: 4 },
        { name: 'F-dur', letter: 'F', alter: 0, fifths: -1 },
        { name: 'B-dur', letter: 'B', alter: -1, fifths: -2 },
        { name: 'Es-dur', letter: 'E', alter: -1, fifths: -3 },
        { name: 'As-dur', letter: 'A', alter: -1, fifths: -4 }
    ];

    const LEVEL_2_MINOR_TONICS = [
        { name: 'a-moll', letter: 'A', alter: 0, fifths: 0 },
        { name: 'e-moll', letter: 'E', alter: 0, fifths: 1 },
        { name: 'h-moll', letter: 'B', alter: 0, fifths: 2 },
        { name: 'fis-moll', letter: 'F', alter: 1, fifths: 3 },
        { name: 'cis-moll', letter: 'C', alter: 1, fifths: 4 },
        { name: 'd-moll', letter: 'D', alter: 0, fifths: -1 },
        { name: 'g-moll', letter: 'G', alter: 0, fifths: -2 },
        { name: 'c-moll', letter: 'C', alter: 0, fifths: -3 },
        { name: 'f-moll', letter: 'F', alter: 0, fifths: -4 }
    ];

    const SOLMIZATION = MT.SOLMIZATION;

    const DEGREE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;
    const MAX_ATTEMPTS = 3;
    const REQUIRED_HOLD_MS = 170; // Płynne tempo śpiewania gamy

    let currentScaleKey = 'durowa';
    let currentTonic = null;
    let currentDirection = 'up'; // 'up' | 'down' | 'up-down'
    let scaleNotes = []; // Tablica obiektów nut: [{ letter, alter, octave }, ...]
    let scaleSemitoneClasses = []; // Klasy półtonowe modulo 12
    let clef = 'treble';

    // Stan prób i etapowego śpiewu:
    let attemptCount = 1; // 1..3
    let currentStep = 0;   // 0..N-1
    let noteResults = [];  // Tablica wyników dla każdej nuty

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
    let lastSungMidi = null;
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

    function playSuccessChime(isFinal = false) {
        try {
            const ctx = KszaAudio.context;
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';

            if (isFinal) {
                // Fanfara końcowa
                osc.frequency.setValueAtTime(880, t); // A5
                osc.frequency.exponentialRampToValueAtTime(1760, t + 0.20); // A6
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.30);
            } else {
                // Subtelny klik zaliczenia nuty
                osc.frequency.setValueAtTime(987.77, t); // H5
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.09);
            }
        } catch (e) {}
    }

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

    function getKeySignatureAlter(letter, fifths) {
        if (fifths > 0) {
            return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
        } else if (fifths < 0) {
            return FLAT_ORDER.slice(0, Math.abs(fifths)).includes(letter) ? -1 : 0;
        }
        return 0;
    }

    function getScaleNoteXml(note, fifths) {
        const defaultAlter = getKeySignatureAlter(note.letter, fifths);
        let accidentalTag = '';
        if (note.alter !== defaultAlter) {
            const accName = { '-2': 'flat-flat', '-1': 'flat', '0': 'natural', '1': 'sharp', '2': 'double-sharp' }[String(note.alter)] || 'natural';
            accidentalTag = `<accidental>${accName}</accidental>`;
        }
        const alterTag = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
        return `<note><pitch><step>${note.letter}</step>${alterTag}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type>${accidentalTag}</note>`;
    }

    function buildScaleMusicXML(clefType, notes, fifths = 0) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';

        // Dzielimy nuty na takty po 4 ćwierćnuty (4/4)
        const measures = [];
        const numMeasures = Math.ceil(notes.length / 4);

        for (let m = 0; m < numMeasures; m++) {
            const chunk = notes.slice(m * 4, m * 4 + 4);
            const notesXml = chunk.map(n => getScaleNoteXml(n, fifths)).join('');
            const attrXml = (m === 0)
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>`
                : '';
            measures.push(`<measure number="${m + 1}">${attrXml}${notesXml}</measure>`);
        }

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Gama</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
    }

    function renderScore(step = currentStep) {
        if (!scaleNotes || scaleNotes.length === 0) return;
        const fifths = currentTonic ? (currentTonic.fifths || 0) : 0;
        try {
            const svg = KszaVerovio.render(buildScaleMusicXML(clef, scaleNotes, fifths), {
                pageWidth: scaleNotes.length > 8 ? 1200 : 900,
                pageHeight: 280,
                scale: scaleNotes.length > 8 ? 50 : 60,
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
                tunerStatus.textContent = isSinging ? 'Śpiewaj gamę...' : 'Mikrofon wyłączony';
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
                tunerStatus.textContent = 'Trzymaj stopień... 🎯';
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
            playBtn.title = 'Odsłuchaj całą gamę na fortepianie';
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

    function pickDirection() {
        const selected = document.getElementById('direction-select')?.value || 'random';
        if (selected === 'random') {
            const level = currentLevel();
            const opts = level === '1' ? ['up', 'down'] : ['up', 'down', 'up-down'];
            return opts[Math.floor(Math.random() * opts.length)];
        }
        return selected;
    }

    /**
     * Buduje pełną sekwencję nut gamy na podstawie toniki i kierunku
     */
    function buildScaleNotesSequence(tonicNote, scaleType, direction) {
        const startAbs = MT.absoluteSemitone(tonicNote);
        const startIdx = MT.diatonicIndexOf(tonicNote.letter, tonicNote.octave);

        const upNotes = scaleType.up.map((st, i) => {
            const target = MT.ladderEntry(startIdx + i);
            return {
                letter: target.letter,
                alter: (startAbs + st) - target.naturalSemitone,
                octave: target.octave
            };
        });

        if (direction === 'up') {
            return upNotes;
        }

        const downOffsets = scaleType.down;
        const downNotes = downOffsets.map((st, i) => {
            const target = MT.ladderEntry(startIdx + 7 - i);
            return {
                letter: target.letter,
                alter: (startAbs + st) - target.naturalSemitone,
                octave: target.octave
            };
        });

        if (direction === 'down') {
            return downNotes;
        }

        // up-down: 16 dźwięków (I do VIII w górę, powtórzenie szczytowego dźwięku VIII, a potem VII do I w dół)
        return upNotes.concat(downNotes);
    }

    function updateTaskStepUI(step) {
        const stepTag = document.getElementById('task-step-tag');
        const attemptTag = document.getElementById('task-attempt-tag');
        const feedback = document.getElementById('feedback');

        if (attemptTag) {
            attemptTag.textContent = `Próba ${attemptCount}/${MAX_ATTEMPTS}`;
        }

        if (stepTag && scaleNotes.length > step) {
            const targetNote = scaleNotes[step];
            const targetLabel = `${MT.noteLabel(targetNote)}${targetNote.octave}`;
            stepTag.textContent = `Krok ${step + 1}/${scaleNotes.length}: Dźwięk ${step + 1} (${targetLabel})`;
        }

        if (feedback && !hasAnswered && scaleNotes.length > step) {
            const targetNote = scaleNotes[step];
            const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
            const targetSolf = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
            const targetLabel = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

            if (isSinging) {
                if (step === 0) {
                    feedback.innerHTML = `Śpiewaj 1. dźwięk: <strong>${targetLabel} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                } else {
                    feedback.innerHTML = `🎯 Śpiewaj kolejny stopień: <strong>${targetLabel} ${targetSolf ? `(${targetSolf})` : ''}</strong>...`;
                }
                feedback.className = 'feedback-msg';
            }
        }
    }

    function resetCurrentQuestionForRetry() {
        hasAnswered = false;
        attemptCount = 1;
        currentStep = 0;
        noteResults = new Array(scaleNotes.length).fill(null);
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        lastSungMidi = null;
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
        voiceOnsetMs = null;
        holdDurationMs = 0;
        lastFrameTime = null;
        lastHeardSemitone = null;
        wrongNoteHoldMs = 0;
        pitchFilter.reset();
        lastSungMidi = null;
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
        if (singText) singText.textContent = 'Zaśpiewaj gamę';

        clef = pickClef();
        const level = currentLevel();
        currentDirection = pickDirection();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;

        const scalePool = (level === '1')
            ? ['durowa', 'eolska', 'harmoniczna']
            : ['durowa', 'eolska', 'harmoniczna', 'dorycka', 'melodyczna'];

        let selectedScaleKey = null;
        let selectedTonic = null;
        let candidateNotes = null;

        for (let i = 0; i < 100; i++) {
            selectedScaleKey = scalePool[Math.floor(Math.random() * scalePool.length)];
            const scaleDef = SCALE_TYPES[selectedScaleKey];

            const tonicPool = scaleDef.isMinor
                ? (level === '1' ? LEVEL_1_MINOR_TONICS : LEVEL_2_MINOR_TONICS)
                : (level === '1' ? LEVEL_1_MAJOR_TONICS : LEVEL_2_MAJOR_TONICS);

            selectedTonic = tonicPool[Math.floor(Math.random() * tonicPool.length)];
            const candTonicNote = { letter: selectedTonic.letter, alter: selectedTonic.alter, octave: rootOctave };

            if (!MT.isCleanNote(candTonicNote)) continue;

            const seq = buildScaleNotesSequence(candTonicNote, scaleDef, currentDirection);
            if (seq.every(MT.isCleanNote)) {
                candidateNotes = seq;
                break;
            }
        }

        if (!candidateNotes) {
            selectedScaleKey = 'durowa';
            selectedTonic = LEVEL_1_MAJOR_TONICS[0];
            candidateNotes = buildScaleNotesSequence({ letter: 'C', alter: 0, octave: rootOctave }, SCALE_TYPES['durowa'], 'up');
            currentDirection = 'up';
        }

        currentScaleKey = selectedScaleKey;
        currentTonic = selectedTonic;
        scaleNotes = candidateNotes;
        noteResults = new Array(scaleNotes.length).fill(null);
        scaleSemitoneClasses = scaleNotes.map(n => ((MT.LETTER_NATURAL_OFFSET[n.letter] + n.alter) % 12 + 12) % 12);

        // Aktualizacja karty zadania
        const badgeEl = document.getElementById('task-badge');
        if (badgeEl) badgeEl.textContent = currentTonic.name[0];

        const dirTag = document.getElementById('task-direction-tag');
        if (dirTag) {
            if (currentDirection === 'up') {
                dirTag.className = 'sing-tag tag-direction-up';
                dirTag.textContent = 'w górę ↑';
            } else if (currentDirection === 'down') {
                dirTag.className = 'sing-tag tag-direction-down';
                dirTag.textContent = 'w dół ↓';
            } else {
                dirTag.className = 'sing-tag tag-direction-up';
                dirTag.textContent = 'w górę i w dół ⇅';
            }
        }

        const rootTag = document.getElementById('task-root-tag');
        if (rootTag) {
            rootTag.innerHTML = `Tonacja: <strong>${currentTonic.name}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            const scaleDef = SCALE_TYPES[currentScaleKey];
            titleEl.innerHTML = `Zaśpiewaj: <strong>Gama ${currentTonic.name} (${scaleDef.shortName})</strong>`;
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
        if (!scaleNotes || scaleNotes.length === 0) return;
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tone = noteToToneName(scaleNotes[0]);
            const shift = getOctaveShift([tone]);
            const adapted = adaptPitch(tone, shift);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
        } catch (e) {
            console.error('Błąd odtwarzania dźwięku:', e);
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!scaleNotes || scaleNotes.length === 0 || isPlayingModel) return;
        const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
        if (!ok || !KszaAudio.player) return;

        isPlayingModel = true;
        const playBtn = document.getElementById('play-model-btn');
        if (playBtn) playBtn.disabled = true;

        try {
            const tones = scaleNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = tones.map(t => adaptPitch(t, shift));

            renderScore(scaleNotes.length - 1);
            const noteEls = document.querySelectorAll('#notation-container g.note');

            let idx = 0;
            function playNext() {
                if (idx >= adapted.length) {
                    isPlayingModel = false;
                    if (playBtn && (attemptCount >= 3 || hasAnswered)) playBtn.disabled = false;
                    renderScore(currentStep);
                    return;
                }

                noteEls.forEach((g, i) => g.classList.toggle('note-current-target', i === idx));
                if (KszaAudio.player) {
                    const dur = (idx === adapted.length - 1) ? 1.0 : 0.42;
                    KszaAudio.player.play(adapted[idx], undefined, { duration: dur });
                }

                idx++;
                setTimeout(playNext, 460);
            }

            playNext();
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
        lastSungMidi = null;
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
                singText.textContent = 'Zaśpiewaj gamę';
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
        const targetClass = scaleSemitoneClasses[currentStep];

        if (now < stepCooldownUntil) {
            updateTunerUI(data, false);
            return;
        }

        // Wymóg rozdzielenia dźwięków oddechem lub zmianą wysokości dla kolejnych kroków
        if (currentStep > 0 && waitingForStepOnset) {
            const isDifferentPitch = lastSungMidi && Math.abs(filteredPitch.midi - lastSungMidi) >= 1;
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
        updateTunerUI(data, isSemitoneMatch);

        if (isSemitoneMatch) {
            holdDurationMs += deltaMs;
            wrongNoteHoldMs = 0;
            const progressPct = Math.min(100, (holdDurationMs / REQUIRED_HOLD_MS) * 100);
            updateHoldProgressBar(progressPct);

            if (holdDurationMs >= REQUIRED_HOLD_MS) {
                const timeToHit = now - voiceOnsetMs;
                const isClean = timeToHit <= 600;
                noteResults[currentStep] = isClean ? 'clean' : 'adjusted';
                lastSungMidi = filteredPitch.midi;

                const isFinal = (currentStep === scaleNotes.length - 1);
                playSuccessChime(isFinal);

                if (!isFinal) {
                    // Przejście do kolejnego stopnia
                    currentStep++;
                    stepCooldownUntil = now + 180;
                    waitingForStepOnset = true;
                    hasDetectedSilenceBeforeStep = false;
                    voiceOnsetMs = null;
                    holdDurationMs = 0;
                    wrongNoteHoldMs = 0;
                    lastHeardSemitone = null;
                    pitchFilter.reset();

                    updateHoldProgressBar(0);
                    updateTaskStepUI(currentStep);
                    renderScore(currentStep);
                } else {
                    // Sukces całej gamy!
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
                // Błąd przy stabilnym śpiewaniu innego dźwięku przez min. 300 ms
                if (wrongNoteHoldMs >= 300) {
                    handleMistake(filteredPitch, currentStep);
                    wrongNoteHoldMs = 0;
                }
            } else {
                lastHeardSemitone = filteredPitch.semitoneClass;
                wrongNoteHoldMs = deltaMs;
            }
        }
    }

    function handleMistake(pitch, step) {
        if (hasAnswered) return;

        const expectedNote = scaleNotes[step];
        const expectedAcc = expectedNote.alter === 1 ? '#' : expectedNote.alter === -1 ? 'b' : '';
        const expectedSolf = SOLMIZATION[expectedNote.letter + expectedAcc] || SOLMIZATION[expectedNote.letter] || '';
        const expectedLabel = `${MT.noteLabel(expectedNote)}${expectedNote.octave}`;

        const heardName = pitch.polishNoteName || pitch.noteName;
        const heardSolf = SOLMIZATION[pitch.noteName] ? `(${SOLMIZATION[pitch.noteName]})` : '';

        // Wskazówka metodyczna dla odmian gam:
        let pedagogicalHint = '';
        if (currentScaleKey === 'harmoniczna' && (step === 6 || step === 1)) {
            pedagogicalHint = ' (VII stopień w gamie molowej harmonicznej jest podwyższony o półton!)';
        } else if (currentScaleKey === 'dorycka' && (step === 5 || step === 6)) {
            pedagogicalHint = ' (W gamie molowej doryckiej VI i VII stopień są podwyższone!)';
        } else if (currentScaleKey === 'melodyczna') {
            pedagogicalHint = ' (W gamie molowej melodycznej podwyższamy VI i VII w górę, a kasujemy w dół!)';
        }

        if (attemptCount < MAX_ATTEMPTS) {
            attemptCount++;
            stopSinging();
            updateModelButtonState();

            currentStep = 0;
            noteResults = new Array(scaleNotes.length).fill(null);
            voiceOnsetMs = null;
            holdDurationMs = 0;
            lastHeardSemitone = null;
            wrongNoteHoldMs = 0;
            lastSungMidi = null;
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
                        Słyszę: <strong>${heardName} ${heardSolf}</strong> zamiast stopnia <strong>${expectedLabel} ${expectedSolf ? `(${expectedSolf})` : ''}</strong>${pedagogicalHint}.<br>
                        <span style="color: var(--ink); font-weight: 600;">💡 Przed ostatnią (3.) próbą możesz kliknąć <strong>„Posłuchaj wzorca”</strong> na fortepianie!</span><br>
                        <small>Gdy będziesz gotowy, kliknij <em>„Rozpocznij próbę 3 z ${MAX_ATTEMPTS}”</em> lub wciśnij spację.</small>
                    `;
                } else {
                    feedback.innerHTML = `
                        Słyszę: <strong>${heardName} ${heardSolf}</strong> zamiast stopnia <strong>${expectedLabel} ${expectedSolf ? `(${expectedSolf})` : ''}</strong>${pedagogicalHint}.<br>
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
        renderScore(scaleNotes.length - 1);

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

        const isAllClean = noteResults.every(r => r === 'clean');
        let headline = '';
        let headlineClass = 'var(--green)';

        if (attemptCount === 1) {
            if (isAllClean) {
                headline = `🎯 Perfekcyjny słuch i intonacja! Cała gama zaśpiewana czysto za 1. razem.`;
            } else {
                headline = `⭐ Bardzo ładne wykonanie gamy za 1. razem.`;
                headlineClass = 'var(--gold)';
            }
        } else if (attemptCount === 2) {
            headline = `👍 Świetna autokorekta! Gama poprawnie zaśpiewana w 2. próbie.`;
        } else {
            headline = `👍 Brawo! Właściwe dźwięki gamy odnalezione w 3. próbie.`;
        }

        const scaleDef = SCALE_TYPES[currentScaleKey];

        if (feedback) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.innerHTML = `
                <div style="font-size: 1.18rem; font-weight: 700; color: ${headlineClass}; margin-bottom: 3px;">${headline}</div>
                <div style="font-size: 0.92rem; color: var(--ink);">
                    Gama: <strong>${currentTonic.name}</strong> (${scaleDef.label}) &bull; ${scaleNotes.length} dźwięków
                </div>
            `;
        }
    }

    function handleMaxAttemptsFailed() {
        renderScore(scaleNotes.length - 1);

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

        const scaleDef = SCALE_TYPES[currentScaleKey];

        if (feedback) {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.innerHTML = `
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--coral); margin-bottom: 3px;">💡 Ta gama sprawiła trudność po 3 próbach.</div>
                <div style="font-size: 0.92rem; color: var(--ink); margin-bottom: 4px;">
                    Gama: <strong>${currentTonic.name}</strong> (${scaleDef.label}).
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
        document.getElementById('direction-select')?.addEventListener('change', generateNewQuestion);
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
