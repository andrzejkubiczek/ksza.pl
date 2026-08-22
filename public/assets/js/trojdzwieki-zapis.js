(() => {
    const MT = KszaMusicTheory;

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

    function buildNoteXml(note, isChordTone) {
        return `<note>${isChordTone ? '<chord/>' : ''}${MT.noteToPitchXml(note)}<duration>4</duration><type>whole</type>${MT.accidentalTag(note)}</note>`;
    }

    function buildMeasureMusicXML(clef, notes) {
        const clefTag = clef === 'bass'
            ? '<clef><sign>F</sign><line>4</line></clef>'
            : '<clef><sign>G</sign><line>2</line></clef>';
        return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Trójdźwięk</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>${notes.map((n, i) => buildNoteXml(n, i > 0)).join('')}</measure></part></score-partwise>`;
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
    let hasAnswered = false;

    const TREBLE_ROOT_OCTAVE = 4;
    const BASS_ROOT_OCTAVE = 2;

    function pickClef() {
        const selected = document.getElementById('clef-select').value;
        if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
        return selected;
    }

    const currentLevel = () => document.getElementById('level-select').value;

    function applyLevelVisibility() {
        const level = currentLevel();
        document.querySelectorAll('.level-2-only').forEach((btn) => {
            btn.style.display = level === '2' ? '' : 'none';
        });
    }

    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        if (el) {
            el.textContent = message || '';
            el.className = `status-line${type ? ` status-${type}` : ''}`;
        }
    }

    async function generateNewQuestion() {
        hasAnswered = false;
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }
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
        const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];

        currentKey = pool[Math.floor(Math.random() * pool.length)];
        const type = TRIAD_TYPES[currentKey];
        const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };
        const notes = MT.buildTriadNotes(rootNote, type.shape, type.inversion);

        try {
            await KszaVerovio.ensureReady();
            renderMeasure(clef, notes);
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
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
        if (feedback) {
            if (selectedKey === currentKey) {
                feedback.className = 'feedback-msg feedback-correct';
                feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
            } else {
                feedback.className = 'feedback-msg feedback-wrong';
                feedback.textContent = `Niestety nie. Poprawna odpowiedź: ${TRIAD_TYPES[currentKey].label}.`;
            }
        }

        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();

        document.getElementById('clef-select')?.addEventListener('change', generateNewQuestion);
        document.getElementById('level-select')?.addEventListener('change', generateNewQuestion);
        document.getElementById('next-btn')?.addEventListener('click', generateNewQuestion);
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
        });
    });
})();
