import { KszaUI } from './core.js';
import { KszaIntervalFilter } from './interval-filter.js';
import { INTERVAL_DEFS, SYMBOLS } from './intervals.js';
import { KszaMusicTheory } from './music-theory.js';
import { KszaVerovio } from './verovio-render.js';

const MT = KszaMusicTheory;


function buildNoteXml(note, isChordTone) {
    return `<note>${isChordTone ? '<chord/>' : ''}${MT.noteToPitchXml(note)}<duration>4</duration><type>whole</type>${MT.accidentalTag(note)}</note>`;
}

function buildMeasureMusicXML(clef, lowerNote, upperNote) {
    const clefTag = clef === 'bass'
        ? '<clef><sign>F</sign><line>4</line></clef>'
        : '<clef><sign>G</sign><line>2</line></clef>';
    return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name print-object="no">Interwał</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefTag}</attributes>${buildNoteXml(lowerNote, false)}${buildNoteXml(upperNote, true)}</measure></part></score-partwise>`;
}

function renderMeasure(clef, lowerNote, upperNote) {
    const svg = KszaVerovio.render(buildMeasureMusicXML(clef, lowerNote, upperNote), {
        pageWidth: 900,
        pageHeight: 260,
        scale: 60,
        adjustPageHeight: true,
        breaks: 'none'
    });
    document.getElementById('notation-container').innerHTML = svg;
}

let currentSymbol = null;
let hasAnswered = false;

const TREBLE_ROOT_OCTAVE = 4;
const BASS_ROOT_OCTAVE = 2;

function pickClef() {
    const selected = document.getElementById('clef-select').value;
    if (selected === 'random') return Math.random() < 0.5 ? 'treble' : 'bass';
    return selected;
}

const setStatus = (msg, type) => KszaUI.setStatus(msg, type);

function getActiveSymbolsPool() {
    const active = KszaIntervalFilter.getActiveSymbols();
    const filtered = SYMBOLS.filter((s) => active.includes(s));
    if (filtered.length >= 2) return filtered;
    return SYMBOLS;
}

function updateChoiceButtonsState() {
    const activeSymbols = KszaIntervalFilter.getActiveSymbols();

    document.querySelectorAll('.interval-choice').forEach((btn) => {
        const symbol = btn.dataset.symbol;
        const isActive = activeSymbols.includes(symbol);
        if (isActive) {
            btn.classList.remove('interval-excluded');
            btn.removeAttribute('aria-disabled');
            if (!hasAnswered) {
                btn.disabled = false;
            }
        } else {
            btn.classList.add('interval-excluded');
            btn.setAttribute('aria-disabled', 'true');
            btn.disabled = true;
        }
    });
}

async function generateNewQuestion() {
    hasAnswered = false;
    const feedback = document.getElementById('feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback-msg';
    }
    document.getElementById('next-btn').style.display = 'none';

    updateChoiceButtonsState();

    document.querySelectorAll('.interval-choice').forEach((btn) => {
        btn.classList.remove('is-correct', 'is-wrong');
    });

    const clef = pickClef();
    const rootOctave = clef === 'bass' ? BASS_ROOT_OCTAVE : TREBLE_ROOT_OCTAVE;
    const rootLetter = MT.LETTERS[Math.floor(Math.random() * MT.LETTERS.length)];
    const pool = getActiveSymbolsPool();
    const symbol = pool[Math.floor(Math.random() * pool.length)];

    const rootNote = { letter: rootLetter, alter: 0, octave: rootOctave };
    const upperNote = MT.spellByShape(rootNote, INTERVAL_DEFS[symbol], 1);

    currentSymbol = symbol;

    try {
        await KszaVerovio.ensureReady();
        renderMeasure(clef, rootNote, upperNote);
        setStatus('', null);
    } catch (e) {
        console.error('Błąd renderowania nut:', e);
        setStatus(`Błąd wczytywania biblioteki nutowej: ${e.message}`, 'error');
    }
}

function checkAnswer(selectedSymbol) {
    if (hasAnswered) return;
    if (!KszaIntervalFilter.isIntervalActive(selectedSymbol)) return;
    hasAnswered = true;

    document.querySelectorAll('.interval-choice').forEach((btn) => {
        btn.disabled = true;
        if (btn.dataset.symbol === currentSymbol) {
            btn.classList.add('is-correct');
        } else if (btn.dataset.symbol === selectedSymbol) {
            btn.classList.add('is-wrong');
        }
    });

    const feedback = document.getElementById('feedback');
    if (feedback) {
        if (selectedSymbol === currentSymbol) {
            feedback.className = 'feedback-msg feedback-correct';
            feedback.textContent = 'Dobrze!';
        } else {
            feedback.className = 'feedback-msg feedback-wrong';
            feedback.textContent = `To ${INTERVAL_DEFS[currentSymbol].label.toLowerCase()} (${currentSymbol}).`;
        }
    }

    document.getElementById('next-btn').style.display = 'inline-flex';
}

document.addEventListener('DOMContentLoaded', () => {
    KszaIntervalFilter.init({
        filterId: 'interval-filter',
        onChange: (symbols) => {
            updateChoiceButtonsState();
            if (currentSymbol && !symbols.includes(currentSymbol)) {
                generateNewQuestion();
            }
        }
    });

    generateNewQuestion();

    document.getElementById('clef-select')?.addEventListener('change', generateNewQuestion);
    document.getElementById('next-btn')?.addEventListener('click', generateNewQuestion);
    document.querySelectorAll('.interval-choice').forEach((btn) => {
        btn.addEventListener('click', () => checkAnswer(btn.dataset.symbol));
    });
});
