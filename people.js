(() => {
  const records = Array.from(document.querySelectorAll('.directory-person'));
  const desk = document.querySelector('.portrait-desk');
  if (!desk || !records.length) return;

  const stage = desk.querySelector('.portrait-window');
  const caption = desk.querySelector('figcaption');
  const desktop = matchMedia('(min-width:681px)');
  const motion = matchMedia('(prefers-reduced-motion:no-preference)');
  let selected = records[0];
  let request = 0;
  let pendingScroll = false;
  selected.dataset.featured = '';

  async function display(record) {
    if (!desktop.matches || selected === record) return;
    delete selected.dataset.featured;
    selected = record;
    record.dataset.featured = '';
    const ticket = ++request;
    const image = new Image();
    image.alt = '';
    image.src = record.querySelector('.directory-mini').src;
    try {
      await image.decode();
    } catch { return; }
    if (ticket !== request) return;

    const previous = stage.lastElementChild;
    delete previous.dataset.transition;
    stage.replaceChildren(previous, image);
    image.dataset.transition = '';
    caption.querySelector('strong').textContent = record.querySelector('h3').textContent;
    caption.querySelector('span').textContent = record.dataset.role;
    if (motion.matches) {
      await image.animate([{opacity: 0}, {opacity: 1}], {
        duration: 240, easing: 'ease-out'
      }).finished;
    }
    if (request === ticket) {
      delete image.dataset.transition;
      stage.replaceChildren(image);
    }
  }

  function followScroll() {
    pendingScroll = false;
    if (!desktop.matches) return;
    const reference = innerHeight * .36;
    let active = records[0];
    for (const record of records) {
      if (record.getBoundingClientRect().top > reference) break;
      active = record;
    }
    display(active);
  }

  for (const record of records) {
    record.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse') display(record);
    });
    record.addEventListener('focusin', () => display(record));
  }
  addEventListener('scroll', () => {
    if (desktop.matches && !pendingScroll) {
      pendingScroll = true;
      requestAnimationFrame(followScroll);
    }
  }, {passive: true});
  desktop.addEventListener('change', followScroll);
  followScroll();
})();
