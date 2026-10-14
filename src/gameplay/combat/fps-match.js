// Independent FPS match rules and bot AI. Do not inherit TDM gameplay.
import * as THREE from 'three';
import { sounds } from '../../audio/audio.js?v=63';
import { WEAPON_CONFIGS } from './weapons.js';

// Danh sách trang bị súng đa dạng cho các bot
const BOT_WEAPON_POOL = ['repeater', 'scatter', 'sniper', 'blaster_c', 'carbine'];

// Tái sử dụng các Vector3 tạm thời để triệt tiêu Garbage Collection churn gây khựng/giật khung hình
const _th_toEnemy = new THREE.Vector3();
const _th_strafeDir = new THREE.Vector3();
const _th_shootOrigin = new THREE.Vector3();
const _th_shootTarget = new THREE.Vector3();
const _th_toPatrol = new THREE.Vector3();

/**
 * Controller điều khiển từng Bot AI trong trận đối kháng FPS
 */
export class FPSBot {
    constructor(id, name, team, characterId, spawnPos, game, fpsManager) {
        this.id = id;
        this.name = name;
        this.team = team;
        this.characterId = characterId;
        this.game = game;
        this.fpsManager = fpsManager;

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
        this.remote.th_kills = 0;
        this.remote.th_deaths = 0;
        this.remote.th_score = 0;

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

        // Nhịp quét AI có điều tiết (8-10 Hz) để chống nghẽn CPU và raycast dồn dập
        this.th_scanTimer = Math.random() * 0.1;
        this.th_targetEnemy = null;

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
        const landmarks = this.game?.arena?.patrolPoints;
        if (landmarks?.length) {
            const candidates = landmarks.filter(point => point.distanceTo(this.remote.position) > 5);
            this.patrolTarget.copy(candidates[Math.floor(Math.random() * candidates.length)] || landmarks[0]);
            this.patrolPath = null;
            this.patrolPathTimer = 0;
            return;
        }
        // Tuần tra chiến thuật dọc theo 3 làn đường chính (Mid, Long A, Site B)
        const laneChoice = Math.random();
        let targetX = 0;
        let targetZ = (Math.random() - 0.5) * 24;

        if (laneChoice < 0.35) {
            // Làn 1: Cứ điểm A & Long A
            targetX = -12 + (Math.random() - 0.5) * 6;
        } else if (laneChoice < 0.70) {
            // Làn 2: Trục đường Mid
            targetX = (Math.random() - 0.5) * 4;
        } else {
            // Làn 3: Cứ điểm B & B Tunnels
            targetX = 14 + (Math.random() - 0.5) * 6;
        }

        this.patrolTarget.set(targetX, 0, targetZ);
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
            this.fpsManager.onEntityKilled(this.remote, attacker);
        }
    }

    moveBot(dx, dz) {
        if (this.game?.arena?.moveCharacter) {
            this.game.arena.moveCharacter(this.remote.position, dx, dz, 0.45);
        } else {
            this.remote.position.x += dx;
            this.remote.position.z += dz;
        }
    }

    update(delta, opponents = []) {
        if (this.remote.isDead) {
            this.respawnTimer += delta;
            this.remote.moving = false;
            this.th_targetEnemy = null;
            if (this.respawnTimer >= 3.0) {
                this.fpsManager.respawnEntity(this.remote);
                this.respawnTimer = 0;
            }
            return;
        }

        // Đếm ngược thời gian khiên bất tử
        if (this.remote.invulnerability > 0) {
            this.remote.invulnerability = Math.max(0, this.remote.invulnerability - delta);

        }

        this.shootCooldown = Math.max(0, this.shootCooldown - delta);
        this.th_scanTimer = (this.th_scanTimer || 0) - delta;

        // 1. Quét tìm mục tiêu có điều tiết (8-10 Hz) để tránh bão hòa raycast CPU
        let nearestEnemy = this.th_targetEnemy;
        if (nearestEnemy && (nearestEnemy.isDead || nearestEnemy.position.distanceTo(this.remote.position) > 34.0)) {
            nearestEnemy = null;
            this.th_targetEnemy = null;
        }

        if (this.th_scanTimer <= 0 || !nearestEnemy) {
            this.th_scanTimer = 0.11 + Math.random() * 0.03;
            let minDist = 32.0;
            nearestEnemy = null;

            for (let i = 0; i < opponents.length; i++) {
                const opp = opponents[i];
                if (!opp || opp.isDead || opp.team === this.team) continue;
                const d = opp.position.distanceTo(this.remote.position);
                if (d >= minDist) continue; // Bỏ qua ngay nếu đối thủ này xa hơn mục tiêu tối ưu hiện có

                // Chỉ tốn chi phí Raycast khi cự ly dưới 32m
                const hasLOS = this.game?.arena?.hasLineOfSight
                    ? this.game.arena.hasLineOfSight(this.remote.position, opp.position)
                    : true;

                if (!hasLOS && d > 6.5) continue;

                const effectiveDist = hasLOS ? d : d + 12.0;
                if (effectiveDist < minDist) {
                    minDist = effectiveDist;
                    nearestEnemy = opp;
                }
            }
            this.th_targetEnemy = nearestEnemy;
        }

        // 2. Hành vi tác chiến (Không tạo rác Vector3 mới)
        if (nearestEnemy) {
            _th_toEnemy.subVectors(nearestEnemy.position, this.remote.position);
            _th_toEnemy.y = 0;
            const dist = _th_toEnemy.length();

            // Xoay hướng ngắm về phía mục tiêu
            if (dist > 0.1) {
                this.remote.aimYaw = Math.atan2(_th_toEnemy.x, _th_toEnemy.z);
            }

            // Khoảng cách chiến thuật tối ưu theo vũ khí
            let idealDist = 13.0;
            const gunId = this.weaponId;
            if (gunId === 'scatter') idealDist = 6.0;
            else if (gunId === 'sniper') idealDist = 20.0;
            else if (gunId === 'blaster_c') idealDist = 9.0;

            if (dist > 0.001) {
                _th_toEnemy.multiplyScalar(1 / dist);
            }
            const moveSpeed = 5.2;

            if (dist > idealDist + 2.5) {
                // Tiến lại gần kẻ địch
                const step = moveSpeed * delta;
                this.moveBot(_th_toEnemy.x * step, _th_toEnemy.z * step);
                this.remote.moving = true;
            } else if (dist < idealDist - 2.5) {
                // Lùi lại để giữ cự ly an toàn
                const step = -moveSpeed * 0.8 * delta;
                this.moveBot(_th_toEnemy.x * step, _th_toEnemy.z * step);
                this.remote.moving = true;
            } else {
                // Di chuyển né đạn qua hai bên (Strafe không cấp phát Vector mới)
                _th_strafeDir.set(-_th_toEnemy.z, 0, _th_toEnemy.x);
                const strafeSign = (Math.floor(Date.now() / 1200) % 2 === 0) ? 1 : -1;
                const step = strafeSign * moveSpeed * 0.65 * delta;
                this.moveBot(_th_strafeDir.x * step, _th_strafeDir.z * step);
                this.remote.moving = true;
            }

            // Khai hỏa khi cự ly phù hợp, hết hồi chiêu và KHÔNG bị tường che khuất
            // CHỈ tính toán Raycast Line of Sight khi súng đã sẵn sàng bắn
            if (this.shootCooldown <= 0 && dist <= 28.0) {
                const canShoot = this.game?.arena?.hasLineOfSight
                    ? this.game.arena.hasLineOfSight(this.remote.position, nearestEnemy.position)
                    : true;

                if (canShoot) {
                    this.shootCooldown = 0.55 + Math.random() * 0.45;
                    if (gunId === 'scatter') this.shootCooldown = 0.95;
                    if (gunId === 'sniper') this.shootCooldown = 1.4;

                    if (!this.remote.weapons?.getMuzzlePosition?.(_th_shootOrigin)) {
                        _th_shootOrigin.copy(this.remote.position);
                        _th_shootOrigin.y += 0.68;
                    }

                    const spreadX = (Math.random() - 0.5) * 0.8;
                    const spreadZ = (Math.random() - 0.5) * 0.8;
                    _th_shootTarget.copy(nearestEnemy.position);
                    _th_shootTarget.x += spreadX;
                    _th_shootTarget.y += 0.85;
                    _th_shootTarget.z += spreadZ;

                    if (this.remote.weapons) {
                        this.remote.weapons.shoot(_th_shootOrigin, _th_shootTarget, false, true, 0.95, this.remote);
                    }
                }
            }
        } else {
            // Không có kẻ địch trong tầm: Tuần tra đến điểm chốt
            const arena = this.game?.arena;
            this.patrolPathTimer = (this.patrolPathTimer || 0) - delta;
            if (arena?.findNavigationPath && (!this.patrolPath || this.patrolPathTimer <= 0)) {
                this.patrolPath = arena.findNavigationPath(this.remote.position, this.patrolTarget, 0.5);
                this.patrolPathTimer = 1.2 + Math.random() * 0.3;
                if (!this.patrolPath.length) this.pickNewPatrolTarget();
            }
            while (this.patrolPath?.length > 1 && this.remote.position.distanceTo(this.patrolPath[0]) < 0.35) {
                this.patrolPath.shift();
            }
            const waypoint = this.patrolPath?.[0] || this.patrolTarget;
            _th_toPatrol.subVectors(waypoint, this.remote.position);
            _th_toPatrol.y = 0;
            const distPatrol = _th_toPatrol.length();

            if (this.remote.position.distanceTo(this.patrolTarget) < 1.0) {
                this.pickNewPatrolTarget();
                this.remote.moving = false;
            } else {
                _th_toPatrol.multiplyScalar(1 / Math.max(distPatrol, 0.001));
                const step = Math.min(4.2 * delta, distPatrol);
                this.moveBot(_th_toPatrol.x * step, _th_toPatrol.z * step);
                this.remote.aimYaw = Math.atan2(_th_toPatrol.x, _th_toPatrol.z);
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
export class FPSMatchManager {
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

        // Vị trí xuất phát của 2 đội ở hai đầu bản đồ trạm không gian
        this.spawnPointsBlue = [
            new THREE.Vector3(-6, 0, 23),
            new THREE.Vector3(-2, 0, 23),
            new THREE.Vector3(2, 0, 23),
            new THREE.Vector3(6, 0, 23)
        ];

        this.spawnPointsRed = [
            new THREE.Vector3(-6, 0, -23),
            new THREE.Vector3(-2, 0, -23),
            new THREE.Vector3(2, 0, -23),
            new THREE.Vector3(6, 0, -23)
        ];
    }

    get isActive() {
        return this.state === 'ACTIVE';
    }

    /**
     * Bắt đầu một trận đấu đối kháng mới
     * @param {string} playerTeam - 'blue' hoặc 'red'
     * @param {object|number} options - Tùy chọn trận đấu { fillBots: boolean, teamSize: number } hoặc số teamSize
     */
    startMatch(playerTeam = 'blue', options = {}) {
        this.cleanup();

        const fillBots = typeof options === 'boolean' ? options : (typeof options === 'object' && options !== null ? !!options.fillBots : false);
        const teamSize = (typeof options === 'object' && options?.teamSize) || (typeof options === 'number' ? options : 4);
        this.lastFillBots = fillBots;

        this.state = 'ACTIVE';
        this.playerTeam = playerTeam;
        this.scoreBlue = 0;
        this.scoreRed = 0;
        this.matchTimer = 0;
        this.playerRespawnTimer = 0;
        this.targetKills = fillBots ? 20 : 10;

        const player = this.game.player;
        player.team = playerTeam;
        player.health = player.maxHealth;
        player.shield = player.maxShield;
        player.isDead = false;
        player.isDowned = false;
        player.invulnerability = 2.0;
        player.th_kills = 0;
        player.th_deaths = 0;
        player.th_score = 0;

        // Gắn vòng hào quang nhận diện phe cho người chơi chính
        this.attachPlayerTeamIndicator(player);

        // Đặt người chơi về điểm xuất phát của đội mình
        const playerSpawn = this.getRandomSpawnPoint(playerTeam);
        player.position.copy(playerSpawn);
        player.aimYaw = playerTeam === 'blue' ? Math.PI : 0;

        this.teamBlue = [];
        this.teamRed = [];

        if (playerTeam === 'blue') {
            this.teamBlue.push(player);
        } else {
            this.teamRed.push(player);
        }

        // Đưa các người chơi Co-op thật (remotePlayers) vào đúng đội của họ và reset chỉ số trận mới
        for (const [id, remote] of this.game.remotePlayers) {
            remote.th_kills = 0;
            remote.th_deaths = 0;
            remote.th_score = 0;
            if (remote.isBot) continue;
            const team = remote.team || (playerTeam === 'blue' ? 'red' : 'blue');
            remote.team = team;
            if (team === 'blue') {
                this.teamBlue.push(remote);
            } else {
                this.teamRed.push(remote);
            }
            this.attachPlayerTeamIndicator(remote);
        }

        // Chỉ tạo Bot khi có cờ fillBots = true (bấm nút phân bổ Bot chủ động)
        if (fillBots && (!this.game.network.active || this.game.network.host)) {
            const botRoles = ['soldier', 'police', 'cyborg', 'specops'];
            const botNamesBlue = ['Xanh - Alpha', 'Xanh - Bravo', 'Xanh - Delta'];
            const botNamesRed = ['Đỏ - Reaper', 'Đỏ - Phantom', 'Đỏ - Shadow', 'Đỏ - Viper'];

            // Sinh Bot bù cho Đội Xanh
            const blueNeeded = Math.max(0, teamSize - this.teamBlue.length);
            for (let i = 0; i < blueNeeded; i++) {
                const spawnPos = this.spawnPointsBlue[i % this.spawnPointsBlue.length];
                const name = botNamesBlue[i] || `Xanh Bot ${i + 1}`;
                const role = botRoles[i % botRoles.length];
                const bot = new FPSBot(`bot_fps_blue_${i + 1}`, name, 'blue', role, spawnPos, this.game, this);
                this.bots.push(bot);
                this.teamBlue.push(bot.remote);
            }

            // Sinh Bot bù cho Đội Đỏ
            const redNeeded = Math.max(0, teamSize - this.teamRed.length);
            for (let i = 0; i < redNeeded; i++) {
                const spawnPos = this.spawnPointsRed[i % this.spawnPointsRed.length];
                const name = botNamesRed[i] || `Đỏ Bot ${i + 1}`;
                const role = botRoles[(i + 1) % botRoles.length];
                const bot = new FPSBot(`bot_fps_red_${i + 1}`, name, 'red', role, spawnPos, this.game, this);
                this.bots.push(bot);
                this.teamRed.push(bot.remote);
            }
        }

        // Cập nhật giao diện FPS HUD
        this.game.ui?.showTDMScoreboard?.(this.scoreBlue, this.scoreRed, this.targetKills);
        const botStatusText = fillBots ? 'ĐÃ PHÂN BỔ BOT (4V4)' : 'KHÔNG CÓ BOT (CHỈ NGƯỜI THẬT)';
        this.game.ui?.showBanner?.(`TRẬN ĐẤU ĐỐI KHÁNG BẮT ĐẦU! ${botStatusText} · CHẠM MỐC ${this.targetKills} MẠNG ĐỂ THẮNG!`);
        sounds.play('horn', { volume: 0.85 });
    }

    attachPlayerTeamIndicator(entity) {
        if (!entity || !entity.mesh) return;
        if (entity.teamRing) {
            entity.mesh.remove(entity.teamRing);
            entity.teamRing = null;
        }
        const color = entity.team === 'blue' ? 0x38bdf8 : 0xef4444;
        const ringGeo = new THREE.RingGeometry(0.58, 0.76, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.05;
        entity.teamRing = ringMesh;
        entity.mesh.add(ringMesh);
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

        // Cập nhật từng Bot AI với danh sách cache thực thể
        if (!this._allEntities || this._allEntities.length !== (this.teamBlue.length + this.teamRed.length)) {
            this._allEntities = [...this.teamBlue, ...this.teamRed];
        }
        for (let i = 0; i < this.bots.length; i++) {
            this.bots[i].update(delta, this._allEntities);
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

        // Chống lặp hạ gục trong cùng 1 frame cho 1 thực thể
        const actualVictim = victim?.remote || victim;
        if (actualVictim._th_killedInFrame) return;
        actualVictim._th_killedInFrame = true;
        setTimeout(() => { actualVictim._th_killedInFrame = false; }, 400);

        // Cộng điểm cho phe hạ gục
        if (actualVictim.team === 'blue') {
            this.scoreRed++;
        } else if (actualVictim.team === 'red') {
            this.scoreBlue++;
        }

        // Xác định killer duy nhất và cộng đúng 1 lần (loại bỏ hoàn toàn bug cộng đúp 2 kill)
        let actualKiller = null;
        if (killer === this.game.player || killer?.remote === this.game.player) {
            actualKiller = this.game.player;
        } else if (killer?.remote) {
            actualKiller = killer.remote;
        } else if (killer) {
            actualKiller = killer;
        }

        if (actualKiller) {
            actualKiller.th_kills = (actualKiller.th_kills || 0) + 1;
            actualKiller.th_score = (actualKiller.th_score || 0) + 100;
        }

        // Tăng đúng 1 lần tử trận cho nạn nhân
        if (actualVictim) {
            actualVictim.th_deaths = (actualVictim.th_deaths || 0) + 1;
        }

        // Cập nhật giao diện tỷ số
        this.game.ui?.updateTDMScore?.(this.scoreBlue, this.scoreRed, this.targetKills);
        this.game.ui?.th_updateTabScoreboardIfOpen?.(this);

        // Hiển thị thông báo Killfeed
        const killerName = killer?.name || (killer === this.game.player ? 'Bạn' : 'Chiến binh');
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
        entity.spawnSeq = (entity.spawnSeq || 0) + 1;

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
            this.game.ui?.startWeaponSelectCountdown?.(10);
            sounds.play('powerup', { volume: 0.9 });
        }
    }

    endMatch(winningTeam) {
        this.state = 'MATCH_OVER';
        if (this.game.firstPersonView?.active) this.game.player.setInputEnabled(false);
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
            canRestart: !this.game.network.active || this.game.network.host,
            onRestart: () => {
                if (this.game.network.active) { this.game.restartGame(); return; }
                this.startMatch(this.playerTeam, { fillBots: this.lastFillBots, teamSize: 4 });
                if (this.game.firstPersonView?.active) this.game.player.setInputEnabled(true);
            },
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

        if (this.game.player) {
            this.game.player.th_kills = 0;
            this.game.player.th_deaths = 0;
            this.game.player.th_score = 0;
            if (this.game.player.teamRing && this.game.player.mesh) {
                this.game.player.mesh.remove(this.game.player.teamRing);
                this.game.player.teamRing = null;
            }
        }

        // Dọn sạch vòng hào quang đội và chỉ số của các remote player
        for (const remote of this.game.remotePlayers.values()) {
            remote.th_kills = 0;
            remote.th_deaths = 0;
            remote.th_score = 0;
            if (remote.teamRing && remote.mesh) {
                remote.mesh.remove(remote.teamRing);
                remote.teamRing = null;
            }
        }

        this.game.ui?.hideTDMScoreboard?.();
        this.game.ui?.hideTDMRespawnCountdown?.();
        this.game.ui?.hideTDMMatchResult?.();
        this.game.ui?.th_hideTabScoreboard?.();
    }

    /**
     * Trả về dữ liệu chi tiết hai phe phục vụ Bảng Điểm Tab Xếp Hạng K/D/Score
     */
    getScoreboardData() {
        const formatTeam = (teamList, teamColor) => {
            return (teamList || []).map(ent => {
                const kills = ent.th_kills || 0;
                const deaths = ent.th_deaths || 0;
                const score = ent.th_score !== undefined ? ent.th_score : (kills * 100);
                const kdRatio = deaths === 0 ? kills.toFixed(1) : (kills / deaths).toFixed(1);
                const isLocal = ent === this.game.player;
                const name = isLocal ? 'Bạn (Chiến binh)' : (ent.name || 'Chiến binh');
                const weapon = ent.weapons?.getCurrentWeapon?.() || ent.weapons?.currentGun;
                const weaponName = weapon?.name || 'Súng chiến thuật';
                return {
                    id: ent.id || (isLocal ? 'local_player' : 'bot'),
                    name,
                    isLocal,
                    team: teamColor,
                    isDead: !!ent.isDead,
                    kills,
                    deaths,
                    score,
                    kd: kdRatio,
                    weaponName
                };
            }).sort((a, b) => (b.score !== a.score) ? (b.score - a.score) : (b.kills - a.kills));
        };

        return {
            mode: 'FPS',
            playerTeam: this.playerTeam,
            scoreBlue: this.scoreBlue,
            scoreRed: this.scoreRed,
            targetKills: this.targetKills,
            matchTimeFormatted: this.getFormattedMatchTime(),
            teamBlue: formatTeam(this.teamBlue, 'blue'),
            teamRed: formatTeam(this.teamRed, 'red')
        };
    }

    getFormattedMatchTime() {
        const sec = Math.floor(this.matchTimer || 0);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

