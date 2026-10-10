import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/loaders/GLTFLoader.js';
import { sounds } from '../audio/audio.js?v=58';
import { ParticleSystem } from '../rendering/particles.js?v=68';
import { Arena, SurvivalArena, SpaceArena } from '../world/arena.js?v=25';
import { WeaponSystem, getStartingWeapon, WEAPON_CONFIGS, getBombConfig, th_getWeaponParts, th_computeWeaponFinalStats, TH_PART_META } from '../gameplay/combat/weapons.js?v=71';
import { PlayerController } from '../gameplay/player/player.js?v=74';
import { WaveManager, Zombie } from '../gameplay/combat/enemies.js?v=69';
import { PickupManager } from '../gameplay/loot/pickups.js?v=40';
import { UIManager } from '../ui/ui.js?v=43';
import { NetworkRoom, makeRemotePlayer } from '../network/network.js?v=71';
import { normalizeCharacter, isCharacterUnlocked, unlockCharacter } from '../gameplay/player/characters.js';
import { RoomLobby } from '../ui/lobby.js?v=37';
import { HomeMenu } from '../ui/home.js?v=59';
import { LootingSystem } from '../gameplay/loot/looting.js?v=70';
import { RenderQuality } from '../rendering/performance.js?v=2';
import { saveGameProgressToCloud, flushGameProgress } from '../network/auth.js?v=49';
import { VisionConeOverlay, getWeaponVisionConfig, applyVisibilityCulling } from '../gameplay/combat/vision-cone.js?v=72';
import { TDMManager } from '../gameplay/combat/tdm.js?v=2';
import { FirstPersonView } from '../gameplay/player/first-person.js?v=2';

class CyberArenaGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.state = 'LOADING'; // LOADING, MENU, PLAYING, PAUSED, GAMEOVER

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_arena_highscore') || '0', 10);
        this.currentWave = 1; // Infinite Phase counter
        this.gameMode = 'SURVIVAL'; // 'SURVIVAL' hoặc 'TDM'
        this.selectedGameMode = 'SURVIVAL';
        this.selectedTDMTeam = 'blue';
        this.characterId = normalizeCharacter(localStorage.getItem('cyber_arena_character') || 'police');
        this.nextWaveTimer = 0;
        this.clock = new THREE.Clock();
        this.network = new NetworkRoom(this);
        this.remotePlayers = new Map();
        this.remoteProjectiles = new Map();
        this.networkEvents = [];
        this.hitEventSeq = 0;
        this.lastHitEventId = 0;
        this.practiceBot = null;
        this.animate = this.animate.bind(this);
        this.radarElapsed = 0;
        this.developerMode = localStorage.getItem('arena_developer_mode') === 'true';
        window.developerMode = this.developerMode;

        // Hệ thống Tiền vàng và Mở khóa Súng (Shop & Armory)
        this.coins = parseInt(localStorage.getItem('arena_player_coins') || '1000', 10);
        this.unlockedWeapons = JSON.parse(localStorage.getItem('arena_unlocked_weapons') || '["blaster","repeater","scatter"]');
        try {
            this.th_weaponParts = JSON.parse(localStorage.getItem('th_weapon_parts') || '{}');
        } catch {
            this.th_weaponParts = {};
        }

        if (this.developerMode) {
            this.coins = 999999;
            this.unlockedWeapons = WEAPON_CONFIGS.map(w => w.id);
        }

        // Cấu hình tối ưu đồ họa và hiệu năng (Mặc định tối ưu mượt mà, tắt lửa nòng và tia lửa)
        let savedPerf = null;
        try {
            savedPerf = JSON.parse(localStorage.getItem('arena_perf_settings') || 'null');
        } catch { }
        this.perfSettings = savedPerf || {
            muzzleFlash: false,     // Mặc định tắt lửa nòng súng để tối ưu theo yêu cầu
            bulletSparks: false,    // Mặc định tắt tia lửa va chạm đạn để tăng FPS tối đa
            shadows: false,         // Mặc định tắt bóng đổ để nhẹ GPU
            mode: 'optimized'       // 'optimized' (Mượt mà) hoặc 'full' (Đầy đủ)
        };

        this.initThree();
        this.initSubsystems();
        this.initDOM();
        this.loadAssetsAndStart();
    }

    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c1017);
        this.scene.fog = new THREE.FogExp2(0x161a24, 0.022);

        // Camera tam nhin chien thuat rong bao quat tam ban va non tam nhin
        this.viewHeight = 26;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-this.viewHeight * aspect / 2, this.viewHeight * aspect / 2,
            this.viewHeight / 2, -this.viewHeight / 2, 0.1, 300);
        // High-Performance WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.perfSettings.mode !== 'optimized',
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderQuality = new RenderQuality(window.devicePixelRatio);
        this.renderQuality.configure(window.devicePixelRatio, window.innerWidth, window.innerHeight, this.perfSettings.mode);
        this.renderer.setPixelRatio(this.renderQuality.ratio);
        this.renderer.shadowMap.enabled = !!this.perfSettings.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        // Resize handler
        window.addEventListener('resize', () => {
            const aspect = window.innerWidth / window.innerHeight;
            this.camera.left = -this.viewHeight * aspect / 2;
            this.camera.right = this.viewHeight * aspect / 2;
            this.camera.updateProjectionMatrix();
            this.renderQuality.configure(window.devicePixelRatio, window.innerWidth, window.innerHeight, this.perfSettings.mode);
            this.renderer.setPixelRatio(this.renderQuality.ratio);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.visionCone?.initCanvasSize?.();
        });

        // GLTF Loader
        this.gltfLoader = new GLTFLoader();
    }

    initSubsystems() {
        this.particles = new ParticleSystem(this.scene);
        this.particles.setQuality(this.perfSettings);
        this.survivalArena = new SurvivalArena(this.scene, this.gltfLoader);
        this.spaceArena = new SpaceArena(this.scene, this.gltfLoader);
        this.arena = this.survivalArena;
        this.weapons = new WeaponSystem(this.scene, this.gltfLoader, this.particles);
        const initialLoadout = this.getLoadout();
        this.weapons.startingWeaponId = initialLoadout.primary;
        this.player = new PlayerController(this.camera, this.canvas, this.arena, this.weapons, true, this.characterId);
        this.player.developerMode = this.developerMode;
        this.waveManager = new WaveManager(this.scene, this.gltfLoader, this.weapons, this.particles, this.arena);
        this.pickups = new PickupManager(this.scene, this.particles);
        this.ui = new UIManager();
        this.player.ui = this.ui;
        this.lootingSystem = new LootingSystem(this.scene, this.particles, this.player, this.waveManager, this.ui);
        this.coopPlayers = [this.player];
        this.reviveZoneMeshes = new Map();

        // Khởi tạo hệ thống Tầm nhìn hình quạt và Chế độ đối kháng TDM
        this.visionCone = new VisionConeOverlay(document.getElementById('vision-cone-canvas'), this.camera);
        this.tdmManager = new TDMManager(this);
        this.firstPersonView = new FirstPersonView(this);

        // Lắng nghe phát bắn của người chơi Host để broadcast cho đồng đội
        this.weapons.onShotFired = (info) => {
            if (this.network.active && this.network.host) {
                (this.networkEvents ||= []).push({
                    type: 'shot',
                    shooterId: 'host',
                    origin: info.origin.toArray(),
                    target: info.target.toArray(),
                    weaponId: info.weapon?.id,
                    color: info.color,
                    bulletType: info.bulletType || 'rifle',
                    ads: !!info.ads
                });
            }
        };

        // Lắng nghe ném bom của người chơi Host để broadcast cho đồng đội
        this.weapons.onBombThrown = (info) => {
            if (this.network.active && this.network.host) {
                (this.networkEvents ||= []).push({
                    type: 'throw_bomb',
                    throwerId: info.throwerId || 'host',
                    origin: info.origin.toArray(),
                    target: info.target.toArray(),
                    weaponId: info.weaponId || info.weapon?.id
                });
            }
        };
    }

    initDOM() {
        this.screenLoading = document.getElementById('screen-loading');
        this.screenMenu = document.getElementById('screen-menu');
        this.screenPause = document.getElementById('screen-pause');
        this.screenGameOver = document.getElementById('screen-gameover');
        this.hud = document.getElementById('hud');

        this.btnStart = document.getElementById('btn-start');
        this.btnStartParty = document.getElementById('btn-start-party');
        this.btnResume = document.getElementById('btn-resume');
        this.btnRestartPause = document.getElementById('btn-restart-pause');
        this.btnRestartOver = document.getElementById('btn-restart-gameover');
        this.roomName = document.getElementById('room-name');
        this.roomLobby = new RoomLobby(document.getElementById('room-lobby'), this.gltfLoader);
        this.roomLobby.onSwitchTeam = (team) => {
            this.network.setTeam(team);
        };
        this.roomLobby.onToggleFillBots = () => {
            this.network.toggleFillBots();
        };
        this.roomCode = document.getElementById('room-code');
        this.roomCopy = document.getElementById('room-copy');
        this.roomStatus = document.getElementById('room-status');
        this.roomStart = document.getElementById('room-start');
        this.roomCreate = document.getElementById('room-create');
        this.roomJoin = document.getElementById('room-join');
        this.roomLeave = document.getElementById('room-leave');
        this.characterOptions = [...document.querySelectorAll('[data-character]')];
        this.characterOptions.forEach(option => option.addEventListener('click', () => this.selectCharacter(option.dataset.character)));
        this.updateCharacterSelection();
        this.roomCreate?.addEventListener('click', () => this.createRoom());
        this.roomJoin?.addEventListener('click', () => this.joinRoom());
        this.roomCopy?.addEventListener('click', () => this.copyRoomCode());
        this.roomStart?.addEventListener('click', () => this.network.start().catch(e => this.showRoomError(e.message)));
        this.roomLeave?.addEventListener('click', () => this.network.leave());
        this.homeMenu = new HomeMenu(this);
        document.getElementById('hud-pause')?.addEventListener('click', () => this.pauseGame());
        document.querySelectorAll('[data-return-home]').forEach(button => button.addEventListener('click', () => this.returnToMenu()));

        this.finalScoreEl = document.getElementById('final-score');
        this.finalWaveEl = document.getElementById('final-wave');
        this.highScoreMenuEl = document.getElementById('menu-highscore');
        this.highScoreOverEl = document.getElementById('gameover-highscore');

        if (this.highScoreMenuEl) {
            this.highScoreMenuEl.textContent = this.highScore.toLocaleString();
        }

        // Button listeners
        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => {
                if (this.selectedGameMode === 'FPS_SOLO') {
                    if (this.network.active) {
                        if (this.network.host) this.network.start();
                    } else this.startTDM('blue', { fillBots: true });
                } else if (this.selectedGameMode === 'TDM') {
                    this.startTDM(this.selectedTDMTeam || 'blue', { fillBots: !!this.soloFillBots });
                } else {
                    this.startGame();
                }
            });
        }
        if (this.btnStartParty) {
            this.btnStartParty.addEventListener('click', () => {
                this.createRoom();
            });
        }
        if (this.btnResume) {
            this.btnResume.addEventListener('click', () => this.resumeGame());
        }
        if (this.btnRestartPause) {
            this.btnRestartPause.addEventListener('click', () => this.restartGame());
        }
        if (this.btnRestartOver) {
            this.btnRestartOver.addEventListener('click', () => this.restartGame());
        }
        this.btnToggleBot = document.getElementById('btn-toggle-bot');
        if (this.btnToggleBot) {
            this.btnToggleBot.addEventListener('click', () => this.togglePracticeBot());
        }
        this.btnToggleDevMode = document.getElementById('btn-toggle-devmode');
        if (this.btnToggleDevMode) {
            this.btnToggleDevMode.addEventListener('click', () => this.toggleDeveloperMode());
        }

        // Phím Pause (ESC) và Phím Admin Full Súng (F2)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'F2') {
                e.preventDefault();
                this.toggleDeveloperMode();
                return;
            }
            if (e.code === 'Escape') {
                if (e.defaultPrevented || e.repeat) return;
                // Nếu đang mở hòm đồ hoặc balo, ưu tiên đóng trước và không mở menu pause
                if (this.lootingSystem?.isBackpackOpen || this.lootingSystem?.activeContainer?.isOpen) {
                    this.lootingSystem.closeContainerUI();
                    return;
                }
                if (this.pauseMenuOpen) {
                    this.resumeGame();
                } else if (this.state === 'PLAYING') {
                    this.pauseGame();
                } else if (this.state === 'PAUSED') {
                    this.resumeGame();
                }
            }
        });

        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING' && !this.network.active) this.pauseGame();
        });

        // Sound toggles in pause menu
        const soundBtn = document.getElementById('toggle-sound');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const on = sounds.toggleAudio();
                soundBtn.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
                this.homeMenu?.syncAudio();
            });
        }
        const musicBtn = document.getElementById('toggle-music');
        if (musicBtn) {
            musicBtn.addEventListener('click', () => {
                const on = sounds.toggleMusic();
                musicBtn.textContent = on ? 'MUSIC: ON' : 'MUSIC: OFF';
                this.homeMenu?.syncAudio();
            });
        }

        const pauseMusicSlider = document.getElementById('pause-music-slider');
        if (pauseMusicSlider) {
            pauseMusicSlider.addEventListener('input', (e) => {
                sounds.setMusicVolume(e.target.value / 100);
                this.homeMenu?.syncAudio();
            });
        }
        const pauseSfxSlider = document.getElementById('pause-sfx-slider');
        if (pauseSfxSlider) {
            pauseSfxSlider.addEventListener('input', (e) => {
                sounds.setSfxVolume(e.target.value / 100);
                this.homeMenu?.syncAudio();
                sounds.play('switchWeapon', { volume: 0.35 });
            });
        }

        // Nút điều khiển Hiệu Năng & Đồ Họa ở Home Settings
        document.getElementById('setting-perf-mode')?.addEventListener('click', () => {
            this.togglePerformanceMode();
        });
        document.getElementById('setting-toggle-muzzle')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ muzzleFlash: !this.perfSettings.muzzleFlash, mode: 'custom' });
        });
        document.getElementById('setting-toggle-sparks')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ bulletSparks: !this.perfSettings.bulletSparks, mode: 'custom' });
        });
        document.getElementById('setting-toggle-shadows')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ shadows: !this.perfSettings.shadows, mode: 'custom' });
        });

        // Nút điều khiển Hiệu Năng & Đồ Họa ở Pause Menu
        document.getElementById('pause-toggle-perf')?.addEventListener('click', () => {
            this.togglePerformanceMode();
        });
        document.getElementById('pause-toggle-muzzle')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ muzzleFlash: !this.perfSettings.muzzleFlash, mode: 'custom' });
        });
        document.getElementById('pause-toggle-sparks')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ bulletSparks: !this.perfSettings.bulletSparks, mode: 'custom' });
        });
        document.getElementById('pause-toggle-shadows')?.addEventListener('click', () => {
            this.applyPerformanceSettings({ shadows: !this.perfSettings.shadows, mode: 'custom' });
        });

        this.syncPerformanceUI();
        this.syncDeveloperModeUI();
        this.updateCoinsUI();
    }

    togglePerformanceMode() {
        const nextMode = this.perfSettings.mode === 'optimized' ? 'full' : 'optimized';
        if (nextMode === 'optimized') {
            this.applyPerformanceSettings({
                mode: 'optimized',
                muzzleFlash: false,
                bulletSparks: false,
                shadows: false
            });
        } else {
            this.applyPerformanceSettings({
                mode: 'full',
                muzzleFlash: true,
                bulletSparks: true,
                shadows: true
            });
        }
    }

    applyPerformanceSettings(settings) {
        this.perfSettings = { ...this.perfSettings, ...settings };
        try {
            localStorage.setItem('arena_perf_settings', JSON.stringify(this.perfSettings));
        } catch { }

        this.renderQuality?.configure(window.devicePixelRatio, window.innerWidth, window.innerHeight, this.perfSettings.mode);
        if (this.renderer && this.renderQuality) this.renderer.setPixelRatio(this.renderQuality.ratio);
        this.arena?.setQuality(this.perfSettings);

        if (this.particles) {
            this.particles.setQuality(this.perfSettings);
        }
        if (this.renderer) {
            this.renderer.shadowMap.enabled = !!this.perfSettings.shadows;
        }
        if (this.arena?.sunLight) {
            this.arena.sunLight.castShadow = !!this.perfSettings.shadows;
        }
        this.syncPerformanceUI();
    }

    syncPerformanceUI() {
        const p = this.perfSettings;
        const isOpt = p.mode === 'optimized';

        // Giao diện Sảnh chính
        const badge = document.getElementById('perf-mode-badge');
        if (badge) badge.textContent = isOpt ? 'TỐI ƯU FPS' : (p.mode === 'full' ? 'MAX HIỆU ỨNG' : 'TÙY BIẾN');

        const btnPerfMode = document.getElementById('setting-perf-mode');
        if (btnPerfMode) {
            btnPerfMode.textContent = `CHẾ ĐỘ: ${isOpt ? 'TỐI ƯU MƯỢT MÀ' : (p.mode === 'full' ? 'ĐẦY ĐỦ ĐỒ HỌA' : 'TÙY BIẾN')}`;
            btnPerfMode.className = `toy-button ${isOpt ? 'yellow' : 'blue'} wide-button`;
        }

        const btnMuzzle = document.getElementById('setting-toggle-muzzle');
        if (btnMuzzle) {
            btnMuzzle.textContent = `LỬA NÒNG: ${p.muzzleFlash ? 'BẬT' : 'TẮT'}`;
            btnMuzzle.style.opacity = p.muzzleFlash ? '1' : '0.65';
        }

        const btnSparks = document.getElementById('setting-toggle-sparks');
        if (btnSparks) {
            btnSparks.textContent = `TIA LỬA ĐẠN: ${p.bulletSparks ? 'BẬT' : 'TẮT'}`;
            btnSparks.style.opacity = p.bulletSparks ? '1' : '0.65';
        }

        const btnShadows = document.getElementById('setting-toggle-shadows');
        if (btnShadows) {
            btnShadows.textContent = `ĐỔ BÓNG THỜI GIAN THỰC: ${p.shadows ? 'BẬT' : 'TẮT'}`;
            btnShadows.style.opacity = p.shadows ? '1' : '0.65';
        }

        // Giao diện Menu Tạm Dừng (Pause Menu)
        const pausePerf = document.getElementById('pause-toggle-perf');
        if (pausePerf) {
            pausePerf.textContent = `CHẾ ĐỘ MƯỢT MÀ (TỐI ƯU FPS): ${isOpt ? 'BẬT' : 'TẮT'}`;
            pausePerf.style.background = isOpt ? 'rgba(14, 165, 233, 0.25)' : 'rgba(30, 41, 59, 0.7)';
            pausePerf.style.borderColor = isOpt ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)';
            pausePerf.style.color = isOpt ? '#38bdf8' : '#e2e8f0';
        }

        const pauseMuzzle = document.getElementById('pause-toggle-muzzle');
        if (pauseMuzzle) {
            pauseMuzzle.textContent = `LỬA NÒNG: ${p.muzzleFlash ? 'BẬT' : 'TẮT'}`;
            pauseMuzzle.style.background = p.muzzleFlash ? 'rgba(14, 165, 233, 0.2)' : 'rgba(15, 23, 42, 0.7)';
            pauseMuzzle.style.borderColor = p.muzzleFlash ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.08)';
            pauseMuzzle.style.color = p.muzzleFlash ? '#38bdf8' : '#64748b';
        }

        const pauseSparks = document.getElementById('pause-toggle-sparks');
        if (pauseSparks) {
            pauseSparks.textContent = `TIA LỬA: ${p.bulletSparks ? 'BẬT' : 'TẮT'}`;
            pauseSparks.style.background = p.bulletSparks ? 'rgba(14, 165, 233, 0.2)' : 'rgba(15, 23, 42, 0.7)';
            pauseSparks.style.borderColor = p.bulletSparks ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.08)';
            pauseSparks.style.color = p.bulletSparks ? '#38bdf8' : '#64748b';
        }

        const pauseShadows = document.getElementById('pause-toggle-shadows');
        if (pauseShadows) {
            pauseShadows.textContent = `ĐỔ BÓNG: ${p.shadows ? 'BẬT' : 'TẮT'}`;
            pauseShadows.style.background = p.shadows ? 'rgba(14, 165, 233, 0.2)' : 'rgba(15, 23, 42, 0.7)';
            pauseShadows.style.borderColor = p.shadows ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.08)';
            pauseShadows.style.color = p.shadows ? '#38bdf8' : '#64748b';
        }
    }

    switchArena(targetMode) {
        const isTDM = targetMode === 'TDM';
        const targetArena = isTDM ? this.spaceArena : this.survivalArena;
        if (this.arena === targetArena && this.arena.colliders.length > 0) {
            return;
        }

        // Dọn dẹp bản đồ đang dựng trên scene
        if (this.arena) {
            this.arena.clearScene();
        }

        this.arena = targetArena;
        this.arena.buildArena();
        this.arena.setQuality(this.perfSettings);
        if (this.arena?.sunLight) {
            this.arena.sunLight.castShadow = !!this.perfSettings.shadows;
        }

        // Cập nhật tham chiếu bản đồ mới vào các subsystem
        if (this.player) this.player.arena = this.arena;
        if (this.waveManager) this.waveManager.arena = this.arena;
        if (this.tdmManager) this.tdmManager.arena = this.arena;
    }

    async loadAssetsAndStart() {
        const loadingProgress = document.getElementById('loading-bar-fill');
        const loadingText = document.getElementById('loading-status-text');

        const updateLoading = (pct, text) => {
            if (loadingProgress) loadingProgress.style.width = `${pct}%`;
            if (loadingText) loadingText.textContent = text;
        };

        updateLoading(15, 'Loading Arena Modules & Portals...');
        await Promise.all([
            this.survivalArena.loadModels(),
            this.spaceArena.loadModels()
        ]);

        updateLoading(40, 'Building Arena & Portals...');
        this.switchArena(this.selectedGameMode || 'SURVIVAL');

        updateLoading(65, 'Loading Weapon Systems...');
        await this.weapons.init();

        updateLoading(80, 'Loading Cyber Soldier...');
        await this.player.loadModel(this.gltfLoader, this.scene);

        updateLoading(95, 'Loading Kenney Zombies & Mutants...');
        await this.waveManager.init();

        updateLoading(100, 'System Initialized');
        setTimeout(() => {
            if (this.screenLoading) this.screenLoading.style.display = 'none';
            if (this.screenMenu) this.screenMenu.style.display = 'flex';
            this.state = 'MENU';
            
            const urlParams = new URLSearchParams(window.location.search);
            const roomCode = urlParams.get('room');
            if (roomCode && this.roomCode) {
                this.roomCode.value = roomCode;
                this.joinRoom();
            }
        }, 300);

        // Start animation loop
        this.animate();
    }

    startGame(fromRoom = false) {
        this.firstPersonView?.setEnabled(false);
        if (this.network.active && !fromRoom) {
            if (this.network.host) this.network.start();
            return;
        }
        this.gameMode = 'SURVIVAL';
        this.switchArena('SURVIVAL');
        this.homeMenu?.showroom.dialog.close();
        this.homeMenu?.dialog.close();
        sounds.init();
        sounds.startMusic();

        this.state = 'PLAYING';
        this.pauseMenuOpen = false;
        this.networkEvents = [];
        this.hitEventSeq = 0;
        this.lastHitEventId = 0;
        if (this.screenMenu) this.screenMenu.style.display = 'none';
        if (this.screenPause) this.screenPause.style.display = 'none';
        if (this.screenGameOver) this.screenGameOver.style.display = 'none';
        if (this.hud) this.hud.style.display = 'block';

        this.score = 0;
        this.currentWave = 1;
        this.nextWaveTimer = 0;
        const currentLoadout = this.getLoadout();
        this.weapons.resetRun(currentLoadout.primary, currentLoadout.secondary, currentLoadout.bomb1, currentLoadout.bomb2);
        for (const remote of this.remotePlayers.values()) {
            remote.clearSharedSkills?.();
            remote.applyCharacterStats?.();
            remote.weapons.resetRun(remote.loadout?.primary, remote.loadout?.secondary, remote.loadout?.bomb1, remote.loadout?.bomb2); remote.health = remote.maxHealth; remote.shield = remote.maxShield;
            remote.isDead = false; remote.isDowned = false; remote.commandQueue = [];
            remote.bleedOutTimer = 30; remote.reviveProgress = 0; remote.isBeingRevived = false; remote.invulnerability = 0;
            remote.lootInventory = null;
            remote.lastCommandId = 0; remote.processedSeq = 0;
            remote.netTarget = null; remote.netVelocity.set(0, 0, 0);
            remote.position.set(0, 0, 8);
        }
        this.player.reset();
        if (this.developerMode) {
            this.player.developerMode = true;
            this.player.health = this.player.maxHealth;
            this.player.shield = this.player.maxShield;
        }
        this.pickups.clear();
        this.particles.clear();
        this.waveManager.clear();
        for (const projectile of this.remoteProjectiles.values()) {
            projectile.mesh.removeFromParent(); projectile.mesh.material.dispose();
        }
        this.remoteProjectiles.clear();
        if (!this.network.active || this.network.host) {
            this.lootingSystem.spawnInitialContainers(this.arena);
        } else {
            this.lootingSystem.clearAll();
        }

        this.player.setInputEnabled(true);
        this.player.cooperative = this.network.active;
        document.getElementById('hud-pause').disabled = false;
        if (!this.network.active || this.network.host) this.waveManager.startWave(this.currentWave);
        else this.waveManager.clear();
        this.ui.showBanner('SỐNG SÓT · NHẶT ĐẠN · NÂNG CẤP');
    }

    startTDM(playerTeam = 'blue', options = {}) {
        this.firstPersonView?.setEnabled(options.firstPerson ?? (this.selectedGameMode === 'FPS_SOLO'));
        const fillBots = typeof options === 'boolean' ? options : !!options.fillBots;
        this.gameMode = 'TDM';
        this.selectedTDMTeam = playerTeam;
        this.switchArena('TDM');
        this.homeMenu?.showroom.dialog.close();
        this.homeMenu?.dialog.close();
        sounds.init();
        sounds.startMusic();

        this.state = 'PLAYING';
        this.pauseMenuOpen = false;
        this.networkEvents = [];
        this.hitEventSeq = 0;
        this.lastHitEventId = 0;
        if (this.screenMenu) this.screenMenu.style.display = 'none';
        if (this.screenPause) this.screenPause.style.display = 'none';
        if (this.screenGameOver) this.screenGameOver.style.display = 'none';
        if (this.hud) this.hud.style.display = 'block';

        this.score = 0;
        this.currentWave = 1;
        this.nextWaveTimer = 0;

        const currentLoadout = this.getLoadout();
        this.weapons.resetRun(currentLoadout.primary, currentLoadout.secondary, currentLoadout.bomb1, currentLoadout.bomb2);

        // Reset các remote players nếu có trong trận đấu Co-op
        for (const remote of this.remotePlayers.values()) {
            remote.health = remote.maxHealth;
            remote.shield = remote.maxShield;
            remote.isDead = false;
            remote.isDowned = false;
            remote.invulnerability = 2.0;
            if (remote.weapons) {
                const weaponId = remote.loadout?.primary || remote.weapons.startingWeaponId || 'repeater';
                remote.weapons.resetRun(weaponId);
            }
        }

        this.player.reset();
        this.player.team = playerTeam;
        if (this.developerMode) {
            this.player.developerMode = true;
            this.player.health = this.player.maxHealth;
            this.player.shield = this.player.maxShield;
        }
        this.pickups.clear();
        this.particles.clear();
        this.waveManager.clear();
        this.lootingSystem?.clearAll?.();

        this.player.setInputEnabled(true);
        this.player.cooperative = this.network.active;
        document.getElementById('hud-pause').disabled = false;

        // Bắt đầu trận đấu đối kháng TDM với cờ fillBots được chỉ định
        this.tdmManager?.startMatch(playerTeam, { fillBots, teamSize: 4 });
        if (this.firstPersonView?.active) {
            this.firstPersonView.updateCamera();
            this.firstPersonView.requestLock();
            this.ui.showBanner('FPS · WASD DI CHUYỂN · CHUỘT NGẮM · R NẠP ĐẠN');
        }
    }

    pauseGame() {
        if (this.state !== 'PLAYING') return;
        this.pauseMenuOpen = true;
        this.lootingSystem?.closeContainerUI();
        if (!this.network.active) this.state = 'PAUSED';
        this.player.setInputEnabled(false);
        this.ui.clearTeammateIndicators();
        this.homeMenu?.syncAudio();
        this.syncPerformanceUI?.();
        const pWave = (typeof document !== 'undefined') ? document.getElementById('pause-wave-badge') : null;
        if (pWave) pWave.textContent = this.gameMode === 'TDM' ? 'ĐỐI KHÁNG TDM' : `ĐỢT ${this.currentWave || 1}`;
        if (this.screenPause) this.screenPause.style.display = 'flex';
    }

    resumeGame() {
        this.pauseMenuOpen = false;
        this.state = 'PLAYING';
        if (this.screenPause) this.screenPause.style.display = 'none';
        this.player.setInputEnabled(true);
    }

    restartGame() {
        if (this.network.active) {
            if (this.network.host) this.network.start();
            return;
        }
        if (this.gameMode === 'TDM') {
            this.startTDM(this.selectedTDMTeam || 'blue', { fillBots: this.tdmManager?.lastFillBots ?? !!this.soloFillBots });
        } else {
            this.startGame();
        }
    }

    returnToMenu() {
        this.firstPersonView?.setEnabled(false);
        this.pauseMenuOpen = false;
        this.lootingSystem.closeContainerUI();
        this.player.setInputEnabled(false);
        this.state = 'MENU';
        if (this.network.active) this.network.leave();
        for (const id of [...this.remotePlayers.keys()]) this.removeCoopPlayer(id);
        this.practiceBot = null;
        this.waveManager.clear();
        this.weapons.clear();
        this.pickups.clear();
        this.particles.clear();
        this.ui.clearTeammateIndicators();
        if (this.tdmManager) {
            this.tdmManager.cleanup();
        }
        if (this.visionCone) {
            this.visionCone.clear();
        }
        this.gameMode = this.selectedGameMode || 'SURVIVAL';
        this.switchArena(this.gameMode);
        this.screenPause.style.display = 'none';
        this.screenGameOver.style.display = 'none';
        this.hud.style.display = 'none';
        this.screenMenu.style.display = 'flex';
        this.homeMenu.preview();
        this.btnStart?.focus();
    }

    gameOver() {
        if (this.gameMode === 'TDM') return false;
        // A player's death never ends a cooperative match while somebody can still play.
        if (this.network.active && (!this.coopPlayers.length || this.coopPlayers.some(p => !p.isDead && !p.isDowned))) return false;
        this.pauseMenuOpen = false;
        if (this.screenPause) this.screenPause.style.display = 'none';
        this.state = 'GAMEOVER';
        this.player.setInputEnabled(false);
        this.lootingSystem?.closeContainerUI();
        this.ui.clearTeammateIndicators();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_arena_highscore', this.highScore.toString());
            this.saveProgress(true);
        }

        if (this.finalScoreEl) this.finalScoreEl.textContent = this.score.toLocaleString();
        if (this.finalWaveEl) this.finalWaveEl.textContent = this.currentWave.toString();
        if (this.highScoreOverEl) this.highScoreOverEl.textContent = this.highScore.toLocaleString();

        setTimeout(() => {
            if (this.state !== 'GAMEOVER') return;
            if (this.hud) this.hud.style.display = 'none';
            if (this.screenGameOver) this.screenGameOver.style.display = 'flex';
        }, 1200);
    }

    onHitEnemy(damage, isCrit, hitPoint, hitResult = null, shooterId = this.network.playerId) {
        if (!this.network.active || shooterId === this.network.playerId) this.ui.triggerHitmarker(isCrit);
        this.ui.showDamageNumber(damage, isCrit, hitPoint, this.camera, hitResult);
        if (this.network.active && this.network.host && hitPoint) {
            (this.networkEvents ||= []).push({
                type: 'hit', id: this.hitEventSeq = (this.hitEventSeq || 0) + 1,
                shooterId, damage, crit: !!isCrit, position: hitPoint.toArray(),
                result: hitResult ? { ...hitResult } : null
            });
        }
    }

    onEnemyKilled(enemy) {
        this.score += enemy.scoreValue;
        const goldByEnemy = { walker: 10, sprinter: 18, boomer: 25, giant: 45, boss: 350 };
        this.addCoins(goldByEnemy[enemy.type] || 15);
        this.pickups.spawnDrop(enemy.position, enemy.type);
        this.lootingSystem?.handleEnemyKilled(enemy);

        if (enemy.type === 'boss') {
            this.ui.showBanner('MUTANT OVERLORD DESTROYED!');
        } else if (enemy.type === 'boomer') {
            // Boomer Explosion
            this.particles.createExplosion(enemy.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x55aa33, 40, explosionRadius);
            sounds.play('enemyDestroy', { volume: 1.0 });
            
            const explosionRadius = 4.5;
            const explosionDamage = 45;
            for (const player of this.coopPlayers) {
                if (player.isDead) continue;
                const dist = player.position.distanceTo(enemy.position);
                if (dist <= explosionRadius) {
                    const hitDir = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
                    // Damage scales by distance
                    const dmg = Math.round(explosionDamage * (1 - dist / explosionRadius));
                    player.takeDamage(dmg, hitDir);
                    if (player.applyKickbackAndShake) {
                        player.applyKickbackAndShake(new THREE.Vector2(0, 0), 0.5);
                    }
                }
            }
        }
    }

    async createRoom() {
        try { const data = await this.network.create(this.roomName?.value || 'Chủ phòng', this.characterId); this.showRoomState(data); }
        catch (error) { this.showRoomError(error.message); }
    }

    async joinRoom() {
        try { const data = await this.network.join(this.roomCode?.value || '', this.roomName?.value || 'Đồng đội', this.characterId); this.showRoomState(data); }
        catch (error) { this.showRoomError(error.message); }
    }

    selectCharacter(characterId) {
        this.characterId = normalizeCharacter(characterId);
        localStorage.setItem('cyber_arena_character', this.characterId);
        this.updateCharacterSelection();
        this.player.setCharacter(this.characterId);
        this.homeMenu?.preview();
        if (this.network?.active) {
            this.network.changeCharacter?.(this.characterId);
        }
        this.saveProgress(true);
    }

    updateCharacterSelection() {
        this.characterOptions?.forEach(option => {
            const selected = option.dataset.character === this.characterId;
            option.classList.toggle('selected', selected);
            option.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }

    getLoadout() {
        try {
            const raw = localStorage.getItem('cyber_arena_loadout');
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    primary: parsed.primary || 'blaster_c',
                    secondary: parsed.secondary || 'blaster',
                    bomb1: parsed.bomb1 || 'grenade_a',
                    bomb2: parsed.bomb2 || 'grenade_b'
                };
            }
        } catch {}
        return {
            primary: localStorage.getItem('cyber_arena_weapon') || 'blaster_c',
            secondary: 'blaster',
            bomb1: 'grenade_a',
            bomb2: 'grenade_b'
        };
    }

    selectWeapon(id) {
        if (this.state !== 'MENU') return false;
        const weapon = getStartingWeapon(id);
        if (!this.weapons.models[weapon.modelFile]) return false;
        const currentLoadout = this.getLoadout();
        currentLoadout.primary = weapon.id;
        try {
            localStorage.setItem('cyber_arena_loadout', JSON.stringify(currentLoadout));
        } catch {}
        localStorage.setItem('cyber_arena_weapon', weapon.id);
        this.weapons.resetRun(currentLoadout.primary, currentLoadout.secondary, currentLoadout.bomb1, currentLoadout.bomb2);
        this.network.changeWeapon(weapon.id);
        this.saveProgress(true);
        return true;
    }

    showRoomError(message) { if (this.roomStatus) this.roomStatus.textContent = message; }

    copyRoomCode() {
        if (this.roomCode && this.roomCode.value) {
            navigator.clipboard.writeText(this.roomCode.value).then(() => {
                if (this.roomCopy) {
                    const oldText = this.roomCopy.textContent;
                    this.roomCopy.textContent = 'ĐÃ COPY';
                    setTimeout(() => { this.roomCopy.textContent = oldText; }, 2000);
                }
            }).catch(() => {
                this.showRoomError('Không thể copy mã phòng.');
            });
        }
    }

    showRoomState(data) {
        if (!data) return;
        this.roomLobby?.update(data);
        this.homeMenu?.room(data);
        this.screenMenu?.classList.add('party-menu');
        if (!this.roomStatus) return;
        const isHost = data.host === data.you || data.isHost;
        const names = (data.players || []).map(player => player.name).join(', ');
        this.roomStatus.textContent = `PHÒNG ${data.code}: ${names}${isHost ? ' • Đóng cửa sổ này và bấm BẮT ĐẦU khi cả đội đã sẵn sàng.' : ' • Đang chờ chủ phòng bắt đầu.'}`;
        if (this.roomCode) this.roomCode.value = data.code;
        if (this.roomCopy) this.roomCopy.style.display = 'inline-block';
        if (this.roomStart) this.roomStart.style.display = isHost ? 'inline-block' : 'none';
        if (this.roomStart) this.roomStart.disabled = (data.players || []).length < 1 || data.started;
        if (this.roomLeave) this.roomLeave.style.display = 'inline-block';
        this.characterOptions?.forEach(option => { option.disabled = !!data.started; });
        if (this.roomCreate) this.roomCreate.disabled = true;
        if (this.roomJoin) this.roomJoin.disabled = true;
        if (this.btnStart) this.btnStart.style.display = 'none';
        if (this.btnStartParty) this.btnStartParty.style.display = 'none';
        
        if (data.code) {
            const newUrl = window.location.pathname + '?room=' + data.code;
            window.history.replaceState(null, '', newUrl);
        }
    }

    resetRoomUI() {
        this.screenMenu?.classList.remove('party-menu');
        if (this.roomLobby?.container) this.roomLobby.container.hidden = true;
        if (this.roomStatus) this.roomStatus.textContent = 'Tạo phòng và gửi liên kết để rủ bạn cùng chiến đấu. Tối đa 4 người.';
        if (this.roomCode) this.roomCode.value = '';
        if (this.roomCopy) this.roomCopy.style.display = 'none';
        if (this.roomStart) this.roomStart.style.display = 'none';
        if (this.roomLeave) this.roomLeave.style.display = 'none';
        if (this.roomCreate) this.roomCreate.disabled = false;
        if (this.roomJoin) this.roomJoin.disabled = false;
        if (this.btnStart) this.btnStart.style.display = '';
        if (this.btnStartParty) this.btnStartParty.style.display = '';
        this.characterOptions?.forEach(option => { option.disabled = false; });
        
        window.history.replaceState(null, '', window.location.pathname);
        this.homeMenu?.room(null);
    }

    ensureCoopPlayer(id, name, character = 'police') {
        if (id === this.network.playerId) return this.player;
        if (this.remotePlayers.has(id)) {
            const remote = this.remotePlayers.get(id);
            remote.name = name || remote.name;
            remote.setCharacter?.(character);
            return remote;
        }
        const remote = makeRemotePlayer(this.scene, this.gltfLoader, id, name, character);
        remote.scene = this.scene; remote.particles = this.particles;
        for (const key of Object.getOwnPropertyNames(PlayerController.prototype)) {
            if (/^(trigger|tryActiveSkill|createSkillVisualEffect|createLightningEntity|showStrikeBeam|showOrbitalStrikeVisual|showGroundSmashVisual|removeSkillEntity|clearSharedSkills|getSharedSkillState|applySharedSkillState|updateActiveSkills|applyCharacterStats|applyExplosionShock|applyScreenShake)$/.test(key) || key.startsWith('trigger')) remote[key] = PlayerController.prototype[key];
        }
        remote.clearSharedSkills(); remote.applyCharacterStats();
        remote.weapons = new WeaponSystem(this.scene, this.gltfLoader, this.particles);
        remote.weapons.models = this.weapons.models;
        // Dùng chung mảng activeZones và thrownBombs để đồng bộ toàn bộ vùng khói/lửa giữa tất cả người chơi
        remote.weapons.activeZones = this.weapons.activeZones;
        remote.weapons.thrownBombs = this.weapons.thrownBombs;
        remote.weapons.isRemoteClone = true;
        remote.weapons.resetRun();
        // The character GLTF can finish loading before the WeaponSystem is
        // attached to the remote object. Re-attach here so remote players do
        // not appear empty-handed after the race.
        if (remote.handNode) remote.weapons.attachToArm(remote.handNode);
        this.remotePlayers.set(id, remote);
        this.coopPlayers.push(remote);
        return remote;
    }

    getCoopPlayer(id) { return id === this.network.playerId ? this.player : this.remotePlayers.get(id); }

    removeCoopPlayer(id) {
        const remote = this.remotePlayers.get(id);
        if (!remote) return;
        remote.clearSharedSkills?.();
        remote.dispose();
        this.remotePlayers.delete(id);
        this.coopPlayers = this.coopPlayers.filter(player => player !== remote);
    }

    reviveTeammate(teammate, reviver = this.player) {
        if (this.network.active && !this.network.host) return false;
        if (!reviver || reviver === teammate || reviver.isDead || reviver.isDowned || !teammate || teammate.position.distanceTo(reviver.position) > 3.0) return false;
        if (!teammate?.isDowned && !teammate?.isDead) return false;
        const revived = teammate.revive();
        if (revived) {
            this.particles.createExplosion(teammate.position, 0x10b981, 16, 2.5);
            sounds.play('powerup', { volume: 1.0 });
            this.ui?.showPickupAlert(`ĐÃ CỨU SỐNG THÀNH CÔNG ${teammate.name || 'ĐỒNG ĐỘI'}!`);
            this.ui?.hideSearchProgress?.();
            this._activeReviveTarget = null;
            const pId = teammate.id || 'player';
            const zone = this.reviveZoneMeshes.get(pId);
            if (zone) {
                this.scene.remove(zone.group);
                this.reviveZoneMeshes.delete(pId);
            }
        }
        return revived;
    }

    reviveNearest(reviver) {
        // Đã chuyển đổi sang cơ chế đứng trong vòng cứu 3.0m tích lũy 5 giây; không còn hồi sinh tức thì qua phím E
        return false;
    }

    // Quản lý các vòng cứu người 3D (Revive Zones): tự động tích lũy tiến trình cứu trong 5 giây khi đứng trong vòng 3.0m
    updateReviveZones(delta) {
        const activeDownedIds = new Set();
        const time = performance.now() * 0.003;
        let localIsRevivingAny = false;

        for (const player of this.coopPlayers) {
            if (!player) continue;
            const pId = player.id || 'player';

            const needsRevive = player.isDowned || (this.network.active && player.isDead);
            if (needsRevive) {
                activeDownedIds.add(pId);
                let zone = this.reviveZoneMeshes.get(pId);
                if (!zone) {
                    const group = new THREE.Group();

                    // Vòng tròn hào quang cứu hộ ngoài (bán kính 3.0m tương tự hòm đồ)
                    const ringGeo = new THREE.RingGeometry(2.88, 3.04, 48);
                    ringGeo.rotateX(-Math.PI / 2);
                    const ringMat = new THREE.MeshBasicMaterial({
                        color: 0x10b981,
                        transparent: true,
                        opacity: 0.85,
                        side: THREE.DoubleSide
                    });
                    const ringMesh = new THREE.Mesh(ringGeo, ringMat);

                    // Đĩa năng lượng mờ bên trong bán kính 2.88m
                    const discGeo = new THREE.CircleGeometry(2.88, 36);
                    discGeo.rotateX(-Math.PI / 2);
                    const discMat = new THREE.MeshBasicMaterial({
                        color: 0x10b981,
                        transparent: true,
                        opacity: 0.12,
                        side: THREE.DoubleSide
                    });
                    const discMesh = new THREE.Mesh(discGeo, discMat);

                    // Vòng tiến trình cứu (Progress Ring) xoay mở rộng
                    const progGeo = new THREE.RingGeometry(2.65, 2.84, 40);
                    progGeo.rotateX(-Math.PI / 2);
                    const progMat = new THREE.MeshBasicMaterial({
                        color: 0x34d399,
                        transparent: true,
                        opacity: 0.95,
                        side: THREE.DoubleSide
                    });
                    const progMesh = new THREE.Mesh(progGeo, progMat);

                    group.add(ringMesh, discMesh, progMesh);
                    this.scene.add(group);

                    zone = { group, ring: ringMesh, disc: discMat, prog: progMesh };
                    this.reviveZoneMeshes.set(pId, zone);
                }

                // Cập nhật vị trí vòng cứu đi theo người chơi đang bò
                zone.group.position.set(player.position.x, 0.05, player.position.z);

                // Hiệu ứng nhịp đập của vòng cứu
                const pulse = Math.sin(time * 4) * 0.04;
                zone.ring.scale.set(1 + pulse, 1, 1 + pulse);
                zone.disc.opacity = 0.10 + Math.sin(time * 5) * 0.05;

                // Cập nhật tiến trình hiển thị trên vòng 3D
                const progRatio = Math.max(0.01, player.reviveProgress || 0);
                zone.prog.scale.set(progRatio, 1, progRatio);
                zone.prog.visible = progRatio > 0.02;

                // Kiểm tra xem có đồng đội nào đang đứng trong vòng cứu (<= 3.0m)
                if (this.network.active && !this.network.host) continue;
                const reviver = this.coopPlayers.find(other => {
                    if (!other || other === player || other.isDowned || other.isDead) return false;
                    return other.position.distanceTo(player.position) <= 3.0;
                });

                if (reviver) {
                    player.isBeingRevived = true;
                    // Chuẩn hóa thời gian cứu: 5.0 giây (có tính hệ số reviveSpeedMult của nhân vật nếu có)
                    const baseReviveTime = 5.0;
                    const speedMult = reviver.reviveSpeedMult || 1.0;
                    const requiredTime = baseReviveTime / speedMult;
                    player.reviveProgress = Math.min(1.0, (player.reviveProgress || 0) + delta / requiredTime);

                    // Nếu người cứu là người chơi chính: cập nhật thanh tiến trình giao diện (Progress Bar UI)
                    if (reviver === this.player) {
                        localIsRevivingAny = true;
                        this._activeReviveTarget = player;
                        const remaining = Math.max(0, (1.0 - player.reviveProgress) * requiredTime);
                        this.ui?.showSearchProgress?.(requiredTime, `CỨU ${player.name || 'ĐỒNG ĐỘI'}`);
                        this.ui?.updateSearchProgress?.(player.reviveProgress, remaining);
                    }

                    // Hiệu ứng hạt ánh sáng xanh bốc lên khi đang được cứu
                    if (Math.random() < 0.25) {
                        this.particles.createImpactSparks(
                            player.position.clone().add(new THREE.Vector3(0, 0.3, 0)),
                            new THREE.Vector3(0, 1, 0),
                            0x10b981,
                            3
                        );
                    }

                    // Hoàn tất đủ 5 giây tiến trình
                    if (player.reviveProgress >= 1.0) {
                        if (reviver === this.player) {
                            this.ui?.hideSearchProgress?.();
                            this._activeReviveTarget = null;
                        }
                        this.reviveTeammate(player, reviver);
                    }
                } else {
                    player.isBeingRevived = false;
                    // Rời khỏi vòng: tiến trình tụt dần
                    player.reviveProgress = Math.max(0, (player.reviveProgress || 0) - delta * 0.40);
                }
            }
        }

        // Nếu người chơi chính vừa bước ra khỏi vòng cứu: ẩn thanh tiến trình
        if (!localIsRevivingAny && this._activeReviveTarget) {
            this.ui?.hideSearchProgress?.();
            this._activeReviveTarget = null;
        }

        // Dọn dẹp các vòng cứu đã hoàn tất hoặc không còn người gục
        for (const [id, zone] of this.reviveZoneMeshes) {
            if (!activeDownedIds.has(id)) {
                this.scene.remove(zone.group);
                this.reviveZoneMeshes.delete(id);
            }
        }
    }

    // Bật hoặc tắt đồng đội bot phục vụ thử nghiệm và chơi đơn
    togglePracticeBot() {
        if (this.network.active) return;
        if (this.practiceBot) {
            this.removeCoopPlayer(this.practiceBot.id);
            this.practiceBot = null;
            this.ui.showPickupAlert('ĐÃ HỦY ĐỒNG ĐỘI AI');
            if (this.btnToggleBot) this.btnToggleBot.textContent = 'ĐỒNG ĐỘI BOT: BẬT (PHÍM B)';
            return;
        }

        const botId = 'bot_practice';
        const bot = this.ensureCoopPlayer(botId, 'Chiến binh AI', 'police');
        bot.isBot = true;
        bot.botShootCooldown = 0;
        // Đặt vị trí ban đầu ngoài tầm nhìn màn hình (15m) để quan sát định vị rìa màn hình
        bot.position.copy(this.player.position).add(new THREE.Vector3(15, 0, 15));
        this.practiceBot = bot;
        this.ui.showPickupAlert('ĐÃ GỌI ĐỒNG ĐỘI AI (PHÍM B ĐỂ BẬT/TẮT)');
        if (this.btnToggleBot) this.btnToggleBot.textContent = 'ĐỒNG ĐỘI BOT: TẮT (PHÍM B)';
    }

    // Cập nhật hành vi cho đồng đội bot (di chuyển, ngắm bắn quái, cứu người chơi)
    updatePracticeBot(delta) {
        const bot = this.practiceBot;
        if (!bot || bot.isDead) return;

        if (bot.isDowned) {
            bot.moving = false;
            return;
        }

        // Nếu người chơi chính bị gục -> Bot ưu tiên số 1 chạy đến vòng cứu
        if (this.player.isDowned) {
            const toPlayer = this.player.position.clone().sub(bot.position);
            toPlayer.y = 0;
            const distToPlayer = toPlayer.length();

            if (distToPlayer > 1.8) {
                // Di chuyển nhanh vào trong vòng cứu
                toPlayer.normalize();
                bot.position.addScaledVector(toPlayer, 6.5 * delta);
                bot.aimYaw = Math.atan2(toPlayer.x, toPlayer.z);
                bot.moving = true;
            } else {
                // Đã đứng trong vòng cứu 2.5m, đứng lại canh gác và bắn quái
                bot.moving = false;
            }

            // Bắn yểm trợ quái xung quanh khi đang cứu
            bot.botShootCooldown = Math.max(0, (bot.botShootCooldown || 0) - delta);
            let nearestEnemy = null;
            let minDist = 14;
            for (const enemy of this.waveManager.enemies) {
                if (enemy.isDead) continue;
                const d = enemy.position.distanceTo(bot.position);
                if (d < minDist) {
                    minDist = d;
                    nearestEnemy = enemy;
                }
            }
            if (nearestEnemy) {
                const toEnemy = nearestEnemy.position.clone().sub(bot.position);
                bot.aimYaw = Math.atan2(toEnemy.x, toEnemy.z);
                if (bot.botShootCooldown <= 0) {
                    bot.botShootCooldown = 0.8;
                    const shootOrigin = bot.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                    const shootTarget = nearestEnemy.position.clone().add(new THREE.Vector3(0, 0.8, 0));
                    bot.weapons.shoot(shootOrigin, shootTarget, false, true);
                }
            }
            return;
        }

        bot.botShootCooldown = Math.max(0, (bot.botShootCooldown || 0) - delta);

        // Vector và khoảng cách tới người chơi
        const toPlayer = this.player.position.clone().sub(bot.position);
        toPlayer.y = 0;
        const distToPlayer = toPlayer.length();

        // Di chuyển theo người chơi nếu khoảng cách quá xa (> 26m)
        if (distToPlayer > 26) {
            toPlayer.normalize();
            bot.position.addScaledVector(toPlayer, 5.2 * delta);
            bot.aimYaw = Math.atan2(toPlayer.x, toPlayer.z);
            bot.moving = true;
        } else {
            bot.moving = false;
        }

        // Tìm kiếm quái gần nhất để bắn hỗ trợ
        let nearestEnemy = null;
        let minDist = 15;
        for (const enemy of this.waveManager.enemies) {
            if (enemy.isDead) continue;
            const d = enemy.position.distanceTo(bot.position);
            if (d < minDist) {
                minDist = d;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            const toEnemy = nearestEnemy.position.clone().sub(bot.position);
            bot.aimYaw = Math.atan2(toEnemy.x, toEnemy.z);
            if (bot.botShootCooldown <= 0) {
                bot.botShootCooldown = 0.85;
                const shootOrigin = bot.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                const shootTarget = nearestEnemy.position.clone().add(new THREE.Vector3(0, 0.8, 0));
                bot.weapons.shoot(shootOrigin, shootTarget, false, true);
            }
        }
    }

    // Bật hoặc tắt Chế độ Admin Developer (Bất tử + Full súng + Vàng vô tận)
    toggleDeveloperMode() {
        this.developerMode = !this.developerMode;
        window.developerMode = this.developerMode;
        try {
            localStorage.setItem('arena_developer_mode', this.developerMode ? 'true' : 'false');
        } catch (e) {
            console.warn('Không thể ghi localStorage:', e);
        }
        if (this.player) {
            this.player.developerMode = this.developerMode;
            if (this.developerMode) {
                this.player.health = this.player.maxHealth;
                this.player.shield = this.player.maxShield;
                this.player.isDead = false;
                this.player.isDowned = false;
            }
        }
        if (this.developerMode) {
            this.coins = 999999;
            this.unlockedWeapons = WEAPON_CONFIGS.map(w => w.id);
            this.saveProgress();
        }
        this.syncDeveloperModeUI();
        this.updateCoinsUI();
        if (this.homeMenu?.showroom) {
            this.homeMenu.showroom.syncSelection();
        }
        if (this.ui?.showPickupAlert) {
            this.ui.showPickupAlert(this.developerMode ? 'QUYỀN ADMIN: BẬT (BẤT TỬ & FULL SÚNG)' : 'QUYỀN ADMIN: TẮT');
        }
    }

    // Kiểm tra trạng thái súng đã mở khóa
    isWeaponUnlocked(id) {
        if (this.developerMode) return true;
        const w = getStartingWeapon(id);
        if (w && w.price === 0) return true;
        return this.unlockedWeapons.includes(id) || (w?.aliases && w.aliases.some(a => this.unlockedWeapons.includes(a)));
    }

    // Kiem tra trang thai nhan vat da mo khoa
    isCharacterUnlocked(id) {
        if (this.developerMode) return true;
        return isCharacterUnlocked(id);
    }

    // Cộng tiền vàng người chơi kèm theo thưởng nội tại nhân vật (nếu có)
    addCoins(amount) {
        const bonus = (this.player?.goldBonus || 0);
        const finalAmount = Math.round(amount * (1.0 + bonus));
        this.coins = Math.max(0, (this.coins || 0) + finalAmount);
        this.saveProgress();
        this.updateCoinsUI();
    }

    // Mua súng mới từ Cửa hàng
    buyWeapon(id) {
        const weapon = getStartingWeapon(id);
        if (this.isWeaponUnlocked(id)) return true;
        if (this.coins >= weapon.price) {
            this.coins -= weapon.price;
            this.unlockedWeapons.push(id);
            this.saveProgress();
            this.updateCoinsUI();
            if (this.homeMenu?.showroom) {
                this.homeMenu.showroom.syncSelection();
            }
            if (this.ui?.showPickupAlert) {
                this.ui.showPickupAlert(`ĐÃ MỞ KHÓA: ${weapon.name}!`);
            }
            sounds.play('equip', { volume: 0.8 });
            return true;
        } else {
            if (this.ui?.showPickupAlert) {
                this.ui.showPickupAlert('KHÔNG ĐỦ VÀNG!');
            }
            return false;
        }
    }

    // Lưu tiến trình tiền vàng và súng
    saveProgress(immediate = false) {
        try {
            localStorage.setItem('arena_player_coins', this.coins.toString());
            localStorage.setItem('arena_unlocked_weapons', JSON.stringify(this.unlockedWeapons));
            localStorage.setItem('th_weapon_parts', JSON.stringify(this.th_weaponParts || {}));
        } catch (e) {
            console.warn('Lỗi lưu tiến trình:', e);
        }

        // Tự động đồng bộ lên tài khoản Supabase Cloud
        try {
            let unlockedChars = ['police'];
            try {
                unlockedChars = JSON.parse(localStorage.getItem('cyber_arena_unlocked_characters') || '["police"]');
            } catch {}

            saveGameProgressToCloud({
                coins: this.coins,
                unlockedWeapons: this.unlockedWeapons,
                weaponParts: this.th_weaponParts,
                characterId: this.characterId,
                unlockedCharacters: unlockedChars,
                highScore: this.highScore,
                loadout: this.getLoadout()
            }, immediate);
        } catch (e) {
            console.warn('Lỗi gọi đồng bộ cloud:', e);
        }
    }



    // ============================================================
    // NÂNG CẤP TỪNG BỘ PHẬN VŨ KHÍ
    // ============================================================

    /**
     * Nâng cấp một bộ phận cụ thể của súng
     * @param {string} weaponId
     * @param {string} slot - 'optic' | 'barrel' | 'grip' | 'magazine'
     */
    th_upgradePart(weaponId, slot) {
        const meta = TH_PART_META[slot];
        if (!weaponId || !meta) return { success: false };

        if (!this.th_weaponParts[weaponId]) {
            this.th_weaponParts[weaponId] = {};
        }

        const currentTier = this.th_weaponParts[weaponId][slot] || 1;
        if (currentTier >= 5) {
            this.ui?.showPickupAlert?.(`${meta.label} ĐÃ ĐẠT CẤP TỐI ĐA!`);
            return { success: false, max: true };
        }

        const cost = meta.costs[currentTier]; // costs[1] = T1→T2, costs[2] = T2→T3,...
        if (this.coins < cost) {
            this.ui?.showPickupAlert?.(`KHÔNG ĐỦ VÀNG! CẦN ${cost.toLocaleString()} VÀNG`);
            return { success: false, notEnoughGold: true };
        }

        this.coins -= cost;
        const rate = meta.rates[currentTier];
        const success = Math.random() <= rate;

        if (success) {
            this.th_weaponParts[weaponId][slot] = currentTier + 1;
            sounds.play('equip', { volume: 0.9, pitchVariation: 0.1 });
            this.ui?.showPickupAlert?.(`NÂNG CẤP ${meta.label} THÀNH CÔNG → T${currentTier + 1}!`);
        } else {
            sounds.playArmorDeflect?.();
            this.ui?.showPickupAlert?.(`NÂNG CẤP ${meta.label} THẤT BẠI! CẤP ĐỘ KHÔNG ĐỔI.`);
        }

        this.saveProgress();
        this.updateCoinsUI();
        return {
            success,
            slot,
            tier: this.th_weaponParts[weaponId][slot] || currentTier,
            cost
        };
    }



    // Cập nhật giao diện tiền vàng trên sảnh và kho vũ khí
    updateCoinsUI() {
        const coinsStr = (this.coins || 0).toLocaleString();
        const menuCoins = document.getElementById('menu-coins');
        if (menuCoins) {
            menuCoins.textContent = coinsStr;
        }
        const armoryGold = document.getElementById('armory-gold-display');
        if (armoryGold) {
            armoryGold.innerHTML = `VÀNG: <b>${coinsStr}</b>${this.developerMode ? ' <span class="admin-badge">[ADMIN FULL SÚNG]</span>' : ''}`;
        }
    }

    // Đồng bộ giao diện nút Chế độ Developer giữa Menu cài đặt và Menu tạm dừng
    syncDeveloperModeUI() {
        const label = this.developerMode ? 'BẬT (ADMIN FULL SÚNG)' : 'TẮT';
        const homeDevBtn = document.getElementById('home-devmode');
        if (homeDevBtn) {
            homeDevBtn.textContent = `CHẾ ĐỘ DEVELOPER: ${label}`;
            homeDevBtn.classList.toggle('yellow', this.developerMode);
            homeDevBtn.classList.toggle('orange', !this.developerMode);
        }
        const pauseDevBtn = document.getElementById('btn-toggle-devmode');
        if (pauseDevBtn) {
            pauseDevBtn.textContent = `CHẾ ĐỘ DEVELOPER: ${label}`;
            pauseDevBtn.style.background = this.developerMode ? 'linear-gradient(#ffe39a, #eeb34e)' : '#8aaddd';
        }
    }

    makeCoopSnapshot() {
        const events = this.networkEvents || [];
        this.networkEvents = [];

        return {
            worldEffects: this.weapons.getWorldState?.(),
            bombs: this.waveManager.bombs.snapshot(),
            state: this.state,
            mode: this.gameMode,
            tdmSpawns: this.gameMode === 'TDM' ? this.coopPlayers.map(p => ({ id: p.id || this.network.playerId, seq: p.spawnSeq || 0, position: p.position.toArray() })) : undefined,
            firstPerson: !!this.firstPersonView?.active,
            fillBots: !!this.tdmManager?.lastFillBots,
            wave: this.currentWave,
            nextWaveTimer: this.nextWaveTimer,
            score: this.score,
            events,
            looting: this.lootingSystem?.snapshot ? this.lootingSystem.snapshot() : null,
            projectiles: this.coopPlayers.flatMap(player => (player.weapons?.projectiles || []).filter(p => p.mesh).map(p => ({ id: `${player.id || this.network.playerId}:${p.id}`, owner: player.id || this.network.playerId, position: p.mesh.position.toArray(), direction: p.direction.toArray(), speed: p.speed, color: p.color }))),
            players: this.coopPlayers.map(player => ({ id: player.id || this.network.playerId, name: player.name || 'Bạn', character: player.characterId || this.characterId, team: player.team || (player === this.player ? this.selectedTDMTeam : 'blue'), position: player.position.toArray(), health: player.health, shield: player.shield, maxHealth: player.maxHealth, maxShield: player.maxShield, isDead: player.isDead, isDowned: player.isDowned, isInSmoke: !!player.isInSmoke, bleedOutTimer: player.bleedOutTimer, reviveProgress: player.reviveProgress || 0, isBeingRevived: !!player.isBeingRevived, invulnerability: player.invulnerability || 0, lootInventory: (player === this.player ? this.lootingSystem?.inventory : player.lootInventory)?.slots || null, aim: player.aimYaw, ads: !!player.isADS, moving: player === this.player ? player.velocity.lengthSq() > 0.1 : player.moving, skills: player.getSharedSkillState?.(), weapons: player.weapons?.getNetworkState(), processedSeq: player.processedSeq || 0 })),
            tdm: (this.gameMode === 'TDM' && this.tdmManager) ? { scoreBlue: this.tdmManager.scoreBlue, scoreRed: this.tdmManager.scoreRed, targetKills: this.tdmManager.targetKills, state: this.tdmManager.state } : null,
            enemies: this.waveManager.enemies.filter(enemy => !enemy.isDead).map(enemy => ({ id: enemy.id, type: enemy.type, position: enemy.position.toArray(), health: enemy.health, maxHealth: enemy.maxHealth, armor: enemy.armor ?? 0, status: {burnTimer: enemy.burnTimer || 0, burnDamage: enemy.burnDamage || 0, freezeTimer: enemy.freezeTimer || 0, vulnerableTimer: enemy.vulnerableTimer || 0, vulnerableMult: enemy.vulnerableMult || 1, combatState: enemy.combatState, combatTimer: enemy.combatTimer || 0}, animation: enemy.animationName || null, animationSeq: enemy.animationSeq || 0, animationTime: Number.isFinite(enemy.currentAction?.time) ? enemy.currentAction.time : null, animationRate: Number.isFinite(enemy.currentAction?.getEffectiveTimeScale()) ? enemy.currentAction.getEffectiveTimeScale() : null, animationPaused: typeof enemy.currentAction?.paused === 'boolean' ? enemy.currentAction.paused : null, yaw: enemy.mesh?.rotation.y || 0 })),
            pickups: this.pickups.pickups.map(pickup => ({ id: pickup.id, type: pickup.type, position: pickup.mesh.position.toArray(), weaponSlot: pickup.weaponSlot, life: pickup.life }))
        };
    }

    applyCoopSnapshot(snapshot, localId) {
        if (!snapshot) return;
        this.waveManager.bombs.applySnapshot(snapshot.bombs || []);
        if (snapshot.worldEffects) this.weapons.applyWorldState?.(snapshot.worldEffects);

        if (snapshot.looting && this.lootingSystem?.applySnapshot) {
            this.lootingSystem.applySnapshot(snapshot.looting);
        }

        // Đồng bộ tỷ số và trạng thái TDM từ Host sang Client
        if (snapshot.tdm && this.tdmManager) {
            const ended = snapshot.tdm.state === 'MATCH_OVER' && this.tdmManager.state !== 'MATCH_OVER';
            this.tdmManager.scoreBlue = snapshot.tdm.scoreBlue;
            this.tdmManager.scoreRed = snapshot.tdm.scoreRed;
            this.tdmManager.targetKills = snapshot.tdm.targetKills;
            this.tdmManager.state = snapshot.tdm.state;
            if (ended) this.tdmManager.endMatch(snapshot.tdm.scoreBlue >= snapshot.tdm.targetKills ? 'blue' : 'red');
            this.ui?.updateTDMScore?.(this.tdmManager.scoreBlue, this.tdmManager.scoreRed, this.tdmManager.targetKills);
        }

        // Đồng bộ hiệu ứng đường đạn, ánh chớp nòng và âm thanh khi người chơi khác bắn
        for (const ev of snapshot.events || []) {
            if (ev.type === 'turret_hit') {
                this.particles?.createImpactSparks?.(new THREE.Vector3().fromArray(ev.position), new THREE.Vector3(0,1,0), 0xfb923c, 6);
                sounds.play('pistol', {volume: 0.45});
            }
            if (ev.type === 'bomb_explosion') {
                const pos = new THREE.Vector3().fromArray(ev.position);
                this.particles?.createExplosion?.(pos, ev.color, 40, ev.radius);
                this.particles?.createImpactSparks?.(pos, new THREE.Vector3(0,1,0), ev.color, 25);
                sounds.play('enemyExplode', {volume: 1});
                this.player.applyExplosionShock?.(pos, 22, 0.75);
            }
            if (ev.type === 'hit' && ev.id > (this.lastHitEventId || 0)) {
                this.lastHitEventId = ev.id;
                if (ev.shooterId === localId) this.ui.triggerHitmarker(ev.crit);
                this.ui.showDamageNumber(ev.damage, ev.crit, new THREE.Vector3().fromArray(ev.position), this.camera, ev.result);
            } else if (ev.type === 'shot' && ev.shooterId !== localId) {
                const origin = new THREE.Vector3().fromArray(ev.origin);
                const target = new THREE.Vector3().fromArray(ev.target);
                const dir = new THREE.Vector3().subVectors(target, origin).normalize();
                const weapon = WEAPON_CONFIGS.find(w => w.id === ev.weaponId) || WEAPON_CONFIGS[0];
                const bulletColor = ev.color || weapon.color || 0xffee44;

                if (this.particles?.muzzleFlashEnabled) {
                    this.particles.createMuzzleFlash(origin, dir, bulletColor);
                }
                if (weapon.fireSound) {
                    sounds.play(weapon.fireSound, { volume: 0.65, pitchVariation: 0.08 });
                }

            } else if (ev.type === 'throw_bomb' && ev.throwerId !== localId) {
                const origin = new THREE.Vector3().fromArray(ev.origin);
                const target = new THREE.Vector3().fromArray(ev.target);
                const bombCfg = getBombConfig(ev.weaponId);
                if (bombCfg) {
                    this.weapons.spawnVisualBomb(origin, target, bombCfg);
                }
            } else if (ev.type === 'orbital_strike') {
                const pos = new THREE.Vector3().fromArray(ev.position);
                this.player.showOrbitalStrikeVisual?.(pos);
            } else if (ev.type === 'ground_smash') {
                const pos = new THREE.Vector3().fromArray(ev.position);
                this.player.showGroundSmashVisual?.(pos);
            } else if (ev.type === 'chain_lightning' && Array.isArray(ev.points)) {
                const points = ev.points.map(p => new THREE.Vector3().fromArray(p));
                this.player.createLightningEntity?.(points);
            } else if (ev.type === 'smoke_zone' && !snapshot.worldEffects) {
                const pos = new THREE.Vector3().fromArray(ev.position);
                this.weapons.createSmokeZone(pos, ev.radius || 6.0, ev.duration || 10.0);
                this.particles?.createExplosion?.(pos, 0x94a3b8, 25, ev.radius || 6.0);
                this.particles?.createImpactSparks?.(pos, new THREE.Vector3(0, 1, 0), 0xb0bec5, 20);
                sounds.play('land', { volume: 0.8, rate: 0.8 });
            }
        }

        const sampleTime = performance.now();
        const projectileIds = new Set();
        for (const state of snapshot.projectiles || []) {
            if (state.owner === localId) continue;
            projectileIds.add(state.id);
            let projectile = this.remoteProjectiles.get(state.id);
            if (!projectile) {
                const mesh = new THREE.Mesh(this.weapons.bulletGeo, new THREE.MeshBasicMaterial({ color: state.color }));
                this.scene.add(mesh);
                projectile = { mesh, direction: new THREE.Vector3() };
                this.remoteProjectiles.set(state.id, projectile);
            }
            projectile.mesh.position.fromArray(state.position);
            projectile.direction.fromArray(state.direction);
            projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), projectile.direction);
            projectile.speed = state.speed;
        }
        for (const [id, projectile] of this.remoteProjectiles) {
            if (!projectileIds.has(id) && projectile.life === undefined) { projectile.mesh.removeFromParent(); projectile.mesh.material.dispose(); this.remoteProjectiles.delete(id); }
        }
        this.currentWave = snapshot.wave ?? this.currentWave;
        this.score = snapshot.score ?? this.score;
        this.nextWaveTimer = snapshot.nextWaveTimer ?? this.nextWaveTimer;
        for (const state of snapshot.players || []) {
            if (state.id === localId) {
                const spawn = snapshot.tdmSpawns?.find(p => p.id === localId);
                if (spawn && spawn.seq > (this.player.spawnSeq || 0)) {
                    this.player.spawnSeq = spawn.seq;
                    this.player.position.fromArray(spawn.position);
                    this.player.velocity.set(0, 0, 0);
                }
                if ((this.player.isDead || this.player.isDowned) && !state.isDead && !state.isDowned) this.player.revive?.();
                this.player.bleedOutTimer = state.bleedOutTimer ?? 30;
                this.player.reviveProgress = state.reviveProgress || 0;
                this.player.isBeingRevived = !!state.isBeingRevived;
                this.player.invulnerability = state.invulnerability || 0;
                if (state.lootInventory && this.lootingSystem) this.lootingSystem.inventory.slots = state.lootInventory.map(s => s ? { ...s } : null);
                if ((state.isDowned || state.isDead) && this.player.model) this.player.model.rotation.x = -Math.PI / 2.2;
                this.player.maxHealth = state.maxHealth ?? this.player.maxHealth;
                this.player.maxShield = state.maxShield ?? this.player.maxShield;
                this.player.applySharedSkillState?.(state.skills);
                this.player.health = state.health; this.player.shield = state.shield;
                this.player.isDead = state.isDead; this.player.isDowned = state.isDowned;
                this.player.isInSmoke = !!state.isInSmoke;
                // Áp dụng trạng thái vũ khí, đạn, phụ kiện và bom từ Host
                if (state.weapons) {
                    this.weapons.applyNetworkState(state.weapons);
                    this.ui?.updateTacticalDock?.(this.weapons, this.player);
                }
                continue;
            }
            const remote = this.ensureCoopPlayer(state.id, state.name, state.character);
            const nextPosition = new THREE.Vector3().fromArray(state.position);
            if (remote.netTarget) {
                const elapsed = Math.max(0.02, (sampleTime - (remote.netSampleTime || sampleTime)) / 1000);
                remote.netVelocity.copy(nextPosition).sub(remote.netTarget).divideScalar(elapsed);
                remote.netVelocity.y = 0;
            }
            remote.netTarget = nextPosition;
            remote.netSampleTime = sampleTime;
            remote.position.copy(nextPosition); remote.health = state.health; remote.shield = state.shield;
            remote.maxHealth = state.maxHealth ?? remote.maxHealth;
            remote.maxShield = state.maxShield ?? remote.maxShield;
            remote.isDead = state.isDead; remote.isDowned = state.isDowned;
            remote.isInSmoke = !!state.isInSmoke;
            remote.bleedOutTimer = state.bleedOutTimer ?? 30; remote.reviveProgress = state.reviveProgress || 0;
            remote.isBeingRevived = !!state.isBeingRevived;
            remote.aimYaw = state.aim; remote.isADS = !!state.ads; remote.moving = !!state.moving;
            if (state.team) {
                remote.team = state.team;
                if (!remote.teamRing && this.tdmManager) {
                    this.tdmManager.attachPlayerTeamIndicator(remote);
                }
            }
            remote.applySharedSkillState?.(state.skills);
            remote.weapons.applyNetworkState(state.weapons);
        }
        const byId = new Map(this.waveManager.enemies.map(enemy => [enemy.id, enemy]));
        if (snapshot.tdm) {
            const ids = new Set((snapshot.players || []).map(p => p.id));
            for (const [id] of this.remotePlayers) if (id.startsWith('bot_') && !ids.has(id)) this.removeCoopPlayer(id);
            for (const remote of this.remotePlayers.values()) remote.isBot = remote.id.startsWith('bot_');
            this.tdmManager.teamBlue = this.coopPlayers.filter(p => p.team === 'blue');
            this.tdmManager.teamRed = this.coopPlayers.filter(p => p.team === 'red');
        }
        const snapshotEnemyIds = new Set((snapshot.enemies || []).map(enemy => enemy.id));
        for (const state of snapshot.enemies || []) {
            let enemy = byId.get(state.id);
            if (!enemy) {
                enemy = new Zombie(this.scene, state.type, new THREE.Vector3().fromArray(state.position), this.waveManager.models, this.particles, this.currentWave, this.weapons);
                enemy.id = state.id;
                this.waveManager.enemies.push(enemy);
            }
            const nextPosition = new THREE.Vector3().fromArray(state.position);
            if (enemy.netTarget) {
                const elapsed = Math.max(0.05, (sampleTime - (enemy.netSampleTime || sampleTime)) / 1000);
                enemy.netVelocity = enemy.netVelocity || new THREE.Vector3();
                enemy.netVelocity.copy(nextPosition).sub(enemy.netTarget).divideScalar(elapsed);
                enemy.netVelocity.y = 0;
            } else enemy.netVelocity = new THREE.Vector3();
            enemy.netTarget = nextPosition;
            enemy.netSampleTime = sampleTime;
            Object.assign(enemy, state.status || {});
            if (state.status) {
                const status = state.status;
                enemy.setEmissiveColor?.(status.freezeTimer > 0 ? 0x00f0ff : status.burnTimer > 0 ? 0xff6600 : 0xff00ff,
                    status.freezeTimer > 0 || status.burnTimer > 0 || status.vulnerableTimer > 0 ? 0.8 : 0);
            }
            enemy.position.copy(nextPosition); enemy.health = state.health;
            enemy.maxHealth = state.maxHealth;
            enemy.armor = state.armor ?? enemy.armor;
            enemy.applyAnimationSnapshot(state);
            if (!enemy.mesh) enemy.setupVisuals(this.waveManager.models);
            if (enemy.mesh && Number.isFinite(state.yaw)) enemy.mesh.rotation.y = state.yaw;
        }
        for (let i = this.waveManager.enemies.length - 1; i >= 0; i--) {
            if (!snapshotEnemyIds.has(this.waveManager.enemies[i].id)) {
                this.waveManager.enemies[i].disposeVisuals();
                this.waveManager.enemies.splice(i, 1);
            }
        }
        if (snapshot.state === 'GAMEOVER' && this.state !== 'GAMEOVER' &&
            snapshot.players?.some(p => p.id === localId) && snapshot.players.every(p => p.isDead || p.isDowned)) this.gameOver();
        const pickupIds = new Set((snapshot.pickups || []).map(pickup => pickup.id));
        for (const state of snapshot.pickups || []) {
            let pickup = this.pickups.pickups.find(candidate => candidate.id === state.id);
            if (!pickup) pickup = this.pickups.createPickup(new THREE.Vector3().fromArray(state.position), state.type, { id: state.id, weaponSlot: state.weaponSlot });
            if (pickup) { pickup.life = state.life; pickup.mesh.position.fromArray(state.position); }
        }
        for (let i = this.pickups.pickups.length - 1; i >= 0; i--) {
            if (!pickupIds.has(this.pickups.pickups[i].id)) this.pickups.remove(i);
        }
    }

    onPickupCollected(text, type) {
        this.ui.showPickupAlert(text);
    }

    animate() {
        requestAnimationFrame(this.animate);
        const frameDelta = this.clock.getDelta();
        // The room ticker owns hidden-tab simulation; never advance it twice.
        if (document.hidden) { this.renderQuality.reset(); return; }
        this.updateFrame(frameDelta);
    }

    updateRoomBackground(delta) {
        if (!document.hidden || !this.network.active) return;
        // Small simulation steps keep collisions/timers stable after a delayed tick.
        let remaining = Math.min(delta, 0.25);
        let maxSteps = 8;
        while (remaining > 0.001 && --maxSteps >= 0) {
            const step = Math.min(remaining, 0.05);
            this.updateFrame(step, false);
            remaining -= step;
        }
        // Consume hidden time so returning to the tab does not simulate it again.
        this.clock.getDelta();
    }

    updateFrame(frameDelta, render = true) {
        const delta = Math.min(frameDelta, 0.05);

        if (this.state === 'PLAYING') {
            if (render && this.renderQuality.sample(frameDelta)) this.renderer.setPixelRatio(this.renderQuality.ratio);
            // Shadow bounds follow the player to avoid clipping in large maps
            if (this.perfSettings.shadows && this.arena.sunLight && this.player) {
                this.arena.sunLight.position.set(this.player.position.x + 25, this.player.position.y + 38, this.player.position.z + 20);
                this.arena.sunLight.target.position.copy(this.player.position);
            }

            // Update arena portals and grass ambience.
            this.arena.update(delta);

            if (this.gameMode === 'TDM') {
                // Chế độ Đối kháng 4v4 TDM
                if (!this.network.active || this.network.host) this.tdmManager?.update(delta);
                this.visionCone?.update(this.player, delta);
            } else {
                if ((!this.network.active || this.network.host) && this.nextWaveTimer > 0) {
                    this.nextWaveTimer -= delta;
                    if (this.nextWaveTimer <= 0) {
                        this.waveManager.startWave(this.currentWave);
                        const message = this.currentWave % 5 === 0 ? 'CẢNH BÁO: MUTANT OVERLORD XUẤT HIỆN!'
                            : this.currentWave === 2 ? `ĐỢT ${this.currentWave}: FAST ZOMBIE XUẤT HIỆN!`
                            : this.currentWave === 3 ? `ĐỢT ${this.currentWave}: TANKER ZOMBIE GIÁP NẶNG!`
                            : `ĐỢT ${this.currentWave}: ĐÀN ZOMBIE TẤN CÔNG!`;
                        this.ui.showBanner(message);
                    }
                }
            }

            // Update Player
            this.player.update(delta, this.arena, this.gameMode === 'TDM' ? (this.player.team === 'blue' ? this.tdmManager.teamRed : this.tdmManager.teamBlue) : this.waveManager.enemies);
            if (this.player.reviveRequested) {
                if (this.network.active && !this.network.host) this.network.sendCommand({ type: 'revive' });
                else this.reviveNearest(this.player);
                this.player.reviveRequested = false;
            }
            if (this.player.toggleBotRequested) {
                this.togglePracticeBot();
                this.player.toggleBotRequested = false;
            }
            if (this.practiceBot) {
                this.updatePracticeBot(delta);
            }
            for (const player of this.remotePlayers.values()) {
                if (!this.network.active || this.network.host) player.updateSimulation?.(delta);
                player.updateVisual(delta);
            }

            // Cập nhật các vòng cứu người 3D và tự động cứu khi đứng trong vòng 2.5m
            this.updateReviveZones(delta);

            // Kiểm tra kết thúc trận khi toàn bộ đội bị gục hoặc tử trận
            const hasAliveTeammate = this.coopPlayers.some(player => !player.isDead && !player.isDowned);
            const noOneCanRevive = !hasAliveTeammate && this.coopPlayers.every(player => player.isDead || player.isDowned);
            if ((!this.network.active || this.network.host) && noOneCanRevive && this.state !== 'GAMEOVER') {
                this.gameOver();
            }

            // Update Weapons & Projectiles
            if (!this.network.active || this.network.host) {
                if (this.gameMode === 'TDM') {
                    const opponentEntities = this.player.team === 'blue' ? this.tdmManager.teamRed : this.tdmManager.teamBlue;
                    this.weapons.enemyTargets = opponentEntities;
                    this.weapons.update(delta, this.arena, opponentEntities, this.player,
                        (dmg, crit, pt, hitResult, target) => {
                            this.onHitEnemy(dmg, crit, pt, hitResult);
                        });
                } else {
                    this.weapons.enemyTargets = this.coopPlayers;
                    this.weapons.update(delta, this.arena, this.waveManager.enemies, this.player,
                        (dmg, crit, pt, hitResult) => this.onHitEnemy(dmg, crit, pt, hitResult));
                }
                for (const remote of this.remotePlayers.values()) {
                    if (this.gameMode === 'TDM') {
                        const botOpponents = remote.team === 'blue' ? this.tdmManager?.teamRed : this.tdmManager?.teamBlue;
                        remote.weapons.enemyTargets = botOpponents || [];
                        if (!remote.isBot) {
                            this.network.processCommands(remote);
                        }
                        remote.weapons.update(delta, this.arena, botOpponents || [], remote,
                            (dmg, crit, pt, hitResult, target) => {
                                this.onHitEnemy(dmg, crit, pt, hitResult, remote.id);
                            });
                    } else {
                        remote.latestEnemies = this.waveManager.enemies;
                        this.network.processCommands(remote);
                        remote.updateActiveSkills?.(delta, this.arena, this.waveManager.enemies);
                        remote.weapons.update(delta, this.arena, this.waveManager.enemies, remote,
                            (dmg, crit, pt, hitResult) => this.onHitEnemy(dmg, crit, pt, hitResult, remote.id));
                    }
                }
            } else {
                this.waveManager.bombs.update(delta, [], false);
                // Predicted shots are cosmetic. Only the host resolves hits and world damage.
                this.weapons.enemyTargets = [];
                this.weapons.update(delta, this.arena, [], this.player, () => {});
                for (const [id, projectile] of this.remoteProjectiles) {
                    projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * delta);
                    if (projectile.life !== undefined) {
                        projectile.life -= delta;
                        if (projectile.life <= 0) {
                            projectile.mesh.removeFromParent();
                            projectile.mesh.material.dispose();
                            this.remoteProjectiles.delete(id);
                        }
                    }
                }
                for (const enemy of this.waveManager.enemies) {
                    if (enemy.netTarget && enemy.mesh) {
                        const age = Math.min(0.16, Math.max(0, (performance.now() - enemy.netSampleTime) / 1000));
                        const visualTarget = enemy.netTarget.clone().addScaledVector(enemy.netVelocity || new THREE.Vector3(), age);
                        enemy.mesh.position.lerp(visualTarget, 1 - Math.exp(-18 * delta));
                    } else enemy.mesh?.position.lerp(enemy.position, 1 - Math.exp(-18 * delta));
                    if (enemy.mesh) enemy.position.copy(enemy.mesh.position);
                    enemy.mixer?.update(delta);
                    enemy.healthBar?.update(enemy.mesh?.position || enemy.position, enemy.health, enemy.maxHealth, !enemy.isDead);
                }
            }

            // Update Infinite Phases & Zombies (Chỉ chạy ở chế độ Sinh Tồn)
            if (this.gameMode !== 'TDM') {
                const waveFinished = (!this.network.active || this.network.host) && this.waveManager.update(
                    delta, this.coopPlayers, this.arena, (enemy) => this.onEnemyKilled(enemy));

                if (waveFinished) {
                    this.currentWave++;
                    this.score += 300 * (this.currentWave - 1);
                    this.addCoins(100);
                    sounds.play('land', { volume: 0.8 });
                    this.ui.showBanner(`HOÀN THÀNH ĐỢT ${this.currentWave - 1}! NGHỈ NGƠI 10 GIÂY (MỞ HÒM & NẠP ĐẠN)`);

                    this.nextWaveTimer = 10.0;
                }
            }

            // Update Pickups
            this.pickups.update(delta, this.coopPlayers, (txt, type) => this.onPickupCollected(txt, type), !this.network.active || this.network.host);

            // Update Particles
            this.particles.update(delta);

            // Update Looting & Airdrop Ecosystem
            if (this.gameMode !== 'TDM') {
                this.lootingSystem.update(delta);
            }

            // Background room ticks still simulate combat; the hidden HUD needs no painting.
            if (!render) return;

            // Update UI & Radar with 4 Portals, Teammates, and Tactical Airdrop Zone
            const teammates = this.gameMode === 'TDM'
                ? ((this.player.team === 'blue' ? this.tdmManager?.teamBlue : this.tdmManager?.teamRed) || []).filter(p => p !== this.player)
                : Array.from(this.remotePlayers.values());

            this.ui.updateStats(this.player, this.waveManager, this.score);
            this.ui.updateOverheadVitals(this.player, this.camera, this.renderer.domElement, teammates);
            this.ui.updateTeammateIndicators(teammates, this.player, this.camera);
            this.ui.updateTeamRoster(teammates, this.player);

            if (this.gameMode === 'TDM') {
                // Áp dụng Culling tầm nhìn chia sẻ toàn đội (Team Shared Vision) có kiểm tra vách tường trước khi vẽ radar
                const teamMembers = (this.player.team === 'blue' ? this.tdmManager?.teamBlue : this.tdmManager?.teamRed) || [this.player];
                const opponents = (this.player.team === 'blue' ? this.tdmManager?.teamRed : this.tdmManager?.teamBlue) || [];
                applyVisibilityCulling(teamMembers, opponents, null, this.arena);
                if (this.firstPersonView?.active) {
                    for (const opponent of opponents) {
                        opponent.mesh.visible = true;
                    }
                }
            }

            this.radarElapsed += delta;
            if (this.radarElapsed >= 0.05) {
                this.radarElapsed %= 0.05;
                const radarEnemies = this.gameMode === 'TDM'
                    ? (this.player.team === 'blue' ? this.tdmManager?.teamRed : this.tdmManager?.teamBlue) || []
                    : this.waveManager.enemies;
                // Trong TDM, chỉ những đối thủ đang nhìn thấy mới hiện trên radar
                const visibleRadarEnemies = this.gameMode === 'TDM'
                    ? radarEnemies.filter(e => e && !e.isDead && e.isVisibleToObserver)
                    : radarEnemies;
                this.ui.drawRadar(this.player, visibleRadarEnemies, this.pickups.pickups, this.arena.getPortals(), teammates, this.lootingSystem.activeAirdropZone);
            }
        } else if (this.state === 'MENU' || this.state === 'LOADING') {
            this.renderQuality.reset();
            this.player.updateCamera(delta);
            this.particles.update(delta);
        }

        // Render 3D Scene
        if (!render) return;
        if (this.state === 'MENU') {
            if (this.homeMenu?.showroom.dialog.open) this.homeMenu.showroom.render(delta);
            else this.roomLobby?.render(delta);
            return; // The opaque menu only needs its character/lobby scene.
        }
        const ownModel = this.player.model;
        const ownVisible = ownModel?.visible;
        if (this.firstPersonView?.active && ownModel) ownModel.visible = false;
        if (this.firstPersonView?.active) {
            for (const entity of [this.player, ...this.tdmManager.teamBlue, ...this.tdmManager.teamRed]) {
                if (entity.healthBar?.group) entity.healthBar.group.visible = false;
            }
        }
        this.renderer.render(this.scene, this.camera);
        if (ownModel) ownModel.visible = ownVisible;
        if (this.firstPersonView?.active) this.firstPersonView.render(this.renderer);
        if (this.state === 'PLAYING' && this.gameMode === 'TDM' && !this.firstPersonView?.active) {
            const myTeammates = ((this.player.team === 'blue' ? this.tdmManager?.teamBlue : this.tdmManager?.teamRed) || []).filter(p => p !== this.player);
            this.visionCone?.render(this.player, true, myTeammates, this.arena);
        } else {
            this.visionCone?.clear();
        }
    }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
    const game = new CyberArenaGame();
    window.game = game;
    
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && game.roomCode) {
        game.roomCode.value = roomCode.toUpperCase();
    }

    // Đảm bảo dữ liệu chưa lưu được đẩy lên cloud khi thoát hoặc reload trang
    window.addEventListener('beforeunload', () => {
        flushGameProgress();
    });
});
