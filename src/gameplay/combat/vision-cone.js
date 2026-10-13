import * as THREE from 'three';

/**
 * Bảng thông số và hàm lấy cấu hình tầm nhìn theo loại súng và trạng thái ngắm
 * @param {object} weapon - Cấu hình vũ khí hiện tại
 * @param {boolean} isADS - Trạng thái đang bật ngắm tâm (Right click / ADS)
 * @param {number} opticTier - Cấp bậc kính ngắm (1-5)
 * @returns {{ visionRange: number, visionAngle: number, proximityRadius: number }}
 */
export function getWeaponVisionConfig(weapon, isADS = false, opticTier = 1) {
    if (!weapon) {
        return {
            visionRange: isADS ? 35.0 : 20.0,
            visionAngle: isADS ? 25.0 : 45.0,
            proximityRadius: isADS ? 1.0 : 1.8
        };
    }

    const cat = (weapon.category || '').toUpperCase();
    const id = (weapon.id || '').toLowerCase();
    const name = (weapon.name || '').toUpperCase();
    const aliases = Array.isArray(weapon.aliases) ? weapon.aliases.join(' ').toLowerCase() : '';

    // 1. Nhóm Shotgun: Cận chiến góc rộng, cự ly ngắn
    if (cat.includes('SHOTGUN') || cat.includes('SĂN') || id.includes('scatter') || id.includes('breacher') || (weapon.pellets && weapon.pellets > 1) || id === 'blaster_g' || id === 'blaster_l' || id === 'blaster_m') {
        if (isADS) {
            return { visionRange: 17.0, visionAngle: 50.0, proximityRadius: 1.6 };
        }
        return { visionRange: 13.0, visionAngle: 70.0, proximityRadius: 2.2 };
    }

    // 2. Nhóm Sniper & DMR: Bắn tỉa cực xa (95m), tia quét tập trung vừa vặn (5.0 độ) khi ngắm, góc rộng 36 độ vừa phải khi bình thường
    if (cat.includes('NGẮM') || cat.includes('SNIPER') || cat.includes('TỈA') || cat.includes('DMR') || name.includes('SNIPER') || name.includes('DMR') || id === 'awp' || id.includes('blaster_n') || id.includes('blaster_o') || aliases.includes('blaster_n') || aliases.includes('blaster_o')) {
        if (isADS) {
            // Khi ngắm chuột phải: Góc 5.0 độ (vừa vặn rõ ràng, không bị quá hẹp), dài 95 mét vươn suốt hành lang, bán kính chân 0.4m
            return { visionRange: 95.0, visionAngle: 5.0, proximityRadius: 0.4 };
        }
        // Khi ở chế độ bình thường: Góc vẫn rộng 36 độ (hẹp hơn Shotgun 70 độ và Súng trường 46 độ) để quan sát cơ động
        return { visionRange: 24.0, visionAngle: 36.0, proximityRadius: 1.8 };
    }

    // 3. Nhóm Súng trường tầm xa (Battle Rifle như Blaster-F Enforcer)
    if (cat.includes('TẦM XA') || name.includes('ENFORCER') || aliases.includes('blaster_f') || aliases.includes('blaster-f')) {
        if (isADS) {
            return { visionRange: 48.0, visionAngle: 15.0, proximityRadius: 0.8 };
        }
        return { visionRange: 26.0, visionAngle: 36.0, proximityRadius: 1.6 };
    }

    // 4. Nhóm Súng lục & Tiểu liên (Pistol / SMG): Cơ động cao
    if (cat.includes('LỤC') || cat.includes('NGẮN') || cat.includes('SMG') || cat.includes('TIỂU LIÊN') || ['blaster', 'blaster_a', 'blaster_b', 'blaster_c', 'repeater', 'blaster_d', 'mac10', 'blaster_h', 'blaster_i', 'pew', 'blaster_k'].includes(id)) {
        if (isADS) {
            return { visionRange: 26.0, visionAngle: 36.0, proximityRadius: 1.3 };
        }
        return { visionRange: 18.0, visionAngle: 50.0, proximityRadius: 2.0 };
    }

    // 5. Nhóm Hỏa lực hạng nặng (Minigun Gatling & Rocket & Pháo)
    if (cat.includes('GATLING') || cat.includes('LỰU') || cat.includes('PHÁO') || id === 'blaster_q' || id === 'rocket' || id === 'blaster_p' || id === 'blaster_r') {
        if (isADS) {
            return { visionRange: 28.0, visionAngle: 35.0, proximityRadius: 1.5 };
        }
        return { visionRange: 20.0, visionAngle: 48.0, proximityRadius: 2.0 };
    }

    // 6. Nhóm Súng trường AR & Carbine (Assault Rifle): Chuẩn đa năng
    if (isADS) {
        if (opticTier >= 4) {
            return { visionRange: 40.0, visionAngle: 18.0, proximityRadius: 0.9 };
        }
        if (opticTier >= 2) {
            return { visionRange: 35.0, visionAngle: 22.0, proximityRadius: 1.1 };
        }
        return { visionRange: 32.0, visionAngle: 26.0, proximityRadius: 1.3 };
    }
    return { visionRange: 22.0, visionAngle: 46.0, proximityRadius: 1.8 };
}

/**
 * Kiểm tra xem một thực thể mục tiêu có nhìn thấy được từ vị trí người quan sát hay không
 * @param {object} observer - Người chơi hoặc Bot quan sát (cần có position, aimYaw, team)
 * @param {object} target - Mục tiêu (cần có position, team)
 * @param {object} visionConfig - Cấu hình tầm nhìn { visionRange, visionAngle, proximityRadius }
 * @param {object} arena - Bản đồ đấu trường để kiểm tra tia Line of Sight (tùy chọn)
 * @returns {boolean} true nếu nhìn thấy được, false nếu bị che khuất
 */
export function checkEntityVisibility(observer, target, visionConfig, arena = null) {
    if (!observer || !target || !target.position) return true;

    // 1. Đồng đội cùng phe luôn nhìn thấy nhau để phối hợp
    if (observer.team && target.team && observer.team === target.team) {
        return true;
    }

    const obsPos = observer.position;
    const tgtPos = target.position;
    const dx = tgtPos.x - obsPos.x;
    const dz = tgtPos.z - obsPos.z;
    const distSq = dx * dx + dz * dz;

    // 2. Vượt quá tầm chiếu xa tối đa
    const maxRange = visionConfig.visionRange || 20.0;
    if (distSq > maxRange * maxRange) {
        return false;
    }

    // 3. Vùng cận cảnh (Proximity) hoặc góc mở hình quạt
    const proxRadius = visionConfig.proximityRadius || 1.8;
    const isProximity = distSq <= proxRadius * proxRadius;

    if (!isProximity) {
        // Kiểm tra góc mở hình quạt trên mặt phẳng XZ
        const angleToTarget = Math.atan2(dx, dz);
        let diff = (angleToTarget - (observer.aimYaw || 0)) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        const angleDiff = Math.abs(diff);

        const halfConeRad = ((visionConfig.visionAngle || 50.0) * Math.PI / 180) / 2;
        if (angleDiff > halfConeRad) {
            return false;
        }
    }

    // 4. KIỂM TRA VẬT CẢN / BỊ TƯỜNG CHE KHUẤT (Line of Sight Raycast)
    // Dù trong góc quạt hay đứng sát cận cảnh, nếu có vách tường ngăn giữa 2 bên thì KHÔNG nhìn thấy
    if (arena && typeof arena.hasLineOfSight === 'function') {
        if (!arena.hasLineOfSight(obsPos, tgtPos)) {
            return false;
        }
    }

    return true;
}

/**
 * Áp dụng ẩn/hiện model và thanh máu cho danh sách đối thủ theo tầm nhìn toàn đội
 * @param {object|Array} teamOrObserver - Người chơi chính hoặc danh sách thành viên cùng phe
 * @param {Array} entities - Danh sách đối thủ cần kiểm tra
 * @param {object} defaultVisionConfig - Cấu hình tầm nhìn mặc định (tùy chọn)
 * @param {object} arena - Bản đồ đấu trường để kiểm tra tia Line of Sight (tùy chọn)
 */
export function applyVisibilityCulling(teamOrObserver, entities, defaultVisionConfig = null, arena = null, configForObserver = null) {
    if (!entities || !Array.isArray(entities)) return;

    // Chuẩn hóa danh sách thành viên quan sát cùng phe
    const observers = Array.isArray(teamOrObserver) ? teamOrObserver : [teamOrObserver];
    const activeObservers = observers.filter(o => o && !o.isDead);
    const configs = activeObservers.map(obs => {
        const weapon = obs.weapons?.currentGun || obs.weapons?.getCurrentWeapon?.();
        return configForObserver?.(obs) || (obs === teamOrObserver && defaultVisionConfig) || getWeaponVisionConfig(weapon, !!obs.isADS, obs.weapons?.getOpticTier?.() || 1);
    });

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (!entity) continue;

        if (entity.isDead) {
            entity.isVisibleToObserver = false;
            if (entity.mesh) entity.mesh.visible = false;
            if (entity.healthBarMesh) entity.healthBarMesh.visible = false;
            if (entity.healthBar?.group) entity.healthBar.group.visible = false;
            continue;
        }

        let isVisible = false;

        // Kiểm tra xem có bất kỳ thành viên nào trong đội soi trúng đối thủ này không
        for (let j = 0; j < activeObservers.length; j++) {
            const obs = activeObservers[j];
            const cfg = configs[j];

            if (checkEntityVisibility(obs, entity, cfg, arena)) {
                isVisible = true;
                break;
            }
        }

        entity.isVisibleToObserver = isVisible;

        // Ẩn/hiện Model 3D
        if (entity.mesh) {
            entity.mesh.visible = isVisible;
        }

        // Ẩn/hiện thanh máu 3D
        if (entity.healthBarMesh) {
            entity.healthBarMesh.visible = isVisible;
        }
        if (entity.healthBar?.group) {
            entity.healthBar.group.visible = isVisible;
        }
    }
}

// Sample wall corners as well as the arc so shadows stay attached while aim rotates.
export function buildVisionPolygon(position, yaw, range, angle, arena, points = [], candidates = []) {
    const half = angle * Math.PI / 360;
    const fullCircle = angle >= 360;
    const boxes = arena?.getCollidersInAABB
        ? arena.getCollidersInAABB(position.x - range, position.z - range,
            position.x + range, position.z + range, candidates)
        : (arena?.colliders || []);
    const angles = [];
    const steps = fullCircle ? 64 : Math.max(16, Math.ceil(angle / 1.5));
    for (let i = 0; i <= steps; i++) angles.push(-half + angle * Math.PI / 180 * i / steps);
    for (const box of boxes) {
        if (box.max.y <= 1 || box.min.y >= 1) continue;
        for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
            let relative = Math.atan2(x - position.x, z - position.z) - yaw;
            relative = Math.atan2(Math.sin(relative), Math.cos(relative));
            for (const epsilon of [-0.0001, 0, 0.0001]) {
                const a = relative + epsilon;
                if (a > -half && a < half) angles.push(a);
            }
        }
    }
    angles.sort((a, b) => a - b);
    let count = 0;
    if (!fullCircle) {
        const origin = points[count++] ||= { x: 0, z: 0 };
        origin.x = position.x; origin.z = position.z;
    }
    let previousAngle = -Infinity;
    for (const relative of angles) {
        if (relative - previousAngle < 0.000001) continue;
        previousAngle = relative;
        const dx = Math.sin(yaw + relative), dz = Math.cos(yaw + relative);
        let distance = range;
        for (const box of boxes) {
            if (box.max.y <= 1 || box.min.y >= 1) continue;
            let near = 0, far = distance;
            if (Math.abs(dx) < 1e-9) {
                if (position.x < box.min.x || position.x > box.max.x) continue;
            } else {
                const a = (box.min.x - position.x) / dx, b = (box.max.x - position.x) / dx;
                near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
            }
            if (Math.abs(dz) < 1e-9) {
                if (position.z < box.min.z || position.z > box.max.z) continue;
            } else {
                const a = (box.min.z - position.z) / dz, b = (box.max.z - position.z) / dz;
                near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
            }
            if (near <= far && far >= 0) distance = Math.max(0, near - 0.005);
        }
        const point = points[count++] ||= { x: 0, z: 0 };
        point.x = position.x + dx * distance;
        point.z = position.z + dz * distance;
    }
    points.length = count;
    return points;
}

/** World-space visibility projected into the overhead camera, never a screen-space circle. */
export class VisionConeOverlay {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas?.getContext('2d');
        this.camera = camera;
        this._hasContent = false;
        this.currentRange = 20;
        this.currentAngle = 50;
        this.currentProximity = 2;
        this.mask = document.createElement('canvas');
        this.maskCtx = this.mask.getContext('2d');
        this._origin = new THREE.Vector3();
        this._axisX = new THREE.Vector3();
        this._axisZ = new THREE.Vector3();
        this._points = [];
        this._candidates = [];
        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
    }

    initCanvasSize() {
        if (!this.canvas) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        this.width = Math.round(window.innerWidth * ratio);
        this.height = Math.round(window.innerHeight * ratio);
        this.canvas.width = this.mask.width = this.width;
        this.canvas.height = this.mask.height = this.height;
        this._hasContent = false;
    }

    clear() {
        if (!this.ctx || !this.canvas || !this._hasContent) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._hasContent = false;
        this._player = null;
    }

    getConfig() {
        return { visionRange: this.currentRange, visionAngle: this.currentAngle, proximityRadius: this.currentProximity };
    }

    update(player, delta) {
        if (!player) return;
        const weapon = player.weapons?.getCurrentWeapon?.() || player.weapons?.currentGun;
        const cfg = getWeaponVisionConfig(weapon, !!player.isADS, player.weapons?.getOpticTier?.() || 1);
        // Initialise each match without sweeping from the previous weapon's light cone.
        const amount = this._player === player ? 1 - Math.exp(-12 * Math.max(0, delta)) : 1;
        this._player = player;
        this.currentRange += (cfg.visionRange - this.currentRange) * amount;
        this.currentAngle += (cfg.visionAngle - this.currentAngle) * amount;
        this.currentProximity += (cfg.proximityRadius - this.currentProximity) * amount;
    }

    _clip(points) {
        const ctx = this.maskCtx;
        ctx.beginPath();
        points.forEach((point, i) => i ? ctx.lineTo(point.x, point.z) : ctx.moveTo(point.x, point.z));
        ctx.closePath();
        ctx.clip();
    }

    _renderSpotterCutout(spotter, range, angle, proximity, arena) {
        const ctx = this.maskCtx, pos = spotter.position, yaw = spotter.aimYaw || 0;
        ctx.save();
        this._clip(buildVisionPolygon(pos, yaw, range, angle, arena, this._points, this._candidates));
        const half = angle * Math.PI / 360;
        // Feather only inside the cone. The occlusion clip stays sharp at walls.
        for (let i = 1; i <= 8; i++) {
            const edge = half * (1 - (i - 1) * 0.025);
            const gradient = ctx.createRadialGradient(pos.x, pos.z, 0, pos.x, pos.z, range);
            for (const [stop, strength] of [[0, 1], [0.65, 0.96], [0.9, 0.6], [1, 0]]) {
                const gray = Math.round(255 * strength * i / 8);
                gradient.addColorStop(stop, `rgb(${gray},${gray},${gray})`);
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.z);
            ctx.arc(pos.x, pos.z, range, Math.PI / 2 - yaw - edge, Math.PI / 2 - yaw + edge);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.save();
        this._clip(buildVisionPolygon(pos, 0, proximity, 360, arena, this._points, this._candidates));
        const near = ctx.createRadialGradient(pos.x, pos.z, 0, pos.x, pos.z, proximity);
        near.addColorStop(0, 'white');
        near.addColorStop(0.55, 'rgb(230,230,230)');
        near.addColorStop(1, 'black');
        ctx.fillStyle = near;
        ctx.fillRect(pos.x - proximity, pos.z - proximity, proximity * 2, proximity * 2);
        ctx.restore();
    }

    render(player, isEnabled = true, teammates = [], arena = null) {
        if (!this.ctx || !this.camera || !isEnabled || !player) { this.clear(); return; }
        const { width, height } = this.canvas;
        const mask = this.maskCtx;
        mask.setTransform(1, 0, 0, 1, 0, 0);
        // An opaque black mask makes lighten a true maximum, so overlapping beams
        // do not accumulate brightness or punch extra light through walls.
        mask.globalCompositeOperation = 'source-over';
        mask.fillStyle = 'black'; mask.fillRect(0, 0, width, height);
        const origin = this._origin.set(0, 0, 0).project(this.camera);
        const x = this._axisX.set(1, 0, 0).project(this.camera);
        const z = this._axisZ.set(0, 0, 1).project(this.camera);
        mask.setTransform((x.x - origin.x) * width / 2, -(x.y - origin.y) * height / 2,
            (z.x - origin.x) * width / 2, -(z.y - origin.y) * height / 2,
            (origin.x + 1) * width / 2, (1 - origin.y) * height / 2);
        mask.globalCompositeOperation = 'lighten';
        if (!player.isDead) this._renderSpotterCutout(player, this.currentRange, this.currentAngle, this.currentProximity, arena);
        for (const mate of teammates) {
            if (!mate || mate === player || mate.isDead) continue;
            const cfg = getWeaponVisionConfig(mate.weapons?.getCurrentWeapon?.() || mate.weapons?.currentGun,
                !!mate.isADS, mate.weapons?.getOpticTier?.() || 1);
            this._renderSpotterCutout(mate, cfg.visionRange, cfg.visionAngle, cfg.proximityRadius, arena);
        }
        // Multiply the scene by the light mask: neutral ambient darkness remains
        // outside vision; inside the beam the original material colours are preserved.
        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(this.mask, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this._hasContent = true;
    }
}
