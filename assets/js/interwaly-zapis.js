/* ksza.pl - interwały: rozpoznawanie zapisu nutowego.
   Czysto wzrokowe ćwiczenie (bez dźwięku) - pisownia enharmoniczna zgodna z
   zapisem (np. tercja mała od C to Es, nie Dis). */
(function () {
    const MT = KszaMusicTheory;

    // steps = liczba kroków literowych (0=pryma,1=sekunda...7=oktawa), semitones = półtony danej odmiany
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

    // Interwał do rozpoznania to dwa jednoczesne dźwięki - stąd <chord/>, nie melodia.
    function buildNoteXml(note, isChordTone) {
        return '<note>' + (isChordTone ? '<chord/>' : '') + MT.noteToPitchXml(note) +
            '<duration>4</duration><type>whole</type>' + MT.accidentalTag(note) + '</note>';
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

    function renderMeasure(clef, lowerNote, upperNote) {
        const svg = KszaVerovio.render(buildMeasureMusicXML(clef, lowerNote, upperNote), {
            pageWidth: 900,
            pageHeight: 260,
            scale: 60,
            adjustPageHeight: true,
            breaks: 'none'
        });
        document.getElementById('notation-container').innerHTML = svg;
    }

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
        const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

        const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };
        const upperNote = MT.spellByShape(rootNote, INTERVAL_DEFS[symbol], 1);

        currentSymbol = symbol;

        try {
            await KszaVerovio.ensureReady();
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
