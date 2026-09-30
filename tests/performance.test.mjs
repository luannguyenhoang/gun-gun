import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../libs/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
const THREE = await import('three');
const { ParticleSystem } = await import('../src/particles.js');
const { RenderQuality } = await import('../src/performance.js');
const { WaveManager, Zombie } = await import('../src/enemies.js');
const { Arena } = await import('../src/arena.js');

test('sustained fire reuses bounded sparks and keeps shared geometry and light count stable', () => {
    const scene = new THREE.Scene(), fx = new ParticleSystem(scene);
    const origin = new THREE.Vector3(), direction = new THREE.Vector3(0, 1, 0);
    let disposed = 0;
    fx.sparkGeo.addEventListener('dispose', () => disposed++);
    fx.debrisGeo.addEventListener('dispose', () => disposed++);
    const meshes = new Set();
    for (let frame = 0; frame < 600; frame++) {
        fx.createImpactSparks(origin, direction, 0xffaa00, 30);
        fx.createMuzzleFlash(origin, direction);
        if (frame % 30 === 0) fx.createExplosion(origin);
        fx.particles.forEach(p => meshes.add(p.mesh));
        fx.update(1 / 60);
        assert.ok(fx.particles.length <= fx.maxSparks);
        assert.ok(fx.debris.length <= fx.maxDebris);
        assert.equal(scene.children.filter(c => c.isLight).length, 1);
    }
    fx.clear();
    assert.equal(disposed, 0);
    assert.ok(meshes.size <= fx.maxSparks);
    assert.equal(fx.sparkPool.length, meshes.size);
    assert.equal(scene.children.length, 1);
    assert.equal(fx.effectLight.intensity, 0);
});

test('quality ignores stalls, lowers under sustained load, and restores slowly within bounds', () => {
    const quality = new RenderQuality(2);
    quality.sample(2);
    assert.equal(quality.ratio, 1.5);
    for (let i = 0; i < 600; i++) quality.sample(1 / 30);
    assert.equal(quality.ratio, 0.75);
    for (let i = 0; i < 120; i++) quality.sample(1 / 60);
    assert.equal(quality.ratio, 0.75);
    for (let i = 0; i < 3000; i++) quality.sample(1 / 60);
    assert.equal(quality.ratio, 1.5);
    assert.equal(new RenderQuality(0.5).minRatio, 0.5);
});

test('horde navigation spreads searches across frames while all enemies keep moving', () => {
    const scene = new THREE.Scene(), arena = new Arena(scene);
    const manager = new WaveManager(scene, null, null, { createImpactSparks() {} }, arena);
    manager.models = { 'character-zombie': { scene: new THREE.Group(), animations: [] } };
    for (let i = 0; i < 20; i++) manager.enemies.push(new Zombie(scene, 'walker', new THREE.Vector3(i * 3, 0, -15), manager.models, manager.particles));
    let calls = 0;
    const find = arena.findNavigationPath.bind(arena);
    arena.findNavigationPath = (...args) => { calls++; return find(...args); };
    const player = { position: new THREE.Vector3(0, 0, 20), isDead: false, takeDamage() {} };
    for (let frame = 0; frame < 12; frame++) {
        calls = 0;
        manager.update(1 / 60, player, arena);
        assert.ok(calls <= 2);
    }
    assert.ok(manager.enemies.every(e => e.navigationPath && e.position.z > -15));
    manager.clear();
});
