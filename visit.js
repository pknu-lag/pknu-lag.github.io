(() => {
  const button = document.querySelector('.copy-address');
  const status = document.querySelector('.copy-status');
  if (!navigator.clipboard?.writeText) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const address = document.querySelector('.visit-address address').innerText;
    try {
      await navigator.clipboard.writeText('Chungmu Hall B13\n' + address);
      status.textContent = 'Address copied';
    } catch {
      status.textContent = 'Select the address above to copy it.';
    }
  });
})();
