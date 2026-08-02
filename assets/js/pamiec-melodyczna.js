/* ksza.pl - pamięć melodyczna: usłysz krótką melodię, powtórz ją klikając
   klawisze. Klawiatura pokazuje zawsze tę samą oktawę (C4-C5) - poziom
   zmienia tylko pulę dźwięków, z której losuje się melodia, i jej długość.
   Sprawdzanie NIE blokuje niczego - jak w dyktandzie wysokościowym, uczeń
   czyści odpowiedź i próbuje ponownie, bez losowania nowej melodii. */
(function () {
    const WHITE_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const CHROMATIC_NOTES = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
    const BLACK_KEYS_AFTER = [
        { afterIndex: 0, note: 'C#4' },
        { afterIndex: 1, note: 'D#4' },
        { afterIndex: 3, note: 'F#4' },
        { afterIndex: 4, note: 'G#4' },
        { afterIndex: 5, note: 'A#4' }
    ];
    const WHITE_KEY_WIDTH = 46;
    const WHITE_KEY_HEIGHT = 170;
    const BLACK_KEY_WIDTH = 28;

    const LEVELS = {
        '1': { pool: WHITE_NOTES, length: 3 },
        '2': { pool: WHITE_NOTES, length: 4 },
        '3': { pool: CHROMATIC_NOTES, length: 4 },
        '4': { pool: CHROMATIC_NOTES, length: 5 },
        '5': { pool: CHROMATIC_NOTES, length: 6 }
    };

    const REFERENCE_NOTE = 'A4'; // a1 = 440 Hz, dźwięk odniesienia przed KAŻDYM odtworzeniem
    const REFERENCE_DURATION = 1.5; // cała nuta - ma pełnie wybrzmieć, bez ucinania
    const REFERENCE_GAP = 0.7;
    const BASE_NOTE_DURATION = 0.85;
    const CLICK_DURATION = 0.45;

    let targetSequence = [];
    let userSequence = [];
    let isPlaying = false;
    let scheduledTimeouts = [];

    function currentLevel() {
        return LEVELS[document.getElementById('level-select').value];
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

    async function ensureInstrumentReady() {
        return KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
    }

    /* ---------- Klawiatura ---------- */
    function buildKeyboardHtml() {
        const totalWidth = WHITE_NOTES.length * WHITE_KEY_WIDTH;
        let whiteHtml = '';
        let blackHtml = '';

        WHITE_NOTES.forEach((note, i) => {
            whiteHtml += '<button type="button" class="echo-white-key" data-note="' + note + '" ' +
                'style="left:' + (i * WHITE_KEY_WIDTH) + 'px;width:' + WHITE_KEY_WIDTH + 'px;" ' +
                'aria-label="Zagraj ' + note + '"></button>';
        });

        BLACK_KEYS_AFTER.forEach((bk) => {
            const centerX = (bk.afterIndex + 1) * WHITE_KEY_WIDTH;
            const left = centerX - BLACK_KEY_WIDTH / 2;
            blackHtml += '<button type="button" class="echo-black-key" data-note="' + bk.note + '" ' +
                'style="left:' + left + 'px;width:' + BLACK_KEY_WIDTH + 'px;" ' +
                'aria-label="Zagraj ' + bk.note + '"></button>';
        });

        return '<div class="echo-keyboard" style="width:' + totalWidth + 'px;height:' + WHITE_KEY_HEIGHT + 'px;">' +
            whiteHtml + blackHtml + '</div>';
    }

    /* ---------- Ślad odpowiedzi ---------- */
    function renderTrail() {
        const trail = document.getElementById('answer-trail');
        trail.innerHTML = '';
        for (let i = 0; i < targetSequence.length; i++) {
            const slot = document.createElement('span');
            slot.className = 'answer-slot' + (i < userSequence.length ? ' is-filled' : '');
            trail.appendChild(slot);
        }
    }

    /* ---------- Generowanie melodii ---------- */
    function generateSequence() {
        const level = currentLevel();
        const seq = [];
        for (let i = 0; i < level.length; i++) {
            seq.push(level.pool[Math.floor(Math.random() * level.pool.length)]);
        }
        return seq;
    }

    function generateNewQuestion() {
        stopScheduled();
        targetSequence = generateSequence();
        userSequence = [];

        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('check-btn').disabled = true;
        renderTrail();
    }

    /* ---------- Odtwarzanie melodii ---------- */
    function stopScheduled() {
        scheduledTimeouts.forEach((id) => clearTimeout(id));
        scheduledTimeouts = [];
        isPlaying = false;
        document.getElementById('play-btn').disabled = false;
    }

    async function playTarget() {
        if (isPlaying) return;
        const ok = await ensureInstrumentReady();
        if (!ok || !KszaAudio.player) return;

        stopScheduled();
        isPlaying = true;
        document.getElementById('play-btn').disabled = true;
        KszaAudio.stopAll();

        const speed = KszaTempo.get();
        const referenceDuration = REFERENCE_DURATION / speed;
        const referenceGap = REFERENCE_GAP / speed;
        const noteDuration = BASE_NOTE_DURATION / speed;
        const melodyStart = referenceDuration + referenceGap;

        // dźwięk odniesienia gra pełną długość, bez ucinania - ma wybrzmieć
        const refId = setTimeout(() => {
            if (KszaAudio.player) KszaAudio.player.play(REFERENCE_NOTE, undefined, { duration: referenceDuration });
        }, 0);
        scheduledTimeouts.push(refId);

        targetSequence.forEach((note, i) => {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration: noteDuration * 0.85 });
            }, (melodyStart + i * noteDuration) * 1000);
            scheduledTimeouts.push(id);
        });

        const totalDuration = melodyStart + targetSequence.length * noteDuration;
        const endId = setTimeout(() => {
            isPlaying = false;
            document.getElementById('play-btn').disabled = false;
        }, totalDuration * 1000 + 150);
        scheduledTimeouts.push(endId);
    }

    /* ---------- Odpowiedź ucznia ---------- */
    async function handleKeyClick(note) {
        if (userSequence.length >= targetSequence.length) return;
        const ok = await ensureInstrumentReady();
        if (!ok || !KszaAudio.player) return;

        KszaAudio.player.play(note, undefined, { duration: CLICK_DURATION });
        userSequence.push(note);
        renderTrail();
        document.getElementById('check-btn').disabled = userSequence.length !== targetSequence.length;
    }

    function resetAnswer() {
        userSequence = [];
        renderTrail();
        document.getElementById('check-btn').disabled = true;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
    }

    function checkAnswer() {
        const slots = document.querySelectorAll('.answer-slot');
        let allCorrect = true;
        userSequence.forEach((note, i) => {
            const correct = note === targetSequence[i];
            slots[i].classList.remove('is-filled');
            slots[i].classList.add(correct ? 'is-correct' : 'is-wrong');
            if (!correct) allCorrect = false;
        });

        document.getElementById('check-btn').disabled = true;

        const feedback = document.getElementById('feedback');
        if (allCorrect) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Brawo! Cała melodia poprawna.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niektóre dźwięki nie pasują - wyczyść odpowiedź i spróbuj ponownie.';
        }
        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    function nextQuestion() {
        generateNewQuestion();
        setTimeout(playTarget, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('echo-keyboard-mount').innerHTML = buildKeyboardHtml();
        document.querySelectorAll('.echo-white-key, .echo-black-key').forEach((btn) => {
            btn.addEventListener('click', () => handleKeyClick(btn.dataset.note));
        });

        generateNewQuestion();

        document.getElementById('level-select').addEventListener('change', generateNewQuestion);
        document.getElementById('instrument-select').addEventListener('change', (e) => {
            stopScheduled();
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.getElementById('play-btn').addEventListener('click', playTarget);
        document.getElementById('reset-btn').addEventListener('click', resetAnswer);
        document.getElementById('check-btn').addEventListener('click', checkAnswer);
        document.getElementById('next-btn').addEventListener('click', nextQuestion);
    });
})();
