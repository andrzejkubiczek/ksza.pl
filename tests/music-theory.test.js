import { describe, expect, it } from 'vitest';
import { KszaMusicTheory as MT } from '../src/scripts/music-theory.js';
const n = (letter, alter, octave) => ({ letter, alter, octave });

describe('absoluteSemitone / ladderEntry', () => {
    it('liczy półtony od C0', () => {
        expect(MT.absoluteSemitone(n('C', 0, 4))).toBe(48);
        expect(MT.absoluteSemitone(n('A', 0, 4))).toBe(57);
        expect(MT.absoluteSemitone(n('B', -1, 3))).toBe(46);
    });

    it('rozpoznaje enharmonię (B# w oktawie 3 = C w oktawie 4)', () => {
        expect(MT.absoluteSemitone(n('B', 1, 3))).toBe(MT.absoluteSemitone(n('C', 0, 4)));
    });

    it('ladderEntry obsługuje indeksy ujemne i przejście przez oktawę', () => {
        expect(MT.ladderEntry(0)).toMatchObject({ letter: 'C', octave: 0 });
        expect(MT.ladderEntry(7)).toMatchObject({ letter: 'C', octave: 1 });
        expect(MT.ladderEntry(-1)).toMatchObject({ letter: 'B', octave: -1 });
    });

    it('diatonicIndexOf jest odwrotnością ladderEntry', () => {
        for (let i = -10; i < 30; i++) {
            const { letter, octave } = MT.ladderEntry(i);
            expect(MT.diatonicIndexOf(letter, octave)).toBe(i);
        }
    });
});

describe('spellByShape (pisownia interwałów)', () => {
    const MAJOR_THIRD = { steps: 2, semitones: 4 };
    const MINOR_THIRD = { steps: 2, semitones: 3 };
    const PERFECT_FIFTH = { steps: 4, semitones: 7 };
    const DIM_FIFTH = { steps: 4, semitones: 6 };

    it('tercja wielka od C to E', () => {
        expect(MT.spellByShape(n('C', 0, 4), MAJOR_THIRD)).toEqual(n('E', 0, 4));
    });

    it('tercja wielka od E to G#, a nie Ab', () => {
        expect(MT.spellByShape(n('E', 0, 4), MAJOR_THIRD)).toEqual(n('G', 1, 4));
    });

    it('tercja mała od E to G', () => {
        expect(MT.spellByShape(n('E', 0, 4), MINOR_THIRD)).toEqual(n('G', 0, 4));
    });

    it('kwinta od B przechodzi do następnej oktawy (F#)', () => {
        expect(MT.spellByShape(n('B', 0, 4), PERFECT_FIFTH)).toEqual(n('F', 1, 5));
    });

    it('kwinta zmniejszona od B to F', () => {
        expect(MT.spellByShape(n('B', 0, 4), DIM_FIFTH)).toEqual(n('F', 0, 5));
    });

    it('obsługuje kierunek w dół', () => {
        expect(MT.spellByShape(n('E', 0, 4), MAJOR_THIRD, -1)).toEqual(n('C', 0, 4));
        expect(MT.spellByShape(n('C', 0, 4), MINOR_THIRD, -1)).toEqual(n('A', 0, 3));
    });

    it('może dać podwójny znak chromatyczny', () => {
        const r = MT.spellByShape(n('F', 1, 4), MAJOR_THIRD);
        expect(r).toEqual(n('A', 1, 4));
        const r2 = MT.spellByShape(n('G', 1, 4), MAJOR_THIRD);
        expect(r2).toEqual(n('B', 1, 4));
    });

    it('zachowuje odległość w półtonach', () => {
        const start = n('D', -1, 4);
        const r = MT.spellByShape(start, PERFECT_FIFTH);
        expect(MT.absoluteSemitone(r) - MT.absoluteSemitone(start)).toBe(7);
    });
});

describe('buildTriadNotes', () => {
    const spelled = (notes) => notes.map((x) => MT.noteLabel(x) + x.octave);

    it('C-dur: C E G', () => {
        expect(spelled(MT.buildTriadNotes(n('C', 0, 4), 'durowy'))).toEqual(['C4', 'E4', 'G4']);
    });

    it('a-moll: A C E', () => {
        expect(spelled(MT.buildTriadNotes(n('A', 0, 3), 'molowy'))).toEqual(['A3', 'C4', 'E4']);
    });

    it('zmniejszony od B: B D F', () => {
        expect(spelled(MT.buildTriadNotes(n('B', 0, 3), 'zmniejszony'))).toEqual(['B3', 'D4', 'F4']);
    });

    it('zwiększony od C: C E G#', () => {
        expect(spelled(MT.buildTriadNotes(n('C', 0, 4), 'zwiekszony'))).toEqual(['C4', 'E4', 'G♯4']);
    });

    it('pierwszy przewrót C-dur: E G C', () => {
        expect(spelled(MT.buildTriadNotes(n('C', 0, 4), 'durowy', 1))).toEqual(['E4', 'G4', 'C5']);
    });

    it('drugi przewrót C-dur: G C E', () => {
        expect(spelled(MT.buildTriadNotes(n('C', 0, 4), 'durowy', 2))).toEqual(['G4', 'C5', 'E5']);
    });

    it('nie mutuje nuty podstawowej', () => {
        const root = n('C', 0, 4);
        MT.buildTriadNotes(root, 'durowy', 2);
        expect(root).toEqual(n('C', 0, 4));
    });

    it('każdy kształt daje właściwe odległości w półtonach', () => {
        const expected = { durowy: [4, 7], molowy: [3, 7], zmniejszony: [3, 6], zwiekszony: [4, 8] };
        for (const [shape, [third, fifth]] of Object.entries(expected)) {
            const [r, t, f] = MT.buildTriadNotes(n('D', 0, 4), shape);
            expect(MT.absoluteSemitone(t) - MT.absoluteSemitone(r)).toBe(third);
            expect(MT.absoluteSemitone(f) - MT.absoluteSemitone(r)).toBe(fifth);
        }
    });
});

describe('isCleanNote / isCleanTriad', () => {
    it('odrzuca nuty wymagające zapisu enharmonicznego (Fb, Cb, B#, E#)', () => {
        expect(MT.isCleanNote(n('F', -1, 4))).toBe(false);
        expect(MT.isCleanNote(n('C', -1, 4))).toBe(false);
        expect(MT.isCleanNote(n('B', 1, 4))).toBe(false);
        expect(MT.isCleanNote(n('E', 1, 4))).toBe(false);
    });

    it('odrzuca podwójne znaki i niepoprawne dane', () => {
        expect(MT.isCleanNote(n('C', 2, 4))).toBe(false);
        expect(MT.isCleanNote(n('D', -2, 4))).toBe(false);
        expect(MT.isCleanNote(null)).toBe(false);
        expect(MT.isCleanNote({ letter: 'C', octave: 4 })).toBe(false);
    });

    it('akceptuje zwykłe nuty i krzyżyki/bemole', () => {
        expect(MT.isCleanNote(n('C', 0, 4))).toBe(true);
        expect(MT.isCleanNote(n('F', 1, 4))).toBe(true);
        expect(MT.isCleanNote(n('B', -1, 4))).toBe(true);
    });

    it('isCleanTriad wymaga dokładnie 3 czystych nut', () => {
        expect(MT.isCleanTriad([n('C', 0, 4), n('E', 0, 4), n('G', 0, 4)])).toBe(true);
        expect(MT.isCleanTriad([n('C', 0, 4), n('E', 0, 4)])).toBe(false);
        expect(MT.isCleanTriad([n('C', 0, 4), n('E', 1, 4), n('G', 0, 4)])).toBe(false);
        expect(MT.isCleanTriad(null)).toBe(false);
    });
});

describe('noteSolfege / noteLabel', () => {
    it('zwraca polskie nazwy solmizacyjne', () => {
        expect(MT.noteSolfege(n('C', 0, 4))).toBe('do');
        expect(MT.noteSolfege(n('F', 1, 4))).toBe('fis');
        expect(MT.noteSolfege(n('E', -1, 4))).toBe('es');
        expect(MT.noteSolfege(n('B', -1, 4))).toBe('b');
        expect(MT.noteSolfege(n('B', 0, 4))).toBe('si');
    });

    it('zwraca pusty ciąg dla niepoprawnych danych', () => {
        expect(MT.noteSolfege(null)).toBe('');
        expect(MT.noteSolfege({})).toBe('');
    });

    it('noteLabel dodaje symbole ♯ i ♭', () => {
        expect(MT.noteLabel(n('C', 1, 4))).toBe('C♯');
        expect(MT.noteLabel(n('B', -1, 4))).toBe('B♭');
        expect(MT.noteLabel(n('D', 0, 4))).toBe('D');
    });
});

describe('MusicXML', () => {
    it('noteToPitchXml pomija <alter> dla nuty bez znaku', () => {
        expect(MT.noteToPitchXml(n('C', 0, 4))).toBe('<pitch><step>C</step><octave>4</octave></pitch>');
        expect(MT.noteToPitchXml(n('F', 1, 4))).toBe('<pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>');
    });

    it('accidentalTag mapuje znaki na nazwy MusicXML', () => {
        expect(MT.accidentalTag(n('C', 0, 4))).toBe('');
        expect(MT.accidentalTag(n('C', 1, 4))).toBe('<accidental>sharp</accidental>');
        expect(MT.accidentalTag(n('C', -1, 4))).toBe('<accidental>flat</accidental>');
    });

    it('buildSingleMeasureScoreXml generuje poprawny XML z kluczem i nutami', () => {
        const xml = MT.buildSingleMeasureScoreXml({ clef: 'bass', notes: [n('C', 0, 3), { isRest: true }] });
        expect(xml).toContain('<sign>F</sign><line>4</line>');
        expect(xml).toContain('<step>C</step><octave>3</octave>');
        expect(xml).toContain('<rest/>');
        expect(xml).toContain('<beats>4</beats><beat-type>4</beat-type>');
        expect(xml.match(/<note>/g)).toHaveLength(2);
    });

    it('domyślnie używa klucza wiolinowego', () => {
        const xml = MT.buildSingleMeasureScoreXml({ notes: [n('G', 0, 4)] });
        expect(xml).toContain('<sign>G</sign><line>2</line>');
    });
});
