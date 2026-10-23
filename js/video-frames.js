// Screen recording -> screens. Plays through a video in the browser, waits
// for the picture to settle (not mid-scroll or mid-animation), and keeps a
// frame each time a settled picture differs clearly from the last one kept.
// Nothing is uploaded anywhere; it all happens on this page.
(function () {
  const STEP = 0.4;        // seconds between samples
  // Differences are the share of pixels that clearly changed, so a new title
  // or button on an otherwise similar layout still counts.
  const SETTLED = 0.004;   // less than this changed = not moving
  const NEW_SCREEN = 0.03; // more than this changed from the last kept frame = new screen
  const MAX_SCREENS = 15;
  const MAX_WIDTH = 1600;  // keep saved frames a sensible size

  function once(el, ok, bad) {
    return new Promise((resolve, reject) => {
      const done = () => { el.removeEventListener(ok, done); el.removeEventListener(bad, fail); resolve(); };
      const fail = () => { el.removeEventListener(ok, done); el.removeEventListener(bad, fail); reject(new Error("video_error")); };
      el.addEventListener(ok, done);
      el.addEventListener(bad, fail);
    });
  }

  async function seek(video, t) {
    if (Math.abs(video.currentTime - t) < 0.001) return;
    const p = once(video, "seeked", "error");
    video.currentTime = t;
    await p;
  }

  // Small color fingerprint of the current frame. Color, not gray, so a blue
  // button turning green counts even when both are equally bright.
  function fingerprint(video, ctx, w, h) {
    ctx.drawImage(video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data.slice();
  }
  function diff(a, b) {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++;
    }
    return n / (a.length / 4);
  }

  function capture(video) {
    const k = Math.min(1, MAX_WIDTH / video.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * k);
    c.height = Math.round(video.videoHeight * k);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return new Promise((resolve) => c.toBlob(resolve, "image/png"));
  }

  const stamp = (t) => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");

  // Resolves to [{ blob, time, label }]. onProgress(fraction, found).
  async function extract(file, onProgress) {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    try {
      await once(video, "loadeddata", "error");
      // Some recordings (often WebM) don't say how long they are until the
      // player has been to the end.
      if (!isFinite(video.duration)) {
        const p = once(video, "seeked", "error");
        video.currentTime = 1e7;
        await p;
        await seek(video, 0);
      }
      if (!video.videoWidth || !isFinite(video.duration)) throw new Error("video_error");
      const w = 72, h = Math.max(1, Math.round((72 * video.videoHeight) / video.videoWidth));
      const small = document.createElement("canvas");
      small.width = w; small.height = h;
      const ctx = small.getContext("2d", { willReadFrequently: true });

      const found = [];
      let prev = null, kept = null;
      const end = Math.max(0, video.duration - 0.05);
      for (let t = 0; t <= end + 1e-6; t += STEP) {
        await seek(video, Math.min(t, end));
        const fp = fingerprint(video, ctx, w, h);
        const still = prev && diff(fp, prev) < SETTLED;
        // The very last sample counts as settled: recordings often end on a screen.
        const last = t + STEP > end;
        if ((still || last || !prev && video.duration < STEP) && (!kept || diff(fp, kept) > NEW_SCREEN)) {
          found.push({ blob: await capture(video), time: video.currentTime, fp });
          kept = fp;
        }
        prev = fp;
        if (onProgress) onProgress(Math.min(1, t / (end || 1)), found.length);
      }
      // Too many: keep an even spread.
      let screens = found;
      if (screens.length > MAX_SCREENS) {
        const pick = [];
        for (let i = 0; i < MAX_SCREENS; i++) pick.push(screens[Math.round((i * (screens.length - 1)) / (MAX_SCREENS - 1))]);
        screens = pick;
      }
      return screens.map((s) => ({ blob: s.blob, time: s.time, label: stamp(s.time) }));
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    }
  }

  window.DTCVideo = { extract };
})();
