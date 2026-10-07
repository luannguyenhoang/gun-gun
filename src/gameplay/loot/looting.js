import * as THREE from 'three';
import { GLTFLoader } from '../../../vendor/loaders/GLTFLoader.js';
import { sounds } from '../../audio/audio.js?v=52';
import { WEAPON_CONFIGS, RARE_WEAPON_CONFIGS, ATTACHMENT_DEFS, getBombConfig, BOMB_CONFIGS, MEDICAL_CONFIGS } from '../combat/weapons.js';

const _gltfLoader = new GLTFLoader();
const _modelCache = new Map();

function getOrLoadModel(path, onLoad) {
    if (typeof window === 'undefined') return;
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
    // --- 1. CÁC VẬT PHẨM Y TẾ & TĂNG CƯỜNG CHIẾN THUẬT ---
    bandage_field: {
        id: 'bandage_field',
        name: 'Băng Gạc Dã Chiến',
        category: 'medical',
        tier: 1,
        rarity: 'common',
        color: '#94a3b8',
        tag: 'BĂNG GẠC',
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        subText: 'Hồi 25 HP khẩn cấp (2.5s)',
        description: 'Băng gạc dã chiến hồi phục 25 HP trong 2.5 giây. Chỉ dùng khi máu dưới 75%.',
        statSummary: '+25 HP (2.5s)',
        actionLabel: 'NHẶT BĂNG GẠC'
    },
    first_aid_kit: {
        id: 'first_aid_kit',
        name: 'Túi Sơ Cứu First Aid',
        category: 'medical',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'FIRST AID',
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        subText: 'Hồi lên 75 HP (4.0s)',
        description: 'Túi sơ cứu tiêu chuẩn PUBG, hồi máu lên mức 75 HP trong 4.0 giây.',
        statSummary: 'Hồi 75 HP (4s)',
        actionLabel: 'NHẶT TÚI CỨU THƯƠNG'
    },
    medkit: {
        id: 'medkit',
        name: 'Túi Cứu Thương PUBG',
        category: 'medical',
        tier: 2,
        rarity: 'uncommon',
        color: '#22c55e',
        tag: 'FIRST AID',
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        subText: 'Hồi 75 HP (4.0s)',
        description: 'Túi sơ cứu tiêu chuẩn PUBG, hồi máu lên mức 75 HP trong 4.0 giây.',
        statSummary: 'Hồi 75 HP (4s)',
        actionLabel: 'NHẶT CỨU THƯƠNG'
    },
    medkit_military: {
        id: 'medkit_military',
        name: 'Hộp Cứu Thương Quân Sự',
        category: 'medical',
        tier: 4,
        rarity: 'epic',
        color: '#f59e0b',
        tag: 'MEDKIT VIP',
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        subText: 'Hồi đầy 100% Máu (6.0s)',
        description: 'Hộp cứu thương cao cấp hồi đầy 100% lượng máu tối đa trong 6.0 giây.',
        statSummary: 'Hồi 100% Full HP (6s)',
        actionLabel: 'NHẶT MEDKIT VIP'
    },
    energy_drink: {
        id: 'energy_drink',
        name: 'Nước Tăng Lực Chiến Binh',
        category: 'medical',
        tier: 2,
        rarity: 'uncommon',
        color: '#06b6d4',
        tag: 'BOOST DRINK',
        icon: 'assets/previews/kenney-blaster/medkit.svg',
        subText: '+50 Khiên & Tăng tốc 25%',
        description: 'Nước tăng lực uống trong 2.0s, hồi phục 50 Khiên và tăng 25% tốc độ chạy trong 12 giây.',
        statSummary: '+50 Khiên · Chạy nhanh 12s',
        actionLabel: 'NHẶT NƯỚC TĂNG LỰC'
    },

    // --- BOM VÀ LỰU ĐẠN CHIẾN THUẬT ---
    grenade_a: {
        id: 'grenade_a',
        name: 'Lựu Đạn Nổ Mảnh A',
        category: 'bomb',
        isBomb: true,
        tier: 1,
        rarity: 'common',
        color: '#f97316',
        tag: 'BOM NỔ',
        icon: 'assets/previews/kenney-blaster/grenade-a.png',
        subText: '1600 Sát thương nổ lớn',
        description: 'Lựu đạn nổ mảnh gây sát thương diện rộng và hất văng bầy zombie.',
        statSummary: '1600 DMG · Bán kính 5m',
        actionLabel: 'NHẶT LỰU ĐẠN NỔ'
    },
    grenade_smoke: {
        id: 'grenade_smoke',
        name: 'Lựu Đạn Khói Chiến Thuật',
        category: 'bomb',
        isBomb: true,
        tier: 2,
        rarity: 'uncommon',
        color: '#94a3b8',
        tag: 'BOM KHÓI',
        icon: 'assets/previews/kenney-blaster/grenade-b.png',
        subText: 'Khói mù 10s · Tàng hình',
        description: 'Màn khói 10 giây che chắn tầm nhìn. Zombie mất dấu và không tấn công người chơi trong khói.',
        statSummary: 'Màn khói 10s · Mất dấu',
        actionLabel: 'NHẶT BOM KHÓI'
    },
    grenade_fire: {
        id: 'grenade_fire',
        name: 'Lựu Đạn Hỏa Thiêu Molotov',
        category: 'bomb',
        isBomb: true,
        tier: 3,
        rarity: 'rare',
        color: '#ef4444',
        tag: 'BOM LỬA',
        icon: 'assets/previews/kenney-blaster/grenade-a.png',
        subText: 'Vũng lửa thiêu đốt 10s',
        description: 'Tạo biển lửa thiêu đốt diện rộng trên mặt đất trong 10 giây. Gây sát thương liên tục.',
        statSummary: 'Biển lửa 10s · Đốt 25 DPS',
        actionLabel: 'NHẶT BOM LỬA'
    },
    grenade_freeze: {
        id: 'grenade_freeze',
        name: 'Lựu Đạn Băng Giá Cryo',
        category: 'bomb',
        isBomb: true,
        tier: 4,
        rarity: 'epic',
        color: '#38bdf8',
        tag: 'BOM BĂNG',
        icon: 'assets/previews/kenney-blaster/grenade-b.png',
        subText: 'Đóng băng zombie 4 giây',
        description: 'Sóng hàn khí cực mạnh làm đóng băng toàn bộ zombie trong phạm vi 4 giây (bất động 100%).',
        statSummary: 'Đóng băng 4s · Bất động',
        actionLabel: 'NHẶT BOM BĂNG'
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
        icon: 'assets/previews/kenney-blaster/silencer-small.png',
        subText: '+2 Flat DMG · +8% Tầm',
        description: 'Tăng +2 Flat Damage và +8% Tầm bắn cho súng.',
        statSummary: '+2 Flat DMG · +8% Tầm',
        flatDmg: 2,
        rangeBonusPct: 0.08
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
        icon: 'assets/previews/kenney-blaster/silencer-small.png',
        subText: '+4 Flat DMG · +15% Tầm',
        description: 'Tăng +4 Flat Damage và +15% Tầm bắn.',
        statSummary: '+4 Flat DMG · +15% Tầm',
        flatDmg: 4,
        rangeBonusPct: 0.15
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
        icon: 'assets/previews/kenney-blaster/silencer-larger.png',
        subText: '+7 Flat DMG · +25% Tầm',
        description: 'Tăng +7 Flat Damage và +25% Tầm bắn.',
        statSummary: '+7 Flat DMG · +25% Tầm',
        flatDmg: 7,
        rangeBonusPct: 0.25
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
        icon: 'assets/previews/kenney-blaster/silencer-larger.png',
        subText: '+11 Flat DMG · +35% Tầm',
        description: 'Tăng +11 Flat Damage và +35% Tầm bắn.',
        statSummary: '+11 Flat DMG · +35% Tầm',
        flatDmg: 11,
        rangeBonusPct: 0.35
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
        icon: 'assets/previews/kenney-blaster/silencer-larger.png',
        subText: '+16 Flat DMG · +50% Tầm',
        description: 'Tăng +16 Flat Damage và +50% Tầm bắn siêu xa.',
        statSummary: '+16 Flat DMG · +50% Tầm',
        flatDmg: 16,
        rangeBonusPct: 0.50
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
        icon: 'assets/previews/kenney-blaster/clip-small.png',
        subText: '+15% Băng · Nạp +10%',
        description: 'Tăng +15% sức chứa băng đạn, nạp đạn nhanh hơn 10%.',
        statSummary: '+15% Băng đạn · Nạp +10%',
        magBonusPct: 0.15
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
        icon: 'assets/previews/kenney-blaster/clip-small.png',
        subText: '+25% Băng · Nạp +15%',
        description: 'Tăng +25% sức chứa băng đạn, nạp đạn nhanh hơn 15%.',
        statSummary: '+25% Băng đạn · Nạp +15%',
        magBonusPct: 0.25
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
        icon: 'assets/previews/kenney-blaster/clip-large.png',
        subText: '+40% Băng · Nạp +20%',
        description: 'Tăng +40% sức chứa băng đạn, nạp đạn nhanh hơn 20%.',
        statSummary: '+40% Băng đạn · Nạp +20%',
        magBonusPct: 0.40
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
        icon: 'assets/previews/kenney-blaster/clip-large.png',
        subText: '+55% Băng · Nạp +25%',
        description: '+55% Băng đạn, nạp nhanh 25%.',
        statSummary: '+55% Băng đạn · Nạp +25%',
        magBonusPct: 0.55
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
        icon: 'assets/previews/kenney-blaster/clip-large.png',
        subText: '+75% Băng · Nạp +30%',
        description: '+75% Băng đạn, nạp nhanh 30%.',
        statSummary: '+75% Băng đạn · Nạp +30%',
        magBonusPct: 0.75
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
        icon: 'assets/previews/kenney-blaster/scope-small.png',
        subText: '+5% Crit · Red Dot',
        description: 'Kính Red Dot: +5% Crit, +0.15x Sát thương bạo kích.',
        statSummary: '+5% Crit · +0.15x Bạo kích',
        critChance: 0.05,
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
        icon: 'assets/previews/kenney-blaster/scope-large-a.png',
        subText: '+10% Crit · Holo 1.5x',
        description: 'Kính Holo: +10% Crit, +0.25x Crit DMG, zoom 1.5x.',
        statSummary: '+10% Crit · Zoom 1.5x',
        critChance: 0.10,
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
        icon: 'assets/previews/kenney-blaster/scope-large-a.png',
        subText: '+15% Crit · Scope 2x',
        description: 'Ống ngắm Scope 2x: +15% Crit, +0.35x Crit DMG, zoom 1.75x.',
        statSummary: '+15% Crit · Zoom 1.75x',
        critChance: 0.15,
        rangeBonusPct: 0.10
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
        icon: 'assets/previews/kenney-blaster/scope-large-b.png',
        subText: '+22% Crit · Scope 4x',
        description: 'Ống ngắm Scope 4x: +22% Crit, +0.45x Crit DMG, zoom 2.2x.',
        statSummary: '+22% Crit · Zoom 2.2x',
        critChance: 0.22,
        rangeBonusPct: 0.15
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
        icon: 'assets/previews/kenney-blaster/scope-large-b.png',
        subText: '+30% Crit · Scope 8x',
        description: 'Kính Thần Ưng: +30% Crit, +0.60x Bạo kích, zoom 2.8x.',
        statSummary: '+30% Crit · Zoom 2.8x',
        critChance: 0.30,
        rangeBonusPct: 0.20
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
        icon: 'assets/previews/kenney-blaster/target-detail.png',
        subText: '-15% Giật · Tản đạn',
        description: 'Tay cầm dọc: Giảm 15% độ giật, giảm 15% góc tản đạn.',
        statSummary: '-15% Giật · -15% Tản đạn'
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
        icon: 'assets/previews/kenney-blaster/target-detail.png',
        subText: '-25% Giật · Gom đạn',
        description: 'Báng hợp kim: Giảm 25% độ giật, giảm 25% tản đạn.',
        statSummary: '-25% Giật · Gom đạn'
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
        icon: 'assets/previews/kenney-blaster/target-detail.png',
        subText: '-35% Giật · Gom đạn',
        description: 'Báng giảm giật cao cấp: Giảm 35% độ giật, gom 35% chùm đạn.',
        statSummary: '-35% Giật · Gom đạn'
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
        icon: 'assets/previews/kenney-blaster/target-detail.png',
        subText: '-45% Giật · Khung chấn',
        description: 'Khung giảm chấn thủy lực: Giảm 45% độ giật, gom 45% chùm đạn.',
        statSummary: '-45% Giật · Gom đạn'
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
        icon: 'assets/previews/kenney-blaster/target-detail.png',
        subText: '-60% Giật · Laser',
        description: 'Báng cân bằng Laser: Giảm 60% độ giật, gom 55% chùm đạn.',
        statSummary: '-60% Giật · Laser gom đạn'
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
        icon: 'assets/previews/kenney-blaster/blaster-a.png',
        subText: 'Súng lục bán tự động',
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
        icon: 'assets/previews/kenney-blaster/blaster-a.png',
        subText: 'Súng lục bán tự động',
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
        icon: 'assets/previews/kenney-blaster/blaster-d.png',
        subText: 'Súng trường liên thanh',
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
        icon: 'assets/previews/kenney-blaster/blaster-d.png',
        subText: 'Súng trường liên thanh',
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
        icon: 'assets/previews/kenney-blaster/blaster-g.png',
        subText: 'Shotgun tán xạ',
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
        icon: 'assets/previews/kenney-blaster/blaster-g.png',
        subText: 'Shotgun tán xạ',
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
        icon: 'assets/previews/kenney-blaster/blaster-j.png',
        subText: 'Pháo Plasma xuyên giáp',
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
        icon: 'assets/previews/kenney-blaster/blaster-e.png',
        subText: 'Tiểu liên bão đạn 48v',
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
        icon: 'assets/previews/kenney-blaster/blaster-r.png',
        subText: 'Huyền thoại · Đạn nổ lan',
        description: 'Siêu vũ khí Huyền Thoại: 8 viên đạn nổ lan xuyên thấu mọi zombie!',
        statSummary: 'Huyền thoại · Bắn nổ lan & Xuyên mục tiêu',
        actionLabel: 'ĐỔI / NHẶT SÚNG'
    }
};

// Ánh xạ tương thích ngược các ID item cũ để tránh lỗi tham chiếu
const LEGACY_LOOT_ALIASES = {
    painkiller_bottle: 'first_aid_kit',
    painkiller_morphine: 'first_aid_kit',
    water_purified: 'energy_drink',
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
        capacity: 4,
        meshColor: 0x8b5a2b,
        accentColor: 0x00f0ff,
        promptLabel: '[F] LỤC THÙNG GỖ QUÂN TRANG',
        lootTable: [
            // Ưu tiên cao nhất: Lựu đạn và vũ khí nổ chiến thuật
            { itemId: 'grenade_a', chance: 0.80, min: 1, max: 3 },
            { itemId: 'grenade_fire', chance: 0.70, min: 1, max: 2 },
            { itemId: 'grenade_smoke', chance: 0.55, min: 1, max: 2 },
            { itemId: 'medkit', chance: 0.50, min: 1, max: 1 },
            { itemId: 'gun_scatter_t2', chance: 0.20, min: 1, max: 1 },
            // Giảm mạnh tỷ lệ phụ kiện linh tinh
            { itemId: 'barrel_t1', chance: 0.12, min: 1, max: 1 },
            { itemId: 'magazine_t1', chance: 0.12, min: 1, max: 1 },
            { itemId: 'optic_t1', chance: 0.10, min: 1, max: 1 },
            { itemId: 'grip_t1', chance: 0.10, min: 1, max: 1 }
        ]
    },
    dead_body: {
        id: 'dead_body',
        name: 'Thi Thể Đặc Nhiệm',
        searchDuration: 1.0,
        interactionRadius: 3.6,
        capacity: 4,
        meshColor: 0x475569,
        accentColor: 0x22c55e,
        promptLabel: '[F] LỤC THI THỂ ĐẶC NHIỆM',
        lootTable: [
            // Trang bị tác chiến của lính đặc nhiệm: Luôn dồi dào bom lửa và bom phá
            { itemId: 'grenade_fire', chance: 0.75, min: 1, max: 3 },
            { itemId: 'grenade_a', chance: 0.70, min: 1, max: 3 },
            { itemId: 'grenade_freeze', chance: 0.60, min: 1, max: 2 },
            { itemId: 'medkit', chance: 0.55, min: 1, max: 1 },
            { itemId: 'gun_blaster_t2', chance: 0.25, min: 1, max: 1 },
            // Phụ kiện chỉ rơi tỷ lệ phụ
            { itemId: 'magazine_t2', chance: 0.15, min: 1, max: 1 },
            { itemId: 'barrel_t1', chance: 0.12, min: 1, max: 1 },
            { itemId: 'optic_t1', chance: 0.10, min: 1, max: 1 },
            { itemId: 'grip_t1', chance: 0.10, min: 1, max: 1 }
        ]
    },
    military_safe: {
        id: 'military_safe',
        name: 'Két Sắt Quân Sự',
        searchDuration: 1.6,
        interactionRadius: 3.6,
        capacity: 4,
        meshColor: 0x334155,
        accentColor: 0xa855f7,
        promptLabel: '[F] MỞ KÉT SẮT QUÂN SỰ',
        lootTable: [
            // Kho vũ khí nổ và trang bị tác chiến hạng nặng
            { itemId: 'grenade_freeze', chance: 0.80, min: 2, max: 3 },
            { itemId: 'grenade_fire', chance: 0.80, min: 2, max: 3 },
            { itemId: 'grenade_a', chance: 0.75, min: 2, max: 4 },
            { itemId: 'medkit', chance: 0.60, min: 1, max: 2 },
            { itemId: 'gun_repeater_t3', chance: 0.30, min: 1, max: 1 },
            { itemId: 'gun_plasma_t4', chance: 0.20, min: 1, max: 1 },
            // Phụ kiện cao cấp tỷ lệ vừa phải
            { itemId: 'barrel_t2', chance: 0.15, min: 1, max: 1 },
            { itemId: 'magazine_t2', chance: 0.15, min: 1, max: 1 },
            { itemId: 'optic_t2', chance: 0.12, min: 1, max: 1 }
        ]
    },
    airdrop_crate: {
        id: 'airdrop_crate',
        name: 'Thính Tiếp Tế Airdrop',
        searchDuration: 2.0,
        interactionRadius: 4.0,
        capacity: 5,
        meshColor: 0xd97706,
        accentColor: 0xf59e0b,
        promptLabel: '[F] MỞ HÒM THÍNH TIẾP TẾ',
        lootTable: [
            // Đồ Cấp 4 (Epic) hoặc Cấp 5 (Legendary) và kho bom mìn quân sự tối tân
            { itemId: 'grenade_fire', chance: 0.90, min: 2, max: 4 },
            { itemId: 'grenade_freeze', chance: 0.85, min: 2, max: 4 },
            { itemId: 'grenade_a', chance: 0.85, min: 2, max: 4 },
            { itemId: 'gun_nova_t5', chance: 0.35, min: 1, max: 1 },
            { itemId: 'gun_plasma_t4', chance: 0.35, min: 1, max: 1 },
            { itemId: 'gun_storm_t4', chance: 0.35, min: 1, max: 1 },
            { itemId: 'medkit', chance: 0.75, min: 1, max: 2 },
            { itemId: 'barrel_t4', chance: 0.18, min: 1, max: 1 },
            { itemId: 'magazine_t4', chance: 0.18, min: 1, max: 1 },
            { itemId: 'optic_t4', chance: 0.15, min: 1, max: 1 },
            { itemId: 'grip_t4', chance: 0.15, min: 1, max: 1 }
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
        // Hòm tồn tại trên sân cho đến khi người chơi nhặt sạch đồ thì tự động giải phóng vị trí
        this.life = typeof options.life === 'number' && options.life !== -1 ? options.life : Infinity;
        this.maxLife = this.life;

        this.mesh = null;
        this.smokeParticles = null;
        this.buildMesh();
        if (options.slots && Array.isArray(options.slots)) {
            // Khởi tạo từ dữ liệu đồng bộ mạng (Client)
            this.slots = options.slots.map(s => s ? { ...s } : null);
            this.isUnlocked = !!options.isUnlocked;
            this.isOpen = !!options.isOpen;
            this.isLooted = !!options.isLooted;
        } else {
            this.generateLoot();
        }
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
        // Tăng số lượng vật phẩm tối đa mỗi hòm đồ để người chơi nhặt đã tay
        const maxItems = Math.min(this.capacity, this.type === 'airdrop_crate' ? 5 : 4);

        // 1. Hòm Thính Tiếp Tế (Airdrop): Chắc chắn có 1 đồ Cấp 4/5, 1 Túi cứu thương, và 1-2 slot bom mìn tối tân
        if (this.type === 'airdrop_crate') {
            const highTierItems = [
                'barrel_t5', 'magazine_t5', 'optic_t5', 'grip_t5', 'gun_nova_t5',
                'barrel_t4', 'magazine_t4', 'optic_t4', 'grip_t4', 'gun_plasma_t4', 'gun_storm_t4'
            ];
            const guaranteed = highTierItems[Math.floor(Math.random() * highTierItems.length)];
            generated.push({ itemId: guaranteed, count: 1, revealed: true });
            generated.push({ itemId: 'medkit', count: 2, revealed: true });

            // Chắc chắn cấp 1 hòm lựu đạn hỏa thiêu hoặc bom băng cực mạnh
            const heavyBombs = ['grenade_fire', 'grenade_freeze', 'grenade_a'];
            const guaranteedBomb = heavyBombs[Math.floor(Math.random() * heavyBombs.length)];
            generated.push({ itemId: guaranteedBomb, count: Math.floor(Math.random() * 2) + 2, revealed: true });
        } else {
            // 2. Với các hòm đồ chiến trường thông thường: BẢO ĐẢM luôn có ít nhất 1 slot bom mìn
            const bombEntries = table.filter(e => e.itemId && e.itemId.startsWith('grenade_'));
            if (bombEntries.length > 0) {
                const picked = bombEntries[Math.floor(Math.random() * bombEntries.length)];
                const min = picked.min || 1;
                const max = picked.max || 2;
                const count = Math.floor(Math.random() * (max - min + 1)) + min;
                generated.push({ itemId: picked.itemId, count, revealed: true });
            }
        }

        // Lấy ngẫu nhiên từ bảng rớt đồ cho đến khi đạt giới hạn maxItems
        const shuffled = [...table].sort(() => Math.random() - 0.5);
        for (const entry of shuffled) {
            if (generated.length >= maxItems) break;
            if (Math.random() <= entry.chance) {
                if (!generated.some(g => g.itemId === entry.itemId)) {
                    const min = entry.min || 1;
                    const max = entry.max || 1;
                    const count = Math.floor(Math.random() * (max - min + 1)) + min;
                    generated.push({
                        itemId: entry.itemId,
                        count: count,
                        revealed: true
                    });
                }
            }
        }

        // Đảm bảo hòm không bao giờ bị rỗng
        if (generated.length === 0 && table.length > 0) {
            const fallback = table[0];
            const count = fallback.min ? Math.floor(Math.random() * (fallback.max - fallback.min + 1)) + fallback.min : 1;
            generated.push({ itemId: fallback.itemId, count, revealed: true });
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

    // Đóng gói trạng thái hòm đồ để đồng bộ mạng
    snapshot() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            position: this.position.toArray(),
            slots: this.slots.map(s => s ? { ...s } : null),
            // PeerJS BinaryPack không hỗ trợ Infinity. Dùng -1 khi truyền mạng cho thời gian sống vô hạn.
            life: Number.isFinite(this.life) ? this.life : -1,
            isOpen: !!this.isOpen,
            isUnlocked: !!this.isUnlocked,
            isLooted: !!this.isLooted,
            searchDuration: this.searchDuration,
            interactionRadius: this.interactionRadius
        };
    }

    dispose() {
        if (this.mesh) {
            this.mesh.removeFromParent();
            this.mesh.traverse(c => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
        }
        if (this.interactRing) {
            this.interactRing.removeFromParent();
            this.interactRing.geometry?.dispose();
            this.interactRing.material?.dispose();
            this.interactRing = null;
        }
        if (this.airdropEntity) {
            this.airdropEntity.dispose();
            this.airdropEntity = null;
        }
    }
}

// Đối tượng Hòm Thính Rơi Từ Bầu Trời (Airdrop Drop Simulation)
export class AirdropDropEntity {
    constructor(scene, targetPos, lootingSystem, options = {}) {
        this.scene = scene;
        this.lootingSystem = lootingSystem;
        this.targetPos = targetPos.clone();
        this.id = options.id || ('airdrop_' + Math.random().toString(36).substring(2, 9));
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

                // Ở chế độ Client, hòm airdrop_crate sẽ được tạo thông qua snapshot của Host
                const isClient = window.game?.network?.active && !window.game?.network?.host;
                if (!isClient) {
                    this.container = this.lootingSystem.spawnContainer('airdrop_crate', this.targetPos);
                    if (this.container) {
                        this.container.airdropEntity = this;
                    }
                    this.lootingSystem.alertEnemies(this.targetPos, 26.0);
                }
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
        this.smokeTimer = 0;
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
        if (this.lootingSystem && this.lootingSystem.airdropDrops) {
            const idx = this.lootingSystem.airdropDrops.indexOf(this);
            if (idx !== -1) {
                this.lootingSystem.airdropDrops.splice(idx, 1);
            }
        }
    }
}

// Thực thể Súng rơi ngoài mặt đất khi bị vứt hoặc hoán đổi (Tồn tại 30s)
export class DroppedWeaponEntity {
    constructor(scene, position, gunData, options = {}) {
        this.scene = scene;
        this.gunData = gunData;
        this.id = options.id || ('drop_gun_' + Math.random().toString(36).substring(2, 9));
        this.life = typeof options.life === 'number' ? options.life : 30.0; // Tồn tại đúng 30 giây trước khi tự hủy
        this.maxLife = 30.0;
        this.interactionRadius = 2.4; // Bán kính bấm [F] tương tác
        this.group = new THREE.Group();

        const tier = gunData.tier || 1;
        const tierInfo = LOOT_TIERS[tier] || LOOT_TIERS[1];
        const tierColor = tierInfo.color || '#94a3b8';
        const colorHex = parseInt(tierColor.replace('#', '0x'), 16);

        // 1. Vòng sáng màu Tier trên nền đất
        const ringGeo = new THREE.RingGeometry(0.28, 0.65, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
        });
        this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
        this.ringMesh.rotation.x = -Math.PI / 2;
        this.ringMesh.position.y = 0.04;
        this.group.add(this.ringMesh);

        // Vòng sáng phụ bên ngoài
        const outerRingGeo = new THREE.RingGeometry(0.68, 0.8, 32);
        const outerRingMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        this.outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        this.outerRing.rotation.x = -Math.PI / 2;
        this.outerRing.position.y = 0.03;
        this.group.add(this.outerRing);

        // 2. Cột sáng nhẹ chỉ thị vị trí từ xa
        const beamGeo = new THREE.CylinderGeometry(0.08, 0.3, 1.8, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
        this.beamMesh.position.y = 0.9;
        this.group.add(this.beamMesh);

        // 3. Khối placeholder đại diện vũ khí
        const boxGeo = new THREE.BoxGeometry(0.6, 0.2, 0.16);
        const boxMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.4,
            metalness: 0.6
        });
        this.weaponMesh = new THREE.Mesh(boxGeo, boxMat);
        this.weaponMesh.position.y = 0.38;
        this.group.add(this.weaponMesh);

        // Tải mô hình 3D thật của khẩu súng
        let modelFile = gunData.modelFile;
        if (!modelFile) {
            const cfg = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS].find(w => w.id === gunData.id || w.aliases?.includes(gunData.id));
            if (cfg?.modelFile) modelFile = cfg.modelFile;
        }

        if (modelFile) {
            const path = modelFile.startsWith('assets/') ? modelFile : `assets/models/${modelFile}`;
            getOrLoadModel(path, (model) => {
                if (!this.group) return;
                this.group.remove(this.weaponMesh);
                boxGeo.dispose();
                boxMat.dispose();
                model.scale.set(1.4, 1.4, 1.4);
                model.position.set(0, 0.38, 0);
                this.weaponMesh = model;
                this.group.add(model);
            });
        }

        this.group.position.set(position.x, position.y || 0, position.z);
        this.scene.add(this.group);
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) return false;

        const elapsed = performance.now() * 0.002;
        if (this.weaponMesh) {
            this.weaponMesh.rotation.y += delta * 1.6;
            this.weaponMesh.position.y = 0.38 + Math.sin(elapsed * 2.2) * 0.06;
        }

        if (this.ringMesh) {
            this.ringMesh.material.opacity = 0.5 + 0.3 * Math.sin(elapsed * 3.0);
        }
        if (this.outerRing) {
            this.outerRing.rotation.z += delta * 0.8;
            if (this.life < 10) {
                this.outerRing.material.opacity = (Math.sin(elapsed * 12) > 0) ? 0.7 : 0.15;
            }
        }

        return true;
    }

    dispose() {
        if (this.group) {
            this.group.removeFromParent();
            this.group.traverse(c => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
            this.group = null;
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
        this.droppedWeapons = []; // Danh sách súng rơi ngoài mặt đất
        this.nearestDroppedWeapon = null;

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
        if (typeof window === 'undefined') return;
        window.addEventListener('keydown', (e) => {
            if (e.repeat || e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
            if (window.game?.state !== 'PLAYING' || window.game?.pauseMenuOpen || this.player.isDead || this.player.isDowned) return;

            // Phím [G] vứt súng đang cầm ra đất để trao đổi với đồng đội
            if (e.code === 'KeyG') {
                this.player?.weapons?.dropCurrentWeapon(this.player, this);
            }

            // Phím [F] cơ chế 1-Phím Thông Minh (Smart 1-Key Swap & Open)
            if (e.code === 'KeyF') {
                if (this.isSearching) {
                    this.cancelSearch();
                } else if (this.activeContainer && this.activeContainer.isOpen) {
                    // Nếu hòm đang mở: Bấm [F] nhặt ngay món đồ trong hòm
                    this.th_smartLootCrate(this.activeContainer);
                } else if (this.nearestDroppedWeapon) {
                    // Nếu đứng gần súng rơi ngoài đất: Bấm [F] để nhặt / đổi súng
                    this.pickupDroppedWeapon(this.nearestDroppedWeapon);
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

    // Sinh khẩu súng rơi ngoài đất (tồn tại 1 phút = 60s)
    spawnDroppedWeapon(position, gunData, customId = null, life = null) {
        if (!gunData) return null;
        gunData = { ...gunData, instanceId: gunData.instanceId || THREE.MathUtils.generateUUID() };
        const existing = this.droppedWeapons.find(w => w.gunData.instanceId === gunData.instanceId || (customId && w.id === customId));
        if (existing) return existing;
        const options = {};
        if (customId) options.id = customId;
        if (typeof life === 'number') options.life = life;
        const entity = new DroppedWeaponEntity(this.scene, position, gunData, options);
        this.droppedWeapons.push(entity);
        return entity;
    }

    // Nhặt hoặc hoán đổi súng rơi ngoài đất [F]
    pickupDroppedWeapon(droppedWeapon) {
        if (!droppedWeapon || !this.player || this.player.isDead || this.player.isDowned || !this.droppedWeapons.includes(droppedWeapon)) return false;
        if (this.player.position.distanceTo(droppedWeapon.group.position) > 4.5) return false;
        if (this.requestCommand({ type: 'pickup_weapon', weaponDropId: droppedWeapon.id })) return true;
        const weapons = this.player.weapons;
        if (!weapons) return false;

        const gunData = droppedWeapon.gunData;
        if (!gunData) return false;

        // Xác định slot sẽ nhận súng mới:
        // Ưu tiên 1: Nếu ô vũ khí chính (slot 0) đang trống -> Nhặt vào ô chính (KHÔNG làm rơi súng phụ!)
        // Ưu tiên 2: Nếu ô vũ khí phụ (slot 1) đang trống -> Nhặt vào ô phụ (KHÔNG làm rơi súng chính!)
        // Ưu tiên 3: Nếu CẢ HAI ô súng đều đã có súng -> Hoán đổi (swap) với khẩu đang cầm trên tay
        let targetSlot = -1;
        if (!weapons.weaponSlots[0]) {
            targetSlot = 0;
        } else if (!weapons.weaponSlots[1]) {
            targetSlot = 1;
        } else {
            targetSlot = (weapons.currentSlotIndex === 1) ? 1 : 0;
        }

        const currentGun = weapons.weaponSlots[targetSlot];

        // Nếu slot này đang có súng (và không phải dao): vứt súng đang có ra đất
        if (currentGun && !currentGun.isKnife) {
            const attachMap = { ...weapons.getAttachmentsForGun(targetSlot) };
            const oldDroppedData = {
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

            // Dọn phụ kiện slot này trên người chơi
            const targetMap = weapons.getAttachmentsForGun(targetSlot);
            targetMap.barrel = null;
            targetMap.magazine = null;
            targetMap.optic = null;
            targetMap.grip = null;

            // Đặt khẩu súng cũ rơi ra ngay vị trí của khẩu súng vừa nhặt
            const oldEntity = this.spawnDroppedWeapon(droppedWeapon.group.position.clone(), oldDroppedData);
        }

        // Tạo instance súng mới từ gunData
        const baseId = gunData.id;
        const baseConfig = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS].find(w => w.id === baseId || w.aliases?.includes(baseId)) || WEAPON_CONFIGS[0];
        const newTier = gunData.tier || 1;
        const newGun = {
            ...baseConfig,
            instanceId: gunData.instanceId,
            tier: newTier,
            color: gunData.color || baseConfig.color
        };

        // Gán vào slot vũ khí của người chơi
        weapons.weaponSlots[targetSlot] = newGun;
        weapons.ammo[newGun.id] = newGun.magSize;
        weapons.reserve[newGun.id] = Infinity;
        if (targetSlot === 1) weapons.secondaryWeapon = newGun;

        // Lắp lại các phụ kiện đã lưu của khẩu súng này
        if (gunData.attachments) {
            for (const [slotKey, modId] of Object.entries(gunData.attachments)) {
                if (modId) {
                    weapons.attachMod(slotKey, modId, targetSlot);
                }
            }
        }

        // Chuyển ngay sang khẩu súng vừa nhặt
        weapons.switchWeapon(targetSlot, this.player);

        // Báo cho Host biết súng đã được nhặt
        if (window.game?.network?.active && !window.game?.network?.host) {
            window.game.network.sendCommand({
                type: 'pickup_weapon',
                weaponDropId: droppedWeapon.id
            });
        }

        // Xóa thực thể súng rơi khỏi danh sách và scene
        const idx = this.droppedWeapons.indexOf(droppedWeapon);
        if (idx !== -1) {
            this.droppedWeapons.splice(idx, 1);
        }
        droppedWeapon.dispose();
        this.nearestDroppedWeapon = null;
        this.ui?.hideDroppedWeaponPrompt?.();

        sounds.play('switchWeapon', { volume: 1.0, rate: 1.2 });
        this.ui?.showPickupAlert(`ĐÃ NHẶT [${newGun.name.toUpperCase()}] CẤP ${newTier}!`);
        this.ui?.updateTacticalDock?.(weapons, this.player);

        if (this.activeContainer && this.activeContainer.isOpen) {
            this.ui?.refreshPUBGMiniCrate(this.activeContainer, this, this.getNearbyDroppedWeapons(4.5));
        }
        return true;
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

    // Rải hòm đồ khi bắt đầu ván đấu để người chơi có trang bị và bom mìn chiến đấu ngay
    spawnInitialContainers(arena) {
        this.clearAll();
        // Đặt sẵn 2 hòm trang bị dã chiến và két sắt ở 2 góc sàn đấu
        this.spawnContainer('wooden_crate', new THREE.Vector3(-10, 0, -8));
        this.spawnContainer('military_safe', new THREE.Vector3(12, 0, 10));
    }

    // Xử lý rơi hòm đồ khi tiêu diệt quái vật
    handleEnemyKilled(enemy) {
        if (!enemy || !enemy.position) return;

        // Giới hạn số lượng hòm đồ tối đa trên sân đấu: 4 hòm
        const MAX_ACTIVE_CONTAINERS = 4;
        if (this.containers.length >= MAX_ACTIVE_CONTAINERS) return;

        const rand = Math.random();
        let dropType = null;

        // Phân loại tỷ lệ rơi đồ hợp lý theo cấp độ quái
        switch (enemy.type) {
            case 'boss':
                // Boss: 75% tỷ lệ rơi Két sắt quân sự hoặc Hòm tiếp tế
                if (rand < 0.75) {
                    dropType = Math.random() < 0.5 ? 'airdrop_crate' : 'military_safe';
                }
                break;

            case 'giant':
            case 'tank':
                // Quái đột biến khổng lồ: 20% tỷ lệ rơi két sắt hoặc thi thể đặc nhiệm
                if (rand < 0.20) {
                    dropType = Math.random() < 0.6 ? 'military_safe' : 'dead_body';
                }
                break;

            case 'spitter':
            case 'boomer':
                // Quái trung cấp (phun độc, phát nổ): 8% tỷ lệ rơi hòm
                if (rand < 0.08) {
                    dropType = Math.random() < 0.5 ? 'wooden_crate' : 'dead_body';
                }
                break;

            case 'sprinter':
            case 'walker':
            default:
                // Quái thường: Tỷ lệ rơi 3.5%
                if (rand < 0.035) {
                    dropType = Math.random() < 0.65 ? 'wooden_crate' : 'dead_body';
                }
                break;
        }

        if (dropType) {
            // Giữ hòm đồ nằm trong giới hạn di chuyển an toàn của sàn đấu
            const dropX = Math.max(-20, Math.min(20, enemy.position.x));
            const dropZ = Math.max(-20, Math.min(20, enemy.position.z));
            const dropPos = new THREE.Vector3(dropX, 0, dropZ);

            this.spawnContainer(dropType, dropPos, { life: Infinity });
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

    // Kiểm tra và xóa ngay hòm rỗng khỏi bản đồ nếu đã nhặt hết đồ
    checkAndRemoveEmptyContainer(container) {
        if (!container) return false;
        if (container.checkEmpty()) {
            const idx = this.containers.indexOf(container);
            if (idx !== -1) {
                this.containers.splice(idx, 1);
            }
            container.dispose();
            if (this.activeContainer === container) {
                this.activeContainer = null;
                this.closeContainerUI();
            }
            return true;
        }
        return false;
    }

    // Bắt đầu tiến trình mở hòm khi đứng trong phạm vi
    tryStartSearch(targetContainer = null) {
        const container = targetContainer || this.getNearestInteractableContainer();
        if (!container || container.isLooted) return false;
        if (container.checkEmpty()) return false;

        // Nếu hòm đã được mở khóa trước đó (isUnlocked) thì mở ngay giao diện, không cần lục lại
        if (container.isUnlocked) {
            this.openContainerUI(container);
            return true;
        }

        if (container.isOpen) return false;
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
        container.isUnlocked = true; // Đã mở khóa thành công, lần sau mở ngay không cần lục lại
        sounds.playClearJam(); // Tiếng khóa mở hòm cơ khí

        // Hiển thị PUBG Mini Crate UI
        this.openContainerUI(container);
    }

    // Lấy danh sách súng rơi ngoài đất lân cận người chơi trong bán kính radius
    getNearbyDroppedWeapons(radius = 4.5) {
        if (!this.player || !this.player.position) return [];
        return this.droppedWeapons.filter(dw => {
            if (!dw || !dw.group || dw.life <= 0) return false;
            return this.player.position.distanceTo(dw.group.position) <= radius;
        });
    }

    // Mở giao diện Hòm đồ PUBG Mini
    openContainerUI(container) {
        if (!container) return;
        this.activeContainer = container;
        container.isOpen = true;
        const nearbyDropped = this.getNearbyDroppedWeapons(4.5);
        this.ui?.showPUBGMiniCrate(container, this, nearbyDropped);
    }

    // Đóng giao diện Hòm đồ PUBG Mini
    closeContainerUI() {
        this.isBackpackOpen = false;
        this.isSearching = false;
        this.searchTimer = 0;
        if (this.player) {
            this.player.isBackpackOpen = false;
            this.player.isSearching = false;
            if (this.player.domElement) this.player.domElement.style.cursor = this.player.inputEnabled ? 'none' : 'default';
        }
        this.ui?.closeSmartInventory?.();
        this.ui?.hideSearchProgress?.();
        if (this.activeContainer) {
            this.dismissedContainerId = this.activeContainer.id;
            this.activeContainer.isOpen = false;
            if (this.activeContainer.checkEmpty()) {
                const idx = this.containers.indexOf(this.activeContainer);
                if (idx !== -1) {
                    this.containers.splice(idx, 1);
                }
                this.activeContainer.dispose();
            }
            this.activeContainer = null;
        }
        this.ui?.hidePUBGMiniCrate();
    }

    // Cơ chế Nhặt & Hoán đổi 1-Phím [F] (Smart 1-Key Swap)
    th_smartLootCrate(targetContainer = null, targetSlotIndex = -1) {
        const container = targetContainer || this.activeContainer;
        const nearbyDropped = this.getNearbyDroppedWeapons(4.5);

        // Nếu bấm [F] (targetSlotIndex === -1) và có súng rơi ngoài đất lân cận:
        // So sánh món trong hòm vs súng dưới đất để nhặt món có Tier cao nhất
        if (targetSlotIndex === -1 && nearbyDropped.length > 0) {
            const bestGroundGun = nearbyDropped[0];
            const groundTier = bestGroundGun.gunData?.tier || 1;

            let crateBestTier = 0;
            if (container && container.isOpen) {
                const crateItems = container.slots.filter(s => s && s.itemId);
                if (crateItems.length > 0) {
                    const firstDef = th_resolveLootItem(crateItems[0].itemId);
                    crateBestTier = firstDef?.tier || 1;
                }
            }

            // Nếu súng dưới đất có Tier cao hơn món đầu trong hòm -> Nhặt súng dưới đất!
            if (groundTier > crateBestTier || !container || !container.isOpen) {
                return this.pickupDroppedWeapon(bestGroundGun);
            }
        }

        if (!container || !container.isOpen) {
            if (nearbyDropped.length > 0) {
                return this.pickupDroppedWeapon(nearbyDropped[0]);
            }
            return false;
        }

        const validItems = container.slots
            .map((s, idx) => s && s.itemId ? { ...s, slotIndex: idx } : null)
            .filter(Boolean);

        if (validItems.length === 0) {
            this.checkAndRemoveEmptyContainer(container);
            if (nearbyDropped.length > 0) {
                return this.pickupDroppedWeapon(nearbyDropped[0]);
            }
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
        if (this.requestLoot(container, selected.slotIndex, 'smart')) return true;
        const def = th_resolveLootItem(selected.itemId);
        if (!def) return false;

        const weapons = this.player?.weapons;
        if (!weapons) return false;

        // 1. VẬT PHẨM Y TẾ & TĂNG CƯỜNG CHIẾN THUẬT
        if (def.category === 'medical' || selected.itemId === 'medkit' || ['bandage_field', 'first_aid_kit', 'medkit_military', 'energy_drink'].includes(selected.itemId)) {
            const qty = selected.count || 1;
            if (selected.itemId === 'bandage_field') {
                weapons.inventory.bandage = (weapons.inventory.bandage || 0) + qty;
            } else if (selected.itemId === 'medkit_military') {
                weapons.inventory.medkit_military = (weapons.inventory.medkit_military || 0) + qty;
            } else if (selected.itemId === 'energy_drink') {
                weapons.inventory.energy_drink = (weapons.inventory.energy_drink || 0) + qty;
            } else {
                weapons.inventory.first_aid = (weapons.inventory.first_aid || 0) + qty;
                weapons.inventory.medkits = (weapons.inventory.medkits || 0) + qty;
            }

            container.slots[selected.slotIndex] = null;
            this.notifyLootAction(container.id, selected.slotIndex, null);
            sounds.playMedkit?.();
            this.ui?.showPickupAlert(`ĐÃ NHẶT [${def.name.toUpperCase()}] (+${qty})`);
            if (this.checkAndRemoveEmptyContainer(container)) {
                this.ui?.showPickupAlert('HÒM ĐÃ HẾT ĐỒ VÀ BIẾN MẤT!');
                return true;
            }
            this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
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
                this.notifyLootAction(container.id, selected.slotIndex, null);
                sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
                this.ui?.showPickupAlert(`ĐÃ LẮP [${def.name.toUpperCase()}] LÊN SÚNG!`);
                if (this.checkAndRemoveEmptyContainer(container)) {
                    this.ui?.showPickupAlert('HÒM ĐÃ HẾT ĐỒ VÀ BIẾN MẤT!');
                    return true;
                }
                this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
                return true;
            }

            // Nếu súng ĐÃ CÓ phụ kiện đó: So sánh Tier
            const currentTier = ATTACHMENT_DEFS[currentModId]?.tier || 1;

            if (itemTier > currentTier) {
                // TỰ ĐỘNG SWAP: Lắp phụ kiện cấp cao vào súng, vứt phụ kiện cũ lại hòm
                const oldModId = weapons.attachMod(attachSlot, selected.itemId, currentGunIdx);
                const replacedAttachment = {
                    itemId: oldModId,
                    count: 1,
                    revealed: true
                };
                container.slots[selected.slotIndex] = replacedAttachment;
                this.notifyLootAction(container.id, selected.slotIndex, replacedAttachment);
                sounds.play('switchWeapon', { volume: 1.0, rate: 1.45 });
                this.ui?.showPickupAlert(`NÂNG CẤP THÀNH CÔNG: [${def.name.toUpperCase()}] (HOÁN ĐỔI CẤP CŨ)`);
                container.generateLootSort?.();
                this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
                return true;
            } else {
                // Kiểm tra xem súng phụ (Khẩu 2) có lắp được không
                const secGunIdx = (currentGunIdx === 0) ? 1 : 0;
                const secAttachMap = weapons.getAttachmentsForGun ? weapons.getAttachmentsForGun(secGunIdx) : {};
                const secModId = secAttachMap[attachSlot];
                if (!secModId) {
                    weapons.attachMod(attachSlot, selected.itemId, secGunIdx);
                    container.slots[selected.slotIndex] = null;
                    this.notifyLootAction(container.id, selected.slotIndex, null);
                    sounds.play('switchWeapon', { volume: 0.9, rate: 1.35 });
                    this.ui?.showPickupAlert(`ĐÃ LẮP [${def.name.toUpperCase()}] LÊN SÚNG PHỤ!`);
                    if (this.checkAndRemoveEmptyContainer(container)) {
                        this.ui?.showPickupAlert('HÒM ĐÃ HẾT ĐỒ VÀ BIẾN MẤT!');
                        return true;
                    }
                    this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
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
                    this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
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
            const gunConfig = [...WEAPON_CONFIGS, ...RARE_WEAPON_CONFIGS].find(w => w.id === baseGunId || w.aliases?.includes(baseGunId)) || WEAPON_CONFIGS[0];
            const newGun = {
                ...gunConfig,
                instanceId: THREE.MathUtils.generateUUID(),
                tier: newTier,
                color: def.color ? parseInt(def.color.replace('#', '0x'), 16) : gunConfig.color
            };

            // Xác định slot sẽ nhận súng mới:
            // Ưu tiên 1: Nếu ô vũ khí chính (slot 0) đang trống -> Nhặt vào ô chính (KHÔNG làm rơi súng phụ!)
            // Ưu tiên 2: Nếu ô vũ khí phụ (slot 1) đang trống -> Nhặt vào ô phụ (KHÔNG làm rơi súng chính!)
            // Ưu tiên 3: Nếu CẢ HAI ô súng đều đã có súng -> Hoán đổi (swap) với khẩu đang cầm trên tay
            let targetSlot = -1;
            if (!weapons.weaponSlots[0]) {
                targetSlot = 0;
            } else if (!weapons.weaponSlots[1]) {
                targetSlot = 1;
            } else {
                targetSlot = (weapons.currentSlotIndex === 1) ? 1 : 0;
            }
            const currentGun = weapons.weaponSlots[targetSlot];

            // Nếu người chơi đang có súng (và không phải dao): vứt súng cũ ra đất, giữ nguyên phụ kiện
            if (currentGun && !currentGun.isKnife) {
                const attachMap = { ...weapons.getAttachmentsForGun(targetSlot) };
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

                // Dọn phụ kiện slot này trên người chơi
                const targetAttach = weapons.getAttachmentsForGun(targetSlot);
                targetAttach.barrel = null;
                targetAttach.magazine = null;
                targetAttach.optic = null;
                targetAttach.grip = null;

                // Sinh súng rơi ngoài đất tại vị trí người chơi
                this.spawnDroppedWeapon(this.player.position.clone(), droppedGunData);
            }

            // Trang bị súng mới
            weapons.weaponSlots[targetSlot] = newGun;
            weapons.ammo[newGun.id] = newGun.magSize;
            weapons.reserve[newGun.id] = Infinity;
            if (targetSlot === 1) weapons.secondaryWeapon = newGun;
            weapons.switchWeapon(targetSlot, this.player);

            // Ô trong hòm được lấy đi (gán null), súng cũ đã rơi ra ngoài mặt đất
            container.slots[selected.slotIndex] = null;
            this.notifyLootAction(container.id, selected.slotIndex, null);

            sounds.play('switchWeapon', { volume: 1.0, rate: 1.1 });
            this.ui?.showPickupAlert(`ĐÃ TRANG BỊ [${newGun.name.toUpperCase()}] CẤP ${newTier}! SÚNG CŨ ĐÃ RƠI RA ĐẤT.`);
            this.ui?.updateTacticalDock?.(weapons, this.player);

            // Kiểm tra xóa hòm nếu hòm đã trống
            if (this.checkAndRemoveEmptyContainer(container)) {
                this.ui?.showPickupAlert('HÒM ĐÃ HẾT ĐỒ VÀ BIẾN MẤT!');
                return true;
            }
            this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
            return true;
        }

        // 4. BOM & LỰU ĐẠN CHIẾN THUẬT -> Nhặt vào ô bom [3] hoặc [4]
        if (def.category === 'bomb' || def.isBomb || ['grenade_a', 'grenade_smoke', 'grenade_fire', 'grenade_freeze'].includes(selected.itemId)) {
            const bombConfig = getBombConfig(selected.itemId);
            const bombItem = {
                ...bombConfig,
                count: selected.count || 1
            };

            // Ưu tiên nạp vào slot bom 1 (index 2) nếu trống hoặc cùng loại
            if (!weapons.weaponSlots[2] || weapons.weaponSlots[2].id === bombItem.id) {
                if (weapons.weaponSlots[2]) {
                    weapons.weaponSlots[2].count = Math.min(2, (weapons.weaponSlots[2].count || 0) + bombItem.count);
                } else {
                    weapons.weaponSlots[2] = bombItem;
                }
            } else if (!weapons.weaponSlots[3] || weapons.weaponSlots[3].id === bombItem.id) {
                // Nhặt vào slot bom 2 (index 3)
                if (weapons.weaponSlots[3]) {
                    weapons.weaponSlots[3].count = Math.min(2, (weapons.weaponSlots[3].count || 0) + bombItem.count);
                } else {
                    weapons.weaponSlots[3] = bombItem;
                }
            } else {
                // Cả 2 slot bom đã đầy -> Thay thế ô bom slot 2
                weapons.weaponSlots[2] = bombItem;
            }

            container.slots[selected.slotIndex] = null;
            this.notifyLootAction(container.id, selected.slotIndex, null);
            sounds.play('switchWeapon', { volume: 0.95, rate: 1.4 });
            this.ui?.showPickupAlert(`ĐÃ TRANG BỊ [${def.name.toUpperCase()}]!`);
            this.ui?.updateTacticalDock?.(weapons, this.player);
            if (this.checkAndRemoveEmptyContainer(container)) {
                this.ui?.showPickupAlert('HÒM ĐÃ HẾT ĐỒ VÀ BIẾN MẤT!');
                return true;
            }
            this.ui?.refreshPUBGMiniCrate(container, this, this.getNearbyDroppedWeapons(4.5));
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
        if (this.activeContainer && this.requestLoot(this.activeContainer, slotIndex, 'backpack')) return;
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
                this.notifyLootAction(this.activeContainer.id, slotIndex, null);
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
                this.notifyLootAction(this.activeContainer.id, slotIndex, null);
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
            if (this.requestCommand({ type: 'store_item', containerId: this.activeContainer.id, slotIndex })) return;
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
        if (itemEntry?.container && this.requestLoot(itemEntry.container, itemEntry.slotIndex, 'backpack')) return true;
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
                this.notifyLootAction(container.id, slotIndex, null);
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
            this.notifyLootAction(container.id, slotIndex, null);
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
        if (this.requestCommand({ type: 'drop_item', slotIndex })) return;
        const dropped = this.inventory.dropItem(slotIndex);
        if (!dropped) return;
        const def = LOOT_ITEMS[dropped.itemId];
        sounds.playItemMove?.();
        this.ui?.showPickupAlert(`ĐÃ VỨT [${def?.name?.toUpperCase() || dropped.itemId}] RA MẶT ĐẤT`);
        this.ui?.refreshSmartInventory();

        const spawnPos = this.player?.position ? this.player.position.clone() : new THREE.Vector3();
        spawnPos.y = 0;

        if (!window.game?.network?.active || window.game?.network?.host) {
            this.spawnDroppedItemContainer(spawnPos, dropped);
        } else {
            window.game.network.sendCommand({
                type: 'drop_item',
                item: dropped,
                position: spawnPos.toArray()
            });
        }
    }

    // Sinh thùng đồ dã chiến chứa vật phẩm vừa vứt từ ba lô
    spawnDroppedItemContainer(position, item, customId = null) {
        const def = th_resolveLootItem(item.itemId);
        const itemName = def?.name || 'VẬT PHẨM';
        const container = this.spawnContainer('wooden_crate', position, {
            id: customId || ('drop_crate_' + Math.random().toString(36).substring(2, 9)),
            customName: `ĐỒ RƠI: ${itemName.toUpperCase()}`,
            slots: [item]
        });
        return container;
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
        if (this.requestCommand({ type: 'use_item', slotIndex })) return;
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
                        const pushDir = new THREE.Vector3().subVectors(enemy.position, targetPos).setY(0);
                        if (pushDir.lengthSq() > 0.0001) pushDir.normalize();
                        else pushDir.set(0, 0, 1);
                        enemy.takeDamage(dmg * falloff, 3, false, pushDir);
                    }
                }
            }
            // Hiệu ứng nổ, hạt lửa và chấn động
            const particles = this.player?.weapons?.particles || window.game?.particles;
            particles?.createExplosion?.(targetPos, 0xff5500, 40, radius);
            this.player.applyKickbackAndShake?.(4.0, 0.45);
            sounds.play?.('enemyExplode', { volume: 1.0 }) || sounds.play?.('enemyDestroy', { volume: 1.0 });
            used = true;
        } else if (effect.type === 'smoke_grenade') {
            // Ném lựu đạn khói: Tạo cụm khói 3D che mắt và làm chậm quái vật trong 10 giây
            const targetPos = this.player.aimPoint ? this.player.aimPoint.clone() : this.player.position.clone();
            targetPos.y = 0.05;
            this.player?.weapons?.createSmokeZone?.(targetPos, 6.0, 10.0);
            const particles = this.player?.weapons?.particles || window.game?.particles;
            particles?.createExplosion?.(targetPos, 0x94a3b8, 25, 6.0);
            particles?.createImpactSparks?.(targetPos, new THREE.Vector3(0, 1, 0), 0xb0bec5, 20);
            if (this.waveManager?.enemies) {
                for (const enemy of this.waveManager.enemies) {
                    if (enemy.isDead) continue;
                    if (enemy.position.distanceTo(targetPos) <= 9.0) {
                        if (enemy.speed && effect.slow) enemy.speed *= (1 - effect.slow);
                    }
                }
            }
            sounds.play('land', { volume: 0.8, rate: 0.8 });

            // Đồng bộ sự kiện vùng khói cho các người chơi khác trong phòng multiplayer
            if (window.game?.network?.active && window.game?.network?.host) {
                (window.game.networkEvents ||= []).push({
                    type: 'smoke_zone',
                    position: targetPos.toArray(),
                    radius: 6.0,
                    duration: 10.0
                });
            }
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
        // Chỉ Host hoặc chế độ chơi đơn mới điều phối bộ đếm Airdrop
        const isClient = window.game?.network?.active && !window.game?.network?.host;
        if (!isClient) {
            this.airdropCountdown -= delta;
            if (this.airdropCountdown <= 0) {
                this.airdropCountdown = this.airdropInterval;
                this.triggerAirdropEvent();
            }
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

        // Cập nhật thời gian sống của các hòm đồ (Tự động biến mất sau 30 giây)
        for (let i = this.containers.length - 1; i >= 0; i--) {
            const c = this.containers[i];
            if (!isClient && typeof c.life === 'number') {
                c.life -= delta;
                if (c.life <= 0) {
                    if (this.activeContainer === c) {
                        this.activeContainer = null;
                        this.closeContainerUI();
                        this.ui?.showPickupAlert('HÒM ĐỒ ĐÃ HẾT HẠN (30 GIÂY) VÀ TỰ BIẾN MẤT!');
                    }
                    c.dispose();
                    this.containers.splice(i, 1);
                    continue;
                }
                // Hiệu ứng nhấp nháy khi còn dưới 8s
                if (c.interactRing && c.life < 8) {
                    c.interactRing.material.opacity = (Math.sin(performance.now() * 0.015) > 0) ? 0.75 : 0.15;
                }
            }
        }

        // 5. Cập nhật các khẩu súng rơi ngoài mặt đất (tồn tại 1 phút = 60s)
        for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
            const dw = this.droppedWeapons[i];
            const alive = dw.update(isClient ? 0 : delta);
            if (!alive) {
                dw.dispose();
                this.droppedWeapons.splice(i, 1);
            }
        }

        if (window.game?.pauseMenuOpen || this.player.isDead || this.player.isDowned) {
            this.closeContainerUI();
            this.ui?.hideDroppedWeaponPrompt?.();
            return;
        }

        // 2. Kiểm tra tiến trình mở hòm theo phạm vi (Range-based Proximity Opening)
        const nearest = this.getNearestInteractableContainer();
        if (nearest?.id !== this.dismissedContainerId) this.dismissedContainerId = null;

        // Tự động kích hoạt mở hòm ngay khi người chơi bước vào vùng sáng của hòm
        // Không cần nhấn phím, không chặn bắn súng hay di chuyển
        if (nearest && nearest.id !== this.dismissedContainerId && !nearest.isOpen && !this.isSearching) {
            this.tryStartSearch(nearest);
        }

        // Nếu hòm đang mở: tự động đóng khi người chơi di chuyển ra xa hoặc cập nhật vật phẩm lân cận
        if (this.activeContainer && this.activeContainer.isOpen) {
            const dist = this.player.position.distanceTo(this.activeContainer.position);
            const maxRange = (this.activeContainer.interactionRadius || 3.6) + 1.2;
            if (dist > maxRange) {
                this.closeContainerUI();
            } else {
                const nearbyDropped = this.getNearbyDroppedWeapons(4.5);
                this.ui?.refreshPUBGMiniCrate(this.activeContainer, this, nearbyDropped);
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
            const timeLabel = nearest.life ? ` (${Math.max(1, Math.ceil(nearest.life))}s)` : '';
            this.ui?.showContainerPrompt((nearest.config?.promptLabel || 'LỤC HÒM') + timeLabel, nearest.position, this.player.camera);
        } else if (!this.isSearching) {
            this.ui?.hideContainerPrompt();
        }

        // Tìm khẩu súng rơi gần nhất trong bán kính tương tác
        let nearestDropped = null;
        let minDroppedDist = Infinity;
        for (const dw of this.droppedWeapons) {
            const dist = this.player.position.distanceTo(dw.group.position);
            if (dist <= dw.interactionRadius && dist < minDroppedDist) {
                minDroppedDist = dist;
                nearestDropped = dw;
            }
        }
        this.nearestDroppedWeapon = nearestDropped;

        // Quản lý hiển thị HUD prompt tương tác nhặt súng rơi
        if (nearestDropped && !this.activeContainer?.isOpen && !this.isSearching) {
            const hasEmptySlot = (!this.player?.weapons?.weaponSlots[0] || !this.player?.weapons?.weaponSlots[1]);
            const isSwap = !hasEmptySlot;
            this.ui?.showDroppedWeaponPrompt(nearestDropped.gunData, nearestDropped.group.position, this.player.camera, nearestDropped.life, isSwap);
        } else {
            this.ui?.hideDroppedWeaponPrompt?.();
        }
    }

    requestCommand(command) {
        if (this.player?.weapons?.onCommand) {
            this.player.weapons.onCommand(command);
            return true;
        }
        return false;
    }

    requestLoot(container, slotIndex, mode) {
        const slot = container.slots[slotIndex];
        if (!slot) return false;
        return this.requestCommand({ type: 'loot_slot', containerId: container.id, slotIndex, lootId: slot.lootId, mode });
    }

    notifyLootAction() {} // Inventory and world changes travel together in the host snapshot.

    processRemoteCommand(player, command) {
        if (!player || player.isDead || player.isDowned) return false;
        // A per-player view shares world entities, but never the host's backpack or UI.
        const context = Object.create(this);
        context.player = player;
        context.inventory = player.lootInventory ||= new PlayerInventory(5, 6);
        context.ui = null;
        context.activeContainer = null;
        const container = this.containers.find(c => c.id === command.containerId);
        if (command.type === 'sort_inventory') return context.inventory.autoSort();
        if (command.type === 'detach_attachment') {
            const mods = player.weapons.getAttachmentsForGun(command.gunSlot);
            const itemId = mods?.[command.attachmentSlot];
            if (itemId && context.inventory.addItem(itemId, 1, true)) player.weapons.detachMod(command.attachmentSlot, command.gunSlot);
            return;
        }
        if (command.type === 'equip_attachment') {
            if (command.gunSlot !== 0 && command.gunSlot !== 1) return false;
            if (!player.weapons.weaponSlots[command.gunSlot]) return false;
            if (command.containerId && (!container || player.position.distanceTo(container.position) > 6.5)) return false;
            const slots = container ? container.slots : context.inventory.slots;
            const slot = slots[command.slotIndex];
            if (!slot || (container && slot.lootId !== command.lootId)) return false;
            const def = LOOT_ITEMS[slot.itemId];
            if (def?.category !== 'attachment' || def.slot !== command.attachmentSlot) return false;
            const previous = player.weapons.attachMod(def.slot, slot.itemId, command.gunSlot);
            slots[command.slotIndex] = previous ? { itemId: previous, count: 1, revealed: true } : null;
            if (container) this.checkAndRemoveEmptyContainer(container);
            return true;
        }
        if (command.type === 'pickup_weapon') {
            return context.pickupDroppedWeapon(this.droppedWeapons.find(w => w.id === command.weaponDropId));
        }
        if (command.type === 'drop_item') return context.dropItemFromBackpack(command.slotIndex);
        if (command.type === 'use_item') return context.useItem(command.slotIndex);
        if (!container || player.position.distanceTo(container.position) > 6.5) return false;
        context.activeContainer = container;
        if (command.type === 'store_item') return context.transferItem('player', command.slotIndex);
        const slot = container.slots[command.slotIndex];
        if (command.type !== 'loot_slot' || !slot || !slot.lootId || slot.lootId !== command.lootId) return false;
        if (command.mode === 'backpack') return context.lootNearbyItem({ container, slotIndex: command.slotIndex });
        const wasOpen = container.isOpen;
        container.isOpen = true;
        try { return context.th_smartLootCrate(container, command.slotIndex); }
        finally { container.isOpen = wasOpen; }
    }

    // Đóng gói trạng thái tài nguyên hòm đồ & hòm thính của toàn map
    snapshot() {
        for (const container of this.containers) {
            for (const slot of container.slots) if (slot) slot.lootId ||= THREE.MathUtils.generateUUID();
        }
        return {
            containers: this.containers.map(c => c.snapshot()),
            airdropDrops: this.airdropDrops.map(d => ({
                id: d.id,
                currentPos: d.currentPos.toArray(),
                targetPos: d.targetPos.toArray(),
                landed: !!d.landed,
                smokeTimer: d.smokeTimer
            })),
            activeAirdropZone: this.activeAirdropZone ? { ...this.activeAirdropZone } : null,
            droppedWeapons: this.droppedWeapons.map(dw => ({
                id: dw.id,
                position: dw.group.position.toArray(),
                gunData: dw.gunData,
                life: Number.isFinite(dw.life) ? dw.life : -1
            }))
        };
    }

    // Client áp dụng trạng thái tài nguyên hòm đồ & hòm thính từ Host
    applySnapshot(snap) {
        if (!snap) return;

        // 1. Đồng bộ vùng đánh dấu radar Airdrop
        this.activeAirdropZone = snap.activeAirdropZone ? { ...snap.activeAirdropZone } : null;

        // 2. Đồng bộ các hòm thính đang rơi
        const dropSnaps = snap.airdropDrops || [];
        const snapDropIds = new Set(dropSnaps.map(d => d.id));
        for (const dSnap of dropSnaps) {
            let drop = this.airdropDrops.find(d => d.id === dSnap.id);
            if (!drop) {
                const targetPos = new THREE.Vector3().fromArray(dSnap.targetPos);
                drop = new AirdropDropEntity(this.scene, targetPos, this, { id: dSnap.id });
                drop.currentPos.fromArray(dSnap.currentPos);
                drop.group.position.copy(drop.currentPos);
                this.airdropDrops.push(drop);
                sounds.playAirdropPlaneSound?.();
                this.ui?.showBanner('CẢNH BÁO: HÒM THÍNH TIẾP TẾ CHIẾN THUẬT ĐANG THẢ DÙ!');
            }
            drop.currentPos.fromArray(dSnap.currentPos);
            drop.group.position.copy(drop.currentPos);
            drop.landed = !!dSnap.landed;
            drop.smokeTimer = dSnap.smokeTimer;
            if (drop.landed) {
                drop.chuteMesh.visible = false;
                drop.linesMesh.visible = false;
            }
        }
        for (let i = this.airdropDrops.length - 1; i >= 0; i--) {
            if (!snapDropIds.has(this.airdropDrops[i].id)) {
                this.airdropDrops[i].dispose();
                this.airdropDrops.splice(i, 1);
            }
        }

        // 3. Đồng bộ danh sách hòm đồ (Containers)
        const containerSnaps = snap.containers || [];
        const snapContainerIds = new Set(containerSnaps.map(c => c.id));
        const byId = new Map(this.containers.map(c => [c.id, c]));

        for (const cSnap of containerSnaps) {
            let container = byId.get(cSnap.id);
            if (!container) {
                const pos = new THREE.Vector3().fromArray(cSnap.position);
                container = new LootContainer(this.scene, cSnap.type, pos, {
                    id: cSnap.id,
                    customName: cSnap.name,
                    slots: cSnap.slots,
                    isOpen: false,
                    isUnlocked: cSnap.isUnlocked,
                    isLooted: cSnap.isLooted
                });
                this.containers.push(container);
            } else {
                container.slots = cSnap.slots.map(s => s ? { ...s } : null);
                // Opening a panel is local UI state, while its contents belong to the host.
                container.isUnlocked ||= !!cSnap.isUnlocked;
                container.isLooted = !!cSnap.isLooted;
                container.checkEmpty();
            }
            container.life = cSnap.life === -1 ? Infinity : (cSnap.life ?? container.life);
            if (this.activeContainer && this.activeContainer.id === container.id) {
                this.ui?.refreshPUBGMiniCrate?.(this.activeContainer, this);
            }
        }

        for (let i = this.containers.length - 1; i >= 0; i--) {
            const c = this.containers[i];
            if (!snapContainerIds.has(c.id)) {
                if (this.activeContainer === c) {
                    this.closeContainerUI();
                }
                c.dispose();
                this.containers.splice(i, 1);
            }
        }

        // 4. Đồng bộ danh sách súng rơi ngoài đất (Dropped Weapons)
        const weaponSnaps = snap.droppedWeapons || [];
        const snapWeaponIds = new Set(weaponSnaps.map(w => w.id));
        const byWeaponId = new Map(this.droppedWeapons.map(w => [w.id, w]));

        for (const wSnap of weaponSnaps) {
            let dw = byWeaponId.get(wSnap.id);
            if (!dw) {
                const pos = new THREE.Vector3().fromArray(wSnap.position);
                dw = this.spawnDroppedWeapon(pos, wSnap.gunData, wSnap.id, wSnap.life);
            } else {
                dw.life = wSnap.life === -1 ? 30.0 : wSnap.life;
                if (Array.isArray(wSnap.position) && dw.group) {
                    dw.group.position.fromArray(wSnap.position);
                }
            }
        }

        for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
            const dw = this.droppedWeapons[i];
            if (!snapWeaponIds.has(dw.id)) {
                if (this.nearestDroppedWeapon === dw) {
                    this.nearestDroppedWeapon = null;
                    this.ui?.hideDroppedWeaponPrompt?.();
                }
                dw.dispose();
                this.droppedWeapons.splice(i, 1);
            }
        }
    }

    clearAll() {
        while (this.containers.length) {
            this.containers.pop().dispose();
        }
        while (this.airdropDrops.length) {
            this.airdropDrops.pop().dispose();
        }
        while (this.droppedWeapons.length) {
            this.droppedWeapons.pop().dispose();
        }
        this.nearestDroppedWeapon = null;
        this.ui?.hideDroppedWeaponPrompt?.();
        this.activeAirdropZone = null;
        this.closeContainerUI();
    }
}
