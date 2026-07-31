/* ksza.pl - wspólne toniki gam + budowanie nut od toniki. Używane przez gamy.js i gamy-stopnie.js. */
window.KszaScaleTonics = (function () {
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const TONIC_OCTAVE_OPTIONS = [3, 4]; // awaryjne, patrz pickTonicOctave

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

    function noteAt(tonicPc, semitoneOffset, tonicOctave) {
        const total = tonicPc + semitoneOffset;
        const pc = ((total % 12) + 12) % 12;
        const octave = tonicOctave + Math.floor(total / 12);
        return CHROMATIC[pc] + octave;
    }

    // Oktawa toniki tak, by cała gama zmieściła się w zakresie instrumentu;
    // gdy żadna nie pasuje w całości, bierzemy tę z najmniejszym przekroczeniem.
    function pickTonicOctave(tonicPc, maxOffset, instrumentKey) {
        const range = KszaInstrumentRange.range(instrumentKey);
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

    return {
        MAJOR_TONICS: MAJOR_TONICS,
        MINOR_TONICS: MINOR_TONICS,
        noteAt: noteAt,
        pickTonicOctave: pickTonicOctave
    };
})();
