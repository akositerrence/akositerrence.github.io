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

const htmlCache = {};

document.addEventListener('DOMContentLoaded', () => {
    const feed = document.querySelector(".stream-feed");
    const modal = document.getElementById("post-modal-container");
    const content = document.getElementById("modal-content");
    const close = document.getElementById("modal-close");
    
    document.querySelectorAll(".post-wrapper").forEach(wrapper => {
        const url = wrapper.dataset.url;
        fetch(url)
            .then(r => r.text())
            .then(html => { htmlCache[url] = html; })
            .catch(() => {});
    })

    console.log(htmlCache);

    feed.addEventListener("click", async (e) => {
        const wrapper = e.target.closest(".post-wrapper");
        if (!wrapper) return;

        console.log("flag1");

        const post_url = wrapper.dataset.url;
        if (!post_url) {
            console.warn("no data-url")
            return;
        }
        e.preventDefault();

        try {
            const html = htmlCache[post_url];
            const doc = new DOMParser().parseFromString(html, "text/html");
            const article = doc.querySelector(".post-modal");

            content.innerHTML = article
                ? article.innerHTML
                : "<p>Error loading post</p>";

            modal.classList.add("show");
            document.body.style.overflow = "hidden";

            const video_embed = content.querySelector(".modal-video-embed");
            const w = window.innerWidth;

            const post_desc = content.querySelector(".post-desc");
            post_desc.style.display ="flex";
            post_desc.style.paddingTop ="0rem";
            post_desc.style.flexDirection ="column";

            video_embed.style.paddingTop ="2.5rem";
            video_embed.style.paddingBottom ="2.5rem";
            video_embed.style.paddingRight ="2.5rem";
            video_embed.style.paddingLeft ="1rem";

            if(w >= 768 ) {
                video_embed.style.width ="55rem";
                video_embed.style.height ="calc(55rem * 2 / 3)";
                post_desc.style.paddingTop ="2.5rem";
                article.style.display = "column";
            } else {
                video_embed.style.width ="17.5rem";
                video_embed.style.height ="calc(17.5rem * 2 / 3)";
                content.style.flexDirection ="column";
            }

        } catch (err) {
            modal.style.display = "flex";
        }
    })

    close.addEventListener("click", () => {
        modal.classList.remove("show");
        document.body.style.overflow = "";
        content.innerHTML = "";
    });

})

