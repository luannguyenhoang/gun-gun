import * as THREE from 'three';
import { sounds } from '../../audio/audio.js';
import { RARE_WEAPON_CONFIGS, ATTACHMENT_DEFS, RARITY_TIERS } from '../combat/weapons.js';
import { LOOT_ITEMS } from './looting.js';

// Danh mục phần thưởng rơi từ Zombie: Chủ yếu rơi Hồi Máu, Giáp và Cứu thương; Phụ kiện rơi hiếm hơn
export const DROP_TYPES = [
    { id: 'health', label: '+40 MÁU', color: 0x00ff88, weight: 0.35 },
    { id: 'shield', label: '+50 GIÁP', color: 0x00d0ff, weight: 0.28 },
    { id: 'medkit', label: '+1 TÚI CỨU THƯƠNG', color: 0x10b981, weight: 0.18 },
    { id: 'barrel', label: 'PHỤ KIỆN: NÒNG', color: 0xff4444, weight: 0.05 },
    { id: 'magazine', label: 'PHỤ KIỆN: BĂNG ĐẠN', color: 0x38bdf8, weight: 0.05 },
    { id: 'optic', label: 'PHỤ KIỆN: KÍNH NGẮM', color: 0xa855f7, weight: 0.04 },
    { id: 'grip', label: 'PHỤ KIỆN: TAY CẦM', color: 0xf59e0b, weight: 0.03 },
    { id: 'weapon', label: 'VŨ KHÍ MỚI', color: 0xffaa22, weight: 0.02 }
];

export const DROP_CHANCE = 0.05;
const ATTACHMENT_SLOTS = ['barrel', 'magazine', 'optic', 'grip'];

export class PickupManager {
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        this.pickups = [];
        this.nextId = 1;
        this.airdropTimer = 22;

        this.geoBox = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        this.geoOcta = new THREE.OctahedronGeometry(0.35);
        this.geoBarrel = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8);
        this.geoBeam = new THREE.CylinderGeometry(0.04, 0.1, 2.2, 6);
        this.geoRing = new THREE.TorusGeometry(0.48, 0.035, 4, 24);
    }

    spawnDrop(position, enemyType = 'walker') {
        // Each ordinary kill rolls independently; no guaranteed drop after a dry streak.
        if (enemyType !== 'boss' && Math.random() >= DROP_CHANCE) return null;
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

        const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            roughness: 0.25
        });

        const body = new THREE.Group();
        mesh.add(body);

        if (type === 'barrel') {
            const cyl = new THREE.Mesh(this.geoBarrel, material);
            cyl.rotation.z = Math.PI / 2;
            body.add(cyl);
        } else if (type === 'optic') {
            const prism = new THREE.Mesh(this.geoOcta, material);
            prism.scale.set(0.65, 0.65, 0.65);
            body.add(prism);
        } else if (type === 'magazine') {
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.35), material);
            body.add(mag);
        } else if (type === 'grip') {
            const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), material);
            gripMesh.rotation.x = 0.25;
            body.add(gripMesh);
        } else if (type === 'weapon') {
            const b = new THREE.Mesh(this.geoBarrel, material);
            const g = new THREE.Mesh(this.geoBox, material);
            g.scale.set(0.35, 0.7, 0.35);
            g.position.set(-0.16, -0.2, 0);
            body.add(b, g);
        } else {
            const core = new THREE.Mesh(this.geoBox, material);
            body.add(core);
        }

        const ring = new THREE.Mesh(this.geoRing, material);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.5;
        mesh.add(ring);

        const beam = new THREE.Mesh(this.geoBeam, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.22,
            depthWrite: false
        }));
        beam.position.y = 0.5;
        mesh.add(beam);

        // Billboard text nhãn rõ ràng, không dùng icon
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 80;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(8, 15, 24, 0.85)';
            ctx.fillRect(0, 0, 512, 80);
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            ctx.fillText(label, 256, 40, 490);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(canvas),
                depthWrite: false
            }));
            sprite.position.y = 1.3;
            sprite.scale.set(2.8, 0.45, 1);
            mesh.add(sprite);
        }

        this.scene.add(mesh);
        const pickup = {
            id: options.id ?? this.nextId++,
            mesh,
            body,
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
                this.airdropTimer = 24 + Math.random() * 12;
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

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            pickup.life -= delta;
            if (pickup.life <= 0) {
                this.remove(i);
                continue;
            }
            pickup.body.rotation.y += (pickup.type === 'airdrop' ? 0.4 : 2.2) * delta;
            pickup.mesh.position.y = pickup.baseY + Math.sin(performance.now() * 0.005 + i) * 0.15;
            const collector = authoritative && players.find(p => !p.isDead && Math.hypot(pickup.mesh.position.x - p.position.x, pickup.mesh.position.z - p.position.z) < 1.6);
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
