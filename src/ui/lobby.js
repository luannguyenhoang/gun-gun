import * as THREE from 'three';
import * as SkeletonUtils from '../../vendor/SkeletonUtils.js';
import { CHARACTER_CONFIGS, normalizeCharacter } from '../gameplay/player/characters.js';

export class RoomLobby {
    constructor(container, loader) {
        this.container = container;
        this.loader = loader;
        this.models = new Map();
        this.members = new Map();
        this.signature = '';
        this.scene = new THREE.Scene();
        this.scene.background = null;
        this.camera = new THREE.PerspectiveCamera(36, 2, 0.1, 100);
        this.camera.position.set(0, 4.7, 13.5);
        this.camera.lookAt(0, 1, 0);
        this.scene.add(new THREE.HemisphereLight(0xfff7df, 0x735338, 2.0));
        const light = new THREE.DirectionalLight(0xffebd6, 3.8);
        light.position.set(-4, 9, 6);
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.camera.left = -5;
        light.shadow.camera.right = 5;
        light.shadow.camera.top = 7;
        light.shadow.camera.bottom = -5;
        light.shadow.normalBias = 0.035;
        light.shadow.radius = 4;
        this.scene.add(light);

        // Ánh sáng Spotlight chiếu thẳng từ trên cao xuống bục
        const spotLight = new THREE.SpotLight(0xfff5e6, 2.2);
        spotLight.position.set(0, 9, 3);
        spotLight.target.position.set(0, 0, 0);
        spotLight.angle = Math.PI / 3.5;
        spotLight.penumbra = 0.5;
        this.scene.add(spotLight);
        this.scene.add(spotLight.target);

        // Bục tròn 3D phát sáng cao cấp theo ảnh mẫu (Glowing Stage Pedestal)
        this.pedestalGroup = new THREE.Group();

        // 1. Tầng đế dưới (Base cylinder: màu be hồng nhạt có viền nổi rộng bề thế)
        const baseGeo = new THREE.CylinderGeometry(3.25, 3.35, 0.28, 64);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x806359,
            roughness: 0.45,
            metalness: 0.08
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = -0.26;
        this.pedestalGroup.add(baseMesh);

        // 2. Tầng bục trên (Top cylinder: màu kem sáng bóng)
        const topGeo = new THREE.CylinderGeometry(2.9, 3.0, 0.2, 64);
        const topMat = new THREE.MeshStandardMaterial({
            color: 0x9d8077,
            roughness: 0.35,
            metalness: 0.05
        });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.y = -0.06;
        topMesh.receiveShadow = true;
        this.pedestalGroup.add(topMesh);

        // 3. Vòng neon phát sáng tròn (Glow Light Ring trên mặt bục rực rỡ)
        const ringGeo = new THREE.TorusGeometry(2.6, 0.075, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xfffae8, toneMapped: false
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 0.035;
        this.pedestalGroup.add(ringMesh);
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = glowCanvas.height = 256;
        const glowContext = glowCanvas.getContext('2d');
        const glowGradient = glowContext.createRadialGradient(128, 128, 0, 128, 128, 128);
        glowGradient.addColorStop(0, 'rgba(255,222,156,0)');
        glowGradient.addColorStop(0.70, 'rgba(255,222,156,0)');
        glowGradient.addColorStop(0.82, 'rgba(255,232,183,0.16)');
        glowGradient.addColorStop(0.867, 'rgba(255,247,216,0.85)');
        glowGradient.addColorStop(0.91, 'rgba(255,232,183,0.16)');
        glowGradient.addColorStop(1, 'rgba(255,222,156,0)');
        glowContext.fillStyle = glowGradient;
        glowContext.fillRect(0, 0, 256, 256);
        const rimGlow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(glowCanvas), transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        }));
        rimGlow.rotation.x = -Math.PI / 2;
        rimGlow.position.y = 0.06;
        this.pedestalGroup.add(rimGlow);
        // Transparent concentric rings soften the bright rim without a postprocessing pass.
        for (let i = 1; i <= 5; i++) {
            const halo = new THREE.Mesh(
                new THREE.TorusGeometry(2.6, 0.075 + i * 0.035, 12, 96),
                new THREE.MeshBasicMaterial({ color: 0xffefb8, transparent: true, opacity: 0.055, depthWrite: false })
            );
            halo.rotation.x = Math.PI / 2;
            halo.position.y = 0.035;
            this.pedestalGroup.add(halo);
        }

        // 4. Vòng viền đế phụ (Sub-glow ring)
        const subRingGeo = new THREE.TorusGeometry(3.2, 0.04, 16, 64);
        const subRingMat = new THREE.MeshBasicMaterial({
            color: 0xfff0db
        });
        const subRingMesh = new THREE.Mesh(subRingGeo, subRingMat);
        subRingMesh.rotation.x = Math.PI / 2;
        subRingMesh.position.y = -0.13;
        this.pedestalGroup.add(subRingMesh);

        this.scene.add(this.pedestalGroup);
        this.pedestalGroup.scale.set(0.65, 1, 0.65);
    }

    load(character) {
        if (!this.models.has(character)) {
            const config = CHARACTER_CONFIGS[character] || CHARACTER_CONFIGS[normalizeCharacter(character)];
            const file = config ? config.modelFile : 'character-male-d.glb';
            this.models.set(character, new Promise((resolve, reject) => this.loader.load(
                `assets/models/${file}`, resolve, undefined, reject)));
        }
        return this.models.get(character);
    }

    mount() {
        if (this.renderer) return;
        this.heading = document.createElement('div');
        this.heading.className = 'lobby-heading';
        this.stage = document.createElement('div');
        this.stage.className = 'lobby-stage';
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.domElement.setAttribute('aria-label', 'Các nhân vật đứng trong sảnh chờ');
        this.labels = document.createElement('div');
        this.labels.className = 'lobby-labels';
        this.stage.append(this.renderer.domElement, this.labels);
        this.container.replaceChildren(this.heading, this.stage);
    }

    update(data) {
        if (!this.container) return;
        this.mount();
        this.container.hidden = false;
        const players = data.players || [];
        this.solo = !!data.solo;
        this.container.classList?.toggle('solo-preview', this.solo);
        if (this.pedestalGroup) this.pedestalGroup.visible = this.solo;
        const signature = JSON.stringify([data.code, data.host, data.you, players, this.solo]);
        if (signature === this.signature) return;
        this.signature = signature;
        this.heading.innerHTML = '';
        const textSpan = document.createElement('span');
        textSpan.textContent = `SẢNH CHỜ · ${players.length}/4 NGƯỜI · MÃ ${data.code} `;
        
        const copyCodeBtn = document.createElement('button');
        copyCodeBtn.className = 'btn-toggle';
        copyCodeBtn.style.cssText = 'padding: 4px 10px; font-size: 10px; margin-left: 10px; vertical-align: middle; min-width: auto; height: auto;';
        copyCodeBtn.textContent = 'COPY MÃ';
        copyCodeBtn.onclick = () => {
            navigator.clipboard.writeText(data.code).then(() => {
                copyCodeBtn.textContent = 'ĐÃ COPY';
                setTimeout(() => copyCodeBtn.textContent = 'COPY MÃ', 2000);
            });
        };

        const copyLinkBtn = document.createElement('button');
        copyLinkBtn.className = 'btn-toggle';
        copyLinkBtn.style.cssText = 'padding: 4px 10px; font-size: 10px; margin-left: 6px; vertical-align: middle; min-width: auto; height: auto;';
        copyLinkBtn.textContent = 'COPY LINK';
        copyLinkBtn.onclick = () => {
            const link = window.location.href.split('?')[0] + '?room=' + data.code;
            navigator.clipboard.writeText(link).then(() => {
                copyLinkBtn.textContent = 'ĐÃ COPY';
                setTimeout(() => copyLinkBtn.textContent = 'COPY LINK', 2000);
            });
        };

        this.heading.append(textSpan, copyCodeBtn, copyLinkBtn);
        const ids = new Set(players.map(p => p.id));
        for (const [id, member] of this.members) {
            if (!ids.has(id)) { this.remove(member); this.members.delete(id); }
        }
        this.labels.replaceChildren();
        for (let index = 0; index < 4; index++) {
            const player = players[index];
            const label = document.createElement('div');
            label.className = 'lobby-nameplate';
            this.labels.append(label);
            if (!player) { label.textContent = '+ Chờ đồng đội'; continue; }
            const character = player.character || 'police';
            const name = document.createElement('strong');
            name.textContent = player.name + (player.id === data.you ? ' (Bạn)' : '');
            const charLabel = CHARACTER_CONFIGS[character]?.label || CHARACTER_CONFIGS[normalizeCharacter(character)]?.label || 'Chiến binh';
            const role = document.createElement('small');
            role.textContent = `${player.id === data.host ? '★ CHỦ PHÒNG' : 'ĐỒNG ĐỘI'} · ${charLabel}`;
            label.append(name, role);
            let member = this.members.get(player.id);
            if (member?.character !== character) {
                if (member) this.remove(member);
                member = { character, index, model: null, mixer: null };
                this.members.set(player.id, member);
                const pending = member;
                this.load(character).then(gltf => {
                    if (this.members.get(player.id) !== pending) return;
                    const model = SkeletonUtils.clone(gltf.scene);
                    model.traverse(node => { if (node.isMesh) node.castShadow = true; });
                    model.scale.setScalar(this.solo ? 4.3 : 2.7);
                    model.rotation.y = -0.3;
                    pending.model = model;
                    this.scene.add(model);
                    pending.mixer = new THREE.AnimationMixer(model);
                    const idle = gltf.animations?.find(clip => clip.name === 'idle');
                    if (idle) pending.mixer.clipAction(idle).play();
                    this.position(pending);
                }).catch(() => { if (this.members.get(player.id) === pending) role.textContent = 'Không tải được nhân vật'; });
            }
            member.index = index;
            this.position(member);
        }
    }

    position(member) {
        member.model?.scale.setScalar(this.solo ? 4.3 : 2.7);
        member.model?.position.set(this.solo ? 0 : (member.index - 1.5) * 2.7, this.solo ? -0.08 : 0.1, 0);
        if (this.solo || !member.model || !this.stage?.clientWidth) return;
        const label = this.labels.children[member.index];
        if (!label) return;
        // Anchor each model's feet to its actual nameplate, including responsive grid gaps.
        const stage = this.stage.getBoundingClientRect();
        const card = label.getBoundingClientRect();
        const point = new THREE.Vector3(
            ((card.left + card.width / 2 - stage.left) / stage.width) * 2 - 1,
            1 - ((card.top - 18 - stage.top) / stage.height) * 2,
            0.5
        ).unproject(this.camera);
        const direction = point.sub(this.camera.position);
        member.model.position.copy(this.camera.position).addScaledVector(direction, -this.camera.position.z / direction.z);
    }
    remove(member) {
        member.mixer?.stopAllAction();
        if (member.model) { member.mixer?.uncacheRoot(member.model); member.model.removeFromParent(); }
    }
    render(delta) {
        if (!this.renderer || !this.stage.clientWidth) return;
        const width = this.stage.clientWidth;
        const height = this.stage.clientHeight;
        if (this.width !== width || this.height !== height) {
            this.width = width; this.height = height;
            const scale = this.container.getBoundingClientRect().width / this.container.clientWidth;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * scale, 2.5));
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        if (this.solo) {
            // Đặt góc camera nghiêng nhìn xuống nhẹ để bục tròn nở elip 3D rõ nét và nằm chính giữa màn hình
            const dist = Math.max(8.4, 6.2 / this.camera.aspect);
            this.camera.position.set(0, 3.9, dist);
            // Aim slightly lower so the pedestal front edge has room inside the canvas.
            this.camera.lookAt(0, 1.0, 0);
        } else {
            this.camera.position.set(0, 4.7, Math.max(13.5, 17 / this.camera.aspect));
            this.camera.lookAt(0, 1, 0);
        }
        this.camera.updateMatrixWorld();
        for (const member of this.members.values()) {
            this.position(member);
            member.mixer?.update(delta);
            if (this.solo && member.model) member.model.rotation.y = -0.55;
        }
        this.renderer.render(this.scene, this.camera);
    }
}
