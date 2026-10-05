import * as THREE from 'three';
import { sounds } from '../../audio/audio.js';
import { HealthBar3D } from '../../rendering/healthbar.js';
import { CHARACTER_CONFIGS, normalizeCharacter } from './characters.js';

const _tempPlayerBox = new THREE.Box3();
const _tempBoxMin = new THREE.Vector3();
const _tempBoxMax = new THREE.Vector3();
const _tempPlayerHitPoint = new THREE.Vector3();

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

    tryActiveSkill() {
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

        // Kich hoat hieu ung cu the cua tung ky nang
        switch (skill.effectType) {
            case 'rapid_fire':
                break;
            case 'speed_boost':
                this.speedBoostTimer = Math.max(this.speedBoostTimer || 0, skill.duration);
                this.speedBoostFactor = 1.45;
                break;
            case 'instant_reload':
                if (this.weapons?.currentWeapon) {
                    this.weapons.currentWeapon.ammo = this.weapons.currentWeapon.maxAmmo;
                    this.weapons.cancelReload();
                }
                sounds.play('reload', { volume: 0.8 });
                break;
            case 'heal_armor':
                this.shield = Math.min(this.maxShield, this.shield + 35);
                sounds.play('pickupMedkit', { volume: 0.8 });
                break;
            case 'shockwave_push':
                this.triggerShockwave(7.0, 35, 25);
                break;
            case 'cluster_grenades':
                this.triggerClusterMines();
                break;
            case 'iron_wall':
                break;
            case 'scanner':
                this.radarScanTimer = skill.duration;
                break;
            case 'stun_grenade':
                this.triggerStunPulse(8.0, 3.0);
                break;
            case 'piercing_beam':
                this.triggerPiercingBeam();
                break;
            case 'smoke_camo':
                this.isInSmoke = true;
                break;
            case 'emp_blast':
                this.triggerEmpBlast(8.5, 120);
                break;
            case 'nanite_shield':
                break;
            case 'sandstorm':
                this.triggerSandstorm(8.5, skill.duration);
                break;
            case 'shadow_decoy':
                this.isInSmoke = true;
                this.triggerShockwave(5.0, 20, 10);
                break;
            case 'guaranteed_crit':
                break;
            case 'toxic_cloud':
                this.triggerToxicCloud(6.5, skill.duration);
                break;
            case 'supply_drop':
                if (this.weapons) {
                    for (const wp of this.weapons.weapons) {
                        if (wp) wp.ammo = wp.maxAmmo;
                    }
                }
                sounds.play('pickupAmmo', { volume: 0.9 });
                break;
            case 'overdrive':
                this.speedBoostTimer = Math.max(this.speedBoostTimer || 0, skill.duration);
                this.speedBoostFactor = 1.35;
                break;
            case 'bone_toss':
                this.triggerPiercingBeam(85);
                break;
            case 'vampire_drain':
                this.triggerVampireDrain(7.0, 35);
                break;
        }

        this.createSkillVisualEffect(skill.effectType);
        return true;
    }

    createSkillVisualEffect(effectType) {
        if (!this.scene) return;
        const geometry = new THREE.RingGeometry(0.5, 1.2, 32);
        geometry.rotateX(-Math.PI / 2);
        let color = 0x00f0ff;
        if (effectType === 'emp_blast') color = 0xa855f7;
        else if (effectType === 'shockwave_push') color = 0x22c55e;
        else if (effectType === 'vampire_drain') color = 0xff2255;
        else if (effectType === 'toxic_cloud') color = 0x10b981;
        else if (effectType === 'nanite_shield' || effectType === 'iron_wall') color = 0xf59e0b;
        else if (effectType === 'guaranteed_crit') color = 0xb45309;

        const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(this.position);
        ring.position.y += 0.1;
        this.scene.add(ring);

        let scale = 1.0;
        const startTime = performance.now();
        const anim = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 0.45) {
                this.scene.remove(ring);
                geometry.dispose();
                material.dispose();
                return;
            }
            scale = 1.0 + elapsed * 14.0;
            ring.scale.set(scale, scale, scale);
            material.opacity = Math.max(0, 0.85 * (1.0 - elapsed / 0.45));
            requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
    }

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
    }

    applyKickbackAndShake(kickStrength = 3.5, shakeStrength = 0.16) {
        if (!this.cursorKick) this.cursorKick = new THREE.Vector2(0, 0);
        const recoilM = this.recoilMult || 1.0;
        const kick = (typeof kickStrength === 'number' ? kickStrength : (kickStrength?.x || 3.5)) * recoilM;
        this.cursorKick.x += (Math.random() - 0.5) * kick * 5.0;
        this.cursorKick.y -= (Math.random() * 0.7 + 0.3) * kick * 6.5; // Nảy hất nhẹ lên trên

        // Rung màn hình dựa trên cỡ đạn (Screen Shake Trauma)
        this.screenShakeTrauma = Math.min(1.0, (this.screenShakeTrauma || 0) + (typeof shakeStrength === 'number' ? shakeStrength : 0.15));
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
        _tempBoxMin.set(this.position.x - this.radius, this.position.y, this.position.z - this.radius);
        _tempBoxMax.set(this.position.x + this.radius, this.position.y + this.height, this.position.z + this.radius);
        _tempPlayerBox.min.copy(_tempBoxMin);
        _tempPlayerBox.max.copy(_tempBoxMax);

        const hit = ray.intersectBox(_tempPlayerBox, _tempPlayerHitPoint);
        if (hit && startPos.distanceTo(_tempPlayerHitPoint) <= startPos.distanceTo(endPos)) {
            return { hit: true, point: _tempPlayerHitPoint.clone() };
        }
        return { hit: false };
    }

    update(delta, arena, enemies = []) {
        // Duy tri trang thai day mau va song sot khi bat Che do Developer
        if (this.developerMode || window.developerMode) {
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
        if (this.shieldRegenTimer > 0) {
            this.shieldRegenTimer -= delta;
        } else if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * delta);
        }

        // Cap nhat bo dem thoi gian hoi chieu va hieu luc Ky nang chu dong
        if (this.activeSkillCooldownTimer > 0) {
            this.activeSkillCooldownTimer = Math.max(0, this.activeSkillCooldownTimer - delta);
        }
        if (this.activeSkillDurationTimer > 0) {
            this.activeSkillDurationTimer = Math.max(0, this.activeSkillDurationTimer - delta);
            if (this.activeSkillDurationTimer === 0) {
                this.activeSkillEffect = null;
            }
        }
        // Noi tai tu phuc hoi mau (Xac uop / Mummy)
        if (this.passiveRegenRate > 0 && this.health < this.maxHealth * 0.5 && !this.isDead && !this.isDowned) {
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

        // Hiệu ứng rung màn hình chấn thương (Screen Shake Trauma)
        const shake = this.screenShakeTrauma * this.screenShakeTrauma * 0.48;
        if (shake > 0.0005) {
            const t = performance.now() * 0.045;
            this.camera.position.x += Math.sin(t) * shake;
            this.camera.position.z += Math.cos(t * 1.3) * shake;
        }

        this.camera.lookAt(this.cameraFocus);
        this.camera.updateMatrixWorld(true);
    }

    reset(startPos = new THREE.Vector3(0, 0, 8)) {
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
        if (this.model) this.model.rotation.y = Math.PI;
        this.healthBar?.update(this.position, this.health, this.maxHealth, true);
        if (this.holdingAction) this.holdingAction.play();
        this.playAnimation('idle');
    }
}
