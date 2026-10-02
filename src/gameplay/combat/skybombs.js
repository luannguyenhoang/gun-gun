import * as THREE from 'three';
import { sounds } from '../../audio/audio.js';

// Host owns damage; guests only render the replicated warning and falling bomb.
export class SkyBombs {
    constructor(scene, particles) { this.scene = scene; this.particles = particles; this.items = new Map(); this.nextId = 1; }
    spawn(position, damage, id = this.nextId++) {
        const target = position.clone().setY(0.06);
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 40), new THREE.MeshBasicMaterial({color:0xff5533, side:THREE.DoubleSide, transparent:true, opacity:.8, depthWrite:false}));
        ring.rotation.x = -Math.PI/2; ring.position.copy(target);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshStandardMaterial({color:0x292333, emissive:0xff4400, emissiveIntensity:.5}));
        this.scene.add(ring, mesh);
        const bomb = {id, target, damage, remaining:1.8, radius:2.5, ring, mesh};
        this.items.set(id,bomb); this.draw(bomb); return bomb;
    }
    draw(b) {
        b.ring.material.opacity = .5 + .4 * Math.abs(Math.sin(b.remaining * 12));
        b.mesh.position.copy(b.target); b.mesh.position.y += .3 + 14 * Math.min(1, Math.max(0,b.remaining)/.8);
        b.mesh.visible = b.remaining <= .8;
    }
    remove(id, explode = false) {
        const b = this.items.get(id); if (!b) return;
        if (explode) {
            this.particles?.createExplosion?.(b.target, 0xff4411, 28, (b.radius || 2.5) * 1.5);
            sounds?.play?.('enemyDestroy', { volume: 1.0, rate: 0.85 });
        }
        for (const mesh of [b.ring, b.mesh]) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); }
        this.items.delete(id);
    }
    update(delta, players = [], authoritative = true) {
        for (const b of this.items.values()) {
            b.remaining = Math.max(0, b.remaining - delta); this.draw(b);
            if (b.remaining > 0 || !authoritative) continue;
            for (const p of players) {
                if (!p.isDead) {
                    const dist = Math.hypot(p.position.x - b.target.x, p.position.z - b.target.z);
                    if (dist <= b.radius) {
                        p.takeDamage(b.damage, p.position.clone().sub(b.target).setY(0).normalize());
                        p.applyKickbackAndShake?.(3.5, 0.4);
                    } else if (dist <= b.radius * 2.2) {
                        p.applyKickbackAndShake?.(1.5, 0.2);
                    }
                }
            }
            this.remove(b.id, true);
        }
    }
    snapshot(){return [...this.items.values()].map(b=>({id:b.id,position:b.target.toArray(),remaining:b.remaining,damage:b.damage}));}
    applySnapshot(states) {
        const ids=new Set(states.map(s=>s.id));
        for(const s of states){const b=this.items.get(s.id)||this.spawn(new THREE.Vector3().fromArray(s.position),s.damage,s.id);b.remaining=s.remaining;this.draw(b);}
        for(const id of this.items.keys())if(!ids.has(id))this.remove(id,true);
    }
    clear(){for(const id of this.items.keys())this.remove(id);}
}
