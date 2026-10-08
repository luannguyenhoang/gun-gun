import * as THREE from 'three';
import { sounds } from '../../audio/audio.js?v=58';
import { WEAPON_CONFIGS } from './weapons.js';

// Danh sách trang bị súng đa dạng cho các bot
const BOT_WEAPON_POOL = ['repeater', 'scatter', 'sniper', 'blaster_c', 'carbine'];

/**
 * Controller điều khiển từng Bot AI trong trận đối kháng TDM
 */
export class TDMBot {
    constructor(id, name, team, characterId, spawnPos, game, tdmManager) {
        this.id = id;
        this.name = name;
        this.team = team;
        this.characterId = characterId;
        this.game = game;
        this.tdmManager = tdmManager;

        // Tận dụng hệ thống người chơi hợp tác sẵn có để có đủ Model 3D, thanh máu và vũ khí
        this.remote = game.ensureCoopPlayer(id, name, characterId);
        this.remote.team = team;
        this.remote.isBot = true;
        this.remote.position.copy(spawnPos);
        this.remote.health = 100;
        this.remote.maxHealth = 100;
        this.remote.shield = 100;
        this.remote.maxShield = 100;
        this.remote.isDead = false;
        this.remote.isDowned = false;
        this.remote.invulnerability = 1.5;

        // Chuyển hướng nhận sát thương từ remote sang controller của Bot
        this.remote.botController = this;
        this.remote.takeDamage = (amount, penPower, isCrit, direction, attacker) => {
            return this.takeDamage(amount, penPower, isCrit, direction, attacker);
        };

        // Chọn vũ khí ngẫu nhiên cho Bot
        const weaponIndex = Math.floor(Math.random() * BOT_WEAPON_POOL.length);
        this.weaponId = BOT_WEAPON_POOL[weaponIndex];
        if (this.remote.weapons) {
            this.remote.weapons.startingWeaponId = this.weaponId;
            this.remote.weapons.resetRun(this.weaponId);
        }

        this.shootCooldown = 0.5 + Math.random() * 0.5;
        this.respawnTimer = 0;
        this.patrolTarget = new THREE.Vector3();
        this.pickNewPatrolTarget();

        // Gắn vòng màu nhận diện phe dưới chân (Team Ring Indicator)
        this.attachTeamIndicator();
    }

    attachTeamIndicator() {
        if (!this.remote.mesh) return;
        const color = this.team === 'blue' ? 0x38bdf8 : 0xef4444;
        const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.teamRing = new THREE.Mesh(ringGeo, ringMat);
        this.teamRing.position.y = 0.05;
        this.remote.mesh.add(this.teamRing);
    }

    pickNewPatrolTarget() {
        // Tuần tra ngẫu nhiên quanh trung tâm bản đồ (-15 đến +15)
        const rx = (Math.random() - 0.5) * 26;
        const rz = (Math.random() - 0.5) * 26;
        this.patrolTarget.set(rx, 0, rz);
    }

    takeDamage(amount, penPower, isCrit, direction, attacker) {
        if (this.remote.isDead || this.remote.invulnerability > 0) return;

        // Trừ giáp trước, trừ máu sau
        const absorbed = Math.min(this.remote.shield, amount);
        this.remote.shield -= absorbed;
        this.remote.health -= (amount - absorbed);

        if (this.remote.health <= 0) {
            this.remote.health = 0;
            this.remote.isDead = true;
            this.remote.isDowned = false;
            this.respawnTimer = 0;

            // Kích hoạt hiệu ứng hạ gục
            this.tdmManager.onEntityKilled(this.remote, attacker);
        }
    }

    update(delta, opponents = []) {
        if (this.remote.isDead) {
            this.respawnTimer += delta;
            this.remote.moving = false;
            if (this.respawnTimer >= 3.0) {
                this.tdmManager.respawnEntity(this.remote);
                this.respawnTimer = 0;
            }
            return;
        }

        // Đếm ngược thời gian khiên bất tử
        if (this.remote.invulnerability > 0) {
            this.remote.invulnerability = Math.max(0, this.remote.invulnerability - delta);
            // Nhấp nháy model khi bất tử
            if (this.remote.mesh) {
                this.remote.mesh.visible = Math.floor(Date.now() / 120) % 2 === 0;
            }
        } else {
            if (this.remote.mesh && !this.remote.mesh.visible && !this.remote._hiddenByCulling) {
                this.remote.mesh.visible = true;
            }
        }

        this.shootCooldown = Math.max(0, this.shootCooldown - delta);

        // 1. Tìm kẻ địch còn sống gần nhất thuộc phe đối phương
        let nearestEnemy = null;
        let minDist = 32.0;

        for (let i = 0; i < opponents.length; i++) {
            const opp = opponents[i];
            if (!opp || opp.isDead || opp.team === this.team) continue;
            const d = opp.position.distanceTo(this.remote.position);
            if (d < minDist) {
                minDist = d;
                nearestEnemy = opp;
            }
        }

        // 2. Hành vi tác chiến
        if (nearestEnemy) {
            const toEnemy = nearestEnemy.position.clone().sub(this.remote.position);
            toEnemy.y = 0;
            const dist = toEnemy.length();

            // Xoay hướng ngắm về phía mục tiêu
            if (dist > 0.1) {
                this.remote.aimYaw = Math.atan2(toEnemy.x, toEnemy.z);
            }

            // Khoảng cách chiến thuật tối ưu theo vũ khí
            let idealDist = 13.0;
            const gunId = this.weaponId;
            if (gunId === 'scatter') idealDist = 6.0;
            else if (gunId === 'sniper') idealDist = 20.0;
            else if (gunId === 'blaster_c') idealDist = 9.0;

            toEnemy.normalize();
            const moveSpeed = 5.2;

            if (dist > idealDist + 2.5) {
                // Tiến lại gần kẻ địch
                this.remote.position.addScaledVector(toEnemy, moveSpeed * delta);
                this.remote.moving = true;
            } else if (dist < idealDist - 2.5) {
                // Lùi lại để giữ cự ly an toàn
                this.remote.position.addScaledVector(toEnemy, -moveSpeed * 0.8 * delta);
                this.remote.moving = true;
            } else {
                // Di chuyển né đạn qua hai bên (Strafe)
                const strafeDir = new THREE.Vector3(-toEnemy.z, 0, toEnemy.x);
                const strafeSign = (Math.floor(Date.now() / 1200) % 2 === 0) ? 1 : -1;
                this.remote.position.addScaledVector(strafeDir, strafeSign * moveSpeed * 0.65 * delta);
                this.remote.moving = true;
            }

            // Khai hỏa khi cự ly phù hợp và hết hồi chiêu
            if (this.shootCooldown <= 0 && dist <= 28.0) {
                this.shootCooldown = 0.55 + Math.random() * 0.45;
                if (gunId === 'scatter') this.shootCooldown = 0.95;
                if (gunId === 'sniper') this.shootCooldown = 1.4;

                const shootOrigin = this.remote.position.clone().add(new THREE.Vector3(0, 1.15, 0));
                // Thêm một chút độ lệch ngắm để Bot bắn thực tế (không bị aimbot hoàn hảo)
                const spreadX = (Math.random() - 0.5) * 0.8;
                const spreadZ = (Math.random() - 0.5) * 0.8;
                const shootTarget = nearestEnemy.position.clone().add(new THREE.Vector3(spreadX, 0.85, spreadZ));

                if (this.remote.weapons) {
                    this.remote.weapons.shoot(shootOrigin, shootTarget, false, true, 0.95, this.remote);
                }
            }
        } else {
            // Không có kẻ địch trong tầm: Tuần tra đến điểm chốt
            const toPatrol = this.patrolTarget.clone().sub(this.remote.position);
            toPatrol.y = 0;
            const distPatrol = toPatrol.length();

            if (distPatrol < 2.0) {
                this.pickNewPatrolTarget();
                this.remote.moving = false;
            } else {
                toPatrol.normalize();
                this.remote.position.addScaledVector(toPatrol, 4.2 * delta);
                this.remote.aimYaw = Math.atan2(toPatrol.x, toPatrol.z);
                this.remote.moving = true;
            }
        }

        // Giới hạn trong đấu trường
        this.remote.position.x = Math.max(-23, Math.min(23, this.remote.position.x));
        this.remote.position.z = Math.max(-23, Math.min(23, this.remote.position.z));
    }
}

/**
 * Trình quản lý toàn bộ vòng đời Chế độ Đối Kháng Chia Đội (Team Deathmatch)
 */
export class TDMManager {
    constructor(game) {
        this.game = game;
        this.state = 'IDLE'; // IDLE, ACTIVE, MATCH_OVER
        this.targetKills = 20;
        this.scoreBlue = 0;
        this.scoreRed = 0;
        this.playerTeam = 'blue';

        this.bots = [];
        this.teamBlue = [];
        this.teamRed = [];

        this.playerRespawnTimer = 0;
        this.matchTimer = 0;

        // Vị trí xuất phát của 2 đội ở hai đầu bản đồ
        this.spawnPointsBlue = [
            new THREE.Vector3(-18, 0, -18),
            new THREE.Vector3(-15, 0, -21),
            new THREE.Vector3(-21, 0, -15),
            new THREE.Vector3(-13, 0, -18)
        ];

        this.spawnPointsRed = [
            new THREE.Vector3(18, 0, 18),
            new THREE.Vector3(15, 0, 21),
            new THREE.Vector3(21, 0, 15),
            new THREE.Vector3(13, 0, 18)
        ];
    }

    /**
     * Bắt đầu một trận đấu đối kháng mới
     * @param {string} playerTeam - 'blue' hoặc 'red'
     * @param {number} teamSize - Số người mỗi đội (mặc định 4v4)
     */
    startMatch(playerTeam = 'blue', teamSize = 4) {
        this.cleanup();

        this.state = 'ACTIVE';
        this.playerTeam = playerTeam;
        this.scoreBlue = 0;
        this.scoreRed = 0;
        this.matchTimer = 0;
        this.playerRespawnTimer = 0;

        const player = this.game.player;
        player.team = playerTeam;
        player.health = player.maxHealth;
        player.shield = player.maxShield;
        player.isDead = false;
        player.isDowned = false;
        player.invulnerability = 2.0;

        // Gắn vòng hào quang nhận diện phe cho người chơi chính
        this.attachPlayerTeamIndicator(player);

        // Đặt người chơi về điểm xuất phát của đội mình
        const playerSpawn = this.getRandomSpawnPoint(playerTeam);
        player.position.copy(playerSpawn);
        player.aimYaw = playerTeam === 'blue' ? Math.PI * 0.25 : -Math.PI * 0.75;

        this.teamBlue = [];
        this.teamRed = [];

        if (playerTeam === 'blue') {
            this.teamBlue.push(player);
        } else {
            this.teamRed.push(player);
        }

        // Tạo Bot lấp đầy 2 đội (4v4)
        const botRoles = ['soldier', 'police', 'cyborg', 'specops'];
        const botNamesBlue = ['Xanh - Alpha', 'Xanh - Bravo', 'Xanh - Delta'];
        const botNamesRed = ['Đỏ - Reaper', 'Đỏ - Phantom', 'Đỏ - Shadow', 'Đỏ - Viper'];

        // Sinh Bot cho Đội Xanh
        const blueBotCount = playerTeam === 'blue' ? (teamSize - 1) : teamSize;
        for (let i = 0; i < blueBotCount; i++) {
            const spawnPos = this.spawnPointsBlue[i % this.spawnPointsBlue.length];
            const name = botNamesBlue[i] || `Xanh ${i + 1}`;
            const role = botRoles[i % botRoles.length];
            const bot = new TDMBot(`bot_blue_${i + 1}`, name, 'blue', role, spawnPos, this.game, this);
            this.bots.push(bot);
            this.teamBlue.push(bot.remote);
        }

        // Sinh Bot cho Đội Đỏ
        const redBotCount = playerTeam === 'red' ? (teamSize - 1) : teamSize;
        for (let i = 0; i < redBotCount; i++) {
            const spawnPos = this.spawnPointsRed[i % this.spawnPointsRed.length];
            const name = botNamesRed[i] || `Đỏ ${i + 1}`;
            const role = botRoles[(i + 1) % botRoles.length];
            const bot = new TDMBot(`bot_red_${i + 1}`, name, 'red', role, spawnPos, this.game, this);
            this.bots.push(bot);
            this.teamRed.push(bot.remote);
        }

        // Cập nhật giao diện TDM HUD
        this.game.ui?.showTDMScoreboard?.(this.scoreBlue, this.scoreRed, this.targetKills);
        this.game.ui?.showBanner?.('TRẬN ĐẤU ĐỐI KHÁNG 4V4 BẮT ĐẦU! CHẠM MỐC 20 MẠNG ĐỂ THẮNG!');
        sounds.play('horn', { volume: 0.85 });
    }

    attachPlayerTeamIndicator(player) {
        if (!player.mesh) return;
        if (this.playerTeamRing) {
            player.mesh.remove(this.playerTeamRing);
        }
        const color = player.team === 'blue' ? 0x38bdf8 : 0xef4444;
        const ringGeo = new THREE.RingGeometry(0.58, 0.76, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.playerTeamRing = new THREE.Mesh(ringGeo, ringMat);
        this.playerTeamRing.position.y = 0.05;
        player.mesh.add(this.playerTeamRing);
    }

    getRandomSpawnPoint(team) {
        const list = team === 'blue' ? this.spawnPointsBlue : this.spawnPointsRed;
        const idx = Math.floor(Math.random() * list.length);
        const base = list[idx];
        const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
        return base.clone().add(offset);
    }

    update(delta) {
        if (this.state !== 'ACTIVE') return;

        this.matchTimer += delta;

        // Cập nhật từng Bot AI
        const allEntities = [...this.teamBlue, ...this.teamRed];
        for (let i = 0; i < this.bots.length; i++) {
            this.bots[i].update(delta, allEntities);
        }

        // Quản lý đếm ngược hồi sinh cho người chơi chính
        const player = this.game.player;
        if (player.isDead) {
            this.playerRespawnTimer += delta;
            const remaining = Math.max(0, 3.0 - this.playerRespawnTimer);
            this.game.ui?.showTDMRespawnCountdown?.(Math.ceil(remaining));

            if (this.playerRespawnTimer >= 3.0) {
                this.respawnEntity(player);
                this.playerRespawnTimer = 0;
            }
        }
    }

    /**
     * Xử lý khi một thực thể (Player hoặc Bot) bị tiêu diệt
     */
    onEntityKilled(victim, killer) {
        if (this.state !== 'ACTIVE' || !victim) return;

        // Cộng điểm cho phe hạ gục
        if (victim.team === 'blue') {
            this.scoreRed++;
        } else if (victim.team === 'red') {
            this.scoreBlue++;
        }

        // Cập nhật giao diện tỷ số
        this.game.ui?.updateTDMScore?.(this.scoreBlue, this.scoreRed, this.targetKills);

        // Hiển thị thông báo Killfeed
        const killerName = killer?.name || 'Chiến binh';
        const victimName = victim.name || (victim === this.game.player ? 'Bạn' : 'Chiến binh');
        const isKillerFriendly = (killer?.team || killer?.owner?.team) === this.playerTeam;
        this.game.ui?.addTDMKillFeed?.(killerName, victimName, isKillerFriendly);

        // Âm thanh hạ gục
        if (killer === this.game.player) {
            sounds.playHitMarker(true);
            this.game.score += 200;
            this.game.addCoins(50);
        } else {
            sounds.play('land', { volume: 0.6 });
        }

        // Kiểm tra điều kiện thắng
        if (this.scoreBlue >= this.targetKills || this.scoreRed >= this.targetKills) {
            const winner = this.scoreBlue >= this.targetKills ? 'blue' : 'red';
            this.endMatch(winner);
        }
    }

    /**
     * Hồi sinh một thực thể tại căn cứ đội nhà
     */
    respawnEntity(entity) {
        if (!entity) return;

        const spawnPos = this.getRandomSpawnPoint(entity.team);
        entity.position.copy(spawnPos);
        entity.health = entity.maxHealth || 100;
        entity.shield = entity.maxShield || 100;
        entity.isDead = false;
        entity.isDowned = false;
        entity.invulnerability = 1.5;

        if (entity === this.game.player) {
            if (entity.model) {
                entity.model.rotation.x = 0;
                entity.model.position.y = entity.position.y;
            }
            entity.playAnimation?.('idle', 0.1);
            entity.setInputEnabled?.(true);
            this.game.ui?.hideTDMRespawnCountdown?.();
            this.game.ui?.showPickupAlert('ĐÃ HỒI SINH! (1.5S KHIÊN BẤT TỬ)');
            sounds.play('powerup', { volume: 0.9 });
        }
    }

    endMatch(winningTeam) {
        this.state = 'MATCH_OVER';
        const isVictory = winningTeam === this.playerTeam;

        if (isVictory) {
            sounds.play('victory', { volume: 1.0 });
            this.game.addCoins(300);
        } else {
            sounds.play('gameover', { volume: 0.9 });
        }

        this.game.ui?.showTDMMatchResult?.({
            isVictory,
            winningTeam,
            playerTeam: this.playerTeam,
            scoreBlue: this.scoreBlue,
            scoreRed: this.scoreRed,
            onRestart: () => this.startMatch(this.playerTeam, 4),
            onHome: () => this.game.returnToMenu()
        });
    }

    cleanup() {
        this.state = 'IDLE';

        // Xóa tất cả các Bot khỏi scene
        for (let i = 0; i < this.bots.length; i++) {
            const bot = this.bots[i];
            if (bot.teamRing && bot.remote.mesh) {
                bot.remote.mesh.remove(bot.teamRing);
            }
            this.game.removeCoopPlayer(bot.id);
        }
        this.bots = [];
        this.teamBlue = [];
        this.teamRed = [];

        if (this.playerTeamRing && this.game.player.mesh) {
            this.game.player.mesh.remove(this.playerTeamRing);
            this.playerTeamRing = null;
        }

        this.game.ui?.hideTDMScoreboard?.();
        this.game.ui?.hideTDMRespawnCountdown?.();
        this.game.ui?.hideTDMMatchResult?.();
    }
}
