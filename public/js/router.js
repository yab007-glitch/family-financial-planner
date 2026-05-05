/* Minimal router — all views are inline in index.html */
window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'dashboard';
  if (window.__appState) window.__appState.currentPage = page;
});
