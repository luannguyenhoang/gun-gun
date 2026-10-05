// Cấu hình toàn bộ hệ thống nhân vật, kỹ năng nội tại, kỹ năng chủ động và giá mua bằng Vàng
export const CHARACTER_CONFIGS = {
    soldier: {
        id: 'soldier',
        label: 'LÍNH CHIẾN',
        subtitle: 'CHIẾN BINH TIỀN TUYẾN',
        modelFile: 'character-soldier.glb',
        color: '#22e6a5',
        preview: 'assets/previews/character-a.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 0,
        description: 'Chiến binh can trường với khả năng kiểm soát độ giật súng tuyệt vời và tốc độ thao tác chiến thuật cao.',
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
    char_a: {
        id: 'char_a',
        label: 'ĐẶC NHIỆM ALPHA',
        subtitle: 'TIÊN PHONG CƠ ĐỘNG',
        modelFile: 'character-a.glb',
        color: '#38bdf8',
        preview: 'assets/previews/character-a.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1000,
        description: 'Chuyên gia đột kích với tốc độ di chuyển vượt trội và bước lướt né thần tốc trên mọi địa hình.',
        passives: {
            speedMult: 1.08,
            dodgeDistMult: 1.15,
            passiveDesc: 'Tăng 8% tốc độ di chuyển cơ bản và 15% khoảng cách lướt né'
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
    char_b: {
        id: 'char_b',
        label: 'ĐẶC VỤ BRAVO',
        subtitle: 'CHUYÊN GIA HẬU CẦN',
        modelFile: 'character-b.glb',
        color: '#4ade80',
        preview: 'assets/previews/character-b.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1200,
        description: 'Binh nhì chuyên quản lý kho đạn dược và tối ưu hóa tài nguyên trên chiến trường.',
        passives: {
            ammoPickupMult: 1.25,
            reloadSpeedMult: 1.15,
            passiveDesc: 'Nhặt thêm 25% lượng đạn từ hòm tiếp tế và nạp đạn nhanh hơn 15%'
        },
        activeSkill: {
            id: 'instant_reload',
            name: 'Tiếp Tế Khẩn Cấp',
            key: 'Q',
            cooldown: 18,
            duration: 0,
            description: 'Lập tức nạp đầy băng đạn cho vũ khí đang cầm trên tay',
            effectType: 'instant_reload'
        }
    },
    char_c: {
        id: 'char_c',
        label: 'KỸ SƯ CƠ KHÍ',
        subtitle: 'BẬC THẦY PHÒNG THỦ',
        modelFile: 'character-c.glb',
        color: '#fb923c',
        preview: 'assets/previews/character-c.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1500,
        description: 'Nhà nghiên cứu gia cố giáp hộ thân tiên tiến, tăng sức chống chịu trước mọi hiểm nguy.',
        passives: {
            armorBonus: 25,
            damageTakenMult: 0.95,
            passiveDesc: 'Khởi đầu với +25 Giáp tối đa và giảm 5% sát thương nhận vào'
        },
        activeSkill: {
            id: 'repair_armor',
            name: 'Hàn Giáp Cấp Tốc',
            key: 'Q',
            cooldown: 20,
            duration: 0,
            description: 'Lập tức phục hồi 35 điểm Giáp phòng hộ'
            ,effectType: 'heal_armor'
        }
    },
    char_d: {
        id: 'char_d',
        label: 'CHIẾN BINH ORC',
        subtitle: 'ĐẤU SĨ DŨNG MÃNH',
        modelFile: 'character-d.glb',
        color: '#22c55e',
        preview: 'assets/previews/character-d.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 2800,
        description: 'Thể lực phi thường với lượng máu dồi dào và tiếng gầm chấn động đẩy lùi kẻ thù.',
        passives: {
            healthBonus: 50,
            knockbackResist: 0.35,
            passiveDesc: 'Tăng 50 Máu tối đa và kháng 35% lực đẩy lùi'
        },
        activeSkill: {
            id: 'savage_roar',
            name: 'Tiếng Gầm Man Rợ',
            key: 'Q',
            cooldown: 20,
            duration: 1,
            description: 'Gầm thét dũng mãnh, đánh bật lùi toàn bộ quái vật trong bán kính 7m',
            effectType: 'shockwave_push'
        }
    },
    char_e: {
        id: 'char_e',
        label: 'THỢ SĂN KHO BÁU',
        subtitle: 'CHUYÊN GIA CHÁY NỔ',
        modelFile: 'character-e.glb',
        color: '#e11d48',
        preview: 'assets/previews/character-e.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3000,
        description: 'Kẻ thích phiêu lưu mạo hiểm, thuần thục các loại thuốc nổ để quét sạch đàn quái vật.',
        passives: {
            explosiveBonus: 0.25,
            passiveDesc: 'Tăng 25% bán kính và sát thương của mọi loại bom mìn'
        },
        activeSkill: {
            id: 'cluster_mines',
            name: 'Mưa Pháo Kích',
            key: 'Q',
            cooldown: 22,
            duration: 0,
            description: 'Thả tức thì cụm mìn nổ mini xung quanh gây sát thương diện rộng',
            effectType: 'cluster_grenades'
        }
    },
    char_f: {
        id: 'char_f',
        label: 'VỆ BINH HOÀNG GIA',
        subtitle: 'BỨC TƯỜNG THÉP',
        modelFile: 'character-f.glb',
        color: '#f59e0b',
        preview: 'assets/previews/character-f.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1500,
        description: 'Được tôi luyện vững vàng để làm lá chắn kiên cố bảo vệ toàn đội ngũ.',
        passives: {
            armorBonus: 15,
            damageTakenMult: 0.90,
            passiveDesc: 'Tăng 15 Giáp tối đa và giảm 10% mọi sát thương nhận vào'
        },
        activeSkill: {
            id: 'iron_wall',
            name: 'Hàng Rào Kiên Cố',
            key: 'Q',
            cooldown: 22,
            duration: 3.5,
            description: 'Giảm 50% mọi sát thương nhận vào trong 3.5 giây',
            effectType: 'iron_wall'
        }
    },
    char_g: {
        id: 'char_g',
        label: 'THỢ SĂN TIỀN THƯỞNG',
        subtitle: 'ĐỊNH VỊ CON MỒI',
        modelFile: 'character-g.glb',
        color: '#84cc16',
        preview: 'assets/previews/character-g.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3200,
        description: 'Truy vết quái vật tinh tường và tối ưu hóa lượng chiến lợi phẩm thu thập.',
        passives: {
            goldBonus: 0.25,
            passiveDesc: 'Nhận thêm 25% lượng Vàng khi tiêu diệt quái vật'
        },
        activeSkill: {
            id: 'radar_scan',
            name: 'Định Vị Mục Tiêu',
            key: 'Q',
            cooldown: 18,
            duration: 6,
            description: 'Quét radar làm lộ diện toàn bộ quái vật xuyên tường trong 6 giây',
            effectType: 'scanner'
        }
    },
    char_h: {
        id: 'char_h',
        label: 'SĨ QUAN AN NINH',
        subtitle: 'HỖ TRỢ ĐỒNG ĐỘI',
        modelFile: 'character-h.glb',
        color: '#06b6d4',
        preview: 'assets/previews/character-h.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1400,
        description: 'Thành thạo kỹ năng cứu thương tác chiến và kiểm soát đám đông bằng lựu đạn gây choáng.',
        passives: {
            reviveSpeedMult: 1.35,
            passiveDesc: 'Tốc độ cứu sống đồng đội bị gục nhanh hơn 35%'
        },
        activeSkill: {
            id: 'stun_pulse',
            name: 'Xung Điện Gây Choáng',
            key: 'Q',
            cooldown: 20,
            duration: 3,
            description: 'Phát xung làm tê liệt và bất động quái vật xung quanh trong 3 giây',
            effectType: 'stun_grenade'
        }
    },
    char_i: {
        id: 'char_i',
        label: 'CHIẾN BINH CYBORG',
        subtitle: 'HỎA LỰC XUYÊN PHÁ',
        modelFile: 'character-i.glb',
        color: '#ec4899',
        preview: 'assets/previews/character-i.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3500,
        description: 'Thị lực quang học nâng cấp giúp phát hiện điểm yếu và bắn xuyên mục tiêu.',
        passives: {
            penetrationBonus: 1,
            critChance: 0.10,
            passiveDesc: 'Đạn bắn ra xuyên thêm 1 mục tiêu và +10% tỉ lệ chí mạng'
        },
        activeSkill: {
            id: 'laser_beam',
            name: 'Tia Laser Xuyên Thấu',
            key: 'Q',
            cooldown: 22,
            duration: 0,
            description: 'Bắn một tia năng lượng cực mạnh quét sạch mục tiêu theo đường thẳng',
            effectType: 'piercing_beam'
        }
    },
    char_j: {
        id: 'char_j',
        label: 'TRINH SÁT NGUY TRANG',
        subtitle: 'BÓNG MA CHIẾN TRƯỜNG',
        modelFile: 'character-j.glb',
        color: '#10b981',
        preview: 'assets/previews/character-j.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3000,
        description: 'Kỹ thuật ngụy trang đặc biệt khiến quái vật khó phát hiện và mất phương hướng.',
        passives: {
            detectionDelayMult: 1.35,
            passiveDesc: 'Quái vật phát hiện bạn chậm hơn 35% so với bình thường'
        },
        activeSkill: {
            id: 'undead_scent',
            name: 'Ngụy Trang Tàng Hình',
            key: 'Q',
            cooldown: 24,
            duration: 4,
            description: 'Ngụy trang tuyệt đối khiến quái vật mất mục tiêu trong 4 giây',
            effectType: 'smoke_camo'
        }
    },
    char_k: {
        id: 'char_k',
        label: 'CYBER MECHA',
        subtitle: 'CÔNG NGHỆ TƯƠNG LAI',
        modelFile: 'character-k.glb',
        color: '#a855f7',
        preview: 'assets/previews/character-k.png',
        tier: 3,
        tierName: 'SỬ THI',
        price: 6500,
        description: 'Người máy chiến đấu thế hệ mới tích hợp trường điện từ EMP hủy diệt.',
        passives: {
            armorBonus: 40,
            shieldRegenRate: 1.5,
            passiveDesc: 'Tăng 40 Giáp tối đa và tốc độ hồi phục Giáp nhanh hơn 50%'
        },
        activeSkill: {
            id: 'emp_discharge',
            name: 'Xung Điện EMP',
            key: 'Q',
            cooldown: 22,
            duration: 1,
            description: 'Phóng điện shock toàn bán kính 8.5m gây 120 sát thương và làm tê liệt quái vật',
            effectType: 'emp_blast'
        }
    },
    char_l: {
        id: 'char_l',
        label: 'NANO ANDROID',
        subtitle: 'LÁ CHẮN TỪ TRƯỜNG',
        modelFile: 'character-l.glb',
        color: '#6366f1',
        preview: 'assets/previews/character-l.png',
        tier: 3,
        tierName: 'SỬ THI',
        price: 7000,
        description: 'Cấu tạo từ các hạt vi phân Nanite có khả năng tạo màn bảo vệ tuyệt đối.',
        passives: {
            speedMult: 1.05,
            healthBonus: 25,
            passiveDesc: 'Tăng 5% tốc độ chạy và +25 Máu cơ bản'
        },
        activeSkill: {
            id: 'nanite_barrier',
            name: 'Khiên Từ Trường Nanite',
            key: 'Q',
            cooldown: 26,
            duration: 3,
            description: 'Kích hoạt màng bảo vệ vô hiệu hóa 100% sát thương trong 3 giây',
            effectType: 'nanite_shield'
        }
    },
    char_m: {
        id: 'char_m',
        label: 'XÁC ƯỚP CỔ ĐẠI',
        subtitle: 'LỜI NGUYỀN NGHÌN NĂM',
        modelFile: 'character-m.glb',
        color: '#d97706',
        preview: 'assets/previews/character-m.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3800,
        description: 'Sức sống bền bỉ vượt thời gian cùng khả năng triệu hồi bão cát trừng phạt kẻ địch.',
        passives: {
            regenRate: 2.0,
            passiveDesc: 'Tự phục hồi 2 Máu mỗi giây khi lượng Máu còn dưới 50%'
        },
        activeSkill: {
            id: 'sand_curse',
            name: 'Bão Cát Sa Mạc',
            key: 'Q',
            cooldown: 24,
            duration: 5,
            description: 'Triệu hồi bão cát làm chậm 60% tốc độ di chuyển của quái vật xung quanh',
            effectType: 'sandstorm'
        }
    },
    char_n: {
        id: 'char_n',
        label: 'NỮ KIẾM SĨ KIMONO',
        subtitle: 'ẢO ẢNH PHÂN THÂN',
        modelFile: 'character-n.glb',
        color: '#ec4899',
        preview: 'assets/previews/character-n.png',
        tier: 4,
        tierName: 'HUYỀN THOẠI',
        price: 7500,
        description: 'Nữ kiếm sĩ phương Đông tinh thông bộ pháp lướt né thần tốc và thuật phân thân đánh lạc hướng.',
        passives: {
            dodgeDistMult: 1.35,
            dodgeCdMult: 0.70,
            passiveDesc: 'Khoảng cách lướt né +35% và hồi phục chiêu lướt nhanh hơn 30%'
        },
        activeSkill: {
            id: 'shadow_decoy',
            name: 'Ảo Ảnh Phân Thân',
            key: 'Q',
            cooldown: 20,
            duration: 3.5,
            description: 'Tàng hình trong 3.5 giây và để lại hình nộm thu hút toàn bộ sự chú ý của quái vật',
            effectType: 'shadow_decoy'
        }
    },
    char_o: {
        id: 'char_o',
        label: 'CHIẾN BINH ĐỘT BIẾN',
        subtitle: 'SỨC MẠNH TIỀM TẨNG',
        modelFile: 'character-o.glb',
        color: '#10b981',
        preview: 'assets/previews/character-o.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3200,
        description: 'Cơ thể biến dị ban tặng sức chịu đựng dẻo dai và khả năng tung đòn chí mạng bất ngờ.',
        passives: {
            critChance: 0.15,
            healthBonus: 20,
            passiveDesc: 'Tăng 15% tỉ lệ chí mạng và +20 Máu cơ bản'
        },
        activeSkill: {
            id: 'dead_eye',
            name: 'Cuồng Nộ Đột Biến',
            key: 'Q',
            cooldown: 20,
            duration: 4,
            description: 'Trong 4 giây, toàn bộ phát bắn đều kích hoạt sát thương chí mạng 100%',
            effectType: 'guaranteed_crit'
        }
    },
    char_p: {
        id: 'char_p',
        label: 'THUYỀN TRƯỞNG HẢI TẶC',
        subtitle: 'BẬC THẦY HÓA CHẤT',
        modelFile: 'character-p.glb',
        color: '#8b5cf6',
        preview: 'assets/previews/character-p.png',
        tier: 3,
        tierName: 'SỬ THI',
        price: 6000,
        description: 'Thuyền trưởng kỳ cựu với kho hóa chất ăn mòn cực mạnh và khả năng dùng hộp cứu thương vượt trội.',
        passives: {
            medkitHealMult: 1.50,
            passiveDesc: 'Tăng 50% lượng Máu và Giáp được phục hồi khi sử dụng Medkit'
        },
        activeSkill: {
            id: 'toxic_spray',
            name: 'Màn Sương Độc Ăn Mòn',
            key: 'Q',
            cooldown: 22,
            duration: 5,
            description: 'Rải màn sương hóa chất ăn mòn thiêu đốt quái vật bước vào trong 5 giây',
            effectType: 'toxic_cloud'
        }
    },
    char_q: {
        id: 'char_q',
        label: 'ĐIỆP VIÊN ÁO ĐEN',
        subtitle: 'TIẾP TẾ HỎA LỰC',
        modelFile: 'character-q.glb',
        color: '#0284c7',
        preview: 'assets/previews/character-q.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3400,
        description: 'Đặc vụ ngầm với khả năng ngắm bắn chuẩn xác và liên lạc tiếp tế đạn đạo từ vệ tinh.',
        passives: {
            adsSpeedMult: 1.40,
            recoilMult: 0.90,
            passiveDesc: 'Tốc độ bật ngắm nhanh hơn 40% và giảm 10% độ giật súng'
        },
        activeSkill: {
            id: 'supply_drop',
            name: 'Tiếp Tế Hỏa Lực',
            key: 'Q',
            cooldown: 30,
            duration: 0,
            description: 'Gọi tiếp viện nạp đầy 100% đạn dự trữ cho mọi vũ khí đang mang',
            effectType: 'supply_drop'
        }
    },
    char_r: {
        id: 'char_r',
        label: 'NINJA BÓNG ĐÊM',
        subtitle: 'SIÊU CHIẾN BINH OMEGA',
        modelFile: 'character-r.glb',
        color: '#dc2626',
        preview: 'assets/previews/character-r.png',
        tier: 4,
        tierName: 'HUYỀN THOẠI',
        price: 8500,
        description: 'Sát thủ ninja siêu cấp với tốc độ di chuyển kinh hoàng và trạng thái Overdrive toàn diện.',
        passives: {
            damageMult: 1.10,
            speedMult: 1.08,
            passiveDesc: 'Tăng 10% tổng sát thương mọi vũ khí và 8% tốc độ di chuyển'
        },
        activeSkill: {
            id: 'overdrive',
            name: 'Trạng Thái Overdrive',
            key: 'Q',
            cooldown: 25,
            duration: 5,
            description: 'Tăng 35% tốc độ bắn, 25% tốc độ chạy và miễn nhiễm làm chậm trong 5 giây',
            effectType: 'overdrive'
        }
    },
    skeleton: {
        id: 'skeleton',
        label: 'KHUNG XƯƠNG',
        subtitle: 'BỘ XƯƠNG BẤT TỬ',
        modelFile: 'character-skeleton.glb',
        color: '#ffe06a',
        preview: 'assets/previews/character-h.png',
        tier: 1,
        tierName: 'CƠ BẢN',
        price: 1000,
        description: 'Thân hình chỉ còn xương nhẹ bẫng giúp di chuyển thoăn thoắt và ném khúc xương định mệnh.',
        passives: {
            dodgeDistMult: 1.25,
            speedMult: 1.06,
            passiveDesc: 'Thân pháp nhẹ nhàng: Khoảng cách lướt +25% và tốc độ chạy +6%'
        },
        activeSkill: {
            id: 'bone_throw',
            name: 'Khúc Xương Định Mệnh',
            key: 'Q',
            cooldown: 16,
            duration: 1,
            description: 'Ném khúc xương gây 90 sát thương và làm choáng mục tiêu trúng đòn',
            effectType: 'bone_toss'
        }
    },
    vampire: {
        id: 'vampire',
        label: 'MA CÀ RỒNG',
        subtitle: 'CHÚA TỂ BÓNG ĐÊM',
        modelFile: 'character-vampire.glb',
        color: '#ff5577',
        preview: 'assets/previews/character-e.png',
        tier: 2,
        tierName: 'HIẾM',
        price: 3500,
        description: 'Hút sinh lực từ kẻ thù trong bóng tối để duy trì sự bất tử giữa vòng vây quái vật.',
        passives: {
            lifesteal: 0.10,
            passiveDesc: 'Hút 10% lượng sát thương gây ra thành Máu cho bản thân'
        },
        activeSkill: {
            id: 'vampire_drain',
            name: 'Dơi Đêm Hút Máu',
            key: 'Q',
            cooldown: 20,
            duration: 0,
            description: 'Hút tức thì 35 Máu từ toàn bộ quái vật trong vùng lân cận',
            effectType: 'vampire_drain'
        }
    }
};

// Tra ve ID hop le neu nhan vat ton tai
export function normalizeCharacter(id) {
    return CHARACTER_CONFIGS[id] ? id : 'soldier';
}

// Lay cau hinh chi tiet cua nhan vat
export function getCharacterConfig(id) {
    const validId = normalizeCharacter(id);
    return CHARACTER_CONFIGS[validId];
}

// Danh sach nhan vat mac dinh duoc mo khoa
export const DEFAULT_UNLOCKED_CHARACTERS = ['soldier'];

// Doc danh sach nhan vat da so huu tu bo nho LocalStorage
export function getUnlockedCharacters() {
    try {
        const stored = localStorage.getItem('cyber_arena_unlocked_characters');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                if (!parsed.includes('soldier')) parsed.unshift('soldier');
                return parsed;
            }
        }
    } catch {
        // Neu loi thi tiep tuc fallback ve mac dinh
    }
    return [...DEFAULT_UNLOCKED_CHARACTERS];
}

// Kiem tra nhan vat da duoc mua chua
export function isCharacterUnlocked(id) {
    if (id === 'soldier') return true;
    const unlocked = getUnlockedCharacters();
    return unlocked.includes(id);
}

// Mua va mo khoa nhan vat moi vao LocalStorage
export function unlockCharacter(id) {
    const list = getUnlockedCharacters();
    if (!list.includes(id)) {
        list.push(id);
        try {
            localStorage.setItem('cyber_arena_unlocked_characters', JSON.stringify(list));
        } catch {
            // Bo qua loi luu tru
        }
    }
    return list;
}
