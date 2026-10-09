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
            visionRange: isADS ? 24.0 : 18.0,
            visionAngle: isADS ? 35.0 : 50.0,
            proximityRadius: isADS ? 1.5 : 2.2
        };
    }

    const cat = (weapon.category || '').toUpperCase();
    const id = (weapon.id || '').toLowerCase();

    // 1. Nhóm Shotgun: Cận chiến bao quát rộng hơn súng trường, tầm ngắn
    if (cat.includes('SHOTGUN') || cat.includes('SĂN') || id.includes('scatter') || id.includes('breacher') || (weapon.pellets && weapon.pellets > 1)) {
        if (isADS) {
            return { visionRange: 16.0, visionAngle: 50.0, proximityRadius: 1.8 };
        }
        return { visionRange: 12.0, visionAngle: 75.0, proximityRadius: 2.5 };
    }

    // 2. Nhóm Sniper / DMR / Railgun: Bắn tỉa cực xa, thu hẹp góc tối đa khi ngắm (Tunnel Vision)
    if (cat.includes('NGẮM') || cat.includes('SNIPER') || cat.includes('TỈA') || id.includes('sniper') || id.includes('railgun') || id.includes('amr') || id.includes('dmr')) {
        if (isADS) {
            if (opticTier >= 5) {
                return { visionRange: 65.0, visionAngle: 12.0, proximityRadius: 0.4 };
            }
            if (opticTier >= 4) {
                return { visionRange: 50.0, visionAngle: 18.0, proximityRadius: 0.6 };
            }
            return { visionRange: 38.0, visionAngle: 25.0, proximityRadius: 1.0 };
        }
        return { visionRange: 24.0, visionAngle: 45.0, proximityRadius: 1.8 };
    }

    // 3. Nhóm Súng lục & Tiểu liên (Pistol / SMG): Cơ động, tầm gần - trung
    if (cat.includes('LỤC') || cat.includes('NGẮN') || cat.includes('SMG') || id.includes('blaster') || id.includes('striker')) {
        if (isADS) {
            return { visionRange: 22.0, visionAngle: 40.0, proximityRadius: 1.5 };
        }
        return { visionRange: 17.0, visionAngle: 55.0, proximityRadius: 2.2 };
    }

    // 4. Nhóm Súng trường (Assault Rifle / Carbine / Repeater): Chuẩn 50 độ
    if (isADS) {
        if (opticTier >= 4) {
            return { visionRange: 42.0, visionAngle: 20.0, proximityRadius: 0.8 };
        }
        if (opticTier >= 2) {
            return { visionRange: 34.0, visionAngle: 28.0, proximityRadius: 1.2 };
        }
        return { visionRange: 26.0, visionAngle: 38.0, proximityRadius: 1.8 };
    }
    return { visionRange: 20.0, visionAngle: 50.0, proximityRadius: 2.0 };
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
        let angleDiff = Math.abs(angleToTarget - (observer.aimYaw || 0));
        while (angleDiff > Math.PI) {
            angleDiff = Math.abs(angleDiff - 2 * Math.PI);
        }

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
export function applyVisibilityCulling(teamOrObserver, entities, defaultVisionConfig = null, arena = null) {
    if (!entities || !Array.isArray(entities)) return;

    // Chuẩn hóa danh sách thành viên quan sát cùng phe
    const observers = Array.isArray(teamOrObserver) ? teamOrObserver : [teamOrObserver];
    const activeObservers = observers.filter(o => o && !o.isDead);

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
            const weapon = obs.weapons?.currentGun || obs.weapons?.getCurrentWeapon?.();
            const isADS = !!obs.isADS;
            const opticTier = obs.weapons?.getOpticTier ? obs.weapons.getOpticTier() : 1;
            const cfg = (obs === teamOrObserver && defaultVisionConfig)
                ? defaultVisionConfig
                : getWeaponVisionConfig(weapon, isADS, opticTier);

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

/**
 * Lớp quản lý vẽ mặt nạ bóng tối 2D Canvas và khoét luồng sáng hình quạt cho toàn đội
 */
export class VisionConeOverlay {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas?.getContext('2d');
        this.camera = camera;
        this.enabled = false;
        this._hasContent = false;

        // Các thông số được nội suy (lerp) mượt mà cho người chơi chính
        this.currentRange = 20.0;
        this.currentAngle = 50.0;
        this.currentProximity = 2.0;

        // Vector và Ray tạm để tính toán chiếu tọa độ và cắt tường tránh Garbage Collection
        this._tempV1 = new THREE.Vector3();
        this._tempV2 = new THREE.Vector3();
        this._tempV3 = new THREE.Vector3();
        this._coneRay = new THREE.Ray();
        this._coneHit = new THREE.Vector3();
        this._coneRayDir = new THREE.Vector3();
        this._rayTarget3D = new THREE.Vector3();

        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
    }

    initCanvasSize() {
        if (!this.canvas) return;
        // Giảm kích thước canvas nội bộ (75%) để giảm 45% diện tích rasterize 2D của GPU/CPU
        // Giữ CSS width/height 100% để tạo hiệu ứng sương mù mềm mại (soft fog)
        const scale = 0.75;
        this.width = Math.round(window.innerWidth * scale);
        this.height = Math.round(window.innerHeight * scale);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this._hasContent = false;
    }

    clear() {
        if (!this.ctx || !this.canvas || !this._hasContent) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._hasContent = false;
    }

    /**
     * Cập nhật thông số tầm nhìn theo thời gian thực (nội suy mượt mà) cho người chơi chính
     */
    update(player, delta) {
        if (!player) return;

        const weapon = player.weapons?.currentGun;
        const isADS = !!player.isADS;
        const opticTier = player.weapons?.getOpticTier ? player.weapons.getOpticTier() : 1;
        const targetCfg = getWeaponVisionConfig(weapon, isADS, opticTier);

        // Nội suy lerp mượt mà (tốc độ lerp 12.0)
        const lerpFactor = Math.min(1.0, 12.0 * delta);
        this.currentRange += (targetCfg.visionRange - this.currentRange) * lerpFactor;
        this.currentAngle += (targetCfg.visionAngle - this.currentAngle) * lerpFactor;
        this.currentProximity += (targetCfg.proximityRadius - this.currentProximity) * lerpFactor;
    }

    /**
     * Hàm khoét lỗ hình quạt và quầng cận cảnh cho một chiến binh cụ thể (bị chặn lại bởi vách tường 3D)
     * @param {object} spotter - Người chơi hoặc bot quan sát
     * @param {number} rangeVal - Tầm chiếu xa
     * @param {number} angleVal - Góc mở hình quạt
     * @param {number} proxVal - Bán kính cận cảnh
     * @param {object} arena - Bản đồ đấu trường để kiểm tra va chạm tường
     */
    _renderSpotterCutout(spotter, rangeVal, angleVal, proxVal, arena = null, isLocalPlayer = true) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // 1. Tính tọa độ màn hình của chiến binh
        this._tempV1.copy(spotter.position);
        this._tempV1.project(this.camera);

        // Kiểm tra xem chiến binh có nằm quá xa khỏi khung hình không
        if (this._tempV1.z > 1.0 || this._tempV1.x < -1.5 || this._tempV1.x > 1.5 || this._tempV1.y < -1.5 || this._tempV1.y > 1.5) {
            return;
        }

        const screenX = (this._tempV1.x * 0.5 + 0.5) * width;
        const screenY = (-(this._tempV1.y * 0.5) + 0.5) * height;

        // 2. Tính bán kính điểm ảnh tương ứng trên màn hình cho gradient
        this._tempV3.set(spotter.position.x + rangeVal, spotter.position.y, spotter.position.z);
        this._tempV3.project(this.camera);
        const rScreenX = (this._tempV3.x * 0.5 + 0.5) * width;
        const screenRadius = Math.max(20, Math.abs(rScreenX - screenX));

        this._tempV3.set(spotter.position.x + proxVal, spotter.position.y, spotter.position.z);
        this._tempV3.project(this.camera);
        const pScreenX = (this._tempV3.x * 0.5 + 0.5) * width;
        const screenProxRadius = Math.max(12, Math.abs(pScreenX - screenX));

        const yaw = spotter.aimYaw || 0;
        const halfAngleRad = ((angleVal * Math.PI) / 180) / 2;

        // 3. BẮN TIA RAYCAST VÀO CÁC HỘP VA CHẠM TƯỜNG ĐỂ TẠO ĐA GIÁC TẦM NHÌN (Vision Polygon)
        // Đồng đội bot lấy mẫu ít tia hơn để tối ưu hiệu năng
        const numRays = isLocalPlayer ? 24 : 12;
        const polyPoints = [];

        for (let s = 0; s <= numRays; s++) {
            const relAngle = -halfAngleRad + (s / numRays) * (halfAngleRad * 2);
            const rayAngle = yaw + relAngle;
            const dirX = Math.sin(rayAngle);
            const dirZ = Math.cos(rayAngle);

            this._coneRayDir.set(dirX, 0, dirZ);
            this._coneRay.origin.set(spotter.position.x, 1.0, spotter.position.z);
            this._coneRay.direction.copy(this._coneRayDir);

            let hitDist = rangeVal;
            if (arena && typeof arena.raycastClosestDistance === 'function') {
                hitDist = arena.raycastClosestDistance(this._coneRay, rangeVal, spotter.position.x, spotter.position.z);
            } else if (arena && arena.colliders) {
                for (let c = 0; c < arena.colliders.length; c++) {
                    const col = arena.colliders[c];
                    // Bo qua cac vat the nam hoan toan duoi san hoac tren tran
                    if (col.max.y <= 0.4 || col.min.y >= 3.0) continue;
                    const hit = this._coneRay.intersectBox(col, this._coneHit);
                    if (hit) {
                        const d = Math.hypot(hit.x - spotter.position.x, hit.z - spotter.position.z);
                        if (d < hitDist) {
                            hitDist = Math.max(0.1, d - 0.05);
                        }
                    }
                }
            }

            this._rayTarget3D.set(
                spotter.position.x + dirX * hitDist,
                spotter.position.y,
                spotter.position.z + dirZ * hitDist
            );
            this._rayTarget3D.project(this.camera);

            const px = (this._rayTarget3D.x * 0.5 + 0.5) * width;
            const py = (-(this._rayTarget3D.y * 0.5) + 0.5) * height;
            polyPoints.push({ x: px, y: py });
        }

        // Bắn tia cho quầng cận cảnh quanh chân để không bị lọt qua vách tường sát bên
        const proxRays = isLocalPlayer ? 14 : 8;
        const proxPoints = [];
        for (let s = 0; s < proxRays; s++) {
            const circleAngle = (s / proxRays) * Math.PI * 2;
            const dirX = Math.sin(circleAngle);
            const dirZ = Math.cos(circleAngle);

            this._coneRayDir.set(dirX, 0, dirZ);
            this._coneRay.origin.set(spotter.position.x, 1.0, spotter.position.z);
            this._coneRay.direction.copy(this._coneRayDir);

            let hitDist = proxVal;
            if (arena && typeof arena.raycastClosestDistance === 'function') {
                hitDist = arena.raycastClosestDistance(this._coneRay, proxVal, spotter.position.x, spotter.position.z);
            } else if (arena && arena.colliders) {
                for (let c = 0; c < arena.colliders.length; c++) {
                    const col = arena.colliders[c];
                    if (col.max.y <= 0.4 || col.min.y >= 3.0) continue;
                    const hit = this._coneRay.intersectBox(col, this._coneHit);
                    if (hit) {
                        const d = Math.hypot(hit.x - spotter.position.x, hit.z - spotter.position.z);
                        if (d < hitDist) {
                            hitDist = Math.max(0.1, d - 0.05);
                        }
                    }
                }
            }

            this._rayTarget3D.set(
                spotter.position.x + dirX * hitDist,
                spotter.position.y,
                spotter.position.z + dirZ * hitDist
            );
            this._rayTarget3D.project(this.camera);

            const px = (this._rayTarget3D.x * 0.5 + 0.5) * width;
            const py = (-(this._rayTarget3D.y * 0.5) + 0.5) * height;
            proxPoints.push({ x: px, y: py });
        }

        // 4. Khoét thủng bóng tối bằng destination-out
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // Khoét hình quạt tầm nhìn phía trước bằng Đa Giác Tầm Nhìn
        const fanGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenRadius);
        fanGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        fanGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.95)');
        fanGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.5)');
        fanGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = fanGrad;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        for (let i = 0; i < polyPoints.length; i++) {
            ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Khoét quầng sáng cận cảnh xung quanh chân
        const proxGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenProxRadius);
        proxGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        proxGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
        proxGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = proxGrad;
        ctx.beginPath();
        if (proxPoints.length > 0) {
            ctx.moveTo(proxPoints[0].x, proxPoints[0].y);
            for (let i = 1; i < proxPoints.length; i++) {
                ctx.lineTo(proxPoints[i].x, proxPoints[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // 5. Chỉ vẽ viền sáng phản quang cho người chơi chính (bỏ qua cho bot để tối ưu GPU/CPU)
        if (isLocalPlayer) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            const rimGrad = ctx.createRadialGradient(screenX, screenY, screenProxRadius * 0.5, screenX, screenY, screenRadius);
            rimGrad.addColorStop(0, 'rgba(255, 245, 210, 0.08)');
            rimGrad.addColorStop(0.85, 'rgba(255, 230, 180, 0.04)');
            rimGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = rimGrad;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            for (let i = 0; i < polyPoints.length; i++) {
                ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Vẽ lớp mặt nạ bóng tối và khoét lỗ hình quạt cho người chơi chính cùng toàn bộ đồng đội
     */
    render(player, isEnabled = true, teammates = [], arena = null) {
        if (!this.ctx || !this.canvas || !this.camera || !isEnabled || !player) {
            this.clear();
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // 1. Xóa khung hình cũ
        ctx.clearRect(0, 0, width, height);

        // 2. Phủ lớp bóng tối mờ nhẹ toàn màn hình (Fog of War mờ 40%)
        ctx.fillStyle = 'rgba(8, 14, 24, 0.40)';
        ctx.fillRect(0, 0, width, height);
        this._hasContent = true;

        // 3. Khoét luồng sáng cho người chơi chính (nếu còn sống)
        if (!player.isDead) {
            this._renderSpotterCutout(player, this.currentRange, this.currentAngle, this.currentProximity, arena, true);
        }

        // 4. Khoét luồng sáng cho tất cả đồng đội cùng phe (nếu còn sống)
        if (teammates && Array.isArray(teammates)) {
            for (let i = 0; i < teammates.length; i++) {
                const mate = teammates[i];
                if (!mate || mate.isDead || mate === player) continue;
                const weapon = mate.weapons?.currentGun || mate.weapons?.getCurrentWeapon?.();
                const isADS = !!mate.isADS;
                const opticTier = mate.weapons?.getOpticTier ? mate.weapons.getOpticTier() : 1;
                const cfg = getWeaponVisionConfig(weapon, isADS, opticTier);
                this._renderSpotterCutout(mate, cfg.visionRange, cfg.visionAngle, cfg.proximityRadius, arena, false);
            }
        }
    }
}
