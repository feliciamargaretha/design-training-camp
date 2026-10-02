// One page, one round at a time: #design, #study, #compare, #redesign.
// No hash shows the start page.
(function () {
  const TITLES = {
    home: "Design Training Camp",
    design: "Design · Design Training Camp",
    study: "Study · Design Training Camp",
    compare: "Compare · Design Training Camp",
    redesign: "Redesign · Design Training Camp",
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
