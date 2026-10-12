// Toi uu hoa Dynamic Resolution Scaling (DRS) dua tren thoi gian khung hinh thuc te
// Ngan chan tran tai GPU tren man hinh 4K / Retina dong thoi duy tri 60 FPS muot ma
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

    configure(pixelRatio, width, height, mode = 'optimized') {
        // Gioi han ngan sach pixel tren man hinh do phan giai cao (1440p / 4K)
        const optimized = mode === 'optimized';
        const pixelBudget = optimized ? 1920 * 1080 : 2560 * 1440;
        const screenLimit = Math.sqrt(pixelBudget / Math.max(1, width * height));
        this.maxRatio = Math.min(pixelRatio || 1, optimized ? 1 : 1.5, screenLimit);
        this.minRatio = Math.min(this.maxRatio, optimized ? 0.5 : 0.75);
        this.ratio = Math.max(this.minRatio, Math.min(this.ratio, this.maxRatio));
        this.reset();
    }

    /**
     * Do dac thoi gian khung hinh va tu dong dieu tiet Dynamic Resolution Scaling
     * @param {number} delta - Frame delta time in seconds
     * @returns {boolean} true neu ti le pixelRatio vua thay doi va can cap nhat WebGLRenderer
     */
    sample(delta) {
        // Bo qua frame spike do load resource hoac chuyen tab
        if (delta <= 0 || delta > 0.25) {
            this.reset();
            return false;
        }

        this.elapsed += delta;
        this.frames++;

        // Lay mau trong chu ky 2 giay de loai tru nhieu dao dong tuc thoi
        if (this.elapsed < 2) return false;

        const average = this.elapsed / this.frames;
        this.elapsed = 0;
        this.frames = 0;
        const previous = this.ratio;

        if (average > 1 / 48) { // Frame drop duoi 48 FPS: ha nhe pixel ratio de lay lai 60 FPS
            this.ratio = Math.max(this.minRatio, this.ratio - 0.15);
            this.fastWindows = 0;
        } else if (average < 1 / 58) { // Dat nguong tren 58 FPS: phuc hoi chat luong hinh anh dan dan
            if (++this.fastWindows >= 4) {
                this.ratio = Math.min(this.maxRatio, this.ratio + 0.15);
                this.fastWindows = 0;
            }
        } else {
            this.fastWindows = 0;
        }

        return Math.abs(previous - this.ratio) > 0.001;
    }
}
