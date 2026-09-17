/* Restore only a local display preference. No network or tracking. */
try {
  var savedTheme = localStorage.getItem('bs-shift');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
} catch (_) { /* Operating-system preference remains the fallback. */ }
