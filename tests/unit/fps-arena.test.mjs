import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
const THREE = await import('three');
const { FPSArena } = await import('../../src/world/fps-arena.js');
const { FPSBot } = await import('../../src/gameplay/combat/fps-match.js');
function fixture() {
    const arena = new FPSArena(new THREE.Scene(), null);
    arena.buildArena();
    return arena;
}

test('both teams can reach all three lanes and every patrol landmark with body clearance', () => {
    const arena = fixture();
    for (const z of [-23, 23]) for (const x of [-6, -2, 2, 6]) {
        const spawn = new THREE.Vector3(x, 0, z);
        assert.equal(arena.checkCollision(spawn, 0.5), false);
        for (const destination of arena.patrolPoints) {
            assert.equal(arena.checkCollision(destination, 0.5), false);
            const path = arena.findNavigationPath(spawn, destination, 0.5);
            assert.ok(path.length, `${spawn.toArray()} -> ${destination.toArray()}`);
            let previous = spawn;
            for (const point of path) {
                assert.ok(arena.navigationClear(previous, point, 0.5), 'route must clear walls');
                previous = point;
            }
            assert.ok(previous.distanceTo(destination) < 0.01);
        }
    }
});

test('gate openings and cross-map connectors are traversable, walls stop movement and shots', () => {
    const arena = fixture();
    for (const z of [-20, 20]) {
        const pos = new THREE.Vector3(0, 0, z - 2);
        arena.moveCharacter(pos, 0, 4, 0.5);
        assert.ok(Math.abs(pos.z - (z + 2)) < 0.01, 'gate has no invisible full-width collider');
    }
    for (const z of [-17, 17]) assert.ok(arena.navigationClear(
        new THREE.Vector3(-19, 0, z), new THREE.Vector3(19, 0, z), 0.5));
    assert.equal(arena.hasLineOfSight(new THREE.Vector3(-15, 0, 10), new THREE.Vector3(0, 0, 10)), false);
    const pos = new THREE.Vector3(-15, 0, 10);
    arena.moveCharacter(pos, 8, 0, 0.5);
    assert.ok(pos.x <= -13);
    arena.moveCharacter(new THREE.Vector3(0, 0, 0), 1, 0, 0.5);
});

test('returning to FPS rebuilds once without retaining scene objects or generated GPU resources', () => {
    const arena = fixture();
    const count = arena.sceneObjects.length, colliders = arena.colliders.length;
    let disposed = 0;
    for (const resource of arena.ownedResources) resource.addEventListener('dispose', () => disposed++);
    const resourceCount = arena.ownedResources.size;
    arena.buildArena();
    assert.equal(arena.sceneObjects.length, count);
    arena.clearScene();
    assert.equal(arena.scene.children.length, 0);
    assert.equal(disposed, resourceCount);
    arena.buildArena();
    assert.equal(arena.sceneObjects.length, count);
    assert.equal(arena.colliders.length, colliders);
});

test('a patrolling FPS bot actually walks around spawn screens and pavilions', () => {
    const arena = fixture();
    for (const [x, z] of [[-19, 0], [19, 17], [3.5, 0]]) {
        const bot = Object.create(FPSBot.prototype);
        bot.game = { arena };
        bot.remote = { position: new THREE.Vector3(-6, 0, -23), invulnerability: 0 };
        bot.patrolTarget = new THREE.Vector3(x, 0, z);
        bot.shootCooldown = 0;
        let reached = false;
        bot.pickNewPatrolTarget = () => { reached = true; };
        for (let i = 0; i < 1800 && !reached; i++) {
            bot.update(1 / 60, []);
            assert.equal(arena.checkCollision(bot.remote.position, 0.44), false);
        }
        assert.ok(reached, `bot stalled before ${x},${z}: ${bot.remote.position.toArray()}`);
    }
});
