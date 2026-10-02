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
const { LootingSystem, LootContainer, AirdropDropEntity } = await import('../../src/gameplay/loot/looting.js');
const { NetworkRoom } = await import('../../src/network/network.js');
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

test('NetworkRoom processCommands handles shot events and hit_enemy damage without blocking the queue', () => {
    const scene = new THREE.Scene();
    let killed = false;
    const enemy = {
        id: 'zombie_99',
        isDead: false,
        health: 100,
        position: new THREE.Vector3(5, 0, 5),
        takeDamage(dmg) {
            this.health -= dmg;
            if (this.health <= 0) this.isDead = true;
        }
    };
    const mockGame = {
        networkEvents: [],
        waveManager: { enemies: [enemy] },
        lootingSystem: { handleRemoteLoot() {}, handleRemoteLootAll() {} },
        onEnemyKilled(e) { killed = true; }
    };

    const network = new NetworkRoom(mockGame);
    const mockRemotePlayer = {
        id: 'p_remote_1',
        isDead: false,
        commandQueue: [
            { seq: 1, type: 'shoot', origin: [0, 1.2, 0], target: [5, 1, 5], ads: true, weaponId: 'blaster_a' },
            { seq: 2, type: 'hit_enemy', enemyId: 'zombie_99', damage: 120, crit: true, hitPoint: [5, 1, 5] }
        ],
        weapons: {
            ammo: { blaster_a: 0 }, // Đang giả lập hết đạn
            isReloading: true,       // Đang giả lập reloading
            fireCooldown: 0.5,
            getCurrentWeapon() { return { id: 'blaster_a' }; },
            weaponSlots: [{ id: 'blaster_a' }],
            shoot() {}
        }
    };

    network.processCommands(mockRemotePlayer);

    // Hàng đợi không bị kẹt bởi isReloading
    assert.equal(mockRemotePlayer.commandQueue.length, 0);
    // Quái nhận sát thương và bị tiêu diệt
    assert.equal(enemy.isDead, true);
    assert.equal(killed, true);
    // Sự kiện bắn được ghi nhận để broadcast
    assert.equal(mockGame.networkEvents.length, 1);
    assert.equal(mockGame.networkEvents[0].type, 'shot');
    assert.equal(mockGame.networkEvents[0].shooterId, 'p_remote_1');
});
