import * as THREE from 'three';
import { sounds } from '../../audio/audio.js?v=58';
import { HealthBar3D } from '../../rendering/healthbar.js';
import { CHARACTER_CONFIGS, normalizeCharacter } from './characters.js';
import { AirdropDropEntity } from '../loot/looting.js';

const _tempPlayerBox = new THREE.Box3();
const _tempBoxMin = new THREE.Vector3();
const _tempBoxMax = new THREE.Vector3();
const _tempPlayerHitPoint = new THREE.Vector3();

// Bộ nạp và cache texture hiệu ứng hạt từ Kenney Particle Pack (bao gồm thư mục Rotated/)
const _skillTextureLoader = new THREE.TextureLoader();
const _skillTextureCache = new Map();

function getSkillTexture(relativePath) {
    if (!_skillTextureCache.has(relativePath)) {
        const tex = _skillTextureLoader.load(relativePath);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        _skillTextureCache.set(relativePath, tex);
    }
    return _skillTextureCache.get(relativePath);
}

// Helper: Tạo đĩa decal hiệu ứng trên mặt đất sát sàn đấu
function createGroundParticleDecal(position, size, texturePath, colorHex = 0xffffff, opacity = 0.9, blending = THREE.AdditiveBlending) {
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        map: getSkillTexture(texturePath),
        color: colorHex,
        transparent: true,
        opacity: opacity,
        blending: blending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y = 0.04;
    return mesh;
}

// Helper: Tạo cụm tia năng lượng đa hướng thẳng đứng (Cross-Quad Beam)
function createCrossQuadPillar(width, height, texturePath, colorHex = 0xffffff, opacity = 0.9) {
    const group = new THREE.Group();
    const planeGeo = new THREE.PlaneGeometry(width, height);
    // Neo chân cột tại y = 0
    planeGeo.translate(0, height / 2, 0);

    const mat = new THREE.MeshBasicMaterial({
        map: getSkillTexture(texturePath),
        color: colorHex,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const p1 = new THREE.Mesh(planeGeo, mat);
    const p2 = new THREE.Mesh(planeGeo, mat.clone());
    p2.rotation.y = Math.PI / 2;

    group.add(p1);
    group.add(p2);
    return group;
}

// Helper: Tạo dải tia sét 3D nối 2 điểm A và B với bề dày, xoay UV chuẩn và lõi phát quang
function createOrientedLightningBeam(p1, p2, width = 1.35, texturePath = 'assets/particles/Rotated/spark_05_rotated.png', colorHex = 0x00f0ff) {
    const group = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.01) return group;

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    group.position.copy(mid);

    // 1. Dải hào quang phóng điện chính ngoài cùng
    const geo = new THREE.PlaneGeometry(width, len);
    // Xoay UV map 90 độ để tia sét nằm ngang trong spark_05_rotated.png chạy dọc xuôi theo đường nối
    const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        uvs.setXY(i, v, 1 - u);
    }
    uvs.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
        map: getSkillTexture(texturePath),
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const mesh1 = new THREE.Mesh(geo, mat);
    const mesh2 = new THREE.Mesh(geo, mat.clone());
    mesh2.rotation.y = Math.PI / 2;
    group.add(mesh1, mesh2);

    // 2. Lõi tia điện cực sáng trắng (Plasma Core Beam) ở giữa
    const coreGeo = new THREE.PlaneGeometry(width * 0.42, len);
    const coreUvs = coreGeo.attributes.uv;
    for (let i = 0; i < coreUvs.count; i++) {
        const u = coreUvs.getX(i);
        const v = coreUvs.getY(i);
        coreUvs.setXY(i, v, 1 - u);
    }
    coreUvs.needsUpdate = true;

    const coreMat = new THREE.MeshBasicMaterial({
        map: getSkillTexture(texturePath),
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const coreMesh1 = new THREE.Mesh(coreGeo, coreMat);
    const coreMesh2 = new THREE.Mesh(coreGeo, coreMat.clone());
    coreMesh2.rotation.y = Math.PI / 2;
    group.add(coreMesh1, coreMesh2);

    // Định hướng dải quad theo vector nối 2 điểm
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    group.quaternion.copy(quat);

    return group;
}

export class PlayerController {
    constructor(camera, domElement, arena, weaponSystem, bindInput = true, characterId = 'police') {
        this.camera = camera;
        this.domElement = domElement;
        this.arena = arena;
        this.weapons = weaponSystem;
        this.characterId = normalizeCharacter(characterId);
        this.loader = null;
        this.scene = null;

        // Player transform & physics
        this.position = new THREE.Vector3(0, 0, 8);
        this.velocity = new THREE.Vector3();
        this.speed = 7.5;
        this.jumpForce = 9.2;
        this.gravity = 24.0;
        this.isGrounded = true;
        this.radius = 0.55;
        this.height = 1.6;

        // Stats
        this.maxHealth = 100;
        this.health = 100;
        this.maxShield = 100;
        this.shield = 100;
        this.isDead = false;
        this.cooperative = false;
        this.isDowned = false;
        this.invulnerability = 0;
        this.damageRevision = 0;
        this.shieldRegenDelay = 4.0;
        this.shieldRegenTimer = 0;
        this.shieldRegenRate = 25;
        this.developerMode = false;

        // Chi so ky nang nhan vat (Active Skill & Passives)
        this.activeSkillCooldownTimer = 0;
        this.activeSkillMaxCooldown = 15;
        this.activeSkillDurationTimer = 0;
        this.activeSkillEffect = null;
        this.recoilMult = 1.0;
        this.dodgeDistMult = 1.0;
        this.dodgeCdMult = 1.0;
        this.critChanceBonus = 0;
        this.damageMult = 1.0;
        this.damageTakenMult = 1.0;
        this.penetrationBonus = 0;
        this.goldBonus = 0;
        this.explosiveBonus = 0;
        this.passiveRegenRate = 0;
        this.latestEnemies = null;

        // Trạng thái các kỹ năng độc đáo
        this.riotChargeTimer = 0;
        this.bulletFrenzyTimer = 0;
        this.shadowVeilTimer = 0;
        this.assassinCritReady = false;
        this.activeBeacons = [];
        this.activeTurrets = [];
        this.activeVortexes = [];
        this.activeGrenades = [];

        // Dodge / Dash
        this.dodgeCooldown = 0;
        this.isDodging = false;
        this.dodgeTimer = 0;
        this.dodgeDir = new THREE.Vector3();

        // Fixed elevated view; aiming never changes the camera orientation.
        this.cameraYaw = 0;
        this.cameraOffset = new THREE.Vector3(0, 26, 18);
        this.cameraFocus = new THREE.Vector3(this.position.x, 0.7, this.position.z);
        this.aimYaw = Math.PI;
        this.aimPoint = this.position.clone().add(new THREE.Vector3(0, 0.85, -10));
        this.pointer = new THREE.Vector2(0, 0.35);
        this.pointerScreen = new THREE.Vector2(window.innerWidth / 2, window.innerHeight * 0.325);
        this.reviveRequested = false;
        this.toggleBotRequested = false;
        this.isADS = false;
        this.isSearching = false;
        this.th_isRadialMenuOpen = false;
        this.th_toggleADS = false;

        // Trạng thái gục (Downed / Bleed-out) và cứu sống
        this.isDowned = false;
        this.bleedOutTimer = 30.0;
        this.maxBleedOutTime = 30.0;
        this.reviveProgress = 0.0;
        this.reviveTimeRequired = 3.5;
        this.isBeingRevived = false;

        // Trạng thái hiệu ứng chiến trường (Khói tàng hình & Tăng tốc)
        this.isInSmoke = false;
        this.speedBoostTimer = 0;
        this.speedBoostFactor = 1.0;

        // Core Gunplay: Cursor Kickback & Screen Shake Trauma
        this.cursorKick = new THREE.Vector2(0, 0);
        this.screenShakeTrauma = 0;
        this.painTimer = 0;
        this.hydration = 100;

        // Input state
        this.keys = {};
        this.mouseButtons = { left: false, right: false };
        this.inputEnabled = false;
        this.isBackpackOpen = false;
        this.isOverweight = false; // Trạng thái quá tải balo (Overweight)
        this.stepTimer = 0;

        // Trạng thái theo dõi đồng đội khi chết (Spectator Mode)
        this.isSpectating = false;
        this.spectateTarget = null;
        this.spectateIndex = 0;

        // 3D Model & Animation
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.holdingAction = null;
        this.handBone = null;
        this.healthBar = null;

        // Chỉ báo trực quan khi cầm và ném bom chiến thuật
        // Vòng tròn 1: Giới hạn ném bom quanh người chơi (bán kính 14m)
        const throwRangeGeo = new THREE.RingGeometry(13.85, 14.15, 64);
        throwRangeGeo.rotateX(-Math.PI / 2);
        const throwRangeMat = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        this.throwRangeMesh = new THREE.Mesh(throwRangeGeo, throwRangeMat);
        this.throwRangeMesh.position.y = 0.05;
        this.throwRangeMesh.visible = false;
        this.arena.scene.add(this.throwRangeMesh);

        // Vòng tròn 2: Phạm vi bom nổ tại vị trí chuột (bán kính 5.5m - 6.5m)
        const blastRadiusGeo = new THREE.RingGeometry(5.35, 5.65, 48);
        blastRadiusGeo.rotateX(-Math.PI / 2);
        const blastRadiusMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        this.blastRadiusMesh = new THREE.Mesh(blastRadiusGeo, blastRadiusMat);
        this.blastRadiusMesh.position.y = 0.06;
        this.blastRadiusMesh.visible = false;
        this.arena.scene.add(this.blastRadiusMesh);

        // Mặt trong mờ của vòng tròn nổ
        const blastInnerGeo = new THREE.CircleGeometry(5.35, 48);
        blastInnerGeo.rotateX(-Math.PI / 2);
        const blastInnerMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
        });
        this.blastInnerMesh = new THREE.Mesh(blastInnerGeo, blastInnerMat);
        this.blastInnerMesh.position.y = 0.055;
        this.blastInnerMesh.visible = false;
        this.arena.scene.add(this.blastInnerMesh);

        this.isAimingBomb = false;
        this.clampedBombTarget = new THREE.Vector3();
        this._lastEnemiesRef = [];

        if (bindInput) this.initInput();
    }

    initInput() {
        this._radialPressTime = 0;

        window.addEventListener('keydown', (e) => {
            if (!this.inputEnabled || e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;

            // Nếu người chơi đã chết: Cho phép phím A/D hoặc mũi tên trái/phải để chuyển đổi góc nhìn theo dõi đồng đội
            if (this.isDead) {
                if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                    e.preventDefault();
                    this.switchSpectatorTarget(-1);
                    return;
                }
                if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                    e.preventDefault();
                    this.switchSpectatorTarget(1);
                    return;
                }
                return;
            }

            // Nếu Radial Menu đang mở:
            if (this.th_isRadialMenuOpen) {
                // Nhấn phím 1, 2, 3, 4 kích hoạt tức thì action tương ứng
                if (e.code === 'Digit1') {
                    e.preventDefault();
                    (this.ui || window.game?.ui)?.executeRadialAction('1', this, this.weapons);
                    return;
                }
                if (e.code === 'Digit2') {
                    e.preventDefault();
                    (this.ui || window.game?.ui)?.executeRadialAction('2', this, this.weapons);
                    return;
                }
                if (e.code === 'Digit3') {
                    e.preventDefault();
                    (this.ui || window.game?.ui)?.executeRadialAction('3', this, this.weapons);
                    return;
                }
                if (e.code === 'Digit4') {
                    e.preventDefault();
                    (this.ui || window.game?.ui)?.executeRadialAction('4', this, this.weapons);
                    return;
                }
                // Nhấn Escape hoặc Alt lần 2 để đóng menu
                if (e.code === 'Escape' || e.code === 'AltLeft' || e.code === 'AltRight') {
                    e.preventDefault();
                    (this.ui || window.game?.ui)?.closeRadialMenuOnly();
                    return;
                }
            }

            // Phím [Alt]: Mở Bánh xe thao tác nhanh thông minh (Smart Dual-Mode)
            if (e.code === 'AltLeft' || e.code === 'AltRight') {
                e.preventDefault();
                if (!e.repeat) {
                    this._radialPressTime = performance.now();
                    this.th_openRadialMenu();
                }
                return;
            }

            if (this.isBackpackOpen) return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.weapons.cancelReload();
                this.tryDodge();
            }
            this.keys[e.code] = true;

            if (e.code === 'KeyR') {
                this.weapons.reload();
            }
            // Điều khiển vũ khí theo chuẩn PUBG & Loadout:
            // [1] Súng chính, [2] Súng phụ, [3] Bom 1, [4] Bom 2, [5] Sơ cứu Medkit, [V] Dao cận chiến
            if (e.code === 'Digit1') this.weapons.switchWeapon(0, this);
            if (e.code === 'Digit2') this.weapons.switchWeapon(1, this);
            if (e.code === 'Digit3') this.weapons.switchWeapon(2, this);
            if (e.code === 'Digit4') this.weapons.switchWeapon(3, this);
            if (e.code === 'Digit5') this.weapons.startMedkitUse(this);
            if (e.code === 'KeyV') this.weapons.switchWeapon(4, this);

            // Kích hoạt Kỹ năng chủ động (chỉ phím Q) và Cứu đồng đội khi đứng gần (phím E)
            if (e.code === 'KeyQ') this.tryActiveSkill();
            if (e.code === 'KeyE') {
                const hasDownedNearby = window.game?.coopPlayers?.some(p => p !== this && p.isDowned && p.position.distanceTo(this.position) < 3.5);
                if (hasDownedNearby) {
                    this.reviveRequested = true;
                }
            }
            if (e.code === 'KeyP') this.toggleBotRequested = true;
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'AltLeft' || e.code === 'AltRight') {
                e.preventDefault();
                const pressDuration = performance.now() - (this._radialPressTime || 0);
                // Giữ phím > 180ms: Hold Mode (kích hoạt ngay khi nhả)
                // Nhấp nhanh <= 180ms: Tap Mode (giữ menu mở để người chơi rê chuột hoặc bấm số 1-4)
                if (pressDuration > 180) {
                    this.th_closeRadialMenu();
                }
            }
            this.keys[e.code] = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (!this.inputEnabled) return;
            // Chuột giữa (MMB): Kích hoạt Radial Menu
            if (e.button === 1) {
                e.preventDefault();
                this._radialPressTime = performance.now();
                if (this.th_isRadialMenuOpen) {
                    (this.ui || window.game?.ui)?.closeRadialMenuOnly();
                } else {
                    this.th_openRadialMenu();
                }
                return;
            }
            // Khi Radial Menu đang mở, nếu click chuột trái (LMB):
            if (this.th_isRadialMenuOpen && e.button === 0) {
                const ui = this.ui || window.game?.ui;
                if (ui?._activeRadialSector) {
                    e.preventDefault();
                    ui.executeRadialAction(ui._activeRadialSector, this, this.weapons);
                    return;
                }
            }
            if (e.target !== this.domElement) return;

            // Nếu người chơi đã chết: Cho phép nhấp chuột trái / phải để chuyển đổi người xem
            if (this.isDead) {
                if (e.button === 0) {
                    this.switchSpectatorTarget(1);
                } else if (e.button === 2) {
                    this.switchSpectatorTarget(-1);
                }
                return;
            }

            if (e.button === 0) this.mouseButtons.left = true;
            if (e.button === 2) this.mouseButtons.right = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                const pressDuration = performance.now() - (this._radialPressTime || 0);
                if (pressDuration > 180) {
                    this.th_closeRadialMenu();
                }
                return;
            }
            if (e.button === 0) {
                this.mouseButtons.left = false;
                sounds.stopContinuousFire?.();
                // Nếu đang giữ chuột ngắm ném bom -> Tiến hành ném bom khi nhả chuột
                if (this.isAimingBomb) {
                    this.isAimingBomb = false;
                    if (this.blastRadiusMesh) this.blastRadiusMesh.visible = false;
                    if (this.blastInnerMesh) this.blastInnerMesh.visible = false;
                    const origin = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                    this.weapons.throwBomb(origin, this.clampedBombTarget, this, this._lastEnemiesRef || []);
                }
            }
            if (e.button === 2) this.mouseButtons.right = false;
        });

        window.addEventListener('wheel', (e) => {
            if (!this.inputEnabled || this.th_isRadialMenuOpen) return;
            if (e.deltaY > 0) this.weapons.nextWeapon(this);
            else if (e.deltaY < 0) this.weapons.prevWeapon(this);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.th_isRadialMenuOpen) {
                const ui = this.ui || window.game?.ui;
                ui?.updateRadialMenuPointer(e.clientX, e.clientY);
            }
            const bounds = this.domElement.getBoundingClientRect();
            this.pointer.set((e.clientX - bounds.left) / bounds.width * 2 - 1,
                1 - (e.clientY - bounds.top) / bounds.height * 2);
            this.pointerScreen.set(e.clientX, e.clientY);
            this.pointerInCanvas = Math.abs(this.pointer.x) <= 1 && Math.abs(this.pointer.y) <= 1;
        });
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('blur', () => {
            if (this.th_isRadialMenuOpen) {
                (this.ui || window.game?.ui)?.closeRadialMenuOnly();
            }
            this.keys = {};
            this.mouseButtons = { left: false, right: false };
        });
    }

    th_openRadialMenu() {
        if (this.isDead || !this.inputEnabled) return;
        this.th_isRadialMenuOpen = true;
        const ui = this.ui || window.game?.ui;
        ui?.openRadialMenu(this, this.weapons);
    }

    th_closeRadialMenu() {
        if (!this.th_isRadialMenuOpen) return;
        const ui = this.ui || window.game?.ui;
        ui?.closeAndExecuteRadialMenu(this, this.weapons);
    }

    setInputEnabled(enabled) {
        this.inputEnabled = enabled;
        this.domElement.style.cursor = enabled ? 'none' : 'default';
        this.keys = {};
        this.mouseButtons = { left: false, right: false };
    }

    async loadModel(loader, scene, characterId = this.characterId) {
        this.characterId = normalizeCharacter(characterId);
        this.loader = loader;
        this.scene = scene;
        this.handBone = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.holdingAction = null;
        return new Promise((resolve) => {
            if (this.model) {
                this.model.removeFromParent();
                this.healthBar?.dispose();
                this.healthBar = null;
            }
            const config = CHARACTER_CONFIGS[this.characterId];
            loader.load(`assets/models/${config.modelFile}`, (gltf) => {
                this.model = gltf.scene;
                this.model.scale.set(1.7, 1.7, 1.7);
                this.model.position.copy(this.position);
                this.model.rotation.y = Math.PI;

                this.model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    if (child.name === 'arm-right') {
                        this.handBone = child;
                    }
                });
                if (!this.handBone) {
                    this.handBone = this.model.getObjectByName('hand-right')
                        || this.model.getObjectByName('hand')
                        || this.model;
                }

                scene.add(this.model);
                this.healthBar = new HealthBar3D(scene, { width: 1.35, offsetY: 2.35, color: 0x22e6a5 });

                // Setup Animation Mixer with separate aiming and locomotion layers
                this.mixer = new THREE.AnimationMixer(this.model);

                gltf.animations.forEach(clip => {
                    // Separate arm-right aiming animation from locomotion tracks
                    if (['idle', 'walk', 'sprint', 'jump'].includes(clip.name)) {
                        clip.tracks = clip.tracks.filter(track => !track.name.includes('arm-right'));
                    }
                    this.animations[clip.name] = this.mixer.clipAction(clip);
                });

                // Attach weapon to right arm
                if (this.handBone) {
                    this.weapons.attachToArm(this.handBone);
                }

                // Start holding-right animation so character holds weapon in firing position
                if (this.animations['holding-right']) {
                    this.holdingAction = this.animations['holding-right'];
                    this.holdingAction.play();
                }

                this.playAnimation('idle');
                resolve();
            }, undefined, () => resolve());
        });
    }

    setCharacter(characterId) {
        const next = normalizeCharacter(characterId);
        this.characterId = next;
        this.applyCharacterStats();
        if (this.loader && this.scene) return this.loadModel(this.loader, this.scene, next);
        return Promise.resolve();
    }

    applyCharacterStats() {
        const cfg = CHARACTER_CONFIGS[this.characterId] || CHARACTER_CONFIGS.police;
        const passives = cfg?.passives || {};
        this.maxHealth = 100 + (passives.healthBonus || 0);
        this.health = Math.min(this.health || this.maxHealth, this.maxHealth);
        this.maxShield = 100 + (passives.armorBonus || 0);
        this.shield = Math.min(this.shield || this.maxShield, this.maxShield);
        this.speed = 7.5 * (passives.speedMult || 1.0);
        this.recoilMult = passives.recoilMult || 1.0;
        this.dodgeDistMult = passives.dodgeDistMult || 1.0;
        this.dodgeCdMult = passives.dodgeCdMult || 1.0;
        this.critChanceBonus = passives.critChance || 0;
        this.damageMult = passives.damageMult || 1.0;
        this.damageTakenMult = passives.damageTakenMult || 1.0;
        this.penetrationBonus = passives.penetrationBonus || 0;
        this.goldBonus = passives.goldBonus || 0;
        this.explosiveBonus = passives.explosiveBonus || 0;
        this.passiveRegenRate = passives.regenRate || 0;
        this.shieldRegenRate = 25 * (passives.shieldRegenRate || 1.0);
    }


    showStrikeBeam(e) {
        if (e.beam) return;
        e.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.8, 45, 16), new THREE.MeshBasicMaterial({color: 0xff3355, transparent: true, opacity: 0.85}));
        e.beam.position.copy(e.position); e.beam.position.y = 22;
        this.scene.add(e.beam);
    }

    removeSkillEntity(e) {
        for (const root of [e.group || e.mesh, e.beam]) {
            if (!root) continue;
            this.scene.remove(root);
            root.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of [o.material].flat()) m.dispose(); });
        }
    }

    clearSharedSkills() {
        for (const key of ['activeBeacons','activeTurrets','activeVortexes','activeGrenades','activeStrikes','activeLightning']) {
            for (const e of this[key] || []) this.removeSkillEntity(e);
            this[key] = [];
        }
        this.activeSkillCooldownTimer = 0; this.activeSkillDurationTimer = 0;
        this.activeSkillEffect = null; this.riotChargeTimer = 0; this.bulletFrenzyTimer = 0; this.shadowVeilTimer = 0;
        this.assassinCritReady = false;
    }

    getSharedSkillState() {
        const stats = {};
        for (const key of ['activeSkillCooldownTimer','activeSkillMaxCooldown','activeSkillDurationTimer','activeSkillEffect','riotChargeTimer','bulletFrenzyTimer','shadowVeilTimer','assassinCritReady','shadowVeilCritMult','speedBoostTimer','speedBoostFactor','radarScanTimer']) stats[key] = this[key] ?? null;
        const entities = [];
        for (const kind of ['activeBeacons','activeTurrets','activeVortexes','activeGrenades','activeStrikes','activeLightning']) {
            for (const e of this[kind] || []) entities.push({kind, id: e.netId ||= (this.nextSkillEntityId = (this.nextSkillEntityId || 0) + 1),
                position: (e.group || e.mesh).position.toArray(), timer: e.timer,
                yaw: e.headGroup?.rotation.y || 0, rotation: e.ring?.rotation.z || 0,
                fired: !!e.fired, points: e.points?.map(p => p.toArray())});
        }
        return {stats, entities, activation: this.skillActivationSeq || 0};
    }

    applySharedSkillState(state) {
        if (!state) return;
        Object.assign(this, state.stats);
        if (state.activation > (this.skillActivationSeq || 0)) {
            this.skillActivationSeq = state.activation;
            if (this.activeSkillEffect) this.createSkillVisualEffect(this.activeSkillEffect);
        }
        for (const kind of ['activeBeacons','activeTurrets','activeVortexes','activeGrenades','activeStrikes','activeLightning']) {
            const list = this[kind] ||= [];
            const incoming = state.entities.filter(e => e.kind === kind);
            const ids = new Set(incoming.map(e => e.id));
            for (let i = list.length - 1; i >= 0; i--) if (!ids.has(list[i].netId)) { this.removeSkillEntity(list[i]); list.splice(i,1); }
            for (const data of incoming) {
                let e = list.find(e => e.netId === data.id);
                if (!e) {
                    if (kind === 'activeBeacons') this.triggerHealingBeacon(data.timer);
                    else if (kind === 'activeTurrets') this.triggerAutoTurret(data.timer);
                    else if (kind === 'activeVortexes') this.triggerSandVortex(data.timer);
                    else if (kind === 'activeStrikes') this.triggerOrbitalStrike();
                    else if (kind === 'activeLightning') this.createLightningEntity(data.points.map(p => new THREE.Vector3().fromArray(p)));
                    else {
                        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8),new THREE.MeshStandardMaterial({color:0x38bdf8}));
                        this.scene.add(mesh); list.push({mesh});
                    }
                    e = list[list.length - 1]; e.netId = data.id;
                }
                (e.group || e.mesh).position.fromArray(data.position);
                e.position?.fromArray(data.position); e.timer = data.timer;
                if (e.headGroup) e.headGroup.rotation.y = data.yaw;
                if (e.ring) e.ring.rotation.z = data.rotation;
                if (data.fired) { e.fired = true; this.showStrikeBeam(e); }
            }
        }
    }

    tryActiveSkill() {
        const network = globalThis.window?.game?.network;
        if (network?.active && !network.host) {
            if (this.isDead || this.isDowned || this.activeSkillCooldownTimer > 0) return false;
            network.sendCommand({type: 'active_skill'});
            return true;
        }
        if (this.isDead || this.isDowned) return false;
        if (this.activeSkillCooldownTimer > 0) return false;

        const cfg = CHARACTER_CONFIGS[this.characterId] || CHARACTER_CONFIGS.police;
        const skill = cfg.activeSkill;
        if (!skill) return false;

        this.activeSkillCooldownTimer = skill.cooldown;
        this.activeSkillMaxCooldown = skill.cooldown;
        this.activeSkillDurationTimer = skill.duration || 0;
        this.activeSkillEffect = skill.effectType;

        sounds.play('jump', { volume: 0.6, rate: 1.8 });

        // Kích hoạt hiệu ứng cụ thể của từng kỹ năng độc đáo
        switch (skill.effectType) {
            case 'riot_charge':
                this.triggerRiotCharge(skill.duration || 4.0);
                break;
            case 'cluster_grenades':
                this.triggerClusterGrenades();
                break;
            case 'healing_beacon':
                this.triggerHealingBeacon(skill.duration || 6.0);
                break;
            case 'vulnerability_scan':
                this.triggerVulnerabilityScan(skill.duration || 6.0);
                break;
            case 'auto_turret':
                this.triggerAutoTurret(skill.duration || 8.0);
                break;
            case 'orbital_strike':
                this.triggerOrbitalStrike();
                break;
            case 'ground_smash':
                this.triggerGroundSmash();
                break;
            case 'bullet_frenzy':
                this.triggerBulletFrenzy(skill.duration || 5.0);
                break;
            case 'supply_drop':
                this.triggerSupplyDrop();
                break;
            case 'sand_vortex':
                this.triggerSandVortex(skill.duration || 5.0);
                break;
            case 'chain_lightning':
                this.triggerChainLightning();
                break;
            case 'shadow_veil':
                this.triggerShadowVeil(skill.duration || 4.0);
                break;
            default:
                this.triggerShockwave(7.0, 30, 25);
                break;
        }

        this.skillActivationSeq = (this.skillActivationSeq || 0) + 1;
        this.createSkillVisualEffect(skill.effectType, skill.name);
        return true;
    }

    // Hiệu ứng kích hoạt kỹ năng tối thượng - Sóng xung kích 3D tức thời và luồng hào quang bốc lên
    createSkillVisualEffect(effectType, skillName = '') {
        if (!this.scene) return;

        // Xác định mã màu đặc trưng cho từng loại kỹ năng
        let color = 0x0284c7;
        if (effectType === 'riot_charge')             color = 0x00f0ff;
        else if (effectType === 'cluster_grenades')   color = 0x38bdf8;
        else if (effectType === 'healing_beacon')     color = 0x10b981;
        else if (effectType === 'vulnerability_scan') color = 0x84cc16;
        else if (effectType === 'auto_turret')        color = 0xfb923c;
        else if (effectType === 'orbital_strike')     color = 0xff1744;
        else if (effectType === 'ground_smash')       color = 0xea580c;
        else if (effectType === 'bullet_frenzy')      color = 0xfbbf24;
        else if (effectType === 'supply_drop')        color = 0x059669;
        else if (effectType === 'sand_vortex')        color = 0xd97706;
        else if (effectType === 'chain_lightning')    color = 0xa855f7;
        else if (effectType === 'shadow_veil')        color = 0x8b5cf6;

        const startPos = this.position.clone();

        // 1. Vòng sóng năng lượng xung kích 3D tức thời nở nhanh ra 2.8m trong 0.28s rồi biến mất (CỐ ĐỊNH, KHÔNG XOAY)
        const shockGeo = new THREE.RingGeometry(0.25, 0.55, 32);
        shockGeo.rotateX(-Math.PI / 2);
        const shockMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const shockMesh = new THREE.Mesh(shockGeo, shockMat);
        shockMesh.position.copy(startPos);
        shockMesh.position.y = 0.05;
        this.scene.add(shockMesh);

        // 2. Cột hào quang phát sáng 3D quanh cơ thể bốc lên cao rồi tan biến
        const auraGeo = new THREE.CylinderGeometry(0.65, 0.95, 2.2, 16, 1, true);
        const auraMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
        auraMesh.position.copy(startPos);
        auraMesh.position.y += 1.1;
        this.scene.add(auraMesh);

        // 3. Bắn các hạt phát sáng tóe ra
        this.particles?.createImpactSparks?.(
            startPos.clone().add(new THREE.Vector3(0, 0.6, 0)),
            new THREE.Vector3(0, 1, 0),
            color,
            24
        );

        // 4. Kích hoạt phản hồi giao diện người dùng
        const colorHex = '#' + color.toString(16).padStart(6, '0');
        const uiManager = window.game?.ui;
        if (this === window.game?.player && uiManager?.triggerSkillActivationFeedback) {
            uiManager.triggerSkillActivationFeedback(skillName, colorHex);
        }

        // Animation xung kích nhanh trong 0.28 giây rồi xóa sạch
        const startTime = performance.now();
        const animDuration = 0.28;
        const anim = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > animDuration) {
                this.scene.remove(shockMesh);
                this.scene.remove(auraMesh);
                shockGeo.dispose();
                shockMat.dispose();
                auraGeo.dispose();
                auraMat.dispose();
                return;
            }

            const t = elapsed / animDuration;
            const scale = 1.0 + t * 5.0;
            shockMesh.scale.set(scale, scale, scale);
            shockMat.opacity = Math.max(0, 0.9 * (1.0 - t));

            auraMesh.scale.set(1.0 + t * 0.4, 1.0 + t * 0.6, 1.0 + t * 0.4);
            auraMesh.position.y = startPos.y + 1.1 + t * 0.5;
            auraMat.opacity = Math.max(0, 0.7 * (1.0 - t));

            requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
    }

    // 1. Cảnh sát trưởng: Húc khiên bạo động bất tử và tông văng quái
    triggerRiotCharge(duration = 4.0) {
        this.riotChargeTimer = duration;
        this.invulnerability = Math.max(this.invulnerability || 0, duration);
        this.speedBoostTimer = Math.max(this.speedBoostTimer || 0, duration);
        this.speedBoostFactor = 1.40;

        // Xóa khiên cũ nếu còn tồn tại
        if (this.riotShieldGroup) {
            this.scene.remove(this.riotShieldGroup);
            this.riotShieldGroup = null;
        }

        // Tạo Khiên Năng Lượng 3D Cong Bán Nguyệt (Curved 3D Forcefield Barrier)
        const shieldGroup = new THREE.Group();

        // Mặt cong 3D bán nguyệt bao bọc phía trước ngực người chơi
        const shieldGeo = new THREE.CylinderGeometry(1.25, 1.25, 1.4, 24, 1, true, -Math.PI / 3, (Math.PI * 2) / 3);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        shieldMesh.position.set(0, 0.75, 0.45);
        shieldGroup.add(shieldMesh);

        // Viền năng lượng phát quang ở đỉnh và đáy khiên
        const rimGeo = new THREE.TorusGeometry(1.25, 0.035, 8, 24, (Math.PI * 2) / 3);
        rimGeo.rotateX(Math.PI / 2);
        rimGeo.rotateZ(-Math.PI / 3);
        const rimMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const topRim = new THREE.Mesh(rimGeo, rimMat);
        topRim.position.set(0, 1.45, 0.45);
        shieldGroup.add(topRim);

        const bottomRim = new THREE.Mesh(rimGeo, rimMat);
        bottomRim.position.set(0, 0.05, 0.45);
        shieldGroup.add(bottomRim);

        shieldGroup.position.copy(this.position);
        shieldGroup.rotation.y = this.aimYaw;
        this.scene.add(shieldGroup);
        this.riotShieldGroup = shieldGroup;
        this.riotTrailTimer = 0;
    }

    // 2. Nữ đặc nhiệm: Cụm lựu đạn ném theo hình quạt (4 quả, dame 180)
    triggerClusterGrenades() {
        const angles = [-0.35, -0.12, 0.12, 0.35];
        for (let i = 0; i < angles.length; i++) {
            const yaw = this.aimYaw + angles[i];
            const dir = new THREE.Vector3(Math.sin(yaw), 0.3, Math.cos(yaw)).normalize();
            const pos = this.position.clone().add(new THREE.Vector3(0, 1.0, 0));

            const geom = new THREE.SphereGeometry(0.18, 8, 8);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0284c7,
                emissiveIntensity: 0.8
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(pos);

            this.scene.add(mesh);
            this.activeGrenades.push({
                mesh,
                velocity: dir.multiplyScalar(16.0),
                timer: 0.5 + i * 0.15,
                damage: 180,
                radius: 4.8
            });
        }
        sounds.play('jump', { volume: 0.8, rate: 1.5 });
    }

    // 3. Bác sĩ tác chiến: Trạm cứu thương dã chiến hồi 15 HP/s trong 6s
    triggerHealingBeacon(duration = 6.0) {
        const pos = this.position.clone();
        pos.y = 0.04;
        const group = new THREE.Group();
        group.position.copy(pos);

        // A. Vòng ranh giới chiến thuật tinh tế (Tactical Range Ring Outline) - CỐ ĐỊNH, KHÔNG XOAY
        const rangeRingGeo = new THREE.RingGeometry(5.92, 6.0, 64);
        rangeRingGeo.rotateX(-Math.PI / 2);
        const rangeRingMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const rangeRing = new THREE.Mesh(rangeRingGeo, rangeRingMat);
        group.add(rangeRing);

        // Vòng đệm mỏng bên trong
        const innerRingGeo = new THREE.RingGeometry(5.75, 5.79, 64);
        innerRingGeo.rotateX(-Math.PI / 2);
        const innerRingMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
        group.add(innerRing);

        // B. Mái vòm năng lượng Hologram 3D (3D Holographic Nanite Dome)
        const domeGeo = new THREE.SphereGeometry(6.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.06,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const domeMesh = new THREE.Mesh(domeGeo, domeMat);
        group.add(domeMesh);

        // C. Trụ thiết bị cứu thương dã chiến công nghệ cao (Deployable Medical Beacon Pod)
        // 1. Chân đế hợp kim 3 chạc công nghệ
        const baseGeo = new THREE.CylinderGeometry(0.35, 0.48, 0.22, 6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.6 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.11;
        group.add(baseMesh);

        // 2. Thân trụ nano kim loại
        const shaftGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.85, 8);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.5 });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        shaftMesh.position.y = 0.55;
        group.add(shaftMesh);

        // 3. Lõi năng lượng Hologram y tế phát sáng (Nanite Core)
        const coreGeo = new THREE.OctahedronGeometry(0.18, 0);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x10b981,
            emissiveIntensity: 1.5,
            roughness: 0.1
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.y = 1.05;
        group.add(coreMesh);

        // 4. Vòng phát sóng nano xoay nhẹ ở đỉnh
        const emitterRingGeo = new THREE.TorusGeometry(0.24, 0.03, 8, 24);
        emitterRingGeo.rotateX(Math.PI / 2);
        const emitterRingMat = new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const emitterRing = new THREE.Mesh(emitterRingGeo, emitterRingMat);
        emitterRing.position.y = 1.05;
        group.add(emitterRing);

        this.scene.add(group);
        this.activeBeacons.push({
            group,
            domeMesh,
            coreMesh,
            emitterRing,
            rangeRing,
            position: pos,
            timer: duration,
            tickTimer: 0,
            radius: 6.0
        });
        sounds.playMedkit();
    }

    // 4. Chuyên viên phân tích: Quét radar và khiến quái chịu thêm 50% sát thương
    triggerVulnerabilityScan(duration = 8.0) {
        this.radarScanTimer = duration;
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            const dist = this.position.distanceTo(enemy.position);
            if (dist <= 35) {
                enemy.vulnerableTimer = duration;
                enemy.vulnerableMultiplier = 1.50;
                enemy.setEmissiveColor?.(0x84cc16, 0.9);
            }
        }

        // Sóng radar quét siêu âm 3D bùng nổ ra xa 35m trong 0.6s
        const radarRingGeo = new THREE.RingGeometry(0.5, 1.2, 48);
        radarRingGeo.rotateX(-Math.PI / 2);
        const radarRingMat = new THREE.MeshBasicMaterial({
            color: 0x84cc16,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const radarRing = new THREE.Mesh(radarRingGeo, radarRingMat);
        radarRing.position.copy(this.position);
        radarRing.position.y = 0.06;
        this.scene.add(radarRing);

        const startTime = performance.now();
        const anim = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 0.6) {
                this.scene.remove(radarRing);
                radarRingGeo.dispose();
                radarRingMat.dispose();
                return;
            }
            const t = elapsed / 0.6;
            const s = 1.0 + t * 28.0;
            radarRing.scale.set(s, s, s);
            radarRingMat.opacity = Math.max(0, 0.9 * (1.0 - t));
            requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
    }

    // 5. Kỹ sư cơ khí: Tháp súng mini tự động bắn zombie trong 8s
    triggerAutoTurret(duration = 8.0) {
        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        const pos = this.position.clone().add(forward.clone().multiplyScalar(1.2));
        pos.y = 0.05;

        const group = new THREE.Group();
        group.position.copy(pos);

        const baseGeom = new THREE.CylinderGeometry(0.35, 0.45, 0.3, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.y = 0.15;
        group.add(baseMesh);

        const headGroup = new THREE.Group();
        headGroup.position.y = 0.4;
        const boxGeom = new THREE.BoxGeometry(0.25, 0.25, 0.35);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.3 });
        const boxMesh = new THREE.Mesh(boxGeom, boxMat);
        headGroup.add(boxMesh);

        const barrelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
        barrelGeom.rotateX(Math.PI / 2);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const barrelMesh = new THREE.Mesh(barrelGeom, barrelMat);
        barrelMesh.position.z = 0.25;
        headGroup.add(barrelMesh);

        group.add(headGroup);
        this.scene.add(group);

        this.activeTurrets.push({
            group,
            headGroup,
            barrelMesh,
            position: pos,
            timer: duration,
            fireCooldown: 0,
            fireRate: 0.18,
            damage: 45,
            range: 18
        });
        sounds.play('reload', { volume: 0.7 });
    }

    // 6. Điệp viên áo đen: Không kích vệ tinh oanh tạc quỹ đạo
    triggerOrbitalStrike() {
        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        const targetPos = this.position.clone().add(forward.multiplyScalar(7.5));
        targetPos.y = 0.05;

        // Vòng ngắm Laser Chiến Thuật 3D (Tactical Laser Reticle)
        const reticleGroup = new THREE.Group();
        reticleGroup.position.copy(targetPos);

        // Vòng viền laser mỏng sắc nét (CỐ ĐỊNH, KHÔNG XOAY)
        const reticleRingGeo = new THREE.RingGeometry(4.88, 4.95, 64);
        reticleRingGeo.rotateX(-Math.PI / 2);
        const reticleRingMat = new THREE.MeshBasicMaterial({
            color: 0xff1744,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const reticleRing = new THREE.Mesh(reticleRingGeo, reticleRingMat);
        reticleGroup.add(reticleRing);

        // 4 Điểm ngắm chữ thập chữ L tại 4 góc
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            const crossGeo = new THREE.PlaneGeometry(0.1, 1.4);
            crossGeo.rotateX(-Math.PI / 2);
            crossGeo.translate(0, 0, 4.9);
            const crossMat = new THREE.MeshBasicMaterial({
                color: 0xff3355,
                side: THREE.DoubleSide
            });
            const crossMesh = new THREE.Mesh(crossGeo, crossMat);
            crossMesh.rotation.y = angle;
            reticleGroup.add(crossMesh);
        }

        // Tia laser định vị từ trên trời (y = 40) chiếu thẳng xuống tâm
        const guideBeamGeo = new THREE.CylinderGeometry(0.06, 0.06, 45, 8);
        guideBeamGeo.translate(0, 22.5, 0);
        const guideBeamMat = new THREE.MeshBasicMaterial({
            color: 0xff1744,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const guideBeam = new THREE.Mesh(guideBeamGeo, guideBeamMat);
        reticleGroup.add(guideBeam);

        this.scene.add(reticleGroup);

        // Hiệu ứng nhấp nháy báo động với tần số tăng dần trong 0.8s
        const aimStartTime = performance.now();
        const aimAnim = () => {
            const elapsed = (performance.now() - aimStartTime) / 1000;
            if (elapsed >= 0.8) return;
            reticleRing.material.opacity = 0.5 + Math.sin(elapsed * 24) * 0.45;
            guideBeam.material.opacity = 0.5 + Math.sin(elapsed * 24) * 0.4;
            requestAnimationFrame(aimAnim);
        };
        requestAnimationFrame(aimAnim);

        (this.activeStrikes ||= []).push({mesh: reticleGroup, position: targetPos, timer: 1.15, fired: false});
    }


    // 7. Đấu sĩ dũng mãnh: Dộng đất hất tung quái và làm choáng 3s (dame 130, radius 11)
    triggerGroundSmash() {
        const startPos = this.position.clone();

        // 1. Vết nứt địa chấn nổ vỡ mặt đất (CỐ ĐỊNH, KHÔNG XOAY)
        const scorchDecal = createGroundParticleDecal(startPos, 9.0, 'assets/particles/scorch_03.png', 0xea580c, 0.92, THREE.NormalBlending);
        scorchDecal.position.y = 0.04;
        this.scene.add(scorchDecal);

        // 2. Vòng sóng xung kích địa chấn 3D bùng nổ cực nhanh ra xa 11 mét
        const shockGeo = new THREE.RingGeometry(0.4, 1.2, 48);
        shockGeo.rotateX(-Math.PI / 2);
        const shockMat = new THREE.MeshBasicMaterial({
            color: 0xea580c,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const shockMesh = new THREE.Mesh(shockGeo, shockMat);
        shockMesh.position.copy(startPos);
        shockMesh.position.y = 0.06;
        this.scene.add(shockMesh);

        // 3. Cột bụi đá và áp lực nổ bốc ngược lên trời
        const geyserGeo = new THREE.CylinderGeometry(1.2, 2.8, 3.8, 16, 1, true);
        const geyserMat = new THREE.MeshBasicMaterial({
            color: 0xfb923c,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const geyserMesh = new THREE.Mesh(geyserGeo, geyserMat);
        geyserMesh.position.copy(startPos);
        geyserMesh.position.y += 1.9;
        this.scene.add(geyserMesh);

        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            const dist = startPos.distanceTo(enemy.position);
            if (dist <= 11.0) {
                const pushDir = new THREE.Vector3().subVectors(enemy.position, startPos).normalize();
                pushDir.y = 0.9;
                enemy.takeDamage(130, 3, true, pushDir);
                if (enemy.knockbackVelocity) {
                    enemy.knockbackVelocity.set(pushDir.x * 24, 14, pushDir.z * 24);
                }
                enemy.combatState = 'STUNNED';
                enemy.combatTimer = 3.0;
            }
        }

        this.particles?.createExplosion?.(startPos, 0xea580c, 45);
        this.applyKickbackAndShake?.(new THREE.Vector2(0, 0), 0.9);
        sounds.play('enemyDestroy', { volume: 1.0 });

        // Animation sóng phóng ra và mờ dần trong 0.35 giây
        const animStartTime = performance.now();
        const anim = () => {
            const elapsed = (performance.now() - animStartTime) / 1000;
            if (elapsed > 0.35) {
                this.scene.remove(shockMesh);
                this.scene.remove(geyserMesh);
                shockGeo.dispose();
                shockMat.dispose();
                geyserGeo.dispose();
                geyserMat.dispose();
                return;
            }
            const t = elapsed / 0.35;
            const s = 1.0 + t * 9.5;
            shockMesh.scale.set(s, s, s);
            shockMat.opacity = Math.max(0, 0.95 * (1.0 - t));

            geyserMesh.scale.set(1.0 + t * 0.4, 1.0 + t * 0.6, 1.0 + t * 0.4);
            geyserMat.opacity = Math.max(0, 0.85 * (1.0 - t));
            requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);

        // Vết nứt địa chấn mờ dần sau 2.0s
        setTimeout(() => {
            const fStart = performance.now();
            const fAnim = () => {
                const el = (performance.now() - fStart) / 1000;
                if (el > 0.8) {
                    this.scene.remove(scorchDecal);
                    scorchDecal.geometry?.dispose();
                    scorchDecal.material?.dispose();
                    return;
                }
                scorchDecal.material.opacity = Math.max(0, 0.92 * (1.0 - el));
                requestAnimationFrame(fAnim);
            };
            requestAnimationFrame(fAnim);
        }, 1600);
    }

    // 8. Tiểu thư nổi loạn: Cuồng xả đạn vô hạn trong 5s
    triggerBulletFrenzy(duration = 5.0) {
        this.bulletFrenzyTimer = duration;
        sounds.play('pickupAmmo', { volume: 0.9 });
        this.particles?.createImpactSparks?.(this.position, new THREE.Vector3(0, 1, 0), 0xfbbf24, 25);
    }

    // 9. Quản lý chiến trường: Thả dù Hòm Tiếp Tế Chiến Thuật (Airdrop Crate)
    triggerSupplyDrop() {
        if (this.weapons) {
            for (const wp of this.weapons.weaponSlots.filter(w => w && !w.isBomb && !w.isKnife && !w.isUtility)) {
                if (wp) {
                    this.weapons.ammo[wp.id] = this.weapons.getModifiedStats(wp).magSize;
                    this.weapons.reserve[wp.id] = Infinity;
                }
            }
            if (this.weapons.inventory) {
                this.weapons.inventory.medkits = (this.weapons.inventory.medkits || 0) + 1;
            }
        }
        // Hồi phục 30 Máu ngay lập tức khi dùng kỹ năng
        this.heal(30);

        // Vị trí thả hòm: phía trước mặt người chơi 4.0m theo hướng ngắm
        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        const dropPos = this.position.clone().add(forward.multiplyScalar(4.0));
        dropPos.x = Math.max(-20, Math.min(20, dropPos.x));
        dropPos.z = Math.max(-20, Math.min(20, dropPos.z));
        dropPos.y = 0;

        // Triển khai Hòm Thính Tiếp Tế Thả Dù (Airdrop Drop Simulation)
        const looting = window.game?.lootingSystem;
        if (looting) {
            // Âm thanh máy bay vận tải gầm rú trên bầu trời
            sounds.playAirdropPlaneSound?.();

            // Banner thông báo chiến thuật toàn màn hình
            looting.ui?.showBanner('CHỈ HUY ĐÃ THẢ DÙ HÒM TIẾP TẾ CHIẾN THUẬT!');

            // Đánh dấu vòng tròn tiếp tế trên Radar
            looting.activeAirdropZone = { x: dropPos.x, z: dropPos.z, radius: 4.5, time: 45 };

            // Sinh thực thể hòm thính thả dù rơi từ bầu trời (AirdropDropEntity)
            const airdropDrop = new AirdropDropEntity(this.scene, dropPos, looting);
            looting.airdropDrops.push(airdropDrop);
        }

        // Cột sáng tín hiệu chỉ thị tọa độ tiếp tế (Signal Flare Beam)
        const beamGeo = new THREE.CylinderGeometry(0.5, 0.9, 32.0, 16);
        beamGeo.translate(0, 16.0, 0);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        beamMesh.position.copy(dropPos);
        this.scene.add(beamMesh);

        sounds.play('pickupAmmo', { volume: 0.95 });
        sounds.playMedkit();
        this.particles?.createImpactSparks?.(dropPos, new THREE.Vector3(0, 1, 0), 0x10b981, 28);

        setTimeout(() => {
            this.scene.remove(beamMesh);
            beamGeo.dispose();
            beamMat.dispose();
        }, 1200);
    }

    // 10. Vận động viên cơ động: Lốc xoáy bão cát hút quái
    triggerSandVortex(duration = 5.0) {
        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        const pos = this.position.clone().add(forward.multiplyScalar(5.5));
        pos.y = 0.05;

        const group = new THREE.Group();
        group.position.copy(pos);

        // Vòng ranh giới bão cát mỏng sát sàn đấu (CỐ ĐỊNH, KHÔNG XOAY)
        const boundaryGeo = new THREE.RingGeometry(8.4, 8.5, 64);
        boundaryGeo.rotateX(-Math.PI / 2);
        const boundaryMat = new THREE.MeshBasicMaterial({
            color: 0xd97706,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide
        });
        const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
        group.add(boundaryMesh);

        // Cột Phễu Lốc Xoáy Bão Cát 3D (Volumetric 3D Dust Twister)
        const twisterGeo = new THREE.CylinderGeometry(4.2, 0.9, 3.6, 16, 4, true);
        twisterGeo.translate(0, 1.8, 0);
        const twisterMat = new THREE.MeshBasicMaterial({
            color: 0xd97706,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const twisterMesh = new THREE.Mesh(twisterGeo, twisterMat);
        group.add(twisterMesh);

        // Lõi xoáy bên trong
        const innerGeo = new THREE.CylinderGeometry(2.4, 0.5, 3.2, 12, 1, true);
        innerGeo.translate(0, 1.6, 0);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        group.add(innerMesh);

        this.scene.add(group);
        this.activeVortexes.push({
            group,
            twisterMesh,
            innerMesh,
            position: pos,
            timer: duration,
            radius: 8.5,
            tickTimer: 0
        });
    }

    // 11. Chiến binh Cyber: Tia sét giật lan truyền qua 12 zombie (dame 150)
    triggerChainLightning() {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        const living = enemies.filter(e => e && !e.isDead && e.active);
        if (living.length === 0) return;

        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        let first = null;
        let bestScore = -Infinity;
        for (const e of living) {
            const toE = new THREE.Vector3().subVectors(e.position, this.position);
            const dist = toE.length();
            if (dist > 22) continue;
            toE.normalize();
            const dot = forward.dot(toE);
            const score = dot * 10 - dist;
            if (score > bestScore) {
                bestScore = score;
                first = e;
            }
        }
        if (!first) first = living[0];

        const chain = [first];
        const visited = new Set([first]);
        while (chain.length < 12) {
            const current = chain[chain.length - 1];
            let next = null;
            let closestDist = Infinity;
            for (const other of living) {
                if (visited.has(other)) continue;
                const d = current.position.distanceTo(other.position);
                if (d < 8.0 && d < closestDist) {
                    closestDist = d;
                    next = other;
                }
            }
            if (!next) break;
            visited.add(next);
            chain.push(next);
        }

        const points = [this.position.clone().add(new THREE.Vector3(0, 1.0, 0))];
        for (const target of chain) {
            target.takeDamage(150, 3, true, null);
            target.combatState = 'STUNNED';
            target.combatTimer = 2.5;
            target.setEmissiveColor?.(0x00f0ff, 1.0);
            const tPos = target.position.clone().add(new THREE.Vector3(0, 1.0, 0));
            points.push(tPos);

            // Bắn chùm hồ quang điện nổ tung tại mỗi zombie bị giật điện
            this.particles?.createImpactSparks?.(tPos, new THREE.Vector3(0, 1, 0), 0x00f0ff, 22);
        }

        if (points.length > 1) this.createLightningEntity(points);
    }

    createLightningEntity(points) {
        const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: 0x00f0ff}));
        this.scene.add(mesh);
        (this.activeLightning ||= []).push({mesh, points, timer: 0.3});
    }

    // 12. Sát thủ bóng đêm: Tàng hình và đòn đánh kế tiếp chí mạng x4
    triggerShadowVeil(duration = 6.0) {
        this.isInSmoke = true;
        this.isStealthed = true;
        this.shadowVeilTimer = duration;
        this.speedBoostTimer = Math.max(this.speedBoostTimer || 0, duration);
        this.speedBoostFactor = 1.50;
        this.assassinCritReady = true;
        this.shadowVeilCritMult = 4;

        // Chuyển model người chơi sang dạng bóng ma bán trong suốt (phantom mode)
        if (this.model) {
            this.model.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.transparent = true;
                    c.material.opacity = 0.35;
                }
            });
        }

        // Bắn chùm hạt khói bóng đêm tức thời
        this.particles?.createImpactSparks?.(this.position, new THREE.Vector3(0, 1, 0), 0x8b5cf6, 28);
    }

    // Cập nhật vòng lặp các thực thể kỹ năng độc đáo
    updateActiveSkills(delta, arena, enemies = []) {
        if (globalThis.window?.game?.network?.active && !window.game.network.host) return;
        this.activeSkillCooldownTimer = Math.max(0, (this.activeSkillCooldownTimer || 0) - delta);
        this.activeSkillDurationTimer = Math.max(0, (this.activeSkillDurationTimer || 0) - delta);
        if (!this.activeSkillDurationTimer) this.activeSkillEffect = null;
        for (const kind of ['activeStrikes', 'activeLightning']) {
            const list = this[kind] ||= [];
            for (let i = list.length - 1; i >= 0; i--) {
                const e = list[i]; e.timer -= delta;
                if (kind === 'activeStrikes' && e.timer <= 0.35 && !e.fired) {
                    e.fired = true;
                    this.showStrikeBeam(e);
                    for (const enemy of enemies) {
                        if (enemy.isDead || enemy.position.distanceTo(e.position) > 7) continue;
                        enemy.takeDamage(350, 4, true, new THREE.Vector3().subVectors(enemy.position, e.position).normalize());
                        enemy.burnTimer = 3.5; enemy.burnDamage = 16;
                    }
                    this.particles?.createExplosion?.(e.position, 0xff2244, 40);
                }
                if (e.timer <= 0) { this.removeSkillEntity(e); list.splice(i, 1); }
            }
        }
        // Cập nhật Húc khiên bạo động
        if (this.riotChargeTimer > 0) {
            this.riotChargeTimer -= delta;

            // Bám khiên chắn theo người chơi
            if (this.riotShieldGroup) {
                this.riotShieldGroup.position.copy(this.position);
                this.riotShieldGroup.rotation.y = this.aimYaw;
            }

            // Tạo vệt gió lướt (Wind Trail) phía sau lưng
            this.riotTrailTimer = (this.riotTrailTimer || 0) + delta;
            if (this.riotTrailTimer >= 0.06) {
                this.riotTrailTimer = 0;
                const trailPos = this.position.clone();
                const trailDecal = createGroundParticleDecal(trailPos, 2.2, 'assets/particles/Rotated/trace_01_rotated.png', 0x00f0ff, 0.7, THREE.AdditiveBlending);
                trailDecal.rotation.z = this.aimYaw;
                this.scene.add(trailDecal);
                setTimeout(() => {
                    this.scene.remove(trailDecal);
                    trailDecal.geometry?.dispose();
                    trailDecal.material?.dispose();
                }, 220);
            }

            for (const enemy of enemies) {
                if (!enemy || enemy.isDead || !enemy.active) continue;
                const d = this.position.distanceTo(enemy.position);
                if (d < 2.4) {
                    const pushDir = new THREE.Vector3().subVectors(enemy.position, this.position).normalize();
                    pushDir.y = 0.25;
                    enemy.takeDamage(70, 3, true, pushDir);
                    if (enemy.knockbackVelocity) enemy.knockbackVelocity.addScaledVector(pushDir, 38);
                    this.particles?.createImpactSparks?.(enemy.position, pushDir, 0x00f0ff, 12);
                }
            }

            if (this.riotChargeTimer <= 0 && this.riotShieldGroup) {
                this.scene.remove(this.riotShieldGroup);
                this.riotShieldGroup.traverse?.(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
                this.riotShieldGroup = null;
            }
        }

        // Cập nhật Cuồng xả đạn vô hạn
        if (this.bulletFrenzyTimer > 0) {
            this.bulletFrenzyTimer -= delta;
        }

        // Cập nhật Tàng hình bóng ma (Shadow Veil)
        if (this.shadowVeilTimer > 0) {
            this.shadowVeilTimer -= delta;
            this.isInSmoke = true;
            this.isStealthed = true;

            if (this.shadowVeilTimer <= 0) {
                this.isInSmoke = false;
                this.isStealthed = false;
                this.assassinCritReady = false;
                // Khôi phục opacity của model về bình thường
                if (this.model) {
                    this.model.traverse(c => {
                        if (c.isMesh && c.material) {
                            c.material.opacity = 1.0;
                        }
                    });
                }
            }
        }

        // Cập nhật Lựu đạn chùm
        for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
            const g = this.activeGrenades[i];
            g.mesh.position.addScaledVector(g.velocity, delta);
            g.velocity.y -= 22 * delta;
            g.timer -= delta;
            if (g.timer <= 0 || g.mesh.position.y <= 0.2) {
                const game = globalThis.window?.game;
                if (game?.network?.active && game.network.host) {
                    (game.networkEvents ||= []).push({type:'bomb_explosion',position:g.mesh.position.toArray(),color:0x38bdf8,radius:g.radius});
                }
                this.particles?.createExplosion?.(g.mesh.position, 0x38bdf8, 25);
                sounds.play('enemyDestroy', { volume: 0.85 });
                this.applyExplosionShock(g.mesh.position, 20, 0.70);

                for (const enemy of enemies) {
                    if (!enemy || enemy.isDead) continue;
                    const d = g.mesh.position.distanceTo(enemy.position);
                    if (d <= g.radius) {
                        const pushDir = new THREE.Vector3().subVectors(enemy.position, g.mesh.position).normalize();
                        pushDir.y = 0.4;
                        enemy.takeDamage(g.damage, 3, true, pushDir);
                        if (enemy.knockbackVelocity) enemy.knockbackVelocity.addScaledVector(pushDir, 30);
                    }
                }
                this.scene.remove(g.mesh);
                g.mesh.geometry?.dispose();
                g.mesh.material?.dispose();
                this.activeGrenades.splice(i, 1);
            }
        }

        // Cập nhật Trạm cứu thương dã chiến
        for (let i = this.activeBeacons.length - 1; i >= 0; i--) {
            const b = this.activeBeacons[i];
            b.timer -= delta;
            b.tickTimer += delta;

            // Xoay nhẹ lõi phát sóng y tế 3D trên đỉnh trụ (rất tinh tế)
            if (b.coreMesh) {
                b.coreMesh.rotation.y += delta * 2.0;
                b.coreMesh.rotation.x += delta * 1.0;
            }
            if (b.emitterRing) {
                b.emitterRing.rotation.z += delta * 3.0;
            }
            // Mái vòm hologram nhấp nháy nhịp thở nhẹ nhàng
            if (b.domeMesh) {
                b.domeMesh.material.opacity = 0.05 + Math.sin(b.timer * 3.0) * 0.025;
            }

            // Mỗi 1 giây: Hồi máu và bắn sóng xung nhịp 3D nở từ trụ ra ngoài
            if (b.tickTimer >= 1.0) {
                b.tickTimer = 0;

                // Tạo sóng xung lực hồi máu 3D nở từ trụ ra 6m
                const pulseGeo = new THREE.RingGeometry(0.3, 0.55, 48);
                pulseGeo.rotateX(-Math.PI / 2);
                const pulseMat = new THREE.MeshBasicMaterial({
                    color: 0x10b981,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                });
                const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
                pulseMesh.position.copy(b.position);
                pulseMesh.position.y = 0.06;
                this.scene.add(pulseMesh);

                const pulseStart = performance.now();
                const pulseAnim = () => {
                    const elapsed = (performance.now() - pulseStart) / 1000;
                    if (elapsed > 0.45) {
                        this.scene.remove(pulseMesh);
                        pulseGeo.dispose();
                        pulseMat.dispose();
                        return;
                    }
                    const t = elapsed / 0.45;
                    const s = 1.0 + t * 10.5;
                    pulseMesh.scale.set(s, s, s);
                    pulseMat.opacity = Math.max(0, 0.7 * (1.0 - t));
                    requestAnimationFrame(pulseAnim);
                };
                requestAnimationFrame(pulseAnim);

                if (this.position.distanceTo(b.position) <= b.radius) {
                    this.heal(15);
                    this.particles?.createImpactSparks?.(this.position, new THREE.Vector3(0, 1, 0), 0x10b981, 10);
                }
                const coopPlayers = window.game?.coopPlayers || [];
                for (const teammate of coopPlayers) {
                    if (teammate !== this && teammate.position && teammate.position.distanceTo(b.position) <= b.radius) {
                        teammate.heal?.(15);
                    }
                }
            }

            if (b.timer <= 0) {
                this.scene.remove(b.group);
                b.group.traverse?.(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
                this.activeBeacons.splice(i, 1);
            }
        }

        // Cập nhật Tháp súng mini tự động
        for (let i = this.activeTurrets.length - 1; i >= 0; i--) {
            const t = this.activeTurrets[i];
            t.timer -= delta;
            t.fireCooldown -= delta;

            let closest = null;
            let minDist = t.range;
            for (const enemy of enemies) {
                if (!enemy || enemy.isDead || !enemy.active) continue;
                const d = t.position.distanceTo(enemy.position);
                if (d < minDist) {
                    minDist = d;
                    closest = enemy;
                }
            }

            if (closest) {
                const toEnemy = new THREE.Vector3().subVectors(closest.position, t.position);
                t.headGroup.rotation.y = Math.atan2(toEnemy.x, toEnemy.z);
                if (t.fireCooldown <= 0) {
                    t.fireCooldown = t.fireRate;
                    closest.takeDamage(t.damage, 2, false, null);
                    sounds.play('pistol', { volume: 0.45, pitchVariation: 0.2 });
                    this.particles?.createImpactSparks?.(closest.position, new THREE.Vector3(0, 1, 0), 0xfb923c, 6);
                    const game = globalThis.window?.game;
                    if (game?.network?.active && game.network.host) {
                        (game.networkEvents ||= []).push({type:'turret_hit',position:closest.position.toArray()});
                    }
                }
            }

            if (t.timer <= 0) {
                this.scene.remove(t.group);
                t.group.traverse?.(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
                this.activeTurrets.splice(i, 1);
            }
        }

        // Cập nhật Lốc xoáy bão cát
        for (let i = this.activeVortexes.length - 1; i >= 0; i--) {
            const v = this.activeVortexes[i];
            v.timer -= delta;
            v.tickTimer += delta;

            // Xoay cột lốc xoáy 3D quanh trục đứng
            if (v.twisterMesh) v.twisterMesh.rotation.y += delta * 6.0;
            if (v.innerMesh) v.innerMesh.rotation.y -= delta * 8.0;

            for (const enemy of enemies) {
                if (!enemy || enemy.isDead || !enemy.active) continue;
                const d = v.position.distanceTo(enemy.position);
                if (d <= v.radius) {
                    enemy.position.lerp(v.position, delta * 3.2);
                    enemy.speed = Math.min(enemy.speed || 3.5, 1.6);
                    if (v.tickTimer >= 0.5) {
                        enemy.takeDamage(18, 2, false, null);
                    }
                }
            }
            if (v.tickTimer >= 0.5) v.tickTimer = 0;

            if (v.timer <= 0) {
                this.scene.remove(v.group);
                v.group.traverse?.(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
                this.activeVortexes.splice(i, 1);
            }
        }
    }

    // Hàm hỗ trợ tương thích ngược
    triggerShockwave(radius = 7.0, pushForce = 30, damage = 25) {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            const dist = this.position.distanceTo(enemy.position);
            if (dist <= radius) {
                const pushDir = new THREE.Vector3().subVectors(enemy.position, this.position).normalize();
                pushDir.y = 0.2;
                enemy.takeDamage(damage, 2, false, pushDir);
                if (enemy.knockbackVelocity) {
                    enemy.knockbackVelocity.addScaledVector(pushDir, pushForce * Math.max(0.3, 1.0 - dist / radius));
                }
            }
        }
    }

    triggerEmpBlast(radius = 8.5, damage = 120) {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            const dist = this.position.distanceTo(enemy.position);
            if (dist <= radius) {
                const pushDir = new THREE.Vector3().subVectors(enemy.position, this.position).normalize();
                enemy.takeDamage(damage, 3, true, pushDir);
                enemy.combatState = 'STUNNED';
                enemy.combatTimer = 2.5;
            }
        }
    }

    triggerStunPulse(radius = 8.0, duration = 3.0) {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            if (this.position.distanceTo(enemy.position) <= radius) {
                enemy.combatState = 'STUNNED';
                enemy.combatTimer = duration;
            }
        }
    }

    triggerVampireDrain(radius = 7.0, amount = 35) {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            if (this.position.distanceTo(enemy.position) <= radius) {
                const pushDir = new THREE.Vector3().subVectors(enemy.position, this.position).normalize();
                enemy.takeDamage(30, 2, false, pushDir);
                hitCount++;
            }
        }
        if (hitCount > 0) {
            this.health = Math.min(this.maxHealth, this.health + amount);
        }
    }

    triggerSandstorm(radius = 8.5, duration = 5.0) {
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            if (this.position.distanceTo(enemy.position) <= radius) {
                enemy.speed = Math.max(1.2, (enemy.speed || 3.5) * 0.4);
            }
        }
    }

    triggerToxicCloud(radius = 6.5, duration = 5.0) {
        this.triggerShockwave(radius, 15, 40);
    }

    triggerClusterMines() {
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const offset = new THREE.Vector3(Math.cos(angle) * 3.5, 0, Math.sin(angle) * 3.5);
            setTimeout(() => {
                this.triggerShockwave(4.0, 25, 45);
            }, 300 * (i + 1));
        }
    }

    triggerPiercingBeam(damage = 110) {
        const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw)).normalize();
        const enemies = this.latestEnemies || window.game?.waveManager?.enemies || [];
        for (const enemy of enemies) {
            if (!enemy || enemy.isDead) continue;
            const toEnemy = new THREE.Vector3().subVectors(enemy.position, this.position);
            const dist = toEnemy.length();
            if (dist > 25) continue;
            toEnemy.normalize();
            if (forward.dot(toEnemy) > 0.85) {
                enemy.takeDamage(damage, 3, true, forward);
            }
        }
    }

    playAnimation(name, duration = 0.15) {
        if (!this.mixer || !this.animations[name]) return;
        const newAction = this.animations[name];

        if (this.currentAction === newAction) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(duration);
        }

        newAction.reset();
        newAction.fadeIn(duration);
        newAction.play();
        this.currentAction = newAction;
    }

    tryDodge() {
        if (this.dodgeCooldown > 0 || this.isDead || !this.isGrounded) return;

        // Hủy lục hòm và hủy nạp đạn khi né đòn
        if (this.isSearching) {
            window.game?.lootingSystem?.cancelSearch();
        }
        this.weapons.cancelReload();

        const moveDir = this.getMovementInput();
        if (moveDir.lengthSq() > 0.01) {
            this.dodgeDir.copy(moveDir).normalize();
        } else {
            this.dodgeDir.set(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
        }

        const cdMult = this.dodgeCdMult || 1.0;
        this.isDodging = true;
        this.dodgeTimer = 0.28;
        this.dodgeCooldown = 1.0 * cdMult;
        sounds.play('jump', { volume: 0.8, rate: 1.4 });

        // Hiệu ứng vệt lướt gió khí động học tốc độ cao (Wind Dash Trail)
        const dashTrail = createGroundParticleDecal(this.position.clone(), 3.2, 'assets/particles/Rotated/trace_01_rotated.png', 0x00f0ff, 0.85, THREE.AdditiveBlending);
        const dashAngle = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
        dashTrail.rotation.z = dashAngle;
        dashTrail.position.y = 0.05;
        this.scene.add(dashTrail);
        setTimeout(() => {
            this.scene.remove(dashTrail);
            dashTrail.geometry?.dispose();
            dashTrail.material?.dispose();
        }, 280);
    }

    applyScreenShake(traumaAmount = 0.5) {
        const added = Math.max(0, typeof traumaAmount === 'number' ? traumaAmount : 0.5);
        this.screenShakeTrauma = Math.min(1.0, (this.screenShakeTrauma || 0) + added);
    }

    // Rung màn hình chấn động nổ theo khoảng cách (Explosion Shockwave Screen Shake)
    applyExplosionShock(epicenter, maxDist = 24, maxTrauma = 0.95) {
        if (!epicenter) return;
        const dist = this.position.distanceTo(epicenter);
        if (dist <= maxDist) {
            // Tỷ lệ suy giảm phi tuyến: gần tâm rung cực mạnh, xa tâm suy giảm êm
            const factor = Math.max(0, 1.0 - (dist / maxDist));
            const shockTrauma = maxTrauma * Math.pow(factor, 1.35);
            this.applyScreenShake(shockTrauma);
        }
        // Đồng bộ lan truyền rung chấn cho tất cả đồng đội trong phòng Co-op
        const coopPlayers = window.game?.coopPlayers || [];
        for (const p of coopPlayers) {
            if (p && p !== this && p.applyScreenShake && p.position) {
                const d = p.position.distanceTo(epicenter);
                if (d <= maxDist) {
                    const factor = Math.max(0, 1.0 - (d / maxDist));
                    p.applyScreenShake(maxTrauma * Math.pow(factor, 1.35));
                }
            }
        }
    }

    applyKickbackAndShake(kickStrength = 3.5, shakeStrength = 0.16) {
        if (!this.cursorKick) this.cursorKick = new THREE.Vector2(0, 0);
        const recoilM = this.recoilMult || 1.0;
        const kick = (typeof kickStrength === 'number' ? kickStrength : (kickStrength?.x || 3.5)) * recoilM;
        // Tăng độ nảy ngang và giật hất lên trên khi xả đạn (~20%) để cảm giác súng đầm tay
        this.cursorKick.x += (Math.random() - 0.5) * kick * 6.0;
        this.cursorKick.y -= (Math.random() * 0.7 + 0.3) * kick * 7.8; // Nảy hất lên trên đầm hơn

        // Rung màn hình dựa trên cỡ đạn (Screen Shake Trauma)
        const traumaAdd = (typeof shakeStrength === 'number' ? shakeStrength * 1.3 : 0.22);
        this.applyScreenShake(traumaAdd);
    }

    getMovementInput() {
        const input = new THREE.Vector3();
        if (this.keys['KeyW']) input.z -= 1;
        if (this.keys['KeyS']) input.z += 1;
        if (this.keys['KeyA']) input.x -= 1;
        if (this.keys['KeyD']) input.x += 1;

        if (input.lengthSq() > 0) {
            input.normalize();
        }
        return input;
    }

    takeDamage(amount, hitDir) {
        if (this.isDead || this.isDowned || this.isDodging || this.invulnerability > 0 || (window.game?.network?.active && !window.game.network.host)) return;
        // Kiem tra khien bat tu Nanite
        if (this.activeSkillEffect === 'nanite_barrier') return;
        // Kiem tra hang rao thep giam 50% sat thuong
        if (this.activeSkillEffect === 'iron_wall') amount = Math.round(amount * 0.5);
        if (this.damageTakenMult) amount = Math.max(1, Math.round(amount * this.damageTakenMult));
        // Che do Developer: Nhan vat bat tu, khong bi tru mau hoac khien
        if (this.developerMode || window.developerMode) {
            this.health = this.maxHealth;
            this.shield = this.maxShield;
            if (hitDir) {
                this.velocity.x += hitDir.x * 2.0;
                this.velocity.z += hitDir.z * 2.0;
            }
            sounds.playShieldDamage();
            return;
        }
        this.damageRevision++;

        this.shieldRegenTimer = this.shieldRegenDelay;

        if (this.shield > 0) {
            sounds.playShieldDamage();
            if (this.shield >= amount) {
                this.shield -= amount;
                amount = 0;
            } else {
                amount -= this.shield;
                this.shield = 0;
            }
        }

        if (amount > 0) {
            this.health -= amount;
            this.painTimer = 4.0;
            sounds.play('enemyHurt', { volume: 0.6, rate: 1.1 });

            if (hitDir) {
                this.velocity.x += hitDir.x * 3.0;
                this.velocity.z += hitDir.z * 3.0;
            }
        }

        // Khóa nhận sát thương trong 0.8 giây (i-frame) giúp tránh bị bầy zombie dồn sát thương chết tức thì
        if (this.health > 0) {
            this.invulnerability = Math.max(this.invulnerability || 0, 0.8);
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    rechargeShield(amount) {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }

    die(forceDead = false) {
        if (this.isDead) return;
        if (this.developerMode || window.developerMode) return;

        // Kiểm tra nếu có đồng đội hoặc bot trong trận
        const hasTeammates = this.cooperative || (window.game?.coopPlayers && window.game.coopPlayers.length > 1);
        if (hasTeammates && !forceDead) {
            // Chuyển sang trạng thái gục (Downed), chờ đồng đội bước vào vòng cứu
            this.isDead = false;
            this.isDowned = true;
            this.bleedOutTimer = 30.0;
            this.reviveProgress = 0.0;
            this.isBeingRevived = false;
            this.isADS = false;
            this.th_toggleADS = false;
            sounds.play('enemyHurt', { volume: 0.9, rate: 0.75 });
            if (this.holdingAction) this.holdingAction.stop();
            if (this.model) {
                this.model.rotation.x = -Math.PI / 2.2;
                this.model.position.y = this.position.y + 0.2;
            }
            this.playAnimation('idle', 0.05);
            this.ui?.showPickupAlert('BẠN ĐÃ BỊ GỤC! BÒ TÌM GÓC NẤP VÀ CHỜ ĐỒNG ĐỘI ĐẾN VÒNG CỨU TRONG 30 GIÂY!');
            return;
        }

        // Chết hoàn toàn
        this.isDead = true;
        this.isDowned = false;
        sounds.play('enemyDestroy', { volume: 0.9 });
        if (this.holdingAction) this.holdingAction.stop();
        // Giữ vị trí không vỡ tan
        this.playAnimation('idle', 0.05);
    }

    revive() {
        if (!this.isDowned && !this.isDead) return false;
        this.isDead = false;
        this.isDowned = false;
        this.reviveRequested = false;
        this.reviveProgress = 0.0;
        this.isBeingRevived = false;
        this.bleedOutTimer = 30.0;
        this.health = 60;
        this.shield = 0;
        this.invulnerability = 2.5;
        this.velocity.set(0, 0, 0);
        if (this.model) {
            this.model.rotation.x = 0;
            this.model.position.y = this.position.y;
        }
        if (this.holdingAction) this.holdingAction.play();
        this.playAnimation('idle');
        sounds.play('powerup', { volume: 1.0 });
        return true;
    }

    checkHit(startPos, endPos, ray) {
        const bulletRadius = 0.18;
        const effRadius = (this.radius || 0.55) + bulletRadius;
        const effHeight = (this.height || 1.6) + bulletRadius;
        _tempBoxMin.set(this.position.x - effRadius, this.position.y, this.position.z - effRadius);
        _tempBoxMax.set(this.position.x + effRadius, this.position.y + effHeight, this.position.z + effRadius);
        _tempPlayerBox.min.copy(_tempBoxMin);
        _tempPlayerBox.max.copy(_tempBoxMax);

        // Trường hợp 1: Điểm bắt đầu của đạn nằm ngay trong HitBox người chơi (bắn dí sát hoặc đạn frame trước đã lọt vào)
        if (_tempPlayerBox.containsPoint(startPos)) {
            return { hit: true, point: startPos.clone() };
        }

        // Trường hợp 2: Điểm kết thúc của đạn trong frame này lọt vào trong HitBox người chơi
        if (_tempPlayerBox.containsPoint(endPos)) {
            return { hit: true, point: endPos.clone() };
        }

        // Trường hợp 3: Tia đạn đâm xuyên qua HitBox trong bước bay này
        const hit = ray.intersectBox(_tempPlayerBox, _tempPlayerHitPoint);
        const stepDist = startPos.distanceTo(endPos);
        if (hit && startPos.distanceTo(_tempPlayerHitPoint) <= stepDist + 0.15) {
            return { hit: true, point: _tempPlayerHitPoint.clone() };
        }
        return { hit: false };
    }

    update(delta, arena, enemies = []) {
        const authoritative = !window.game?.network?.active || window.game.network.host;
        this.updateActiveSkills(delta, arena, enemies);
        // Duy tri trang thai day mau va song sot khi bat Che do Developer
        if (authoritative && (this.developerMode || window.developerMode)) {
            this.health = this.maxHealth;
            this.shield = this.maxShield;
            this.isDead = false;
            this.isDowned = false;
        }
        this.enemiesRef = enemies;
        this.invulnerability = Math.max(0, this.invulnerability - delta);
        if (this.painTimer > 0) {
            this.painTimer = Math.max(0, this.painTimer - delta);
        }
        if (this.mixer) {
            this.mixer.update(delta);
        }

        if (this.isDead) {
            this.healthBar?.update(this.position, this.health, this.maxHealth, true);
            this.updateCamera(delta);
            return;
        }

        // Xử lý trạng thái gục (Downed / Bleed-out)
        if (this.isDowned) {
            if (!window.game?.network?.active || window.game.network.host) this.bleedOutTimer -= delta;
            if (this.bleedOutTimer <= 0 && (!window.game?.network?.active || window.game.network.host)) {
                this.bleedOutTimer = 0;
                this.die(true); // Hết 30 giây chảy máu, chết hẳn
                return;
            }

            // Cập nhật thanh hiển thị thời gian chờ cứu
            this.healthBar?.update(this.position, this.bleedOutTimer, this.maxBleedOutTime, true);

            // Cho phép bò chậm với 20% tốc độ chạy
            const crawlSpeed = this.speed * 0.20;
            const moveDir = this.getMovementInput();
            const isCrawling = moveDir.lengthSq() > 0.01;

            if (isCrawling) {
                this.velocity.x = moveDir.x * crawlSpeed;
                this.velocity.z = moveDir.z * crawlSpeed;
            } else {
                this.velocity.x *= Math.pow(0.001, delta);
                this.velocity.z *= Math.pow(0.001, delta);
            }

            // Trọng lực và va chạm khi bò
            this.velocity.y -= this.gravity * delta;
            if (arena.moveCharacter) {
                arena.moveCharacter(this.position, this.velocity.x * delta, this.velocity.z * delta, this.radius);
            } else {
                const probe = this.position.clone();
                probe.x += this.velocity.x * delta;
                if (!arena.checkCollision(probe, this.radius)) this.position.x = probe.x;
                probe.copy(this.position); probe.z += this.velocity.z * delta;
                if (!arena.checkCollision(probe, this.radius)) this.position.z = probe.z;
            }
            this.position.y += this.velocity.y * delta;
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }

            // Tư thế bò của model trên sàn đấu
            if (this.model) {
                this.model.position.set(this.position.x, this.position.y + 0.2, this.position.z);
                this.model.rotation.x = -Math.PI / 2.2;
                if (isCrawling) {
                    const crawlAngle = Math.atan2(moveDir.x, moveDir.z);
                    this.model.rotation.y = crawlAngle;
                    this.playAnimation('walk');
                } else {
                    this.playAnimation('idle');
                }
            }

            this.updateCamera(delta);
            return; // Đang bị gục không thể bắn súng hay lướt/nhảy
        }

        // Shield auto-regeneration
        if (authoritative && this.shieldRegenTimer > 0) {
            this.shieldRegenTimer -= delta;
        } else if (authoritative && this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * delta);
        }

        // Noi tai tu phuc hoi mau (Xac uop / Mummy)
        if (authoritative && this.passiveRegenRate > 0 && this.health < this.maxHealth * 0.5 && !this.isDead && !this.isDowned) {
            this.health = Math.min(this.maxHealth * 0.5, this.health + this.passiveRegenRate * delta);
        }

        // Dodge handling
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= delta;
        }
        if (this.isDodging) {
            this.dodgeTimer -= delta;
            const dodgeSpeed = 16.0 * (this.dodgeDistMult || 1.0);
            this.velocity.x = this.dodgeDir.x * dodgeSpeed;
            this.velocity.z = this.dodgeDir.z * dodgeSpeed;
            if (this.dodgeTimer <= 0) {
                this.isDodging = false;
            }
        }

        // Precision fire affects spread and movement, never camera zoom/angle.
        this.isADS = this.mouseButtons.right || !!this.th_toggleADS;

        // Locomotion input
        let currentSpeed = this.speed;
        if (this.isADS) {
            currentSpeed *= 0.65;
        }
        if (this.weapons?.isUsingMedkit) {
            currentSpeed *= 0.55; // Vừa sơ cứu vừa di chuyển cẩn thận
        }
        if (this.isBackpackOpen) {
            currentSpeed *= 0.65; // Vừa xem balo vừa bước đi cẩn thận quan sát
        }
        if (this.isOverweight) {
            currentSpeed *= 0.65; // Phạt giảm tốc độ di chuyển khi balo vượt quá 450 KG
        }
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer -= delta;
            currentSpeed *= (this.speedBoostFactor || 1.25); // Tăng tốc khi uống Nước tăng lực
        }

        const moveDir = this.getMovementInput();
        const isMoving = moveDir.lengthSq() > 0.01;

        if (this.isSearching) {
            this.velocity.set(0, 0, 0);
        } else if (!this.isDodging) {
            if (isMoving) {
                this.velocity.x = moveDir.x * currentSpeed;
                this.velocity.z = moveDir.z * currentSpeed;

                this.stepTimer -= delta;
                if (this.stepTimer <= 0 && this.isGrounded) {
                    sounds.play('step', { volume: 0.35, rate: 1.0 });
                    this.stepTimer = 0.42;
                }
            } else {
                this.velocity.x *= Math.pow(0.001, delta);
                this.velocity.z *= Math.pow(0.001, delta);
            }
        }

        // Chuc nang Nhay da duoc thay the bang Luot ne don (Space = Dodge)
        // Trong luc khong co nhay, trong luc van giu nhan vat tiep dat on dinh
        this.velocity.y -= this.gravity * delta;

        // Sweep and slide the circular body, including recovery from overlap.
        if (arena.moveCharacter) {
            arena.moveCharacter(this.position, this.velocity.x * delta, this.velocity.z * delta, this.radius);
        } else {
            const probe = this.position.clone();
            probe.x += this.velocity.x * delta;
            if (!arena.checkCollision(probe, this.radius)) this.position.x = probe.x;
            probe.copy(this.position); probe.z += this.velocity.z * delta;
            if (!arena.checkCollision(probe, this.radius)) this.position.z = probe.z;
        }
        // Vertical collision
        this.position.y += this.velocity.y * delta;
        if (this.position.y <= 0) {
            this.position.y = 0;
            if (!this.isGrounded && this.velocity.y < -4) {
                sounds.play('land', { volume: 0.5 });
            }
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // Giảm dần độ giật con trỏ (Cursor Kickback Decay)
        this.cursorKick.lerp(new THREE.Vector2(0, 0), 1 - Math.exp(-22 * delta));

        // Giảm dần chấn thương rung màn hình (Screen Shake Trauma Decay)
        this.screenShakeTrauma = Math.max(0, this.screenShakeTrauma - delta * 2.2);

        this.updateCamera(delta);
        this.updateAim(enemies);

        // Sync 3D model orientation
        if (this.model) {
            this.model.position.copy(this.position);
            this.healthBar?.update(this.position, this.health, this.maxHealth, true);

            const targetModelYaw = this.aimYaw;

            // Shortest arc angle interpolation
            let diff = (targetModelYaw - this.model.rotation.y) % (Math.PI * 2);
            if (diff < -Math.PI) diff += Math.PI * 2;
            if (diff > Math.PI) diff -= Math.PI * 2;
            this.model.rotation.y += diff * Math.min(1.0, delta * 16);

            // Animation selection
            if (!this.isGrounded) {
                this.playAnimation('jump');
            } else if (this.isDodging) {
                this.playAnimation('walk', 0.05);
            } else if (isMoving) {
                this.playAnimation('walk');
            } else {
                this.playAnimation('idle');
            }
        }

        // Weapon firing
        this.weapons.updateHeldPose?.(this.model);
        this.handleShooting();

        // Xử lý chỉ báo ném bom (Throw Range & Blast Radius Indicators)
        this._lastEnemiesRef = enemies;
        const currentW = this.weapons.getCurrentWeapon();
        if (currentW && currentW.isBomb) {
            // Hiển thị vòng tròn giới hạn ném quanh người chơi (bán kính 14m)
            if (this.throwRangeMesh) {
                this.throwRangeMesh.visible = true;
                this.throwRangeMesh.position.set(this.position.x, 0.05, this.position.z);
            }

            // Nếu người chơi đang giữ chuột trái -> Hiện vòng tròn nổ kẹp theo tầm ném
            if (this.mouseButtons.left && this.inputEnabled && !this.isDead && !this.th_isRadialMenuOpen) {
                this.isAimingBomb = true;

                // Lấy tọa độ chuột giao cắt mặt phẳng mặt đất
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(this.pointer, this.camera);
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const groundHit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());

                if (groundHit) {
                    const dx = groundHit.x - this.position.x;
                    const dz = groundHit.z - this.position.z;
                    const dist = Math.hypot(dx, dz);
                    const maxRange = currentW.throwRange || 14.0;

                    // Kẹp tọa độ ném không vượt quá giới hạn ném ban đầu
                    if (dist > maxRange) {
                        this.clampedBombTarget.set(
                            this.position.x + (dx / dist) * maxRange,
                            0.05,
                            this.position.z + (dz / dist) * maxRange
                        );
                    } else {
                        this.clampedBombTarget.set(groundHit.x, 0.05, groundHit.z);
                    }
                }

                // Cập nhật vị trí và kích thước vòng tròn nổ
                const r = currentW.blastRadius || 5.5;
                const scale = r / 5.5;
                if (this.blastRadiusMesh) {
                    this.blastRadiusMesh.scale.set(scale, scale, scale);
                    this.blastRadiusMesh.position.copy(this.clampedBombTarget);
                    this.blastRadiusMesh.visible = true;
                }
                if (this.blastInnerMesh) {
                    this.blastInnerMesh.scale.set(scale, scale, scale);
                    this.blastInnerMesh.position.copy(this.clampedBombTarget);
                    this.blastInnerMesh.visible = true;
                }
            } else {
                if (this.blastRadiusMesh) this.blastRadiusMesh.visible = false;
                if (this.blastInnerMesh) this.blastInnerMesh.visible = false;
            }
        } else {
            if (this.throwRangeMesh) this.throwRangeMesh.visible = false;
            if (this.blastRadiusMesh) this.blastRadiusMesh.visible = false;
            if (this.blastInnerMesh) this.blastInnerMesh.visible = false;
            this.isAimingBomb = false;
        }
    }

    updateAim(enemies = []) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.pointer, this.camera);
        // Aim at torso height for empty space; directly pointing at a zombie
        // uses its actual hit volume, including larger mutants and headshots.
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.position.y + 0.85));
        const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (!target) return;
        for (const collider of this.arena.colliders) {
            const hit = raycaster.ray.intersectBox(collider, new THREE.Vector3());
            if (hit && raycaster.ray.origin.distanceTo(hit) < raycaster.ray.origin.distanceTo(target)) target.copy(hit);
        }
        for (const enemy of enemies) {
            if (enemy.isDead || !enemy.mesh) continue;
            const center = enemy.position.clone().add(new THREE.Vector3(0, enemy.scale * 0.45, 0));
            const hit = raycaster.ray.intersectSphere(new THREE.Sphere(center, enemy.radius), new THREE.Vector3());
            if (hit && raycaster.ray.origin.distanceTo(hit) < raycaster.ray.origin.distanceTo(target)) {
                // Aim just inside the body so overhead selection does not send
                // the muzzle ray grazing tangentially along the hit sphere.
                target.copy(hit).lerp(center, 0.25);
            }
        }
        this.aimPoint.copy(target);
        const dx = target.x - this.position.x;
        const dz = target.z - this.position.z;
        if (Math.hypot(dx, dz) > 0.1) this.aimYaw = Math.atan2(dx, dz);
    }

    handleShooting() {
        if (!this.inputEnabled || !this.pointerInCanvas || this.isDead || this.th_isRadialMenuOpen) return;

        const w = this.weapons.getCurrentWeapon();
        if (w.isBomb) return; // Khi cầm bom, cơ chế ném kích hoạt qua thao tác giữ và nhả chuột

        const shouldShoot = w.isAuto ? this.mouseButtons.left : (this.mouseButtons.left && this.weapons.fireCooldown <= 0);

        if (shouldShoot) {
            // Compute muzzle origin from character right arm
            const muzzlePos = new THREE.Vector3();
            if (this.weapons.getMuzzlePosition?.(muzzlePos)) {
                // The projectile and flash now originate at the visible barrel.
            } else if (this.handBone) {
                this.model.updateMatrixWorld(true);
                this.handBone.getWorldPosition(muzzlePos);
                // Forward offset in character facing direction
                const forward = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
                muzzlePos.addScaledVector(forward, 0.45);
                muzzlePos.y += 0.05;
            } else {
                muzzlePos.copy(this.position).add(new THREE.Vector3(0, 1.2, 0));
            }

            const dmgMult = (this.damageMult || 1.0) * (this.activeSkillEffect === 'overdrive' ? 1.25 : 1.0);
            this.weapons.shoot(muzzlePos, this.aimPoint, this.isADS, true, dmgMult, this);
        } else {
            if (!this.mouseButtons.left && sounds?.stopContinuousFire) {
                sounds.stopContinuousFire();
            }
        }
    }

    getAliveTeammates() {
        const game = window.game;
        if (!game) return [];
        const remotes = Array.from(game.remotePlayers?.values() || []);
        // Ưu tiên đồng đội còn sống, nếu không có ai thì lấy đồng đội đang chờ cứu
        const alive = remotes.filter(p => p && !p.isDead && !p.isDowned);
        if (alive.length > 0) return alive;
        return remotes.filter(p => p && (!p.isDead || p.isDowned));
    }

    switchSpectatorTarget(direction = 1) {
        const mates = this.getAliveTeammates();
        if (mates.length === 0) {
            this.spectateTarget = null;
            return;
        }
        this.spectateIndex = (this.spectateIndex + direction + mates.length) % mates.length;
        this.spectateTarget = mates[this.spectateIndex];
        sounds.play('switchWeapon', { volume: 0.6, rate: 1.8 });
    }

    updateCamera(delta) {
        let target = new THREE.Vector3(this.position.x, 0.7, this.position.z);
        let targetFov = 50; // Default FOV

        // Chế độ quan sát đồng đội khi nhân vật đã chết (Spectator Mode)
        if (this.isDead) {
            const mates = this.getAliveTeammates();
            if (mates.length > 0) {
                this.isSpectating = true;
                // Nếu mục tiêu hiện tại đã mất hoặc đã chết, tự động chọn mục tiêu hợp lệ tiếp theo
                if (!this.spectateTarget || (this.spectateTarget.isDead && !this.spectateTarget.isDowned) || !mates.includes(this.spectateTarget)) {
                    this.spectateIndex = Math.max(0, this.spectateIndex % mates.length);
                    this.spectateTarget = mates[this.spectateIndex];
                }
                if (this.spectateTarget) {
                    target.set(this.spectateTarget.position.x, 0.7, this.spectateTarget.position.z);
                }
                // Hiển thị HUD quan sát đồng đội
                const ui = this.ui || window.game?.ui;
                ui?.updateSpectatorHUD?.(this.spectateTarget, mates.length, this.spectateIndex);
            } else {
                this.isSpectating = false;
                this.spectateTarget = null;
                const ui = this.ui || window.game?.ui;
                ui?.hideSpectatorHUD?.();
            }
        } else {
            if (this.isSpectating) {
                this.isSpectating = false;
                this.spectateTarget = null;
                const ui = this.ui || window.game?.ui;
                ui?.hideSpectatorHUD?.();
            }
            if (this.isADS) {
                const aimVec = new THREE.Vector3().subVectors(this.aimPoint, this.position);
                aimVec.y = 0;
                aimVec.clampLength(0, 4.2);
                target.addScaledVector(aimVec, 0.45); // Dịch 45% về phía con trỏ chuột
                targetFov = 30; // Zoom in for ADS
            }
        }

        const lerpSpeed = this.isDead ? 6 : 12;
        this.cameraFocus.lerp(target, 1 - Math.exp(-lerpSpeed * Math.max(0, delta)));
        this.camera.position.copy(this.cameraFocus).add(this.cameraOffset);

        // Smooth FOV zoom (Aiming Animation)
        if (this.camera.fov) {
            this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-15 * delta));
            this.camera.updateProjectionMatrix();
        }

        // Hiệu ứng rung màn hình chấn thương uy lực (Explosion & Gunfire Screen Shake Trauma)
        const trauma = this.screenShakeTrauma || 0;
        const shake = trauma * trauma * 1.15;
        if (shake > 0.0005) {
            const t = performance.now() * 0.055;
            this.camera.position.x += Math.sin(t) * shake;
            this.camera.position.y += Math.sin(t * 1.7) * (shake * 0.45);
            this.camera.position.z += Math.cos(t * 1.3) * shake;
        }

        // Đăng ký hàm rung màn hình toàn cục để các hệ thống khác (weapons, skybombs) dễ dàng gọi
        window.triggerExplosionScreenShake = (epicenter, maxDist, maxTrauma) => {
            this.applyExplosionShock(epicenter, maxDist, maxTrauma);
        };

        this.camera.lookAt(this.cameraFocus);
        this.camera.updateMatrixWorld(true);
    }

    reset(startPos = new THREE.Vector3(0, 0, 8)) {
        this.clearSharedSkills();
        this.position.copy(startPos);
        this.velocity.set(0, 0, 0);
        this.applyCharacterStats();
        this.health = this.maxHealth;
        this.shield = this.maxShield;
        this.activeSkillCooldownTimer = 0;
        this.activeSkillDurationTimer = 0;
        this.activeSkillEffect = null;
        this.isDead = false;
        this.isDowned = false;
        this.isInSmoke = false;
        this.isSpectating = false;
        this.spectateTarget = null;
        this.spectateIndex = 0;
        const ui = this.ui || window.game?.ui;
        ui?.hideSpectatorHUD?.();
        this.speedBoostTimer = 0;
        this.speedBoostFactor = 1.0;
        this.invulnerability = 0;
        this.aimYaw = Math.PI;
        this.isADS = false;
        this.isSearching = false;
        this.cameraFocus.set(this.position.x, 0.7, this.position.z);
        this.aimPoint.copy(this.position).add(new THREE.Vector3(0, 0.85, -10));
        this.updateCamera(0);
        this.keys = {};
        this.mouseButtons = { left: false, right: false };
        this.isDodging = false;
        this.isGrounded = true;
        this.dodgeCooldown = 0;
        this.shieldRegenTimer = 0;
        this.riotChargeTimer = 0;
        this.bulletFrenzyTimer = 0;
        this.shadowVeilTimer = 0;
        this.assassinCritReady = false;

        // Dọn dẹp các hiệu ứng đặc biệt khi reset
        if (this.riotShieldGroup) {
            this.scene.remove(this.riotShieldGroup);
            this.riotShieldGroup = null;
        }
        if (this.shadowVeilAuraMesh) {
            this.scene.remove(this.shadowVeilAuraMesh);
            this.shadowVeilAuraMesh = null;
        }
        if (this.bulletFrenzyVentsGroup) {
            this.scene.remove(this.bulletFrenzyVentsGroup);
            this.bulletFrenzyVentsGroup = null;
        }
        if (this.model) {
            this.model.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material.opacity = 1.0;
                }
            });
        }

        if (this.activeBeacons) for (const b of this.activeBeacons) this.scene.remove(b.group);
        if (this.activeTurrets) for (const t of this.activeTurrets) this.scene.remove(t.group);
        if (this.activeVortexes) for (const v of this.activeVortexes) this.scene.remove(v.group);
        if (this.activeGrenades) for (const g of this.activeGrenades) this.scene.remove(g.mesh);
        this.activeBeacons = [];
        this.activeTurrets = [];
        this.activeVortexes = [];
        this.activeGrenades = [];
        if (this.model) this.model.rotation.y = Math.PI;
        this.healthBar?.update(this.position, this.health, this.maxHealth, true);
        if (this.holdingAction) this.holdingAction.play();
        this.playAnimation('idle');
    }
}
