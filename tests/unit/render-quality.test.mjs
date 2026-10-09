import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
const THREE = await import('three');
const { RenderQuality } = await import('../../src/rendering/performance.js');
const { Arena } = await import('../../src/world/arena.js');
const { ParticleSystem } = await import('../../src/rendering/particles.js');
const { VisionConeOverlay } = await import('../../src/gameplay/combat/vision-cone.js');

test('optimized resolution bounds 4K/DPR work and recovers after resize and preset changes', () => {
    const quality = new RenderQuality(2);
    quality.configure(2, 3840, 2160, 'optimized');
    assert.equal(quality.ratio, 0.5);
    for (let i = 0; i < 3000; i++) quality.sample(1 / 60);
    assert.equal(quality.ratio, 0.5);
    quality.configure(2, 1280, 720, 'optimized');
    for (let i = 0; i < 3000; i++) quality.sample(1 / 60);
    assert.equal(quality.ratio, 1);
    for (let i = 0; i < 600; i++) quality.sample(1 / 30);
    assert.equal(quality.ratio, 0.5);
    quality.configure(2, 1280, 720, 'full');
    assert.equal(quality.ratio, 0.75);
    for (let i = 0; i < 3000; i++) quality.sample(1 / 60);
    assert.equal(quality.ratio, 1.5);
    quality.configure(0.4, 1280, 720, 'optimized');
    assert.equal(quality.ratio, 0.4);
});

test('presets omit decorative lights from rendering and restore them without reallocating', () => {
    const scene = new THREE.Scene();
    const arena = new Arena(scene);
    arena.setupLighting();
    const originalLights = [...arena.tacticalLights];
    const originalCount = scene.children.length;
    arena.setQuality({ mode: 'optimized', shadows: false });
    assert.equal(arena.tacticalLights.filter(light => light.visible).length, 0);
    assert.equal(arena.sunLight.castShadow, false);
    arena.setQuality({ mode: 'full', shadows: true });
    assert.equal(arena.tacticalLights.filter(light => light.visible).length, 5);
    assert.equal(arena.sunLight.castShadow, true);
    assert.equal(scene.children.length, originalCount);
    assert.deepEqual(arena.tacticalLights, originalLights);
    const particles = new ParticleSystem(scene);
    particles.setQuality({ effectLight: false });
    assert.equal(particles.effectLight.visible, false);
    particles.setQuality({ effectLight: true });
    assert.equal(particles.effectLight.visible, true);
    particles.clear();
});

test('inactive vision overlay clears only once after TDM content', () => {
    let clears = 0;
    const overlay = Object.create(VisionConeOverlay.prototype);
    overlay.canvas = { width: 960, height: 540 };
    overlay.ctx = { clearRect: () => clears++ };
    overlay._hasContent = true;
    for (let i = 0; i < 120; i++) overlay.clear();
    assert.equal(clears, 1);
    overlay._hasContent = true;
    overlay.clear();
    assert.equal(clears, 2);
});
