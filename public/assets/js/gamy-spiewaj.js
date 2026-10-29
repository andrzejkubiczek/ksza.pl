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
            shortName: 'molowa eolska',
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
            down: [12, 10, 8, 7, 5, 3, 2, 0]
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

    const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;

    let currentScaleKey = 'durowa';
    let currentTonic = null;
    let currentDirection = 'up';
    let scaleNotes = [];
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

    function getKeySignatureAlter(letter, fifths) {
        if (fifths > 0) {
            return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
        } else if (fifths < 0) {
            return FLAT_ORDER.slice(0, Math.abs(fifths)).includes(letter) ? -1 : 0;
        }
        return 0;
    }

    function getScaleNoteXml(note, fifths, isGhost = false) {
        if (isGhost) {
            return `<note><rest/><duration>1</duration><type>quarter</type></note>`;
        }
        const defaultAlter = getKeySignatureAlter(note.letter, fifths);
        let accidentalTag = '';
        if (note.alter !== defaultAlter) {
            const accName = { '-2': 'flat-flat', '-1': 'flat', '0': 'natural', '1': 'sharp', '2': 'double-sharp' }[String(note.alter)] || 'natural';
            accidentalTag = `<accidental>${accName}</accidental>`;
        }
        const alterTag = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
        return `<note><pitch><step>${note.letter}</step>${alterTag}<octave>${note.octave}</octave></pitch><duration>1</duration><type>quarter</type>${accidentalTag}</note>`;
    }

    function buildScaleMusicXML(clefType, notes, fifths = 0, revealed = false) {
        const clefTag = clefType === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';

        const measures = [];
        const numMeasures = Math.ceil(notes.length / 4);

        for (let m = 0; m < numMeasures; m++) {
            const chunk = notes.slice(m * 4, m * 4 + 4);
            const notesXml = chunk.map((n, idx) => {
                const globalIdx = m * 4 + idx;
                return getScaleNoteXml(n, fifths, !revealed && globalIdx > 0);
            }).join('');
            const attrXml = (m === 0)
                ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>`
                : '';
            measures.push(`<measure number="${m + 1}">${attrXml}${notesXml}</measure>`);
        }

        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Gama</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
    }

    function renderScore(revealed = isRevealed) {
        if (!scaleNotes || scaleNotes.length === 0) return;
        const fifths = currentTonic ? (currentTonic.fifths || 0) : 0;
        try {
            const svg = KszaVerovio.render(buildScaleMusicXML(clef, scaleNotes, fifths, revealed), {
                pageWidth: scaleNotes.length > 8 ? 1200 : 900,
                pageHeight: 280,
                scale: scaleNotes.length > 8 ? 50 : 60,
                adjustPageHeight: true,
                breaks: 'none'
            });
            const container = document.getElementById('notation-container');
            if (container) {
                container.innerHTML = svg;
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

    function pickDirection() {
        const selected = document.getElementById('direction-select')?.value || 'random';
        if (selected === 'random') {
            const level = currentLevel();
            const opts = level === '1' ? ['up', 'down'] : ['up', 'down', 'up-down'];
            return opts[Math.floor(Math.random() * opts.length)];
        }
        return selected;
    }

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

        return upNotes.concat(downNotes);
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
            const firstNote = scaleNotes[0];
            rootTag.innerHTML = `od: <strong>${MT.noteLabel(firstNote)}${firstNote.octave}</strong> (${currentTonic.name})`;
        }

        const titleEl = document.getElementById('task-title');
        if (titleEl) {
            const scaleDef = SCALE_TYPES[currentScaleKey];
            titleEl.innerHTML = `Zaśpiewaj: <strong>Gama ${currentTonic.name} (${scaleDef.shortName})</strong>`;
        }

        try {
            await KszaVerovio.ensureReady();
            renderScore(false);
        } catch (e) {
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
        }
    }

    async function playRootPitch() {
        if (!scaleNotes || scaleNotes.length === 0) return;
        clearPlayTimers();
        KszaAudio.stopAll();
        try {
            const ok = await KszaAudio.ensureReady({ value: 'piano' }, onAudioState);
            if (!ok || !KszaAudio.player) return;

            const tone = noteToToneName(scaleNotes[0]);
            const shift = getOctaveShift([tone]);
            const adapted = adaptPitch(tone, shift);

            highlightStaffNote(0);
            KszaAudio.player.play(adapted, undefined, { duration: 1.2 });
            playTimers.push(setTimeout(() => highlightStaffNote(-1), 1100));
        } catch (e) {
            setStatus(`Błąd audio: ${e.message}`, 'error');
        }
    }

    async function playModel() {
        if (!scaleNotes || scaleNotes.length === 0 || isPlayingModel) return;
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
            const names = scaleNotes.map((n) => MT.noteLabel(n)).join(' – ');
            feedback.innerHTML = `Stopnie: <strong>${names}</strong>`;
        }

        try {
            const tones = scaleNotes.map(noteToToneName);
            const shift = getOctaveShift(tones);
            const adapted = tones.map((t) => adaptPitch(t, shift));

            renderScore(true);

            let idx = 0;
            function playNext() {
                if (idx >= adapted.length) {
                    isPlayingModel = false;
                    if (playBtn) playBtn.disabled = false;
                    highlightStaffNote(-1);
                    return;
                }

                highlightStaffNote(idx);
                if (KszaAudio.player) {
                    const dur = (idx === adapted.length - 1) ? 1.0 : 0.42;
                    KszaAudio.player.play(adapted[idx], undefined, { duration: dur });
                }

                idx++;
                playTimers.push(setTimeout(playNext, 460));
            }

            playNext();
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
        document.getElementById('direction-select')?.addEventListener('change', generateNewQuestion);
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
