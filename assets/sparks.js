// Tiny “spark burst” without canvas. Attach to an element and fire().
function createSparks(anchorEl) {
  const layer = document.createElement("div");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.overflow = "visible";
  anchorEl.style.position = "relative";
  anchorEl.appendChild(layer);

  function fire() {
    const rect = anchorEl.getBoundingClientRect();
    const count = 12;

    for (let i = 0; i < count; i++) {
      const s = document.createElement("i");
      const size = 3 + Math.random() * 4;
      s.style.position = "absolute";
      s.style.left = "18px";
      s.style.top = "18px";
      s.style.width = `${size}px`;
      s.style.height = `${size}px`;
      s.style.borderRadius = "999px";
      s.style.background = Math.random() > 0.5 ? "rgba(255,191,71,0.95)" : "rgba(74,163,255,0.95)";
      s.style.boxShadow = "0 0 18px rgba(255,191,71,0.35)";
      s.style.opacity = "0.95";
      layer.appendChild(s);

      const dx = (Math.random() - 0.5) * 70;
      const dy = (Math.random() - 0.8) * 70;

      s.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0 }
        ],
        { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.2,1)" }
      );

      setTimeout(() => s.remove(), 1100);
    }
  }

  return { fire };
}

window.createSparks = createSparks;
