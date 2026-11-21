(() => {
  const section = document.querySelector('#boseong-seasons');
  const buttons = section.querySelectorAll('[data-season]');
  const reading = section.querySelector('.fit-reading');
  function select(button) {
    const season = button.dataset.season;
    for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
    for (const line of section.querySelectorAll('[data-fit]')) {
      line.classList.toggle('fit-selected', line.dataset.fit === season);
    }
    reading.querySelector('strong').textContent = season + ' · r = ' + button.dataset.r;
    reading.querySelector('span').textContent = button.dataset.note;
  }
  for (const button of buttons) button.addEventListener('click', () => select(button));
  section.classList.add('fit-ready');
  select(section.querySelector('[aria-pressed="true"]'));
})();
