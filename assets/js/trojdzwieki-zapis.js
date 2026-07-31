/* ksza.pl - trójdźwięki: rozpoznawanie zapisu nutowego
   Bez dźwięku, tylko wzrokowo. Trudniejsze niż interwały: PRZEWROTY -
   pisownia dźwięków nie zmienia się między postaciami, zmienia się
   tylko który składnik jest w basie. Budujemy zawsze od prawdziwego
   prymu, a dla przewrotu "obracamy" gotowy akord. */
(function () {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_NATURAL_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // Ksztalt kazdego trojdzwieku: tercja i kwinta jako {steps, semitones} LICZONE OD PRYMY.
    const TRIAD_SHAPES = {
        durowy:      { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 7 } },
        molowy:      { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 7 } },
        zmniejszony: { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 6 } },
        zwiekszony:  { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 8 } }
    };

    // Klucze odpowiedzi - te same co w wersji "ze słuchu". inversion: 0=zasadnicza,
    // 1=I przewrót (tercja w basie), 2=II przewrót (kwinta w basie).
    const TRIAD_TYPES = {
        'durowy_z':    { shape: 'durowy',      inversion: 0, level: 1, label: 'Durowy' },
        'molowy_z':    { shape: 'molowy',      inversion: 0, level: 1, label: 'Molowy' },
        'zmniejszony': { shape: 'zmniejszony', inversion: 0, level: 1, label: 'Zmniejszony' },
        'zwiekszony':  { shape: 'zwiekszony',  inversion: 0, level: 1, label: 'Zwiększony' },
        'durowy_3':    { shape: 'durowy',      inversion: 1, level: 2, label: 'Durowy - I przewrót' },
        'durowy_5':    { shape: 'durowy',      inversion: 2, level: 2, label: 'Durowy - II przewrót' },
        'molowy_3':    { shape: 'molowy',      inversion: 1, level: 2, label: 'Molowy - I przewrót' },
        'molowy_5':    { shape: 'molowy',      inversion: 2, level: 2, label: 'Molowy - II przewrót' }
    };

    /* ---------- Pisownia enharmoniczna (ta sama "drabina" co w interwałach) ---------- */
    function ladderEntry(diatonicIndex) {
        const letterIdx = ((diatonicIndex % 7) + 7) % 7;
        const octave = Math.floor(diatonicIndex / 7);
        const letter = LETTERS[letterIdx];
        return { letter: letter, octave: octave, naturalSemitone: octave * 12 + LETTER_NATURAL_OFFSET[letter] };
    }
    function diatonicIndexOf(letter, octave) { return octave * 7 + LETTERS.indexOf(letter); }
    function absoluteSemitone(note) { return note.octave * 12 + LETTER_NATURAL_OFFSET[note.letter] + note.alter; }

    function spellUp(startNote, def) {
        const startAbs = absoluteSemitone(startNote);
        const startIdx = diatonicIndexOf(startNote.letter, startNote.octave);
        const target = ladderEntry(startIdx + def.steps);
        return { letter: target.letter, alter: (startAbs + def.semitones) - target.naturalSemitone, octave: target.octave };
    }

    // Buduje trojdzwiek w postaci zasadniczej (rosnaco: pryma, tercja, kwinta),
    // a nastepnie dla przewrotu "obraca" go: skladniki z dolu wedruja na gore,
    // kazdy podniesiony dokladnie o oktawe (to zawsze wystarcza dla trojdzwieku).
    function buildTriadNotes(rootNote, shapeName, inversion) {
        const shape = TRIAD_SHAPES[shapeName];
        const third = spellUp(rootNote, shape.third);
        const fifth = spellUp(rootNote, shape.fifth);
        const notes = [rootNote, third, fifth];
        for (let i = 0; i < inversion; i++) {
            const wrapped = notes.shift();
            notes.push({ letter: wrapped.letter, alter: wrapped.alter, octave: wrapped.octave + 1 });
        }
        return notes;
    }

    /* ---------- MusicXML: trzy dźwięki jako AKORD ---------- */
    function noteToPitchXml(note) {
        const alterTag = note.alter !== 0 ? '<alter>' + note.alter + '</alter>' : '';
        return '<pitch><step>' + note.letter + '</step>' + alterTag + '<octave>' + note.octave + '</octave></pitch>';
    }
    const ACCIDENTAL_NAMES = { '-2': 'flat-flat', '-1': 'flat', '1': 'sharp', '2': 'double-sharp' };
    function accidentalTag(note) {
        return note.alter !== 0 ? '<accidental>' + ACCIDENTAL_NAMES[String(note.alter)] + '</accidental>' : '';
    }
    function buildNoteXml(note, isChordTone) {
        return '<note>' + (isChordTone ? '<chord/>' : '') + noteToPitchXml(note) +
            '<duration>4</duration><type>whole</type>' + accidentalTag(note) + '</note>';
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
            '<time><beats>4</beats><beat-type>4</beat-type></time>' + clefTag + '</attributes>' +
            notes.map((n, i) => buildNoteXml(n, i > 0)).join('') +
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

    function renderMeasure(clef, notes) {
        const musicXml = buildMeasureMusicXML(clef, notes);
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
    let currentKey = null;
    let hasAnswered = false;

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;

    function pickClef() {
        const selected = document.getElementById('clef-select').value;
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }
    function currentLevel() {
        return document.getElementById('level-select').value;
    }
    function applyLevelVisibility() {
        const level = currentLevel();
        document.querySelectorAll('.level-2-only').forEach((btn) => {
            btn.style.display = level === '2' ? '' : 'none';
        });
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
        applyLevelVisibility();

        const level = currentLevel();
        const pool = Object.keys(TRIAD_TYPES).filter((k) => level === '2' || TRIAD_TYPES[k].level === 1);

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        const clef = pickClef();
        const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
        const rootLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];

        currentKey = pool[Math.floor(Math.random() * pool.length)];
        const type = TRIAD_TYPES[currentKey];
        const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };
        const notes = buildTriadNotes(rootNote, type.shape, type.inversion);

        try {
            await ensureVerovioReady();
            renderMeasure(clef, notes);
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function checkAnswer(selectedKey) {
        if (hasAnswered) return;
        hasAnswered = true;

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.key === currentKey) {
                btn.classList.add('is-correct');
            } else if (btn.dataset.key === selectedKey) {
                btn.classList.add('is-wrong');
            }
        });

        const feedback = document.getElementById('feedback');
        if (selectedKey === currentKey) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Poprawna odpowiedź: ' + TRIAD_TYPES[currentKey].label + '.';
        }

        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();

        document.getElementById('clef-select').addEventListener('change', generateNewQuestion);
        document.getElementById('level-select').addEventListener('change', generateNewQuestion);
        document.getElementById('next-btn').addEventListener('click', generateNewQuestion);
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
        });
    });
})();
