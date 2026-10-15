import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
const THREE = await import('three');
const { protectSpawn, registerDuelAttack, isRevealedOnRadar, duelMovement } = await import('../../src/gameplay/combat/duel-rules.js');
const { WeaponSystem } = await import('../../src/gameplay/combat/weapons.js');
const { FPSMatchManager } = await import('../../src/gameplay/combat/fps-match.js');
const { TDMManager } = await import('../../src/gameplay/combat/tdm.js');

test('respawns protect for five seconds in both duel modes, preserving team rules', () => {
    for (const Manager of [FPSMatchManager, TDMManager]) {
        const manager = new Manager({ player: {}, ui: {} });
        manager.is1v1 = true;
        const entity = { team: 'red', position: new THREE.Vector3(), maxHealth: 100, isDead: true, radarRevealTimer: 1, isSprinting: true };
        manager.respawnEntity(entity);
        assert.equal(entity.invulnerability, 5);
        assert.equal(entity.spawnProtected, true);
        assert.equal(entity.health, 100);
        assert.equal(entity.isDead, false);
        assert.equal(isRevealedOnRadar(entity), false);
    }
});

test('accepted gun, knife and bomb attacks cancel protection; rejected shots do not', () => {
    globalThis.window = { game: { gameMode: 'FPS_SOLO' } };
    try {
        const weapons = new WeaponSystem(new THREE.Scene(), null, {});
        weapons.resetRun('repeater');
        const entity = {}, origin = new THREE.Vector3(0, 1, 0), target = new THREE.Vector3(0, 1, 10);
        protectSpawn(entity);
        weapons.fireCooldown = 1;
        assert.equal(weapons.shoot(origin, target, false, true, 1, entity), false);
        assert.equal(entity.invulnerability, 5);
        weapons.fireCooldown = 0;
        assert.equal(weapons.shoot(origin, target, false, true, 1, entity), true);
        assert.equal(entity.invulnerability, 0);
        assert.equal(entity.radarRevealTimer, 1.5);
        protectSpawn(entity);
        weapons.switchWeapon(4, entity); weapons.fireCooldown = 0;
        assert.equal(weapons.shoot(origin, target, false, true, 1, entity), true);
        assert.equal(entity.invulnerability, 0);
        assert.equal(entity.radarRevealTimer, 0);
        protectSpawn(entity);
        weapons.getCurrentWeapon = () => ({ isBomb: true, count: 2, id: 'frag' });
        let sent = false;
        weapons.onCommand = () => { sent = true; };
        assert.equal(weapons.throwBomb(origin, target, entity), true);
        assert.equal(sent, true);
        assert.equal(entity.invulnerability, 0);
        assert.equal(entity.radarRevealTimer, 0);
    } finally { delete globalThis.window; }
});

test('walking/crouching stay hidden unless recently firing; sprinting reveals only living players', () => {
    const entity = { moving: true };
    assert.equal(isRevealedOnRadar(entity), false);
    entity.isSprinting = true;
    assert.equal(isRevealedOnRadar(entity), true);
    entity.isCrouching = true;
    assert.equal(isRevealedOnRadar(entity), false);
    entity.radarRevealTimer = 0.001;
    assert.equal(isRevealedOnRadar(entity), true);
    entity.radarRevealTimer = 0;
    assert.equal(isRevealedOnRadar(entity), false);
    entity.isDead = true; entity.radarRevealTimer = 1.5;
    assert.equal(isRevealedOnRadar(entity), false);
    assert.equal(duelMovement({ ShiftLeft: true }, false).sprinting, false);
    assert.equal(duelMovement({ ShiftLeft: true }, true, true).sprinting, false);
    assert.equal(duelMovement({ ShiftLeft: true, ControlLeft: true }, true).sprinting, false);
    assert.equal(duelMovement({ ShiftLeft: true }, true).multiplier, 1.5);
});

test('attacking does not cancel unrelated survival invulnerability', () => {
    const entity = { invulnerability: 3, spawnProtected: false };
    registerDuelAttack(entity, 'gun', { gameMode: 'SURVIVAL' });
    assert.equal(entity.invulnerability, 3);
    assert.equal(entity.radarRevealTimer, undefined);
});
