import { sounds } from '../audio/audio.js?v=52';
import { CharacterShowroom } from './showroom.js?v=51';
import { CHARACTER_CONFIGS, isCharacterUnlocked } from '../gameplay/player/characters.js';
import { getStartingWeapon } from '../gameplay/combat/weapons.js?v=32';
import { initAuth, signIn, signUp, signInWithGoogle, signOut, onAuthStateChange, applyProfileProgressToGame, resetGameProgressToGuest, refreshCurrentProfile } from '../network/auth.js?v=49';
import { listPublicRooms } from '../network/supabase-room.js?v=3';
import {
    initFriendsSystem,
    cleanupFriendsSystem,
    searchPlayers,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriendship,
    sendGameInvite,
    isUserOnline,
    onPresenceUpdate,
    onFriendsUpdate,
    onGameInvite,
    getFriendsList,
    getPendingRequests
} from '../network/friends.js?v=2';

export class HomeMenu {
    constructor(game) {
        this.game = game;
        // Scale the reference composition as a whole, including type and icons.
        const shell = document.querySelector('.home-shell');
        const fitLobby = () => {
            const scale = window.innerWidth > 700 ? Math.min(window.innerWidth / 1120, window.innerHeight / 640, 1.4) : 1;
            shell.style.setProperty('--reference-scale', scale);
            shell.style.setProperty('--reference-width', window.innerWidth / scale + 'px');
            shell.style.setProperty('--reference-height', window.innerHeight / scale + 'px');
        };
        fitLobby();
        window.addEventListener('resize', fitLobby);
        this.dialog = document.getElementById('home-dialog');
        this.showroom = new CharacterShowroom(game);
        this.currentRoomCode = '';
        this.pendingInviteFriendId = null;
        this.incomingRoomCode = '';
        this.titles = { friends: 'BẠN BÈ & PHÒNG CHƠI', profile: 'HỒ SƠ & TÀI KHOẢN', characters: 'CHỌN NHÂN VẬT', help: 'CÁCH CHƠI', settings: 'CÀI ĐẶT', records: 'KỶ LỤC CỦA BẠN' };
        document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => this.open(button.dataset.open)));
        this.dialog.querySelector('.close-dialog').addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', event => { if (event.target === this.dialog) { const r = this.dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) this.dialog.close(); } });
        
        // Khởi tạo tên người chơi từ bộ nhớ
        game.roomName.value = localStorage.getItem('arena_player_name') || 'Người chơi';
        document.getElementById('profile-name').textContent = game.roomName.value.toUpperCase();

        // 1. Nút lưu tên nhân vật (khi đã đăng nhập)
        document.getElementById('save-profile')?.addEventListener('click', () => {
            const name = game.roomName.value.trim() || 'Người chơi';
            game.roomName.value = name;
            localStorage.setItem('arena_player_name', name);
            document.getElementById('profile-name').textContent = name.toUpperCase();
            this.dialog.close();
        });
        game.roomName?.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                document.getElementById('save-profile')?.click();
            }
        });

        // Quản lý chọn Chế độ chơi (Tabs nhanh + Mode Selector Dialog: SURVIVAL vs TDM)
        this.modeCard = document.querySelector('.mode-card');
        this.modeDialog = document.getElementById('mode-selector-dialog');
        this.modeTitleStrong = document.querySelector('.mode-titles strong');
        this.modeTitleSmall = document.querySelector('.mode-titles small');
        this.tabModeSurvival = document.getElementById('mode-tab-survival');
        this.tabModeTDM = document.getElementById('mode-tab-tdm');
        this.quickTeamSection = document.getElementById('tdm-quick-team');
        this.quickTeamBtns = document.querySelectorAll('.quick-team-btn');
        this.quickBotSection = document.getElementById('tdm-bot-bar');
        this.btnBotToggle = document.getElementById('tdm-bot-toggle-btn');
        this.btnStart = document.getElementById('btn-start');
        const popoverBotBtn = document.getElementById('th-popover-bot-toggle');
        const savedMode = localStorage.getItem('th_saved_game_mode');
        this.selectedMode = (savedMode === 'TDM' || savedMode === 'FPS_SOLO' || savedMode === 'SURVIVAL') ? savedMode : 'SURVIVAL';
        this.selectedTeam = localStorage.getItem('th_saved_tdm_team') || 'blue';
        const savedBots = localStorage.getItem('th_saved_tdm_fill_bots');
        this.game.soloFillBots = savedBots !== null ? (savedBots === 'true') : true; // Mặc định BẬT Bot cho TDM

        const syncBotUI = () => {
            const hasBots = !!this.game.soloFillBots;
            if (popoverBotBtn) {
                popoverBotBtn.classList.toggle('active', hasBots);
                popoverBotBtn.textContent = hasBots ? 'BỔ SUNG BOT 4V4: BẬT' : 'BỔ SUNG BOT 4V4: TẮT';
            }
            if (this.btnBotToggle) {
                this.btnBotToggle.classList.toggle('active', hasBots);
                this.btnBotToggle.textContent = hasBots ? 'PHÂN BỔ BOT: BẬT (4V4)' : 'PHÂN BỔ BOT: TẮT';
            }
            if (this.selectedMode === 'TDM') {
                if (this.modeTitleStrong) this.modeTitleStrong.textContent = hasBots ? 'ĐỐI KHÁNG 4V4' : 'ĐỐI KHÁNG TDM';
                const badgesContainer = document.getElementById('mode-badges-container');
                if (badgesContainer) {
                    badgesContainer.innerHTML = `
                        <span class="mode-badge-pill ${this.selectedTeam === 'blue' ? 'blue' : 'red'}">${this.selectedTeam === 'blue' ? 'ĐỘI XANH' : 'ĐỘI ĐỎ'}</span>
                        <span class="mode-badge-pill ${hasBots ? 'green' : 'gray'}">${hasBots ? 'CÓ BOT AI' : 'KHÔNG BOT'}</span>
                    `;
                }
            }
        };

        const toggleBots = () => {
            this.game.soloFillBots = !this.game.soloFillBots;
            localStorage.setItem('th_saved_tdm_fill_bots', this.game.soloFillBots);
            if (this.game.network?.active && this.game.network.host) {
                this.game.network.toggleFillBots();
            }
            syncBotUI();
        };

        this.syncBotUI = syncBotUI;
        this.syncBotUI();

        popoverBotBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleBots(); });
        this.btnBotToggle?.addEventListener('click', (e) => { e.stopPropagation(); toggleBots(); });

        const applyMode = (mode, team) => {
            this.selectedMode = mode;
            this.selectedTeam = team;
            this.game.selectedGameMode = mode;
            this.game.selectedTDMTeam = team;
            localStorage.setItem('th_saved_game_mode', mode);
            if (team) localStorage.setItem('th_saved_tdm_team', team);
            this.game.switchArena?.(mode === 'FPS_SOLO' ? 'TDM' : mode);
            document.getElementById('mode-tab-fps')?.classList.toggle('active', mode === 'FPS_SOLO');

            // 1. Cập nhật trạng thái các Tab chọn nhanh
            if (this.tabModeSurvival) this.tabModeSurvival.classList.toggle('active', mode === 'SURVIVAL');
            if (this.tabModeTDM) this.tabModeTDM.classList.toggle('active', mode === 'TDM');

            // 2. Ẩn/Hiện khu vực chọn phe nhanh và nút phân bổ Bot
            if (this.quickTeamSection) {
                this.quickTeamSection.style.display = mode === 'TDM' ? 'flex' : 'none';
            }
            if (this.quickBotSection) {
                this.quickBotSection.style.display = mode === 'TDM' ? 'flex' : 'none';
            }

            // 3. Cập nhật nút chọn phe nhanh
            this.quickTeamBtns.forEach(btn => {
                const btnTeam = btn.dataset.team || 'blue';
                btn.classList.toggle('active', btnTeam === team);
            });

            // 4. Cập nhật trạng thái trong Popover danh sách chế độ chơi
            const popoverModeItems = document.querySelectorAll('#th-mode-select-popover .th_mode-item');
            popoverModeItems.forEach(item => {
                item.classList.toggle('active', item.dataset.mode === mode);
            });

            // Cập nhật các nút chọn phe trong popover
            const popoverTeamBtns = document.querySelectorAll('#th-mode-select-popover .th_popover-team-btn');
            popoverTeamBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tdmTeam === team);
            });

            // 5. Cập nhật các nút phe và card active trong hộp thoại modal (nếu có mở)
            const modalTeamBtns = this.modeDialog?.querySelectorAll('.team-btn');
            modalTeamBtns?.forEach(btn => {
                const btnTeam = btn.dataset.team || 'blue';
                btn.classList.toggle('active', btnTeam === team);
            });
            const modeOptionCards = this.modeDialog?.querySelectorAll('.mode-option-card');
            modeOptionCards?.forEach(card => {
                card.classList.toggle('active', card.dataset.mode === mode);
            });

            // 6. Cập nhật hiển thị trên thẻ mode-card và nút bắt đầu
            const modeIconImg = document.getElementById('mode-icon-img');
            const badgesContainer = document.getElementById('mode-badges-container');
            const subtextSolo = this.btnStart?.querySelector('.btn-subtext');
            const subtextParty = this.btnStartParty?.querySelector('.btn-subtext');

            if (subtextSolo) subtextSolo.textContent = 'CHIẾN ĐẤU SOLO';
            if (subtextParty) subtextParty.textContent = 'SẢNH CHỜ TỔ ĐỘI';

            if (mode === 'TDM') {
                const hasBots = !!this.game.soloFillBots;
                if (this.modeTitleStrong) this.modeTitleStrong.textContent = hasBots ? 'ĐỐI KHÁNG 4V4' : 'ĐỐI KHÁNG TDM';
                if (this.modeCard) {
                    this.modeCard.classList.remove('tdm-blue', 'tdm-red');
                    this.modeCard.classList.add(team === 'blue' ? 'tdm-blue' : 'tdm-red');
                }
                if (modeIconImg) modeIconImg.src = 'assets/ui/lobby/runtime/skull-purple.png';
                if (badgesContainer) {
                    badgesContainer.innerHTML = `
                        <span class="mode-badge-pill ${team === 'blue' ? 'blue' : 'red'}">${team === 'blue' ? 'ĐỘI XANH' : 'ĐỘI ĐỎ'}</span>
                        <span class="mode-badge-pill ${hasBots ? 'green' : 'gray'}">${hasBots ? 'CÓ BOT AI' : 'KHÔNG BOT'}</span>
                    `;
                }
            } else {
                if (this.modeTitleStrong) {
                    this.modeTitleStrong.textContent = mode === 'FPS_SOLO' ? 'FPS · BẠN BÈ' : 'VÔ TẬN ZOMBIE';
                }
                if (this.modeTitleSmall) {
                    this.modeTitleSmall.textContent = mode === 'FPS_SOLO' ? 'Chơi đơn với bot hoặc tạo phòng đấu cùng bạn bè' : 'Đấu trường Zombie';
                }
                if (this.modeCard) {
                    this.modeCard.classList.remove('tdm-blue', 'tdm-red');
                }
                if (modeIconImg) {
                    modeIconImg.src = mode === 'FPS_SOLO' ? 'assets/ui/lobby/runtime/skull-purple.png' : 'assets/ui/lobby/runtime/skull-blue.png';
                }
                if (badgesContainer) {
                    if (mode === 'FPS_SOLO') {
                        badgesContainer.innerHTML = `
                            <span class="mode-badge-pill blue">GÓC NHÌN 1</span>
                            <span class="mode-badge-pill green">BẠN BÈ / BOT</span>
                        `;
                    } else {
                        badgesContainer.innerHTML = `
                            <span class="mode-badge-pill purple">SINH TỒN</span>
                            <span class="mode-badge-pill gray">ĐẤU TRƯỜNG</span>
                        `;
                    }
                }
            }

            // Đồng bộ trạng thái Bot
            syncBotUI();

            // 7. Đồng bộ chế độ ngay lập tức với sảnh chờ phòng nếu đang hoạt động
            if (this.game.network?.active) {
                if (this.game.network.host) {
                    this.game.network.setMode(mode);
                } else {
                    this.game.ui?.showPickupAlert?.('CHẾ ĐỘ DO CHỦ PHÒNG QUYẾT ĐỊNH');
                }
            } else {
                this.preview();
            }
        };

        this._th_applyMode = applyMode;

        // Gắn sự kiện cho các tab chọn nhanh tại sảnh chính
        this.tabModeSurvival?.addEventListener('click', () => applyMode('SURVIVAL', this.selectedTeam));
        this.tabModeTDM?.addEventListener('click', () => applyMode('TDM', this.selectedTeam));
        document.getElementById('mode-tab-fps')?.addEventListener('click', () => applyMode('FPS_SOLO', 'blue'));

        // Gắn sự kiện cho các nút chọn phe nhanh
        this.quickTeamBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const team = btn.dataset.team || 'blue';
                applyMode('TDM', team);
            });
        });

        // Xử lý nút chọn phe trong Popover
        const popoverTeamBtns = document.querySelectorAll('#th-mode-select-popover .th_popover-team-btn');
        popoverTeamBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const team = btn.dataset.tdmTeam || 'blue';
                applyMode('TDM', team);
            });
        });

        // Xử lý danh sách chọn chế độ dạng popover một chạm (.th_mode-select-popover)
        const modePopover = document.getElementById('th-mode-select-popover');
        const modePopoverClose = document.getElementById('th-mode-popover-close');
        const modeCardWrapper = document.getElementById('th-mode-card-wrapper');

        const toggleModePopover = (forceState) => {
            if (!modePopover) return;
            const willOpen = typeof forceState === 'boolean' ? forceState : (modePopover.style.display === 'none' || !modePopover.style.display);
            modePopover.style.display = willOpen ? 'block' : 'none';
            if (willOpen) {
                const items = modePopover.querySelectorAll('.th_mode-item');
                items.forEach(it => it.classList.toggle('active', it.dataset.mode === this.selectedMode));
            }
        };

        if (this.modeCard) {
            this.modeCard.style.cursor = 'pointer';
            this.modeCard.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleModePopover();
            });
        }

        modePopoverClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleModePopover(false);
        });

        // Chọn một chạm trong Popover
        const popoverItems = modePopover?.querySelectorAll('.th_mode-item');
        popoverItems?.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = item.dataset.mode;
                applyMode(mode, this.selectedTeam);
                toggleModePopover(false);
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });

        // Bấm ra ngoài vùng chọn để đóng Popover
        document.addEventListener('click', (e) => {
            if (modePopover && modePopover.style.display !== 'none') {
                if (!modeCardWrapper?.contains(e.target)) {
                    toggleModePopover(false);
                }
            }
        });

        // Nhấn Esc để đóng Popover
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modePopover && modePopover.style.display !== 'none') {
                toggleModePopover(false);
            }
        });

        // Đồng bộ chế độ ban đầu ngay khi tải game
        applyMode(this.selectedMode, this.selectedTeam);

        // Hộp thoại modal chi tiết (dự phòng)
        if (this.modeDialog) {
            this.modeDialog.querySelector('.close-mode-dialog')?.addEventListener('click', () => {
                this.modeDialog.close();
            });

            this.modeDialog.addEventListener('click', (event) => {
                if (event.target === this.modeDialog) this.modeDialog.close();
            });

            // Chọn phe trong hộp thoại modal
            const teamBtns = this.modeDialog.querySelectorAll('.team-btn');
            teamBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const team = btn.dataset.team || 'blue';
                    applyMode('TDM', team);
                });
            });

            // Nút xác nhận chọn chế độ trong hộp thoại modal
            const selectModeBtns = this.modeDialog.querySelectorAll('[data-select-mode]');
            selectModeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.selectMode;
                    applyMode(mode, this.selectedTeam);
                    this.modeDialog.close();
                });
            });
        }

        // 2. Thiết lập giao diện xác thực Supabase Auth
        this.tabLogin = document.getElementById('tab-btn-login');
        this.tabSignup = document.getElementById('tab-btn-signup');
        this.panelLogin = document.getElementById('auth-panel-login');
        this.panelSignup = document.getElementById('auth-panel-signup');
        this.msgBox = document.getElementById('auth-status-msg');
        this.guestView = document.getElementById('auth-guest-view');
        this.loggedInView = document.getElementById('auth-logged-in-view');

        const showAuthMsg = (text, isError = true) => {
            if (!this.msgBox) return;
            this.msgBox.textContent = text;
            this.msgBox.className = `auth-message-box ${isError ? 'error' : 'success'}`;
            this.msgBox.style.display = 'block';
        };
        const clearAuthMsg = () => {
            if (this.msgBox) this.msgBox.style.display = 'none';
        };

        // Chuyển tab Đăng nhập / Đăng ký
        this.tabLogin?.addEventListener('click', () => {
            this.tabLogin.classList.add('active');
            this.tabSignup?.classList.remove('active');
            if (this.panelLogin) this.panelLogin.style.display = 'block';
            if (this.panelSignup) this.panelSignup.style.display = 'none';
            clearAuthMsg();
        });
        this.tabSignup?.addEventListener('click', () => {
            this.tabSignup.classList.add('active');
            this.tabLogin?.classList.remove('active');
            if (this.panelSignup) this.panelSignup.style.display = 'block';
            if (this.panelLogin) this.panelLogin.style.display = 'none';
            clearAuthMsg();
        });

        // Đăng nhập bằng Email & Mật khẩu
        const handleLogin = async () => {
            const emailInput = document.getElementById('auth-login-email');
            const passInput = document.getElementById('auth-login-pass');
            const btn = document.getElementById('btn-do-login');
            const email = emailInput?.value.trim();
            const password = passInput?.value;

            if (!email || !password) {
                showAuthMsg('Vui lòng điền đầy đủ Email và Mật khẩu.');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'ĐANG ĐĂNG NHẬP…';
            clearAuthMsg();

            const { error } = await signIn({ email, password });
            btn.disabled = false;
            btn.textContent = 'ĐĂNG NHẬP';

            if (error) {
                let msg = error.message || 'Đăng nhập không thành công.';
                if (msg.includes('Invalid login credentials')) {
                    msg = 'Email hoặc mật khẩu không chính xác.';
                } else if (msg.includes('Email not confirmed')) {
                    msg = 'Tài khoản chưa xác nhận email. Hãy kiểm tra hộp thư của bạn.';
                }
                showAuthMsg(msg, true);
            } else {
                showAuthMsg('Đăng nhập thành công!', false);
                if (passInput) passInput.value = '';
            }
        };

        document.getElementById('btn-do-login')?.addEventListener('click', handleLogin);
        document.getElementById('auth-login-pass')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleLogin();
            }
        });

        // Đăng ký tài khoản mới bằng Email & Mật khẩu
        const handleSignup = async () => {
            const nameInput = document.getElementById('auth-signup-name');
            const emailInput = document.getElementById('auth-signup-email');
            const passInput = document.getElementById('auth-signup-pass');
            const confirmInput = document.getElementById('auth-signup-confirm');
            const btn = document.getElementById('btn-do-signup');

            const fullName = nameInput?.value.trim();
            const email = emailInput?.value.trim();
            const password = passInput?.value;
            const confirmPass = confirmInput?.value;

            if (!fullName) {
                showAuthMsg('Vui lòng nhập họ và tên hoặc biệt danh.');
                return;
            }
            if (!email || !email.includes('@')) {
                showAuthMsg('Vui lòng nhập địa chỉ email hợp lệ.');
                return;
            }
            if (!password || password.length < 6) {
                showAuthMsg('Mật khẩu cần tối thiểu 6 ký tự.');
                return;
            }
            if (password !== confirmPass) {
                showAuthMsg('Mật khẩu xác nhận không khớp.');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'ĐANG TẠO TÀI KHOẢN…';
            clearAuthMsg();

            const { data, error } = await signUp({ email, password, fullName });
            btn.disabled = false;
            btn.textContent = 'TẠO TÀI KHOẢN MỚI';

            if (error) {
                let msg = error.message || 'Lỗi khi tạo tài khoản.';
                if (msg.includes('already registered')) {
                    msg = 'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập.';
                }
                showAuthMsg(msg, true);
            } else {
                if (data?.session) {
                    showAuthMsg('Tạo tài khoản và đăng nhập thành công!', false);
                } else {
                    showAuthMsg('Đăng ký thành công! Vui lòng kiểm tra email kích hoạt tài khoản rồi đăng nhập.', false);
                    setTimeout(() => this.tabLogin?.click(), 2500);
                }
            }
        };

        document.getElementById('btn-do-signup')?.addEventListener('click', handleSignup);
        document.getElementById('auth-signup-confirm')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSignup();
            }
        });

        // Đăng nhập với Google OAuth
        document.getElementById('btn-do-google')?.addEventListener('click', async () => {
            const { error } = await signInWithGoogle();
            if (error) {
                let msg = error.message || '';
                if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider') || msg.includes('validation_failed')) {
                    msg = 'Tính năng Google OAuth chưa được bật trên Supabase Dashboard của dự án gun-gun. Bạn hãy dùng form Đăng ký / Đăng nhập bằng Email & Mật khẩu ở trên.';
                } else {
                    msg = 'Không thể đăng nhập bằng Google: ' + msg;
                }
                showAuthMsg(msg, true);
            }
        });

        // Đăng xuất
        document.getElementById('btn-auth-logout')?.addEventListener('click', async () => {
            await signOut();
            resetGameProgressToGuest(game);
            const defaultName = 'Người chơi';
            game.roomName.value = defaultName;
            localStorage.setItem('arena_player_name', defaultName);
            document.getElementById('profile-name').textContent = defaultName.toUpperCase();
        });

        // Lưu tên khách tạm thời (dành cho chế độ khách)
        const guestInput = document.getElementById('room-name-guest');
        if (guestInput) guestInput.value = game.roomName.value;
        document.getElementById('save-guest-name')?.addEventListener('click', () => {
            const name = guestInput?.value.trim() || 'Người chơi';
            game.roomName.value = name;
            if (guestInput) guestInput.value = name;
            localStorage.setItem('arena_player_name', name);
            document.getElementById('profile-name').textContent = name.toUpperCase();
            this.dialog.close();
        });

        // 3. Thiết lập hệ thống Bạn bè & Mời chơi Thời Gian Thực
        this.tabFriendsList = document.getElementById('tab-btn-friends-list');
        this.tabRoomP2p = document.getElementById('tab-btn-room-p2p');
        this.panelFriendsSocial = document.getElementById('friends-panel-social');
        this.panelFriendsRoom = document.getElementById('friends-panel-room');
        this.friendsGuestAlert = document.getElementById('friends-guest-alert');
        this.friendsLoggedInContent = document.getElementById('friends-logged-in-content');

        this.inputSearchPlayer = document.getElementById('input-search-player');
        this.btnSearchPlayer = document.getElementById('btn-search-player');
        this.searchResultsContainer = document.getElementById('friends-search-results');
        this.friendsPendingContainer = document.getElementById('friends-pending-container');
        this.friendsPendingList = document.getElementById('friends-pending-list');
        this.pendingCount = document.getElementById('pending-count');
        this.friendsListEl = document.getElementById('friends-list');
        this.onlineCountEl = document.getElementById('friends-online-count');
        this.totalCountEl = document.getElementById('friends-total-count');

        // Modal Lời mời thời gian thực
        this.inviteModal = document.getElementById('realtime-invite-modal');
        this.inviteSenderAvatar = document.getElementById('invite-sender-avatar');
        this.inviteSenderName = document.getElementById('invite-sender-name');
        this.inviteTargetRoom = document.getElementById('invite-target-room');
        this.btnInviteAccept = document.getElementById('btn-invite-accept');
        this.btnInviteDecline = document.getElementById('btn-invite-decline');
        this.btnInviteClose = document.getElementById('btn-invite-close');

        // Chuyển tab trong panel Friends
        this.tabFriendsList?.addEventListener('click', () => {
            this.tabFriendsList.classList.add('active');
            this.tabRoomP2p?.classList.remove('active');
            if (this.panelFriendsSocial) this.panelFriendsSocial.style.display = 'block';
            if (this.panelFriendsRoom) this.panelFriendsRoom.style.display = 'none';
        });
        // Hàm tải và hiển thị danh sách phòng công khai đang mở
        const renderPublicRoomsUI = async () => {
            const listEl = document.getElementById('public-rooms-list');
            if (!listEl) return;
            listEl.innerHTML = '<div class="friends-empty-hint">Đang tải danh sách phòng...</div>';
            try {
                const rooms = await listPublicRooms();
                listEl.replaceChildren();
                if (!rooms || rooms.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'friends-empty-hint';
                    empty.textContent = 'Chưa có phòng nào đang mở. Hãy tạo phòng mới!';
                    listEl.appendChild(empty);
                    return;
                }
                for (const r of rooms) {
                    const card = document.createElement('div');
                    card.className = 'friend-item-card';

                    const left = document.createElement('div');
                    left.className = 'friend-info-left';

                    const avatar = document.createElement('div');
                    avatar.className = 'friend-avatar';
                    avatar.textContent = (r.host_name || '★').charAt(0).toUpperCase();

                    const meta = document.createElement('div');
                    meta.className = 'friend-meta';

                    const title = document.createElement('strong');
                    title.textContent = `PHÒNG ${r.code}`;

                    const sub = document.createElement('small');
                    const playersCount = (r.players || []).length;
                    const max = r.max_players || 8;
                    sub.textContent = `${r.host_name || 'Chủ phòng'} · ${r.mode || 'TDM'} · ${playersCount}/${max} người`;

                    meta.append(title, sub);
                    left.append(avatar, meta);

                    const right = document.createElement('div');
                    right.className = 'friend-actions-right';

                    const btnJoin = document.createElement('button');
                    btnJoin.className = 'toy-button orange btn-friend-invite';
                    btnJoin.textContent = 'VÀO NGAY';
                    btnJoin.addEventListener('click', () => {
                        this.game.roomCode.value = r.code;
                        this.game.roomJoin.click();
                    });
                    right.appendChild(btnJoin);

                    card.append(left, right);
                    listEl.appendChild(card);
                }
            } catch (err) {
                console.warn('[HomeMenu] Lỗi tải danh sách phòng:', err);
                listEl.innerHTML = '<div class="friends-empty-hint">Không thể tải danh sách phòng lúc này.</div>';
            }
        };

        this.tabRoomP2p?.addEventListener('click', () => {
            this.tabRoomP2p.classList.add('active');
            this.tabFriendsList?.classList.remove('active');
            if (this.panelFriendsRoom) this.panelFriendsRoom.style.display = 'block';
            if (this.panelFriendsSocial) this.panelFriendsSocial.style.display = 'none';
            renderPublicRoomsUI();
        });

        document.getElementById('btn-refresh-rooms')?.addEventListener('click', () => {
            renderPublicRoomsUI();
        });

        // Nút chuyển sang Đăng nhập từ cảnh báo khách
        document.getElementById('btn-friends-goto-login')?.addEventListener('click', () => {
            this.open('profile');
        });

        // Tìm kiếm người chơi để kết bạn
        const handleSearch = async () => {
            const query = this.inputSearchPlayer?.value.trim();
            if (!query) {
                if (this.searchResultsContainer) this.searchResultsContainer.style.display = 'none';
                return;
            }

            if (this.btnSearchPlayer) {
                this.btnSearchPlayer.disabled = true;
                this.btnSearchPlayer.textContent = '...';
            }

            const results = await searchPlayers(query);
            if (this.btnSearchPlayer) {
                this.btnSearchPlayer.disabled = false;
                this.btnSearchPlayer.textContent = 'TÌM';
            }

            if (!this.searchResultsContainer) return;
            this.searchResultsContainer.replaceChildren();

            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'friends-empty-hint';
                empty.textContent = 'Không tìm thấy người chơi nào phù hợp.';
                this.searchResultsContainer.appendChild(empty);
            } else {
                for (const player of results) {
                    const card = document.createElement('div');
                    card.className = 'friend-item-card';

                    const left = document.createElement('div');
                    left.className = 'friend-info-left';

                    const avatar = document.createElement('div');
                    avatar.className = 'friend-avatar-thumb';
                    if (player.avatar_url) avatar.innerHTML = `<img src="${player.avatar_url}" alt="Avatar">`;
                    else avatar.textContent = (player.full_name || player.email || '?').charAt(0).toUpperCase();

                    const meta = document.createElement('div');
                    meta.className = 'friend-text-meta';
                    const name = document.createElement('strong');
                    name.textContent = player.full_name || 'Người chơi';
                    const email = document.createElement('span');
                    email.textContent = player.email || '';
                    meta.append(name, email);
                    left.append(avatar, meta);

                    const right = document.createElement('div');
                    right.className = 'friend-actions-right';
                    const btnAdd = document.createElement('button');
                    btnAdd.className = 'toy-button blue btn-friend-invite';
                    btnAdd.textContent = '+ KẾT BẠN';
                    btnAdd.addEventListener('click', async () => {
                        btnAdd.disabled = true;
                        btnAdd.textContent = 'ĐANG GỬI…';
                        const { error } = await sendFriendRequest(player.id);
                        if (error) {
                            btnAdd.textContent = 'ĐÃ GỬI / BẠN BÈ';
                        } else {
                            btnAdd.textContent = '✓ ĐÃ GỬI';
                        }
                    });
                    right.appendChild(btnAdd);

                    card.append(left, right);
                    this.searchResultsContainer.appendChild(card);
                }
            }
            this.searchResultsContainer.style.display = 'flex';
        };

        this.btnSearchPlayer?.addEventListener('click', handleSearch);
        this.inputSearchPlayer?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSearch();
            }
        });

        // Hàm render danh sách bạn bè
        const renderFriendsUI = () => {
            if (!this.friendsListEl) return;
            const friends = getFriendsList();
            this.friendsListEl.replaceChildren();

            let onlineCount = 0;
            for (const f of friends) {
                if (isUserOnline(f.targetUserId)) onlineCount++;
            }

            if (this.onlineCountEl) this.onlineCountEl.textContent = onlineCount;
            if (this.totalCountEl) this.totalCountEl.textContent = friends.length;

            if (friends.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'friends-empty-hint';
                empty.textContent = 'Chưa có bạn bè nào. Hãy nhập email hoặc tên ở trên để kết bạn!';
                this.friendsListEl.appendChild(empty);
                return;
            }

            for (const friend of friends) {
                const isOnline = isUserOnline(friend.targetUserId);
                const card = document.createElement('div');
                card.className = 'friend-item-card';

                const left = document.createElement('div');
                left.className = 'friend-info-left';

                const avatar = document.createElement('div');
                avatar.className = 'friend-avatar-thumb';
                if (friend.avatarUrl) avatar.innerHTML = `<img src="${friend.avatarUrl}" alt="Avatar">`;
                else avatar.textContent = friend.fullName.charAt(0).toUpperCase();

                const pip = document.createElement('span');
                pip.className = `friend-status-pip ${isOnline ? '' : 'offline'}`;
                pip.title = isOnline ? 'Đang Online' : 'Ngoại tuyến';
                avatar.appendChild(pip);

                const meta = document.createElement('div');
                meta.className = 'friend-text-meta';
                const name = document.createElement('strong');
                name.textContent = friend.fullName;
                const sub = document.createElement('span');
                sub.textContent = isOnline ? 'ĐANG ONLINE' : 'NGOẠI TUYẾN';
                sub.style.color = isOnline ? '#34d399' : '#9ca3af';
                meta.append(name, sub);
                left.append(avatar, meta);

                const right = document.createElement('div');
                right.className = 'friend-actions-right';

                // Nút Mời Chơi (khi online)
                if (isOnline) {
                    const btnInvite = document.createElement('button');
                    btnInvite.className = 'toy-button orange btn-friend-invite';
                    btnInvite.textContent = 'MỜI CHƠI';
                    btnInvite.addEventListener('click', async () => {
                        btnInvite.disabled = true;
                        try {
                            let code = this.currentRoomCode;
                            if (!code) {
                                btnInvite.textContent = 'TẠO PHÒNG…';
                                const room = await this.game.createRoom();
                                if (!room) throw new Error(this.game.roomStatus?.textContent || 'Không thể tạo phòng.');
                                code = room.code;
                            }
                            btnInvite.textContent = 'ĐANG GỬI…';
                            const { error } = await sendGameInvite(friend.targetUserId, code);
                            if (error) throw error;
                            btnInvite.textContent = 'ĐÃ GỬI!';
                        } catch (error) {
                            btnInvite.textContent = 'THỬ LẠI';
                            this.game.showRoomError(error.message);
                            this.game.ui?.showPickupAlert?.(error.message);
                        } finally {
                            setTimeout(() => {
                                btnInvite.disabled = false;
                                btnInvite.textContent = 'MỜI CHƠI';
                            }, 2000);
                        }
                    });
                    right.appendChild(btnInvite);
                }

                // Nút Hủy kết bạn
                const btnRemove = document.createElement('button');
                btnRemove.className = 'btn-friend-remove';
                btnRemove.textContent = '✕';
                btnRemove.title = 'Hủy kết bạn';
                btnRemove.addEventListener('click', async () => {
                    if (confirm(`Bạn có chắc muốn hủy kết bạn với ${friend.fullName}?`)) {
                        await removeFriendship(friend.friendshipId);
                    }
                });
                right.appendChild(btnRemove);

                card.append(left, right);
                this.friendsListEl.appendChild(card);
            }
        };

        // Hàm render danh sách lời mời kết bạn
        const renderPendingUI = () => {
            if (!this.friendsPendingContainer || !this.friendsPendingList) return;
            const pending = getPendingRequests();
            const incoming = pending.filter(p => !p.isSender);

            if (incoming.length === 0) {
                this.friendsPendingContainer.style.display = 'none';
                return;
            }

            if (this.pendingCount) this.pendingCount.textContent = incoming.length;
            this.friendsPendingList.replaceChildren();

            for (const req of incoming) {
                const card = document.createElement('div');
                card.className = 'friend-item-card';

                const left = document.createElement('div');
                left.className = 'friend-info-left';

                const avatar = document.createElement('div');
                avatar.className = 'friend-avatar-thumb';
                if (req.avatarUrl) avatar.innerHTML = `<img src="${req.avatarUrl}" alt="Avatar">`;
                else avatar.textContent = req.fullName.charAt(0).toUpperCase();

                const meta = document.createElement('div');
                meta.className = 'friend-text-meta';
                const name = document.createElement('strong');
                name.textContent = req.fullName;
                const email = document.createElement('span');
                email.textContent = req.email;
                meta.append(name, email);
                left.append(avatar, meta);

                const right = document.createElement('div');
                right.className = 'friend-actions-right';

                const btnAccept = document.createElement('button');
                btnAccept.className = 'toy-button yellow btn-friend-invite';
                btnAccept.textContent = 'ĐỒNG Ý';
                btnAccept.addEventListener('click', async () => {
                    btnAccept.disabled = true;
                    await acceptFriendRequest(req.friendshipId);
                });

                const btnDecline = document.createElement('button');
                btnDecline.className = 'toy-button coral btn-friend-invite';
                btnDecline.textContent = 'TỪ CHỐI';
                btnDecline.addEventListener('click', async () => {
                    btnDecline.disabled = true;
                    await removeFriendship(req.friendshipId);
                });

                right.append(btnAccept, btnDecline);
                card.append(left, right);
                this.friendsPendingList.appendChild(card);
            }
            this.friendsPendingContainer.style.display = 'block';
        };

        // Cập nhật huy hiệu bạn bè trên header
        const updateFriendsBadge = () => {
            const badge = document.querySelector('.button-badge');
            if (!badge) return;
            if (this.game.network.active && this.currentRoomCode) {
                return; // Khi trong phòng thì hiển thị số người trong phòng
            }
            const pending = getPendingRequests().filter(p => !p.isSender);
            if (pending.length > 0) {
                badge.textContent = `+${pending.length}`;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = '+';
            }
        };

        // Đăng ký các listeners của Friends & Presence
        onFriendsUpdate(() => {
            renderFriendsUI();
            renderPendingUI();
            updateFriendsBadge();
        });
        onPresenceUpdate(() => {
            renderFriendsUI();
        });

        // Xử lý Lời Mời Chơi Thời Gian Thực (In-game Toast Modal)
        onGameInvite(invite => this.showGameInvite(invite));

        // Nút trong Toast Lời Mời Chơi
        this.btnInviteAccept?.addEventListener('click', () => this.acceptGameInvite());
        this.btnInviteDecline?.addEventListener('click', () => this.hideGameInvite());
        this.btnInviteClose?.addEventListener('click', () => this.hideGameInvite());

        // Lắng nghe thay đổi trạng thái xác thực
        onAuthStateChange(({ user, profile }) => {
            const authStatus = document.getElementById('profile-auth-status');
            const headerAvatar = document.getElementById('header-avatar');

            if (user) {
                // Đã đăng nhập
                if (this.loggedInView) this.loggedInView.style.display = 'block';
                if (this.guestView) this.guestView.style.display = 'none';
                if (this.friendsLoggedInContent) this.friendsLoggedInContent.style.display = 'block';
                if (this.friendsGuestAlert) this.friendsGuestAlert.style.display = 'none';

                const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Người chơi';
                const nameEl = document.getElementById('auth-user-name');
                const emailEl = document.getElementById('auth-user-email');
                if (nameEl) nameEl.textContent = displayName.toUpperCase();
                if (emailEl) emailEl.textContent = user.email || '';

                const roleBadge = document.getElementById('auth-user-badge');
                if (roleBadge) {
                    const roleText = profile?.role === 'admin' ? 'QUẢN TRỊ VIÊN' : (profile?.role === 'leader' ? 'TRƯỞNG NHÓM' : 'THÀNH VIÊN');
                    roleBadge.textContent = `SUPABASE · ${roleText}`;
                }

                // Cập nhật avatar nếu có
                const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
                const avatarBox = document.getElementById('auth-user-avatar');
                if (avatarBox) {
                    if (avatarUrl) avatarBox.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
                    else avatarBox.textContent = displayName.charAt(0).toUpperCase();
                }
                if (headerAvatar) {
                    if (avatarUrl) headerAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
                    else headerAvatar.textContent = displayName.charAt(0).toUpperCase();
                }

                if (authStatus) {
                    authStatus.textContent = 'ĐÃ ĐĂNG NHẬP';
                    authStatus.classList.add('logged-in');
                }

                // Cập nhật tên vào ô roomName
                game.roomName.value = displayName;
                localStorage.setItem('arena_player_name', displayName);
                document.getElementById('profile-name').textContent = displayName.toUpperCase();

                // Khởi tạo hệ thống Bạn bè & Presence cho user này
                initFriendsSystem();

                // Đồng bộ súng, tiền và cấp độ nâng cấp theo tài khoản
                applyProfileProgressToGame(profile, game);
            } else {
                // Chưa đăng nhập / Khách
                if (this.loggedInView) this.loggedInView.style.display = 'none';
                if (this.guestView) this.guestView.style.display = 'block';
                if (this.friendsLoggedInContent) this.friendsLoggedInContent.style.display = 'none';
                if (this.friendsGuestAlert) this.friendsGuestAlert.style.display = 'block';

                if (headerAvatar) headerAvatar.textContent = '★';
                if (authStatus) {
                    authStatus.textContent = 'ĐĂNG NHẬP / HỒ SƠ';
                    authStatus.classList.remove('logged-in');
                }

                const savedName = localStorage.getItem('arena_player_name') || 'Người chơi';
                game.roomName.value = savedName;
                document.getElementById('profile-name').textContent = savedName.toUpperCase();
                if (guestInput) guestInput.value = savedName;

                // Dọn dẹp trạng thái bạn bè
                cleanupFriendsSystem();

                // Ở chế độ khách, giữ nguyên tiến trình người chơi đã lưu trong localStorage và cập nhật UI
                game.updateCoinsUI?.();
                game.updateCharacterSelection?.();
                game.homeMenu?.preview?.();
            }
        });

        // Khởi động kiểm tra session hiện có
        initAuth();

        // Xử lý thanh trượt điều chỉnh âm lượng Nhạc nền và SFX
        const musicSlider = document.getElementById('setting-music-slider');
        const sfxSlider = document.getElementById('setting-sfx-slider');
        if (musicSlider) {
            musicSlider.addEventListener('input', (e) => {
                sounds.setMusicVolume(e.target.value / 100);
                this.syncAudio();
            });
        }
        if (sfxSlider) {
            sfxSlider.addEventListener('input', (e) => {
                sounds.setSfxVolume(e.target.value / 100);
                this.syncAudio();
                sounds.play('switchWeapon', { volume: 0.4 });
            });
        }

        document.getElementById('home-sound').addEventListener('click', () => { sounds.toggleAudio(); this.syncAudio(); });
        document.getElementById('home-music').addEventListener('click', () => { sounds.toggleMusic(); this.syncAudio(); });
        document.getElementById('home-devmode')?.addEventListener('click', () => { this.game.toggleDeveloperMode(); });
        document.getElementById('copy-link').addEventListener('click', async event => {
            try { await navigator.clipboard.writeText(document.getElementById('share-link').value); event.target.textContent = 'ĐÃ COPY'; setTimeout(() => event.target.textContent = 'COPY', 1800); }
            catch { game.showRoomError('Hãy chọn và sao chép liên kết trong ô phía trên.'); }
        });
        game.roomCode.addEventListener('input', () => { game.roomCode.value = game.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
        game.roomCode.addEventListener('keydown', event => { if (event.key === 'Enter' && !game.roomJoin.disabled) game.roomJoin.click(); });
        this.preview();
    }

    open(panel) {
        if (panel === 'characters' || panel === 'weapons') {
            this.showroom.open(panel);
            return;
        }
        document.getElementById('dialog-title').textContent = this.titles[panel];
        this.dialog.querySelectorAll('[data-panel]').forEach(section => section.hidden = section.dataset.panel !== panel);
        document.getElementById('record-score').textContent = this.game.highScore.toLocaleString();
        this.syncAudio();
        this.dialog.showModal();
    }

    syncAudio() {
        const musicPct = Math.round(sounds.musicVolume * 100);
        const sfxPct = Math.round(sounds.sfxVolume * 100);

        // Nút toggle nhanh
        const homeSound = document.getElementById('home-sound');
        const homeMusic = document.getElementById('home-music');
        if (homeSound) homeSound.textContent = `ÂM THANH: ${sounds.enabled ? 'BẬT' : 'TẮT'}`;
        if (homeMusic) homeMusic.textContent = `NHẠC: ${sounds.musicEnabled ? 'BẬT' : 'TẮT'}`;
        const toggleSound = document.getElementById('toggle-sound');
        const toggleMusic = document.getElementById('toggle-music');
        if (toggleSound) toggleSound.textContent = `SOUND: ${sounds.enabled ? 'ON' : 'OFF'}`;
        if (toggleMusic) toggleMusic.textContent = `MUSIC: ${sounds.musicEnabled ? 'ON' : 'OFF'}`;

        // Cập nhật thanh trượt & badge trong Settings
        const musicSlider = document.getElementById('setting-music-slider');
        const musicBadge = document.getElementById('music-vol-badge');
        if (musicSlider) musicSlider.value = musicPct;
        if (musicBadge) musicBadge.textContent = `${sounds.musicEnabled && sounds.enabled ? musicPct : 0}%`;

        const sfxSlider = document.getElementById('setting-sfx-slider');
        const sfxBadge = document.getElementById('sfx-vol-badge');
        if (sfxSlider) sfxSlider.value = sfxPct;
        if (sfxBadge) sfxBadge.textContent = `${sounds.enabled ? sfxPct : 0}%`;

        // Cập nhật thanh trượt & badge trong Pause Menu
        const pauseMusicSlider = document.getElementById('pause-music-slider');
        const pauseMusicBadge = document.getElementById('pause-music-badge');
        if (pauseMusicSlider) pauseMusicSlider.value = musicPct;
        if (pauseMusicBadge) pauseMusicBadge.textContent = `${sounds.musicEnabled && sounds.enabled ? musicPct : 0}%`;

        const pauseSfxSlider = document.getElementById('pause-sfx-slider');
        const pauseSfxBadge = document.getElementById('pause-sfx-badge');
        if (pauseSfxSlider) pauseSfxSlider.value = sfxPct;
        if (pauseSfxBadge) pauseSfxBadge.textContent = `${sounds.enabled ? sfxPct : 0}%`;

        this.game.syncDeveloperModeUI?.();
        this.game.syncPerformanceUI?.();
    }

    preview() {
        this.refreshLoadout();
        if (!this.game.network.active) this.game.roomLobby.update({ solo: true, code: '', you: 'preview', host: 'preview', players: [{ id: 'preview', name: this.game.roomName.value, character: this.game.characterId }] });
    }

    refreshLoadout() {
        const gun = getStartingWeapon(this.game.weapons.startingWeaponId);
        const cfg = CHARACTER_CONFIGS[this.game.characterId] || CHARACTER_CONFIGS.police;
        document.getElementById('home-equipped-character').textContent = cfg?.label || 'CẢNH SÁT TRƯỞNG';
        document.getElementById('home-equipped-weapon').textContent = gun.name;
        document.getElementById('home-equipped-icon').src = gun.icon;
        const characters = Object.keys(CHARACTER_CONFIGS);
        document.getElementById('home-character-count').textContent = `${characters.filter(isCharacterUnlocked).length} / ${characters.length} ĐÃ MỞ`;
    }

    showGameInvite(invite) {
        if (!this.inviteModal) return;
        const code = (invite.roomCode || '').trim().toUpperCase();
        if (!code || (this.game.network.active && this.game.network.code === code)) return;
        if (invite.timestamp && Date.now() - invite.timestamp > 120000) return;
        if (this.acceptingInvite) {
            this.queuedInvite = invite;
            return;
        }
        this.incomingRoomCode = code;
        this.incomingInviteTime = invite.timestamp || Date.now();
        if (this.inviteSenderName) this.inviteSenderName.textContent = (invite.fromName || 'ĐỒNG ĐỘI').toUpperCase();
        if (this.inviteTargetRoom) this.inviteTargetRoom.textContent = code;
        if (this.inviteSenderAvatar) {
            this.inviteSenderAvatar.replaceChildren();
            if (invite.fromAvatar) {
                const avatar = document.createElement('img');
                avatar.src = invite.fromAvatar;
                avatar.alt = 'Avatar';
                this.inviteSenderAvatar.appendChild(avatar);
            } else this.inviteSenderAvatar.textContent = (invite.fromName || '★').charAt(0).toUpperCase();
        }
        const status = document.getElementById('invite-status');
        if (status) status.textContent = '';
        // A normal z-index cannot put the invitation above an open modal dialog.
        if (this.dialog.open) this.dialog.close();
        this.inviteModal.style.display = 'block';
        sounds.play('switchWeapon', { volume: 1.0 });
    }

    hideGameInvite() {
        if (this.acceptingInvite) return;
        if (this.inviteModal) this.inviteModal.style.display = 'none';
        this.incomingRoomCode = '';
    }

    async acceptGameInvite() {
        if (this.acceptingInvite || !this.incomingRoomCode) return;
        const status = document.getElementById('invite-status');
        if (Date.now() - this.incomingInviteTime > 120000) {
            if (status) status.textContent = 'Lời mời đã hết hạn. Hãy nhờ bạn gửi lại.';
            return;
        }
        this.acceptingInvite = true;
        this.btnInviteAccept.disabled = true;
        this.btnInviteAccept.textContent = 'ĐANG VÀO PHÒNG…';
        if (status) status.textContent = '';
        try {
            if (this.dialog.open) this.dialog.close();
            const room = await this.game.joinRoom(this.incomingRoomCode);
            if (!room) throw new Error(this.game.roomStatus?.textContent || 'Không thể vào phòng. Vui lòng thử lại.');
            this.inviteModal.style.display = 'none';
            this.incomingRoomCode = '';
        } catch (error) {
            if (status) status.textContent = error.message;
        } finally {
            this.acceptingInvite = false;
            this.btnInviteAccept.disabled = false;
            this.btnInviteAccept.textContent = 'THAM GIA NGAY';
            if (this.queuedInvite) {
                const invite = this.queuedInvite;
                this.queuedInvite = null;
                this.showGameInvite(invite);
            }
        }
    }

    room(data) {
        const code = data?.code || '';
        const active = !!code;
        this.currentRoomCode = code;

        if (active && data?.mode && data.mode !== this.selectedMode) {
            this.selectedMode = data.mode;
            this.applyModeSilent(data.mode);
        }

        document.getElementById('share-room').hidden = !active;
        document.getElementById('share-link-row').hidden = !active;
        this.game.roomCreate.hidden = active;
        document.getElementById('share-code').textContent = code;
        const isHost = active && (data.host === data.you || !!data.isHost);
        const currentRoomMode = data?.mode || this.game.selectedGameMode || 'SURVIVAL';
        const isTDM = currentRoomMode === 'TDM' || currentRoomMode === 'FPS_SOLO';
        const maxSlots = isTDM ? 8 : 4;
        const modeLabel = isTDM ? 'ĐỐI KHÁNG' : 'SINH TỒN';
        document.getElementById('mode-status').textContent = active ? `TỔ ĐỘI ${modeLabel} ${data.players.length}/${maxSlots} · ${isHost ? 'CHỦ PHÒNG' : 'ĐỒNG ĐỘI'}` : 'CHƠI ĐƠN · SẴN SÀNG';
        document.getElementById('friends-label').textContent = active ? `PHÒNG ${code}` : 'BẠN BÈ';
        document.querySelector('.button-badge').textContent = active ? data.players.length : '+';
        this.game.roomJoin.closest('.join-row').hidden = active;
        this.dialog.querySelector('label[for="room-code"]').hidden = active;
        const guestWait = document.getElementById('guest-wait');
        if (guestWait) {
            guestWait.hidden = true;
            guestWait.style.display = 'none';
        }
        if (active && data && typeof data.fillBots === 'boolean') {
            this.game.soloFillBots = data.fillBots;
            this.syncBotUI?.();
        }
        if (active) {
            const url = new URL(location.pathname, location.origin);
            url.searchParams.set('room', code);
            document.getElementById('share-link').value = url.href;
            if (this.qrCode !== code) {
                const qr = document.getElementById('room-qr');
                qr.replaceChildren();
                if (window.QRCode) new window.QRCode(qr, { text: url.href, width: 124, height: 124, colorDark: '#211b2d', correctLevel: window.QRCode.CorrectLevel.M });
                else qr.textContent = 'Dùng liên kết bên dưới';
                this.qrCode = code;
            }
        } else this.preview();
    }

    applyModeSilent(mode, team = this.selectedTeam) {
        if (typeof this._th_applyMode === 'function') {
            this._th_applyMode(mode, team);
        }
    }
}

