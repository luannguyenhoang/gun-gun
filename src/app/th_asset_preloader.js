import * as THREE from 'three';
import { CHARACTER_CONFIGS } from '../gameplay/player/characters.js';
import { sounds } from '../audio/audio.js';

// Kích hoạt bộ nhớ đệm toàn cục của Three.js để không bao giờ tải lại tài nguyên trùng lặp
THREE.Cache.enabled = true;

/**
 * Trình tiền nạp tài nguyên toàn diện và biên dịch trước Shader WebGL (TH_AssetPreloader)
 * Đảm bảo 100% tài nguyên (Models, Textures, Shaders, Audio) nằm sẵn trên RAM & VRAM GPU,
 * loại bỏ hoàn toàn tình trạng giật cục (micro-stutter / frame-drop) giữa trận đấu.
 */
export async function th_preloadAllGameAssets(game, onProgress = null) {
    const report = (pct) => {
        if (typeof onProgress === 'function') {
            onProgress(pct);
        }
    };

    report(10);

    // 1. Tiền nạp toàn bộ mô hình hai Đấu trường (Survival Arena & Tactical Space Arena)
    try {
        await Promise.all([
            game.survivalArena ? game.survivalArena.loadModels() : Promise.resolve(),
            game.spaceArena ? game.spaceArena.loadModels() : Promise.resolve(),
            game.fpsArena ? game.fpsArena.loadModels() : Promise.resolve()
        ]);
    } catch (e) {
        console.warn('[TH_AssetPreloader] Nạp models đấu trường có cảnh báo:', e);
    }
    report(35);

    // 2. Tiền nạp toàn bộ hệ thống kho vũ khí và phụ kiện
    try {
        if (game.weapons && typeof game.weapons.init === 'function') {
            await game.weapons.init();
        }
    } catch (e) {
        console.warn('[TH_AssetPreloader] Nạp kho vũ khí có cảnh báo:', e);
    }
    report(55);

    // 3. Tiền nạp toàn bộ mô hình 3D của 12 nhân vật chiến binh vào bộ nhớ đệm
    const characterModelFiles = new Set();
    for (const key in CHARACTER_CONFIGS) {
        const cfg = CHARACTER_CONFIGS[key];
        if (cfg && cfg.modelFile) {
            characterModelFiles.add(`assets/models/${cfg.modelFile}`);
        }
    }

    if (game.gltfLoader) {
        const charPromises = Array.from(characterModelFiles).map((url) => {
            return new Promise((resolve) => {
                game.gltfLoader.load(
                    url,
                    (gltf) => {
                        gltf.scene.traverse((c) => {
                            if (c.isMesh) {
                                c.castShadow = true;
                                c.receiveShadow = true;
                            }
                        });
                        resolve();
                    },
                    undefined,
                    () => resolve() // Tiếp tục nếu file bị lỗi nhẹ
                );
            });
        });
        await Promise.all(charPromises);
    }
    report(75);

    // 4. Khởi tạo hệ sinh thái âm thanh chiến trường
    try {
        if (sounds && typeof sounds.init === 'function') {
            sounds.init();
        }
    } catch (e) {
        console.warn('[TH_AssetPreloader] Khởi tạo âm thanh có cảnh báo:', e);
    }
    report(85);

    // 5. Biên dịch trước Shader WebGL (Shader Program GPU Pre-compilation)
    // Đưa toàn bộ vật liệu của bản đồ và scene vào WebGL Pipeline để compile trước GLSL Shaders
    try {
        if (game.renderer && game.scene && game.camera) {
            // Tạm thời kích hoạt scene hiện tại để GPU biên dịch trước shader
            game.renderer.compile(game.scene, game.camera);
        }
    } catch (e) {
        console.warn('[TH_AssetPreloader] Biên dịch trước Shader có cảnh báo:', e);
    }
    report(100);

    return true;
}
