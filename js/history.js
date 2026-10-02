// History: every day with saved work, newest first. Opening a day loads all
// its rounds as they were left.
(function () {
  const $ = (id) => document.getElementById(id);
  const ROUNDS = [
    ["design", "Design"],
    ["study", "Study"],
    ["compare", "Compare"],
    ["redesign", "Redesign"],
    ["review", "Review"],
  ];
  const VERDICTS = { wide: "Wide range", some: "Some range", narrow: "Narrow range" };
  let urls = [];

  async function loadDay(dateKey) {
    const get = (round) => window.DTCStore.get(dateKey + ":" + round);
    const [design, study, analysis, redesign, review] = await Promise.all(
      ["design", "study", "analysis", "redesign", "review"].map(get)
    );
    const date = window.DTC.parseKey(dateKey);
    const challenge = window.DTC.forDate(date);
    const same = (x) => x && x.challengeId === challenge.id;
    const explorations = same(redesign)
      ? (redesign.explorations || []).filter((x) => x.screens && x.screens.length)
      : [];
    const done = {
      design: same(design) && (design.screens || []).length > 0,
      study: same(study) && Object.keys(study).some((k) => k !== "challengeId" && String(study[k] || "").trim()),
      compare: same(analysis) && (analysis.observations || []).length > 0,
      redesign: explorations.length > 0,
      review: same(review) && !!(review.summary || review.range),
    };
    return { dateKey, date, challenge, design: same(design) ? design : null, explorations, review: same(review) ? review : null, done };
  }

  function thumb(blob, label) {
    const fig = document.createElement("figure");
    fig.className = "hist__thumb";
    const img = document.createElement("img");
    const url = URL.createObjectURL(blob);
    urls.push(url);
    img.src = url;
    img.alt = "";
    const cap = document.createElement("figcaption");
    cap.textContent = label;
    fig.append(img, cap);
    return fig;
  }

  function renderDay(day, isToday) {
    const li = document.createElement("li");
    li.className = "hist__day";

    const head = document.createElement("div");
    head.className = "hist__head";
    const date = document.createElement("p");
    date.className = "hist__date";
    date.textContent = isToday
      ? "Today"
      : day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const num = document.createElement("span");
    num.className = "hist__num";
    num.textContent = "#" + String(day.challenge.id).padStart(3, "0");
    date.append(" ", num);
    const brief = document.createElement("p");
    brief.className = "hist__brief";
    brief.textContent = day.challenge.brief;
    const meta = document.createElement("div");
    window.DTC.renderMeta(meta, { ...day.challenge, context: "", scope: "" });
    head.append(date, brief, meta);

    // Rounds done
    const progress = document.createElement("ol");
    progress.className = "hist__rounds";
    progress.setAttribute("aria-label", "Rounds");
    ROUNDS.forEach(([key, label]) => {
      const r = document.createElement("li");
      r.className = "hist__round" + (day.done[key] ? " is-done" : "");
      r.textContent = (day.done[key] ? "✓ " : "") + label;
      progress.append(r);
    });

    // Screens: your first design and each exploration
    const thumbs = document.createElement("div");
    thumbs.className = "hist__thumbs";
    if (day.design && day.design.screens && day.design.screens[0]) thumbs.append(thumb(day.design.screens[0].blob, "Original"));
    day.explorations.slice(0, 4).forEach((x, i) =>
      thumbs.append(thumb(x.screens[0].blob, (x.name || "").trim() || "Exploration " + "ABCDEFGHIJ"[i]))
    );

    const side = document.createElement("div");
    side.className = "hist__side";
    if (day.review && day.review.summary && day.review.summary.strongest) {
      const t = document.createElement("p");
      t.className = "hist__takeaway";
      t.innerHTML = "<span>Strongest</span> ";
      t.append(day.review.summary.strongest);
      side.append(t);
    }
    if (day.review && day.review.range && VERDICTS[day.review.range.verdict]) {
      const v = document.createElement("span");
      v.className = "range__verdict range__verdict--" + day.review.range.verdict;
      v.textContent = VERDICTS[day.review.range.verdict];
      side.append(v);
    }
    if (day.review && day.review.summary && day.review.summary.next) {
      const n = document.createElement("p");
      n.className = "hist__next";
      n.textContent = "Practice next: " + day.review.summary.next;
      side.append(n);
    }

    // Open: the review if it's done, otherwise the first unfinished round.
    const next = ROUNDS.find(([key]) => !day.done[key]);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn btn--sm";
    open.textContent = day.done.review ? "Open review" : next ? "Continue at " + next[1] : "Open";
    open.addEventListener("click", () => {
      const hash = "#" + (day.done.review ? "review" : next ? next[0] : "review");
      if (isToday && !window.DTC.isPast()) {
        location.hash = hash;
      } else if (!window.DTC.openDay(day.dateKey, hash)) {
        open.textContent = "Can't open past days in this browser";
        open.disabled = true;
      }
    });
    side.append(open);

    const body = document.createElement("div");
    body.className = "hist__body";
    body.append(thumbs, side);

    li.append(head, progress, body);
    return li;
  }

  async function render() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    const keys = await window.DTCStore.keys();
    const dates = [...new Set(keys.map((k) => k.split(":")[0]).filter((d) => window.DTC.parseKey(d)))]
      .sort()
      .reverse();
    const todayKey = window.DTC.dateKey(new Date());
    const days = (await Promise.all(dates.map(loadDay)))
      .filter((d) => Object.values(d.done).some(Boolean));

    const list = $("hist-list");
    list.replaceChildren(...days.map((d) => renderDay(d, d.dateKey === todayKey)));
    $("hist-empty").hidden = days.length > 0;
    $("hist-count").textContent = days.length + (days.length === 1 ? " day practised" : " days practised");
  }

  window.DTCPages.on("history", render);
})();
