import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
const THREE = await import('three');
const { PlayerController } = await import('../../src/gameplay/player/player.js');
const { applyVisibilityCulling } = await import('../../src/gameplay/combat/vision-cone.js');

function playerFixture() {
    const pending = [], scene = new THREE.Scene();
    const player = Object.assign(Object.create(PlayerController.prototype), {
        characterId: 'police', position: new THREE.Vector3(),
        weapons: { attachToArm() {} }, playAnimation() {}, applyCharacterStats() {}
    });
    const loader = { load(url, done, _progress, fail) { pending.push({ url, done, fail }); } };
    const model = name => ({ scene: Object.assign(new THREE.Group(), { name }), animations: [] });
    return { player, loader, scene, pending, model };
}

test('overlapping character loads cannot leave a motionless model or orphan health bar in the scene', async () => {
    const { player, loader, scene, pending, model } = playerFixture();
    const first = player.loadModel(loader, scene, 'police');
    const latest = player.loadModel(loader, scene, 'medic');
    const wanted = model('latest');
    pending[1].done(wanted);
    await latest;
    const stale = model('old');
    pending[0].done(stale);
    await first;
    assert.equal(player.model, wanted.scene);
    assert.equal(stale.scene.parent, null);
    assert.equal(scene.children.length, 2, 'one avatar and one health bar');
    const oldHealth = player.healthBar.group;
    const change = player.loadModel(loader, scene, 'assassin');
    assert.equal(wanted.scene.parent, scene, 'keep the current avatar until replacement is ready');
    pending[2].done(model('replacement'));
    await change;
    assert.equal(wanted.scene.parent, null);
    assert.equal(oldHealth.parent, null);
    assert.equal(scene.children.length, 2);
});

test('repeated selection and room creation reuse a pending or loaded character', async () => {
    const { player, loader, scene, pending, model } = playerFixture();
    const loading = player.loadModel(loader, scene, 'police');
    const same = player.setCharacter('police');
    assert.equal(pending.length, 1);
    pending[0].done(model('police'));
    await Promise.all([loading, same]);
    await player.setCharacter('police');
    assert.equal(pending.length, 1);
    assert.equal(scene.children.length, 2);
});

test('failed avatar load can be retried without removing the current model', async () => {
    const { player, loader, scene, pending, model } = playerFixture();
    const initial = player.loadModel(loader, scene, 'police');
    pending[0].done(model('initial')); await initial;
    const original = player.model;
    const failed = player.setCharacter('medic'); pending[1].fail(); await failed;
    assert.equal(original.parent, scene);
    const retry = player.setCharacter('medic'); pending[2].done(model('retry')); await retry;
    assert.equal(original.parent, null);
    assert.equal(scene.children.length, 2);
});

test('visibility recovers when an enemy becomes a teammate, while opposing players need line of sight', () => {
    const observer = { position: new THREE.Vector3(), aimYaw: 0, team: 'blue' };
    const opponent = { position: new THREE.Vector3(0, 0, 5), team: 'red', mesh: {} };
    const arena = { hasLineOfSight: () => true };
    applyVisibilityCulling([observer], [opponent], null, arena);
    assert.equal(opponent.mesh.visible, true);
    observer.aimYaw = Math.PI;
    applyVisibilityCulling([observer], [opponent], null, arena);
    assert.equal(opponent.mesh.visible, false);
    opponent.team = 'blue';
    applyVisibilityCulling([observer], [opponent], null, arena);
    assert.equal(opponent.mesh.visible, true);
    opponent.team = 'red'; observer.aimYaw = 0; arena.hasLineOfSight = () => false;
    applyVisibilityCulling([observer], [opponent], null, arena);
    assert.equal(opponent.mesh.visible, false);
});

test('authoritative snapshots remove departed humans and local aliases as well as stale bots', () => {
    const source = readFileSync(new URL('../../src/app/main.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').split('// Instantiate game on page load')[0];
    const Game = vm.runInNewContext(source + '\nCyberArenaGame;', { THREE, performance });
    const remotes = new Map(['old-human', 'guest', 'bot_old'].map(id => [id, {}]));
    const game = {
        gameMode: 'TDM', remotePlayers: remotes, remoteProjectiles: new Map(),
        player: {}, weapons: {}, waveManager: { bombs: { applySnapshot() {} }, enemies: [] },
        pickups: { pickups: [] }, removeCoopPlayer(id) { remotes.delete(id); }
    };
    Game.prototype.applyCoopSnapshot.call(game, { mode: 'TDM', players: [], enemies: [], pickups: [] }, 'guest');
    assert.equal(remotes.size, 0);
});

for (const mode of ['TDM', 'FPS_SOLO']) test(`${mode} clears previous-life counters and stale motion when starting another match`, () => {
    const source = readFileSync(new URL('../../src/app/main.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').split('// Instantiate game on page load')[0];
    const Game = vm.runInNewContext(source + '\nCyberArenaGame;', {
        document: { getElementById: () => ({}) }, sounds: { init() {}, startMusic() {} }
    });
    const remote = {
        spawnSeq: 7, health: 0, maxHealth: 100, maxShield: 100,
        netTarget: new THREE.Vector3(99, 0, 99), netSampleTime: 123,
        netVelocity: new THREE.Vector3(10, 0, 10), isVisibleToObserver: false
    };
    const game = {
        gameMode: mode, remotePlayers: new Map([['guest', remote]]),
        player: { spawnSeq: 9, reset() {}, setInputEnabled() {} },
        weapons: { resetRun() {} }, getLoadout: () => ({}), switchArena() {}, network: { active: true },
        pickups: { clear() {} }, particles: { clear() {} }, waveManager: { clear() {} },
        tdmManager: { startMatch() {} }, fpsManager: { startMatch() {} }
    };
    Game.prototype[mode === 'TDM' ? 'startTDM' : 'startFPS'].call(game, 'blue');
    assert.equal(game.player.spawnSeq, 0);
    assert.equal(remote.spawnSeq, 0);
    assert.equal(remote.netTarget, null);
    assert.equal(remote.netSampleTime, 0);
    assert.equal(remote.netVelocity.lengthSq(), 0);
    assert.equal(remote.isVisibleToObserver, true);
});
