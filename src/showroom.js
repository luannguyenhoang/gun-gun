import * as THREE from 'three';
import * as SkeletonUtils from '../libs/SkeletonUtils.js';
import { CHARACTER_CONFIGS } from './characters.js';
import { WEAPON_CONFIGS, getStartingWeapon, updateHeldWeaponPose } from './weapons.js?v=32';

const DETAILS = {
    soldier: { title: 'LÍNH', subtitle: 'CHIẾN BINH TIỀN TUYẾN', color: '#75bca1', description: 'Giữ vững vị trí. Sẵn sàng đối đầu với bất kỳ đợt zombie nào.' },
    skeleton: { title: 'KHUNG XƯƠNG', subtitle: 'KẺ SỐNG SÓT BẤT DIỆT', color: '#bea2ed', description: 'Chỉ còn xương, nhưng tinh thần chiến đấu thì chưa bao giờ tắt.' },
    vampire: { title: 'MA CÀ RỒNG', subtitle: 'CHIẾN BINH BÓNG ĐÊM', color: '#e78188', description: 'Bước ra từ bóng tối. Biến đấu trường thành sân chơi của bạn.' }
};

export class CharacterShowroom {
    constructor(game) {
        this.game = game;
        this.dialog = document.getElementById('character-screen');
        this.stage = document.getElementById('character-stage');
        this.cards = [...this.dialog.querySelectorAll('[data-preview-character]')];
        this.entries = new Map();
        this.mode = 'characters';
        this.weaponId = getStartingWeapon(game.weapons.startingWeaponId).id;
        this.weaponCards = document.getElementById('weapon-cards');
        for (const weapon of WEAPON_CONFIGS) {
            const card = document.createElement('button');
            card.className = 'character-card weapon-card';
            card.dataset.previewWeapon = weapon.id;
            const tierColor = '#' + weapon.color.toString(16).padStart(6, '0');
            card.style.setProperty('--card-color', tierColor);
            card.innerHTML = `
                <div class="weapon-card-header">
                    <span class="weapon-tier-badge tier-${weapon.tier}">CẤP ${weapon.tier}</span>
                    <span class="weapon-category-tag">${weapon.category}</span>
                </div>
                <div class="weapon-card-portrait">
                    <img src="${weapon.icon}" alt="${weapon.name}">
                </div>
                <strong class="weapon-card-name">${weapon.name}</strong>
                <span class="character-card-status weapon-card-status"></span>
            `;
            card.onclick = () => this.previewWeapon(weapon.id);
            this.weaponCards.append(card);
        }
        this.armoryFilter = 'all';
        this.dialog.querySelectorAll('[data-armory-filter]').forEach(btn => {
            btn.onclick = () => {
                this.dialog.querySelectorAll('[data-armory-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.armoryFilter = btn.dataset.armoryFilter;
                this.filterWeapons();
            };
        });
        this.dialog.querySelectorAll('[data-showroom-tab]').forEach(button => {
            button.onclick = () => this.setMode(button.dataset.showroomTab);
        });
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.HemisphereLight(0xfff5e6, 0x806585, 2.6));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3, 6, 7);
        this.scene.add(key);
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        this.confirm = document.getElementById('character-confirm');
        this.status = document.getElementById('character-load-status');
        this.dialog.querySelector('[data-character-back]').onclick = () => this.dialog.close();
        this.dialog.addEventListener('close', () => this.close());
        this.cards.forEach(card => card.onclick = () => this.preview(card.dataset.previewCharacter));
        this.confirm.onclick = () => {
            if (this.locked()) return;
            if (this.mode === 'weapons') {
                const isUnlocked = this.game.isWeaponUnlocked(this.weaponId);
                if (!isUnlocked) {
                    const bought = this.game.buyWeapon(this.weaponId);
                    if (bought) {
                        this.syncSelection();
                    }
                    return;
                }
                this.game.selectWeapon(this.weaponId);
                this.game.homeMenu.refreshLoadout();
                this.syncSelection();
                return;
            }
            if (!this.entries.get(this.selected)) return;
            this.game.selectCharacter(this.selected);
            this.syncSelection();
        };
        this.stage.addEventListener('pointerdown', event => {
            this.dragX = event.clientX;
            this.stage.setPointerCapture(event.pointerId);
        });
        this.stage.addEventListener('pointermove', event => {
            if (this.dragX == null) return;
            const entry = this.entries.get(this.selected);
            if (entry) entry.model.rotation.y += (event.clientX - this.dragX) * 0.012;
            this.dragX = event.clientX;
        });
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.stage.addEventListener(event, () => { this.dragX = null; });
        this.stage.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            const entry = this.entries.get(this.selected);
            if (entry) entry.model.rotation.y += event.key === 'ArrowLeft' ? -0.2 : 0.2;
        });
    }

    locked() { return this.game.network.active && this.game.state !== 'MENU'; }

    open() {
        this.game.homeMenu.dialog.close();
        this.game.roomLobby.mount();
        this.renderer = this.game.roomLobby.renderer;
        this.originalLabel = this.renderer.domElement.getAttribute('aria-label');
        this.renderer.domElement.setAttribute('aria-label', 'Mô hình nhân vật 3D');
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.stage.prepend(this.renderer.domElement);
        this.width = 0;
        this.dialog.showModal();
        this.weaponId = getStartingWeapon(this.game.weapons.startingWeaponId).id;
        for (const entry of this.entries.values()) if (entry) this.attachGun(entry);
        this.setMode('weapons'); // Mặc định mở tab VŨ KHÍ khi vào kho súng
        for (const id of Object.keys(CHARACTER_CONFIGS)) this.load(id);
    }

    close() {
        if (this.dialog.open) return;
        this.dragX = null;
        if (!this.renderer) return;
        this.game.roomLobby.stage.prepend(this.renderer.domElement);
        this.renderer.domElement.setAttribute('aria-label', this.originalLabel);
        // Force the lobby to restore its render dimensions after the shared canvas returns.
        this.game.roomLobby.width = 0;
    }

    async load(id) {
        if (this.entries.has(id)) return;
        this.entries.set(id, null);
        try {
            const gltf = await this.game.roomLobby.load(id);
            const model = SkeletonUtils.clone(gltf.scene);
            const box = new THREE.Box3().setFromObject(model);
            model.scale.setScalar(3.8 / Math.max(0.1, box.max.y - box.min.y));
            box.setFromObject(model);
            model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
            const mixer = new THREE.AnimationMixer(model);
            const idle = gltf.animations?.find(clip => clip.name.toLowerCase() === 'idle');
            if (idle) mixer.clipAction(idle).play();
            const holding = gltf.animations?.find(clip => clip.name === 'holding-right');
            if (holding) mixer.clipAction(holding).play();
            mixer.update(0.1);
            model.rotation.y = -0.35;
            model.visible = false;
            this.scene.add(model);
            const entry = { model, mixer, thumbnail: false };
            this.entries.set(id, entry);
            this.attachGun(entry);
            if (this.selected === id && this.mode === 'characters') this.preview(id);
        } catch {
            this.entries.delete(id);
            if (this.selected === id) {
                this.status.hidden = false;
                this.status.textContent = 'Chưa tải được nhân vật. Chọn thẻ để thử lại.';
                this.confirm.disabled = true;
            }
        }
    }

    preview(id) {
        this.selected = id;
        const info = DETAILS[id];
        if (!info) return;
        this.dialog.style.setProperty('--character-accent', info.color);
        document.getElementById('character-name').textContent = info.title;
        document.getElementById('character-subtitle').textContent = info.subtitle;
        document.getElementById('character-description').textContent = info.description;
        document.getElementById('character-watermark').textContent = info.title;
        const weapon = getStartingWeapon(this.weaponId);
        document.getElementById('character-health').textContent = this.game.player.maxHealth;
        document.getElementById('character-shield').textContent = this.game.player.maxShield;
        document.getElementById('character-damage').textContent = weapon.damage;
        document.getElementById('character-speed').textContent = this.game.player.speed;
        document.getElementById('character-weapon-detail').textContent = `${weapon.damage} sát thương · ${weapon.magSize} viên / băng`;
        document.getElementById('character-weapon-name').textContent = weapon.name;
        document.getElementById('character-weapon-icon').src = weapon.icon;
        for (const [key, entry] of this.entries) if (entry) entry.model.visible = (key === id && this.mode === 'characters');
        const loaded = !!this.entries.get(id);
        this.status.hidden = loaded;
        this.status.textContent = 'ĐANG TẢI NHÂN VẬT…';
        this.stage.setAttribute('aria-busy', String(!loaded));
        this.syncSelection();
        this.load(id);
    }

    syncSelection() {
        for (const card of this.cards) {
            const id = card.dataset.previewCharacter;
            card.classList.toggle('previewing', id === this.selected);
            card.setAttribute('aria-pressed', String(id === this.selected));
            card.querySelector('.character-card-status').textContent = id === this.game.characterId ? '✓ ĐANG DÙNG' : 'ĐÃ SỞ HỮU';
            card.classList.toggle('equipped', id === this.game.characterId);
        }
        for (const card of this.weaponCards.children) {
            const id = card.dataset.previewWeapon;
            const wCfg = getStartingWeapon(id);
            const isUnlocked = this.game.isWeaponUnlocked(id);
            const isEquipped = (id === this.game.weapons.startingWeaponId);
            card.classList.toggle('previewing', id === this.weaponId);
            card.classList.toggle('equipped', isEquipped);
            card.classList.toggle('locked', !isUnlocked);
            card.setAttribute('aria-pressed', String(id === this.weaponId));
            const statusEl = card.querySelector('.weapon-card-status') || card.querySelector('.character-card-status');
            if (statusEl) {
                statusEl.textContent = isEquipped 
                    ? '✓ ĐANG SỬ DỤNG' 
                    : isUnlocked 
                        ? 'ĐÃ SỞ HỮU' 
                        : `${wCfg.price.toLocaleString()} VÀNG`;
            }
        }

        const unlockedCount = WEAPON_CONFIGS.filter(w => this.game.isWeaponUnlocked(w.id)).length;
        const countEl = document.getElementById('armory-unlocked-count');
        if (countEl) countEl.textContent = `SỞ HỮU: ${unlockedCount}/${WEAPON_CONFIGS.length}`;
        this.filterWeapons();

        const curWeapon = getStartingWeapon(this.weaponId);
        const isWeaponUnlocked = this.game.isWeaponUnlocked(this.weaponId);
        const equipped = this.mode === 'weapons' 
            ? this.weaponId === this.game.weapons.startingWeaponId 
            : this.selected === this.game.characterId;

        if (this.mode === 'weapons') {
            if (equipped) {
                this.confirm.textContent = '✓ ĐANG SỬ DỤNG';
                this.confirm.disabled = true;
                this.confirm.classList.add('equipped');
            } else if (isWeaponUnlocked) {
                this.confirm.textContent = 'TRANG BỊ SÚNG';
                this.confirm.disabled = this.locked();
                this.confirm.classList.remove('equipped');
            } else {
                const canBuy = (this.game.coins >= curWeapon.price);
                this.confirm.textContent = `MUA [${curWeapon.price.toLocaleString()} VÀNG]`;
                this.confirm.disabled = this.locked() || !canBuy;
                this.confirm.classList.remove('equipped');
            }
        } else {
            this.confirm.textContent = this.locked() ? 'TRẬN ĐẤU ĐÃ BẮT ĐẦU' : equipped ? '✓ ĐANG SỬ DỤNG' : 'CHỌN NHÂN VẬT';
            this.confirm.classList.toggle('equipped', equipped);
            this.confirm.disabled = this.locked() || !this.entries.get(this.selected) || equipped;
        }

        this.game.updateCoinsUI?.();
    }

    filterWeapons() {
        if (!this.weaponCards) return;
        for (const card of this.weaponCards.children) {
            const id = card.dataset.previewWeapon;
            const w = getStartingWeapon(id);
            if (this.armoryFilter === 'all' || String(w.tier) === this.armoryFilter) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.dialog.classList.toggle('weapon-mode', mode === 'weapons');
        this.dialog.querySelectorAll('[data-showroom-tab]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.showroomTab === mode));
        });
        document.getElementById('character-screen-title').textContent = mode === 'weapons' ? 'KHO VŨ KHÍ' : 'NHÂN VẬT';
        this.dialog.querySelector('.character-action>span').textContent = mode === 'weapons' ? 'Trang bị súng để mang vào trận tiếp theo' : 'Chọn chiến binh cho trận đấu tiếp theo';
        if (mode === 'weapons') {
            // Khi ở chế độ vũ khí: ẩn mô hình nhân vật 3D, hiển thị lưới súng
            for (const entry of this.entries.values()) {
                if (entry) entry.model.visible = false;
            }
            this.previewWeapon(this.weaponId);
        } else {
            // Khi ở chế độ nhân vật: khôi phục nhân vật 3D
            this.preview(this.selected || this.game.characterId);
            this.syncSelection();
        }
    }

    attachGun(entry) {
        entry.gun?.removeFromParent();
        const weapon = getStartingWeapon(this.weaponId);
        const base = this.game.weapons.models[weapon.modelFile];
        const hand = entry.model.getObjectByName('arm-right') || entry.model.getObjectByName('hand-right');
        if (!base || !hand) return;
        const gun = base.clone(true);
        const bounds = new THREE.Box3().setFromObject(gun);
        hand.updateWorldMatrix(true, false);
        const armScaleZ = hand.getWorldScale(new THREE.Vector3()).z || 1.0;
        const targetShowroomLength = (weapon.targetLength || 1.1) * (3.8 / 1.7);

        // Kenney Blaster Kit chuẩn trục Z (-Z là hướng nòng súng)
        const scale = targetShowroomLength / (Math.max(0.01, bounds.max.z - bounds.min.z) * armScaleZ);
        gun.scale.setScalar(scale);
        gun.userData.barrelForward = -1;
        gun.userData.gripOffset = new THREE.Vector3(0, 0.14, -0.18).multiplyScalar(scale);
        gun.userData.handOffset = new THREE.Vector3(-0.24, -0.05, 0.02);

        gun.name = `showroom-${weapon.id}`;
        hand.add(gun);
        entry.gun = gun;
        entry.hand = hand;
        updateHeldWeaponPose(gun, hand, entry.model);
    }

    previewWeapon(id) {
        const weapon = getStartingWeapon(id);
        this.weaponId = weapon.id;
        if (this.mode === 'characters') {
            for (const entry of this.entries.values()) if (entry) this.attachGun(entry);
        }
        document.getElementById('armory-name').textContent = weapon.name;
        document.getElementById('armory-category').textContent = `${weapon.category} · CẤP ${weapon.tier}`;
        document.getElementById('armory-damage').textContent = weapon.pellets > 1 ? `${weapon.damage} × ${weapon.pellets}` : weapon.damage;
        document.getElementById('armory-rate').textContent = (1 / weapon.fireRate).toFixed(1);
        document.getElementById('armory-ammo').textContent = weapon.magSize;
        document.getElementById('armory-reload').textContent = `${weapon.reloadTime}s`;
        const armoryRangeEl = document.getElementById('armory-range');
        if (armoryRangeEl) armoryRangeEl.textContent = `${weapon.range || 45}m`;
        document.getElementById('armory-image').src = weapon.icon;
        document.getElementById('armory-fire-mode').textContent = weapon.isAuto ? 'TỰ ĐỘNG' : 'BÁN TỰ ĐỘNG';
        document.getElementById('armory-reserve').textContent = `${weapon.magSize * 6} VIÊN DỰ TRỮ`;
        const descriptions = {
            blaster: 'BLASTER-A: Súng lục cân bằng tiêu chuẩn, độ giật thấp và ổn định cho phát bắn chính xác.',
            blaster_b: 'BLASTER-B: Súng ngắn hai nòng xả đạn nhanh, cơ động áp chế mục tiêu ở cự ly gần.',
            blaster_c: 'BLASTER-C: Súng trường xung lực chiến thuật, hỏa lực ổn định và độ chính xác cao.',
            repeater: 'BLASTER-D: Tiểu liên tự động xả đạn cao tốc. Băng đạn dồi dào giải vây hiệu quả.',
            blaster_e: 'BLASTER-E: Súng trường bão tố liên thanh cực nhanh, đạn xuyên giáp tầm trung uy lực.',
            shotgun: 'BLASTER-F: Shotgun chiến thuật bắn chùm 8 viên đạn ghém, quét sạch bầy zombie cự ly gần.',
            scatter: 'BLASTER-G: Shotgun tán xạ hạng nặng, sức công phá thô bạo với vùng quét đạn rộng lớn.',
            mac10: 'BLASTER-H: Tiểu liên cơ động Viper tốc độ xả đạn chớp mắt, trọng lượng siêu nhẹ.',
            blaster_i: 'BLASTER-I: Súng trường thiện xạ với ống ngắm quang học, sát thương đơn mục tiêu cao.',
            plasma: 'BLASTER-J: Đại bác Plasma phát xạ năng lượng hủy diệt, phá hủy phòng tuyến quái vật.',
            pew: 'BLASTER-K: Súng lục laser công nghệ cao, nạp đạn nhanh như chớp và đường đạn thẳng tắp.',
            blaster_l: 'BLASTER-L: Súng carbine xung điện thế hệ mới, cân bằng hoàn hảo giữa tốc độ và uy lực.',
            blaster_m: 'BLASTER-M: Súng bắn tỉa bán tự động chuyên dụng tầm xa, sát thương bạo kích chí mạng.',
            awp: 'BLASTER-N: Súng bắn tỉa hạng nặng công phá tầm siêu xa, một phát hạ gục phần lớn kẻ địch.',
            blaster_o: 'BLASTER-O: Súng trường titan hạng nặng công phá tường thành, hỏa lực áp đảo toàn diện.',
            rocket: 'BLASTER-P: Súng phóng lựu RPG nổ lan kinh hoàng, quét sạch đám đông zombie trong chớp mắt.',
            blaster_q: 'BLASTER-Q: Súng máy Gatling quái thú 100 viên, mưa đạn bão lửa thiêu rụi chiến trường.',
            blaster_r: 'BLASTER-R: Pháo lượng tử tối thượng với bán kính hủy diệt khổng lồ, xóa sổ mọi hiểm họa.'
        };
        document.getElementById('armory-description').textContent = descriptions[weapon.id] || 'Vũ khí chiến đấu Kenney Blaster Kit.';
        this.syncSelection();
    }

    render(delta) {
        if (!this.dialog.open || !this.renderer || this.mode === 'weapons') return;
        const width = this.stage.clientWidth, height = this.stage.clientHeight;
        if (!width || !height) return;
        // Portraits are rendered once, with the same WebGL context as the hero/lobby.
        for (const [id, entry] of this.entries) {
            if (!entry || entry.thumbnail) continue;
            for (const other of this.entries.values()) if (other) other.model.visible = other === entry;
            this.renderer.setSize(160, 180, false);
            this.camera.aspect = 160 / 180;
            this.camera.position.set(0, 2.8, 7.6);
            this.camera.lookAt(0, 2.05, 0);
            this.camera.updateProjectionMatrix();
            this.renderer.render(this.scene, this.camera);
            const img = this.cards.find(c => c.dataset.previewCharacter === id).querySelector('img');
            img.src = this.renderer.domElement.toDataURL();
            img.hidden = false;
            entry.thumbnail = true;
            this.width = 0;
        }
        for (const [id, entry] of this.entries) if (entry) entry.model.visible = id === this.selected;
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.position.set(0, 2.8, Math.max(width < 500 ? 9.5 : 8.2, 5.2 / this.camera.aspect));
            this.camera.lookAt(0, 1.9, 0);
            this.camera.updateProjectionMatrix();
        }
        const entry = this.entries.get(this.selected);
        if (entry) {
            entry.mixer.update(delta);
            updateHeldWeaponPose(entry.gun, entry.hand, entry.model);
        }
        this.renderer.render(this.scene, this.camera);
    }
}
