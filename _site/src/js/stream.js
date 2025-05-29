console.log("stream.js loaded");

let curX = 0;
let curY = 0;
let tgX = 0;
let tgY = 0;

document.addEventListener("DOMContentLoaded", () => {
    const interBubble = document.querySelector(".interactive");
    if (!interBubble) return;

    function move() {
        curX = curX + (tgX-curX) / 20;
        curY = curY + (tgY-curY) / 20;

        const halfW = interBubble.offsetWidth  / 2;
        const halfH = interBubble.offsetHeight / 2;

        interBubble.style.transform = `translate(${Math.round(curX - halfW)}px, ${Math.round(curY - halfH)}px)`;
        requestAnimationFrame(move);
    }

    window.addEventListener("mousemove", (e) => {
        tgX = e.clientX;
        tgY = e.clientY;
    });

    move();
});

document.addEventListener('DOMContentLoaded', () => {
    const feed = document.querySelector(".stream-feed");
    const modal = document.getElementById("post-modal-container");
    const content = document.getElementById("modal-content");
    const close = document.getElementById("modal-close");

    feed.addEventListener("click", async (e) => {
        const wrapper = e.target.closest(".post-wrapper");
        if (!wrapper) return;

        const post_url = wrapper.dataset.url;
        if (!post_url) {
            console.warn("no data-url")
            return;
        }
        e.preventDefault();

        try {
            const fetched_content = await fetch(post_url);
            const html = await fetched_content.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const article = doc.querySelector(".post-modal");

            content.innerHTML = article
                ? article.innerHTML
                : "<p>Error loading post</p>";

            modal.style.display = "flex";
            document.body.style.overflow = "hidden";
        } catch (err) {
            modal.style.display = "flex";
        }
    })

    close.addEventListener("click", () => {
        modal.style.display = "none";
        document.body.style.overflow = "";
        content.innerHTML = "";
    });

})

