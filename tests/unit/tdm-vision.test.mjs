import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s,c,next) { return s === 'three' ? {url:new URL('../../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c); } });
const THREE = await import('three');
const { BaseArena } = await import('../../src/world/arena-base.js');
const { PlayerController } = await import('../../src/gameplay/player/player.js');
const { buildVisionPolygon, VisionConeOverlay, applyVisibilityCulling } = await import('../../src/gameplay/combat/vision-cone.js');
function inside(x,z,points) {
    let yes=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
        const a=points[i],b=points[j];
        if((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x) yes=!yes;
    }
    return yes;
}
test('cone and proximity light cannot leak behind a wall, including between sparse ray directions',()=>{
    const arena = new BaseArena(new THREE.Scene());
    arena.colliders.push(new THREE.Box3(new THREE.Vector3(0.27,0,2),new THREE.Vector3(0.41,3,3)));
    arena.buildSpatialGrid();
    const pos = new THREE.Vector3();
    for(const angle of [5,50,360]) for(const yaw of [-0.03,0,0.03,Math.PI*2+0.03]) {
        const poly=buildVisionPolygon(pos,yaw,15,angle,arena);
        for(let x=0.3;x<0.39;x+=0.02) for(let z=3.1;z<12;z+=0.3) {
            const target = new THREE.Vector3(x*z/2.5,0,z);
            if(!arena.hasLineOfSight(pos,target)) assert.equal(inside(target.x,target.z,poly),false);
        }
    }
    const open=buildVisionPolygon(pos,0,10,50,null);
    assert.ok(inside(0,8,open));
    assert.equal(inside(8,0,open),false);
});
test('ADS interpolation is frame-rate independent and culling uses the displayed cone',()=>{
    const results=[];
    for(const hz of [30,60,144]) {
        const overlay=Object.create(VisionConeOverlay.prototype);
        Object.assign(overlay,{currentRange:20,currentAngle:50,currentProximity:2});
        const player={position:new THREE.Vector3(),aimYaw:0,weapons:{getCurrentWeapon:()=>({id:'awp'})}};
        overlay.update(player,0);player.isADS=true;
        for(let i=0;i<hz;i++) overlay.update(player,1/hz);
        results.push(overlay.getConfig());
        const enemy={position:new THREE.Vector3(0,0,60),mesh:{visible:false}};
        applyVisibilityCulling([player],[enemy],null,null,()=>overlay.getConfig());
        assert.equal(enemy.mesh.visible,true);
        enemy.position.set(15,0,5);
        applyVisibilityCulling([player],[enemy],null,null,()=>overlay.getConfig());
        assert.equal(enemy.mesh.visible,false);
    }
    for(const cfg of results) for(const key of Object.keys(cfg)) assert.ok(Math.abs(cfg[key]-results[0][key])<1e-8);
});
test('TDM camera converges independently of stale aim, keeps orientation and centres in the deadzone',()=>{
    globalThis.window={game:{gameMode:'TDM'}};
    try {
        const finals=[];
        for(const hz of [30,60,144]) {
            const p=Object.create(PlayerController.prototype);
            Object.assign(p,{position:new THREE.Vector3(),cameraOffset:new THREE.Vector3(0,26,18),cameraFocus:new THREE.Vector3(0,0.7,0),
                camera:new THREE.OrthographicCamera(-26,26,16,-16,0.1,300),pointer:new THREE.Vector2(0.8,0.4),
                aimPoint:new THREE.Vector3(),weapons:{getCurrentWeapon:()=>({id:'awp'})},isADS:true});
            p.updateCamera(0);const rotation=p.camera.quaternion.clone();
            for(let i=0;i<hz;i++) {
                p.aimPoint.set(i%2?100:-100,0,80);
                p.updateCamera(1/hz);
                assert.ok(p.camera.quaternion.angleTo(rotation)<1e-6);
                assert.ok(p.cameraFocus.length()<9);
            }
            finals.push(p.cameraFocus.clone());
            p.pointer.set(0.04,-0.04);
            for(let i=0;i<hz;i++)p.updateCamera(1/hz);
            assert.ok(Math.hypot(p.cameraFocus.x,p.cameraFocus.z)<0.001);
        }
        for(const end of finals)assert.ok(end.distanceTo(finals[0])<1e-8);
    } finally {delete globalThis.window;}
});
test('space gate allows player and vision through center while pillars remain solid', () => {
    const arena = new BaseArena(new THREE.Scene());
    arena.models['space/gate'] = new THREE.Object3D();
    arena.placeInstance('space/gate', new THREE.Vector3(0, 0, 18), Math.PI, 1, true);
    arena.buildSpatialGrid();

    // Đi qua tâm cổng không bị va chạm
    assert.equal(arena.checkCollision(new THREE.Vector3(0, 0, 18), 0.55), false);
    // Hai bên cột trụ vẫn cản va chạm
    assert.equal(arena.checkCollision(new THREE.Vector3(1.6, 0, 18), 0.3), true);
    assert.equal(arena.checkCollision(new THREE.Vector3(-1.6, 0, 18), 0.3), true);
    // Tầm nhìn xuyên qua giữa cổng
    assert.equal(arena.hasLineOfSight(new THREE.Vector3(0, 0, 15), new THREE.Vector3(0, 0, 21)), true);
    // Tầm nhìn bị cột trụ cản
    assert.equal(arena.hasLineOfSight(new THREE.Vector3(1.6, 0, 15), new THREE.Vector3(1.6, 0, 21)), false);
});

