console.log("gallery.js loaded");

let photos = [];
let currentPhotoIndex = 0;
let msnry = null;
let preloadedPhotoSrcs = new Set();
let lightboxLoadId = 0;
let galleryCards = [];
let visibleGalleryCards = [];
let deferredGalleryCards = [];
let galleryExpanded = false;
let galleryInitialized = false;
let galleryResizeFrame = 0;
let galleryGrid = null;
let loadMoreRow = null;
let loadMoreButton = null;
let galleryViewportSegments = 1;

const MOBILE_GALLERY_VIEWPORT_INCREMENT = 1.5;
const DESKTOP_GALLERY_VIEWPORT_INCREMENT = 2;

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".project-gallery");
    if (!grid) {
        console.warn(".project-gallery element not found");
        return;
    }

    galleryGrid = grid;
    loadMoreRow = document.querySelector(".gallery-load-more-row");
    loadMoreButton = document.querySelector(".gallery-load-more-button");
    loadMoreButton?.addEventListener("click", revealNextGalleryBatch);

    loadGallery(grid);
});

async function loadGallery(grid) {
    try {
        const response = await fetch("./photos.json");
        if (!response.ok) {
            throw new Error("Could not load photos.json");
        }
        photos = await response.json();
        if (!Array.isArray(photos)) {
            throw new Error("photos.json must be an array");
        }

        galleryCards = photos.map(createPhotoCard);
        createLightbox();

        initMasonry(grid);
        selectGalleryCardsForCurrentPage();
        updateLoadMoreVisibility();
        revealGalleryGrid(grid);

        await Promise.all(
            visibleGalleryCards.map((entry, index) =>
                loadThumbnail(entry, index < 3 ? "high" : "auto")
            )
        );

        galleryInitialized = true;
        beginDeferredThumbnailPreload();
        startGalleryResizeTracking();
    } catch (error) {
        console.error("Gallery failed to load:", error);
        showGalleryError(grid);
        initMasonry(grid);
        revealGalleryGrid(grid);
        hideLoadMore();
    }
}

function createPhotoCard(photo, index) {
    const card = document.createElement("div");
    card.className = "gallery-instance brick";
    const thumbSrc = getThumbnailSrc(photo.src);
    const location = cleanText(photo.location);
    const date = cleanText(photo.date);
    const alt = cleanText(photo.alt || getPhotoDetails(photo) || "gallery photo");
    const width = photo.width;
    const height = photo.height;
    const hasDimensions = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
    const dimensions = hasDimensions ? ` width="${width}" height="${height}"` : "";

    card.innerHTML = `
        <button class="instance-title gallery-photo-button" type="button">
            <img class="gallery-img-loading" alt="${alt}"${dimensions}>
            <div class="instance-title-group">
                ${location ? `<div class="project-img-title-affiliation gallery-hover-location">${location}</div>` : ""}
                ${date ? `<div class="project-img-title-affiliation gallery-hover-date">${date}</div>` : ""}
            </div>
        </button>
    `;
    const img = card.querySelector("img");
    if (hasDimensions) {
        img.style.aspectRatio = `${width} / ${height}`;
    }

    const button = card.querySelector(".gallery-photo-button");
    button.addEventListener("click", () => {
        openLightbox(index);
    });

    return {
        card,
        img,
        index,
        thumbSrc,
        width,
        height,
        hasDimensions,
        loadPromise: null
    };
}

function selectGalleryCardsForCurrentPage() {
    if (!galleryGrid || galleryExpanded) {
        return;
    }

    const previouslyVisibleCards = new Set(
        galleryCards.filter(entry => entry.card.isConnected)
    );
    galleryCards.forEach(entry => entry.card.remove());
    refreshGalleryItems();

    visibleGalleryCards = [];
    deferredGalleryCards = [];
    const layout = getInitialGalleryLayout();

    galleryCards.forEach(entry => {
        if (!entry.hasDimensions) {
            deferredGalleryCards.push(entry);
            return;
        }

        const columnIndex = getShortestColumnIndex(layout.columnHeights);
        const imageHeight = layout.imageWidth * entry.height / entry.width;
        const cardBottom = layout.columnHeights[columnIndex] + layout.verticalChrome + imageHeight;

        if (cardBottom <= layout.relativeBoundary + 0.5) {
            layout.columnHeights[columnIndex] = cardBottom;
            visibleGalleryCards.push(entry);
            return;
        }

        deferredGalleryCards.push(entry);
    });

    const fragment = document.createDocumentFragment();
    visibleGalleryCards.forEach(entry => {
        if (!previouslyVisibleCards.has(entry)) {
            startGalleryCardReveal(entry);
        }
        fragment.appendChild(entry.card);
    });
    galleryGrid.appendChild(fragment);
    visibleGalleryCards.forEach(reserveThumbnailGeometry);
    refreshGalleryItems();

    galleryGrid.dataset.visibleCardCount = String(visibleGalleryCards.length);
    galleryGrid.dataset.deferredCardCount = String(deferredGalleryCards.length);
    galleryGrid.dataset.viewportSegments = String(galleryViewportSegments);
}

function startGalleryCardReveal(entry) {
    const card = entry.card;
    card.classList.remove("gallery-card-revealing");
    card.classList.add("gallery-card-revealing");

    const finish = () => {
        card.classList.remove("gallery-card-revealing");
    };

    card.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 700);
}

function getInitialGalleryLayout() {
    const gridBounds = galleryGrid.getBoundingClientRect();
    const columnCount = window.matchMedia("(min-width: 768px)").matches ? 3 : 2;
    const columnWidth = gridBounds.width / columnCount;
    const titleCard = galleryGrid.querySelector(".page-title-card");
    const titleHeight = titleCard?.getBoundingClientRect().height || 400;
    const chrome = measureGalleryCardChrome();
    const gridDocumentTop = gridBounds.top + window.scrollY;

    return {
        columnHeights: [titleHeight, ...Array(columnCount - 1).fill(0)],
        imageWidth: Math.max(1, columnWidth - chrome.horizontal),
        verticalChrome: chrome.vertical,
        relativeBoundary: Math.max(0, getGalleryDocumentBoundary() - gridDocumentTop)
    };
}

function measureGalleryCardChrome() {
    const probe = galleryCards.find(entry => entry.hasDimensions);
    if (!probe) {
        return { horizontal: 14, vertical: 14 };
    }

    galleryGrid.appendChild(probe.card);
    const cardStyle = window.getComputedStyle(probe.card);
    const button = probe.card.querySelector(".gallery-photo-button");
    const buttonStyle = window.getComputedStyle(button);
    const horizontal = getHorizontalChrome(cardStyle) + getHorizontalChrome(buttonStyle);
    const vertical = getVerticalChrome(cardStyle) + getVerticalChrome(buttonStyle);
    probe.card.remove();
    refreshGalleryItems();

    return { horizontal, vertical };
}

function getHorizontalChrome(style) {
    return getCssPixels(style.paddingLeft) + getCssPixels(style.paddingRight) +
        getCssPixels(style.borderLeftWidth) + getCssPixels(style.borderRightWidth);
}

function getVerticalChrome(style) {
    return getCssPixels(style.paddingTop) + getCssPixels(style.paddingBottom) +
        getCssPixels(style.borderTopWidth) + getCssPixels(style.borderBottomWidth);
}

function getCssPixels(value) {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}

function getShortestColumnIndex(columnHeights) {
    return columnHeights.reduce(
        (shortest, height, index) => height < columnHeights[shortest] ? index : shortest,
        0
    );
}

function getGalleryDocumentBoundary() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportIncrement = window.matchMedia("(min-width: 768px)").matches
        ? DESKTOP_GALLERY_VIEWPORT_INCREMENT
        : MOBILE_GALLERY_VIEWPORT_INCREMENT;
    return viewportHeight * viewportIncrement * galleryViewportSegments;
}

function reserveThumbnailGeometry(entry) {
    if (entry.img.naturalWidth > 0) {
        entry.img.style.removeProperty("height");
        return;
    }

    const imageWidth = entry.img.getBoundingClientRect().width;
    if (imageWidth > 0) {
        entry.img.style.height = `${imageWidth * entry.height / entry.width}px`;
    }
}

function loadThumbnail(entry, priority = "auto") {
    if (entry.loadPromise) {
        return entry.loadPromise;
    }

    entry.img.loading = "eager";
    entry.img.fetchPriority = priority;
    entry.loadPromise = new Promise(resolve => {
        let settled = false;
        const settle = () => {
            if (settled) {
                return;
            }
            settled = true;
            entry.img.removeEventListener("load", settle);
            entry.img.removeEventListener("error", settle);
            if (entry.img.naturalWidth > 0) {
                entry.img.style.removeProperty("height");
            }
            entry.img.classList.add("gallery-img-loaded");
            if (entry.card.isConnected) {
                requestGalleryLayout();
            }
            resolve();
        };

        entry.img.addEventListener("load", settle, { once: true });
        entry.img.addEventListener("error", settle, { once: true });
        entry.img.src = entry.thumbSrc;

        if (entry.img.complete) {
            settle();
        }
    });

    return entry.loadPromise;
}

function beginDeferredThumbnailPreload() {
    deferredGalleryCards.forEach(entry => {
        loadThumbnail(entry, "low");
    });
}

function revealNextGalleryBatch() {
    if (galleryExpanded || !galleryGrid) {
        return;
    }

    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    loadMoreButton?.blur();

    galleryViewportSegments += 1;
    selectGalleryCardsForCurrentPage();
    visibleGalleryCards.forEach(entry => {
        loadThumbnail(entry, "low");
    });

    galleryExpanded = deferredGalleryCards.length === 0;

    if (loadMoreButton) {
        loadMoreButton.setAttribute("aria-expanded", String(galleryExpanded));
    }
    updateLoadMoreVisibility();
    restoreGalleryScrollPosition(scrollLeft, scrollTop);
}

function restoreGalleryScrollPosition(left, top) {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    const restore = () => {
        window.scrollTo(left, top);
    };

    restore();
    window.requestAnimationFrame(() => {
        restore();
        if (previousScrollBehavior) {
            root.style.scrollBehavior = previousScrollBehavior;
        } else {
            root.style.removeProperty("scroll-behavior");
        }
    });
}

function updateLoadMoreVisibility() {
    if (!loadMoreRow || !loadMoreButton) {
        return;
    }

    loadMoreRow.hidden = galleryExpanded || deferredGalleryCards.length === 0;
}

function hideLoadMore() {
    if (loadMoreRow) {
        loadMoreRow.hidden = true;
    }
}

function startGalleryResizeTracking() {
    const schedule = () => {
        if (galleryExpanded || galleryResizeFrame) {
            return;
        }
        galleryResizeFrame = window.requestAnimationFrame(() => {
            galleryResizeFrame = 0;
            if (!galleryInitialized || galleryExpanded) {
                return;
            }
            selectGalleryCardsForCurrentPage();
            updateLoadMoreVisibility();
        });
    };

    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
}

function refreshGalleryItems() {
    if (!galleryGrid || !msnry) {
        return;
    }

    if (typeof msnry.reloadItems === "function") {
        msnry.reloadItems();
    }
    if (typeof msnry.layout === "function") {
        msnry.layout();
    }
}

function initMasonry(grid) {
    grid.classList.remove("feed-masonry-enhanced");

    if (typeof window.Masonry !== "function") {
        console.warn(
            "Masonry is unavailable; using the gallery fallback layout."
        );
        resetGalleryMasonryStyles(grid);
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

        msnry = masonry;
        grid.classList.add("feed-masonry-enhanced");

        if (typeof window.imagesLoaded === "function") {
            const imageTracker = window.imagesLoaded(grid);

            if (imageTracker && typeof imageTracker.on === "function") {
                imageTracker.on("progress", requestGalleryLayout);
                imageTracker.on("always", requestGalleryLayout);
            }
        } else {
            console.warn(
                "imagesLoaded is unavailable; native image events will update the gallery layout."
            );
        }

        return true;
    } catch (error) {
        console.error(
            "Gallery Masonry initialization failed; using the fallback layout:",
            error
        );

        if (masonry && typeof masonry.destroy === "function") {
            try {
                masonry.destroy();
            } catch (destroyError) {
                console.warn(
                    "Could not fully destroy the partial gallery layout:",
                    destroyError
                );
            }
        }

        msnry = null;
        resetGalleryMasonryStyles(grid);
        return false;
    }
}

function revealGalleryGrid(grid) {
    grid.classList.remove("gallery-loading");
    grid.classList.add("gallery-ready");
}

function requestGalleryLayout() {
    if (msnry && typeof msnry.layout === "function") {
        msnry.layout();
    }
}

function resetGalleryMasonryStyles(grid) {
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

function showGalleryError(grid) {
    if (grid.querySelector(".gallery-load-error")) {
        return;
    }

    const message = document.createElement("p");
    message.className = "gallery-load-error standard-text brick";
    message.textContent = "Photos could not be loaded.";
    grid.appendChild(message);
}

function createLightbox() {
    if (document.querySelector(".gallery-lightbox")) {
        return;
    }
    const lightbox = document.createElement("div");
    lightbox.className = "gallery-lightbox";
    lightbox.innerHTML = `
        <button class="gallery-lightbox-arrow gallery-lightbox-prev" type="button">‹</button>
        <button class="gallery-lightbox-arrow gallery-lightbox-next" type="button">›</button>
        <div class="gallery-lightbox-date"></div>
        <button class="gallery-lightbox-close" type="button">Close</button>
        <div class="gallery-lightbox-content">
            <img class="gallery-lightbox-img" src="" alt="">
        </div>
        <div class="gallery-lightbox-info">
            <div class="gallery-lightbox-location"></div>
        </div>
    `;
    document.body.appendChild(lightbox);
    lightbox.addEventListener("click", event => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });
    lightbox.querySelector(".gallery-lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".gallery-lightbox-prev").addEventListener("click", showPreviousPhoto);
    lightbox.querySelector(".gallery-lightbox-next").addEventListener("click", showNextPhoto);
    document.addEventListener("keydown", event => {
        if (!lightbox.classList.contains("open")) {
            return;
        }
        if (event.key === "Escape") {
            closeLightbox();
        }
        if (event.key === "ArrowLeft") {
            showPreviousPhoto();
        }
        if (event.key === "ArrowRight") {
            showNextPhoto();
        }
    });
}

function openLightbox(index) {
    currentPhotoIndex = index;
    const lightbox = document.querySelector(".gallery-lightbox");
    updateLightboxPhoto(() => {
        lightbox.classList.add("open");
        document.body.classList.add("gallery-lightbox-open");
    });
}

function closeLightbox() {
    lightboxLoadId++;
    const lightbox = document.querySelector(".gallery-lightbox");
    if (!lightbox) {
        return;
    }
    lightbox.classList.remove("open");
    document.body.classList.remove("gallery-lightbox-open");
    const img = lightbox.querySelector(".gallery-lightbox-img");
    img.src = "";
    img.alt = "";
}

function showPreviousPhoto() {
    if (!photos.length) {
        return;
    }
    currentPhotoIndex = currentPhotoIndex - 1;
    if (currentPhotoIndex < 0) {
        currentPhotoIndex = photos.length - 1;
    }
    updateLightboxPhoto();
}

function showNextPhoto() {
    if (!photos.length) {
        return;
    }
    currentPhotoIndex = currentPhotoIndex + 1;
    if (currentPhotoIndex >= photos.length) {
        currentPhotoIndex = 0;
    }
    updateLightboxPhoto();
}

function updateLightboxPhoto(onReady) {
    const photo = photos[currentPhotoIndex];
    const lightbox = document.querySelector(".gallery-lightbox");
    if (!photo || !lightbox) {
        return;
    }

    const img = lightbox.querySelector(".gallery-lightbox-img");
    const date = lightbox.querySelector(".gallery-lightbox-date");
    const location = lightbox.querySelector(".gallery-lightbox-location");
    if (!img || !date || !location) {
        return;
    }

    const photoDetails = getPhotoDetails(photo);
    const loadId = ++lightboxLoadId;
    const fullImg = new Image();

    const revealPhoto = (src) => {
        if (loadId !== lightboxLoadId) {
            return;
        }

        img.src = src;
        img.alt = photo.alt || photoDetails || "gallery photo";
        date.textContent = String(photo.date || "");
        location.textContent = String(photo.location || "");

        if (onReady) {
            onReady();
        }
    };

    fullImg.onload = () => {
        revealPhoto(photo.src);
        preloadNearbyPhotos();
    };
    fullImg.onerror = () => {
        revealPhoto(getThumbnailSrc(photo.src));
    };
    fullImg.src = photo.src;
}

function preloadNearbyPhotos() {
    if (!photos.length) {
        return;
    }
    const previousIndex = currentPhotoIndex - 1 < 0 ? photos.length - 1 : currentPhotoIndex - 1;
    const nextIndex = currentPhotoIndex + 1 >= photos.length ? 0 : currentPhotoIndex + 1;
    [previousIndex, nextIndex].forEach(index => {
        const src = photos[index]?.src;
        if (!src || preloadedPhotoSrcs.has(src)) {
            return;
        }
        const img = new Image();
        img.src = src;
        preloadedPhotoSrcs.add(src);
    });
}

function getPhotoDetails(photo) {
    return [photo.location, photo.date].filter(Boolean).join(" · ");
}

function getThumbnailSrc(src) {
    return String(src ?? "").replace("./photos/", "./thumbnail_photos/");
}

function cleanText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
