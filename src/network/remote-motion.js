import * as THREE from '../../vendor/three.module.js';

// Render a short distance behind the host clock, rather than extrapolating
// velocity from packet arrival intervals (which include network jitter).
export class RemoteMotion {
    constructor(delay = 80) { this.delay = delay; this.samples = []; this.offset = Infinity; }
    reset() { this.samples.length = 0; this.offset = Infinity; }
    push(position, yaw, time, received = performance.now()) {
        if (!Number.isFinite(time)) return;
        const last = this.samples.at(-1);
        if (last && time <= last.time) return;
        if (last && last.position.distanceToSquared(position) > 144) this.samples.length = 0;
        this.offset = Math.min(this.offset, received - time);
        this.samples.push({position: position.clone(), yaw, time});
        if (this.samples.length > 32) this.samples.shift();
    }
    sample(out, now = performance.now()) {
        if (!this.samples.length) return null;
        const time = now - this.offset - this.delay;
        while (this.samples.length > 2 && this.samples[1].time <= time) this.samples.shift();
        const a = this.samples[0], b = this.samples[1] || a;
        const blend = b.time === a.time ? 0 : THREE.MathUtils.clamp((time - a.time) / (b.time - a.time), 0, 1);
        out.copy(a.position).lerp(b.position, blend);
        const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
        return a.yaw + turn * blend;
    }
}
