/* ksza.pl - trener trójdźwięków */
(function () {
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const BASS_OCTAVE_OPTIONS = [3, 4]; // mała/razkreślna - awaryjny zestaw, gdy zakres instrumentu jest za wąski

    // Offsety liczone od NAJNIŻSZEGO granego dźwięku (basu danej postaci), nie od
    // "prymy" akordu - nie trzeba śledzić harmonicznego prymu, liczy się struktura.
    const TRIAD_TYPES = [
        { key: 'durowy_z',     label: 'Durowy',                 offsets: [0, 4, 7], level: 1 },
        { key: 'molowy_z',     label: 'Molowy',                 offsets: [0, 3, 7], level: 1 },
        { key: 'zmniejszony',  label: 'Zmniejszony',            offsets: [0, 3, 6], level: 1 },
        { key: 'zwiekszony',   label: 'Zwiększony',             offsets: [0, 4, 8], level: 1 },
        { key: 'durowy_3',     label: 'Durowy - I przewrót',    offsets: [0, 3, 8], level: 2 },
        { key: 'durowy_5',     label: 'Durowy - II przewrót',   offsets: [0, 5, 9], level: 2 },
        { key: 'molowy_3',     label: 'Molowy - I przewrót',    offsets: [0, 4, 9], level: 2 },
        { key: 'molowy_5',     label: 'Molowy - II przewrót',   offsets: [0, 5, 8], level: 2 }
    ];

    const BASE_NOTE_DURATION = 0.9375;        // pojedynczy dźwięk w części melodycznej
    const BASE_GAP_BETWEEN_NOTES = 1.1875;    // odstęp między startami kolejnych dźwięków (melodycznie)
    const BASE_FINAL_NOTE_DURATION = 1.75;    // ostatni dźwięk części melodycznej - trzymany dłużej
    const BASE_HARMONIC_DURATION = 1.75;      // wszystkie dźwięki grane razem
    const BASE_MIXED_GAP = 1.0;               // cisza między częścią melodyczną a harmoniczną (tryb mieszany)

    let currentTriadType = null;
    let currentNotes = [];
    let hasAnswered = false;
    let isPlaying = false;
    let scheduledTimeouts = [];

    function noteAt(bassPc, semitoneOffset, bassOctave) {
        const total = bassPc + semitoneOffset;
        const pc = ((total % 12) + 12) % 12;
        const octave = bassOctave + Math.floor(total / 12);
        return CHROMATIC[pc] + octave;
    }

    function currentInstrument() {
        return document.getElementById('instrument-select').value;
    }

    // Bas (jako absolutny półton) tak, by cały akord zmieścił się w zakresie
    // instrumentu; gdyby się nie dało - awaryjnie generyczny zestaw oktaw.
    function pickBassAbsolute(maxOffset) {
        const range = KszaInstrumentRange.range(currentInstrument());
        let lo = range.min;
        let hi = range.max - maxOffset;
        if (hi < lo) {
            const oct = BASS_OCTAVE_OPTIONS[Math.floor(Math.random() * BASS_OCTAVE_OPTIONS.length)];
            lo = oct * 12;
            hi = lo + 11;
        }
        return lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        el.textContent = message || '';
        el.className = 'status-line' + (type ? ' status-' + type : '');
    }

    function onAudioState(state, message) {
        document.getElementById('play-btn').disabled = state === 'loading';
        if (state === 'error') setStatus(message, 'error');
        else if (state === 'loading') setStatus(message, null);
        else setStatus('', null);
    }

    function stopScheduled() {
        scheduledTimeouts.forEach((id) => clearTimeout(id));
        scheduledTimeouts = [];
        isPlaying = false;
        document.getElementById('play-btn').disabled = false;
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

    function generateNewTriad() {
        stopScheduled();
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('play-btn').style.display = 'inline-flex';

        applyLevelVisibility();

        const level = currentLevel();
        const pool = TRIAD_TYPES.filter((t) => level === '2' || t.level === 1);

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        currentTriadType = pool[Math.floor(Math.random() * pool.length)];

        const maxOffset = Math.max(...currentTriadType.offsets);
        const bassAbsolute = pickBassAbsolute(maxOffset);
        const bassPc = ((bassAbsolute % 12) + 12) % 12;
        const bassOctave = Math.floor(bassAbsolute / 12);
        currentNotes = currentTriadType.offsets.map((o) => noteAt(bassPc, o, bassOctave));
    }

    async function playCurrentTriad() {
        if (isPlaying) return;

        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopScheduled();
        isPlaying = true;
        document.getElementById('play-btn').disabled = true;
        KszaAudio.stopAll();

        function scheduleNote(note, delaySeconds, duration) {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration: duration });
            }, delaySeconds * 1000);
            scheduledTimeouts.push(id);
        }

        const speed = KszaTempo.get();
        const NOTE_DURATION = BASE_NOTE_DURATION / speed;
        const GAP_BETWEEN_NOTES = BASE_GAP_BETWEEN_NOTES / speed;
        const FINAL_NOTE_DURATION = BASE_FINAL_NOTE_DURATION / speed;
        const HARMONIC_DURATION = BASE_HARMONIC_DURATION / speed;
        const MIXED_GAP = BASE_MIXED_GAP / speed;

        const mode = document.getElementById('mode-select').value;
        const [n1, n2, n3] = currentNotes;
        let totalSeconds;

        if (mode === 'harmonic') {
            scheduleNote(n1, 0, HARMONIC_DURATION);
            scheduleNote(n2, 0, HARMONIC_DURATION);
            scheduleNote(n3, 0, HARMONIC_DURATION);
            totalSeconds = HARMONIC_DURATION;
        } else if (mode === 'mixed') {
            scheduleNote(n1, 0, NOTE_DURATION);
            scheduleNote(n2, GAP_BETWEEN_NOTES, NOTE_DURATION);
            scheduleNote(n3, GAP_BETWEEN_NOTES * 2, FINAL_NOTE_DURATION);
            const harmonicStart = GAP_BETWEEN_NOTES * 2 + FINAL_NOTE_DURATION + MIXED_GAP;
            scheduleNote(n1, harmonicStart, HARMONIC_DURATION);
            scheduleNote(n2, harmonicStart, HARMONIC_DURATION);
            scheduleNote(n3, harmonicStart, HARMONIC_DURATION);
            totalSeconds = harmonicStart + HARMONIC_DURATION;
        } else {
            scheduleNote(n1, 0, NOTE_DURATION);
            scheduleNote(n2, GAP_BETWEEN_NOTES, NOTE_DURATION);
            scheduleNote(n3, GAP_BETWEEN_NOTES * 2, FINAL_NOTE_DURATION);
            totalSeconds = GAP_BETWEEN_NOTES * 2 + FINAL_NOTE_DURATION;
        }

        const endId = setTimeout(() => {
            isPlaying = false;
            document.getElementById('play-btn').disabled = false;
        }, totalSeconds * 1000 + 150);
        scheduledTimeouts.push(endId);
    }

    function checkAnswer(selectedKey) {
        if (hasAnswered) return;
        hasAnswered = true;

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.key === currentTriadType.key) {
                btn.classList.add('is-correct');
            } else if (btn.dataset.key === selectedKey) {
                btn.classList.add('is-wrong');
            }
        });

        const feedback = document.getElementById('feedback');
        if (selectedKey === currentTriadType.key) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Poprawna odpowiedź: ' + currentTriadType.label + '.';
        }

        document.getElementById('play-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    function nextTriad() {
        generateNewTriad();
        setTimeout(playCurrentTriad, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewTriad();

        document.getElementById('play-btn').addEventListener('click', playCurrentTriad);
        document.getElementById('next-btn').addEventListener('click', nextTriad);
        document.getElementById('instrument-select').addEventListener('change', (e) => {
            KszaAudio.stopAll();
            stopScheduled();
            const shift = KszaInstrumentRange.fitOctaveShift(currentNotes, e.target.value);
            if (shift !== 0) {
                currentNotes = currentNotes.map((n) => KszaInstrumentRange.transposeNoteName(n, shift));
            }
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.getElementById('level-select').addEventListener('change', generateNewTriad);
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
        });
    });
})();
