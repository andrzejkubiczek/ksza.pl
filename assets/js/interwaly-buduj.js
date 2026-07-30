/* ksza.pl - interwały: budowanie zapisu nutowego
   Odwrotność ćwiczenia "zapis nutowy": tam uczeń CZYTA gotowy interwał,
   tutaj go BUDUJE. Dźwięk startowy jest losowany i stały, uczeń strzałkami
   przesuwa literę drugiego dźwięku (drabina diatoniczna C-D-E-F-G-A-B) i
   osobno ustawia znak chromatyczny (bemol/naturalny/krzyżyk). Po każdej
   zmianie przerysowujemy nuty przez Verovio - ten sam mechanizm budowania
   MusicXML co w interwaly-zapis.js (zweryfikowany), tylko sterowany
   panelem zamiast przycisków z gotową nazwą interwału.

   Panel znaku chromatycznego ma świadomie tylko 3 stany (-1..1): przy
   naturalnym dźwięku startowym żaden z 13 interwałów nie wymaga
   podwójnego bemola/krzyżyka (sprawdzone dla wszystkich 7 liter x 13
   interwałów x 2 kierunki). Poziom 2 dopuszcza chromatyczny dźwięk
   startowy, ale TYLKO w kombinacjach z danym interwałem/kierunkiem,
   które nadal mieszczą się w tym zakresie (patrz pickRootAlter) - żeby
   panel nie musiał rosnąć do 5 znaków. */
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

    /* ---------- MusicXML: dwie KOLEJNE nuty (nie akord) ----------
       W ćwiczeniu "rozpoznawanie" dwa dzwieki sa akordem (<chord/>), bo
       interwal tam jest gotowy i ma brzmiec jako calosc. Tutaj uczen
       dopiero USTAWIA gorny dzwiek - gdy krok = 0 (pryma), akord
       nalozylby obie nuty na siebie w tym samym miejscu, przez co znak
       chromatyczny gornej nuty wygladalby jak znak dolnej (zob. uwaga
       uzytkownika). Dwie kolejne nuty w takcie rozwiazuja to od razu:
       zawsze osobne miejsca na pieciolinii, niezaleznie od wysokosci. */
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

    // Poziom 2: dźwięk startowy może być chromatyczny, ale tylko jeśli dla
    // danego interwału/kierunku wynikowy drugi dźwięk nadal mieści się w
    // zakresie -1..1 (żeby panel nie musiał mieć podwójnych znaków). 0
    // (naturalny) jest zawsze bezpieczny, więc lista nigdy nie jest pusta.
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
