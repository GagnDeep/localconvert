/* LocalConvert site script — vanilla, no dependencies. */
(() => {
  "use strict";

  // Mobile navigation
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Conversion hub filter
  const filter = document.getElementById("hub-filter");
  if (filter) {
    const items = [...document.querySelectorAll("[data-q]")];
    const groups = [...document.querySelectorAll("[data-group]")];
    const sections = [...document.querySelectorAll("[data-section]")];
    const empty = document.getElementById("hub-empty");
    const run = () => {
      const terms = filter.value.toLowerCase().replace(/\bto\b/g, " ").split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const li of items) {
        const q = li.dataset.q;
        const ok = terms.every((t) => q.includes(t));
        li.hidden = !ok;
        if (ok) shown++;
      }
      for (const g of groups) g.hidden = !g.querySelector("[data-q]:not([hidden])");
      for (const s of sections) s.hidden = !s.querySelector("[data-group]:not([hidden])");
      if (empty) empty.hidden = shown > 0;
    };
    filter.addEventListener("input", run);
    const initial = new URLSearchParams(location.search).get("q");
    if (initial) { filter.value = initial; run(); }
  }

  // In-browser image converter — everything stays on this device.
  const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

  const supportsEncode = (() => {
    const cache = {};
    return (type) => {
      if (type in cache) return cache[type];
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      return (cache[type] = c.toDataURL(type).startsWith(`data:${type}`));
    };
  })();

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unsupported")); };
    img.src = url;
  });

  for (const root of document.querySelectorAll("[data-converter]")) {
    const input = root.querySelector("[data-input]");
    const drop = root.querySelector("[data-drop]");
    const list = root.querySelector("[data-list]");
    const quality = root.querySelector("[data-quality]");
    const qOut = root.querySelector("[data-quality-out]");
    const qField = root.querySelector("[data-quality-field]");
    const width = root.querySelector("[data-width]");
    const segs = [...root.querySelectorAll("[data-target]")];
    let target = root.dataset.defaultTarget || "jpg";

    const syncQuality = () => {
      qOut.textContent = `${quality.value}%`;
      qField.style.opacity = target === "png" ? ".45" : "1";
      quality.disabled = target === "png";
    };
    segs.forEach((b) => {
      if (b.dataset.target === "webp" && !supportsEncode("image/webp")) {
        b.title = "Your browser can't create WebP files — try Chrome, Edge, Firefox or the LocalConvert app.";
      }
      b.addEventListener("click", () => {
        target = b.dataset.target;
        segs.forEach((s) => { s.classList.toggle("is-on", s === b); s.setAttribute("aria-pressed", String(s === b)); });
        syncQuality();
      });
    });
    quality.addEventListener("input", syncQuality);
    syncQuality();

    const convert = async (file) => {
      const li = document.createElement("li");
      li.className = "conv-item";
      li.innerHTML = `<span class="conv-thumb"></span><div><div class="conv-name"></div><div class="conv-meta">Converting…</div></div><span></span>`;
      li.querySelector(".conv-name").textContent = file.name;
      list.prepend(li);
      const meta = li.querySelector(".conv-meta");
      const out = target;
      try {
        const type = MIME[out];
        if (!supportsEncode(type)) throw new Error(`This browser can't create ${out.toUpperCase()} files.`);
        const { img, url } = await loadImage(file);
        let w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
        const max = Number(width.value);
        if (max && w > max) { h = Math.round(h * (max / w)); w = max; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (out === "jpg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const blob = await new Promise((r) => canvas.toBlob(r, type, Number(quality.value) / 100));
        if (!blob) throw new Error("Encoding failed.");
        const outURL = URL.createObjectURL(blob);
        const thumb = document.createElement("img");
        thumb.src = outURL; thumb.alt = ""; thumb.width = 52; thumb.height = 52;
        li.querySelector(".conv-thumb").replaceWith(thumb);
        const delta = 1 - blob.size / file.size;
        const pct = Math.round(Math.abs(delta) * 100);
        meta.innerHTML = `${w}×${h} · ${fmtBytes(file.size)} → ${fmtBytes(blob.size)} ` +
          (delta > 0.01 ? `<span class="good">${pct}% smaller</span>` : delta < -0.01 ? `${pct}% larger` : "");
        const a = document.createElement("a");
        a.className = "btn btn-primary";
        a.href = outURL;
        a.download = file.name.replace(/\.[^.]+$/, "") + "." + out;
        a.textContent = "Download";
        li.lastElementChild.replaceWith(a);
      } catch (err) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const hint = ext === "heic" || ext === "heif"
          ? "HEIC opens in Safari 17+ only. The LocalConvert app converts HEIC on any iPhone."
          : (err && err.message === "unsupported") ? "Your browser can't open this file type. Try the LocalConvert app." : (err && err.message) || "Conversion failed.";
        meta.innerHTML = `<span class="err"></span>`;
        meta.firstChild.textContent = hint;
      }
    };

    const handle = async (files) => {
      for (const f of files) await convert(f);
    };
    input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
    drop.addEventListener("drop", (e) => handle([...e.dataTransfer.files]));
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    drop.tabIndex = 0;
    drop.setAttribute("role", "button");
  }
})();
