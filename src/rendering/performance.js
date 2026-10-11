export class RenderQuality {
    constructor(pixelRatio) {
        const dpr = pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
        this.maxRatio = 1.0; // Giới hạn 1.0 để triệt tiêu tải nặng trên màn hình High DPI/Retina
        this.minRatio = 0.85; // Ngưỡng hạ tối đa khi giật lag để giữ hình ảnh sắc nét
        this.ratio = 1.0;
        this.mode = 'optimized';
        this.reset();
    }

    reset() {
        this.elapsed = 0;
        this.frames = 0;
        this.slowWindows = 0;
        this.fastWindows = 0;
    }

    configure(pixelRatio, width, height, mode = 'optimized') {
        this.mode = mode;
        const dpr = pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
        // Ở chế độ optimized: luôn khóa maxRatio = 1.0 để đảm bảo 60 FPS mượt mà
        this.maxRatio = mode === 'optimized' ? 1.0 : Math.min(dpr, 1.5);
        this.minRatio = 0.85;
        this.ratio = Math.min(this.ratio, this.maxRatio);
        this.reset();
    }

    /**
     * Đo đạc thời gian khung hình và tự động điều tiết Dynamic Resolution Scaling
     * @param {number} delta - Frame delta time in seconds
     * @returns {boolean} true nếu pixelRatio vừa thay đổi và cần cập nhật WebGLRenderer
     */
    sample(delta) {
        this.elapsed += delta;
        this.frames++;

        // Đo đạc chu kỳ 0.5 giây (khoảng 30 khung hình)
        if (this.elapsed < 0.5) return false;

        const avgDelta = this.elapsed / Math.max(1, this.frames);
        const prevRatio = this.ratio;

        if (avgDelta > 0.022) { // Khung hình dưới 45 FPS -> Cần hạ nhẹ độ phân giải
            this.slowWindows++;
            this.fastWindows = 0;
            if (this.slowWindows >= 2 && this.ratio > this.minRatio) {
                this.ratio = Math.max(this.minRatio, Math.round((this.ratio - 0.1) * 100) / 100);
                this.slowWindows = 0;
            }
        } else if (avgDelta < 0.017) { // Khung hình đạt chuẩn 60 FPS -> Phục hồi dần
            this.fastWindows++;
            this.slowWindows = 0;
            if (this.fastWindows >= 4 && this.ratio < this.maxRatio) {
                this.ratio = Math.min(this.maxRatio, Math.round((this.ratio + 0.05) * 100) / 100);
                this.fastWindows = 0;
            }
        } else {
            this.slowWindows = 0;
            this.fastWindows = 0;
        }

        this.elapsed = 0;
        this.frames = 0;

        return prevRatio !== this.ratio;
    }
}
