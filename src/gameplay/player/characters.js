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
            id: 'tactical_rapid',
            name: 'Chiến Thuật Áp Đảo',
            key: 'Q',
            cooldown: 18,
            duration: 6,
            description: 'Tăng 30% tốc độ thay đạn và 15% tốc độ bắn trong 6 giây',
            effectType: 'rapid_fire'
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
            id: 'sprint_boost',
            name: 'Nước Rút Siêu Tốc',
            key: 'Q',
            cooldown: 15,
            duration: 4,
            description: 'Tăng 45% tốc độ di chuyển trong 4 giây để áp sát hoặc thoát vây',
            effectType: 'speed_boost'
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
            id: 'toxic_spray',
            name: 'Sương Kháng Khuẩn',
            key: 'Q',
            cooldown: 20,
            duration: 5,
            description: 'Phun màn sương độc hóa chất thiêu đốt quái vật bước vào trong 5 giây',
            effectType: 'toxic_cloud'
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
            id: 'radar_scan',
            name: 'Quét Radar Mục Tiêu',
            key: 'Q',
            cooldown: 18,
            duration: 6,
            description: 'Lộ diện vị trí toàn bộ quái vật xuyên tường trong 6 giây',
            effectType: 'scanner'
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
            id: 'repair_armor',
            name: 'Hàn Giáp Cấp Tốc',
            key: 'Q',
            cooldown: 20,
            duration: 0,
            description: 'Lập tức phục hồi 40 điểm Giáp phòng hộ',
            effectType: 'heal_armor'
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
            id: 'supply_drop',
            name: 'Tiếp Tế Hỏa Lực',
            key: 'Q',
            cooldown: 28,
            duration: 0,
            description: 'Gọi tiếp viện nạp đầy 100% đạn dự trữ cho toàn bộ vũ khí',
            effectType: 'supply_drop'
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
            id: 'savage_roar',
            name: 'Tiếng Gầm Chấn Động',
            key: 'Q',
            cooldown: 20,
            duration: 1,
            description: 'Gầm vang chấn động, đẩy lùi toàn bộ quái vật bán kính 7.5m',
            effectType: 'shockwave_push'
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
            id: 'stun_pulse',
            name: 'Xung Điện Gây Choáng',
            key: 'Q',
            cooldown: 18,
            duration: 3,
            description: 'Phát xung làm tê liệt và bất động quái vật xung quanh trong 3 giây',
            effectType: 'stun_grenade'
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
            id: 'instant_reload',
            name: 'Nạp Đạn Khẩn Cấp',
            key: 'Q',
            cooldown: 16,
            duration: 0,
            description: 'Lập tức nạp đầy băng đạn cho vũ khí đang cầm trên tay',
            effectType: 'instant_reload'
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
            id: 'sand_curse',
            name: 'Bão Cát Sa Mạc',
            key: 'Q',
            cooldown: 22,
            duration: 5,
            description: 'Tạo bão cát làm chậm 60% tốc độ di chuyển của quái vật xung quanh',
            effectType: 'sandstorm'
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
            id: 'emp_discharge',
            name: 'Xung Điện EMP',
            key: 'Q',
            cooldown: 22,
            duration: 1,
            description: 'Phóng sóng xung kích 8.5m gây 120 sát thương và làm tê liệt quái vật',
            effectType: 'emp_blast'
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
            id: 'shadow_decoy',
            name: 'Ảo Ảnh Phân Thân',
            key: 'Q',
            cooldown: 20,
            duration: 3.5,
            description: 'Tàng hình trong 3.5 giây và để lại hình nộm thu hút mọi đòn tấn công của quái',
            effectType: 'shadow_decoy'
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
