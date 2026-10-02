// Turns a screenshot into a text description Claude can review when the view
// can't send images: the text on screen (via Tesseract OCR, run in the page),
// where it sits, how big it is, its colours and contrast, plus background
// bands, palette, picture areas, alignment and spacing.
//
// Tesseract and its English data are published next to the page in
// vendor/tesseract/, so nothing is fetched from other sites.
(function () {
  const VENDOR = "vendor/tesseract/";
  const MAX_LINES = 60;
  const cache = new Map(); // key -> Promise<string>
  let workerPromise = null;

  const abs = (path) => new URL(path, document.baseURI).href;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Couldn't load " + src));
      document.head.append(s);
    });
  }

  function getWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        await loadScript(abs(VENDOR + "tesseract.min.js"));
        const worker = await window.Tesseract.createWorker("eng", 1, {
          workerPath: abs(VENDOR + "worker.min.js"),
          corePath: abs(VENDOR + "tesseract-core-simd-lstm.wasm.js"),
          langPath: abs(VENDOR.replace(/\/$/, "")),
          gzip: true,
          cacheMethod: "none",
        });
        // Sparse text: UI screens are labels and buttons, not paragraphs.
        await worker.setParameters({ tessedit_pageseg_mode: "11" });
        return worker;
      })();
      // Don't wait forever if the browser blocks the reader from starting.
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("The screen reader didn't start in time")), 60000)
      );
      workerPromise = Promise.race([workerPromise, timeout]).catch((err) => {
        workerPromise = null;
        throw err;
      });
    }
    return workerPromise;
  }

  // ---------- Colour helpers ----------
  const hex = (r, g, b) =>
    "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  function lum(r, g, b) {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) {
    const la = lum(...a), lb = lum(...b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const bucketOf = (r, g, b) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);

  // Histogram of a pixel region: buckets with count and average colour.
  function histogram(data, width, x0, y0, x1, y1, step) {
    const map = new Map();
    let total = 0;
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const k = bucketOf(r, g, b);
        let e = map.get(k);
        if (!e) map.set(k, (e = { n: 0, r: 0, g: 0, b: 0 }));
        e.n++; e.r += r; e.g += g; e.b += b;
        total++;
      }
    }
    const buckets = [...map.values()]
      .map((e) => ({ n: e.n, share: e.n / total, rgb: [e.r / e.n, e.g / e.n, e.b / e.n] }))
      .sort((a, b) => b.n - a.n);
    return { buckets, total };
  }

  // ---------- Reading one screen ----------
  async function imageFrom(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    return img;
  }

  // Pixels per design point. Phone exports are usually @1x, @2x or @3x of a
  // ~390pt-wide screen; anything else is scaled to 390pt.
  function pointScale(width, platform) {
    if (platform === "web") return width > 2200 ? 2 : 1;
    const raw = width / 390;
    const whole = Math.round(raw);
    return whole >= 1 && Math.abs(raw - whole) < 0.15 ? whole : raw;
  }

  async function analyse(blob, platform) {
    const bitmap = await imageFrom(blob);
    const W = bitmap.width, H = bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, W, H);
    const scale = pointScale(W, platform);
    const pt = (v) => Math.round(v / scale);

    // OCR on an upscaled copy when the image is small (Mobbin previews are ~300px wide).
    const ocrScale = W < 900 ? Math.min(3, 1200 / W) : 1;
    let ocrCanvas = canvas;
    if (ocrScale !== 1) {
      ocrCanvas = document.createElement("canvas");
      ocrCanvas.width = Math.round(W * ocrScale);
      ocrCanvas.height = Math.round(H * ocrScale);
      const c2 = ocrCanvas.getContext("2d");
      c2.imageSmoothingQuality = "high";
      c2.drawImage(bitmap, 0, 0, ocrCanvas.width, ocrCanvas.height);
    }
    const worker = await getWorker();
    const { data: ocr } = await worker.recognize(ocrCanvas, {}, { blocks: true });

    const lines = [];
    (ocr.blocks || []).forEach((block) =>
      (block.paragraphs || []).forEach((para) =>
        (para.lines || []).forEach((line) => {
          const words = (line.words || []).filter((w) => w.confidence >= 45 && /[\p{L}\p{N}$€£%]/u.test(w.text));
          if (!words.length) return;
          const box = {
            x0: Math.min(...words.map((w) => w.bbox.x0)) / ocrScale,
            y0: Math.min(...words.map((w) => w.bbox.y0)) / ocrScale,
            x1: Math.max(...words.map((w) => w.bbox.x1)) / ocrScale,
            y1: Math.max(...words.map((w) => w.bbox.y1)) / ocrScale,
          };
          lines.push({ text: words.map((w) => w.text).join(" "), box });
        })
      )
    );
    lines.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);

    // Page palette and background.
    const step = Math.max(1, Math.round(Math.min(W, H) / 300));
    const page = histogram(data, W, 0, 0, W, H, step);
    const bg = page.buckets[0].rgb;

    // Colour of each text line: background = commonest colour in its box,
    // text = the frequent colour furthest from it.
    lines.forEach((l) => {
      const x0 = Math.max(0, Math.floor(l.box.x0)), y0 = Math.max(0, Math.floor(l.box.y0));
      const x1 = Math.min(W, Math.ceil(l.box.x1)), y1 = Math.min(H, Math.ceil(l.box.y1));
      const h = histogram(data, W, x0, y0, Math.max(x0 + 1, x1), Math.max(y0 + 1, y1), 1);
      const lineBg = h.buckets[0].rgb;
      // Text colour: the average of the pixels furthest from the background
      // (skips the blended pixels at letter edges).
      let maxD = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          maxD = Math.max(maxD, dist([data[i], data[i + 1], data[i + 2]], lineBg));
        }
      let fr = 0, fgG = 0, fb = 0, fn = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          const c = [data[i], data[i + 1], data[i + 2]];
          if (dist(c, lineBg) >= maxD * 0.75) { fr += c[0]; fgG += c[1]; fb += c[2]; fn++; }
        }
      l.bg = lineBg;
      l.fg = fn ? [fr / fn, fgG / fn, fb / fn] : [0, 0, 0];
      l.contrast = contrast(l.fg, l.bg);
      // Share of "ink" pixels: a rough weight hint (bolder text covers more).
      let ink = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          const c = [data[i], data[i + 1], data[i + 2]];
          if (dist(c, l.fg) < dist(c, l.bg)) ink++;
        }
      }
      l.ink = ink / Math.max(1, (x1 - x0) * (y1 - y0));
      l.onFill = dist(lineBg, bg) > 40;
    });

    // Background bands from top to bottom.
    const rowStep = Math.max(1, Math.round(scale * 4));
    const bands = [];
    for (let y = 0; y < H; y += rowStep) {
      const h = histogram(data, W, 0, y, W, Math.min(H, y + 1), Math.max(1, Math.round(W / 120)));
      const top = h.buckets[0];
      const last = bands[bands.length - 1];
      if (last && dist(last.rgb, top.rgb) < 18) last.y1 = y + rowStep;
      else bands.push({ y0: y, y1: y + rowStep, rgb: top.rgb, share: top.share });
    }
    const bigBands = bands.filter((b) => pt(b.y1 - b.y0) >= 12 && b.share > 0.6);

    // Picture areas: busy cells (high variation) with no text in them.
    const cell = Math.round(16 * scale);
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const busy = new Uint8Array(cols * rows);
    const textCell = new Uint8Array(cols * rows);
    lines.forEach((l) => {
      for (let cy = Math.floor(l.box.y0 / cell); cy <= Math.floor(l.box.y1 / cell); cy++)
        for (let cx = Math.floor(l.box.x0 / cell); cx <= Math.floor(l.box.x1 / cell); cx++)
          if (cy >= 0 && cy < rows && cx >= 0 && cx < cols) textCell[cy * cols + cx] = 1;
    });
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (textCell[cy * cols + cx]) continue;
        let n = 0, s = 0, s2 = 0;
        const sStep = Math.max(1, Math.round(cell / 8));
        for (let y = cy * cell; y < Math.min(H, (cy + 1) * cell); y += sStep)
          for (let x = cx * cell; x < Math.min(W, (cx + 1) * cell); x += sStep) {
            const i = (y * W + x) * 4;
            const v = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
            n++; s += v; s2 += v * v;
          }
        const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
        if (sd > 38) busy[cy * cols + cx] = 1;
      }
    }
    const seen = new Uint8Array(cols * rows);
    const pictures = [];
    for (let i = 0; i < busy.length; i++) {
      if (!busy[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      let minX = cols, minY = rows, maxX = 0, maxY = 0, count = 0;
      while (stack.length) {
        const j = stack.pop();
        const x = j % cols, y = (j / cols) | 0;
        count++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy, k = ny * cols + nx;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && busy[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        });
      }
      if (count >= 6) pictures.push({ x0: minX * cell, y0: minY * cell, x1: (maxX + 1) * cell, y1: (maxY + 1) * cell });
    }

    // Alignment and spacing.
    const lefts = new Map();
    lines.forEach((l) => {
      const k = Math.round(pt(l.box.x0) / 2) * 2;
      lefts.set(k, (lefts.get(k) || 0) + 1);
    });
    const gaps = [];
    for (let i = 1; i < lines.length; i++) {
      const g = pt(lines[i].box.y0 - lines[i - 1].box.y1);
      if (g >= 0) gaps.push(g);
    }

    // ---------- Write it up ----------
    const out = [];
    out.push("Size: " + W + "×" + H + " px, read as " + pt(W) + "×" + pt(H) + " pt" +
      (Number.isInteger(scale) ? " (@" + scale + "x)." : " (scaled to a " + pt(W) + "pt-wide screen)."));
    out.push("Main background: " + hex(...bg) + ".");
    out.push("Palette (share of screen): " +
      page.buckets.slice(0, 8).filter((b) => b.share > 0.01)
        .map((b) => hex(...b.rgb) + " " + Math.round(b.share * 100) + "%").join(", ") + ".");
    if (bigBands.length > 1) {
      out.push("Background bands, top to bottom (pt): " +
        bigBands.slice(0, 16).map((b) => pt(b.y0) + "–" + pt(b.y1) + " " + hex(...b.rgb)).join("; ") + ".");
    }
    if (pictures.length) {
      out.push("Picture or illustration areas (x,y,w,h in pt): " +
        pictures.slice(0, 8).map((p) => "(" + pt(p.x0) + "," + pt(p.y0) + "," + pt(p.x1 - p.x0) + "," + pt(p.y1 - p.y0) + ")").join(" ") + ".");
    }
    out.push("Text lines, top to bottom (x,y in pt; h = text height in pt; colour on background; contrast; ink = rough weight, higher is bolder):");
    lines.slice(0, MAX_LINES).forEach((l) => {
      out.push(
        "- y" + pt(l.box.y0) + " x" + pt(l.box.x0) + " w" + pt(l.box.x1 - l.box.x0) + " h" + pt(l.box.y1 - l.box.y0) +
        ' "' + l.text.slice(0, 90) + '" ' + hex(...l.fg) + " on " + hex(...l.bg) +
        (l.onFill ? " (filled area)" : "") +
        " " + l.contrast.toFixed(1) + ":1 ink " + Math.round(l.ink * 100) + "%"
      );
    });
    if (lines.length > MAX_LINES) out.push("- …" + (lines.length - MAX_LINES) + " more lines not listed.");
    if (!lines.length) out.push("- No readable text found.");
    out.push("Left edges used by text (pt: lines): " +
      [...lefts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([x, n]) => x + ": " + n).join(", ") + ".");
    if (gaps.length) out.push("Vertical gaps between consecutive text lines (pt): " + gaps.slice(0, 40).join(", ") + ".");
    if (bitmap.close) bitmap.close();
    return out.join("\n");
  }

  // Describe one screen; cached per key for this page load.
  function describe(key, blob, platform) {
    if (!cache.has(key)) {
      cache.set(key, analyse(blob, platform).catch((err) => {
        cache.delete(key);
        throw err;
      }));
    }
    return cache.get(key);
  }

  window.DTCReader = { describe, warmUp: () => getWorker().then(() => true, () => false) };
})();
