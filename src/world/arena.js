import * as THREE from 'three';

const _tempLosDir = new THREE.Vector3();
const _tempLosRay = new THREE.Ray();
const _tempLosHit = new THREE.Vector3();
const _navigationRay = new THREE.Ray();
const _navigationBox = new THREE.Box3();
const _navigationHit = new THREE.Vector3();
const _movementProbe = new THREE.Vector3();

export class Arena {
    constructor(scene, gltfLoader) {
        this.scene = scene;
        this.loader = gltfLoader;
        this.colliders = []; // Array of THREE.Box3 for obstacle collisions
        this.portals = [];
        this.models = {};
        this.halfSize = 28;
        this.radius = 29;
    }

    async loadModels() {
        const modelNames = [
            'floor', 'floor-detail', 'wall', 'wall-corner', 'wall-high', 'wall-low', 'wall-gate',
            'column', 'column-damaged', 'tree', 'stairs', 'platform', 'platform-large-grass',
            'banner', 'block', 'statue', 'trophy', 'weapon-rack',
            'space/template-floor', 'space/template-floor-detail', 'space/template-wall',
            'space/template-wall-corner', 'space/template-wall-half', 'space/gate',
            'space/gate-lasers', 'space/template-detail', 'space/template-floor-layer-raised',
            'space/cables'
        ];

        const promises = modelNames.map(name => {
            return new Promise((resolve) => {
                this.loader.load(
                    `assets/models/${name}.glb`,
                    (gltf) => {
                        this.models[name] = gltf.scene;
                        gltf.scene.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        resolve();
                    },
                    undefined,
                    () => resolve()
                );
            });
        });

        await Promise.all(promises);
    }

    buildArena() {
        this.setupLighting();
        this.buildFloorAndWalls();
        this.buildCenterPlaza();
        this.buildTacticalCover();
        this.buildSpawnPortals();
        this.buildGrass();
    }

    setupLighting() {
        // Ánh sáng môi trường trạm không gian chuyên dụng
        const ambientLight = new THREE.AmbientLight(0x162438, 0.75);
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0x4488bb, 0x111622, 0.6);
        this.scene.add(hemiLight);

        // Nguồn sáng định hướng giả lập ánh sáng vũ trụ rọi qua vòm trạm
        const sun = new THREE.DirectionalLight(0xddeeff, 1.4);
        sun.position.set(24, 35, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 1.0;
        sun.shadow.camera.far = 80;
        const d = 30; // Bao phủ toàn bộ bản đồ 56m x 56m
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        sun.shadow.bias = -0.0005;
        this.sunLight = sun;
        this.scene.add(sun);
        this.scene.add(sun.target);

        // Đèn PointLight neon nhận diện các cứ điểm chiến thuật chính
        const tacticalLights = [
            { pos: [0, 5, 24], color: 0x00d0ff, intensity: 4.2, dist: 28 },   // Căn cứ Đội Xanh (Nam)
            { pos: [0, 5, -24], color: 0xff3b30, intensity: 4.2, dist: 28 },  // Căn cứ Đội Đỏ (Bắc)
            { pos: [0, 5, 0], color: 0xffeedd, intensity: 4.5, dist: 28 },    // Sảnh Mid (Trung tâm)
            { pos: [-18, 5, 0], color: 0xaa33ff, intensity: 4.0, dist: 24 },  // Cứ điểm A (Reactor Alpha)
            { pos: [18, 5, 0], color: 0xff9900, intensity: 4.0, dist: 24 },   // Cứ điểm B (Storage Beta)
        ];
        tacticalLights.forEach(tl => {
            const pl = new THREE.PointLight(tl.color, tl.intensity, tl.dist);
            pl.position.set(tl.pos[0], tl.pos[1], tl.pos[2]);
            this.scene.add(pl);
        });
    }

    placeInstance(modelName, position, rotationY = 0, scale = 1, addCollider = false) {
        const base = this.models[modelName];
        if (!base) return null;

        const clone = base.clone(true);
        clone.position.copy(position);
        clone.rotation.y = rotationY;
        clone.scale.set(scale, scale, scale);
        this.scene.add(clone);

        if (addCollider) {
            clone.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(clone);
            this.colliders.push(box);
        }

        return clone;
    }

    getMeshProps(modelName) {
        const base = this.models[modelName];
        if (!base) return null;
        let geo = null, mat = null;
        base.traverse(c => {
            if (c.isMesh && !geo) {
                geo = c.geometry;
                mat = c.material;
            }
        });
        return { geo, mat };
    }

    buildFloorAndWalls() {
        const halfSize = this.halfSize; // 28m
        const tileSize = 4; // Lưới module 4m x 4m của Kenney Space Kit

        // 1. Sàn Module không gian (Instanced Space Floor)
        const floorProps = this.getMeshProps('space/template-floor') || this.getMeshProps('floor');

        if (floorProps && floorProps.geo && floorProps.mat) {
            const steps = Math.floor((halfSize * 2) / tileSize); // 14 ô
            const totalTiles = steps * steps; // 196 ô

            const instancedFloor = new THREE.InstancedMesh(floorProps.geo, floorProps.mat, totalTiles);
            instancedFloor.name = 'space-modular-floor';
            instancedFloor.receiveShadow = true;
            instancedFloor.castShadow = false;

            const dummy = new THREE.Object3D();
            let idx = 0;
            for (let x = -halfSize + 2; x <= halfSize - 2; x += tileSize) {
                for (let z = -halfSize + 2; z <= halfSize - 2; z += tileSize) {
                    dummy.position.set(x, 0, z);
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    instancedFloor.setMatrixAt(idx++, dummy.matrix);
                }
            }
            instancedFloor.count = idx;
            instancedFloor.instanceMatrix.needsUpdate = true;
            this.scene.add(instancedFloor);
        }

        // 2. Tường bao chu vi ngoài cùng (Instanced Perimeter Walls)
        const wallProps = this.getMeshProps('space/template-wall') || this.getMeshProps('wall-high');
        if (wallProps && wallProps.geo && wallProps.mat) {
            const wallStep = 4;
            const stepsCount = Math.floor((halfSize * 2) / wallStep); // 14
            const totalWalls = stepsCount * 4;

            const instancedWalls = new THREE.InstancedMesh(wallProps.geo, wallProps.mat, totalWalls + 8);
            instancedWalls.name = 'space-perimeter-walls';
            instancedWalls.castShadow = true;
            instancedWalls.receiveShadow = true;

            const dummy = new THREE.Object3D();
            let wIdx = 0;

            // Tường Bắc (Z = -halfSize) và Tường Nam (Z = halfSize)
            for (let x = -halfSize + 2; x <= halfSize - 2; x += wallStep) {
                dummy.position.set(x, 0, -halfSize);
                dummy.rotation.set(0, 0, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                dummy.position.set(x, 0, halfSize);
                dummy.rotation.set(0, Math.PI, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
            }

            // Tường Tây (X = -halfSize) và Tường Đông (X = halfSize)
            for (let z = -halfSize + 2; z <= halfSize - 2; z += wallStep) {
                dummy.position.set(-halfSize, 0, z);
                dummy.rotation.set(0, Math.PI * 0.5, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                dummy.position.set(halfSize, 0, z);
                dummy.rotation.set(0, -Math.PI * 0.5, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
            }

            instancedWalls.count = wIdx;
            instancedWalls.instanceMatrix.needsUpdate = true;
            this.scene.add(instancedWalls);
        }

        // Đặt 4 góc tường chu vi (Wall Corners)
        this.placeInstance('space/template-wall-corner', new THREE.Vector3(-halfSize, 0, -halfSize), 0, 1, false);
        this.placeInstance('space/template-wall-corner', new THREE.Vector3(halfSize, 0, -halfSize), -Math.PI * 0.5, 1, false);
        this.placeInstance('space/template-wall-corner', new THREE.Vector3(halfSize, 0, halfSize), Math.PI, 1, false);
        this.placeInstance('space/template-wall-corner', new THREE.Vector3(-halfSize, 0, halfSize), Math.PI * 0.5, 1, false);

        // Hộp va chạm biên chu vi bản đồ (Perimeter Boundary Colliders)
        const wallHeight = 8;
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(-halfSize - 2, 0, -halfSize - 2),
            new THREE.Vector3(halfSize + 2, wallHeight, -halfSize)
        ));
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(-halfSize - 2, 0, halfSize),
            new THREE.Vector3(halfSize + 2, wallHeight, halfSize + 2)
        ));
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(-halfSize - 2, 0, -halfSize - 2),
            new THREE.Vector3(-halfSize, wallHeight, halfSize + 2)
        ));
        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(halfSize, 0, -halfSize - 2),
            new THREE.Vector3(halfSize + 2, wallHeight, halfSize + 2)
        ));
    }

    buildSpawnPortals() {
        // 8 cổng xuất phát teleporter xung quanh biên trạm không gian (halfSize = 28)
        const portalDist = this.halfSize;
        const offset = 8;
        const portalDefs = [
            { name: 'Cổng Bắc 1', pos: new THREE.Vector3(-offset, 0, -portalDist), rot: 0, spawnDir: new THREE.Vector3(0, 0, 1) },
            { name: 'Cổng Bắc 2', pos: new THREE.Vector3(offset, 0, -portalDist), rot: 0, spawnDir: new THREE.Vector3(0, 0, 1) },
            { name: 'Cổng Nam 1', pos: new THREE.Vector3(-offset, 0, portalDist), rot: Math.PI, spawnDir: new THREE.Vector3(0, 0, -1) },
            { name: 'Cổng Nam 2', pos: new THREE.Vector3(offset, 0, portalDist), rot: Math.PI, spawnDir: new THREE.Vector3(0, 0, -1) },
            { name: 'Cổng Tây 1', pos: new THREE.Vector3(-portalDist, 0, -offset), rot: Math.PI * 0.5, spawnDir: new THREE.Vector3(1, 0, 0) },
            { name: 'Cổng Tây 2', pos: new THREE.Vector3(-portalDist, 0, offset), rot: Math.PI * 0.5, spawnDir: new THREE.Vector3(1, 0, 0) },
            { name: 'Cổng Đông 1', pos: new THREE.Vector3(portalDist, 0, -offset), rot: -Math.PI * 0.5, spawnDir: new THREE.Vector3(-1, 0, 0) },
            { name: 'Cổng Đông 2', pos: new THREE.Vector3(portalDist, 0, offset), rot: -Math.PI * 0.5, spawnDir: new THREE.Vector3(-1, 0, 0) }
        ];

        portalDefs.forEach((p, idx) => {
            // Cổng vòm xuất phát công nghệ cao
            const gate = this.placeInstance('space/gate', p.pos, p.rot, 1.2, true) || this.placeInstance('wall-gate', p.pos, p.rot, 2.4, true);
            let gateDepth = 0;
            if (gate) {
                const bounds = new THREE.Box3().setFromObject(gate);
                const front = new THREE.Vector3(
                    p.spawnDir.x >= 0 ? bounds.max.x : bounds.min.x,
                    0,
                    p.spawnDir.z >= 0 ? bounds.max.z : bounds.min.z
                );
                gateDepth = front.sub(p.pos).dot(p.spawnDir);
            }

            // Glowing Pulsating Vortex Disc
            const vortexGeo = new THREE.PlaneGeometry(1.6, 2.4);
            const vortexMat = new THREE.MeshBasicMaterial({
                color: idx % 2 === 0 ? 0x00d0ff : 0xb026ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85
            });
            const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
            vortexMesh.position.copy(p.pos);
            vortexMesh.position.y = 1.3;
            vortexMesh.rotation.y = p.rot;
            this.scene.add(vortexMesh);

            // Inner Portal Core Ring
            const ringGeo = new THREE.RingGeometry(0.3, 0.7, 16);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.copy(p.pos);
            ringMesh.position.y = 1.3;
            ringMesh.position.addScaledVector(p.spawnDir, 0.05);
            ringMesh.rotation.y = p.rot;
            this.scene.add(ringMesh);

            // Dynamic Portal Light
            const pLight = new THREE.PointLight(idx % 2 === 0 ? 0x00d0ff : 0xb026ff, 4, 10);
            pLight.position.copy(p.pos);
            pLight.position.y = 1.4;
            pLight.position.addScaledVector(p.spawnDir, 0.8);
            this.scene.add(pLight);

            this.portals.push({
                name: p.name,
                position: p.pos,
                spawnPos: p.pos.clone().addScaledVector(p.spawnDir, gateDepth),
                spawnDir: p.spawnDir,
                vortex: vortexMesh,
                ring: ringMesh,
                light: pLight,
                baseLightIntensity: 4
            });
        });
    }

    buildCenterPlaza() {
        // --- 1. Vách ngăn hai Căn cứ xuất phát (Base Partitions) ---
        // Vách căn cứ Đội Xanh (Nam: Z = 18) - chừa lối ra Long A (X=-18), Mid (X=0) và B Tunnels (X=18)
        const southDividers = [-14, -10, -6, 6, 10, 14];
        southDividers.forEach(x => {
            this.placeInstance('space/template-wall', new THREE.Vector3(x, 0, 18), Math.PI, 1, true);
        });

        // Vách căn cứ Đội Đỏ (Bắc: Z = -18) - đối xứng tương ứng
        const northDividers = [-14, -10, -6, 6, 10, 14];
        northDividers.forEach(x => {
            this.placeInstance('space/template-wall', new THREE.Vector3(x, 0, -18), 0, 1, true);
        });

        // --- 2. Cổng vòm hai đầu trục đường Mid ---
        this.placeInstance('space/gate', new THREE.Vector3(0, 0, 18), Math.PI, 1, true);
        this.placeInstance('space/gate', new THREE.Vector3(0, 0, -18), 0, 1, true);

        // --- 3. Vách ngăn trục đường Mid (Hành lang trung tâm) ---
        const midZCoords = [-14, -10, -6, 6, 10, 14];
        midZCoords.forEach(z => {
            this.placeInstance('space/template-wall', new THREE.Vector3(-4, 0, z), Math.PI * 0.5, 1, true);
            this.placeInstance('space/template-wall', new THREE.Vector3(4, 0, z), -Math.PI * 0.5, 1, true);
        });

        // Cổng Laser tại các ngách rẽ Connector (nối Mid sang Site A và Site B)
        this.placeInstance('space/gate-lasers', new THREE.Vector3(-4, 0, 0), Math.PI * 0.5, 1, true);
        this.placeInstance('space/gate-lasers', new THREE.Vector3(4, 0, 0), -Math.PI * 0.5, 1, true);

        // --- 4. Vật cản trụ máy ngắm bắn tầm xa tại sảnh Mid (Mid Sniper Cover) ---
        this.placeInstance('space/template-detail', new THREE.Vector3(-1.8, 0, -8), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(1.8, 0, 8), 0, 1.2, true);

        // Dây cáp điện trung tâm
        this.placeInstance('space/cables', new THREE.Vector3(0, 0, 4), 0, 1.4, false);
        this.placeInstance('space/cables', new THREE.Vector3(0, 0, -4), Math.PI, 1.4, false);
    }

    buildTacticalCover() {
        // --- 1. Cứ điểm A: Lò phản ứng Alpha (Site A - Long A & Short A) ---
        // Vách ngăn hành lang Long A (chạy dọc X = -16)
        const longAZ = [12, 8, -6, -10, -14];
        longAZ.forEach(z => {
            this.placeInstance('space/template-wall', new THREE.Vector3(-16, 0, z), Math.PI * 0.5, 1, true);
        });
        // Cổng chốt nối từ Long A vào lòng Site A
        this.placeInstance('space/gate', new THREE.Vector3(-16, 0, 1), Math.PI * 0.5, 1, true);

        // Bục máy Lò phản ứng hạt nhân ở trung tâm Site A
        this.placeInstance('space/template-floor-layer-raised', new THREE.Vector3(-10, 0, 0), 0, 1, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-10, 0, 4), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-10, 0, -4), 0, 1.2, true);

        // Vật cản khúc cua Long A
        this.placeInstance('space/template-detail', new THREE.Vector3(-22, 0, 8), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-22, 0, -8), 0, 1.2, true);
        this.placeInstance('space/template-wall-half', new THREE.Vector3(-20, 0, 0), Math.PI * 0.5, 1, true);

        // --- 2. Cứ điểm B: Kho chứa năng lượng Beta (Site B - B Tunnels & Room) ---
        // Hành lang B Tunnels (Đường hầm ziczac tạo góc mù 90 độ)
        this.placeInstance('space/template-wall', new THREE.Vector3(14, 0, 14), -Math.PI * 0.5, 1, true);
        this.placeInstance('space/template-wall', new THREE.Vector3(14, 0, 10), -Math.PI * 0.5, 1, true);
        this.placeInstance('space/template-wall', new THREE.Vector3(20, 0, 6), 0, 1, true);
        this.placeInstance('space/template-wall', new THREE.Vector3(24, 0, 6), 0, 1, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(22, 0, 12), 0, 1.2, true);

        // Vách phòng Site B tại Z = -4
        this.placeInstance('space/template-wall', new THREE.Vector3(10, 0, -4), 0, 1, true);
        this.placeInstance('space/template-wall', new THREE.Vector3(18, 0, -4), 0, 1, true);
        this.placeInstance('space/gate-lasers', new THREE.Vector3(14, 0, -4), 0, 1, true);

        // Thùng hàng modular và vật cản trong phòng Site B
        this.placeInstance('space/template-floor-layer-raised', new THREE.Vector3(12, 0, -10), 0, 1, true);
        this.placeInstance('space/template-floor-layer-raised', new THREE.Vector3(18, 0, -10), 0, 1, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(15, 0, -14), 0, 1.2, true);
        this.placeInstance('space/template-wall-half', new THREE.Vector3(15, 0, -7), 0, 1, true);

        // Dây cáp công nghiệp phụ trợ
        this.placeInstance('space/cables', new THREE.Vector3(-8, 0, 0), 0, 1.5, false);
        this.placeInstance('space/cables', new THREE.Vector3(15, 0, -10), Math.PI * 0.5, 1.5, false);
    }

    buildGrass() {
        // Giữ mặt sàn trạm không gian sạch sẽ kim loại
    }

    update(delta) {
        // Animate portals only; the overhead arena has no cloud layer.
        const time = performance.now() * 0.003;
        for (const p of this.portals) {
            if (p.ring) {
                p.ring.rotation.z += delta * 2.5;
            }
            if (p.light) {
                p.light.intensity = p.baseLightIntensity + Math.sin(time * 3 + p.position.x) * 1.5;
            }
            if (p.vortex && p.vortex.material) {
                p.vortex.material.opacity = 0.75 + Math.sin(time * 4 + p.position.z) * 0.15;
            }
        }
    }

    getPortals() {
        return this.portals;
    }

    getPortalSpawnPosition(portal, radius) {
        const lateral = new THREE.Vector3(portal.spawnDir.z, 0, -portal.spawnDir.x);
        const jitter = (Math.random() - 0.5) * 1.5;
        // Jitter only across the exit, never backwards into the gate. Check the
        // complete body and search inward if another obstacle occupies the exit.
        for (let step = 0; step <= 16; step++) {
            const candidate = portal.spawnPos.clone()
                .addScaledVector(portal.spawnDir, radius + 0.15 + step * 0.5)
                .addScaledVector(lateral, jitter);
            if (!this.checkCollision(candidate, radius)) return candidate;
        }
        return null;
    }

    checkCollision(pos, radius = 0.5) {
        for (const col of this.colliders) {
            if (col.max.y <= pos.y + 0.1 || col.min.y >= pos.y + 1.9) continue;
            const x = Math.max(col.min.x, Math.min(pos.x, col.max.x));
            const z = Math.max(col.min.z, Math.min(pos.z, col.max.z));
            if ((pos.x - x) ** 2 + (pos.z - z) ** 2 < radius * radius) return true;
        }
        return false;
    }

    moveCharacter(position, dx, dz, radius) {
        // Resolve existing overlap first (spawn, knockback or a network correction).
        for (let pass = 0; pass < 4; pass++) {
            let corrected = false;
            for (const box of this.colliders) {
                if (box.max.y <= position.y + 0.1 || box.min.y >= position.y + 1.9) continue;
                const x = Math.max(box.min.x, Math.min(position.x, box.max.x));
                const z = Math.max(box.min.z, Math.min(position.z, box.max.z));
                const ox = position.x - x, oz = position.z - z;
                const distance = Math.hypot(ox, oz);
                if (distance >= radius) continue;
                corrected = true;
                if (distance > 0.00001) {
                    position.x += ox / distance * (radius - distance + 0.001);
                    position.z += oz / distance * (radius - distance + 0.001);
                } else {
                    const sides = [
                        [Math.abs(position.x - (box.min.x - radius)), 'x', box.min.x - radius - 0.001],
                        [Math.abs(position.x - (box.max.x + radius)), 'x', box.max.x + radius + 0.001],
                        [Math.abs(position.z - (box.min.z - radius)), 'z', box.min.z - radius - 0.001],
                        [Math.abs(position.z - (box.max.z + radius)), 'z', box.max.z + radius + 0.001]
                    ].sort((a, b) => a[0] - b[0]);
                    position[sides[0][1]] = sides[0][2];
                }
            }
            if (!corrected) break;
        }
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.45)));
        const probe = _movementProbe;
        for (let step = 0; step < steps; step++) {
            probe.copy(position); probe.x += dx / steps;
            if (!this.checkCollision(probe, radius)) position.x = probe.x;
            probe.copy(position); probe.z += dz / steps;
            if (!this.checkCollision(probe, radius)) position.z = probe.z;
        }
    }

    navigationClear(from, to, radius) {
        const direction = _navigationRay.direction.subVectors(to, from);
        direction.y = 0;
        const length = direction.length();
        direction.normalize();
        const ray = _navigationRay;
        ray.origin.set(from.x, 1, from.z);
        const hit = _navigationHit;
        for (const collider of this.colliders) {
            if (collider.max.y <= 0.1 || collider.min.y >= 1.9) continue;
            const box = _navigationBox.copy(collider);
            box.min.x -= radius; box.max.x += radius;
            box.min.z -= radius; box.max.z += radius;
            box.min.y = 0; box.max.y = 2;
            if (box.containsPoint(ray.origin)) return false;
            if (ray.intersectBox(box, hit) && hit.distanceTo(ray.origin) < length) return false;
        }
        return true;
    }

    findNavigationPath(from, to, radius) {
        if (this.navigationClear(from, to, radius)) return [to.clone()];
        const nodes = [from.clone(), to.clone()];
        const margin = radius + 0.16;
        for (const box of this.colliders) {
            if (box.max.y <= 0.1 || box.min.y >= 1.9) continue;
            if (box.max.x < Math.min(from.x, to.x) - 8 || box.min.x > Math.max(from.x, to.x) + 8 ||
                box.max.z < Math.min(from.z, to.z) - 8 || box.min.z > Math.max(from.z, to.z) + 8) continue;
            for (const x of [box.min.x - margin, box.max.x + margin]) {
                for (const z of [box.min.z - margin, box.max.z + margin]) {
                    const point = new THREE.Vector3(x, 0, z);
                    if (!this.checkCollision(point, radius)) nodes.push(point);
                }
            }
        }
        const costs = nodes.map(() => Infinity), parents = [], closed = new Set();
        costs[0] = 0;
        while (closed.size < nodes.length) {
            let current = -1, best = Infinity;
            for (let i = 0; i < nodes.length; i++) {
                const value = costs[i] + nodes[i].distanceTo(to);
                if (!closed.has(i) && value < best) { best = value; current = i; }
            }
            if (current < 0) break;
            if (current === 1) {
                const path = [];
                for (let i = 1; i !== 0; i = parents[i]) path.unshift(nodes[i]);
                return path;
            }
            closed.add(current);
            for (let i = 1; i < nodes.length; i++) {
                if (closed.has(i)) continue;
                const cost = costs[current] + nodes[current].distanceTo(nodes[i]);
                if (cost < costs[i] && this.navigationClear(nodes[current], nodes[i], radius)) {
                    costs[i] = cost; parents[i] = current;
                }
            }
        }
        return [];
    }

    hasLineOfSight(fromPos, toPos) {
        _tempLosDir.subVectors(toPos, fromPos);
        _tempLosDir.y = 0;
        const dist = _tempLosDir.length();
        if (dist <= 0.0001) return true;
        _tempLosDir.multiplyScalar(1 / dist);

        // Đặt tia kiểm tra ở độ cao ngực/tầm mắt (Y = 1.0)
        _tempLosRay.origin.set(fromPos.x, 1.0, fromPos.z);
        _tempLosRay.direction.copy(_tempLosDir);

        for (const col of this.colliders) {
            // Bỏ qua các vật thể nằm hoàn toàn dưới sàn hoặc trên trần
            if (col.max.y <= 0.4 || col.min.y >= 3.0) continue;
            const hit = _tempLosRay.intersectBox(col, _tempLosHit);
            if (hit) {
                const hitDist = Math.hypot(hit.x - fromPos.x, hit.z - fromPos.z);
                if (hitDist < dist - 0.25) {
                    return false;
                }
            }
        }
        return true;
    }
}

