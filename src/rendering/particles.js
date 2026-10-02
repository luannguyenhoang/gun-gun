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

        // Geometries dùng chung cho hiệu ứng nổ (tránh tạo/hủy geometry liên tục gây lag)
        this.fireballGeo = new THREE.IcosahedronGeometry(1.0, 2);
        this.shockwaveGeo = new THREE.RingGeometry(0.2, 0.8, 32);
        this.shockwaveGeo.rotateX(-Math.PI / 2);
        this.smokeGeo = new THREE.IcosahedronGeometry(0.5, 1);
        this.explosions = [];
        this.maxExplosions = 12;
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

    createKnifeSlash(position, direction, color = 0x99e6ff, range = 1.1) {
        if (this.muzzleFlashes.length >= 24) return;
        const startPosition = position.clone();
        const thrustGroup = new THREE.Group();
        thrustGroup.position.copy(position);
        
        // Mũi nhọn đâm tới (Thrust Cone)
        const coneGeo = new THREE.ConeGeometry(0.18, range * 0.8, 8);
        coneGeo.rotateX(Math.PI / 2); // Chỉa về trục Z
        coneGeo.translate(0, 0, range * 0.4);
        
        const coneMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);

        // Lõi sáng trắng bên trong
        const coreGeo = new THREE.ConeGeometry(0.07, range * 0.7, 8);
        coreGeo.rotateX(Math.PI / 2);
        coreGeo.translate(0, 0, range * 0.35);
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
        
        this.createImpactSparks(position.clone().addScaledVector(direction, range), direction, color, 6);

        this.muzzleFlashes.push({
            obj: thrustGroup,
            mat: coneMat,
            extraMat: coreMat,
            onUpdate: (delta, progress) => {
                // Động tác đâm lao về phía trước
                thrustGroup.position.copy(startPosition).addScaledVector(direction, range * 0.2 * (1 - progress));
                const scale = 0.6 + progress * 0.4;
                thrustGroup.scale.setScalar(scale);
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

    createExplosion(position, color = 0xff6600, debrisCount = 18, radius = 4.0) {
        // Flash light
        const flashLight = new THREE.Object3D();
        flashLight.position.copy(position);
        if (this.muzzleFlashes.length < 24) {
            this.muzzleFlashes.push({
                obj: flashLight,
                lightColor: color || 0xffaa22,
                life: 0.22,
                maxLife: 0.22
            });
        }

        // Tạo chớp sáng cục bộ rực rỡ
        if (this.effectLight) {
            this.effectLight.color.setHex(color || 0xffaa22);
            this.effectLight.intensity = 18;
            this.effectLight.position.copy(position);
        }

        // Tạo cụm hiệu ứng thị giác nổ 3D (Fireball + Shockwave ring + Smoke billows)
        if (this.explosions.length < this.maxExplosions) {
            const expGroup = new THREE.Group();
            expGroup.position.copy(position);

            // 1. Quả cầu lửa lõi sáng trắng chớp tắt nhanh
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending
            });
            const coreMesh = new THREE.Mesh(this.fireballGeo, coreMat);
            coreMesh.scale.setScalar(0.4);
            expGroup.add(coreMesh);

            // 2. Quả cầu lửa bùng nổ chính
            const fireMat = new THREE.MeshBasicMaterial({
                color: color || 0xff5500,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending
            });
            const fireMesh = new THREE.Mesh(this.fireballGeo, fireMat);
            fireMesh.scale.setScalar(0.6);
            expGroup.add(fireMesh);

            // 3. Các khối lửa phụ cuộn quanh tạo chùm nổ tự nhiên
            const billows = [];
            for (let b = 0; b < 3; b++) {
                const bMat = new THREE.MeshBasicMaterial({
                    color: color || 0xff6600,
                    transparent: true,
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending
                });
                const bMesh = new THREE.Mesh(this.fireballGeo, bMat);
                bMesh.position.set(
                    (Math.random() - 0.5) * 0.6,
                    Math.random() * 0.4,
                    (Math.random() - 0.5) * 0.6
                );
                bMesh.scale.setScalar(0.35 + Math.random() * 0.25);
                expGroup.add(bMesh);
                billows.push({ mesh: bMesh, mat: bMat });
            }

            // 4. Vòng sóng xung kích lan tỏa trên mặt đất (Ground Shockwave Ring)
            const ringMat = new THREE.MeshBasicMaterial({
                color: color || 0xff7722,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ringMesh = new THREE.Mesh(this.shockwaveGeo, ringMat);
            ringMesh.position.y = 0.05 - position.y; // Căn sát mặt đất world y ~ 0.05
            ringMesh.scale.setScalar(0.5);
            expGroup.add(ringMesh);

            // 5. Cụm khói đen/xám bốc lên cuồn cuộn
            const smokePuffs = [];
            for (let s = 0; s < 5; s++) {
                const sMat = new THREE.MeshBasicMaterial({
                    color: 0x222226,
                    transparent: true,
                    opacity: 0.55
                });
                const sMesh = new THREE.Mesh(this.smokeGeo, sMat);
                sMesh.position.set(
                    (Math.random() - 0.5) * 0.8,
                    Math.random() * 0.5,
                    (Math.random() - 0.5) * 0.8
                );
                const sVel = new THREE.Vector3(
                    (Math.random() - 0.5) * 1.5,
                    1.2 + Math.random() * 1.8,
                    (Math.random() - 0.5) * 1.5
                );
                expGroup.add(sMesh);
                smokePuffs.push({
                    mesh: sMesh,
                    mat: sMat,
                    velocity: sVel,
                    rotVel: (Math.random() - 0.5) * 4
                });
            }

            this.scene.add(expGroup);

            this.explosions.push({
                group: expGroup,
                coreMesh,
                coreMat,
                fireMesh,
                fireMat,
                billows,
                ringMesh,
                ringMat,
                smokePuffs,
                age: 0,
                maxLife: 0.85,
                targetRadius: radius || 4.0
            });
        }

        // Sparks
        this.createImpactSparks(position, new THREE.Vector3(0, 1, 0), color || 0xffaa00, 24);

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
        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.age += delta;

            if (exp.age >= exp.maxLife) {
                this.scene.remove(exp.group);
                exp.coreMat?.dispose();
                exp.fireMat?.dispose();
                exp.ringMat?.dispose();
                for (const b of exp.billows) b.mat?.dispose();
                for (const s of exp.smokePuffs) s.mat?.dispose();
                this.explosions.splice(i, 1);
                continue;
            }

            // Lõi trắng nở cực nhanh và tắt trong 0.2s
            if (exp.coreMesh && exp.coreMat) {
                if (exp.age < 0.2) {
                    const coreT = exp.age / 0.2;
                    const scale = 0.4 + (exp.targetRadius * 0.6) * (1 - Math.pow(1 - coreT, 2));
                    exp.coreMesh.scale.setScalar(scale);
                    exp.coreMat.opacity = 1 - coreT;
                } else {
                    exp.coreMesh.visible = false;
                }
            }

            // Quả cầu lửa chính nở to và mờ dần trong 0.45s
            if (exp.fireMesh && exp.fireMat) {
                if (exp.age < 0.45) {
                    const fireT = exp.age / 0.45;
                    const scale = 0.6 + (exp.targetRadius * 0.85) * (1 - Math.pow(1 - fireT, 3));
                    exp.fireMesh.scale.setScalar(scale);
                    exp.fireMat.opacity = Math.max(0, 0.95 * (1 - fireT));
                } else {
                    exp.fireMesh.visible = false;
                }
            }

            // Các khối lửa billow cuộn xoay nhẹ
            for (const b of exp.billows) {
                if (exp.age < 0.45) {
                    const fireT = exp.age / 0.45;
                    b.mesh.scale.setScalar((0.5 + exp.targetRadius * 0.6) * (1 - Math.pow(1 - fireT, 2.5)));
                    b.mat.opacity = Math.max(0, 0.8 * (1 - fireT));
                    b.mesh.rotation.y += delta * 2.0;
                } else {
                    b.mesh.visible = false;
                }
            }

            // Vòng sóng xung kích lan tỏa trên mặt đất trong 0.38s
            if (exp.ringMesh && exp.ringMat) {
                if (exp.age < 0.38) {
                    const ringT = exp.age / 0.38;
                    const ringScale = 0.5 + (exp.targetRadius * 1.5) * (1 - Math.pow(1 - ringT, 2));
                    exp.ringMesh.scale.setScalar(ringScale);
                    exp.ringMat.opacity = Math.max(0, 0.85 * (1 - ringT * ringT));
                } else {
                    exp.ringMesh.visible = false;
                }
            }

            // Khói bốc lên cuồn cuộn và tan dần
            for (const s of exp.smokePuffs) {
                s.mesh.position.addScaledVector(s.velocity, delta);
                s.velocity.y += delta * 0.5;
                s.mesh.rotation.y += s.rotVel * delta;
                const smokeT = exp.age / exp.maxLife;
                const sScale = 0.6 + (exp.targetRadius * 0.4) * (0.5 + smokeT * 1.5);
                s.mesh.scale.setScalar(sScale);
                s.mat.opacity = Math.max(0, 0.55 * (1 - smokeT));
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
        for (const exp of this.explosions) {
            this.scene.remove(exp.group);
            exp.coreMat?.dispose();
            exp.fireMat?.dispose();
            exp.ringMat?.dispose();
            for (const b of exp.billows) b.mat?.dispose();
            for (const s of exp.smokePuffs) s.mat?.dispose();
        }
        this.effectLight.intensity = 0;
        this.particles = [];
        this.debris = [];
        this.muzzleFlashes = [];
        this.explosions = [];
    }
}
