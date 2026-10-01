import * as THREE from 'three';
import * as SkeletonUtils from '../libs/SkeletonUtils.js';
import { CHARACTER_CONFIGS } from './characters.js';
import { WEAPON_CONFIGS, getStartingWeapon, updateHeldWeaponPose, BOMB_CONFIGS, getBombConfig } from './weapons.js?v=35';

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
        this.selected = this.game.characterId || 'soldier';
        this.mode = 'characters';
        this.loadout = this.getSavedLoadout();
        this.weaponId = this.loadout.primary;
        this.allItems = [...WEAPON_CONFIGS, ...BOMB_CONFIGS];
        this.weaponCards = document.getElementById('weapon-cards');

        // Tạo toàn bộ thẻ cho Súng và Bom
        for (const item of this.allItems) {
            const card = document.createElement('button');
            card.className = 'character-card weapon-card';
            card.dataset.previewWeapon = item.id;
            card.dataset.slotType = item.slotType || (item.isBomb ? 'bomb' : 'primary');
            const tierColor = '#' + (item.color || 0x38bdf8).toString(16).padStart(6, '0');
            card.style.setProperty('--card-color', tierColor);
            card.innerHTML = `
                <div class="weapon-card-header">
                    <span class="weapon-tier-badge tier-${item.tier}">CẤP ${item.tier}</span>
                    <span class="weapon-category-tag">${item.category}</span>
                </div>
                <div class="weapon-card-portrait">
                    <img src="${item.icon}" alt="${item.name}">
                </div>
                <strong class="weapon-card-name">${item.name}</strong>
                <span class="character-card-status weapon-card-status"></span>
            `;
            card.onclick = () => this.previewWeapon(item.id);
            this.weaponCards.append(card);
        }

        // 3 Tab Phân Loại Vũ Khí Ở Cột Trái (VŨ KHÍ CHÍNH | VŨ KHÍ PHỤ | TRANG BỊ KHÁC)
        this.armoryCategory = 'primary';
        this.dialog.querySelectorAll('[data-armory-cat]').forEach(btn => {
            btn.onclick = () => {
                this.dialog.querySelectorAll('[data-armory-cat]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.armoryCategory = btn.dataset.armoryCat;
                this.filterWeapons();
            };
        });

        // 4 Ô Trang Bị Loadout Bao Quanh Nhân Vật 3D (Cột Phải)
        this.dialog.querySelectorAll('[data-rig-slot]').forEach(slotBox => {
            slotBox.onclick = () => {
                const slotType = slotBox.dataset.rigSlot;
                const catType = (slotType === 'bomb1' || slotType === 'bomb2') ? 'other' : slotType;
                const catBtn = this.dialog.querySelector(`[data-armory-cat="${catType}"]`);
                if (catBtn) catBtn.click();
                const curId = this.loadout[slotType];
                if (curId) this.previewWeapon(curId);
            };
        });

        // Gắn sự kiện các nút trong cụm trang bị
        this.armoryActionGroup = document.getElementById('armory-action-group');
        this.btnPrimary = document.getElementById('armory-btn-primary');
        this.btnSecondary = document.getElementById('armory-btn-secondary');
        this.btnBomb1 = document.getElementById('armory-btn-bomb1');
        this.btnBomb2 = document.getElementById('armory-btn-bomb2');

        if (this.btnPrimary) this.btnPrimary.onclick = () => this.equipToSlot('primary', this.weaponId);
        if (this.btnSecondary) this.btnSecondary.onclick = () => this.equipToSlot('secondary', this.weaponId);
        if (this.btnBomb1) this.btnBomb1.onclick = () => this.equipToSlot('bomb1', this.weaponId);
        if (this.btnBomb2) this.btnBomb2.onclick = () => this.equipToSlot('bomb2', this.weaponId);

        this.dialog.querySelectorAll('[data-showroom-tab]').forEach(button => {
            button.onclick = () => this.setMode(button.dataset.showroomTab);
        });
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.HemisphereLight(0xfff5e6, 0x806585, 2.6));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3, 6, 7);
        this.scene.add(key);
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
        this.confirm = document.getElementById('character-confirm');
        this.status = document.getElementById('character-load-status');
        this.dialog.querySelector('[data-character-back]').onclick = () => this.dialog.close();
        this.dialog.addEventListener('close', () => this.close());
        this.cards.forEach(card => card.onclick = () => this.preview(card.dataset.previewCharacter));
        
        this.confirm.onclick = () => {
            if (this.locked()) return;
            if (this.mode === 'weapons') {
                const item = this.getItem(this.weaponId);
                const isUnlocked = this.game.isWeaponUnlocked(item.id);
                if (!isUnlocked) {
                    const bought = this.game.buyWeapon(item.id);
                    if (bought) {
                        this.syncSelection();
                    }
                    return;
                }
                // Trang bị mặc định theo loại
                if (item.slotType === 'secondary') {
                    this.equipToSlot('secondary', item.id);
                } else if (item.isBomb) {
                    this.equipToSlot('bomb1', item.id);
                } else {
                    this.equipToSlot('primary', item.id);
                }
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

    getItem(id) {
        return BOMB_CONFIGS.find(b => b.id === id) || WEAPON_CONFIGS.find(w => w.id === id) || WEAPON_CONFIGS[0];
    }

    getSavedLoadout() {
        try {
            const raw = localStorage.getItem('cyber_arena_loadout');
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    primary: parsed.primary || 'blaster_c',
                    secondary: parsed.secondary || 'blaster',
                    bomb1: parsed.bomb1 || 'grenade_a',
                    bomb2: parsed.bomb2 || 'grenade_b'
                };
            }
        } catch {}
        return {
            primary: 'blaster_c',
            secondary: 'blaster',
            bomb1: 'grenade_a',
            bomb2: 'grenade_b'
        };
    }

    saveLoadout() {
        try {
            localStorage.setItem('cyber_arena_loadout', JSON.stringify(this.loadout));
        } catch {}
        if (this.game.weapons) {
            this.game.weapons.startingWeaponId = this.loadout.primary;
            this.game.startingLoadout = { ...this.loadout };
        }
    }

    equipToSlot(slotName, itemId) {
        if (!this.loadout || !slotName || !itemId) return;
        const item = this.getItem(itemId);
        if (!item) return;

        // Nếu chưa mở khóa thì tiến hành mua trước
        if (!this.game.isWeaponUnlocked(itemId)) {
            const bought = this.game.buyWeapon(itemId);
            if (!bought) return;
        }

        this.loadout[slotName] = itemId;
        this.saveLoadout();
        this.syncSelection();
        this.syncLoadoutUI();
    }

    syncLoadoutUI() {
        const slots = ['primary', 'secondary', 'bomb1', 'bomb2'];
        for (const slot of slots) {
            const itemId = this.loadout[slot];
            const item = this.getItem(itemId);
            const imgEl = document.getElementById(`rig-img-${slot}`) || document.getElementById(`loadout-img-${slot}`);
            const nameEl = document.getElementById(`rig-name-${slot}`) || document.getElementById(`loadout-name-${slot}`);
            const slotCard = this.dialog.querySelector(`[data-rig-slot="${slot}"]`);

            if (item) {
                if (imgEl) {
                    imgEl.src = item.icon;
                    imgEl.alt = item.name;
                }
                if (nameEl) {
                    nameEl.textContent = item.name;
                }
            }

            if (slotCard) {
                const isSelected = (this.weaponId === itemId);
                slotCard.classList.toggle('active-slot', isSelected);
            }
        }
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
        this.loadout = this.getSavedLoadout();
        this.weaponId = this.loadout.primary;
        this.syncLoadoutUI();
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
        // Khôi phục kích thước render của phòng chờ
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
            model.rotation.y = -0.35;
            const currentSelected = this.selected || this.game.characterId || 'soldier';
            model.visible = (id === currentSelected);
            this.scene.add(model);
            const entry = { model, mixer, thumbnail: false };
            this.entries.set(id, entry);
            this.attachGun(entry);
            if (id === currentSelected) {
                this.status.hidden = true;
                if (this.mode === 'characters') this.preview(id);
                else this.previewWeapon(this.weaponId);
            }
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
        const weapon = this.getItem(this.weaponId);
        document.getElementById('character-health').textContent = this.game.player.maxHealth;
        document.getElementById('character-shield').textContent = this.game.player.maxShield;
        document.getElementById('character-damage').textContent = weapon.damage || 30;
        document.getElementById('character-speed').textContent = this.game.player.speed;
        document.getElementById('character-weapon-detail').textContent = weapon.isBomb 
            ? `${weapon.damage} sát thương nổ · Bán kính ${weapon.radius}m` 
            : `${weapon.damage} sát thương · ${weapon.magSize} viên / băng`;
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
            const item = this.getItem(id);
            const isUnlocked = this.game.isWeaponUnlocked(id);
            const isEquippedPrimary = (id === this.loadout.primary);
            const isEquippedSecondary = (id === this.loadout.secondary);
            const isEquippedBomb1 = (id === this.loadout.bomb1);
            const isEquippedBomb2 = (id === this.loadout.bomb2);
            const isEquipped = isEquippedPrimary || isEquippedSecondary || isEquippedBomb1 || isEquippedBomb2;

            card.classList.toggle('previewing', id === this.weaponId);
            card.classList.toggle('equipped', isEquipped);
            card.classList.toggle('locked', !isUnlocked);
            card.setAttribute('aria-pressed', String(id === this.weaponId));

            const statusEl = card.querySelector('.weapon-card-status') || card.querySelector('.character-card-status');
            if (statusEl) {
                if (isEquippedPrimary) statusEl.textContent = '✓ SÚNG CHÍNH';
                else if (isEquippedSecondary) statusEl.textContent = '✓ SÚNG PHỤ';
                else if (isEquippedBomb1) statusEl.textContent = '✓ BOM 1';
                else if (isEquippedBomb2) statusEl.textContent = '✓ BOM 2';
                else if (isUnlocked) statusEl.textContent = 'ĐÃ SỞ HỮU';
                else statusEl.textContent = `${item.price.toLocaleString()} VÀNG`;
            }
        }

        const unlockedCount = this.allItems.filter(w => this.game.isWeaponUnlocked(w.id)).length;
        const countEl = document.getElementById('armory-unlocked-count');
        if (countEl) countEl.textContent = `SỞ HỮU: ${unlockedCount}/${this.allItems.length}`;
        this.filterWeapons();

        const curItem = this.getItem(this.weaponId);
        const isWeaponUnlocked = this.game.isWeaponUnlocked(this.weaponId);

        // Cập nhật badge trạng thái ở bảng mini panel dưới chân nhân vật
        const statusBadge = document.getElementById('armory-status-badge');
        if (statusBadge) {
            statusBadge.textContent = isWeaponUnlocked ? 'ĐÃ SỞ HỮU' : `${curItem.price.toLocaleString()} VÀNG`;
            statusBadge.classList.toggle('locked', !isWeaponUnlocked);
        }

        if (this.mode === 'weapons') {
            if (!isWeaponUnlocked) {
                // Chưa mua -> hiển thị nút MUA
                if (this.armoryActionGroup) this.armoryActionGroup.style.display = 'none';
                this.confirm.style.display = '';
                const canBuy = (this.game.coins >= curItem.price);
                this.confirm.textContent = `MUA [${curItem.price.toLocaleString()} VÀNG]`;
                this.confirm.disabled = this.locked() || !canBuy;
                this.confirm.classList.remove('equipped');
            } else {
                // Đã sở hữu -> hiển thị cụm nút trang bị theo loại trang bị
                this.confirm.style.display = 'none';
                if (this.armoryActionGroup) {
                    this.armoryActionGroup.style.display = 'flex';
                    if (curItem.isBomb) {
                        if (this.btnPrimary) this.btnPrimary.style.display = 'none';
                        if (this.btnSecondary) this.btnSecondary.style.display = 'none';
                        if (this.btnBomb1) {
                            this.btnBomb1.style.display = '';
                            this.btnBomb1.textContent = (this.loadout.bomb1 === curItem.id) ? '✓ ĐANG TRANG BỊ BOM 1' : 'TRANG BỊ VÀO BOM 1 [3]';
                        }
                        if (this.btnBomb2) {
                            this.btnBomb2.style.display = '';
                            this.btnBomb2.textContent = (this.loadout.bomb2 === curItem.id) ? '✓ ĐANG TRANG BỊ BOM 2' : 'TRANG BỊ VÀO BOM 2 [4]';
                        }
                    } else if (curItem.slotType === 'secondary') {
                        if (this.btnPrimary) this.btnPrimary.style.display = 'none';
                        if (this.btnBomb1) this.btnBomb1.style.display = 'none';
                        if (this.btnBomb2) this.btnBomb2.style.display = 'none';
                        if (this.btnSecondary) {
                            this.btnSecondary.style.display = '';
                            this.btnSecondary.textContent = (this.loadout.secondary === curItem.id) ? '✓ ĐANG LÀ SÚNG PHỤ' : 'TRANG BỊ SÚNG PHỤ [2]';
                        }
                    } else {
                        // Súng chính
                        if (this.btnSecondary) this.btnSecondary.style.display = 'none';
                        if (this.btnBomb1) this.btnBomb1.style.display = 'none';
                        if (this.btnBomb2) this.btnBomb2.style.display = 'none';
                        if (this.btnPrimary) {
                            this.btnPrimary.style.display = '';
                            this.btnPrimary.textContent = (this.loadout.primary === curItem.id) ? '✓ ĐANG LÀ SÚNG CHÍNH' : 'TRANG BỊ SÚNG CHÍNH [1]';
                        }
                    }
                }
            }
        } else {
            // Chế độ Nhân vật
            if (this.armoryActionGroup) this.armoryActionGroup.style.display = 'none';
            this.confirm.style.display = '';
            const equipped = this.selected === this.game.characterId;
            this.confirm.textContent = this.locked() ? 'TRẬN ĐẤU ĐÃ BẮT ĐẦU' : equipped ? '✓ ĐANG SỬ DỤNG' : 'CHỌN NHÂN VẬT';
            this.confirm.classList.toggle('equipped', equipped);
            this.confirm.disabled = this.locked() || !this.entries.get(this.selected) || equipped;
        }

        this.syncLoadoutUI();
        this.game.updateCoinsUI?.();
    }

    // Lọc danh sách vũ khí theo 3 Tab Lớn (VŨ KHÍ CHÍNH | VŨ KHÍ PHỤ | TRANG BỊ KHÁC)
    filterWeapons() {
        if (!this.weaponCards) return;
        const currentCat = this.armoryCategory || 'primary';
        for (const card of this.weaponCards.children) {
            const id = card.dataset.previewWeapon;
            const item = this.getItem(id);
            if (!item) continue;
            let match = false;
            if (currentCat === 'primary') {
                match = (item.slotType === 'primary' && !item.isBomb);
            } else if (currentCat === 'secondary') {
                match = (item.slotType === 'secondary' && !item.isBomb);
            } else if (currentCat === 'other') {
                match = (item.isBomb || item.slotType === 'bomb');
            } else {
                match = true;
            }
            card.classList.toggle('filter-hidden', !match);
            if (!match) {
                card.style.setProperty('display', 'none', 'important');
            } else {
                card.style.removeProperty('display');
            }
        }

        // Cập nhật số lượng sở hữu theo tab hiện tại
        const catItems = this.allItems.filter(item => {
            if (currentCat === 'primary') return item.slotType === 'primary' && !item.isBomb;
            if (currentCat === 'secondary') return item.slotType === 'secondary' && !item.isBomb;
            if (currentCat === 'other') return item.isBomb || item.slotType === 'bomb';
            return true;
        });
        const unlockedCatCount = catItems.filter(w => this.game.isWeaponUnlocked(w.id)).length;
        const countEl = document.getElementById('armory-unlocked-count');
        if (countEl) countEl.textContent = `SỞ HỮU: ${unlockedCatCount}/${catItems.length}`;
    }

    setMode(mode) {
        this.mode = mode;
        this.dialog.classList.toggle('weapon-mode', mode === 'weapons');
        this.dialog.querySelectorAll('[data-showroom-tab]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.showroomTab === mode));
        });
        document.getElementById('character-screen-title').textContent = mode === 'weapons' ? 'KHO VŨ KHÍ' : 'NHÂN VẬT';
        const subAction = document.getElementById('character-action-sub') || this.dialog.querySelector('.character-action>span');
        if (subAction) {
            subAction.textContent = mode === 'weapons' ? 'Trang bị vũ khí để mang vào trận tiếp theo' : 'Chọn chiến binh cho trận đấu tiếp theo';
        }

        // Kích hoạt tính lại kích thước canvas để nhân vật 3D hiển thị cân đối trong khung mới
        this.width = 0;
        this.height = 0;

        const charId = this.selected || this.game.characterId || 'soldier';
        for (const [key, entry] of this.entries) {
            if (entry) {
                entry.model.visible = (key === charId);
                if (mode === 'weapons') {
                    this.attachGun(entry);
                }
            }
        }

        if (mode === 'weapons') {
            this.previewWeapon(this.weaponId);
        } else {
            this.preview(charId);
            this.syncSelection();
        }
    }

    attachGun(entry) {
        entry.gun?.removeFromParent();
        const weapon = this.getItem(this.weaponId);
        const modelKey = weapon.modelFile;
        const base = this.game.weapons.models[modelKey];
        const hand = entry.model.getObjectByName('arm-right') || entry.model.getObjectByName('hand-right');
        if (!base || !hand) return;
        const gun = base.clone(true);
        const bounds = new THREE.Box3().setFromObject(gun);
        hand.updateWorldMatrix(true, false);
        const armScaleZ = hand.getWorldScale(new THREE.Vector3()).z || 1.0;
        const targetShowroomLength = (weapon.targetLength || 1.1) * 1.95;

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
        const item = this.getItem(id);
        this.weaponId = item.id;

        // Mô hình nhân vật cầm vũ khí đang xem
        for (const entry of this.entries.values()) {
            if (entry) this.attachGun(entry);
        }

        const curChar = this.selected || this.game.characterId || 'soldier';
        if (this.entries.get(curChar)) {
            this.status.hidden = true;
        }

        const nameEl = document.getElementById('armory-name');
        const catEl = document.getElementById('armory-category');
        const dmgEl = document.getElementById('armory-damage');
        const rateEl = document.getElementById('armory-rate');
        const ammoEl = document.getElementById('armory-ammo');
        const reloadEl = document.getElementById('armory-reload');
        const rangeEl = document.getElementById('armory-range');

        if (nameEl) nameEl.textContent = item.name;
        if (catEl) catEl.textContent = `${item.category} · CẤP ${item.tier}`;
        if (dmgEl) dmgEl.textContent = item.pellets > 1 ? `${item.damage} × ${item.pellets}` : item.damage;

        if (item.isBomb) {
            if (rateEl) rateEl.textContent = '0.7';
            if (ammoEl) ammoEl.textContent = `${item.count} quả`;
            if (reloadEl) reloadEl.textContent = `${item.fuseTime || 0.65}s`;
            if (rangeEl) rangeEl.textContent = `${item.throwRange || 14}m`;
        } else {
            if (rateEl) rateEl.textContent = (1 / item.fireRate).toFixed(1);
            if (ammoEl) ammoEl.textContent = item.magSize;
            if (reloadEl) reloadEl.textContent = `${item.reloadTime}s`;
            if (rangeEl) rangeEl.textContent = `${item.range || 45}m`;
        }

        this.syncSelection();
    }

    render(delta) {
        if (!this.dialog.open || !this.renderer) return;
        const width = this.stage.clientWidth, height = this.stage.clientHeight;
        if (!width || !height) return;
        
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
        const currentSelected = this.selected || this.game.characterId || 'soldier';
        for (const [id, entry] of this.entries) if (entry) entry.model.visible = (id === currentSelected);
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            const isWeaponsMode = (this.mode === 'weapons');
            const camZ = Math.max(width < 500 ? 11.2 : (isWeaponsMode ? 10.0 : 8.6), (isWeaponsMode ? 6.0 : 5.2) / this.camera.aspect);
            const camX = isWeaponsMode ? -0.20 : 0;
            this.camera.position.set(camX, 2.75, camZ);
            this.camera.lookAt(camX, 1.88, 0);
            this.camera.updateProjectionMatrix();
        }
        const entry = this.entries.get(currentSelected);
        if (entry) {
            entry.mixer.update(delta);
            updateHeldWeaponPose(entry.gun, entry.hand, entry.model);
        }
        this.renderer.render(this.scene, this.camera);
    }
}
