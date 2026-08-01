/* ksza.pl - trójdźwięki: budowanie zapisu nutowego.
   Bas jest dany, uczeń ustawia pozostałe dwa dźwięki - kursor "Poprzednia/
   Następna nuta" wybiera KTÓRY, te same strzałki i przełącznik ♭/♮/♯ działają
   na aktualnie wybranym (stan każdego pamiętany osobno). */
(function () {
    const MT = KszaMusicTheory;

    const TRIAD_SHAPES = {
        durowy:      { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 7 } },
        molowy:      { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 7 } },
        zmniejszony: { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 6 } },
        zwiekszony:  { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 8 } }
    };

    // symbol: te same znaki co na przyciskach w ćwiczeniu "rozpoznawanie".
    const TRIAD_TYPES = {
        'durowy_z':    { shape: 'durowy',      inversion: 0, level: 1, label: 'Durowy',                 symbol: '+' },
        'molowy_z':    { shape: 'molowy',      inversion: 0, level: 1, label: 'Molowy',                 symbol: 'o' },
        'zmniejszony': { shape: 'zmniejszony', inversion: 0, level: 1, label: 'Zmniejszony',             symbol: '>' },
        'zwiekszony':  { shape: 'zwiekszony',  inversion: 0, level: 1, label: 'Zwiększony',              symbol: '<' },
        'durowy_3':    { shape: 'durowy',      inversion: 1, level: 2, label: 'Durowy - I przewrót',     symbol: '+₃' },
        'durowy_5':    { shape: 'durowy',      inversion: 2, level: 2, label: 'Durowy - II przewrót',    symbol: '+₅' },
        'molowy_3':    { shape: 'molowy',      inversion: 1, level: 2, label: 'Molowy - I przewrót',     symbol: 'o₃' },
        'molowy_5':    { shape: 'molowy',      inversion: 2, level: 2, label: 'Molowy - II przewrót',    symbol: 'o₅' }
    };

    function buildTriadNotes(rootNote, shapeName, inversion) {
        const shape = TRIAD_SHAPES[shapeName];
        const third = MT.spellByShape(rootNote, shape.third, 1);
        const fifth = MT.spellByShape(rootNote, shape.fifth, 1);
        const notes = [rootNote, third, fifth];
        for (let i = 0; i < inversion; i++) {
            const wrapped = notes.shift();
            notes.push({ letter: wrapped.letter, alter: wrapped.alter, octave: wrapped.octave + 1 });
        }
        return notes;
    }

    // Trzy KOLEJNE nuty (nie akord), żeby było czytelniej.
    function buildNoteXml(note) {
        return '<note>' + MT.noteToPitchXml(note) +
            '<duration>1</duration><type>quarter</type>' + MT.accidentalTag(note) + '</note>';
    }

    function buildMeasureMusicXML(clef, notes) {
        const clefTag = clef === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<score-partwise version="4.0">' +
            '<part-list><score-part id="P1"><part-name print-object="no">Trójdźwięk</part-name></score-part></part-list>' +
            '<part id="P1"><measure number="1">' +
            '<attributes><divisions>1</divisions><key><fifths>0</fifths></key>' +
            '<time><beats>3</beats><beat-type>4</beat-type></time>' + clefTag + '</attributes>' +
            notes.map(buildNoteXml).join('') +
            '</measure></part></score-partwise>';
    }

    function renderMeasure(clef, notes) {
        const svg = KszaVerovio.render(buildMeasureMusicXML(clef, notes), {
            pageWidth: 900,
            pageHeight: 260,
            scale: 60,
            adjustPageHeight: true,
            breaks: 'none'
        });
        document.getElementById('notation-container').innerHTML = svg;
    }

    let currentKey = null;
    let clef = 'treble';
    let bassNote = null;
    let expectedNotes = null;     // [bas, środkowy, górny] - poprawna odpowiedź
    let hasAnswered = false;

    // Edytowalne pozycje w notes: 1 (środkowy), 2 (górny).
    const EDITABLE_INDICES = [1, 2];
    let editableState = {};
    let cursorPos = 0;

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;

    function currentLevel() {
        return document.getElementById('level-select').value;
    }
    function pickClef() {
        const selected = document.getElementById('clef-select').value;
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }
    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        el.textContent = message || '';
        el.className = 'status-line' + (type ? ' status-' + type : '');
    }

    // H + zwiększony wymagałby podwójnego krzyżyka (kwinta = Fisis) - wykluczone.
    function pickRootLetter(shapeName) {
        const pool = shapeName === 'zwiekszony' ? MT.LETTERS.filter((l) => l !== 'B') : MT.LETTERS;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function currentEditIndex() { return EDITABLE_INDICES[cursorPos]; }

    function candidateNoteAt(index) {
        const state = editableState[index];
        const bassIdx = MT.diatonicIndexOf(bassNote.letter, bassNote.octave);
        const entry = MT.ladderEntry(bassIdx + state.step);
        return { letter: entry.letter, alter: state.alter, octave: entry.octave };
    }

    function currentNotes() {
        return [bassNote, candidateNoteAt(1), candidateNoteAt(2)];
    }

    function updateCursorLabel() {
        document.getElementById('note-cursor-label').textContent =
            'Dźwięk ' + (currentEditIndex() + 1) + ' z 3';
        document.getElementById('note-prev').disabled = hasAnswered || cursorPos === 0;
        document.getElementById('note-next').disabled = hasAnswered || cursorPos === EDITABLE_INDICES.length - 1;
    }

    function updateLetterButtons() {
        const step = editableState[currentEditIndex()].step;
        document.getElementById('letter-down').disabled = hasAnswered || step === 0;
        document.getElementById('letter-up').disabled = hasAnswered || step === 7;
    }

    function updateAccidentalButtons() {
        const alter = editableState[currentEditIndex()].alter;
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.classList.toggle('is-active', parseInt(btn.dataset.alter, 10) === alter);
        });
    }

    function syncControlsToCursor() {
        updateCursorLabel();
        updateLetterButtons();
        updateAccidentalButtons();
    }

    function redraw() {
        try {
            renderMeasure(clef, currentNotes());
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    async function generateNewQuestion() {
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('check-btn').disabled = false;
        document.querySelectorAll('.accidental-btn').forEach((btn) => { btn.disabled = false; });

        const level = currentLevel();
        const pool = Object.keys(TRIAD_TYPES).filter((k) => level === '2' || TRIAD_TYPES[k].level === 1);
        currentKey = pool[Math.floor(Math.random() * pool.length)];
        const type = TRIAD_TYPES[currentKey];

        clef = pickClef();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const rootLetter = pickRootLetter(type.shape);
        const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };

        expectedNotes = buildTriadNotes(rootNote, type.shape, type.inversion);
        bassNote = expectedNotes[0];

        editableState = { 1: { step: 0, alter: 0 }, 2: { step: 0, alter: 0 } };
        cursorPos = 0;
        syncControlsToCursor();

        document.getElementById('task-line').textContent = 'Zbuduj: ' + type.label + ' (' + type.symbol + ').';

        try {
            await KszaVerovio.ensureReady();
            redraw();
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function moveCursor(delta) {
        if (hasAnswered) return;
        const next = cursorPos + delta;
        if (next < 0 || next > EDITABLE_INDICES.length - 1) return;
        cursorPos = next;
        syncControlsToCursor();
    }

    function moveLetter(delta) {
        if (hasAnswered) return;
        const state = editableState[currentEditIndex()];
        const next = state.step + delta;
        if (next < 0 || next > 7) return;
        state.step = next;
        updateLetterButtons();
        redraw();
    }

    function setAccidental(alter) {
        if (hasAnswered) return;
        editableState[currentEditIndex()].alter = alter;
        updateAccidentalButtons();
        redraw();
    }

    function cycleAccidental() {
        if (hasAnswered) return;
        const current = editableState[currentEditIndex()].alter;
        setAccidental(current === 0 ? 1 : current === 1 ? -1 : 0);
    }

    function checkAnswer() {
        if (hasAnswered) return;
        hasAnswered = true;

        const isCorrect = EDITABLE_INDICES.every((index) => {
            const candidate = candidateNoteAt(index);
            const expected = expectedNotes[index];
            return candidate.letter === expected.letter &&
                candidate.alter === expected.alter &&
                candidate.octave === expected.octave;
        });

        document.getElementById('check-btn').disabled = true;
        document.querySelectorAll('.accidental-btn').forEach((btn) => { btn.disabled = true; });
        document.getElementById('note-prev').disabled = true;
        document.getElementById('note-next').disabled = true;
        updateLetterButtons();

        const feedback = document.getElementById('feedback');
        if (isCorrect) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowo zbudowany trójdźwięk.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Prawidłowo: środkowy dźwięk to ' + MT.noteLabel(expectedNotes[1]) +
                ', górny to ' + MT.noteLabel(expectedNotes[2]) + '.';
        }

        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();
        KszaGestureLayer.setup('gesture-layer', {
            canEdit: () => !hasAnswered,
            moveLetter: moveLetter,
            cycleAccidental: cycleAccidental
        });

        document.getElementById('level-select').addEventListener('change', generateNewQuestion);
        document.getElementById('clef-select').addEventListener('change', generateNewQuestion);
        document.getElementById('next-btn').addEventListener('click', generateNewQuestion);
        document.getElementById('note-prev').addEventListener('click', () => moveCursor(-1));
        document.getElementById('note-next').addEventListener('click', () => moveCursor(1));
        document.getElementById('letter-up').addEventListener('click', () => moveLetter(1));
        document.getElementById('letter-down').addEventListener('click', () => moveLetter(-1));
        document.getElementById('check-btn').addEventListener('click', checkAnswer);
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.addEventListener('click', () => setAccidental(parseInt(btn.dataset.alter, 10)));
        });
    });
})();
