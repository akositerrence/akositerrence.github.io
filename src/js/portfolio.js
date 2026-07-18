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

        initPortfolioMasonry(grid);
    } catch (error) {
        console.error("Portfolio failed to load:", error);

        showPortfolioError(grid);
        initPortfolioMasonry(grid);
    }
}

function createProjectCard(project, index) {
    const article = document.createElement("article");
    article.className = "portfolio-project-instance brick";

    const link = document.createElement("a");
    link.className = "portfolio-project-link";
    link.href = getSafeHref(project.href);
    link.target = "_blank";
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

        if (portfolioMasonry) {
            portfolioMasonry.layout();
        }
    });

    image.addEventListener("error", () => {
        console.warn(
            `Could not load project image: ${image.src}`
        );

        image.classList.add("portfolio-img-loaded");
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
    portfolioMasonry = new Masonry(grid, {
        itemSelector: ".brick",
        columnWidth: ".brick",
        gutter: 0,
        percentPosition: true
    });

    grid.classList.remove("gallery-loading");
    grid.classList.add("gallery-ready");

    imagesLoaded(grid).on("progress", () => {
        portfolioMasonry.layout();
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