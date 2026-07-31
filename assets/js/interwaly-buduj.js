/* ksza.pl - interwały: budowanie zapisu nutowego
   Odwrotność "zapis nutowy": tam uczeń czyta gotowy interwał, tutaj go
   buduje - strzałkami przesuwa literę drugiego dźwięku i osobno ustawia
   znak chromatyczny (♭/♮/♯, świadomie tylko 3 stany - sprawdzone, że przy
   dozwolonych kombinacjach nigdy nie trzeba podwójnego znaku). */
(function () {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_NATURAL_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    const INTERVAL_DEFS = {
        '1':  { steps: 0, semitones: 0,  label: 'Pryma czysta' },
        '2>': { steps: 1, semitones: 1,  label: 'Sekunda mała' },
        '2':  { steps: 1, semitones: 2,  label: 'Sekunda wielka' },
        '3>': { steps: 2, semitones: 3,  label: 'Tercja mała' },
        '3':  { steps: 2, semitones: 4,  label: 'Tercja wielka' },
        '4':  { steps: 3, semitones: 5,  label: 'Kwarta czysta' },
        '4<': { steps: 3, semitones: 6,  label: 'Kwarta zwiększona' },
        '5':  { steps: 4, semitones: 7,  label: 'Kwinta czysta' },
        '6>': { steps: 5, semitones: 8,  label: 'Seksta mała' },
        '6':  { steps: 5, semitones: 9,  label: 'Seksta wielka' },
        '7':  { steps: 6, semitones: 10, label: 'Septyma mała' },
        '7<': { steps: 6, semitones: 11, label: 'Septyma wielka' },
        '8':  { steps: 7, semitones: 12, label: 'Oktawa czysta' }
    };
    const SYMBOLS = Object.keys(INTERVAL_DEFS);

    /* ---------- Pisownia enharmoniczna (identyczne jak w interwaly-zapis.js) ---------- */
    function ladderEntry(diatonicIndex) {
        const letterIdx = ((diatonicIndex % 7) + 7) % 7;
        const octave = Math.floor(diatonicIndex / 7);
        const letter = LETTERS[letterIdx];
        return { letter: letter, octave: octave, naturalSemitone: octave * 12 + LETTER_NATURAL_OFFSET[letter] };
    }
    function diatonicIndexOf(letter, octave) { return octave * 7 + LETTERS.indexOf(letter); }
    function absoluteSemitone(note) { return note.octave * 12 + LETTER_NATURAL_OFFSET[note.letter] + note.alter; }

    // direction: 1 = interwał w górę, -1 = interwał w dół.
    function spellInterval(startNote, symbol, direction) {
        const def = INTERVAL_DEFS[symbol];
        const startAbs = absoluteSemitone(startNote);
        const startIdx = diatonicIndexOf(startNote.letter, startNote.octave);
        const target = ladderEntry(startIdx + direction * def.steps);
        return { letter: target.letter, alter: (startAbs + direction * def.semitones) - target.naturalSemitone, octave: target.octave };
    }

    // Dwie KOLEJNE nuty, nie akord - przy kroku 0 obie nuty nakładałyby się
    // na siebie i znak chromatyczny wyglądałby, jakby dotyczył złej nuty.
    function noteToPitchXml(note) {
        const alterTag = note.alter !== 0 ? '<alter>' + note.alter + '</alter>' : '';
        return '<pitch><step>' + note.letter + '</step>' + alterTag + '<octave>' + note.octave + '</octave></pitch>';
    }

    const ACCIDENTAL_NAMES = { '-2': 'flat-flat', '-1': 'flat', '1': 'sharp', '2': 'double-sharp' };
    function accidentalTag(note) {
        return note.alter !== 0 ? '<accidental>' + ACCIDENTAL_NAMES[String(note.alter)] + '</accidental>' : '';
    }

    function buildNoteXml(note) {
        return '<note>' + noteToPitchXml(note) +
            '<duration>2</duration><type>half</type>' + accidentalTag(note) + '</note>';
    }

    function buildMeasureMusicXML(clef, lowerNote, upperNote) {
        const clefTag = clef === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<score-partwise version="4.0">' +
            '<part-list><score-part id="P1"><part-name>Interwał</part-name></score-part></part-list>' +
            '<part id="P1"><measure number="1">' +
            '<attributes><divisions>1</divisions><key><fifths>0</fifths></key>' +
            '<time><beats>4</beats><beat-type>4</beat-type></time>' + clefTag + '</attributes>' +
            buildNoteXml(lowerNote) +
            buildNoteXml(upperNote) +
            '</measure></part></score-partwise>';
    }

    /* ---------- Verovio ---------- */
    let verovioToolkit = null;
    let verovioReadyPromise = null;

    function ensureVerovioReady() {
        if (verovioReadyPromise) return verovioReadyPromise;
        verovioReadyPromise = new Promise((resolve, reject) => {
            if (typeof verovio === 'undefined') {
                reject(new Error('Biblioteka Verovio nie została wczytana (sprawdź połączenie).'));
                return;
            }

            let settled = false;
            const tryInit = () => {
                if (settled) return;
                try {
                    verovioToolkit = new verovio.toolkit();
                    settled = true;
                    clearInterval(pollId);
                    clearTimeout(timeoutId);
                    resolve();
                } catch (e) { /* moduł jeszcze nie gotowy - spróbujemy ponownie */ }
            };

            verovio.module.onRuntimeInitialized = tryInit;
            const pollId = setInterval(tryInit, 50);
            const timeoutId = setTimeout(() => {
                settled = true;
                clearInterval(pollId);
                reject(new Error('Przekroczono limit czasu ładowania Verovio.'));
            }, 20000);

            tryInit();
        });
        return verovioReadyPromise;
    }

    function renderMeasure(clef, lowerNote, upperNote) {
        const musicXml = buildMeasureMusicXML(clef, lowerNote, upperNote);
        const svg = verovioToolkit.renderData(musicXml, {
            pageWidth: 900,
            pageHeight: 260,
            scale: 60,
            adjustPageHeight: true,
            breaks: 'none'
        });
        document.getElementById('notation-container').innerHTML = svg;
    }

    /* ---------- Stan ćwiczenia ---------- */
    let currentSymbol = null;
    let direction = 1;     // 1 = w górę, -1 = w dół
    let rootNote = null;
    let clef = 'treble';
    let builderStep = 0;   // wzgledem rootNote: 0 = ta sama litera .. +-7 = oktawa (kierunek zależny)
    let builderAlter = 0;  // -1 bemol, 0 naturalny, 1 krzyżyk
    let hasAnswered = false;

    const TREBLE_ROOT_OCTAVE = 4; // razkreślna
    const BASS_ROOT_OCTAVE = 2;   // wielka

    function currentLevel() {
        return document.getElementById('level-select').value;
    }

    function stepBounds() {
        return direction === 1 ? { min: 0, max: 7 } : { min: -7, max: 0 };
    }

    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        el.textContent = message || '';
        el.className = 'status-line' + (type ? ' status-' + type : '');
    }

    function candidateNote() {
        const startIdx = diatonicIndexOf(rootNote.letter, rootNote.octave);
        const entry = ladderEntry(startIdx + builderStep);
        return { letter: entry.letter, alter: builderAlter, octave: entry.octave };
    }

    function noteLabel(note) {
        const accidental = note.alter === 1 ? '♯' : note.alter === -1 ? '♭' : '';
        return note.letter + accidental;
    }

    function updateLetterButtons() {
        const bounds = stepBounds();
        document.getElementById('letter-down').disabled = hasAnswered || builderStep === bounds.min;
        document.getElementById('letter-up').disabled = hasAnswered || builderStep === bounds.max;
    }

    // Poziom 2: dźwięk startowy może być chromatyczny, ale tylko gdy wynikowy
    // drugi dźwięk zmieści się w -1..1 (naturalny jest zawsze bezpieczny).
    function pickRootAlter(letter, symbol, dir) {
        const safeAlters = [-1, 0, 1].filter((alter) => {
            const probe = { letter: letter, alter: alter, octave: TREBLE_ROOT_OCTAVE };
            const result = spellInterval(probe, symbol, dir);
            return Math.abs(result.alter) <= 1;
        });
        return safeAlters[Math.floor(Math.random() * safeAlters.length)];
    }

    function redraw() {
        try {
            renderMeasure(clef, rootNote, candidateNote());
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function pickClef() {
        const selected = document.getElementById('clef-select').value;
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }

    async function generateNewQuestion() {
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('check-btn').disabled = false;

        clef = pickClef();
        const level = currentLevel();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const rootLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        currentSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        direction = level === '2' && Math.random() < 0.5 ? -1 : 1;
        const rootAlter = level === '2' ? pickRootAlter(rootLetter, currentSymbol, direction) : 0;
        rootNote = { letter: rootLetter, alter: rootAlter, octave: rootOctave };

        builderStep = 0;
        builderAlter = 0;
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.disabled = false;
            btn.classList.toggle('is-active', btn.dataset.alter === '0');
        });
        updateLetterButtons();

        const directionLabel = direction === 1 ? 'w górę' : 'w dół';
        document.getElementById('task-line').textContent =
            'Zbuduj ' + directionLabel + ' od dźwięku ' + noteLabel(rootNote) + ': ' +
            INTERVAL_DEFS[currentSymbol].label + ' (' + currentSymbol + ').';

        try {
            await ensureVerovioReady();
            redraw();
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function moveLetter(delta) {
        if (hasAnswered) return;
        const bounds = stepBounds();
        const next = builderStep + delta;
        if (next < bounds.min || next > bounds.max) return;
        builderStep = next;
        updateLetterButtons();
        redraw();
    }

    function setAccidental(alter) {
        if (hasAnswered) return;
        builderAlter = alter;
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.classList.toggle('is-active', parseInt(btn.dataset.alter, 10) === alter);
        });
        redraw();
    }

    function cycleAccidental() {
        if (hasAnswered) return;
        setAccidental(builderAlter === 0 ? 1 : builderAlter === 1 ? -1 : 0);
    }

    // Gest jako alternatywa dla przycisków: przesunięcie WZGLĘDNE (co ile
    // pikseli = jeden krok), bo Verovio przerysowuje nuty od zera i nie znamy
    // ich dokładnej pozycji na ekranie. Dotknięcie bez przesunięcia = znak.
    function setupGestureLayer() {
        const layer = document.getElementById('gesture-layer');
        const DRAG_STEP_PX = 24;
        const TAP_THRESHOLD_PX = 4;
        let dragging = false;
        let startY = 0;
        let appliedSteps = 0;
        let moved = false;

        layer.addEventListener('pointerdown', (ev) => {
            if (hasAnswered) return;
            dragging = true;
            moved = false;
            startY = ev.clientY;
            appliedSteps = 0;
            layer.setPointerCapture(ev.pointerId);
        });
        layer.addEventListener('pointermove', (ev) => {
            if (!dragging) return;
            const deltaY = ev.clientY - startY;
            if (Math.abs(deltaY) > TAP_THRESHOLD_PX) moved = true;
            const targetSteps = Math.round(-deltaY / DRAG_STEP_PX);
            const diff = targetSteps - appliedSteps;
            if (diff !== 0) {
                const dir = diff > 0 ? 1 : -1;
                for (let i = 0; i < Math.abs(diff); i++) moveLetter(dir);
                appliedSteps = targetSteps;
            }
        });
        function endGesture() {
            if (!dragging) return;
            dragging = false;
            if (!moved) cycleAccidental();
        }
        layer.addEventListener('pointerup', endGesture);
        layer.addEventListener('pointercancel', endGesture);
    }

    function checkAnswer() {
        if (hasAnswered) return;
        hasAnswered = true;

        const expected = spellInterval(rootNote, currentSymbol, direction);
        const candidate = candidateNote();
        const isCorrect = candidate.letter === expected.letter &&
            candidate.alter === expected.alter &&
            candidate.octave === expected.octave;

        document.getElementById('check-btn').disabled = true;
        document.querySelectorAll('.accidental-btn').forEach((btn) => { btn.disabled = true; });
        updateLetterButtons();

        const feedback = document.getElementById('feedback');
        const directionLabel = direction === 1 ? 'w górę' : 'w dół';
        if (isCorrect) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowo zbudowany interwał.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Prawidłowy drugi dźwięk to ' + noteLabel(expected) +
                ' (' + currentSymbol + ' ' + INTERVAL_DEFS[currentSymbol].label + ' ' + directionLabel + ' od ' + noteLabel(rootNote) + ').';
        }

        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();
        setupGestureLayer();

        document.getElementById('level-select').addEventListener('change', generateNewQuestion);
        document.getElementById('clef-select').addEventListener('change', generateNewQuestion);
        document.getElementById('next-btn').addEventListener('click', generateNewQuestion);
        document.getElementById('letter-up').addEventListener('click', () => moveLetter(1));
        document.getElementById('letter-down').addEventListener('click', () => moveLetter(-1));
        document.getElementById('check-btn').addEventListener('click', checkAnswer);
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.addEventListener('click', () => setAccidental(parseInt(btn.dataset.alter, 10)));
        });
    });
})();
