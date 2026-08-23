console.log("gallery.js loaded");

let photos = [];
let currentPhotoIndex = 0;
let msnry = null;
let preloadedPhotoSrcs = new Set();
let lightboxLoadId = 0;

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".project-gallery");
    if (!grid) {
        console.warn(".project-gallery element not found");
        return;
    }
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
        photos.forEach((photo, index) => {
            const card = createPhotoCard(photo, index);
            grid.appendChild(card);
        });
        createLightbox();
    } catch (error) {
        console.error("Gallery failed to load:", error);

        showGalleryError(grid);
    } finally {
        initMasonry(grid);
        revealGalleryGrid(grid);
    }
}

function createPhotoCard(photo, index) {
    const card = document.createElement("div");
    card.className = "gallery-instance brick";
    const src = cleanText(photo.src);
    const thumbSrc = cleanText(getThumbnailSrc(photo.src));
    const location = cleanText(photo.location);
    const date = cleanText(photo.date);
    const alt = cleanText(photo.alt || getPhotoDetails(photo) || "gallery photo");
    card.innerHTML = `
        <button class="instance-title gallery-photo-button" type="button">
            <img class="gallery-img-loading" src="${thumbSrc}" alt="${alt}" loading="${index < 9 ? "eager" : "lazy"}" fetchpriority="${index < 3 ? "high" : "auto"}">
            <div class="instance-title-group">
                ${location ? `<div class="project-img-title-affiliation gallery-hover-location">${location}</div>` : ""}
                ${date ? `<div class="project-img-title-affiliation gallery-hover-date">${date}</div>` : ""}
            </div>
        </button>
    `;
    const img = card.querySelector("img");
    const markImageLoaded = () => {
        img.classList.add("gallery-img-loaded");
        requestGalleryLayout();
    };

    if (img.complete) {
        markImageLoaded();
    } else {
        img.addEventListener("load", markImageLoaded, { once: true });
        img.addEventListener("error", markImageLoaded, { once: true });
    }

    const button = card.querySelector(".gallery-photo-button");
    button.addEventListener("click", () => {
        openLightbox(index);
    });
    return card;
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
            percentPosition: true
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
        <div class="gallery-lightbox-content">
            <button class="gallery-lightbox-close" type="button">Close</button>
            <img class="gallery-lightbox-img" src="" alt="">
            <div class="gallery-lightbox-info">
                <div class="gallery-lightbox-details"></div>
            </div>
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
    const details = lightbox.querySelector(".gallery-lightbox-details");
    if (!img || !details) {
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
        details.textContent = photoDetails;

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
