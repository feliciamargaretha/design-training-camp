// When a past day is open (from History), say so on every page and offer the
// way back to today.
(function () {
  if (!window.DTC.isPast()) return;
  const date = window.DTC.activeDate();
  const challenge = window.DTC.today();

  const bar = document.createElement("div");
  bar.className = "day-banner";
  bar.setAttribute("role", "status");
  const text = document.createElement("p");
  text.textContent = "You're looking at " +
    date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) +
    " · Challenge #" + String(challenge.id).padStart(3, "0") + " · " + challenge.name;
  const links = document.createElement("div");
  links.className = "day-banner__links";
  const history = document.createElement("a");
  history.href = "#history";
  history.textContent = "History";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "Back to today";
  back.addEventListener("click", () => window.DTC.openDay(window.DTC.dateKey(new Date()), ""));
  links.append(history, back);
  bar.append(text, links);
  document.body.prepend(bar);
})();
