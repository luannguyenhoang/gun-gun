import * as THREE from 'three';
import { sounds } from './audio.js';

// Chuẩn hóa 5 Cấp bậc Độ hiếm (Rarity Tiers) áp dụng cho CẢ SÚNG VÀ PHỤ KIỆN
export const RARITY_TIERS = {
    1: { tier: 1, id: 'common', name: 'COMMON', label: 'Cấp 1 · Thường', color: '#94a3b8', hex: 0x94a3b8, dmgMod: 0.00, desc: 'Chỉ số gốc' },
    2: { tier: 2, id: 'uncommon', name: 'UNCOMMON', label: 'Cấp 2 · Đặc biệt', color: '#22c55e', hex: 0x22c55e, dmgMod: 0.15, desc: '+15% Sát thương' },
    3: { tier: 3, id: 'rare', name: 'RARE', label: 'Cấp 3 · Hiếm', color: '#3b82f6', hex: 0x3b82f6, dmgMod: 0.35, desc: '+35% Sát thương' },
    4: { tier: 4, id: 'epic', name: 'EPIC', label: 'Cấp 4 · Sử thi', color: '#a855f7', hex: 0xa855f7, dmgMod: 0.60, desc: '+60% Sát thương' },
    5: { tier: 5, id: 'legendary', name: 'LEGENDARY', label: 'Cấp 5 · Huyền thoại', color: '#f59e0b', hex: 0xf59e0b, dmgMod: 1.00, desc: '+100% Sát thương, Xuyên mục tiêu & Bắn nổ lan' }
};

// 4 Linh kiện Phụ kiện Nâng cấp Súng (Attachments Ecosystem theo 5 Tier)
export const ATTACHMENT_DEFS = {
    // 1. Nòng súng (Barrel): Tăng trực tiếp Flat Damage và tầm bắn hiệu dụng
    barrel_t1: { id: 'barrel_t1', name: 'Nòng Cấp 1', slot: 'barrel', tier: 1, flatDmg: 5, rangeBonus: 1.1, desc: '+5 Sát thương trực tiếp' },
    barrel_t2: { id: 'barrel_t2', name: 'Nòng Cấp 2', slot: 'barrel', tier: 2, flatDmg: 12, rangeBonus: 1.25, desc: '+12 Flat DMG, +15% Mod' },
    barrel_t3: { id: 'barrel_t3', name: 'Nòng Cấp 3', slot: 'barrel', tier: 3, flatDmg: 22, rangeBonus: 1.45, desc: '+22 Flat DMG, +35% Mod' },
    barrel_t4: { id: 'barrel_t4', name: 'Nòng Cấp 4', slot: 'barrel', tier: 4, flatDmg: 38, rangeBonus: 1.70, desc: '+38 Flat DMG, +60% Mod' },
    barrel_t5: { id: 'barrel_t5', name: 'Nòng Cấp 5', slot: 'barrel', tier: 5, flatDmg: 65, rangeBonus: 2.10, desc: '+65 Flat DMG, +100% Mod, Đạn xé gió' },

    // 2. Băng đạn (Magazine): Tăng dung lượng đạn và tốc độ nạp đạn (DPS duy trì)
    magazine_t1: { id: 'magazine_t1', name: 'Băng Đạn Cấp 1', slot: 'magazine', tier: 1, magBonusPct: 0.25, reloadSpeedBonus: 0.15, desc: '+25% Dung lượng, nạp nhanh 15%' },
    magazine_t2: { id: 'magazine_t2', name: 'Băng Đạn Cấp 2', slot: 'magazine', tier: 2, magBonusPct: 0.45, reloadSpeedBonus: 0.25, desc: '+45% Băng đạn, nạp nhanh 25%' },
    magazine_t3: { id: 'magazine_t3', name: 'Băng Đạn Cấp 3', slot: 'magazine', tier: 3, magBonusPct: 0.75, reloadSpeedBonus: 0.40, desc: '+75% Băng đạn, nạp nhanh 40%' },
    magazine_t4: { id: 'magazine_t4', name: 'Băng Đạn Cấp 4', slot: 'magazine', tier: 4, magBonusPct: 1.10, reloadSpeedBonus: 0.55, desc: '+110% Băng đạn, nạp đạn chớp mắt' },
    magazine_t5: { id: 'magazine_t5', name: 'Băng Đạn Cấp 5', slot: 'magazine', tier: 5, magBonusPct: 1.60, reloadSpeedBonus: 0.75, desc: '+160% Băng đạn, nạp đạn siêu tốc' },

    // 3. Kính ngắm (Optic): Tăng tỷ lệ bạo kích (Crit Chance) và sát thương bạo kích (Crit Damage)
    optic_t1: { id: 'optic_t1', name: 'Kính Ngắm Cấp 1', slot: 'optic', tier: 1, critChance: 0.08, critDmgMod: 0.2, adsZoom: 1.25, desc: '+8% Crit, +0.2x Bạo kích' },
    optic_t2: { id: 'optic_t2', name: 'Kính Ngắm Cấp 2', slot: 'optic', tier: 2, critChance: 0.15, critDmgMod: 0.4, adsZoom: 1.50, desc: '+15% Crit, +0.4x Bạo kích, zoom 1.5x' },
    optic_t3: { id: 'optic_t3', name: 'Kính Ngắm Cấp 3', slot: 'optic', tier: 3, critChance: 0.25, critDmgMod: 0.7, adsZoom: 2.00, desc: '+25% Crit, +0.7x Bạo kích, zoom 2.0x' },
    optic_t4: { id: 'optic_t4', name: 'Kính Ngắm Cấp 4', slot: 'optic', tier: 4, critChance: 0.38, critDmgMod: 1.1, adsZoom: 2.80, desc: '+38% Crit, +1.1x Bạo kích, zoom 2.8x' },
    optic_t5: { id: 'optic_t5', name: 'Kính Ngắm Cấp 5', slot: 'optic', tier: 5, critChance: 0.55, critDmgMod: 1.8, adsZoom: 3.50, desc: '+55% Crit, +1.8x Bạo kích cực đại' },

    // 4. Báng / Tay cầm (Grip): Giảm độ tản đạn, giảm độ giật để gom toàn bộ đạn vào 1 điểm
    grip_t1: { id: 'grip_t1', name: 'Báng Tay Cầm Cấp 1', slot: 'grip', tier: 1, recoilReduction: 0.20, spreadReduction: 0.20, desc: '-20% Giật, -20% Tản đạn' },
    grip_t2: { id: 'grip_t2', name: 'Báng Tay Cầm Cấp 2', slot: 'grip', tier: 2, recoilReduction: 0.35, spreadReduction: 0.35, desc: '-35% Giật, -35% Tản đạn' },
    grip_t3: { id: 'grip_t3', name: 'Báng Tay Cầm Cấp 3', slot: 'grip', tier: 3, recoilReduction: 0.50, spreadReduction: 0.50, desc: '-50% Giật, -50% Gom đạn' },
    grip_t4: { id: 'grip_t4', name: 'Báng Tay Cầm Cấp 4', slot: 'grip', tier: 4, recoilReduction: 0.65, spreadReduction: 0.65, desc: '-65% Giật, -65% Gom toàn bộ đạn' },
    grip_t5: { id: 'grip_t5', name: 'Báng Tay Cầm Cấp 5', slot: 'grip', tier: 5, recoilReduction: 0.85, spreadReduction: 0.80, desc: '-85% Giật, đạn bay thẳng như laser' }
};

// Ánh xạ tương thích ngược với các ID phụ kiện cũ
export const ATTACH_ALIAS = {
    attach_compensator: 'barrel_t3',
    attach_silencer: 'barrel_t4',
    attach_flash_hider: 'barrel_t2',
    attach_red_dot: 'optic_t1',
    attach_scope_x2: 'optic_t2',
    attach_scope_x4: 'optic_t3',
    attach_scope_x6: 'optic_t4',
    attach_scope_x8: 'optic_t5',
    attach_ext_mag: 'magazine_t3',
    attach_quickdraw_mag: 'magazine_t4',
    attach_grip_tactical: 'grip_t3',
    attach_stock_heavy: 'grip_t4',
    attach_stock_tactical: 'grip_t2'
};

export function th_normalizeAttachment(id) {
    if (!id) return null;
    return ATTACH_ALIAS[id] || id;
}

export const WEAPON_CONFIGS = [
    {
        id: 'blaster',
        name: 'BLASTER-X',
        category: 'SÚNG CHÍNH',
        tier: 1,
        modelFile: 'kenney-blaster/blaster-a.glb',
        icon: 'assets/previews/kenney-blaster/blaster-a.png',
        fireRate: 0.18,
        damage: 28,
        penPower: 1, // Xuyên giáp cấp 1
        critMultiplier: 2.0,
        magSize: 16,
        reloadTime: 1.15,
        bulletSpeed: 105,
        baseSpreadDegHip: 2.2, // Góc tản Hipfire (độ)
        baseSpreadDegADS: 0.5, // Góc tản ADS (độ)
        moveSpreadPenalty: 2.5, // Phạt tản khi chạy (độ)
        recoilSpreadPerShot: 0.8, // Tăng sau mỗi phát (độ)
        maxSpreadDeg: 9.0, // Tản tối đa (độ)
        spreadRecoveryRate: 20.0, // Co nhỏ lại (°/s)
        screenShake: 0.14, // Trauma rung camera nhẹ
        cursorKick: 2.8, // Pixel giật tâm ngắm
        color: 0x00f0ff,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.025,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'repeater',
        name: 'REPEATER-9',
        category: 'SÚNG TỰ ĐỘNG',
        tier: 1,
        modelFile: 'kenney-blaster/blaster-d.glb',
        icon: 'assets/previews/kenney-blaster/blaster-d.png',
        fireRate: 0.09,
        damage: 17,
        penPower: 1,
        critMultiplier: 2.0,
        magSize: 32,
        reloadTime: 1.3,
        bulletSpeed: 115,
        baseSpreadDegHip: 3.5,
        baseSpreadDegADS: 1.0,
        moveSpreadPenalty: 3.0,
        recoilSpreadPerShot: 0.48,
        maxSpreadDeg: 12.0,
        spreadRecoveryRate: 24.0,
        screenShake: 0.10,
        cursorKick: 2.0,
        color: 0xffaa00,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.018,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'scatter',
        name: 'SCATTER-V',
        category: 'SHOTGUN TÁN XẠ',
        tier: 1,
        modelFile: 'kenney-blaster/blaster-g.glb',
        icon: 'assets/previews/kenney-blaster/blaster-g.png',
        fireRate: 0.55,
        damage: 14,
        penPower: 1,
        critMultiplier: 1.8,
        magSize: 8,
        reloadTime: 1.5,
        bulletSpeed: 95,
        baseSpreadDegHip: 9.0,
        baseSpreadDegADS: 4.5,
        moveSpreadPenalty: 4.0,
        recoilSpreadPerShot: 2.0,
        maxSpreadDeg: 18.0,
        spreadRecoveryRate: 28.0,
        screenShake: 0.38,
        cursorKick: 7.0,
        color: 0xff22aa,
        isAuto: false,
        pellets: 6,
        recoilPitch: 0.06,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    }
];

export const RARE_WEAPON_CONFIGS = [
    { ...WEAPON_CONFIGS[0], id: 'plasma', name: 'PLASMA LANCE', modelFile: 'kenney-blaster/blaster-j.glb', icon: 'assets/previews/kenney-blaster/blaster-j.png', damage: 54, penPower: 3, fireRate: 0.15, magSize: 24, baseSpreadDegHip: 1.8, baseSpreadDegADS: 0.4, screenShake: 0.22, cursorKick: 3.8, color: 0x9966ff, isAuto: true, tier: 4 },
    { ...WEAPON_CONFIGS[1], id: 'storm', name: 'STORM MK-II', modelFile: 'kenney-blaster/blaster-e.glb', icon: 'assets/previews/kenney-blaster/blaster-e.png', damage: 25, penPower: 2, fireRate: 0.065, magSize: 48, baseSpreadDegHip: 2.8, baseSpreadDegADS: 0.7, screenShake: 0.14, cursorKick: 2.4, color: 0x55ffcc, tier: 4 },
    { ...WEAPON_CONFIGS[2], id: 'nova', name: 'NOVA SHOTGUN', modelFile: 'kenney-blaster/blaster-g.glb', icon: 'assets/previews/kenney-blaster/blaster-g.png', damage: 22, penPower: 3, pellets: 8, fireRate: 0.45, magSize: 12, baseSpreadDegHip: 7.5, baseSpreadDegADS: 3.5, screenShake: 0.45, cursorKick: 8.0, color: 0xff6633, tier: 5 }
];

export function getStartingWeapon(id) {
    return WEAPON_CONFIGS.find(weapon => weapon.id === id) || WEAPON_CONFIGS[0];
}

export const KNIFE_CONFIG = {
    id: 'knife',
    name: 'DAO BẾP',
    modelFile: 'kenney-food/cooking-knife.glb',
    icon: 'assets/previews/kenney-food/cooking-knife.png',
    category: 'VŨ KHÍ CẬN CHIẾN',
    damage: 32,
    penPower: 2, // Dao găm sắc bén xuyên giáp cấp 2
    fireRate: 0.30,
    range: 1.1,
    screenShake: 0.10,
    cursorKick: 1.2,
    baseSpreadDegHip: 0,
    baseSpreadDegADS: 0,
    moveSpreadPenalty: 0,
    recoilSpreadPerShot: 0,
    maxSpreadDeg: 0,
    spreadRecoveryRate: 0,
    color: 0x99e6ff,
    isKnife: true,
    isAuto: false,
    pellets: 1
};

export const MEDKIT_CONFIG = {
    id: 'medkit',
    name: 'TÚI CỨU THƯƠNG',
    category: 'TIỆN ÍCH HỒI PHỤC',
    healAmount: 45,
    isUtility: true,
    color: 0x00ff88
};

export const SHIELD_BATTERY_CONFIG = {
    id: 'shield_battery',
    name: 'PIN NĂNG LƯỢNG GIÁP',
    category: 'TIỆN ÍCH KHIÊN',
    shieldAmount: 50,
    isUtility: true,
    color: 0x00d0ff
};

// Reusable math objects to eliminate memory allocations in game loop
const _tempRay = new THREE.Ray();
const _tempNextPos = new THREE.Vector3();
const _tempHitPoint = new THREE.Vector3();
const _tempAimDir = new THREE.Vector3();
const _tempRotAxis = new THREE.Vector3(0, 1, 0);
const _tempSlashForward = new THREE.Vector3();
const _tempToEnemy = new THREE.Vector3();
const _tempToEnemyHoriz = new THREE.Vector3();
const _tempCheckRay = new THREE.Ray();
const _tempCheckRayDir = new THREE.Vector3();
const _tempSparkDir = new THREE.Vector3();
const _tempHitPointSparks = new THREE.Vector3();
const _heldParentRotation = new THREE.Quaternion();
const _heldFacing = new THREE.Quaternion();
const _barrelCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export function updateHeldWeaponPose(mesh, hand, character) {
    if (!mesh?.userData.gripOffset || !hand || !character) return;
    hand.updateWorldMatrix(true, false);
    hand.getWorldQuaternion(_heldParentRotation);
    character.getWorldQuaternion(_heldFacing);
    if (mesh.userData.barrelForward === -1) _heldFacing.multiply(_barrelCorrection);
    mesh.quaternion.copy(_heldParentRotation.invert().multiply(_heldFacing));
    
    // Động tác thay đạn bằng Code (Procedural Reload Animation)
    if (mesh.userData.reloadProgress !== undefined && mesh.userData.reloadProgress < 1.0) {
        const p = mesh.userData.reloadProgress;
        // Dùng hàm sine để tạo đường cong vồng xuống mượt mà (0 -> 1 -> 0)
        const dip = Math.sin(p * Math.PI);
        // Xoay súng chúi nòng xuống 60 độ và hơi nghiêng qua phải
        const reloadRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-dip * 1.0, 0, -dip * 0.5));
        mesh.quaternion.multiply(reloadRot);
    }
    
    mesh.position.copy(mesh.userData.gripOffset).applyQuaternion(mesh.quaternion).add(mesh.userData.handOffset);
    
    // Giật súng xuống thấp khi thay đạn
    if (mesh.userData.reloadProgress !== undefined && mesh.userData.reloadProgress < 1.0) {
        const dip = Math.sin(mesh.userData.reloadProgress * Math.PI);
        mesh.position.y -= dip * 0.15; 
        mesh.position.z += dip * 0.1;
    }
    
    mesh.updateWorldMatrix(false, true);
}

export class WeaponSystem {
    constructor(scene, gltfLoader, particleSystem) {
        this.scene = scene;
        this.loader = gltfLoader;
        this.particles = particleSystem;

        this.models = {};
        this.weaponSlots = [];
        this.currentSlotIndex = 0;
        this.ammo = {};
        this.reserve = {};
        this.inventory = {
            medkits: 3
        };
        this.isUsingMedkit = false;
        this.medkitTimer = 0;
        this.medkitTotalTime = 5.0;
        this.medkitPlayerRef = null;
        this.bulletCalibers = [
            { id: 'rusty', name: 'S-Rusty Bullet', dmgMod: 1.0, penMod: 0, speedMod: 1.0 },
            { id: 'ap', name: 'AP-Armor Piercing', dmgMod: 1.2, penMod: 1, speedMod: 1.1 },
            { id: 'hv', name: 'HV-High Velocity', dmgMod: 0.95, penMod: 0, speedMod: 1.4 }
        ];
        this.currentCaliberIndex = 0;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.fireCooldown = 0;
        this.recoilOffset = 0;
        this.upgrades = { damage: 0, rapid: 0, multishot: 0 };

        // Aim & Cone of fire state
        this.currentSpreadDeg = 2.2;

        // Active projectiles list
        this.projectiles = [];
        this.nextProjectileId = 1;

        // Cấu hình phụ kiện mod vũ khí (Attachments Ecosystem)
        this.attachments = {
            muzzle: null,    // Đầu nòng (Compensator, Silencer, Flash Hider)
            optic: null,     // Kính ngắm (Red Dot, Scope x2, Scope x4, Scope x6, Scope x8)
            magazine: null,  // Băng đạn (Extended Mag, Quick-draw Mag)
            grip: null,      // Tay cầm (Tactical Grip)
            stock: null      // Báng súng (Heavy Stock, Tactical Stock)
        };

        // Shared geometries & materials pool
        this.bulletGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6);
        this.bulletGeo.rotateX(Math.PI / 2);
        this.acidGeo = new THREE.IcosahedronGeometry(0.2, 1);

        // Pre-cached pool of bullet meshes (NOT added to scene until fired)
        this.bulletMeshPool = [];
        this.enemyMeshPool = [];
    }

    getBulletMesh(color) {
        let entry = this.bulletMeshPool.pop();
        if (!entry) {
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(this.bulletGeo, mat);
            entry = { mesh, material: mat };
        } else {
            entry.material.color.setHex(color);
        }
        this.scene.add(entry.mesh);
        return entry;
    }

    recycleBulletMesh(entry) {
        if (!entry || !entry.mesh) return;
        this.scene.remove(entry.mesh);
        if (this.bulletMeshPool.length < 60) {
            this.bulletMeshPool.push(entry);
        } else {
            entry.material.dispose();
        }
    }

    getEnemyMesh(color, acid = false) {
        let entry = this.enemyMeshPool.pop();
        if (!entry) {
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(acid ? this.acidGeo : this.bulletGeo, mat);
            entry = { mesh, material: mat };
        } else {
            entry.material.color.setHex(color);
        }
        this.scene.add(entry.mesh);
        return entry;
    }

    recycleEnemyMesh(entry) {
        if (!entry || !entry.mesh) return;
        this.scene.remove(entry.mesh);
        if (this.enemyMeshPool.length < 30) {
            this.enemyMeshPool.push(entry);
        } else {
            entry.material.dispose();
        }
    }

    async init() {
        const loadModel = (file) => new Promise((resolve) => {
            this.loader.load(`assets/models/${file}`, (gltf) => {
                gltf.scene.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });
                this.models[file] = gltf.scene;
                resolve();
            }, undefined, () => resolve());
        });

        const allModels = [
            ...WEAPON_CONFIGS.map(w => w.modelFile),
            ...RARE_WEAPON_CONFIGS.map(w => w.modelFile),
            KNIFE_CONFIG.modelFile
        ].filter(Boolean);
        await Promise.all([...new Set(allModels)].map(loadModel));

        this.resetRun();
    }

    resetRun(weaponId = this.startingWeaponId) {
        const starter = getStartingWeapon(weaponId);
        this.startingWeaponId = starter.id;
        this.clear();
        // 3 ô trang bị: [0] Súng chính, [1] Súng phụ, [2] Dao cận chiến
        this.secondaryWeapon = { ...WEAPON_CONFIGS[1], tier: 1 };
        this.weaponSlots = [
            starter,               // 0: Súng chính
            this.secondaryWeapon,  // 1: Súng phụ
            KNIFE_CONFIG           // 2: Dao găm
        ];
        this.currentSlotIndex = 0;
        this.ammo = {
            [starter.id]: starter.magSize,
            [this.secondaryWeapon.id]: this.secondaryWeapon.magSize
        };
        // Đạn dự trữ là vô hạn để người chơi tập trung 100% vào việc bắn và nâng cấp đồ
        this.reserve = {
            [starter.id]: Infinity,
            [this.secondaryWeapon.id]: Infinity
        };
        this.inventory = {
            medkits: 3
        };
        this.isUsingMedkit = false;
        this.medkitTimer = 0;
        this.medkitTotalTime = 5.0;
        this.medkitPlayerRef = null;
        this.currentCaliberIndex = 0;
        this.upgrades = { damage: 0, rapid: 0, multishot: 0 };

        // 4 Linh kiện Phụ kiện Nâng cấp Súng (Attachments Ecosystem):
        // 1. barrel (Nòng), 2. magazine (Băng đạn), 3. optic (Kính ngắm), 4. grip (Báng/Tay cầm)
        this.primaryAttachments = {
            barrel: null,
            magazine: null,
            optic: null,
            grip: null
        };
        this.secondaryAttachments = {
            barrel: null,
            magazine: null,
            optic: null,
            grip: null
        };
        this.attachments = this.primaryAttachments;

        // Chế độ Overclock (Xả đạn tăng cường)
        this.overclockTimer = 0;
        this.overclockDuration = 6.0;
        this.overclockCooldown = 0;
        this.overclockMaxCooldown = 15.0;

        this.isReloading = false;
        this.reloadTimer = 0;
        this.fireCooldown = 0;
        this.recoilOffset = 0;
        this.currentSpreadDeg = starter.baseSpreadDegHip;
        if (this.handNode) this.attachToArm(this.handNode);
    }

    get damageBoost() { return 1 + this.upgrades.damage * 0.2; }
    get fireRateBoost() { return 1 + this.upgrades.rapid * 0.125; }
    get beamCount() { return 1 + this.upgrades.multishot * 2; }

    // Lấy phụ kiện tương ứng theo súng (0: Súng chính, 1: Súng phụ)
    getAttachmentsForGun(gunIndex = 0) {
        return gunIndex === 1 ? this.secondaryAttachments : this.primaryAttachments;
    }

    // Tự động tìm khẩu súng có slot phụ kiện tương ứng còn trống
    // Ưu tiên súng chính (Khẩu 1), nếu đã lắp thì kiểm tra tiếp súng phụ (Khẩu 2)
    findEmptyAttachmentSlot(slotType) {
        const normSlot = (slotType === 'muzzle' ? 'barrel' : (slotType === 'stock' ? 'grip' : slotType));
        if (!['barrel', 'magazine', 'optic', 'grip'].includes(normSlot)) return null;
        if (!this.primaryAttachments[normSlot]) return 0;
        if (!this.secondaryAttachments[normSlot]) return 1;
        return null;
    }

    // Kiểm tra xem phụ kiện mới có thể hoán đổi nâng cấp (Swap) vào súng không
    th_canSwapAttachment(gunIndex, slotType, newTier) {
        const normSlot = (slotType === 'muzzle' ? 'barrel' : (slotType === 'stock' ? 'grip' : slotType));
        const attachMap = this.getAttachmentsForGun(gunIndex);
        const currentAttachId = attachMap[normSlot];
        if (!currentAttachId) return { canEquip: true, canUpgrade: false, currentTier: 0 };
        const currentDef = ATTACHMENT_DEFS[th_normalizeAttachment(currentAttachId)];
        const currentTier = currentDef ? currentDef.tier : 1;
        if (newTier > currentTier) {
            return { canEquip: true, canUpgrade: true, currentTier };
        }
        return { canEquip: false, canUpgrade: false, currentTier };
    }

    // Tính toán chỉ số vũ khí hiệu dụng theo Cấp bậc & Phụ kiện (Tier & Direct Damage Scaling)
    // Công thức: FinalDamage = (WeaponBaseDamage * (1 + WeaponTierMod) + BarrelFlatDamage) * (1 + SumAttachmentDamageModifiers)
    getModifiedStats(weapon = null, gunIndex = null) {
        const w = weapon || this.getCurrentWeapon();
        const effectiveGunIdx = gunIndex !== null ? gunIndex : (w?.id === this.secondaryWeapon?.id ? 1 : 0);
        const attachMap = this.getAttachmentsForGun(effectiveGunIdx);

        if (!w || w.isKnife || w.isUtility) {
            return {
                damage: w?.damage || 0,
                magSize: w?.magSize || 0,
                reloadTime: w?.reloadTime || 1.0,
                recoilPitch: w?.recoilPitch || 0,
                cursorKick: w?.cursorKick || 0,
                screenShake: w?.screenShake || 0,
                spreadRecoveryRate: w?.spreadRecoveryRate || 20,
                moveSpreadPenalty: w?.moveSpreadPenalty || 2.5,
                baseSpreadDegHip: w?.baseSpreadDegHip || 2.0,
                baseSpreadDegADS: w?.baseSpreadDegADS || 0.5,
                adsZoom: 1.0,
                soundRadius: 26.0,
                attachments: { ...attachMap },
                extraCritChance: 0,
                extraCritDmgMod: 0,
                hasLegendary: false
            };
        }

        const weaponTier = w.tier || 1;
        const weaponTierMod = RARITY_TIERS[weaponTier]?.dmgMod || 0;

        let barrelFlat = 0;
        let sumAttachMods = 0;
        let magBonusPct = 0;
        let reloadSpeedBonus = 0;
        let extraCritChance = 0;
        let extraCritDmgMod = 0;
        let recoilReduction = 0;
        let spreadReduction = 0;
        let adsZoom = 1.0;
        let hasLegendary = (weaponTier >= 5);

        for (const [slotKey, rawId] of Object.entries(attachMap)) {
            if (!rawId) continue;
            const attachId = th_normalizeAttachment(rawId);
            const def = ATTACHMENT_DEFS[attachId];
            if (!def) continue;

            // Mỗi phụ kiện đóng góp modifier sát thương theo Tier (+15%, +35%, +60%, +100%)
            sumAttachMods += (RARITY_TIERS[def.tier]?.dmgMod || 0);
            if (def.tier >= 5) hasLegendary = true;

            if (def.slot === 'barrel') {
                barrelFlat += (def.flatDmg || 0);
            } else if (def.slot === 'magazine') {
                magBonusPct += (def.magBonusPct || 0);
                reloadSpeedBonus += (def.reloadSpeedBonus || 0);
            } else if (def.slot === 'optic') {
                extraCritChance += (def.critChance || 0);
                extraCritDmgMod += (def.critDmgMod || 0);
                adsZoom = Math.max(adsZoom, def.adsZoom || 1.25);
            } else if (def.slot === 'grip') {
                recoilReduction += (def.recoilReduction || 0);
                spreadReduction += (def.spreadReduction || 0);
            }
        }

        // Tính FinalDamage theo đúng công thức cốt lõi
        const finalBaseDamage = (w.damage * (1 + weaponTierMod) + barrelFlat);
        const damage = Math.round(finalBaseDamage * (1 + sumAttachMods));
        const magSize = Math.max(w.magSize, Math.round(w.magSize * (1 + magBonusPct)));
        const reloadTime = Math.max(0.35, w.reloadTime * (1 - Math.min(0.75, reloadSpeedBonus)));

        const recoilFactor = Math.max(0.12, 1 - recoilReduction);
        const spreadFactor = Math.max(0.15, 1 - spreadReduction);

        return {
            damage,
            magSize,
            reloadTime,
            recoilPitch: w.recoilPitch * recoilFactor,
            cursorKick: w.cursorKick * recoilFactor,
            screenShake: w.screenShake * recoilFactor,
            spreadRecoveryRate: (w.spreadRecoveryRate || 20) * (1 + spreadReduction * 0.8),
            moveSpreadPenalty: (w.moveSpreadPenalty || 2.5) * spreadFactor,
            baseSpreadDegHip: (w.baseSpreadDegHip || 2.0) * spreadFactor,
            baseSpreadDegADS: (w.baseSpreadDegADS || 0.5) * spreadFactor,
            adsZoom,
            soundRadius: 26.0,
            turnPenalty: 0,
            attachments: { ...attachMap },
            extraCritChance,
            extraCritDmgMod,
            hasLegendary
        };
    }

    // Lắp phụ kiện vào ô chỉ định của khẩu súng chỉ định (0: Khẩu 1, 1: Khẩu 2)
    attachMod(slot, attachmentId, gunIndex = 0) {
        const normSlot = (slot === 'muzzle' ? 'barrel' : (slot === 'stock' ? 'grip' : slot));
        if (!['barrel', 'magazine', 'optic', 'grip'].includes(normSlot)) return null;
        const targetMap = this.getAttachmentsForGun(gunIndex);
        const previousId = targetMap[normSlot];
        targetMap[normSlot] = th_normalizeAttachment(attachmentId);
        sounds.play('switchWeapon', { volume: 0.85, rate: 1.35 });
        return previousId;
    }

    // Tháo phụ kiện khỏi ô chỉ định của khẩu súng chỉ định
    detachMod(slot, gunIndex = 0) {
        const normSlot = (slot === 'muzzle' ? 'barrel' : (slot === 'stock' ? 'grip' : slot));
        if (!['barrel', 'magazine', 'optic', 'grip'].includes(normSlot)) return null;
        const targetMap = this.getAttachmentsForGun(gunIndex);
        const removed = targetMap[normSlot];
        targetMap[normSlot] = null;
        if (removed) {
            sounds.play('switchWeapon', { volume: 0.7, rate: 0.95 });
        }
        return removed;
    }

    // Kích hoạt chế độ Overclock (Xả đạn nhanh trong 6 giây)
    th_activateOverclock() {
        if (this.overclockCooldown > 0) return false;
        this.overclockTimer = this.overclockDuration;
        this.overclockCooldown = this.overclockMaxCooldown;
        sounds.play('switchWeapon', { volume: 0.95, rate: 2.1 });
        return true;
    }

    // Bơm máu nhanh cấp cứu (Quick Heal)
    th_quickHeal(player) {
        if (!player || player.isDead) return false;
        if ((this.inventory.medkits || 0) <= 0) return false;
        if (player.health >= player.maxHealth) return false;
        this.inventory.medkits--;
        player.heal(50);
        player.painTimer = 0;
        sounds.playMedkit();
        this.particles?.createImpactSparks?.(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), 0x00ff88, 22);
        return true;
    }

    // Đổi nhanh giữa Súng chính <-> Súng phụ
    th_swapWeapons(player) {
        const nextSlot = (this.currentSlotIndex === 0) ? 1 : 0;
        this.switchWeapon(nextSlot, player);
    }

    getNetworkState() {
        return {
            gun: this.weaponSlots[0].id,
            slot: this.currentSlotIndex,
            ammo: { ...this.ammo },
            reserve: { ...this.reserve },
            upgrades: { ...this.upgrades },
            attachments: { ...this.attachments },
            isReloading: this.isReloading,
            reloadTimer: this.reloadTimer,
            currentSpreadDeg: this.currentSpreadDeg,
            inventory: { ...this.inventory }
        };
    }

    applyNetworkState(state) {
        if (!state) return;
        const gun = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS].find(w => w.id === state.gun) || WEAPON_CONFIGS[0];
        const changed = this.weaponSlots[0]?.id !== gun.id;
        this.weaponSlots[0] = gun;
        this.currentSlotIndex = Math.min(1, Math.max(0, state.slot || 0));
        this.ammo = { ...state.ammo };
        this.reserve = { ...state.reserve };
        if (state.inventory) this.inventory = { ...state.inventory };
        if (state.attachments) this.attachments = { ...state.attachments };
        this.upgrades = { ...state.upgrades };
        this.isReloading = !!state.isReloading;
        this.reloadTimer = state.reloadTimer || 0;
        if (changed && this.handNode) this.attachToArm(this.handNode);
        this.updateEquippedMesh();
    }

    applyUpgrade(type) {
        const limits = { damage: 10, rapid: 8, multishot: 2 };
        if (!(type in limits)) return false;
        if (this.upgrades[type] >= limits[type]) return false;
        this.upgrades[type]++;
        return true;
    }

    equipRareWeapon(slot) {
        const weapon = RARE_WEAPON_CONFIGS[slot];
        const targetSlot = 0; // Trang bị vào súng chính
        const previous = this.weaponSlots[targetSlot];
        if (!weapon || (previous && previous.tier >= weapon.tier)) return false;
        const reserve = this.reserve[previous.id] || 0;
        delete this.ammo[previous.id];
        delete this.reserve[previous.id];
        this.weaponSlots[targetSlot] = weapon;
        this.ammo[weapon.id] = weapon.magSize;
        // Băng đạn dự trữ dồi dào khởi đầu: tối thiểu 6 băng đạn
        this.reserve[weapon.id] = Math.max(reserve, weapon.magSize * 6);
        this.currentSlotIndex = targetSlot;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.fireCooldown = 0.15;
        if (this.handNode) this.attachToArm(this.handNode);
        return true;
    }

    getCurrentWeapon() {
        return this.weaponSlots[this.currentSlotIndex] || this.weaponSlots[0];
    }

    getCurrentAmmo() {
        const w = this.getCurrentWeapon();
        if (w.isKnife) {
            return { current: '∞', max: '∞', reserve: '∞', isKnife: true, isReloading: false, reloadProgress: 1 };
        }
        if (w.isUtility) {
            return { current: this.inventory.medkits, max: this.inventory.medkits, reserve: 0, isUtility: true, isReloading: false, reloadProgress: 1 };
        }
        const effective = this.getModifiedStats(w);
        return {
            current: this.ammo[w.id] ?? 0,
            max: effective.magSize,
            reserve: this.reserve[w.id] ?? 0,
            isReloading: this.isReloading,
            reloadProgress: this.isReloading ? (1 - this.reloadTimer / effective.reloadTime) : 1
        };
    }

    switchWeapon(index, player = null) {
        if (index < 0 || index >= this.weaponSlots.length) return;

        // Bất kỳ hành động đổi vũ khí nào cũng sẽ hủy tiến trình sơ cứu dở dang
        if (this.isUsingMedkit) {
            this.cancelMedkitUse();
        }

        // Bấm vào ô 2 (Túi cứu thương Medkit - Phím 3) -> Bắt đầu tiến trình sơ cứu 5 giây
        if (index === 2) {
            this.startMedkitUse(player);
            return;
        }

        if (index === this.currentSlotIndex) return;

        if (this.onCommand) this.onCommand({ type: 'switch', slot: index });
        this.currentSlotIndex = index;
        this.cancelReload();
        this.fireCooldown = 0.18;
        sounds.play('switchWeapon', { volume: 0.7 });

        // Tự động nạp đạn nếu chuyển sang vũ khí đang hết đạn trong băng
        const nextW = this.getCurrentWeapon();
        if (nextW && !nextW.isKnife && !nextW.isUtility && (this.ammo[nextW.id] || 0) <= 0 && (this.reserve[nextW.id] || 0) > 0) {
            this.reload();
        }
    }

    // Cơ chế Channeling sơ cứu vết thương trong 5.0 giây
    startMedkitUse(player) {
        if (!player || player.isDead) return false;
        if (this.inventory.medkits <= 0) return false;
        if (player.health >= player.maxHealth) return false;
        if (this.isUsingMedkit) return false;

        this.isUsingMedkit = true;
        this.medkitTimer = this.medkitTotalTime;
        this.medkitPlayerRef = player;
        sounds.playMedkit();
        return true;
    }

    cancelMedkitUse() {
        if (this.isUsingMedkit) {
            this.isUsingMedkit = false;
            this.medkitTimer = 0;
            this.medkitPlayerRef = null;
        }
    }

    usePainkiller(player) {
        if (!player || player.isDead || this.inventory.painkillers <= 0) return false;
        this.inventory.painkillers--;
        player.heal(25);
        player.painTimer = 0;
        sounds.playMedkit();
        this.particles.createImpactSparks(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), 0xffaa00, 14);
        return true;
    }

    useGrenade(player, enemies = null) {
        if (!player || player.isDead || this.inventory.grenades <= 0) return false;
        this.inventory.grenades--;
        sounds.play('enemyExplode', { volume: 0.9 });
        const blastPos = player.position.clone().add(new THREE.Vector3(
            Math.sin(player.mesh.rotation.y) * 4.2,
            0.5,
            Math.cos(player.mesh.rotation.y) * 4.2
        ));
        this.particles.createExplosion(blastPos, 0xff5500, 36);
        this.particles.createImpactSparks(blastPos, new THREE.Vector3(0, 1, 0), 0xffdd44, 28);
        if (enemies && enemies.length) {
            for (const e of enemies) {
                if (e && !e.isDead && e.position.distanceTo(blastPos) <= 6.0) {
                    e.takeDamage(120, null, true, player);
                }
            }
        }
        return true;
    }

    useWaterBottle(player) {
        if (!player || player.isDead || this.inventory.waterBottles <= 0) return false;
        this.inventory.waterBottles--;
        sounds.playShieldBattery();
        this.particles.createImpactSparks(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), 0x38bdf8, 14);
        return true;
    }

    useAmmoPack(player) {
        if (!player || player.isDead || this.inventory.ammoPacks <= 0) return false;
        this.inventory.ammoPacks--;
        for (const w of this.weaponSlots) {
            if (!w.isKnife && !w.isUtility) {
                this.reserve[w.id] = (this.reserve[w.id] || 0) + (w.magSize * 2);
            }
        }
        sounds.play('switchWeapon', { volume: 0.8, rate: 0.9 });
        this.particles.createImpactSparks(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), 0xffff00, 16);
        return true;
    }

    toggleBulletCaliber() {
        this.currentCaliberIndex = (this.currentCaliberIndex + 1) % this.bulletCalibers.length;
        sounds.play('switchWeapon', { volume: 0.5, rate: 1.6 });
        return this.bulletCalibers[this.currentCaliberIndex];
    }

    getCurrentCaliber() {
        return this.bulletCalibers[this.currentCaliberIndex] || this.bulletCalibers[0];
    }

    nextWeapon(player = null) {
        const next = this.currentSlotIndex === 0 ? 1 : 0;
        this.switchWeapon(next, player);
    }

    prevWeapon(player = null) {
        const prev = this.currentSlotIndex === 0 ? 1 : 0;
        this.switchWeapon(prev, player);
    }

    reload() {
        const w = this.getCurrentWeapon();
        if (w.isKnife || w.isUtility) return;
        const effective = this.getModifiedStats(w);
        if (this.isReloading || this.ammo[w.id] >= effective.magSize || !this.reserve[w.id]) return;
        if (this.onCommand) this.onCommand({ type: 'reload' });
        this.isReloading = true;
        this.reloadTimer = effective.reloadTime;
        sounds.play('switchWeapon', { volume: 0.6, rate: 1.2 });
    }

    cancelReload() {
        if (this.isReloading) {
            this.isReloading = false;
            this.reloadTimer = 0;
        }
    }

    addAmmo(packs = 2) {
        for (const w of this.weaponSlots) {
            if (w && !w.isKnife && !w.isUtility) {
                this.reserve[w.id] = Math.min(w.magSize * 15, (this.reserve[w.id] || 0) + w.magSize * packs);
            }
        }
    }

    attachToArm(handNode) {
        if (!handNode) return;
        for (const mesh of Object.values(this.weaponMeshes || {})) {
            mesh.removeFromParent();
            if (mesh.userData.ownsMaterials) mesh.traverse(child => {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                for (const material of materials) material?.dispose();
            });
        }
        this.handNode = handNode;
        this.weaponMeshes = {};

        this.weaponSlots.forEach(w => {
            if (!w) return;
            if (w.isKnife) {
                const mesh = this.createKnifeMesh(w);
                if (!mesh) return;
                handNode.add(mesh);
                this.weaponMeshes[w.id] = mesh;
                return;
            }
            if (w.isUtility) return;

            const base = this.models[w.modelFile];
            if (!base) return;

            const mesh = base.clone(true);
            mesh.userData.ownsMaterials = true;
            mesh.traverse(child => {
                if (!child.isMesh) return;
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone());
                } else if (child.material) {
                    child.material = child.material.clone();
                }

                if (w.tier) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            m.color.setHex(w.color);
                            if (m.emissive) { m.emissive.setHex(w.color); m.emissiveIntensity = 0.35; }
                        });
                    } else {
                        child.material.color.setHex(w.color);
                        if (child.material.emissive) {
                            child.material.emissive.setHex(w.color);
                            child.material.emissiveIntensity = 0.35;
                        }
                    }
                }
            });
            // Kenney guns are ~0.8 model units long. Normalize to a readable
            // 0.95–1.15 world units instead of shrinking them again on the arm.
            const bounds = new THREE.Box3().setFromObject(mesh);
            handNode.updateWorldMatrix(true, false);
            const armScale = handNode.getWorldScale(new THREE.Vector3()).z;
            const worldLength = w.modelFile.includes('blaster-a') ? 0.95 : 1.15;
            const scale = worldLength / ((bounds.max.z - bounds.min.z) * armScale);
            mesh.scale.setScalar(scale);
            mesh.userData.barrelForward = -1;
            mesh.userData.gripOffset = new THREE.Vector3(0, 0.14, -0.18).multiplyScalar(scale);
            mesh.userData.handOffset = w.offset.clone();
            mesh.rotation.set(0, -Math.PI / 3, 0);
            mesh.position.copy(mesh.userData.gripOffset).applyQuaternion(mesh.quaternion).add(mesh.userData.handOffset);
            const muzzle = new THREE.Object3D();
            muzzle.name = 'weapon-muzzle';
            muzzle.position.set(0, 0.04, bounds.min.z - 0.025);
            mesh.add(muzzle);
            mesh.visible = false;
            handNode.add(mesh);
            this.weaponMeshes[w.id] = mesh;
        });

        this.updateEquippedMesh();
    }

    createKnifeMesh(config = KNIFE_CONFIG) {
        const source = this.models[config.modelFile];
        if (!source) return null;
        const group = new THREE.Group();
        group.name = 'kenney-cooking-knife';
        const model = source.clone(true);
        const bounds = new THREE.Box3().setFromObject(model);
        this.handNode.updateWorldMatrix(true, false);
        const armScale = this.handNode.getWorldScale(new THREE.Vector3()).x;
        const scale = 0.8 / ((bounds.max.x - bounds.min.x) * armScale);
        // Food Kit's tip points along -X and its wooden grip is at +X.
        model.scale.setScalar(scale);
        model.rotation.y = Math.PI / 2;
        model.position.set(0.045 * scale, -0.02 * scale, 0.24 * scale);
        group.add(model);
        group.userData.gripOffset = new THREE.Vector3();
        group.userData.handOffset = new THREE.Vector3(-0.24, -0.05, 0.02);
        group.position.copy(group.userData.handOffset);
        return group;
    }
    updateEquippedMesh() {
        const currentId = this.getCurrentWeapon().id;
        for (const [id, mesh] of Object.entries(this.weaponMeshes || {})) {
            mesh.visible = (id === currentId);
        }
    }

    updateHeldPose(character) {
        const mesh = this.weaponMeshes?.[this.getCurrentWeapon().id];
        if (mesh) {
            const w = this.getCurrentWeapon();
            const effective = this.getModifiedStats(w);
            mesh.userData.reloadProgress = this.isReloading ? (1 - this.reloadTimer / effective.reloadTime) : 1.0;
        }
        updateHeldWeaponPose(mesh, this.handNode, character);
    }

    getMuzzlePosition(target = new THREE.Vector3()) {
        const muzzle = this.weaponMeshes?.[this.getCurrentWeapon().id]?.getObjectByName('weapon-muzzle');
        if (!muzzle) return null;
        muzzle.updateWorldMatrix(true, false);
        return muzzle.getWorldPosition(target);
    }

    shoot(origin, targetPoint, isADS = false, isPlayer = true, damageMultiplier = 1.0, playerRef = null) {
        const current = this.getCurrentWeapon();
        if (current.isUtility) return false;

        // Nếu đang sơ cứu Medkit mà hành động bắn/chém -> Hủy sơ cứu ngay
        if (this.isUsingMedkit) {
            this.cancelMedkitUse();
        }

        // Tự động chuyển dao nếu cả súng và đạn dự trữ đều hết
        if (isPlayer && !current.isKnife && (this.ammo[current.id] <= 0) && !(this.reserve[current.id] > 0)) {
            this.switchWeapon(1, playerRef);
            return false;
        }

        // Giữ chuột bắn không ngắt quãng tiến trình tự động nạp đạn (Reload)
        if (this.isReloading) return false;

        if (this.onCommand && isPlayer) {
            if (this.fireCooldown > 0) return false;
            if (!current.isKnife && (this.ammo[current.id] || 0) <= 0) {
                if ((this.reserve[current.id] || 0) > 0) this.reload();
                return false;
            }
            this.onCommand({ type: 'shoot', target: targetPoint.toArray(), ads: isADS });
            const send = this.onCommand;
            this.onCommand = null;
            try { return this.shoot(origin, targetPoint, isADS, isPlayer, damageMultiplier, playerRef); }
            finally { this.onCommand = send; }
        }

        const w = this.getCurrentWeapon();

        // Xử lý chém dao
        if (w.isKnife) {
            if (this.fireCooldown > 0) return false;
            const direction = new THREE.Vector3().subVectors(targetPoint, origin);
            if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
            direction.normalize();
            this.fireCooldown = w.fireRate;
            sounds.play('enemyAttack', { volume: 0.5, rate: 1.45 });
            this.particles?.createKnifeSlash?.(origin, direction, w.color, w.range);

            if (playerRef?.applyKickbackAndShake) playerRef.applyKickbackAndShake(w.cursorKick, w.screenShake);

            this.projectiles.push({
                meshEntry: null,
                mesh: null,
                origin: origin.clone(),
                direction,
                range: w.range,
                damage: w.damage * damageMultiplier * (isPlayer ? this.damageBoost : 1),
                penPower: w.penPower,
                critMultiplier: 1.8,
                life: 0.12,
                isPlayer,
                isKnife: true,
                ownerId: 'player'
            });
            return true;
        }

        const effective = this.getModifiedStats(w);

        // Kiểm tra hết băng đạn -> Tự động nạp đạn (Đạn dự trữ là vô hạn)
        if (this.ammo[w.id] <= 0) {
            this.reload();
            return false;
        }

        if (this.fireCooldown > 0) return false;

        this.ammo[w.id]--;

        // Xử lý chế độ Bắn Tăng Cường (Overclock): Tốc độ xả đạn cực nhanh, độ giật triệt tiêu
        const isOverclockActive = this.overclockTimer > 0;
        const speedFactor = isOverclockActive ? 0.55 : 1.0;
        this.fireCooldown = (w.fireRate / this.fireRateBoost) * speedFactor;
        this.recoilOffset = isOverclockActive ? (effective.recoilPitch * 0.2) : effective.recoilPitch;

        // Tăng nón tản đạn sau mỗi phát bắn (Recoil Spread có tính phụ kiện giảm giật)
        const recoilSpread = isOverclockActive ? 0.05 : ((w.recoilSpreadPerShot || 0.8) * (effective.recoilPitch / Math.max(0.001, w.recoilPitch)));
        this.currentSpreadDeg = Math.min(w.maxSpreadDeg, this.currentSpreadDeg + recoilSpread);

        // Phản lực con trỏ và rung màn hình (Cursor Kickback & Screen Shake)
        if (playerRef?.applyKickbackAndShake && !isOverclockActive) {
            playerRef.applyKickbackAndShake(effective.cursorKick, effective.screenShake);
        }

        // Hiệu ứng âm thanh bắn
        if (isOverclockActive) {
            sounds.playShot(w.id);
        } else {
            sounds.playShot(w.id);
        }

        // Phụt tia lửa nòng
        const bulletColor = isOverclockActive ? 0xffdd00 : (effective.hasLegendary ? 0xf59e0b : w.color);
        this.particles?.createMuzzleFlash?.(origin, new THREE.Vector3().subVectors(targetPoint, origin).normalize(), bulletColor);

        const beams = isPlayer ? this.beamCount : 1;
        const spreadRad = THREE.MathUtils.degToRad(isOverclockActive ? Math.min(this.currentSpreadDeg, 1.0) : this.currentSpreadDeg);

        for (let i = 0; i < w.pellets * beams; i++) {
            _tempAimDir.subVectors(targetPoint, origin).normalize();

            // Tính toán góc lệch Cone of Fire toán học
            const angleY = (Math.random() - 0.5) * spreadRad;
            const anglePitch = (Math.random() - 0.5) * (spreadRad * 0.3);
            _tempAimDir.applyAxisAngle(_tempRotAxis, angleY);
            _tempAimDir.y += anglePitch;
            _tempAimDir.normalize();

            // Phân nhánh đòn đánh đa tia
            const lane = Math.floor(i / w.pellets) - (beams - 1) / 2;
            _tempAimDir.applyAxisAngle(_tempRotAxis, lane * 0.07);

            // Lấy mesh từ pool linh hoạt
            const entry = this.getBulletMesh(bulletColor);
            entry.mesh.position.copy(origin);
            entry.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tempAimDir);

            // Đạn huyền thoại (Tier 5): Xuyên 3 mục tiêu + Bắn nổ lan
            const pierceCount = effective.hasLegendary ? 3 : (w.penPower || 1);

            this.projectiles.push({
                meshEntry: entry,
                mesh: entry.mesh,
                id: this.nextProjectileId++,
                origin: origin.clone(),
                direction: _tempAimDir.clone(),
                speed: w.bulletSpeed * (isOverclockActive ? 1.25 : 1.0),
                damage: effective.damage * damageMultiplier * (isPlayer ? this.damageBoost : 1),
                penPower: effective.hasLegendary ? Math.max(3, w.penPower) : w.penPower,
                critMultiplier: (w.critMultiplier || 2.0) + (effective.extraCritDmgMod || 0),
                critChance: 0.12 + (effective.extraCritChance || 0),
                hasLegendary: !!effective.hasLegendary,
                pierceCount: pierceCount,
                hitEnemies: new Set(),
                color: bulletColor,
                life: 2.0,
                isPlayer: true,
                ownerId: 'player',
                isKnife: false
            });
        }

        if (this.ammo[w.id] <= 0) {
            this.reload();
        }

        return true;
    }

    shootEnemyBolt(origin, targetPos, damage = 12, speed = 35, acid = false) {
        _tempAimDir.subVectors(targetPos, origin).normalize();
        _tempAimDir.x += (Math.random() - 0.5) * 0.05;
        _tempAimDir.y += (Math.random() - 0.5) * 0.05;
        _tempAimDir.z += (Math.random() - 0.5) * 0.05;
        _tempAimDir.normalize();

        const color = acid ? 0x99ff22 : 0xff3322;
        this.particles.createMuzzleFlash(origin, _tempAimDir, color);
        sounds.play('enemyAttack', { volume: 0.65, pitchVariation: 0.1 });

        const entry = this.getEnemyMesh(color, acid);
        entry.mesh.position.copy(origin);
        entry.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tempAimDir);

        this.projectiles.push({
            meshEntry: entry,
            mesh: entry.mesh,
            id: this.nextProjectileId++,
            origin: origin.clone(),
            direction: _tempAimDir.clone(),
            speed: speed,
            damage: damage,
            penPower: 1,
            critMultiplier: 1.0,
            color: color,
            life: 3.2,
            isPlayer: false,
            ownerId: 'enemy',
            isKnife: false
        });
    }

    update(delta, arena, enemies, player, onHitCallback) {
        if (this.fireCooldown > 0) {
            this.fireCooldown -= delta;
        }

        // Cập nhật bộ đếm thời gian Overclock
        if (this.overclockTimer > 0) {
            this.overclockTimer -= delta;
        }
        if (this.overclockCooldown > 0) {
            this.overclockCooldown -= delta;
        }

        // Xử lý tiến trình sơ cứu Medkit 5 giây
        if (this.isUsingMedkit && this.medkitPlayerRef) {
            const p = this.medkitPlayerRef;
            if (p.isDead || p.health >= p.maxHealth) {
                this.cancelMedkitUse();
            } else {
                this.medkitTimer -= delta;
                if (Math.random() < 0.28) {
                    const sparkPos = p.position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 0.7,
                        0.4 + Math.random() * 0.9,
                        (Math.random() - 0.5) * 0.7
                    ));
                    this.particles.createImpactSparks(sparkPos, new THREE.Vector3(0, 1, 0), 0x00ff88, 2);
                }

                if (this.medkitTimer <= 0) {
                    this.isUsingMedkit = false;
                    this.medkitTimer = 0;
                    if (this.inventory.medkits > 0) {
                        this.inventory.medkits--;
                        p.heal(50);
                        p.painTimer = 0;
                        sounds.playMedkit();
                        this.particles.createImpactSparks(p.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), 0x00ff88, 24);
                    }
                    this.medkitPlayerRef = null;
                }
            }
        }

        const currentW = this.getCurrentWeapon();
        const mainPlayer = Array.isArray(player) ? player[0] : player;

        // Cập nhật nón tản đạn (Cone of Fire co nhỏ theo thời gian)
        if (mainPlayer && !currentW.isKnife && !currentW.isUtility) {
            const effective = this.getModifiedStats(currentW);
            const isMoving = mainPlayer.velocity && (mainPlayer.velocity.x * mainPlayer.velocity.x + mainPlayer.velocity.z * mainPlayer.velocity.z > 0.05);
            const isADS = mainPlayer.isADS;
            const targetMinSpread = (isADS ? effective.baseSpreadDegADS : effective.baseSpreadDegHip) + (isMoving ? effective.moveSpreadPenalty : 0);

            // Tự động co nhỏ lại về mức tối thiểu theo spreadRecoveryRate
            if (this.currentSpreadDeg > targetMinSpread) {
                this.currentSpreadDeg = Math.max(targetMinSpread, this.currentSpreadDeg - (effective.spreadRecoveryRate || 20) * delta);
            } else if (this.currentSpreadDeg < targetMinSpread) {
                this.currentSpreadDeg = Math.min(targetMinSpread, this.currentSpreadDeg + (effective.spreadRecoveryRate || 20) * delta);
            }
        }

        // Tự động nạp đạn nếu súng hết đạn trong băng (đạn dự trữ là vô hạn)
        if (!currentW.isKnife && !currentW.isUtility && !this.isReloading && (this.ammo[currentW.id] || 0) <= 0) {
            this.reload();
        }

        // Cập nhật tiến trình nạp đạn
        if (this.isReloading) {
            this.reloadTimer -= delta;
            if (this.reloadTimer <= 0) {
                const w = this.getCurrentWeapon();
                const effective = this.getModifiedStats(w);
                this.ammo[w.id] = effective.magSize;
                this.reserve[w.id] = Infinity;
                this.isReloading = false;
                this.reloadTimer = 0;
                sounds.playClearJam(); // Âm thanh lên đạn cơ khí giòn giã khi nạp xong
            }
        }

        this.updateEquippedMesh();

        // Cập nhật đường đạn với Continuous Collision Detection (CCD)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= delta;

            // Xử lý quét đòn chém diện rộng của dao
            if (p.isKnife) {
                const startPos = p.origin;
                _tempSlashForward.copy(p.direction);
                _tempSlashForward.y = 0;
                _tempSlashForward.normalize();
                const slashRange = p.range;
                let hitCount = 0;

                if (p.isPlayer) {
                    for (const enemy of enemies) {
                        if (enemy.isDead) continue;
                        _tempToEnemy.subVectors(enemy.position, startPos);
                        const dist = _tempToEnemy.length();
                        if (dist > slashRange + (enemy.radius || 0.6)) continue;
                        if (Math.abs(_tempToEnemy.y) > 2.2) continue;

                        _tempToEnemyHoriz.copy(_tempToEnemy);
                        _tempToEnemyHoriz.y = 0;
                        _tempToEnemyHoriz.normalize();
                        const dot = _tempSlashForward.dot(_tempToEnemyHoriz);
                        if (dot < 0.75) continue; // Đòn chọc thẳng (góc hẹp)

                        // Check cản tường
                        _tempCheckRayDir.copy(_tempToEnemy).normalize();
                        _tempCheckRay.set(startPos, _tempCheckRayDir);
                        let blocked = false;
                        for (const col of arena.colliders) {
                            const hit = _tempCheckRay.intersectBox(col, _tempHitPoint);
                            if (hit && startPos.distanceTo(hit) < dist - 0.3) {
                                blocked = true;
                                break;
                            }
                        }
                        if (blocked) continue;

                        hitCount++;
                        const isCrit = dot > 0.82 && (Math.random() < 0.35);
                        const finalDamage = p.damage * (isCrit ? p.critMultiplier : 1.0);

                        if (enemy.velocity) {
                            enemy.velocity.addScaledVector(_tempToEnemyHoriz, 4.5);
                        }

                        // Sát thương dao với Pen Power 2
                        const hitResult = enemy.takeDamage(finalDamage, p.penPower, isCrit, _tempSlashForward);
                        _tempHitPointSparks.copy(enemy.position);
                        _tempHitPointSparks.y += 1.0;
                        _tempSparkDir.copy(_tempSlashForward).negate();
                        this.particles.createImpactSparks(_tempHitPointSparks, _tempSparkDir, isCrit ? 0xff2255 : 0x99e6ff, isCrit ? 14 : 9);
                        if (onHitCallback) onHitCallback(finalDamage, isCrit, _tempHitPointSparks, hitResult);
                    }

                    if (hitCount > 0) {
                        sounds.playHitMarker(false);
                    }
                }
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.removeProjectile(i);
                continue;
            }

            // Continuous Collision Detection (CCD) theo frame
            const stepDist = p.speed * delta;
            const startPos = p.mesh.position;
            _tempNextPos.copy(startPos).addScaledVector(p.direction, stepDist);
            _tempRay.set(startPos, p.direction);
            let hitFound = false;

            // 1. Va chạm chướng ngại vật Arena
            for (const col of arena.colliders) {
                const hit = _tempRay.intersectBox(col, _tempHitPoint);
                if (hit && startPos.distanceTo(hit) <= stepDist) {
                    this.particles.createImpactSparks(hit, p.direction.clone().negate(), p.color, 8);
                    this.removeProjectile(i);
                    hitFound = true;
                    break;
                }
            }
            if (hitFound) continue;

            // 2. Đạn người chơi va chạm quái
            if (p.isPlayer) {
                for (const enemy of enemies) {
                    if (enemy.isDead || p.hitEnemies?.has(enemy)) continue;
                    const hitInfo = enemy.checkHit(startPos, _tempNextPos, _tempRay);
                    if (hitInfo.hit) {
                        p.hitEnemies?.add(enemy);

                        // Tính tỷ lệ bạo kích theo Phụ kiện Kính ngắm (Optic Crit Chance)
                        const isCrit = hitInfo.isCrit || (Math.random() < (p.critChance || 0.12));
                        const finalDamage = p.damage * (isCrit ? p.critMultiplier : 1.0);

                        // Gọi takeDamage kèm penPower
                        const hitResult = enemy.takeDamage(finalDamage, p.penPower, isCrit, p.direction);

                        // Tia lửa phụ thuộc vào việc xuyên máu hay bị giáp cản
                        const sparkColor = hitResult?.isPenetrated ? (isCrit ? 0xff2255 : p.color) : 0xffffff;
                        this.particles.createImpactSparks(hitInfo.point, p.direction.clone().negate(), sparkColor, isCrit ? 14 : 8);

                        // Hiệu ứng Đồ Huyền Thoại (Tier 5): Bắn lan (Area of Effect Splash Damage)
                        if (p.hasLegendary) {
                            this.particles?.createExplosion?.(hitInfo.point, 0xf59e0b, 16);
                            for (const other of enemies) {
                                if (other !== enemy && !other.isDead && other.position.distanceTo(hitInfo.point) <= 3.2) {
                                    other.takeDamage(finalDamage * 0.45, 1, false, other.position.clone().sub(hitInfo.point).normalize());
                                }
                            }
                        }

                        sounds.playHitMarker(isCrit);
                        if (onHitCallback) onHitCallback(finalDamage, isCrit, hitInfo.point, hitResult);

                        // Hiệu ứng Xuyên mục tiêu (Piercing)
                        if (p.pierceCount > 1) {
                            p.pierceCount--;
                            p.damage *= 0.85; // Giảm nhẹ sát thương qua từng quái
                            // Đạn vẫn tiếp tục bay
                        } else {
                            this.removeProjectile(i);
                            hitFound = true;
                            break;
                        }
                    }
                }
            } else {
                // 3. Đạn quái va chạm người chơi
                const targets = Array.isArray(player) ? player : [player];
                for (const target of targets) {
                    if (!target || target.isDead) continue;
                    const hitInfo = target.checkHit(startPos, _tempNextPos, _tempRay);
                    if (hitInfo.hit) {
                        target.takeDamage(p.damage, p.direction);
                        this.particles.createImpactSparks(hitInfo.point, p.direction.clone().negate(), p.color, 10);
                        this.removeProjectile(i);
                        hitFound = true;
                        break;
                    }
                }
            }

            if (!hitFound) {
                p.mesh.position.copy(_tempNextPos);
            }
        }
    }

    removeProjectile(index) {
        const p = this.projectiles[index];
        if (p) {
            if (p.meshEntry) {
                if (p.isPlayer) {
                    this.recycleBulletMesh(p.meshEntry);
                } else {
                    this.recycleEnemyMesh(p.meshEntry);
                }
            }
            this.projectiles.splice(index, 1);
        }
    }

    clear() {
        for (const p of this.projectiles) {
            if (p.meshEntry) {
                if (p.isPlayer) {
                    this.recycleBulletMesh(p.meshEntry);
                } else {
                    this.recycleEnemyMesh(p.meshEntry);
                }
            }
        }
        this.projectiles = [];
    }
}
