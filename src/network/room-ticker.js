// A worker keeps room updates independent of requestAnimationFrame (hidden tabs
// stop receiving animation frames). OS/browser suspension can still stop a page.
export function createRoomTicker(tick) {
    let worker;
    let timer;
    let previous = performance.now();
    const update = () => {
        const now = performance.now();
        const delta = Math.min(0.25, Math.max(0, (now - previous) / 1000));
        previous = now;
        tick(delta);
    };
    const fallback = () => {
        worker?.terminate();
        worker = null;
        timer ??= setInterval(update, 33);
    };
    try {
        worker = new Worker(new URL('./room-ticker-worker.js', import.meta.url));
        worker.onmessage = update;
        worker.onerror = fallback;
    } catch { fallback(); }
    return () => { worker?.terminate(); clearInterval(timer); };
}
