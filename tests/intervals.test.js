import { describe, expect, it } from 'vitest';
import { INTERVAL_DEFS, SYMBOLS } from '../src/scripts/intervals.js';
import { KszaMusicTheory as MT } from '../src/scripts/music-theory.js';

describe('INTERVAL_DEFS', () => {
    it('zawiera 13 interwałów w kolejności rosnącej', () => {
        expect(SYMBOLS).toHaveLength(13);
        const semitones = SYMBOLS.map((s) => INTERVAL_DEFS[s].semitones);
        expect(semitones).toEqual([...semitones].sort((a, b) => a - b));
    });

    it('każdy interwał ma etykietę i nie dubluje półtonów', () => {
        expect(new Set(SYMBOLS.map((s) => INTERVAL_DEFS[s].semitones)).size).toBe(13);
        SYMBOLS.forEach((s) => expect(INTERVAL_DEFS[s].label).toBeTruthy());
    });

    it('spellByShape zachowuje liczbę półtonów dla każdego interwału i dźwięku startowego', () => {
        for (const letter of MT.LETTERS) {
            for (const alter of [-1, 0, 1]) {
                const start = { letter, alter, octave: 4 };
                for (const s of SYMBOLS) {
                    const end = MT.spellByShape(start, INTERVAL_DEFS[s]);
                    expect(MT.absoluteSemitone(end) - MT.absoluteSemitone(start)).toBe(INTERVAL_DEFS[s].semitones);
                }
            }
        }
    });
});
