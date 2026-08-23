/**
 * KszaPitchDetector - Bezlatencyjny detektor wysokości głosu oparty o Web Audio API i algorytm YIN / Autokorelację.
 * Działa w 100% po stronie przeglądarki, bez nagrywania dźwięku na dysk.
 * Przygotowany pod moduły solfeżowe: śpiewanie interwałów, trójdźwięków, gam i czytanie a vista.
 */
window.KszaPitchDetector = (() => {
    let audioCtx = null;
    let micStream = null;
    let sourceNode = null;
    let analyserNode = null;
    let isListening = false;
    let animFrameId = null;
    let callback = null;

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const POLISH_NOTE_NAMES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
    const SOLMIZATION = ['do', 'cis', 're', 'dis', 'mi', 'fa', 'fis', 'sol', 'gis', 'la', 'ais', 'si'];

    // Bufor próbek i pre-alokowane tablice robocze algorytmu YIN (zero garbage collection)
    const BUFFER_SIZE = 2048;
    const buffer = new Float32Array(BUFFER_SIZE);
    const halfLen = BUFFER_SIZE / 2;
    const diff = new Float32Array(halfLen);
    const cmndf = new Float32Array(halfLen);

    /**
     * Sprawdza dostępność mikrofonu w przeglądarce
     */
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Oblicza energię RMS (głośność), aby odfiltrować ciszę i szumy tła
     */
    function getRMS(buf) {
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
            sum += buf[i] * buf[i];
        }
        return Math.sqrt(sum / buf.length);
    }

    /**
     * Algorytm YIN - zoptymalizowany dla częstotliwości ludzkiego głosu (65 Hz - 1200 Hz)
     */
    function detectPitchYIN(buf, sampleRate) {
        const threshold = 0.20; // próg błędu YIN
        const minPeriod = Math.floor(sampleRate / 1200); // max 1200 Hz (sopran D6)
        const maxPeriod = Math.floor(sampleRate / 65);   // min 65 Hz (bas C2)

        diff[0] = 1;

        // Krok 1: Funkcja różnicowa (Difference Function)
        for (let tau = 1; tau < halfLen; tau++) {
            let sum = 0;
            for (let j = 0; j < halfLen; j++) {
                const delta = buf[j] - buf[j + tau];
                sum += delta * delta;
            }
            diff[tau] = sum;
        }

        // Krok 2: Skumulowana normalizowana średnia różnicowa (CMNDF)
        cmndf[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < halfLen; tau++) {
            runningSum += diff[tau];
            cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
        }

        // Krok 3: Wyznaczenie pierwszego lokalnego minimum poniżej progu
        let tauEstimate = -1;
        for (let tau = minPeriod; tau < maxPeriod && tau < halfLen; tau++) {
            if (cmndf[tau] < threshold) {
                while (tau + 1 < halfLen && cmndf[tau + 1] < cmndf[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) {
            // Fallback: globalne minimum
            let minVal = 1000;
            for (let tau = minPeriod; tau < maxPeriod && tau < halfLen; tau++) {
                if (cmndf[tau] < minVal) {
                    minVal = cmndf[tau];
                    tauEstimate = tau;
                }
            }
            if (minVal > 0.45) return null; // Brak pewności sygnału tonowego
        }

        // Krok 4: Interpolacja paraboliczna dla sub-sample precision
        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < halfLen - 1) {
            const s0 = cmndf[tauEstimate - 1];
            const s1 = cmndf[tauEstimate];
            const s2 = cmndf[tauEstimate + 1];
            const delta = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
            if (isFinite(delta)) {
                betterTau = tauEstimate + delta;
            }
        }

        const frequency = sampleRate / betterTau;
        const confidence = 1 - Math.min(1, cmndf[tauEstimate] || 1);

        return { frequency, confidence };
    }

    /**
     * Konwertuje częstotliwość w Hz na informacje muzyczne (dźwięk, oktawa, centy, klasa wysokości)
     */
    function frequencyToNote(freq) {
        if (!freq || freq <= 0) return null;

        // Numer nuty MIDI: A4 (440 Hz) = 69
        const midiNum = 69 + 12 * Math.log2(freq / 440);
        const roundedMidi = Math.round(midiNum);
        const cents = Math.round((midiNum - roundedMidi) * 100);

        const noteIndex = ((roundedMidi % 12) + 12) % 12;
        const noteName = NOTE_NAMES[noteIndex];
        const polishNoteName = POLISH_NOTE_NAMES[noteIndex];
        const solfege = SOLMIZATION[noteIndex];
        const octave = Math.floor(roundedMidi / 12) - 1;

        return {
            frequency: Math.round(freq * 10) / 10,
            midi: roundedMidi,
            noteName,
            polishNoteName,
            solfege,
            octave,
            cents, // od -50 do +50
            semitoneClass: noteIndex // 0 = C, 1 = C#, ..., 9 = A, 10 = A#/B, 11 = B/H
        };
    }

    /**
     * Główna pętla analizująca próbki z mikrofonu
     */
    function processLoop() {
        if (!isListening || !analyserNode) return;

        analyserNode.getFloatTimeDomainData(buffer);
        const rms = getRMS(buffer);

        // Próg głośności (0.010) odcinający szum tła i ciche odgłosy z otoczenia
        if (rms < 0.010) {
            if (callback) {
                callback({
                    isSilent: true,
                    rms,
                    pitch: null
                });
            }
        } else {
            const result = detectPitchYIN(buffer, audioCtx.sampleRate);
            if (result && result.confidence >= 0.68 && result.frequency >= 65 && result.frequency <= 1200) {
                const noteInfo = frequencyToNote(result.frequency);
                if (callback) {
                    callback({
                        isSilent: false,
                        rms,
                        confidence: result.confidence,
                        pitch: noteInfo
                    });
                }
            } else if (callback) {
                callback({
                    isSilent: false,
                    rms,
                    confidence: 0,
                    pitch: null
                });
            }
        }

        animFrameId = requestAnimationFrame(processLoop);
    }

    /**
     * Rozpoczyna nasłuchiwanie z mikrofonu
     */
    async function start(onPitch) {
        if (isListening) return true;

        if (!isSupported()) {
            throw new Error('Twoja przeglądarka nie obsługuje pobierania dźwięku z mikrofonu.');
        }

        callback = onPitch;

        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            sourceNode = audioCtx.createMediaStreamSource(micStream);
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = BUFFER_SIZE;

            sourceNode.connect(analyserNode);
            isListening = true;

            processLoop();
            return true;
        } catch (e) {
            stop();
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                throw new Error('Brak uprawnień do mikrofonu. Kliknij ikonę kłódki przy adresie strony i zezwól na mikrofon.');
            }
            throw e;
        }
    }

    /**
     * Zatrzymuje nasłuchiwanie i zwalnia mikrofon
     */
    function stop() {
        isListening = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        if (sourceNode) {
            try { sourceNode.disconnect(); } catch (e) {}
            sourceNode = null;
        }
        if (micStream) {
            micStream.getTracks().forEach((track) => track.stop());
            micStream = null;
        }
        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close(); } catch (e) {}
            audioCtx = null;
        }
        analyserNode = null;
    }

    return {
        isSupported,
        start,
        stop,
        frequencyToNote,
        isListening: () => isListening
    };
})();

