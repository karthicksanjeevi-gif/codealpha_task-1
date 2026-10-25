const $ = (id) => document.getElementById(id);
const input = $("input"), output = $("output"), msg = $("msg");
const source = $("source"), target = $("target");
const go = $("go"), copyBtn = $("copy"), speakBtn = $("speak");
const max = input.maxLength;

input.addEventListener("input", () => { $("count").textContent = `${input.value.length} / ${max}`; });
input.addEventListener("keydown", (e) => { if (e.ctrlKey && e.key === "Enter") translate(); });
go.addEventListener("click", translate);

$("swap").addEventListener("click", () => {
  if (source.value === "auto") return;
  [source.value, target.value] = [target.value, source.value];
  if (output.classList.contains("has")) {
    input.value = output.textContent;
    input.dispatchEvent(new Event("input"));
    translate();
  }
});

async function translate() {
  msg.textContent = "";
  if (!input.value.trim()) { msg.textContent = "Enter some text to translate."; return; }
  go.disabled = true; go.textContent = "Translating...";
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.value, source: source.value, target: target.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translation failed.");
    output.textContent = data.translation;
    output.classList.add("has");
    copyBtn.disabled = speakBtn.disabled = false;
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    go.disabled = false; go.textContent = "Translate";
  }
}

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.textContent);
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

speakBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) { msg.textContent = "Text-to-speech is not supported in this browser."; return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(output.textContent);
  u.lang = target.value;
  speechSynthesis.speak(u);
});

/* ---------- Background blobs move with the mouse (parallax) ---------- */
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (matchMedia("(pointer: coarse)").matches) return;

  const blobs = [...document.querySelectorAll(".bg span")];
  const depth = [90, -140, 190];          // px each blob travels; negative = opposite direction
  let tx = 0, ty = 0, cx = 0, cy = 0;

  addEventListener("mousemove", (e) => {
    tx = e.clientX / innerWidth - 0.5;
    ty = e.clientY / innerHeight - 0.5;
  });

  (function loop() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    blobs.forEach((b, i) => {
      b.style.transform = `translate(${cx * depth[i]}px, ${cy * depth[i]}px)`;
    });
    requestAnimationFrame(loop);
  })();
})();

/* ---------- Dot grid that reacts to the mouse ---------- */
(() => {
  const canvas = $("dots");
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GAP = 32;        // distance between dots
  const SIZE = 1.6;      // normal dot radius
  const REACH = 150;     // how far the mouse affects dots
  const PUSH = 30;       // how far dots are pushed away
  const GROW = 2.2;      // how much dots grow near the mouse
  const SPRING = 0.12;   // lower = softer, slower return

  let dots = [], w = 0, h = 0, color = "#0f6b63";
  const mouse = { x: -9999, y: -9999 };

  function readColor() {
    color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || color;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < h; y += GAP)
      for (let x = GAP / 2; x < w; x += GAP)
        dots.push({ ox: x, oy: y, x, y });
    readColor();
    if (reduce) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    for (const d of dots) {
      // gentle sway so the dots are alive even when the mouse is still
      const sway = reduce ? 0 : 2.5;
      let tx = d.ox + Math.sin(t / 1500 + d.oy * 0.015) * sway;
      let ty = d.oy + Math.cos(t / 1700 + d.ox * 0.015) * sway;
      let size = SIZE, alpha = 0.28;

      const dx = tx - mouse.x, dy = ty - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < REACH && dist > 0.01) {
        const f = 1 - dist / REACH;
        const e = f * f;                      // stronger push near the mouse
        tx += (dx / dist) * e * PUSH;
        ty += (dy / dist) * e * PUSH;
        size = SIZE + e * GROW;
        alpha = 0.28 + e * 0.6;
      }

      d.x += (tx - d.x) * SPRING;
      d.y += (ty - d.y) * SPRING;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener("mouseleave", () => { mouse.x = mouse.y = -9999; });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(readColor, 50));

  resize();
  if (!reduce) (function loop(t) { draw(t); requestAnimationFrame(loop); })(0);
})();

/* ---------- Ripple on button click ---------- */
document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(s);
    setTimeout(() => s.remove(), 600);
  });
});

/* ---------- Magnetic pull on the Translate button ---------- */
(() => {
  if (matchMedia("(pointer: coarse)").matches) return;
  go.addEventListener("mousemove", (e) => {
    const r = go.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.2;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.3;
    go.style.transform = `translate(${x}px, ${y}px)`;
  });
  go.addEventListener("mouseleave", () => (go.style.transform = ""));
})();

/* ---------- Animate the result whenever the translation changes ---------- */
new MutationObserver(() => {
  output.classList.remove("pop");
  void output.offsetWidth;   // restart the animation
  output.classList.add("pop");
}).observe(output, { childList: true, characterData: true, subtree: true });