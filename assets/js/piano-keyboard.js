(() => {
    const WHITE_KEY_WIDTH = 46;
    const WHITE_KEY_HEIGHT = 170;
    const BLACK_KEY_WIDTH = 28;

    const WHITE_LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'h', 'c', 'd', 'e', 'f'];

    const BLACK_KEYS_AFTER = [
        { afterIndex: 0, sharp: 'cis', flat: 'des' },
        { afterIndex: 1, sharp: 'dis', flat: 'es' },
        { afterIndex: 3, sharp: 'fis', flat: 'ges' },
        { afterIndex: 4, sharp: 'gis', flat: 'as' },
        { afterIndex: 5, sharp: 'ais', flat: 'b' },
        { afterIndex: 7, sharp: 'cis', flat: 'des' },
        { afterIndex: 8, sharp: 'dis', flat: 'es' }
    ];

    function buildKeyboardHtml() {
        const totalWidth = WHITE_LETTERS.length * WHITE_KEY_WIDTH;
        let whiteHtml = '';
        let blackHtml = '';

        WHITE_LETTERS.forEach((letter, i) => {
            const left = i * WHITE_KEY_WIDTH;
            whiteHtml += `<div class="piano-white-key" style="left:${left}px;width:${WHITE_KEY_WIDTH}px;"><span class="piano-key-label">${letter}</span></div>`;
        });

        BLACK_KEYS_AFTER.forEach((bk) => {
            const centerX = (bk.afterIndex + 1) * WHITE_KEY_WIDTH;
            const left = centerX - BLACK_KEY_WIDTH / 2;
            blackHtml += `<div class="piano-black-key" style="left:${left}px;width:${BLACK_KEY_WIDTH}px;"><span class="piano-key-label">${bk.sharp}</span><span class="piano-key-label">${bk.flat}</span></div>`;
        });

        return `<div class="piano-keyboard" style="width:${totalWidth}px;height:${WHITE_KEY_HEIGHT}px;">${whiteHtml}${blackHtml}</div>`;
    }

    function buildWidgetHtml() {
        return `<button type="button" class="btn-ghost piano-keyboard-toggle" aria-expanded="false">Pokaż klawiaturę</button><div class="piano-keyboard-panel" hidden>${buildKeyboardHtml()}</div>`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.piano-keyboard-mount').forEach((mount) => {
            mount.innerHTML = buildWidgetHtml();

            const toggle = mount.querySelector('.piano-keyboard-toggle');
            const panel = mount.querySelector('.piano-keyboard-panel');
            toggle.addEventListener('click', () => {
                const willShow = panel.hidden;
                panel.hidden = !willShow;
                toggle.setAttribute('aria-expanded', String(willShow));
                toggle.textContent = willShow ? 'Ukryj klawiaturę' : 'Pokaż klawiaturę';
            });
        });
    });

    window.KszaPianoKeyboard = { buildKeyboardHtml };
})();
