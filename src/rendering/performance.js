// Use sustained frame time, not individual loading/GC spikes, to adjust resolution.
export class RenderQuality {
    constructor(pixelRatio) {
        this.maxRatio = Math.min(pixelRatio || 1, 1.5);
        this.minRatio = Math.min(this.maxRatio, 0.75);
        this.ratio = this.maxRatio;
        this.reset();
    }

    reset() {
        this.elapsed = 0;
        this.frames = 0;
        this.fastWindows = 0;
    }

    sample(delta) {
        if (delta <= 0 || delta > 0.25) { this.reset(); return false; }
        this.elapsed += delta;
        this.frames++;
        if (this.elapsed < 2) return false;
        const average = this.elapsed / this.frames;
        this.elapsed = 0;
        this.frames = 0;
        const previous = this.ratio;
        if (average > 1 / 48) {
            this.ratio = Math.max(this.minRatio, this.ratio - 0.15);
            this.fastWindows = 0;
        } else if (average < 1 / 58) {
            if (++this.fastWindows >= 4) {
                this.ratio = Math.min(this.maxRatio, this.ratio + 0.15);
                this.fastWindows = 0;
            }
        } else this.fastWindows = 0;
        return Math.abs(previous - this.ratio) > 0.001;
    }
}
