(() => {
  const sheet = document.querySelector('.upload-sheet');
  if (!sheet) return;
  const controls = sheet.querySelector('.upload-controls');
  const buttons = [...controls.querySelectorAll('[data-upload-choice]')];
  const panels = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));
  const status = document.getElementById('upload-status');
  // If the enhancement cannot initialize fully, keep the complete static reading path.
  if (panels.some(panel => !panel) || !status || !('inert' in HTMLElement.prototype)) return;
  const messages = {
    before: 'Before: the filename also chose the storage name. The whole file was read before the size check.',
    change: 'The change: the server chooses the storage name and reads at most the limit plus one byte.',
    evidence: 'What backs it: four published test cases, with links to their source. No tests are run by this page.'
  };
  function select(button, announce = true) {
    buttons.forEach((candidate, index) => {
      const active = candidate === button;
      candidate.setAttribute('aria-pressed', String(active));
      panels[index].setAttribute('aria-hidden', String(!active));
      panels[index].inert = !active;
    });
    if (announce) status.textContent = messages[button.dataset.uploadChoice];
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button)));
  select(buttons[0], false);
  sheet.classList.add('is-enhanced');
  controls.hidden = false;
})();
