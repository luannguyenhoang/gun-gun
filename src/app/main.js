import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/loaders/GLTFLoader.js';
import { sounds } from '../audio/audio.js';
import { ParticleSystem } from '../rendering/particles.js?v=22';
import { Arena } from '../world/arena.js?v=22';
import { WeaponSystem, getStartingWeapon, WEAPON_CONFIGS, th_UPGRADE_TIER_CONFIG, th_rollElementalEffect, th_getWeaponTier, th_getWeaponEnchant, th_ELEMENTAL_EFFECTS, th_getWeaponParts, th_computeWeaponFinalStats, TH_PART_META } from '../gameplay/combat/weapons.js?v=46';
import { PlayerController } from '../gameplay/player/player.js?v=22';
import { WaveManager, Zombie } from '../gameplay/combat/enemies.js?v=39';
import { PickupManager } from '../gameplay/loot/pickups.js?v=40';
import { UIManager } from '../ui/ui.js?v=40';
import { NetworkRoom, makeRemotePlayer } from '../network/network.js?v=33';
import { normalizeCharacter } from '../gameplay/player/characters.js?v=22';
import { RoomLobby } from '../ui/lobby.js?v=35';
import { HomeMenu } from '../ui/home.js?v=32';
import { LootingSystem } from '../gameplay/loot/looting.js?v=40';
import { RenderQuality } from '../rendering/performance.js';

class CyberArenaGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.state = 'LOADING'; // LOADING, MENU, PLAYING, PAUSED, GAMEOVER

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_arena_highscore') || '0', 10);
        this.currentWave = 1; // Infinite Phase counter
        this.characterId = normalizeCharacter(localStorage.getItem('cyber_arena_character') || 'soldier');
        this.nextWaveTimer = 0;
        this.clock = new THREE.Clock();
        this.network = new NetworkRoom(this);
        this.remotePlayers = new Map();
        this.remoteProjectiles = new Map();
        this.networkEvents = [];
        this.practiceBot = null;
        this.animate = this.animate.bind(this);
        this.radarElapsed = 0;
        this.developerMode = localStorage.getItem('arena_developer_mode') === 'true';
        window.developerMode = this.developerMode;

        // Hệ thống Tiền vàng và Mở khóa Súng (Shop & Armory)
        this.coins = parseInt(localStorage.getItem('arena_player_coins') || '1000', 10);
        this.unlockedWeapons = JSON.parse(localStorage.getItem('arena_unlocked_weapons') || '["blaster","repeater","scatter"]');
        try {
            this.th_weaponTiers = JSON.parse(localStorage.getItem('th_arena_weapon_tiers') || '{}');
            this.th_weaponEnchants = JSON.parse(localStorage.getItem('th_arena_weapon_enchants') || '{}');
            this.th_weaponParts = JSON.parse(localStorage.getItem('th_weapon_parts') || '{}');
        } catch {
            this.th_weaponTiers = {};
            this.th_weaponEnchants = {};
            this.th_weaponParts = {};
        }

        if (this.developerMode) {
            this.coins = 999999;
            this.unlockedWeapons = WEAPON_CONFIGS.map(w => w.id);
        }

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

        // Camera
        this.viewHeight = 18;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-this.viewHeight * aspect / 2, this.viewHeight * aspect / 2,
            this.viewHeight / 2, -this.viewHeight / 2, 0.1, 300);
        // High-Performance WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderQuality = new RenderQuality(window.devicePixelRatio);
        this.renderer.setPixelRatio(this.renderQuality.ratio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        // Resize handler
        window.addEventListener('resize', () => {
            const aspect = window.innerWidth / window.innerHeight;
            this.camera.left = -this.viewHeight * aspect / 2;
            this.camera.right = this.viewHeight * aspect / 2;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // GLTF Loader
        this.gltfLoader = new GLTFLoader();
    }

    initSubsystems() {
        this.particles = new ParticleSystem(this.scene);
        this.arena = new Arena(this.scene, this.gltfLoader);
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
                    ads: !!info.ads
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
        this.btnResume = document.getElementById('btn-resume');
        this.btnRestartPause = document.getElementById('btn-restart-pause');
        this.btnRestartOver = document.getElementById('btn-restart-gameover');
        this.roomName = document.getElementById('room-name');
        this.roomLobby = new RoomLobby(document.getElementById('room-lobby'), this.gltfLoader);
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
            this.btnStart.addEventListener('click', () => this.startGame());
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
                if (this.state === 'PLAYING') {
                    this.pauseGame();
                } else if (this.state === 'PAUSED') {
                    this.resumeGame();
                }
            }
        });

        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.pauseGame();
        });

        // Sound toggles in pause menu
        const soundBtn = document.getElementById('toggle-sound');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const on = sounds.toggleAudio();
                soundBtn.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
            });
        }
        const musicBtn = document.getElementById('toggle-music');
        if (musicBtn) {
            musicBtn.addEventListener('click', () => {
                const on = sounds.toggleMusic();
                musicBtn.textContent = on ? 'MUSIC: ON' : 'MUSIC: OFF';
            });
        }
        this.syncDeveloperModeUI();
        this.updateCoinsUI();
    }

    async loadAssetsAndStart() {
        const loadingProgress = document.getElementById('loading-bar-fill');
        const loadingText = document.getElementById('loading-status-text');

        const updateLoading = (pct, text) => {
            if (loadingProgress) loadingProgress.style.width = `${pct}%`;
            if (loadingText) loadingText.textContent = text;
        };

        updateLoading(15, 'Loading Arena Modules & Portals...');
        await this.arena.loadModels();

        updateLoading(40, 'Building Arena & Portals...');
        this.arena.buildArena();

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
        if (this.network.active && !fromRoom) {
            if (this.network.host) this.network.start();
            return;
        }
        this.homeMenu?.showroom.dialog.close();
        this.homeMenu?.dialog.close();
        sounds.init();
        sounds.startMusic();

        this.state = 'PLAYING';
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
            remote.weapons.resetRun(); remote.health = remote.maxHealth; remote.shield = remote.maxShield;
            remote.isDead = false; remote.isDowned = false; remote.commandQueue = [];
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
        document.getElementById('hud-pause').disabled = this.network.active;
        if (!this.network.active || this.network.host) this.waveManager.startWave(this.currentWave);
        else this.waveManager.clear();
        this.ui.showBanner('SỐNG SÓT · NHẶT ĐẠN · NÂNG CẤP');
    }

    pauseGame() {
        if (this.network.active) return;
        this.state = 'PAUSED';
        this.player.setInputEnabled(false);
        this.ui.clearTeammateIndicators();
        if (this.screenPause) this.screenPause.style.display = 'flex';
    }

    resumeGame() {
        this.state = 'PLAYING';
        if (this.screenPause) this.screenPause.style.display = 'none';
        this.player.setInputEnabled(true);
    }

    restartGame() {
        this.startGame();
    }

    returnToMenu() {
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
        this.screenPause.style.display = 'none';
        this.screenGameOver.style.display = 'none';
        this.hud.style.display = 'none';
        this.screenMenu.style.display = 'flex';
        this.homeMenu.preview();
        this.btnStart?.focus();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.player.setInputEnabled(false);
        this.lootingSystem?.closeContainerUI();
        this.ui.clearTeammateIndicators();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_arena_highscore', this.highScore.toString());
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

    onHitEnemy(damage, isCrit, hitPoint, hitResult = null) {
        this.ui.triggerHitmarker(isCrit);
        this.ui.showDamageNumber(damage, isCrit, hitPoint, this.camera, hitResult);
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
        this.roomStatus.textContent = `PHÒNG ${data.code}: ${names}${isHost ? ' • Bấm BẮT ĐẦU PHÒNG' : ' • Chờ chủ phòng'}`;
        if (this.roomCode) this.roomCode.value = data.code;
        if (this.roomCopy) this.roomCopy.style.display = 'inline-block';
        if (this.roomStart) this.roomStart.style.display = isHost ? 'inline-block' : 'none';
        if (this.roomStart) this.roomStart.disabled = (data.players || []).length < 1 || data.started;
        if (this.roomLeave) this.roomLeave.style.display = 'inline-block';
        this.characterOptions?.forEach(option => { option.disabled = !!data.started; });
        if (this.roomCreate) this.roomCreate.disabled = true;
        if (this.roomJoin) this.roomJoin.disabled = true;
        if (this.btnStart) this.btnStart.style.display = 'none';
        
        if (data.code) {
            const newUrl = window.location.pathname + '?room=' + data.code;
            window.history.replaceState(null, '', newUrl);
        }
    }

    resetRoomUI() {
        this.screenMenu?.classList.remove('party-menu');
        if (this.roomLobby?.container) this.roomLobby.container.hidden = true;
        if (this.roomStatus) this.roomStatus.textContent = 'Tạo phòng rồi gửi link này cho đồng đội. Bản public chạy online; bản local cần cùng Wi‑Fi.';
        if (this.roomCode) this.roomCode.value = '';
        if (this.roomCopy) this.roomCopy.style.display = 'none';
        if (this.roomStart) this.roomStart.style.display = 'none';
        if (this.roomLeave) this.roomLeave.style.display = 'none';
        if (this.roomCreate) this.roomCreate.disabled = false;
        if (this.roomJoin) this.roomJoin.disabled = false;
        if (this.btnStart) this.btnStart.style.display = 'inline-block';
        this.characterOptions?.forEach(option => { option.disabled = false; });
        
        window.history.replaceState(null, '', window.location.pathname);
        this.homeMenu?.room(null);
    }

    ensureCoopPlayer(id, name, character = 'soldier') {
        if (id === this.network.playerId) return this.player;
        if (this.remotePlayers.has(id)) {
            const remote = this.remotePlayers.get(id);
            remote.name = name || remote.name;
            remote.setCharacter?.(character);
            return remote;
        }
        const remote = makeRemotePlayer(this.scene, this.gltfLoader, id, name, character);
        remote.weapons = new WeaponSystem(this.scene, this.gltfLoader, this.particles);
        remote.weapons.models = this.weapons.models;
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
        remote.dispose();
        this.remotePlayers.delete(id);
        this.coopPlayers = this.coopPlayers.filter(player => player !== remote);
    }

    reviveTeammate(teammate, reviver = this.player) {
        if (!teammate?.isDowned || teammate === reviver || teammate.position.distanceTo(reviver.position) > 2.4) return false;
        const revived = teammate.revive();
        if (revived) this.ui.showPickupAlert(`ĐÃ HỒI SINH ${teammate.name || 'ĐỒNG ĐỘI'}`);
        return revived;
    }

    reviveNearest(reviver) {
        const teammate = this.coopPlayers.find(player => player !== reviver && player.isDowned && player.position.distanceTo(reviver.position) <= 2.4);
        return this.reviveTeammate(teammate, reviver);
    }

    // Bật hoặc tắt đồng đội bot phục vụ thử nghiệm và chơi đơn
    togglePracticeBot() {
        if (this.practiceBot) {
            this.removeCoopPlayer(this.practiceBot.id);
            this.practiceBot = null;
            this.ui.showPickupAlert('ĐÃ HỦY ĐỒNG ĐỘI AI');
            if (this.btnToggleBot) this.btnToggleBot.textContent = 'ĐỒNG ĐỘI BOT: BẬT (PHÍM B)';
            return;
        }

        const botId = 'bot_practice';
        const bot = this.ensureCoopPlayer(botId, 'Chiến binh AI', 'soldier');
        bot.isBot = true;
        bot.botShootCooldown = 0;
        // Đặt vị trí ban đầu ngoài tầm nhìn màn hình (15m) để quan sát định vị rìa màn hình
        bot.position.copy(this.player.position).add(new THREE.Vector3(15, 0, 15));
        this.practiceBot = bot;
        this.ui.showPickupAlert('ĐÃ GỌI ĐỒNG ĐỘI AI (PHÍM B ĐỂ BẬT/TẮT)');
        if (this.btnToggleBot) this.btnToggleBot.textContent = 'ĐỒNG ĐỘI BOT: TẮT (PHÍM B)';
    }

    // Cập nhật hành vi cho đồng đội bot (di chuyển, ngắm bắn quái)
    updatePracticeBot(delta) {
        const bot = this.practiceBot;
        if (!bot || bot.isDead) return;

        if (bot.isDowned) {
            bot.moving = false;
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

    // Cộng tiền vàng người chơi
    addCoins(amount) {
        this.coins = Math.max(0, (this.coins || 0) + amount);
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
    saveProgress() {
        try {
            localStorage.setItem('arena_player_coins', this.coins.toString());
            localStorage.setItem('arena_unlocked_weapons', JSON.stringify(this.unlockedWeapons));
            localStorage.setItem('th_arena_weapon_tiers', JSON.stringify(this.th_weaponTiers || {}));
            localStorage.setItem('th_arena_weapon_enchants', JSON.stringify(this.th_weaponEnchants || {}));
            localStorage.setItem('th_weapon_parts', JSON.stringify(this.th_weaponParts || {}));
        } catch (e) {
            console.warn('Lỗi lưu tiến trình:', e);
        }
    }

    // Cường hóa / Đập đồ nâng cấp súng
    th_enhanceWeapon(weaponId) {
        if (!weaponId) return { success: false };
        const currentTier = this.th_weaponTiers[weaponId] || 1;
        if (currentTier >= 5) {
            if (this.ui?.showPickupAlert) this.ui.showPickupAlert('VŨ KHÍ ĐÃ ĐẠT CẤP TỐI ĐA!');
            return { success: false, max: true };
        }
        const cfg = th_UPGRADE_TIER_CONFIG[currentTier];
        if (!cfg) return { success: false };

        if (this.coins < cfg.cost) {
            if (this.ui?.showPickupAlert) this.ui.showPickupAlert('KHÔNG ĐỦ VÀNG ĐỂ CƯỜNG HÓA!');
            return { success: false, notEnoughGold: true };
        }

        this.coins -= cfg.cost;
        const isSuccess = (Math.random() <= cfg.successRate);

        if (isSuccess) {
            const nextTier = currentTier + 1;
            this.th_weaponTiers[weaponId] = nextTier;
            this.saveProgress();
            this.updateCoinsUI();
            sounds.play('equip', { volume: 0.9, pitchVariation: 0.1 });
            if (this.ui?.showPickupAlert) {
                this.ui.showPickupAlert(`CƯỜNG HÓA THÀNH CÔNG: LÊN CẤP ${nextTier}!`);
            }
            if (this.homeMenu?.showroom) {
                this.homeMenu.showroom.syncSelection();
            }
            return { success: true, tier: nextTier };
        } else {
            this.saveProgress();
            this.updateCoinsUI();
            sounds.playArmorDeflect();
            if (this.ui?.showPickupAlert) {
                this.ui.showPickupAlert('CƯỜNG HÓA THẤT BẠI! CẤP ĐỘ KHÔNG ĐỔI.');
            }
            if (this.homeMenu?.showroom) {
                this.homeMenu.showroom.syncSelection();
            }
            return { success: false, tier: currentTier };
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

    // Gacha Ép Khảm Hiệu Ứng Nguyên Tố (300 Vàng / lượt)
    th_gachaEnchantWeapon(weaponId) {
        if (!weaponId) return null;
        const cost = 300;
        if (this.coins < cost) {
            if (this.ui?.showPickupAlert) this.ui.showPickupAlert('KHÔNG ĐỦ VÀNG ÉP HIỆU ỨNG (CẦN 300 VÀNG)!');
            return null;
        }

        this.coins -= cost;
        const rolled = th_rollElementalEffect();
        this.th_weaponEnchants[weaponId] = rolled.id;
        this.saveProgress();
        this.updateCoinsUI();
        sounds.play('switchWeapon', { volume: 0.9, rate: 1.2 });
        if (this.ui?.showPickupAlert) {
            this.ui.showPickupAlert(`ÉP THÀNH CÔNG: [${rolled.name}] - ${rolled.desc}!`);
        }
        if (this.homeMenu?.showroom) {
            this.homeMenu.showroom.syncSelection();
        }
        return rolled;
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
            bombs: this.waveManager.bombs.snapshot(),
            state: this.state,
            wave: this.currentWave,
            score: this.score,
            events,
            looting: this.lootingSystem?.snapshot ? this.lootingSystem.snapshot() : null,
            projectiles: this.coopPlayers.flatMap(player => (player.weapons?.projectiles || []).filter(p => p.mesh).map(p => ({ id: `${player.id || this.network.playerId}:${p.id}`, owner: player.id || this.network.playerId, position: p.mesh.position.toArray(), direction: p.direction.toArray(), speed: p.speed, color: p.color }))),
            players: this.coopPlayers.map(player => ({ id: player.id || this.network.playerId, name: player.name || 'Bạn', character: player.characterId || this.characterId, position: player.position.toArray(), health: player.health, shield: player.shield, isDead: player.isDead, isDowned: player.isDowned, aim: player.aimYaw, ads: !!player.isADS, moving: player === this.player ? player.velocity.lengthSq() > 0.1 : player.moving, weapons: player.weapons?.getNetworkState(), processedSeq: player.processedSeq || 0 })),
            enemies: this.waveManager.enemies.filter(enemy => !enemy.isDead).map(enemy => ({ id: enemy.id, type: enemy.type, position: enemy.position.toArray(), health: enemy.health, maxHealth: enemy.maxHealth, yaw: enemy.mesh?.rotation.y || 0 })),
            pickups: this.pickups.pickups.map(pickup => ({ id: pickup.id, type: pickup.type, position: pickup.mesh.position.toArray(), weaponSlot: pickup.weaponSlot, life: pickup.life }))
        };
    }

    applyCoopSnapshot(snapshot, localId) {
        if (!snapshot) return;
        this.waveManager.bombs.applySnapshot(snapshot.bombs || []);

        if (snapshot.looting && this.lootingSystem?.applySnapshot) {
            this.lootingSystem.applySnapshot(snapshot.looting);
        }

        // Đồng bộ hiệu ứng đường đạn, ánh chớp nòng và âm thanh khi người chơi khác bắn
        for (const ev of snapshot.events || []) {
            if (ev.type === 'shot' && ev.shooterId !== localId) {
                const origin = new THREE.Vector3().fromArray(ev.origin);
                const target = new THREE.Vector3().fromArray(ev.target);
                const dir = new THREE.Vector3().subVectors(target, origin).normalize();
                const weapon = WEAPON_CONFIGS.find(w => w.id === ev.weaponId) || WEAPON_CONFIGS[0];
                const bulletColor = ev.color || weapon.color || 0xffee44;

                this.particles.createMuzzleFlash(origin, dir, bulletColor);
                if (weapon.fireSound) {
                    sounds.play(weapon.fireSound, { volume: 0.65, pitchVariation: 0.08 });
                }

                const tracerId = `tracer_${ev.shooterId}_${Math.random().toString(36).substring(2, 7)}`;
                const mesh = new THREE.Mesh(this.weapons.bulletGeo, new THREE.MeshBasicMaterial({ color: bulletColor }));
                mesh.position.copy(origin);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
                this.scene.add(mesh);
                this.remoteProjectiles.set(tracerId, {
                    mesh,
                    direction: dir,
                    speed: weapon.bulletSpeed || 60,
                    life: 1.2
                });
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
        for (const state of snapshot.players || []) {
            if (state.id === localId) {
                this.player.health = state.health; this.player.shield = state.shield;
                this.player.isDead = state.isDead; this.player.isDowned = state.isDowned;
                if (state.processedSeq >= this.network.seq) this.weapons.applyNetworkState(state.weapons);
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
            remote.isDead = state.isDead; remote.isDowned = state.isDowned;
            remote.aimYaw = state.aim; remote.isADS = !!state.ads; remote.moving = !!state.moving;
            remote.weapons.applyNetworkState(state.weapons);
        }
        const byId = new Map(this.waveManager.enemies.map(enemy => [enemy.id, enemy]));
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
            enemy.position.copy(nextPosition); enemy.health = state.health;
            enemy.maxHealth = state.maxHealth;
            if (!enemy.mesh) enemy.setupVisuals(this.waveManager.models);
            if (enemy.mesh && Number.isFinite(state.yaw)) enemy.mesh.rotation.y = state.yaw;
        }
        for (let i = this.waveManager.enemies.length - 1; i >= 0; i--) {
            if (!snapshotEnemyIds.has(this.waveManager.enemies[i].id)) {
                this.waveManager.enemies[i].disposeVisuals();
                this.waveManager.enemies.splice(i, 1);
            }
        }
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
        const delta = Math.min(frameDelta, 0.05);
        // Room polling continues while a teammate waits in the lobby.
        this.network.update(delta);
        if (document.hidden) { this.renderQuality.reset(); return; }

        if (this.state === 'PLAYING') {
            if (this.renderQuality.sample(frameDelta)) this.renderer.setPixelRatio(this.renderQuality.ratio);
            // Shadow bounds follow the player to avoid clipping in large maps
            if (this.arena.sunLight && this.player) {
                this.arena.sunLight.position.set(this.player.position.x + 25, this.player.position.y + 38, this.player.position.z + 20);
                this.arena.sunLight.target.position.copy(this.player.position);
            }

            // Update arena portals and grass ambience.
            this.arena.update(delta);
            if (this.nextWaveTimer > 0) {
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

            // Update Player
            this.player.update(delta, this.arena, this.waveManager.enemies);
            if (this.player.reviveRequested) {
                const downed = this.coopPlayers.find(player => player !== this.player && player.isDowned);
                this.reviveTeammate(downed, this.player);
                this.player.reviveRequested = false;
            }
            if (this.player.toggleBotRequested) {
                this.togglePracticeBot();
                this.player.toggleBotRequested = false;
            }
            if (this.practiceBot) {
                this.updatePracticeBot(delta);
            }
            for (const player of this.remotePlayers.values()) player.updateVisual(delta);
            // Player Damage Flash / Game Over check
            if (this.player.isDead && (!this.network.active || this.coopPlayers.every(player => player.isDead)) && this.state !== 'GAMEOVER') {
                this.gameOver();
            }

            // Update Weapons & Projectiles
            if (!this.network.active || this.network.host) {
                this.weapons.enemyTargets = this.coopPlayers;
                this.weapons.update(delta, this.arena, this.waveManager.enemies, this.player,
                    (dmg, crit, pt, hitResult) => this.onHitEnemy(dmg, crit, pt, hitResult));
                for (const remote of this.remotePlayers.values()) {
                    this.network.processCommands(remote);
                    remote.weapons.update(delta, this.arena, this.waveManager.enemies, remote,
                        (dmg, crit, pt, hitResult) => this.onHitEnemy(dmg, crit, pt, hitResult));
                }
            } else {
                this.waveManager.bombs.update(delta, [], false);
                // Client prediction: xử lý va chạm trúng đích tức thời và báo cáo sát thương lên Host
                this.weapons.update(delta, this.arena, this.waveManager.enemies, this.player,
                    (dmg, crit, pt, hitResult, enemy) => {
                        this.onHitEnemy(dmg, crit, pt, hitResult);
                        if (enemy && enemy.id) {
                            enemy.health = Math.max(0, enemy.health - dmg);
                            if (enemy.health <= 0) enemy.isDead = true;
                            this.network.sendCommand({
                                type: 'hit_enemy',
                                enemyId: enemy.id,
                                damage: dmg,
                                crit: !!crit,
                                hitPoint: pt ? pt.toArray() : null
                            });
                        }
                    });
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

            // Update Infinite Phases & Zombies
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

            // Update Pickups
            this.pickups.update(delta, this.coopPlayers, (txt, type) => this.onPickupCollected(txt, type), !this.network.active || this.network.host);

            // Update Particles
            this.particles.update(delta);

            // Update Looting & Airdrop Ecosystem
            this.lootingSystem.update(delta);

            // Update UI & Radar with 4 Portals, Teammates, and Tactical Airdrop Zone
            const teammates = Array.from(this.remotePlayers.values());
            this.ui.updateStats(this.player, this.waveManager, this.score);
            this.ui.updateOverheadVitals(this.player, this.camera, this.renderer.domElement);
            this.ui.updateTeammateIndicators(teammates, this.player, this.camera);
            this.ui.updateTeamRoster(teammates, this.player);
            this.radarElapsed += delta;
            if (this.radarElapsed >= 0.05) {
                this.radarElapsed %= 0.05;
                this.ui.drawRadar(this.player, this.waveManager.enemies, this.pickups.pickups, this.arena.getPortals(), teammates, this.lootingSystem.activeAirdropZone);
            }
        } else if (this.state === 'MENU' || this.state === 'LOADING') {
            this.renderQuality.reset();
            this.player.updateCamera(delta);
            this.particles.update(delta);
        }

        // Render 3D Scene
        if (this.state === 'MENU') {
            if (this.homeMenu?.showroom.dialog.open) this.homeMenu.showroom.render(delta);
            else this.roomLobby?.render(delta);
            return; // The opaque menu only needs its character/lobby scene.
        }
        this.renderer.render(this.scene, this.camera);
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
});
