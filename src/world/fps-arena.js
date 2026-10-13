import * as THREE from 'three';
import { BaseArena } from './arena-base.js';

// Courtyard: four stone pavilions frame three lanes. All dimensions are metres.
// Architecture defines cover; the small, consistent asset palette only dresses it.
const PALETTE = {
    plaster: 0xe2d9bf, stone: 0xb4ac96, trim: 0xf0e6cc, roof: 0x95624d,
    paving: 0xcac5b1, joint: 0xaaa895, soil: 0x666c4b, leaf: 0x56745b,
    shutter: 0x3c605a, blue: 0x437e96, red: 0xaf6252, water: 0x579b9a,
};

export class FPSArena extends BaseArena {
    constructor(scene, gltfLoader) {
        super(scene, gltfLoader);
        this.halfSize = 28;
        this.radius = 29;
        this.ownedResources = new Set();
        // Traversable landmarks used by bots instead of random points inside buildings.
        this.patrolPoints = [
            [-19, -17], [-19, 0], [-19, 17], [19, -17], [19, 0], [19, 17],
            [-3.5, -10], [3.5, 10], [-3.5, 0], [3.5, 0], [-9, 0], [9, 0],
            [0, -17], [0, 17],
        ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    }

    async loadModels() {
        if (this.th_isLoaded) return;
        if (this.loading) return this.loading;
        this.loading = Promise.all(['fantasy/tree-high-round'].map(name =>
            new Promise(resolve => this.loader.load(`assets/models/${name}.glb`, gltf => {
                this.models[name] = gltf.scene;
                resolve();
            }, undefined, error => {
                console.warn(`[FPSArena] Optional dressing unavailable: ${name}`, error);
                resolve();
            }))
        ));
        await this.loading;
        this.th_isLoaded = true;
    }

    own(resource) {
        this.ownedResources.add(resource);
        return resource;
    }

    clearScene() {
        super.clearScene();
        // Only dispose generated resources; cached GLB geometry is reused on re-entry.
        for (const resource of this.ownedResources) resource.dispose();
        this.ownedResources.clear();
        this.batches = null;
    }

    box(name, x, y, z, width, height, depth, material, solid = false) {
        const transform = new THREE.Matrix4().compose(
            new THREE.Vector3(x, y + height / 2, z), new THREE.Quaternion(),
            new THREE.Vector3(width, height, depth));
        this.batches[material].push({ name, transform });
        if (solid) this.colliders.push(new THREE.Box3(
            new THREE.Vector3(x - width / 2, y, z - depth / 2),
            new THREE.Vector3(x + width / 2, y + height, z + depth / 2)));
    }

    flushArchitecture() {
        const geometry = this.own(new THREE.BoxGeometry(1, 1, 1));
        for (const [key, entries] of Object.entries(this.batches)) {
            if (!entries.length) continue;
            const material = this.own(new THREE.MeshStandardMaterial({ color: PALETTE[key], roughness: 0.92 }));
            const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
            mesh.name = `courtyard-${key}`;
            entries.forEach((entry, i) => mesh.setMatrixAt(i, entry.transform));
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = !['paving', 'joint', 'soil'].includes(key);
            mesh.receiveShadow = true;
            this.addSceneObject(mesh);
        }
        this.batches = null;
    }

    // Centre and ground assets using their actual bounds, never guessed source pivots.
    placeDressing(name, x, z, height, y = 0) {
        if (!this.models[name]) return null;
        const model = this.models[name].clone(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const scale = height / Math.max(size.y, 0.001);
        model.scale.multiplyScalar(scale);
        bounds.setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.add(new THREE.Vector3(x - center.x, y - bounds.min.y, z - center.z));
        model.traverse(child => {
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        this.addSceneObject(model);
        return model;
    }

    buildArena() {
        if (this.sceneObjects.length) return;
        this.batches = Object.fromEntries(Object.keys(PALETTE).map(key => [key, []]));
        this.setupLighting();
        this.buildGround();
        this.buildPerimeter();
        for (const x of [-9, 9]) for (const z of [-10, 10]) this.buildPavilion(x, z);
        this.buildBases();
        this.buildCourts();
        this.flushArchitecture();
        this.optimizeColliders();
        this.buildSpatialGrid();
    }

    setupLighting() {
        this.ambientLight = this.addSceneObject(new THREE.AmbientLight(0xfff4dc, 0.65));
        this.hemiLight = this.addSceneObject(new THREE.HemisphereLight(0xdceaf0, 0x787966, 1.15));
        this.sunLight = this.addSceneObject(new THREE.DirectionalLight(0xffebc9, 2.1));
        this.sunLight.position.set(-18, 32, 14);
        this.sunLight.shadow.mapSize.set(2048, 2048);
        Object.assign(this.sunLight.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 90 });
        this.sunLight.shadow.bias = -0.0003;
        this.sunLight.shadow.normalBias = 0.03;
        this.addSceneObject(this.sunLight.target);
    }

    buildGround() {
        this.box('foundation', 0, -0.22, 0, 57, 0.2, 57, 'joint');
        // Quiet paving grid, with broad light routes and darker planted edges.
        for (let x = -27; x <= 27; x += 2) for (let z = -27; z <= 27; z += 2) {
            this.box('paving', x, -0.02, z, 1.97, 0.02, 1.97, 'paving');
        }
        for (const x of [-15, -4.5, 4.5, 15]) {
            this.box('lane-inlay', x, 0.005, 0, 0.12, 0.012, 38, 'trim');
        }
        for (const z of [-19, -4, 4, 19]) {
            this.box('crossing-inlay', 0, 0.006, z, 48, 0.012, 0.12, 'trim');
        }
    }

    buildPerimeter() {
        for (const x of [-28, 28]) {
            this.box('boundary', x, 0, 0, 1, 3.4, 57, 'plaster', true);
            this.box('boundary-cap', x, 3.4, 0, 1.2, 0.2, 57, 'trim');
            this.box('boundary-foot', x, 0, 0, 1.1, 0.5, 57, 'stone');
        }
        for (const z of [-28, 28]) {
            this.box('boundary', 0, 0, z, 55, 3.4, 1, 'plaster', true);
            this.box('boundary-cap', 0, 3.4, z, 55, 0.2, 1.2, 'trim');
        }
        for (const x of [-28, 28]) for (const z of [-21, -7, 7, 21]) {
            this.box('wall-pier', x, 0, z, 1.35, 3.7, 1.35, 'stone');
        }
        // Silhouette trees are outside the playable boundary, never in a firing lane.
        for (const x of [-31, 31]) for (const z of [-24, -12, 0, 12, 24]) {
            this.placeDressing('fantasy/tree-high-round', x, z, 7.5);
        }
    }

    buildPavilion(x, z) {
        this.box('pavilion', x, 0, z, 7, 4.2, 10, 'plaster', true);
        this.box('plinth', x, 0, z, 7.2, 0.45, 10.2, 'stone');
        this.box('cornice', x, 3.95, z, 7.4, 0.3, 10.4, 'trim');
        this.box('roof-eave', x, 4.25, z, 7.7, 0.18, 10.7, 'roof');
        // A single low hipped roof profile gives every building the same silhouette.
        const roof = new THREE.Mesh(this.own(new THREE.ConeGeometry(1, 1.5, 4)),
            this.own(new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 1 })));
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(5.45, 1, 7.57);
        roof.position.set(x, 5.09, z);
        roof.castShadow = true;
        this.addSceneObject(roof);
        for (const side of [-1, 1]) {
            for (const dz of [-3, 0, 3]) {
                this.box('window-frame', x + side * 3.53, 1.45, z + dz, 0.12, 1.55, 1.4, 'trim');
                this.box('closed-shutter', x + side * 3.61, 1.55, z + dz, 0.06, 1.3, 1.15, 'shutter');
                this.box('window-sill', x + side * 3.65, 1.35, z + dz, 0.3, 0.13, 1.6, 'stone');
            }
            for (const dx of [-2, 2]) {
                this.box('end-window-frame', x + dx, 1.45, z + side * 5.03, 1.4, 1.55, 0.12, 'trim');
                this.box('end-shutter', x + dx, 1.55, z + side * 5.11, 1.15, 1.3, 0.06, 'shutter');
            }
        }
    }

    sign(text, x, y, z, rotation, color = '#365d59') {
        if (typeof document === 'undefined') return;
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 192;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 192);
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 492, 172);
        ctx.fillStyle = '#fff3d7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 55px sans-serif'; ctx.fillText(text, 256, 99);
        const texture = this.own(new THREE.CanvasTexture(canvas));
        texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(this.own(new THREE.PlaneGeometry(3.3, 1.24)),
            this.own(new THREE.MeshBasicMaterial({ map: texture })));
        sign.position.set(x, y, z); sign.rotation.y = rotation;
        this.addSceneObject(sign);
    }

    buildBases() {
        for (const side of [-1, 1]) {
            const z = side * 20;
            const team = side > 0 ? 'blue' : 'red';
            // Two solid wings protect spawns; three real openings remain at x=-17,0,17.
            for (const x of [-9, 9]) {
                this.box('spawn-screen', x, 0, z, 10, 2.8, 0.8, 'plaster', true);
                this.box('spawn-cap', x, 2.8, z, 10.3, 0.2, 1.05, 'trim');
                this.box('team-band', x, 1.9, z, 10.05, 0.4, 0.84, team);
            }
            // Centre entrance: colliders belong to the piers and lintel, not the opening.
            for (const x of [-3.4, 3.4]) {
                this.box('gate-pier', x, 0, z, 1.2, 4, 1.3, 'stone', true);
                this.box('gate-cap', x, 3.85, z, 1.5, 0.3, 1.55, 'trim');
            }
            this.box('gate-lintel', 0, 3.65, z, 5.6, 0.55, 1.3, 'stone', true);
            // Centre baffle prevents a spawn-to-spawn sightline; both sides have wide exits.
            this.box('spawn-baffle', 0, 0, side * 25.5, 8, 2.7, 0.7, 'plaster', true);
            this.box('baffle-cap', 0, 2.7, side * 25.5, 8.3, 0.2, 0.95, 'trim');
            this.sign(side > 0 ? 'SOUTH  /  01' : 'NORTH  /  02', 0, 1.8, side * 25.1,
                side > 0 ? Math.PI : 0, side > 0 ? '#3b7187' : '#985445');
            for (const x of [-21, 21]) this.planter(x, side * 24, 4, 3, true);
        }
    }

    planter(x, z, width, depth, tree = false) {
        this.box('planter', x, 0, z, width, 1.05, depth, 'stone', true);
        this.box('planter-rim', x, 0.95, z, width + 0.12, 0.16, depth + 0.12, 'trim');
        this.box('earth', x, 1.11, z, width - 0.35, 0.03, depth - 0.35, 'soil');
        if (tree) this.placeDressing('fantasy/tree-high-round', x, z, 4.5, 1.13);
        else this.box('clipped-hedge', x, 1.14, z, width - 0.5, 0.55, depth - 0.5, 'leaf', true);
    }

    buildCourts() {
        // Mid has one landmark and two clear 3 m passages, without stacked scenery.
        this.box('fountain-plinth', 0, 0, 0, 4.4, 0.55, 4.4, 'stone', true);
        for (const side of [-1, 1]) {
            this.box('basin-edge', side * 2.05, 0.55, 0, 0.3, 0.3, 4.4, 'trim', true);
            this.box('basin-edge', 0, 0.55, side * 2.05, 3.8, 0.3, 0.3, 'trim', true);
        }
        this.box('water', 0, 0.61, 0, 3.8, 0.025, 3.8, 'water');
        this.box('fountain-column', 0, 0.55, 0, 0.7, 1.45, 0.7, 'stone', true);
        this.box('upper-basin', 0, 1.5, 0, 1.8, 0.22, 1.8, 'trim', true);
        this.box('upper-water', 0, 1.725, 0, 1.5, 0.02, 1.5, 'water');
        this.box('fountain-cap', 0, 2, 0, 0.9, 0.15, 0.9, 'trim', true);
        // A: formal garden. B: a paved arcade court. Same cover footprint for both teams.
        for (const side of [-1, 1]) {
            this.planter(-22, side * 9, 4, 5, true);
            this.planter(22, side * 9, 4, 5, false);
            this.box('arcade-pier', 25.5, 0, side * 6, 0.8, 3.4, 0.8, 'stone', true);
            this.box('arcade-pier', 25.5, 0, side * 13, 0.8, 3.4, 0.8, 'stone', true);
            this.box('arcade-beam', 25.5, 3.4, side * 9.5, 1, 0.4, 8.4, 'trim', true);
            // Cover is offset to break the long flank sightline, with >= 3 m clearance.
            this.planter(-16.5, side * 3, 2.2, 3, false);
            this.planter(16.5, side * 3, 2.2, 3, false);
        }
        this.sign('A  /  GARDEN', -27.45, 2.15, 0, Math.PI / 2);
        this.sign('B  /  ARCADE', 27.45, 2.15, 0, -Math.PI / 2, '#985f47');
        for (const z of [-10, 10]) {
            this.sign('COURTYARD', -5.44, 3.1, z, Math.PI / 2);
        }
    }

    update() {}
}
