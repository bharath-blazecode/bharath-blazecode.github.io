// Turns the stacked samples into one view with an ARIA tab selector.
(() => {
  const root = document.querySelector('[data-explainer]');
  const slot = root && root.querySelector('[data-tabs-slot]');
  const panels = root ? Array.from(root.querySelectorAll('[data-panel]')) : [];
  if (!slot || panels.length < 2) return;

  const prompt = document.createElement('p');
  prompt.className = 'label ex-pick-label';
  prompt.id = 'ex-pick-label';
  prompt.textContent = 'Pick a sample piece of evidence';

  const list = document.createElement('div');
  list.className = 'ex-tabs';
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-labelledby', prompt.id);

  const tabs = panels.map((panel, index) => {
    const tab = document.createElement('button');
    const number = document.createElement('span');
    const name = document.createElement('span');
    tab.type = 'button';
    tab.id = 'ex-tab-' + (index + 1);
    tab.className = 'ex-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    number.className = 'ex-tab-no';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = '0' + (index + 1);
    name.textContent = panel.dataset.tab;
    tab.append(number, name);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    list.appendChild(tab);
    return tab;
  });

  function select(index, moveFocus, animate) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
      panels[i].tabIndex = on ? 0 : -1;
      panels[i].classList.remove('is-entering');
    });
    if (animate) {
      void panels[index].offsetWidth;
      panels[index].classList.add('is-entering');
    }
    if (moveFocus) tabs[index].focus();
  }

  list.addEventListener('click', event => {
    const tab = event.target.closest('[role=tab]');
    if (tab) select(tabs.indexOf(tab), false, true);
  });

  list.addEventListener('keydown', event => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowDown: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      ArrowUp: current === 0 ? last : current - 1,
      Home: 0,
      End: last
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true, true);
  });

  panels.forEach(panel => panel.addEventListener('animationend', () => panel.classList.remove('is-entering')));
  slot.append(prompt, list);
  root.classList.add('is-on');
  select(0, false, false);
})();
