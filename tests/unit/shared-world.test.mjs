import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s === 'three' ? {url:new URL('../../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE = await import('three');
const {WeaponSystem, getBombConfig} = await import('../../src/gameplay/combat/weapons.js');
const {PlayerController} = await import('../../src/gameplay/player/player.js');
const {NetworkRoom} = await import('../../src/network/network.js');
const weapons = () => new WeaponSystem(new THREE.Scene(), null, {createExplosion(){},createImpactSparks(){}});

test('reset preserves shared effect arrays so guest bombs continue to be simulated by host', () => {
    const host=weapons(),remote=weapons();
    remote.isRemoteClone=true; remote.thrownBombs=host.thrownBombs;remote.activeZones=host.activeZones;
    host.resetRun(); remote.resetRun();
    remote.spawnVisualBomb(new THREE.Vector3(),new THREE.Vector3(1,0,1),getBombConfig('grenade_smoke'));
    assert.equal(host.thrownBombs.length,1);assert.equal(host.thrownBombs,remote.thrownBombs);
    host.resetRun();assert.equal(remote.thrownBombs.length,0);
});

test('late join receives persistent smoke and in-flight bomb; repeated snapshots do not duplicate them', () => {
    const host = weapons(), client = weapons();
    host.createSmokeZone(new THREE.Vector3(4,0,2), 6, 8);
    host.spawnVisualBomb(new THREE.Vector3(1,1,1), new THREE.Vector3(4,0,2), getBombConfig('grenade_smoke'));
    const first = host.getWorldState();
    client.applyWorldState(structuredClone(first));
    client.applyWorldState(structuredClone(first));
    assert.equal(client.activeZones.length,1); assert.equal(client.thrownBombs.length,1);
    assert.deepEqual(client.activeZones[0].pos.toArray(), [4,0,2]);
    client.updateThrownBombs(30, {}, [{takeDamage(){throw Error('Replica applied damage');}}]);
    client.updateActiveZones(30, null, []);
    assert.equal(client.activeZones[0].life,8);
    assert.equal(client.activeZones.length,1);
    host.clear(); client.applyWorldState(host.getWorldState());
    assert.equal(client.activeZones.length,0); assert.equal(client.thrownBombs.length,0);
});

test('guest throw is a request only and does not create an independent bomb or consume inventory', () => {
    const w = weapons(); w.resetRun(undefined,undefined,'grenade_smoke'); w.currentSlotIndex = 2;
    const before = w.getCurrentWeapon().count, sent=[]; w.onCommand=c=>sent.push(c);
    assert.equal(w.throwBomb(new THREE.Vector3(),new THREE.Vector3(3,0,3)),true);
    assert.equal(w.getCurrentWeapon().count,before); assert.equal(w.thrownBombs.length,0);
    assert.equal(sent[0].type,'throw_bomb');
});

test('commands send immediately, snapshots target 60Hz, and congestion retains events with latest state', () => {
    let sends=[];
    const game={player:{position:new THREE.Vector3(),velocity:new THREE.Vector3()}, state:'PLAYING', getCoopPlayer(){}};
    const client = new NetworkRoom(game); client.active=true; client.host=false; client.startedEpoch=1;
    client.conn={open:true,send:x=>sends.push(x)};
    client.pollTimer=1; client.sendCommand({type:'active_skill'});
    assert.equal(sends.length,1); assert.equal(sends[0].commands[0].type,'active_skill');
    sends=[];
    const host=new NetworkRoom({...game,makeCoopSnapshot:()=>({events:[],value:1})}); host.active=true;host.host=true;
    host.connections=[{id:'p',joined:true,conn:{open:true,send:x=>sends.push(x),dataChannel:{bufferedAmount:0}}}];
    for(let i=0;i<60;i++)host.update(1/60);
    assert.equal(sends.length,60);
    host.connections[0].conn.dataChannel.bufferedAmount=70000;
    host.game.makeCoopSnapshot=()=>({events:[{type:'shot'}],value:2});host.update(1/60);
    assert.equal(sends.length,60);
    host.connections[0].conn.dataChannel.bufferedAmount=0;
    host.game.makeCoopSnapshot=()=>({events:[],value:3});host.update(1/60);
    assert.equal(sends.at(-1).snapshot.value,3);assert.equal(sends.at(-1).snapshot.events.length,1);
});

test('skill replicas retain host timers, cannot heal/damage locally, and remove entities on reset', () => {
    const player=()=>{
        const p=Object.create(PlayerController.prototype);
        Object.assign(p,{scene:new THREE.Scene(),position:new THREE.Vector3(),aimYaw:0,characterId:'engineer'});
        p.clearSharedSkills();return p;
    };
    const host=player(), guest=player();
    host.triggerAutoTurret(8); host.triggerSandVortex(5);
    const state=host.getSharedSkillState();guest.applySharedSkillState(structuredClone(state));guest.applySharedSkillState(structuredClone(state));
    assert.equal(guest.activeTurrets.length,1);assert.equal(guest.activeVortexes.length,1);
    globalThis.window={game:{network:{active:true,host:false}}};
    try { guest.updateActiveSkills(10,{},[{takeDamage(){throw Error('Replica damage');}}]); }
    finally {delete globalThis.window;}
    assert.equal(guest.activeTurrets[0].timer,8);
    host.clearSharedSkills();guest.applySharedSkillState(host.getSharedSkillState());
    assert.equal(guest.scene.children.length,0);
});
