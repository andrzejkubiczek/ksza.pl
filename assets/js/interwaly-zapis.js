/* ksza.pl - interwały: rozpoznawanie zapisu nutowego
   W odróżnieniu od wersji "ze słuchu" to ćwiczenie jest czysto wzrokowe -
   nie używa Tone.js ani żadnego dźwięku. Nowa część: prawidłowa pisownia
   enharmoniczna (np. tercja mała od C to Es, nie Dis - inaczej niż w
   dźwięku, w zapisie ma to znaczenie) oraz rysowanie przez Verovio. */
(function () {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_NATURAL_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // steps = liczba krokow literowych (0=pryma,1=sekunda...7=oktawa)
    // semitones = polstony dla danej odmiany interwalu
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

    /* ---------- Pisownia enharmoniczna ----------
       "Drabina" diatoniczna: indeks rośnie o 1 na każdy krok literowy,
       niezależnie od oktawy - przejście przez jej granicę liczy się samo.
       Zweryfikowane na 10 przypadkach (w tym granicznych) + wyczerpująco
       na 91 kombinacjach (7 nut naturalnych x 13 interwałów). */
    function ladderEntry(diatonicIndex) {
        const letterIdx = ((diatonicIndex % 7) + 7) % 7;
        const octave = Math.floor(diatonicIndex / 7);
        const letter = LETTERS[letterIdx];
        return { letter: letter, octave: octave, naturalSemitone: octave * 12 + LETTER_NATURAL_OFFSET[letter] };
    }
    function diatonicIndexOf(letter, octave) { return octave * 7 + LETTERS.indexOf(letter); }
    function absoluteSemitone(note) { return note.octave * 12 + LETTER_NATURAL_OFFSET[note.letter] + note.alter; }

    function spellIntervalUp(startNote, symbol) {
        const def = INTERVAL_DEFS[symbol];
        const startAbs = absoluteSemitone(startNote);
        const startIdx = diatonicIndexOf(startNote.letter, startNote.octave);
        const target = ladderEntry(startIdx + def.steps);
        return { letter: target.letter, alter: (startAbs + def.semitones) - target.naturalSemitone, octave: target.octave };
    }

    /* ---------- MusicXML: dwa dzwieki jako AKORD (jednoczesnie, nie po sobie) ----------
       Interwal do rozpoznania to dwa jednoczesnie brzmiace dzwieki, nie melodia -
       stad <chord/> zamiast dwoch osobnych nut w czasie. */
    function noteToPitchXml(note) {
        const alterTag = note.alter !== 0 ? '<alter>' + note.alter + '</alter>' : '';
        return '<pitch><step>' + note.letter + '</step>' + alterTag + '<octave>' + note.octave + '</octave></pitch>';
    }

    // <alter> ustala WYSOKOŚĆ dźwięku, ale sam nie gwarantuje narysowania
    // krzyżyka/bemola - do tego potrzebny jest osobny <accidental>.
    const ACCIDENTAL_NAMES = { '-2': 'flat-flat', '-1': 'flat', '1': 'sharp', '2': 'double-sharp' };
    function accidentalTag(note) {
        return note.alter !== 0 ? '<accidental>' + ACCIDENTAL_NAMES[String(note.alter)] + '</accidental>' : '';
    }

    function buildNoteXml(note, isChordTone) {
        return '<note>' + (isChordTone ? '<chord/>' : '') + noteToPitchXml(note) +
            '<duration>4</duration><type>whole</type>' + accidentalTag(note) + '</note>';
    }

    function buildMeasureMusicXML(clef, lowerNote, upperNote) {
        const clefTag = clef === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<score-partwise version="4.0">' +
            '<part-list><score-part id="P1"><part-name print-object="no">Interwał</part-name></score-part></part-list>' +
            '<part id="P1"><measure number="1">' +
            '<attributes><divisions>1</divisions><key><fifths>0</fifths></key>' +
            '<time><beats>4</beats><beat-type>4</beat-type></time>' + clefTag + '</attributes>' +
            buildNoteXml(lowerNote, false) +
            buildNoteXml(upperNote, true) +
            '</measure></part></score-partwise>';
    }

    /* ---------- Verovio ---------- */
    let verovioToolkit = null;
    let verovioReadyPromise = null;

    // onRuntimeInitialized czasem nie odpala się w porę - zabezpieczenie
    // potrójne: próba od razu, oficjalny callback, odpytywanie co 50ms.
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

            tryInit(); // a nuż jest już gotowy w tej właśnie chwili
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
    let hasAnswered = false;

    const TREBLE_ROOT_OCTAVE = 4; // razkreślna
    const BASS_ROOT_OCTAVE = 2;   // wielka

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

    async function generateNewQuestion() {
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        const clef = pickClef();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const rootLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

        const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };
        const upperNote = spellIntervalUp(rootNote, symbol);

        currentSymbol = symbol;

        try {
            await ensureVerovioReady();
            renderMeasure(clef, rootNote, upperNote);
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function checkAnswer(selectedSymbol) {
        if (hasAnswered) return;
        hasAnswered = true;

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.symbol === currentSymbol) {
                btn.classList.add('is-correct');
            } else if (btn.dataset.symbol === selectedSymbol) {
                btn.classList.add('is-wrong');
            }
        });

        const feedback = document.getElementById('feedback');
        if (selectedSymbol === currentSymbol) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Poprawna odpowiedź: ' + INTERVAL_DEFS[currentSymbol].label + '.';
        }

        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();

        document.getElementById('clef-select').addEventListener('change', generateNewQuestion);
        document.getElementById('next-btn').addEventListener('click', generateNewQuestion);
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.symbol));
        });
    });
})();
