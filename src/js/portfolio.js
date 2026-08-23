console.log("portfolio.js loaded");

let portfolioMasonry = null;

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".portfolio-grid");

    if (!grid) {
        console.warn(".portfolio-grid element not found");
        return;
    }

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

        const projects = await response.json();

        if (!Array.isArray(projects)) {
            throw new Error("projects.json must contain an array");
        }

        const fragment = document.createDocumentFragment();

        projects.forEach((project, index) => {
            const card = createProjectCard(project, index);
            fragment.appendChild(card);
        });

        grid.appendChild(fragment);
    } catch (error) {
        console.error("Portfolio failed to load:", error);

        showPortfolioError(grid);
    } finally {
        initPortfolioMasonry(grid);
        revealPortfolioGrid(grid);
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

    const projectTitle = String(
        project.title || "Untitled project"
    );

    link.setAttribute(
        "aria-label",
        `View project: ${projectTitle}`
    );

    const image = document.createElement("img");
    image.className =
        "portfolio-project-image portfolio-img-loading";

    image.src = String(project.image || "");
    image.alt = String(
        project.alt ||
        project.title ||
        "Portfolio project"
    );

    image.loading = index < 6 ? "eager" : "lazy";
    image.fetchPriority = index < 3 ? "high" : "auto";

    image.addEventListener("load", () => {
        image.classList.add("portfolio-img-loaded");
        requestPortfolioLayout();
    });

    image.addEventListener("error", () => {
        console.warn(
            `Could not load project image: ${image.src}`
        );

        image.classList.add("portfolio-img-loaded");
        requestPortfolioLayout();
    });

    if (image.complete) {
        image.classList.add("portfolio-img-loaded");
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

        detailLine.className =
            "project-img-title-affiliation";

        detailLine.textContent = details;

        overlay.appendChild(detailLine);
    }

    link.append(image, overlay);
    article.appendChild(link);

    return article;
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
            percentPosition: true
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
    if (
        portfolioMasonry &&
        typeof portfolioMasonry.layout === "function"
    ) {
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
    const message = document.createElement("p");

    message.className =
        "portfolio-load-error standard-text brick";

    message.textContent =
        "Projects could not be loaded.";

    grid.appendChild(message);
}

function getSafeHref(value) {
    const href = String(value || "#").trim();

    const unsafeProtocol =
        /^(javascript|data|vbscript):/i;

    if (unsafeProtocol.test(href)) {
        return "#";
    }

    return href;
}
