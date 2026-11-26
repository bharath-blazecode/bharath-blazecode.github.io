document.documentElement.classList.add('js');
try { if (localStorage.getItem('bs-shift') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (_) {}
