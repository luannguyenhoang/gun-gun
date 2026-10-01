import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../libs/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three');
const {Zombie,WaveManager}=await import('../src/enemies.js');
const {SkyBombs}=await import('../src/skybombs.js');
const models={'character-zombie':{scene:new T.Group(),animations:[]}};
const player=(x=0)=>({position:new T.Vector3(x,0,0),isDead:false,hits:0,takeDamage(){this.hits++;}});
test('spitter charges, locks aim, fires acid and respects a wall',()=>{
 const shots=[];const z=new Zombie(new T.Scene(),'spitter',new T.Vector3(0,0,10),models,null,1,{shootEnemyBolt(...a){shots.push(a);}});
 const p=player();z.rangedCooldown=0;
 z.update(.01,p,{hasLineOfSight:()=>true},[z]);assert.ok(z.spitCharge>0);assert.equal(shots.length,0);
 const locked=z.acidTarget.clone();p.position.x=4;
 z.update(.7,p,{hasLineOfSight:()=>true},[z]);assert.equal(shots.length,1);assert.deepEqual(shots[0][1],locked);assert.equal(shots[0][4],true);
 z.rangedCooldown=0;z.update(.01,p,{hasLineOfSight:()=>false},[z]);assert.equal(z.spitCharge<=0,true);assert.equal(shots.length,1);
});
test('bomb telegraphs, falls, damages every nearby player once and can be dodged',()=>{
 const bombs=new SkyBombs(new T.Scene());const a=player(),b=player(1),dodger=player();
 const bomb=bombs.spawn(a.position,35);dodger.position.x=8;
 bombs.update(1,[a,b,dodger]);assert.equal(a.hits,0);assert.ok(bomb.mesh.visible);
 bombs.update(.81,[a,b,dodger]);bombs.update(1,[a,b,dodger]);
 assert.equal(a.hits,1);assert.equal(b.hits,1);assert.equal(dodger.hits,0);assert.equal(bombs.items.size,0);
});
test('guests reproduce bomb positions and timing without applying damage',()=>{
 const host=new SkyBombs(new T.Scene()),guest=new SkyBombs(new T.Scene());const p=player();
 host.spawn(p.position,35);host.update(.5,[]);guest.applySnapshot(host.snapshot());
 assert.equal([...guest.items.values()][0].remaining,1.3);
 guest.update(2,[p],false);assert.equal(p.hits,0);
 guest.applySnapshot([]);assert.equal(guest.items.size,0);
});
test('new species are available early and pooling rebuilds their appearance',()=>{
 const manager=new WaveManager(new T.Scene(),null,null,null,null);manager.models=models;
 const random=Math.random;
 try{Math.random=()=>.2;assert.equal(manager.determineArchetype(.75),'spitter');manager.currentPhase=2;assert.equal(manager.determineArchetype(0),'spitter');Math.random=()=>.05;manager.currentPhase=3;assert.equal(manager.determineArchetype(0),'bomber');}
 finally{Math.random=random;}
 const z=manager.acquireZombie('walker',new T.Vector3(),0,7.5);const old=z.mesh;z.deactivate();
 const reused=manager.acquireZombie('bomber',new T.Vector3(),0,7.5);
 assert.equal(z,reused);assert.notEqual(reused.mesh,old);assert.equal(reused.type,'bomber');assert.equal(reused.active,true);assert.equal(reused.isDead,false);assert.equal(reused.mutationParts.length,2);
 reused.rangedCooldown=0;reused.update(.01,player(10),{},[reused]);assert.equal(manager.bombs.items.size,1);
 manager.clear();assert.equal(manager.bombs.items.size,0);
});
