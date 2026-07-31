/* ksza.pl - wspólna teoria: pisownia enharmoniczna + budowanie <pitch>/<accidental> w MusicXML.
   Używane przez interwaly-zapis/-buduj, trojdzwieki-zapis/-buduj, dyktanda-wysokosciowe. */
window.KszaMusicTheory = (function () {
    const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const LETTER_NATURAL_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const ACCIDENTAL_NAMES = { '-2': 'flat-flat', '-1': 'flat', '0': 'natural', '1': 'sharp', '2': 'double-sharp' };

    // "Drabina" diatoniczna: indeks rośnie o 1 na każdy krok literowy, niezależnie
    // od oktawy - przejście przez jej granicę liczy się samo. Zweryfikowane wyczerpująco.
    function ladderEntry(diatonicIndex) {
        const letterIdx = ((diatonicIndex % 7) + 7) % 7;
        const octave = Math.floor(diatonicIndex / 7);
        const letter = LETTERS[letterIdx];
        return { letter: letter, octave: octave, naturalSemitone: octave * 12 + LETTER_NATURAL_OFFSET[letter] };
    }

    function diatonicIndexOf(letter, octave) { return octave * 7 + LETTERS.indexOf(letter); }
    function absoluteSemitone(note) { return note.octave * 12 + LETTER_NATURAL_OFFSET[note.letter] + note.alter; }

    // shape = {steps, semitones} liczone od startNote; direction: 1 = w górę, -1 = w dół.
    function spellByShape(startNote, shape, direction) {
        direction = direction || 1;
        const startAbs = absoluteSemitone(startNote);
        const startIdx = diatonicIndexOf(startNote.letter, startNote.octave);
        const target = ladderEntry(startIdx + direction * shape.steps);
        return { letter: target.letter, alter: (startAbs + direction * shape.semitones) - target.naturalSemitone, octave: target.octave };
    }

    function noteLabel(note) {
        const accidental = note.alter === 1 ? '♯' : note.alter === -1 ? '♭' : '';
        return note.letter + accidental;
    }

    function noteToPitchXml(note) {
        const alterTag = note.alter !== 0 ? '<alter>' + note.alter + '</alter>' : '';
        return '<pitch><step>' + note.letter + '</step>' + alterTag + '<octave>' + note.octave + '</octave></pitch>';
    }

    function accidentalTag(note) {
        return note.alter !== 0 ? '<accidental>' + ACCIDENTAL_NAMES[String(note.alter)] + '</accidental>' : '';
    }

    return {
        LETTERS: LETTERS,
        LETTER_NATURAL_OFFSET: LETTER_NATURAL_OFFSET,
        ACCIDENTAL_NAMES: ACCIDENTAL_NAMES,
        ladderEntry: ladderEntry,
        diatonicIndexOf: diatonicIndexOf,
        absoluteSemitone: absoluteSemitone,
        spellByShape: spellByShape,
        noteLabel: noteLabel,
        noteToPitchXml: noteToPitchXml,
        accidentalTag: accidentalTag
    };
})();
