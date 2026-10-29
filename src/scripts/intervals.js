export const INTERVAL_DEFS = {
    '1':  { steps: 0, semitones: 0,  label: 'Pryma czysta' },
    '2>': { steps: 1, semitones: 1,  label: 'Sekunda mała' },
    '2':  { steps: 1, semitones: 2,  label: 'Sekunda wielka' },
    '3>': { steps: 2, semitones: 3,  label: 'Tercja mała' },
    '3':  { steps: 2, semitones: 4,  label: 'Tercja wielka' },
    '4':  { steps: 3, semitones: 5,  label: 'Kwarta czysta' },
    '4<': { steps: 3, semitones: 6,  label: 'Tryton' },
    '5':  { steps: 4, semitones: 7,  label: 'Kwinta czysta' },
    '6>': { steps: 5, semitones: 8,  label: 'Seksta mała' },
    '6':  { steps: 5, semitones: 9,  label: 'Seksta wielka' },
    '7':  { steps: 6, semitones: 10, label: 'Septyma mała' },
    '7<': { steps: 6, semitones: 11, label: 'Septyma wielka' },
    '8':  { steps: 7, semitones: 12, label: 'Oktawa czysta' }
};

// Object.keys ustawia klucze liczbowe ('1', '2'...) przed pozostałymi, więc sortujemy jawnie.
export const SYMBOLS = Object.keys(INTERVAL_DEFS).sort((a, b) => INTERVAL_DEFS[a].semitones - INTERVAL_DEFS[b].semitones);
