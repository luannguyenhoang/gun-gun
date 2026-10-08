import * as THREE from 'three';

/** A small world-space health bar that stays above a character's head. */
export class HealthBar3D {
    constructor(scene, { width = 1.25, offsetY = 2.2, color = 0x35e58a } = {}) {
        this.width = width;
        this.offsetY = offsetY;
        this.group = new THREE.Group();
        this.group.renderOrder = 100;

        const background = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 0.10, 0.22),
            new THREE.MeshBasicMaterial({ color: 0x1e1b2e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false })
        );
        // Thanh mau chinh (Do hoac Xanh luc)
        this.fill = new THREE.Mesh(
            new THREE.PlaneGeometry(width, 0.09),
            new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
        );
        this.fill.position.z = 0.006;

        // Thanh giap bao ho (Xanh lam ngoc bao ho - Armor)
        this.armorFill = new THREE.Mesh(
            new THREE.PlaneGeometry(width, 0.07),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
        );
        this.armorFill.position.z = 0.007;
        this.armorFill.visible = false;

        background.renderOrder = 100;
        this.fill.renderOrder = 101;
        this.armorFill.renderOrder = 102;

        background.onBeforeRender = (_renderer, _scene, camera) => {
            this.group.quaternion.copy(camera.quaternion);
            this.group.updateMatrixWorld(true);
        };
        this.group.add(background, this.fill, this.armorFill);
        scene.add(this.group);
        this.update(new THREE.Vector3(), 1, 1, 0, 0, false);
    }

    update(position, health, maxHealth, armor = 0, maxArmor = 0, visible = true) {
        // Tuong thich nguoc khi goi update(pos, hp, maxHp, visible)
        if (typeof armor === 'boolean') {
            visible = armor;
            armor = 0;
            maxArmor = 0;
        }

        this.group.position.set(position.x, position.y + this.offsetY, position.z);
        const ratio = Math.max(0, Math.min(1, Number(health) / Math.max(1, Number(maxHealth))));
        this.fill.scale.x = ratio;
        this.fill.position.x = -this.width * (1 - ratio) * 0.5;

        // Cap nhat thanh giap neu muc tieu co giap
        if (maxArmor > 0) {
            const aRatio = Math.max(0, Math.min(1, Number(armor) / Math.max(1, Number(maxArmor))));
            this.armorFill.scale.x = aRatio;
            this.armorFill.position.x = -this.width * (1 - aRatio) * 0.5;
            this.armorFill.visible = aRatio > 0;

            // Xep thanh giap o tren, thanh mau o duoi
            this.armorFill.position.y = 0.045;
            this.fill.position.y = -0.045;
        } else {
            this.armorFill.visible = false;
            this.fill.position.y = 0;
        }

        this.group.visible = visible;
    }

    dispose() {
        this.group.removeFromParent();
        this.group.traverse(child => {
            child.geometry?.dispose();
            child.material?.dispose();
        });
    }
}
