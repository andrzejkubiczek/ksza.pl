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

    let currentInversion = 0;
    let triadNotes = [];
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

    function buildMeasureMusicXML(clefType, notes, revealed) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';

        const n0 = buildNoteXml(notes[0], false);
        const n1 = buildNoteXml(notes[1], !revealed);
        const n2 = buildNoteXml(notes[2], !revealed);

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Trójdźwięk</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>3</beats><beat-type>2</beat-type></time>${clefTag}</attributes>${n0}${n1}${n2}</measure></part></score-partwise>`;
    }

    function renderScore(revealed = isRevealed) {
        if (!triadNotes || triadNotes.length < 3) return;
        try {
            const svg = KszaVerovio.render(buildMeasureMusicXML(clef, triadNotes, revealed), {
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
                    if (noteEls[2]) noteEls[2].classList.add('note-feedback-correct');
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

        currentInversion = selectedType.inversion;

        const badgeEl = document.getElementById('task-badge');
        if (badgeEl) badgeEl.textContent = selectedType.symbol;

        const invTag = document.getElementById('task-inversion-tag');
        if (invTag) invTag.textContent = INVERSION_NAMES[currentInversion];

        const rootTag = document.getElementById('task-root-tag');
        if (rootTag) {
            rootTag.innerHTML = `od: <strong>${formatNoteWithSolfege(triadNotes[0])}</strong>`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            titleEl.innerHTML = `Zaśpiewaj: <strong>${selectedType.label}</strong>`;
        }

        try {
            await KszaVerovio.ensureReady();
            renderScore(false);
        } catch (e) {
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
        }
    }

    async function playRootPitch() {
        if (!triadNotes || triadNotes.length === 0) return;
        clearPlayTimers();
        KszaAudio.stopAll();
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tones = triadNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = adaptPitch(tones[0], shift);

            highlightStaffNote(0);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
            playTimers.push(setTimeout(() => highlightStaffNote(-1), 1100));
        } catch (e) {
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!triadNotes || triadNotes.length < 3 || isPlayingModel) return;
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
            const names = triadNotes.map((n) => `<strong>${formatNoteWithSolfege(n)}</strong>`).join(' • ');
            feedback.innerHTML = `Składniki: ${names}`;
        }

        try {
            const tones = triadNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = tones.map((t) => adaptPitch(t, shift));

            renderScore(true);
            highlightStaffNote(0);
            KszaAudio.player.play(adapted[0], undefined, { duration: 0.65 });

            playTimers.push(setTimeout(() => {
                highlightStaffNote(1);
                if (KszaAudio.player) KszaAudio.player.play(adapted[1], undefined, { duration: 0.65 });

                playTimers.push(setTimeout(() => {
                    highlightStaffNote(2);
                    if (KszaAudio.player) KszaAudio.player.play(adapted[2], undefined, { duration: 1.2 });

                    playTimers.push(setTimeout(() => {
                        isPlayingModel = false;
                        if (playBtn) playBtn.disabled = false;
                        renderScore(true);
                    }, 1250));
                }, 700));
            }, 700));
        } catch (e) {
            setStatus(`Błąd audio: ${e.message}`, 'error');
            isPlayingModel = false;
            if (playBtn) playBtn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
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
