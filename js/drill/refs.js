// Palette Drill: one real screen per product from the viewer's Mobbin
// connector, and its palette read from the screenshot's pixels. Pixel
// palettes include photos and illustrations, and hex values are approximate.
(function () {
  const SERVER = "Mobbin";
  const HINT = {
    "mobile-list": "home screen", "mobile-detail": "detail screen", "mobile-form": "form screen", "mobile-onboarding": "welcome onboarding screen",
    "desktop-table": "list view", "desktop-dashboard": "dashboard", "landing-hero": "homepage", pricing: "pricing page",
  };
  const C = window.PDColor;

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const matches = (app, name) => { const a = norm(app), n = norm(name); return a === n || a.startsWith(n) || n.startsWith(a); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getMcp() {
    try { return window.claude && window.claude.use ? await window.claude.use("mcp") : null; } catch (_) { return null; }
  }

  async function search(mcp, query, platform) {
    const input = { query, platform, limit: 8, mode: "standard", image_format: "jpg", output_destination: "code",
      task_intent: "Compare a learner's palette with real products in a color practice drill." };
    const opts = { cache: { staleTime: 86400000, gcTime: 7 * 86400000 } };
    try {
      return await mcp.callTool(SERVER, "search_screens", input, opts);
    } catch (err) {
      if (!err || !err.retryable) throw err;
      await wait((err.retryAfterMs || 1500) + Math.random() * 1000);
      return mcp.callTool(SERVER, "search_screens", input, opts);
    }
  }

  // First screen that belongs to the named app, as a data URL.
  async function screenFor(mcp, name, template, platform) {
    for (const q of [name + " " + HINT[template], name + " home screen"]) {
      const res = await search(mcp, q, platform);
      const payload = res.payload || {};
      const images = (res.content || []).filter((b) => b.type === "image");
      const list = payload.screens || [];
      const i = list.findIndex((s, n) => images[n] && matches(s.app_name, name));
      if (i >= 0) return { appName: list[i].app_name, url: list[i].mobbin_url, image: "data:" + images[i].mimeType + ";base64," + images[i].data };
    }
    return null;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Palette from pixels: bucket in OKLab, merge near buckets, keep the main ones.
  async function readPalette(src, platform) {
    const img = await loadImage(src);
    // Mobbin adds a dark "curated by" strip at the bottom; leave it out.
    const crop = platform === "web" ? 0.1 : 0.06;
    const w = Math.min(220, img.naturalWidth);
    const h = Math.round((img.naturalHeight * (1 - crop) * w) / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * (1 - crop), 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const k = (data[i] >> 3) + "," + (data[i + 1] >> 3) + "," + (data[i + 2] >> 3);
      const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
      buckets.set(k, b);
    }
    const total = w * h;
    const lab = (b) => {
      const o = C.hexToOklch(toHex(b));
      const hr = (o.H * Math.PI) / 180;
      return [o.L, o.C * Math.cos(hr), o.C * Math.sin(hr)];
    };
    const toHex = (b) => "#" + [b.r / b.n, b.g / b.n, b.b / b.n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const clusters = [];
    [...buckets.values()].sort((a, b) => b.n - a.n).forEach((b) => {
      const p = lab(b);
      const near = clusters.find((c) => Math.hypot(c.p[0] - p[0], c.p[1] - p[1], c.p[2] - p[2]) < 0.07);
      if (near) { near.n += b.n; near.r += b.r; near.g += b.g; near.b += b.b; }
      else clusters.push({ p, n: b.n, r: b.r, g: b.g, b: b.b });
    });
    return clusters
      .map((c) => { const hex = toHex(c); const o = C.hexToOklch(hex); return { hex, L: o.L, C: o.C, H: o.H, share: (100 * c.n) / total }; })
      .filter((c) => c.share >= 0.5)
      .sort((a, b) => b.share - a.share)
      .slice(0, 8);
  }

  // Lightness range, who owns saturation, and how much of the screen it takes.
  function summarize(palette) {
    const f = window.PDChecks.fmt;
    const big = palette.filter((c) => c.share >= 2);
    const Ls = (big.length ? big : palette).map((c) => c.L);
    const owner = palette.filter((c) => c.share >= 0.5).sort((a, b) => b.C - a.C)[0];
    return {
      lightMin: f.L(Math.min(...Ls)), lightMax: f.L(Math.max(...Ls)),
      owner: owner ? { hex: owner.hex, L: f.L(owner.L), C: f.C(owner.C), H: owner.C < 0.002 ? "—" : f.H(owner.H), share: f.share(owner.share) } : null,
      colors: palette.map((c) => ({ hex: c.hex, L: f.L(c.L), C: f.C(c.C), H: c.C < 0.002 ? "—" : f.H(c.H), share: f.share(c.share) })),
    };
  }

  async function thumb(src) {
    const img = await loadImage(src);
    const w = 260, h = Math.round((img.naturalHeight * w) / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  // { status, products: [{ name, role: "product"|"competitor", found, url, thumb, palette, summary }] }
  async function load(brief, onProgress) {
    const cacheKey = "refs:" + brief.id;
    const saved = await window.PDStore.get(cacheKey);
    if (saved && saved.products && saved.products.some((p) => p.found)) return { status: "ok", products: saved.products };

    const names = [{ name: brief.mobbin, label: brief.product, role: "product" }, ...brief.competitors.map((n) => ({ name: n, label: n, role: "competitor" }))];
    const empty = names.map((n) => ({ name: n.label, role: n.role, found: false }));
    const mcp = await getMcp();
    if (!mcp) return { status: "unavailable", products: empty };
    const platform = window.PDTemplates.TEMPLATES[brief.template].platform;
    const products = [];
    let error = null;
    for (const n of names) {
      if (onProgress) onProgress(n.label);
      try {
        const s = await screenFor(mcp, n.name, brief.template, platform);
        if (!s) { products.push({ name: n.label, role: n.role, found: false }); continue; }
        const palette = await readPalette(s.image, platform);
        products.push({ name: n.label, role: n.role, found: true, url: s.url, thumb: await thumb(s.image), palette, summary: summarize(palette) });
      } catch (err) {
        error = (err && err.code) || "upstream_error";
        products.push({ name: n.label, role: n.role, found: false });
        if (["not_granted", "server_not_connected", "needs_reauth", "not_in_manifest", "blocked_by_policy"].includes(error)) {
          return { status: error, products: [...products, ...names.slice(products.length).map((x) => ({ name: x.label, role: x.role, found: false }))] };
        }
      }
    }
    if (products.some((p) => p.found)) await window.PDStore.set(cacheKey, { products });
    return { status: products.some((p) => p.found) ? "ok" : error || "empty", products };
  }

  window.PDRefs = { load, readPalette, summarize };
})();
