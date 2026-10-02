import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three');
const { NetworkRoom, makeRemotePlayer }=await import('../../src/network/network.js');
const { WeaponSystem, WEAPON_CONFIGS }=await import('../../src/gameplay/combat/weapons.js');
const { SkyBombs }=await import('../../src/gameplay/combat/skybombs.js');
const { Zombie }=await import('../../src/gameplay/combat/enemies.js');
const source=readFileSync(new URL('../../src/app/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').split('// Instantiate game on page load')[0];
const Game=vm.runInNewContext(source+'\nCyberArenaGame;', {THREE,Zombie,performance});
function weapons(scene){const w=new WeaponSystem(scene,null,{createMuzzleFlash(){}});w.resetRun();return w;}
function game(){
 const scene=new THREE.Scene(), w=weapons(scene);
 const g={scene,weapons:w,player:{health:100,shield:100},network:{seq:0},remoteProjectiles:new Map(),remotePlayers:new Map(),currentWave:1,score:0,
 waveManager:{bombs:new SkyBombs(scene),enemies:[],models:{'character-zombie':{scene:new THREE.Group(),animations:[]}}},pickups:{pickups:[]}};
 g.ensureCoopPlayer=(id)=>{if(!g.remotePlayers.has(id)){const p=makeRemotePlayer(scene,null,id,id);p.weapons=weapons(scene);g.remotePlayers.set(id,p);}return g.remotePlayers.get(id);};
 return g;
}
test('snapshots create visible zombies and move the same remote player on both guests',()=>{
 const clients=[game(),game()];
 const snapshot={players:[{id:'host',position:[3,0,4],health:100,shield:100,aim:1,weapons:clients[0].weapons.getNetworkState()}],enemies:[{id:7,type:'walker',position:[5,0,6],health:50,maxHealth:200,yaw:1}],projectiles:[],pickups:[]};
 for(const g of clients){
  Game.prototype.applyCoopSnapshot.call(g,snapshot,'guest');
  assert.equal(g.waveManager.enemies.length,1);
  assert.ok(g.waveManager.enemies[0].mesh.parent===g.scene);
  assert.equal(g.waveManager.enemies[0].maxHealth,200);
  assert.deepEqual(g.remotePlayers.get('host').position.toArray(),[3,0,4]);
  snapshot.enemies[0].position=[8,0,9];
  Game.prototype.applyCoopSnapshot.call(g,snapshot,'guest');
  assert.deepEqual(g.waveManager.enemies[0].position.toArray(),[8,0,9]);
  Game.prototype.applyCoopSnapshot.call(g,{...snapshot,enemies:[]},'guest');
  assert.equal(g.waveManager.enemies.length,0);
 }
});
test('late join starts even when accepted epoch matches host; duplicate start does not reset match',()=>{
 let starts=0;
 const n=new NetworkRoom({startGame(room){assert.equal(room,true);starts++;}});
 n.epoch=123;n.pendingCommands=[{seq:3}];n.seq=3;
 n.beginMatch(123);n.beginMatch(123);
 assert.equal(starts,1);assert.equal(n.seq,0);assert.equal(n.pendingCommands.length,0);
 n.beginMatch(124);assert.equal(starts,2);
});
test('multiplayer start/restart routes through the host and guests cannot reset independently',()=>{
 let starts=0;
 const g={network:{active:true,host:false,start(){starts++;}}};
 Game.prototype.startGame.call(g);assert.equal(starts,0);
 g.network.host=true;Game.prototype.startGame.call(g);assert.equal(starts,1);
});
test('weapon snapshot preserves secondary gun, knife slot and separate attachments',()=>{
 const a=weapons(new THREE.Scene()), b=weapons(new THREE.Scene());
 a.weaponSlots[1]={...WEAPON_CONFIGS[4],tier:5};a.currentSlotIndex=2;
 a.primaryAttachments.barrel='barrel_t2';a.secondaryAttachments.grip='grip_t3';
 b.applyNetworkState(a.getNetworkState());
 assert.equal(b.getCurrentWeapon().id,'knife');assert.equal(b.weaponSlots[1].id,a.weaponSlots[1].id);
 assert.equal(b.weaponSlots[1].tier,5);assert.equal(b.secondaryAttachments.grip,'grip_t3');
});

test('Peer transport delivers host enemies and guest movement in a shared snapshot', async () => {
 const { EventEmitter } = await import('node:events');
 const peers = new Map();
 class Peer extends EventEmitter {
  constructor(id = `guest-${peers.size}`) { super();this.id=id;peers.set(id,this);queueMicrotask(()=>this.emit('open',id)); }
  connect(id) {
   const a=new EventEmitter(),b=new EventEmitter();
   a.send=data=>b.emit('data',structuredClone(data));b.send=data=>a.emit('data',structuredClone(data));
   queueMicrotask(()=>{peers.get(id).emit('connection',b);a.open=b.open=true;a.emit('open');});return a;
  }
 }
 const previousWindow=globalThis.window;globalThis.window={Peer};
 try {
  function endpoint() {
   const g=game();g.state='MENU';g.player.position=new THREE.Vector3();g.player.velocity=new THREE.Vector3();
   g.player.weapons=g.weapons;g.player.setCharacter=()=>{};g.coopPlayers=[g.player];
   const ensure=g.ensureCoopPlayer;g.ensureCoopPlayer=id=>{const p=ensure(id);if(!g.coopPlayers.includes(p))g.coopPlayers.push(p);return p;};
   g.getCoopPlayer=id=>id===g.network.playerId?g.player:g.remotePlayers.get(id);
   g.showRoomState=()=>{};g.startGame=()=>{g.state='PLAYING';g.waveManager.enemies=[];};
   g.makeCoopSnapshot=()=>Game.prototype.makeCoopSnapshot.call(g);
   g.applyCoopSnapshot=(s,id)=>Game.prototype.applyCoopSnapshot.call(g,s,id);
   g.network=new NetworkRoom(g);return g;
  }
  const host=endpoint(),guest=endpoint();
  await host.network.create('Host');await host.network.start();
  await guest.network.join(host.network.code,'Guest');
  host.waveManager.enemies.push(new Zombie(host.scene,'walker',new THREE.Vector3(5,0,5),host.waveManager.models,null));
  host.network.update(.04);
  assert.equal(guest.state,'PLAYING');assert.equal(guest.waveManager.enemies.length,1);
  guest.player.position.set(9,0,7);guest.network.update(.04);host.network.update(.04);
  assert.deepEqual(host.remotePlayers.get(guest.network.playerId).position.toArray(),[9,0,7]);
  host.player.position.set(2,0,3);host.network.update(.04);
  assert.deepEqual(guest.remotePlayers.get('host').position.toArray(),[2,0,3]);
 } finally { globalThis.window=previousWindow; }
});

test('unlimited reserve is finite on the wire and restored after transfer', () => {
 const a=weapons(new THREE.Scene()),b=weapons(new THREE.Scene());
 a.reserve[a.weaponSlots[0].id]=Infinity;
 a.reserve[a.weaponSlots[1].id]=17;
 const snapshot=a.getNetworkState();
 function assertFinite(value){
  if(typeof value==='number') assert.ok(Number.isFinite(value),'PeerJS cannot pack non-finite numbers');
  else if(value && typeof value==='object') Object.values(value).forEach(assertFinite);
 }
 assertFinite(snapshot);
 assert.equal(snapshot.reserve[a.weaponSlots[0].id],-1);
 b.applyNetworkState(structuredClone(snapshot));
 assert.equal(b.reserve[a.weaponSlots[0].id],Infinity);
 assert.equal(b.reserve[a.weaponSlots[1].id],17);
});
