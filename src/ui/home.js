import { sounds } from '../audio/audio.js';
import { CharacterShowroom } from './showroom.js?v=46';
import { CHARACTER_CONFIGS, isCharacterUnlocked } from '../gameplay/player/characters.js';
import { getStartingWeapon } from '../gameplay/combat/weapons.js?v=32';
import { initAuth, signIn, signUp, signInWithGoogle, signOut, onAuthStateChange } from '../network/auth.js';

export class HomeMenu {
    constructor(game) {
        this.game = game;
        this.dialog = document.getElementById('home-dialog');
        this.showroom = new CharacterShowroom(game);
        this.titles = { friends: 'CHƠI CÙNG BẠN BÈ', profile: 'HỒ SƠ & TÀI KHOẢN', characters: 'CHỌN NHÂN VẬT', help: 'CÁCH CHƠI', settings: 'CÀI ĐẶT', records: 'KỶ LỤC CỦA BẠN' };
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

        // Lắng nghe thay đổi trạng thái xác thực
        onAuthStateChange(({ user, profile }) => {
            const authStatus = document.getElementById('profile-auth-status');
            const headerAvatar = document.getElementById('header-avatar');

            if (user) {
                // Đã đăng nhập
                if (this.loggedInView) this.loggedInView.style.display = 'block';
                if (this.guestView) this.guestView.style.display = 'none';

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
            } else {
                // Chưa đăng nhập / Khách
                if (this.loggedInView) this.loggedInView.style.display = 'none';
                if (this.guestView) this.guestView.style.display = 'block';

                if (headerAvatar) headerAvatar.textContent = '★';
                if (authStatus) {
                    authStatus.textContent = 'ĐĂNG NHẬP / HỒ SƠ';
                    authStatus.classList.remove('logged-in');
                }

                const savedName = localStorage.getItem('arena_player_name') || 'Người chơi';
                game.roomName.value = savedName;
                document.getElementById('profile-name').textContent = savedName.toUpperCase();
                if (guestInput) guestInput.value = savedName;
            }
        });

        // Khởi động kiểm tra session hiện có
        initAuth();

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
            this.showroom.open();
            if (panel === 'weapons') this.showroom.setMode('weapons');
            return;
        }
        document.getElementById('dialog-title').textContent = this.titles[panel];
        this.dialog.querySelectorAll('[data-panel]').forEach(section => section.hidden = section.dataset.panel !== panel);
        document.getElementById('record-score').textContent = this.game.highScore.toLocaleString();
        this.syncAudio();
        this.dialog.showModal();
    }
    syncAudio() {
        document.getElementById('home-sound').textContent = `ÂM THANH: ${sounds.enabled ? 'BẬT' : 'TẮT'}`;
        document.getElementById('home-music').textContent = `NHẠC: ${sounds.musicEnabled ? 'BẬT' : 'TẮT'}`;
        document.getElementById('toggle-sound').textContent = `SOUND: ${sounds.enabled ? 'ON' : 'OFF'}`;
        document.getElementById('toggle-music').textContent = `MUSIC: ${sounds.musicEnabled ? 'ON' : 'OFF'}`;
        this.game.syncDeveloperModeUI?.();
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
    room(data) {
        const code = data?.code || '';
        const active = !!code;
        document.getElementById('share-room').hidden = !active;
        document.getElementById('share-link-row').hidden = !active;
        this.game.roomCreate.hidden = active;
        document.getElementById('share-code').textContent = code;
        const isHost = active && (data.host === data.you || !!data.isHost);
        document.getElementById('mode-status').textContent = active ? `TỔ ĐỘI ${data.players.length}/4 · ${isHost ? 'CHỦ PHÒNG' : 'ĐỒNG ĐỘI'}` : 'CHƠI ĐƠN · SẴN SÀNG';
        document.getElementById('friends-label').textContent = active ? `PHÒNG ${code}` : 'BẠN BÈ';
        document.querySelector('.button-badge').textContent = active ? data.players.length : '+';
        this.game.roomJoin.closest('.join-row').hidden = active;
        this.dialog.querySelector('label[for="room-code"]').hidden = active;
        document.getElementById('guest-wait').hidden = !active || data.host === data.you || !!data.isHost;
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
}
