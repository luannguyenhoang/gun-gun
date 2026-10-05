import { SkyBombs } from './skybombs.js';
import * as THREE from 'three';
import * as SkeletonUtils from '../../../vendor/SkeletonUtils.js';
import { sounds } from '../../audio/audio.js';
import { HealthBar3D } from '../../rendering/healthbar.js';

// Ban kinh va cham vat ly theo loai quai
const ZOMBIE_RADII = {
    walker: 0.6,
    sprinter: 0.55,
    tank: 0.95,
    boss: 2.2,
    giant: 1.65,
    spitter: 0.7,
    bomber: 0.8,
    crawler: 0.4,
    boomer: 1.05,
    orc_brawler: 0.95,
    cyber_enforcer: 0.75,
    shadow_stalker: 0.55,
    toxic_spitter: 0.7
};

// Vector va bien tam dung chung de toi uu bo nho, Zero GC trong vong lap 60 FPS
const _upAxis = new THREE.Vector3(0, 1, 0);
const _tempCenter = new THREE.Vector3();
const _tempSphere = new THREE.Sphere();
const _tempHitPoint = new THREE.Vector3();
const _tempToPlayer = new THREE.Vector3();
const _tempSpitOrigin = new THREE.Vector3();
const _tempPlayerTarget = new THREE.Vector3();
const _tempSeparation = new THREE.Vector3();
const _tempDiff = new THREE.Vector3();
const _tempMoveVel = new THREE.Vector3();
const _tempDesiredDir = new THREE.Vector3();
const _tempCheckPos = new THREE.Vector3();
const _tempClawPos = new THREE.Vector3();

// Cac trang thai chu ky chien dau cua Zombie
export const ZombieCombatState = {
    CHASE: 'CHASE',         // San duoi truc dien
    WINDUP: 'WINDUP',       // Tu luc tan cong (~0.25s), model rung nhe va chop do bao hieu
    RECOVERY: 'RECOVERY',   // Khung lai sau don danh (~0.8s - 1.0s), dung chon chan tai cho
    STUNNED: 'STUNNED'      // Khung do dinh dan (~0.1s), bi ngat don va day lui
};

export class Zombie {
    constructor(scene, type, position, gltfModels, particles, phaseNum = 1, weapons = null) {
        this.scene = scene;
        this.type = type;
        this.weapons = weapons;
        this.particles = particles;
        this.gltfModels = gltfModels;
        this.position = position ? position.clone() : new THREE.Vector3();
        this.active = true;
        this.isDead = false;
        this.id = 0;

        // Vector day lui tich luy
        this.knockbackVelocity = new THREE.Vector3();

        // Cac chi so chu ky chien dau
        this.combatState = ZombieCombatState.CHASE;
        this.combatTimer = 0;
        this.windupDuration = 0.20;      // Pha 1: Tu luc ~0.20s
        this.recoveryDuration = 0.50;    // Pha 3: Khung hoi phuc nhanh hon ~0.50s (giam khung de danh quyet liet hon)
        this.stunDuration = 0.06;         // Khung khi trung dan ~0.06s

        this.flashTimer = 0;
        this.spitCharge = 0;
        this.rangedCooldown = 1.5;
        this.acidTarget = null;
        this.acidTarget = null;
        this.navigationPath = null;
        this.pathTimer = 0;

        // Model, animation va thanh mau
        this.mesh = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.healthBar = null;
        this.mutationParts = [];
        this.stompRing = null;
        this.meshMaterials = [];

        this.applyStats(type, phaseNum, 0, 7.5);
        this.setupVisuals(gltfModels);
    }

    // Tinh toan chi so quai dua tren he so thoi gian va loai quai - Tang suc manh manh me
    applyStats(type, phaseNum = 1, survivalMinutes = 0, playerSpeed = 7.5) {
        this.type = type;
        this.radius = ZOMBIE_RADII[type] ?? ZOMBIE_RADII.walker;

        // He so tang tien theo thoi gian song (hoac phase) - Tang manh tay hon
        const timeScale = 1.0 + (survivalMinutes * 0.35);
        const phaseMult = Math.max(timeScale, 1.0 + (phaseNum - 1) * 0.45);
        const dmgMult = 1.0 + survivalMinutes * 0.20 + (phaseNum - 1) * 0.30;

        // Tinh toan toc do toi da khong vuot qua 95% toc do Player de van tha dieu duoc nhung ap sat rat sat
        const maxAllowedSpeed = (playerSpeed || 7.5) * 0.95;

        if (type === 'orc_brawler') {
            this.baseHealth = 650;
            this.baseArmor = 280;
            this.armorClass = 2;
            this.speed = Math.min(4.0 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 2.4;
            this.damage = Math.round(48 * dmgMult);
            this.attackRange = 1.6;
            this.attackCooldown = 1.0;
            this.knockbackResistance = 0.85;
            this.scoreValue = 350;
        } else if (type === 'cyber_enforcer') {
            this.baseHealth = 380;
            this.baseArmor = 160;
            this.armorClass = 2;
            this.speed = Math.min(5.5 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.85;
            this.damage = Math.round(35 * dmgMult);
            this.attackRange = 1.35;
            this.attackCooldown = 0.8;
            this.knockbackResistance = 0.45;
            this.scoreValue = 280;
        } else if (type === 'shadow_stalker') {
            this.baseHealth = 160;
            this.baseArmor = 30;
            this.armorClass = 1;
            this.speed = Math.min(7.6 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.5;
            this.damage = Math.round(28 * dmgMult);
            this.attackRange = 1.2;
            this.attackCooldown = 0.6;
            this.knockbackResistance = 0.15;
            this.scoreValue = 220;
        } else if (type === 'toxic_spitter') {
            this.baseHealth = 290;
            this.baseArmor = 70;
            this.armorClass = 1;
            this.speed = Math.min(4.2 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.7;
            this.damage = Math.round(26 * dmgMult);
            this.attackRange = 12.0;
            this.attackCooldown = 2.0;
            this.knockbackResistance = 0.25;
            this.scoreValue = 260;
        } else if (type === 'tank') {
            // Tanker Zombie: Mau cuc trau, giap day, khang day lui knockback 90%
            this.baseHealth = 550;
            this.baseArmor = 280;
            this.armorClass = 2; // Giap kim loai cap 2
            this.speed = Math.min(3.8 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 2.2;
            this.damage = Math.round(45 * dmgMult);
            this.attackRange = 1.5;
            this.attackCooldown = 1.0;
            this.knockbackResistance = 0.90;
            this.scoreValue = 300;
        } else if (type === 'sprinter') {
            // Fast Zombie: Toc do rat cao, mau duoc nang cap, ap sat nhanh
            this.baseHealth = 120;
            this.baseArmor = 20;
            this.armorClass = 1;
            this.speed = Math.min(7.2 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.55;
            this.damage = Math.round(24 * dmgMult);
            this.attackRange = 1.2;
            this.attackCooldown = 0.7;
            this.knockbackResistance = 0.1;
            this.scoreValue = 180;
        } else if (type === 'giant') {
            this.baseHealth = 1100;
            this.baseArmor = 500;
            this.armorClass = 3;
            this.speed = Math.min(3.0 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 3.6;
            this.damage = Math.round(65 * dmgMult);
            this.attackRange = 2.8;
            this.attackCooldown = 1.7;
            this.knockbackResistance = 0.95;
            this.scoreValue = 500;
        } else if (type === 'bomber') {
            this.baseHealth = 300; this.baseArmor = 70; this.armorClass = 1;
            this.speed = Math.min(3.2, maxAllowedSpeed); this.scale = 1.95;
            this.damage = Math.round(35 * dmgMult); this.attackRange = 1.4;
            this.attackCooldown = 1.5; this.knockbackResistance = 0.3; this.scoreValue = 260;
        } else if (type === 'spitter') {
            this.baseHealth = 220;
            this.baseArmor = 60;
            this.armorClass = 1;
            this.speed = Math.min(4.2 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.8;
            this.damage = Math.round(32 * dmgMult);
            this.attackRange = 1.35;
            this.attackCooldown = 2.0;
            this.knockbackResistance = 0.25;
            this.scoreValue = 220;
        } else if (type === 'boss') {
            this.baseHealth = 7500;
            this.baseArmor = 3500;
            this.armorClass = 4;
            this.speed = Math.min(5.4 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 5.2;
            this.damage = Math.round(110 * dmgMult);
            this.attackRange = 4.5;
            this.attackCooldown = 1.3;
            this.knockbackResistance = 1.0;
            this.scoreValue = 3500;
        } else if (type === 'crawler') {
            this.baseHealth = 95;
            this.baseArmor = 0;
            this.armorClass = 0;
            this.speed = Math.min(6.2 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 0.85;
            this.damage = Math.round(30 * dmgMult);
            this.attackRange = 0.95;
            this.attackCooldown = 0.55;
            this.knockbackResistance = 0.05;
            this.scoreValue = 120;
        } else if (type === 'boomer') {
            this.baseHealth = 280;
            this.baseArmor = 30;
            this.armorClass = 1;
            this.speed = Math.min(3.2 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.7;
            this.damage = Math.round(80 * dmgMult);
            this.attackRange = 1.4;
            this.attackCooldown = 1.8;
            this.knockbackResistance = 0.5;
            this.scoreValue = 200;
        } else {
            // Zombie thuong (walker): Mau trau hon nhieu, sat thuong cao
            this.baseHealth = 180;
            this.baseArmor = 30;
            this.armorClass = 1;
            this.speed = Math.min(5.0 * (1.0 + survivalMinutes * 0.025), maxAllowedSpeed);
            this.scale = 1.65;
            this.damage = Math.round(28 * dmgMult);
            this.attackRange = 1.25;
            this.attackCooldown = 0.9;
            this.knockbackResistance = 0.1;
            this.scoreValue = 150;
        }

        this.maxHealth = Math.round(this.baseHealth * phaseMult);
        this.health = this.maxHealth;
        this.maxArmor = Math.round(this.baseArmor * phaseMult);
        this.armor = this.maxArmor;
    }

    setupVisuals(models) {
        if (!models) return;

        let baseModelKey = 'mini-male-f';
        if (this.type === 'sprinter' || this.type === 'shadow_stalker') {
            baseModelKey = 'mini-female-a';
        } else if (this.type === 'spitter' || this.type === 'toxic_spitter') {
            baseModelKey = 'mini-male-a';
        } else if (this.type === 'boss') {
            baseModelKey = 'mini-male-c';
        } else if (this.type === 'crawler') {
            baseModelKey = 'mini-female-d';
        } else if (this.type === 'tank' || this.type === 'orc_brawler' || this.type === 'giant') {
            baseModelKey = 'mini-male-f';
        } else {
            // Walker, bomber...
            baseModelKey = Math.random() < 0.5 ? 'mini-male-f' : 'mini-female-d';
        }

        const base = models[baseModelKey] || models['mini-male-f'] || models['character-zombie'] || Object.values(models)[0];
        if (!base) return;

        this.mesh = SkeletonUtils.clone(base.scene);
        this.mesh.scale.set(this.scale, this.scale, this.scale);
        if (this.type === 'sprinter') this.mesh.scale.multiply(new THREE.Vector3(0.85, 1, 0.85));
        if (this.type === 'giant' || this.type === 'tank') this.mesh.scale.multiply(new THREE.Vector3(1.25, 1.15, 1.25));
        if (this.type === 'boss') this.mesh.scale.multiply(new THREE.Vector3(1.6, 1.45, 1.6));
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = Math.random() * Math.PI * 2;

        this.meshMaterials = [];
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material = child.material.clone();
                this.meshMaterials.push(child.material);

                // Áp dụng tông màu Zombie cho mô hình Mini
                if (this.type === 'boss') {
                    child.material.color.setHex(0x992233);
                    child.material.emissive = new THREE.Color(0xaa1122);
                    child.material.emissiveIntensity = 0.35;
                } else if (this.type === 'spitter' || this.type === 'toxic_spitter') {
                    child.material.color.setHex(0x448833);
                    child.material.emissive = new THREE.Color(0x22cc44);
                    child.material.emissiveIntensity = 0.30;
                } else if (this.type === 'sprinter' || this.type === 'shadow_stalker') {
                    child.material.color.setHex(0x557766);
                    child.material.emissive = new THREE.Color(0x38bdf8);
                    child.material.emissiveIntensity = 0.20;
                } else if (this.type === 'tank' || this.type === 'orc_brawler' || this.type === 'giant') {
                    child.material.color.setHex(0x556644);
                    child.material.emissive = new THREE.Color(0x336622);
                    child.material.emissiveIntensity = 0.25;
                } else {
                    // Zombie Walker thường (màu da xanh tái)
                    child.material.color.setHex(0x668866);
                }
            }
        });

        this.addMutationVisuals();
        this.scene.add(this.mesh);

        const barColor = this.type === 'spitter' ? 0x99ff22 : this.type === 'boss' ? 0xff2255 : 0xff4d5f;
        this.healthBar = new HealthBar3D(this.scene, {
            width: this.type === 'giant' || this.type === 'boss' ? 1.8 : 1.15,
            offsetY: this.scale * 1.05,
            color: barColor
        });
        this.healthBar.update(this.position, this.health, this.maxHealth, true);

        if (base.animations && base.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.mesh);
            base.animations.forEach(clip => {
                this.animations[clip.name] = this.mixer.clipAction(clip);
            });

            const startAnim = (this.type === 'sprinter') ? 'sprint' : 'walk';
            this.playAnimation(this.animations[startAnim] ? startAnim : 'walk');
        }
    }

    addMutationVisuals() {
        if (!this.mesh) return;
        const color = this.type === 'spitter' ? 0x99ff22 : this.type === 'giant' ? 0xff6622 : 0xffdd33;
        this.mutationParts = [];
        const add = (geometry, x, y, z, anchor = 'torso') => {
            const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.5 });
            material.userData.baseEmissive = color;
            const part = new THREE.Mesh(geometry, material);
            part.position.set(x, y, z);
            part.castShadow = true;
            (this.mesh.getObjectByName(anchor) || this.mesh).add(part);
            this.mutationParts.push(part);
            return part;
        };

        if (this.type === 'bomber') {
            add(new THREE.SphereGeometry(0.2, 8, 6), -0.2, 0.25, -0.2);
            add(new THREE.SphereGeometry(0.2, 8, 6), 0.2, 0.25, -0.2);
        } else if (this.type === 'spitter') {
            add(new THREE.IcosahedronGeometry(0.16, 1), -0.17, 0.17, -0.16);
            add(new THREE.IcosahedronGeometry(0.16, 1), 0.17, 0.17, -0.16);
            this.spitMouth = add(new THREE.IcosahedronGeometry(0.075, 1), 0, 0.16, 0.19, 'head');
        } else if (this.type === 'giant') {
            add(new THREE.BoxGeometry(0.18, 0.12, 0.26), -0.21, 0.17, 0);
            add(new THREE.BoxGeometry(0.18, 0.12, 0.26), 0.21, 0.17, 0);
            add(new THREE.ConeGeometry(0.07, 0.22, 4), -0.14, 0.42, 0, 'head');
            add(new THREE.ConeGeometry(0.07, 0.22, 4), 0.14, 0.42, 0, 'head');
            this.stompRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40),
                new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
            this.stompRing.rotation.x = -Math.PI / 2;
            this.stompRing.scale.setScalar(this.attackRange);
            this.stompRing.visible = false;
            this.scene.add(this.stompRing);
        } else if (this.type === 'sprinter') {
            for (const x of [-0.12, 0, 0.12]) {
                const fin = add(new THREE.ConeGeometry(0.05, 0.28, 3), x, 0.17, -0.14);
                fin.rotation.x = -0.65;
            }
        }
    }

    // Tai kich hoat tu Object Pool de tranh cap phat lai bo nho
    activate(position, type, survivalMinutes = 0, playerSpeed = 7.5, phaseNum = 1) {
        this.position.copy(position);
        this.position.y = 0;
        this.active = true;
        this.isDead = false;
        this.knockbackVelocity.set(0, 0, 0);
        this.combatState = ZombieCombatState.CHASE;
        this.combatTimer = 0;
        this.flashTimer = 0;
        this.spitCharge = 0;
        this.rangedCooldown = 1.5;
        this.acidTarget = null;
        this.bossSkillTimer = 4.0;
        this.bossPhase = phaseNum;
        this.navigationPath = null;
        this.pathTimer = 0;

        // Rebuild visuals when a pooled zombie changes species.
        if (this.type !== type) this.disposeVisuals();
        this.active = true; this.isDead = false;
        this.applyStats(type, phaseNum, survivalMinutes, playerSpeed);
        if (!this.mesh) this.setupVisuals(this.gltfModels);

        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.visible = true;
            this.setEmissiveColor(0x000000, 0);
        }
        if (this.healthBar) {
            this.healthBar.update(this.position, this.health, this.maxHealth, true);
        }
    }

    // Thu hoi ve Object Pool
    deactivate() {
        this.active = false;
        this.isDead = true;
        if (this.mesh) this.mesh.visible = false;
        if (this.stompRing) this.stompRing.visible = false;
        if (this.healthBar) this.healthBar.update(this.position, 0, this.maxHealth, false);
    }

    playAnimation(name, duration = 0.15) {
        this.animationName = name;
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

    setEmissiveColor(colorHex, intensity = 0.5) {
        if (!this.meshMaterials) return;
        for (let i = 0; i < this.meshMaterials.length; i++) {
            const mat = this.meshMaterials[i];
            if (mat && mat.emissive) {
                mat.emissive.setHex(colorHex);
                mat.emissiveIntensity = intensity;
            }
        }
    }

    takeDamage(amount, penPower = 1, isCrit = false, hitDir = null) {
        if (this.isDead || !this.active) return { isPenetrated: false, isBlunt: false, healthDamage: 0, armorDamage: 0 };

        // Hiệu ứng Ăn Mòn: tăng 25% sát thương nhận vào
        if (this.corrosiveTimer > 0) {
            amount = Math.round(amount * 1.25);
        }

        // Hiệu ứng Suy Yếu mục tiêu từ Radar (Vulnerability Scan): tăng thêm 35% sát thương nhận vào
        if (this.vulnerableTimer > 0) {
            amount = Math.round(amount * (this.vulnerableMultiplier || 1.35));
        }

        const ac = this.armorClass || 0;
        const isPenetrated = (penPower >= ac) || (this.armor <= 0);
        let healthDmg = 0;
        let armorDmg = 0;
        let isBlunt = false;

        if (isPenetrated) {
            // Dan xuyen giap: Tru thang vao Mau
            healthDmg = Math.round(amount * 0.88);
            armorDmg = Math.round(amount * 0.32);
            this.health -= healthDmg;
            this.armor = Math.max(0, this.armor - armorDmg);
            this.flashTimer = 0.12;
            sounds.play('enemyHurt', { volume: 0.5, pitchVariation: 0.2 });
            this.setEmissiveColor(isCrit ? 0xff0022 : 0xcc3300, 0.85);
        } else {
            // Bi giap can: Dan tru vao Giap, sat thuong cun vao Mau
            armorDmg = Math.min(this.armor, Math.round(amount));
            this.armor = Math.max(0, this.armor - armorDmg);
            healthDmg = Math.min(2, Math.max(1, Math.round(amount * 0.08)));
            this.health -= healthDmg;
            isBlunt = true;
            this.flashTimer = 0.08;
            sounds.playArmorDeflect();
            this.setEmissiveColor(0xffffff, 0.8);
        }

        // Hit Stun va Knockback: Ngat don danh neu dang tu luc (Wind-up), khung 0.1s va day lui
        if (this.combatState === ZombieCombatState.WINDUP) {
            // Ngat don dang tu luc
            this.combatState = ZombieCombatState.STUNNED;
            this.combatTimer = this.stunDuration;
        } else if (this.combatState === ZombieCombatState.CHASE) {
            this.combatState = ZombieCombatState.STUNNED;
            this.combatTimer = this.stunDuration;
        }

        // Tính toán lực đẩy lùi knockback ngược hướng đạn bay (chuẩn hóa vector hướng và kẹp trần vận tốc)
        if (hitDir && this.type !== 'boss') {
            const baseKb = this.type === 'giant' ? 0.08 : this.type === 'tank' ? 0.15 : 0.55;
            const effectiveKb = baseKb * Math.max(0, 1.0 - (this.knockbackResistance || 0));
            const kbDir = new THREE.Vector3(hitDir.x || 0, 0, hitDir.z || 0);
            if (kbDir.lengthSq() > 0.0001) {
                kbDir.normalize();
                this.knockbackVelocity.addScaledVector(kbDir, effectiveKb * 7.5);
                // Giới hạn trần vận tốc đẩy lùi để tránh zombie bị văng phi lý ra ngoài bản đồ
                if (this.knockbackVelocity.length() > 5.5) {
                    this.knockbackVelocity.clampLength(0, 5.5);
                }
            }
        }

        if (this.health <= 0) {
            this.die();
        }

        return {
            isPenetrated,
            isBlunt,
            healthDamage: healthDmg,
            armorDamage: armorDmg,
            isCrit
        };
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        sounds.play('enemyDestroy', { volume: this.type === 'boss' ? 1.0 : 0.75 });
        // Keep the pool slot reserved until WaveManager awards this kill.
        // Releasing here skipped onEnemyKilled and could respawn the same object first.
        if (this.mesh) this.mesh.visible = false;
        if (this.stompRing) this.stompRing.visible = false;
        this.healthBar?.update(this.position, 0, this.maxHealth, false);
    }

    disposeVisuals() {
        this.deactivate();
        this.healthBar?.dispose();
        this.healthBar = null;
        if (this.stompRing) {
            this.stompRing.removeFromParent();
            this.stompRing.geometry?.dispose();
            this.stompRing.material?.dispose();
            this.stompRing = null;
        }
        if (this.mesh) {
            this.mesh.removeFromParent();
            this.mesh.traverse(c => { if (c.isMesh) c.material?.dispose(); });
            for (const part of this.mutationParts || []) part.geometry?.dispose();
            this.mesh = null;
        }
    }

    checkHit(startPos, endPos, ray) {
        if (!this.mesh || this.isDead || !this.active) return { hit: false };

        const height = this.scale * 1.7; // Tinh chieu cao tuong doi cua zombie
        const posX = this.mesh ? this.mesh.position.x : this.position.x;
        const posY = this.mesh ? this.mesh.position.y : this.position.y;
        const posZ = this.mesh ? this.mesh.position.z : this.position.z;
        
        // Dung Bounding Box hinh tru thay vi hinh cau de cover toan bo chieu cao
        const boxMin = new THREE.Vector3(posX - this.radius, posY, posZ - this.radius);
        const boxMax = new THREE.Vector3(posX + this.radius, posY + height, posZ + this.radius);
        
        // Dùng biến tạm để tránh rác bộ nhớ (Zero GC)
        if (!this._hitBox) this._hitBox = new THREE.Box3();
        this._hitBox.min.copy(boxMin);
        this._hitBox.max.copy(boxMax);

        const hit = ray.intersectBox(this._hitBox, _tempHitPoint);

        if (hit && startPos.distanceTo(_tempHitPoint) <= startPos.distanceTo(endPos)) {
            // Headshot nam o 20% phan dau tren cung
            const isCrit = (_tempHitPoint.y > this.position.y + height * 0.8);
            return { hit: true, point: _tempHitPoint.clone(), isCrit: isCrit };
        }

        return { hit: false };
    }

    update(delta, player, arena, allZombies, navigationBudget = null) {
        if (this.isDead || !this.mesh || !this.active) return;
        this.arena = arena;

        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Phan ra van toc day lui Knockback
        if (this.knockbackVelocity.lengthSq() > 0.01) {
            const kbX = this.knockbackVelocity.x * delta;
            const kbZ = this.knockbackVelocity.z * delta;
            if (arena?.moveCharacter) {
                arena.moveCharacter(this.position, kbX, kbZ, this.radius);
            } else {
                this.position.x += kbX;
                this.position.z += kbZ;
            }
            this.knockbackVelocity.multiplyScalar(Math.max(0, 1.0 - delta * 12.0));
        }

        // Reset hit flash sau khi trung dan
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
            if (this.flashTimer <= 0) {
                if (this.combatState !== ZombieCombatState.WINDUP) {
                    this.setEmissiveColor(0x000000, 0);
                }
            }
        }

        // Xử lý hiệu ứng Hỏa thiêu đốt (DoT) & Ăn mòn
        if (this.burnTimer > 0) {
            this.burnTimer -= delta;
            this.burnTick = (this.burnTick || 0) + delta;
            if (this.burnTick >= 0.5) {
                this.burnTick = 0;
                this.takeDamage(this.burnDamage || 8, 1, false, null);
            }
        }
        // Xử lý hiệu ứng Suy Yếu (Vulnerability)
        if (this.vulnerableTimer > 0) {
            this.vulnerableTimer -= delta;
        }

        // Xử lý hiệu ứng Đóng băng (Freeze): bất động hoàn toàn
        if (this.freezeTimer > 0) {
            this.freezeTimer -= delta;
            this.playAnimation('idle');
            this.setEmissiveColor(0x00f0ff, 0.85);
            if (this.freezeTimer <= 0) {
                this.setEmissiveColor(0x000000, 0);
            }
            return;
        }

        if (player.isDead || player.isDowned) {
            this.playAnimation('idle');
            return;
        }

        // Màn khói mù mịt (Smoke Grenade): người chơi tàng hình trong khói, zombie mất dấu mục tiêu
        if (player.isInSmoke) {
            this.combatState = ZombieCombatState.CHASE;
            this.spitCharge = 0;
            this.playAnimation('walk');

            // 1. Lực tách bầy chống quái chồng lấn
            _tempSeparation.set(0, 0, 0);
            let neighborCount = 0;
            for (let i = 0; i < allZombies.length; i++) {
                const other = allZombies[i];
                if (other === this || other.isDead || !other.active) continue;
                _tempDiff.subVectors(this.position, other.position);
                _tempDiff.y = 0;
                const minSpace = this.radius + other.radius;
                const distanceSq = _tempDiff.lengthSq();
                if (distanceSq > 0.0001 && distanceSq < minSpace * minSpace) {
                    const d = Math.sqrt(distanceSq);
                    _tempDiff.multiplyScalar((minSpace - d) / (minSpace * d));
                    _tempSeparation.add(_tempDiff);
                    neighborCount++;
                }
            }
            if (neighborCount > 0) {
                _tempSeparation.multiplyScalar(4.0);
            }

            // 2. Đi lang thang dò dẫm tốc độ chậm (Confused Wandering), không tấn công
            this.wanderAngle = (this.wanderAngle ?? (Math.random() * Math.PI * 2)) + (Math.random() - 0.5) * delta * 2.0;
            _tempDesiredDir.set(Math.cos(this.wanderAngle), 0, Math.sin(this.wanderAngle));

            _tempMoveVel.set(0, 0, 0);
            const wanderSpeed = this.speed * 0.35;
            _tempMoveVel.addScaledVector(_tempDesiredDir, wanderSpeed);
            _tempMoveVel.add(_tempSeparation);

            if (arena?.moveCharacter) {
                arena.moveCharacter(this.position, _tempMoveVel.x * delta, _tempMoveVel.z * delta, this.radius);
            } else if (arena?.checkCollision) {
                _tempCheckPos.copy(this.position); _tempCheckPos.x += _tempMoveVel.x * delta;
                if (!arena.checkCollision(_tempCheckPos, this.radius)) this.position.x = _tempCheckPos.x;
                _tempCheckPos.copy(this.position); _tempCheckPos.z += _tempMoveVel.z * delta;
                if (!arena.checkCollision(_tempCheckPos, this.radius)) this.position.z = _tempCheckPos.z;
            } else {
                this.position.x += _tempMoveVel.x * delta;
                this.position.z += _tempMoveVel.z * delta;
            }

            // Xoay hướng mặt theo hướng bước đi dò tìm
            if (_tempMoveVel.lengthSq() > 0.05) {
                const targetYaw = Math.atan2(_tempMoveVel.x, _tempMoveVel.z);
                let diff = (targetYaw - this.mesh.rotation.y) % (Math.PI * 2);
                if (diff < -Math.PI) diff += Math.PI * 2;
                if (diff > Math.PI) diff -= Math.PI * 2;
                this.mesh.rotation.y += diff * Math.min(1.0, delta * 8.0);
            }

            this.mesh.position.copy(this.position);
            this.healthBar?.update(this.position, this.health, this.maxHealth, true);
            return;
        }

        // 1. Tinh toan culy va huong truc dien toi Player (Pure Chaser AI)
        _tempToPlayer.subVectors(player.position, this.position);
        _tempToPlayer.y = 0;
        const dist = _tempToPlayer.length();
        if (dist > 0.0001) _tempToPlayer.multiplyScalar(1 / dist);

        this.rangedCooldown = Math.max(0, this.rangedCooldown - delta);
        if (this.type === 'spitter' && this.weapons && this.combatState !== ZombieCombatState.STUNNED) {
            if (this.spitCharge > 0) {
                this.spitCharge -= delta;
                this.setEmissiveColor(0x99ff22, .9);
                if (this.spitCharge <= 0) {
                    const origin = this.position.clone().add(new THREE.Vector3(0,1.2,0));
                    if (!arena?.hasLineOfSight || arena.hasLineOfSight(origin,this.acidTarget))
                        this.weapons.shootEnemyBolt(origin,this.acidTarget,this.damage,12,true);
                    this.rangedCooldown = 2.8; this.setEmissiveColor(0,0);
                }
            } else if (this.rangedCooldown <= 0 && dist >= 3 && dist <= 18 &&
                (!arena?.hasLineOfSight || arena.hasLineOfSight(this.position,player.position))) {
                this.acidTarget = player.position.clone().add(new THREE.Vector3(0,.8,0));
                this.spitCharge = .65;
            }
        }
        if (this.type === 'bomber' && this.bombs && this.rangedCooldown <= 0 && dist <= 22 &&
            this.combatState !== ZombieCombatState.STUNNED) {
            this.bombs.spawn(player.position, this.damage);
            this.rangedCooldown = 5.5;
            sounds?.play?.('enemyAttack', { volume: 0.75, pitchVariation: 0.2 });
        }

        // 2. Swarm separation: Thuat toan day mem chong chong lan quai, giup bay tu dan hang ngang
        _tempSeparation.set(0, 0, 0);
        let neighborCount = 0;
        for (let i = 0; i < allZombies.length; i++) {
            const other = allZombies[i];
            if (other === this || other.isDead || !other.active) continue;
            _tempDiff.subVectors(this.position, other.position);
            _tempDiff.y = 0;
            const minSpace = this.radius + other.radius;
            const distanceSq = _tempDiff.lengthSq();
            if (distanceSq > 0.0001 && distanceSq < minSpace * minSpace) {
                const d = Math.sqrt(distanceSq);
                _tempDiff.multiplyScalar((minSpace - d) / (minSpace * d));
                _tempSeparation.add(_tempDiff);
                neighborCount++;
            }
        }
        if (neighborCount > 0) {
            _tempSeparation.multiplyScalar(4.0);
        }

        // 3. May trang thai chu ky chien dau (Combat Loop: Wind-up -> Hit -> Recovery)
        if (this.combatState === ZombieCombatState.STUNNED) {
            // Bi ngat don va khung lai trong 0.1s
            this.combatTimer -= delta;
            if (this.combatTimer <= 0) {
                this.combatState = ZombieCombatState.CHASE;
            }
        } else if (this.combatState === ZombieCombatState.WINDUP) {
            // Pha 1: Tu luc (~0.25s), Zombie dung buoc hoan toan
            this.combatTimer -= delta;

            // Chi thi hinh anh: Chop do manh dan va model rung nhe bao hieu sap vung don
            const progress = 1.0 - Math.max(0, this.combatTimer / this.windupDuration);
            this.setEmissiveColor(0xff0022, 0.4 + progress * 0.5);

            // Rung nhe vi tri mesh
            const shake = 0.05;
            this.mesh.position.x = this.position.x + (Math.random() - 0.5) * shake;
            this.mesh.position.z = this.position.z + (Math.random() - 0.5) * shake;

            if (this.combatTimer <= 0) {
                // Pha 2: Gay sat thuong (Impact)
                this.setEmissiveColor(0x000000, 0);
                this.executeImpact(player, dist);
            }
        } else if (this.combatState === ZombieCombatState.RECOVERY) {
            // Pha 3: Khung lai sau don danh (~0.8s - 1.0s), dung chon chan tai cho, khong xoay nguoi
            this.combatTimer -= delta;
            if (this.combatTimer <= 0) {
                this.combatState = ZombieCombatState.CHASE;
                const runAnim = (this.type === 'sprinter') ? 'sprint' : 'walk';
                this.playAnimation(this.animations[runAnim] ? runAnim : 'walk');
            }
        } else {
            // Trạng thái CHASE: San duoi va ap sat
            if (dist <= this.attackRange) {
                // Buoc vao tam danh -> Chuyen sang Pha Tu luc (Wind-up)
                this.combatState = ZombieCombatState.WINDUP;
                this.combatTimer = this.windupDuration;
            } else {
                // Di chuyen truc dien toi nguoi choi ket hop ne vat can
                _tempMoveVel.set(0, 0, 0);
                _tempDesiredDir.copy(_tempToPlayer);

                this.pathTimer = (this.pathTimer || 0) - delta;
                if (arena?.findNavigationPath) {
                    if ((this.pathTimer <= 0 || !this.navigationPath) &&
                        (!navigationBudget || (navigationBudget.remaining > 0 && navigationBudget.allowed.has(this)))) {
                        if (navigationBudget) navigationBudget.remaining--;
                        this.navigationPath = arena.findNavigationPath(this.position, player.position, this.radius);
                        this.pathTimer = 0.9;
                    }
                    while (this.navigationPath?.length && this.position.distanceToSquared(this.navigationPath[0]) < 0.0625) {
                        this.navigationPath.shift();
                    }
                    if (this.navigationPath?.length) {
                        _tempDesiredDir.subVectors(this.navigationPath[0], this.position).setY(0).normalize();
                    }
                }

                _tempDesiredDir.normalize();
                let currentSpeed = this.speed;
                if (this.slowTimer > 0) {
                    this.slowTimer -= delta;
                    currentSpeed *= (this.slowFactor || 0.55);
                }
                _tempMoveVel.addScaledVector(_tempDesiredDir, currentSpeed);
                _tempMoveVel.add(_tempSeparation);

                // Di chuyen nhan vat tren Arena
                if (arena?.moveCharacter) {
                    arena.moveCharacter(this.position, _tempMoveVel.x * delta, _tempMoveVel.z * delta, this.radius);
                } else if (arena?.checkCollision) {
                    _tempCheckPos.copy(this.position); _tempCheckPos.x += _tempMoveVel.x * delta;
                    if (!arena.checkCollision(_tempCheckPos, this.radius)) this.position.x = _tempCheckPos.x;
                    _tempCheckPos.copy(this.position); _tempCheckPos.z += _tempMoveVel.z * delta;
                    if (!arena.checkCollision(_tempCheckPos, this.radius)) this.position.z = _tempCheckPos.z;
                } else {
                    this.position.x += _tempMoveVel.x * delta;
                    this.position.z += _tempMoveVel.z * delta;
                }

                // Xoay huong mat theo huong di chuyen / huong player
                let targetYaw = Math.atan2(_tempToPlayer.x, _tempToPlayer.z);
                if (_tempMoveVel.lengthSq() > 0.5) {
                    targetYaw = Math.atan2(_tempMoveVel.x, _tempMoveVel.z);
                }
                let diff = (targetYaw - this.mesh.rotation.y) % (Math.PI * 2);
                if (diff < -Math.PI) diff += Math.PI * 2;
                if (diff > Math.PI) diff -= Math.PI * 2;
                this.mesh.rotation.y += diff * Math.min(1.0, delta * 14);
            }
        }

        // Boss Skills Logic
        if (this.type === 'boss' && this.combatState === ZombieCombatState.CHASE) {
            this.bossSkillTimer -= delta;
            if (this.bossSkillTimer <= 0) {
                this.bossSkillTimer = 5.0 - Math.min(2.5, this.bossPhase * 0.1); // Cooldown decreases as phases go up
                const skillRoll = Math.random();
                
                if (skillRoll < 0.33) {
                    // Skill 1: Bloodlust Sprint
                    this.speed += 4.0;
                    this.setEmissiveColor(0xff0000, 0.8);
                    setTimeout(() => { if (!this.isDead) this.speed -= 4.0; }, 2500 + this.bossPhase * 100);
                    sounds.play('enemyAttack', { pitchVariation: 0.4 });
                } else if (skillRoll < 0.66 && this.weapons) {
                    // Skill 2: Acid Spit Volley
                    this.playAnimation('attack', 0.2);
                    this.setEmissiveColor(0x00ff00, 0.8);
                    const projectiles = Math.min(8, 3 + Math.floor(this.bossPhase / 2));
                    for (let i = 0; i < projectiles; i++) {
                        setTimeout(() => {
                            if (!this.isDead && this.weapons && !player.isDead && !player.isDowned) {
                                _tempSpitOrigin.copy(this.position);
                                _tempSpitOrigin.y += 1.8;
                                this.weapons.shootEnemyBolt(_tempSpitOrigin, player.position.clone(), this.damage * 0.5, 30 + this.bossPhase * 2, true);
                            }
                        }, i * 250);
                    }
                } else {
                    // Skill 3: Ground Slam
                    this.combatState = ZombieCombatState.WINDUP;
                    this.combatTimer = 0.8; // Long windup
                    this.setEmissiveColor(0xffaa00, 1.0);
                    this.isGroundSlamming = true; // Flag for executeImpact
                }
            }
        }

        // Cap nhat vi tri mesh va thanh mau neu khong trong pha rung
        if (this.combatState !== ZombieCombatState.WINDUP) {
            this.mesh.position.copy(this.position);
        }
        this.healthBar?.update(this.position, this.health, this.maxHealth, true);

        // Cap nhat stomp ring cua quai Giant neu co
        if (this.stompRing) {
            this.stompRing.position.copy(this.position);
            this.stompRing.position.y = 0.04;
            this.stompRing.visible = (this.combatState === ZombieCombatState.WINDUP);
        }
    }

    // Pha 2: Kiem tra va gay sat thuong (Impact)
    executeImpact(player, currentDist) {
        if (this.isGroundSlamming) {
            this.isGroundSlamming = false;
            // Ground Slam AoE
            const slamRadius = 6.0 + (this.bossPhase || 1) * 0.5;
            this.particles?.createImpactSparks(this.position, new THREE.Vector3(0, 1, 0), 0xffaa00, 30);
            sounds.play('enemyDestroy', { volume: 1.0 });
            
            const targets = Array.isArray(player) ? player : [player];
            for (const t of targets) {
                if (t.isDead || t.isDowned) continue;
                const d = t.position.distanceTo(this.position);
                if (d <= slamRadius) {
                    const hitDir = new THREE.Vector3().subVectors(t.position, this.position).normalize();
                    t.takeDamage(this.damage * 1.5, hitDir);
                    if (t.applyKickbackAndShake) t.applyKickbackAndShake(new THREE.Vector2(0, 0), 0.8);
                }
            }
        } else {
            // Kiem tra lai khoang cach: Neu nguoi choi van trong tam -> Danh trung
            if (currentDist <= this.attackRange * 1.15) {
                this.applyMeleeDamage(player);
            }
        }

        // Chuyen sang Pha 3: Khung hoi phuc (Recovery)
        this.combatState = ZombieCombatState.RECOVERY;
        this.combatTimer = this.recoveryDuration;
    }

    applyMeleeDamage(player) {
        sounds.play('enemyAttack', { volume: 0.7, pitchVariation: 0.15 });
        const hitDir = new THREE.Vector3().subVectors(player.position, this.position).normalize();
        
        // Tru mau nguoi choi
        player.takeDamage(this.damage, hitDir);

        // Kich hoat rung man hinh chấn thương va flash do man hinh
        if (typeof player.applyKickbackAndShake === 'function') {
            player.applyKickbackAndShake(new THREE.Vector2(0, 0), 0.35);
        } else {
            player.screenShakeTrauma = Math.min(1.0, (player.screenShakeTrauma || 0) + 0.35);
        }

        // Tao tia mau va vet cao chem
        _tempClawPos.copy(player.position);
        _tempClawPos.y += 1.1;
        this.particles?.createImpactSparks(_tempClawPos, hitDir.clone().negate(), 0xff1133, 10);
    }
}

// Bo sinh quai vo tan voi Object Pool va leo thang do kho theo thoi gian
export class WaveManager {
    constructor(scene, gltfLoader, weapons, particles, arena) {
        this.scene = scene;
        this.loader = gltfLoader;
        this.weapons = weapons;
        this.particles = particles;
        this.arena = arena;
        this.models = {};
        this.bombs = new SkyBombs(scene, particles);

        // Danh sach quan ly quai tren san va Pool tai su dung
        this.enemies = [];
        this.pool = [];
        this.nextId = 1;

        // Thoi gian sinh ton va bo dem spawn
        this.survivalTimer = 0;       // Tong so giay song sot
        this.batchSpawnTimer = 0;     // Bo dem spawn theo dot
        this.currentPhase = 1;
        this.isWaveInProgress = true;
        this.spawnQueue = [];

        // Cu ly spawn vong tron quanh Player phu hop map 72x72
        this.minSpawnDistance = 12.0;
        this.maxSpawnDistance = 18.0;

        this.navigationBudget = { remaining: 0, allowed: new Set() };
        this.navigationCursor = 0;
    }

    async init() {
        if (!this.loader) return;
        const load = (name, file) => new Promise(resolve => {
            this.loader.load(`assets/models/${file}`, (gltf) => {
                this.models[name] = gltf;
                resolve();
            }, undefined, () => resolve());
        });

        await Promise.all([
            load('mini-male-f', 'character-male-f.glb'),
            load('mini-female-d', 'character-female-d.glb'),
            load('mini-female-a', 'character-female-a.glb'),
            load('mini-male-a', 'character-male-a.glb'),
            load('mini-male-c', 'character-male-c.glb')
        ]);
    }

    startWave(phaseNum = 1) {
        this.currentPhase = phaseNum;
        this.isWaveInProgress = true;
        this.hasSpawnedBoss = false;
        // Tổng số lượng quái cho đợt tăng vọt để đông đảo, dồn dập
        this.totalWaveEnemies = Math.floor(45 + phaseNum * 16);
        this.remainingToSpawn = this.totalWaveEnemies;
        // Giới hạn số quái tối đa cùng xuất hiện trên sân (Tăng lên 30 - 50 con cùng lúc)
        this.maxOnField = Math.min(50, 22 + Math.floor(phaseNum * 4));
        this.batchInterval = Math.max(0.65, 1.3 - phaseNum * 0.1);
        this.batchSpawnTimer = 0;
    }

    // Chon loai quai xuat hien dua tren moc thoi gian song sot (phut)
    determineArchetype(survivalMinutes) {
        const roll = Math.random();
        if ((this.currentPhase >= 3 || survivalMinutes >= 1.5) && roll < .10) return 'bomber';
        if ((this.currentPhase >= 2 || survivalMinutes >= .75) && roll >= .10 && roll < .28) return 'spitter';
        if (survivalMinutes < 2.0) {
            if (roll < 0.15) return 'shadow_stalker';
            return roll < 0.4 ? 'crawler' : 'walker';
        } else if (survivalMinutes < 4.0) {
            if (roll < 0.15) return 'cyber_enforcer';
            if (roll < 0.30) return 'sprinter';
            if (roll < 0.50) return 'crawler';
            return 'walker';
        } else if (survivalMinutes < 6.0) {
            if (roll < 0.12) return 'orc_brawler';
            if (roll < 0.24) return 'cyber_enforcer';
            if (roll < 0.36) return 'shadow_stalker';
            if (roll < 0.48) return 'toxic_spitter';
            if (roll < 0.65) return 'boomer';
            return 'walker';
        } else {
            if (roll < 0.12) return 'orc_brawler';
            if (roll < 0.22) return 'tank';
            if (roll < 0.32) return 'giant';
            if (roll < 0.45) return 'cyber_enforcer';
            if (roll < 0.60) return 'shadow_stalker';
            if (roll < 0.75) return 'toxic_spitter';
            return 'walker';
        }
    }

    // Tinh toan toa do spawn: Uu tien 60% spawn truc tiep tu 8 cong khong gian
    calculateOffscreenSpawnPosition(player) {
        const center = player?.position || new THREE.Vector3(0, 0, 0);
        const arenaRadius = this.arena?.radius || 34;

        // Ưu tiên 60% xuất hiện từ các cổng không gian
        const portals = this.arena?.getPortals?.();
        if (portals && portals.length > 0 && Math.random() < 0.6) {
            const portal = portals[Math.floor(Math.random() * portals.length)];
            const pos = this.arena.getPortalSpawnPosition(portal, 0.7);
            if (pos) return pos;
        }

        for (let attempts = 0; attempts < 10; attempts++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.minSpawnDistance + Math.random() * (this.maxSpawnDistance - this.minSpawnDistance);
            const spawnX = center.x + Math.cos(angle) * distance;
            const spawnZ = center.z + Math.sin(angle) * distance;
            const spawnPos = new THREE.Vector3(spawnX, 0, spawnZ);

            // Kiem tra hop le voi ranh gioi va vat can cua Arena
            if (this.arena?.checkCollision && this.arena.checkCollision(spawnPos, 0.8)) {
                continue;
            }
            if (spawnPos.length() > arenaRadius - 2) {
                spawnPos.clampLength(0, arenaRadius - 3);
            }
            if (!this.arena?.checkCollision || !this.arena.checkCollision(spawnPos, 0.8)) {
                return spawnPos;
            }
        }

        // Fallback: lay vi tri portal
        if (portals && portals.length > 0) {
            const portal = portals[Math.floor(Math.random() * portals.length)];
            return this.arena.getPortalSpawnPosition(portal, 0.7) || new THREE.Vector3(0, 0, -16);
        }
        return new THREE.Vector3(center.x + 10, 0, center.z);
    }

    // Lay doi tuong Zombie tu Object Pool hoac khoi tao moi
    acquireZombie(type, position, survivalMinutes, playerSpeed) {
        let zombie = null;
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].active) {
                zombie = this.pool[i];
                break;
            }
        }

        if (!zombie) {
            zombie = new Zombie(
                this.scene,
                type,
                position,
                this.models,
                this.particles,
                this.currentPhase,
                this.weapons
            );
            this.pool.push(zombie);
        }

        zombie.id = this.nextId++;
        zombie.arena = this.arena;
        zombie.bombs = this.bombs;
        zombie.activate(position, type, survivalMinutes, playerSpeed, this.currentPhase);
        return zombie;
    }

    spawnSingleEnemy(targetPlayer, survivalMinutes, forceType = null) {
        const type = forceType || this.determineArchetype(survivalMinutes);
        const spawnPos = this.calculateOffscreenSpawnPosition(targetPlayer);
        const playerSpeed = targetPlayer?.speed || 7.5;

        // Hieu ung nang luong portal / tia dien khi quai spawn
        this.particles?.createImpactSparks(spawnPos, _upAxis, 0xb026ff, 12);

        const zombie = this.acquireZombie(type, spawnPos, survivalMinutes, playerSpeed);
        if (!this.enemies.includes(zombie)) {
            this.enemies.push(zombie);
        }
        return true;
    }

    spawnZombie(type) {
        const radius = ZOMBIE_RADII[type] ?? 0.6;
        const portals = this.arena?.getPortals?.();
        if (portals && portals.length > 0) {
            const portal = portals[Math.floor(Math.random() * portals.length)];
            const spawnPos = this.arena.getPortalSpawnPosition(portal, radius);
            if (!spawnPos) return false;
            if (this.arena.checkCollision(spawnPos, radius)) return false;
            const zombie = this.acquireZombie(type, spawnPos, 0, 7.5);
            if (!this.enemies.includes(zombie)) {
                this.enemies.push(zombie);
            }
            return true;
        }
        return false;
    }

    update(delta, player, arena, onEnemyKilled) {
        const targets = (Array.isArray(player) ? player : [player]).filter(p => !p.isDead && !p.isDowned);
        this.bombs.update(delta, targets);
        const primaryPlayer = targets[0] || (Array.isArray(player) ? player[0] : player);

        // Cập nhật thời gian sống sót
        if (primaryPlayer && !primaryPlayer.isDead) {
            this.survivalTimer += delta;
        }

        const survivalMinutes = this.survivalTimer / 60.0;

        // 1. Quản lý sinh quai theo đợt có kiểm soát (Wave Spawning)
        if (this.isWaveInProgress && primaryPlayer && !primaryPlayer.isDead) {
            // Xử lý hàng đợi thủ công (spawnQueue) nếu có
            if (this.spawnQueue && this.spawnQueue.length > 0) {
                const nextType = this.spawnQueue[0];
                if (this.spawnZombie(nextType)) {
                    this.spawnQueue.shift();
                }
            }

            this.batchSpawnTimer += delta;
            const activeCount = this.enemies.filter(e => e.active && !e.isDead).length;

            // Chỉ sinh thêm quái nếu số quái trên sân chưa chạm trần maxOnField và còn quái trong hàng đợi của đợt
            if (this.remainingToSpawn > 0 && activeCount < this.maxOnField && this.batchSpawnTimer >= this.batchInterval) {
                this.batchSpawnTimer = 0;
                
                // Kiem tra spawn Boss moi 5 phase
                if (this.currentPhase % 5 === 0 && !this.hasSpawnedBoss) {
                    this.hasSpawnedBoss = true;
                    this.spawnSingleEnemy(primaryPlayer, survivalMinutes, 'boss');
                    this.remainingToSpawn--;
                }
                
                 const canSpawn = Math.min(4, this.maxOnField - activeCount, this.remainingToSpawn);
                for (let i = 0; i < canSpawn; i++) {
                    this.spawnSingleEnemy(primaryPlayer, survivalMinutes);
                    this.remainingToSpawn--;
                }
            }
        }

        // 2. Round-robin phân phối ngân sách navigation
        this.navigationBudget.remaining = 2;
        this.navigationBudget.allowed.clear();
        for (let checked = 0; checked < this.enemies.length && this.navigationBudget.allowed.size < 2; checked++) {
            this.navigationCursor %= Math.max(1, this.enemies.length);
            const candidate = this.enemies[this.navigationCursor++];
            if (candidate && !candidate.isDead && candidate.active && (!candidate.navigationPath || (candidate.pathTimer || 0) <= delta)) {
                this.navigationBudget.allowed.add(candidate);
            }
        }

        // 3. Cập nhật toàn bộ quái đang hoạt động
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const zombie = this.enemies[i];
            if (!zombie.active) {
                this.enemies.splice(i, 1);
                continue;
            }

            const target = targets.reduce((nearest, p) =>
                !nearest || p.position.distanceToSquared(zombie.position) < nearest.position.distanceToSquared(zombie.position) ? p : nearest, null);

            if (target) {
                zombie.update(delta, target, arena, this.enemies, this.navigationBudget);
            } else {
                zombie.spitCharge = 0;
                zombie.playAnimation('idle');
            }

            if (zombie.isDead) {
                if (onEnemyKilled) {
                    onEnemyKilled(zombie);
                }
                zombie.deactivate();
                this.enemies.splice(i, 1);
            }
        }

        // 4. Kiểm tra hoàn thành đợt (Wave Cleared) -> Kích hoạt thời gian nghỉ ngơi
        const activeRemaining = this.enemies.filter(e => e.active && !e.isDead).length;
        const queueRemaining = (this.remainingToSpawn || 0) + (this.spawnQueue?.length || 0);
        if (this.isWaveInProgress && queueRemaining <= 0 && activeRemaining === 0) {
            this.isWaveInProgress = false;
            return true; // Báo hiệu cho main.js bắt đầu 10 giây nghỉ
        }

        return false;
    }

    getRemainingEnemiesCount() {
        return Math.max(0, this.remainingToSpawn || 0) + this.enemies.filter(e => e.active && !e.isDead).length;
    }

    getBoss() {
        return this.enemies.find(e => e.type === 'boss' && e.active && !e.isDead);
    }

    clear() {
        this.bombs.clear();
        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].deactivate();
        }
        for (let i = 0; i < this.pool.length; i++) {
            this.pool[i].deactivate();
        }
        this.enemies = [];
        this.remainingToSpawn = 0;
        this.isWaveInProgress = false;
        this.survivalTimer = 0;
        this.batchSpawnTimer = 0;
    }
}
