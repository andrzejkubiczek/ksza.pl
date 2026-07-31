/* ksza.pl - dyktanda: puzzle w wersji zapisu nutowego
   Ta sama lista dyktand (dyktanda.json) i te same pliki MusicXML co w
   wersji "ze słuchu" - silnik odtwarzania jest identyczny (dziecko musi
   móc posłuchać dyktanda w obu wersjach), dodatkowo każdy takt jest też
   rysowany przez Verovio na karcie puzzli.

   Każdy takt to osobny, samodzielny dokument MusicXML z tym samym kluczem/
   metrum/tonacją co cały utwór (z pierwszego taktu) - żeby żaden fragment
   nie zdradzał, który jest naprawdę pierwszy w kolejności. Nuty w każdym
   takcie to dosłowna kopia oryginalnego XML-a (przez XMLSerializer), więc
   wiązania, kropki i inne szczegóły zapisu zostają takie, jak w źródle. */
(function () {
    const TEMPO_SLOWDOWN = 1.25;

    /* ---------- Parser MusicXML: audio (events) + notacja (surowy XML) razem ---------- */
    function parseMusicXML(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        if (xml.querySelector('parsererror')) {
            throw new Error('Plik nie jest poprawnym XML-em (uszkodzony lub to nie jest plik MusicXML).');
        }

        const part = xml.querySelector('part');
        if (!part) {
            throw new Error('Nie znaleziono elementu <part> - to nie wygląda na plik MusicXML.');
        }

        const measureEls = Array.from(part.querySelectorAll('measure'));
        const firstAttrs = measureEls.length ? measureEls[0].querySelector('attributes') : null;

        function attrText(selector, fallback) {
            const el = firstAttrs ? firstAttrs.querySelector(selector) : null;
            return el ? el.textContent : fallback;
        }

        const notationHeaderXml =
            '<attributes><divisions>' + attrText('divisions', '1') + '</divisions>' +
            '<key><fifths>' + attrText('key fifths', '0') + '</fifths></key>' +
            '<time><beats>' + attrText('time beats', '4') + '</beats>' +
            '<beat-type>' + attrText('time beat-type', '4') + '</beat-type></time>' +
            '<clef><sign>' + attrText('clef sign', 'G') + '</sign>' +
            '<line>' + attrText('clef line', '2') + '</line></clef>' +
            '</attributes>';

        let divisions = 1;
        let tempoBPM = 96;
        const serializer = new XMLSerializer();
        const fragments = [];
        let pendingTie = null;

        measureEls.forEach((measure) => {
            const events = [];
            const noteEls = [];

            Array.from(measure.children).forEach((el) => {
                const tag = el.tagName;

                if (tag === 'attributes') {
                    const divEl = el.querySelector('divisions');
                    if (divEl) divisions = parseInt(divEl.textContent, 10) || divisions;
                } else if (tag === 'direction') {
                    const soundEl = el.querySelector('sound[tempo]');
                    if (soundEl) {
                        const t = parseFloat(soundEl.getAttribute('tempo'));
                        if (t) tempoBPM = t;
                    }
                } else if (tag === 'note') {
                    noteEls.push(el);
                    if (el.querySelector('chord') || el.querySelector('grace')) return;

                    const durationEl = el.querySelector('duration');
                    if (!durationEl) return;
                    const beats = parseInt(durationEl.textContent, 10) / divisions;

                    const isRest = !!el.querySelector('rest');
                    const tieStart = !!el.querySelector('tie[type="start"]');
                    const tieStop = !!el.querySelector('tie[type="stop"]');

                    let pitchName = null;
                    if (!isRest) {
                        const pitchEl = el.querySelector('pitch');
                        const step = pitchEl.querySelector('step').textContent;
                        const octave = pitchEl.querySelector('octave').textContent;
                        const alterEl = pitchEl.querySelector('alter');
                        const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
                        const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : alter === 2 ? '##' : alter === -2 ? 'bb' : '';
                        pitchName = step + accidental + octave;
                    }

                    if (tieStop && pendingTie && pendingTie.pitch === pitchName) {
                        pendingTie.event.beats += beats;
                        pendingTie = tieStart ? pendingTie : null;
                    } else {
                        const event = { pitch: pitchName, beats: beats };
                        events.push(event);
                        pendingTie = tieStart ? { pitch: pitchName, event: event } : null;
                    }
                }
            });

            if (events.length > 0) {
                const notationXml = notationHeaderXml + noteEls.map((n) => serializer.serializeToString(n)).join('');
                fragments.push({ events: events, notationXml: notationXml });
            }
        });

        if (fragments.length < 2) {
            throw new Error('Dyktando musi mieć co najmniej 2 takty z nutami, żeby dało się ułożyć puzzle.');
        }

        return { fragments: fragments, tempoBPM: tempoBPM };
    }

    function buildFragmentMusicXML(innerXml) {
        // print-object="no" - nazwa "Dyktando" jest w danych, ale nieukazywana (Verovio nie rysuje incipitu).
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<score-partwise version="4.0">' +
            '<part-list><score-part id="P1"><part-name print-object="no">Dyktando</part-name></score-part></part-list>' +
            '<part id="P1"><measure number="1">' + innerXml + '</measure></part></score-partwise>';
    }

    /* ---------- Verovio ---------- */
    let verovioToolkit = null;
    let verovioReadyPromise = null;

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

            tryInit();
        });
        return verovioReadyPromise;
    }

    function renderFragmentSvg(notationXml) {
        // Domyślne marginesy strony Verovio (50px z każdej strony) NIE skalują się
        // z "scale" - przy małym fragmencie potrafią pochłonąć większość wysokości.
        // Zmniejszone tutaj, żeby w tej samej ramce CSS zostało miejsce na nuty.
        return verovioToolkit.renderData(buildFragmentMusicXML(notationXml), {
            pageWidth: 380,
            pageHeight: 110,
            scale: 90,
            pageMarginTop: 15,
            pageMarginBottom: 15,
            pageMarginLeft: 15,
            pageMarginRight: 15,
            adjustPageHeight: true,
            breaks: 'none'
        });
    }

    /* ---------- Stan ---------- */
    const dictationLibrary = {};
    const dictationSources = {};

    let activeDictation = null;
    let displayOrder = [];
    let fragmentNumberMap = {};
    let sortableInstance = null;

    let fullPlaybackTimeline = [];
    let fullPlaybackTotalDuration = 0;
    let playbackState = 'stopped';
    let scheduleStartWallClock = 0;
    let scheduleStartOffset = 0;
    let scheduleSpeed = 1;
    let pausedOffset = 0;
    let scheduledTimeouts = [];
    let scheduledSimpleTimeouts = [];
    let playbackWatcher = null;

    /* ---------- UI ---------- */
    function setStatus(message, type) {
        const el = document.getElementById('status-line');
        el.textContent = message || '';
        el.className = 'status-line' + (type ? ' status-' + type : '');
    }

    function onAudioState(state, message) {
        setPlayControlsDisabled(state === 'loading');
        if (state === 'error') setStatus(message, 'error');
        else if (state === 'loading') setStatus(message, null);
        else setStatus('', null);
    }

    function setPlayControlsDisabled(disabled) {
        ['play-full-btn', 'pause-btn', 'resume-btn', 'restart-btn'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
    }

    /* ---------- Proste odtwarzanie (fragment / mój układ) ---------- */
    function playEvents(events, tempoBPM) {
        if (!KszaAudio.player) return;
        stopAllPlayback();

        const quarterSeconds = (60 / tempoBPM) * TEMPO_SLOWDOWN / KszaTempo.get();
        let cursor = 0;

        events.forEach((e) => {
            const durSeconds = e.beats * quarterSeconds;
            if (e.pitch) {
                const duration = durSeconds * 0.92;
                const id = setTimeout(() => {
                    if (KszaAudio.player) KszaAudio.player.play(e.pitch, undefined, { duration: duration });
                }, cursor * 1000);
                scheduledSimpleTimeouts.push(id);
            }
            cursor += durSeconds;
        });
    }

    async function playFragmentByOriginalIndex(originalIndex) {
        if (!activeDictation) return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok) return;
        playEvents(activeDictation.fragments[originalIndex].events, activeDictation.tempoBPM);
    }

    async function playCurrentArrangement() {
        if (!activeDictation) return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok) return;
        const ordered = [].concat(...displayOrder.map((i) => activeDictation.fragments[i].events));
        playEvents(ordered, activeDictation.tempoBPM);
    }

    /* ---------- Silnik pełnego odtwarzania z pauzą (jak w dyktanda.js) ---------- */
    function buildFullPlaybackTimeline() {
        fullPlaybackTimeline = [];
        fullPlaybackTotalDuration = 0;
        if (!activeDictation) return;

        const quarterSeconds = (60 / activeDictation.tempoBPM) * TEMPO_SLOWDOWN;
        const allEvents = [].concat(...activeDictation.fragments.map((f) => f.events));
        let cursor = 0;
        allEvents.forEach((e) => {
            const durSeconds = e.beats * quarterSeconds;
            if (e.pitch) {
                fullPlaybackTimeline.push({ pitch: e.pitch, offset: cursor, duration: durSeconds * 0.92 });
            }
            cursor += durSeconds;
        });
        fullPlaybackTotalDuration = cursor;
    }

    function stopScheduledTimeouts() {
        scheduledTimeouts.forEach((id) => clearTimeout(id));
        scheduledTimeouts = [];
        if (playbackWatcher) { clearTimeout(playbackWatcher); playbackWatcher = null; }
    }

    function stopAllPlayback() {
        scheduledSimpleTimeouts.forEach((id) => clearTimeout(id));
        scheduledSimpleTimeouts = [];
        stopScheduledTimeouts();
        KszaAudio.stopAll();
        playbackState = 'stopped';
        pausedOffset = 0;
        updatePlaybackButtons();
    }

    function scheduleFullFrom(offsetSeconds) {
        stopScheduledTimeouts();
        scheduleStartWallClock = performance.now();
        scheduleStartOffset = offsetSeconds;
        scheduleSpeed = KszaTempo.get();

        fullPlaybackTimeline.forEach((e) => {
            if (e.offset + e.duration <= offsetSeconds) return;
            const delayMs = Math.max(0, (e.offset - offsetSeconds) / scheduleSpeed * 1000);
            const timeoutId = setTimeout(() => {
                if (KszaAudio.player) {
                    KszaAudio.player.play(e.pitch, undefined, { duration: e.duration / scheduleSpeed });
                }
            }, delayMs);
            scheduledTimeouts.push(timeoutId);
        });

        playbackState = 'playing';
        updatePlaybackButtons();

        const remainingMs = Math.max(0, (fullPlaybackTotalDuration - offsetSeconds) / scheduleSpeed * 1000) + 600;
        playbackWatcher = setTimeout(() => {
            playbackState = 'stopped';
            pausedOffset = 0;
            updatePlaybackButtons();
        }, remainingMs);
    }

    async function playFromStart() {
        if (!activeDictation) return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok) return;
        stopAllPlayback();
        scheduleFullFrom(0);
    }

    function pausePlayback() {
        if (playbackState !== 'playing') return;
        const wallClockElapsed = (performance.now() - scheduleStartWallClock) / 1000;
        pausedOffset = Math.min(scheduleStartOffset + wallClockElapsed * scheduleSpeed, fullPlaybackTotalDuration);
        stopScheduledTimeouts();
        KszaAudio.stopAll();
        playbackState = 'paused';
        updatePlaybackButtons();
    }

    async function resumePlayback() {
        if (playbackState !== 'paused') return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok) return;
        scheduleFullFrom(pausedOffset);
    }

    function updatePlaybackButtons() {
        const map = {
            'play-full-btn': playbackState === 'stopped',
            'pause-btn': playbackState === 'playing',
            'resume-btn': playbackState === 'paused',
            'restart-btn': playbackState === 'paused'
        };
        Object.keys(map).forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = map[id] ? 'inline-flex' : 'none';
        });
    }

    /* ---------- Puzzle ---------- */
    function shuffledIndices(n) {
        const arr = Array.from({ length: n }, (_, i) => i);
        let isSame = true;
        while (isSame) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            isSame = arr.every((v, i) => v === i) && n > 1;
        }
        return arr;
    }

    function buildPuzzle() {
        if (!activeDictation) return;
        displayOrder = shuffledIndices(activeDictation.fragments.length);

        fragmentNumberMap = {};
        displayOrder.forEach((originalIndex, position) => {
            fragmentNumberMap[originalIndex] = position + 1;
        });

        renderPuzzleList();
        const feedback = document.getElementById('result-feedback');
        feedback.textContent = '';
        feedback.className = 'feedback-msg';
    }

    function renderPuzzleList() {
        const list = document.getElementById('puzzle-list');
        list.innerHTML = '';

        displayOrder.forEach((originalIndex) => {
            const li = document.createElement('li');
            li.className = 'fragment-card notation-fragment-card';
            li.dataset.originalIndex = String(originalIndex);

            const number = fragmentNumberMap[originalIndex] || '?';

            li.innerHTML =
                '<span class="drag-handle" aria-hidden="true">&#8942;&#8942;</span>' +
                '<span class="fragment-badge">' + number + '</span>' +
                '<button type="button" class="fragment-play-btn" aria-label="Odtwórz fragment ' + number + '">' +
                '<span class="play-icon" aria-hidden="true"></span></button>' +
                '<div class="fragment-notation" aria-label="Zapis nutowy fragmentu ' + number + '"></div>' +
                '<span class="result-icon" aria-hidden="true"></span>';

            li.querySelector('.fragment-play-btn').addEventListener('click', () => {
                playFragmentByOriginalIndex(originalIndex);
            });

            try {
                li.querySelector('.fragment-notation').innerHTML = renderFragmentSvg(activeDictation.fragments[originalIndex].notationXml);
            } catch (e) {
                console.error('Błąd renderowania fragmentu:', e);
            }

            list.appendChild(li);
        });

        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(list, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: () => {
                displayOrder = Array.from(list.children).map((li) => parseInt(li.dataset.originalIndex, 10));
                Array.from(list.children).forEach((li) => li.classList.remove('is-correct', 'is-wrong'));
                Array.from(list.querySelectorAll('.result-icon')).forEach((icon) => (icon.textContent = ''));
                const feedback = document.getElementById('result-feedback');
                feedback.textContent = '';
                feedback.className = 'feedback-msg';
            }
        });
    }

    function checkOrder() {
        const list = document.getElementById('puzzle-list');
        const cards = Array.from(list.children);
        let correctCount = 0;

        cards.forEach((li, position) => {
            const originalIndex = parseInt(li.dataset.originalIndex, 10);
            const icon = li.querySelector('.result-icon');
            li.classList.remove('is-correct', 'is-wrong');
            if (originalIndex === position) {
                li.classList.add('is-correct');
                icon.textContent = '✓';
                correctCount++;
            } else {
                li.classList.add('is-wrong');
                icon.textContent = '✕';
            }
        });

        const feedback = document.getElementById('result-feedback');
        if (correctCount === cards.length) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Brawo! Cała kolejność poprawna.';
        } else {
            feedback.className = 'feedback-msg feedback-partial';
            feedback.textContent = 'Dobrze ułożone fragmenty: ' + correctCount + ' z ' + cards.length + '. Popraw kolejność i sprawdź ponownie.';
        }
    }

    /* ---------- Wczytywanie dyktand ---------- */
    async function loadManifest() {
        try {
            const res = await fetch('../dyktanda/dyktanda.json', { cache: 'no-store' });
            if (!res.ok) return; // brak manifestu = pusta lista, bez błędu
            const items = await res.json();
            if (!Array.isArray(items)) return;
            items.forEach((item, i) => {
                if (item && item.file) {
                    dictationSources['m-' + i] = {
                        url: '../dyktanda/' + item.file,
                        title: item.title || item.file
                    };
                }
            });
        } catch (e) {
            console.warn('Nie udało się wczytać listy dyktand (dyktanda.json):', e);
        }
    }

    function populateDictationSelect() {
        const select = document.getElementById('dictation-select');
        select.innerHTML = '';

        Object.keys(dictationSources).forEach((id) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = dictationSources[id].title;
            select.appendChild(opt);
        });

        if (select.options.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Brak dostępnych dyktand';
            select.appendChild(opt);
            setStatus('Nie dodano jeszcze żadnego dyktanda - patrz dyktanda/dyktanda.json.', null);
        }
    }

    async function loadDictationById(id) {
        if (!id) return;

        let dictation = dictationLibrary[id];

        if (!dictation && dictationSources[id]) {
            setStatus('Wczytywanie dyktanda...', null);
            try {
                await ensureVerovioReady();
                const res = await fetch(dictationSources[id].url);
                if (!res.ok) throw new Error('Nie udało się pobrać pliku (kod ' + res.status + ').');
                const text = await res.text();
                dictation = parseMusicXML(text);
                dictationLibrary[id] = dictation;
            } catch (e) {
                console.error('Błąd wczytywania dyktanda:', e);
                setStatus('Błąd wczytywania dyktanda: ' + e.message, 'error');
                return;
            }
        }

        if (!dictation) return;

        stopAllPlayback();
        activeDictation = dictation;
        buildFullPlaybackTimeline();
        buildPuzzle();
        setStatus('', null);
    }

    /* ---------- Inicjalizacja ---------- */
    document.addEventListener('DOMContentLoaded', async () => {
        await loadManifest();
        populateDictationSelect();

        const select = document.getElementById('dictation-select');
        loadDictationById(select.value);

        select.addEventListener('change', (e) => loadDictationById(e.target.value));

        document.getElementById('instrument-select').addEventListener('change', (e) => {
            stopAllPlayback();
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });

        document.getElementById('play-full-btn').addEventListener('click', playFromStart);
        document.getElementById('pause-btn').addEventListener('click', pausePlayback);
        document.getElementById('resume-btn').addEventListener('click', resumePlayback);
        document.getElementById('restart-btn').addEventListener('click', playFromStart);
        document.getElementById('listen-arrangement-btn').addEventListener('click', playCurrentArrangement);
        document.getElementById('shuffle-btn').addEventListener('click', buildPuzzle);
        document.getElementById('check-btn').addEventListener('click', checkOrder);
    });
})();
