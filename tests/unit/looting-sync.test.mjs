import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

registerHooks({
    resolve(s, c, next) {
        return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
    }
});

const THREE = await import('three');
const { GLTFLoader } = await import('../../vendor/loaders/GLTFLoader.js');
const { LootingSystem, LootContainer, AirdropDropEntity } = await import('../../src/gameplay/loot/looting.js');
const { WeaponSystem } = await import('../../src/gameplay/combat/weapons.js');
const { NetworkRoom, makeRemotePlayer } = await import('../../src/network/network.js');
const { Zombie } = await import('../../src/gameplay/combat/enemies.js');

test('LootContainer snapshot and restore preserve id, position and slots', () => {
    const scene = new THREE.Scene();
    const container = new LootContainer(scene, 'wooden_crate', new THREE.Vector3(5, 0, 5), {
        id: 'box_123',
        customName: 'Thùng Dã Chiến'
    });
    container.slots[0] = { itemId: 'medkit', count: 1, revealed: true };

    const snap = container.snapshot();
    assert.equal(snap.id, 'box_123');
    assert.equal(snap.slots[0].itemId, 'medkit');
    assert.deepEqual(snap.position, [5, 0, 5]);

    const restored = new LootContainer(scene, snap.type, new THREE.Vector3().fromArray(snap.position), {
        id: snap.id,
        customName: snap.name,
        slots: snap.slots
    });
    assert.equal(restored.id, 'box_123');
    assert.equal(restored.slots[0].itemId, 'medkit');
});

test('LootingSystem snapshot and applySnapshot synchronize containers and airdrop drops across host and guest', () => {
    const sceneHost = new THREE.Scene();
    const sceneGuest = new THREE.Scene();

    const hostLooting = new LootingSystem(sceneHost, null, { position: new THREE.Vector3() }, {}, null);
    const guestLooting = new LootingSystem(sceneGuest, null, { position: new THREE.Vector3() }, {}, null);

    // Host tạo 1 hòm đồ và 1 airdrop drop
    hostLooting.spawnContainer('military_safe', new THREE.Vector3(10, 0, 10), { id: 'safe_01' });
    const drop = new AirdropDropEntity(sceneHost, new THREE.Vector3(0, 0, 0), hostLooting, { id: 'air_01' });
    hostLooting.airdropDrops.push(drop);
    hostLooting.activeAirdropZone = { x: 0, z: 0, radius: 4.5, time: 30 };

    const snap = hostLooting.snapshot();
    assert.equal(snap.containers.length, 1);
    assert.equal(snap.airdropDrops.length, 1);
    assert.ok(snap.activeAirdropZone);

    // Guest áp dụng snapshot
    guestLooting.applySnapshot(snap);
    assert.equal(guestLooting.containers.length, 1);
    assert.equal(guestLooting.containers[0].id, 'safe_01');
    assert.equal(guestLooting.airdropDrops.length, 1);
    assert.equal(guestLooting.airdropDrops[0].id, 'air_01');
    assert.ok(guestLooting.activeAirdropZone);

    // Host nhặt đồ khỏi hòm -> hòm rỗng và biến mất
    hostLooting.containers[0].slots = [null, null];
    hostLooting.checkAndRemoveEmptyContainer(hostLooting.containers[0]);
    assert.equal(hostLooting.containers.length, 0);

    const snap2 = hostLooting.snapshot();
    guestLooting.applySnapshot(snap2);
    assert.equal(guestLooting.containers.length, 0);
});

test('guest shots respect cooldown and client hit reports cannot apply damage', () => {
    const enemy = { id: 'enemy', health: 100, takeDamage() { throw Error('client damage accepted'); } };
    const game = { networkEvents: [], waveManager: { enemies: [enemy] } };
    const network = new NetworkRoom(game);
    const player = { id: 'guest', position: new THREE.Vector3(), commandQueue: [
        { seq: 1, type: 'shoot', target: [5, 1, 5] },
        { seq: 2, type: 'hit_enemy', enemyId: 'enemy', damage: 9999 }
    ], weapons: { fireCooldown: .5, getCurrentWeapon: () => ({ id: 'blaster' }), shoot: () => true } };
    network.processCommands(player);
    assert.equal(player.commandQueue.length, 2);
    player.weapons.fireCooldown = 0;
    network.processCommands(player);
    assert.equal(player.commandQueue.length, 0);
    assert.equal(enemy.health, 100);
    assert.equal(game.networkEvents.length, 1);
    assert.equal(player.processedSeq, 2);
});

test('duplicate and concurrent requests conserve weapon ownership and attachments', () => {
    const saved = globalThis.window;
    const load = GLTFLoader.prototype.load; GLTFLoader.prototype.load = () => {};
    globalThis.window = { addEventListener() {} };
    try {
        const scene = new THREE.Scene();
        const a = makeRemotePlayer(scene, null, 'a', 'A'), b = makeRemotePlayer(scene, null, 'b', 'B');
        for (const p of [a, b]) { p.weapons = new WeaponSystem(scene, null, {}); p.weapons.resetRun(); p.position.set(0, 0, 0); }
        const loot = new LootingSystem(scene, null, a, {}, null);
        const room = new NetworkRoom({ lootingSystem: loot });
        const id = a.weapons.weaponSlots[0].instanceId;
        a.weapons.primaryAttachments.barrel = 'barrel_t2';
        a.commandQueue = Array.from({ length: 10 }, (_, i) => ({ seq: i + 1, type: 'drop_weapon', slot: 0, instanceId: id }));
        room.processCommands(a);
        assert.equal(a.weapons.weaponSlots[0], null);
        assert.equal(loot.droppedWeapons.length, 1);
        assert.equal(loot.droppedWeapons[0].gunData.instanceId, id);
        const command = { type: 'pickup_weapon', weaponDropId: loot.droppedWeapons[0].id };
        b.weapons.weaponSlots[0] = null;
        assert.equal(loot.processRemoteCommand(b, command), true);
        assert.equal(loot.processRemoteCommand(a, command), false);
        assert.equal(b.weapons.weaponSlots[0].instanceId, id);
        assert.equal(b.weapons.primaryAttachments.barrel, 'barrel_t2');
        assert.equal(loot.droppedWeapons.length, 0);
        // Forged weapon payloads have no authority to create a new gun.
        a.commandQueue = [{ seq: 11, type: 'drop_weapon', slot: 0, instanceId: id, gunData: { id: 'blaster' } }];
        room.processCommands(a);
        assert.equal(loot.droppedWeapons.length, 0);
    } finally { globalThis.window = saved; GLTFLoader.prototype.load = load; }
});

test('contested crate loot is awarded once and distant requests leave the world unchanged', () => {
    const saved = globalThis.window;
    const load = GLTFLoader.prototype.load; GLTFLoader.prototype.load = () => {};
    globalThis.window = { addEventListener() {} };
    try {
        const scene = new THREE.Scene();
        const a = makeRemotePlayer(scene, null, 'a', 'A'), b = makeRemotePlayer(scene, null, 'b', 'B');
        for (const p of [a,b]) { p.weapons = new WeaponSystem(scene, null, {}); p.weapons.resetRun(); p.position.set(0,0,0); }
        const loot = new LootingSystem(scene, null, a, {}, null);
        const box = loot.spawnContainer('wooden_crate', new THREE.Vector3(), { slots: [{ itemId: 'medkit', count: 1, revealed: true }] });
        const snap = loot.snapshot();
        const cmd = { type: 'loot_slot', containerId: box.id, slotIndex: 0, lootId: snap.containers[0].slots[0].lootId, mode: 'smart' };
        b.position.set(100,0,100);
        assert.equal(loot.processRemoteCommand(b, cmd), false);
        const before = a.weapons.inventory.medkits;
        assert.equal(loot.processRemoteCommand(a, cmd), true);
        b.position.set(0,0,0);
        assert.equal(loot.processRemoteCommand(b, cmd), false);
        assert.equal(a.weapons.inventory.medkits, before + 1);
        assert.equal(b.weapons.inventory.medkits, before);
        assert.equal(loot.containers.length, 0);
    } finally { globalThis.window = saved; GLTFLoader.prototype.load = load; }
});

test('Coop match does not trigger game over when host dies but teammates are alive', () => {
    const hostPlayer = { id: 'host', isDead: true, isDowned: false, health: 0 };
    const remoteGuest = { id: 'guest_1', isDead: false, isDowned: false, health: 80 };
    const coopPlayers = [hostPlayer, remoteGuest];

    const hasAliveTeammate = coopPlayers.some(player => !player.isDead && !player.isDowned);
    const noOneCanRevive = !hasAliveTeammate && coopPlayers.every(player => player.isDead || player.isDowned);

    // Đồng đội vẫn sống -> Trận đấu không được game over!
    assert.equal(hasAliveTeammate, true);
    assert.equal(noOneCanRevive, false);

    // Khi cả hai đều gục / chết -> Trận đấu mới kết thúc
    remoteGuest.isDead = true;
    const hasAliveTeammate2 = coopPlayers.some(player => !player.isDead && !player.isDowned);
    const noOneCanRevive2 = !hasAliveTeammate2 && coopPlayers.every(player => player.isDead || player.isDowned);
    assert.equal(hasAliveTeammate2, false);
    assert.equal(noOneCanRevive2, true);
});

