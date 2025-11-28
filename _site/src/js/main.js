console.log("main.js loaded");

let curX = 0;
let curY = 0;
let tgX = 0;
let tgY = 0;

document.addEventListener("DOMContentLoaded", () => {
    if (window.innerWidth > 768) {
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
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (window.innerWidth > 768) {
        function addDimOnHover(selector) {
            const cards = Array.from(document.querySelectorAll(selector));
            if (!cards.length) return;

            cards.forEach(card => {
            card.addEventListener("mouseenter", () => {
                cards.forEach(c => {
                if (c !== card) c.style.opacity = "0.5";
                });
            });
            card.addEventListener("mouseleave", () => {
                cards.forEach(c => {
                c.style.opacity = "";
                });
            });
            });
        }

        const groups = [
            ".experience-instance",
            ".portfolio-instance",
            ".certifications-instance",
            ".education-instance",
            ".post-instance"
        ];

        groups.forEach(addDimOnHover);
    }
});
