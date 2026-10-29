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
    const SOLMIZATION = MT.SOLMIZATION;
    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;

    let currentSymbol = null;
    let direction = 1;
    let rootNote = null;
    let targetNote = null;
    let clef = 'treble';
    let isRevealed = false;
    let isPlayingModel = false;
    let playTimers = [];

    const currentLevel = () => document.getElementById('level-select')?.value || '1';
    const setStatus = (msg, type) => KszaUI.setStatus(msg, type);

    function clearPlayTimers() {
        playTimers.forEach((id) => clearTimeout(id));
        playTimers = [];
        isPlayingModel = false;
        const playBtn = document.getElementById('play-model-btn');
        if (playBtn) playBtn.disabled = false;
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
        return KszaInstrumentRange.fitOctaveShift(tones, 'piano');
    }

    function adaptPitch(pitch, shift = 0) {
        if (!pitch || typeof KszaInstrumentRange === 'undefined') return pitch;
        return shift !== 0 ? KszaInstrumentRange.transposeNoteName(pitch, shift) : pitch;
    }

    function formatNoteWithSolfege(note) {
        const acc = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : '';
        const solf = SOLMIZATION[note.letter + acc] || SOLMIZATION[note.letter] || '';
        const label = `${MT.noteLabel(note)}${note.octave}`;
        return solf ? `${label} (${solf})` : label;
    }

    function buildNoteXml(note, isGhost = false) {
        if (isGhost) {
            return `<note><rest/><duration>2</duration><type>half</type></note>`;
        }
        return `<note>${MT.noteToPitchXml(note)}<duration>2</duration><type>half</type>${MT.accidentalTag(note)}</note>`;
    }

    function buildMeasureMusicXML(clefType, note1, note2, revealed) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';

        const note2Xml = revealed ? buildNoteXml(note2, false) : buildNoteXml(note2, true);

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Interwał</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>${buildNoteXml(note1, false)}${note2Xml}</measure></part></score-partwise>`;
    }

    function renderScore(revealed = isRevealed) {
        if (!rootNote || !targetNote) return;
        try {
            const svg = KszaVerovio.render(buildMeasureMusicXML(clef, rootNote, targetNote, revealed), {
                pageWidth: 900,
                pageHeight: 260,
                scale: 60,
                adjustPageHeight: true,
                breaks: 'none'
            });
            const container = document.getElementById('notation-container');
            if (container) {
                container.innerHTML = svg;
                if (revealed) {
                    const noteEls = container.querySelectorAll('g.note');
                    if (noteEls[1]) noteEls[1].classList.add('note-feedback-correct');
                }
            }
            setStatus('', null);
        } catch (e) {
            setStatus(`Błąd renderowania nut: ${e.message}`, 'error');
        }
    }

    function highlightStaffNote(index) {
        const noteEls = document.querySelectorAll('#notation-container g.note');
        noteEls.forEach((g, i) => {
            g.classList.toggle('note-current-target', i === index);
        });
    }

    function pickClef() {
        const selected = document.getElementById('clef-select')?.value || 'random';
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }

    function isSimpleNote(note) {
        if (!note || Math.abs(note.alter) > 1) return false;
        if (note.letter === 'F' && note.alter === -1) return false;
        if (note.letter === 'C' && note.alter === -1) return false;
        if (note.letter === 'B' && note.alter === 1) return false;
        if (note.letter === 'E' && note.alter === 1) return false;
        return true;
    }

    function getActiveSymbolsPool() {
        if (window.KszaIntervalFilter) {
            const active = KszaIntervalFilter.getActiveSymbols();
            const filtered = SYMBOLS.filter((s) => active.includes(s));
            if (filtered.length >= 2) return filtered;
        }
        return SYMBOLS;
    }

    async function generateNewQuestion() {
        clearPlayTimers();
        KszaAudio.stopAll();
        isRevealed = false;

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }

        const playText = document.getElementById('play-model-text');
        if (playText) playText.textContent = 'Sprawdź z fortepianem';

        clef = pickClef();
        const level = currentLevel();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const pool = getActiveSymbolsPool();
        const safeAlters = level === '1' ? [0] : [-1, 0, 1];

        for (let i = 0; i < 100; i++) {
            const candSymbol = pool[Math.floor(Math.random() * pool.length)];
            const candDir = level === '1' || candSymbol === '1' ? 1 : (Math.random() < 0.5 ? 1 : -1);
            const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
            const rootAlter = safeAlters[Math.floor(Math.random() * safeAlters.length)];
            const candRoot = { letter: rootLetter, alter: rootAlter, octave: rootOctave };

            if (!isSimpleNote(candRoot)) continue;

            const candTarget = MT.spellByShape(candRoot, INTERVAL_DEFS[candSymbol], candDir);
            if (isSimpleNote(candTarget)) {
                currentSymbol = candSymbol;
                direction = candDir;
                rootNote = candRoot;
                targetNote = candTarget;
                break;
            }
        }

        if (!rootNote || !targetNote) {
            currentSymbol = pool[0] || '5';
            direction = 1;
            rootNote = { letter: 'C', alter: 0, octave: rootOctave };
            targetNote = MT.spellByShape(rootNote, INTERVAL_DEFS[currentSymbol], direction);
        }

        const badgeEl = document.getElementById('task-badge');
        if (badgeEl) {
            badgeEl.textContent = currentSymbol === '4<' ? '4</5>' : currentSymbol;
        }

        const dirTag = document.getElementById('task-direction-tag');
        if (dirTag) {
            if (currentSymbol === '1') {
                dirTag.className = 'sing-tag tag-direction-up';
                dirTag.textContent = 'ten sam dźwięk';
            } else if (direction === 1) {
                dirTag.className = 'sing-tag tag-direction-up';
                dirTag.textContent = 'w górę ↑';
            } else {
                dirTag.className = 'sing-tag tag-direction-down';
                dirTag.textContent = 'w dół ↓';
            }
        }

        const rootTag = document.getElementById('task-root-tag');
        if (rootTag) {
            rootTag.innerHTML = `od: <strong>${formatNoteWithSolfege(rootNote)}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            titleEl.innerHTML = `Zaśpiewaj: <strong>${INTERVAL_DEFS[currentSymbol].label}</strong>`;
        }

        try {
            await KszaVerovio.ensureReady();
            renderScore(false);
        } catch (e) {
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
        }
    }

    async function playRootPitch() {
        if (!rootNote) return;
        clearPlayTimers();
        KszaAudio.stopAll();
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tone = noteToToneName(rootNote);
            const shift = getOctaveShift([tone, noteToToneName(targetNote)]);
            const adapted = adaptPitch(tone, shift);

            highlightStaffNote(0);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
            playTimers.push(setTimeout(() => highlightStaffNote(-1), 1100));
        } catch (e) {
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!rootNote || !targetNote || isPlayingModel) return;
        clearPlayTimers();
        KszaAudio.stopAll();

        const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
        if (!ok || !KszaAudio.player) return;

        isPlayingModel = true;
        isRevealed = true;
        const playBtn = document.getElementById('play-model-btn');
        if (playBtn) playBtn.disabled = true;

        const playText = document.getElementById('play-model-text');
        if (playText) playText.textContent = 'Odtwórz ponownie';

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.innerHTML = `Dźwięki: <strong>${formatNoteWithSolfege(rootNote)}</strong> → <strong>${formatNoteWithSolfege(targetNote)}</strong>`;
        }

        try {
            const rootTone = noteToToneName(rootNote);
            const targetTone = noteToToneName(targetNote);
            const shift = getOctaveShift([rootTone, targetTone]);

            const adaptedRoot = adaptPitch(rootTone, shift);
            const adaptedTarget = adaptPitch(targetTone, shift);

            renderScore(true);
            highlightStaffNote(0);
            KszaAudio.player.play(adaptedRoot, undefined, { duration: 0.85 });

            playTimers.push(setTimeout(() => {
                highlightStaffNote(1);
                if (KszaAudio.player) {
                    KszaAudio.player.play(adaptedTarget, undefined, { duration: 1.2 });
                }

                playTimers.push(setTimeout(() => {
                    isPlayingModel = false;
                    if (playBtn) playBtn.disabled = false;
                    renderScore(true);
                }, 1250));
            }, 900));
        } catch (e) {
            setStatus(`Błąd audio: ${e.message}`, 'error');
            isPlayingModel = false;
            if (playBtn) playBtn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.KszaIntervalFilter) {
            KszaIntervalFilter.init('interval-filter', () => {
                generateNewQuestion();
            });
        }

        document.getElementById('ref-pitch-btn')?.addEventListener('click', playRootPitch);
        document.getElementById('play-model-btn')?.addEventListener('click', playModel);
        document.getElementById('next-btn')?.addEventListener('click', generateNewQuestion);
        document.getElementById('level-select')?.addEventListener('change', generateNewQuestion);
        document.getElementById('clef-select')?.addEventListener('change', generateNewQuestion);

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                playModel();
            } else if (e.code === 'Enter') {
                e.preventDefault();
                generateNewQuestion();
            } else if (e.key === 'r' || e.key === 'R') {
                playRootPitch();
            }
        });

        generateNewQuestion();
    });
})();
