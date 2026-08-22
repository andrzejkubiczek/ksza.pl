(() => {
    const ST = KszaScaleTonics;
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    const SCALE_TYPES = [
        { key: 'durowa', label: 'Durowa', tonics: ST.MAJOR_TONICS, degrees: [0, 2, 4, 5, 7, 9, 11, 12], level: 1 },
        { key: 'harmoniczna', label: 'Molowa harmoniczna', tonics: ST.MINOR_TONICS, degrees: [0, 2, 3, 5, 7, 8, 11, 12], level: 2 }
    ];

    const BASE_NOTE_DURATION = 0.4;
    const BASE_GAP_AFTER_SCALE = 0.55;
    const BASE_TARGET_DURATION = 0.85;
    const BASE_TARGET_GAP = 0.15;

    let currentScaleType = null;
    let currentTonic = null;
    let currentTonicOctave = 4;
    let currentDegreeIndex = 0;
    let currentNoteNames = [];
    let hasAnswered = false;
    let isPlaying = false;
    let scheduledTimeouts = [];

    const currentInstrument = () => document.getElementById('instrument-select').value;
    const currentLevel = () => document.getElementById('level-select').value;

    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        if (el) {
            el.textContent = message || '';
            el.className = `status-line${type ? ` status-${type}` : ''}`;
        }
    }

    function onAudioState(state, message) {
        const playBtn = document.getElementById('play-btn');
        if (playBtn) playBtn.disabled = state === 'loading';
        if (state === 'error') setStatus(message, 'error');
        else if (state === 'loading') setStatus(message, null);
        else setStatus('', null);
    }

    function stopPlayback() {
        scheduledTimeouts.forEach((id) => clearTimeout(id));
        scheduledTimeouts = [];
        isPlaying = false;
        updatePlayButtonState();
    }

    function updatePlayButtonState() {
        const btn = document.getElementById('play-btn');
        if (!btn) return;
        btn.disabled = isPlaying;
        btn.innerHTML = isPlaying
            ? '<span class="play-icon" aria-hidden="true"></span><span>Gra...</span>'
            : '<span class="play-icon" aria-hidden="true"></span><span>Odtwórz</span>';
    }

    function generateNewQuestion() {
        stopPlayback();
        hasAnswered = false;
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }
        document.getElementById('play-btn').style.display = 'inline-flex';
        document.getElementById('next-btn').style.display = 'none';

        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        const level = currentLevel();
        const pool = SCALE_TYPES.filter((t) => level === '2' || t.level === 1);
        currentScaleType = pool[Math.floor(Math.random() * pool.length)];
        const { tonics } = currentScaleType;
        currentTonic = tonics[Math.floor(Math.random() * tonics.length)];
        currentTonicOctave = ST.pickTonicOctave(currentTonic.pc, 12, currentInstrument());
        currentDegreeIndex = Math.floor(Math.random() * 8);
        currentNoteNames = currentScaleType.degrees.map((o) => ST.noteAt(currentTonic.pc, o, currentTonicOctave));
    }

    async function playQuestion() {
        if (isPlaying) return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopPlayback();
        isPlaying = true;
        updatePlayButtonState();
        KszaAudio.stopAll();

        const speed = KszaTempo.get();
        const NOTE_DURATION = BASE_NOTE_DURATION / speed;
        const GAP_AFTER_SCALE = BASE_GAP_AFTER_SCALE / speed;
        const TARGET_DURATION = BASE_TARGET_DURATION / speed;
        const TARGET_GAP = BASE_TARGET_GAP / speed;

        const scheduleNote = (note, delaySeconds, duration) => {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration });
            }, delaySeconds * 1000);
            scheduledTimeouts.push(id);
        };

        let cursor = 0;
        currentNoteNames.forEach((note) => {
            scheduleNote(note, cursor, NOTE_DURATION);
            cursor += NOTE_DURATION;
        });
        cursor += GAP_AFTER_SCALE;

        const target = currentNoteNames[currentDegreeIndex];
        scheduleNote(target, cursor, TARGET_DURATION);
        cursor += TARGET_DURATION + TARGET_GAP;
        scheduleNote(target, cursor, TARGET_DURATION);
        cursor += TARGET_DURATION;

        const endId = setTimeout(() => {
            isPlaying = false;
            updatePlayButtonState();
        }, cursor * 1000 + 150);
        scheduledTimeouts.push(endId);
    }

    function checkAnswer(selectedDegree) {
        if (hasAnswered) return;
        hasAnswered = true;

        const correctDegree = String(currentDegreeIndex + 1);
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.key === correctDegree) btn.classList.add('is-correct');
            else if (btn.dataset.key === selectedDegree) btn.classList.add('is-wrong');
        });

        const feedback = document.getElementById('feedback');
        if (feedback) {
            if (selectedDegree === correctDegree) {
                feedback.className = 'feedback-msg feedback-correct';
                feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
            } else {
                feedback.className = 'feedback-msg feedback-wrong';
                feedback.textContent = `Niestety nie. Poprawna odpowiedź: stopień ${ROMAN[currentDegreeIndex]}.`;
            }
        }

        document.getElementById('play-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    function nextQuestion() {
        generateNewQuestion();
        setTimeout(playQuestion, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewQuestion();

        document.getElementById('play-btn')?.addEventListener('click', playQuestion);
        document.getElementById('next-btn')?.addEventListener('click', nextQuestion);
        document.getElementById('level-select')?.addEventListener('change', generateNewQuestion);
        document.getElementById('instrument-select')?.addEventListener('change', (e) => {
            KszaAudio.stopAll();
            stopPlayback();
            const shift = KszaInstrumentRange.fitOctaveShift(currentNoteNames, e.target.value);
            if (shift !== 0) {
                currentNoteNames = currentNoteNames.map((n) => KszaInstrumentRange.transposeNoteName(n, shift));
            }
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
        });
    });
})();
