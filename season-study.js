(() => {
  const section = document.querySelector('#boseong-seasons');
  const controls = section.querySelector('.season-switch');
  const panels = section.querySelectorAll('[data-fit]');
  const buttons = controls.querySelectorAll('button');
  function select(season) {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.season === season));
    for (const panel of panels) panel.hidden = panel.dataset.fit !== season;
  }
  for (const button of buttons) button.addEventListener('click', () => select(button.dataset.season));
  select(controls.querySelector('[aria-pressed="true"]').dataset.season);
  controls.hidden = false;
})();
