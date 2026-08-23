(() => {
    "use strict";

    const SELECTORS = {
        canvas: "[data-site-grid]",
        anchor: "[data-grid-anchor]",
        title: "[data-grid-title]",
        divider: "[data-grid-divider]",
        highlight: "[data-grid-highlight]"
    };

    const PREFERRED_TILE_SIZE = 20;
    const DESKTOP_QUERY = "(min-width: 48rem)";
    const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
    const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
    const FADE_DURATION = 1000;
    const GAUSSIAN_SIGMA = 2.25;
    const GAUSSIAN_CUTOFF = 0.003;
    const GAUSSIAN_ALPHA = 0.035;
    const GLOW_COLOR = "216, 222, 232";
    const HIGHLIGHT_PROPERTIES = [
        "--grid-highlight-left",
        "--grid-highlight-top",
        "--grid-highlight-right",
        "--grid-highlight-bottom"
    ];

    const init = () => {
        const canvas = document.querySelector(SELECTORS.canvas);
        const anchor = document.querySelector(SELECTORS.anchor);

        if (!canvas || !anchor || typeof canvas.getContext !== "function") return;

        let context;
        try {
            context = canvas.getContext("2d");
        } catch (_error) {
            return;
        }
        if (!context) return;

        const root = document.documentElement;
        const body = document.body;
        const splitGapTiles = 2;
        const title = document.querySelector(SELECTORS.title);
        const divider = document.querySelector(SELECTORS.divider);
        const desktopMedia = window.matchMedia(DESKTOP_QUERY);
        const finePointerMedia = window.matchMedia(FINE_POINTER_QUERY);
        const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
        const fadingTiles = new Map();
        const initialTitleWidth = title
            ? {
                value: title.style.getPropertyValue("width"),
                priority: title.style.getPropertyPriority("width")
            }
            : null;
        const initialDividerTransform = divider
            ? {
                value: divider.style.getPropertyValue("transform"),
                priority: divider.style.getPropertyPriority("transform")
            }
            : null;

        let viewportWidth = 0;
        let viewportHeight = 0;
        let tileSize = PREFERRED_TILE_SIZE;
        let gridOffsetX = 0;
        let gridOffsetY = 0;
        let dividerTranslation = 0;
        let hoveredTile = null;
        let lastPointer = null;
        let geometryFrame = 0;
        let drawFrame = 0;

        const restoreProperty = (element, property, initial) => {
            if (!element || !initial) return;

            if (initial.value) {
                element.style.setProperty(property, initial.value, initial.priority);
            } else {
                element.style.removeProperty(property);
            }
        };

        const clearSplitAlignment = () => {
            restoreProperty(title, "width", initialTitleWidth);
            restoreProperty(divider, "transform", initialDividerTransform);
            dividerTranslation = 0;
        };

        const parseColumnSetting = (value) => {
            if (typeof value !== "string") return 0;

            const choices = value
                .split(/[^0-9]+/)
                .map((part) => Number.parseInt(part, 10))
                .filter((part) => Number.isFinite(part) && part > 0);

            if (choices.length === 0) return 0;
            if (choices.length === 1) return choices[0];
            return desktopMedia.matches ? choices[choices.length - 1] : choices[0];
        };

        const feedColumnCount = () => {
            const source = anchor.closest("[data-grid-columns]")
                || body?.closest("[data-grid-columns]")
                || document.querySelector("[data-grid-columns]");
            const explicitColumns = parseColumnSetting(source?.dataset.gridColumns);

            if (explicitColumns) return explicitColumns;
            if (body?.classList.contains("page-feed")) {
                return desktopMedia.matches ? 3 : 2;
            }
            return 1;
        };

        const syncSplitAlignment = () => {
            if (!title || !divider || !desktopMedia.matches) {
                clearSplitAlignment();
                return;
            }

            const titleBounds = title.getBoundingClientRect();
            const desiredTitleRight = gridOffsetX - 2 * splitGapTiles * tileSize;
            const desiredTitleWidth = desiredTitleRight - titleBounds.left;

            if (desiredTitleWidth > 0) {
                title.style.width = `${desiredTitleWidth}px`;
            } else {
                restoreProperty(title, "width", initialTitleWidth);
            }

            const dividerBounds = divider.getBoundingClientRect();
            const dividerBaseCenter = dividerBounds.left
                + dividerBounds.width / 2
                - dividerTranslation;
            const desiredDividerCenter = gridOffsetX - splitGapTiles * tileSize;
            dividerTranslation = desiredDividerCenter - dividerBaseCenter;
            divider.style.transform = `translateX(${dividerTranslation}px)`;
        };

        const clearHighlightProperties = (element) => {
            for (const property of HIGHLIGHT_PROPERTIES) {
                element.style.removeProperty(property);
            }
        };

        const syncHighlights = () => {
            const highlights = document.querySelectorAll(SELECTORS.highlight);

            for (const element of highlights) {
                const kind = element.dataset.gridHighlight;
                if (kind !== "panel") {
                    clearHighlightProperties(element);
                    continue;
                }

                const bounds = element.getBoundingClientRect();
                if (!bounds.width || !bounds.height || !tileSize) {
                    clearHighlightProperties(element);
                    continue;
                }

                const snappedLeft = gridOffsetX;
                const snappedRight = gridOffsetX
                    + Math.ceil((bounds.right - gridOffsetX) / tileSize) * tileSize;

                element.style.setProperty(
                    "--grid-highlight-left",
                    `${snappedLeft - bounds.left}px`
                );
                element.style.setProperty(
                    "--grid-highlight-right",
                    `${bounds.right - snappedRight}px`
                );

                const snappedTop = gridOffsetY
                    + Math.floor((bounds.top - gridOffsetY) / tileSize) * tileSize;
                const snappedBottom = gridOffsetY
                    + Math.ceil((bounds.bottom - gridOffsetY) / tileSize) * tileSize;

                element.style.setProperty(
                    "--grid-highlight-top",
                    `${snappedTop - bounds.top}px`
                );
                element.style.setProperty(
                    "--grid-highlight-bottom",
                    `${bounds.bottom - snappedBottom}px`
                );
            }
        };

        const tileAt = (x, y) => {
            const column = Math.floor((x - gridOffsetX) / tileSize);
            const row = Math.floor((y - gridOffsetY) / tileSize);
            return { column, row, key: `${column}:${row}` };
        };

        const canGlow = () => finePointerMedia.matches;

        const scheduleDraw = () => {
            if (!drawFrame) drawFrame = window.requestAnimationFrame(draw);
        };

        const updateHoveredTile = (nextTile) => {
            if (hoveredTile?.key === nextTile?.key) return;

            if (hoveredTile && !reducedMotionMedia.matches) {
                fadingTiles.set(hoveredTile.key, {
                    ...hoveredTile,
                    startedAt: performance.now()
                });
            }

            if (nextTile) fadingTiles.delete(nextTile.key);
            hoveredTile = nextTile;
            scheduleDraw();
        };

        const clearGlow = (allowFade = true) => {
            if (hoveredTile && allowFade && !reducedMotionMedia.matches && canGlow()) {
                fadingTiles.set(hoveredTile.key, {
                    ...hoveredTile,
                    startedAt: performance.now()
                });
            }
            hoveredTile = null;
            if (!allowFade || reducedMotionMedia.matches || !canGlow()) fadingTiles.clear();
            scheduleDraw();
        };

        const lightArea = (tile, strength) => {
            const radius = Math.ceil(
                GAUSSIAN_SIGMA * Math.sqrt(-2 * Math.log(GAUSSIAN_CUTOFF))
            );

            for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
                for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
                    const squaredDistance = columnOffset ** 2 + rowOffset ** 2;
                    const falloff = Math.exp(
                        -squaredDistance / (2 * GAUSSIAN_SIGMA ** 2)
                    );
                    if (falloff < GAUSSIAN_CUTOFF) continue;

                    context.fillStyle = `rgba(${GLOW_COLOR}, ${GAUSSIAN_ALPHA * strength * falloff})`;
                    context.fillRect(
                        gridOffsetX + (tile.column + columnOffset) * tileSize + 1,
                        gridOffsetY + (tile.row + rowOffset) * tileSize + 1,
                        Math.max(0, tileSize - 2),
                        Math.max(0, tileSize - 2)
                    );
                }
            }
        };

        function draw(time) {
            drawFrame = 0;
            context.clearRect(0, 0, viewportWidth, viewportHeight);

            if (!canGlow()) {
                fadingTiles.clear();
                hoveredTile = null;
                return;
            }

            if (reducedMotionMedia.matches) {
                fadingTiles.clear();
            } else {
                for (const [key, tile] of fadingTiles) {
                    const strength = Math.max(0, 1 - (time - tile.startedAt) / FADE_DURATION);
                    if (strength === 0) {
                        fadingTiles.delete(key);
                    } else {
                        lightArea(tile, strength);
                    }
                }
            }

            if (hoveredTile) lightArea(hoveredTile, 1);
            if (fadingTiles.size) scheduleDraw();
        }

        const syncGeometry = () => {
            geometryFrame = 0;

            const bounds = anchor.getBoundingClientRect();
            if (!bounds.width) return;

            const columnMultiple = feedColumnCount();
            const approximateCount = Math.max(1, Math.round(bounds.width / PREFERRED_TILE_SIZE));
            const columnCount = columnMultiple > 1
                ? Math.max(
                    columnMultiple,
                    Math.round(approximateCount / columnMultiple) * columnMultiple
                )
                : approximateCount;

            tileSize = bounds.width / columnCount;
            gridOffsetX = bounds.left;
            gridOffsetY = bounds.top;
            root.style.setProperty("--grid-tile-size", `${tileSize}px`);
            root.style.setProperty("--grid-offset-x", `${gridOffsetX}px`);
            root.style.setProperty("--grid-offset-y", `${gridOffsetY}px`);

            syncSplitAlignment();
            syncHighlights();

            if (lastPointer && canGlow()) {
                updateHoveredTile(tileAt(lastPointer.x, lastPointer.y));
            }
            scheduleDraw();
        };

        const scheduleGeometrySync = () => {
            if (!geometryFrame) {
                geometryFrame = window.requestAnimationFrame(syncGeometry);
            }
        };

        const resizeCanvas = () => {
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;
            canvas.width = Math.round(viewportWidth * pixelRatio);
            canvas.height = Math.round(viewportHeight * pixelRatio);
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            scheduleGeometrySync();
        };

        const handlePointerMove = (event) => {
            if (!canGlow() || event.pointerType === "touch") {
                lastPointer = null;
                clearGlow(false);
                return;
            }

            lastPointer = { x: event.clientX, y: event.clientY };
            updateHoveredTile(tileAt(event.clientX, event.clientY));
        };

        const handlePointerLeave = () => {
            lastPointer = null;
            clearGlow(true);
        };

        const handleInteractionPreferenceChange = () => {
            if (!canGlow()) {
                lastPointer = null;
                clearGlow(false);
            } else if (reducedMotionMedia.matches) {
                fadingTiles.clear();
                scheduleDraw();
            }
            scheduleGeometrySync();
        };

        const observeMedia = (media, handler) => {
            if (typeof media.addEventListener === "function") {
                media.addEventListener("change", handler);
            } else if (typeof media.addListener === "function") {
                media.addListener(handler);
            }
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        root.addEventListener("pointerleave", handlePointerLeave);
        window.addEventListener("blur", handlePointerLeave);
        window.addEventListener("load", scheduleGeometrySync);
        window.addEventListener("resize", resizeCanvas, { passive: true });
        window.addEventListener("scroll", scheduleGeometrySync, { passive: true });
        observeMedia(desktopMedia, scheduleGeometrySync);
        observeMedia(finePointerMedia, handleInteractionPreferenceChange);
        observeMedia(reducedMotionMedia, handleInteractionPreferenceChange);

        if (document.fonts?.ready) {
            document.fonts.ready.then(scheduleGeometrySync).catch(() => {});
        }

        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(scheduleGeometrySync);
            observer.observe(anchor);
            if (body && body !== anchor) observer.observe(body);
            if (title && title !== anchor) observer.observe(title);
            if (divider && divider !== anchor) observer.observe(divider);
        }

        resizeCanvas();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
