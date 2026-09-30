import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s,c,next) { return s === 'three' ? {url:new URL('../libs/three.module.js',import.meta.url).href,shortCircuit:true} : next(s,c); } });
const THREE = await import('three');
const { WeaponSystem, WEAPON_CONFIGS } = await import('../src/weapons.js');
const { NetworkRoom } = await import('../src/network.js');
test('selected starter survives resets with correct ammo, reserve and utility slots', () => {
    const system = new WeaponSystem(new THREE.Scene(), null, {});
    for (const config of WEAPON_CONFIGS) {
        system.resetRun(config.id);
        system.ammo[config.id] = 0;
        system.resetRun();
        assert.equal(system.getCurrentWeapon().id, config.id);
        assert.equal(system.ammo[config.id], config.magSize);
        assert.equal(system.reserve[config.id], config.magSize * 6);
        assert.deepEqual(system.weaponSlots.slice(1).map(w => w.id), ['knife','medkit']);
        assert.equal(system.getNetworkState().gun, config.id);
    }
    system.resetRun('plasma');
    assert.equal(system.startingWeaponId, 'blaster');
});
test('roster equips a guest starter, preserves it on restart, and cannot reset guns mid-match', () => {
    const remote = { weapons: new WeaponSystem(new THREE.Scene(), null, {}) };
    remote.weapons.resetRun();
    const game = {state:'MENU', remotePlayers:new Map([['guest',remote]]), ensureCoopPlayer:()=>remote};
    const room = new NetworkRoom(game);
    room.playerId = 'host';
    room.updateRoster([{id:'guest',weapon:'scatter'}]);
    remote.weapons.resetRun();
    assert.equal(remote.weapons.getCurrentWeapon().id,'scatter');
    game.state = 'PLAYING';
    room.updateRoster([{id:'guest',weapon:'repeater'}]);
    assert.equal(remote.weapons.getCurrentWeapon().id,'scatter');
});
