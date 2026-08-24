window.KszaMusicTheory = (() => {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_NATURAL_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const ACCIDENTAL_NAMES = { '-2': 'flat-flat', '-1': 'flat', '0': 'natural', '1': 'sharp', '2': 'double-sharp' };

    // Indeks diatoniczny rośnie o 1 na każdy krok literowy niezależnie od granic oktawy
    function ladderEntry(diatonicIndex) {
        const letterIdx = ((diatonicIndex % 7) + 7) % 7;
        const octave = Math.floor(diatonicIndex / 7);
        const letter = LETTERS[letterIdx];
        return { letter, octave, naturalSemitone: octave * 12 + LETTER_NATURAL_OFFSET[letter] };
    }

    const diatonicIndexOf = (letter, octave) => octave * 7 + LETTERS.indexOf(letter);
    const absoluteSemitone = (note) => note.octave * 12 + LETTER_NATURAL_OFFSET[note.letter] + note.alter;

    function spellByShape(startNote, shape, direction = 1) {
        const startAbs = absoluteSemitone(startNote);
        const startIdx = diatonicIndexOf(startNote.letter, startNote.octave);
        const target = ladderEntry(startIdx + direction * shape.steps);
        return {
            letter: target.letter,
            alter: (startAbs + direction * shape.semitones) - target.naturalSemitone,
            octave: target.octave
        };
    }

    function noteLabel(note) {
        const accidental = note.alter === 1 ? '♯' : note.alter === -1 ? '♭' : '';
        return `${note.letter}${accidental}`;
    }

    function noteToPitchXml(note) {
        const alterTag = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
        return `<pitch><step>${note.letter}</step>${alterTag}<octave>${note.octave}</octave></pitch>`;
    }

    function accidentalTag(note) {
        return note.alter !== 0 ? `<accidental>${ACCIDENTAL_NAMES[String(note.alter)]}</accidental>` : '';
    }

    const TRIAD_SHAPES = {
        durowy:      { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 7 } },
        molowy:      { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 7 } },
        zmniejszony: { third: { steps: 2, semitones: 3 }, fifth: { steps: 4, semitones: 6 } },
        zwiekszony:  { third: { steps: 2, semitones: 4 }, fifth: { steps: 4, semitones: 8 } }
    };

    function buildTriadNotes(rootNote, shapeName, inversion = 0) {
        const shape = TRIAD_SHAPES[shapeName];
        const third = spellByShape(rootNote, shape.third, 1);
        const fifth = spellByShape(rootNote, shape.fifth, 1);
        const notes = [rootNote, third, fifth];
        for (let i = 0; i < inversion; i++) {
            const wrapped = notes.shift();
            notes.push({ letter: wrapped.letter, alter: wrapped.alter, octave: wrapped.octave + 1 });
        }
        return notes;
    }

    function isCleanNote(note) {
        if (!note || typeof note.alter !== 'number' || Math.abs(note.alter) > 1) return false;
        if (note.letter === 'F' && note.alter === -1) return false; // Fes
        if (note.letter === 'C' && note.alter === -1) return false; // Ces
        if (note.letter === 'B' && note.alter === 1) return false;  // His
        if (note.letter === 'E' && note.alter === 1) return false;  // Eis
        return true;
    }

    function isCleanTriad(notes) {
        if (!notes || notes.length !== 3) return false;
        return notes.every(isCleanNote);
    }

    return {
        LETTERS,
        LETTER_NATURAL_OFFSET,
        ACCIDENTAL_NAMES,
        TRIAD_SHAPES,
        ladderEntry,
        diatonicIndexOf,
        absoluteSemitone,
        spellByShape,
        noteLabel,
        noteToPitchXml,
        accidentalTag,
        buildTriadNotes,
        isCleanNote,
        isCleanTriad
    };
})();
