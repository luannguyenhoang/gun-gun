import * as THREE from 'three';
import { BaseArena } from './arena-base.js';

/**
 * Bản đồ Đấu trường Sinh tồn Zombie (Zombie Survival Arena)
 * Đấu trường đô thị bỏ hoang nguyên bản: sàn nhựa đường, vạch sơn phân làn,
 * tượng đài trung tâm, vật cản che chắn và 8 cổng portal ma quái sinh zombie.
 */
export class SurvivalArena extends BaseArena {
    constructor(scene, gltfLoader) {
        super(scene, gltfLoader);
        this.halfSize = 25;
        this.radius = 26;

        this.gridCellSize = 4.0;
        this.gridMinX = -32;
        this.gridMinZ = -32;
        this.gridCols = 16;
        this.gridRows = 16;
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

        // Tối ưu hóa va chạm và xây dựng lưới không gian
        this.optimizeColliders();
        this.buildSpatialGrid();
    }

    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xddeeff, 0.6);
        this.addSceneObject(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0x88ccff, 0x223344, 0.5);
        this.addSceneObject(this.hemiLight);

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
        this.addSceneObject(sun);
        this.addSceneObject(sun.target);

        // Đèn đường góc map và đèn giao lộ trung tâm
        const streetLightPositions = [
            [-20, 5, -20], [20, 5, -20],
            [-20, 5,  20], [20, 5,  20],
            [  0, 5,   0]
        ];
        streetLightPositions.forEach(([x, y, z]) => {
            const sl = new THREE.PointLight(0xffa040, 3.5, 22);
            sl.position.set(x, y, z);
            this.addSceneObject(sl);
            this.tacticalLights.push(sl);
        });
    }

    buildFloorAndWalls() {
        const halfSize = this.halfSize;
        const tileSize = 2;

        // 1. Sàn nhựa đường đô thị tối ưu qua InstancedMesh
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
            const turfMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
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
                    const v = 0.28 + (Math.sin(x * 0.5 + z * 0.3) + 1) * 0.025;
                    instancedFloor.setColorAt(idx++, new THREE.Color(v, v, v + 0.01));
                }
            }
            instancedFloor.instanceMatrix.needsUpdate = true;
            this.addSceneObject(instancedFloor);

            // Vạch đường phân làn đô thị
            const laneLineMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3 });
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
                this.addSceneObject(line);
            });
        }

        // 2. Tường bao chu vi ngoài cùng kết hợp cổng mở
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
            const isGateGap = (val) => Math.abs(Math.abs(val) - 10) < 2.5;

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
            this.addSceneObject(instancedWalls);
        }

        // Hộp va chạm bao quanh biên
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
        const portalDist = 26;
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
            const gate = this.placeInstance('wall-gate', p.pos, p.rot, 2.4, true);
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
                color: idx % 2 === 0 ? 0xb026ff : 0xff0055,
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

            const pLight = new THREE.PointLight(idx % 2 === 0 ? 0xb026ff : 0xff0055, 4, 10);
            pLight.position.copy(p.pos);
            pLight.position.y = 1.4;
            pLight.position.addScaledVector(p.spawnDir, 0.8);
            this.addSceneObject(pLight);

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
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 }));
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.y = 0.025;
        plaza.receiveShadow = true;
        plaza.name = 'walkable-plaza';
        this.addSceneObject(plaza);

        const roundabout = new THREE.Mesh(
            new THREE.RingGeometry(3.2, 3.5, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
        );
        roundabout.rotation.x = -Math.PI / 2;
        roundabout.position.y = 0.04;
        this.addSceneObject(roundabout);
    }

    buildTacticalCover() {
        const coverPoints = [
            { model: 'block',  pos: [-20, 0, -20], rot: 0,    scale: 2.0 },
            { model: 'block',  pos: [ 20, 0, -20], rot: 0,    scale: 2.0 },
            { model: 'block',  pos: [-20, 0,  20], rot: 0,    scale: 2.0 },
            { model: 'block',  pos: [ 20, 0,  20], rot: 0,    scale: 2.0 },

            { model: 'wall-low', pos: [-5, 0, -18], rot: 0,             scale: 1.8 },
            { model: 'wall-low', pos: [ 5, 0,  18], rot: Math.PI,       scale: 1.8 },

            { model: 'weapon-rack', pos: [-13, 0, 0], rot: Math.PI * 0.5,  scale: 1.8 },
            { model: 'weapon-rack', pos: [ 13, 0, 0], rot: -Math.PI * 0.5, scale: 1.8 },
        ];

        coverPoints.forEach(cp => {
            this.placeInstance(cp.model, new THREE.Vector3(cp.pos[0], cp.pos[1], cp.pos[2]), cp.rot, cp.scale, true);
        });

        const treePositions = [
            [-10, 0, -22], [10, 0, -22],
            [-10, 0,  22], [10, 0,  22],
            [-22, 0, -10], [-22, 0, 10],
            [ 22, 0, -10], [ 22, 0, 10],
        ];
        treePositions.forEach(([x, y, z], i) => {
            this.placeInstance('tree', new THREE.Vector3(x, y, z), i * 0.7, 1.6, false);
        });

        this.placeInstance('banner', new THREE.Vector3(-17, 0, -17), 0.8, 1.6, false);
        this.placeInstance('banner', new THREE.Vector3( 17, 0,  17), 2.5, 1.6, false);
    }

    buildGrass() {
        // Giữ mặt sàn nhựa đường sạch sẽ
    }

    update(delta) {
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
}
