import * as THREE from 'three';
import { GLTFLoader } from '../../../vendor/loaders/GLTFLoader.js';
import { sounds } from '../../audio/audio.js';
import { RARE_WEAPON_CONFIGS, ATTACHMENT_DEFS, RARITY_TIERS } from '../combat/weapons.js';
import { LOOT_ITEMS } from './looting.js';

// Cache mô hình 3D cho vật phẩm nhặt
const _gltfLoader = typeof window !== 'undefined' ? new GLTFLoader() : null;
const _pickupModelCache = new Map();

function getOrLoadPickupModel(path, onLoad) {
    if (typeof window === 'undefined' || !_gltfLoader) return;
    if (_pickupModelCache.has(path)) {
        onLoad(_pickupModelCache.get(path).clone());
        return;
    }
    _gltfLoader.load(path, (gltf) => {
        gltf.scene.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });
        _pickupModelCache.set(path, gltf.scene);
        onLoad(gltf.scene.clone());
    }, undefined, () => {});
}

// Nạp trước các mô hình vật phẩm nhặt
if (typeof window !== 'undefined' && _gltfLoader) {
    getOrLoadPickupModel('assets/models/aid-defibrillator-green.glb', () => {});
    getOrLoadPickupModel('assets/models/aid-defibrillator-red.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/clip-large.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/silencer-larger.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/scope-large-a.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/blaster-e.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/blaster-j.glb', () => {});
    getOrLoadPickupModel('assets/models/kenney-blaster/blaster-r.glb', () => {});
}

// Căn giữa và điều chỉnh kích thước chuẩn cho mô hình GLTF
function centerAndScaleModel(model, targetScale = 1.0) {
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.scale.setScalar(targetScale);
    return wrapper;
}

// Dựng mô hình Khiên Năng Lượng Lục Giác 3D chi tiết cao (Hexagonal Energy Shield)
function createTacticalShieldMesh() {
    const shieldGroup = new THREE.Group();

    // 1. Khung kim loại viền lục giác titan mạ bạc
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.25
    });
    const rimGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 6);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    shieldGroup.add(rimMesh);

    // 2. Kính năng lượng phát sáng Cyan rực rỡ
    const energyMat = new THREE.MeshStandardMaterial({
        color: 0x00d0ff,
        emissive: 0x00d0ff,
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85
    });
    const energyGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 6);
    const energyMesh = new THREE.Mesh(energyGeo, energyMat);
    energyMesh.rotation.x = Math.PI / 2;
    shieldGroup.add(energyMesh);

    // 3. Lõi pin phản ứng năng lượng ở giữa
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.5,
        roughness: 0.1
    });
    const coreGeo = new THREE.OctahedronGeometry(0.12);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.z = 0.03;
    shieldGroup.add(coreMesh);

    // 4. Các thanh giằng kim loại bảo vệ
    const braceMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.8,
        roughness: 0.3
    });
    const braceH = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.08), braceMat);
    const braceV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.56, 0.08), braceMat);
    shieldGroup.add(braceH, braceV);

    return shieldGroup;
}

// Dựng mô hình Tay Cầm Chiến Thuật Góc Nghiêng 3D (Angled Foregrip)
function createTacticalGripMesh() {
    const gripGroup = new THREE.Group();

    // 1. Ray gá kẹp Picatinny trên đỉnh
    const mountMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.3
    });
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), mountMat);
    mount.position.y = 0.22;
    gripGroup.add(mount);

    // 2. Thân tay cầm báng nghiêng công thái học
    const handleMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.6,
        metalness: 0.2
    });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.14), handleMat);
    handle.position.set(0, 0.02, 0);
    handle.rotation.x = -0.38;
    gripGroup.add(handle);

    // 3. Khía vân chống trượt
    const ribMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.8
    });
    for (let i = -1; i <= 1; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.15), ribMat);
        rib.position.set(0, i * 0.08, 0);
        rib.rotation.x = -0.38;
        gripGroup.add(rib);
    }

    // 4. Viền chỉ thị cam Amber cao cấp
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8
    });
    const accent = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.025, 0.155), accentMat);
    accent.position.set(0, 0.15, 0);
    accent.rotation.x = -0.38;
    gripGroup.add(accent);

    return gripGroup;
}

// Dựng mô hình Nòng Giảm Thanh tác chiến (Fallback khi chưa load file GLB)
function createTacticalSilencerFallback() {
    const silencerGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.25
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 16), mat);
    tube.rotation.z = Math.PI / 2;
    silencerGroup.add(tube);

    const tipMat = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xff4444,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3
    });
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.08, 16), tipMat);
    tip.rotation.z = Math.PI / 2;
    tip.position.x = 0.31;
    silencerGroup.add(tip);

    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.10, 0.08, 16), mat);
    mount.rotation.z = Math.PI / 2;
    mount.position.x = -0.31;
    silencerGroup.add(mount);
    return silencerGroup;
}

// Dựng mô hình Kính Ngắm tác chiến ACOG (Fallback khi chưa load file GLB)
function createTacticalScopeFallback() {
    const scopeGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.25
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.44, 16), bodyMat);
    tube.rotation.z = Math.PI / 2;
    scopeGroup.add(tube);

    const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.07, 0.16, 16), bodyMat);
    obj.rotation.z = Math.PI / 2;
    obj.position.x = 0.28;
    scopeGroup.add(obj);

    const lensMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xa855f7,
        emissiveIntensity: 0.9,
        metalness: 0.5,
        roughness: 0.1
    });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.115, 16), lensMat);
    lens.rotation.y = Math.PI / 2;
    lens.position.x = 0.36;
    scopeGroup.add(lens);

    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.12, 16), bodyMat);
    eye.rotation.z = Math.PI / 2;
    eye.position.x = -0.26;
    scopeGroup.add(eye);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), bodyMat);
    turret.position.y = 0.09;
    scopeGroup.add(turret);
    return scopeGroup;
}

// Huy hiệu chữ thập y tế phát quang
function createMedicalCrossBadge(colorHex) {
    const badgeGroup = new THREE.Group();
    const crossMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.95,
        roughness: 0.2
    });
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.06), crossMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.06), crossMat);
    badgeGroup.add(barH, barV);
    badgeGroup.position.y = 0.28;
    return badgeGroup;
}

// Bảng tỉ lệ rơi đồ chuẩn hóa: Giảm tỉ lệ rơi rác, tập trung hồi máu, giáp và cứu thương
export const DROP_TYPES = [
    { id: 'health', label: '+40 MÁU', color: 0x00ff88, weight: 0.40 },
    { id: 'shield', label: '+50 GIÁP', color: 0x00d0ff, weight: 0.35 },
    { id: 'medkit', label: '+1 TÚI CỨU THƯƠNG', color: 0x10b981, weight: 0.15 },
    { id: 'barrel', label: 'PHỤ KIỆN: NÒNG', color: 0xff4444, weight: 0.02 },
    { id: 'magazine', label: 'PHỤ KIỆN: BĂNG ĐẠN', color: 0x38bdf8, weight: 0.02 },
    { id: 'optic', label: 'PHỤ KIỆN: KÍNH NGẮM', color: 0xa855f7, weight: 0.02 },
    { id: 'grip', label: 'PHỤ KIỆN: TAY CẦM', color: 0xf59e0b, weight: 0.02 },
    { id: 'weapon', label: 'VŨ KHÍ MỚI', color: 0xffaa22, weight: 0.02 }
];

// Tỷ lệ rơi trực tiếp từ zombie thường: Giảm từ 5% xuống 2.5%
export const DROP_CHANCE = 0.025;
const ATTACHMENT_SLOTS = ['barrel', 'magazine', 'optic', 'grip'];

export class PickupManager {
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        this.pickups = [];
        this.nextId = 1;
        this.airdropTimer = 22;

        this.geoBeam = new THREE.CylinderGeometry(0.04, 0.1, 2.2, 6);
    }

    spawnDrop(position, enemyType = 'walker') {
        // Tỷ lệ rơi cho quái thường: 2.5%
        if (enemyType !== 'boss' && enemyType !== 'giant' && enemyType !== 'tank') {
            if (Math.random() >= DROP_CHANCE) return null;
        } else if (enemyType === 'giant' || enemyType === 'tank') {
            // Quái to có 15% tỷ lệ rơi vật phẩm trực tiếp
            if (Math.random() >= 0.15) return null;
        }

        let forcedType = null;
        if (enemyType === 'boss') {
            forcedType = Math.random() < 0.5 ? 'weapon' : ATTACHMENT_SLOTS[Math.floor(Math.random() * ATTACHMENT_SLOTS.length)];
        }

        let roll = Math.random();
        const definition = DROP_TYPES.find(drop => {
            roll -= drop.weight;
            return roll < 0;
        }) || DROP_TYPES[0];

        const type = forcedType || definition.id;
        return this.createPickup(position, type);
    }

    createPickup(position, type, options = {}) {
        if (type === 'airdrop') return this.createAirdrop(position, options);
        const definition = DROP_TYPES.find(drop => drop.id === type) || DROP_TYPES[0];
        const { color } = definition;

        const weaponSlot = type === 'weapon' ? (options.weaponSlot ?? Math.floor(Math.random() * RARE_WEAPON_CONFIGS.length)) : null;
        const label = type === 'weapon' ? RARE_WEAPON_CONFIGS[weaponSlot].name : definition.label;

        const mesh = new THREE.Group();
        mesh.position.copy(position);
        mesh.position.y = 0.7;

        const body = new THREE.Group();
        mesh.add(body);

        // Nạp mô hình 3D thực tế chi tiết theo từng loại vật phẩm
        if (type === 'barrel') {
            const modelPath = 'assets/models/kenney-blaster/silencer-larger.glb';
            const attachSilencer = (model) => {
                const wrapper = centerAndScaleModel(model, 2.0);
                wrapper.rotation.z = Math.PI / 2;
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachSilencer(_pickupModelCache.get(modelPath).clone());
            } else {
                const fallback = createTacticalSilencerFallback();
                body.add(fallback);
                getOrLoadPickupModel(modelPath, (loaded) => {
                    body.remove(fallback);
                    attachSilencer(loaded);
                });
            }
        } else if (type === 'optic') {
            const modelPath = 'assets/models/kenney-blaster/scope-large-a.glb';
            const attachScope = (model) => {
                const wrapper = centerAndScaleModel(model, 1.8);
                wrapper.rotation.y = Math.PI / 2;
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachScope(_pickupModelCache.get(modelPath).clone());
            } else {
                const fallback = createTacticalScopeFallback();
                body.add(fallback);
                getOrLoadPickupModel(modelPath, (loaded) => {
                    body.remove(fallback);
                    attachScope(loaded);
                });
            }
        } else if (type === 'magazine') {
            const modelPath = 'assets/models/kenney-blaster/clip-large.glb';
            const attachMagazine = (model) => {
                const wrapper = centerAndScaleModel(model, 2.2);
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachMagazine(_pickupModelCache.get(modelPath).clone());
            } else {
                const fallback = createTacticalGripMesh();
                body.add(fallback);
                getOrLoadPickupModel(modelPath, (loaded) => {
                    body.remove(fallback);
                    attachMagazine(loaded);
                });
            }
        } else if (type === 'grip') {
            const gripMesh = createTacticalGripMesh();
            body.add(gripMesh);
        } else if (type === 'shield') {
            const shieldMesh = createTacticalShieldMesh();
            body.add(shieldMesh);
        } else if (type === 'weapon') {
            const gunCfg = RARE_WEAPON_CONFIGS[weaponSlot] || RARE_WEAPON_CONFIGS[0];
            const rawFile = gunCfg?.modelFile || 'kenney-blaster/blaster-e.glb';
            const modelPath = rawFile.startsWith('assets/') ? rawFile : `assets/models/${rawFile}`;

            const attachGun = (model) => {
                const wrapper = centerAndScaleModel(model, 1.5);
                wrapper.rotation.y = Math.PI / 2;
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachGun(_pickupModelCache.get(modelPath).clone());
            } else {
                const fallbackGun = createTacticalSilencerFallback();
                body.add(fallbackGun);
                getOrLoadPickupModel(modelPath, (loaded) => {
                    body.remove(fallbackGun);
                    attachGun(loaded);
                });
            }
        } else if (type === 'health') {
            const modelPath = 'assets/models/aid-defibrillator-green.glb';
            const crossBadge = createMedicalCrossBadge(0x00ff88);
            body.add(crossBadge);

            const attachHealth = (model) => {
                const wrapper = centerAndScaleModel(model, 0.85);
                wrapper.position.y = -0.12;
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachHealth(_pickupModelCache.get(modelPath).clone());
            } else {
                getOrLoadPickupModel(modelPath, (loaded) => {
                    attachHealth(loaded);
                });
            }
        } else if (type === 'medkit') {
            const modelPath = 'assets/models/aid-defibrillator-red.glb';
            const crossBadge = createMedicalCrossBadge(0xff2222);
            body.add(crossBadge);

            const attachMedkit = (model) => {
                const wrapper = centerAndScaleModel(model, 0.85);
                wrapper.position.y = -0.12;
                body.add(wrapper);
            };

            if (_pickupModelCache.has(modelPath)) {
                attachMedkit(_pickupModelCache.get(modelPath).clone());
            } else {
                getOrLoadPickupModel(modelPath, (loaded) => {
                    attachMedkit(loaded);
                });
            }
        } else {
            const shieldMesh = createTacticalShieldMesh();
            body.add(shieldMesh);
        }

        // 1. Vòng hào quang sáng trên nền đất (Ground Aura Ring)
        const groundRingGeo = new THREE.RingGeometry(0.35, 0.52, 32);
        const groundRingMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        });
        const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
        groundRing.rotation.x = -Math.PI / 2;
        groundRing.position.y = -0.68;
        mesh.add(groundRing);

        // Vòng xung kích ngoài mờ hơn tạo chiều sâu
        const outerRingGeo = new THREE.RingGeometry(0.55, 0.65, 32);
        const outerRingMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = -0.685;
        mesh.add(outerRing);

        // 2. Cột sáng định vị thanh thoát từ xa
        const beam = new THREE.Mesh(this.geoBeam, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.16,
            depthWrite: false
        }));
        beam.position.y = 0.5;
        mesh.add(beam);

        // 3. Billboard nhãn hiển thị tên vật phẩm sắc nét bo góc
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 90;
            const ctx = canvas.getContext('2d');

            // Nền hộp bo góc tối mờ sang trọng
            const r = 16;
            ctx.fillStyle = 'rgba(10, 18, 30, 0.88)';
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(512 - r, 0);
            ctx.quadraticCurveTo(512, 0, 512, r);
            ctx.lineTo(512, 90 - r);
            ctx.quadraticCurveTo(512, 90, 512 - r, 90);
            ctx.lineTo(r, 90);
            ctx.quadraticCurveTo(0, 90, 0, 90 - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.fill();

            // Viền phát sáng cùng màu item
            ctx.lineWidth = 4;
            ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
            ctx.stroke();

            // Chữ hiển thị đậm nét, tương phản cao
            ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            ctx.fillText(label, 256, 45, 480);

            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(canvas),
                depthWrite: false
            }));
            sprite.position.y = 1.35;
            sprite.scale.set(2.8, 0.5, 1);
            mesh.add(sprite);
        }

        this.scene.add(mesh);
        const pickup = {
            id: options.id ?? this.nextId++,
            mesh,
            body,
            groundRing,
            type,
            color,
            weaponSlot,
            baseY: 0.7,
            life: type === 'weapon' ? 60 : 45
        };
        this.pickups.push(pickup);
        return pickup;
    }

    createAirdrop(position, options = {}) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.position.y = 0.45;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.8, 1.25),
            new THREE.MeshStandardMaterial({ color: 0xd14a28, roughness: 0.75 }));
        const strap = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.12, 0.16),
            new THREE.MeshStandardMaterial({ color: 0xf2cf63, emissive: 0x553300, emissiveIntensity: 0.4 }));
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
            new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.6, depthWrite: false }));
        strap.position.y = 0.42;
        beacon.position.y = 1.35;
        group.add(crate, strap, beacon);
        this.scene.add(group);
        const pickup = {
            id: options.id ?? this.nextId++,
            mesh: group,
            body: group,
            type: 'airdrop',
            color: 0xff5522,
            weaponSlot: Math.floor(Math.random() * RARE_WEAPON_CONFIGS.length),
            baseY: 0.45,
            life: 90
        };
        this.pickups.push(pickup);
        return pickup;
    }

    // Tự động gắn hoặc nâng cấp phụ kiện nhặt được lên súng
    th_autoEquipAttachment(attachSlot, player, forcedTier = null) {
        const weapons = player?.weapons;
        if (!weapons) return '+1 PHỤ KIỆN';

        // Xác định Tier rơi theo tiến trình ngẫu nhiên
        let tier = forcedTier;
        if (!tier) {
            const r = Math.random();
            if (r < 0.45) tier = 1;
            else if (r < 0.75) tier = 2;
            else if (r < 0.93) tier = 3;
            else tier = 4;
        }

        const itemId = `${attachSlot}_t${tier}`;
        const def = LOOT_ITEMS[itemId] || ATTACHMENT_DEFS[itemId];
        const attachName = def?.name || `PHỤ KIỆN CẤP ${tier}`;
        const currentGunIdx = weapons.currentSlotIndex === 1 ? 1 : 0;
        const currentAttach = weapons.getAttachmentsForGun(currentGunIdx);
        const currentModId = currentAttach[attachSlot];

        // 1. Nếu súng chính còn trống slot -> Gắn luôn
        if (!currentModId) {
            weapons.attachMod(attachSlot, itemId, currentGunIdx);
            sounds.play('switchWeapon', { volume: 0.95, rate: 1.35 });
            return `ĐÃ LẮP: [${attachName.toUpperCase()}] LÊN SÚNG!`;
        }

        // 2. Nếu súng chính có cấp thấp hơn -> Swap nâng cấp luôn!
        const currentTier = ATTACHMENT_DEFS[currentModId]?.tier || 1;
        if (tier > currentTier) {
            weapons.attachMod(attachSlot, itemId, currentGunIdx);
            sounds.play('switchWeapon', { volume: 1.0, rate: 1.45 });
            return `NÂNG CẤP THÀNH CÔNG: [${attachName.toUpperCase()}]`;
        }

        // 3. Kiểm tra súng phụ (Khẩu 2)
        const secGunIdx = currentGunIdx === 0 ? 1 : 0;
        const secAttach = weapons.getAttachmentsForGun(secGunIdx);
        const secModId = secAttach[attachSlot];
        if (!secModId) {
            weapons.attachMod(attachSlot, itemId, secGunIdx);
            sounds.play('switchWeapon', { volume: 0.9, rate: 1.3 });
            return `ĐÃ LẮP [${attachName.toUpperCase()}] LÊN SÚNG PHỤ!`;
        }

        const secTier = ATTACHMENT_DEFS[secModId]?.tier || 1;
        if (tier > secTier) {
            weapons.attachMod(attachSlot, itemId, secGunIdx);
            sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
            return `NÂNG CẤP CHO SÚNG PHỤ: [${attachName.toUpperCase()}]`;
        }

        // 4. Nếu cả 2 súng đều đã có đồ cấp cao hơn -> Thưởng điểm chiến lợi phẩm
        if (window.game) window.game.score += 150;
        return `PHỤ KIỆN CẤP THẤP HƠN TRANG BỊ → +150 ĐIỂM`;
    }

    collect(pickup, player) {
        const weapons = player.weapons;

        // 1. Phụ kiện súng (Nòng, Băng đạn, Kính ngắm, Tay cầm)
        if (ATTACHMENT_SLOTS.includes(pickup.type)) {
            return this.th_autoEquipAttachment(pickup.type, player);
        }

        // 2. Hòm tiếp tế Airdrop: Tặng phụ kiện Cấp 4/5 + Túi cứu thương + Hồi máu & giáp
        if (pickup.type === 'airdrop') {
            player.heal(50);
            player.rechargeShield(50);
            if (weapons.inventory.medkits < 10) weapons.inventory.medkits += 2;
            const randomSlot = ATTACHMENT_SLOTS[Math.floor(Math.random() * ATTACHMENT_SLOTS.length)];
            const highTier = Math.random() < 0.65 ? 4 : 5;
            this.th_autoEquipAttachment(randomSlot, player, highTier);
            return 'HÒM TIẾP TẾ: +PHỤ KIỆN CAO CẤP +2 TÚI CỨU THƯƠNG +HỒI PHỤC!';
        }

        // 3. Hồi máu nhanh
        if (pickup.type === 'health') {
            player.heal(40);
            return '+40 MÁU KHẨN CẤP';
        }

        // 4. Giáp nạp
        if (pickup.type === 'shield') {
            player.rechargeShield(50);
            return '+50 GIÁP BẢO VỆ';
        }

        // 5. Túi cứu thương PUBG
        if (pickup.type === 'medkit') {
            weapons.inventory.medkits = (weapons.inventory.medkits || 0) + 1;
            return '+1 TÚI CỨU THƯƠNG (BÁNH XE / PHÍM 3)';
        }

        // 6. Súng mới
        if (pickup.type === 'weapon') {
            if (weapons.equipRareWeapon(pickup.weaponSlot)) {
                return `ĐÃ TRANG BỊ [${weapons.getCurrentWeapon().name.toUpperCase()}]`;
            }
            if (window.game) window.game.score += 300;
            return 'SÚNG ĐÃ SỞ HỮU → +300 ĐIỂM';
        }

        player.rechargeShield(30);
        return '+30 GIÁP';
    }

    update(delta, player, onPickupNotify, authoritative = true) {
        const players = Array.isArray(player) ? player : [player];
        if (authoritative && !Array.isArray(player)) {
            this.airdropTimer -= delta;
            if (this.airdropTimer <= 0) {
                this.airdropTimer = 35 + Math.random() * 15;
                const existingAirdrops = this.pickups.filter(p => p.type === 'airdrop').length;
                if (existingAirdrops < 1) {
                    const centerP = Array.isArray(player) ? player[0] : player;
                    const px = centerP ? centerP.position.x : 0;
                    const pz = centerP ? centerP.position.z : 0;
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 10 + Math.random() * 12;
                    const x = Math.max(-24, Math.min(24, px + Math.cos(angle) * dist));
                    const z = Math.max(-24, Math.min(24, pz + Math.sin(angle) * dist));
                    this.createPickup(new THREE.Vector3(x, 0, z), 'airdrop');
                    onPickupNotify?.('HÒM TIẾP TẾ ĐÃ RƠI XUỐNG CHIẾN TRƯỜNG!', 'airdrop', centerP);
                }
            }
        }

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            pickup.life -= delta;
            if (pickup.life <= 0) {
                this.remove(i);
                continue;
            }
            // Xoay nhẹ nhàng mượt mà quanh trục Y
            pickup.body.rotation.y += (pickup.type === 'airdrop' ? 0.4 : 1.35) * delta;
            // Hiệu ứng lơ lửng bồng bềnh hình sin
            pickup.mesh.position.y = pickup.baseY + Math.sin(performance.now() * 0.0035 + i) * 0.12;

            // Hiệu ứng nhịp thở mở rộng cho hào quang mặt đất
            if (pickup.groundRing) {
                const pulse = 1.0 + Math.sin(performance.now() * 0.004 + i) * 0.07;
                pickup.groundRing.scale.set(pulse, pulse, 1);
            }

            const collector = authoritative && players.find(p => !p.isDead && !p.isDowned && Math.hypot(pickup.mesh.position.x - p.position.x, pickup.mesh.position.z - p.position.z) < 1.6);
            if (collector) {
                const text = this.collect(pickup, collector);
                sounds.playPickup(pickup.type);
                this.particles.createImpactSparks(pickup.mesh.position, new THREE.Vector3(0, 1, 0), pickup.color, 18);
                if (onPickupNotify) onPickupNotify(text, pickup.type, collector);
                this.remove(i);
            }
        }
    }

    remove(index) {
        const pickup = this.pickups[index];
        pickup.mesh.removeFromParent();
        const materials = new Set();
        pickup.mesh.traverse(child => { if (child.material) materials.add(child.material); });
        for (const material of materials) {
            material.map?.dispose();
            material.dispose();
        }
        this.pickups.splice(index, 1);
    }

    clear() {
        while (this.pickups.length) this.remove(this.pickups.length - 1);
    }
}
