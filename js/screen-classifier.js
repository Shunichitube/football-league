const app = document.querySelector('#app');
const SCREEN_CLASSES = [
  'screen-draft',
  'screen-auction',
  'screen-squad',
  'screen-development',
  'screen-growth',
  'screen-release',
  'screen-season-results',
  'screen-stats',
  'screen-table',
  'screen-home',
  'screen-title'
];

function textOf(selector, root) {
  return root.querySelector(selector)?.textContent?.trim() || '';
}

function classifyMain(main) {
  if (!main) return;
  main.classList.remove(...SCREEN_CLASSES);

  const eyebrow = textOf('.eyebrow', main);
  const heading = textOf('h1,h2', main);
  const hasLineup = Boolean(main.querySelector('.lineup-editor'));
  const hasCandidateGrid = Boolean(main.querySelector('.candidate-grid'));
  const hasDirectAuctionCandidate = Boolean(main.querySelector(':scope > article.candidate'));

  if (hasLineup || heading === '編成') main.classList.add('screen-squad');
  else if (eyebrow === '育成') main.classList.add('screen-development');
  else if (eyebrow.includes('成長結果')) main.classList.add('screen-growth');
  else if (heading.includes('放出フェイズ') || eyebrow.includes('選手整理')) main.classList.add('screen-release');
  else if (eyebrow.includes('ドラフト') || (hasCandidateGrid && heading.includes('指名'))) main.classList.add('screen-draft');
  else if (eyebrow.includes('競売') || hasDirectAuctionCandidate) main.classList.add('screen-auction');
  else if (eyebrow.includes('結果')) main.classList.add('screen-season-results');
  else if (heading.includes('個人成績')) main.classList.add('screen-stats');
  else if (heading.includes('順位表')) main.classList.add('screen-table');
  else if (main.classList.contains('title')) main.classList.add('screen-title');
  else main.classList.add('screen-home');
}

function classifyScreens() {
  document.querySelectorAll('#app > main').forEach(classifyMain);
}

const observer = new MutationObserver(classifyScreens);
if (app) observer.observe(app, { childList: true, subtree: true });
classifyScreens();
