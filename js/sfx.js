const AUDIO_KEY = 'football-league:audio-settings';
export const SFX_FILES = {
  button: new URL('../assets/audio/音源/決定16.mp3', import.meta.url).href,
  lineup: new URL('../assets/audio/音源/選択3.mp3', import.meta.url).href,
  training: new URL('../assets/audio/音源/パワーアップ１.mp3', import.meta.url).href
};
export function createSfxController({createAudio = src => new Audio(src), storage = globalThis.localStorage, doc = globalThis.document, now = () => Date.now()} = {}) {
  const sounds = new Map();
  let volume = .7, dragging = false, suppressUntil = 0;
  try {
    const settings = JSON.parse(storage?.getItem(AUDIO_KEY) || '{}');
    if (Number.isFinite(Number(settings.se))) volume = Math.max(0, Math.min(100, Number(settings.se))) / 100;
  } catch { /* Use default volume if settings are unavailable. */ }
  function play(kind) {
    if (!volume || !SFX_FILES[kind]) return;
    let sound = sounds.get(kind);
    if (!sound) { sound = createAudio(SFX_FILES[kind]); sound.preload = 'none'; sounds.set(kind, sound); }
    for (const other of sounds.values()) if (other !== sound) other.pause();
    sound.volume = volume; sound.currentTime = 0;
    Promise.resolve(sound.play()).catch(error => {
      if (error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') console.warn('Sound effect could not play:', error);
    });
  }
  function click(event) {
    const button = event.target?.closest?.('button,[role="button"],a[data-nav]');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    if (dragging || (now() < suppressUntil && event.target?.closest?.('[data-lineup-drag]'))) return;
    play('button');
  }
  function beginLineupDrag() { dragging = true; play('lineup'); }
  function trainingCompleted() { play('training'); }
  function endLineupDrag() {
    if (dragging) suppressUntil = now() + 250;
    dragging = false;
  }
  function settings(event) {
    const value = Number(event.detail?.se);
    if (!Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(100, value)) / 100;
    for (const sound of sounds.values()) {
      sound.volume = volume;
      if (!volume) sound.pause();
    }
  }
  // Capture covers settings and other dialogs whose buttons stop bubbling.
  doc?.addEventListener('click', click, true);
  doc?.addEventListener('dragend', endLineupDrag, true);
  doc?.addEventListener('football-league:audio-settings', settings);
  doc?.addEventListener('football-league:training-completed', trainingCompleted);
  return {
    play, beginLineupDrag, endLineupDrag,
    dispose() {
      for (const sound of sounds.values()) sound.pause();
      doc?.removeEventListener('click', click, true);
      doc?.removeEventListener('dragend', endLineupDrag, true);
      doc?.removeEventListener('football-league:audio-settings', settings);
      doc?.removeEventListener('football-league:training-completed', trainingCompleted);
    }
  };
}
