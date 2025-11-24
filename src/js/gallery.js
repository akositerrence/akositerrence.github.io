console.log("gallery.js loaded");

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".project-gallery");
    if (!grid) {
        console.warn("No .project-gallery element found");
        return;
    }

    const msnry = new Masonry(grid, {
        itemSelector: ".brick",
        columnWidth: ".brick",
        gutter: 0
    });
});
