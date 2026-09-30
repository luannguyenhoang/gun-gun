import * as THREE from 'three';
import { GLTFLoader } from '../libs/loaders/GLTFLoader.js';
import { sounds } from './audio.js';

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
export const LOOT_ITEMS = {
    // 1. Phụ kiện súng (Weapon Attachments / Mods)
    // --- 1.1 Đầu nòng (Muzzle) ---
    attach_compensator: {
        id: 'attach_compensator',
        name: 'Nòng Giảm Giật Compensator',
        category: 'attachment',
        slot: 'muzzle',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'COMP',
        iconImage: 'assets/previews/kenney-blaster/silencer-small.png',
        description: 'Bộ tản khí đầu nòng: Giảm 25% độ giật súng, tăng 15% tốc độ co tâm hồi phục.',
        value: 750,
        stackMax: 1,
        size: [1, 1],
        effects: { recoil: -0.25, recovery: 0.15 }
    },
    attach_silencer: {
        id: 'attach_silencer',
        name: 'Ống Giảm Thanh Tactical Silencer',
        category: 'attachment',
        slot: 'muzzle',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'SIL',
        iconImage: 'assets/previews/kenney-blaster/silencer-larger.png',
        description: 'Ống triệt âm đặc nhiệm: Giảm 60% bán kính tiếng ồn báo động zombie, giảm 10% độ giật.',
        value: 1250,
        stackMax: 1,
        size: [1, 1],
        effects: { soundRadius: -0.60, recoil: -0.10 }
    },
    attach_flash_hider: {
        id: 'attach_flash_hider',
        name: 'Loa Che Lửa Flash Hider',
        category: 'attachment',
        slot: 'muzzle',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'FH',
        iconImage: 'assets/previews/kenney-blaster/silencer-small.png',
        description: 'Loa triệt tiêu ánh chớp đầu nòng: Triệt tiêu tia lửa khi bắn, giảm 12% độ giật, tăng 10% độ chụm ADS.',
        value: 400,
        stackMax: 1,
        size: [1, 1],
        effects: { recoil: -0.12, adsSpread: -0.10 }
    },

    // --- 1.2 Kính ngắm (Optic / Sight) ---
    attach_red_dot: {
        id: 'attach_red_dot',
        name: 'Kính Ngắm Phản Xạ Red Dot',
        category: 'attachment',
        slot: 'optic',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'RDS',
        iconImage: 'assets/previews/kenney-blaster/scope-small.png',
        description: 'Kính ngắm điểm đỏ chấm phản xạ: Tăng nhẹ tầm nhìn khi ngắm ADS (x1.35), giảm 20% góc tản đạn.',
        value: 600,
        stackMax: 1,
        size: [1, 1],
        effects: { adsZoom: 1.35, adsSpread: -0.20 }
    },
    attach_scope_x2: {
        id: 'attach_scope_x2',
        name: 'Ống Ngắm Tác Chiến Scope x2',
        category: 'attachment',
        slot: 'optic',
        rarity: 'epic',
        color: '#b026ff',
        icon: '2X',
        iconImage: 'assets/previews/kenney-blaster/scope-large-a.png',
        description: 'Ống ngắm quang học cự ly trung bình: Mở rộng tầm nhìn x2.0, giảm 40% góc tản đạn ADS, làm chậm 15% tốc độ xoay.',
        value: 1100,
        stackMax: 1,
        size: [1, 1],
        effects: { adsZoom: 2.0, adsSpread: -0.40, turnPenalty: -0.15 }
    },
    attach_scope_x4: {
        id: 'attach_scope_x4',
        name: 'Ống Ngắm Bắn Tỉa Scope x4',
        category: 'attachment',
        slot: 'optic',
        rarity: 'legendary',
        color: '#ffaa00',
        icon: '4X',
        iconImage: 'assets/previews/kenney-blaster/scope-large-b.png',
        description: 'Ống ngắm bắn tỉa tầm xa phóng đại x3.5: Giảm 60% tản đạn ngắm tĩnh, nhưng làm chậm 30% tốc độ xoay người.',
        shortDesc: 'Độ phóng đại 4x tầm xa',
        theme: 'silver',
        value: 1900,
        stackMax: 1,
        size: [1, 1],
        effects: { adsZoom: 3.5, adsSpread: -0.60, turnPenalty: -0.30 }
    },
    attach_scope_x6: {
        id: 'attach_scope_x6',
        name: 'Ống Ngắm 6x',
        category: 'attachment',
        slot: 'optic',
        rarity: 'epic',
        color: '#b026ff',
        icon: '6X',
        iconImage: 'assets/previews/kenney-blaster/scope-large-b.png',
        description: 'Ống ngắm quang học phóng đại 6x cự ly xa.',
        shortDesc: 'Độ phóng đại 6x cự ly xa',
        theme: 'silver',
        value: 2200,
        stackMax: 1,
        size: [1, 1],
        effects: { adsZoom: 4.5, adsSpread: -0.70, turnPenalty: -0.35 }
    },
    attach_scope_x8: {
        id: 'attach_scope_x8',
        name: 'Ống Ngắm 8x',
        category: 'attachment',
        slot: 'optic',
        rarity: 'legendary',
        color: '#ffaa00',
        icon: '8X',
        iconImage: 'assets/previews/kenney-blaster/scope-large-b.png',
        description: 'Ống ngắm bắn tỉa chuyên nghiệp phóng đại 8x tối đa.',
        shortDesc: 'Độ phóng đại 8x tối đa',
        theme: 'silver',
        value: 3000,
        stackMax: 1,
        size: [1, 1],
        effects: { adsZoom: 6.0, adsSpread: -0.80, turnPenalty: -0.45 }
    },

    // --- 1.3 Băng đạn (Magazine) ---
    attach_ext_mag: {
        id: 'attach_ext_mag',
        name: 'Băng Đạn Mở Rộng Extended Mag',
        category: 'attachment',
        slot: 'magazine',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'EXT',
        iconImage: 'assets/previews/kenney-blaster/clip-large.png',
        description: 'Hộp tiếp đạn mở rộng sức chứa: Tăng +50% sức chứa băng đạn (tăng từ 16 lên 24-30 viên).',
        shortDesc: '+50% Sức chứa băng đạn',
        theme: 'silver',
        value: 850,
        stackMax: 1,
        size: [1, 1],
        effects: { magBonus: 14 }
    },
    attach_quickdraw_mag: {
        id: 'attach_quickdraw_mag',
        name: 'Băng Nạp Nhanh Quickdraw Mag',
        category: 'attachment',
        slot: 'magazine',
        rarity: 'epic',
        color: '#eab308',
        icon: 'QDM',
        iconImage: 'assets/previews/kenney-blaster/clip-small.png',
        description: 'Băng đạn kẹp trợ lực nạp siêu tốc: Giảm 35% thời gian nạp đạn cho súng.',
        shortDesc: '+ Tốc độ nạp đạn (Reloading speed)',
        theme: 'gold',
        value: 950,
        stackMax: 1,
        size: [1, 1],
        effects: { reloadTime: -0.35 }
    },

    // --- 1.4 Tay cầm / Báng súng (Grip / Stock) ---
    attach_grip_tactical: {
        id: 'attach_grip_tactical',
        name: 'Tay Cầm Tác Chiến Tactical Grip',
        category: 'attachment',
        slot: 'grip',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'GRP',
        iconImage: 'assets/previews/kenney-blaster/blaster-a.png',
        description: 'Tay cầm dọc dã chiến: Tăng 35% tốc độ co tâm, giảm 30% độ tản đạn khi vừa chạy vừa bắn.',
        shortDesc: '+35% Tốc độ co tâm, giảm rung',
        theme: 'silver',
        value: 700,
        stackMax: 1,
        size: [1, 1],
        effects: { recovery: 0.35, runSpread: -0.30 }
    },
    attach_stock_heavy: {
        id: 'attach_stock_heavy',
        name: 'Báng Súng Hấp Thụ Giật Heavy Stock',
        category: 'attachment',
        slot: 'stock',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'STK',
        iconImage: 'assets/previews/kenney-blaster/blaster-d.png',
        description: 'Báng tỳ đầm chắc cao cấp: Giảm 20% độ giật súng, tăng 20% tốc độ ổn định đường ngắm.',
        shortDesc: 'Giảm 20% độ giật súng',
        theme: 'silver',
        value: 1050,
        stackMax: 1,
        size: [1, 1],
        effects: { recoil: -0.20, recovery: 0.20 }
    },
    attach_stock_tactical: {
        id: 'attach_stock_tactical',
        name: 'Báng Chiến Thuật Tactical Stock',
        category: 'attachment',
        slot: 'stock',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'TCK',
        iconImage: 'assets/previews/kenney-blaster/blaster-c.png',
        description: 'Báng súng hợp kim nhẹ: Tăng độ ổn định và giảm giật khi bắn liên thanh.',
        shortDesc: 'Tăng ổn định khi xả đạn',
        theme: 'silver',
        value: 800,
        stackMax: 1,
        size: [1, 1],
        effects: { recoil: -0.15, recovery: 0.25 }
    },

    // 2. Đạn dược chuyên dụng (Ammunition)
    ammo_12gauge: {
        id: 'ammo_12gauge',
        name: '12 Gauge Ammo',
        category: 'ammo',
        rarity: 'rare',
        color: '#eab308',
        icon: '12G',
        iconImage: 'assets/previews/kenney-blaster/clip-small.png',
        description: 'Hộp đạn ghém 12 Gauge tiêu chuẩn dùng cho mọi loại súng Shotgun dã chiến.',
        shortDesc: 'Cho súng Shotgun (For Shotguns)',
        theme: 'gold',
        value: 350,
        stackMax: 10,
        size: [1, 1],
        effect: { type: 'add_ammo', packs: 3 }
    },
    ammo_556: {
        id: 'ammo_556',
        name: 'Đạn 5.56mm',
        category: 'ammo',
        rarity: 'rare',
        color: '#94a3b8',
        icon: '5.56',
        iconImage: 'assets/previews/kenney-blaster/bullet-foam-tip.png',
        description: 'Hộp đạn 5.56mm sơ tốc cao dùng cho súng trường tiến công tầm trung và xa.',
        shortDesc: 'Dùng cho súng 5.56mm (AR)',
        theme: 'silver',
        value: 380,
        stackMax: 10,
        size: [1, 1],
        effect: { type: 'add_ammo', packs: 4 }
    },
    ammo_762: {
        id: 'ammo_762',
        name: 'Đạn 7.62mm',
        category: 'ammo',
        rarity: 'rare',
        color: '#94a3b8',
        icon: '7.62',
        iconImage: 'assets/previews/kenney-blaster/bullet-foam-tip-thick.png',
        description: 'Đạn 7.62mm uy lực xuyên phá cao chuyên dùng cho súng AKM và Blaster-X.',
        shortDesc: 'Dùng cho súng 7.62mm / AKM',
        theme: 'silver',
        value: 400,
        stackMax: 10,
        size: [1, 1],
        effect: { type: 'add_ammo', packs: 4 }
    },
    ammo_9mm: {
        id: 'ammo_9mm',
        name: 'Đạn 9mm',
        category: 'ammo',
        rarity: 'common',
        color: '#94a3b8',
        icon: '9MM',
        iconImage: 'assets/previews/kenney-blaster/bullet-foam.png',
        description: 'Đạn 9mm cơ bản dùng cho súng ngắn P92 và các dòng tiểu liên SMG.',
        shortDesc: 'Dùng cho súng P92 & SMG',
        theme: 'silver',
        value: 200,
        stackMax: 10,
        size: [1, 1],
        effect: { type: 'add_ammo', packs: 3 }
    },
    ammo_hollow: {
        id: 'ammo_hollow',
        name: 'Hộp Đạn Hollow Point HP (Mô Mềm)',
        category: 'ammo',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'HP',
        iconImage: 'assets/previews/kenney-blaster/bullet-foam-tip.png',
        description: 'Đạn nở khoang rỗng khi va chạm: Tăng 40% sát thương chí mạng crit lên quái không mặc giáp.',
        shortDesc: '+40% Sát thương chí mạng',
        theme: 'silver',
        value: 450,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'crit_boost', duration: 30, value: 0.4 }
    },
    ammo_standard: {
        id: 'ammo_standard',
        name: 'Băng Đạn Quân Dụng FMJ',
        category: 'ammo',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'FMJ',
        iconImage: 'assets/previews/kenney-blaster/clip-small.png',
        description: 'Đạn bọc kim loại toàn phần FMJ cân bằng, nạp đầy 4 băng đạn dự trữ cho mọi loại súng.',
        shortDesc: 'Nạp đầy 4 băng đạn dự trữ',
        theme: 'silver',
        value: 200,
        stackMax: 5,
        size: [1, 1],
        effect: { type: 'add_ammo', packs: 4 }
    },
    ammo_ap: {
        id: 'ammo_ap',
        name: 'Hộp Đạn Xuyên Giáp AP',
        category: 'ammo',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'AP',
        iconImage: 'assets/previews/kenney-blaster/bullet-foam-tip-thick.png',
        description: 'Đạn lõi vonfram mật độ cao: Tăng 100% xuyên thấu giáp và xé rách mô cứng đột biến của Mutant.',
        shortDesc: 'Tăng 100% xuyên thấu giáp',
        theme: 'silver',
        value: 650,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'damage_boost', duration: 45, value: 0.35 }
    },

    // 3. Vật phẩm Y tế / Nước tăng lực / Sinh tồn (Meds, Drinks & Throwables)
    energy_drink: {
        id: 'energy_drink',
        name: 'Nước tăng lực',
        category: 'medical',
        rarity: 'rare',
        color: '#eab308',
        icon: 'ENR',
        iconImage: 'assets/previews/kenney-blaster/target-detail.png',
        description: 'Lon nước tăng lực hồi phục sinh lực và tăng tốc độ chạy dã chiến.',
        shortDesc: 'Hồi phục 40 Máu',
        theme: 'gold',
        value: 300,
        stackMax: 5,
        size: [1, 1],
        effect: { type: 'heal', amount: 40, speedBoost: 1.2, duration: 15 }
    },
    medkit_military: {
        id: 'medkit_military',
        name: 'First Aid Kit',
        category: 'medical',
        rarity: 'rare',
        color: '#eab308',
        icon: 'FAK',
        iconImage: 'assets/previews/kenney-blaster/crate-small.png',
        description: 'Bộ cứu thương dã chiến cao cấp: Cầm máu tức thì và hồi phục 75 Máu.',
        shortDesc: 'Hồi phục 75 Máu (Recovers to 75)',
        theme: 'gold',
        value: 500,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'heal', amount: 75 }
    },
    painkiller_bottle: {
        id: 'painkiller_bottle',
        name: 'Thuốc giảm đau',
        category: 'medical',
        rarity: 'rare',
        color: '#94a3b8',
        icon: 'PKL',
        iconImage: 'assets/previews/kenney-blaster/clip-small.png',
        description: 'Lọ thuốc giảm đau giúp hồi phục 60 Máu và tăng khả năng chịu đòn.',
        shortDesc: 'Hồi phục 60 Máu (Painkiller)',
        theme: 'silver',
        value: 450,
        stackMax: 5,
        size: [1, 1],
        effect: { type: 'heal', amount: 60 }
    },
    stun_grenade: {
        id: 'stun_grenade',
        name: 'Lựu đạn gây choáng',
        category: 'throwable',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'STN',
        iconImage: 'assets/previews/kenney-blaster/grenade-a.png',
        description: 'Lựu đạn chớp âm thanh gây mù và làm choáng toàn bộ zombie trong bán kính phát nổ.',
        shortDesc: 'Làm mù mục tiêu (Stun)',
        theme: 'silver',
        value: 350,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'stun_area', duration: 4, radius: 8 }
    },
    bandage_field: {
        id: 'bandage_field',
        name: 'Băng Gạc Ép Dã Chiến',
        category: 'medical',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'BNG',
        description: 'Băng cuộn cầm máu nhanh: Hồi phục tức thì 35 Máu và ngăn chảy máu mô.',
        shortDesc: 'Hồi phục tức thì 35 Máu',
        theme: 'silver',
        value: 220,
        stackMax: 4,
        size: [1, 1],
        effect: { type: 'heal', amount: 35 }
    },
    painkiller_morphine: {
        id: 'painkiller_morphine',
        name: 'Ống Tiêm Giảm Đau Morphine',
        category: 'medical',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'MOR',
        description: 'Xóa bỏ mọi cảm giác đau đớn, tăng 35% tốc độ di chuyển trong 20 giây.',
        shortDesc: '+35% Tốc độ di chuyển',
        theme: 'silver',
        value: 400,
        stackMax: 4,
        size: [1, 1],
        effect: { type: 'speed_boost', duration: 20, multiplier: 1.35 }
    },
    stimpack_adrenaline: {
        id: 'stimpack_adrenaline',
        name: 'Huyết Thanh Adrenaline Combat',
        category: 'medical',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'ADR',
        description: 'Kích thích phản xạ thần kinh: Tăng 25% tốc độ xả đạn và hồi 30 Máu khẩn cấp.',
        shortDesc: '+25% Tốc độ xả đạn & hồi 30 Máu',
        theme: 'silver',
        value: 750,
        stackMax: 2,
        size: [1, 1],
        effect: { type: 'stimpack', duration: 15, fireRateBoost: 0.25, heal: 30 }
    },
    // 4. Phế liệu nâng cấp & Chế tạo (Scraps / Gun Parts)
    scrap_metal: {
        id: 'scrap_metal',
        name: 'Phế Liệu Kim Loại Vũ Khí',
        category: 'scrap',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'SCR',
        iconImage: 'assets/previews/kenney-blaster/target-fragment-small.png',
        description: 'Các mảnh hợp kim dùng để bảo trì vũ khí, gia cố giáp hoặc quy đổi 300 Điểm sinh tồn.',
        shortDesc: 'Vật liệu bảo trì súng',
        theme: 'silver',
        value: 300,
        stackMax: 10,
        size: [1, 1],
        effect: { type: 'score', points: 300 }
    },
    gun_parts: {
        id: 'gun_parts',
        name: 'Cụm Linh Kiện Vũ Khí',
        category: 'scrap',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'PRT',
        iconImage: 'assets/previews/kenney-blaster/target-fragment-large.png',
        description: 'Linh kiện cơ khí chính xác dùng để độ súng và thay thế phụ tùng, quy đổi 650 Điểm sinh tồn.',
        shortDesc: 'Linh kiện cơ khí độ súng',
        theme: 'silver',
        value: 650,
        stackMax: 5,
        size: [1, 1],
        effect: { type: 'score', points: 650 }
    },
    weapon_parts_core: {
        id: 'weapon_parts_core',
        name: 'Khối Cơ Khí Chế Tạo Vũ Khí',
        category: 'scrap',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'COR',
        iconImage: 'assets/previews/kenney-blaster/target-detail.png',
        description: 'Khối cơ cấu khóa nòng cao cấp của kho khí tài quân sự. Quy đổi 1200 Điểm sinh tồn.',
        shortDesc: 'Khối cơ cấu khóa nòng',
        theme: 'silver',
        value: 1200,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'score', points: 1200 }
    },

    // 5. Mũ & Giáp bảo hộ (Equipment / Armor & Helmet)
    helmet_tactical: {
        id: 'helmet_tactical',
        name: 'Mũ FAST-MT',
        category: 'equipment',
        slot: 'helmet',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'HLM',
        iconImage: 'assets/previews/kenney-blaster/target-detail.png',
        description: 'Mũ bảo hộ carbon tăng +40 Giáp tối đa và giảm sát thương chí mạng vào đầu.',
        shortDesc: '+40 Giáp, chống chí mạng',
        theme: 'silver',
        value: 700,
        stackMax: 1,
        size: [1, 1],
        effect: { type: 'equip_armor', bonusShield: 40 }
    },
    armor_vest_lvl4: {
        id: 'armor_vest_lvl4',
        name: 'Áo Giáp Kevlar Cấp 4',
        category: 'equipment',
        slot: 'armor',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'LV4',
        iconImage: 'assets/previews/kenney-blaster/crate-small.png',
        description: 'Áo giáp sợi aramid tăng thêm +60 Giáp tối đa và lập tức sạc đầy lớp khiên phòng hộ.',
        shortDesc: '+60 Giáp bảo hộ dã chiến',
        theme: 'silver',
        value: 900,
        stackMax: 1,
        size: [2, 1],
        effect: { type: 'equip_armor', bonusShield: 60 }
    },
    armor_vest_lvl6: {
        id: 'armor_vest_lvl6',
        name: 'Áo Giáp Gốm Titan Cấp 6',
        category: 'equipment',
        slot: 'armor',
        rarity: 'legendary',
        color: '#ffaa00',
        icon: 'LV6',
        iconImage: 'assets/previews/kenney-blaster/crate-wide.png',
        description: 'Giáp tấm gốm cao cấp cấp độ đặc nhiệm: Tăng +120 Giáp tối đa và giảm 25% sát thương nhận vào.',
        shortDesc: '+120 Giáp, giảm 25% sát thương',
        theme: 'silver',
        value: 2800,
        stackMax: 1,
        size: [2, 2],
        effect: { type: 'equip_armor', bonusShield: 120, damageReduction: 0.25 }
    },

    // 6. Vũ khí nhặt được (Weapons)
    weapon_shotgun_s1897: {
        id: 'weapon_shotgun_s1897',
        name: 'S1897',
        category: 'weapon',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'S1897',
        iconImage: 'assets/previews/kenney-blaster/blaster-g.png',
        description: 'Súng Shotgun hành động bơm kinh điển, hỏa lực càn quét ở cự ly gần cực mạnh.',
        shortDesc: 'Uses 12 Gauge ammo',
        theme: 'silver',
        value: 800,
        stackMax: 1,
        size: [3, 1],
        weaponSlotId: 0
    },
    weapon_pistol_p92: {
        id: 'weapon_pistol_p92',
        name: 'P92',
        category: 'weapon',
        rarity: 'common',
        color: '#94a3b8',
        icon: 'P92',
        iconImage: 'assets/previews/kenney-blaster/blaster-m.png',
        description: 'Súng ngắn bán tự động P92 cơ động, độ giật thấp, tốc độ bắn nhanh.',
        shortDesc: 'Uses 9mm ammo',
        theme: 'silver',
        value: 400,
        stackMax: 1,
        size: [2, 1],
        weaponSlotId: 1
    },
    weapon_pan: {
        id: 'weapon_pan',
        name: 'Chảo Rán Dã Chiến',
        category: 'weapon',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'PAN',
        iconImage: 'assets/previews/kenney-food/cooking-knife.png',
        description: 'Chảo rán thép gia cường: Vũ khí cận chiến uy lực, có khả năng đỡ đạn sau lưng.',
        shortDesc: 'Vũ khí cận chiến uy lực cao',
        theme: 'silver',
        value: 500,
        stackMax: 1,
        size: [2, 1],
        weaponSlotId: 2
    },
    weapon_assault: {
        id: 'weapon_assault',
        name: 'Súng Trường AK-CYBER',
        category: 'weapon',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'AK',
        iconImage: 'assets/previews/kenney-blaster/blaster-d.png',
        description: 'Vũ khí tự động quân dụng 7.62mm, uy lực cao, độ giật đầm, tàn phá mục tiêu bọc giáp.',
        shortDesc: 'Uses 7.62mm ammo',
        theme: 'silver',
        value: 1200,
        stackMax: 1,
        size: [3, 1],
        weaponSlotId: 1
    },
    weapon_sniper: {
        id: 'weapon_sniper',
        name: 'Súng Bắn Tỉa Hạng Nặng DSR-50',
        category: 'weapon',
        rarity: 'legendary',
        color: '#ffaa00',
        icon: 'SR',
        iconImage: 'assets/previews/kenney-blaster/blaster-j.png',
        description: 'Súng bắn tỉa hạng nặng công phá cao, đạn xuyên thấu mọi lớp vỏ bảo hộ của zombie khổng lồ.',
        value: 2500,
        stackMax: 1,
        size: [3, 2],
        weaponSlotId: 2
    },
    weapon_shotgun: {
        id: 'weapon_shotgun',
        name: 'Shotgun Tác Chiến STRIKER-12',
        category: 'weapon',
        rarity: 'rare',
        color: '#00d0ff',
        icon: 'SG',
        iconImage: 'assets/previews/kenney-blaster/blaster-g.png',
        description: 'Shotgun tác chiến cự ly gần với chùm đạn đa tia diện rộng, đẩy lùi đàn zombie hung hãn.',
        value: 800,
        stackMax: 1,
        size: [3, 1],
        weaponSlotId: 0
    },
    weapon_titan: {
        id: 'weapon_titan',
        name: 'Đại Bác Phản Lực TITAN-N',
        category: 'weapon',
        rarity: 'legendary',
        color: '#ff3366',
        icon: 'TITAN',
        iconImage: 'assets/previews/kenney-blaster/blaster-n.png',
        description: 'Khẩu đại pháo 4 họng xả cực mạnh từ kho khí tài Airdrop, phát bắn nổ chấn động xóa sổ mọi mục tiêu.',
        value: 3500,
        stackMax: 1,
        size: [3, 2],
        weaponSlotId: 0
    },

    // 7. Lựu đạn & Đồ chiến thuật
    grenade_explosive: {
        id: 'grenade_explosive',
        name: 'Lựu Đạn Nổ Phá GRENADE-A',
        category: 'grenade',
        rarity: 'rare',
        color: '#ef4444',
        icon: 'NADE',
        iconImage: 'assets/previews/kenney-blaster/grenade-a.png',
        description: 'Lựu đạn nổ dã chiến: Chuột phải để ném kích nổ tức thì 260 sát thương trong bán kính 6.5m.',
        value: 600,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'explosive_grenade', damage: 260, radius: 6.5 }
    },
    grenade_smoke: {
        id: 'grenade_smoke',
        name: 'Lựu Đạn Khói Chiến Thuật SMOKE-B',
        category: 'grenade',
        rarity: 'rare',
        color: '#00f0ff',
        icon: 'SMK',
        iconImage: 'assets/previews/kenney-blaster/smoke.png',
        description: 'Tạo màn khói chiến thuật dày đặc trong 10 giây, làm chậm 60% tốc độ di chuyển của bầy zombie.',
        value: 500,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'smoke_grenade', duration: 10, slow: 0.6 }
    },

    // 8. Đồ quý giá & Tài liệu mật (Valuables)
    gold_bar: {
        id: 'gold_bar',
        name: 'Thỏi Vàng Quân Quỹ 9999 (1kg)',
        category: 'valuable',
        rarity: 'legendary',
        color: '#ffaa00',
        icon: 'AU',
        description: 'Tài sản thanh khoản cực cao từ kho dự trữ ngầm. Quy đổi trực tiếp 3000 Điểm sinh tồn.',
        value: 3000,
        stackMax: 5,
        size: [1, 1],
        effect: { type: 'score', points: 3000 }
    },
    military_flashdrive: {
        id: 'military_flashdrive',
        name: 'Ổ Cứng Mã Hóa Dữ Liệu Quân Sự',
        category: 'valuable',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'USB',
        description: 'Chứa sơ đồ trạm nghiên cứu sinh học ngầm. Quy đổi 1800 Điểm sinh tồn.',
        value: 1800,
        stackMax: 3,
        size: [1, 1],
        effect: { type: 'score', points: 1800 }
    },
    classified_intel: {
        id: 'classified_intel',
        name: 'Tài Liệu Tuyệt Mật Mutant Project',
        category: 'valuable',
        rarity: 'epic',
        color: '#b026ff',
        icon: 'DOC',
        description: 'Hồ sơ nghiên cứu gen đột biến Mutant Overlord. Quy đổi 2200 Điểm sinh tồn.',
        value: 2200,
        stackMax: 2,
        size: [1, 1],
        effect: { type: 'score', points: 2200 }
    }
};

// Cấu hình các loại hòm đồ tương tác trong sàn đấu (Loot Tables mở rộng)
export const CONTAINER_CONFIGS = {
    wooden_crate: {
        id: 'wooden_crate',
        name: 'Thùng Gỗ Quân Trang',
        searchDuration: 1.2,
        interactionRadius: 3.6,
        capacity: 10,
        meshColor: 0x8b5a2b,
        accentColor: 0x4a3525,
        promptLabel: 'VÙNG MỞ THÙNG GỖ (ĐỨNG TRONG VÒNG ĐỂ MỞ)',
        lootTable: [
            { itemId: 'energy_drink', chance: 0.90, min: 2, max: 5 },
            { itemId: 'stun_grenade', chance: 0.85, min: 1, max: 2 },
            { itemId: 'medkit_military', chance: 0.80, min: 1, max: 2 },
            { itemId: 'attach_quickdraw_mag', chance: 0.75, min: 1, max: 1 },
            { itemId: 'ammo_12gauge', chance: 0.85, min: 5, max: 10 },
            { itemId: 'ammo_556', chance: 0.80, min: 30, max: 60 },
            { itemId: 'weapon_shotgun_s1897', chance: 0.50, min: 1, max: 1 },
            { itemId: 'weapon_pistol_p92', chance: 0.60, min: 1, max: 1 },
            { itemId: 'attach_red_dot', chance: 0.70, min: 1, max: 1 },
            { itemId: 'attach_scope_x6', chance: 0.40, min: 1, max: 1 },
            { itemId: 'attach_scope_x8', chance: 0.35, min: 1, max: 1 },
            { itemId: 'attach_silencer', chance: 0.50, min: 1, max: 1 },
            { itemId: 'attach_grip_tactical', chance: 0.50, min: 1, max: 1 },
            { itemId: 'attach_stock_heavy', chance: 0.45, min: 1, max: 1 },
            { itemId: 'painkiller_bottle', chance: 0.75, min: 1, max: 3 }
        ]
    },
    military_safe: {
        id: 'military_safe',
        name: 'Két Sắt Quân Sự Chống Đạn',
        searchDuration: 2.0,
        interactionRadius: 3.6,
        capacity: 10,
        meshColor: 0x334155,
        accentColor: 0x0284c7,
        promptLabel: 'VÙNG MỞ KÉT SẮT (ĐỨNG TRONG VÒNG ĐỂ MỞ)',
        lootTable: [
            { itemId: 'ammo_ap', chance: 0.85, min: 1, max: 2 },
            { itemId: 'attach_silencer', chance: 0.60, min: 1, max: 1 },
            { itemId: 'attach_scope_x2', chance: 0.55, min: 1, max: 1 },
            { itemId: 'attach_scope_x4', chance: 0.35, min: 1, max: 1 },
            { itemId: 'attach_quickdraw_mag', chance: 0.50, min: 1, max: 1 },
            { itemId: 'attach_stock_heavy', chance: 0.45, min: 1, max: 1 },
            { itemId: 'gun_parts', chance: 0.75, min: 1, max: 2 },
            { itemId: 'weapon_parts_core', chance: 0.50, min: 1, max: 1 },
            { itemId: 'armor_vest_lvl6', chance: 0.35, min: 1, max: 1 },
            { itemId: 'gold_bar', chance: 0.50, min: 1, max: 2 },
            { itemId: 'military_flashdrive', chance: 0.60, min: 1, max: 1 },
            { itemId: 'weapon_assault', chance: 0.45, min: 1, max: 1 },
            { itemId: 'weapon_titan', chance: 0.25, min: 1, max: 1 }
        ]
    },
    dead_body: {
        id: 'dead_body',
        name: 'Thi Thể Đặc Nhiệm Tử Trận',
        searchDuration: 1.4,
        interactionRadius: 3.6,
        capacity: 10,
        meshColor: 0x475569,
        accentColor: 0xef4444,
        promptLabel: 'VÙNG KHÁM XÁC (ĐỨNG TRONG VÒNG ĐỂ MỞ)',
        lootTable: [
            { itemId: 'ammo_standard', chance: 0.75, min: 1, max: 2 },
            { itemId: 'ammo_hollow', chance: 0.45, min: 1, max: 1 },
            { itemId: 'bandage_field', chance: 0.60, min: 1, max: 2 },
            { itemId: 'medkit_military', chance: 0.50, min: 1, max: 1 },
            { itemId: 'stimpack_adrenaline', chance: 0.40, min: 1, max: 1 },
            { itemId: 'painkiller_morphine', chance: 0.50, min: 1, max: 1 },
            { itemId: 'scrap_metal', chance: 0.60, min: 1, max: 3 },
            { itemId: 'attach_red_dot', chance: 0.35, min: 1, max: 1 },
            { itemId: 'attach_compensator', chance: 0.35, min: 1, max: 1 },
            { itemId: 'attach_grip_tactical', chance: 0.35, min: 1, max: 1 },
            { itemId: 'armor_vest_lvl4', chance: 0.30, min: 1, max: 1 },
            { itemId: 'helmet_tactical', chance: 0.35, min: 1, max: 1 }
        ]
    },
    airdrop_crate: {
        id: 'airdrop_crate',
        name: 'Hòm Thính Tiếp Tế Chiến Thuật',
        searchDuration: 2.5,
        interactionRadius: 4.0,
        capacity: 14,
        meshColor: 0xd97706,
        accentColor: 0x06b6d4,
        promptLabel: 'VÙNG HÒM THÍNH (ĐỨNG TRONG VÒNG ĐỂ MỞ)',
        lootTable: [
            { itemId: 'weapon_titan', chance: 0.65, min: 1, max: 1 },
            { itemId: 'weapon_sniper', chance: 0.70, min: 1, max: 1 },
            { itemId: 'weapon_assault', chance: 0.80, min: 1, max: 1 },
            { itemId: 'attach_scope_x4', chance: 0.80, min: 1, max: 1 },
            { itemId: 'attach_silencer', chance: 0.85, min: 1, max: 1 },
            { itemId: 'attach_quickdraw_mag', chance: 0.80, min: 1, max: 1 },
            { itemId: 'attach_stock_heavy', chance: 0.80, min: 1, max: 1 },
            { itemId: 'armor_vest_lvl6', chance: 0.85, min: 1, max: 1 },
            { itemId: 'ammo_ap', chance: 0.95, min: 2, max: 3 },
            { itemId: 'stimpack_adrenaline', chance: 0.90, min: 2, max: 2 },
            { itemId: 'medkit_military', chance: 0.95, min: 2, max: 3 },
            { itemId: 'gold_bar', chance: 0.75, min: 2, max: 3 },
            { itemId: 'weapon_parts_core', chance: 0.85, min: 1, max: 2 }
        ]
    }
};

// Quản lý Túi đồ của Người chơi (Smart Grid Backpack: 5 Cột x 6 Hàng = 30 Ô)
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

    // Sinh vật phẩm ngẫu nhiên theo bảng Loot Table
    generateLoot() {
        const table = this.config.lootTable || [];
        let slotIdx = 0;

        for (const entry of table) {
            if (slotIdx >= this.capacity) break;
            if (Math.random() <= entry.chance) {
                const count = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
                this.slots[slotIdx] = {
                    itemId: entry.itemId,
                    count: count,
                    revealed: false // Mới mở hòm lần đầu sẽ chưa nhận diện
                };
                slotIdx++;
            }
        }

        // Đảm bảo hòm luôn có tối thiểu 1 vật phẩm hữu ích
        if (slotIdx === 0 && table.length > 0) {
            const first = table[0];
            this.slots[0] = { itemId: first.itemId, count: 1, revealed: false };
        }
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
            // Phím [B] để bật / tắt Giao diện Balo Túi Đồ [Backpack Grid & Weapon Modding]
            if (e.code === 'KeyB') {
                if (window.game?.state === 'PLAYING') {
                    this.toggleBackpack();
                }
            }
            // Phím [F] để bắt đầu lục hòm hoặc đóng hòm nếu đang mở
            if (e.code === 'KeyF') {
                if (this.isSearching) {
                    this.cancelSearch();
                } else if (this.isBackpackOpen) {
                    this.closeContainerUI();
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

    // Hoàn tất mở hòm: Mở giao diện Looting to Backpack Loop
    completeSearch() {
        this.isSearching = false;
        this.player.isSearching = false;
        this.ui?.hideSearchProgress();

        if (!this.activeContainer) return;
        const container = this.activeContainer;
        container.isOpen = true;
        sounds.playClearJam(); // Tiếng khóa mở hòm cơ khí

        // Mở giao diện Hòm đồ kết hợp Balo (Looting to Backpack Loop)
        this.openContainerUI(container);
    }

    // Mở giao diện Hòm đồ
    openContainerUI(container) {
        if (!container) return;
        this.activeContainer = container;
        container.isOpen = true;
        this.isBackpackOpen = true;
        this.ui?.openSmartInventory(this.inventory, container, this);
        if (this.player) {
            this.player.isBackpackOpen = true;
            this.player.domElement.style.cursor = 'default';
        }
    }

    // Đóng giao diện hòm đồ / balo
    closeContainerUI() {
        if (this.activeContainer) {
            this.activeContainer.isOpen = false;
            // Nếu hòm đã bị vét sạch đồ thì gỡ bỏ khỏi sàn đấu để giữ map gọn gàng
            if (this.activeContainer.checkEmpty()) {
                const idx = this.containers.indexOf(this.activeContainer);
                if (idx !== -1) {
                    this.activeContainer.dispose();
                    this.containers.splice(idx, 1);
                }
            }
            this.activeContainer = null;
        }
        this.isBackpackOpen = false;
        this.revealingSlotIndex = -1;
        this.revealTimer = 0;
        this.ui?.closeSmartInventory();
        if (this.player && window.game?.state === 'PLAYING') {
            this.player.isBackpackOpen = false;
            this.player.domElement.style.cursor = 'none';
        }
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
