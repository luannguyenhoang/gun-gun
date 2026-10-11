import * as THREE from 'three';

const _tempLosDir = new THREE.Vector3();
const _tempLosRay = new THREE.Ray();
const _tempLosHit = new THREE.Vector3();
const _navigationRay = new THREE.Ray();
const _navigationBox = new THREE.Box3();
const _navigationHit = new THREE.Vector3();
const _movementProbe = new THREE.Vector3();
const _tempNearbyColliders = [];
const _tempSlideColliders = [];

/**
 * Lớp cơ sở trừu tượng BaseArena
 * Chứa toàn bộ logic toán học, va chạm Box3, lưới không gian Spatial Grid,
 * thuật toán tìm đường A* và kiểm tra góc nhìn (Line of Sight) dùng chung.
 */
export class BaseArena {
    constructor(scene, gltfLoader) {
        this.scene = scene;
        this.loader = gltfLoader;
        this.colliders = []; // Mảng chứa các THREE.Box3 va chạm vật cản
        this.portals = [];
        this.models = {};
        this.tacticalLights = [];
        this.sceneObjects = []; // Danh sách đối tượng 3D đã thêm vào scene để dọn dẹp
        this.sunLight = null;
        this.ambientLight = null;
        this.hemiLight = null;
        this.halfSize = 25;
        this.radius = 26;

        // Cấu hình Lưới phân vùng không gian (Spatial Hash Grid)
        this.gridCellSize = 4.0;
        this.gridMinX = -32;
        this.gridMinZ = -32;
        this.gridCols = 16;
        this.gridRows = 16;
        this.gridCells = [];
        this._queryStamp = 0;
    }

    addSceneObject(obj) {
        if (!obj) return obj;
        this.sceneObjects.push(obj);
        this.scene.add(obj);
        return obj;
    }

    clearScene() {
        // Dọn dẹp toàn bộ vật thể, ánh sáng và lưới của bản đồ hiện tại
        for (const obj of this.sceneObjects) {
            if (obj.removeFromParent) {
                obj.removeFromParent();
            } else if (obj.parent) {
                obj.parent.remove(obj);
            }
            if (obj.geometry) {
                obj.geometry.dispose();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }
        this.sceneObjects = [];

        if (this.sunLight) {
            this.sunLight.removeFromParent?.();
            this.sunLight.target?.removeFromParent?.();
            this.sunLight = null;
        }
        if (this.ambientLight) {
            this.ambientLight.removeFromParent?.();
            this.ambientLight = null;
        }
        if (this.hemiLight) {
            this.hemiLight.removeFromParent?.();
            this.hemiLight = null;
        }

        this.colliders = [];
        this.portals = [];
        this.tacticalLights = [];
        this.gridCells = [];
    }

    placeInstance(modelName, position, rotationY = 0, scale = 1, addCollider = false) {
        const base = this.models[modelName];
        if (!base) return null;

        const clone = base.clone(true);
        clone.position.copy(position);
        clone.rotation.y = rotationY;
        clone.scale.set(scale, scale, scale);
        this.addSceneObject(clone);

        if (addCollider) {
            clone.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(clone);
            this.colliders.push(box);
        }

        return clone;
    }

    getMeshProps(modelName) {
        const base = this.models[modelName];
        if (!base) return null;
        let geo = null, mat = null;
        base.traverse(c => {
            if (c.isMesh && !geo) {
                geo = c.geometry;
                mat = c.material;
            }
        });
        return { geo, mat };
    }

    setQuality({ mode = 'optimized', shadows = false } = {}) {
        for (const light of this.tacticalLights) {
            light.visible = mode !== 'optimized';
        }
        if (this.sunLight) {
            this.sunLight.castShadow = !!shadows;
        }
    }

    getPortals() {
        return this.portals;
    }

    getPortalSpawnPosition(portal, radius) {
        const lateral = new THREE.Vector3(portal.spawnDir.z, 0, -portal.spawnDir.x);
        const jitter = (Math.random() - 0.5) * 1.5;
        for (let step = 0; step <= 16; step++) {
            const candidate = portal.spawnPos.clone()
                .addScaledVector(portal.spawnDir, radius + 0.15 + step * 0.5)
                .addScaledVector(lateral, jitter);
            if (!this.checkCollision(candidate, radius)) return candidate;
        }
        return null;
    }

    optimizeColliders() {
        // Hợp nhất các hộp va chạm thẳng hàng tiếp giáp nhau để chống kẹt mép tường
        let merged = true;
        let maxMergeSteps = 500;
        while (merged && --maxMergeSteps > 0) {
            merged = false;
            for (let i = 0; i < this.colliders.length; i++) {
                const a = this.colliders[i];
                for (let j = i + 1; j < this.colliders.length; j++) {
                    const b = this.colliders[j];

                    if (Math.abs(a.min.y - b.min.y) > 0.3 || Math.abs(a.max.y - b.max.y) > 0.3) continue;

                    // Hợp nhất theo trục X
                    if (Math.abs(a.min.z - b.min.z) < 0.25 && Math.abs(a.max.z - b.max.z) < 0.25) {
                        const touchesX = (a.max.x >= b.min.x - 0.2) && (a.min.x <= b.max.x + 0.2);
                        if (touchesX) {
                            a.min.x = Math.min(a.min.x, b.min.x);
                            a.max.x = Math.max(a.max.x, b.max.x);
                            a.min.z = Math.min(a.min.z, b.min.z);
                            a.max.z = Math.max(a.max.z, b.max.z);
                            this.colliders.splice(j, 1);
                            merged = true;
                            break;
                        }
                    }

                    // Hợp nhất theo trục Z
                    if (Math.abs(a.min.x - b.min.x) < 0.25 && Math.abs(a.max.x - b.max.x) < 0.25) {
                        const touchesZ = (a.max.z >= b.min.z - 0.2) && (a.min.z <= b.max.z + 0.2);
                        if (touchesZ) {
                            a.min.x = Math.min(a.min.x, b.min.x);
                            a.max.x = Math.max(a.max.x, b.max.x);
                            a.min.z = Math.min(a.min.z, b.min.z);
                            a.max.z = Math.max(a.max.z, b.max.z);
                            this.colliders.splice(j, 1);
                            merged = true;
                            break;
                        }
                    }
                }
                if (merged) break;
            }
        }
    }

    buildSpatialGrid() {
        const totalCells = this.gridCols * this.gridRows;
        this.gridCells = new Array(totalCells);
        for (let i = 0; i < totalCells; i++) {
            this.gridCells[i] = [];
        }
        const invCell = 1 / this.gridCellSize;
        for (let b = 0; b < this.colliders.length; b++) {
            const box = this.colliders[b];
            box._colliderId = b;
            box._queryStamp = 0;

            const minCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((box.min.x - this.gridMinX) * invCell)));
            const maxCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((box.max.x - this.gridMinX) * invCell)));
            const minRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((box.min.z - this.gridMinZ) * invCell)));
            const maxRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((box.max.z - this.gridMinZ) * invCell)));

            for (let r = minRow; r <= maxRow; r++) {
                const rowOffset = r * this.gridCols;
                for (let c = minCol; c <= maxCol; c++) {
                    this.gridCells[rowOffset + c].push(box);
                }
            }
        }
    }

    getCollidersInRadius(x, z, radius, outList = []) {
        outList.length = 0;
        if (!this.gridCells || this.gridCells.length === 0) {
            for (let i = 0; i < this.colliders.length; i++) outList.push(this.colliders[i]);
            return outList;
        }

        this._queryStamp++;
        const stamp = this._queryStamp;
        const invCell = 1 / this.gridCellSize;

        const minCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((x - radius - this.gridMinX) * invCell)));
        const maxCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((x + radius - this.gridMinX) * invCell)));
        const minRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((z - radius - this.gridMinZ) * invCell)));
        const maxRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((z + radius - this.gridMinZ) * invCell)));

        for (let r = minRow; r <= maxRow; r++) {
            const rowOffset = r * this.gridCols;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = this.gridCells[rowOffset + c];
                for (let i = 0; i < cell.length; i++) {
                    const box = cell[i];
                    if (box._queryStamp !== stamp) {
                        box._queryStamp = stamp;
                        outList.push(box);
                    }
                }
            }
        }
        return outList;
    }

    getCollidersInAABB(minX, minZ, maxX, maxZ, outList = []) {
        outList.length = 0;
        if (!this.gridCells || this.gridCells.length === 0) {
            for (let i = 0; i < this.colliders.length; i++) outList.push(this.colliders[i]);
            return outList;
        }

        this._queryStamp++;
        const stamp = this._queryStamp;
        const invCell = 1 / this.gridCellSize;

        const minCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((minX - this.gridMinX) * invCell)));
        const maxCol = Math.max(0, Math.min(this.gridCols - 1, Math.floor((maxX - this.gridMinX) * invCell)));
        const minRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((minZ - this.gridMinZ) * invCell)));
        const maxRow = Math.max(0, Math.min(this.gridRows - 1, Math.floor((maxZ - this.gridMinZ) * invCell)));

        for (let r = minRow; r <= maxRow; r++) {
            const rowOffset = r * this.gridCols;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = this.gridCells[rowOffset + c];
                for (let i = 0; i < cell.length; i++) {
                    const box = cell[i];
                    if (box._queryStamp !== stamp) {
                        box._queryStamp = stamp;
                        outList.push(box);
                    }
                }
            }
        }
        return outList;
    }

    raycastClosestDistance(ray, maxDist, originX, originZ, cachedCandidates = null) {
        const dir = ray.direction;
        const targetX = ray.origin.x + dir.x * maxDist;
        const targetZ = ray.origin.z + dir.z * maxDist;
        const minX = Math.min(ray.origin.x, targetX) - 0.5;
        const maxX = Math.max(ray.origin.x, targetX) + 0.5;
        const minZ = Math.min(ray.origin.z, targetZ) - 0.5;
        const maxZ = Math.max(ray.origin.z, targetZ) + 0.5;

        const candidates = cachedCandidates || this.getCollidersInAABB(minX, minZ, maxX, maxZ, _tempNearbyColliders);
        let closestDist = maxDist;

        for (let i = 0; i < candidates.length; i++) {
            const col = candidates[i];
            if (col.max.y <= 0.4 || col.min.y >= 3.0) continue;
            const hit = ray.intersectBox(col, _tempLosHit);
            if (hit) {
                const d = Math.hypot(hit.x - originX, hit.z - originZ);
                if (d < closestDist) {
                    closestDist = Math.max(0.1, d - 0.05);
                }
            }
        }
        return closestDist;
    }

    checkCollision(pos, radius = 0.5) {
        const candidates = this.getCollidersInRadius(pos.x, pos.z, radius, _tempNearbyColliders);
        const radSq = radius * radius;
        for (let i = 0; i < candidates.length; i++) {
            const col = candidates[i];
            if (col.max.y <= pos.y + 0.1 || col.min.y >= pos.y + 1.9) continue;
            const x = Math.max(col.min.x, Math.min(pos.x, col.max.x));
            const z = Math.max(col.min.z, Math.min(pos.z, col.max.z));
            if ((pos.x - x) ** 2 + (pos.z - z) ** 2 < radSq) return true;
        }
        return false;
    }

    moveCharacter(position, dx, dz, radius) {
        // 1. Giải phóng chồng lấn nếu đã bị lún từ trước (Spawn, knockback, sai số tọa độ)
        const nearby = this.getCollidersInRadius(position.x, position.z, radius + 0.2, _tempNearbyColliders);
        for (let pass = 0; pass < 3; pass++) {
            let hadOverlap = false;
            for (let i = 0; i < nearby.length; i++) {
                const box = nearby[i];
                if (box.max.y <= position.y + 0.1 || box.min.y >= position.y + 1.9) continue;
                const cx = Math.max(box.min.x, Math.min(position.x, box.max.x));
                const cz = Math.max(box.min.z, Math.min(position.z, box.max.z));
                const ox = position.x - cx;
                const oz = position.z - cz;
                const distSq = ox * ox + oz * oz;
                if (distSq >= radius * radius) continue;

                hadOverlap = true;
                const dist = Math.sqrt(distSq);
                if (dist > 0.0001) {
                    const pen = radius - dist;
                    position.x += (ox / dist) * (pen + 0.002);
                    position.z += (oz / dist) * (pen + 0.002);
                } else {
                    const left = Math.abs(position.x - box.min.x);
                    const right = Math.abs(box.max.x - position.x);
                    const bottom = Math.abs(position.z - box.min.z);
                    const top = Math.abs(box.max.z - position.z);
                    const minDist = Math.min(left, right, bottom, top);
                    if (minDist === left) position.x = box.min.x - radius - 0.002;
                    else if (minDist === right) position.x = box.max.x + radius + 0.002;
                    else if (minDist === bottom) position.z = box.min.z - radius - 0.002;
                    else position.z = box.max.z + radius + 0.002;
                }
            }
            if (!hadOverlap) break;
        }

        // 2. Di chuyển theo bước nhỏ (Substeps) kết hợp trượt tiếp tuyến chống kẹt (Tangent Slide)
        const totalDist = Math.hypot(dx, dz);
        if (totalDist < 0.00001) return;

        const maxStepSize = Math.min(radius * 0.45, 0.16);
        const steps = Math.max(1, Math.ceil(totalDist / maxStepSize));
        const subDx = dx / steps;
        const subDz = dz / steps;

        for (let s = 0; s < steps; s++) {
            let curDx = subDx;
            let curDz = subDz;

            for (let slideIter = 0; slideIter < 3; slideIter++) {
                const moveLen = Math.hypot(curDx, curDz);
                if (moveLen < 0.0001) break;

                const targetX = position.x + curDx;
                const targetZ = position.z + curDz;

                const localColliders = this.getCollidersInRadius(targetX, targetZ, radius, _tempSlideColliders);
                let hitBox = null;
                let maxPen = 0;
                let normX = 0, normZ = 0;

                for (let i = 0; i < localColliders.length; i++) {
                    const box = localColliders[i];
                    if (box.max.y <= position.y + 0.1 || box.min.y >= position.y + 1.9) continue;
                    const cx = Math.max(box.min.x, Math.min(targetX, box.max.x));
                    const cz = Math.max(box.min.z, Math.min(targetZ, box.max.z));
                    const ox = targetX - cx;
                    const oz = targetZ - cz;
                    const distSq = ox * ox + oz * oz;

                    if (distSq < radius * radius) {
                        const dist = Math.sqrt(distSq);
                        const pen = radius - dist;
                        if (pen > maxPen) {
                            maxPen = pen;
                            hitBox = box;
                            if (dist > 0.0001) {
                                normX = ox / dist;
                                normZ = oz / dist;
                            } else {
                                const left = Math.abs(targetX - box.min.x);
                                const right = Math.abs(box.max.x - targetX);
                                const bottom = Math.abs(targetZ - box.min.z);
                                const top = Math.abs(box.max.z - targetZ);
                                const minD = Math.min(left, right, bottom, top);
                                if (minD === left) { normX = -1; normZ = 0; }
                                else if (minD === right) { normX = 1; normZ = 0; }
                                else if (minD === bottom) { normX = 0; normZ = -1; }
                                else { normX = 0; normZ = 1; }
                            }
                        }
                    }
                }

                if (!hitBox) {
                    position.x = targetX;
                    position.z = targetZ;
                    break;
                }

                position.x = targetX + normX * (maxPen + 0.002);
                position.z = targetZ + normZ * (maxPen + 0.002);

                const dot = curDx * normX + curDz * normZ;
                if (dot < 0) {
                    curDx -= normX * dot;
                    curDz -= normZ * dot;
                } else {
                    break;
                }
            }
        }
    }

    navigationClear(from, to, radius) {
        const direction = _navigationRay.direction.subVectors(to, from);
        direction.y = 0;
        const length = direction.length();
        direction.normalize();
        const ray = _navigationRay;
        ray.origin.set(from.x, 1, from.z);
        const hit = _navigationHit;

        const minX = Math.min(from.x, to.x) - radius - 0.5;
        const maxX = Math.max(from.x, to.x) + radius + 0.5;
        const minZ = Math.min(from.z, to.z) - radius - 0.5;
        const maxZ = Math.max(from.z, to.z) + radius + 0.5;
        const candidates = this.getCollidersInAABB(minX, minZ, maxX, maxZ, _tempNearbyColliders);

        for (let i = 0; i < candidates.length; i++) {
            const collider = candidates[i];
            if (collider.max.y <= 0.1 || collider.min.y >= 1.9) continue;
            const box = _navigationBox.copy(collider);
            box.min.x -= radius; box.max.x += radius;
            box.min.z -= radius; box.max.z += radius;
            box.min.y = 0; box.max.y = 2;
            if (box.containsPoint(ray.origin)) return false;
            if (ray.intersectBox(box, hit) && hit.distanceTo(ray.origin) < length) return false;
        }
        return true;
    }

    findNavigationPath(from, to, radius) {
        if (this.navigationClear(from, to, radius)) return [to.clone()];
        const nodes = [from.clone(), to.clone()];
        const margin = radius + 0.16;
        const minX = Math.min(from.x, to.x) - 8;
        const maxX = Math.max(from.x, to.x) + 8;
        const minZ = Math.min(from.z, to.z) - 8;
        const maxZ = Math.max(from.z, to.z) + 8;
        const localBoxes = this.getCollidersInAABB(minX, minZ, maxX, maxZ, _tempNearbyColliders);

        for (let i = 0; i < localBoxes.length; i++) {
            const box = localBoxes[i];
            if (box.max.y <= 0.1 || box.min.y >= 1.9) continue;
            for (const x of [box.min.x - margin, box.max.x + margin]) {
                for (const z of [box.min.z - margin, box.max.z + margin]) {
                    const point = new THREE.Vector3(x, 0, z);
                    if (!this.checkCollision(point, radius)) nodes.push(point);
                }
            }
        }
        const costs = nodes.map(() => Infinity), parents = [], closed = new Set();
        costs[0] = 0;
        while (closed.size < nodes.length) {
            let current = -1, best = Infinity;
            for (let i = 0; i < nodes.length; i++) {
                const value = costs[i] + nodes[i].distanceTo(to);
                if (!closed.has(i) && value < best) { best = value; current = i; }
            }
            if (current < 0) break;
            if (current === 1) {
                const path = [];
                let currIdx = 1;
                let stepCount = 0;
                while (currIdx !== 0 && currIdx !== undefined && stepCount++ < nodes.length) {
                    path.unshift(nodes[currIdx]);
                    currIdx = parents[currIdx];
                }
                return path;
            }
            closed.add(current);
            for (let i = 1; i < nodes.length; i++) {
                if (closed.has(i)) continue;
                const cost = costs[current] + nodes[current].distanceTo(nodes[i]);
                if (cost < costs[i] && this.navigationClear(nodes[current], nodes[i], radius)) {
                    costs[i] = cost; parents[i] = current;
                }
            }
        }
        return [];
    }

    hasLineOfSight(fromPos, toPos) {
        _tempLosDir.subVectors(toPos, fromPos);
        _tempLosDir.y = 0;
        const dist = _tempLosDir.length();
        if (dist <= 0.0001) return true;
        _tempLosDir.multiplyScalar(1 / dist);

        _tempLosRay.origin.set(fromPos.x, 1.0, fromPos.z);
        _tempLosRay.direction.copy(_tempLosDir);

        const minX = Math.min(fromPos.x, toPos.x) - 0.5;
        const maxX = Math.max(fromPos.x, toPos.x) + 0.5;
        const minZ = Math.min(fromPos.z, toPos.z) - 0.5;
        const maxZ = Math.max(fromPos.z, toPos.z) + 0.5;
        const candidates = this.getCollidersInAABB(minX, minZ, maxX, maxZ, _tempNearbyColliders);

        for (let i = 0; i < candidates.length; i++) {
            const col = candidates[i];
            if (col.max.y <= 0.4 || col.min.y >= 3.0) continue;
            const hit = _tempLosRay.intersectBox(col, _tempLosHit);
            if (hit) {
                const hitDist = Math.hypot(hit.x - fromPos.x, hit.z - fromPos.z);
                if (hitDist < dist - 0.25) {
                    return false;
                }
            }
        }
        return true;
    }
}
