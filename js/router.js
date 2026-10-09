// One page, one round at a time: #design, #study, #compare, #redesign, #review,
// plus #history, and #drill for the Palette Drill tab.
// No hash shows the start page.
(function () {
  const TITLES = {
    home: "Design Training Camp",
    design: "Design · Design Training Camp",
    study: "Study · Design Training Camp",
    compare: "Compare · Design Training Camp",
    redesign: "Redesign · Design Training Camp",
    review: "Review · Design Training Camp",
    history: "History · Design Training Camp",
    drill: "Palette Drill · Design Training Camp",
  };
  const hooks = {};
  let current = null;

  function pageFromHash() {
    const name = location.hash.replace(/^#/, "");
    return document.querySelector('[data-page="' + name + '"]') ? name : "home";
  }

  function show() {
    const name = pageFromHash();
    if (name === current) return;
    current = name;
    document.querySelectorAll("[data-page]").forEach((el) => {
      el.hidden = el.dataset.page !== name;
    });
    document.title = TITLES[name] || TITLES.home;
    const section = name === "drill" ? "drill" : "camp";
    document.body.dataset.section = section;
    document.querySelectorAll("[data-section-tab]").forEach((tab) => {
      if (tab.dataset.sectionTab === section) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    (hooks[name] || []).forEach((fn) => fn());
  }

  window.DTCPages = {
    // Run `fn` every time the round opens.
    on(name, fn) {
      (hooks[name] = hooks[name] || []).push(fn);
    },
  };

  window.addEventListener("hashchange", show);
  document.addEventListener("DOMContentLoaded", show);
})();
