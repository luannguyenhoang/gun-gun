import { CHARACTER_CONFIGS, normalizeCharacter } from '../gameplay/player/characters.js';
import { getStartingWeapon } from '../gameplay/combat/weapons.js';

// Danh sách mẹo chiến thuật ngẫu nhiên chuẩn bị vào trận
const TH_LOADING_TIPS = [
    'Mẹo: Bấm phím R để nạp đạn nhanh, phím Space để lộn nhào né đạn hiểm.',
    'Mẹo: Bấm phím B trong 10 giây đầu trận để mở kho vũ khí và đổi trang bị.',
    'Mẹo: Nhấp chuột phải để ngắm bắn (ADS), giúp mở rộng tầm nhìn chiến thuật.',
    'Mẹo: Tận dụng các vách ngăn Connector và cổng Laser để phục kích đối phương.',
    'Mẹo: Di chuyển cùng đồng đội để bọc lót hỏa lực và hồi sinh nhanh chóng.',
    'Mẹo: Đội nào chạm mốc 20 mạng hạ gục trước sẽ giành chiến thắng chung cuộc.'
];

const TH_MASTERY_RANKS = [
    { title: 'THÔNG THẠO 7', level: '7' },
    { title: 'BẬC THÁCH ĐẤU', level: 'I' },
    { title: 'BẬC CAO THỦ', level: 'II' },
    { title: 'HUY CHƯƠNG KIM CƯƠNG', level: 'III' }
];

/**
 * Màn hình chờ tải trận đối kháng 4v4 phong cách Liên Minh Huyền Thoại (LoL Versus Loading Screen)
 */
export class TH_VersusLoadingScreen {
    constructor() {
        this.container = document.getElementById('th-versus-loading-screen');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'th-versus-loading-screen';
            this.container.className = 'th_versus-screen';
            this.container.style.display = 'none';
            document.body.appendChild(this.container);
        }
        this.isActive = false;
        this.progress = 0;
        this.animFrame = null;
    }

    /**
     * Bắt đầu hiển thị màn hình chờ tải trận 4v4
     * @param {object} options
     * @param {Array} options.teamBlue - Danh sách người chơi/bot Đội Xanh (4 người)
     * @param {Array} options.teamRed - Danh sách người chơi/bot Đội Đỏ (4 người)
     * @param {string} options.playerTeam - Phe người chơi chính ('blue' hoặc 'red')
     * @param {Function} options.onComplete - Callback kích hoạt khi tải xong 100%
     */
    /**
     * Bắt đầu hiển thị màn hình chờ tải trận 4v4
     * @param {object} options
     * @param {Array} options.teamBlue - Danh sách người chơi/bot Đội Xanh (4 người)
     * @param {Array} options.teamRed - Danh sách người chơi/bot Đội Đỏ (4 người)
     * @param {string} options.playerTeam - Phe người chơi chính ('blue' hoặc 'red')
     * @param {Function} options.preloadTask - Tác vụ tải tài nguyên thực tế async (onProgress) => Promise
     * @param {Function} options.onComplete - Callback kích hoạt khi tải xong 100%
     */
    start({ teamBlue = [], teamRed = [], playerTeam = 'blue', preloadTask = null, onComplete = null } = {}) {
        this.isActive = true;
        this.progress = 0;
        this.onComplete = onComplete;

        // Chuẩn hóa danh sách 4 người cho mỗi đội
        const fullBlue = this._normalizeTeam(teamBlue, 'blue', ['Alpha', 'Bravo', 'Delta', 'Echo']);
        const fullRed = this._normalizeTeam(teamRed, 'red', ['Reaper', 'Phantom', 'Shadow', 'Viper']);

        const randomTip = TH_LOADING_TIPS[Math.floor(Math.random() * TH_LOADING_TIPS.length)];

        // Render cấu trúc HTML 2 hàng thẻ bài đối đầu chuẩn eSports
        this.container.innerHTML = `
            <div class="th_versus-backdrop">
                <!-- Hiệu ứng vệt sáng năng lượng nền -->
                <div class="th_versus-ambient-blue"></div>
                <div class="th_versus-ambient-red"></div>

                <div class="th_versus-layout">
                    <!-- Hàng trên: ĐỘI XANH (4 Thẻ bài) -->
                    <div class="th_versus-team-section team-blue">
                        <div class="th_versus-team-title">
                            <span class="th_team-tag blue">ĐỘI XANH</span>
                            <span class="th_team-sub">4 CHIẾN BINH PHÒNG THỦ</span>
                        </div>
                        <div class="th_versus-cards-row">
                            ${fullBlue.map((p, idx) => this._renderCardHtml(p, 'blue', idx)).join('')}
                        </div>
                    </div>

                    <!-- Thanh thông tin trung tâm trận đấu -->
                    <div class="th_versus-center-bar">
                        <div class="th_versus-match-badge">
                            <span class="th_badge-mode">ĐỐI KHÁNG 4V4</span>
                            <span class="th_badge-goal">MỤC TIÊU: 20 MẠNG CHIẾN THẮNG</span>
                        </div>
                        
                        <div class="th_versus-progress-wrapper">
                            <div class="th_versus-progress-track">
                                <div id="th-versus-main-progress" class="th_versus-progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="th_versus-progress-info">
                                <span class="th_tip-text">${randomTip}</span>
                                <span id="th-versus-main-pct" class="th_pct-text">0%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Hàng dưới: ĐỘI ĐỎ (4 Thẻ bài) -->
                    <div class="th_versus-team-section team-red">
                        <div class="th_versus-team-title">
                            <span class="th_team-tag red">ĐỘI ĐỎ</span>
                            <span class="th_team-sub">4 CHIẾN BINH TẤN CÔNG</span>
                        </div>
                        <div class="th_versus-cards-row">
                            ${fullRed.map((p, idx) => this._renderCardHtml(p, 'red', idx)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.style.display = 'flex';
        this.container.classList.remove('fade-out');
        this.container.classList.add('fade-in');

        // Khởi chạy tiến trình tải: ưu tiên nạp tài nguyên thực sự nếu có preloadTask
        if (typeof preloadTask === 'function') {
            this._runRealLoadingSequence(preloadTask);
        } else {
            this._runLoadingSequence();
        }
    }

    _normalizeTeam(team, teamColor, defaultBotNames) {
        const result = [];
        const botRoles = ['soldier', 'police', 'cyborg', 'specops'];
        const botGuns = ['repeater', 'scatter', 'sniper', 'blaster_c'];

        for (let i = 0; i < 4; i++) {
            const p = team[i];
            if (p) {
                result.push({
                    name: p.name || `Chiến binh ${i + 1}`,
                    character: p.character || botRoles[i % botRoles.length],
                    weaponId: p.weaponId || p.weapons?.startingWeaponId || botGuns[i % botGuns.length],
                    isHost: !!p.is_host || p.id === 'host',
                    isLocal: p.isLocal || p.id === 'host' || p.is_local,
                    isBot: !!p.isBot,
                    team: teamColor
                });
            } else {
                result.push({
                    name: `${teamColor === 'blue' ? 'Xanh' : 'Đỏ'} - ${defaultBotNames[i] || 'Bot'}`,
                    character: botRoles[i % botRoles.length],
                    weaponId: botGuns[i % botGuns.length],
                    isHost: false,
                    isLocal: false,
                    isBot: true,
                    team: teamColor
                });
            }
        }
        return result;
    }

    _renderCardHtml(player, teamColor, index) {
        const charKey = normalizeCharacter(player.character);
        const charCfg = CHARACTER_CONFIGS[charKey] || CHARACTER_CONFIGS.police;
        const weapon = getStartingWeapon(player.weaponId || 'repeater');
        const roleText = player.isLocal ? 'BẠN (CHỦ PHÒNG)' : (player.isBot ? 'CHIẾN BINH BOT' : 'ĐỒNG ĐỘI');
        const rank = TH_MASTERY_RANKS[(index + (teamColor === 'red' ? 2 : 0)) % TH_MASTERY_RANKS.length];
        const cardId = `th-card-${teamColor}-${index}`;

        // Preview ảnh chân dung nhân vật chính xác từ cấu hình thật trong thư mục assets/previews/
        const charImg = charCfg.preview || 'assets/previews/character-male-d.png';
        const weaponImg = weapon?.icon || (weapon?.modelFile ? `assets/previews/${weapon.modelFile.replace('.glb', '.png')}` : 'assets/previews/kenney-blaster/blaster-a.png');

        return `
            <div id="${cardId}" class="th_versus-card ${teamColor} ${player.isLocal ? 'is-local-player' : ''}">
                <div class="th_card-inner">
                    <!-- Khung ảnh nhân vật phong cách chân dung lớn -->
                    <div class="th_card-art-container">
                        <img class="th_card-art-img" src="${charImg}" alt="${charCfg.label}" onerror="this.src='assets/previews/character-male-d.png'">
                        <div class="th_card-art-overlay"></div>
                    </div>

                    <!-- Huy hiệu danh hiệu & Cấp bậc thông thạo -->
                    <div class="th_card-rank-badge">
                        <span class="th_rank-tag">${rank.title}</span>
                    </div>

                    <!-- Khối thông tin người chơi & Vũ khí -->
                    <div class="th_card-info">
                        <div class="th_card-player-name" title="${player.name}">${player.name}</div>
                        <div class="th_card-player-role">${roleText}</div>
                        
                        <!-- Vũ khí chính được mang vào trận -->
                        <div class="th_card-weapon-box">
                            <img class="th_card-weapon-img" src="${weaponImg}" alt="${weapon.name}" onerror="this.style.display='none'">
                            <span class="th_card-weapon-name">${weapon.name}</span>
                        </div>
                    </div>

                    <!-- Thanh % tiến trình tải của từng người chơi -->
                    <div class="th_card-loading-status">
                        <div class="th_card-status-bar">
                            <div class="th_card-status-fill" style="width: 0%"></div>
                        </div>
                        <span class="th_card-status-pct">0%</span>
                    </div>
                </div>
            </div>
        `;
    }

    _updateProgressVisual(currentPct) {
        const mainBar = document.getElementById('th-versus-main-progress');
        const mainPct = document.getElementById('th-versus-main-pct');
        const cardFills = this.container.querySelectorAll('.th_card-status-fill');
        const cardPcts = this.container.querySelectorAll('.th_card-status-pct');

        if (mainBar) mainBar.style.width = `${currentPct}%`;
        if (mainPct) mainPct.textContent = `${currentPct}%`;

        cardFills.forEach((fill, idx) => {
            const jitter = ((idx * 7) % 11) - 5;
            let cPct = currentPct >= 98 ? 100 : Math.max(0, Math.min(100, currentPct + jitter));
            fill.style.width = `${cPct}%`;
            if (cardPcts[idx]) cardPcts[idx].textContent = `${cPct}%`;
        });
    }

    /**
     * Tiến trình nạp tài nguyên thực tế song song
     */
    async _runRealLoadingSequence(preloadTask) {
        let displayPct = 0;
        let targetPct = 10;
        let isTaskDone = false;

        const timer = setInterval(() => {
            if (!this.isActive) {
                clearInterval(timer);
                return;
            }
            if (displayPct < targetPct) {
                displayPct += Math.max(1, Math.round((targetPct - displayPct) * 0.2));
                this._updateProgressVisual(displayPct);
            }
        }, 30);

        try {
            await preloadTask((pct) => {
                targetPct = Math.max(targetPct, Math.min(96, Math.round(pct)));
            });
            isTaskDone = true;
            targetPct = 100;
        } catch (err) {
            console.warn('[TH_VersusLoadingScreen] Lỗi khi nạp trước tài nguyên:', err);
            targetPct = 100;
            isTaskDone = true;
        }

        const checkFinish = () => {
            if (!this.isActive) return;
            if (displayPct < 100) {
                displayPct = Math.min(100, displayPct + 4);
                this._updateProgressVisual(displayPct);
                requestAnimationFrame(checkFinish);
            } else {
                clearInterval(timer);
                setTimeout(() => this.finish(), 300);
            }
        };
        requestAnimationFrame(checkFinish);
    }

    _runLoadingSequence() {
        const startTime = performance.now();
        const duration = 2200; // 2.2 giây mượt mà

        const updateFrame = (now) => {
            if (!this.isActive) return;

            const elapsed = now - startTime;
            const rawProgress = Math.min(1.0, elapsed / duration);
            const easeProgress = 1 - (1 - rawProgress) * (1 - rawProgress);
            const currentPct = Math.round(easeProgress * 100);

            this._updateProgressVisual(currentPct);

            if (rawProgress < 1.0) {
                this.animFrame = requestAnimationFrame(updateFrame);
            } else {
                setTimeout(() => {
                    this.finish();
                }, 280);
            }
        };

        this.animFrame = requestAnimationFrame(updateFrame);
    }

    /**
     * Hoàn tất và ẩn màn hình tải trận
     */
    finish() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.animFrame) cancelAnimationFrame(this.animFrame);

        this.container.classList.remove('fade-in');
        this.container.classList.add('fade-out');

        setTimeout(() => {
            this.container.style.display = 'none';
            this.container.classList.remove('fade-out');
            if (typeof this.onComplete === 'function') {
                this.onComplete();
                this.onComplete = null;
            }
        }, 400);
    }
}
