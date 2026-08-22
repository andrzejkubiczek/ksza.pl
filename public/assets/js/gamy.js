(() => {
    const ST = KszaScaleTonics;

    const SCALE_TYPES = [
        { key: 'durowa',      label: 'Durowa',             tonics: ST.MAJOR_TONICS, up: [0, 2, 4, 5, 7, 9, 11, 12], down: null },
        { key: 'eolska',      label: 'Molowa eolska',      tonics: ST.MINOR_TONICS, up: [0, 2, 3, 5, 7, 8, 10, 12], down: null },
        { key: 'harmoniczna', label: 'Molowa harmoniczna', tonics: ST.MINOR_TONICS, up: [0, 2, 3, 5, 7, 8, 11, 12], down: null },
        { key: 'dorycka',     label: 'Molowa dorycka',     tonics: ST.MINOR_TONICS, up: [0, 2, 3, 5, 7, 9, 11, 12], down: null },
        { key: 'melodyczna',  label: 'Molowa melodyczna',  tonics: ST.MINOR_TONICS, up: [0, 2, 3, 5, 7, 9, 11, 12], down: [12, 10, 8, 7, 5, 3, 2, 0] }
    ];

    const BASE_NOTE_DURATION = 0.425;
    const BASE_TURNAROUND_DURATION = 0.6875;
    const BASE_TURNAROUND_GAP = 0.225;
    const TURNAROUND_INDEX = 7;
    const DIRECTIONS = ['up-down', 'down-up'];

    let currentScaleType = null;
    let currentTonic = null;
    let currentTonicOctave = 4;
    let currentDirection = 'up-down';
    let currentNoteNames = [];
    let hasAnswered = false;
    let isPlayingScale = false;
    let scheduledScaleTimeouts = [];

    const currentInstrument = () => document.getElementById('instrument-select').value;

    function buildScaleNoteNames(scaleType, tonic, direction, tonicOctave) {
        const upNotes = scaleType.up.map((o) => ST.noteAt(tonic.pc, o, tonicOctave));
        const downOffsets = scaleType.down || [...scaleType.up].reverse();
        const downNotes = downOffsets.map((o) => ST.noteAt(tonic.pc, o, tonicOctave));

        if (direction === 'down-up') {
            return downNotes.concat(upNotes);
        }
        return upNotes.concat(downNotes);
    }

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

    function stopScheduledScale() {
        scheduledScaleTimeouts.forEach((id) => clearTimeout(id));
        scheduledScaleTimeouts = [];
        isPlayingScale = false;
        updatePlayButtonState();
    }

    function updatePlayButtonState() {
        const playBtn = document.getElementById('play-btn');
        if (!playBtn) return;
        playBtn.disabled = isPlayingScale;
        playBtn.innerHTML = isPlayingScale
            ? '<span class="play-icon" aria-hidden="true"></span><span>Gra...</span>'
            : '<span class="play-icon" aria-hidden="true"></span><span>Odtwórz gamę</span>';
    }

    function generateNewScale() {
        stopScheduledScale();
        hasAnswered = false;
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback-msg';
        }
        document.getElementById('play-btn').style.display = 'inline-flex';
        document.getElementById('next-btn').style.display = 'none';

        document.querySelectorAll('.scale-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        currentScaleType = SCALE_TYPES[Math.floor(Math.random() * SCALE_TYPES.length)];
        const { tonics } = currentScaleType;
        currentTonic = tonics[Math.floor(Math.random() * tonics.length)];
        currentDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const maxOffset = Math.max(...currentScaleType.up);
        currentTonicOctave = ST.pickTonicOctave(currentTonic.pc, maxOffset, currentInstrument());
        currentNoteNames = buildScaleNoteNames(currentScaleType, currentTonic, currentDirection, currentTonicOctave);
    }

    async function playCurrentScale() {
        if (isPlayingScale) return;

        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopScheduledScale();
        isPlayingScale = true;
        updatePlayButtonState();
        KszaAudio.stopAll();

        const speed = KszaTempo.get();
        const NOTE_DURATION = BASE_NOTE_DURATION / speed;
        const TURNAROUND_DURATION = BASE_TURNAROUND_DURATION / speed;
        const TURNAROUND_GAP = BASE_TURNAROUND_GAP / speed;

        let cursor = 0;
        currentNoteNames.forEach((note, i) => {
            const isTurnaround = i === TURNAROUND_INDEX;
            const duration = isTurnaround ? TURNAROUND_DURATION : NOTE_DURATION;
            const delayMs = cursor * 1000;
            const timeoutId = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration: duration * 0.92 });
            }, delayMs);
            scheduledScaleTimeouts.push(timeoutId);
            cursor += duration;
            if (isTurnaround) cursor += TURNAROUND_GAP;
        });

        const endTimeoutId = setTimeout(() => {
            isPlayingScale = false;
            updatePlayButtonState();
        }, cursor * 1000 + 150);
        scheduledScaleTimeouts.push(endTimeoutId);
    }

    function checkAnswer(selectedKey) {
        if (hasAnswered) return;
        hasAnswered = true;

        document.querySelectorAll('.scale-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.key === currentScaleType.key) {
                btn.classList.add('is-correct');
            } else if (btn.dataset.key === selectedKey) {
                btn.classList.add('is-wrong');
            }
        });

        const feedback = document.getElementById('feedback');
        if (feedback) {
            if (selectedKey === currentScaleType.key) {
                feedback.className = 'feedback-msg feedback-correct';
                feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
            } else {
                feedback.className = 'feedback-msg feedback-wrong';
                feedback.textContent = `Niestety nie. Poprawna odpowiedź: ${currentScaleType.label}.`;
            }
        }

        document.getElementById('play-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    function nextScale() {
        generateNewScale();
        setTimeout(playCurrentScale, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewScale();

        document.getElementById('play-btn')?.addEventListener('click', playCurrentScale);
        document.getElementById('next-btn')?.addEventListener('click', nextScale);
        document.getElementById('instrument-select')?.addEventListener('change', (e) => {
            KszaAudio.stopAll();
            stopScheduledScale();
            const shift = KszaInstrumentRange.fitOctaveShift(currentNoteNames, e.target.value);
            if (shift !== 0) {
                currentNoteNames = currentNoteNames.map((n) => KszaInstrumentRange.transposeNoteName(n, shift));
            }
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.querySelectorAll('.scale-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
        });
    });
})();
