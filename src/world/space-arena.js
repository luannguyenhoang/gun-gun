import * as THREE from 'three';
import { BaseArena } from './arena-base.js';

/**
 * Bản đồ Trạm Không Gian Chiến Thuật (Tactical Space Map)
 * Thiết kế chuyên dụng cho chế độ Đối kháng TDM 4v4: 3 làn đường (Mid, Site A, Site B),
 * các vách ngăn cản tầm nhìn Fog of War và các cứ điểm hồi sinh đối xứng.
 */
export class SpaceArena extends BaseArena {
    constructor(scene, gltfLoader) {
        super(scene, gltfLoader);
        this.halfSize = 28;
        this.radius = 29;

        // Cấu hình Lưới phân vùng không gian bao phủ 64m x 64m
        this.gridCellSize = 4.0;
        this.gridMinX = -32;
        this.gridMinZ = -32;
        this.gridCols = 16;
        this.gridRows = 16;
    }

    async loadModels() {
        const modelNames = [
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

        // Tối ưu hóa va chạm và xây dựng lưới không gian
        this.optimizeColliders();
        this.buildSpatialGrid();
    }

    setupLighting() {
        // Ánh sáng môi trường trạm không gian Sci-Fi
        this.ambientLight = new THREE.AmbientLight(0x162438, 0.75);
        this.addSceneObject(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0x4488bb, 0x111622, 0.6);
        this.addSceneObject(this.hemiLight);

        // Nguồn sáng định hướng mặt trời ngoài vũ trụ rọi xiên
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
        this.addSceneObject(sun);
        this.addSceneObject(sun.target);

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
            this.addSceneObject(pl);
            this.tacticalLights.push(pl);
        });
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
            this.addSceneObject(instancedFloor);
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
            this.addSceneObject(instancedWalls);
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
            this.addSceneObject(vortexMesh);

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
            this.addSceneObject(ringMesh);

            this.portals.push({
                name: p.name,
                position: p.pos,
                spawnPos: p.pos.clone().addScaledVector(p.spawnDir, gateDepth),
                spawnDir: p.spawnDir,
                vortex: vortexMesh,
                ring: ringMesh,
                light: null,
                baseLightIntensity: 0
            });
        });
    }

    buildCenterPlaza() {
        // 1. Vách ngăn hai Căn cứ xuất phát (Base Partitions)
        const southDividers = [-14, -10, -6, 6, 10, 14];
        southDividers.forEach(x => {
            this.placeInstance('space/template-wall', new THREE.Vector3(x, 0, 18), Math.PI, 1, true);
        });

        const northDividers = [-14, -10, -6, 6, 10, 14];
        northDividers.forEach(x => {
            this.placeInstance('space/template-wall', new THREE.Vector3(x, 0, -18), 0, 1, true);
        });

        // 2. Cổng vòm hai đầu trục đường Mid
        this.placeInstance('space/gate', new THREE.Vector3(0, 0, 18), Math.PI, 1, true);
        this.placeInstance('space/gate', new THREE.Vector3(0, 0, -18), 0, 1, true);

        // 3. Vách ngăn trục đường Mid (Hành lang trung tâm)
        const midZCoords = [-14, -10, -6, 6, 10, 14];
        midZCoords.forEach(z => {
            this.placeInstance('space/template-wall', new THREE.Vector3(-4, 0, z), Math.PI * 0.5, 1, true);
            this.placeInstance('space/template-wall', new THREE.Vector3(4, 0, z), -Math.PI * 0.5, 1, true);
        });

        // Cổng Laser tại các ngách rẽ Connector (nối Mid sang Site A và Site B)
        this.placeInstance('space/gate-lasers', new THREE.Vector3(-4, 0, 0), Math.PI * 0.5, 1, true);
        this.placeInstance('space/gate-lasers', new THREE.Vector3(4, 0, 0), -Math.PI * 0.5, 1, true);

        // 4. Vật cản trụ máy ngắm bắn tầm xa tại sảnh Mid (Mid Sniper Cover)
        this.placeInstance('space/template-detail', new THREE.Vector3(-1.8, 0, -8), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(1.8, 0, 8), 0, 1.2, true);

        // Dây cáp điện trung tâm
        this.placeInstance('space/cables', new THREE.Vector3(0, 0, 4), 0, 1.4, false);
        this.placeInstance('space/cables', new THREE.Vector3(0, 0, -4), Math.PI, 1.4, false);
    }

    buildTacticalCover() {
        // 1. Cứ điểm A: Lò phản ứng Alpha (Site A - Long A & Short A)
        const longAZ = [12, 8, -6, -10, -14];
        longAZ.forEach(z => {
            this.placeInstance('space/template-wall', new THREE.Vector3(-16, 0, z), Math.PI * 0.5, 1, true);
        });
        this.placeInstance('space/gate', new THREE.Vector3(-16, 0, 1), Math.PI * 0.5, 1, true);

        // Bục máy Lò phản ứng hạt nhân ở trung tâm Site A
        this.placeInstance('space/template-floor-layer-raised', new THREE.Vector3(-10, 0, 0), 0, 1, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-10, 0, 4), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-10, 0, -4), 0, 1.2, true);

        // Vật cản khúc cua Long A
        this.placeInstance('space/template-detail', new THREE.Vector3(-22, 0, 8), 0, 1.2, true);
        this.placeInstance('space/template-detail', new THREE.Vector3(-22, 0, -8), 0, 1.2, true);
        this.placeInstance('space/template-wall-half', new THREE.Vector3(-20, 0, 0), Math.PI * 0.5, 1, true);

        // 2. Cứ điểm B: Kho chứa năng lượng Beta (Site B - B Tunnels & Room)
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
        const time = performance.now() * 0.003;
        for (const p of this.portals) {
            if (p.ring) {
                p.ring.rotation.z += delta * 2.5;
            }
            if (p.vortex && p.vortex.material) {
                p.vortex.material.opacity = 0.75 + Math.sin(time * 4 + p.position.z) * 0.15;
            }
        }
    }
}
