/* ksza.pl - trener interwałów */
(function () {
    const notesArray = [
        'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
        'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
        'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
    ];

    const intervals = [
        { semitones: 0, symbol: '1' }, { semitones: 1, symbol: '2>' }, { semitones: 2, symbol: '2' },
        { semitones: 3, symbol: '3>' }, { semitones: 4, symbol: '3' }, { semitones: 5, symbol: '4' },
        { semitones: 6, symbol: '4<' }, { semitones: 7, symbol: '5' }, { semitones: 8, symbol: '6>' },
        { semitones: 9, symbol: '6' }, { semitones: 10, symbol: '7' }, { semitones: 11, symbol: '7<' },
        { semitones: 12, symbol: '8' }
    ];

    const BASE_NOTE_DURATION = 0.9375;        // 0.75 * 1.25 - wolniej o 25% (I stopień, młodsze dzieci)
    const BASE_GAP_BEFORE_SECOND = 1.1875;    // 0.95 * 1.25
    const BASE_SECOND_NOTE_DURATION = 1.75;   // 1.4 * 1.25
    const BASE_HARMONIC_DURATION = 1.75;      // czas trwania obu dźwięków granych razem (tryb harmoniczny/mieszany)
    const BASE_MIXED_GAP = 1.0;               // cisza między częścią melodyczną a harmoniczną w trybie mieszanym

    const ARRAY_BASE_SEMITONE = KszaInstrumentRange.toSemitone(notesArray[0]); // C3

    let currentInterval = null;
    let firstNoteName = '';
    let secondNoteName = '';
    let hasAnswered = false;
    let isPlayingInterval = false;
    let scheduledIntervalTimeouts = [];

    function currentInstrument() {
        return document.getElementById('instrument-select').value;
    }

    // Indeks startowy tak, by cały interwał zmieścił się w zakresie instrumentu.
    // notesArray ma twardy sufit (B5) - gdy się nie da zmieścić w całości
    // (np. ksylofon + oktawa), bierzemy pozycję najbliższą temu zakresowi.
    function pickStartIndex(semitones) {
        const range = KszaInstrumentRange.range(currentInstrument());
        const arrayMaxIdx = notesArray.length - 1 - semitones;
        let minIdx = Math.max(0, range.min - ARRAY_BASE_SEMITONE);
        let maxIdx = Math.min(arrayMaxIdx, range.max - ARRAY_BASE_SEMITONE - semitones);
        if (maxIdx < minIdx) {
            minIdx = Math.max(0, Math.min(minIdx, arrayMaxIdx));
            maxIdx = minIdx;
        }
        return minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1));
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

    function stopScheduledInterval() {
        scheduledIntervalTimeouts.forEach((id) => clearTimeout(id));
        scheduledIntervalTimeouts = [];
        isPlayingInterval = false;
        document.getElementById('play-btn').disabled = false;
    }

    function generateNewInterval() {
        stopScheduledInterval();
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('play-btn').style.display = 'inline-flex';

        document.querySelectorAll('.interval-choice').forEach((b) => b.removeAttribute('disabled'));

        currentInterval = intervals[Math.floor(Math.random() * intervals.length)];
        const startIndex = pickStartIndex(currentInterval.semitones);

        const lowerNote = notesArray[startIndex];
        const higherNote = notesArray[startIndex + currentInterval.semitones];
        const playAscending = Math.random() > 0.5;

        if (playAscending || currentInterval.semitones === 0) {
            firstNoteName = lowerNote;
            secondNoteName = higherNote;
        } else {
            firstNoteName = higherNote;
            secondNoteName = lowerNote;
        }
    }

    async function playCurrentInterval() {
        if (isPlayingInterval) return; // interwał juz gra - ignorujemy kolejne klikniecie

        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopScheduledInterval();
        isPlayingInterval = true;
        document.getElementById('play-btn').disabled = true;
        KszaAudio.stopAll();

        function scheduleNote(note, delaySeconds, duration) {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(note, undefined, { duration: duration });
            }, delaySeconds * 1000);
            scheduledIntervalTimeouts.push(id);
        }

        // Mnożnik z suwaka - większy = szybciej, mniejszy = wolniej.
        const speed = KszaTempo.get();
        const NOTE_DURATION = BASE_NOTE_DURATION / speed;
        const GAP_BEFORE_SECOND = BASE_GAP_BEFORE_SECOND / speed;
        const SECOND_NOTE_DURATION = BASE_SECOND_NOTE_DURATION / speed;
        const HARMONIC_DURATION = BASE_HARMONIC_DURATION / speed;
        const MIXED_GAP = BASE_MIXED_GAP / speed;

        const mode = document.getElementById('mode-select').value;
        let totalSeconds;

        if (mode === 'harmonic') {
            scheduleNote(firstNoteName, 0, HARMONIC_DURATION);
            scheduleNote(secondNoteName, 0, HARMONIC_DURATION);
            totalSeconds = HARMONIC_DURATION;
        } else if (mode === 'mixed') {
            scheduleNote(firstNoteName, 0, NOTE_DURATION);
            scheduleNote(secondNoteName, GAP_BEFORE_SECOND, SECOND_NOTE_DURATION);
            const harmonicStart = GAP_BEFORE_SECOND + SECOND_NOTE_DURATION + MIXED_GAP;
            scheduleNote(firstNoteName, harmonicStart, HARMONIC_DURATION);
            scheduleNote(secondNoteName, harmonicStart, HARMONIC_DURATION);
            totalSeconds = harmonicStart + HARMONIC_DURATION;
        } else {
            scheduleNote(firstNoteName, 0, NOTE_DURATION);
            scheduleNote(secondNoteName, GAP_BEFORE_SECOND, SECOND_NOTE_DURATION);
            totalSeconds = GAP_BEFORE_SECOND + SECOND_NOTE_DURATION;
        }

        const endId = setTimeout(() => {
            isPlayingInterval = false;
            document.getElementById('play-btn').disabled = false;
        }, totalSeconds * 1000 + 150);
        scheduledIntervalTimeouts.push(endId);
    }

    function checkAnswer(selectedSymbol) {
        if (hasAnswered) return;
        hasAnswered = true;

        document.querySelectorAll('.interval-choice').forEach((b) => b.setAttribute('disabled', 'true'));

        const feedback = document.getElementById('feedback');
        if (selectedSymbol === currentInterval.symbol) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Poprawna odpowiedź: ' + currentInterval.symbol + '.';
        }

        document.getElementById('play-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
    }

    function nextInterval() {
        generateNewInterval();
        setTimeout(playCurrentInterval, 250);
    }

    document.addEventListener('DOMContentLoaded', () => {
        generateNewInterval();

        document.getElementById('play-btn').addEventListener('click', playCurrentInterval);
        document.getElementById('next-btn').addEventListener('click', nextInterval);
        document.getElementById('instrument-select').addEventListener('change', (e) => {
            KszaAudio.stopAll();
            stopScheduledInterval();
            const shift = KszaInstrumentRange.fitOctaveShift([firstNoteName, secondNoteName], e.target.value);
            if (shift !== 0) {
                firstNoteName = KszaInstrumentRange.transposeNoteName(firstNoteName, shift);
                secondNoteName = KszaInstrumentRange.transposeNoteName(secondNoteName, shift);
            }
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.querySelectorAll('.interval-choice').forEach((btn) => {
            btn.addEventListener('click', () => checkAnswer(btn.dataset.symbol));
        });
    });
})();
