import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier, context, next) {
    return specifier === 'three' ? {url:new URL('../../vendor/three.module.js',import.meta.url).href,shortCircuit:true} : next(specifier,context);
}});
const { NetworkRoom } = await import('../../src/network/network.js');

test('FPS late join starts the host mode once and ignores duplicate or older epochs', () => {
    const calls = [], remotes = new Map();
    const game = {
        ensureCoopPlayer(id) { if (!remotes.has(id)) remotes.set(id, {}); return remotes.get(id); },
        startTDM(team, options) { calls.push({ team, options }); }
    };
    const room = new NetworkRoom(game); room.playerId = 'guest';
    const config = { mode: 'TDM', firstPerson: true, fillBots: true, players: [{id:'host',team:'blue'}, {id:'guest',team:'red'}] };
    assert.equal(room.beginMatch(10, config), true);
    assert.deepEqual(calls, [{team:'red',options:{fillBots:true,firstPerson:true,isCoop:true}}]);
    assert.equal(remotes.get('host').team, 'blue');
    assert.equal(room.beginMatch(10, config), true);
    assert.equal(room.beginMatch(9, config), false);
    assert.equal(calls.length, 1);
});

test('FPS respawn ignores positions from an earlier life until the guest acknowledges its spawn', () => {
    const player = { position: new THREE.Vector3(3,0,20), spawnSeq: 2 };
    const room = new NetworkRoom({gameMode:'TDM',getCoopPlayer:()=>player});
    room.playerId = 'host';
    room.applyInputs({guest:{position:[9,0,-5],spawnSeq:1}});
    assert.deepEqual(player.position.toArray(), [3,0,20]);
    room.applyInputs({guest:{position:[4,0,20],spawnSeq:2}});
    assert.deepEqual(player.position.toArray(), [4,0,20]);
});

test('host reconstructs the FPS muzzle from the guest position rather than trusting the supplied origin', () => {
    let actual;
    const player = {
        id:'guest',position:new THREE.Vector3(2,0,3),
        commandQueue:[{type:'shoot',seq:1,origin:[999,999,999],target:[2,1.55,-10],weaponId:'gun'}],
        weapons:{getCurrentWeapon:()=>({id:'gun'}),shoot(origin,target){actual={origin:origin.toArray(),target:target.toArray()};return true;}}
    };
    const room = new NetworkRoom({firstPersonView:{active:true},networkEvents:[]});
    room.processCommands(player);
    assert.deepEqual(actual, {origin:[2,1.55,3],target:[2,1.55,-10]});
});
