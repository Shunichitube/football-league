// Explicit view classification; no DOM observation or text-based phase inference.
const classes = { draft: 'draft', auction: 'auction', squad: 'squad', development: 'development', focus: 'development', growth: 'growth', release: 'release', seasonResults: 'season-results', stats: 'stats', table: 'table', title: 'title' };
export function classifyScreens(view) {
  document.querySelectorAll('#app > main').forEach(main => main.classList.add('screen-'+(classes[view] || 'home')));
}
