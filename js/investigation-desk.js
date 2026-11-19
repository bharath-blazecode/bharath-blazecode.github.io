/* The desk is an enhancement; the field-map links and illustration work on their own. */
(() => {
  'use strict';
  const desk = document.querySelector('[data-investigation-desk]');
  if (!desk) return;
  const canvas = desk.querySelector('[data-desk-canvas]');
  const links = [...desk.querySelectorAll('[data-desk-link]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!canvas || !links.length) return;

  const research = desk.querySelector('[data-desk-link="research"]');
  if (research) research.addEventListener('click', () => {
    const role = document.querySelector('[data-experience-target="experience-research"]');
    if (role && role.getAttribute('aria-expanded') === 'false') role.click();
  });

  let scene = null;
  let loading = false;
  let inView = false;
  let failed = false;
  function sync() {
    if (scene) scene.setVisible(inView && !document.hidden);
  }
  async function load() {
    if (scene || loading || failed || !inView || document.hidden) return;
    loading = true;
    try {
      const { createDeskScene } = await import('../assets/desk/desk-scene.js');
      scene = createDeskScene(canvas, {
        reducedMotion: reduced.matches,
        onReady() { desk.classList.add('has-3d'); },
        onFailure() {
          desk.classList.remove('has-3d');
          failed = true;
          if (scene) { scene.dispose(); scene = null; }
        },
        onHover(key) { links.forEach(link => link.classList.toggle('is-desk-hovered', link.dataset.deskLink === key)); },
        onSelect(key) {
          const link = links.find(item => item.dataset.deskLink === key);
          if (link) link.click();
        }
      });
      sync();
    } catch (_) {
      // The static illustration and regular links are the complete fallback.
      failed = true;
      desk.classList.remove('has-3d');
    } finally {
      loading = false;
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      if (inView) load();
      sync();
    }, { threshold: [0, .1] });
    observer.observe(desk);
  } else {
    inView = true;
    load();
  }
  reduced.addEventListener('change', () => { if (scene) scene.setReduced(reduced.matches); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); sync(); });
  window.addEventListener('pagehide', () => { if (scene) scene.setVisible(false); });
  window.addEventListener('pageshow', sync);
})();
