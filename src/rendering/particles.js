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

        // Cấu hình tối ưu hóa hiệu năng (Mặc định tắt hiệu ứng nòng súng & tia lửa để đạt FPS tối đa)
        this.muzzleFlashEnabled = false;
        this.sparksEnabled = false;
        this.sparksCountMultiplier = 0;
        this.effectLightEnabled = false;

        // Pool tái sử dụng Muzzle Flash tránh tạo mới và dispose Material liên tục gây micro-stutter
        this.muzzlePool = [];

        // Texture lửa, khói và tia lửa nòng súng chất lượng cao (Kenney Particle Pack)
        this.textures = { fire: [], smoke: [], muzzle: [] };
        this.initTextures();
    }

    setQuality({ muzzleFlash = false, bulletSparks = false, effectLight = false } = {}) {
        this.muzzleFlashEnabled = !!muzzleFlash;
        this.sparksEnabled = !!bulletSparks;
        this.sparksCountMultiplier = bulletSparks ? 1.0 : 0;
        this.effectLightEnabled = !!effectLight;
        if (!this.effectLightEnabled && this.effectLight) {
            this.effectLight.intensity = 0;
        }
    }

    initTextures() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        try {
            const loader = new THREE.TextureLoader();
            const firePaths = [
                'assets/textures/particles/fire_01.png',
                'assets/textures/particles/fire_02.png',
                'assets/textures/particles/flame_01.png',
                'assets/textures/particles/flame_02.png',
                'assets/textures/particles/flame_03.png'
            ];
            const smokePaths = [
                'assets/textures/particles/smoke_01.png',
                'assets/textures/particles/smoke_02.png',
                'assets/textures/particles/smoke_03.png',
                'assets/textures/particles/smoke_04.png'
            ];
            const muzzlePaths = [
                'assets/textures/particles/muzzle_01.png',
                'assets/textures/particles/muzzle_02.png',
                'assets/textures/particles/muzzle_03.png',
                'assets/textures/particles/muzzle_04.png'
            ];

            firePaths.forEach(path => {
                loader.load(path, (tex) => {
                    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    this.textures.fire.push(tex);
                }, undefined, () => {});
            });

            smokePaths.forEach(path => {
                loader.load(path, (tex) => {
                    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    this.textures.smoke.push(tex);
                }, undefined, () => {});
            });

            muzzlePaths.forEach(path => {
                loader.load(path, (tex) => {
                    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                    this.textures.muzzle.push(tex);
                }, undefined, () => {});
            });
        } catch {}
    }

    createMuzzleFlash(position, direction, color = 0x00f0ff) {
        // Nếu đã tắt tia lửa nòng súng để tối ưu hiệu năng: bỏ qua ngay lập tức
        if (!this.muzzleFlashEnabled) return;
        if (this.muzzleFlashes.length >= 16) return;

        // Tái sử dụng đối tượng từ pool nếu có để tránh cấp phát bộ nhớ liên tục
        let entry = this.muzzlePool.pop();
        if (!entry) {
            const flashGroup = new THREE.Group();
            let sprite = null;
            let mat = null;
            let smokeSprite = null;
            let smokeMat = null;

            if (this.textures?.muzzle?.length > 0) {
                const mTex = this.textures.muzzle[0];
                mat = new THREE.SpriteMaterial({
                    map: mTex,
                    color: color || 0xffbb33,
                    transparent: true,
                    opacity: 0.95,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                sprite = new THREE.Sprite(mat);
                sprite.scale.set(0.48, 0.48, 1);
                flashGroup.add(sprite);

                if (this.textures?.smoke?.length > 0) {
                    smokeMat = new THREE.SpriteMaterial({
                        map: this.textures.smoke[0],
                        color: 0x9999aa,
                        transparent: true,
                        opacity: 0.35,
                        blending: THREE.NormalBlending,
                        depthWrite: false
                    });
                    smokeSprite = new THREE.Sprite(smokeMat);
                    smokeSprite.scale.set(0.25, 0.25, 1);
                    flashGroup.add(smokeSprite);
                }
            } else {
                const geo = new THREE.SphereGeometry(0.15, 6, 6);
                mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
                const mesh = new THREE.Mesh(geo, mat);
                flashGroup.add(mesh);
            }

            entry = {
                obj: flashGroup,
                sprite,
                mat,
                smokeSprite,
                smokeMat,
                inScene: false
            };
        }

        entry.obj.position.copy(position);
        if (entry.mat) {
            entry.mat.color.setHex(color || 0xffbb33);
            entry.mat.opacity = 0.95;
            if (entry.mat.rotation !== undefined) entry.mat.rotation = Math.random() * Math.PI * 2;
        }
        if (entry.sprite) {
            entry.sprite.scale.set(0.48, 0.48, 1);
        }
        if (entry.smokeSprite && entry.smokeMat) {
            entry.smokeMat.opacity = 0.35;
            if (direction) {
                entry.smokeSprite.position.copy(direction).multiplyScalar(0.15);
            }
        }

        if (!entry.inScene) {
            this.scene.add(entry.obj);
            entry.inScene = true;
        } else {
            entry.obj.visible = true;
        }

        this.muzzleFlashes.push({
            entry: entry,
            obj: entry.obj,
            lightColor: color,
            mat: entry.mat,
            extraMat: entry.smokeMat,
            life: 0.07,
            maxLife: 0.07,
            onUpdate: (delta, progress) => {
                const s = 0.48 * (1 - progress * 0.4);
                if (entry.sprite) entry.sprite.scale.set(s, s, 1);
                if (entry.mat) entry.mat.opacity = Math.max(0, 0.95 * (1 - progress));
                if (entry.smokeSprite && entry.smokeMat) {
                    const ss = 0.25 + progress * 0.25;
                    entry.smokeSprite.scale.set(ss, ss, 1);
                    entry.smokeMat.opacity = Math.max(0, 0.35 * (1 - progress));
                }
            }
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
        // Nếu đã tắt tia lửa va chạm đạn để tăng FPS: bỏ qua ngay lập tức
        if (!this.sparksEnabled || this.sparksCountMultiplier <= 0) return;

        const mat = color === 0xff2255 ? this.critSparkMaterial : 
                    color === 0xffaa00 ? this.orangeSparkMaterial : this.sparkMaterial;

        const effectiveCount = Math.max(1, Math.round(count * this.sparksCountMultiplier));
        const available = Math.min(effectiveCount, this.maxSparks - this.particles.length);
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

        // Tạo cụm hiệu ứng thị giác nổ (Texture Sprite từ Kenney Particle Pack hoặc Fallback Mesh)
        if (this.explosions.length < this.maxExplosions) {
            const expGroup = new THREE.Group();
            expGroup.position.copy(position);

            const hasFire = this.textures.fire && this.textures.fire.length > 0;
            const hasSmoke = this.textures.smoke && this.textures.smoke.length > 0;
            const hasTextures = hasFire || hasSmoke;

            if (hasTextures) {
                // SỬ DỤNG SPRITE TEXTURE CHẤT LƯỢNG CAO TỪ KENNEY PARTICLE PACK
                const fireList = hasFire ? this.textures.fire : this.textures.smoke;
                const smokeList = hasSmoke ? this.textures.smoke : this.textures.fire;

                // 1. Quả cầu lửa lõi trắng bùng nổ cực nhanh
                const coreTex = fireList[0];
                const coreMat = new THREE.SpriteMaterial({
                    map: coreTex,
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1.0,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    rotation: Math.random() * Math.PI * 2
                });
                const coreSprite = new THREE.Sprite(coreMat);
                coreSprite.scale.set(0.6, 0.6, 1);
                expGroup.add(coreSprite);

                // 2. Quả cầu lửa chính rực sáng
                const fireTex = fireList[Math.floor(Math.random() * fireList.length)];
                const fireMat = new THREE.SpriteMaterial({
                    map: fireTex,
                    color: color || 0xff6611,
                    transparent: true,
                    opacity: 0.95,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    rotation: Math.random() * Math.PI * 2
                });
                const fireSprite = new THREE.Sprite(fireMat);
                fireSprite.scale.set(0.9, 0.9, 1);
                expGroup.add(fireSprite);

                // 3. Các khối lửa phụ cuộn quanh tạo chùm nổ tự nhiên
                const billows = [];
                for (let b = 0; b < 3; b++) {
                    const bTex = fireList[Math.floor(Math.random() * fireList.length)];
                    const bMat = new THREE.SpriteMaterial({
                        map: bTex,
                        color: color || 0xff7722,
                        transparent: true,
                        opacity: 0.85,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        rotation: Math.random() * Math.PI * 2
                    });
                    const bSprite = new THREE.Sprite(bMat);
                    bSprite.position.set(
                        (Math.random() - 0.5) * 0.7,
                        Math.random() * 0.5,
                        (Math.random() - 0.5) * 0.7
                    );
                    bSprite.scale.set(0.6, 0.6, 1);
                    expGroup.add(bSprite);
                    billows.push({ sprite: bSprite, mat: bMat, rotVel: (Math.random() - 0.5) * 3.5 });
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
                ringMesh.position.y = 0.05 - position.y;
                ringMesh.scale.setScalar(0.5);
                expGroup.add(ringMesh);

                // 5. Cụm khói đen/xám bốc lên cuồn cuộn
                const smokePuffs = [];
                for (let s = 0; s < 6; s++) {
                    const sTex = smokeList[Math.floor(Math.random() * smokeList.length)];
                    const sMat = new THREE.SpriteMaterial({
                        map: sTex,
                        color: 0x333338,
                        transparent: true,
                        opacity: 0.68,
                        blending: THREE.NormalBlending,
                        depthWrite: false,
                        rotation: Math.random() * Math.PI * 2
                    });
                    const sSprite = new THREE.Sprite(sMat);
                    sSprite.position.set(
                        (Math.random() - 0.5) * 0.9,
                        0.2 + Math.random() * 0.4,
                        (Math.random() - 0.5) * 0.9
                    );
                    sSprite.scale.set(0.6, 0.6, 1);
                    const sVel = new THREE.Vector3(
                        (Math.random() - 0.5) * 1.6,
                        1.4 + Math.random() * 1.8,
                        (Math.random() - 0.5) * 1.6
                    );
                    expGroup.add(sSprite);
                    smokePuffs.push({
                        sprite: sSprite,
                        mat: sMat,
                        velocity: sVel,
                        rotVel: (Math.random() - 0.5) * 2.8
                    });
                }

                this.scene.add(expGroup);

                this.explosions.push({
                    isSprite: true,
                    group: expGroup,
                    coreSprite,
                    coreMat,
                    fireSprite,
                    fireMat,
                    fireRotVel: (Math.random() - 0.5) * 3.0,
                    billows,
                    ringMesh,
                    ringMat,
                    smokePuffs,
                    age: 0,
                    maxLife: 0.9,
                    targetRadius: radius || 4.0
                });
            } else {
                // FALLBACK MESH CHO MÔI TRƯỜNG TEST HOẶC CHƯA KỊP NẠP TEXTURE
                const coreMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1.0,
                    blending: THREE.AdditiveBlending
                });
                const coreMesh = new THREE.Mesh(this.fireballGeo, coreMat);
                coreMesh.scale.setScalar(0.4);
                expGroup.add(coreMesh);

                const fireMat = new THREE.MeshBasicMaterial({
                    color: color || 0xff5500,
                    transparent: true,
                    opacity: 0.95,
                    blending: THREE.AdditiveBlending
                });
                const fireMesh = new THREE.Mesh(this.fireballGeo, fireMat);
                fireMesh.scale.setScalar(0.6);
                expGroup.add(fireMesh);

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

                const ringMat = new THREE.MeshBasicMaterial({
                    color: color || 0xff7722,
                    transparent: true,
                    opacity: 0.85,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                const ringMesh = new THREE.Mesh(this.shockwaveGeo, ringMat);
                ringMesh.position.y = 0.05 - position.y;
                ringMesh.scale.setScalar(0.5);
                expGroup.add(ringMesh);

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
                    isSprite: false,
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
        if (this.effectLight) {
            this.effectLight.intensity = 0;
        }
        // Update muzzle flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const f = this.muzzleFlashes[i];
            f.life -= delta;
            const progress = Math.max(0, f.life / f.maxLife);
            if (this.effectLightEnabled && f.lightColor !== undefined && progress * 8 > this.effectLight.intensity) {
                this.effectLight.intensity = progress * 8;
                this.effectLight.color.setHex(f.lightColor);
                this.effectLight.position.copy(f.obj.position);
            }
            if (f.mat) f.mat.opacity = progress;
            if (f.extraMat) f.extraMat.opacity = progress * 0.85;
            if (f.onUpdate) f.onUpdate(delta, progress);

            if (f.life <= 0) {
                if (f.entry) {
                    // Tái sử dụng đối tượng vào pool thay vì hủy và tạo mới liên tục
                    f.entry.obj.visible = false;
                    if (this.muzzlePool.length < 24) {
                        this.muzzlePool.push(f.entry);
                    } else {
                        this.scene.remove(f.entry.obj);
                    }
                } else {
                    this.scene.remove(f.obj);
                    if (f.obj.traverse) {
                        f.obj.traverse(c => {
                            if (c.geometry) c.geometry.dispose();
                            if (c.material) c.material.dispose();
                        });
                    }
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

            if (exp.isSprite) {
                // XỬ LÝ ANIMATION CHO SPRITE KHÓI LỬA
                // Lõi trắng nở cực nhanh và tắt trong 0.2s
                if (exp.coreSprite && exp.coreMat) {
                    if (exp.age < 0.2) {
                        const coreT = exp.age / 0.2;
                        const scale = 0.5 + (exp.targetRadius * 0.75) * (1 - Math.pow(1 - coreT, 2));
                        exp.coreSprite.scale.set(scale, scale, 1);
                        exp.coreMat.opacity = 1 - coreT;
                    } else {
                        exp.coreSprite.visible = false;
                    }
                }

                // Cầu lửa chính nở to rực sáng và mờ dần trong 0.45s
                if (exp.fireSprite && exp.fireMat) {
                    if (exp.age < 0.45) {
                        const fireT = exp.age / 0.45;
                        const scale = 0.8 + (exp.targetRadius * 1.15) * (1 - Math.pow(1 - fireT, 3));
                        exp.fireSprite.scale.set(scale, scale, 1);
                        exp.fireMat.opacity = Math.max(0, 0.95 * (1 - fireT));
                        exp.fireMat.rotation += exp.fireRotVel * delta;
                    } else {
                        exp.fireSprite.visible = false;
                    }
                }

                // Các khối lửa phụ cuộn xoay nhẹ
                for (const b of exp.billows) {
                    if (exp.age < 0.45) {
                        const fireT = exp.age / 0.45;
                        const scale = (0.6 + exp.targetRadius * 0.8) * (1 - Math.pow(1 - fireT, 2.5));
                        b.sprite.scale.set(scale, scale, 1);
                        b.mat.opacity = Math.max(0, 0.85 * (1 - fireT));
                        b.mat.rotation += b.rotVel * delta;
                    } else {
                        b.sprite.visible = false;
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

                // Khói bốc lên cuồn cuộn, nở to và tan biến mềm mại
                for (const s of exp.smokePuffs) {
                    s.sprite.position.addScaledVector(s.velocity, delta);
                    s.velocity.y += delta * 0.4;
                    s.velocity.x *= 0.98;
                    s.velocity.z *= 0.98;
                    s.mat.rotation += s.rotVel * delta;
                    const smokeT = exp.age / exp.maxLife;
                    const sScale = 0.8 + (exp.targetRadius * 0.5) * (0.6 + smokeT * 1.8);
                    s.sprite.scale.set(sScale, sScale, 1);
                    s.mat.opacity = Math.max(0, 0.68 * (1 - smokeT));
                }
            } else {
                // FALLBACK MESH NẾU CHƯA CÓ TEXTURE
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
