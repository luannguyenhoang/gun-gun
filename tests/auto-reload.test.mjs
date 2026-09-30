import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../libs/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three');
const {WeaponSystem}=await import('../src/weapons.js');
function fixture(){const w=new WeaponSystem(new THREE.Scene(),null,{createMuzzleFlash(){}});w.resetRun();return w;}
test('holding fire through an empty magazine completes automatic reload and resumes shooting',()=>{
 const w=fixture(),origin=new THREE.Vector3(),target=new THREE.Vector3(0,0,10);w.ammo.blaster=1;w.reserve.blaster=20;
 assert.equal(w.shoot(origin,target),true);assert.equal(w.ammo.blaster,0);assert.equal(w.isReloading,true);
 for(let i=0;i<80;i++){w.shoot(origin,target);w.update(1/60,{colliders:[]},[],[]);}
 assert.equal(w.isReloading,false);assert.equal(w.reserve.blaster,4);assert.ok(w.ammo.blaster>0 && w.ammo.blaster<16);
});
test('empty gun reloads without input when reserve arrives, using only available rounds',()=>{
 const w=fixture();w.ammo.blaster=0;w.reserve.blaster=0;w.update(.01,{colliders:[]},[],[]);assert.equal(w.isReloading,false);
 w.reserve.blaster=5;w.update(.01,{colliders:[]},[],[]);assert.equal(w.isReloading,true);
 for(let i=0;i<80;i++)w.update(1/60,{colliders:[]},[],[]);
 assert.equal(w.ammo.blaster,5);assert.equal(w.reserve.blaster,0);
});
