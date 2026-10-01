// A single timer owned by the auction screen, even when that screen is rerendered.
export function createAuctionClock(update, timers = globalThis) {
  let timer = null;
  return {
    sync(active) {
      if (active && timer === null) timer = timers.setInterval(update, 200);
      if (!active && timer !== null) {
        timers.clearInterval(timer);
        timer = null;
      }
    },
    dispose() { this.sync(false); }
  };
}
