// Cau hinh toan bo he thong nhan vat, ky nang noi tai, ky nang chu dong va gia mua bang Vang
export const CHARACTER_CONFIGS = {
    soldier: {
        id: 'soldier',
        label: 'LINH CHIEN',
        subtitle: 'CHIEN BINH TIEN TUYEN',
        modelFile: 'character-soldier.glb',
        color: '#22e6a5',
        preview: 'assets/previews/character-a.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 0,
        description: 'Chien binh can truong, kiem soat do giat sung tuyet voi va tang toc do thao tac chien thuat.',
        passives: {
            recoilMult: 0.85,
            healthBonus: 0,
            armorBonus: 0,
            speedMult: 1.0,
            passiveDesc: 'Giam 15% do giat moi loai sung'
        },
        activeSkill: {
            id: 'tactical_rapid',
            name: 'Chien Thuat Ap Dao',
            key: 'Q / E',
            cooldown: 18,
            duration: 6,
            description: 'Tang 30% toc do thay dan va 15% toc do ban trong 6 giay',
            effectType: 'rapid_fire'
        }
    },
    char_a: {
        id: 'char_a',
        label: 'DAC NHIEM ALPHA',
        subtitle: 'TIEN PHONG CO DONG',
        modelFile: 'character-a.glb',
        color: '#38bdf8',
        preview: 'assets/previews/character-a.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1000,
        description: 'Chuyen gia dot kich voi toc do di chuyen vuot troi tren moi dia hinh.',
        passives: {
            speedMult: 1.08,
            dodgeDistMult: 1.15,
            passiveDesc: 'Tang 8% toc do chay co ban va 15% khoang cach luot'
        },
        activeSkill: {
            id: 'sprint_boost',
            name: 'Nuoc Rut Sieu Toc',
            key: 'Q / E',
            cooldown: 15,
            duration: 4,
            description: 'Tang 45% toc do di chuyen trong 4 giay de thoat vay hoac ap sat',
            effectType: 'speed_boost'
        }
    },
    char_b: {
        id: 'char_b',
        label: 'DAC VU BRAVO',
        subtitle: 'CHUYEN GIA HAU CAN',
        modelFile: 'character-b.glb',
        color: '#4ade80',
        preview: 'assets/previews/character-b.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1200,
        description: 'Binh nhi chuyen quan ly dan duoc va kho vu khi chien truong.',
        passives: {
            ammoPickupMult: 1.25,
            reloadSpeedMult: 1.15,
            passiveDesc: 'Nhat duoc nhieu hon 25% luong dan tu hom tiep te'
        },
        activeSkill: {
            id: 'instant_reload',
            name: 'Tiep Te Khan Cap',
            key: 'Q / E',
            cooldown: 20,
            duration: 0,
            description: 'Lap tuc nap day bang dan cho vu khi dang cam tren tay',
            effectType: 'instant_reload'
        }
    },
    char_c: {
        id: 'char_c',
        label: 'KY SU CO KHI',
        subtitle: 'BAC THAY PHONG THU',
        modelFile: 'character-c.glb',
        color: '#fb923c',
        preview: 'assets/previews/character-c.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1500,
        description: 'Nghien cuu va gia co giap phong ho tien tien cho ban than.',
        passives: {
            armorBonus: 25,
            damageTakenMult: 0.95,
            passiveDesc: 'Khoi dau voi +25 Giap toi da va giam 5% sat thuong'
        },
        activeSkill: {
            id: 'repair_armor',
            name: 'Han Giap Cap Toc',
            key: 'Q / E',
            cooldown: 22,
            duration: 0,
            description: 'Lap tuc phuc hoi 35 diem Giap phong ho',
            effectType: 'heal_armor'
        }
    },
    char_d: {
        id: 'char_d',
        label: 'ORC CHIEN BINH',
        subtitle: 'DAU SI KHONG LO',
        modelFile: 'character-d.glb',
        color: '#22c55e',
        preview: 'assets/previews/character-d.png',
        tier: 2,
        tierName: 'HIEM',
        price: 2800,
        description: 'The luc phi phuong voi luong mau khong lo va tieng gam tran ap ke dich.',
        passives: {
            healthBonus: 60,
            knockbackResist: 0.35,
            passiveDesc: 'Tang 60 Mau toi da va khang 35% luc day lui'
        },
        activeSkill: {
            id: 'savage_roar',
            name: 'Tieng Gam Man Ro',
            key: 'Q / E',
            cooldown: 20,
            duration: 1,
            description: 'Gam the the hien suc manh, danh bat lui toan bo zombie ban kinh 7m',
            effectType: 'shockwave_push'
        }
    },
    char_e: {
        id: 'char_e',
        label: 'HAI TAC DOT BIEN',
        subtitle: 'CHUYEN GIA CHAY NO',
        modelFile: 'character-e.glb',
        color: '#e11d48',
        preview: 'assets/previews/character-e.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3000,
        description: 'Thich su dung vu khi no de quet sach dam dong quai vat hung han.',
        passives: {
            explosiveBonus: 0.25,
            passiveDesc: 'Tang 25% ban kinh va sat thuong tat ca loai bom min'
        },
        activeSkill: {
            id: 'cluster_mines',
            name: 'Mua Phao Kich',
            key: 'Q / E',
            cooldown: 25,
            duration: 0,
            description: 'Tha tuc thi 3 qua min no mini xung quanh gay sat thuong dien rong',
            effectType: 'cluster_grenades'
        }
    },
    char_f: {
        id: 'char_f',
        label: 'VE BINH HOANG GIA',
        subtitle: 'BUC TUONG THEP',
        modelFile: 'character-f.glb',
        color: '#f59e0b',
        preview: 'assets/previews/character-f.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1500,
        description: 'Huan luyen chuyen nghiep trong cac tinh huong bi bao vay giam thieu sat thuong.',
        passives: {
            damageTakenMult: 0.90,
            passiveDesc: 'Giam 10% moi loai sat thuong nhan vao'
        },
        activeSkill: {
            id: 'iron_wall',
            name: 'Hang Rao Kien Co',
            key: 'Q / E',
            cooldown: 25,
            duration: 3.5,
            description: 'Giam 50% moi sat thuong nhan vao trong 3.5 giay',
            effectType: 'iron_wall'
        }
    },
    char_g: {
        id: 'char_g',
        label: 'THO SAN TIEN THUONG',
        subtitle: 'DINH VI CON MOI',
        modelFile: 'character-g.glb',
        color: '#84cc16',
        preview: 'assets/previews/character-g.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3200,
        description: 'Chuyen gia truy lung quai va tich luy tien vang chien loi pham vuot troi.',
        passives: {
            goldBonus: 0.25,
            passiveDesc: 'Tang 25% luong Vang thu duoc khi tieu diet zombie'
        },
        activeSkill: {
            id: 'radar_scan',
            name: 'Dinh Vi Muc Tieu',
            key: 'Q / E',
            cooldown: 18,
            duration: 6,
            description: 'Quet radar lam lo dien toan bo vi tri quai vat xuyen tuong trong 6s',
            effectType: 'scanner'
        }
    },
    char_h: {
        id: 'char_h',
        label: 'SI QUAN AN NINH',
        subtitle: 'HO TRO DONG DOI',
        modelFile: 'character-h.glb',
        color: '#06b6d4',
        preview: 'assets/previews/character-h.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1400,
        description: 'Thanh thạo ky nang cuu thuong va khong che dam dong bang luu dan gay choang.',
        passives: {
            reviveSpeedMult: 1.30,
            passiveDesc: 'Toc do cuu song dong doi bi guc nhanh hon 30%'
        },
        activeSkill: {
            id: 'stun_pulse',
            name: 'Luu Dan Gay Choang',
            key: 'Q / E',
            cooldown: 22,
            duration: 3,
            description: 'Phat xung shockwave lam te liet va bat dong zombie xung quanh trong 3 giay',
            effectType: 'stun_grenade'
        }
    },
    char_i: {
        id: 'char_i',
        label: 'QUAI NHAN DOC NHAN',
        subtitle: 'HOA LUC XUYEN PHA',
        modelFile: 'character-i.glb',
        color: '#ec4899',
        preview: 'assets/previews/character-i.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3500,
        description: 'Giac quan vuot troi giup ban trung yeu huyet va xuyen qua ke dich.',
        passives: {
            penetrationBonus: 1,
            critChance: 0.10,
            passiveDesc: 'Dan ban ra xuyen them 1 muc tieu va +10% ty le chi mang'
        },
        activeSkill: {
            id: 'laser_beam',
            name: 'Tia Tu Ngoai',
            key: 'Q / E',
            cooldown: 24,
            duration: 0,
            description: 'Ban mot tia nang luong cuc manh xuyen qua moi ke dich phia truoc',
            effectType: 'piercing_beam'
        }
    },
    char_j: {
        id: 'char_j',
        label: 'ZOMBIE NAM VUNG',
        subtitle: 'BONG MA NGUY TRANG',
        modelFile: 'character-j.glb',
        color: '#10b981',
        preview: 'assets/previews/character-j.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3000,
        description: 'Mang theo mui tu khi khien lu zombie thuong kho nhan dien va bo qua.',
        passives: {
            detectionDelayMult: 1.35,
            passiveDesc: 'Zombie phat hien ban cham hon 35% so voi binh thuong'
        },
        activeSkill: {
            id: 'undead_scent',
            name: 'Mui Tu Khi',
            key: 'Q / E',
            cooldown: 26,
            duration: 4,
            description: 'Nguy trang tuyet doi khien zombie phot lo ban trong 4 giay',
            effectType: 'smoke_camo'
        }
    },
    char_k: {
        id: 'char_k',
        label: 'CYBER MECHA',
        subtitle: 'CONG NGHE TUONG LAI',
        modelFile: 'character-k.glb',
        color: '#a855f7',
        preview: 'assets/previews/character-k.png',
        tier: 3,
        tierName: 'HUYEN THOAI',
        price: 6500,
        description: 'Chien binh nguoi may tich hop cong nghe phong dien tu giap nang luong cao cap.',
        passives: {
            armorBonus: 40,
            shieldRegenRate: 1.5,
            passiveDesc: 'Tang 40 Giap toi da va toc do hoi phuc giap nhanh hon 50%'
        },
        activeSkill: {
            id: 'emp_discharge',
            name: 'Xung Dien EMP',
            key: 'Q / E',
            cooldown: 24,
            duration: 1,
            description: 'Phong dien shock toan ban kinh 8m gay 120 sat thuong va lam te liet',
            effectType: 'emp_blast'
        }
    },
    char_l: {
        id: 'char_l',
        label: 'NANO ANDROID',
        subtitle: 'HOA LUC TU TUONG',
        modelFile: 'character-l.glb',
        color: '#6366f1',
        preview: 'assets/previews/character-l.png',
        tier: 3,
        tierName: 'HUYEN THOAI',
        price: 7000,
        description: 'Tao ra tu hat phan tu Nanite giup tao khien vo hieu hoa sat thuong tuyet doi.',
        passives: {
            speedMult: 1.05,
            healthBonus: 20,
            passiveDesc: 'Tang nhe 5% toc do chay va 20 Mau co ban'
        },
        activeSkill: {
            id: 'nanite_barrier',
            name: 'Khien Tu Truong Nanite',
            key: 'Q / E',
            cooldown: 30,
            duration: 3,
            description: 'Tao lop bao ho vo hieu hoa 100% sat thuong trong 3 giay',
            effectType: 'nanite_shield'
        }
    },
    char_m: {
        id: 'char_m',
        label: 'XAC UOP CO DAI',
        subtitle: 'LOI NGUYEN NGHIN NAM',
        modelFile: 'character-m.glb',
        color: '#d97706',
        preview: 'assets/previews/character-m.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3800,
        description: 'Suc song ben bi vuot thoi gian cung loi nguyen lam cham ke dich.',
        passives: {
            regenRate: 2.0,
            passiveDesc: 'Tu hoi phuc 2 Mau moi giay khi luong Mau con duoi 50%'
        },
        activeSkill: {
            id: 'sand_curse',
            name: 'Loi Nguyen Cat Bui',
            key: 'Q / E',
            cooldown: 25,
            duration: 5,
            description: 'Trieu hoi bao cat lam cham 60% toc do di chuyen cua zombie xung quanh',
            effectType: 'sandstorm'
        }
    },
    char_n: {
        id: 'char_n',
        label: 'NINJA BONG DEM',
        subtitle: 'SAT THU VO HINH',
        modelFile: 'character-n.glb',
        color: '#1e293b',
        preview: 'assets/previews/character-n.png',
        tier: 3,
        tierName: 'HUYEN THOAI',
        price: 7500,
        description: 'Bac thay thuat nhan gia voi kha nang luot xa va tao hinh nom phan than danh lac huong.',
        passives: {
            dodgeDistMult: 1.40,
            dodgeCdMult: 0.70,
            passiveDesc: 'Khoang cach Luot +40% va hoi phuc Luot nhanh hon 30%'
        },
        activeSkill: {
            id: 'shadow_decoy',
            name: 'Ao Anh Phan Than',
            key: 'Q / E',
            cooldown: 22,
            duration: 3.5,
            description: 'Tang hinh trong 3.5 giay va de lai hinh nom hut toan bo su chu y cua zombie',
            effectType: 'shadow_decoy'
        }
    },
    char_o: {
        id: 'char_o',
        label: 'TAY SUNG CAO BOI',
        subtitle: 'XA THU THIET XAT',
        modelFile: 'character-o.glb',
        color: '#b45309',
        preview: 'assets/previews/character-o.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3200,
        description: 'Doi tay nhanh nhu chop voi nhung phat ban chi mang cuc ky nguy hiem.',
        passives: {
            critChance: 0.15,
            passiveDesc: 'Tang 15% ty le gay sat thuong chi mang cho moi vien dan'
        },
        activeSkill: {
            id: 'dead_eye',
            name: 'Tu Than Mien Tay',
            key: 'Q / E',
            cooldown: 20,
            duration: 4,
            description: 'Trong 4 giay ke tiep, 100% phat ban deu gay sat thuong chi mang',
            effectType: 'guaranteed_crit'
        }
    },
    char_p: {
        id: 'char_p',
        label: 'CHUYEN VIEN SINH HOC',
        subtitle: 'BAC THAY DOC TO',
        modelFile: 'character-p.glb',
        color: '#059669',
        preview: 'assets/previews/character-p.png',
        tier: 3,
        tierName: 'HUYEN THOAI',
        price: 6000,
        description: 'Nghien cuu virut zombie va tao ra hoi thuoc giai hoa chat an mon cuc manh.',
        passives: {
            medkitHealMult: 1.50,
            passiveDesc: 'Tang 50% luong Mau va Giap duoc hoi phuc khi dung Medkit'
        },
        activeSkill: {
            id: 'toxic_spray',
            name: 'Khi Doc Diet Khuan',
            key: 'Q / E',
            cooldown: 25,
            duration: 5,
            description: 'Rai dam suong hoa chat an mon thieu dot quai vat lọt vao',
            effectType: 'toxic_cloud'
        }
    },
    char_q: {
        id: 'char_q',
        label: 'PHI CONG DOT KICH',
        subtitle: 'CHIEN BINH KHONG GIAN',
        modelFile: 'character-q.glb',
        color: '#0284c7',
        preview: 'assets/previews/character-q.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3400,
        description: 'Kha nang ngam ban phan xa cuc nhay va ket noi vien thong voi tau ho tro.',
        passives: {
            adsSpeedMult: 1.40,
            passiveDesc: 'Toc do bat ngam ban ADS nhanh hon 40%'
        },
        activeSkill: {
            id: 'supply_drop',
            name: 'Tiep Te Hoa Luc',
            key: 'Q / E',
            cooldown: 35,
            duration: 0,
            description: 'Goi tiep te hoi day 100% dan duoc va tang them 1 qua bom chien thuat',
            effectType: 'supply_drop'
        }
    },
    char_r: {
        id: 'char_r',
        label: 'CHIEN BINH TUONG LAI',
        subtitle: 'SIEU CHIEN BINH OMEGA',
        modelFile: 'character-r.glb',
        color: '#dc2626',
        preview: 'assets/previews/character-r.png',
        tier: 3,
        tierName: 'HUYEN THOAI',
        price: 8000,
        description: 'San pham dinh cao cua cong nghe gen voi sat thuong va phan xa toan dien.',
        passives: {
            damageMult: 1.10,
            speedMult: 1.05,
            passiveDesc: 'Tang 10% tong sat thuong moi loai vu khi va 5% toc do'
        },
        activeSkill: {
            id: 'overdrive',
            name: 'Che Do Overdrive',
            key: 'Q / E',
            cooldown: 28,
            duration: 5,
            description: 'Tang 35% toc do ban, 25% toc do di chuyen va mien nhiem lam cham trong 5s',
            effectType: 'overdrive'
        }
    },
    skeleton: {
        id: 'skeleton',
        label: 'KHUNG XUONG',
        subtitle: 'KE SONG SOT BAT DIET',
        modelFile: 'character-skeleton.glb',
        color: '#ffe06a',
        preview: 'assets/previews/character-h.png',
        tier: 1,
        tierName: 'CO BAN',
        price: 1000,
        description: 'Chi con xuong, trong luong cuc nhe giup than thoat luot qua ke thu.',
        passives: {
            dodgeDistMult: 1.25,
            speedMult: 1.06,
            passiveDesc: 'Than phap nhe nhang: Toc do luot +25% va toc do chay +6%'
        },
        activeSkill: {
            id: 'bone_throw',
            name: 'Khuc Xuong Dinh Menh',
            key: 'Q / E',
            cooldown: 16,
            duration: 1,
            description: 'Nem khuc xuong gay 90 sat thuong va lam choang muc tieu dau tien 2 giay',
            effectType: 'bone_toss'
        }
    },
    vampire: {
        id: 'vampire',
        label: 'MA CA RONG',
        subtitle: 'CHIEN BINH BONG DEM',
        modelFile: 'character-vampire.glb',
        color: '#ff5577',
        preview: 'assets/previews/character-e.png',
        tier: 2,
        tierName: 'HIEM',
        price: 3500,
        description: 'Hut sinh luc tu ke thu trong bong dem de duy tri su bat tu tren dau truong.',
        passives: {
            lifesteal: 0.08,
            passiveDesc: 'Hut 8% sat thuong gay ra thanh luong Mau cho ban than'
        },
        activeSkill: {
            id: 'vampire_drain',
            name: 'Doi Dem San Moi',
            key: 'Q / E',
            cooldown: 22,
            duration: 0,
            description: 'Hut 35 Mau tu dam quai vat xung quanh de hoi phuc tuc thi',
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
