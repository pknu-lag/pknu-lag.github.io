const menu = document.querySelector(".menu");
const nav = document.querySelector("#main-nav");
menu.addEventListener("click", () => {
  menu.setAttribute("aria-expanded", String(nav.classList.toggle("open")));
});

menu.parentElement.addEventListener("keydown", event => {
  if (event.key === "Escape" && nav.classList.contains("open")) {
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
    menu.focus();
  }
});

const query = document.querySelector("#query");
if (query) {
  const year = document.querySelector("#year");
  const papers = [...document.querySelectorAll(".paper")];
  const synonyms = {
    "서은교":"eunkyo seo", "최규연":"gyuyeon choi", "한준녕":"junnyeong han",
    "이보라":"bora lee", "탁선래":"sunlae tak", "박윤주":"yunju park",
    "토양수분":"soil moisture", "폭염":"heatwave", "강수":"precipitation",
    "적설":"snow", "자료동화":"assimilation", "가뭄":"drought"
  };
  const linkedAuthor = new URLSearchParams(location.search).get("author");
  if (linkedAuthor) query.value = linkedAuthor;
  function filterPapers() {
    const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const paper of papers) {
      const text = paper.textContent.toLowerCase().replace(/[-‐–]/g, " ");
      const exactAuthor = linkedAuthor && query.value.trim() === linkedAuthor;
      const authors = paper.querySelector("[data-byline]")?.dataset.byline.split(",").map(name => name.trim());
      const found = exactAuthor ? authors?.includes(linkedAuthor) : words.every(word => text.includes(word) || (
        synonyms[word] && (text.includes(synonyms[word]) ||
        text.replace(/\s/g, "").includes(synonyms[word].replace(/\s/g, "")))
      ));
      paper.hidden = !found || Boolean(year.value && year.value !== paper.dataset.year);
      if (!paper.hidden) matches++;
    }
    document.querySelector("#count").textContent = matches + (matches === 1 ? " publication" : " publications");
    document.querySelector("#empty").hidden = matches > 0;
  }
  query.addEventListener("input", filterPapers);
  year.addEventListener("change", filterPapers);
  if (linkedAuthor) filterPapers();
}

document.querySelectorAll("[data-study]").forEach(button => {
  const dialog = document.querySelector("#study-" + button.dataset.study);
  button.addEventListener("click", () => dialog.showModal());
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
});
