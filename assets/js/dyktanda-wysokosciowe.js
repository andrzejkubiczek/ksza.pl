/* ksza.pl - dyktando wysokościowe.
   Osobna lista plików niż puzzle (dyktanda/wysokosciowe/dyktanda.json) - te
   pliki mają świadomie JEDNĄ wartość rytmiczną przez całe dyktando, bo to
   ćwiczenie sprawdza tylko wysokość, nie rytm.

   Klucz, tonacja, metrum i pierwszy dźwięk są dane i stałe. Uczeń kursorem
   "Poprzedni/Następny dźwięk" wybiera, który z pozostałych dźwięków ustawia -
   ten sam mechanizm (strzałki, przeciąganie, znak chromatyczny) co w
   interwałach/trójdźwiękach, tylko więcej dźwięków w rzędzie.

   Prawdziwa tonacja (nie zawsze C-dur) - znak chromatyczny trzeba
   interpretować WZGLĘDEM tonacji: dźwięk zgodny z tonacją nie potrzebuje
   żadnego znaku, inaczej wymaga jawnego kasownika (patrz keySignatureAlter). */
(function () {
    const MT = KszaMusicTheory;
    const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    const TYPE_DURATION = { whole: 16, half: 8, quarter: 4, eighth: 2, '16th': 1 };

    // Alteracja, jaką tonacja narzuca danej literze (np. F w G-dur = +1).
    function keySignatureAlter(letter, fifths) {
        if (fifths > 0) return SHARP_ORDER.slice(0, fifths).indexOf(letter) !== -1 ? 1 : 0;
        if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).indexOf(letter) !== -1 ? -1 : 0;
        return 0;
    }

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

        const clefSign = attrText('clef sign', 'G');
        const clefLine = attrText('clef line', '2');
        const keyFifths = parseInt(attrText('key fifths', '0'), 10);
        const beats = attrText('time beats', '4');
        const beatType = attrText('time beat-type', '4');

        const measures = measureEls
            .map((measure) => Array.from(measure.querySelectorAll('note'))
                .filter((n) => !n.querySelector('rest') && !n.querySelector('chord') && !n.querySelector('grace'))
                .map((el) => {
                    const pitchEl = el.querySelector('pitch');
                    const letter = pitchEl.querySelector('step').textContent;
                    const octave = parseInt(pitchEl.querySelector('octave').textContent, 10);
                    const alterEl = pitchEl.querySelector('alter');
                    const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
                    const typeEl = el.querySelector('type');
                    return { letter: letter, alter: alter, octave: octave, type: typeEl ? typeEl.textContent : 'quarter' };
                }))
            .filter((notes) => notes.length > 0);

        const flat = [].concat(...measures);
        if (flat.length < 2) {
            throw new Error('Dyktando musi mieć co najmniej 2 dźwięki, żeby dało się je uzupełnić.');
        }

        return {
            clef: clefSign === 'F' ? 'bass' : 'treble',
            clefSign: clefSign, clefLine: clefLine,
            keyFifths: keyFifths, beats: beats, beatType: beatType,
            noteType: flat[0].type,
            measureSizes: measures.map((m) => m.length),
            notes: flat.map((n) => ({ letter: n.letter, alter: n.alter, octave: n.octave }))
        };
    }

    // Klucz-aware: dźwięk zgodny z tonacją nie potrzebuje żadnego znaku.
    function accidentalTag(note, keyFifths) {
        const keyAlter = keySignatureAlter(note.letter, keyFifths);
        if (note.alter === keyAlter) return '';
        return '<accidental>' + MT.ACCIDENTAL_NAMES[String(note.alter)] + '</accidental>';
    }

    function buildNoteXml(note, noteType, keyFifths) {
        const duration = TYPE_DURATION[noteType] || TYPE_DURATION.quarter;
        return '<note>' + MT.noteToPitchXml(note) +
            '<duration>' + duration + '</duration><type>' + noteType + '</type>' +
            accidentalTag(note, keyFifths) + '</note>';
    }

    function regroupFlat(flatNotes, measureSizes) {
        const groups = [];
        let cursor = 0;
        measureSizes.forEach((size) => {
            groups.push(flatNotes.slice(cursor, cursor + size));
            cursor += size;
        });
        return groups;
    }

    function buildScoreMusicXML(dictation, groupedNotes) {
        const clefTag = '<clef><sign>' + dictation.clefSign + '</sign><line>' + dictation.clefLine + '</line></clef>';
        const measuresXml = groupedNotes.map((notes, i) => {
            const attrsXml = i === 0
                ? '<attributes><divisions>' + (TYPE_DURATION[dictation.noteType] || TYPE_DURATION.quarter) + '</divisions>' +
                  '<key><fifths>' + dictation.keyFifths + '</fifths></key>' +
                  '<time><beats>' + dictation.beats + '</beats><beat-type>' + dictation.beatType + '</beat-type></time>' +
                  clefTag + '</attributes>'
                : '';
            const notesXml = notes.map((n) => buildNoteXml(n, dictation.noteType, dictation.keyFifths)).join('');
            return '<measure number="' + (i + 1) + '">' + attrsXml + notesXml + '</measure>';
        }).join('');

        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<score-partwise version="4.0">' +
            '<part-list><score-part id="P1"><part-name print-object="no">Dyktando</part-name></score-part></part-list>' +
            '<part id="P1">' + measuresXml + '</part></score-partwise>';
    }

    // Verovio (MusicXML) nie koloruje pojedynczych nut przez atrybut "color" na
    // <note> (sprawdzone w źródłach importera) - kolorujemy więc PO renderze:
    // każda wyrenderowana nuta ma klasę "note" w kolejności zgodnej z naszym
    // XML-em, więc wystarczy dobrać element po indeksie i dorzucić klasę CSS.
    function renderScore(dictation, flatNotes, feedbackColors) {
        const svg = KszaVerovio.render(buildScoreMusicXML(dictation, regroupFlat(flatNotes, dictation.measureSizes)), {
            pageWidth: 1400,
            pageHeight: 200,
            scale: 60,
            adjustPageHeight: true,
            breaks: 'none'
        });
        document.getElementById('notation-container').innerHTML = svg;

        if (feedbackColors) {
            const noteEls = document.querySelectorAll('#notation-container g.note');
            noteEls.forEach((g, i) => {
                if (feedbackColors[i] === 'correct') g.classList.add('note-feedback-correct');
                else if (feedbackColors[i] === 'wrong') g.classList.add('note-feedback-wrong');
            });
        }
    }

    const dictationLibrary = {};
    const dictationSources = {};

    let activeDictation = null;
    let editableState = {};      // { flatIndex: {step, alter} }, względem pierwszego dźwięku
    let editableIndices = [];    // [1, 2, ..., N-1]
    let cursorPos = 0;
    // Kolory po ostatnim "Sprawdź" - koloruje tylko WŁASNE dźwięki ucznia
    // (zielony/czerwony), nie odsłania poprawnej odpowiedzi. Sprawdzanie nie
    // blokuje edycji: dziecko poprawia czerwone i sprawdza ponownie.
    let feedbackColors = null;

    const MIN_STEP = -14;
    const MAX_STEP = 14;

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

    function currentEditIndex() { return editableIndices[cursorPos]; }

    function candidateNoteAt(flatIndex) {
        const state = editableState[flatIndex];
        const firstNote = activeDictation.notes[0];
        const firstIdx = MT.diatonicIndexOf(firstNote.letter, firstNote.octave);
        const entry = MT.ladderEntry(firstIdx + state.step);
        return { letter: entry.letter, alter: state.alter, octave: entry.octave };
    }

    function currentNotesFlat() {
        return activeDictation.notes.map((n, i) => (i === 0 ? n : candidateNoteAt(i)));
    }

    function noteToToneName(note) {
        const accidental = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === 2 ? '##' : note.alter === -2 ? 'bb' : '';
        return note.letter + accidental + note.octave;
    }

    function updateCursorLabel() {
        document.getElementById('note-cursor-label').textContent =
            'Dźwięk ' + (currentEditIndex() + 1) + ' z ' + activeDictation.notes.length;
        document.getElementById('note-prev').disabled = cursorPos === 0;
        document.getElementById('note-next').disabled = cursorPos === editableIndices.length - 1;
    }
    function updateLetterButtons() {
        const step = editableState[currentEditIndex()].step;
        document.getElementById('letter-down').disabled = step === MIN_STEP;
        document.getElementById('letter-up').disabled = step === MAX_STEP;
    }
    function updateAccidentalButtons() {
        const alter = editableState[currentEditIndex()].alter;
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.classList.toggle('is-active', parseInt(btn.dataset.alter, 10) === alter);
        });
    }
    function syncControlsToCursor() {
        updateCursorLabel();
        updateLetterButtons();
        updateAccidentalButtons();
    }

    function redraw() {
        try {
            renderScore(activeDictation, currentNotesFlat(), feedbackColors);
            setStatus('', null);
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    function moveCursor(delta) {
        const next = cursorPos + delta;
        if (next < 0 || next > editableIndices.length - 1) return;
        cursorPos = next;
        syncControlsToCursor();
    }
    function moveLetter(delta) {
        const state = editableState[currentEditIndex()];
        const next = state.step + delta;
        if (next < MIN_STEP || next > MAX_STEP) return;
        state.step = next;
        feedbackColors = null; // poprzednie sprawdzenie jest już nieaktualne
        updateLetterButtons();
        redraw();
    }
    function setAccidental(alter) {
        editableState[currentEditIndex()].alter = alter;
        feedbackColors = null;
        updateAccidentalButtons();
        redraw();
    }
    function cycleAccidental() {
        const current = editableState[currentEditIndex()].alter;
        setAccidental(current === 0 ? 1 : current === 1 ? -1 : 0);
    }

    const BASE_NOTE_DURATION = 0.75;
    let scheduledTimeouts = [];
    let isPlaying = false;

    function stopPlayback() {
        scheduledTimeouts.forEach((id) => clearTimeout(id));
        scheduledTimeouts = [];
        isPlaying = false;
        document.getElementById('play-btn').disabled = false;
    }

    async function playDictation() {
        if (isPlaying) return;
        const ok = await KszaAudio.ensureReady(document.getElementById('instrument-select'), onAudioState);
        if (!ok || !KszaAudio.player) return;

        stopPlayback();
        isPlaying = true;
        document.getElementById('play-btn').disabled = true;
        KszaAudio.stopAll();

        const noteDuration = BASE_NOTE_DURATION / KszaTempo.get();
        activeDictation.notes.forEach((note, i) => {
            const id = setTimeout(() => {
                if (KszaAudio.player) KszaAudio.player.play(noteToToneName(note), undefined, { duration: noteDuration * 0.92 });
            }, i * noteDuration * 1000);
            scheduledTimeouts.push(id);
        });

        const endId = setTimeout(() => {
            isPlaying = false;
            document.getElementById('play-btn').disabled = false;
        }, activeDictation.notes.length * noteDuration * 1000 + 150);
        scheduledTimeouts.push(endId);
    }

    function checkAnswer() {
        const colors = {};
        let allCorrect = true;

        editableIndices.forEach((i) => {
            const candidate = candidateNoteAt(i);
            const expected = activeDictation.notes[i];
            const correct = candidate.letter === expected.letter &&
                candidate.alter === expected.alter &&
                candidate.octave === expected.octave;
            colors[i] = correct ? 'correct' : 'wrong';
            if (!correct) allCorrect = false;
        });

        feedbackColors = colors;
        redraw();

        const feedback = document.getElementById('feedback');
        if (allCorrect) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Doskonale! Wszystkie wysokości poprawne.';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = 'Czerwone dźwięki jeszcze nie pasują - popraw je i sprawdź ponownie.';
        }
    }

    async function loadManifest() {
        try {
            const res = await fetch('../dyktanda/wysokosciowe/dyktanda.json', { cache: 'no-store' });
            if (!res.ok) return;
            const items = await res.json();
            if (!Array.isArray(items)) return;
            items.forEach((item, i) => {
                if (item && item.file) {
                    dictationSources['m-' + i] = {
                        url: '../dyktanda/wysokosciowe/' + item.file,
                        title: item.title || item.file,
                        klasy: item.klasy || []
                    };
                }
            });
        } catch (e) {
            console.warn('Nie udało się wczytać listy dyktand wysokościowych:', e);
        }
    }

    function currentKlasa() {
        const el = document.getElementById('klasa-select');
        return el ? el.value : '';
    }

    function populateDictationSelect() {
        const select = document.getElementById('dictation-select');
        select.innerHTML = '';
        const klasa = currentKlasa();
        Object.keys(dictationSources)
            .filter((id) => KszaKlasaFilter.matches(dictationSources[id].klasy, klasa))
            .forEach((id) => {
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
            setStatus('Nie dodano jeszcze żadnego dyktanda - patrz dyktanda/wysokosciowe/dyktanda.json.', null);
        }
    }

    async function loadDictationById(id) {
        if (!id) return;
        let dictation = dictationLibrary[id];

        if (!dictation && dictationSources[id]) {
            setStatus('Wczytywanie dyktanda...', null);
            try {
                await KszaVerovio.ensureReady();
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

        stopPlayback();
        activeDictation = dictation;
        feedbackColors = null;

        editableIndices = [];
        editableState = {};
        for (let i = 1; i < dictation.notes.length; i++) {
            editableIndices.push(i);
            editableState[i] = { step: 0, alter: 0 };
        }
        cursorPos = 0;

        document.getElementById('check-btn').disabled = false;
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.disabled = false;
            btn.classList.toggle('is-active', btn.dataset.alter === '0');
        });
        document.getElementById('feedback').textContent = '';
        document.getElementById('feedback').className = 'feedback-msg';
        syncControlsToCursor();

        try {
            await KszaVerovio.ensureReady();
            redraw();
        } catch (e) {
            console.error('Błąd renderowania nut:', e);
            setStatus('Błąd wczytywania biblioteki nutowej: ' + e.message, 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        KszaGestureLayer.setup('gesture-layer', {
            moveLetter: moveLetter,
            cycleAccidental: cycleAccidental
        });
        KszaKlasaFilter.populateSelect(document.getElementById('klasa-select'));

        await loadManifest();
        populateDictationSelect();

        const select = document.getElementById('dictation-select');
        loadDictationById(select.value);

        select.addEventListener('change', (e) => loadDictationById(e.target.value));

        const klasaSelect = document.getElementById('klasa-select');
        if (klasaSelect) {
            klasaSelect.addEventListener('change', () => {
                populateDictationSelect();
                loadDictationById(select.value);
            });
        }

        document.getElementById('instrument-select').addEventListener('change', (e) => {
            stopPlayback();
            KszaAudio.loadInstrument(e.target.value, onAudioState);
        });
        document.getElementById('play-btn').addEventListener('click', playDictation);
        document.getElementById('note-prev').addEventListener('click', () => moveCursor(-1));
        document.getElementById('note-next').addEventListener('click', () => moveCursor(1));
        document.getElementById('letter-up').addEventListener('click', () => moveLetter(1));
        document.getElementById('letter-down').addEventListener('click', () => moveLetter(-1));
        document.getElementById('check-btn').addEventListener('click', checkAnswer);
        document.querySelectorAll('.accidental-btn').forEach((btn) => {
            btn.addEventListener('click', () => setAccidental(parseInt(btn.dataset.alter, 10)));
        });
    });
})();
