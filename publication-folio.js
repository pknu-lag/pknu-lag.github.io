(() => {
  const folio = document.querySelector(".publication-folio");
  const tablist = folio.querySelector(".folio-tabs");
  const tabs = [...tablist.querySelectorAll("[data-sheet]")];
  tablist.setAttribute("role", "tablist");

  function turnPage(selected) {
    for (const tab of tabs) {
      const panel = document.getElementById(tab.hash.slice(1));
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    }
  }

  for (const [index, tab] of tabs.entries()) {
    const panel = document.getElementById(tab.hash.slice(1));
    panel.setAttribute("role", "tabpanel");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    tab.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      turnPage(tab);
    });
    tab.addEventListener("keydown", event => {
      const positions = {ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1};
      if (event.key === " ") {
        event.preventDefault();
        turnPage(tab);
      } else if (Object.hasOwn(positions, event.key)) {
        event.preventDefault();
        const next = tabs[positions[event.key]];
        turnPage(next);
        next.focus();
      }
    });
  }
  function readFragment() {
    const linked = tabs.find(tab => tab.hash === location.hash);
    if (linked) turnPage(linked);
  }
  turnPage(tabs[0]);
  readFragment();
  window.addEventListener("hashchange", readFragment);
  folio.classList.add("folio-enhanced");

  const year = document.querySelector("#year");
  const chart = document.querySelector(".archive-timeline");
  const bars = [...chart.querySelectorAll("[data-filter-year]")];
  function syncYear() {
    for (const bar of bars) {
      bar.setAttribute("aria-pressed", String(bar.dataset.filterYear === year.value));
    }
  }
  for (const bar of bars) {
    bar.addEventListener("click", () => {
      year.value = year.value === bar.dataset.filterYear ? "" : bar.dataset.filterYear;
      year.dispatchEvent(new Event("change", {bubbles: true}));
    });
    bar.addEventListener("keydown", event => {
      const index = bars.indexOf(bar);
      const positions = {ArrowLeft: (index + bars.length - 1) % bars.length,
        ArrowRight: (index + 1) % bars.length, Home: 0, End: bars.length - 1};
      if (Object.hasOwn(positions, event.key)) {
        event.preventDefault();
        bars[positions[event.key]].focus();
      }
    });
  }
  year.addEventListener("change", syncYear);
  syncYear();
  chart.hidden = false;
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        chart.classList.add("chart-visible");
        observer.disconnect();
      }
    }, {threshold: .2});
    observer.observe(chart);
  }
})();
