(() => {
    "use strict";

    const CARD_SELECTOR = "[data-fit-card]";
    const TEXT_SELECTOR = "[data-fit-card-text]";
    const WIDTH_CAP = 0.75;
    const SCALE_PROPERTY = "--title-card-text-scale";

    const init = () => {
        const groups = [...document.querySelectorAll(TEXT_SELECTOR)];
        if (!groups.length) return;

        let frame = 0;

        const fit = () => {
            frame = 0;

            for (const group of groups) {
                const card = group.closest(CARD_SELECTOR);
                if (!card) continue;

                const cardWidth = card.getBoundingClientRect().width;
                const naturalWidth = Math.max(group.scrollWidth, group.offsetWidth);

                if (!cardWidth || !naturalWidth) {
                    group.style.removeProperty(SCALE_PROPERTY);
                    continue;
                }

                const scale = Math.min(1, cardWidth * WIDTH_CAP / naturalWidth);
                group.style.setProperty(SCALE_PROPERTY, String(scale));
            }
        };

        const scheduleFit = () => {
            if (frame) return;
            frame = requestAnimationFrame(fit);
        };

        scheduleFit();
        window.addEventListener("load", scheduleFit, { once: true });
        window.addEventListener("resize", scheduleFit, { passive: true });

        if (document.fonts?.ready) {
            document.fonts.ready.then(scheduleFit).catch(() => {});
        }

        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(scheduleFit);
            for (const group of groups) {
                const card = group.closest(CARD_SELECTOR);
                if (card) observer.observe(card);
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
