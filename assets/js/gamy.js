/* ksza.pl - trener odmian gam */
(function () {
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const MAJOR_TONICS = [
        { name: 'C-dur', pc: 0 }, { name: 'G-dur', pc: 7 }, { name: 'D-dur', pc: 2 },
        { name: 'A-dur', pc: 9 }, { name: 'F-dur', pc: 5 }, { name: 'B-dur', pc: 10 },
        { name: 'Es-dur', pc: 3 }
    ];
    const MINOR_TONICS = [
        { name: 'a-moll', pc: 9 }, { name: 'e-moll', pc: 4 }, { name: 'h-moll', pc: 11 },
        { name: 'fis-moll', pc: 6 }, { name: 'd-moll', pc: 2 }, { name: 'g-moll', pc: 7 },
        { name: 'c-moll', pc: 0 }
    ];

    // "up" = przebieg w górę, "down": null = odwrócenie up. "dorycka" tu to
    // VI i VII podwyższone symetrycznie w obu kierunkach (nie klasyczny tryb
    // dorycki) - różni się od melodycznej tylko zejściem.
    const SCALE_TYPES = [
        { key: 'durowa',      label: 'Durowa',             tonics: MAJOR_TONICS, up: [0,2,4,5,7,9,11,12], down: null },
        { key: 'eolska',      label: 'Molowa eolska',      tonics: MINOR_TONICS, up: [0,2,3,5,7,8,10,12], down: null },
        { key: 'harmoniczna', label: 'Molowa harmoniczna', tonics: MINOR_TONICS, up: [0,2,3,5,7,8,11,12], down: null },
        { key: 'dorycka',     label: 'Molowa dorycka',     tonics: MINOR_TONICS, up: [0,2,3,5,7,9,11,12], down: null },
        { key: 'melodyczna',  label: 'Molowa melodyczna',  tonics: MINOR_TONICS, up: [0,2,3,5,7,9,11,12], down: [12,10,8,7,5,3,2,0] }
    ];

    const TONIC_OCTAVE_OPTIONS = [3, 4]; // awaryjne, patrz pickTonicOctave
    const BASE_NOTE_DURATION = 0.425;        // 0.34 * 1.25 - wolniej o 25% (I stopień, młodsze dzieci)
    const BASE_TURNAROUND_DURATION = 0.6875; // 0.55 * 1.25
    const BASE_TURNAROUND_GAP = 0.225;       // 0.18 * 1.25
    const TURNAROUND_INDEX = 7;       // pozycja punktu zwrotnego (sekwencja: 8 + 7 nut)
    const DIRECTIONS = ['up-down', 'down-up'];

    let currentScaleType = null;
    let currentTonic = null;
    let currentTonicOctave = 4;
    let currentDirection = 'up-down';
    let currentNoteNames = [];
    let hasAnswered = false;
    let isPlayingScale = false;
    let scheduledScaleTimeouts = []; // setTimeout ID-ki - pozwalaja niezawodnie anulowac zaplanowane nuty

    function noteAt(tonicPc, semitoneOffset, tonicOctave) {
        const total = tonicPc + semitoneOffset;
        const pc = ((total % 12) + 12) % 12;
        const octave = tonicOctave + Math.floor(total / 12);
        return CHROMATIC[pc] + octave;
    }

    function currentInstrument() {
        return document.getElementById('instrument-select').value;
    }

    // Oktawa toniki tak, by cała gama zmieściła się w zakresie instrumentu;
    // gdy żadna nie pasuje w całości (np. wąski zakres ksylofonu), bierzemy
    // tę z najmniejszym przekroczeniem zakresu.
    function pickTonicOctave(tonicPc, maxOffset) {
        const range = KszaInstrumentRange.range(currentInstrument());
        const candidates = [];
        for (let oct = 0; oct <= 8; oct++) {
            const abs = oct * 12 + tonicPc;
            if (abs >= range.min && abs + maxOffset <= range.max) candidates.push(oct);
        }
        if (candidates.length) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        let best = TONIC_OCTAVE_OPTIONS[0];
        let bestOverflow = Infinity;
        for (let oct = 0; oct <= 8; oct++) {
            const abs = oct * 12 + tonicPc;
            const overflow = Math.max(0, range.min - abs) + Math.max(0, (abs + maxOffset) - range.max);
            if (overflow < bestOverflow) {
                bestOverflow = overflow;
                best = oct;
            }
        }
        return best;
    }

    // Nuta w punkcie zwrotnym powtórzona - kończy jeden kierunek i zaczyna drugi.
    function buildScaleNoteNames(scaleType, tonic, direction, tonicOctave) {
        const upNotes = scaleType.up.map((o) => noteAt(tonic.pc, o, tonicOctave));
        const downOffsets = scaleType.down || [...scaleType.up].reverse();
        const downNotes = downOffsets.map((o) => noteAt(tonic.pc, o, tonicOctave));

        if (direction === 'down-up') {
            return downNotes.concat(upNotes);
        }
        return upNotes.concat(downNotes);
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

    function stopScheduledScale() {
        scheduledScaleTimeouts.forEach((id) => clearTimeout(id));
        scheduledScaleTimeouts = [];
        isPlayingScale = false;
        updatePlayButtonState();
    }

    function updatePlayButtonState() {
        const playBtn = document.getElementById('play-btn');
        playBtn.disabled = isPlayingScale;
        playBtn.innerHTML = isPlayingScale
            ? '<span class="play-icon" aria-hidden="true"></span><span>Gra...</span>'
            : '<span class="play-icon" aria-hidden="true"></span><span>Odtwórz gamę</span>';
    }

    function generateNewScale() {
        stopScheduledScale(); // gdyby poprzednia gama jeszcze grala - zatrzymaj ja od razu
        hasAnswered = false;
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        document.getElementById('play-btn').style.display = 'inline-flex';
        document.getElementById('next-btn').style.display = 'none';

        document.querySelectorAll('.scale-choice').forEach((btn) => {
            btn.disabled = false;
            btn.classList.remove('is-correct', 'is-wrong');
        });

        currentScaleType = SCALE_TYPES[Math.floor(Math.random() * SCALE_TYPES.length)];
        const tonics = currentScaleType.tonics;
        currentTonic = tonics[Math.floor(Math.random() * tonics.length)];
        currentDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const maxOffset = Math.max(...currentScaleType.up);
        currentTonicOctave = pickTonicOctave(currentTonic.pc, maxOffset);
        currentNoteNames = buildScaleNoteNames(currentScaleType, currentTonic, currentDirection, currentTonicOctave);
    }

    async function playCurrentScale() {
        if (isPlayingScale) return; // gama juz gra - ignorujemy kolejne klikniecie

        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopScheduledScale(); // na wszelki wypadek - zeruje tez isPlayingScale, wiec ustawiamy je PO
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
        if (selectedKey === currentScaleType.key) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! To prawidłowa odpowiedź.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Niestety nie. Poprawna odpowiedź: ' + currentScaleType.label + '.';
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

        document.getElementById('play-btn').addEventListener('click', playCurrentScale);
        document.getElementById('next-btn').addEventListener('click', nextScale);
        document.getElementById('instrument-select').addEventListener('change', (e) => {
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
