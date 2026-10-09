import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
    resolve(s, c, next) {
        return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
    }
});

const THREE = await import('three');
const { GLTFLoader } = await import('../../vendor/loaders/GLTFLoader.js');
const { LootingSystem, DroppedWeaponEntity } = await import('../../src/gameplay/loot/looting.js');
const { WeaponSystem, WEAPON_CONFIGS } = await import('../../src/gameplay/combat/weapons.js');

test('DroppedWeaponEntity has infinite lifetime by default and does not expire after 30s', () => {
    const scene = new THREE.Scene();
    const gunData = { id: 'blaster_a', name: 'Blaster A', tier: 1 };
    const entity = new DroppedWeaponEntity(scene, new THREE.Vector3(0, 0, 0), gunData);

    assert.equal(entity.life, Infinity);
    assert.equal(entity.maxLife, Infinity);

    // Mô phỏng 60 giây trôi qua
    const alive30 = entity.update(30.0);
    assert.equal(alive30, true);
    assert.equal(entity.life, Infinity);

    const alive60 = entity.update(30.0);
    assert.equal(alive60, true);
    assert.equal(entity.life, Infinity);

    entity.dispose();
});

test('LootingSystem.pickupDroppedWeapon equips new weapon and switches mesh immediately without delay', () => {
    const saved = globalThis.window;
    const load = GLTFLoader.prototype.load;
    GLTFLoader.prototype.load = () => {};
    globalThis.window = { addEventListener() {} };

    try {
        const scene = new THREE.Scene();
        const player = {
            position: new THREE.Vector3(0, 0, 0),
            isDead: false,
            isDowned: false
        };
        const weapons = new WeaponSystem(scene, null, {});
        // Mock model 3D cho môi trường Node.js
        weapons.models = {
            'kenney-blaster/blaster-a.glb': new THREE.Group(),
            'kenney-blaster/blaster-b.glb': new THREE.Group()
        };
        weapons.resetRun('blaster_a');
        player.weapons = weapons;

        // Giả lập handNode của người chơi
        const handNode = new THREE.Group();
        scene.add(handNode);
        weapons.attachToArm(handNode);

        const looting = new LootingSystem(scene, null, player, {}, null);

        // Sinh súng rơi ngoài đất: Blaster B (tier 2)
        const droppedGunData = {
            instanceId: 'test_gun_b_123',
            id: 'blaster_b',
            name: 'Blaster B',
            tier: 2
        };
        const droppedEntity = looting.spawnDroppedWeapon(new THREE.Vector3(1, 0, 1), droppedGunData);
        assert.equal(looting.droppedWeapons.length, 1);
        assert.equal(droppedEntity.life, Infinity);

        // Nhặt súng
        const picked = looting.pickupDroppedWeapon(droppedEntity);
        assert.equal(picked, true);

        // Súng rơi cũ bị xóa khỏi sân
        assert.equal(looting.droppedWeapons.some(w => w === droppedEntity), false);

        // Súng mới được trang bị vào slot 0 ngay lập tức
        assert.equal(weapons.weaponSlots[0].id, 'blaster_b');
        assert.equal(weapons.weaponSlots[0].tier, 2);

        // Model súng mới blaster_b đã có trong weaponMeshes và đang hiển thị
        assert.ok(weapons.weaponMeshes['blaster_b']);
        assert.equal(weapons.weaponMeshes['blaster_b'].visible, true);
        assert.equal(weapons.weaponMeshes['blaster_a'], undefined);
    } finally {
        globalThis.window = saved;
        GLTFLoader.prototype.load = load;
    }
});
