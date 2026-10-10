import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {RemoteMotion} from '../../src/network/remote-motion.js';

test('jittered arrivals interpolate on the host timeline and never overshoot a stopped player',()=>{
    const motion=new RemoteMotion(80), out=new THREE.Vector3();
    for(const [time,received] of [[0,1000],[20,1035],[40,1042],[60,1095],[80,1096]]) motion.push(new THREE.Vector3(time/20,0,0),0,time,received);
    motion.sample(out,1100); assert.ok(Math.abs(out.x-1)<1e-8);
    motion.sample(out,1120); assert.ok(Math.abs(out.x-2)<1e-8);
    motion.sample(out,1400); assert.equal(out.x,4);
    motion.sample(out,1600); assert.equal(out.x,4);
});
test('teleports reset position history, epoch reset accepts a new clock and yaw follows the shortest arc',()=>{
    const motion=new RemoteMotion(0),out=new THREE.Vector3();
    motion.push(out,Math.PI-0.1,100,100);
    motion.push(new THREE.Vector3(1,0,0),-Math.PI+0.1,200,200);
    assert.ok(Math.abs(motion.sample(out,150)-Math.PI)<1e-8);
    motion.push(new THREE.Vector3(50,0,0),0,300,300);
    motion.sample(out,300);assert.equal(out.x,50);
    motion.reset();motion.push(new THREE.Vector3(2,0,0),0,1,400);
    motion.sample(out,400);assert.equal(out.x,2);
});
