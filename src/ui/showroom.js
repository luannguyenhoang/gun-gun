import * as THREE from 'three';
import * as SkeletonUtils from '../../vendor/SkeletonUtils.js';
import { GLTFLoader } from '../../vendor/loaders/GLTFLoader.js';
import { CHARACTER_CONFIGS, isCharacterUnlocked, unlockCharacter } from '../gameplay/player/characters.js';
import { WEAPON_CONFIGS, getStartingWeapon, updateHeldWeaponPose, BOMB_CONFIGS, getBombConfig, MEDICAL_CONFIGS, th_getWeaponParts, th_getPartTier, TH_PART_META, ATTACHMENT_DEFS } from '../gameplay/combat/weapons.js?v=46';

export class CharacterShowroom {
    constructor(game) {
        this.game = game;
        this.dialog = document.getElementById('character-screen');
        this.stage = document.getElementById('character-stage');
        this.entries = new Map();
        this.selected = this.game.characterId || 'police';
        this.mode = 'characters';
        this.loadout = this.getSavedLoadout();
        this.weaponId = this.loadout.primary;
        this.allItems = [...WEAPON_CONFIGS, ...BOMB_CONFIGS, ...MEDICAL_CONFIGS];
        this.weaponCards = document.getElementById('weapon-cards');

        // Sinh the dong cho toan bo 21 nhan vat
        this.characterCardsContainer = document.getElementById('character-cards');
        if (this.characterCardsContainer) {
            this.characterCardsContainer.innerHTML = '';
            for (const [id, charCfg] of Object.entries(CHARACTER_CONFIGS)) {
                const card = document.createElement('button');
                card.className = 'character-card';
                card.dataset.previewCharacter = id;
                card.style.setProperty('--card-color', charCfg.color || '#38bdf8');
                const isFree = (charCfg.price === 0);
                const priceBadge = isFree ? 'MIỄN PHÍ' : `${charCfg.price.toLocaleString()} VÀNG`;
                const tierClass = `tier-${charCfg.tier || 1}`;
                card.innerHTML = `
                    <div class="weapon-card-header">
                        <span class="weapon-tier-badge ${tierClass}">${charCfg.tierName || 'CƠ BẢN'}</span>
                        <span class="weapon-category-tag">${priceBadge}</span>
                    </div>
                    <span class="character-card-portrait">
                        <img src="${charCfg.preview}" alt="${charCfg.label}" onerror="this.hidden=true">
                    </span>
                    <strong>${charCfg.label}</strong>
                    <span class="character-card-status"></span>
                `;
                card.onclick = () => this.preview(id);
                this.characterCardsContainer.appendChild(card);
            }
        }
        this.cards = [...(this.characterCardsContainer?.querySelectorAll('[data-preview-character]') || [])];

        // Tạo toàn bộ thẻ cho Súng, Bom và Vật phẩm Y tế
        for (const item of this.allItems) {
            const card = document.createElement('button');
            card.className = 'character-card weapon-card';
            card.dataset.previewWeapon = item.id;
            card.dataset.slotType = item.slotType || (item.isBomb ? 'bomb' : 'primary');
            const tierColor = '#' + (item.color || 0x38bdf8).toString(16).padStart(6, '0');
            card.style.setProperty('--card-color', tierColor);
            card.innerHTML = `
                <div class="weapon-card-header">
                    <span class="weapon-tier-badge tier-${item.tier || 1}">CẤP ${item.tier || 1}</span>
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

        // ---- TAB NÂNG CẤP ----
        this.th_upgradeWeaponId = null;
        this.th_upgradeCategory = 'primary';
        this.th_upgradePanel = document.getElementById('th_upgrade-panel');
        this.th_upgradeWeaponList = document.getElementById('th_upgrade-weapon-list');
        this.th_activePopupSlot = null; // Bộ phận đang mở popup
        this.th_isUpgradingPart = false; // Cờ chặn spam bấm nâng cấp

        // Lắng nghe phím Escape để đóng popup nâng cấp thuận tiện
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('th_part_popup')) {
                this.th_closePartPopup();
                e.stopPropagation();
            }
        });

        // Lọc loại súng trong tab nâng cấp
        document.querySelectorAll('[data-upgrade-cat]').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('[data-upgrade-cat]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.th_upgradeCategory = btn.dataset.upgradeCat;
                this.th_renderUpgradeWeaponList();
            };
        });

        // Khởi tạo các biến quản lý Model 3D súng tại bàn nâng cấp
        this.th_weaponCanvas = null;
        this.th_weaponRenderer = null;
        this.th_weaponScene = null;
        this.th_weaponCamera = null;
        this.th_weaponRoot = null;
        this.th_weaponModel = null;
        this.th_weaponIdLoaded = null;
        this.th_defaultRotX = 0.22;
        this.th_defaultRotY = -Math.PI * 0.72; // Góc 3/4 nòng hướng sang trái và chúc nhẹ
        this.th_weaponRotX = this.th_defaultRotX;
        this.th_weaponRotY = this.th_defaultRotY;
        this.th_weaponTime = 0;
        this.th_isDragging = false;
        this.th_dragStartX = 0;
        this.th_dragStartY = 0;
        this.th_wpWidth = 0;
        this.th_wpHeight = 0;
        this.th_gltfLoader = new GLTFLoader();
        // ---- END TAB NÂNG CẤP ----
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
                // Mua vật phẩm y tế tiếp tế vào kho
                if (item.slotType === 'medical') {
                    const cost = item.price || 150;
                    if (this.game.coins >= cost) {
                        this.game.coins -= cost;
                        if (this.game.weapons) {
                            this.game.weapons.inventory[item.id] = (this.game.weapons.inventory[item.id] || 0) + 1;
                            if (item.id === 'bandage_field') this.game.weapons.inventory.bandage = this.game.weapons.inventory[item.id];
                            if (item.id === 'first_aid_kit') {
                                this.game.weapons.inventory.first_aid = this.game.weapons.inventory[item.id];
                                this.game.weapons.inventory.medkits = this.game.weapons.inventory[item.id];
                            }
                            if (item.id === 'medkit_military') this.game.weapons.inventory.medkit_military = this.game.weapons.inventory[item.id];
                            if (item.id === 'energy_drink') this.game.weapons.inventory.energy_drink = this.game.weapons.inventory[item.id];
                        }
                        this.game.saveProgress?.();
                        this.game.updateCoinsUI?.();
                        this.syncSelection();
                        this.previewWeapon(item.id);
                        if (this.game.ui?.showPickupAlert) {
                            this.game.ui.showPickupAlert(`ĐÃ MUA: ${item.name} (+1)!`);
                        }
                    } else if (this.game.ui?.showPickupAlert) {
                        this.game.ui.showPickupAlert('KHÔNG ĐỦ VÀNG!');
                    }
                    return;
                }
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
            if (!isCharacterUnlocked(this.selected)) {
                this.buyCharacter(this.selected);
                return;
            }
            if (!this.entries.get(this.selected)) return;
            this.game.selectCharacter(this.selected);
            this.syncSelection();
            this.renderDetails();
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

    // ============================================================
    // TAB NÂNG CẤP: MILITARY TACTICAL WORKBENCH
    // ============================================================

    th_renderUpgradeWeaponList() {
        if (!this.th_upgradeWeaponList) return;
        const cat = this.th_upgradeCategory;
        const weapons = WEAPON_CONFIGS.filter(w => {
            if (cat === 'primary') return w.slotType !== 'secondary';
            if (cat === 'secondary') return w.slotType === 'secondary';
            return true;
        });

        this.th_upgradeWeaponList.innerHTML = '';
        for (const w of weapons) {
            const isUnlocked = this.game.isWeaponUnlocked(w.id);
            const parts = th_getWeaponParts(w.id);
            const tier = Math.floor((parts.optic + parts.barrel + parts.grip + parts.magazine) / 4);
            const isActive = (w.id === this.th_upgradeWeaponId);

            const row = document.createElement('button');
            row.className = 'th_tactical-weapon-row' + (isUnlocked ? '' : ' th_locked');
            if (isActive) row.classList.add('th_active');
            row.dataset.weaponId = w.id;

            row.innerHTML = `
                <img class="th_tactical-weapon-row-img" src="${w.icon}" alt="${w.name}">
                <div class="th_tactical-weapon-row-info">
                    <div class="th_tactical-weapon-row-name">${w.name}</div>
                    <div class="th_tactical-weapon-row-meta">
                        <span class="th_badge-tier tier-${tier}">T${tier}</span>
                        ${!isUnlocked ? `<span style="font-size:8px;color:#FFB300">${w.price.toLocaleString()} V</span>` : ''}
                    </div>
                </div>
            `;

            row.onclick = () => this.th_selectUpgradeWeapon(w.id);
            this.th_upgradeWeaponList.append(row);
        }
    }

    th_selectUpgradeWeapon(weaponId) {
        if (this.th_upgradeWeaponId !== weaponId) {
            this.th_closePartPopup();
        }
        this.th_upgradeWeaponId = weaponId;
        this.th_renderUpgradeWeaponList();
        this.th_syncUpgradeUI();
    }

    th_syncUpgradeUI() {
        const id = this.th_upgradeWeaponId;
        const item = id ? WEAPON_CONFIGS.find(w => w.id === id) : null;

        const setEl = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };

        if (!item) {
            if (this.th_upBtnForge) { this.th_upBtnForge.disabled = true; setEl('th_btn_upgrade_text', 'CHƯA CHỌN VŨ KHÍ'); }
            if (this.th_upBtnGacha) { this.th_upBtnGacha.disabled = true; }
            // Ẩn popup nếu đang mở
            this.th_closePartPopup();
            return;
        }

        const isUnlocked = this.game.isWeaponUnlocked(id);
        const parts = th_getWeaponParts(id);

        // 1. CỘT GIỮA: Preview Súng Model 3D + Watermark
        const previewImg = document.getElementById('th_up_preview_img');
        if (previewImg) {
            previewImg.src = item.icon;
            previewImg.style.display = 'none';
        }
        setEl('th_up_watermark', item.name.toUpperCase());
        setEl('th_up_bay_code', `${item.name.toUpperCase()} - ${item.category}`);

        // Tải và hiển thị model 3D vũ khí
        this.th_loadWeaponModel(id);

        // 2. Cập nhật 4 Slot Bộ phận với tier thực từ dữ liệu người dùng
        this.th_renderPartSlots(id, parts, isUnlocked);

        // 3. CỘT PHẢI: Summary panel
        setEl('th_up_name', item.name);
        setEl('th_up_cat_tag', item.category);

        // Tính tổng tier để hiển thị badge tổng hợp
        const avgTier = Math.floor((parts.optic + parts.barrel + parts.grip + parts.magazine) / 4);
        const tierBadge = document.getElementById('th_up_tier_badge');
        if (tierBadge) {
            tierBadge.textContent = `CẤP T${avgTier}`;
            tierBadge.className = `th_tactical-tier-badge tier-${avgTier}`;
        }
        setEl('th_up_grade_tag', `Ngắm: T${parts.optic} | Nòng: T${parts.barrel} | Tay: T${parts.grip} | Băng: T${parts.magazine}`);

        // 4. Stats bars: hiển thị stats THỰC sau khi cộng bộ phận
        const bDef = ATTACHMENT_DEFS[`barrel_t${parts.barrel}`] || {};
        const oDef = ATTACHMENT_DEFS[`optic_t${parts.optic}`] || {};
        const mDef = ATTACHMENT_DEFS[`magazine_t${parts.magazine}`] || {};
        const gDef = ATTACHMENT_DEFS[`grip_t${parts.grip}`] || {};

        const finalDmg   = item.damage + (bDef.flatDmg || 0);
        const finalRange = Math.round((item.range || 20) * (1 + (bDef.rangeBonusPct || 0) + (oDef.rangeBonusPct || 0)));
        const finalMag   = Math.floor((item.magSize || 30) * (1 + (mDef.magBonusPct || 0)));
        const finalRecoil = Math.round((gDef.recoilReduction || 0) * 100);
        const currentRpm = Math.round((1 / (item.fireRate || 0.1)) * 60);

        setEl('th_up_dmg_cur', item.damage);
        setEl('th_up_dmg_nxt', finalDmg > item.damage ? `+${finalDmg}` : finalDmg);
        setEl('th_up_range_cur', `${item.range || 20}m`);
        setEl('th_up_range_nxt', `${finalRange}m`);
        setEl('th_up_rpm_cur', `${currentRpm} RPM`);
        setEl('th_up_rpm_nxt', `${finalMag} ĐẠN`);
        setEl('th_up_recoil_cur', '0%');
        setEl('th_up_recoil_nxt', finalRecoil > 0 ? `-${finalRecoil}%` : '0%');

        const setWidth = (id2, w) => { const el = document.getElementById(id2); if (el) el.style.width = w; };
        setWidth('th_stat_dmg_fill',    `${Math.min(90, (item.damage / 80) * 70)}%`);
        setWidth('th_stat_dmg_bonus',   `${Math.min(25, (bDef.flatDmg || 0) / 80 * 70)}%`);
        setWidth('th_stat_range_fill',  `${Math.min(90, ((item.range || 20) / 40) * 70)}%`);
        setWidth('th_stat_range_bonus', `${Math.min(20, (bDef.rangeBonusPct || 0) * 30)}%`);
        setWidth('th_stat_recoil_fill', `${Math.min(90, (gDef.recoilReduction || 0) * 100)}%`);
        setWidth('th_stat_recoil_bonus','0%');
    }

    // ============================================================
    // TRÌNH XUẤT MODEL 3D VŨ KHÍ TẠI BÀN NÂNG CẤP (Workbench 3D Viewer)
    // ============================================================
    th_initWeapon3DViewer() {
        this.th_weaponCanvas = document.getElementById('th_up_weapon_canvas');
        if (!this.th_weaponCanvas) return;

        this.th_weaponScene = new THREE.Scene();
        this.th_weaponCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
        this.th_weaponCamera.position.set(0, 0.12, 4.3);
        this.th_weaponCamera.lookAt(0, 0, 0);

        this.th_weaponRenderer = new THREE.WebGLRenderer({
            canvas: this.th_weaponCanvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.th_weaponRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        if (THREE.SRGBColorSpace) this.th_weaponRenderer.outputColorSpace = THREE.SRGBColorSpace;
        this.th_weaponRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.th_weaponRenderer.toneMappingExposure = 1.35;

        // Ánh sáng Studio chuyên nghiệp tôn khối kim loại sắc nét
        const hemi = new THREE.HemisphereLight(0xfff8ee, 0x2e114d, 3.2);
        this.th_weaponScene.add(hemi);

        const key = new THREE.DirectionalLight(0xffffff, 4.2);
        key.position.set(4, 5, 5);
        this.th_weaponScene.add(key);

        const rimPurple = new THREE.DirectionalLight(0xa855f7, 3.8); // Viền tím neon
        rimPurple.position.set(-4, -2, -3);
        this.th_weaponScene.add(rimPurple);

        const rimCyan = new THREE.DirectionalLight(0x38bdf8, 2.5); // Viền cyan tương phản
        rimCyan.position.set(-3, 3, 3);
        this.th_weaponScene.add(rimCyan);

        const bottomGlow = new THREE.PointLight(0xffd079, 3.0, 7); // Hắt sáng từ bệ kính vàng
        bottomGlow.position.set(0, -1.2, 0.4);
        this.th_weaponScene.add(bottomGlow);

        this.th_weaponRoot = new THREE.Group();
        this.th_weaponScene.add(this.th_weaponRoot);

        // Kéo chuột hoặc ngón tay để xoay súng 360 độ mượt mà
        const canvas = this.th_weaponCanvas;
        canvas.addEventListener('pointerdown', (e) => {
            this.th_isDragging = true;
            this.th_dragStartX = e.clientX;
            this.th_dragStartY = e.clientY;
            try { canvas.setPointerCapture?.(e.pointerId); } catch {}
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!this.th_isDragging) return;
            const dx = e.clientX - this.th_dragStartX;
            const dy = e.clientY - this.th_dragStartY;
            this.th_dragStartX = e.clientX;
            this.th_dragStartY = e.clientY;

            this.th_weaponRotY += dx * 0.012;
            this.th_weaponRotX = Math.max(-0.7, Math.min(0.7, this.th_weaponRotX + dy * 0.012));
        });
        const endDrag = (e) => {
            if (this.th_isDragging) {
                this.th_isDragging = false;
                try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
            }
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
        canvas.addEventListener('dblclick', () => {
            this.th_weaponRotX = this.th_defaultRotX;
            this.th_weaponRotY = this.th_defaultRotY;
        });
    }

    th_loadWeaponModel(weaponId) {
        if (!weaponId) return;
        const item = WEAPON_CONFIGS.find(w => w.id === weaponId);
        if (!item || !item.modelFile) return;

        if (!this.th_weaponCanvas) {
            this.th_initWeapon3DViewer();
        }

        if (this.th_weaponIdLoaded === weaponId && this.th_weaponModel) {
            return;
        }

        const source = this.game.weapons?.models?.[item.modelFile];
        if (source) {
            this.th_setupWeaponMesh(source, weaponId);
        } else {
            this.th_gltfLoader.load(`assets/models/${item.modelFile}`, (gltf) => {
                this.th_setupWeaponMesh(gltf.scene, weaponId);
            });
        }
    }

    th_setupWeaponMesh(source, weaponId) {
        if (!this.th_weaponRoot) return;
        while (this.th_weaponRoot.children.length > 0) {
            this.th_weaponRoot.remove(this.th_weaponRoot.children[0]);
        }

        const gun = SkeletonUtils.clone(source) || source.clone(true);
        gun.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                if (c.material) {
                    c.material = c.material.clone();
                    c.material.roughness = Math.min(c.material.roughness, 0.42);
                    c.material.metalness = Math.max(c.material.metalness, 0.32);
                }
            }
        });

        const pivot = new THREE.Group();
        const box = new THREE.Box3().setFromObject(gun);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        gun.position.set(-center.x, -center.y, -center.z);
        pivot.add(gun);

        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
        const targetSize = 1.62; // Thu nhỏ kích thước để súng vừa vặn bệ kính, không che khuất 4 ô phụ kiện
        const scale = targetSize / maxDim;
        pivot.scale.setScalar(scale);

        this.th_weaponModel = pivot;
        this.th_weaponIdLoaded = weaponId;
        this.th_weaponRoot.add(pivot);
    }

    th_renderUpgradeWeapon3D(delta) {
        if (!this.th_weaponCanvas) {
            this.th_initWeapon3DViewer();
        }
        if (!this.th_weaponRenderer || !this.th_weaponCanvas) return;

        if (this.th_upgradeWeaponId && this.th_upgradeWeaponId !== this.th_weaponIdLoaded) {
            this.th_loadWeaponModel(this.th_upgradeWeaponId);
        }

        const viewport = this.th_weaponCanvas.parentElement;
        if (viewport) {
            const w = viewport.clientWidth;
            const h = viewport.clientHeight;
            if (w > 0 && h > 0 && (this.th_wpWidth !== w || this.th_wpHeight !== h)) {
                this.th_wpWidth = w;
                this.th_wpHeight = h;
                this.th_weaponRenderer.setSize(w, h, false);
                this.th_weaponCamera.aspect = w / h;
                this.th_weaponCamera.updateProjectionMatrix();
            }
        }

        this.th_weaponTime += delta;
        if (this.th_weaponRoot) {
            if (!this.th_isDragging) {
                // Hiệu ứng lơ lửng nhẹ trên bệ từ trường
                this.th_weaponRoot.position.y = Math.sin(this.th_weaponTime * 2.2) * 0.045;
                this.th_weaponRoot.rotation.x = this.th_weaponRotX + Math.sin(this.th_weaponTime * 1.3) * 0.02;
                this.th_weaponRoot.rotation.y = this.th_weaponRotY + Math.sin(this.th_weaponTime * 0.9) * 0.045;
            } else {
                this.th_weaponRoot.position.y = 0;
                this.th_weaponRoot.rotation.x = this.th_weaponRotX;
                this.th_weaponRoot.rotation.y = this.th_weaponRotY;
            }
        }

        this.th_weaponRenderer.render(this.th_weaponScene, this.th_weaponCamera);
    }

    // Render 4 slot bộ phận trong cột giữa với tier thực
    th_renderPartSlots(weaponId, parts, isUnlocked) {
        const SLOT_ELEMENTS = {
            optic:    { valId: 'th_mod_optic_val',   slotEl: document.querySelector('.th_mod-slot-optic, [data-mod-slot="optic"]') },
            barrel:   { valId: 'th_mod_barrel_val',  slotEl: document.querySelector('.th_mod-slot-barrel, [data-mod-slot="barrel"]') },
            grip:     { valId: 'th_mod_grip_val',    slotEl: document.querySelector('.th_mod-slot-grip, [data-mod-slot="grip"]') },
            magazine: { valId: 'th_mod_mag_val',     slotEl: document.querySelector('.th_mod-slot-mag, [data-mod-slot="mag"]') },
        };

        const PART_NAMES = {
            optic:    ['IRON SIGHTS', 'REFLEX T2', 'HOLO T3', 'ACOG 4X T4', 'THERMAL T5'],
            barrel:   ['STOCK BARREL', 'COMP T2', 'FLASH T3', 'SUPPRESSOR T4', 'TITANIUM T5'],
            grip:     ['STD GRIP', 'ANGLED T2', 'TACTICAL T3', 'SKELETON T4', 'CARBON T5'],
            magazine: ['STD MAG', 'EXTENDED T2', 'DRUM T3', 'QUICKMAG T4', 'OVERDRIVE T5'],
        };

        for (const [slot, info] of Object.entries(SLOT_ELEMENTS)) {
            const tier = parts[slot] || 1;
            const meta = TH_PART_META[slot];
            const valEl = document.getElementById(info.valId);
            if (valEl) {
                valEl.innerHTML = `<span class="th_part-tier-badge tier-${tier}">T${tier}</span> ${PART_NAMES[slot][tier - 1] || ''}`;
            }

            // Gắn click event vào slot card
            if (info.slotEl) {
                info.slotEl.onclick = isUnlocked
                    ? (e) => {
                        e.stopPropagation();
                        this.th_showPartPopup(weaponId, slot);
                    }
                    : null;
                info.slotEl.style.cursor = isUnlocked ? 'pointer' : 'default';
                info.slotEl.classList.toggle('th_slot-unlocked', isUnlocked);
                info.slotEl.classList.toggle('th_slot-maxed', tier >= 5);
                info.slotEl.classList.toggle('th_slot-selected', this.th_activePopupSlot === slot);
            }
        }
    }

    // Hiển thị popup nâng cấp bộ phận (vẫn duy trì mở sau khi bấm nâng cấp thành công hoặc thất bại)
    th_showPartPopup(weaponId, slot, lastResult = null) {
        const meta = TH_PART_META[slot];
        if (!meta) return;

        // Luôn đọc tier thực tế mới nhất từ hệ thống
        const currentTier = th_getPartTier(weaponId, slot);
        this.th_activePopupSlot = slot;

        // Đánh dấu highlight slot đang được chọn
        document.querySelectorAll('.th_mod-slot').forEach(el => el.classList.remove('th_slot-selected'));
        const activeSlotEl = document.querySelector(`.th_mod-slot-${slot}, [data-mod-slot="${slot}"]`);
        if (activeSlotEl) activeSlotEl.classList.add('th_slot-selected');

        const isMax = currentTier >= 5;
        const cost = isMax ? 0 : meta.costs[currentTier];
        const rate = isMax ? 0 : meta.rates[currentTier];
        const nextTier = isMax ? 5 : currentTier + 1;
        const playerCoins = this.game.coins || 0;
        const canAfford = !isMax && playerCoins >= cost;

        const bDef_cur = ATTACHMENT_DEFS[`${slot}_t${currentTier}`] || {};
        const bDef_nxt = ATTACHMENT_DEFS[`${slot}_t${nextTier}`] || {};

        // Tạo stat comparison rows có hiệu ứng nhấp nháy chỉ số
        const statRows = this.th_buildPartStatComparison(slot, bDef_cur, bDef_nxt, isMax, lastResult);

        // Khung backdrop mờ để đóng khi click ra ngoài
        const bay = document.querySelector('.th_tactical-workbench-bay');
        let backdrop = document.getElementById('th_part_popup_backdrop');
        if (!backdrop && bay) {
            backdrop = document.createElement('div');
            backdrop.className = 'th_part-popup-backdrop';
            backdrop.id = 'th_part_popup_backdrop';
            backdrop.onclick = (e) => {
                e.stopPropagation();
                this.th_closePartPopup();
            };
            bay.appendChild(backdrop);
        }
        if (backdrop) {
            requestAnimationFrame(() => backdrop.classList.add('th_visible'));
        }

        // Tạo banner thông báo kết quả nâng cấp nếu có
        let bannerHtml = '';
        if (lastResult) {
            if (lastResult.success) {
                bannerHtml = `<div class="th_popup-result-banner th_result-success">NÂNG CẤP THÀNH CÔNG · ĐÃ ĐẠT CẤP T${currentTier}</div>`;
            } else {
                const lostCost = lastResult.cost ? lastResult.cost.toLocaleString() : cost.toLocaleString();
                bannerHtml = `<div class="th_popup-result-banner th_result-fail">NÂNG CẤP THẤT BẠI · CẤP ĐỘ GIỮ NGUYÊN (-${lostCost} VÀNG)</div>`;
            }
        }

        let popup = document.getElementById('th_part_popup');
        const isNewPopup = !popup;
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'th_part-upgrade-popup';
            popup.id = 'th_part_popup';
            if (bay) bay.appendChild(popup);
        }

        popup.innerHTML = `
            <div class="th_popup-header">
                <span class="th_popup-title">${meta.label}</span>
                <span class="th_popup-tier tier-${currentTier}">T${currentTier}${!isMax ? ` → T${nextTier}` : ' MAX'}</span>
                <button class="th_popup-close" id="th_popup_close_btn" title="Đóng cửa sổ">✕</button>
            </div>
            ${bannerHtml}
            <div class="th_popup-stats">
                ${statRows}
            </div>
            ${!isMax ? `
            <div class="th_popup-cost">
                <span class="th_popup-cost-label">CHI PHÍ</span>
                <span class="th_popup-cost-value" style="color:${canAfford ? '#ffd700' : '#ff4444'}">${cost.toLocaleString()} VÀNG</span>
                <span class="th_popup-rate-label">TỶ LỆ</span>
                <span class="th_popup-rate-value" style="color:${rate >= 0.8 ? '#00F0FF' : rate >= 0.6 ? '#ffd700' : '#ff6b35'}">${Math.round(rate * 100)}%</span>
            </div>
            <div class="th_popup-wallet">
                <span class="th_popup-wallet-label">VÀNG HIỆN CÓ</span>
                <span class="th_popup-wallet-value" style="color:${canAfford ? '#ffd700' : '#ff6b6b'}">${playerCoins.toLocaleString()} VÀNG</span>
            </div>
            <button class="th_popup-upgrade-btn${canAfford ? '' : ' th_disabled'}" id="th_part_upgrade_btn" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? `NÂNG CẤP T${currentTier} → T${nextTier}` : 'KHÔNG ĐỦ VÀNG'}
            </button>
            ` : `
            <div class="th_popup-maxed">ĐÃ ĐẠT CẤP TỐI ĐA (MAX)</div>
            `}
        `;

        // Gắn sự kiện đóng popup
        document.getElementById('th_popup_close_btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.th_closePartPopup();
        });

        // Gắn sự kiện nâng cấp
        const upgradeBtn = document.getElementById('th_part_upgrade_btn');
        if (upgradeBtn && !isMax && canAfford) {
            upgradeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.th_isUpgradingPart) return;
                this.th_isUpgradingPart = true;

                // Thực hiện nâng cấp trong logic game
                const result = this.game.th_upgradePart(weaponId, slot);

                // Cập nhật dữ liệu danh sách và giao diện súng
                this.th_renderUpgradeWeaponList();
                this.th_syncUpgradeUI();
                this.game.updateCoinsUI?.();

                // Hiệu ứng phản hồi ánh sáng trên bệ nâng cấp
                if (bay) {
                    bay.classList.remove('th_bay-success-flash', 'th_bay-fail-flash');
                    void bay.offsetWidth;
                    bay.classList.add(result.success ? 'th_bay-success-flash' : 'th_bay-fail-flash');
                    setTimeout(() => bay.classList.remove('th_bay-success-flash', 'th_bay-fail-flash'), 700);
                }

                // Hiệu ứng hạt ánh sáng bung nở nếu thành công
                if (result.success) {
                    this.th_createSparksEffect(popup);
                }

                // DUY TRÌ POPUP VÀ CẬP NHẬT DỮ LIỆU ĐỂ NGƯỜI CHƠI CÓ THỂ TIẾP TỤC NÂNG CẤP
                this.th_showPartPopup(weaponId, slot, result);

                setTimeout(() => {
                    this.th_isUpgradingPart = false;
                }, 220);
            });
        }

        // Kích hoạt animation rung lắc hoặc hào quang
        popup.classList.remove('th_popup-success-anim', 'th_popup-fail-shake');
        if (lastResult) {
            void popup.offsetWidth; // ép reflow để kích hoạt lại animation
            if (lastResult.success) {
                popup.classList.add('th_popup-success-anim');
            } else {
                popup.classList.add('th_popup-fail-shake');
            }
            setTimeout(() => {
                popup.classList.remove('th_popup-success-anim', 'th_popup-fail-shake');
            }, 550);
        }

        if (isNewPopup) {
            requestAnimationFrame(() => popup.classList.add('th_popup-visible'));
        }
    }

    // Hiệu ứng hạt ánh sáng bung nở khi nâng cấp thành công
    th_createSparksEffect(popup) {
        if (!popup) return;
        const count = 12;
        const colors = ['#ffd079', '#10b981', '#34d399', '#fef08a', '#6ee7b7'];
        for (let i = 0; i < count; i++) {
            const spark = document.createElement('div');
            spark.className = 'th_spark-particle';
            const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
            const dist = 55 + Math.random() * 65;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            spark.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            spark.style.left = '50%';
            spark.style.top = '45%';
            spark.style.boxShadow = `0 0 8px ${spark.style.backgroundColor}`;
            popup.appendChild(spark);
            setTimeout(() => spark.remove(), 680);
        }
    }

    th_buildPartStatComparison(slot, cur, nxt, isMax, lastResult = null) {
        const rows = [];
        if (slot === 'barrel') {
            rows.push({ label: 'Sát thương', cur: `+${cur.flatDmg || 0}`, nxt: isMax ? 'MAX' : `+${nxt.flatDmg || 0}`, positive: true });
            rows.push({ label: 'Tầm bắn', cur: `+${Math.round((cur.rangeBonusPct || 0) * 100)}%`, nxt: isMax ? 'MAX' : `+${Math.round((nxt.rangeBonusPct || 0) * 100)}%`, positive: true });
        } else if (slot === 'optic') {
            rows.push({ label: 'Crit Chance', cur: `+${Math.round((cur.critChance || 0) * 100)}%`, nxt: isMax ? 'MAX' : `+${Math.round((nxt.critChance || 0) * 100)}%`, positive: true });
            rows.push({ label: 'Bạo kích', cur: `+${(cur.critDmgMod || 0).toFixed(2)}x`, nxt: isMax ? 'MAX' : `+${(nxt.critDmgMod || 0).toFixed(2)}x`, positive: true });
        } else if (slot === 'grip') {
            rows.push({ label: 'Giảm giật', cur: `-${Math.round((cur.recoilReduction || 0) * 100)}%`, nxt: isMax ? 'MAX' : `-${Math.round((nxt.recoilReduction || 0) * 100)}%`, positive: true });
            rows.push({ label: 'Gom đạn', cur: `-${Math.round((cur.spreadReduction || 0) * 100)}%`, nxt: isMax ? 'MAX' : `-${Math.round((nxt.spreadReduction || 0) * 100)}%`, positive: true });
        } else if (slot === 'magazine') {
            rows.push({ label: 'Băng đạn', cur: `+${Math.round((cur.magBonusPct || 0) * 100)}%`, nxt: isMax ? 'MAX' : `+${Math.round((nxt.magBonusPct || 0) * 100)}%`, positive: true });
            rows.push({ label: 'Nạp nhanh', cur: `-${Math.round((cur.reloadSpeedBonus || 0) * 100)}%`, nxt: isMax ? 'MAX' : `-${Math.round((nxt.reloadSpeedBonus || 0) * 100)}%`, positive: true });
        }

        let flashClass = '';
        if (lastResult) {
            flashClass = lastResult.success ? ' th_stat-boost-flash' : ' th_stat-fail-flash';
        }

        return rows.map(r => `
            <div class="th_popup-stat-row${flashClass}">
                <span class="th_stat-label">${r.label}</span>
                <span class="th_stat-cur">${r.cur}</span>
                <span class="th_stat-arrow">→</span>
                <span class="th_stat-nxt" style="color:${r.positive ? '#00F0FF' : '#ff6b35'}">${r.nxt}</span>
            </div>
        `).join('');
    }

    th_closePartPopup() {
        const popup = document.getElementById('th_part_popup');
        if (popup) popup.remove();
        const backdrop = document.getElementById('th_part_popup_backdrop');
        if (backdrop) backdrop.remove();
        document.querySelectorAll('.th_mod-slot').forEach(el => el.classList.remove('th_slot-selected'));
        this.th_activePopupSlot = null;
        this.th_isUpgradingPart = false;
    }


    getItem(id) {
        return BOMB_CONFIGS.find(b => b.id === id) || 
               MEDICAL_CONFIGS.find(m => m.id === id) || 
               WEAPON_CONFIGS.find(w => w.id === id) || 
               WEAPON_CONFIGS[0];
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
        this.th_closePartPopup();
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
            const currentSelected = this.selected || this.game.characterId || 'police';
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
        const charCfg = CHARACTER_CONFIGS[id];
        if (!charCfg) return;
        this.dialog.style.setProperty('--character-accent', charCfg.color || '#38bdf8');
        document.getElementById('character-name').textContent = charCfg.label;
        document.getElementById('character-subtitle').textContent = `${charCfg.tierName || 'CƠ BẢN'} · ${charCfg.subtitle}`;
        
        const passiveText = charCfg.passives?.passiveDesc ? `[NỘI TẠI]: ${charCfg.passives.passiveDesc}` : '';
        const skillText = charCfg.activeSkill ? `[KỸ NĂNG Q - ${charCfg.activeSkill.name.toUpperCase()}]: ${charCfg.activeSkill.description} (${charCfg.activeSkill.cooldown}s)` : '';
        document.getElementById('character-description').textContent = `${charCfg.description} | ${passiveText} | ${skillText}`;
        document.getElementById('character-watermark').textContent = charCfg.label;

        const weapon = this.getItem(this.weaponId);
        const baseHp = 100 + (charCfg.passives?.healthBonus || 0);
        const baseShield = 100 + (charCfg.passives?.armorBonus || 0);
        const speedVal = (7.5 * (charCfg.passives?.speedMult || 1.0)).toFixed(1);
        document.getElementById('character-health').textContent = baseHp;
        document.getElementById('character-shield').textContent = baseShield;
        document.getElementById('character-damage').textContent = weapon.damage || 30;
        document.getElementById('character-speed').textContent = speedVal;
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
        this.renderDetails();
        this.load(id);
    }

    syncSelection() {
        for (const card of this.cards) {
            const id = card.dataset.previewCharacter;
            const isUnlocked = isCharacterUnlocked(id);
            const isEquipped = (id === this.game.characterId);
            const charCfg = CHARACTER_CONFIGS[id];
            card.classList.toggle('previewing', id === this.selected);
            card.classList.toggle('locked', !isUnlocked);
            card.setAttribute('aria-pressed', String(id === this.selected));
            const statusEl = card.querySelector('.character-card-status');
            if (statusEl) {
                if (isEquipped) statusEl.textContent = '✓ ĐANG DÙNG';
                else if (isUnlocked) statusEl.textContent = 'ĐÃ SỞ HỮU';
                else statusEl.textContent = `${(charCfg?.price || 0).toLocaleString()} VÀNG`;
            }
            card.classList.toggle('equipped', isEquipped);
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

            // Cập nhật Cấp độ hiển thị theo trung bình các bộ phận
            const cardParts = th_getWeaponParts(id);
            const cardTier = Math.floor((cardParts.optic + cardParts.barrel + cardParts.grip + cardParts.magazine) / 4);
            const tierBadge = card.querySelector('.weapon-tier-badge');
            if (tierBadge) {
                tierBadge.className = `weapon-tier-badge tier-${cardTier}`;
                tierBadge.textContent = `CẤP ${cardTier}`;
            }

            const statusEl = card.querySelector('.weapon-card-status') || card.querySelector('.character-card-status');
            if (statusEl) {
                if (item.slotType === 'medical') {
                    const count = (this.game.weapons && this.game.weapons.inventory) ? (this.game.weapons.inventory[item.id] || 0) : 0;
                    statusEl.textContent = count > 0 ? `CÓ: ${count} (${item.price} V)` : `${item.price.toLocaleString()} VÀNG`;
                } else if (isEquippedPrimary) statusEl.textContent = '✓ SÚNG CHÍNH';
                else if (isEquippedSecondary) statusEl.textContent = '✓ SÚNG PHỤ';
                else if (isEquippedBomb1) statusEl.textContent = '✓ BOM 1';
                else if (isEquippedBomb2) statusEl.textContent = '✓ BOM 2';
                else if (isUnlocked) statusEl.textContent = 'ĐÃ SỞ HỮU';
                else statusEl.textContent = `${item.price.toLocaleString()} VÀNG`;
            }
        }

        const unlockedCount = this.allItems.filter(w => {
            if (w.slotType === 'medical') {
                const count = (this.game.weapons && this.game.weapons.inventory) ? (this.game.weapons.inventory[w.id] || 0) : 0;
                return count > 0;
            }
            return this.game.isWeaponUnlocked(w.id);
        }).length;
        const countEl = document.getElementById('armory-unlocked-count');
        if (countEl) countEl.textContent = `SỞ HỮU: ${unlockedCount}/${this.allItems.length}`;
        this.filterWeapons();

        const curItem = this.getItem(this.weaponId);
        const isMedical = curItem.slotType === 'medical';
        const isWeaponUnlocked = isMedical ? true : this.game.isWeaponUnlocked(this.weaponId);


        // Cập nhật badge trạng thái ở bảng mini panel dưới chân nhân vật
        const statusBadge = document.getElementById('armory-status-badge');
        if (statusBadge) {
            statusBadge.textContent = isMedical
                ? `KHO: ${(this.game.weapons?.inventory?.[curItem.id] || 0)} CÁI`
                : (isWeaponUnlocked ? 'ĐÃ SỞ HỮU' : `${curItem.price.toLocaleString()} VÀNG`);
            statusBadge.classList.toggle('locked', !isWeaponUnlocked);
        }

        if (this.mode === 'weapons') {
            if (isMedical) {
                // Vật phẩm y tế: hiển thị nút Mua Tiếp Tế
                if (this.armoryActionGroup) this.armoryActionGroup.style.display = 'none';
                this.confirm.style.display = '';
                const canBuy = (this.game.coins >= curItem.price);
                this.confirm.textContent = `MUA TIẾP TẾ (+1) [${curItem.price.toLocaleString()} VÀNG]`;
                this.confirm.disabled = this.locked() || !canBuy;
                this.confirm.classList.remove('equipped');
            } else if (!isWeaponUnlocked) {
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
            const charCfg = CHARACTER_CONFIGS[this.selected] || CHARACTER_CONFIGS.police;
            const isUnlocked = isCharacterUnlocked(this.selected);
            const equipped = (this.selected === this.game.characterId);

            if (!isUnlocked) {
                const canBuy = (this.game.coins >= charCfg.price);
                this.confirm.textContent = `MUA NHÂN VẬT [${charCfg.price.toLocaleString()} VÀNG]`;
                this.confirm.classList.remove('equipped');
                this.confirm.classList.add('buy-mode');
                this.confirm.disabled = this.locked() || !canBuy;
            } else {
                this.confirm.classList.remove('buy-mode');
                this.confirm.textContent = this.locked() ? 'TRẬN ĐẤU ĐÃ BẮT ĐẦU' : equipped ? '✓ ĐANG SỬ DỤNG' : 'CHỌN NHÂN VẬT';
                this.confirm.classList.toggle('equipped', equipped);
                this.confirm.disabled = this.locked() || !this.entries.get(this.selected) || equipped;
            }
        }

        this.syncLoadoutUI();
        this.game.updateCoinsUI?.();
    }

    buyCharacter(id) {
        const charCfg = CHARACTER_CONFIGS[id];
        if (!charCfg || isCharacterUnlocked(id)) return;
        if (this.game.coins < charCfg.price) {
            this.game.ui?.showPickupAlert?.('BẠN KHÔNG ĐỦ VÀNG!');
            return;
        }

        this.game.coins -= charCfg.price;
        localStorage.setItem('arena_player_coins', this.game.coins.toString());
        unlockCharacter(id);
        this.game.saveProgress?.(true);

        this.selected = id;
        this.game.selectCharacter(id);
        this.syncSelection();
        this.renderDetails();
        this.game.updateCoinsUI?.();
        this.game.ui?.showPickupAlert?.(`ĐÃ MỞ KHÓA: ${charCfg.label}!`);
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
                match = (item.isBomb || item.slotType === 'bomb' || item.slotType === 'medical');
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
            if (currentCat === 'other') return item.isBomb || item.slotType === 'bomb' || item.slotType === 'medical';
            return true;
        });
        const unlockedCatCount = catItems.filter(w => {
            if (w.slotType === 'medical') {
                const count = (this.game.weapons && this.game.weapons.inventory) ? (this.game.weapons.inventory[w.id] || 0) : 0;
                return count > 0;
            }
            return this.game.isWeaponUnlocked(w.id);
        }).length;
        const countEl = document.getElementById('armory-unlocked-count');
        if (countEl) countEl.textContent = `SỞ HỮU: ${unlockedCatCount}/${catItems.length}`;
    }

    setMode(mode) {
        if (mode !== 'upgrade') {
            this.th_closePartPopup();
        }
        this.mode = mode;
        this.dialog.classList.toggle('weapon-mode', mode === 'weapons');
        this.dialog.classList.toggle('upgrade-mode', mode === 'upgrade');
        this.dialog.querySelectorAll('[data-showroom-tab]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.showroomTab === mode));
        });

        const titles = { weapons: 'KHO VŨ KHÍ', characters: 'NHÂN VẬT', upgrade: 'NÂNG CẤP VŨ KHÍ' };
        document.getElementById('character-screen-title').textContent = titles[mode] || 'NHÂN VẬT';

        const subAction = document.getElementById('character-action-sub') || this.dialog.querySelector('.character-action>span');
        if (subAction) {
            const subs = {
                weapons: 'Trang bị vũ khí để mang vào trận tiếp theo',
                characters: 'Chọn chiến binh cho trận đấu tiếp theo',
                upgrade: 'Cường hóa và ép nguyên tố cho vũ khí'
            };
            subAction.textContent = subs[mode] || subs.characters;
        }

        // Kích hoạt tính lại kích thước canvas để nhân vật 3D hiển thị cân đối trong khung mới
        this.width = 0;
        this.height = 0;

        const charId = this.selected || this.game.characterId || 'police';
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
        } else if (mode === 'upgrade') {
            // Tab nâng cấp: render danh sách súng và chuẩn bị khung 3D vũ khí
            this.th_wpWidth = 0;
            this.th_wpHeight = 0;
            this.th_renderUpgradeWeaponList();
            // Tự động chọn súng đang trang bị nếu chưa có gì được chọn
            if (!this.th_upgradeWeaponId) {
                const firstUnlocked = WEAPON_CONFIGS.find(w => this.game.isWeaponUnlocked(w.id) && w.slotType !== 'secondary');
                if (firstUnlocked) this.th_selectUpgradeWeapon(firstUnlocked.id);
                else this.th_syncUpgradeUI();
            } else {
                this.th_syncUpgradeUI();
            }
        } else {
            this.preview(charId);
            this.syncSelection();
        }
    }


    attachGun(entry) {
        entry.gun?.removeFromParent();
        const weapon = this.getItem(this.weaponId);
        if (!weapon || weapon.slotType === 'medical') return;
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

        // Định vị súng đúng vị trí bàn tay: nhân vật Kenney Blocky v2 có cánh tay dọc theo trục Y
        if (hand.geometry && !hand.geometry.boundingBox) {
            hand.geometry.computeBoundingBox();
        }
        const isV2Blocky = hand.geometry && (hand.geometry.boundingBox?.min.y < -0.5);
        gun.userData.handOffset = isV2Blocky ? new THREE.Vector3(-0.20, -0.72, 0.02) : new THREE.Vector3(-0.24, -0.05, 0.02);

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

        const curChar = this.selected || this.game.characterId || 'police';
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
        const parts = th_getWeaponParts(item.id);
        const currentTier = Math.floor((parts.optic + parts.barrel + parts.grip + parts.magazine) / 4);

        if (nameEl) nameEl.textContent = item.name;
        if (catEl) catEl.textContent = `${item.category} · CẤP ${currentTier}`;

        if (item.isBomb) {
            if (dmgEl) dmgEl.textContent = item.damage;
            if (rateEl) rateEl.textContent = '0.7';
            if (ammoEl) ammoEl.textContent = `${item.count} quả`;
            if (reloadEl) reloadEl.textContent = `${item.fuseTime || 0.65}s`;
            if (rangeEl) rangeEl.textContent = `${item.throwRange || 14}m`;
        } else if (item.slotType === 'medical') {
            const count = (this.game.weapons && this.game.weapons.inventory) ? (this.game.weapons.inventory[item.id] || 0) : 0;
            if (dmgEl) dmgEl.textContent = item.healAmount ? `+${item.healAmount} HP` : `+${item.healPercent || 100}% HP`;
            if (rateEl) rateEl.textContent = `${item.useTime || 3}s`;
            if (ammoEl) ammoEl.textContent = `${count} cái`;
            if (reloadEl) reloadEl.textContent = item.healShield ? `+${item.healShield} Khiên` : '-';
            if (rangeEl) rangeEl.textContent = item.speedBoostDuration ? `Chạy +25% (${item.speedBoostDuration}s)` : '-';
        } else {
            const stats = this.game.weapons ? this.game.weapons.getModifiedStats(item) : null;
            const finalDmg = stats ? stats.damage : item.damage;
            const finalMag = stats ? stats.magSize : item.magSize;
            const finalReload = stats ? stats.reloadTime : item.reloadTime;
            const finalRange = stats ? stats.maxRange : (item.range || 45);

            if (dmgEl) dmgEl.textContent = item.pellets > 1 ? `${finalDmg} × ${item.pellets}` : finalDmg;
            if (rateEl) rateEl.textContent = (1 / item.fireRate).toFixed(1);
            if (ammoEl) ammoEl.textContent = finalMag;
            if (reloadEl) reloadEl.textContent = `${finalReload.toFixed(1)}s`;
            if (rangeEl) rangeEl.textContent = `${finalRange}m`;
        }

        this.syncSelection();
    }

    render(delta) {
        if (!this.dialog.open) return;
        if (this.mode === 'upgrade') {
            this.th_renderUpgradeWeapon3D(delta);
            return;
        }
        if (!this.renderer) return;
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
        const currentSelected = this.selected || this.game.characterId || 'police';
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
