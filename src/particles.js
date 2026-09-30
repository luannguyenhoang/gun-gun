import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.debris = [];
        this.muzzleFlashes = [];
        this.sparkPool = [];
        this.maxSparks = 160;
        this.maxDebris = 48;
        // Keep light count stable so shooting does not recompile scene materials.
        this.effectLight = new THREE.PointLight(0xffaa22, 0, 8);
        this.scene.add(this.effectLight);

        // Pre-create reusable materials for performance
        this.sparkMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 1
        });
        this.orangeSparkMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 1
        });
        this.critSparkMaterial = new THREE.MeshBasicMaterial({
            color: 0xff2255,
            transparent: true,
            opacity: 1
        });
        this.smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x556677,
            transparent: true,
            opacity: 0.6
        });
        this.sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        this.debrisGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    }

    createMuzzleFlash(position, direction, color = 0x00f0ff) {
        if (this.muzzleFlashes.length >= 24) return;
        const flashGroup = new THREE.Group();
        flashGroup.position.copy(position);

        const geo = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        flashGroup.add(mesh);

        this.scene.add(flashGroup);
        this.muzzleFlashes.push({
            obj: flashGroup,
            lightColor: color,
            mat: mat,
            life: 0.06,
            maxLife: 0.06
        });
    }

    createKnifeSlash(position, direction, color = 0x99e6ff) {
        if (this.muzzleFlashes.length >= 24) return;
        const thrustGroup = new THREE.Group();
        thrustGroup.position.copy(position).addScaledVector(direction, 0.5);
        
        // Mũi nhọn đâm tới (Thrust Cone)
        const coneGeo = new THREE.ConeGeometry(0.5, 3.5, 8);
        coneGeo.rotateX(Math.PI / 2); // Chỉa về trục Z
        coneGeo.translate(0, 0, 1.75); // Đưa gốc về tay
        
        const coneMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);

        // Lõi sáng trắng bên trong
        const coreGeo = new THREE.ConeGeometry(0.2, 3.2, 8);
        coreGeo.rotateX(Math.PI / 2);
        coreGeo.translate(0, 0, 1.6);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);

        thrustGroup.add(coneMesh, coreMesh);
        
        // Định hướng đâm theo hướng nhìn
        thrustGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

        this.scene.add(thrustGroup);
        
        this.createImpactSparks(position.clone().addScaledVector(direction, 1.8), direction, color, 6);

        this.muzzleFlashes.push({
            obj: thrustGroup,
            mat: coneMat,
            extraMat: coreMat,
            onUpdate: (delta, progress) => {
                // Động tác đâm lao về phía trước
                thrustGroup.position.addScaledVector(direction, delta * 22 * progress);
                const scale = 0.6 + progress * 0.4;
                thrustGroup.scale.set(scale * 0.4, scale * 0.4, scale * 1.5);
            },
            life: 0.12,
            maxLife: 0.12
        });
    }

    createImpactSparks(position, normal, color = 0x00f0ff, count = 10) {
        const mat = color === 0xff2255 ? this.critSparkMaterial : 
                    color === 0xffaa00 ? this.orangeSparkMaterial : this.sparkMaterial;

        const available = Math.min(count, this.maxSparks - this.particles.length);
        for (let i = 0; i < available; i++) {
            const particle = this.sparkPool.pop() || {
                mesh: new THREE.Mesh(this.sparkGeo, mat.clone()),
                velocity: new THREE.Vector3(), maxLife: 0.45, gravity: 9.8, drag: 0.92
            };
            const mesh = particle.mesh;
            mesh.material.color.copy(mat.color);
            mesh.material.opacity = 1;
            mesh.scale.setScalar(1);
            mesh.position.copy(position);

            const spread = 0.8;
            particle.velocity.set(
                normal.x + (Math.random() - 0.5) * spread,
                normal.y + (Math.random() - 0.5) * spread,
                normal.z + (Math.random() - 0.5) * spread
            ).normalize().multiplyScalar(4 + Math.random() * 6);

            this.scene.add(mesh);
            particle.life = 0.25 + Math.random() * 0.2;
            this.particles.push(particle);
        }
    }

    createExplosion(position, color = 0xff6600, debrisCount = 18) {
        // Flash light
        const flashLight = new THREE.Object3D();
        flashLight.position.copy(position);
        if (this.muzzleFlashes.length < 24) this.muzzleFlashes.push({
            obj: flashLight,
            lightColor: 0xffaa22,
            life: 0.2,
            maxLife: 0.2
        });

        // Sparks
        this.createImpactSparks(position, new THREE.Vector3(0, 1, 0), 0xffaa00, 24);

        // Debris pieces
        const debrisColors = [0x333333, 0xff5500, 0x8899aa, 0x111111];
        const available = Math.min(debrisCount, this.maxDebris - this.debris.length);
        for (let i = 0; i < available; i++) {
            const dColor = debrisColors[Math.floor(Math.random() * debrisColors.length)];
            const mat = new THREE.MeshStandardMaterial({
                color: dColor,
                roughness: 0.4,
                metalness: 0.8
            });
            const mesh = new THREE.Mesh(this.debrisGeo, mat);
            mesh.position.copy(position);

            const angle = Math.random() * Math.PI * 2;
            const elevation = (Math.random() - 0.2) * Math.PI;
            const speed = 4 + Math.random() * 8;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * Math.cos(elevation) * speed,
                Math.sin(elevation) * speed + 3,
                Math.sin(angle) * Math.cos(elevation) * speed
            );

            const rotVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 12
            );

            this.scene.add(mesh);
            this.debris.push({
                mesh: mesh,
                velocity: velocity,
                rotVelocity: rotVelocity,
                life: 1.2 + Math.random() * 0.8,
                maxLife: 2.0,
                gravity: 16.0,
                bounce: 0.5
            });
        }
    }

    createShieldHit(position) {
        this.createImpactSparks(position, new THREE.Vector3(0, 1, 0), 0x00f0ff, 12);
    }

    update(delta) {
        this.effectLight.intensity = 0;
        // Update muzzle flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const f = this.muzzleFlashes[i];
            f.life -= delta;
            const progress = Math.max(0, f.life / f.maxLife);
            if (f.lightColor !== undefined && progress * 8 > this.effectLight.intensity) {
                this.effectLight.intensity = progress * 8;
                this.effectLight.color.setHex(f.lightColor);
                this.effectLight.position.copy(f.obj.position);
            }
            if (f.mat) f.mat.opacity = progress;
            if (f.extraMat) f.extraMat.opacity = progress * 0.85;
            if (f.onUpdate) f.onUpdate(delta, progress);

            if (f.life <= 0) {
                this.scene.remove(f.obj);
                if (f.obj.traverse) {
                    f.obj.traverse(c => {
                        if (c.geometry) c.geometry.dispose();
                        if (c.material) c.material.dispose();
                    });
                }
                this.muzzleFlashes.splice(i, 1);
            }
        }

        // Update sparks
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.sparkPool.push(p);
                this.particles.splice(i, 1);
                continue;
            }

            p.velocity.y -= p.gravity * delta;
            p.velocity.multiplyScalar(Math.pow(p.drag, delta * 60));
            p.mesh.position.addScaledVector(p.velocity, delta);

            const scale = Math.max(0.01, p.life / p.maxLife);
            p.mesh.scale.set(scale, scale, scale);
            if (p.mesh.material) {
                p.mesh.material.opacity = scale;
            }
        }

        // Update debris
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.life -= delta;

            if (d.life <= 0) {
                this.scene.remove(d.mesh);
                d.mesh.material.dispose();
                this.debris.splice(i, 1);
                continue;
            }

            d.velocity.y -= d.gravity * delta;
            d.mesh.position.addScaledVector(d.velocity, delta);

            // Ground bounce
            if (d.mesh.position.y < 0.1) {
                d.mesh.position.y = 0.1;
                d.velocity.y = -d.velocity.y * d.bounce;
                d.velocity.x *= 0.7;
                d.velocity.z *= 0.7;
            }

            d.mesh.rotation.x += d.rotVelocity.x * delta;
            d.mesh.rotation.y += d.rotVelocity.y * delta;
            d.mesh.rotation.z += d.rotVelocity.z * delta;

            if (d.life < 0.5) {
                const s = d.life / 0.5;
                d.mesh.scale.set(s, s, s);
            }
        }
    }

    clear() {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            this.sparkPool.push(p);
        }
        for (const d of this.debris) {
            this.scene.remove(d.mesh);
            d.mesh.material.dispose();
        }
        for (const f of this.muzzleFlashes) {
            this.scene.remove(f.obj);
            f.obj.traverse(c => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
        }
        this.effectLight.intensity = 0;
        this.particles = [];
        this.debris = [];
        this.muzzleFlashes = [];
    }
}
