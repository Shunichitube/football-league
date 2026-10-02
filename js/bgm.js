const AUDIO_KEY = 'football-league:audio-settings';
export const BGM_FILES = {
  home: new URL('../assets/audio/ホーム画面とゲーム最終結果の画面BGM.mp3', import.meta.url).href,
  preparation: new URL('../assets/audio/選手育成中.mp3', import.meta.url).href,
  result: new URL('../assets/audio/優勝決定！.mp3', import.meta.url).href
};
export function bgmTrack(view, simulating = false) {
  if (simulating) return null;
  if (['title','setup','loadTitle','roomEntry','roomLobby','grandFinal','history'].includes(view)) return 'home';
  if (['draft','auction','squad','home','offseasonEvents','development','focus','growth','release','stats','table'].includes(view)) return 'preparation';
  if (['seasonResults','matchDetail'].includes(view)) return 'result';
  return null;
}
export function createBgmController({createAudio = src => new Audio(src), storage = globalThis.localStorage, doc = globalThis.document} = {}) {
  const tracks = new Map();
  let active = null, wanted = null, view = 'title', simulating = false, volume = .7, generation = 0, pending = null;
  try {
    const value = JSON.parse(storage?.getItem(AUDIO_KEY) || '{}');
    if (Number.isFinite(Number(value.bgm))) volume = Math.max(0, Math.min(100, Number(value.bgm))) / 100;
  } catch { /* Use default volume if settings are unavailable. */ }
  function pause() {
    generation++; pending = null;
    if (active) { active.pause(); active.currentTime = 0; active = null; }
  }
  function play() {
    if (!wanted || !volume) return;
    let audio = tracks.get(wanted);
    if (!audio) {
      audio = createAudio(BGM_FILES[wanted]); audio.loop = true; audio.preload = 'none';
      tracks.set(wanted, audio);
    }
    audio.volume = volume; active = audio;
    if (!audio.paused || pending === audio) return;
    const ticket = generation; pending = audio;
    Promise.resolve(audio.play()).then(() => {
      if (audio !== active || !volume) audio.pause();
      if (ticket === generation && pending === audio) pending = null;
    }).catch(error => {
      if (ticket === generation && pending === audio) pending = null;
      // Browser autoplay denial is retried on the next user gesture.
      if (error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') console.warn('BGM could not play:', error);
    });
  }
  function sync(state) {
    view = state.view; simulating = !!state.simulating;
    const next = bgmTrack(view, simulating);
    if (next !== wanted) { pause(); wanted = next; }
    if (!doc?.hidden) play();
  }
  function gesture() { if (!doc?.hidden) play(); }
  function settings(event) {
    const value = Number(event.detail?.bgm);
    if (!Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(100, value)) / 100;
    if (active) active.volume = volume;
    if (!volume) pause(); else gesture();
  }
  function visibility() {
    if (doc.hidden) pause(); else sync({view, simulating});
  }
  doc?.addEventListener('pointerdown', gesture);
  doc?.addEventListener('keydown', gesture);
  doc?.addEventListener('football-league:audio-settings', settings);
  doc?.addEventListener('visibilitychange', visibility);
  return {
    sync,
    dispose() {
      pause(); wanted = null;
      doc?.removeEventListener('pointerdown', gesture);
      doc?.removeEventListener('keydown', gesture);
      doc?.removeEventListener('football-league:audio-settings', settings);
      doc?.removeEventListener('visibilitychange', visibility);
    }
  };
}
