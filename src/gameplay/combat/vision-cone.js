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
            visionAngle: isADS ? 60.0 : 80.0,
            proximityRadius: isADS ? 1.5 : 2.2
        };
    }

    const cat = (weapon.category || '').toUpperCase();
    const id = (weapon.id || '').toLowerCase();

    // 1. Nhóm Shotgun: Cận chiến bao quát cực rộng, tầm ngắn
    if (cat.includes('SHOTGUN') || cat.includes('SĂN') || id.includes('scatter') || id.includes('breacher') || (weapon.pellets && weapon.pellets > 1)) {
        if (isADS) {
            return { visionRange: 16.0, visionAngle: 75.0, proximityRadius: 1.8 };
        }
        return { visionRange: 12.0, visionAngle: 110.0, proximityRadius: 2.5 };
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
            return { visionRange: 38.0, visionAngle: 28.0, proximityRadius: 1.0 };
        }
        return { visionRange: 24.0, visionAngle: 60.0, proximityRadius: 1.8 };
    }

    // 3. Nhóm Súng lục & Tiểu liên (Pistol / SMG): Cơ động, tầm trung
    if (cat.includes('LỤC') || cat.includes('NGẮN') || cat.includes('SMG') || id.includes('blaster') || id.includes('striker')) {
        if (isADS) {
            return { visionRange: 22.0, visionAngle: 65.0, proximityRadius: 1.5 };
        }
        return { visionRange: 17.0, visionAngle: 85.0, proximityRadius: 2.2 };
    }

    // 4. Nhóm Súng trường (Assault Rifle / Carbine / Repeater): Cân bằng
    if (isADS) {
        if (opticTier >= 4) {
            return { visionRange: 42.0, visionAngle: 22.0, proximityRadius: 0.8 };
        }
        if (opticTier >= 2) {
            return { visionRange: 34.0, visionAngle: 35.0, proximityRadius: 1.2 };
        }
        return { visionRange: 26.0, visionAngle: 55.0, proximityRadius: 1.8 };
    }
    return { visionRange: 20.0, visionAngle: 75.0, proximityRadius: 2.0 };
}

/**
 * Kiểm tra xem một thực thể mục tiêu có nhìn thấy được từ vị trí người quan sát hay không
 * @param {object} observer - Người chơi hoặc Bot quan sát (cần có position, aimYaw, team)
 * @param {object} target - Mục tiêu (cần có position, team)
 * @param {object} visionConfig - Cấu hình tầm nhìn { visionRange, visionAngle, proximityRadius }
 * @returns {boolean} true nếu nhìn thấy được, false nếu bị che khuất
 */
export function checkEntityVisibility(observer, target, visionConfig) {
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

    // 2. Vùng cận cảnh xung quanh chân (Proximity)
    const proxRadius = visionConfig.proximityRadius || 2.0;
    if (distSq <= proxRadius * proxRadius) {
        return true;
    }

    // 3. Vượt quá tầm chiếu xa tối đa
    const maxRange = visionConfig.visionRange || 20.0;
    if (distSq > maxRange * maxRange) {
        return false;
    }

    // 4. Kiểm tra góc mở hình quạt trên mặt phẳng XZ
    const angleToTarget = Math.atan2(dx, dz);
    let angleDiff = Math.abs(angleToTarget - (observer.aimYaw || 0));
    while (angleDiff > Math.PI) {
        angleDiff = Math.abs(angleDiff - 2 * Math.PI);
    }

    const halfConeRad = ((visionConfig.visionAngle || 75.0) * Math.PI / 180) / 2;
    return angleDiff <= halfConeRad;
}

/**
 * Áp dụng ẩn/hiện model và thanh máu cho danh sách đối thủ
 * @param {object} observer - Người chơi chính
 * @param {Array} entities - Danh sách thực thể cần kiểm tra
 * @param {object} visionConfig - Cấu hình tầm nhìn hiện tại
 */
export function applyVisibilityCulling(observer, entities, visionConfig) {
    if (!entities || !Array.isArray(entities)) return;

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (!entity || entity.isDead) continue;

        const isVisible = checkEntityVisibility(observer, entity, visionConfig);
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
 * Lớp quản lý vẽ mặt nạ bóng tối 2D Canvas và khoét luồng sáng hình quạt
 */
export class VisionConeOverlay {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas?.getContext('2d');
        this.camera = camera;
        this.enabled = false;

        // Các thông số được nội suy (lerp) mượt mà khi chuyển trạng thái
        this.currentRange = 20.0;
        this.currentAngle = 75.0;
        this.currentProximity = 2.0;

        // Vector tạm để tính toán chiếu tọa độ
        this._tempV1 = new THREE.Vector3();
        this._tempV2 = new THREE.Vector3();
        this._tempV3 = new THREE.Vector3();

        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
    }

    initCanvasSize() {
        if (!this.canvas) return;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    clear() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Cập nhật thông số tầm nhìn theo thời gian thực (nội suy mượt mà)
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
     * Vẽ lớp mặt nạ bóng tối và khoét lỗ hình quạt
     */
    render(player, isEnabled = true) {
        if (!this.ctx || !this.canvas || !this.camera || !isEnabled || !player || player.isDead) {
            this.clear();
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // 1. Xóa khung hình cũ
        ctx.clearRect(0, 0, width, height);

        // 2. Phủ lớp bóng tối mờ nhẹ toàn màn hình (Fog of War mờ 40% để vẫn nhìn rõ vật thể và địa hình)
        ctx.fillStyle = 'rgba(8, 14, 24, 0.40)';
        ctx.fillRect(0, 0, width, height);

        // 3. Tính tọa độ màn hình của người chơi
        this._tempV1.copy(player.position);
        this._tempV1.project(this.camera);
        const screenX = (this._tempV1.x * 0.5 + 0.5) * width;
        const screenY = (-(this._tempV1.y * 0.5) + 0.5) * height;

        // 4. Tính góc xoay màn hình của hướng ngắm (aimYaw)
        const yaw = player.aimYaw || 0;
        this._tempV2.set(
            player.position.x + Math.sin(yaw) * 10,
            player.position.y,
            player.position.z + Math.cos(yaw) * 10
        );
        this._tempV2.project(this.camera);
        const fScreenX = (this._tempV2.x * 0.5 + 0.5) * width;
        const fScreenY = (-(this._tempV2.y * 0.5) + 0.5) * height;
        const screenAngle = Math.atan2(fScreenY - screenY, fScreenX - screenX);

        // 5. Tính bán kính điểm ảnh tương ứng trên màn hình
        this._tempV3.set(player.position.x + this.currentRange, player.position.y, player.position.z);
        this._tempV3.project(this.camera);
        const rScreenX = (this._tempV3.x * 0.5 + 0.5) * width;
        const screenRadius = Math.max(20, Math.abs(rScreenX - screenX));

        this._tempV3.set(player.position.x + this.currentProximity, player.position.y, player.position.z);
        this._tempV3.project(this.camera);
        const pScreenX = (this._tempV3.x * 0.5 + 0.5) * width;
        const screenProxRadius = Math.max(12, Math.abs(pScreenX - screenX));

        // 6. Khoét thủng bóng tối bằng destination-out
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // 6a. Khoét hình quạt tầm nhìn phía trước
        const halfAngleRad = ((this.currentAngle * Math.PI) / 180) / 2;
        const startAngle = screenAngle - halfAngleRad;
        const endAngle = screenAngle + halfAngleRad;

        const fanGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenRadius);
        fanGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        fanGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.95)');
        fanGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.5)');
        fanGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = fanGrad;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.arc(screenX, screenY, screenRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();

        // 6b. Khoét quầng sáng cận cảnh xung quanh chân
        const proxGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenProxRadius);
        proxGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        proxGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
        proxGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = proxGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenProxRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // 7. Vẽ viền sáng phản quang nhẹ ở mép luồng sáng để tạo cảm giác đèn pin rọi vào sương mù
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const rimGrad = ctx.createRadialGradient(screenX, screenY, screenProxRadius * 0.5, screenX, screenY, screenRadius);
        rimGrad.addColorStop(0, 'rgba(255, 245, 210, 0.08)');
        rimGrad.addColorStop(0.85, 'rgba(255, 230, 180, 0.04)');
        rimGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.arc(screenX, screenY, screenRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
