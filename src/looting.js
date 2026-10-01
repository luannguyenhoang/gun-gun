import * as THREE from 'three';
import { GLTFLoader } from '../libs/loaders/GLTFLoader.js';
import { sounds } from './audio.js';
import { WEAPON_CONFIGS, RARE_WEAPON_CONFIGS, ATTACHMENT_DEFS } from './weapons.js';

const _gltfLoader = new GLTFLoader();
const _modelCache = new Map();

function getOrLoadModel(path, onLoad) {
    if (_modelCache.has(path)) {
        onLoad(_modelCache.get(path).clone());
        return;
    }
    _gltfLoader.load(path, (gltf) => {
        gltf.scene.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });
        _modelCache.set(path, gltf.scene);
        onLoad(gltf.scene.clone());
    }, undefined, () => {});
}

// Danh mục vật phẩm chuẩn Hardcore Extraction Shooter
// =========================================================================
// HỆ THỐNG CẤP BẬC ĐỘ HIẾM & DANH MỤC VẬT PHẨM CHUẨN HÓA 5 TIER
// Loại bỏ hoàn toàn hộp đạn, buff đạn lẻ. Chỉ tập trung vào Súng, Phụ kiện & Túi cứu thương
// =========================================================================
export const LOOT_TIERS = {
    1: { tier: 1, name: 'COMMON', label: 'Cấp 1 · Thường', color: '#94a3b8', border: '#64748b' },
    2: { tier: 2, name: 'UNCOMMON', label: 'Cấp 2 · Đặc biệt', color: '#22c55e', border: '#16a34a' },
    3: { tier: 3, name: 'RARE', label: 'Cấp 3 · Hiếm', color: '#3b82f6', border: '#2563eb' },
    4: { tier: 4, name: 'EPIC', label: 'Cấp 4 · Sử thi', color: '#a855f7', border: '#9333ea' },
    5: { tier: 5, name: 'LEGENDARY', label: 'Cấp 5 · Huyền thoại', color: '#f59e0b', border: '#d97706' }
};

export const LOOT_ITEMS = {
    // --- 1. VẬT PHẨM Y TẾ DUY NHẤT (FIRST AID KIT) ---
    medkit: {
        id: 'medkit',
        name: 'Túi Cứu Thương PUBG',
        category: 'medical',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'MEDKIT',
        description: 'Bấm [F] nhặt ngay, tự dồn vào số lượng máu dự trữ. Hồi 50 HP khẩn cấp.',
        statSummary: '+50 Máu Cấp Cứu',
        actionLabel: 'NHẶT CỨU THƯƠNG'
    },

    // --- 2. LINH KIỆN NÒNG SÚNG (BARREL - Flat Damage & Range) ---
    barrel_t1: {
        id: 'barrel_t1',
        name: 'Nòng Chuẩn Cấp 1',
        category: 'attachment',
        slot: 'barrel',
        tier: 1,
        rarity: 'common',
        color: '#94a3b8',
        tag: 'NÒNG T1',
        description: 'Tăng trực tiếp +5 Flat Damage và +10% Tầm bắn cho súng.',
        statSummary: '+5 Flat DMG · +10% Tầm bắn',
        flatDmg: 5,
        rangeBonusPct: 0.10
    },
    barrel_t2: {
        id: 'barrel_t2',
        name: 'Nòng Cường Lực Cấp 2',
        category: 'attachment',
        slot: 'barrel',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'NÒNG T2',
        description: 'Tăng +12 Flat Damage, +25% Tầm bắn và +15% Damage modifier.',
        statSummary: '+12 Flat DMG · +25% Tầm · +15% Mod',
        flatDmg: 12,
        rangeBonusPct: 0.25
    },
    barrel_t3: {
        id: 'barrel_t3',
        name: 'Nòng Tác Chiến Cấp 3',
        category: 'attachment',
        slot: 'barrel',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'NÒNG T3',
        description: 'Tăng +22 Flat Damage, +45% Tầm bắn và +35% Damage modifier.',
        statSummary: '+22 Flat DMG · +45% Tầm · +35% Mod',
        flatDmg: 22,
        rangeBonusPct: 0.45
    },
    barrel_t4: {
        id: 'barrel_t4',
        name: 'Nòng Siêu Cấp Cấp 4',
        category: 'attachment',
        slot: 'barrel',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'NÒNG T4',
        description: 'Tăng +38 Flat Damage, +70% Tầm bắn và +60% Damage modifier.',
        statSummary: '+38 Flat DMG · +70% Tầm · +60% Mod',
        flatDmg: 38,
        rangeBonusPct: 0.70
    },
    barrel_t5: {
        id: 'barrel_t5',
        name: 'Nòng Thần Thoại Cấp 5',
        category: 'attachment',
        slot: 'barrel',
        tier: 5,
        rarity: 'legendary',
        color: '#f59e0b',
        tag: 'NÒNG T5',
        description: 'Tăng +65 Flat Damage, +110% Tầm bắn siêu xa, +100% Mod, đạn bay xé gió.',
        statSummary: '+65 Flat DMG · +110% Tầm siêu xa · +100% Mod',
        flatDmg: 65,
        rangeBonusPct: 1.10
    },

    // --- 3. LINH KIỆN BĂNG ĐẠN (MAGAZINE - Mag Size & Reload Speed) ---
    magazine_t1: {
        id: 'magazine_t1',
        name: 'Băng Đạn Cấp 1',
        category: 'attachment',
        slot: 'magazine',
        tier: 1,
        rarity: 'common',
        color: '#94a3b8',
        tag: 'BĂNG ĐẠN T1',
        description: 'Tăng +25% sức chứa băng đạn, nạp đạn nhanh hơn 15%.',
        statSummary: '+25% Băng đạn · Nạp +15%',
        magBonusPct: 0.25
    },
    magazine_t2: {
        id: 'magazine_t2',
        name: 'Băng Đạn Mở Rộng Cấp 2',
        category: 'attachment',
        slot: 'magazine',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'BĂNG ĐẠN T2',
        description: 'Tăng +45% sức chứa băng đạn, nạp đạn nhanh hơn 25%, +15% Damage.',
        statSummary: '+45% Băng đạn · Nạp +25% · +15% DMG',
        magBonusPct: 0.45
    },
    magazine_t3: {
        id: 'magazine_t3',
        name: 'Băng Đạn Siêu Cấp Cấp 3',
        category: 'attachment',
        slot: 'magazine',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'BĂNG ĐẠN T3',
        description: 'Tăng +75% sức chứa băng đạn, nạp đạn nhanh hơn 40%, +35% Damage.',
        statSummary: '+75% Băng đạn · Nạp +40% · +35% DMG',
        magBonusPct: 0.75
    },
    magazine_t4: {
        id: 'magazine_t4',
        name: 'Băng Đạn Trống Kép Cấp 4',
        category: 'attachment',
        slot: 'magazine',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'BĂNG ĐẠN T4',
        description: '+110% Băng đạn, nạp đạn chớp mắt, +60% Damage.',
        statSummary: '+110% Băng đạn · Nạp chớp mắt · +60% DMG',
        magBonusPct: 1.10
    },
    magazine_t5: {
        id: 'magazine_t5',
        name: 'Băng Đạn Vô Tận Cấp 5',
        category: 'attachment',
        slot: 'magazine',
        tier: 5,
        rarity: 'legendary',
        color: '#f59e0b',
        tag: 'BĂNG ĐẠN T5',
        description: '+160% Băng đạn, nạp đạn siêu tốc, +100% Damage.',
        statSummary: '+160% Băng đạn · Nạp siêu tốc · +100% DMG',
        magBonusPct: 1.60
    },

    // --- 4. LINH KIỆN KÍNH NGẮM (OPTIC - Crit Chance & Crit Damage) ---
    optic_t1: {
        id: 'optic_t1',
        name: 'Kính Ngắm Cấp 1',
        category: 'attachment',
        slot: 'optic',
        tier: 1,
        rarity: 'common',
        color: '#94a3b8',
        tag: 'KÍNH NGẮM T1',
        description: 'Kính Red Dot: +8% Crit, +0.2x Sát thương bạo kích.',
        statSummary: '+8% Crit · +0.2x Crit DMG',
        critChance: 0.08,
        rangeBonusPct: 0.00
    },
    optic_t2: {
        id: 'optic_t2',
        name: 'Kính Ngắm Cấp 2',
        category: 'attachment',
        slot: 'optic',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'KÍNH NGẮM T2',
        description: 'Kính Holo: +15% Crit, +0.4x Crit DMG, zoom 1.5x, +5% Tầm bắn, +15% Damage.',
        statSummary: '+15% Crit · +5% Tầm · +15% DMG',
        critChance: 0.15,
        rangeBonusPct: 0.05
    },
    optic_t3: {
        id: 'optic_t3',
        name: 'Kính Ngắm Cấp 3',
        category: 'attachment',
        slot: 'optic',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'KÍNH NGẮM T3',
        description: 'Ống ngắm Scope 2x: +25% Crit, +0.7x Crit DMG, zoom 2.0x, +15% Tầm bắn hiệu dụng, +35% Damage.',
        statSummary: '+25% Crit · +15% Tầm · +35% DMG',
        critChance: 0.25,
        rangeBonusPct: 0.15
    },
    optic_t4: {
        id: 'optic_t4',
        name: 'Kính Ngắm Cấp 4',
        category: 'attachment',
        slot: 'optic',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'KÍNH NGẮM T4',
        description: 'Ống ngắm Scope 4x: +38% Crit, +1.1x Crit DMG, zoom 2.8x, +30% Tầm bắn hiệu dụng, +60% Damage.',
        statSummary: '+38% Crit · +30% Tầm · +60% DMG',
        critChance: 0.38,
        rangeBonusPct: 0.30
    },
    optic_t5: {
        id: 'optic_t5',
        name: 'Kính Ngắm Cấp 5',
        category: 'attachment',
        slot: 'optic',
        tier: 5,
        rarity: 'legendary',
        color: '#f59e0b',
        tag: 'KÍNH NGẮM T5',
        description: 'Kính Thần Ưng: +55% Crit, +1.8x Bạo kích cực đại, zoom 3.5x, +50% Tầm bắn cực đại, +100% Damage.',
        statSummary: '+55% Crit · +50% Tầm bắn · +100% DMG',
        critChance: 0.55,
        rangeBonusPct: 0.50
    },

    // --- 5. LINH KIỆN BÁNG / TAY CẦM (GRIP - Recoil & Spread Reduction) ---
    grip_t1: {
        id: 'grip_t1',
        name: 'Báng Tay Cầm Cấp 1',
        category: 'attachment',
        slot: 'grip',
        tier: 1,
        rarity: 'common',
        color: '#94a3b8',
        tag: 'TAY CẦM T1',
        description: 'Tay cầm dọc: Giảm 20% độ giật, giảm 20% góc tản đạn.',
        statSummary: '-20% Giật · -20% Tản đạn'
    },
    grip_t2: {
        id: 'grip_t2',
        name: 'Báng Tay Cầm Cấp 2',
        category: 'attachment',
        slot: 'grip',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'TAY CẦM T2',
        description: 'Báng hợp kim: Giảm 35% độ giật, giảm 35% tản đạn, +15% Damage.',
        statSummary: '-35% Giật · Gom đạn · +15% DMG'
    },
    grip_t3: {
        id: 'grip_t3',
        name: 'Báng Tay Cầm Cấp 3',
        category: 'attachment',
        slot: 'grip',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'TAY CẦM T3',
        description: 'Báng giảm giật cao cấp: Giảm 50% độ giật, gom 50% chùm đạn, +35% Damage.',
        statSummary: '-50% Giật · Gom đạn · +35% DMG'
    },
    grip_t4: {
        id: 'grip_t4',
        name: 'Báng Tay Cầm Cấp 4',
        category: 'attachment',
        slot: 'grip',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'TAY CẦM T4',
        description: 'Khung giảm chấn thủy lực: Giảm 65% độ giật, gom 1 điểm, +60% Damage.',
        statSummary: '-65% Giật · Gom 1 điểm · +60% DMG'
    },
    grip_t5: {
        id: 'grip_t5',
        name: 'Báng Tay Cầm Cấp 5',
        category: 'attachment',
        slot: 'grip',
        tier: 5,
        rarity: 'legendary',
        color: '#f59e0b',
        tag: 'TAY CẦM T5',
        description: 'Báng cân bằng Laser: Giảm 85% độ giật, đạn bay thẳng tắp, +100% Damage.',
        statSummary: '-85% Giật · Laser chính xác · +100% DMG'
    },

    // --- 6. VŨ KHÍ THEO CẤP BẬC TIER ---
    gun_blaster_t2: {
        id: 'gun_blaster_t2',
        name: 'Blaster-X Cấp 2',
        category: 'weapon',
        baseWeaponId: 'blaster',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'SÚNG T2',
        description: 'Súng ngắn bán tự động Cấp 2 (+15% Damage gốc).',
        statSummary: '+15% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_blaster_t3: {
        id: 'gun_blaster_t3',
        name: 'Blaster-X Cấp 3',
        category: 'weapon',
        baseWeaponId: 'blaster',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'SÚNG T3',
        description: 'Súng ngắn bán tự động Cấp 3 (+35% Damage gốc).',
        statSummary: '+35% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_repeater_t2: {
        id: 'gun_repeater_t2',
        name: 'Repeater-9 Cấp 2',
        category: 'weapon',
        baseWeaponId: 'repeater',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'SÚNG T2',
        description: 'Súng trường liên thanh tự động Cấp 2 (+15% Damage gốc).',
        statSummary: 'Tự động · +15% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_repeater_t3: {
        id: 'gun_repeater_t3',
        name: 'Repeater-9 Cấp 3',
        category: 'weapon',
        baseWeaponId: 'repeater',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'SÚNG T3',
        description: 'Súng trường liên thanh tự động Cấp 3 (+35% Damage gốc).',
        statSummary: 'Tự động · +35% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_scatter_t2: {
        id: 'gun_scatter_t2',
        name: 'Scatter-V Cấp 2',
        category: 'weapon',
        baseWeaponId: 'scatter',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'SÚNG T2',
        description: 'Shotgun tán xạ diện rộng Cấp 2 (+15% Damage gốc).',
        statSummary: 'Shotgun · +15% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_scatter_t3: {
        id: 'gun_scatter_t3',
        name: 'Scatter-V Cấp 3',
        category: 'weapon',
        baseWeaponId: 'scatter',
        tier: 3,
        rarity: 'rare',
        color: '#3b82f6',
        tag: 'SÚNG T3',
        description: 'Shotgun tán xạ diện rộng Cấp 3 (+35% Damage gốc).',
        statSummary: 'Shotgun · +35% Base DMG',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_plasma_t4: {
        id: 'gun_plasma_t4',
        name: 'Plasma Lance Cấp 4',
        category: 'weapon',
        baseWeaponId: 'plasma',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'SÚNG T4 EPIC',
        description: 'Khẩu pháo Plasma sử thi: Sát thương cực lớn, đạn xuyên giáp mạnh.',
        statSummary: 'Sử thi · Xuyên giáp Cấp 3',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_storm_t4: {
        id: 'gun_storm_t4',
        name: 'Storm MK-II Cấp 4',
        category: 'weapon',
        baseWeaponId: 'storm',
        tier: 4,
        rarity: 'epic',
        color: '#a855f7',
        tag: 'SÚNG T4 EPIC',
        description: 'Tiểu liên bão đạn sử thi: Tốc độ xả đạn thần tốc 48 viên/băng.',
        statSummary: 'Sử thi · Tốc độ bắn cực đại',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    },
    gun_nova_t5: {
        id: 'gun_nova_t5',
        name: 'Nova Shotgun Cấp 5',
        category: 'weapon',
        baseWeaponId: 'nova',
        tier: 5,
        rarity: 'legendary',
        color: '#f59e0b',
        tag: 'SÚNG T5 LEGENDARY',
        description: 'Siêu vũ khí Huyền Thoại: 8 viên đạn nổ lan xuyên thấu mọi zombie!',
        statSummary: 'Huyền thoại · Bắn nổ lan & Xuyên mục tiêu',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    }
};

// Ánh xạ tương thích ngược các ID item cũ để tránh lỗi tham chiếu
const LEGACY_LOOT_ALIASES = {
    medkit_military: 'medkit',
    bandage_field: 'medkit',
    painkiller_bottle: 'medkit',
    painkiller_morphine: 'medkit',
    energy_drink: 'medkit',
    water_purified: 'medkit',
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
    attach_stock_tactical: 'grip_t2',
    weapon_pistol_p92: 'gun_blaster_t2',
    weapon_shotgun_s1897: 'gun_scatter_t2',
    weapon_assault: 'gun_repeater_t3',
    weapon_sniper: 'gun_plasma_t4',
    weapon_titan: 'gun_nova_t5'
};

export function th_resolveLootItem(itemId) {
    if (!itemId) return null;
    const resolvedId = LEGACY_LOOT_ALIASES[itemId] || itemId;
    return LOOT_ITEMS[resolvedId] || null;
}

// =========================================================================
// CẤU HÌNH HÒM ĐỒ TƯƠNG TÁC (LOOT DROP RATES CHUẨN HÓA)
// - Hòm thường: Rớt Súng / Phụ kiện Cấp 1 -> Cấp 3
// - Hòm Airdrop: Chắc chắn có đồ Cấp 4 (Epic) hoặc Cấp 5 (Legendary)
// =========================================================================
export const CONTAINER_CONFIGS = {
    wooden_crate: {
        id: 'wooden_crate',
        name: 'Thùng Gỗ Quân Trang',
        searchDuration: 1.0,
        interactionRadius: 3.6,
        capacity: 6,
        meshColor: 0x8b5a2b,
        accentColor: 0x00f0ff,
        promptLabel: '[F] LỤC THÙNG GỖ QUÂN TRANG',
        lootTable: [
            { itemId: 'barrel_t2', chance: 0.65, min: 1, max: 1 },
            { itemId: 'magazine_t2', chance: 0.60, min: 1, max: 1 },
            { itemId: 'optic_t2', chance: 0.55, min: 1, max: 1 },
            { itemId: 'grip_t2', chance: 0.60, min: 1, max: 1 },
            { itemId: 'barrel_t3', chance: 0.35, min: 1, max: 1 },
            { itemId: 'magazine_t3', chance: 0.30, min: 1, max: 1 },
            { itemId: 'optic_t3', chance: 0.25, min: 1, max: 1 },
            { itemId: 'grip_t3', chance: 0.30, min: 1, max: 1 },
            { itemId: 'gun_repeater_t2', chance: 0.40, min: 1, max: 1 },
            { itemId: 'gun_scatter_t2', chance: 0.35, min: 1, max: 1 },
            { itemId: 'medkit', chance: 0.60, min: 1, max: 1 }
        ]
    },
    dead_body: {
        id: 'dead_body',
        name: 'Thi Thể Đặc Nhiệm',
        searchDuration: 1.0,
        interactionRadius: 3.6,
        capacity: 6,
        meshColor: 0x475569,
        accentColor: 0x22c55e,
        promptLabel: '[F] LỤC THI THỂ ĐẶC NHIỆM',
        lootTable: [
            { itemId: 'barrel_t1', chance: 0.70, min: 1, max: 1 },
            { itemId: 'magazine_t1', chance: 0.70, min: 1, max: 1 },
            { itemId: 'optic_t1', chance: 0.65, min: 1, max: 1 },
            { itemId: 'grip_t1', chance: 0.65, min: 1, max: 1 },
            { itemId: 'barrel_t2', chance: 0.45, min: 1, max: 1 },
            { itemId: 'optic_t2', chance: 0.40, min: 1, max: 1 },
            { itemId: 'gun_blaster_t2', chance: 0.50, min: 1, max: 1 },
            { itemId: 'medkit', chance: 0.75, min: 1, max: 2 }
        ]
    },
    military_safe: {
        id: 'military_safe',
        name: 'Két Sắt Quân Sự',
        searchDuration: 1.6,
        interactionRadius: 3.6,
        capacity: 6,
        meshColor: 0x334155,
        accentColor: 0xa855f7,
        promptLabel: '[F] MỞ KÉT SẮT QUÂN SỰ',
        lootTable: [
            { itemId: 'barrel_t3', chance: 0.75, min: 1, max: 1 },
            { itemId: 'magazine_t3', chance: 0.70, min: 1, max: 1 },
            { itemId: 'optic_t3', chance: 0.65, min: 1, max: 1 },
            { itemId: 'grip_t3', chance: 0.70, min: 1, max: 1 },
            { itemId: 'barrel_t4', chance: 0.45, min: 1, max: 1 },
            { itemId: 'optic_t4', chance: 0.40, min: 1, max: 1 },
            { itemId: 'gun_repeater_t3', chance: 0.55, min: 1, max: 1 },
            { itemId: 'gun_plasma_t4', chance: 0.35, min: 1, max: 1 },
            { itemId: 'medkit', chance: 0.90, min: 1, max: 2 }
        ]
    },
    airdrop_crate: {
        id: 'airdrop_crate',
        name: 'Thính Tiếp Tế Airdrop',
        searchDuration: 2.0,
        interactionRadius: 4.0,
        capacity: 8,
        meshColor: 0xd97706,
        accentColor: 0xf59e0b,
        promptLabel: '[F] MỞ HÒM THÍNH TIẾP TẾ',
        lootTable: [
            // CHẮC CHẮN CÓ ĐỒ CẤP 4 (EPIC) HOẶC CẤP 5 (LEGENDARY)
            { itemId: 'barrel_t5', chance: 0.60, min: 1, max: 1 },
            { itemId: 'barrel_t4', chance: 0.85, min: 1, max: 1 },
            { itemId: 'magazine_t5', chance: 0.55, min: 1, max: 1 },
            { itemId: 'magazine_t4', chance: 0.80, min: 1, max: 1 },
            { itemId: 'optic_t5', chance: 0.55, min: 1, max: 1 },
            { itemId: 'optic_t4', chance: 0.85, min: 1, max: 1 },
            { itemId: 'grip_t5', chance: 0.55, min: 1, max: 1 },
            { itemId: 'grip_t4', chance: 0.80, min: 1, max: 1 },
            { itemId: 'gun_nova_t5', chance: 0.50, min: 1, max: 1 },
            { itemId: 'gun_plasma_t4', chance: 0.70, min: 1, max: 1 },
            { itemId: 'gun_storm_t4', chance: 0.70, min: 1, max: 1 },
            { itemId: 'medkit', chance: 1.00, min: 1, max: 3 }
        ]
    }
};

export class PlayerInventory {
    constructor(cols = 5, rows = 6) {
        this.cols = cols;
        this.rows = rows;
        this.capacity = cols * rows; // 30 ô vuông
        this.slotsCount = this.capacity;
        this.slots = new Array(this.capacity).fill(null);
        this.initDefaultLoadout();
    }

    // Đồ khởi đầu cơ bản của chiến binh phong phú theo chuẩn PUBG Mobile
    initDefaultLoadout() {
        this.slots[0] = { itemId: 'medkit_military', count: 2, revealed: true };      // First Aid Kit (thẻ vàng)
        this.slots[1] = { itemId: 'attach_quickdraw_mag', count: 1, revealed: true }; // Quickdraw Mag (thẻ vàng)
        this.slots[2] = { itemId: 'ammo_12gauge', count: 10, revealed: true };        // 12 Gauge Ammo (thẻ vàng)
        this.slots[3] = { itemId: 'energy_drink', count: 5, revealed: true };          // Nước tăng lực (thẻ vàng)
        this.slots[4] = { itemId: 'painkiller_bottle', count: 2, revealed: true };     // Thuốc giảm đau
        this.slots[5] = { itemId: 'attach_scope_x8', count: 1, revealed: true };       // Ống ngắm 8x
        this.slots[6] = { itemId: 'attach_scope_x6', count: 1, revealed: true };       // Ống ngắm 6x
        this.slots[7] = { itemId: 'attach_red_dot', count: 1, revealed: true };        // Kính ngắm Chấm Đỏ
        this.slots[8] = { itemId: 'attach_compensator', count: 1, revealed: true };    // Nòng giảm giật
        this.slots[9] = { itemId: 'attach_grip_tactical', count: 1, revealed: true };  // Tay cầm dã chiến
        this.slots[10] = { itemId: 'attach_stock_heavy', count: 1, revealed: true };  // Báng súng Heavy
        this.slots[11] = { itemId: 'ammo_556', count: 111, revealed: true };          // Đạn 5.56mm
        this.slots[12] = { itemId: 'ammo_762', count: 65, revealed: true };           // Đạn 7.62mm
        this.slots[13] = { itemId: 'stun_grenade', count: 2, revealed: true };         // Lựu đạn gây choáng
    }

    // Vứt vật phẩm ra mặt đất
    dropItem(slotIndex) {
        const slot = this.slots[slotIndex];
        if (!slot) return null;
        const dropped = { ...slot };
        this.slots[slotIndex] = null;
        return dropped;
    }

    // Thêm vật phẩm vào ô trống đầu tiên hoặc gộp stack
    addItem(itemId, count = 1, revealed = true) {
        const itemDef = LOOT_ITEMS[itemId];
        if (!itemDef) return 0;

        let remaining = count;
        const stackLimit = itemDef.stackMax || 1;

        // 1. Thử gộp vào các ô có cùng itemId chưa đầy stack
        for (let i = 0; i < this.capacity; i++) {
            const slot = this.slots[i];
            if (slot && slot.itemId === itemId && slot.count < stackLimit) {
                const space = stackLimit - slot.count;
                const add = Math.min(space, remaining);
                slot.count += add;
                remaining -= add;
                if (remaining <= 0) return count;
            }
        }

        // 2. Cho vào ô trống đầu tiên
        for (let i = 0; i < this.capacity; i++) {
            if (!this.slots[i]) {
                const add = Math.min(stackLimit, remaining);
                this.slots[i] = { itemId, count: add, revealed: true };
                remaining -= add;
                if (remaining <= 0) return count;
            }
        }

        return count - remaining; // Số lượng đã nhặt thành công
    }

    removeItemAt(slotIndex, count = 1) {
        const slot = this.slots[slotIndex];
        if (!slot) return null;
        const removeCount = Math.min(slot.count, count);
        slot.count -= removeCount;
        const res = { itemId: slot.itemId, count: removeCount };
        if (slot.count <= 0) {
            this.slots[slotIndex] = null;
        }
        return res;
    }

    hasFreeSlot() {
        return this.slots.some(s => s === null);
    }

    // Hoán đổi hoặc di chuyển vật phẩm giữa 2 ô trong lưới
    swapSlots(fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx >= this.capacity || toIdx < 0 || toIdx >= this.capacity) return false;
        if (fromIdx === toIdx) return false;

        const itemA = this.slots[fromIdx];
        const itemB = this.slots[toIdx];

        // Nếu cùng itemId và có thể gộp stack
        if (itemA && itemB && itemA.itemId === itemB.itemId) {
            const def = LOOT_ITEMS[itemA.itemId];
            const maxStack = def?.stackMax || 1;
            if (itemB.count < maxStack) {
                const space = maxStack - itemB.count;
                const transfer = Math.min(space, itemA.count);
                itemB.count += transfer;
                itemA.count -= transfer;
                if (itemA.count <= 0) this.slots[fromIdx] = null;
                return true;
            }
        }

        this.slots[fromIdx] = itemB;
        this.slots[toIdx] = itemA;
        return true;
    }

    // Tự động sắp xếp (Auto-sort Button): Gom nhóm các hộp đạn và xếp phụ kiện, vật phẩm theo thứ tự tối ưu
    autoSort() {
        const gathered = [];

        // 1. Thu thập tất cả các vật phẩm hiện có
        for (let i = 0; i < this.capacity; i++) {
            if (this.slots[i]) {
                gathered.push({ ...this.slots[i] });
                this.slots[i] = null;
            }
        }

        // 2. Gom nhóm các item cùng loại có thể gộp stack
        const consolidated = [];
        for (const item of gathered) {
            const def = LOOT_ITEMS[item.itemId];
            const max = def?.stackMax || 1;
            let placed = false;

            if (max > 1) {
                for (const existing of consolidated) {
                    if (existing.itemId === item.itemId && existing.count < max) {
                        const space = max - existing.count;
                        const add = Math.min(space, item.count);
                        existing.count += add;
                        item.count -= add;
                        if (item.count <= 0) {
                            placed = true;
                            break;
                        }
                    }
                }
            }

            if (item.count > 0) {
                consolidated.push(item);
            }
        }

        // 3. Phân loại theo danh mục ưu tiên chiến thuật
        const categoryPriority = {
            weapon: 1,
            equipment: 2,
            attachment: 3,
            ammo: 4,
            medical: 5,
            grenade: 6,
            scrap: 7,
            valuable: 8
        };

        consolidated.sort((a, b) => {
            const defA = LOOT_ITEMS[a.itemId];
            const defB = LOOT_ITEMS[b.itemId];
            const pA = categoryPriority[defA?.category] || 99;
            const pB = categoryPriority[defB?.category] || 99;
            if (pA !== pB) return pA - pB;
            // Nếu cùng danh mục, xếp theo giá trị hoặc tên
            return (defB?.value || 0) - (defA?.value || 0);
        });

        // 4. Đặt lại vào lưới tuần tự từ ô đầu tiên
        for (let i = 0; i < Math.min(this.capacity, consolidated.length); i++) {
            this.slots[i] = consolidated[i];
        }

        sounds.play('switchWeapon', { volume: 0.8, rate: 1.4 });
        return true;
    }

    // Thử lắp trực tiếp phụ kiện vào vũ khí đang cầm nếu slot tương thích còn trống
    tryAutoEquipAttachment(slotIndex, weaponSystem) {
        const slot = this.slots[slotIndex];
        if (!slot || !weaponSystem) return false;

        const def = LOOT_ITEMS[slot.itemId];
        if (def?.category !== 'attachment' || !def.slot) return false;

        const attachSlot = def.slot; // 'muzzle', 'optic', 'magazine', 'grip'

        // Kiểm tra xem slot trên súng có đang trống không hoặc thay thế
        const currentMod = weaponSystem.attachments[attachSlot];
        const removedMod = weaponSystem.attachMod(attachSlot, slot.itemId);

        // Gỡ bỏ phụ kiện khỏi balo, nếu có phụ kiện cũ thì đưa lại vào ô này
        if (removedMod) {
            this.slots[slotIndex] = { itemId: removedMod, count: 1, revealed: true };
        } else {
            this.slots[slotIndex] = null;
        }

        return true;
    }
}

// Đối tượng Hòm đồ tương tác trong 3D Scene
export class LootContainer {
    constructor(scene, type, position, options = {}) {
        this.scene = scene;
        this.type = type;
        this.config = CONTAINER_CONFIGS[type] || CONTAINER_CONFIGS.wooden_crate;
        this.name = options.customName || this.config.name;
        this.position = position.clone();
        this.searchDuration = this.config.searchDuration;
        this.capacity = this.config.capacity;
        this.slots = new Array(this.capacity).fill(null);
        this.isSearched = false;
        this.isLooted = false;
        this.isOpen = false;
        this.id = options.id || ('container_' + Math.random().toString(36).substring(2, 9));

        this.mesh = null;
        this.smokeParticles = null;
        this.buildMesh();
        this.generateLoot();
    }

    // Sinh mô hình 3D cho Container dựa trên phân loại
    buildMesh() {
        const group = new THREE.Group();
        group.position.copy(this.position);

        if (this.type === 'wooden_crate') {
            // Hòm gỗ quân sự dã chiến: Tải mô hình 3D crate-medium chuẩn Kenney
            const fallbackGeo = new THREE.BoxGeometry(1.2, 0.75, 0.9);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: this.config.meshColor, roughness: 0.85 });
            const fallbackCrate = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallbackCrate.position.y = 0.38;
            group.add(fallbackCrate);

            getOrLoadModel('assets/models/kenney-blaster/crate-medium.glb', (model) => {
                model.scale.set(1.6, 1.6, 1.6);
                model.position.set(0, 0, 0);
                group.remove(fallbackCrate);
                fallbackGeo.dispose();
                fallbackMat.dispose();
                group.add(model);
            });
        } else if (this.type === 'military_safe') {
            // Két sắt quân sự chống đạn: Tải mô hình crate-wide với ánh sáng titan
            const fallbackGeo = new THREE.BoxGeometry(1.1, 0.9, 0.9);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
            const fallbackSafe = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallbackSafe.position.y = 0.45;
            group.add(fallbackSafe);

            getOrLoadModel('assets/models/kenney-blaster/crate-wide.glb', (model) => {
                model.scale.set(1.5, 1.5, 1.5);
                model.position.set(0, 0, 0);
                group.remove(fallbackSafe);
                fallbackGeo.dispose();
                fallbackMat.dispose();
                group.add(model);
            });
        } else if (this.type === 'dead_body') {
            // Xác chiến binh tử trận nằm cạnh túi đồ dã chiến
            const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            bodyMesh.rotation.z = Math.PI / 2;
            bodyMesh.rotation.y = Math.random() * Math.PI;
            bodyMesh.position.y = 0.2;
            bodyMesh.castShadow = true;

            const bagGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
            const bagMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
            const bagMesh = new THREE.Mesh(bagGeo, bagMat);
            bagMesh.position.set(0.45, 0.18, 0.25);

            group.add(bodyMesh, bagMesh);
        } else if (this.type === 'airdrop_crate') {
            // Hòm thính Airdrop: Dùng model crate-wide cỡ lớn kèm đèn tín hiệu
            const fallbackGeo = new THREE.BoxGeometry(1.5, 1.1, 1.5);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
            const crate = new THREE.Mesh(fallbackGeo, fallbackMat);
            crate.position.y = 0.55;
            group.add(crate);

            getOrLoadModel('assets/models/kenney-blaster/crate-wide.glb', (model) => {
                model.scale.set(2.0, 2.0, 2.0);
                model.position.set(0, 0, 0);
                group.remove(crate);
                fallbackGeo.dispose();
                fallbackMat.dispose();
                group.add(model);
            });

            // Đèn hải đăng chớp tín hiệu
            const beaconGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.45, 8);
            const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(0, 1.15, 0);
            group.add(beacon);
        }

        // Vòng sáng tương tác mở rộng dưới sàn (Bán kính 3.6m - 4.0m)
        const ringRadius = this.config.interactionRadius || 3.6;
        const ringGeo = new THREE.RingGeometry(ringRadius - 0.2, ringRadius, 36);
        const ringMat = new THREE.MeshBasicMaterial({
            color: this.config.accentColor || 0x00d0ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        group.add(ring);
        this.interactRing = ring;
        this.interactionRadius = ringRadius;

        this.scene.add(group);
        this.mesh = group;
    }

    // Sinh vật phẩm ngẫu nhiên và tự động sắp xếp Cấp bậc cao nhất lên trên cùng
    generateLoot() {
        const table = this.config.lootTable || [];
        const generated = [];

        // Hòm Thính Tiếp Tế (Airdrop): Chắc chắn có đồ Cấp 4 (Epic) hoặc Cấp 5 (Legendary)
        if (this.type === 'airdrop_crate') {
            const highTierItems = [
                'barrel_t5', 'magazine_t5', 'optic_t5', 'grip_t5', 'gun_nova_t5',
                'barrel_t4', 'magazine_t4', 'optic_t4', 'grip_t4', 'gun_plasma_t4'
            ];
            const guaranteed = highTierItems[Math.floor(Math.random() * highTierItems.length)];
            generated.push({ itemId: guaranteed, count: 1, revealed: true });
            generated.push({ itemId: 'medkit', count: Math.floor(Math.random() * 2) + 1, revealed: true });
        }

        for (const entry of table) {
            if (generated.length >= this.capacity) break;
            if (Math.random() <= entry.chance) {
                if (!generated.some(g => g.itemId === entry.itemId)) {
                    const count = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
                    generated.push({
                        itemId: entry.itemId,
                        count: count,
                        revealed: true
                    });
                }
            }
        }

        if (generated.length === 0 && table.length > 0) {
            generated.push({ itemId: table[0].itemId, count: 1, revealed: true });
        }

        // Tự động sắp xếp ưu tiên: Cấp bậc cao nhất nằm TRÊN CÙNG
        this.slots = this.sortLootList(generated, this.capacity);
    }

    sortLootList(items, capacity) {
        items.sort((a, b) => {
            const defA = th_resolveLootItem(a.itemId);
            const defB = th_resolveLootItem(b.itemId);
            const tierA = defA?.tier || 1;
            const tierB = defB?.tier || 1;
            if (tierB !== tierA) return tierB - tierA; // Cấp bậc cao hơn xếp trước
            if (defA?.category === 'weapon' && defB?.category !== 'weapon') return -1;
            if (defB?.category === 'weapon' && defA?.category !== 'weapon') return 1;
            return 0;
        });
        const result = new Array(capacity).fill(null);
        for (let i = 0; i < Math.min(capacity, items.length); i++) {
            result[i] = items[i];
        }
        return result;
    }

    generateLootSort() {
        const remaining = this.slots.filter(s => s && s.itemId);
        this.slots = this.sortLootList(remaining, this.capacity);
    }

    // Kiểm tra xem hòm đã bị lấy sạch đồ chưa
    checkEmpty() {
        this.isLooted = this.slots.every(s => s === null);
        if (this.interactRing) {
            this.interactRing.material.opacity = this.isLooted ? 0.1 : 0.45;
        }
        return this.isLooted;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.removeFromParent();
            this.mesh.traverse(c => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
        }
    }
}

// Đối tượng Hòm Thính Rơi Từ Bầu Trời (Airdrop Drop Simulation)
export class AirdropDropEntity {
    constructor(scene, targetPos, lootingSystem) {
        this.scene = scene;
        this.lootingSystem = lootingSystem;
        this.targetPos = targetPos.clone();
        this.currentPos = new THREE.Vector3(targetPos.x, 34, targetPos.z);
        this.fallSpeed = 5.2; // Tốc độ hạ cánh
        this.landed = false;
        this.smokeTimer = 75; // Khói đỏ nghi ngút phụt lên trong 75 giây
        this.group = new THREE.Group();

        // 1. Thùng hàng thính Airdrop
        const boxGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.position.y = 0.6;
        boxMesh.castShadow = true;
        this.group.add(boxMesh);

        getOrLoadModel('assets/models/kenney-blaster/crate-wide.glb', (model) => {
            model.scale.set(2.0, 2.0, 2.0);
            model.position.set(0, 0, 0);
            this.group.remove(boxMesh);
            boxGeo.dispose();
            boxMat.dispose();
            this.group.add(model);
        });

        // 2. Dù lượn đơn giản (Parachute dome)
        const chuteGeo = new THREE.SphereGeometry(2.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
        const chuteMat = new THREE.MeshStandardMaterial({
            color: 0xff4422,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        const chuteMesh = new THREE.Mesh(chuteGeo, chuteMat);
        chuteMesh.position.y = 3.6;
        this.chuteMesh = chuteMesh;

        // 4 dây dù nối từ dù xuống 4 góc hòm
        const linesGeo = new THREE.BufferGeometry();
        const linePositions = new Float32Array([
            0, 3.5, 0, -0.7, 1.2, -0.7,
            0, 3.5, 0,  0.7, 1.2, -0.7,
            0, 3.5, 0,  0.7, 1.2,  0.7,
            0, 3.5, 0, -0.7, 1.2,  0.7
        ]);
        linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const linesMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const linesMesh = new THREE.LineSegments(linesGeo, linesMat);
        this.linesMesh = linesMesh;

        // 3. Vòng tròn bóng đổ (Shadow Ring) trên mặt đất to dần khi hạ cánh
        const shadowGeo = new THREE.RingGeometry(0.2, 1.6, 24);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x0a0a0a,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.set(targetPos.x, 0.04, targetPos.z);
        this.scene.add(this.shadowMesh);

        this.group.add(boxMesh, chuteMesh, linesMesh);
        this.group.position.copy(this.currentPos);
        this.scene.add(this.group);
    }

    update(delta, particles, enemies) {
        if (!this.landed) {
            // Hạ cánh dần theo trục Y
            this.currentPos.y -= this.fallSpeed * delta;
            this.group.position.copy(this.currentPos);

            // Bóng đổ trên mặt đất nở to và đậm dần khi hòm tiếp cận mặt đất
            const heightRatio = Math.max(0, Math.min(1, (34 - this.currentPos.y) / 34));
            const shadowScale = 0.4 + heightRatio * 0.9;
            this.shadowMesh.scale.set(shadowScale, shadowScale, 1);
            this.shadowMesh.material.opacity = 0.15 + heightRatio * 0.65;

            // Nhẹ nhàng chao liệng dù
            this.chuteMesh.rotation.z = Math.sin(performance.now() * 0.003) * 0.08;

            if (this.currentPos.y <= 0.0) {
                this.landed = true;
                this.currentPos.y = 0;
                this.group.position.y = 0;

                // Ẩn dù và dây dù khi tiếp đất
                this.chuteMesh.visible = false;
                this.linesMesh.visible = false;
                sounds.play('land', { volume: 0.95 });

                // Tạo container Airdrop chính thức
                this.container = this.lootingSystem.spawnContainer('airdrop_crate', this.targetPos);

                // Kích động đàn zombie xung quanh lao tới hòm thính
                this.lootingSystem.alertEnemies(this.targetPos, 26.0);
            }
        } else {
            // Sau khi tiếp đất: Khói hiệu ứng màu đỏ phụt lên liên tục trong 60-90 giây
            if (this.smokeTimer > 0) {
                this.smokeTimer -= delta;
                if (Math.random() < 0.45 && particles) {
                    const smokePos = this.targetPos.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 0.6,
                        1.2 + Math.random() * 0.8,
                        (Math.random() - 0.5) * 0.6
                    ));
                    particles.createImpactSparks(smokePos, new THREE.Vector3(0, 1, 0), 0xff2200, 3);
                }
            }
        }
    }

    dispose() {
        if (this.group) {
            this.group.removeFromParent();
            this.group.traverse(c => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
        }
        if (this.shadowMesh) {
            this.shadowMesh.removeFromParent();
            this.shadowMesh.geometry.dispose();
            this.shadowMesh.material.dispose();
        }
    }
}

// Hệ thống Điều Phối Looting & Airdrop Toàn Diện
export class LootingSystem {
    constructor(scene, particles, player, waveManager, ui) {
        this.scene = scene;
        this.particles = particles;
        this.player = player;
        this.waveManager = waveManager;
        this.ui = ui;

        this.inventory = new PlayerInventory(5, 6);
        this.containers = [];
        this.airdropDrops = [];

        // Trạng thái Balo và Lục hòm hiện thời
        this.isBackpackOpen = false;
        this.activeContainer = null;
        this.isSearching = false;
        this.searchTimer = 0;
        this.searchDuration = 2.0;

        // Trạng thái nhận diện từng ô (Item Reveal)
        this.revealingSlotIndex = -1;
        this.revealTimer = 0;
        this.revealDuration = 0.5;

        // Chu kỳ Airdrop Event
        this.airdropInterval = 90; // Xuất hiện mỗi 90 giây
        this.airdropCountdown = 60; // Lần đầu tiên rơi ở giây thứ 60
        this.activeAirdropZone = null;

        this.initEventListeners();
    }

    initEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat || e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
            if (window.game?.state !== 'PLAYING') return;

            // Phím [F] cơ chế 1-Phím Thông Minh (Smart 1-Key Swap & Open)
            if (e.code === 'KeyF') {
                if (this.isSearching) {
                    this.cancelSearch();
                } else if (this.activeContainer && this.activeContainer.isOpen) {
                    // Nếu hòm đang mở: Bấm [F] nhặt ngay món đồ Cấp cao nhất!
                    this.th_smartLootCrate(this.activeContainer);
                } else {
                    this.tryStartSearch();
                }
            }
            // Phím [Space] để nhặt toàn bộ đồ khi đang mở hòm
            if (e.code === 'Space' && this.isBackpackOpen && this.activeContainer?.isOpen) {
                e.preventDefault();
                this.lootAll();
            }
            // Phím [Escape] để đóng hòm đồ / balo
            if (e.code === 'Escape' && this.isBackpackOpen) {
                e.preventDefault();
                this.closeContainerUI();
            }
        });
    }

    // Bật tắt Balo túi đồ [Phím B]
    toggleBackpack() {
        if (this.isBackpackOpen) {
            this.closeContainerUI();
        } else {
            this.openBackpack();
        }
    }

    // Mở Balo túi đồ người chơi
    openBackpack() {
        this.isBackpackOpen = true;
        this.player.keys = {};
        this.player.mouseButtons = { left: false, right: false };
        this.ui?.openSmartInventory(this.inventory, this.activeContainer, this);
        if (this.player) {
            this.player.isBackpackOpen = true;
            this.player.domElement.style.cursor = 'default';
        }
    }

    // Sinh hòm đồ mới trong bản đồ
    spawnContainer(type, position, options = {}) {
        const container = new LootContainer(this.scene, type, position, options);
        this.containers.push(container);
        return container;
    }

    // Rải số lượng tối thiểu hòm đồ khi bắt đầu game (tránh làm tràn ngập hòm trên sàn đấu)
    spawnInitialContainers(arena) {
        this.clearAll();
        // Chỉ để duy nhất 1 thùng gỗ quân trang dã chiến ở góc xa để người chơi làm quen
        this.spawnContainer('wooden_crate', new THREE.Vector3(-12, 0, -10));
    }

    // Xử lý rơi hòm đồ khi tiêu diệt quái vật theo các tỷ lệ nhỏ
    handleEnemyKilled(enemy) {
        if (!enemy || !enemy.position) return;

        // Giới hạn số lượng hòm đồ tối đa đồng thời trên sân để giữ map gọn gàng
        const MAX_ACTIVE_CONTAINERS = 6;
        if (this.containers.length >= MAX_ACTIVE_CONTAINERS) return;

        const rand = Math.random();
        let dropType = null;

        // Phân loại tỷ lệ rơi đồ theo từng loại quái vật
        switch (enemy.type) {
            case 'boss':
                // Boss chắc chắn rơi Két sắt quân sự chống đạn chứa đồ giá trị cao
                dropType = 'military_safe';
                break;

            case 'giant':
            case 'tank':
                // Quái đột biến khổng lồ: 16% tỷ lệ rơi
                if (rand < 0.16) {
                    dropType = Math.random() < 0.35 ? 'military_safe' : 'wooden_crate';
                }
                break;

            case 'spitter':
                // Quái phun độc: 7% tỷ lệ rơi
                if (rand < 0.07) {
                    dropType = Math.random() < 0.6 ? 'wooden_crate' : 'dead_body';
                }
                break;

            case 'sprinter':
            case 'walker':
            default:
                // Quái thường: Tỷ lệ rơi nhỏ 3.5%
                if (rand < 0.035) {
                    dropType = Math.random() < 0.75 ? 'wooden_crate' : 'dead_body';
                }
                break;
        }

        if (dropType) {
            // Giữ hòm đồ nằm trong giới hạn di chuyển an toàn của sàn đấu
            const dropX = Math.max(-20, Math.min(20, enemy.position.x));
            const dropZ = Math.max(-20, Math.min(20, enemy.position.z));
            const dropPos = new THREE.Vector3(dropX, 0, dropZ);

            this.spawnContainer(dropType, dropPos);
            sounds.play('land', { volume: 0.45, rate: 1.3 });

            const cfg = CONTAINER_CONFIGS[dropType];
            const containerName = cfg ? cfg.name : 'HÒM ĐỒ';
            this.ui?.showPickupAlert(`CHIẾN LỢI PHẨM: ${containerName.toUpperCase()} ĐÃ RƠI RA!`);
        }
    }

    // Tìm hòm đồ gần người chơi nhất trong bán kính tương tác (3.8m)
    getNearestInteractableContainer() {
        if (!this.player || this.player.isDead) return null;
        let nearest = null;
        let minDist = 3.8;

        for (const c of this.containers) {
            const range = (c.interactionRadius || 3.6);
            const d = this.player.position.distanceTo(c.position);
            if (d <= range && d < minDist) {
                minDist = d;
                nearest = c;
            }
        }
        return nearest;
    }

    // Bắt đầu tiến trình mở hòm khi đứng trong phạm vi
    tryStartSearch(targetContainer = null) {
        const container = targetContainer || this.getNearestInteractableContainer();
        if (!container || container.isOpen) return false;
        if (this.isSearching && this.activeContainer === container) return true;

        this.activeContainer = container;
        this.isSearching = true;
        this.searchDuration = container.searchDuration;
        this.searchTimer = this.searchDuration;

        // Cơ chế mới: KHÔNG khóa di chuyển và KHÔNG khóa bắn súng
        // Người chơi vẫn có thể chạy nhảy né đòn và xả súng tự do trong lúc mở hòm!
        this.player.isSearching = false;

        // Âm thanh mở hòm cơ khí
        sounds.playSearchSound?.();

        // Hiển thị thanh thời gian đếm ngược trên UI
        this.ui?.showSearchProgress(this.searchDuration, container.name);
        return true;
    }

    // Hủy tiến trình mở hòm khi người chơi chạy hẳn ra ngoài phạm vi
    cancelSearch() {
        if (!this.isSearching) return;
        this.isSearching = false;
        this.searchTimer = 0;
        this.player.isSearching = false;
        this.ui?.hideSearchProgress();
        this.ui?.showPickupAlert('ĐÃ RỜI KHỎI PHẠM VI MỞ HÒM');
    }

    // Hoàn tất mở hòm: Hiển thị giao diện In-World PUBG Mini Crate UI ngay dưới thanh tiến trình
    completeSearch() {
        this.isSearching = false;
        this.player.isSearching = false;
        this.ui?.hideSearchProgress();

        if (!this.activeContainer) return;
        const container = this.activeContainer;
        container.isOpen = true;
        sounds.playClearJam(); // Tiếng khóa mở hòm cơ khí

        // Hiển thị PUBG Mini Crate UI (góc nhìn thông thoáng 100%, không che màn hình)
        this.openContainerUI(container);
    }

    // Mở giao diện Hòm đồ PUBG Mini
    openContainerUI(container) {
        if (!container) return;
        this.activeContainer = container;
        container.isOpen = true;
        this.ui?.showPUBGMiniCrate(container, this);
    }

    // Đóng giao diện Hòm đồ PUBG Mini
    closeContainerUI() {
        if (this.activeContainer) {
            this.activeContainer.isOpen = false;
            if (this.activeContainer.checkEmpty()) {
                const idx = this.containers.indexOf(this.activeContainer);
                if (idx !== -1) {
                    this.activeContainer.dispose();
                    this.containers.splice(idx, 1);
                }
            }
            this.activeContainer = null;
        }
        this.ui?.hidePUBGMiniCrate();
    }

    // Cơ chế Nhặt & Hoán đổi 1-Phím [F] (Smart 1-Key Swap)
    th_smartLootCrate(targetContainer = null, targetSlotIndex = -1) {
        const container = targetContainer || this.activeContainer;
        if (!container || !container.isOpen) return false;

        const validItems = container.slots
            .map((s, idx) => s && s.itemId ? { ...s, slotIndex: idx } : null)
            .filter(Boolean);

        if (validItems.length === 0) {
            this.closeContainerUI();
            return false;
        }

        let selected = null;
        if (targetSlotIndex >= 0 && container.slots[targetSlotIndex]) {
            selected = { ...container.slots[targetSlotIndex], slotIndex: targetSlotIndex };
        } else {
            // Mặc định chọn món có Cấp bậc cao nhất nằm trên cùng
            selected = validItems[0];
        }

        if (!selected) return false;
        const def = th_resolveLootItem(selected.itemId);
        if (!def) return false;

        const weapons = this.player?.weapons;
        if (!weapons) return false;

        // 1. VẬT PHẨM Y TẾ DUY NHẤT (FIRST AID KIT) -> Bấm [F] nhặt ngay, tự dồn vào số lượng máu dự trữ
        if (def.category === 'medical' || selected.itemId === 'medkit') {
            weapons.inventory.medkits = (weapons.inventory.medkits || 0) + (selected.count || 1);
            container.slots[selected.slotIndex] = null;
            sounds.playMedkit?.();
            this.ui?.showPickupAlert('ĐÃ NHẶT TÚI CỨU THƯƠNG (+1)');
            container.checkEmpty();
            this.ui?.refreshPUBGMiniCrate(container, this);
            return true;
        }

        // 2. LINH KIỆN PHỤ KIỆN (ATTACHMENT) -> Gắn thẳng hoặc Smart Swap Cấp Cao
        if (def.category === 'attachment') {
            const attachSlot = def.slot; // 'barrel', 'magazine', 'optic', 'grip'
            const itemTier = def.tier || 1;
            const currentGunIdx = weapons.currentSlotIndex === 1 ? 1 : 0;
            const currentAttachMap = weapons.getAttachmentsForGun ? weapons.getAttachmentsForGun(currentGunIdx) : weapons.attachments;
            const currentModId = currentAttachMap ? currentAttachMap[attachSlot] : null;

            // Nếu slot tương ứng trên súng còn trống -> Gắn thẳng vào súng
            if (!currentModId) {
                weapons.attachMod(attachSlot, selected.itemId, currentGunIdx);
                container.slots[selected.slotIndex] = null;
                sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
                this.ui?.showPickupAlert(`ĐÃ LẮP [${def.name.toUpperCase()}] LÊN SÚNG!`);
                container.checkEmpty();
                this.ui?.refreshPUBGMiniCrate(container, this);
                return true;
            }

            // Nếu súng ĐÃ CÓ phụ kiện đó: So sánh Tier
            const currentTier = ATTACHMENT_DEFS[currentModId]?.tier || 1;

            if (itemTier > currentTier) {
                // TỰ ĐỘNG SWAP: Lắp phụ kiện cấp cao vào súng, vứt phụ kiện cũ lại hòm
                const oldModId = weapons.attachMod(attachSlot, selected.itemId, currentGunIdx);
                container.slots[selected.slotIndex] = {
                    itemId: oldModId,
                    count: 1,
                    revealed: true
                };
                sounds.play('switchWeapon', { volume: 1.0, rate: 1.45 });
                this.ui?.showPickupAlert(`NÂNG CẤP THÀNH CÔNG: [${def.name.toUpperCase()}] (HOÁN ĐỔI CẤP CŨ)`);
                container.generateLootSort?.();
                this.ui?.refreshPUBGMiniCrate(container, this);
                return true;
            } else {
                // Kiểm tra xem súng phụ (Khẩu 2) có lắp được không
                const secGunIdx = (currentGunIdx === 0) ? 1 : 0;
                const secAttachMap = weapons.getAttachmentsForGun ? weapons.getAttachmentsForGun(secGunIdx) : {};
                const secModId = secAttachMap[attachSlot];
                if (!secModId) {
                    weapons.attachMod(attachSlot, selected.itemId, secGunIdx);
                    container.slots[selected.slotIndex] = null;
                    sounds.play('switchWeapon', { volume: 0.9, rate: 1.35 });
                    this.ui?.showPickupAlert(`ĐÃ LẮP [${def.name.toUpperCase()}] LÊN SÚNG PHỤ!`);
                    container.checkEmpty();
                    this.ui?.refreshPUBGMiniCrate(container, this);
                    return true;
                }
                const secTier = ATTACHMENT_DEFS[secModId]?.tier || 1;
                if (itemTier > secTier) {
                    const oldModId = weapons.attachMod(attachSlot, selected.itemId, secGunIdx);
                    container.slots[selected.slotIndex] = {
                        itemId: oldModId,
                        count: 1,
                        revealed: true
                    };
                    sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
                    this.ui?.showPickupAlert(`NÂNG CẤP CHO SÚNG PHỤ: [${def.name.toUpperCase()}]`);
                    container.generateLootSort?.();
                    this.ui?.refreshPUBGMiniCrate(container, this);
                    return true;
                }

                // Cả hai súng đều có cấp bằng hoặc cao hơn -> Cảnh báo
                this.ui?.showPickupAlert(`PHỤ KIỆN [${def.name}] CẤP THẤP HƠN TRANG BỊ ĐANG CÓ!`);
                return false;
            }
        }

        // 3. SÚNG (WEAPON) -> Nhặt vào súng phụ hoặc đổi lấy súng đang cầm trên tay
        if (def.category === 'weapon') {
            const baseGunId = def.baseWeaponId || 'repeater';
            const newTier = def.tier || 2;
            const gunConfig = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS].find(w => w.id === baseGunId) || WEAPON_CONFIGS[0];
            const newGun = {
                ...gunConfig,
                tier: newTier,
                color: def.color ? parseInt(def.color.replace('#', '0x'), 16) : gunConfig.color
            };

            const currentGunIdx = weapons.currentSlotIndex === 1 ? 1 : 0;
            const currentGun = weapons.weaponSlots[currentGunIdx];

            // Đổi súng
            weapons.weaponSlots[currentGunIdx] = newGun;
            weapons.ammo[newGun.id] = newGun.magSize;
            weapons.reserve[newGun.id] = Infinity;
            if (currentGunIdx === 1) weapons.secondaryWeapon = newGun;

            // Đặt lại súng cũ vào hòm
            const oldGunId = `gun_${currentGun.id}_t${currentGun.tier || 1}`;
            container.slots[selected.slotIndex] = {
                itemId: LOOT_ITEMS[oldGunId] ? oldGunId : selected.itemId,
                count: 1,
                revealed: true
            };

            sounds.play('switchWeapon', { volume: 1.0, rate: 1.1 });
            if (weapons.handNode) weapons.attachToArm(weapons.handNode);
            this.ui?.showPickupAlert(`ĐÃ TRANG BỊ [${newGun.name}] CẤP ${newTier}!`);
            this.ui?.refreshPUBGMiniCrate(container, this);
            return true;
        }

        return false;
    }

    // Nhận diện từng ô vật phẩm (Item Reveal - 0.5s Search Time mỗi ô)
    startRevealItem(slotIndex) {
        if (!this.activeContainer || slotIndex < 0 || slotIndex >= this.activeContainer.slots.length) return;
        const slot = this.activeContainer.slots[slotIndex];
        if (!slot || slot.revealed) return;

        this.revealingSlotIndex = slotIndex;
        this.revealTimer = this.revealDuration;
        sounds.playSearchSound?.();
        this.ui?.updateRevealingProgress(slotIndex, 0);
    }

    // Thao tác nhặt đồ thông minh (Smart QoL Action): Shift + Click hoặc Double Click
    smartLootItem(slotIndex) {
        if (!this.activeContainer) return;
        const slot = this.activeContainer.slots[slotIndex];
        if (!slot) return;
        slot.revealed = true;

        const def = LOOT_ITEMS[slot.itemId];
        // 1. Nếu là phụ kiện súng: kiểm tra xem súng còn trống slot tương ứng không
        if (def?.category === 'attachment' && def.slot && this.player?.weapons) {
            const attachSlot = def.slot;
            if (!this.player.weapons.attachments[attachSlot]) {
                // Slot súng đang trống: Lắp thẳng lên súng!
                this.player.weapons.attachMod(attachSlot, slot.itemId);
                this.activeContainer.slots[slotIndex] = null;
                sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
                this.ui?.showPickupAlert(`ĐÃ TỰ ĐỘNG LẮP [${def.name.toUpperCase()}] LÊN SÚNG!`);
                this.activeContainer.checkEmpty();
                this.ui?.refreshSmartInventory();
                return;
            }
        }

        // 2. Nếu không phải phụ kiện hoặc slot súng đã có: Chuyển vào Balo
        const added = this.inventory.addItem(slot.itemId, slot.count, true);
        if (added > 0) {
            slot.count -= added;
            if (slot.count <= 0) {
                this.activeContainer.slots[slotIndex] = null;
            }
            sounds.playLootTransferSound?.();
            this.activeContainer.checkEmpty();
            this.ui?.refreshSmartInventory();
        } else {
            this.ui?.showPickupAlert('TÚI ĐỒ ĐÃ ĐẦY! KHÔNG THỂ NHẶT THÊM');
        }
    }

    // Chuyển thẳng vật phẩm sang túi bên kia (Shift + Click)
    transferItem(fromSide, slotIndex) {
        if (!this.activeContainer) return;

        if (fromSide === 'container') {
            this.smartLootItem(slotIndex);
        } else if (fromSide === 'player') {
            const slot = this.inventory.slots[slotIndex];
            if (!slot) return;
            // Tìm ô trống trong hòm
            const emptyIdx = this.activeContainer.slots.findIndex(s => s === null);
            if (emptyIdx !== -1) {
                this.activeContainer.slots[emptyIdx] = { ...slot, revealed: true };
                this.inventory.slots[slotIndex] = null;
                sounds.playLootTransferSound?.();
                this.activeContainer.checkEmpty();
                this.ui?.refreshSmartInventory();
            } else {
                this.ui?.showPickupAlert('HÒM ĐỒ ĐÃ CHẬT CHỖ!');
            }
        }
    }

    // Lấy danh sách toàn bộ vật phẩm lân cận (từ hòm đang mở hoặc các hòm trong tầm)
    getNearbyItems() {
        const items = [];
        if (this.activeContainer) {
            this.activeContainer.slots.forEach((s, idx) => {
                if (s && s.itemId) {
                    items.push({
                        ...s,
                        source: 'container',
                        container: this.activeContainer,
                        slotIndex: idx
                    });
                }
            });
            return items;
        }

        // Quét các hòm trong phạm vi 6.5m xung quanh người chơi
        if (this.player && this.player.position) {
            for (const c of this.containers) {
                const dist = this.player.position.distanceTo(c.position);
                if (dist <= 6.5) {
                    c.slots.forEach((s, idx) => {
                        if (s && s.itemId) {
                            items.push({
                                ...s,
                                source: 'container',
                                container: c,
                                slotIndex: idx
                            });
                        }
                    });
                }
            }
        }
        return items;
    }

    // Nhặt 1 vật phẩm từ danh sách lân cận
    lootNearbyItem(itemEntry) {
        if (!itemEntry || !itemEntry.container) return false;
        const container = itemEntry.container;
        const slotIndex = itemEntry.slotIndex;
        const slot = container.slots[slotIndex];
        if (!slot) return false;

        const def = LOOT_ITEMS[slot.itemId];
        // Nếu là phụ kiện và súng còn slot trống thì tự động gắn thẳng lên súng!
        if (def?.category === 'attachment' && def.slot && this.player?.weapons) {
            const attachSlot = def.slot;
            if (!this.player.weapons.attachments[attachSlot]) {
                this.player.weapons.attachMod(attachSlot, slot.itemId);
                container.slots[slotIndex] = null;
                sounds.playAttachmentEquip?.();
                this.ui?.showPickupAlert(`ĐÃ TỰ ĐỘNG LẮP [${def.name.toUpperCase()}] LÊN SÚNG!`);
                container.checkEmpty();
                this.ui?.refreshSmartInventory();
                return true;
            }
        }

        // Chuyển vào Balo
        const added = this.inventory.addItem(slot.itemId, slot.count, true);
        if (added > 0) {
            slot.count -= added;
            if (slot.count <= 0) {
                container.slots[slotIndex] = null;
            }
            sounds.playItemMove?.();
            container.checkEmpty();
            this.ui?.refreshSmartInventory();
            return true;
        } else {
            this.ui?.showPickupAlert('BA LÔ ĐÃ ĐẦY! KHÔNG THỂ NHẶT THÊM');
            return false;
        }
    }

    // Vứt vật phẩm từ balo ra mặt đất
    dropItemFromBackpack(slotIndex) {
        const dropped = this.inventory.dropItem(slotIndex);
        if (!dropped) return;
        const def = LOOT_ITEMS[dropped.itemId];
        sounds.playItemMove?.();
        this.ui?.showPickupAlert(`ĐÃ VỨT [${def?.name?.toUpperCase() || dropped.itemId}] RA MẶT ĐẤT`);
        this.ui?.refreshSmartInventory();
    }

    // Nhặt toàn bộ đồ tương thích (Loot All / Phím Space)
    lootAll() {
        const nearby = this.getNearbyItems();
        if (nearby.length === 0) {
            this.ui?.showPickupAlert('KHÔNG CÓ VẬT PHẨM LÂN CẬN ĐỂ NHẶT!');
            return;
        }

        let transferred = 0;
        for (const item of nearby) {
            if (this.lootNearbyItem(item)) {
                transferred++;
            }
        }

        if (transferred > 0) {
            sounds.playItemMove?.();
            this.ui?.showPickupAlert(`ĐÃ NHẶT TOÀN BỘ VẬT PHẨM LÂN CẬN`);
            this.ui?.refreshSmartInventory();
        }
    }

    // Sử dụng vật phẩm từ túi đồ
    useItem(slotIndex) {
        const slot = this.inventory.slots[slotIndex];
        if (!slot) return;
        const itemDef = LOOT_ITEMS[slot.itemId];
        if (!itemDef || !itemDef.effect) return;

        const effect = itemDef.effect;
        let used = false;

        if (effect.type === 'heal') {
            this.player.heal(effect.amount);
            used = true;
        } else if (effect.type === 'add_ammo') {
            this.player.weapons.addAmmo(effect.packs);
            used = true;
        } else if (effect.type === 'equip_armor') {
            this.player.maxShield += effect.bonusShield;
            this.player.rechargeShield(this.player.maxShield);
            used = true;
        } else if (effect.type === 'score') {
            if (typeof window.game !== 'undefined') {
                window.game.score += effect.points;
            }
            used = true;
        } else if (effect.type === 'explosive_grenade') {
            // Ném lựu đạn nổ phá: Kích nổ tại vị trí ngắm hoặc trước mặt người chơi
            const targetPos = this.player.aimPoint ? this.player.aimPoint.clone() : this.player.position.clone();
            targetPos.y = 0.5;
            const radius = effect.radius || 6.5;
            const dmg = effect.damage || 260;

            // Gây sát thương diện rộng cho toàn bộ zombie trong bán kính nổ
            if (this.waveManager?.enemies) {
                for (const enemy of this.waveManager.enemies) {
                    if (enemy.isDead) continue;
                    const d = enemy.position.distanceTo(targetPos);
                    if (d <= radius) {
                        const falloff = 1 - (d / radius) * 0.45;
                        enemy.takeDamage(dmg * falloff, this.player.position);
                    }
                }
            }
            // Rung màn hình và tạo chấn động
            this.player.applyKickbackAndShake?.(4.0, 0.45);
            sounds.playExplosion?.();
            used = true;
        } else if (effect.type === 'smoke_grenade') {
            // Ném lựu đạn khói: Làm chậm và che mắt quái vật trong 10 giây
            const targetPos = this.player.aimPoint ? this.player.aimPoint.clone() : this.player.position.clone();
            if (this.waveManager?.enemies) {
                for (const enemy of this.waveManager.enemies) {
                    if (enemy.isDead) continue;
                    if (enemy.position.distanceTo(targetPos) <= 9.0) {
                        if (enemy.speed) enemy.speed *= (1 - effect.slow);
                    }
                }
            }
            sounds.play('land', { volume: 0.8, rate: 0.8 });
            used = true;
        }

        if (used) {
            sounds.playPickup('health');
            this.inventory.removeItemAt(slotIndex, 1);
            this.ui?.refreshDualInventory();
            this.ui?.showPickupAlert(`ĐÃ SỬ DỤNG: ${itemDef.name}`);
        }
    }

    // Kích hoạt sự kiện Hòm Tiếp Tế Rơi (Airdrop Event)
    triggerAirdropEvent() {
        const px = this.player ? this.player.position.x : 0;
        const pz = this.player ? this.player.position.z : 0;
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 10;
        const dropX = Math.max(-20, Math.min(20, px + Math.cos(angle) * dist));
        const dropZ = Math.max(-20, Math.min(20, pz + Math.sin(angle) * dist));
        const targetPos = new THREE.Vector3(dropX, 0, dropZ);

        // 1. Âm thanh máy bay vận tải gầm rú trên bầu trời pan từ loa trái sang phải
        sounds.playAirdropPlaneSound?.();

        // 2. Banner cảnh báo hình ảnh toàn màn hình
        this.ui?.showBanner('CẢNH BÁO: HÒM THÍNH TIẾP TẾ CHIẾN THUẬT ĐANG THẢ DÙ!');

        // 3. Đánh dấu vòng tròn đỏ trên bản đồ Tactical Radar
        this.activeAirdropZone = { x: dropX, z: dropZ, radius: 4.5, time: 40 };

        // 4. Sinh mô phỏng rơi thùng hàng và dù
        const airdropDrop = new AirdropDropEntity(this.scene, targetPos, this);
        this.airdropDrops.push(airdropDrop);
    }

    // Cảnh báo zombie trong bán kính nghe thấy âm thanh
    alertEnemies(position, radius) {
        if (!this.waveManager?.enemies) return;
        for (const enemy of this.waveManager.enemies) {
            if (enemy.isDead) continue;
            if (enemy.position.distanceTo(position) <= radius) {
                // Kích động quái vật hướng về vị trí tiếng ồn
                if (enemy.velocity) {
                    const toNoise = position.clone().sub(enemy.position).normalize();
                    enemy.velocity.addScaledVector(toNoise, 3.5);
                }
            }
        }
    }

    // Cập nhật hệ sinh thái Looting & Airdrop mỗi frame
    update(delta) {
        // 1. Quản lý chu kỳ Airdrop Event
        this.airdropCountdown -= delta;
        if (this.airdropCountdown <= 0) {
            this.airdropCountdown = this.airdropInterval;
            this.triggerAirdropEvent();
        }

        // Cập nhật marker Airdrop trên radar
        if (this.activeAirdropZone) {
            this.activeAirdropZone.time -= delta;
            if (this.activeAirdropZone.time <= 0) {
                this.activeAirdropZone = null;
            }
        }

        // Cập nhật các hòm thính đang rơi
        for (let i = this.airdropDrops.length - 1; i >= 0; i--) {
            const drop = this.airdropDrops[i];
            drop.update(delta, this.particles, this.waveManager?.enemies);
            if (drop.landed && drop.smokeTimer <= 0) {
                drop.dispose();
                this.airdropDrops.splice(i, 1);
            }
        }

        // 2. Kiểm tra tiến trình mở hòm theo phạm vi (Range-based Proximity Opening)
        const nearest = this.getNearestInteractableContainer();

        // Tự động kích hoạt mở hòm ngay khi người chơi bước vào vùng sáng của hòm
        // Không cần nhấn phím, không chặn bắn súng hay di chuyển
        if (nearest && !nearest.isOpen && !this.isSearching) {
            this.tryStartSearch(nearest);
        }

        // Nếu hòm đang mở: tự động đóng khi người chơi di chuyển ra xa
        if (this.activeContainer && this.activeContainer.isOpen) {
            const dist = this.player.position.distanceTo(this.activeContainer.position);
            const maxRange = (this.activeContainer.interactionRadius || 3.6) + 1.2;
            if (dist > maxRange) {
                this.closeContainerUI();
            }
        }

        if (this.isSearching && this.activeContainer) {
            const dist = this.player.position.distanceTo(this.activeContainer.position);
            const maxRange = (this.activeContainer.interactionRadius || 3.6) + 0.6;

            // Chỉ hủy tiến trình khi người chơi chạy hẳn ra ngoài phạm vi vòng sáng
            if (dist > maxRange) {
                this.cancelSearch();
            } else {
                // Người chơi đang ở trong vòng: Tiến trình tiếp tục đếm, người chơi vẫn tự do chạy nhảy và xả súng
                this.searchTimer -= delta;
                const progress = 1 - Math.max(0, this.searchTimer / this.searchDuration);
                this.ui?.updateSearchProgress(progress, this.searchTimer);

                // Hiệu ứng vòng sáng xoay nhẹ thể hiện đang mở hòm
                if (this.activeContainer.interactRing) {
                    this.activeContainer.interactRing.rotation.z += delta * 1.8;
                    this.activeContainer.interactRing.material.opacity = 0.5 + 0.3 * Math.sin(performance.now() * 0.009);
                }

                if (this.searchTimer <= 0) {
                    this.completeSearch();
                }
            }
        }

        // 3. Tiến trình nhận diện từng ô vật phẩm (Item Reveal)
        if (this.revealingSlotIndex !== -1 && this.activeContainer) {
            this.revealTimer -= delta;
            const revProgress = 1 - (this.revealTimer / this.revealDuration);
            this.ui?.updateRevealingProgress(this.revealingSlotIndex, revProgress);

            if (this.revealTimer <= 0) {
                const slot = this.activeContainer.slots[this.revealingSlotIndex];
                if (slot) {
                    slot.revealed = true;
                    sounds.playItemRevealSound?.();
                }
                this.revealingSlotIndex = -1;
                this.ui?.refreshDualInventory();
            }
        }

        // 4. Hiển thị / ẩn gợi ý tương tác khi tới gần hòm
        // Dùng lại biến nearest đã tính ở bước 2 để tránh khai báo trùng
        if (nearest && !this.isSearching && !nearest.isOpen) {
            this.ui?.showContainerPrompt(nearest.config?.promptLabel, nearest.position, this.player.camera);
        } else if (!this.isSearching) {
            this.ui?.hideContainerPrompt();
        }
    }

    clearAll() {
        while (this.containers.length) {
            this.containers.pop().dispose();
        }
        while (this.airdropDrops.length) {
            this.airdropDrops.pop().dispose();
        }
        this.activeAirdropZone = null;
        this.closeContainerUI();
    }
}
