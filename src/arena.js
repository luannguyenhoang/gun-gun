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
        this.halfSize = 25;
        this.radius = 23;
    }

    async loadModels() {
        const modelNames = [
            'floor', 'floor-detail', 'wall', 'wall-corner', 'wall-high', 'wall-low', 'wall-gate',
            'column', 'column-damaged', 'tree', 'stairs', 'platform', 'platform-large-grass',
            'banner', 'block', 'statue', 'trophy', 'weapon-rack'
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
        const ambientLight = new THREE.AmbientLight(0xddeeff, 0.6);
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x223344, 0.5);
        this.scene.add(hemiLight);

        const sun = new THREE.DirectionalLight(0xfff5e6, 1.6);
        sun.position.set(20, 32, 18);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 1.0;
        sun.shadow.camera.far = 70;
        const d = 22;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        sun.shadow.bias = -0.0005;
        this.sunLight = sun;
        this.scene.add(sun);
        this.scene.add(sun.target);

        // Đèn đường góc map - tạo cảm giác đô thị bỏ hoang leo lét
        const streetLightPositions = [
            [-20, 5, -20], [20, 5, -20],
            [-20, 5,  20], [20, 5,  20]
        ];
        streetLightPositions.forEach(([x, y, z]) => {
            const sl = new THREE.PointLight(0xffa040, 3.5, 22);
            sl.position.set(x, y, z);
            this.scene.add(sl);
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

    buildFloorAndWalls() {
        const halfSize = this.halfSize; // Thu nhỏ map còn 50% (72x72 thay vì 146x146)
        const tileSize = 2;

        // 1. High-Performance Instanced Floor
        const floorBase = this.models['floor'];
        let floorGeo = null;
        let floorMat = null;
        if (floorBase) {
            floorBase.traverse(c => {
                if (c.isMesh && !floorGeo) {
                    floorGeo = c.geometry;
                    floorMat = c.material;
                }
            });
        }

        if (floorGeo && floorMat) {
            const steps = Math.floor((halfSize * 2) / tileSize) + 1;
            const totalTiles = steps * steps;
            // Nhựa đường tối màu - phong cách đô thị bỏ hoang
            const turfMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.95 });
            const instancedFloor = new THREE.InstancedMesh(floorGeo, turfMaterial, totalTiles);
            instancedFloor.name = 'asphalt-ground';
            instancedFloor.receiveShadow = true;
            instancedFloor.castShadow = false;

            const dummy = new THREE.Object3D();
            let idx = 0;
            for (let x = -halfSize; x <= halfSize; x += tileSize) {
                for (let z = -halfSize; z <= halfSize; z += tileSize) {
                    dummy.position.set(x, 0, z);
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(tileSize, tileSize, tileSize);
                    dummy.updateMatrix();
                    instancedFloor.setMatrixAt(idx, dummy.matrix);
                    // Biến thiên màu nhựa đường nhẹ
                    const shade = 0.92 + (Math.sin(x * 0.5 + z * 0.3) + 1) * 0.04;
                    instancedFloor.setColorAt(idx++, new THREE.Color(shade * 0.17, shade * 0.17, shade * 0.17));
                }
            }
            instancedFloor.instanceMatrix.needsUpdate = true;
            this.scene.add(instancedFloor);

            // Vạch đường phân làn đô thị
            const laneLineMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 });
            const laneConfigs = [
                { size: [0.3, 22], pos: [-12, 0.03, 0] },
                { size: [0.3, 22], pos: [ 12, 0.03, 0] },
                { size: [22, 0.3], pos: [ 0, 0.03, -12] },
                { size: [22, 0.3], pos: [ 0, 0.03,  12] },
            ];
            laneConfigs.forEach(({ size, pos }) => {
                const line = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), laneLineMat);
                line.rotation.x = -Math.PI / 2;
                line.position.set(pos[0], pos[1], pos[2]);
                this.scene.add(line);
            });
        }

        // 2. High-Performance Instanced Perimeter Walls
        const wallBase = this.models['wall-high'];
        let wallGeo = null;
        let wallMat = null;
        if (wallBase) {
            wallBase.traverse(c => {
                if (c.isMesh && !wallGeo) {
                    wallGeo = c.geometry;
                    wallMat = c.material;
                }
            });
        }

        if (wallGeo && wallMat) {
            const wallStep = 2;
            const wallScale = 2;
            const stepsCount = Math.floor((halfSize * 2) / wallStep) + 1;
            const totalWalls = stepsCount * 4;

            const instancedWalls = new THREE.InstancedMesh(wallGeo, wallMat, totalWalls);
            instancedWalls.castShadow = true;
            instancedWalls.receiveShadow = true;

            const dummy = new THREE.Object3D();
            let wIdx = 0;
            // Để trống tại vị trí các cổng (x = ±16 và z = ±16)
            const isGateGap = (val) => Math.abs(Math.abs(val) - 16) < 2.5;

            for (let x = -halfSize; x <= halfSize; x += wallStep) {
                if (!isGateGap(x)) {
                    dummy.position.set(x, 0, -halfSize - 1);
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(wallScale, wallScale, wallScale);
                    dummy.updateMatrix();
                    instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                    dummy.position.set(x, 0, halfSize + 1);
                    dummy.rotation.set(0, Math.PI, 0);
                    dummy.scale.set(wallScale, wallScale, wallScale);
                    dummy.updateMatrix();
                    instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
                }
            }

            for (let z = -halfSize; z <= halfSize; z += wallStep) {
                if (!isGateGap(z)) {
                    dummy.position.set(-halfSize - 1, 0, z);
                    dummy.rotation.set(0, Math.PI * 0.5, 0);
                    dummy.scale.set(wallScale, wallScale, wallScale);
                    dummy.updateMatrix();
                    instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                    dummy.position.set(halfSize + 1, 0, z);
                    dummy.rotation.set(0, -Math.PI * 0.5, 0);
                    dummy.scale.set(wallScale, wallScale, wallScale);
                    dummy.updateMatrix();
                    instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
                }
            }

            instancedWalls.count = wIdx;
            instancedWalls.instanceMatrix.needsUpdate = true;
            this.scene.add(instancedWalls);
        }

        // Perimeter Boundary Colliders
        const wallHeight = 10;
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
        // 8 cổng spawn xung quanh biên map mới (halfSize = 25)
        const portalDist = 25.5;
        const offset = 10;
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
            // Portal Archway Gate
            const gate = this.placeInstance('wall-gate', p.pos, p.rot, 2.4, true);
            // The arch uses a solid box collider. Spawn beyond its arena-facing
            // surface, with the individual zombie's radius added at spawn time.
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
                color: idx % 2 === 0 ? 0xb026ff : 0xff0055,
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
            const pLight = new THREE.PointLight(idx % 2 === 0 ? 0xb026ff : 0xff0055, 4, 10);
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
        // Giao lộ trung tâm bê tông - phong cách đô thị bỏ hoang
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 }));
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = 0.025;
        plaza.receiveShadow = true;
        plaza.name = 'walkable-plaza';
        this.scene.add(plaza);

        // Vòng tròn giao lộ (roundabout marker)
        const roundabout = new THREE.Mesh(
            new THREE.RingGeometry(3.2, 3.5, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
        );
        roundabout.rotation.x = -Math.PI / 2;
        roundabout.position.y = 0.04;
        this.scene.add(roundabout);

        const colDist = 5;
        const colScale = 2.0;
        this.placeInstance('column', new THREE.Vector3(-colDist, 0, -colDist), 0, colScale, true);
        this.placeInstance('column-damaged', new THREE.Vector3(colDist, 0, -colDist), 0.5, colScale, true);
        this.placeInstance('column', new THREE.Vector3(-colDist, 0, colDist), 1.2, colScale, true);
        this.placeInstance('column-damaged', new THREE.Vector3(colDist, 0, colDist), 2.1, colScale, true);
    }

    buildTacticalCover() {
        const coverPoints = [
            // --- Khối nhà góc Tây-Bắc ---
            { model: 'block',    pos: [-18, 0, -18], rot: 0,             scale: 2.2 },
            { model: 'wall-low', pos: [-14, 0, -18], rot: 0,             scale: 2 },
            { model: 'wall-low', pos: [-18, 0, -14], rot: Math.PI * 0.5, scale: 2 },
            { model: 'banner',   pos: [-16, 0, -16], rot: 0.8,           scale: 1.8 },

            // --- Khối nhà góc Đông-Bắc ---
            { model: 'block',    pos: [18, 0, -18],  rot: 0,             scale: 2.2 },
            { model: 'wall-low', pos: [14, 0, -18],  rot: 0,             scale: 2 },
            { model: 'wall-low', pos: [18, 0, -14],  rot: Math.PI * 0.5, scale: 2 },
            { model: 'banner',   pos: [16, 0, -20],  rot: -0.5,          scale: 1.8 },

            // --- Khối nhà góc Tây-Nam ---
            { model: 'block',    pos: [-18, 0, 18],  rot: 0,             scale: 2.2 },
            { model: 'wall-low', pos: [-14, 0, 18],  rot: Math.PI,       scale: 2 },
            { model: 'wall-low', pos: [-18, 0, 14],  rot: Math.PI * 0.5, scale: 2 },
            { model: 'statue',   pos: [-20, 0, 16],  rot: 1.4,           scale: 1.6 },

            // --- Khối nhà góc Đông-Nam ---
            { model: 'block',    pos: [18, 0, 18],   rot: 0,             scale: 2.2 },
            { model: 'wall-low', pos: [14, 0, 18],   rot: Math.PI,       scale: 2 },
            { model: 'wall-low', pos: [18, 0, 14],   rot: Math.PI * 0.5, scale: 2 },
            { model: 'trophy',   pos: [20, 0, 16],   rot: -1.2,          scale: 1.6 },

            // --- Hẻm chiến thuật Bắc ---
            { model: 'wall-low', pos: [-6, 0, -16],  rot: 0,             scale: 2 },
            { model: 'wall-low', pos: [ 6, 0, -16],  rot: 0,             scale: 2 },
            { model: 'block',    pos: [ 0, 0, -18],  rot: 0.3,           scale: 1.6 },

            // --- Hẻm chiến thuật Nam ---
            { model: 'wall-low', pos: [-6, 0, 16],   rot: Math.PI,       scale: 2 },
            { model: 'wall-low', pos: [ 6, 0, 16],   rot: Math.PI,       scale: 2 },
            { model: 'block',    pos: [ 0, 0, 18],   rot: -0.2,          scale: 1.6 },

            // --- Hẻm chiến thuật Tây ---
            { model: 'wall-low', pos: [-16, 0, -6],  rot: Math.PI * 0.5, scale: 2 },
            { model: 'wall-low', pos: [-16, 0,  6],  rot: Math.PI * 0.5, scale: 2 },
            { model: 'column',   pos: [-18, 0,  0],  rot: 0,             scale: 1.6 },

            // --- Hẻm chiến thuật Đông ---
            { model: 'wall-low', pos: [16, 0, -6],   rot: -Math.PI * 0.5, scale: 2 },
            { model: 'wall-low', pos: [16, 0,  6],   rot: -Math.PI * 0.5, scale: 2 },
            { model: 'column-damaged', pos: [18, 0, 0], rot: 0.5,        scale: 1.6 },

            // --- Cây vỉa hè rải rác ---
            { model: 'tree', pos: [-10, 0, -21], rot: 0.3,  scale: 1.8 },
            { model: 'tree', pos: [ 10, 0, -21], rot: 1.1,  scale: 1.8 },
            { model: 'tree', pos: [-10, 0,  21], rot: 2.0,  scale: 1.8 },
            { model: 'tree', pos: [ 10, 0,  21], rot: 0.7,  scale: 1.8 },
            { model: 'tree', pos: [-21, 0, -10], rot: 1.5,  scale: 1.8 },
            { model: 'tree', pos: [-21, 0,  10], rot: 0.4,  scale: 1.8 },
            { model: 'tree', pos: [ 21, 0, -10], rot: 2.4,  scale: 1.8 },
            { model: 'tree', pos: [ 21, 0,  10], rot: 1.9,  scale: 1.8 },

            // --- Vật chắn chiến thuật gần trung tâm ---
            { model: 'block', pos: [-8, 0, -8],  rot: 0.4,  scale: 1.5 },
            { model: 'block', pos: [ 8, 0, -8],  rot: -0.2, scale: 1.5 },
            { model: 'block', pos: [-8, 0,  8],  rot: 1.1,  scale: 1.5 },
            { model: 'block', pos: [ 8, 0,  8],  rot: 0.8,  scale: 1.5 },

            // --- Rack vũ khí hai bên ---
            { model: 'weapon-rack', pos: [-12, 0, 0], rot: Math.PI * 0.5,  scale: 1.8 },
            { model: 'weapon-rack', pos: [ 12, 0, 0], rot: -Math.PI * 0.5, scale: 1.8 },
        ];

        coverPoints.forEach(cp => {
            this.placeInstance(cp.model, new THREE.Vector3(cp.pos[0], cp.pos[1], cp.pos[2]), cp.rot, cp.scale, true);
        });

        // Platform bê tông 2 bên hẻm chính
        this.placeInstance('platform', new THREE.Vector3(-20, 0, 0), 0, 2.0, true);
        this.placeInstance('platform', new THREE.Vector3(20, 0, 0), 0, 2.0, true);
        this.placeInstance('column-damaged', new THREE.Vector3(-20, 1.0, 0), 0, 1.3, true);
        this.placeInstance('column-damaged', new THREE.Vector3(20, 1.0, 0), 0.8, 1.3, true);
    }

    buildGrass() {
        // Cỏ thưa xen kẽ trên nhựa đường - phong cách đô thị bỏ hoang
        const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.25, 3),
            new THREE.MeshStandardMaterial({ color: 0x4a6030, roughness: 1 }), 800);
        blades.name = 'sparse-weeds';
        const dummy = new THREE.Object3D();
        // Rải cỏ thưa trong phạm vi map mới 48x48
        let seed = 731;
        const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let i = 0; i < blades.count; i++) {
            dummy.position.set((random() - 0.5) * 48, 0.13, (random() - 0.5) * 48);
            while (Math.abs(dummy.position.x) < 4.6 && Math.abs(dummy.position.z) < 4.6) {
                dummy.position.set((random() - 0.5) * 48, 0.13, (random() - 0.5) * 48);
            }
            dummy.rotation.y = random() * Math.PI;
            dummy.scale.set(1, 0.5 + random() * 0.8, 1);
            dummy.updateMatrix();
            blades.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(blades);
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
        const dist = _tempLosDir.length();
        if (dist > 0.0001) _tempLosDir.multiplyScalar(1 / dist);

        _tempLosRay.set(fromPos, _tempLosDir);
        for (const col of this.colliders) {
            const hit = _tempLosRay.intersectBox(col, _tempLosHit);
            if (hit && fromPos.distanceTo(hit) < dist - 0.2) {
                return false;
            }
        }
        return true;
    }
}

