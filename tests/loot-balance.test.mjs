import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s,c,next) { return s === 'three' ? {url:new URL('../libs/three.module.js',import.meta.url).href,shortCircuit:true} : next(s,c); } });
const T = await import('three');
const { WeaponSystem } = await import('../src/weapons.js');
const { WaveManager } = await import('../src/enemies.js');
const { Arena } = await import('../src/arena.js');
const { PickupManager } = await import('../src/pickups.js');
const particles = {createImpactSparks(){},createKnifeSlash(){}};

test('killed pooled zombies award score and loot exactly once before reuse', () => {
    const scene = new T.Scene(), arena = new Arena(scene);
    const manager = new WaveManager(scene, null, null, particles, arena);
    manager.models = {'character-zombie':{scene:new T.Group()}};
    const enemy = manager.acquireZombie('walker',new T.Vector3(4,0,4),0,7.5);
    manager.enemies.push(enemy);
    enemy.takeDamage(10000, 10);
    assert.ok(enemy.isDead);
    assert.equal(enemy.mesh.visible,false);
    const next = manager.acquireZombie('walker',new T.Vector3(20,0,20),0,7.5);
    assert.notEqual(next,enemy,'pending reward cannot be overwritten by an imminent spawn');
    const pickups = new PickupManager(scene,particles);
    let score = 0, kills = 0;
    const notify = killed => { score += killed.scoreValue; kills++; pickups.spawnDrop(killed.position,'boss'); };
    manager.update(0.016,{isDead:true},arena,notify);
    manager.update(0.016,{isDead:true},arena,notify);
    assert.equal(kills,1);
    assert.ok(score > 0);
    assert.equal(pickups.pickups.length,1);
    assert.equal(pickups.pickups[0].mesh.position.x,4);
    assert.equal(manager.acquireZombie('walker',new T.Vector3(),0,7.5),enemy);
});

test('bad luck still yields a drop every 5 kills, ammo every 10 and buff every 20; restart resets counters', () => {
    const manager = new PickupManager(new T.Scene(), particles);
    const random = Math.random;
    Math.random = () => 0.99;
    try {
        for (let kill = 1; kill <= 20; kill++) {
            const result = manager.spawnDrop(new T.Vector3());
            assert.equal(!!result,kill % 5 === 0);
            if (kill === 10) assert.equal(result.type,'ammo');
        }
        assert.equal(manager.pickups.filter(p=>p.type==='ammo').length,2);
        assert.ok(manager.pickups.some(p=>['damage','rapid','multishot'].includes(p.type)));
        manager.clear();
        assert.equal(manager.spawnDrop(new T.Vector3()),null);
        assert.equal(manager.killsWithoutAmmo,1);
        assert.equal(manager.killsWithoutBuff,1);
        assert.ok(manager.spawnDrop(new T.Vector3(),'boss'));
    } finally { Math.random = random; }
});

test('knife hits once for 32 base damage at close range and cannot reach the old range', () => {
    const weapons = new WeaponSystem(new T.Scene(),null,particles);
    weapons.resetRun();
    weapons.currentSlotIndex = 1;
    const hits = [];
    const target = (z) => ({position:new T.Vector3(0,0,z),radius:0.6,isDead:false,takeDamage(damage){hits.push({z,damage});return {};}});
    const random = Math.random;
    Math.random = () => 0.99;
    try {
        weapons.shoot(new T.Vector3(0,0.8,0),new T.Vector3(0,0.8,3));
        weapons.update(0.016,{colliders:[]},[target(1),target(2.1)],{isADS:false});
        weapons.update(0.016,{colliders:[]},[target(1)],{isADS:false});
        assert.deepEqual(hits,[{z:1,damage:32}]);
    } finally {Math.random=random;}
});
