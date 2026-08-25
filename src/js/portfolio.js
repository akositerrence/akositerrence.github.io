console.log("portfolio.js loaded");

let portfolioMasonry = null;
let portfolioProjects = [];
let portfolioCards = [];
let visiblePortfolioCards = [];
let deferredPortfolioCards = [];
let portfolioExpanded = false;
let portfolioInitialized = false;
let portfolioViewportSegments = 1;
let portfolioResizeFrame = 0;
let portfolioGrid = null;
let portfolioLoadMoreRow = null;
let portfolioLoadMoreButton = null;

const MOBILE_PORTFOLIO_VIEWPORT_INCREMENT = 1.5;
const DESKTOP_PORTFOLIO_VIEWPORT_INCREMENT = 2;

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".portfolio-grid");

    if (!grid) {
        console.warn(".portfolio-grid element not found");
        return;
    }

    portfolioGrid = grid;
    portfolioLoadMoreRow = document.querySelector(".portfolio-load-more-row");
    portfolioLoadMoreButton = document.querySelector(".portfolio-load-more-button");
    portfolioLoadMoreButton?.addEventListener("click", revealNextPortfolioBatch);

    loadProjects(grid);
});

async function loadProjects(grid) {
    try {
        const response = await fetch("./projects.json");

        if (!response.ok) {
            throw new Error(
                `Could not load projects.json. Status: ${response.status}`
            );
        }

        portfolioProjects = await response.json();

        if (!Array.isArray(portfolioProjects)) {
            throw new Error("projects.json must contain an array");
        }

        portfolioCards = portfolioProjects.map(createProjectCard);

        initPortfolioMasonry(grid);
        selectPortfolioCardsForCurrentPage();
        updatePortfolioLoadMoreVisibility();
        revealPortfolioGrid(grid);

        await Promise.all(
            visiblePortfolioCards.map((entry, index) =>
                loadPortfolioImage(entry, index < 3 ? "high" : "auto")
            )
        );

        portfolioInitialized = true;
        beginDeferredPortfolioPreload();
        startPortfolioResizeTracking();
    } catch (error) {
        console.error("Portfolio failed to load:", error);
        showPortfolioError(grid);
        initPortfolioMasonry(grid);
        revealPortfolioGrid(grid);
        hidePortfolioLoadMore();
    }
}

function createProjectCard(project, index) {
    const article = document.createElement("article");
    article.className = "portfolio-project-instance brick";

    const link = document.createElement("a");
    link.className = "portfolio-project-link";
    link.href = getSafeHref(project.href);
    link.target = "";
    link.rel = "noopener noreferrer";

    const projectTitle = String(project.title || "Untitled project");
    link.setAttribute("aria-label", `View project: ${projectTitle}`);

    const image = document.createElement("img");
    image.className = "portfolio-project-image portfolio-img-loading";
    image.alt = String(project.alt || project.title || "Portfolio project");

    const width = project.width;
    const height = project.height;
    const hasDimensions = Number.isFinite(width) && width > 0 &&
        Number.isFinite(height) && height > 0;

    if (hasDimensions) {
        image.width = width;
        image.height = height;
        image.style.aspectRatio = `${width} / ${height}`;
    }

    const overlay = document.createElement("div");
    overlay.className = "portfolio-project-overlay";

    const title = document.createElement("div");
    title.className = "project-img-title";
    title.textContent = projectTitle;
    overlay.appendChild(title);

    const details = [project.date, project.affiliation]
        .filter(Boolean)
        .join(" · ");

    if (details) {
        const detailLine = document.createElement("div");
        detailLine.className = "project-img-title-affiliation";
        detailLine.textContent = details;
        overlay.appendChild(detailLine);
    }

    link.append(image, overlay);
    article.appendChild(link);

    return {
        article,
        image,
        index,
        imageSource: String(project.image || ""),
        width,
        height,
        hasDimensions,
        loadPromise: null
    };
}

function selectPortfolioCardsForCurrentPage(preserveExistingCards = false) {
    if (!portfolioGrid || portfolioExpanded) {
        return;
    }

    const previouslyVisibleCards = new Set(
        portfolioCards.filter(entry => entry.article.isConnected)
    );
    if (!preserveExistingCards) {
        portfolioCards.forEach(entry => entry.article.remove());
        refreshPortfolioItems();
    }

    visiblePortfolioCards = [];
    deferredPortfolioCards = [];
    const layout = getInitialPortfolioLayout();

    portfolioCards.forEach(entry => {
        if (!entry.hasDimensions) {
            deferredPortfolioCards.push(entry);
            return;
        }

        const columnIndex = getShortestPortfolioColumn(layout.columnHeights);
        const imageHeight = layout.imageWidth * entry.height / entry.width;
        const cardBottom = layout.columnHeights[columnIndex] +
            layout.verticalChrome + imageHeight;

        if (cardBottom <= layout.relativeBoundary + 0.5) {
            layout.columnHeights[columnIndex] = cardBottom;
            visiblePortfolioCards.push(entry);
            return;
        }

        deferredPortfolioCards.push(entry);
    });

    if (preserveExistingCards) {
        const selectedCards = new Set(visiblePortfolioCards);
        visiblePortfolioCards = portfolioCards.filter(entry =>
            previouslyVisibleCards.has(entry) || selectedCards.has(entry)
        );
        const retainedCards = new Set(visiblePortfolioCards);
        deferredPortfolioCards = portfolioCards.filter(entry =>
            !retainedCards.has(entry)
        );
    }

    if (preserveExistingCards) {
        insertNewPortfolioCards(previouslyVisibleCards);
    } else {
        const fragment = document.createDocumentFragment();
        visiblePortfolioCards.forEach(entry => {
            if (!previouslyVisibleCards.has(entry)) {
                startPortfolioCardReveal(entry);
            }
            fragment.appendChild(entry.article);
        });
        portfolioGrid.appendChild(fragment);
        visiblePortfolioCards.forEach(reservePortfolioImageGeometry);
    }
    refreshPortfolioItems();

    portfolioGrid.dataset.visibleCardCount = String(visiblePortfolioCards.length);
    portfolioGrid.dataset.deferredCardCount = String(deferredPortfolioCards.length);
    portfolioGrid.dataset.viewportSegments = String(portfolioViewportSegments);
}

function insertNewPortfolioCards(previouslyVisibleCards) {
    visiblePortfolioCards.forEach((entry, index) => {
        if (previouslyVisibleCards.has(entry)) {
            return;
        }

        startPortfolioCardReveal(entry);
        const nextVisibleCard = visiblePortfolioCards
            .slice(index + 1)
            .find(candidate => candidate.article.isConnected);
        portfolioGrid.insertBefore(
            entry.article,
            nextVisibleCard?.article || null
        );
        reservePortfolioImageGeometry(entry);
    });
}

function getInitialPortfolioLayout() {
    const gridBounds = portfolioGrid.getBoundingClientRect();
    const columnCount = window.matchMedia("(min-width: 768px)").matches ? 3 : 2;
    const columnWidth = gridBounds.width / columnCount;
    const titleCard = portfolioGrid.querySelector(".page-title-card");
    const titleHeight = titleCard?.getBoundingClientRect().height || 400;
    const chrome = measurePortfolioCardChrome();
    const gridDocumentTop = gridBounds.top + window.scrollY;

    return {
        columnHeights: [titleHeight, ...Array(columnCount - 1).fill(0)],
        imageWidth: Math.max(1, columnWidth - chrome.horizontal),
        verticalChrome: chrome.vertical,
        relativeBoundary: Math.max(
            0,
            getPortfolioDocumentBoundary() - gridDocumentTop
        )
    };
}

function measurePortfolioCardChrome() {
    const probe = portfolioCards.find(entry => entry.hasDimensions);
    if (!probe) {
        return { horizontal: 14, vertical: 14 };
    }

    const probeWasConnected = probe.article.isConnected;
    if (!probeWasConnected) {
        portfolioGrid.appendChild(probe.article);
    }
    const cardStyle = window.getComputedStyle(probe.article);
    const link = probe.article.querySelector(".portfolio-project-link");
    const linkStyle = window.getComputedStyle(link);
    const horizontal = getPortfolioHorizontalChrome(cardStyle) +
        getPortfolioHorizontalChrome(linkStyle);
    const vertical = getPortfolioVerticalChrome(cardStyle) +
        getPortfolioVerticalChrome(linkStyle);
    if (!probeWasConnected) {
        probe.article.remove();
        refreshPortfolioItems();
    }

    return { horizontal, vertical };
}

function getPortfolioHorizontalChrome(style) {
    return getPortfolioCssPixels(style.paddingLeft) +
        getPortfolioCssPixels(style.paddingRight) +
        getPortfolioCssPixels(style.borderLeftWidth) +
        getPortfolioCssPixels(style.borderRightWidth);
}

function getPortfolioVerticalChrome(style) {
    return getPortfolioCssPixels(style.paddingTop) +
        getPortfolioCssPixels(style.paddingBottom) +
        getPortfolioCssPixels(style.borderTopWidth) +
        getPortfolioCssPixels(style.borderBottomWidth);
}

function getPortfolioCssPixels(value) {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}

function getShortestPortfolioColumn(columnHeights) {
    return columnHeights.reduce(
        (shortest, height, index) =>
            height < columnHeights[shortest] ? index : shortest,
        0
    );
}

function getPortfolioDocumentBoundary() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportIncrement = window.matchMedia("(min-width: 768px)").matches
        ? DESKTOP_PORTFOLIO_VIEWPORT_INCREMENT
        : MOBILE_PORTFOLIO_VIEWPORT_INCREMENT;
    return viewportHeight * viewportIncrement * portfolioViewportSegments;
}

function reservePortfolioImageGeometry(entry) {
    if (entry.image.naturalWidth > 0) {
        entry.image.style.removeProperty("height");
        return;
    }

    const imageWidth = entry.image.getBoundingClientRect().width;
    if (imageWidth > 0) {
        entry.image.style.height = `${imageWidth * entry.height / entry.width}px`;
    }
}

function startPortfolioCardReveal(entry) {
    const card = entry.article;
    card.classList.remove("portfolio-card-revealing");
    card.classList.add("portfolio-card-revealing");

    const finish = () => {
        card.classList.remove("portfolio-card-revealing");
    };

    card.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 700);
}

function loadPortfolioImage(entry, priority = "auto") {
    if (entry.loadPromise) {
        return entry.loadPromise;
    }

    entry.image.loading = "eager";
    entry.image.fetchPriority = priority;
    entry.loadPromise = new Promise(resolve => {
        let settled = false;
        const settle = (failed = false) => {
            if (settled) {
                return;
            }
            settled = true;
            entry.image.removeEventListener("load", handleLoad);
            entry.image.removeEventListener("error", handleError);
            if (failed) {
                console.warn(`Could not load project image: ${entry.imageSource}`);
            }
            if (entry.image.naturalWidth > 0) {
                entry.image.style.removeProperty("height");
            }
            entry.image.classList.add("portfolio-img-loaded");
            if (entry.article.isConnected) {
                requestPortfolioLayout();
            }
            resolve();
        };
        const handleLoad = () => settle(false);
        const handleError = () => settle(true);

        entry.image.addEventListener("load", handleLoad, { once: true });
        entry.image.addEventListener("error", handleError, { once: true });
        entry.image.src = entry.imageSource;

        if (entry.image.complete) {
            settle(entry.image.naturalWidth === 0);
        }
    });

    return entry.loadPromise;
}

function beginDeferredPortfolioPreload() {
    deferredPortfolioCards.forEach(entry => {
        loadPortfolioImage(entry, "low");
    });
}

function revealNextPortfolioBatch() {
    if (portfolioExpanded || !portfolioGrid) {
        return;
    }

    portfolioLoadMoreButton?.blur();

    portfolioViewportSegments += 1;
    selectPortfolioCardsForCurrentPage(true);
    visiblePortfolioCards.forEach(entry => {
        loadPortfolioImage(entry, "low");
    });

    portfolioExpanded = deferredPortfolioCards.length === 0;
    portfolioLoadMoreButton?.setAttribute(
        "aria-expanded",
        String(portfolioExpanded)
    );
    updatePortfolioLoadMoreVisibility();
}

function updatePortfolioLoadMoreVisibility() {
    if (!portfolioLoadMoreRow || !portfolioLoadMoreButton) {
        return;
    }

    portfolioLoadMoreRow.hidden = portfolioExpanded ||
        deferredPortfolioCards.length === 0;
}

function hidePortfolioLoadMore() {
    if (portfolioLoadMoreRow) {
        portfolioLoadMoreRow.hidden = true;
    }
}

function startPortfolioResizeTracking() {
    const schedule = () => {
        if (portfolioExpanded || portfolioResizeFrame) {
            return;
        }
        portfolioResizeFrame = window.requestAnimationFrame(() => {
            portfolioResizeFrame = 0;
            if (!portfolioInitialized || portfolioExpanded) {
                return;
            }
            selectPortfolioCardsForCurrentPage(true);
            updatePortfolioLoadMoreVisibility();
        });
    };

    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
}

function refreshPortfolioItems() {
    if (!portfolioGrid || !portfolioMasonry) {
        return;
    }
    if (typeof portfolioMasonry.reloadItems === "function") {
        portfolioMasonry.reloadItems();
    }
    if (typeof portfolioMasonry.layout === "function") {
        portfolioMasonry.layout();
    }
}

function initPortfolioMasonry(grid) {
    grid.classList.remove("feed-masonry-enhanced");

    if (typeof window.Masonry !== "function") {
        console.warn(
            "Masonry is unavailable; using the portfolio fallback layout."
        );
        resetPortfolioMasonryStyles(grid);
        return false;
    }

    let masonry = null;

    try {
        masonry = new window.Masonry(grid, {
            itemSelector: ".brick",
            columnWidth: ".brick",
            gutter: 0,
            percentPosition: true,
            transitionDuration: 0
        });

        portfolioMasonry = masonry;
        grid.classList.add("feed-masonry-enhanced");

        if (typeof window.imagesLoaded === "function") {
            const imageTracker = window.imagesLoaded(grid);

            if (imageTracker && typeof imageTracker.on === "function") {
                imageTracker.on("progress", requestPortfolioLayout);
                imageTracker.on("always", requestPortfolioLayout);
            }
        } else {
            console.warn(
                "imagesLoaded is unavailable; native image events will update the portfolio layout."
            );
        }

        return true;
    } catch (error) {
        console.error(
            "Portfolio Masonry initialization failed; using the fallback layout:",
            error
        );

        if (masonry && typeof masonry.destroy === "function") {
            try {
                masonry.destroy();
            } catch (destroyError) {
                console.warn(
                    "Could not fully destroy the partial portfolio layout:",
                    destroyError
                );
            }
        }

        portfolioMasonry = null;
        resetPortfolioMasonryStyles(grid);
        return false;
    }
}

function revealPortfolioGrid(grid) {
    grid.classList.remove("gallery-loading");
    grid.classList.add("gallery-ready");
}

function requestPortfolioLayout() {
    if (portfolioMasonry && typeof portfolioMasonry.layout === "function") {
        portfolioMasonry.layout();
    }
}

function resetPortfolioMasonryStyles(grid) {
    grid.classList.remove("feed-masonry-enhanced");
    grid.style.removeProperty("height");
    grid.style.removeProperty("position");

    grid.querySelectorAll(".brick").forEach(item => {
        item.style.removeProperty("bottom");
        item.style.removeProperty("left");
        item.style.removeProperty("position");
        item.style.removeProperty("right");
        item.style.removeProperty("top");
        item.style.removeProperty("transform");
    });
}

function showPortfolioError(grid) {
    if (grid.querySelector(".portfolio-load-error")) {
        return;
    }

    const message = document.createElement("p");
    message.className = "portfolio-load-error standard-text brick";
    message.textContent = "Projects could not be loaded.";
    grid.appendChild(message);
}

function getSafeHref(value) {
    const href = String(value || "#").trim();
    const unsafeProtocol = /^(javascript|data|vbscript):/i;
    return unsafeProtocol.test(href) ? "#" : href;
}
