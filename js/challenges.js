// Daily briefs. Every day gets one small brief: a B2C mobile screen, a B2B
// desktop screen or a landing page section, with an industry, light or dark
// mode and a visual style. Briefs are built from the lists below with a
// generator seeded by the date, so a day always gets the same brief.
//
// Each brief also carries a Mobbin search (tool + query) so Study and Compare
// can pull real references for the same problem.
(function () {
  const DAY = 86400000;

  // ---------- Building blocks ----------

  // B2C: one product, a few screens that make sense for it. Mobile, 1–2 screens.
  const B2C = [
    { product: "a food delivery app", industry: "Food delivery", screens: [
      ["Checkout", "a checkout screen", "review the order and pay"],
      ["Order tracking", "the live order tracking screen", "see when the food arrives"],
      ["Restaurant menu", "a restaurant's menu screen", "pick a dish quickly"],
    ] },
    { product: "a mobile banking app", industry: "Banking", screens: [
      ["Send money", "the send money screen", "pay a friend in a few taps"],
      ["Card details", "a card details screen", "check and control their card"],
      ["Sign up", "the sign-up screen", "open an account without friction"],
    ] },
    { product: "a meditation app", industry: "Wellness", screens: [
      ["Paywall", "the premium paywall", "understand what premium adds"],
      ["Session player", "the session player screen", "settle into a session"],
      ["Onboarding", "the first onboarding screen", "feel welcome and know what to expect"],
    ] },
    { product: "a travel booking app", industry: "Travel", screens: [
      ["Search results", "hotel search results", "compare a few options"],
      ["Booking confirmation", "the booking confirmation screen", "feel sure the trip is booked"],
      ["Trip overview", "a trip overview screen", "see the whole trip at a glance"],
    ] },
    { product: "a fitness app", industry: "Fitness", screens: [
      ["Workout summary", "the workout summary screen", "feel proud and see progress"],
      ["Goal picker", "an onboarding goal picker", "choose a goal that fits"],
      ["Progress", "a weekly progress screen", "understand how the week went"],
    ] },
    { product: "a grocery delivery app", industry: "Grocery", screens: [
      ["Cart", "the cart screen", "check the basket before paying"],
      ["Product detail", "a product detail screen", "decide whether to add an item"],
    ] },
    { product: "a music streaming app", industry: "Music", screens: [
      ["Now playing", "the now playing screen", "control playback and discover more"],
      ["Library", "the library screen", "find saved music fast"],
    ] },
    { product: "a language learning app", industry: "Education", screens: [
      ["Lesson complete", "the lesson complete screen", "feel progress and come back tomorrow"],
      ["Home", "the home screen", "start today's lesson"],
    ] },
    { product: "a home rental app", industry: "Real estate", screens: [
      ["Listing detail", "a listing detail screen", "judge whether the place fits"],
      ["Saved homes", "the saved homes screen", "compare shortlisted places"],
    ] },
    { product: "a plant care app", industry: "Lifestyle", screens: [
      ["Plant detail", "a plant's detail screen", "know what the plant needs today"],
      ["Reminders", "the care reminders screen", "see what to water and when"],
    ] },
    { product: "a ride-hailing app", industry: "Mobility", screens: [
      ["Ride options", "the ride options screen", "pick a ride by price and time"],
      ["Driver arriving", "the driver arriving screen", "find the car and feel safe"],
    ] },
    { product: "a podcast app", industry: "Media", screens: [
      ["Episode detail", "an episode detail screen", "decide whether to listen"],
      ["Empty library", "the empty library state", "find a first show to follow"],
    ] },
  ];

  // B2B: one product, a few single desktop screens.
  const B2B = [
    { product: "a CRM for small sales teams", industry: "Sales software", screens: [
      ["Contact detail", "a contact detail page", "prepare for the next call"],
      ["Deal pipeline", "the deal pipeline view", "see which deals need attention"],
    ] },
    { product: "a product analytics tool", industry: "Analytics", screens: [
      ["Dashboard", "the overview dashboard", "spot what changed this week"],
      ["Funnel report", "a funnel report", "find where users drop off"],
    ] },
    { product: "an HR platform", industry: "HR", screens: [
      ["Time-off request", "the time-off request page", "request leave and see what's left"],
      ["Employee directory", "the employee directory", "find a colleague and their role"],
    ] },
    { product: "an invoicing tool for freelancers", industry: "Finance", screens: [
      ["Invoice editor", "the invoice editor", "create and send an invoice fast"],
      ["Invoice list", "the invoices list", "see what's paid, due and overdue"],
    ] },
    { product: "a customer support platform", industry: "Customer support", screens: [
      ["Ticket inbox", "the ticket inbox", "pick the next ticket to answer"],
      ["Ticket detail", "a ticket detail view", "understand the issue and reply"],
    ] },
    { product: "an infrastructure monitoring tool", industry: "Developer tools", screens: [
      ["Incident detail", "an incident detail page", "understand impact and act"],
      ["Service status", "the service status overview", "see what's healthy and what isn't"],
    ] },
    { product: "a logistics platform", industry: "Logistics", screens: [
      ["Shipment tracking", "the shipment tracking table", "find delayed shipments"],
    ] },
    { product: "a clinic management system", industry: "Healthcare", screens: [
      ["Appointment schedule", "the daily appointment schedule", "run the day without surprises"],
    ] },
    { product: "a project management tool", industry: "Productivity", screens: [
      ["Project overview", "a project overview page", "see status, owners and what's next"],
      ["Team settings", "the team members and roles settings", "invite teammates with the right access"],
    ] },
    { product: "a cybersecurity platform", industry: "Security", screens: [
      ["Alerts", "the alerts list", "triage the most serious threats first"],
    ] },
  ];

  // Landing page sections, for a few kinds of brands. One desktop section.
  const SECTIONS = [
    ["Hero", "the hero section", "hero section with headline, supporting text and a primary call to action"],
    ["Feature callout", "a feature callout section with three features", "feature section with three feature highlights"],
    ["Pricing", "the pricing section", "pricing section with plan cards"],
    ["Testimonials", "a testimonials section", "testimonials section with customer quotes"],
    ["FAQ", "the FAQ section", "FAQ section with expandable questions"],
    ["How it works", "a how-it-works section in three steps", "how it works section with numbered steps"],
    ["Footer", "the footer", "website footer with navigation links and newsletter signup"],
    ["Call to action", "a closing call-to-action banner", "call to action banner section"],
    ["Logo wall", "an integrations or customer logos section", "integrations section with partner logos"],
    ["Comparison", "a plan comparison table", "pricing comparison table section"],
  ];
  // Each brand lists the sections that make sense for it.
  const BRANDS = [
    { product: "an AI note-taking tool", industry: "AI software",
      sections: ["Hero", "Feature callout", "Pricing", "Testimonials", "FAQ", "How it works", "Logo wall", "Comparison", "Call to action", "Footer"] },
    { product: "a sustainable sneaker brand", industry: "Fashion",
      sections: ["Hero", "Feature callout", "Testimonials", "FAQ", "Call to action", "Footer"] },
    { product: "a fintech card for freelancers", industry: "Fintech",
      sections: ["Hero", "Feature callout", "Pricing", "FAQ", "How it works", "Comparison", "Testimonials", "Call to action"] },
    { product: "a boutique hotel", industry: "Hospitality",
      sections: ["Hero", "Feature callout", "Testimonials", "FAQ", "Call to action", "Footer"] },
    { product: "a specialty coffee subscription", industry: "Food & drink",
      sections: ["Hero", "Pricing", "How it works", "Testimonials", "FAQ", "Footer"] },
    { product: "a developer API platform", industry: "Developer tools",
      sections: ["Hero", "Feature callout", "Pricing", "Logo wall", "How it works", "Comparison", "Call to action", "Footer"] },
    { product: "a climate nonprofit", industry: "Nonprofit",
      sections: ["Hero", "How it works", "Testimonials", "FAQ", "Call to action", "Footer"] },
    { product: "an online course platform", industry: "Education",
      sections: ["Hero", "Feature callout", "Pricing", "Testimonials", "FAQ", "Comparison"] },
    { product: "an electric bike brand", industry: "Mobility",
      sections: ["Hero", "Feature callout", "Comparison", "Testimonials", "FAQ", "Call to action"] },
    { product: "a design agency", industry: "Creative services",
      sections: ["Hero", "Testimonials", "Logo wall", "How it works", "Call to action", "Footer"] },
  ];

  // b2b: whether the style suits a work tool.
  const STYLES = [
    { name: "minimal and editorial", b2b: true },
    { name: "bold and playful", b2b: true },
    { name: "premium and refined", b2b: true },
    { name: "warm and friendly", b2b: true },
    { name: "technical and precise", b2b: true },
    { name: "calm and soft", b2b: true },
    { name: "energetic and sporty", b2b: false },
    { name: "trustworthy and corporate", b2b: true },
    { name: "retro-inspired", b2b: false },
    { name: "Swiss and grid-based", b2b: true },
  ];

  // Before the generator existed, briefs came from this list. Kept so past
  // days still show the brief they were done with.
  const LEGACY = [
    { name: "Onboarding", pattern: "Onboarding", platform: "ios", brief: "Design the first onboarding screen for a habit-tracking app." },
    { name: "Sign up", pattern: "Signup", platform: "ios", brief: "Design a sign-up screen for a mobile banking app." },
    { name: "Paywall", pattern: "Paywall", platform: "ios", brief: "Design a paywall for a premium meditation plan." },
    { name: "Empty state", pattern: "Empty State", platform: "ios", brief: "Design the empty inbox of a team chat app." },
    { name: "Checkout", pattern: "Checkout", platform: "ios", brief: "Design a checkout screen for a food delivery app." },
    { name: "Settings", pattern: "Settings", platform: "ios", brief: "Design the notification settings for a news app." },
    { name: "Profile", pattern: "Profile", platform: "ios", brief: "Design a user profile for a running community." },
    { name: "Pricing", pattern: "Pricing", platform: "web", brief: "Design a pricing page for a design-collaboration tool." },
    { name: "Search", pattern: "Search", platform: "ios", brief: "Design the search results screen for a recipe app." },
    { name: "Dashboard", pattern: "Dashboard", platform: "web", brief: "Design the home dashboard for a personal finance tool." },
    { name: "Error", pattern: "Error", platform: "ios", brief: "Design a payment-failed screen that keeps the user calm." },
    { name: "Notifications", pattern: "Notifications", platform: "ios", brief: "Design the activity feed for a photo-sharing app." },
  ];
  const GENERATOR_START = Date.UTC(2026, 9, 3); // 3 Oct 2026; earlier days use LEGACY
  const NUMBER_ZERO = Date.UTC(2026, 8, 27); // so 2 Oct 2026 is challenge 005

  // ---------- Generator ----------
  function rng(seed) {
    // mulberry32
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  // A shuffled order of a list that repeats every cycle, so items don't come
  // back until the others have had a turn.
  function inCycle(list, n, salt) {
    const cycle = Math.floor(n / list.length);
    const order = list.map((_, i) => i);
    const r = rng(cycle * 7919 + salt);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return list[order[n % list.length]];
  }

  function utcDay(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function forDate(date) {
    const day = utcDay(date);
    const id = Math.round((day - NUMBER_ZERO) / DAY);
    const dayNumber = Math.floor(day / DAY);

    if (day < GENERATOR_START) {
      const old = LEGACY[dayNumber % LEGACY.length];
      return {
        ...old,
        id,
        kind: old.platform === "web" ? "b2b" : "b2c",
        theme: "light",
        tool: "search_screens",
        query: old.brief.replace(/^Design (the |a |an )?/i, "").replace(/\.$/, ""),
        scope: old.platform === "web" ? "1 desktop screen" : "1 mobile screen",
      };
    }

    const n = Math.round((day - GENERATOR_START) / DAY);
    const r = rng(dayNumber * 2654435761);
    // Rotate B2C, B2B and landing sections so each week has a mix.
    const kind = ["b2c", "section", "b2b"][n % 3];
    const theme = r() < 0.4 ? "dark" : "light";
    const style = inCycle(kind === "b2b" ? STYLES.filter((x) => x.b2b) : STYLES, n, 11).name;
    const modeWords = theme === "dark" ? "dark mode" : "light mode";

    if (kind === "section") {
      const brand = inCycle(BRANDS, Math.floor(n / 3), 37);
      const fits = SECTIONS.filter((x) => brand.sections.includes(x[0]));
      const [name, what, query] = pick(r, fits);
      return {
        id, kind, theme, style, name: name + " section",
        industry: brand.industry,
        platform: "web",
        tool: "search_sections",
        query,
        scope: "1 desktop section",
        brief: "Design " + what + " for the landing page of " + brand.product + ".",
        context: "Visual style: " + style + ", in " + modeWords + ".",
      };
    }

    const pool = kind === "b2c" ? B2C : B2B;
    const product = inCycle(pool, Math.floor(n / 3), kind === "b2c" ? 41 : 53);
    const [name, what, goal] = pick(r, product.screens);
    return {
      id, kind, theme, style, name,
      industry: product.industry,
      platform: kind === "b2c" ? "ios" : "web",
      tool: "search_screens",
      query: what.replace(/^(a|an|the) /, "") + " in " + product.product.replace(/^(a|an) /, "") +
        (theme === "dark" ? " in dark mode" : ""),
      scope: kind === "b2c" ? "1 mobile screen (2 at most)" : "1 desktop screen",
      brief: "Design " + what + " for " + product.product + ".",
      context: "Help people " + goal + ". Visual style: " + style + ", in " + modeWords + ".",
    };
  }

  // ---------- Which day is on screen ----------
  // 1. A day opened from History (remembered for this tab).
  // 2. Otherwise the brief you're working on: starting Design pins it, and it
  //    stays, even on later days, until you finish its Review.
  // 3. Otherwise today.
  const DATE_KEY = "dtc:date";
  const PIN_KEY = "dtc:pinned";
  const DONE_PREFIX = "dtc:done:";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  function parseKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function dateKey(date = activeDate()) {
    const pad = (n) => String(n).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  const isBeforeToday = (d) => d && utcDay(d) < utcDay(new Date());

  function viewedKey() {
    try {
      const k = sessionStorage.getItem(DATE_KEY);
      return isBeforeToday(parseKey(k)) ? k : null;
    } catch (_) {
      return null;
    }
  }

  function isDone(key) {
    return store.get(DONE_PREFIX + key) === "1";
  }

  function pinnedKey() {
    const k = store.get(PIN_KEY);
    return isBeforeToday(parseKey(k)) && !isDone(k) ? k : null;
  }

  // "view" (opened from History), "carried" (an unfinished brief from an
  // earlier day) or "today".
  function mode() {
    return viewedKey() ? "view" : pinnedKey() ? "carried" : "today";
  }

  function activeDate() {
    const k = viewedKey() || pinnedKey();
    return k ? parseKey(k) : new Date();
  }

  function isPast() {
    return mode() !== "today";
  }

  // Starting a brief keeps it on screen until it's finished.
  function pin(key = dateKey()) {
    if (!isDone(key)) store.set(PIN_KEY, key);
  }
  function pinnedRaw() {
    return store.get(PIN_KEY);
  }

  // Finishing Review releases the brief.
  function markDone(key = dateKey()) {
    store.set(DONE_PREFIX + key, "1");
    if (store.get(PIN_KEY) === key) store.remove(PIN_KEY);
  }

  function openDay(key, hash) {
    try {
      if (key === dateKey(new Date())) {
        sessionStorage.removeItem(DATE_KEY);
        store.remove(PIN_KEY);
      } else {
        sessionStorage.setItem(DATE_KEY, key);
      }
    } catch (_) {
      return false;
    }
    location.hash = hash || "";
    location.reload();
    return true;
  }

  // Leave the brief on screen and go to today's.
  function useToday(hash) {
    return openDay(dateKey(new Date()), hash);
  }

  function today(date = activeDate()) {
    return forDate(date);
  }

  // Mobbin search link for the brief (used when the connector isn't available).
  function mobbinUrl(challenge) {
    if (challenge.pattern) {
      const params = new URLSearchParams({
        content_type: "screens",
        sort: "publishedAt",
        filter: "screenPatterns." + challenge.pattern,
      });
      return "https://mobbin.com/search/apps/" + challenge.platform + "?" + params.toString();
    }
    const params = new URLSearchParams({
      content_type: challenge.tool === "search_sections" ? "sections" : "screens",
      q: challenge.query,
    });
    return "https://mobbin.com/search/" + (challenge.tool === "search_sections" ? "sites" : "apps/" + challenge.platform) +
      "?" + params.toString();
  }

  // Short labels for a brief, e.g. ["B2C", "Mobile", "Dark mode", "Fitness", "Calm and soft"].
  function tags(challenge) {
    return [
      challenge.kind === "section" ? "Landing page" : challenge.kind === "b2b" ? "B2B" : "B2C",
      challenge.platform === "web" ? "Desktop" : "Mobile",
      challenge.theme === "dark" ? "Dark mode" : "Light mode",
      challenge.industry,
      challenge.style ? challenge.style.replace(/^./, (c) => c.toUpperCase()) : null,
    ].filter(Boolean);
  }

  // Fill a brief's details into an element: tags, context and scope.
  function renderMeta(el, challenge) {
    if (!el) return;
    el.replaceChildren();
    const row = document.createElement("div");
    row.className = "brief-tags";
    tags(challenge).forEach((t) => {
      const span = document.createElement("span");
      span.className = "brief-tag";
      span.textContent = t;
      row.append(span);
    });
    el.append(row);
    if (challenge.context || challenge.scope) {
      const p = document.createElement("p");
      p.className = "brief-context";
      p.textContent = [challenge.context, challenge.scope ? "Scope: " + challenge.scope + "." : ""].filter(Boolean).join(" ");
      el.append(p);
    }
  }

  // What one reference is called: "checkout screen", "pricing section".
  function refNoun(challenge) {
    const name = challenge.name.toLowerCase();
    return challenge.tool === "search_sections" ? name : name + " screen";
  }

  // The brief as Claude reads it: the task, its context and its scope.
  function briefLine(challenge) {
    return [
      challenge.brief,
      challenge.context,
      challenge.scope ? "Scope: " + challenge.scope + (challenge.platform === "web" ? ", desktop." : ", mobile.") : "",
    ].filter(Boolean).join(" ");
  }

  // Every brief from the first one used, oldest first (for History).
  function allKeys() {
    const keys = [];
    for (let d = new Date(2026, 9, 2); utcDay(d) <= utcDay(new Date()); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      keys.push(dateKey(d));
    }
    return keys;
  }

  window.DTC = {
    refNoun, briefLine, today, forDate, dateKey, parseKey, activeDate, isPast, mode,
    openDay, useToday, pin, pinnedRaw, markDone, isDone, allKeys, mobbinUrl, tags, renderMeta,
  };
})();
