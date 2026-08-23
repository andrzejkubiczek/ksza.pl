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
    const SYMBOLS = Object.keys(INTERVAL_DEFS);

    const SOLMIZATION = {
        'C': 'do', 'C#': 'cis', 'Db': 'des',
        'D': 're', 'D#': 'dis', 'Eb': 'es',
        'E': 'mi',
        'F': 'fa', 'F#': 'fis', 'Gb': 'ges',
        'G': 'sol', 'G#': 'gis', 'Ab': 'as',
        'A': 'la', 'A#': 'ais', 'Bb': 'b',
        'B': 'si'
    };

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
    const TOLERANCE_CENTS = 40; // Spójna, sprawdzona tolerancja intonacji szkolnej

    let currentSymbol = null;
    let direction = 1;
    let rootNote = null;
    let targetNote = null;
    let targetSemitoneClass = 0;
    let rootSemitoneClass = 0;
    let clef = 'treble';

    let isSinging = false;
    let isPlayingModel = false;
    let hasAnswered = false;

    let voiceOnsetMs = null;
    let targetMatchCount = 0;
    let lastHeardSemitone = null;
    let otherNoteCount = 0;

    const currentLevel = () => document.getElementById('level-select')?.value || '1';
    const currentInstrument = () => document.getElementById('instrument-select')?.value || 'piano';

    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        if (el) {
            el.textContent = message || '';
            el.className = `status-line${type ? ` status-${type}` : ''}`;
        }
    }

    function onAudioState(state, message) {
        const playBtn = document.getElementById('play-model-btn');
        const refBtn = document.getElementById('ref-pitch-btn');
        if (playBtn) playBtn.disabled = state === 'loading';
        if (refBtn) refBtn.disabled = state === 'loading';

        if (state === 'error') setStatus(message, 'error');
        else if (state === 'loading') setStatus(message, null);
        else setStatus('', null);
    }

    function noteToToneName(note) {
        const accidental = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === 2 ? '##' : note.alter === -2 ? 'bb' : '';
        return `${note.letter}${accidental}${note.octave}`;
    }

    function getOctaveShift(tones) {
        if (!tones || typeof KszaInstrumentRange === 'undefined') return 0;
        return KszaInstrumentRange.fitOctaveShift(tones, currentInstrument());
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

    function buildMeasureMusicXML(clefType, note1, note2, isTargetRevealed) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        
        const note2Xml = isTargetRevealed
            ? buildNoteXml(note2, false)
            : buildNoteXml(note2, true);

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Interwał</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>${buildNoteXml(note1, false)}${note2Xml}</measure></part></score-partwise>`;
    }

    function renderScore(isTargetRevealed = false, resultClass = null) {
        try {
            const svg = KszaVerovio.render(buildMeasureMusicXML(clef, rootNote, targetNote, isTargetRevealed), {
                pageWidth: 900,
                pageHeight: 260,
                scale: 60,
                adjustPageHeight: true,
                breaks: 'none'
            });
            const container = document.getElementById('notation-container');
            if (container) {
                container.innerHTML = svg;
                if (isTargetRevealed && resultClass) {
                    const noteEls = container.querySelectorAll('g.note');
                    if (noteEls.length >= 2) {
                        const targetNoteEl = noteEls[1];
                        targetNoteEl.classList.remove('note-feedback-correct', 'note-feedback-warn', 'note-feedback-wrong');
                        targetNoteEl.classList.add(resultClass);
                    }
                }
            }
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus(`Błąd renderowania nut: ${e.message}`, 'error');
        }
    }

    function updateTunerUI(data) {
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
            return;
        }

        const p = data.pitch;
        const solf = SOLMIZATION[p.noteName] || '';
        const displayName = p.polishNoteName || p.noteName;
        if (tunerNote) tunerNote.textContent = displayName;
        if (tunerSolfege) tunerSolfege.textContent = solf ? `(${solf})` : '';

        const cents = p.cents;
        if (tunerStatus) {
            if (Math.abs(cents) <= 20) {
                tunerStatus.textContent = 'W punkt! 🎯';
                tunerStatus.className = 'tuner-status is-in-tune';
            } else if (cents < -20) {
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

    function pickClef() {
        const selected = document.getElementById('clef-select')?.value || 'random';
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }

    function pickRootAlter(letter, symbol, dir) {
        const safeAlters = [-1, 0, 1].filter((alter) => {
            const probe = { letter, alter, octave: TREBLE_ROOT_OCTAVE };
            const result = MT.spellByShape(probe, INTERVAL_DEFS[symbol], dir);
            return Math.abs(result.alter) <= 1;
        });
        return safeAlters.length ? safeAlters[Math.floor(Math.random() * safeAlters.length)] : 0;
    }

    async function generateNewQuestion() {
        stopSinging();
        hasAnswered = false;
        voiceOnsetMs = null;
        targetMatchCount = 0;
        lastHeardSemitone = null;
        otherNoteCount = 0;

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
        const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
        currentSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        direction = level === '2' && Math.random() < 0.5 ? -1 : 1;
        const rootAlter = level === '2' ? pickRootAlter(rootLetter, currentSymbol, direction) : 0;

        rootNote = { letter: rootLetter, alter: rootAlter, octave: rootOctave };
        targetNote = MT.spellByShape(rootNote, INTERVAL_DEFS[currentSymbol], direction);

        rootSemitoneClass = ((MT.LETTER_NATURAL_OFFSET[rootNote.letter] + rootNote.alter) % 12 + 12) % 12;
        targetSemitoneClass = ((MT.LETTER_NATURAL_OFFSET[targetNote.letter] + targetNote.alter) % 12 + 12) % 12;

        const rootAccidental = rootNote.alter === 1 ? '#' : rootNote.alter === -1 ? 'b' : '';
        const rootSolf = SOLMIZATION[rootNote.letter + rootAccidental] || SOLMIZATION[rootNote.letter] || '';
        const rootLabelText = `${MT.noteLabel(rootNote)}${rootNote.octave}`;

        // Aktualizacja nowej karty zadania
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
            rootTag.innerHTML = `od dźwięku: <strong>${rootLabelText} ${rootSolf ? `(${rootSolf})` : ''}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            titleEl.innerHTML = `Zaśpiewaj: <strong>${INTERVAL_DEFS[currentSymbol].label}</strong>`;
        }

        try {
            await KszaVerovio.ensureReady();
            renderScore(false);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
        }
    }

    async function playRootPitch() {
        if (!rootNote) return;
        try {
            const instSelect = document.getElementById('instrument-select');
            const ok = await KszaAudio.ensureReady(instSelect, onAudioState);
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
        const instSelect = document.getElementById('instrument-select');
        const ok = await KszaAudio.ensureReady(instSelect, onAudioState);
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

            KszaAudio.player.play(adaptedRoot, undefined, { duration: 0.8 });
            setTimeout(() => {
                if (KszaAudio.player) {
                    KszaAudio.player.play(adaptedTarget, undefined, { duration: 1.2 });
                }
                setTimeout(() => {
                    isPlayingModel = false;
                    if (playBtn) playBtn.disabled = false;
                }, 1300);
            }, 850);
        } catch (e) {
            console.error('Błąd odtwarzania wzorca:', e);
            setStatus(`Błąd audio: ${e.message}`, 'error');
            isPlayingModel = false;
            if (playBtn) playBtn.disabled = false;
        }
    }

    async function startSinging() {
        if (isSinging || hasAnswered) return;
        voiceOnsetMs = null;
        targetMatchCount = 0;
        lastHeardSemitone = null;
        otherNoteCount = 0;

        const micBadge = document.getElementById('mic-status-badge');
        const singBtn = document.getElementById('sing-btn');
        const singText = document.getElementById('sing-btn-text');

        try {
            await KszaPitchDetector.start(onPitchDetected);
            isSinging = true;

            if (micBadge) {
                micBadge.className = 'mic-status-badge is-active';
                micBadge.textContent = '● Mikrofon aktywny – zaśpiewaj dźwięk docelowy';
            }
            if (singBtn) {
                singBtn.classList.add('btn-active');
            }
            if (singText) {
                singText.textContent = 'Zatrzymaj mikrofon';
            }

            const feedback = document.getElementById('feedback');
            if (feedback && !hasAnswered) {
                feedback.textContent = 'Śpiewaj dźwięk docelowy...';
                feedback.className = 'feedback-msg';
            }
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
            singText.textContent = hasAnswered ? 'Zaśpiewaj ponownie' : 'Zaśpiewaj interwał';
        }

        updateTunerUI(null);
    }

    function toggleSinging() {
        if (isSinging) {
            stopSinging();
        } else {
            startSinging();
        }
    }

    function onPitchDetected(data) {
        updateTunerUI(data);

        if (!isSinging || hasAnswered) return;
        if (!data || data.isSilent || !data.pitch) {
            targetMatchCount = 0;
            return;
        }

        const pitch = data.pitch;
        const now = performance.now();

        if (!voiceOnsetMs) {
            voiceOnsetMs = now;
        }

        const isTargetMatch = (pitch.semitoneClass === targetSemitoneClass) && (Math.abs(pitch.cents) <= TOLERANCE_CENTS);

        if (isTargetMatch) {
            targetMatchCount++;
            // 2 kolejne klatki trafienia w dźwięk docelowy (ok. 50-80 ms stabilności)
            if (targetMatchCount >= 2) {
                const timeToHit = now - voiceOnsetMs;
                const isCleanAttack = timeToHit <= 650;
                handleSuccess(isCleanAttack);
            }
        } else {
            targetMatchCount = 0;

            // Live pomoc dydaktyczna przy intonowaniu innego dźwięku
            if (pitch.semitoneClass === lastHeardSemitone) {
                otherNoteCount++;
                if (otherNoteCount >= 6 && pitch.semitoneClass !== rootSemitoneClass) {
                    showHeardIntervalHint(pitch);
                    otherNoteCount = 0;
                }
            } else {
                lastHeardSemitone = pitch.semitoneClass;
                otherNoteCount = 1;
            }
        }
    }

    function showHeardIntervalHint(pitch) {
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

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.className = 'feedback-msg';
            feedback.innerHTML = `Słyszę: <strong>${pitch.polishNoteName || pitch.noteName}</strong> (${heardName}) &ndash; <strong>${hintDir}</strong>!`;
        }
    }

    function handleSuccess(isCleanAttack) {
        hasAnswered = true;
        stopSinging();

        const resultClass = isCleanAttack ? 'note-feedback-correct' : 'note-feedback-warn';
        renderScore(true, resultClass);

        const feedback = document.getElementById('feedback');
        const legend = document.getElementById('feedback-legend');
        if (legend) legend.style.display = 'flex';

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.style.display = 'inline-flex';
            nextBtn.focus();
        }

        const targetAccidental = targetNote.alter === 1 ? '#' : targetNote.alter === -1 ? 'b' : '';
        const solfStr = SOLMIZATION[targetNote.letter + targetAccidental] || SOLMIZATION[targetNote.letter] || '';
        const noteLabelStr = `${MT.noteLabel(targetNote)}${targetNote.octave}`;

        if (feedback) {
            feedback.className = 'feedback-msg feedback-correct';
            if (isCleanAttack) {
                feedback.innerHTML = `
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--green); margin-bottom: 2px;">🎯 Czysty atak w punkt!</div>
                    <div>Zaśpiewano prawidłowo: <strong>${noteLabelStr}</strong> ${solfStr ? `(${solfStr})` : ''}</div>
                `;
            } else {
                feedback.innerHTML = `
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--gold); margin-bottom: 2px;">⭐ Dźwięk dociągany</div>
                    <div>Zaśpiewano prawidłowo: <strong>${noteLabelStr}</strong> ${solfStr ? `(${solfStr})` : ''}</div>
                `;
            }
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
                playModel();
            }
        });
    }

    // Inicjalizacja modułu
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        generateNewQuestion();
    });
})();

