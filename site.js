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

const story = document.querySelector(".photo-story");
if (story) {
  const frames = [...story.querySelectorAll(".story-frame")];
  const thumbnails = [...story.querySelectorAll("[data-story]")];
  let selected = 0;
  function showStory(index) {
    selected = (index + frames.length) % frames.length;
    frames.forEach((frame, i) => {
      frame.hidden = i !== selected;
      thumbnails[i].setAttribute("aria-pressed", String(i === selected));
    });
    const rail = story.querySelector(".story-rail");
    const thumb = thumbnails[selected];
    const offset = thumb.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    if (offset < 0 || offset + thumb.offsetWidth > rail.clientWidth) rail.scrollLeft += offset;
  }
  thumbnails.forEach((thumb, i) => thumb.addEventListener("click", () => showStory(i)));
  story.querySelectorAll("[data-story-step]").forEach(button => {
    button.addEventListener("click", () => showStory(selected + Number(button.dataset.storyStep)));
  });
}

const light = document.querySelector("#light");
if (light) {
  const archive = [...document.querySelectorAll(".gallery .photo-open")];
  const image = light.querySelector("img");
  const caption = light.querySelector(".viewer-caption");
  const count = light.querySelector(".viewer-count");
  const stage = light.querySelector(".viewer-stage");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let slideDirection = 0;
  let selected = 0;
  function showPhoto(index, direction = 0) {
    slideDirection = direction;
    selected = (index + archive.length) % archive.length;
    const item = archive[selected];
    image.src = item.href;
    image.alt = item.querySelector("img").alt;
    caption.textContent = image.alt;
    count.textContent = String(selected + 1).padStart(2, "0") + " / " + String(archive.length).padStart(2, "0");
  }
  document.querySelectorAll(".photo-open").forEach(anchor => anchor.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const index = archive.findIndex(item => item.href === anchor.href);
    if (index < 0) return;
    event.preventDefault();
    showPhoto(index);
    light.showModal();
  }));
  function openLinkedPhoto() {
    const match = /^#photo-(\d{2})$/.exec(location.hash);
    if (!match) return;
    const index = archive.findIndex(item => item.closest("figure")?.id === "photo-" + match[1]);
    if (index >= 0 && !light.open) {
      showPhoto(index);
      light.showModal();
    }
  }
  window.addEventListener("hashchange", openLinkedPhoto);
  openLinkedPhoto();
  image.addEventListener("load", () => {
    if (!slideDirection || !light.open || reducedMotion.matches) return;
    image.getAnimations().forEach(animation => animation.cancel());
    image.animate([
      { opacity: .65, transform: "translateX(" + (slideDirection * 9) + "px)" },
      { opacity: 1, transform: "translateX(0)" }
    ], { duration: 180, easing: "ease-out" });
  });
  let swipe = null;
  stage.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    swipe = event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    if (swipe) stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointercancel", () => { swipe = null; });
  stage.addEventListener("pointerup", event => {
    if (swipe?.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    const direction = dx < 0 ? 1 : -1;
    showPhoto(selected + direction, direction);
  });
  light.querySelector("#prev-photo").addEventListener("click", () => showPhoto(selected - 1, -1));
  light.querySelector("#next-photo").addEventListener("click", () => showPhoto(selected + 1, 1));
  light.querySelector("#close").addEventListener("click", () => light.close());
  light.addEventListener("click", event => { if (event.target === light) light.close(); });
  light.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      showPhoto(selected + direction, direction);
    }
  });
}
