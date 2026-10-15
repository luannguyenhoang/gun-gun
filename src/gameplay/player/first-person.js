import * as THREE from '../../../vendor/three.module.js';
import { duelMovement } from '../combat/duel-rules.js';

// Solo camera and cosmetic viewmodel. Combat continues through WeaponSystem.
export class FirstPersonView {
    constructor(game) {
        this.game = game;
        this.overhead = game.camera;
        this.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 300);
        this.camera.rotation.order = 'YXZ';
        this.direction = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.sensitivity = 1;
        this.adsSensitivity = 0.8;
        try {
            const saved = JSON.parse(localStorage.getItem('fps-controls') || '{}');
            for (const key of ['sensitivity', 'adsSensitivity']) {
                if (Number.isFinite(saved[key])) this[key] = THREE.MathUtils.clamp(saved[key], 0.1, 3);
            }
        } catch {}
        this.settingsPanels = [];
        for (const parent of [document.querySelector('[data-panel="settings"]'), document.querySelector('.pause-actions')]) {
            if (!parent) continue;
            const panel = document.createElement('section');
            panel.className = 'fps-settings';
            panel.innerHTML = `<strong>ĐIỀU KHIỂN GÓC NHÌN THỨ NHẤT</strong>
                <label>Độ nhạy chuột <output></output><input aria-label="Độ nhạy chuột FPS" data-fps-setting="sensitivity" type="range" min="0.1" max="3" step="0.05"></label>
                <label>Độ nhạy khi ngắm <output></output><input aria-label="Độ nhạy khi ngắm FPS" data-fps-setting="adsSensitivity" type="range" min="0.1" max="3" step="0.05"></label>
                <small>Áp dụng ngay · Tự lưu trên máy · Shift chạy nhanh · Ctrl/C ngồi</small>`;
            parent.append(panel);
            this.settingsPanels.push(panel);
            panel.addEventListener('input', event => {
                const key = event.target.dataset.fpsSetting;
                if (!['sensitivity', 'adsSensitivity'].includes(key)) return;
                this[key] = THREE.MathUtils.clamp(Number(event.target.value), 0.1, 3);
                this.syncSettings();
                try { localStorage.setItem('fps-controls', JSON.stringify({sensitivity:this.sensitivity, adsSensitivity:this.adsSensitivity})); } catch {}
            });
        }
        this.syncSettings();
        this.viewScene = new THREE.Scene();
        this.viewScene.add(new THREE.HemisphereLight(0xffffff, 0x667080, 2.5));
        this.rig = new THREE.Group();
        this.camera.add(this.rig);
        this.viewScene.add(this.camera);
        this.hint = document.createElement('button');
        this.hint.id = 'fps-capture';
        this.hint.textContent = 'NHẤP ĐỂ VÀO TRẬN · WASD di chuyển · Chuột ngắm · R nạp đạn · Space nhảy · Esc tạm dừng';
        this.hint.style.cssText = 'position:fixed;left:50%;top:30%;transform:translateX(-50%);z-index:90;padding:18px 24px;border:1px solid #69e7dd;border-radius:8px;background:#101c2eee;color:white;max-width:90vw;cursor:pointer;display:none';
        document.body.append(this.hint);
        this.hint.addEventListener('click', () => this.requestLock());
        game.canvas.addEventListener('click', () => { if (this.active && !this.locked) this.requestLock(); });
        document.addEventListener('pointerlockchange', () => {
            if (!this.active) return;
            this.game.player.mouseButtons = { left: false, right: false };
            this.game.player.keys = {};
            if (!this.locked && this.game.state === 'PLAYING' && this.game.fpsManager.state === 'ACTIVE') this.game.pauseGame();
            this.syncHint();
        });
        document.addEventListener('pointerlockerror', () => this.syncHint());
        window.addEventListener('resize', () => {
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    get locked() { return document.pointerLockElement === this.game.canvas; }

    movementSpeed(baseSpeed, keys, ads = false) {
        return baseSpeed * 0.6 * duelMovement(keys, true, ads).multiplier;
    }

    brakeVelocity(velocity, delta) {
        const decay = Math.exp(-30 * delta);
        velocity.x *= decay;
        velocity.z *= decay;
    }

    syncSettings() {
        for (const panel of this.settingsPanels) for (const input of panel.querySelectorAll('input')) {
            input.value = this[input.dataset.fpsSetting];
            input.previousElementSibling.textContent = `${Number(input.value).toFixed(2)}×`;
        }
    }

    requestLock() {
        if (!this.active || this.locked || this.game.state !== 'PLAYING') return;
        const result = this.game.canvas.requestPointerLock?.();
        result?.catch(() => this.syncHint());
    }

    syncHint() {
        this.hint.style.display = this.active && !this.locked && !this.game.pauseMenuOpen && this.game.state === 'PLAYING' && this.game.fpsManager.state === 'ACTIVE' ? 'block' : 'none';
    }

    setEnabled(enabled) {
        this.active = enabled;
        const { renderQuality, renderer, perfSettings } = this.game;
        if (renderQuality && renderer) {
            renderQuality.configure(window.devicePixelRatio, innerWidth, innerHeight, perfSettings.mode, enabled);
            renderer.setPixelRatio(renderQuality.ratio);
        }
        this.game.player.firstPerson = enabled ? this : null;
        this.game.camera = this.game.player.camera = enabled ? this.camera : this.overhead;
        document.body.classList.toggle('solo-fps', enabled);
        if (enabled) {
            this.yaw = 0; this.pitch = 0;
            this.lastShotTime = undefined; this.sprayShot = 0;
            this.updateCamera();
        } else {
            if (this.locked) document.exitPointerLock();
            const aspect = innerWidth / innerHeight;
            this.overhead.left = -this.game.viewHeight * aspect / 2;
            this.overhead.right = this.game.viewHeight * aspect / 2;
            this.overhead.updateProjectionMatrix();
            if (this.game.player.model) this.game.player.model.visible = true;
            this.clearWeapon();
        }
        this.syncHint();
    }

    look(event) {
        if (!this.locked || !this.game.player.inputEnabled) return;
        const scale = 0.0015 * this.sensitivity * (this.game.player.isADS ? this.adsSensitivity : 1);
        this.yaw -= event.movementX * scale;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * scale, -1.45, 1.45);
        // Apply input immediately, without mouse smoothing or frame-rate scaling.
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    updateCamera(delta = 1 / 60) {
        const p = this.game.player;
        this.camera.position.copy(p.position);
        this.camera.position.y += p.isDead ? 0.6 : p.isCrouching ? 1.0 : 1.55;
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        const targetFov = p.isADS ? 58 : 80;
        const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-22 * Math.max(0, delta)));
        const fov = Math.abs(nextFov - targetFov) < 0.02 ? targetFov : nextFov;
        if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
        this.camera.updateMatrixWorld(true);
        p.pointer.set(0, 0);
        p.pointerScreen.set(innerWidth / 2, innerHeight / 2);
        p.pointerInCanvas = this.locked;
    }

    applyRecoil(strength, now = performance.now()) {
        if (this.lastShotTime === undefined || now - this.lastShotTime > 280) this.sprayShot = 0;
        this.lastShotTime = now;
        const shot = ++this.sprayShot;
        const p = this.game.player;
        const kick = Math.max(0, strength) * 0.35 * (p.recoilMult || 1) * (p.isADS ? 0.65 : 1);
        // A repeatable rise then lateral drift, applied to the same angles as mouse input.
        // No separate recoil offset pulls the aim back after the player compensates.
        const horizontal = shot <= 4 ? 0 : shot <= 10 ? 0.35 : shot <= 20 ? -0.35 : Math.sin(shot * 0.8) * 0.3;
        this.pitch = THREE.MathUtils.clamp(this.pitch + kick, -1.45, 1.45);
        this.yaw -= kick * horizontal;
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        this.updateAim();
    }

    updateAim() {
        const p = this.game.player;
        this.camera.getWorldDirection(this.direction);
        p.aimPoint.copy(this.camera.position).addScaledVector(this.direction, 150);
        p.aimYaw = Math.atan2(this.direction.x, this.direction.z);
    }

    clearWeapon() {
        if (this.weapon) {
            this.weapon.removeFromParent();
            this.weapon.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) m.dispose(); });
        }
        this.weapon = null; this.weaponId = null;
    }

    render(renderer) {
        const p = this.game.player, weapons = this.game.weapons;
        this.syncHint();
        const config = weapons.getCurrentWeapon();
        if (this.weaponId !== config.id) {
            this.clearWeapon();
            const source = weapons.models[config.modelFile];
            if (source) {
                const mesh = source.clone(true);
                mesh.traverse(o => {
                    if (!o.isMesh) return;
                    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
                    o.castShadow = o.receiveShadow = false;
                });
                if (config.isStyloo) mesh.rotation.y = Math.PI / 2;
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const scale = 0.55 / Math.max(size.x, size.y, size.z, 0.01);
                mesh.scale.multiplyScalar(scale);
                mesh.position.sub(center.multiplyScalar(scale));
                this.rig.add(mesh); this.weapon = mesh; this.weaponId = config.id;
            }
        }
        if (p.isDead || p.isDowned) return;
        const bob = p.velocity.lengthSq() > 0.2 ? Math.sin(performance.now() * 0.009) * 0.008 : 0;
        this.rig.position.set(p.isADS ? 0.04 : 0.28, -0.26 + bob - (weapons.isReloading ? 0.16 : 0), -0.75 + Math.min(0.08, weapons.fireCooldown * 0.12));
        this.rig.rotation.z = weapons.isReloading ? -0.35 : 0;
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(this.viewScene, this.camera);
        renderer.autoClear = autoClear;
    }
}
