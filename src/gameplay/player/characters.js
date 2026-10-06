// Cấu hình toàn bộ hệ thống nhân vật, kỹ năng nội tại, kỹ năng chủ động và giá mua bằng Vàng
export const CHARACTER_CONFIGS = {
    police: {
        id: 'police',
        label: 'CẢNH SÁT TRƯỞNG',
        subtitle: 'CHỈ HUY TÁC CHIẾN',
        modelFile: 'character-male-d.glb',
        color: '#0284c7',
        preview: 'assets/previews/character-male-d.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 0,
        description: 'Cảnh sát trưởng dày dạn kinh nghiệm, trấn an đồng đội và kiểm soát vũ khí tuyệt vời.',
        passives: {
            recoilMult: 0.85,
            healthBonus: 0,
            armorBonus: 0,
            speedMult: 1.0,
            passiveDesc: 'Giảm 15% độ giật của mọi loại súng'
        },
        activeSkill: {
            id: 'riot_charge',
            name: 'Húc Khiên Bạo Động',
            key: 'Q',
            cooldown: 18,
            duration: 4,
            description: 'Bật khiên năng lượng bất tử 4 giây, tăng 40% tốc chạy và húc văng quái cản đường gây 70 sát thương',
            effectType: 'riot_charge'
        }
    },
    commando: {
        id: 'commando',
        label: 'NỮ ĐẶC NHIỆM',
        subtitle: 'TIÊN PHONG CƠ ĐỘNG',
        modelFile: 'character-female-a.glb',
        color: '#38bdf8',
        preview: 'assets/previews/character-female-a.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1000,
        description: 'Nữ chiến binh đột kích với phản xạ nhanh nhạy và bước lướt né thần tốc.',
        passives: {
            speedMult: 1.08,
            dodgeDistMult: 1.20,
            passiveDesc: 'Tăng 8% tốc độ di chuyển và 20% khoảng cách lướt né'
        },
        activeSkill: {
            id: 'cluster_grenades',
            name: 'Cụm Lựu Đạn Ném',
            key: 'Q',
            cooldown: 11,
            duration: 0,
            description: 'Ném 4 quả lựu đạn nổ liên hoàn hình quạt phía trước, hất tung bầy quái diện rộng',
            effectType: 'cluster_grenades'
        }
    },
    medic: {
        id: 'medic',
        label: 'BÁC SĨ TÁC CHIẾN',
        subtitle: 'THIÊN THẦN CỨU THƯƠNG',
        modelFile: 'character-male-a.glb',
        color: '#10b981',
        preview: 'assets/previews/character-male-a.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1200,
        description: 'Chuyên gia y tế chiến trường với khả năng hồi phục và cấp cứu đồng đội thần tốc.',
        passives: {
            reviveSpeedMult: 1.40,
            medkitHealMult: 1.35,
            passiveDesc: 'Cứu đồng đội nhanh hơn 40% và Medkit hồi thêm 35% Máu/Giáp'
        },
        activeSkill: {
            id: 'healing_beacon',
            name: 'Trạm Cứu Thương Dã Chiến',
            key: 'Q',
            cooldown: 22,
            duration: 6,
            description: 'Triệu hồi trạm cứu thương tại chỗ trong 6 giây, liên tục hồi 15 Máu/giây cho bản thân và đồng đội gần đó',
            effectType: 'healing_beacon'
        }
    },
    analyst: {
        id: 'analyst',
        label: 'CHUYÊN VIÊN PHÂN TÍCH',
        subtitle: 'ĐỊNH VỊ TÌNH BÁO',
        modelFile: 'character-male-b.glb',
        color: '#84cc16',
        preview: 'assets/previews/character-male-b.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1500,
        description: 'Nhà phân tích chiến thuật với khả năng dò tìm quái vật và tối ưu tài nguyên thu thập.',
        passives: {
            goldBonus: 0.30,
            passiveDesc: 'Nhận thêm 30% lượng Vàng khi tiêu diệt quái vật'
        },
        activeSkill: {
            id: 'vulnerability_scan',
            name: 'Radar Suy Yếu Mục Tiêu',
            key: 'Q',
            cooldown: 14,
            duration: 8,
            description: 'Quét lộ diện toàn bộ quái vật xuyên tường trong 8 giây và khiến chúng phải nhận thêm 50% sát thương',
            effectType: 'vulnerability_scan'
        }
    },
    engineer: {
        id: 'engineer',
        label: 'KỸ SƯ CƠ KHÍ',
        subtitle: 'BẬC THẦY GIA CỐ',
        modelFile: 'character-male-c.glb',
        color: '#fb923c',
        preview: 'assets/previews/character-male-c.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 2800,
        description: 'Chuyên gia kỹ thuật chế tạo giáp bảo hộ kiên cố chống chịu va đập cực tốt.',
        passives: {
            armorBonus: 35,
            damageTakenMult: 0.90,
            passiveDesc: 'Khởi đầu với +35 Giáp tối đa và giảm 10% sát thương nhận vào'
        },
        activeSkill: {
            id: 'auto_turret',
            name: 'Tháp Súng Tự Động',
            key: 'Q',
            cooldown: 16,
            duration: 10,
            description: 'Triệu hồi một tháp súng máy mini tự động xoay và xả đạn liên tục vào các zombie xung quanh trong 10 giây',
            effectType: 'auto_turret'
        }
    },
    agent: {
        id: 'agent',
        label: 'ĐIỆP VIÊN ÁO ĐEN',
        subtitle: 'TIẾP TẾ HỎA LỰC',
        modelFile: 'character-male-e.glb',
        color: '#475569',
        preview: 'assets/previews/character-male-e.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3200,
        description: 'Đặc vụ ngầm với khả năng ngắm bắn chuẩn xác và kết nối tiếp viện đạn đạo từ vệ tinh.',
        passives: {
            adsSpeedMult: 1.40,
            recoilMult: 0.90,
            passiveDesc: 'Bật ngắm ADS nhanh hơn 40% và giảm 10% độ giật súng'
        },
        activeSkill: {
            id: 'orbital_strike',
            name: 'Không Kích Vệ Tinh',
            key: 'Q',
            cooldown: 18,
            duration: 0.8,
            description: 'Đánh dấu tọa độ trước mặt, sau 0.8 giây gọi pháo kích năng lượng quỹ đạo gây 350 sát thương thiêu rụi bầy quái',
            effectType: 'orbital_strike'
        }
    },
    miner: {
        id: 'miner',
        label: 'ĐẤU SĨ DŨNG MÃNH',
        subtitle: 'SỨC MẠNH VÔ SONG',
        modelFile: 'character-male-f.glb',
        color: '#ea580c',
        preview: 'assets/previews/character-male-f.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3500,
        description: 'Thể hình vạm vỡ, lượng máu khổng lồ cùng tiếng gầm chấn động đẩy lui bầy quái vật.',
        passives: {
            healthBonus: 60,
            knockbackResist: 0.40,
            passiveDesc: 'Tăng 60 Máu tối đa và kháng 40% lực đẩy lùi'
        },
        activeSkill: {
            id: 'ground_smash',
            name: 'Địa Chấn Chấn Động',
            key: 'Q',
            cooldown: 12,
            duration: 3,
            description: 'Dộng mạnh vũ khí xuống đất tạo sóng chấn động hất tung bầy quái, gây 130 sát thương và làm choáng 3 giây',
            effectType: 'ground_smash'
        }
    },
    schoolgirl: {
        id: 'schoolgirl',
        label: 'TIỂU THƯ NỔI LOẠN',
        subtitle: 'CHUYÊN GIA GÂY CHOÁNG',
        modelFile: 'character-female-b.glb',
        color: '#eab308',
        preview: 'assets/previews/character-female-b.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 2600,
        description: 'Nhanh nhẹn và tinh nghịch, sử dụng lựu đạn gây choáng để vô hiệu hóa đàn quái hung tợn.',
        passives: {
            speedMult: 1.06,
            dodgeCdMult: 0.80,
            passiveDesc: 'Tăng 6% tốc độ chạy và hồi chiêu lướt né nhanh hơn 20%'
        },
        activeSkill: {
            id: 'bullet_frenzy',
            name: 'Cuồng Xả Đạn Vô Hạn',
            key: 'Q',
            cooldown: 22,
            duration: 5,
            description: 'Bắn không tốn đạn, tăng 80% tốc độ xả đạn và giảm 80% độ giật súng trong 5 giây',
            effectType: 'bullet_frenzy'
        }
    },
    secretary: {
        id: 'secretary',
        label: 'QUẢN LÝ CHIẾN TRƯỜNG',
        subtitle: 'HẬU CẦN THẦN TỐC',
        modelFile: 'character-female-c.glb',
        color: '#64748b',
        preview: 'assets/previews/character-female-c.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3000,
        description: 'Điều phối vật tư xuất sắc, luôn giữ cho băng đạn sẵn sàng khai hỏa.',
        passives: {
            ammoPickupMult: 1.30,
            reloadSpeedMult: 1.20,
            passiveDesc: 'Nhặt thêm 30% đạn từ hòm tiếp tế và nạp đạn nhanh hơn 20%'
        },
        activeSkill: {
            id: 'supply_drop',
            name: 'Hòm Tiếp Tế Chiến Thuật',
            key: 'Q',
            cooldown: 18,
            duration: 0,
            description: 'Thả ngay tại chỗ hòm quân nhu: nạp đầy 100% đạn dự trữ cho toàn bộ súng, cấp 1 túi Medkit cấp cứu và hồi phục 30 Máu ngay lập tức',
            effectType: 'supply_drop'
        }
    },
    athlete: {
        id: 'athlete',
        label: 'VẬN ĐỘNG VIÊN CƠ ĐỘNG',
        subtitle: 'BỨC PHÁ BÃO CÁT',
        modelFile: 'character-female-d.glb',
        color: '#ef4444',
        preview: 'assets/previews/character-female-d.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3200,
        description: 'Sức bền vượt trội cùng khả năng tạo bão cát làm chậm bước tiến kẻ thù.',
        passives: {
            speedMult: 1.10,
            healthBonus: 20,
            passiveDesc: 'Tăng 10% tốc độ chạy và +20 Máu cơ bản'
        },
        activeSkill: {
            id: 'sand_vortex',
            name: 'Lốc Xoáy Hút Quái',
            key: 'Q',
            cooldown: 15,
            duration: 7,
            description: 'Tạo cơn lốc xoáy bão cát hút toàn bộ zombie xung quanh vào tâm bão, làm chậm 70% và gây sát thương kéo dài',
            effectType: 'sand_vortex'
        }
    },
    cyber_girl: {
        id: 'cyber_girl',
        label: 'CHIẾN BINH CYBER',
        subtitle: 'XUNG LỰC EMP',
        modelFile: 'character-female-e.glb',
        color: '#a855f7',
        preview: 'assets/previews/character-female-e.png',
        tier: 3,
        tierName: 'SỬ THI',
        price: 5500,
        description: 'Trang bị chip cấy ghép công nghệ cao, phóng xung điện từ hủy diệt diện rộng.',
        passives: {
            armorBonus: 40,
            shieldRegenRate: 1.50,
            passiveDesc: 'Tăng 40 Giáp tối đa và tốc độ phục hồi Giáp nhanh hơn 50%'
        },
        activeSkill: {
            id: 'chain_lightning',
            name: 'Tia Sét Lan Truyền EMP',
            key: 'Q',
            cooldown: 14,
            duration: 2,
            description: 'Phóng luồng điện cao thế giật nhảy liên hoàn qua tối đa 12 con zombie gần nhau, gây tê liệt và 150 sát thương',
            effectType: 'chain_lightning'
        }
    },
    assassin: {
        id: 'assassin',
        label: 'SÁT THỦ BÓNG ĐÊM',
        subtitle: 'ẢO ẢNH VÔ HÌNH',
        modelFile: 'character-female-f.glb',
        color: '#8b5cf6',
        preview: 'assets/previews/character-female-f.png',
        tier: 3,
        tierName: 'SỬ THI',
        price: 6500,
        description: 'Bậc thầy ẩn mình trong màn đêm với thuật phân thân đánh lừa mọi kẻ săn mồi.',
        passives: {
            damageMult: 1.12,
            dodgeDistMult: 1.35,
            passiveDesc: 'Tăng 12% tổng sát thương vũ khí và 35% khoảng cách lướt né'
        },
        activeSkill: {
            id: 'shadow_veil',
            name: 'Bóng Ma Ám Sát',
            key: 'Q',
            cooldown: 14,
            duration: 6,
            description: 'Tàng hình hoàn toàn trong 6 giây (quái mất dấu), tăng 50% tốc độ chạy và đòn đánh đầu tiên phá tàng hình chí mạng x4',
            effectType: 'shadow_veil'
        }
    }
};

// Trả về ID hợp lệ nếu nhân vật tồn tại, tự động chuyển đổi từ nhân vật cũ soldier sang police
export function normalizeCharacter(id) {
    if (id === 'soldier') return 'police';
    return CHARACTER_CONFIGS[id] ? id : 'police';
}

// Lấy cấu hình chi tiết của nhân vật
export function getCharacterConfig(id) {
    const validId = normalizeCharacter(id);
    return CHARACTER_CONFIGS[validId];
}

// Danh sách nhân vật mặc định được mở khóa ban đầu
export const DEFAULT_UNLOCKED_CHARACTERS = ['police'];

// Đọc danh sách nhân vật đã sở hữu từ bộ nhớ LocalStorage
export function getUnlockedCharacters() {
    try {
        const stored = localStorage.getItem('cyber_arena_unlocked_characters');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                if (!parsed.includes('police')) parsed.unshift('police');
                return parsed;
            }
        }
    } catch {
        // Bỏ qua lỗi lưu trữ
    }
    return [...DEFAULT_UNLOCKED_CHARACTERS];
}

// Kiểm tra nhân vật đã được mua chưa
export function isCharacterUnlocked(id) {
    if (id === 'police' || id === 'soldier') return true;
    const unlocked = getUnlockedCharacters();
    return unlocked.includes(id);
}

// Mua và mở khóa nhân vật mới vào LocalStorage
export function unlockCharacter(id) {
    const list = getUnlockedCharacters();
    if (!list.includes(id)) {
        list.push(id);
        try {
            localStorage.setItem('cyber_arena_unlocked_characters', JSON.stringify(list));
        } catch {
            // Bỏ qua lỗi lưu trữ
        }
    }
    return list;
}
