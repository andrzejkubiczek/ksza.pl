import { KszaAudio, KszaTempo } from './core.js';

document.addEventListener('DOMContentLoaded', () => {
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    }

    const slider = document.getElementById('tempo-slider');
    const valueLabel = document.getElementById('tempo-value');
    if (slider) {
        const initialPercent = Math.round(KszaTempo.get() * 100);
        slider.value = initialPercent;
        if (valueLabel) valueLabel.textContent = `${initialPercent}%`;

        slider.addEventListener('input', () => {
            const percent = parseInt(slider.value, 10);
            KszaTempo.set(percent / 100);
            if (valueLabel) valueLabel.textContent = `${percent}%`;
        });
    }

    if (KszaAudio.prewarmDefaultInstrument) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(KszaAudio.prewarmDefaultInstrument);
        } else {
            setTimeout(KszaAudio.prewarmDefaultInstrument, 300);
        }
    }
});

// Wspólne skróty klawiaturowe: Spacja = odtwórz, Enter = dalej / sprawdź.
// Strony "Zaśpiewaj" (play-model-btn) mają własną obsługę klawiszy.
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-btn');
    if (!playBtn || document.getElementById('play-model-btn')) return;

    const isUsable = (el) => el && !el.disabled && el.offsetParent !== null;

    playBtn.setAttribute('aria-keyshortcuts', 'Space');
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.setAttribute('aria-keyshortcuts', 'Enter');

    const hint = document.createElement('p');
    hint.className = 'shortcut-hint';
    hint.textContent = nextBtn ? 'Skróty: Spacja – odtwórz, Enter – dalej' : 'Skrót: Spacja – odtwórz';
    const controls = playBtn.closest('.player-controls') || playBtn.parentElement;
    controls.insertAdjacentElement('afterend', hint);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const tag = e.target.tagName;
        if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(tag) || e.target.isContentEditable) return;

        if (e.code === 'Space' && isUsable(playBtn)) {
            e.preventDefault();
            playBtn.click();
        } else if (e.code === 'Enter') {
            const target = [nextBtn, document.getElementById('check-btn')].find(isUsable);
            if (target) {
                e.preventDefault();
                target.click();
            }
        }
    });
});
