/* ksza.pl - wspólna obsługa gestu nad zapisem nutowym: przeciągnięcie
   góra/dół = krok o literę, stuknięcie bez przesunięcia = zmiana znaku.
   Przesunięcie WZGLĘDNE (co ile pikseli = jeden krok), bo Verovio przerysowuje
   nuty od zera i nie znamy ich dokładnej pozycji na ekranie. */
window.KszaGestureLayer = {
    setup(layerId, handlers) {
        const layer = document.getElementById(layerId);
        if (!layer) return;

        const DRAG_STEP_PX = 24;
        const TAP_THRESHOLD_PX = 4;
        let dragging = false;
        let startY = 0;
        let appliedSteps = 0;
        let moved = false;

        layer.addEventListener('pointerdown', (ev) => {
            if (handlers.canEdit && !handlers.canEdit()) return;
            dragging = true;
            moved = false;
            startY = ev.clientY;
            appliedSteps = 0;
            layer.setPointerCapture(ev.pointerId);
        });

        layer.addEventListener('pointermove', (ev) => {
            if (!dragging) return;
            const deltaY = ev.clientY - startY;
            if (Math.abs(deltaY) > TAP_THRESHOLD_PX) moved = true;
            const targetSteps = Math.round(-deltaY / DRAG_STEP_PX);
            const diff = targetSteps - appliedSteps;
            if (diff !== 0) {
                const dir = diff > 0 ? 1 : -1;
                for (let i = 0; i < Math.abs(diff); i++) {
                    handlers.moveLetter(dir);
                }
                appliedSteps = targetSteps;
            }
        });

        const endGesture = () => {
            if (!dragging) return;
            dragging = false;
            if (!moved && handlers.cycleAccidental) {
                handlers.cycleAccidental();
            }
        };

        layer.addEventListener('pointerup', endGesture);
        layer.addEventListener('pointercancel', endGesture);
    }
};
