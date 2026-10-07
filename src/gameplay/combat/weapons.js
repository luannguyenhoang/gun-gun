import * as THREE from 'three';
import { sounds } from '../../audio/audio.js?v=58';

// Bộ nạp và cache texture hiệu ứng hạt từ Kenney Particle Pack
const _molotovTextureLoader = new THREE.TextureLoader();
const _molotovTextures = new Map();

function getMolotovTexture(name) {
    if (!_molotovTextures.has(name)) {
        const tex = _molotovTextureLoader.load(`assets/particles/${name}.png`);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        _molotovTextures.set(name, tex);
    }
    return _molotovTextures.get(name);
}

// Tạo cụm ngọn lửa 3D đa hướng (Cross-Quad Flame) kiểu CS:GO - nhìn từ mọi góc (kể cả top-down) đều rực rỡ và dày dặn
function createCrossQuadFlame(width, height, textureName, colorHex) {
    const group = new THREE.Group();
    const planeGeo = new THREE.PlaneGeometry(width, height);
    // Chuyển trục neo (pivot) về chân ngọn lửa (y = 0) để luôn bám mặt đất
    planeGeo.translate(0, height / 2, 0);

    const mat = new THREE.MeshBasicMaterial({
        map: getMolotovTexture(textureName),
        color: colorHex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const mesh1 = new THREE.Mesh(planeGeo, mat);
    const mesh2 = new THREE.Mesh(planeGeo, mat);
    mesh2.rotation.y = Math.PI / 2;
    const mesh3 = new THREE.Mesh(planeGeo, mat);
    mesh3.rotation.y = Math.PI / 4;

    group.add(mesh1, mesh2, mesh3);
    return { group, mat };
}

// Chuẩn hóa 5 Cấp bậc Độ hiếm (Rarity Tiers) áp dụng cho CẢ SÚNG VÀ PHỤ KIỆN
export const RARITY_TIERS = {
    1: { tier: 1, id: 'common', name: 'COMMON', label: 'Cấp 1 · Thường', color: '#94a3b8', hex: 0x94a3b8, dmgMod: 0.00, desc: 'Chỉ số gốc' },
    2: { tier: 2, id: 'uncommon', name: 'UNCOMMON', label: 'Cấp 2 · Đặc biệt', color: '#22c55e', hex: 0x22c55e, dmgMod: 0.15, desc: '+15% Sát thương' },
    3: { tier: 3, id: 'rare', name: 'RARE', label: 'Cấp 3 · Hiếm', color: '#3b82f6', hex: 0x3b82f6, dmgMod: 0.35, desc: '+35% Sát thương' },
    4: { tier: 4, id: 'epic', name: 'EPIC', label: 'Cấp 4 · Sử thi', color: '#a855f7', hex: 0xa855f7, dmgMod: 0.60, desc: '+60% Sát thương' },
    5: { tier: 5, id: 'legendary', name: 'LEGENDARY', label: 'Cấp 5 · Huyền thoại', color: '#f59e0b', hex: 0xf59e0b, dmgMod: 1.00, desc: '+100% Sát thương, Xuyên 3 mục tiêu' }
};



// ============================================================
// HỆ THỐNG NÂNG CẤP TỪNG BỘ PHẬN VŨ KHÍ (Part-based Upgrade)
// ============================================================

/**
 * Lấy tier hiện tại của một bộ phận cụ thể của súng
 * @param {string} weaponId - ID súng
 * @param {string} slot - 'optic' | 'barrel' | 'grip' | 'magazine'
 * @returns {number} 1-5
 */
export function th_getPartTier(weaponId, slot) {
    if (!weaponId || !slot) return 1;
    try {
        const raw = localStorage.getItem('th_weapon_parts');
        if (raw) {
            const data = JSON.parse(raw);
            const wData = data[weaponId];
            if (wData && typeof wData[slot] === 'number') {
                return Math.max(1, Math.min(5, wData[slot]));
            }
        }
    } catch { }
    return 1;
}

/**
 * Lấy toàn bộ tier bộ phận của một khẩu súng
 * @param {string} weaponId
 * @returns {{ optic: number, barrel: number, grip: number, magazine: number }}
 */
export function th_getWeaponParts(weaponId) {
    return {
        optic: th_getPartTier(weaponId, 'optic'),
        barrel: th_getPartTier(weaponId, 'barrel'),
        grip: th_getPartTier(weaponId, 'grip'),
        magazine: th_getPartTier(weaponId, 'magazine'),
    };
}

/**
 * Tính final stats thực của súng sau khi cộng bonus từ tất cả bộ phận đã nâng cấp
 * @param {object} weaponConfig - Config gốc từ WEAPON_CONFIGS
 * @param {string} weaponId
 * @returns {object} Stats đã tổng hợp bonus bộ phận
 */
export function th_computeWeaponFinalStats(weaponConfig, weaponId) {
    const base = weaponConfig;
    const parts = th_getWeaponParts(weaponId);

    // Sẽ được resolve sau khi ATTACHMENT_DEFS được export
    const _getDef = (key) => {
        try {
            // ATTACHMENT_DEFS được khai báo ở dưới, dùng dynamic access
            return ATTACHMENT_DEFS[key] || {};
        } catch { return {}; }
    };

    const bDef = _getDef(`barrel_t${parts.barrel}`);
    const oDef = _getDef(`optic_t${parts.optic}`);
    const gDef = _getDef(`grip_t${parts.grip}`);
    const mDef = _getDef(`magazine_t${parts.magazine}`);

    return {
        damage: base.damage + (bDef.flatDmg || 0),
        range: (base.range || 20) * (1 + (bDef.rangeBonusPct || 0) + (oDef.rangeBonusPct || 0)),
        magSize: Math.floor((base.magSize || 30) * (1 + (mDef.magBonusPct || 0))),
        reloadTime: (base.reloadTime || 1.5) * (1 - (mDef.reloadSpeedBonus || 0)),
        critChance: (base.critChance || 0) + (oDef.critChance || 0),
        critMultiplier: (base.critMultiplier || 2.0) + (oDef.critDmgMod || 0),
        recoilFactor: 1 - (gDef.recoilReduction || 0),
        spreadFactor: 1 - (gDef.spreadReduction || 0),
        // Giữ lại các stats khác không bị ảnh hưởng
        fireRate: base.fireRate,
        bulletSpeed: base.bulletSpeed,
        penPower: base.penPower,
        pellets: base.pellets,
        isAuto: base.isAuto,
    };
}

// Metadata bộ phận để hiển thị UI
export const TH_PART_META = {
    optic: { label: 'KÍNH NGẮM', key: 'optic', costs: [0, 250, 600, 1200, 2400], rates: [1, 1.0, 0.80, 0.65, 0.45], statKey: 'Crit Chance' },
    barrel: { label: 'NÒNG SÚNG', key: 'barrel', costs: [0, 200, 500, 1000, 2000], rates: [1, 1.0, 0.85, 0.70, 0.50], statKey: 'Sát thương' },
    grip: { label: 'TAY CẦM', key: 'grip', costs: [0, 150, 400, 800, 1600], rates: [1, 1.0, 0.90, 0.75, 0.55], statKey: 'Giật' },
    magazine: { label: 'BĂNG ĐẠN', key: 'magazine', costs: [0, 180, 450, 900, 1800], rates: [1, 1.0, 0.85, 0.70, 0.50], statKey: 'Băng đạn' },
};

// 4 Linh kiện Phụ kiện Nâng cấp Súng (Attachments Ecosystem theo 5 Tier)
export const ATTACHMENT_DEFS = {
    // 1. Nòng súng (Barrel): Tăng Flat Damage và tầm bắn hiệu dụng ở mức cân đối
    barrel_t1: { id: 'barrel_t1', name: 'Nòng Cấp 1', slot: 'barrel', tier: 1, flatDmg: 2, rangeBonusPct: 0.08, icon: 'assets/previews/kenney-blaster/silencer-small.png', modelFile: 'kenney-blaster/silencer-small.glb', desc: '+2 Sát thương, +8% Tầm bắn' },
    barrel_t2: { id: 'barrel_t2', name: 'Nòng Cấp 2', slot: 'barrel', tier: 2, flatDmg: 4, rangeBonusPct: 0.15, icon: 'assets/previews/kenney-blaster/silencer-small.png', modelFile: 'kenney-blaster/silencer-small.glb', desc: '+4 Sát thương, +15% Tầm bắn' },
    barrel_t3: { id: 'barrel_t3', name: 'Nòng Cấp 3', slot: 'barrel', tier: 3, flatDmg: 7, rangeBonusPct: 0.25, icon: 'assets/previews/kenney-blaster/silencer-larger.png', modelFile: 'kenney-blaster/silencer-larger.glb', desc: '+7 Sát thương, +25% Tầm bắn' },
    barrel_t4: { id: 'barrel_t4', name: 'Nòng Cấp 4', slot: 'barrel', tier: 4, flatDmg: 11, rangeBonusPct: 0.35, icon: 'assets/previews/kenney-blaster/silencer-larger.png', modelFile: 'kenney-blaster/silencer-larger.glb', desc: '+11 Sát thương, +35% Tầm bắn' },
    barrel_t5: { id: 'barrel_t5', name: 'Nòng Cấp 5', slot: 'barrel', tier: 5, flatDmg: 16, rangeBonusPct: 0.50, icon: 'assets/previews/kenney-blaster/silencer-larger.png', modelFile: 'kenney-blaster/silencer-larger.glb', desc: '+16 Sát thương, +50% Tầm bắn' },

    // 2. Băng đạn (Magazine): Tăng dung lượng đạn và tốc độ nạp đạn
    magazine_t1: { id: 'magazine_t1', name: 'Băng Đạn Cấp 1', slot: 'magazine', tier: 1, magBonusPct: 0.15, reloadSpeedBonus: 0.10, icon: 'assets/previews/kenney-blaster/clip-small.png', modelFile: 'kenney-blaster/clip-small.glb', desc: '+15% Dung lượng, nạp nhanh 10%' },
    magazine_t2: { id: 'magazine_t2', name: 'Băng Đạn Cấp 2', slot: 'magazine', tier: 2, magBonusPct: 0.25, reloadSpeedBonus: 0.15, icon: 'assets/previews/kenney-blaster/clip-small.png', modelFile: 'kenney-blaster/clip-small.glb', desc: '+25% Băng đạn, nạp nhanh 15%' },
    magazine_t3: { id: 'magazine_t3', name: 'Băng Đạn Cấp 3', slot: 'magazine', tier: 3, magBonusPct: 0.40, reloadSpeedBonus: 0.20, icon: 'assets/previews/kenney-blaster/clip-large.png', modelFile: 'kenney-blaster/clip-large.glb', desc: '+40% Băng đạn, nạp nhanh 20%' },
    magazine_t4: { id: 'magazine_t4', name: 'Băng Đạn Cấp 4', slot: 'magazine', tier: 4, magBonusPct: 0.55, reloadSpeedBonus: 0.25, icon: 'assets/previews/kenney-blaster/clip-large.png', modelFile: 'kenney-blaster/clip-large.glb', desc: '+55% Băng đạn, nạp nhanh 25%' },
    magazine_t5: { id: 'magazine_t5', name: 'Băng Đạn Cấp 5', slot: 'magazine', tier: 5, magBonusPct: 0.75, reloadSpeedBonus: 0.30, icon: 'assets/previews/kenney-blaster/clip-large.png', modelFile: 'kenney-blaster/clip-large.glb', desc: '+75% Băng đạn, nạp nhanh 30%' },

    // 3. Kính ngắm (Optic): Tăng tỷ lệ bạo kích và tầm bắn hiệu dụng
    optic_t1: { id: 'optic_t1', name: 'Kính Ngắm Cấp 1', slot: 'optic', tier: 1, critChance: 0.05, critDmgMod: 0.15, adsZoom: 1.25, rangeBonusPct: 0.00, icon: 'assets/previews/kenney-blaster/scope-small.png', modelFile: 'kenney-blaster/scope-small.glb', desc: '+5% Crit, +0.15x Bạo kích' },
    optic_t2: { id: 'optic_t2', name: 'Kính Ngắm Cấp 2', slot: 'optic', tier: 2, critChance: 0.10, critDmgMod: 0.25, adsZoom: 1.50, rangeBonusPct: 0.05, icon: 'assets/previews/kenney-blaster/scope-large-a.png', modelFile: 'kenney-blaster/scope-large-a.glb', desc: '+10% Crit, +0.25x Bạo kích, zoom 1.5x' },
    optic_t3: { id: 'optic_t3', name: 'Kính Ngắm Cấp 3', slot: 'optic', tier: 3, critChance: 0.15, critDmgMod: 0.35, adsZoom: 1.75, rangeBonusPct: 0.10, icon: 'assets/previews/kenney-blaster/scope-large-a.png', modelFile: 'kenney-blaster/scope-large-a.glb', desc: '+15% Crit, +0.35x Bạo kích, zoom 1.75x' },
    optic_t4: { id: 'optic_t4', name: 'Kính Ngắm Cấp 4', slot: 'optic', tier: 4, critChance: 0.22, critDmgMod: 0.45, adsZoom: 2.20, rangeBonusPct: 0.15, icon: 'assets/previews/kenney-blaster/scope-large-b.png', modelFile: 'kenney-blaster/scope-large-b.glb', desc: '+22% Crit, +0.45x Bạo kích, zoom 2.2x' },
    optic_t5: { id: 'optic_t5', name: 'Kính Ngắm Cấp 5', slot: 'optic', tier: 5, critChance: 0.30, critDmgMod: 0.60, adsZoom: 2.80, rangeBonusPct: 0.20, icon: 'assets/previews/kenney-blaster/scope-large-b.png', modelFile: 'kenney-blaster/scope-large-b.glb', desc: '+30% Crit, +0.60x Bạo kích, zoom 2.8x' },

    // 4. Báng / Tay cầm (Grip): Giảm độ giật và độ tản đạn
    grip_t1: { id: 'grip_t1', name: 'Báng Tay Cầm Cấp 1', slot: 'grip', tier: 1, recoilReduction: 0.15, spreadReduction: 0.15, icon: 'assets/previews/kenney-blaster/target-detail.png', modelFile: 'kenney-blaster/target-detail.glb', desc: '-15% Giật, -15% Tản đạn' },
    grip_t2: { id: 'grip_t2', name: 'Báng Tay Cầm Cấp 2', slot: 'grip', tier: 2, recoilReduction: 0.25, spreadReduction: 0.25, icon: 'assets/previews/kenney-blaster/target-detail.png', modelFile: 'kenney-blaster/target-detail.glb', desc: '-25% Giật, -25% Tản đạn' },
    grip_t3: { id: 'grip_t3', name: 'Báng Tay Cầm Cấp 3', slot: 'grip', tier: 3, recoilReduction: 0.35, spreadReduction: 0.35, icon: 'assets/previews/kenney-blaster/target-detail.png', modelFile: 'kenney-blaster/target-detail.glb', desc: '-35% Giật, -35% Gom đạn' },
    grip_t4: { id: 'grip_t4', name: 'Báng Tay Cầm Cấp 4', slot: 'grip', tier: 4, recoilReduction: 0.45, spreadReduction: 0.45, icon: 'assets/previews/kenney-blaster/target-detail.png', modelFile: 'kenney-blaster/target-detail.glb', desc: '-45% Giật, -45% Gom đạn' },
    grip_t5: { id: 'grip_t5', name: 'Báng Tay Cầm Cấp 5', slot: 'grip', tier: 5, recoilReduction: 0.60, spreadReduction: 0.55, icon: 'assets/previews/kenney-blaster/target-detail.png', modelFile: 'kenney-blaster/target-detail.glb', desc: '-60% Giật, -55% Gom đạn' }
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
        aliases: ['blaster_a', 'blaster-a'],
        name: 'BLASTER-A ALPHA',
        category: 'SÚNG LỤC TIÊU CHUẨN',
        tier: 1,
        price: 0,
        targetLength: 0.95,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-a.glb',
        icon: 'assets/previews/kenney-blaster/blaster-a.png',
        fireRate: 0.36,
        damage: 28,
        penPower: 1,
        critMultiplier: 2.0,
        magSize: 16,
        reloadTime: 1.15,
        range: 18,
        bulletSpeed: 105,
        baseSpreadDegHip: 2.2,
        baseSpreadDegADS: 0.5,
        moveSpreadPenalty: 2.5,
        recoilSpreadPerShot: 1,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 20.0,
        screenShake: 0.17,
        cursorKick: 3.36,
        color: 0x38bdf8,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.0313,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_b',
        aliases: ['blaster-b'],
        name: 'BLASTER-B STRIKER',
        category: 'SÚNG NGẮN LIÊN THANH',
        tier: 1,
        price: 350,
        targetLength: 0.95,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-b.glb',
        icon: 'assets/previews/kenney-blaster/blaster-b.png',
        fireRate: 0.24,
        damage: 22,
        penPower: 1,
        critMultiplier: 2.0,
        magSize: 22,
        reloadTime: 1.1,
        range: 16,
        bulletSpeed: 110,
        baseSpreadDegHip: 2.8,
        baseSpreadDegADS: 0.8,
        moveSpreadPenalty: 2.2,
        recoilSpreadPerShot: 0.75,
        maxSpreadDeg: 10.0,
        spreadRecoveryRate: 22.0,
        screenShake: 0.14,
        cursorKick: 2.64,
        color: 0x22c55e,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.025,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_c',
        aliases: ['blaster-c', 'ak47'],
        name: 'BLASTER-C PHANTOM',
        category: 'SÚNG TRƯỜNG CHIẾN THUẬT',
        tier: 1,
        price: 800,
        targetLength: 1.05,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-c.glb',
        icon: 'assets/previews/kenney-blaster/blaster-c.png',
        fireRate: 0.26,
        damage: 36,
        penPower: 2,
        critMultiplier: 2.1,
        magSize: 30,
        reloadTime: 1.3,
        range: 22,
        bulletSpeed: 125,
        baseSpreadDegHip: 2.4,
        baseSpreadDegADS: 0.6,
        moveSpreadPenalty: 2.6,
        recoilSpreadPerShot: 0.875,
        maxSpreadDeg: 10.0,
        spreadRecoveryRate: 21.0,
        screenShake: 0.19,
        cursorKick: 3.6,
        color: 0x60a5fa,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.035,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'repeater',
        aliases: ['blaster_d', 'blaster-d'],
        name: 'BLASTER-D REPEATER',
        category: 'TIỂU LIÊN SMG CAO TỐC',
        tier: 1,
        price: 0,
        targetLength: 1.10,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-d.glb',
        icon: 'assets/previews/kenney-blaster/blaster-d.png',
        fireRate: 0.18,
        damage: 18,
        penPower: 1,
        critMultiplier: 2.0,
        magSize: 32,
        reloadTime: 1.25,
        range: 15,
        bulletSpeed: 115,
        baseSpreadDegHip: 3.5,
        baseSpreadDegADS: 1.0,
        moveSpreadPenalty: 3.0,
        recoilSpreadPerShot: 0.6,
        maxSpreadDeg: 12.0,
        spreadRecoveryRate: 24.0,
        screenShake: 0.12,
        cursorKick: 2.4,
        color: 0xf59e0b,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.0225,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_e',
        aliases: ['blaster-e', 'storm'],
        name: 'BLASTER-E STORM MK-II',
        category: 'SÚNG TRƯỜNG BÃO TỐ',
        tier: 1,
        price: 1300,
        targetLength: 1.15,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-e.glb',
        icon: 'assets/previews/kenney-blaster/blaster-e.png',
        fireRate: 0.16,
        damage: 32,
        penPower: 2,
        critMultiplier: 2.2,
        magSize: 36,
        reloadTime: 1.35,
        range: 24,
        bulletSpeed: 130,
        baseSpreadDegHip: 2.5,
        baseSpreadDegADS: 0.6,
        moveSpreadPenalty: 2.4,
        recoilSpreadPerShot: 0.688,
        maxSpreadDeg: 9.5,
        spreadRecoveryRate: 23.0,
        screenShake: 0.17,
        cursorKick: 2.88,
        color: 0x10b981,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.0325,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'shotgun',
        aliases: ['blaster_f', 'blaster-f'],
        name: 'BLASTER-F ENFORCER',
        category: 'SHOTGUN CHIẾN THUẬT',
        tier: 1,
        price: 750,
        targetLength: 1.00,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-f.glb',
        icon: 'assets/previews/kenney-blaster/blaster-f.png',
        fireRate: 0.845,
        damage: 16,
        penPower: 2,
        critMultiplier: 1.9,
        magSize: 8,
        reloadTime: 1.6,
        range: 12,
        bulletSpeed: 100,
        baseSpreadDegHip: 8.5,
        baseSpreadDegADS: 4.0,
        moveSpreadPenalty: 3.5,
        recoilSpreadPerShot: 2.75,
        maxSpreadDeg: 17.0,
        spreadRecoveryRate: 25.0,
        screenShake: 0.46,
        cursorKick: 8.64,
        color: 0x8b5cf6,
        isAuto: false,
        pellets: 8,
        recoilPitch: 0.0813,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'scatter',
        aliases: ['blaster_g', 'blaster-g'],
        name: 'BLASTER-G SCATTER-V',
        category: 'SHOTGUN TÁN XẠ NẶNG',
        tier: 1,
        price: 0,
        targetLength: 0.90,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-g.glb',
        icon: 'assets/previews/kenney-blaster/blaster-g.png',
        fireRate: 0.715,
        damage: 14,
        penPower: 1,
        critMultiplier: 1.8,
        magSize: 8,
        reloadTime: 1.5,
        range: 10,
        bulletSpeed: 95,
        baseSpreadDegHip: 9.0,
        baseSpreadDegADS: 4.5,
        moveSpreadPenalty: 4.0,
        recoilSpreadPerShot: 2.5,
        maxSpreadDeg: 18.0,
        spreadRecoveryRate: 28.0,
        screenShake: 0.42,
        cursorKick: 8.16,
        color: 0xec4899,
        isAuto: false,
        pellets: 6,
        recoilPitch: 0.075,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'mac10',
        aliases: ['blaster_h', 'blaster-h'],
        name: 'BLASTER-H VIPER',
        category: 'TIỂU LIÊN CƠ ĐỘNG',
        tier: 1,
        price: 650,
        targetLength: 0.85,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-h.glb',
        icon: 'assets/previews/kenney-blaster/blaster-h.png',
        fireRate: 0.13,
        damage: 16,
        penPower: 1,
        critMultiplier: 1.9,
        magSize: 40,
        reloadTime: 1.1,
        range: 14,
        bulletSpeed: 110,
        baseSpreadDegHip: 4.0,
        baseSpreadDegADS: 1.2,
        moveSpreadPenalty: 2.0,
        recoilSpreadPerShot: 0.438,
        maxSpreadDeg: 12.5,
        spreadRecoveryRate: 26.0,
        screenShake: 0.11,
        cursorKick: 2.16,
        color: 0x14b8a6,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.02,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_i',
        aliases: ['blaster-i'],
        name: 'BLASTER-I SHARPSHOOTER',
        category: 'SÚNG TRƯỜNG XẠ THỦ',
        tier: 1,
        price: 950,
        targetLength: 1.20,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-i.glb',
        icon: 'assets/previews/kenney-blaster/blaster-i.png',
        fireRate: 0.416,
        damage: 68,
        penPower: 3,
        critMultiplier: 2.4,
        magSize: 15,
        reloadTime: 1.4,
        range: 28,
        bulletSpeed: 150,
        baseSpreadDegHip: 2.0,
        baseSpreadDegADS: 0.3,
        moveSpreadPenalty: 3.0,
        recoilSpreadPerShot: 1.875,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 20.0,
        screenShake: 0.26,
        cursorKick: 5.04,
        color: 0x3b82f6,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.0563,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'plasma',
        aliases: ['blaster_j', 'blaster-j'],
        name: 'BLASTER-J PLASMA LANCE',
        category: 'ĐẠI BÁC PLASMA CAO ÁP',
        tier: 1,
        price: 2100,
        targetLength: 1.25,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-j.glb',
        icon: 'assets/previews/kenney-blaster/blaster-j.png',
        fireRate: 0.3,
        damage: 56,
        penPower: 4,
        critMultiplier: 2.3,
        magSize: 26,
        reloadTime: 1.35,
        range: 25,
        bulletSpeed: 140,
        baseSpreadDegHip: 1.8,
        baseSpreadDegADS: 0.4,
        moveSpreadPenalty: 2.0,
        recoilSpreadPerShot: 0.625,
        maxSpreadDeg: 8.0,
        spreadRecoveryRate: 22.0,
        screenShake: 0.26,
        cursorKick: 4.56,
        color: 0x9966ff,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.035,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'pew',
        aliases: ['blaster_k', 'blaster-k'],
        name: 'BLASTER-K CYBER LASER',
        category: 'SÚNG LỤC NĂNG LƯỢNG',
        tier: 1,
        price: 450,
        targetLength: 0.90,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-k.glb',
        icon: 'assets/previews/kenney-blaster/blaster-k.png',
        fireRate: 0.26,
        damage: 26,
        penPower: 2,
        critMultiplier: 2.1,
        magSize: 20,
        reloadTime: 0.95,
        range: 18,
        bulletSpeed: 130,
        baseSpreadDegHip: 1.5,
        baseSpreadDegADS: 0.3,
        moveSpreadPenalty: 1.5,
        recoilSpreadPerShot: 0.5,
        maxSpreadDeg: 7.0,
        spreadRecoveryRate: 24.0,
        screenShake: 0.12,
        cursorKick: 2.28,
        color: 0x06b6d4,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.02,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_l',
        aliases: ['blaster-l'],
        name: 'BLASTER-L PULSE CARBINE',
        category: 'CARBINE XUNG LỰC',
        tier: 1,
        price: 1500,
        targetLength: 1.15,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-l.glb',
        icon: 'assets/previews/kenney-blaster/blaster-l.png',
        fireRate: 0.2,
        damage: 40,
        penPower: 3,
        critMultiplier: 2.2,
        magSize: 30,
        reloadTime: 1.25,
        range: 24,
        bulletSpeed: 135,
        baseSpreadDegHip: 2.2,
        baseSpreadDegADS: 0.5,
        moveSpreadPenalty: 2.3,
        recoilSpreadPerShot: 0.75,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 23.0,
        screenShake: 0.18,
        cursorKick: 3.12,
        color: 0xf97316,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.0338,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_m',
        aliases: ['blaster-m'],
        name: 'BLASTER-M GUARDIAN DMR',
        category: 'SÚNG BẮN TỈA BÁN TỰ ĐỘNG',
        tier: 1,
        price: 1750,
        targetLength: 1.30,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-m.glb',
        icon: 'assets/previews/kenney-blaster/blaster-m.png',
        fireRate: 0.50,
        damage: 65,
        penPower: 2,
        critMultiplier: 2.2,
        magSize: 10,
        reloadTime: 1.5,
        range: 30,
        bulletSpeed: 160,
        baseSpreadDegHip: 2.5,
        baseSpreadDegADS: 0.2,
        moveSpreadPenalty: 3.0,
        recoilSpreadPerShot: 2.25,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 19.0,
        screenShake: 0.29,
        cursorKick: 5.76,
        color: 0x6366f1,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.0625,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'awp',
        aliases: ['blaster_n', 'blaster-n'],
        name: 'BLASTER-N VORTEX SNIPER',
        category: 'SÚNG BẮN TỈA CỰC NẶNG',
        tier: 1,
        price: 2500,
        targetLength: 1.40,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-n.glb',
        icon: 'assets/previews/kenney-blaster/blaster-n.png',
        fireRate: 1.35,
        damage: 110,
        penPower: 2,
        pierceCount: 2, // Súng bắn tỉa hạng nặng có thể xuyên qua tối đa 2 mục tiêu
        critMultiplier: 2.4,
        magSize: 5,
        reloadTime: 2.0,
        range: 36,
        bulletSpeed: 175,
        baseSpreadDegHip: 4.0,
        baseSpreadDegADS: 0.1,
        moveSpreadPenalty: 4.5,
        recoilSpreadPerShot: 4.375,
        maxSpreadDeg: 12.0,
        spreadRecoveryRate: 16.0,
        screenShake: 0.5,
        cursorKick: 9,
        color: 0xef4444,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.0938,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_o',
        aliases: ['blaster-o'],
        name: 'BLASTER-O TITAN BLASTER',
        category: 'SÚNG TRƯỜNG CÔNG PHÁ HẠNG NẶNG',
        tier: 1,
        price: 2700,
        targetLength: 1.25,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-o.glb',
        icon: 'assets/previews/kenney-blaster/blaster-o.png',
        fireRate: 0.24,
        damage: 42,
        penPower: 2,
        critMultiplier: 2.1,
        magSize: 32,
        reloadTime: 1.4,
        range: 26,
        bulletSpeed: 140,
        baseSpreadDegHip: 2.0,
        baseSpreadDegADS: 0.4,
        moveSpreadPenalty: 2.4,
        recoilSpreadPerShot: 0.813,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 21.0,
        screenShake: 0.24,
        cursorKick: 4.2,
        color: 0xd946ef,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.0375,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'rocket',
        aliases: ['blaster_p', 'blaster-p'],
        name: 'BLASTER-P RPG DEVASTATOR',
        category: 'VŨ KHÍ NỔ LAN HẠNG NẶNG',
        tier: 1,
        price: 3200,
        targetLength: 1.30,
        isStyloo: false,
        isExplosive: true,
        splashRadius: 3.6,
        modelFile: 'kenney-blaster/blaster-p.glb',
        icon: 'assets/previews/kenney-blaster/blaster-p.png',
        fireRate: 2.0,
        damage: 120,
        penPower: 2,
        critMultiplier: 1.8,
        magSize: 2,
        reloadTime: 2.2,
        range: 26,
        bulletSpeed: 80,
        baseSpreadDegHip: 1.2,
        baseSpreadDegADS: 0.2,
        moveSpreadPenalty: 3.5,
        recoilSpreadPerShot: 4.375,
        maxSpreadDeg: 8.0,
        spreadRecoveryRate: 14.0,
        screenShake: 0.6,
        cursorKick: 9,
        color: 0xf43f5e,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.1125,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_q',
        aliases: ['blaster-q'],
        name: 'BLASTER-Q VULCAN MINIGUN',
        category: 'SÚNG MÁY GATLING HUYỀN THOẠI',
        tier: 1,
        price: 4200,
        targetLength: 1.35,
        isStyloo: false,
        modelFile: 'kenney-blaster/blaster-q.glb',
        icon: 'assets/previews/kenney-blaster/blaster-q.png',
        fireRate: 0.10,
        damage: 16,
        penPower: 2,
        critMultiplier: 1.8,
        magSize: 75,
        reloadTime: 2.6,
        range: 24,
        bulletSpeed: 135,
        baseSpreadDegHip: 4.2,
        baseSpreadDegADS: 1.5,
        moveSpreadPenalty: 4.0,
        recoilSpreadPerShot: 0.438,
        maxSpreadDeg: 14.0,
        spreadRecoveryRate: 18.0,
        screenShake: 0.19,
        cursorKick: 2.64,
        color: 0xeab308,
        isAuto: true,
        pellets: 1,
        recoilPitch: 0.025,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    },
    {
        id: 'blaster_r',
        aliases: ['blaster-r', 'nova'],
        name: 'BLASTER-R OMEGA CANNON',
        category: 'PHÁO LƯỢNG TỬ TẬN THẾ',
        tier: 1,
        price: 5000,
        targetLength: 1.45,
        isStyloo: false,
        isExplosive: true,
        splashRadius: 4.2,
        modelFile: 'kenney-blaster/blaster-r.glb',
        icon: 'assets/previews/kenney-blaster/blaster-r.png',
        fireRate: 2.2,
        damage: 150,
        penPower: 2,
        critMultiplier: 2.0,
        magSize: 3,
        reloadTime: 2.4,
        range: 32,
        bulletSpeed: 85,
        baseSpreadDegHip: 1.5,
        baseSpreadDegADS: 0.2,
        moveSpreadPenalty: 4.0,
        recoilSpreadPerShot: 5,
        maxSpreadDeg: 9.0,
        spreadRecoveryRate: 12.0,
        screenShake: 0.66,
        cursorKick: 10.2,
        color: 0xec4899,
        isAuto: false,
        pellets: 1,
        recoilPitch: 0.125,
        scale: 0.24,
        offset: new THREE.Vector3(-0.24, -0.05, 0.02),
        rotOffset: new THREE.Euler(0, Math.PI * 0.35, 0)
    }
];

// Phân loại danh mục súng chính và súng phụ (Súng lục)
export const SECONDARY_WEAPON_IDS = new Set(['blaster', 'blaster_a', 'blaster-a', 'blaster_b', 'blaster-b', 'mac10', 'blaster-h', 'pew', 'blaster-k']);
for (const w of WEAPON_CONFIGS) {
    w.slotType = SECONDARY_WEAPON_IDS.has(w.id) ? 'secondary' : 'primary';
}

// Phân loại hình thái và kích cỡ đạn theo từng dòng súng
export function getBulletType(w) {
    if (!w) return 'rifle';
    if (w.isExplosive || w.id === 'blaster_p' || w.id === 'blaster_r') return 'explosive';
    if (w.pellets > 1 || w.id === 'blaster_f' || w.id === 'blaster_m') return 'shotgun';
    if (w.id === 'blaster_g' || w.id === 'blaster_l') return 'sniper';
    if (w.id === 'blaster_j' || w.id === 'blaster_n') return 'plasma';
    if (w.id === 'blaster_q') return 'minigun';
    if (['blaster', 'blaster_a', 'blaster_b', 'mac10', 'pew'].includes(w.id)) return 'pistol';
    return 'rifle';
}

// Danh sách các loại Bom & Lựu Đạn chiến thuật (Bộ 4 loại Bom hoàn chỉnh)
export const BOMB_CONFIGS = [
    {
        id: 'grenade_a',
        aliases: ['grenade-a'],
        name: 'LỰU ĐẠN NỔ MẢNH A',
        category: 'LỰU ĐẠN NỔ MẢNH',
        slotType: 'bomb',
        tier: 1,
        price: 0,
        isBomb: true,
        bombType: 'frag',
        throwRange: 14.0,
        blastRadius: 5.0,
        damage: 1600,
        knockback: 10.0,
        fuseTime: 0.65,
        modelFile: 'kenney-blaster/grenade-a.glb',
        icon: 'assets/previews/kenney-blaster/grenade-a.png',
        color: 0xf97316,
        description: 'Lựu đạn nổ phân mảnh uy lực cao. Gây sát thương nổ diện rộng và hất văng bầy zombie.'
    },
    {
        id: 'grenade_smoke',
        aliases: ['grenade-smoke', 'grenade_b'],
        name: 'LỰU ĐẠN KHÓI CHIẾN THUẬT',
        category: 'LỰU ĐẠN TÁC CHIẾN',
        slotType: 'bomb',
        tier: 2,
        price: 1200,
        isBomb: true,
        bombType: 'smoke',
        throwRange: 14.0,
        blastRadius: 5.5,
        duration: 10.0,
        damage: 0,
        knockback: 0,
        fuseTime: 0.65,
        modelFile: 'kenney-blaster/grenade-b.glb',
        icon: 'assets/previews/kenney-blaster/grenade-b.png',
        color: 0x94a3b8,
        description: 'Tạo màn khói che chắn tầm nhìn trong 10 giây. Zombie mất dấu và không tấn công người chơi trong phạm vi khói.'
    },
    {
        id: 'grenade_fire',
        aliases: ['grenade-fire', 'molotov'],
        name: 'LỰU ĐẠN HỎA THIÊU MOLOTOV',
        category: 'LỰU ĐẠN TÁC CHIẾN',
        slotType: 'bomb',
        tier: 3,
        price: 1800,
        isBomb: true,
        bombType: 'fire',
        throwRange: 14.0,
        blastRadius: 4.5,
        duration: 10.0,
        burnDps: 25,
        damage: 80,
        knockback: 3.0,
        fuseTime: 0.65,
        modelFile: 'kenney-blaster/grenade-a.glb',
        icon: 'assets/previews/kenney-blaster/grenade-a.png',
        color: 0xef4444,
        description: 'Tạo biển lửa thiêu đốt diện rộng trên mặt đất trong 10 giây. Gây sát thương liên tục và áp hiệu ứng cháy lên zombie.'
    },
    {
        id: 'grenade_freeze',
        aliases: ['grenade-freeze', 'cryo'],
        name: 'LỰU ĐẠN BĂNG GIÁ CRYO',
        category: 'LỰU ĐẠN TÁC CHIẾN',
        slotType: 'bomb',
        tier: 4,
        price: 2500,
        isBomb: true,
        bombType: 'freeze',
        throwRange: 14.0,
        blastRadius: 5.5,
        freezeDuration: 4.0,
        damage: 200,
        knockback: 2.0,
        fuseTime: 0.65,
        modelFile: 'kenney-blaster/grenade-b.glb',
        icon: 'assets/previews/kenney-blaster/grenade-b.png',
        color: 0x38bdf8,
        description: 'Sóng hàn khí cực mạnh đóng băng toàn bộ zombie trong phạm vi suốt 4 giây (bất động 100%).'
    }
];

export function getBombConfig(id) {
    if (!id) return BOMB_CONFIGS[0];
    return BOMB_CONFIGS.find(b => b.id === id || b.aliases?.includes(id)) || BOMB_CONFIGS[0];
}

// Danh mục 4 Vật phẩm y tế & tăng cường chuẩn PUBG
export const MEDICAL_CONFIGS = [
    {
        id: 'bandage_field',
        name: 'BĂNG GẠC DÃ CHIẾN',
        category: 'VẬT PHẨM Y TẾ',
        slotType: 'medical',
        tier: 1,
        price: 150,
        healAmount: 25,
        maxHealthCap: 75,
        useTime: 2.5,
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        color: 0x94a3b8,
        description: 'Băng gạc cơ bản, hồi 25 HP trong 2.5 giây. Chỉ dùng khi máu dưới 75%.'
    },
    {
        id: 'first_aid_kit',
        name: 'TÚI SƠ CỨU FIRST AID',
        category: 'VẬT PHẨM Y TẾ',
        slotType: 'medical',
        tier: 2,
        price: 400,
        healAmount: 75,
        maxHealthCap: 75,
        useTime: 4.0,
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        color: 0x22c55e,
        description: 'Túi sơ cứu tiêu chuẩn PUBG, hồi phục ngay lên 75 HP trong 4.0 giây.'
    },
    {
        id: 'medkit_military',
        name: 'HỘP CỨU THƯƠNG QUÂN SỰ',
        category: 'VẬT PHẨM Y TẾ',
        slotType: 'medical',
        tier: 4,
        price: 900,
        healAmount: 100,
        maxHealthCap: 100,
        useTime: 6.0,
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        color: 0xf59e0b,
        description: 'Hộp cứu thương cao cấp tối thượng, hồi đầy 100% Máu trong 6.0 giây.'
    },
    {
        id: 'energy_drink',
        name: 'NƯỚC TĂNG LỰC CHIẾN BINH',
        category: 'VẬT PHẨM TĂNG CƯỜNG',
        slotType: 'medical',
        tier: 2,
        price: 350,
        shieldAmount: 50,
        speedBoostDuration: 12.0,
        speedBoostPct: 0.25,
        useTime: 2.0,
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        color: 0x06b6d4,
        description: 'Nước tăng lực uống nhanh trong 2.0 giây. Hồi 50 Khiên giáp và tăng 25% tốc độ chạy trong 12 giây.'
    }
];

export function getMedicalConfig(id) {
    if (!id) return MEDICAL_CONFIGS[1];
    return MEDICAL_CONFIGS.find(m => m.id === id) || MEDICAL_CONFIGS[1];
}

// Danh sách các súng hiếm rơi ra trong trận
export const RARE_WEAPON_CONFIGS = [
    WEAPON_CONFIGS[4], // BLASTER-E STORM
    WEAPON_CONFIGS[9], // BLASTER-J PLASMA
    WEAPON_CONFIGS[13], // BLASTER-N VORTEX
    WEAPON_CONFIGS[15], // BLASTER-P RPG
    WEAPON_CONFIGS[16], // BLASTER-Q MINIGUN
    WEAPON_CONFIGS[17]  // BLASTER-R OMEGA
];

// Toàn bộ phụ kiện và trang bị Kenney Blaster Kit
export const ALL_KENNEY_ACCESSORIES = [
    { id: 'silencer_small', name: 'Giảm Thanh Mini', category: 'Nòng súng', slot: 'barrel', modelFile: 'kenney-blaster/silencer-small.glb', icon: 'assets/previews/kenney-blaster/silencer-small.png', desc: 'Giảm thanh nhỏ gọn, tăng nhẹ tầm bắn và giảm tiếng động' },
    { id: 'silencer_large', name: 'Giảm Thanh Hạng Nặng', category: 'Nòng súng', slot: 'barrel', modelFile: 'kenney-blaster/silencer-larger.glb', icon: 'assets/previews/kenney-blaster/silencer-larger.png', desc: 'Ống giảm thanh cỡ lớn triệt tiêu độ giật và tăng flat damage' },
    { id: 'scope_small', name: 'Kính Ngắm Phản Xạ Red Dot', category: 'Kính ngắm', slot: 'optic', modelFile: 'kenney-blaster/scope-small.glb', icon: 'assets/previews/kenney-blaster/scope-small.png', desc: 'Kính ngắm cự ly gần hỗ trợ ngắm nhanh chính xác' },
    { id: 'scope_large_a', name: 'Kính Ngắm Tác Chiến x4', category: 'Kính ngắm', slot: 'optic', modelFile: 'kenney-blaster/scope-large-a.glb', icon: 'assets/previews/kenney-blaster/scope-large-a.png', desc: 'Kính ngắm tầm trung độ phóng đại 4x tăng tỷ lệ bạo kích' },
    { id: 'scope_large_b', name: 'Kính Ngắm Tỉa Viễn Vọng x8', category: 'Kính ngắm', slot: 'optic', modelFile: 'kenney-blaster/scope-large-b.glb', icon: 'assets/previews/kenney-blaster/scope-large-b.png', desc: 'Kính ngắm cự ly siêu xa x8 chuyên dụng cho súng bắn tỉa' },
    { id: 'clip_small', name: 'Băng Đạn Tiêu Chuẩn', category: 'Băng đạn', slot: 'magazine', modelFile: 'kenney-blaster/clip-small.glb', icon: 'assets/previews/kenney-blaster/clip-small.png', desc: 'Hộp tiếp đạn tiêu chuẩn nạp đạn nhanh' },
    { id: 'clip_large', name: 'Băng Đạn Trống Mở Rộng', category: 'Băng đạn', slot: 'magazine', modelFile: 'kenney-blaster/clip-large.glb', icon: 'assets/previews/kenney-blaster/clip-large.png', desc: 'Băng đạn cỡ lớn tăng gấp đôi dung lượng đạn' },
    { id: 'grenade_a', name: 'Lựu Đạn Nổ Phân Mảnh', category: 'Vũ khí nổ', slot: 'grenade', modelFile: 'kenney-blaster/grenade-a.glb', icon: 'assets/previews/kenney-blaster/grenade-a.png', desc: 'Lựu đạn gây sát thương nổ diện rộng cực lớn' },
    { id: 'grenade_b', name: 'Lựu Đạn Khói Chiến Thuật', category: 'Vũ khí nổ', slot: 'grenade', modelFile: 'kenney-blaster/grenade-b.glb', icon: 'assets/previews/kenney-blaster/grenade-b.png', desc: 'Tạo màn khói che chắn tầm nhìn của zombie' },
    { id: 'bullet_foam', name: 'Đạn Xốp Tiêu Chuẩn', category: 'Đạn dược', slot: 'ammo', modelFile: 'kenney-blaster/bullet-foam.glb', icon: 'assets/previews/kenney-blaster/bullet-foam.png', desc: 'Đạn xốp cơ bản năng động' },
    { id: 'bullet_foam_thick', name: 'Đạn Xốp Hạng Nặng', category: 'Đạn dược', slot: 'ammo', modelFile: 'kenney-blaster/bullet-foam-thick.glb', icon: 'assets/previews/kenney-blaster/bullet-foam-thick.png', desc: 'Đạn xốp cỡ to tạo lực đẩy lùi mạnh' },
    { id: 'bullet_foam_tip', name: 'Đạn Xốp Xuyên Phá', category: 'Đạn dược', slot: 'ammo', modelFile: 'kenney-blaster/bullet-foam-tip.glb', icon: 'assets/previews/kenney-blaster/bullet-foam-tip.png', desc: 'Đạn có đầu nhọn xuyên giáp kẻ địch' },
    { id: 'bullet_foam_tip_thick', name: 'Đạn Xốp Công Phá Cao', category: 'Đạn dược', slot: 'ammo', modelFile: 'kenney-blaster/bullet-foam-tip-thick.glb', icon: 'assets/previews/kenney-blaster/bullet-foam-tip-thick.png', desc: 'Đạn xốp hạng nặng tối thượng gây sát thương chí mạng' },
    { id: 'crate_small', name: 'Thùng Vật Tư Nhỏ', category: 'Hòm đồ', slot: 'crate', modelFile: 'kenney-blaster/crate-small.glb', icon: 'assets/previews/kenney-blaster/crate-small.png', desc: 'Hòm tiếp tế đạn và cứu thương' },
    { id: 'crate_medium', name: 'Hòm Vũ Khí Quân Sự', category: 'Hòm đồ', slot: 'crate', modelFile: 'kenney-blaster/crate-medium.glb', icon: 'assets/previews/kenney-blaster/crate-medium.png', desc: 'Hòm chứa súng và phụ kiện cấp cao' },
    { id: 'crate_wide', name: 'Hòm Tiếp Tế Airdrop', category: 'Hòm đồ', slot: 'crate', modelFile: 'kenney-blaster/crate-wide.glb', icon: 'assets/previews/kenney-blaster/crate-wide.png', desc: 'Hòm thính chứa súng Huyền thoại và nòng cấp 5' }
];

export function getStartingWeapon(id) {
    if (!id) return WEAPON_CONFIGS[0];
    const match = WEAPON_CONFIGS.find(weapon => weapon.id === id || weapon.aliases?.includes(id));
    if (match) return match;
    const bombMatch = BOMB_CONFIGS.find(b => b.id === id || b.aliases?.includes(id));
    if (bombMatch) return bombMatch;
    const medMatch = MEDICAL_CONFIGS.find(m => m.id === id || m.aliases?.includes(id));
    if (medMatch) return medMatch;
    return WEAPON_CONFIGS[0];
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
const _stylooCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

export function updateHeldWeaponPose(mesh, hand, character) {
    if (!mesh?.userData.gripOffset || !hand || !character) return;
    hand.updateWorldMatrix(true, false);
    hand.getWorldQuaternion(_heldParentRotation);
    character.getWorldQuaternion(_heldFacing);
    if (mesh.userData.isStyloo) {
        _heldFacing.multiply(_stylooCorrection);
    } else if (mesh.userData.barrelForward === -1) {
        _heldFacing.multiply(_barrelCorrection);
    }
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
            medkits: 3,
            bandage: 5,
            first_aid: 2,
            medkit_military: 1,
            energy_drink: 2
        };
        this.activeZones = [];
        this.isUsingMedkit = false;
        this.medkitTimer = 0;
        this.medkitTotalTime = 5.0;
        this.medkitPlayerRef = null;
        this.currentMedicalItem = null;
        this.currentMedicalInvKey = 'medkits';
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
        this.thrownBombs = [];

        // Cấu hình phụ kiện mod vũ khí (Attachments Ecosystem)
        this.attachments = {
            muzzle: null,    // Đầu nòng (Compensator, Silencer, Flash Hider)
            optic: null,     // Kính ngắm (Red Dot, Scope x2, Scope x4, Scope x6, Scope x8)
            magazine: null,  // Băng đạn (Extended Mag, Quick-draw Mag)
            grip: null,      // Tay cầm (Tactical Grip)
            stock: null      // Báng súng (Heavy Stock, Tactical Stock)
        };

        // Kho hình học đạn phong phú theo từng dòng súng (kích thước cân đối, thanh thoát, dễ quan sát)
        this.bulletGeometries = {
            pistol: (() => {
                const geo = new THREE.CylinderGeometry(0.048, 0.048, 0.45, 6);
                geo.rotateX(Math.PI / 2);
                return geo;
            })(),
            rifle: (() => {
                const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6);
                geo.rotateX(Math.PI / 2);
                return geo;
            })(),
            shotgun: new THREE.SphereGeometry(0.08, 8, 8),
            sniper: (() => {
                const geo = new THREE.CylinderGeometry(0.07, 0.07, 1.25, 6);
                geo.rotateX(Math.PI / 2);
                return geo;
            })(),
            minigun: (() => {
                const geo = new THREE.CylinderGeometry(0.052, 0.052, 0.55, 6);
                geo.rotateX(Math.PI / 2);
                return geo;
            })(),
            explosive: new THREE.SphereGeometry(0.16, 10, 10),
            plasma: new THREE.IcosahedronGeometry(0.13, 1),
            default: (() => {
                const geo = new THREE.CylinderGeometry(0.058, 0.058, 0.65, 6);
                geo.rotateX(Math.PI / 2);
                return geo;
            })()
        };
        this.bulletGeo = this.bulletGeometries.rifle;
        this.acidGeo = new THREE.IcosahedronGeometry(0.25, 1);

        // Pool đạn được phân theo từng loại đạn để tái sử dụng tối ưu
        this.bulletMeshPools = {
            pistol: [],
            rifle: [],
            shotgun: [],
            sniper: [],
            minigun: [],
            explosive: [],
            plasma: [],
            default: []
        };
        this.enemyMeshPool = [];
    }

    getBulletMesh(color, bulletType = 'rifle') {
        const pool = this.bulletMeshPools[bulletType] || this.bulletMeshPools.default;
        let entry = pool.pop();
        if (!entry) {
            const geo = this.bulletGeometries[bulletType] || this.bulletGeometries.default;
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);
            entry = { mesh, material: mat, bulletType };
        } else {
            entry.material.color.setHex(color);
        }
        this.scene.add(entry.mesh);
        return entry;
    }

    recycleBulletMesh(entry) {
        if (!entry || !entry.mesh) return;
        this.scene.remove(entry.mesh);
        const pool = this.bulletMeshPools[entry.bulletType] || this.bulletMeshPools.default;
        if (pool.length < 60) {
            pool.push(entry);
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
            ...ALL_KENNEY_ACCESSORIES.map(a => a.modelFile),
            ...BOMB_CONFIGS.map(b => b.modelFile),
            KNIFE_CONFIG.modelFile
        ].filter(Boolean);
        await Promise.all([...new Set(allModels)].map(loadModel));

        this.resetRun();
    }

    resetRun(weaponId = this.startingWeaponId, secondaryId = null, bomb1Id = null, bomb2Id = null) {
        const starter = getStartingWeapon(weaponId);
        this.startingWeaponId = starter.id;
        this.clear();

        // 5 ô trang bị: [0] Súng chính, [1] Súng phụ (Lục), [2] Bom 1, [3] Bom 2, [4] Dao cận chiến
        const secCfg = secondaryId ? getStartingWeapon(secondaryId) : getStartingWeapon('blaster_b');
        this.secondaryWeapon = { ...secCfg, tier: secCfg.tier || 1, instanceId: THREE.MathUtils.generateUUID() };

        const b1Cfg = getBombConfig(bomb1Id || 'grenade_a');
        const b2Cfg = getBombConfig(bomb2Id || 'grenade_b');
        this.bombSlot1 = { ...b1Cfg, count: 2 };
        this.bombSlot2 = { ...b2Cfg, count: 2 };

        this.weaponSlots = [
            { ...starter, instanceId: THREE.MathUtils.generateUUID() }, // 0: Súng chính
            this.secondaryWeapon,  // 1: Súng phụ
            this.bombSlot1,        // 2: Ô Bom 1
            this.bombSlot2,        // 3: Ô Bom 2
            KNIFE_CONFIG           // 4: Dao găm
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
        // Keep the shared room array: remote weapon systems reference it too.
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
                baseRange: w?.range || (w?.isKnife ? 1.1 : 0),
                maxRange: w?.range || (w?.isKnife ? 1.1 : 0),
                rangeBonusPct: 0,
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
        let rangeBonusPct = 0;
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
                rangeBonusPct += (def.rangeBonusPct || 0);
            } else if (def.slot === 'magazine') {
                magBonusPct += (def.magBonusPct || 0);
                reloadSpeedBonus += (def.reloadSpeedBonus || 0);
            } else if (def.slot === 'optic') {
                extraCritChance += (def.critChance || 0);
                extraCritDmgMod += (def.critDmgMod || 0);
                adsZoom = Math.max(adsZoom, def.adsZoom || 1.25);
                if (def.rangeBonusPct) rangeBonusPct += def.rangeBonusPct;
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

        // Tính toán tầm bắn hiệu dụng theo súng và các phụ kiện chuyên biệt
        const baseRange = w.range || 45;
        const maxRange = Math.round(baseRange * (1 + rangeBonusPct));

        return {
            damage,
            magSize,
            reloadTime,
            baseRange,
            maxRange,
            rangeBonusPct,
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
            hasLegendary,
            weaponTier
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
        if (this.onCommand) { this.onCommand({type: 'overclock'}); return true; }
        if (this.overclockCooldown > 0) return false;
        this.overclockTimer = this.overclockDuration;
        this.overclockCooldown = this.overclockMaxCooldown;
        sounds.play('switchWeapon', { volume: 0.95, rate: 2.1 });
        return true;
    }

    // Bơm máu nhanh cấp cứu (Quick Heal)
    th_quickHeal(player) {
        if (this.onCommand) { this.onCommand({type: 'quick_heal'}); return true; }
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

    // Vứt khẩu súng đang cầm ra đất (phím [G]), nhường chỗ cho Dao hoặc súng phụ
    dropCurrentWeapon(player, lootingSystem) {
        if (!player || player.isDead || player.isDowned) return false;
        const currentGun = this.weaponSlots[this.currentSlotIndex];
        if (!currentGun || currentGun.isKnife) {
            window.game?.ui?.showPickupAlert('KHÔNG THỂ VỨT DAO CẬN CHIẾN!');
            return false;
        }

        const slotIndex = this.currentSlotIndex; // 0 hoặc 1
        if (slotIndex !== 0 && slotIndex !== 1) return false;

        if (this.onCommand) {
            this.onCommand({ type: 'drop_weapon', slot: slotIndex, instanceId: currentGun.instanceId });
            return true;
        }

        // Lưu giữ nguyên vẹn Tier và toàn bộ phụ kiện kèm theo súng
        const attachMap = { ...this.getAttachmentsForGun(slotIndex) };
        const droppedGunData = {
            instanceId: currentGun.instanceId,
            id: currentGun.id,
            name: currentGun.name,
            tier: currentGun.tier || 1,
            color: currentGun.color,
            modelFile: currentGun.modelFile,
            icon: currentGun.icon,
            category: currentGun.category,
            attachments: attachMap
        };

        // Dọn dẹp phụ kiện của slot súng này
        const targetAttachMap = this.getAttachmentsForGun(slotIndex);
        targetAttachMap.barrel = null;
        targetAttachMap.magazine = null;
        targetAttachMap.optic = null;
        targetAttachMap.grip = null;

        // Sinh thực thể súng rơi ngoài đất
        const entity = lootingSystem?.spawnDroppedWeapon(player.position.clone(), droppedGunData);
        if (!entity) return false;

        // Xử lý slot súng
        this.weaponSlots[slotIndex] = null;
        if (slotIndex === 1) this.secondaryWeapon = null;

        const otherSlot = slotIndex === 0 ? 1 : 0;
        const hasOtherGun = !!this.weaponSlots[otherSlot];

        if (hasOtherGun) {
            // Tự động chuyển sang khẩu súng còn lại
            this.switchWeapon(otherSlot, player);
        } else {
            // Nếu không còn súng nào, tự động rút Dao cận chiến (slot 4)
            this.switchWeapon(4, player);
        }

        sounds.play('switchWeapon', { volume: 0.9, rate: 0.9 });
        window.game?.ui?.showPickupAlert(`ĐÃ VỨT [${droppedGunData.name.toUpperCase()}] RA ĐẤT!`);
        window.game?.ui?.updateTacticalDock?.(this, player);
        return true;
    }

    getNetworkState() {
        return {
            gun: this.weaponSlots[0]?.id || null,
            guns: this.weaponSlots.slice(0, 2).map(w => w ? ({ id: w.id, tier: w.tier, instanceId: w.instanceId, color: w.color }) : null),
            bombs: this.weaponSlots.slice(2, 4).map(w => w ? ({ id: w.id, count: w.count }) : null),
            primaryAttachments: { ...this.primaryAttachments },
            secondaryAttachments: { ...this.secondaryAttachments },
            slot: this.currentSlotIndex,
            ammo: { ...this.ammo },
            // PeerJS BinaryPack rejects Infinity. Use -1 only on the wire for unlimited ammo.
            reserve: Object.fromEntries(Object.entries(this.reserve).map(([id, count]) => [id, count === Infinity ? -1 : count])),
            upgrades: { ...this.upgrades },
            attachments: { ...this.attachments },
            isUsingMedkit: this.isUsingMedkit,
            overclockTimer: this.overclockTimer,
            overclockCooldown: this.overclockCooldown,
            medkitTimer: this.medkitTimer,
            medkitTotalTime: this.medkitTotalTime,
            isReloading: this.isReloading,
            reloadTimer: this.reloadTimer,
            currentSpreadDeg: this.currentSpreadDeg,
            inventory: { ...this.inventory }
        };
    }

    applyNetworkState(state) {
        if (!state) return;
        this.overclockTimer = state.overclockTimer || 0;
        this.overclockCooldown = state.overclockCooldown || 0;
        const previousId = this.getCurrentWeapon()?.id;
        const configs = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS];
        const guns = state.guns || [{ id: state.gun }, null];
        for (let index = 0; index < 2; index++) {
            const entry = guns[index];
            const config = entry && configs.find(w => w.id === entry.id);
            this.weaponSlots[index] = config ? { ...config, ...entry } : null;
        }
        if (state.bombs) {
            for (let index = 0; index < 2; index++) {
                const entry = state.bombs[index];
                const config = entry && getBombConfig(entry.id);
                this.weaponSlots[index + 2] = config ? { ...config, count: entry.count } : null;
            }
            this.bombSlot1 = this.weaponSlots[2];
            this.bombSlot2 = this.weaponSlots[3];
        }
        this.weaponSlots[4] = KNIFE_CONFIG;
        this.secondaryWeapon = this.weaponSlots[1];
        this.currentSlotIndex = Math.min(4, Math.max(0, state.slot || 0));
        if (!this.weaponSlots[this.currentSlotIndex]) this.currentSlotIndex = 4;
        if (state.primaryAttachments) this.primaryAttachments = { ...state.primaryAttachments };
        if (state.secondaryAttachments) this.secondaryAttachments = { ...state.secondaryAttachments };
        this.ammo = { ...state.ammo };
        this.reserve = Object.fromEntries(Object.entries(state.reserve || {}).map(([id, count]) => [id, count === -1 ? Infinity : count]));
        if (state.inventory) this.inventory = { ...state.inventory };
        this.attachments = this.currentSlotIndex === 1 ? this.secondaryAttachments : this.primaryAttachments;
        this.upgrades = { ...state.upgrades };
        this.isUsingMedkit = !!state.isUsingMedkit;
        this.medkitTimer = state.medkitTimer || 0;
        this.medkitTotalTime = state.medkitTotalTime || 0;
        this.isReloading = !!state.isReloading;
        this.reloadTimer = state.reloadTimer || 0;
        if (previousId !== this.getCurrentWeapon()?.id && this.handNode) this.attachToArm(this.handNode);
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
        const reserve = this.reserve[previous?.id] || 0;
        delete this.ammo[previous?.id];
        delete this.reserve[previous?.id];
        this.weaponSlots[targetSlot] = { ...weapon, instanceId: THREE.MathUtils.generateUUID() };
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
        return this.weaponSlots[this.currentSlotIndex]
            || this.weaponSlots[0]
            || this.weaponSlots[1]
            || this.weaponSlots[4]
            || KNIFE_CONFIG;
    }

    getCurrentAmmo() {
        const w = this.getCurrentWeapon();
        if (!w) {
            return { current: 0, max: 0, reserve: 0, isKnife: false, isReloading: false, reloadProgress: 1 };
        }
        if (w.isKnife) {
            return { current: '∞', max: '∞', reserve: '∞', isKnife: true, isReloading: false, reloadProgress: 1 };
        }
        if (w.isBomb) {
            return { current: w.count ?? 0, max: 2, reserve: 0, isBomb: true, isReloading: false, reloadProgress: 1 };
        }
        if (w.isUtility) {
            return { current: this.inventory.medkits, max: this.inventory.medkits, reserve: 0, isUtility: true, isReloading: false, reloadProgress: 1 };
        }
        const effective = this.getModifiedStats(w);
        return {
            current: this.ammo[w.id] ?? 0,
            max: effective?.magSize || 20,
            reserve: this.reserve[w.id] ?? 0,
            isReloading: this.isReloading,
            reloadProgress: this.isReloading ? (1 - this.reloadTimer / (effective?.reloadTime || 1.5)) : 1
        };
    }

    switchWeapon(index, player = null) {
        if (index < 0 || index >= this.weaponSlots.length) return;

        // Bất kỳ hành động đổi vũ khí nào cũng sẽ hủy tiến trình sơ cứu dở dang
        if (this.isUsingMedkit) {
            this.cancelMedkitUse();
        }

        if (index === this.currentSlotIndex) return;

        if (this.onCommand) this.onCommand({ type: 'switch', slot: index });
        this.currentSlotIndex = index;
        sounds.stopContinuousFire?.();
        this.cancelReload();
        this.fireCooldown = 0.18;
        sounds.play('switchWeapon', { volume: 0.7 });

        // Cập nhật mô hình vũ khí hiển thị trên tay nhân vật
        this.updateEquippedMesh();

        // Tự động nạp đạn nếu chuyển sang vũ khí đang hết đạn trong băng
        const nextW = this.getCurrentWeapon();
        if (nextW && !nextW.isKnife && !nextW.isBomb && !nextW.isUtility && (this.ammo[nextW.id] || 0) <= 0 && (this.reserve[nextW.id] || 0) > 0) {
            this.reload();
        }
    }

    // Lấy thông tin đạn và trạng thái theo từng ô vũ khí cho giao diện HUD
    getSlotAmmo(index) {
        const w = this.weaponSlots[index];
        if (!w) return null;
        if (w.isKnife) {
            return { current: '∞', max: '∞', reserve: '∞', isKnife: true, name: w.name, icon: w.icon };
        }
        if (w.isBomb) {
            return { current: w.count ?? 0, max: 2, reserve: 0, isBomb: true, name: w.name, icon: w.icon, tier: w.tier || 2 };
        }
        const effective = this.getModifiedStats(w);
        return {
            current: this.ammo[w.id] ?? 0,
            max: effective.magSize,
            reserve: this.reserve[w.id] ?? 0,
            name: w.name,
            icon: w.icon,
            isAuto: !!w.isAuto,
            tier: w.tier || 1
        };
    }

    // Cơ chế Channeling sơ cứu vết thương hoặc uống nước tăng lực
    startMedkitUse(player, itemType = null) {
        if (!player || player.isDead || player.isDowned) return false;
        if (this.onCommand) { this.onCommand({ type: 'medkit', itemType }); return true; }
        if (this.isUsingMedkit) return false;

        // Tự động chọn loại vật phẩm phù hợp nhất nếu không chỉ định
        if (!itemType) {
            if ((this.inventory.medkit_military || 0) > 0 && player.health < 40) itemType = 'medkit_military';
            else if ((this.inventory.first_aid || this.inventory.medkits || 0) > 0 && player.health < 75) itemType = 'first_aid_kit';
            else if ((this.inventory.bandage || 0) > 0 && player.health < 75) itemType = 'bandage_field';
            else if ((this.inventory.energy_drink || 0) > 0 && player.shield < player.maxShield) itemType = 'energy_drink';
            else if ((this.inventory.medkit_military || 0) > 0 && player.health < player.maxHealth) itemType = 'medkit_military';
            else if ((this.inventory.first_aid || this.inventory.medkits || 0) > 0) itemType = 'first_aid_kit';
            else if ((this.inventory.bandage || 0) > 0) itemType = 'bandage_field';
            else if ((this.inventory.energy_drink || 0) > 0) itemType = 'energy_drink';
            else return false;
        }

        const medCfg = MEDICAL_CONFIGS.find(m => m.id === itemType) || MEDICAL_CONFIGS[1];
        const invKey = itemType === 'first_aid_kit' ? (this.inventory.first_aid !== undefined ? 'first_aid' : 'medkits')
            : itemType === 'bandage_field' ? 'bandage'
                : itemType;

        if ((this.inventory[invKey] || 0) <= 0 && (this.inventory.medkits || 0) <= 0) return false;

        // Kiểm tra điều kiện máu/khiên
        if (medCfg.healAmount && player.health >= (medCfg.maxHealthCap || player.maxHealth)) return false;

        this.currentMedicalItem = medCfg;
        this.currentMedicalInvKey = invKey;
        this.isUsingMedkit = true;
        this.medkitTotalTime = medCfg.useTime || 4.0;
        this.medkitTimer = this.medkitTotalTime;
        this.medkitPlayerRef = player;
        sounds.playMedkit();
        return true;
    }

    cancelMedkitUse() {
        if (this.onCommand && this.isUsingMedkit) this.onCommand({ type: 'cancel_medkit' });
        if (this.isUsingMedkit) {
            this.isUsingMedkit = false;
            this.medkitTimer = 0;
            this.medkitPlayerRef = null;
            this.currentMedicalItem = null;
        }
    }

    // Lấy danh sách các ô vũ khí có trang bị hợp lệ để con lăn chuột duyệt qua
    getAvailableSlots() {
        const slots = [];
        for (let i = 0; i < this.weaponSlots.length; i++) {
            const w = this.weaponSlots[i];
            if (w && (!w.isBomb || (w.count && w.count > 0))) {
                slots.push(i);
            }
        }
        return slots.length > 0 ? slots : [0];
    }

    nextWeapon(player = null) {
        const available = this.getAvailableSlots();
        const curPos = available.indexOf(this.currentSlotIndex);
        const nextIndex = curPos >= 0 ? available[(curPos + 1) % available.length] : available[0];
        this.switchWeapon(nextIndex, player);
    }

    prevWeapon(player = null) {
        const available = this.getAvailableSlots();
        const curPos = available.indexOf(this.currentSlotIndex);
        const prevIndex = curPos >= 0 ? available[(curPos - 1 + available.length) % available.length] : available[available.length - 1];
        this.switchWeapon(prevIndex, player);
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
            if (w.isBomb) {
                const base = this.models[w.modelFile];
                if (!base) return;
                const mesh = base.clone(true);
                mesh.userData.ownsMaterials = true;
                mesh.traverse(child => {
                    if (!child.isMesh) return;
                    if (Array.isArray(child.material)) child.material = child.material.map(m => m.clone());
                    else if (child.material) child.material = child.material.clone();
                });
                const scale = 0.65;
                mesh.scale.setScalar(scale);
                mesh.userData.isBomb = true;
                mesh.position.set(-0.24, -0.05, 0.05);
                mesh.rotation.set(0, 0, 0);
                mesh.visible = false;
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

                // Giữ nguyên toàn bộ màu sắc, vật liệu và chi tiết texture gốc của mô hình asset
            });
            // Chuẩn hóa tỷ lệ kích thước vật lý chính xác theo từng model
            const bounds = new THREE.Box3().setFromObject(mesh);
            const size = new THREE.Vector3();
            bounds.getSize(size);

            handNode.updateWorldMatrix(true, false);
            const armScaleZ = handNode.getWorldScale(new THREE.Vector3()).z || 1.0;
            const armScaleX = handNode.getWorldScale(new THREE.Vector3()).x || 1.0;

            const targetLength = w.targetLength || (w.modelFile.includes('blaster-a') ? 0.95 : 1.15);

            // Kiểm tra xem handNode có phải là nhân vật Kenney Blocky v2 (cánh tay kéo dài theo trục Y)
            if (handNode.geometry && !handNode.geometry.boundingBox) {
                handNode.geometry.computeBoundingBox();
            }
            const isV2Blocky = handNode.geometry && (handNode.geometry.boundingBox?.min.y < -0.5);
            const defaultHandOffset = isV2Blocky ? new THREE.Vector3(-0.20, -0.72, 0.02) : new THREE.Vector3(-0.24, -0.05, 0.02);

            if (w.isStyloo) {
                // Súng Styloo: nòng chạy dọc trục X (+X là đầu nòng súng)
                const scale = (targetLength / Math.max(0.01, size.x)) / armScaleX;
                mesh.scale.setScalar(scale);
                mesh.userData.isStyloo = true;
                mesh.userData.gripOffset = new THREE.Vector3(0, 0.08, 0).multiplyScalar(scale);
                mesh.userData.handOffset = defaultHandOffset.clone();
                mesh.rotation.set(0, -Math.PI / 2 - Math.PI / 3, 0);
                mesh.position.copy(mesh.userData.gripOffset).applyQuaternion(mesh.quaternion).add(mesh.userData.handOffset);
                const muzzle = new THREE.Object3D();
                muzzle.name = 'weapon-muzzle';
                muzzle.position.set(bounds.max.x + 0.05, 0.03, 0);
                mesh.add(muzzle);
            } else {
                // Súng Kenney Blaster: nòng chạy dọc trục Z (-Z là đầu nòng súng)
                const scale = (targetLength / Math.max(0.01, bounds.max.z - bounds.min.z)) / armScaleZ;
                mesh.scale.setScalar(scale);
                mesh.userData.barrelForward = -1;
                mesh.userData.gripOffset = new THREE.Vector3(0, 0.14, -0.18).multiplyScalar(scale);
                mesh.userData.handOffset = w.offset ? w.offset.clone() : defaultHandOffset.clone();
                mesh.rotation.set(0, -Math.PI / 3, 0);
                mesh.position.copy(mesh.userData.gripOffset).applyQuaternion(mesh.quaternion).add(mesh.userData.handOffset);
                const muzzle = new THREE.Object3D();
                muzzle.name = 'weapon-muzzle';
                muzzle.position.set(0, 0.04, bounds.min.z - 0.025);
                mesh.add(muzzle);
            }
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
        if (this.handNode?.geometry && !this.handNode.geometry.boundingBox) {
            this.handNode.geometry.computeBoundingBox();
        }
        const isV2Blocky = this.handNode?.geometry && (this.handNode.geometry.boundingBox?.min.y < -0.5);
        group.userData.handOffset = isV2Blocky ? new THREE.Vector3(-0.20, -0.72, 0.02) : new THREE.Vector3(-0.24, -0.05, 0.02);
        group.position.copy(group.userData.handOffset);
        return group;
    }
    updateEquippedMesh() {
        const cur = this.getCurrentWeapon();
        const currentId = cur?.id;
        for (const [id, mesh] of Object.entries(this.weaponMeshes || {})) {
            mesh.visible = (currentId ? id === currentId : false);
        }
    }

    updateHeldPose(character) {
        const cur = this.getCurrentWeapon();
        if (!cur) return;
        const mesh = this.weaponMeshes?.[cur.id];
        if (mesh) {
            const effective = this.getModifiedStats(cur);
            mesh.userData.reloadProgress = this.isReloading ? (1 - this.reloadTimer / (effective?.reloadTime || 1.5)) : 1.0;
        }
        updateHeldWeaponPose(mesh, this.handNode, character);
    }

    getMuzzlePosition(target = new THREE.Vector3()) {
        const cur = this.getCurrentWeapon();
        if (!cur) return null;
        const muzzle = this.weaponMeshes?.[cur.id]?.getObjectByName('weapon-muzzle');
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
            this.onCommand({
                type: 'shoot',
                origin: origin.toArray(),
                target: targetPoint.toArray(),
                ads: !!isADS,
                weaponId: current.id
            });
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
                ownerId: 'player', owner: playerRef
            });
            return true;
        }

        const effective = this.getModifiedStats(w);

        const isBulletFrenzy = playerRef?.bulletFrenzyTimer > 0;

        // Kiểm tra hết băng đạn -> Tự động nạp đạn (trừ khi đang cuồng xả đạn vô hạn)
        if (!isBulletFrenzy && this.ammo[w.id] <= 0) {
            sounds.stopContinuousFire?.();
            this.reload();
            return false;
        }

        if (this.fireCooldown > 0) return false;

        if (!isBulletFrenzy) {
            this.ammo[w.id]--;
        }

        // Xử lý chế độ Bắn Tăng Cường (Overclock / Bullet Frenzy): Tốc độ xả đạn cực nhanh, độ giật triệt tiêu
        const isOverclockActive = this.overclockTimer > 0 || isBulletFrenzy;
        const speedFactor = isBulletFrenzy ? 0.40 : (isOverclockActive ? 0.55 : 1.0);
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

        // Phụt tia lửa nòng (Chỉ chạy khi bật hiệu ứng để tránh lag)
        const bulletColor = isOverclockActive ? 0xffdd00 : (effective.hasLegendary ? 0xf59e0b : w.color);
        const bulletType = getBulletType(w);
        if (this.particles?.muzzleFlashEnabled) {
            this.particles.createMuzzleFlash(origin, new THREE.Vector3().subVectors(targetPoint, origin).normalize(), bulletColor);
        }
        this.onShotFired?.({ origin, target: targetPoint, ads: isADS, weapon: w, color: bulletColor, bulletType });

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

            // Lấy mesh từ pool linh hoạt theo loại đạn
            const entry = this.getBulletMesh(bulletColor, bulletType);
            entry.mesh.position.copy(origin);
            entry.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tempAimDir);

            // penPower là chỉ số xuyên thủng giáp (Armor Penetration) của quái vật, không phải số mục tiêu xuyên cơ thể.
            // Chỉ những vũ khí có thuộc tính pierceCount riêng hoặc đạt cấp 5 Huyền Thoại (Tier 5) mới xuyên người.
            const basePierce = w.pierceCount || (effective.hasLegendary ? 3 : 1);
            const pierceCount = Math.max(1, basePierce);
            const charExtraPen = playerRef?.penetrationBonus || 0;
            const charCritBonus = playerRef?.critChanceBonus || 0;
            const isGuaranteedCrit = playerRef?.activeSkillEffect === 'guaranteed_crit';
            const finalCritChance = isGuaranteedCrit ? 1.0 : Math.min(1.0, 0.12 + (effective.extraCritChance || 0) + charCritBonus);

            this.projectiles.push({
                meshEntry: entry,
                mesh: entry.mesh,
                bulletType: bulletType,
                id: this.nextProjectileId++,
                origin: origin.clone(),
                direction: _tempAimDir.clone(),
                speed: w.bulletSpeed * (isOverclockActive ? 1.25 : 1.0),
                damage: effective.damage * damageMultiplier * (isPlayer ? this.damageBoost : 1),
                baseDamage: effective.damage * damageMultiplier * (isPlayer ? this.damageBoost : 1),
                maxRange: effective.maxRange,
                distanceTraveled: 0,
                penPower: (effective.hasLegendary ? Math.max(3, w.penPower) : w.penPower) + charExtraPen,
                critMultiplier: (w.critMultiplier || 2.0) + (effective.extraCritDmgMod || 0),
                critChance: finalCritChance,
                hasLegendary: !!effective.hasLegendary,
                pierceCount: pierceCount,
                hitEnemies: new Set(),
                color: bulletColor,
                life: 2.0,
                isPlayer: true,
                ownerId: 'player', owner: playerRef,
                isKnife: false,
                isExplosive: !!w.isExplosive,
                splashRadius: w.splashRadius || 4.8
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
        if (this.particles?.muzzleFlashEnabled) {
            this.particles.createMuzzleFlash(origin, _tempAimDir, color);
        }
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

    throwBomb(origin, targetPoint, playerRef, enemies = []) {
        const w = this.getCurrentWeapon();
        if (!w || !w.isBomb) return false;
        if ((w.count || 0) <= 0) return false;

        if (this.onCommand) {
            this.onCommand({type: 'throw_bomb', origin: origin.toArray(), target: targetPoint.toArray(), weaponId: w.id});
            return true;
        }

        w.count--;
        sounds.play('switchWeapon', { volume: 0.8, rate: 1.5 });

        if (this.onBombThrown) {
            this.onBombThrown({
                origin,
                target: targetPoint,
                weapon: w,
                weaponId: w.id,
                throwerId: playerRef?.id || 'host'
            });
        }

        // Tạo quả bom 3D bay trong scene
        const base = this.models[w.modelFile];
        let mesh = null;
        if (base) {
            mesh = base.clone(true);
            mesh.scale.setScalar(0.75);
            mesh.position.copy(origin);
            this.scene.add(mesh);
        }

        const startPos = origin.clone();
        const endPos = targetPoint.clone();
        endPos.y = 0.1; // Chạm sát mặt đất

        const duration = w.fuseTime || 0.65;
        this.thrownBombs.push({
            mesh,
            startPos,
            endPos,
            time: 0,
            duration,
            bombConfig: { ...w },
            playerRef
        });

        // Tự động kiểm tra: nếu hết quả bom này, chuyển về súng chính
        if (w.count <= 0) {
            setTimeout(() => {
                if (this.getCurrentWeapon()?.id === w.id) {
                    this.switchWeapon(0, playerRef);
                }
            }, 300);
        }

        return true;
    }

    // Hiển thị bom ném thị giác cho đồng đội trong Multiplayer mà không trừ kho đồ
    spawnVisualBomb(origin, targetPoint, bombConfig, playerRef = null) {
        if (!bombConfig) return;
        const base = this.models[bombConfig.modelFile];
        let mesh = null;
        if (base) {
            mesh = base.clone(true);
            mesh.scale.setScalar(0.75);
            mesh.position.copy(origin);
            this.scene.add(mesh);
        }

        const startPos = origin.clone();
        const endPos = targetPoint.clone();
        endPos.y = 0.1;

        const duration = bombConfig.fuseTime || 0.65;
        this.thrownBombs.push({
            mesh,
            startPos,
            endPos,
            time: 0,
            duration,
            bombConfig: { ...bombConfig },
            playerRef
        });
        sounds.play('switchWeapon', { volume: 0.8, rate: 1.5 });
    }

    // Tạo cụm khói 3D chiến thuật bồng bềnh
    createSmokeZone(blastPos, radius = 5.5, duration = 10.0) {
        const smokeGroup = new THREE.Group();
        smokeGroup.position.copy(blastPos);

        // Vòng tròn mờ báo hiệu phạm vi trên sàn
        const groundRingGeo = new THREE.RingGeometry(radius * 0.94, radius, 32);
        groundRingGeo.rotateX(-Math.PI / 2);
        const groundRingMat = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
        });
        const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
        groundRing.position.y = 0.04;
        smokeGroup.add(groundRing);

        // Cụm các khối mây khói mềm bồng bềnh
        const puffs = [];
        const puffGeo = new THREE.SphereGeometry(1, 14, 14);
        const puffCount = 6;
        for (let p = 0; p < puffCount; p++) {
            const angle = (p / puffCount) * Math.PI * 2;
            const dist = (p === 0) ? 0 : radius * 0.42;
            const puffMat = new THREE.MeshBasicMaterial({
                color: (p % 2 === 0) ? 0x94a3b8 : 0xb0bec5,
                transparent: true,
                opacity: 0.45,
                depthWrite: false
            });
            const puffMesh = new THREE.Mesh(puffGeo, puffMat);
            puffMesh.position.set(
                Math.cos(angle) * dist,
                0.7 + (p % 3) * 0.4,
                Math.sin(angle) * dist
            );
            puffMesh.scale.setScalar(radius * (0.65 + (p % 2) * 0.2));
            smokeGroup.add(puffMesh);
            puffs.push({
                mesh: puffMesh,
                mat: puffMat,
                baseScale: puffMesh.scale.x,
                rotSpeed: 0.15 + p * 0.05
            });
        }

        this.scene.add(smokeGroup);

        this.activeZones.push({
            type: 'smoke',
            pos: blastPos.clone(),
            radius: radius,
            life: duration,
            maxLife: duration,
            group: smokeGroup,
            puffs: puffs,
            groundRing: groundRing
        });
    }

    createFireZone(blastPos, radius, bCfg = {}) {
        const fireGroup = new THREE.Group();
        fireGroup.position.copy(blastPos);

        // Nhóm mặt đất (Ground Group) để co dãn hiệu ứng lan tỏa (Spread Expansion)
        const groundGroup = new THREE.Group();
        groundGroup.position.set(0, 0.02, 0);
        groundGroup.scale.set(0.2, 1, 0.2); // Ban đầu nhỏ, lan rộng trong 0.65s

        // Lớp 1: Decal mặt đất cháy xém CSGO (scorch_01 rách mép loang lổ)
        const scorchGeo = new THREE.PlaneGeometry(radius * 2.3, radius * 2.3);
        scorchGeo.rotateX(-Math.PI / 2);
        const scorchMat = new THREE.MeshBasicMaterial({
            map: getMolotovTexture('scorch_01'),
            transparent: true,
            opacity: 0.92,
            depthWrite: false
        });
        const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
        scorchMesh.rotation.y = Math.random() * Math.PI * 2;
        groundGroup.add(scorchMesh);

        // Lớp 2: Vết cháy phụ (scorch_02) tạo hình dạng vũng loang lổ hữu cơ
        const scorch2Geo = new THREE.PlaneGeometry(radius * 1.8, radius * 1.8);
        scorch2Geo.rotateX(-Math.PI / 2);
        const scorch2Mat = new THREE.MeshBasicMaterial({
            map: getMolotovTexture('scorch_02'),
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });
        const scorch2Mesh = new THREE.Mesh(scorch2Geo, scorch2Mat);
        scorch2Mesh.position.set(radius * 0.25, 0.002, -radius * 0.2);
        scorch2Mesh.rotation.y = Math.random() * Math.PI * 2;
        groundGroup.add(scorch2Mesh);

        // Lớp 3: Vùng than hồng bốc cháy Additive Blending rực rỡ (fire_01)
        const emberGeo = new THREE.PlaneGeometry(radius * 1.9, radius * 1.9);
        emberGeo.rotateX(-Math.PI / 2);
        const emberMat = new THREE.MeshBasicMaterial({
            map: getMolotovTexture('fire_01'),
            color: 0xff3a00,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const emberMesh = new THREE.Mesh(emberGeo, emberMat);
        emberMesh.position.y = 0.004;
        groundGroup.add(emberMesh);

        // Lớp 4: Lõi nhiệt vàng rực cháy sáng (fire_02)
        const coreGeo = new THREE.PlaneGeometry(radius * 1.25, radius * 1.25);
        coreGeo.rotateX(-Math.PI / 2);
        const coreMat = new THREE.MeshBasicMaterial({
            map: getMolotovTexture('fire_02'),
            color: 0xffaa22,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.y = 0.007;
        groundGroup.add(coreMesh);

        fireGroup.add(groundGroup);

        // Lớp 5: Các cụm ngọn lửa 3D đa hướng (Cross-Quad Flame Billboards) rực cháy
        const flames = [];
        const totalFlames = 22;
        for (let f = 0; f < totalFlames; f++) {
            let dist, baseH, baseW, col, texName;
            if (f === 0) {
                // Ngọn lửa mẹ ở trung tâm (cao, rộng, vàng sáng chói)
                dist = 0;
                baseH = 2.4;
                baseW = 1.45;
                col = 0xffe066;
                texName = 'flame_01';
            } else if (f <= 6) {
                // Cụm tầng gần trung tâm (vàng cam rực rỡ)
                dist = radius * (0.22 + Math.random() * 0.22);
                baseH = 1.6 + Math.random() * 0.45;
                baseW = 0.95 + Math.random() * 0.25;
                col = Math.random() < 0.5 ? 0xffbb33 : 0xff8811;
                texName = Math.random() < 0.5 ? 'flame_02' : 'flame_03';
            } else if (f <= 14) {
                // Cụm tầng trung (cam đỏ bùng cháy)
                dist = radius * (0.45 + Math.random() * 0.28);
                baseH = 1.2 + Math.random() * 0.4;
                baseW = 0.75 + Math.random() * 0.2;
                col = Math.random() < 0.5 ? 0xff5511 : 0xff7722;
                texName = Math.random() < 0.5 ? 'flame_04' : 'flame_01';
            } else {
                // Cụm rìa ngoài (đỏ cam rực lửa)
                dist = radius * (0.72 + Math.random() * 0.24);
                baseH = 0.8 + Math.random() * 0.35;
                baseW = 0.55 + Math.random() * 0.15;
                col = Math.random() < 0.6 ? 0xef4444 : 0xf97316;
                texName = Math.random() < 0.5 ? 'flame_03' : 'flame_05';
            }

            const angle = f === 0 ? 0 : (f / totalFlames) * Math.PI * 2 + (f * 1.618);
            const posX = Math.cos(angle) * dist;
            const posZ = Math.sin(angle) * dist;

            const { group: flGroup, mat: flMat } = createCrossQuadFlame(baseW, baseH, texName, col);
            flGroup.position.set(posX, 0, posZ);
            flGroup.rotation.y = Math.random() * Math.PI;
            flGroup.scale.set(0, 0, 0); // Ban đầu thu nhỏ, bùng lên khi sóng lửa lan tới
            fireGroup.add(flGroup);

            flames.push({
                group: flGroup,
                mat: flMat,
                dist: dist,
                baseX: posX,
                baseZ: posZ,
                baseHeight: baseH,
                baseScaleW: baseW,
                ignited: false,
                igniteProgress: 0,
                phase: f * 1.2 + Math.random() * 2,
                flickerSpeed: 10.0 + Math.random() * 7.0,
                swaySpeed: 2.5 + Math.random() * 2.5
            });
        }

        // Lớp 6: Làn khói mềm cuộn nhẹ (Soft Rising Smoke - không che khuất màn hình)
        const smokePuffs = [];
        const smokeGeo = new THREE.PlaneGeometry(1.8, 1.8);
        const smokeMat = new THREE.MeshBasicMaterial({
            map: getMolotovTexture('smoke_04'),
            color: 0x1e293b,
            transparent: true,
            opacity: 0.16,
            depthWrite: false
        });

        for (let s = 0; s < 6; s++) {
            const sMesh = new THREE.Mesh(smokeGeo, smokeMat);
            sMesh.rotation.x = -Math.PI / 2.5; // Hơi nghiêng theo góc nhìn camera
            const sAngle = Math.random() * Math.PI * 2;
            const sDist = Math.random() * radius * 0.6;
            sMesh.position.set(Math.cos(sAngle) * sDist, 0.5 + s * 0.45, Math.sin(sAngle) * sDist);
            fireGroup.add(sMesh);
            smokePuffs.push({
                mesh: sMesh,
                baseX: sMesh.position.x,
                baseZ: sMesh.position.z,
                y: sMesh.position.y,
                speed: 0.7 + Math.random() * 0.5,
                scale: 0.9 + Math.random() * 0.4,
                maxHeight: 3.2 + Math.random() * 0.5
            });
        }

        this.scene.add(fireGroup);

        this.activeZones.push({
            type: 'fire',
            pos: blastPos.clone(),
            radius: radius,
            life: bCfg.duration || 10.0,
            maxLife: bCfg.duration || 10.0,
            burnDps: bCfg.burnDps || 25,
            tickTimer: 0,
            sparkTimer: 0,
            group: fireGroup,
            groundGroup: groundGroup,
            scorchMat: scorchMat,
            scorch2Mat: scorch2Mat,
            emberMat: emberMat,
            coreMat: coreMat,
            flames: flames,
            smokePuffs: smokePuffs
        });

    }

    getWorldState() {
        const id = entity => entity.netId ||= 'effect-' + (this.nextEffectId = (this.nextEffectId || 0) + 1);
        return {
            zones: this.activeZones.map(z => ({ id: id(z), type: z.type, position: z.pos.toArray(), radius: z.radius,
                life: z.life, maxLife: z.maxLife, burnDps: z.burnDps || 0 })),
            bombs: this.thrownBombs.map(b => ({ id: id(b), start: b.startPos.toArray(), end: b.endPos.toArray(),
                time: b.time, duration: b.duration, weaponId: b.bombConfig.id }))
        };
    }

    removeWorldZone(zone) {
        const root = zone.group || zone.mesh;
        if (!root) return;
        this.scene.remove(root);
        const geometries = new Set(), materials = new Set();
        root.traverse(o => {
            if (o.geometry) geometries.add(o.geometry);
            if (o.material) for (const m of [o.material].flat()) materials.add(m);
        });
        for (const g of geometries) g.dispose();
        for (const m of materials) m.dispose();
    }

    applyWorldState(state) {
        this.worldReplica = true;
        const reconcile = (list, states, create) => {
            const ids = new Set(states.map(s => s.id));
            for (let i = list.length - 1; i >= 0; i--) {
                if (!ids.has(list[i].netId)) {
                    if (list === this.activeZones) this.removeWorldZone(list[i]);
                    else if (list[i].mesh) this.scene.remove(list[i].mesh);
                    list.splice(i, 1);
                }
            }
            for (const s of states) {
                let entity = list.find(e => e.netId === s.id);
                if (!entity) { create(s); entity = list[list.length - 1]; entity.netId = s.id; }
                if (s.life !== undefined) { entity.life = s.life; entity.maxLife = s.maxLife; }
                else { entity.time = s.time; entity.duration = s.duration; }
            }
        };
        reconcile(this.activeZones, state.zones || [], s => {
            const pos = new THREE.Vector3().fromArray(s.position);
            if (s.type === 'fire') this.createFireZone(pos, s.radius, {duration: s.maxLife, burnDps: s.burnDps});
            else this.createSmokeZone(pos, s.radius, s.maxLife);
        });
        reconcile(this.thrownBombs, (state.bombs || []).filter(s => getBombConfig(s.weaponId)), s => {
            this.spawnVisualBomb(new THREE.Vector3().fromArray(s.start), new THREE.Vector3().fromArray(s.end), getBombConfig(s.weaponId));
        });
    }

    updateThrownBombs(delta, arena, enemies = []) {
        if (!this.thrownBombs || !this.thrownBombs.length) return;
        for (let i = this.thrownBombs.length - 1; i >= 0; i--) {
            const tb = this.thrownBombs[i];
            tb.time += delta;
            const progress = Math.min(1.0, tb.time / tb.duration);

            // Phương trình quỹ đạo parabol
            const curX = tb.startPos.x + (tb.endPos.x - tb.startPos.x) * progress;
            const curZ = tb.startPos.z + (tb.endPos.z - tb.startPos.z) * progress;
            const peakHeight = 2.8;
            const curY = tb.startPos.y + (tb.endPos.y - tb.startPos.y) * progress + 4 * peakHeight * progress * (1 - progress);

            if (tb.mesh) {
                tb.mesh.position.set(curX, curY, curZ);
                tb.mesh.rotation.x += delta * 14;
                tb.mesh.rotation.z += delta * 10;
            }

            if (this.worldReplica) continue;
            if (progress >= 1.0) {
                // Tiếp đất -> Kích nổ diện rộng!
                if (tb.mesh) {
                    this.scene.remove(tb.mesh);
                }
                const blastPos = tb.endPos.clone();
                const bCfg = tb.bombConfig;
                const radius = bCfg.blastRadius || 5.5;
                const game = globalThis.window?.game;
                if (game?.network?.active && game.network.host) {
                    (game.networkEvents ||= []).push({type: 'bomb_explosion', position: blastPos.toArray(), color: bCfg.color || 0xf97316, radius});
                }

                // Hiệu ứng hạt nổ & chớp sáng
                this.particles.createExplosion(blastPos, bCfg.color || 0xf97316, 40, radius);
                this.particles.createImpactSparks(blastPos, new THREE.Vector3(0, 1, 0), bCfg.color || 0xffdd44, 25);
                sounds.play('enemyExplode', { volume: 1.0 });

                // Kích hoạt rung màn hình chấn động nổ uy lực (Explosion Shockwave Screen Shake)
                const blastTrauma = (bCfg.bombType === 'fire') ? 0.82 :
                                    (bCfg.bombType === 'freeze') ? 0.75 :
                                    (bCfg.bombType === 'smoke') ? 0.45 : 0.95;
                window.triggerExplosionScreenShake?.(blastPos, 26, blastTrauma);
                if (tb.playerRef?.applyScreenShake) {
                    tb.playerRef.applyScreenShake(blastTrauma * 0.85);
                } else if (tb.playerRef?.applyKickbackAndShake) {
                    tb.playerRef.applyKickbackAndShake(3.5, 0.4);
                }

                // Xử lý hiệu ứng theo từng chủng loại bom
                if (bCfg.bombType === 'smoke') {
                    // 1. BOM KHÓI: Cụm sương mù khói 3D bồng bềnh
                    this.createSmokeZone(blastPos, radius, bCfg.duration || 10.0);
                } else if (bCfg.bombType === 'fire') {
                    // 2. BOM LỬA MOLOTOV (CS:GO STYLE): Vết cháy xém Decal, biển lửa Cross-Quad 3D bập bùng và hiệu ứng Lan Tỏa (Fire Spread)
                    this.createFireZone(blastPos, radius, bCfg);

                    // Sát thương nổ ban đầu
                    for (const e of enemies) {
                        if (!e || e.isDead) continue;
                        if (e.position.distanceTo(blastPos) <= radius) {
                            e.burnTimer = 4.0;
                            e.burnDamage = bCfg.burnDps || 25;
                            const pushDir = new THREE.Vector3().subVectors(e.position, blastPos).setY(0);
                            if (pushDir.lengthSq() > 0.0001) pushDir.normalize(); else pushDir.set(0, 0, 1);
                            e.takeDamage(bCfg.damage || 80, 3, false, pushDir);
                        }
                    }
                } else if (bCfg.bombType === 'freeze') {
                    // 3. BOM ĐÓNG BĂNG: Sóng hàn khí đóng băng toàn bộ zombie trong 4 giây
                    for (const e of enemies) {
                        if (!e || e.isDead) continue;
                        if (e.position.distanceTo(blastPos) <= radius) {
                            e.freezeTimer = bCfg.freezeDuration || 4.0;
                            const pushDir = new THREE.Vector3().subVectors(e.position, blastPos).setY(0);
                            if (pushDir.lengthSq() > 0.0001) pushDir.normalize(); else pushDir.set(0, 0, 1);
                            e.takeDamage(bCfg.damage || 200, 4, true, pushDir);
                            if (e.setEmissiveColor) e.setEmissiveColor(0x00f0ff, 0.9);
                        }
                    }
                } else {
                    // 4. BOM NỔ MẢNH (Frag) & MẶC ĐỊNH
                    for (const e of enemies) {
                        if (!e || e.isDead) continue;
                        const dist = e.position.distanceTo(blastPos);
                        if (dist <= radius) {
                            const falloff = Math.max(0.35, 1 - (dist / radius) * 0.65);
                            const finalDamage = Math.round(bCfg.damage * falloff);

                            const pushDir = new THREE.Vector3().subVectors(e.position, blastPos).setY(0);
                            if (pushDir.lengthSq() > 0.0001) pushDir.normalize(); else pushDir.set(0, 0, 1);

                            if (e.velocity) {
                                e.velocity.addScaledVector(pushDir, (bCfg.knockback || 12.0) * falloff);
                            }

                            e.takeDamage(finalDamage, 4, true, pushDir);
                        }
                    }
                }

                this.thrownBombs.splice(i, 1);
            }
        }
    }

    // Kiểm tra xem một toạ độ bất kỳ có đang nằm trong màn khói hay không
    isPositionInSmoke(pos) {
        if (!pos || !this.activeZones || !this.activeZones.length) return false;
        for (const zone of this.activeZones) {
            if (zone.type === 'smoke' && zone.life > 0) {
                const dist = Math.hypot(pos.x - zone.pos.x, pos.z - zone.pos.z);
                if (dist <= zone.radius) return true;
            }
        }
        return false;
    }

    // Cập nhật các vùng hiệu ứng chiến trường (Khói, Lửa)
    updateActiveZones(delta, player, enemies = []) {
        if (this.worldReplica) enemies = [];
        const allTargets = this.worldReplica ? [] : this.enemyTargets || (Array.isArray(player) ? player : (player ? [player] : []));
        for (const p of allTargets) {
            if (p) p._tempInSmoke = false;
        }

        if (this.activeZones && this.activeZones.length > 0) {
            for (let i = this.activeZones.length - 1; i >= 0; i--) {
                const zone = this.activeZones[i];
                if (!this.worldReplica) zone.life -= delta;
                const progress = Math.max(0, zone.life / zone.maxLife);

                if (zone.type === 'smoke') {
                    for (const p of allTargets) {
                        if (p && !p.isDead) {
                            // Dùng bán kính 2D mặt đất (Math.hypot) để chính xác tuyệt đối không phụ thuộc độ cao trục Y
                            const dist = Math.hypot(p.position.x - zone.pos.x, p.position.z - zone.pos.z);
                            if (dist <= zone.radius) {
                                p._tempInSmoke = true;
                            }
                        }
                    }

                    // Hiệu ứng mây khói xoay bồng bềnh và mờ dần trong 2 giây cuối
                    const fade = Math.min(1.0, zone.life / 2.0);
                    if (zone.puffs) {
                        for (let p = 0; p < zone.puffs.length; p++) {
                            const puff = zone.puffs[p];
                            puff.mesh.rotation.y += delta * puff.rotSpeed;
                            puff.mesh.rotation.z += delta * (puff.rotSpeed * 0.5);
                            puff.mat.opacity = 0.45 * fade;
                            const breathe = 1.0 + 0.08 * Math.sin(zone.life * 2.5 + p);
                            puff.mesh.scale.setScalar(puff.baseScale * breathe);
                        }
                    } else if (zone.mesh && zone.mat) {
                        zone.mesh.rotation.y += delta * 0.2;
                        zone.mat.opacity = Math.min(0.65, progress * 0.7);
                    }

                    if (zone.groundRing) {
                        zone.groundRing.material.opacity = 0.35 * fade;
                    }
                } else if (zone.type === 'fire') {
                    zone.tickTimer = (zone.tickTimer || 0) + delta;
                    if (zone.tickTimer >= 0.5) {
                        zone.tickTimer = 0;
                        for (const e of enemies) {
                            if (!e || e.isDead) continue;
                            const dist = Math.hypot(e.position.x - zone.pos.x, e.position.z - zone.pos.z);
                            if (dist <= zone.radius) {
                                e.burnTimer = 3.5;
                                e.burnDamage = zone.burnDps || 25;
                                e.takeDamage(Math.round((zone.burnDps || 25) * 0.5), 2, false, null);
                            }
                        }
                    }

                    const fade = Math.min(1.0, zone.life / 1.5);
                    const elapsed = zone.maxLife - zone.life;

                    // 1. Hiệu ứng Lan Tỏa (Fire Spread Expansion kiểu CS:GO) trong 0.65 giây đầu
                    const spreadProgress = Math.min(1.0, elapsed / 0.65);
                    const easeSpread = 1 - Math.pow(1 - spreadProgress, 2);
                    const currentSpreadDist = zone.radius * (0.25 + 0.75 * easeSpread);

                    if (zone.groundGroup) {
                        zone.groundGroup.scale.set(easeSpread, 1, easeSpread);
                    }

                    // 2. Cập nhật các cụm ngọn lửa 3D Cross-Quad
                    if (zone.flames) {
                        for (let f = 0; f < zone.flames.length; f++) {
                            const fl = zone.flames[f];
                            // Khi sóng lửa lan tới vị trí cụm lửa -> Bắt đầu bùng cháy
                            if (!fl.ignited && currentSpreadDist >= fl.dist) {
                                fl.ignited = true;
                            }

                            if (fl.ignited) {
                                fl.igniteProgress = Math.min(1.0, (fl.igniteProgress || 0) + delta * 3.8);
                                const flick = 0.82 + 0.32 * Math.sin(zone.life * fl.flickerSpeed + fl.phase) + 0.14 * Math.cos(zone.life * (fl.flickerSpeed * 0.65) + fl.phase);
                                const currentScale = Math.max(0.01, flick * fl.igniteProgress * fade);
                                fl.group.scale.set(currentScale, currentScale, currentScale);
                                fl.group.position.x = fl.baseX + Math.sin(zone.life * 2.8 + fl.phase) * 0.1;
                                fl.group.position.z = fl.baseZ + Math.cos(zone.life * 2.4 + fl.phase) * 0.1;
                                fl.mat.opacity = 0.92 * fade;
                            } else {
                                fl.group.scale.set(0, 0, 0);
                            }
                        }
                    }

                    // 3. Than hồng mặt đất và lõi nhiệt phập phồng nhịp thở (Heat Pulsing)
                    if (zone.emberMat) {
                        zone.emberMat.opacity = (0.55 + 0.25 * Math.sin(zone.life * 7.0)) * fade;
                    }
                    if (zone.coreMat) {
                        zone.coreMat.opacity = (0.7 + 0.2 * Math.sin(zone.life * 9.0)) * fade;
                    }
                    if (zone.scorchMat) {
                        zone.scorchMat.opacity = 0.92 * fade;
                    }
                    if (zone.scorch2Mat) {
                        zone.scorch2Mat.opacity = 0.85 * fade;
                    }

                    // 4. Làn khói mềm cuộn bốc lên cao và mờ dần nhẹ nhàng
                    if (zone.smokePuffs) {
                        for (let s = 0; s < zone.smokePuffs.length; s++) {
                            const sp = zone.smokePuffs[s];
                            sp.y += delta * sp.speed;
                            if (sp.y > sp.maxHeight) sp.y = 0.4;
                            const progress = sp.y / sp.maxHeight;
                            sp.mesh.position.y = sp.y;
                            sp.mesh.position.x = sp.baseX + Math.sin(zone.life * 2.2 + sp.speed) * 0.25;
                            sp.mesh.position.z = sp.baseZ + Math.cos(zone.life * 1.8 + sp.speed) * 0.25;
                            const currentScale = sp.scale * (1.0 + progress * 1.8) * fade;
                            sp.mesh.scale.setScalar(currentScale);
                            sp.mesh.material.opacity = 0.18 * (1.0 - progress * 0.7) * fade;
                        }
                    }

                    // 5. Bắn các đốm tàn lửa bay bổng lên cao
                    zone.sparkTimer = (zone.sparkTimer || 0) + delta;
                    if (zone.sparkTimer >= 0.1) {
                        zone.sparkTimer = 0;
                        if (this.particles?.createImpactSparks) {
                            const sparkPos = zone.pos.clone().add(new THREE.Vector3(
                                (Math.random() - 0.5) * currentSpreadDist * 1.1,
                                0.2 + Math.random() * 0.4,
                                (Math.random() - 0.5) * currentSpreadDist * 1.1
                            ));
                            this.particles.createImpactSparks(sparkPos, new THREE.Vector3(0, 1.5, 0), Math.random() < 0.5 ? 0xff6600 : 0xffdd22, 3);
                        }
                    }
                }

                if (zone.life <= 0) {
                    this.removeWorldZone(zone);
                    this.activeZones.splice(i, 1);
                }
            }
        }

        // Đảm bảo cờ isInSmoke được cập nhật chính xác mỗi frame kể cả khi không còn vùng khói
        for (const p of allTargets) {
            if (p) p.isInSmoke = !!p._tempInSmoke || !!(p.shadowVeilTimer > 0) || !!p.isStealthed;
        }
    }

    update(delta, arena, enemies, player, onHitCallback) {
        // Chỉ cập nhật bom và vùng hiệu ứng từ hệ thống chính của Host/Local để tránh trừ timer nhiều lần
        if (!this.isRemoteClone) {
            this.worldReplica = !!(globalThis.window?.game?.network?.active && !window.game.network.host);
            this.updateThrownBombs(delta, arena, enemies);
            this.updateActiveZones(delta, player, enemies);
        }
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

        // Xử lý tiến trình sơ cứu / uống nước tăng lực
        if (!this.worldReplica && this.isUsingMedkit && this.medkitPlayerRef) {
            const p = this.medkitPlayerRef;
            if (p.isDead || p.isDowned) {
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
                    const medCfg = this.currentMedicalItem || MEDICAL_CONFIGS[1];
                    const invKey = this.currentMedicalInvKey || 'medkits';

                    if ((this.inventory[invKey] || 0) > 0) {
                        this.inventory[invKey]--;
                    } else if (this.inventory.medkits > 0) {
                        this.inventory.medkits--;
                    }

                    if (medCfg.healAmount) {
                        if (medCfg.maxHealthCap && medCfg.maxHealthCap < 100) {
                            p.health = Math.min(medCfg.maxHealthCap, p.health + medCfg.healAmount);
                        } else {
                            p.heal(medCfg.healAmount);
                        }
                    }
                    if (medCfg.shieldAmount) {
                        p.rechargeShield(medCfg.shieldAmount);
                    }
                    if (medCfg.speedBoostDuration) {
                        p.speedBoostTimer = medCfg.speedBoostDuration;
                        p.speedBoostFactor = 1 + (medCfg.speedBoostPct || 0.25);
                    }

                    p.painTimer = 0;
                    sounds.playMedkit();
                    this.particles.createImpactSparks(p.position.clone().add(new THREE.Vector3(0, 1.0, 0)), new THREE.Vector3(0, 1, 0), medCfg.color || 0x00ff88, 24);
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
            p.distanceTraveled = (p.distanceTraveled || 0) + stepDist;

            const startPos = p.mesh.position;

            // Kiểm tra giới hạn tầm bắn tối đa theo từng súng và phụ kiện chuyên biệt
            if (p.maxRange && p.distanceTraveled >= p.maxRange) {
                // Tạo hiệu ứng hạt tàn đạn nhẹ khi viên đạn bay hết cự ly hiệu dụng
                if (startPos) {
                    this.particles?.createImpactSparks?.(startPos, p.direction.clone().negate(), p.color, 4);
                }
                this.removeProjectile(i);
                continue;
            }

            _tempNextPos.copy(startPos).addScaledVector(p.direction, stepDist);
            _tempRay.set(startPos, p.direction);
            let hitFound = false;

            // 1. Va chạm chướng ngại vật Arena
            for (const col of arena.colliders) {
                const hit = _tempRay.intersectBox(col, _tempHitPoint);
                if (hit && startPos.distanceTo(hit) <= stepDist) {
                    if (p.isExplosive) {
                        this.particles.createExplosion(hit, 0xff5500, 32);
                        sounds.play('enemyDestroy', { volume: 0.9 });
                        for (const enemy of enemies) {
                            if (!enemy.isDead && enemy.position.distanceTo(hit) <= p.splashRadius) {
                                const dist = enemy.position.distanceTo(hit);
                                const splashDmg = Math.round(p.damage * (1 - (dist / p.splashRadius) * 0.45));
                                const dir = enemy.position.clone().sub(hit).normalize();
                                enemy.takeDamage(splashDmg, p.penPower, false, dir);
                            }
                        }
                    } else {
                        this.particles.createImpactSparks(hit, p.direction.clone().negate(), p.color, 8);
                    }
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

                        // Tính toán sát thương và cơ chế suy giảm theo cự ly (Damage Drop-off từ 70% tầm bắn)
                        let currentBaseDmg = p.baseDamage !== undefined ? p.baseDamage : p.damage;
                        if (p.maxRange && p.distanceTraveled > p.maxRange * 0.7) {
                            const dropRatio = (p.distanceTraveled - p.maxRange * 0.7) / (p.maxRange * 0.3);
                            const dropFactor = 1.0 - Math.min(0.5, Math.max(0, dropRatio) * 0.5); // Giảm tối đa 50% ở cuối tầm bắn
                            currentBaseDmg = Math.round(currentBaseDmg * dropFactor);
                        }

                        // Tính tỷ lệ bạo kích theo Phụ kiện Kính ngắm hoặc Kỹ năng Ám sát
                        let isCrit = hitInfo.isCrit || (Math.random() < (p.critChance || 0.12));
                        let critMult = isCrit ? (p.critMultiplier || 1.8) : 1.0;
                        if (p.owner?.assassinCritReady) {
                            isCrit = true;
                            critMult = 4.0;
                            p.owner.assassinCritReady = false;
                            p.owner.shadowVeilTimer = 0;
                            p.owner.isInSmoke = false;
                            p.owner.isStealthed = false;
                            sounds.play('enemyDestroy', { volume: 1.0, pitchVariation: 0.2 });
                        }
                        const finalDamage = Math.round(currentBaseDmg * critMult);

                        // Gọi takeDamage kèm penPower
                        const hitResult = enemy.takeDamage(finalDamage, p.penPower, isCrit, p.direction);

                        // Tia lửa phụ thuộc vào việc xuyên máu hay bị giáp cản
                        const sparkColor = hitResult?.isPenetrated ? (isCrit ? 0xff2255 : p.color) : 0xffffff;
                        this.particles.createImpactSparks(hitInfo.point, p.direction.clone().negate(), sparkColor, isCrit ? 14 : 8);

                        // Hiệu ứng Đạn nổ RPG (Devastator)
                        if (p.isExplosive) {
                            this.particles.createExplosion(hitInfo.point, 0xff5500, 36);
                            sounds.play('enemyDestroy', { volume: 1.0 });
                            for (const other of enemies) {
                                if (other !== enemy && !other.isDead && other.position.distanceTo(hitInfo.point) <= p.splashRadius) {
                                    const dist = other.position.distanceTo(hitInfo.point);
                                    const splashDmg = Math.round(finalDamage * (1 - (dist / p.splashRadius) * 0.45));
                                    const dir = other.position.clone().sub(hitInfo.point).normalize();
                                    other.takeDamage(splashDmg, p.penPower, false, dir);
                                }
                            }
                        }

                        // Hiệu ứng Đồ Huyền Thoại (Tier 5): Tia lửa va chạm hoàng kim uy lực (Chỉ vũ khí isExplosive mới tạo vụ nổ AoE)
                        if (p.hasLegendary && !p.isExplosive) {
                            this.particles?.createImpactSparks?.(hitInfo.point, p.direction.clone().negate(), 0xf59e0b, 12);
                        }

                        sounds.playHitMarker(isCrit);
                        if (onHitCallback) onHitCallback(finalDamage, isCrit, hitInfo.point, hitResult, enemy);

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
                const targets = this.enemyTargets || (Array.isArray(player) ? player : [player]);
                for (const target of targets) {
                    if (!target || target.isDead || target.isDowned) continue;
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
                if (p.bulletType === 'explosive' || p.bulletType === 'plasma') {
                    p.mesh.rotation.z += 0.25;
                    p.mesh.rotation.y += 0.15;
                }
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
        if (!this.isRemoteClone) {
            for (const z of this.activeZones) this.removeWorldZone(z);
            for (const b of this.thrownBombs) if (b.mesh) this.scene.remove(b.mesh);
            this.activeZones.splice(0);
            this.thrownBombs.splice(0);
            this.worldReplica = false;
        }
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
