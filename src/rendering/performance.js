export class RenderQuality {
    constructor(pixelRatio) {
        const dpr = pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
        this.maxRatio = Math.max(1.0, Math.min(dpr, 2.0));
        this.minRatio = 1.0; // Tuyệt đối không hạ dưới 1.0 để hình ảnh luôn sắc nét
        this.ratio = this.maxRatio;
        this.reset();
    }

    reset() {
        this.elapsed = 0;
        this.frames = 0;
        this.fastWindows = 0;
    }

    configure(pixelRatio, width, height, mode = 'optimized') {
        const dpr = pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
        this.maxRatio = Math.max(1.0, Math.min(dpr, 2.0));
        this.minRatio = 1.0;
        this.ratio = this.maxRatio;
        this.reset();
    }

    sample(delta) {
        return false;
    }
}
