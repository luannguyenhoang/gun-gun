import * as THREE from 'three';
import { BaseArena } from './arena-base.js';

/**
 * Bản đồ Làng Rừng Cổ Xanh Mát (Lush Ancient Forest Village)
 * Thiết kế ĐỘC QUYỀN cho chế độ Góc nhìn thứ nhất (FPS SOLO):
 * - Không gian thiên nhiên tươi mát rợp bóng cây xanh, bao gồm cụm nhà gỗ, nhà đá cổ,
 *   cối xay gió (windmill), đài phun nước, chòi chợ và cầu gỗ.
 * - Bố cục 3 làn chiến thuật cân bằng, góc nấp sau hiên nhà, ô cửa sổ và góc tường chuẩn FPS.
 * - Tối ưu hóa va chạm Box3, lưới phân vùng SpatialGrid và duy trì 60 FPS mượt mà.
 */
export class FPSArena extends BaseArena {
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
        if (this.th_isLoaded) return;
        const modelNames = [
            'floor', 'floor-detail', 'wall', 'wall-gate',
            'forest/tree', 'forest/tree-high', 'forest/plant', 'forest/rocks-low', 'forest/rocks-high',
            'forest/fence', 'forest/tent', 'forest/patch-grass',
            'forest/building-structure', 'forest/building-roof', 'forest/building-platform', 'forest/bridge',
            'graveyard/pine', 'graveyard/pine-crooked', 'graveyard/stone-wall', 'graveyard/stone-wall-damaged',
            'graveyard/stone-wall-column', 'graveyard/pillar-large', 'graveyard/pillar-obelisk', 'graveyard/crypt-door',
            'graveyard/crypt-large', 'graveyard/crypt-small',
            'fantasy/fountain-round', 'fantasy/fountain-center', 'fantasy/hedge', 'fantasy/hedge-large',
            'fantasy/hedge-gate', 'fantasy/tree-high-round', 'fantasy/wall', 'fantasy/wall-half',
            'fantasy/wall-broken', 'fantasy/wall-arch', 'fantasy/cart', 'fantasy/stairs-stone',
            'fantasy/banner-green', 'fantasy/banner-red', 'fantasy/rock-large', 'fantasy/rock-wide',
            'fantasy/windmill', 'fantasy/watermill', 'fantasy/stall-green', 'fantasy/stall-red', 'fantasy/stall'
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
                    (err) => {
                        console.error(`[FPSArena] Lỗi tải model ${name}:`, err);
                        resolve();
                    }
                );
            });
        });

        await Promise.all(promises);
        this.th_isLoaded = true;
    }

    placeProp(modelName, position, rotationY = 0, scale = 1, addCollider = false) {
        const base = this.models[modelName];
        if (!base) return null;

        const clone = base.clone(true);
        clone.position.copy(position);
        clone.rotation.y = rotationY;
        if (typeof scale === 'number') {
            clone.scale.set(scale, scale, scale);
        } else if (scale && typeof scale.x === 'number') {
            clone.scale.set(scale.x, scale.y, scale.z);
        }
        this.addSceneObject(clone);

        if (addCollider) {
            clone.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(clone);
            this.colliders.push(box);
        }

        return clone;
    }

    buildArena() {
        if (!this.models['floor'] || !this.models['fantasy/wall']) {
            this.loadModels().then(() => {
                if (this.sceneObjects.length === 0) {
                    this.buildArena();
                }
            });
            if (Object.keys(this.models).length === 0) return;
        }

        this.setupLighting();
        this.buildFloorAndWalls();
        this.buildSpawnPortals();
        this.buildBases();
        this.buildCenterVillagePlaza();
        this.buildTacticalSiteA();
        this.buildTacticalSiteB();
        this.buildGrass();

        this.optimizeColliders();
        this.buildSpatialGrid();
    }

    setupLighting() {
        // Ánh sáng ban ngày ấm áp trong trẻo xuyên qua tán rừng làng cổ
        this.ambientLight = new THREE.AmbientLight(0xdcfce7, 0.55);
        this.addSceneObject(this.ambientLight);

        // Bầu trời xanh dịu và phản chiếu màu cỏ xanh tươi mát
        this.hemiLight = new THREE.HemisphereLight(0x78c2e6, 0x2e7d32, 0.45);
        this.addSceneObject(this.hemiLight);

        // Ánh nắng mặt trời ban ngày rọi xiên tự nhiên
        const sun = new THREE.DirectionalLight(0xfffaf0, 1.35);
        sun.position.set(24, 38, 20);
        sun.castShadow = false;
        this.sunLight = sun;
        this.addSceneObject(sun);
        this.addSceneObject(sun.target);

        // Đèn dịu mắt định vị các khu vực chiến thuật
        const tacticalLights = [
            { pos: [0, 4.0, 23], color: 0x38bdf8, intensity: 1.5, dist: 16 }, // Blue Camp
            { pos: [0, 4.0, -23], color: 0xf97316, intensity: 1.5, dist: 16 }, // Red Camp
            { pos: [0, 5.0, 0], color: 0x2dd4bf, intensity: 1.6, dist: 16 },  // Quảng trường đài phun nước Mid
            { pos: [-13, 4.0, 0], color: 0xc084fc, intensity: 1.4, dist: 15 }, // Nhà đá cổ Site A
            { pos: [18, 4.0, 0], color: 0xfacc15, intensity: 1.4, dist: 15 }   // Cụm nhà gỗ Site B
        ];

        tacticalLights.forEach(tl => {
            const pl = new THREE.PointLight(tl.color, tl.intensity, tl.dist);
            pl.position.set(tl.pos[0], tl.pos[1], tl.pos[2]);
            this.addSceneObject(pl);
            this.tacticalLights.push(pl);
        });
    }

    setQuality({ mode = 'optimized', shadows = false } = {}) {
        const isFull = mode !== 'optimized';
        for (const light of this.tacticalLights) {
            light.visible = isFull;
        }
        if (this.sunLight) {
            this.sunLight.castShadow = !!shadows;
        }
    }

    buildFloorAndWalls() {
        const halfSize = this.halfSize; // 28m
        const tileSize = 2;

        // 1. Mặt Sàn Thảm Cỏ Xanh Tươi Mát (Lush Green Turf)
        const floorBase = this.models['floor'];
        let floorGeo = null;
        if (floorBase) {
            floorBase.traverse(c => {
                if (c.isMesh && !floorGeo) floorGeo = c.geometry;
            });
        }

        if (floorGeo) {
            const steps = Math.floor((halfSize * 2) / tileSize) + 1;
            const totalTiles = steps * steps;

            const grassMat = new THREE.MeshStandardMaterial({
                color: 0x48a83d,
                roughness: 0.88,
                metalness: 0.02
            });

            const instancedFloor = new THREE.InstancedMesh(floorGeo, grassMat, totalTiles);
            instancedFloor.name = 'forest-village-floor';
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

                    const wave = Math.sin(x * 0.35 + z * 0.25) * 0.04;
                    const r = 0.24 + wave;
                    const g = 0.62 + wave * 1.2;
                    const b = 0.22 + wave * 0.8;
                    instancedFloor.setColorAt(idx++, new THREE.Color(r, g, b));
                }
            }
            instancedFloor.count = idx;
            instancedFloor.instanceMatrix.needsUpdate = true;
            instancedFloor.instanceColor.needsUpdate = true;
            this.addSceneObject(instancedFloor);
        }

        // 2. Tường Bao Chu Vi Bằng Tường Thành Đá Cổ Làng Rừng
        const wallProps = this.getMeshProps('fantasy/wall') || this.getMeshProps('wall');
        if (wallProps && wallProps.geo && wallProps.mat) {
            const wallStep = 4;
            const stepsCount = Math.floor((halfSize * 2) / wallStep);
            const totalWalls = stepsCount * 4;

            const instancedWalls = new THREE.InstancedMesh(wallProps.geo, wallProps.mat, totalWalls + 8);
            instancedWalls.name = 'village-perimeter-walls';
            instancedWalls.castShadow = true;
            instancedWalls.receiveShadow = true;

            const dummy = new THREE.Object3D();
            let wIdx = 0;

            for (let x = -halfSize + 2; x <= halfSize - 2; x += wallStep) {
                dummy.position.set(x, 0, -halfSize);
                dummy.rotation.set(0, 0, 0);
                dummy.scale.set(2, 2, 2);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                dummy.position.set(x, 0, halfSize);
                dummy.rotation.set(0, Math.PI, 0);
                dummy.scale.set(2, 2, 2);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
            }

            for (let z = -halfSize + 2; z <= halfSize - 2; z += wallStep) {
                dummy.position.set(-halfSize, 0, z);
                dummy.rotation.set(0, Math.PI * 0.5, 0);
                dummy.scale.set(2, 2, 2);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);

                dummy.position.set(halfSize, 0, z);
                dummy.rotation.set(0, -Math.PI * 0.5, 0);
                dummy.scale.set(2, 2, 2);
                dummy.updateMatrix();
                instancedWalls.setMatrixAt(wIdx++, dummy.matrix);
            }

            instancedWalls.count = wIdx;
            instancedWalls.instanceMatrix.needsUpdate = true;
            this.addSceneObject(instancedWalls);
        }

        // Rặng cây thông cổ thụ và cây tán tròn che mát quanh mép chu vi
        const borderCoords = [-24, -16, -8, 0, 8, 16, 24];
        borderCoords.forEach(coord => {
            this.placeProp('graveyard/pine', new THREE.Vector3(coord, 0, -halfSize + 2.5), 0, 2.0, false);
            this.placeProp('graveyard/pine', new THREE.Vector3(coord, 0, halfSize - 2.5), Math.PI, 2.0, false);
            this.placeProp('fantasy/tree-high-round', new THREE.Vector3(-halfSize + 2.5, 0, coord), 0, 1.8, false);
            this.placeProp('forest/tree-high', new THREE.Vector3(halfSize - 2.5, 0, coord), 0, 1.8, false);
        });

        // Hộp va chạm biên chu vi bản đồ
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
            const gate = this.placeProp('fantasy/wall-arch', p.pos, p.rot, 1.8, true) || this.placeProp('wall-gate', p.pos, p.rot, 2.4, true);
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
                color: idx % 2 === 0 ? 0x38bdf8 : 0x4ade80,
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
                color: 0x22c55e,
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

    /**
     * Dựng Căn cứ 2 phe: Blue Forest Camp & Red Forest Camp (kèm nhà trạm gác & nhà gỗ)
     */
    buildBases() {
        // --- 1. BLUE CAMP (Phía Nam - Z = 18 đến 28) ---
        // Vách thành đá mặt tiền (Z = 18)
        this.placeProp('fantasy/wall', new THREE.Vector3(-14, 0, 18), Math.PI, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(-6, 0, 18), Math.PI, 1.8, true);
        this.placeProp('fantasy/wall-arch', new THREE.Vector3(0, 0, 18), Math.PI, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(6, 0, 18), Math.PI, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(14, 0, 18), Math.PI, 1.8, true);

        // Cờ hiệu xanh thiên thanh
        this.placeProp('fantasy/banner-green', new THREE.Vector3(-3.2, 0, 18.2), 0, 1.6, false);
        this.placeProp('fantasy/banner-green', new THREE.Vector3(3.2, 0, 18.2), 0, 1.6, false);

        // Chòi nhà trạm gác mái ngói xanh Blue Camp ở góc tây
        this.placeProp('fantasy/stall-green', new THREE.Vector3(-11.5, 0, 24.0), Math.PI * 0.5, 1.8, true);

        // Ngôi nhà gỗ kiểm lâm của Blue Camp ở góc đông
        this.placeProp('forest/building-structure', new THREE.Vector3(11.5, 0, 24.0), 0, 1.8, true);
        this.placeProp('forest/building-roof', new THREE.Vector3(11.5, 1.8, 24.0), 0, 1.8, false);

        // Xe kéo gỗ và hàng rào gỗ bên cánh
        this.placeProp('fantasy/cart', new THREE.Vector3(-10.5, 0, 20.0), 0, 1.3, true);
        this.placeProp('forest/fence', new THREE.Vector3(10.5, 0, 20.0), 0, 1.4, true);

        // Cây xanh rợp bóng mát
        this.placeProp('fantasy/tree-high-round', new THREE.Vector3(-11.5, 0, 26.5), 0, 1.8, false);
        this.placeProp('fantasy/tree-high-round', new THREE.Vector3(11.5, 0, 26.5), 0, 1.8, false);


        // --- 2. RED CAMP (Phía Bắc - Z = -18 đến -28) ---
        // Vách thành đá mặt tiền (Z = -18)
        this.placeProp('fantasy/wall', new THREE.Vector3(-14, 0, -18), 0, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(-6, 0, -18), 0, 1.8, true);
        this.placeProp('fantasy/wall-arch', new THREE.Vector3(0, 0, -18), 0, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(6, 0, -18), 0, 1.8, true);
        this.placeProp('fantasy/wall', new THREE.Vector3(14, 0, -18), 0, 1.8, true);

        // Cờ hiệu đỏ rực rỡ
        this.placeProp('fantasy/banner-red', new THREE.Vector3(-3.2, 0, -18.2), Math.PI, 1.6, false);
        this.placeProp('fantasy/banner-red', new THREE.Vector3(3.2, 0, -18.2), Math.PI, 1.6, false);

        // Chòi nhà trạm chỉ huy mái ngói đỏ Red Camp ở góc đông
        this.placeProp('fantasy/stall-red', new THREE.Vector3(11.5, 0, -24.0), -Math.PI * 0.5, 1.8, true);

        // Ngôi nhà đá cổ lăng mộ kiên cố ở góc tây Red Camp
        this.placeProp('graveyard/crypt-large', new THREE.Vector3(-11.5, 0, -24.0), 0, 1.8, true);

        // Xe kéo gỗ quân sự và hàng rào bên cánh
        this.placeProp('fantasy/cart', new THREE.Vector3(10.5, 0, -20.0), Math.PI, 1.3, true);
        this.placeProp('forest/fence', new THREE.Vector3(-10.5, 0, -20.0), 0, 1.4, true);

        // Cây thông cổ thụ tỏa bóng mát
        this.placeProp('graveyard/pine', new THREE.Vector3(-8.5, 0, -26.5), 0, 2.0, false);
        this.placeProp('graveyard/pine', new THREE.Vector3(8.5, 0, -26.5), 0, 2.0, false);
    }

    /**
     * Dựng Trục Đường Mid - Quảng Trường Làng Cổ, Cối Xay Gió (Windmill) & Đài Phun Nước
     */
    buildCenterVillagePlaza() {
        // Vách hàng rào cây xanh xén tỉa tuyệt đẹp ngăn cách trục Mid với 2 cánh
        const westHedgeZ = [-14, -10, 10, 14];
        westHedgeZ.forEach(z => {
            this.placeProp('fantasy/hedge-large', new THREE.Vector3(-4.5, 0, z), Math.PI * 0.5, 1.4, true);
        });
        this.placeProp('fantasy/hedge-gate', new THREE.Vector3(-4.5, 0, 0), Math.PI * 0.5, 1.4, true);

        const eastHedgeZ = [-14, -10, 10, 14];
        eastHedgeZ.forEach(z => {
            this.placeProp('fantasy/hedge-large', new THREE.Vector3(4.5, 0, z), -Math.PI * 0.5, 1.4, true);
        });
        this.placeProp('fantasy/hedge-gate', new THREE.Vector3(4.5, 0, 0), -Math.PI * 0.5, 1.4, true);

        // --- ĐÀI PHUN NƯỚC Ở TÂM MID (X = 0, Z = 0) ---
        this.placeProp('fantasy/fountain-round', new THREE.Vector3(0, 0, 0), 0, 1.8, true);
        this.placeProp('fantasy/fountain-center', new THREE.Vector3(0, 0.4, 0), 0, 1.6, false);

        // --- CỐI XAY GIÓ LÀNG CỔ (WINDMILL) SỪNG SỮNG Ở MID ---
        this.placeProp('fantasy/windmill', new THREE.Vector3(-2.2, 0, -8), 0, 2.2, true);

        // --- NHÀ CỐI XAY NƯỚC (WATERMILL) & CẦU GỖ Ở SƯỜN PHÍA NAM MID ---
        this.placeProp('fantasy/watermill', new THREE.Vector3(2.2, 0, 8), 0, 1.8, true);
        this.placeProp('forest/bridge', new THREE.Vector3(0, 0, 4.5), 0, 1.4, true);

        // Vật cản ngắm bắn nấp so le chuẩn FPS
        this.placeProp('fantasy/wall-half', new THREE.Vector3(-2.2, 0, 7.5), 0, 1.4, true);
        this.placeProp('forest/rocks-high', new THREE.Vector3(2.2, 0, 7.5), 0, 1.2, true);

        this.placeProp('fantasy/wall-half', new THREE.Vector3(2.2, 0, -7.5), Math.PI, 1.4, true);
        this.placeProp('forest/rocks-high', new THREE.Vector3(-2.2, 0, -7.5), Math.PI, 1.2, true);

        // Cây xanh bóng mát rợp đường Mid
        this.placeProp('forest/tree', new THREE.Vector3(-3.2, 0, 12), 0, 1.6, false);
        this.placeProp('graveyard/pine', new THREE.Vector3(3.2, 0, -12), 0, 1.8, false);
    }

    /**
     * Dựng Cứ Điểm A: Ngôi Nhà Đá Cổ (Ancient Stone Crypt), Cột Obelisk & Đường Đá Long A
     */
    buildTacticalSiteA() {
        // --- 1. CON ĐƯỜNG ĐÁ LONG A (X = -21, Z từ -16 đến +16) ---
        this.placeProp('fantasy/rock-large', new THREE.Vector3(-21, 0, 10), 0, 1.6, true);
        this.placeProp('fantasy/rock-large', new THREE.Vector3(-21, 0, -10), Math.PI, 1.6, true);
        this.placeProp('fantasy/wall-half', new THREE.Vector3(-21, 0, 0), Math.PI * 0.5, 1.4, true);

        this.placeProp('forest/rocks-low', new THREE.Vector3(-21, 0, 4.5), 0, 1.4, true);
        this.placeProp('forest/rocks-low', new THREE.Vector3(-21, 0, -4.5), 0, 1.4, true);
        this.placeProp('graveyard/pine-crooked', new THREE.Vector3(-23, 0, 6), 0, 1.8, false);
        this.placeProp('graveyard/pine-crooked', new THREE.Vector3(-23, 0, -6), Math.PI, 1.8, false);

        // Vách thành đá nối Long A và Site A
        this.placeProp('graveyard/stone-wall', new THREE.Vector3(-16, 0, 8), Math.PI * 0.5, 1.6, true);
        this.placeProp('graveyard/stone-wall', new THREE.Vector3(-16, 0, -8), Math.PI * 0.5, 1.6, true);
        this.placeProp('fantasy/wall-arch', new THREE.Vector3(-16, 0, 0), Math.PI * 0.5, 1.8, true);

        // --- 2. TRUNG TÂM CỨ ĐIỂM SITE A (Sanctuary - X = -12, Z = 0) ---
        // Ngôi nhà đá cổ rêu phong uy nghiêm nguyên căn có cửa đi vào
        this.placeProp('graveyard/crypt-large', new THREE.Vector3(-13.5, 0, 0), Math.PI * 0.5, 1.9, true);

        // Bậc thang đá và cột đá obelisk cổ kính trước thềm nhà
        this.placeProp('fantasy/stairs-stone', new THREE.Vector3(-8.8, 0, 0), -Math.PI * 0.5, 1.4, true);
        this.placeProp('graveyard/pillar-obelisk', new THREE.Vector3(-9.2, 0, 3.5), 0, 1.8, true);
        this.placeProp('graveyard/pillar-large', new THREE.Vector3(-9.2, 0, -3.5), 0, 1.6, true);

        // Tường đá nứt vỡ cổ kính làm vật cản núp bắn
        this.placeProp('graveyard/stone-wall-damaged', new THREE.Vector3(-12, 0, 7.2), 0, 1.6, true);
        this.placeProp('graveyard/stone-wall-damaged', new THREE.Vector3(-12, 0, -7.2), 0, 1.6, true);

        // Cây cổ thụ xanh mát
        this.placeProp('fantasy/tree-high-round', new THREE.Vector3(-16, 0, -3), 0, 1.8, false);
        this.placeProp('forest/plant', new THREE.Vector3(-10, 0, 2), 0, 1.4, false);
    }

    /**
     * Dựng Cứ Điểm B: Cụm Nhà Gỗ Làng Rừng (Forest Cabins & Market Outpost)
     */
    buildTacticalSiteB() {
        // Vách hàng rào cây xanh nối vào Site B
        this.placeProp('fantasy/hedge-large', new THREE.Vector3(13, 0, 12), -Math.PI * 0.5, 1.4, true);
        this.placeProp('fantasy/hedge-large', new THREE.Vector3(13, 0, -12), -Math.PI * 0.5, 1.4, true);
        this.placeProp('fantasy/hedge-gate', new THREE.Vector3(13, 0, 6), -Math.PI * 0.5, 1.4, true);
        this.placeProp('fantasy/hedge-gate', new THREE.Vector3(13, 0, -6), -Math.PI * 0.5, 1.4, true);

        // --- 1. NGÔI NHÀ GỖ LỚN Ở TÂM SITE B (Forest Wooden Cabin - X = 18, Z = 0) ---
        this.placeProp('forest/building-structure', new THREE.Vector3(18.0, 0, 0), 0, 2.2, true);
        this.placeProp('forest/building-roof', new THREE.Vector3(18.0, 2.2, 0), 0, 2.2, false);

        // --- 2. CÁC CÔNG TRÌNH NHÀ PHỤ CẬN SITE B ---
        // Chòi nhà chợ nông sản làng rừng (X = 20, Z = 8)
        this.placeProp('fantasy/stall', new THREE.Vector3(20.0, 0, 8.5), -Math.PI * 0.5, 1.8, true);

        // Lều dã ngoại quân sự (X = 20, Z = -8)
        this.placeProp('forest/tent', new THREE.Vector3(20.0, 0, -8.5), Math.PI * 0.5, 1.6, true);

        // Xe kéo gỗ chở hàng và tảng đá tự nhiên
        this.placeProp('fantasy/cart', new THREE.Vector3(15.0, 0, 9.0), 0, 1.3, true);
        this.placeProp('fantasy/rock-wide', new THREE.Vector3(16.0, 0, -10.0), Math.PI * 0.5, 1.4, true);

        // Tường thành đá thấp phía rìa đông
        this.placeProp('fantasy/wall-half', new THREE.Vector3(24, 0, 0), Math.PI * 0.5, 1.4, true);

        // Rừng thông cổ thụ tỏa bóng mát
        this.placeProp('graveyard/pine', new THREE.Vector3(22, 0, 3.8), 0, 2.0, false);
        this.placeProp('graveyard/pine', new THREE.Vector3(22, 0, -3.8), 0, 2.0, false);
        this.placeProp('forest/fence', new THREE.Vector3(14, 0, 0), 0, 1.5, true);
    }

    buildGrass() {
        // Mặt sàn đã được phủ thảm cỏ xanh mướt mát mắt qua InstancedMesh
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
