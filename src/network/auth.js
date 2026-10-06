// Quản lý dịch vụ xác thực tài khoản qua Supabase Auth (Dự án: gun-gun)
const SUPABASE_URL = 'https://ijkhfuxkbzkbmrgyqywz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fkQ3L7av8yZlRG43L4ZolA_P0f7q8ZQ';

let _supabaseClient = null;
let _currentUser = null;
let _currentProfile = null;
const _authListeners = new Set();

export function getSupabaseClient() {
    if (_supabaseClient) return _supabaseClient;
    if (typeof window !== 'undefined' && window.supabase?.createClient) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }
    return _supabaseClient;
}

export async function fetchProfile(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) return null;
    try {
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        if (error) {
            console.warn('[SupabaseAuth] Lỗi tải profile:', error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('[SupabaseAuth] Ngoại lệ khi tải profile:', err);
        return null;
    }
}

export async function updateProfile(userId, { fullName, avatarUrl }) {
    const client = getSupabaseClient();
    if (!client || !userId) return { error: new Error('Chưa kết nối Supabase') };
    try {
        const updates = {};
        if (fullName !== undefined) updates.full_name = fullName;
        if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
        const { data, error } = await client
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .maybeSingle();
        if (!error && data) {
            _currentProfile = { ..._currentProfile, ...data };
            notifyListeners();
        }
        return { data, error };
    } catch (err) {
        return { error: err };
    }
}

export async function signUp({ email, password, fullName }) {
    const client = getSupabaseClient();
    if (!client) return { error: new Error('Hệ thống xác thực chưa sẵn sàng.') };

    const cleanEmail = email.trim();
    const cleanName = fullName?.trim() || cleanEmail.split('@')[0];

    try {
        const { data, error } = await client.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: {
                    full_name: cleanName
                }
            }
        });

        if (error) return { error };

        // Nếu có session ngay lập tức (không bắt buộc verify email)
        if (data?.user && data?.session) {
            _currentUser = data.user;
            _currentProfile = await fetchProfile(data.user.id) || {
                id: data.user.id,
                email: cleanEmail,
                full_name: cleanName
            };
            notifyListeners();
        }

        return { data, error: null };
    } catch (err) {
        return { error: err };
    }
}

export async function signIn({ email, password }) {
    const client = getSupabaseClient();
    if (!client) return { error: new Error('Hệ thống xác thực chưa sẵn sàng.') };

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) return { error };

        if (data?.user) {
            _currentUser = data.user;
            _currentProfile = await fetchProfile(data.user.id) || {
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0]
            };
            notifyListeners();
        }

        return { data, error: null };
    } catch (err) {
        return { error: err };
    }
}

export async function signInWithGoogle() {
    const client = getSupabaseClient();
    if (!client) return { error: new Error('Hệ thống xác thực chưa sẵn sàng.') };

    try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
        return { data, error };
    } catch (err) {
        return { error: err };
    }
}

export async function signOut() {
    await flushGameProgress();
    unsubscribeProfileRealtime();
    const client = getSupabaseClient();
    if (client) {
        try {
            await client.auth.signOut();
        } catch (err) {
            console.warn('[SupabaseAuth] Lỗi đăng xuất:', err);
        }
    }
    _currentUser = null;
    _currentProfile = null;
    notifyListeners();
}

export function getCurrentUser() {
    return _currentUser;
}

export function getCurrentProfile() {
    return _currentProfile;
}

export function onAuthStateChange(listener) {
    _authListeners.add(listener);
    // Gọi ngay lập tức với trạng thái hiện tại
    listener({ user: _currentUser, profile: _currentProfile });
    return () => _authListeners.delete(listener);
}

function notifyListeners() {
    for (const listener of _authListeners) {
        try {
            listener({ user: _currentUser, profile: _currentProfile });
        } catch (err) {
            console.error('[SupabaseAuth] Listener error:', err);
        }
    }
}

export async function initAuth() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        // Lấy session hiện tại từ storage hoặc URL redirect
        const { data: { session }, error } = await client.auth.getSession();
        if (!error && session?.user) {
            _currentUser = session.user;
            _currentProfile = await fetchProfile(session.user.id) || {
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
            };
            subscribeProfileRealtime(session.user.id);
            notifyListeners();
        }

        // Lắng nghe thay đổi trạng thái đăng nhập/đăng xuất/refresh
        client.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                _currentUser = session.user;
                _currentProfile = await fetchProfile(session.user.id) || {
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
                };
                subscribeProfileRealtime(session.user.id);
                // Dọn sạch hash chứa token sau khi đã lưu phiên an toàn
                if (typeof window !== 'undefined' && (window.location.hash?.includes('access_token') || window.location.search?.includes('code='))) {
                    setTimeout(() => {
                        window.history.replaceState(null, '', window.location.pathname);
                    }, 500);
                }
            } else {
                unsubscribeProfileRealtime();
                _currentUser = null;
                _currentProfile = null;
            }
            notifyListeners();
        });
    } catch (err) {
        console.warn('[SupabaseAuth] Lỗi khởi tạo phiên:', err);
    }

    return _currentUser;
}

// ============================================================
// HỆ THỐNG ĐỒNG BỘ TIẾN TRÌNH GAME THEO TÀI KHOẢN (CLOUD PROGRESS)
// ============================================================

let _syncDebounceTimer = null;
let _pendingProgress = null;

/**
 * Lưu tiến trình game (tiền, súng mở khóa, cấp cường hóa, part, enchant, loadout) lên Supabase theo tài khoản
 * @param {Object} progress - Dữ liệu tiến trình cần cập nhật
 * @param {boolean} [immediate=false] - Lưu ngay lập tức không qua debounce
 */
export async function saveGameProgressToCloud(progress, immediate = false) {
    const client = getSupabaseClient();
    if (!client || !_currentUser) return;

    _pendingProgress = { ...(_pendingProgress || {}), ...progress };

    if (immediate) {
        if (_syncDebounceTimer) {
            clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = null;
        }
        return await flushGameProgress();
    }

    if (_syncDebounceTimer) {
        clearTimeout(_syncDebounceTimer);
    }

    _syncDebounceTimer = setTimeout(async () => {
        _syncDebounceTimer = null;
        await flushGameProgress();
    }, 800);
}

/**
 * Đẩy ngay lập tức các dữ liệu tiến trình còn chờ lên Supabase
 */
export async function flushGameProgress() {
    if (!_pendingProgress || !_currentUser) return;
    const toSave = { ..._pendingProgress };
    _pendingProgress = null;
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const updates = {};
        if (typeof toSave.coins === 'number') updates.coins = toSave.coins;
        if (Array.isArray(toSave.unlockedWeapons)) updates.unlocked_weapons = toSave.unlockedWeapons;
        else if (Array.isArray(toSave.unlocked_weapons)) updates.unlocked_weapons = toSave.unlocked_weapons;

        if (toSave.weaponTiers && typeof toSave.weaponTiers === 'object') updates.weapon_tiers = toSave.weaponTiers;
        else if (toSave.weapon_tiers && typeof toSave.weapon_tiers === 'object') updates.weapon_tiers = toSave.weapon_tiers;

        if (toSave.weaponEnchants && typeof toSave.weaponEnchants === 'object') updates.weapon_enchants = toSave.weaponEnchants;
        else if (toSave.weapon_enchants && typeof toSave.weapon_enchants === 'object') updates.weapon_enchants = toSave.weapon_enchants;

        if (toSave.weaponParts && typeof toSave.weaponParts === 'object') updates.weapon_parts = toSave.weaponParts;
        else if (toSave.weapon_parts && typeof toSave.weapon_parts === 'object') updates.weapon_parts = toSave.weapon_parts;

        if (toSave.loadout && typeof toSave.loadout === 'object') updates.loadout = toSave.loadout;
        if (typeof toSave.characterId === 'string') updates.character_id = toSave.characterId;
        else if (typeof toSave.character_id === 'string') updates.character_id = toSave.character_id;

        if (Array.isArray(toSave.unlockedCharacters)) updates.unlocked_characters = toSave.unlockedCharacters;
        else if (Array.isArray(toSave.unlocked_characters)) updates.unlocked_characters = toSave.unlocked_characters;

        if (typeof toSave.highScore === 'number') updates.high_score = toSave.highScore;
        else if (typeof toSave.high_score === 'number') updates.high_score = toSave.high_score;

        if (Object.keys(updates).length === 0) return;

        updates.updated_at = new Date().toISOString();

        const { error } = await client
            .from('profiles')
            .update(updates)
            .eq('id', _currentUser.id);

        if (error) {
            console.warn('[CloudSync] Lỗi cập nhật tiến trình tài khoản:', error.message);
        } else if (_currentProfile) {
            _currentProfile = { ..._currentProfile, ...updates };
        }
    } catch (err) {
        console.warn('[CloudSync] Ngoại lệ khi lưu tiến trình:', err);
    }
}

/**
 * Áp dụng tiến trình từ profile tài khoản vào game instance và cập nhật giao diện
 * @param {Object} profile - Dữ liệu profile từ Supabase
 * @param {Object} game - Instance game chính
 */
export function applyProfileProgressToGame(profile, game) {
    if (!profile || !game) return;

    // Áp dụng dữ liệu tiến trình từ database vào game
    if (typeof profile.coins === 'number') {
        game.coins = profile.coins;
        try { localStorage.setItem('arena_player_coins', game.coins.toString()); } catch {}
    }

    if (Array.isArray(profile.unlocked_weapons) && profile.unlocked_weapons.length > 0) {
        game.unlockedWeapons = [...profile.unlocked_weapons];
        try { localStorage.setItem('arena_unlocked_weapons', JSON.stringify(game.unlockedWeapons)); } catch {}
    }

    if (profile.weapon_tiers && typeof profile.weapon_tiers === 'object') {
        game.th_weaponTiers = { ...profile.weapon_tiers };
        try { localStorage.setItem('th_arena_weapon_tiers', JSON.stringify(game.th_weaponTiers)); } catch {}
    }

    if (profile.weapon_enchants && typeof profile.weapon_enchants === 'object') {
        game.th_weaponEnchants = { ...profile.weapon_enchants };
        try { localStorage.setItem('th_arena_weapon_enchants', JSON.stringify(game.th_weaponEnchants)); } catch {}
    }

    if (profile.weapon_parts && typeof profile.weapon_parts === 'object') {
        game.th_weaponParts = { ...profile.weapon_parts };
        try { localStorage.setItem('th_weapon_parts', JSON.stringify(game.th_weaponParts)); } catch {}
    }

    if (profile.character_id) {
        game.characterId = profile.character_id;
        try { localStorage.setItem('cyber_arena_character', game.characterId); } catch {}
    }

    if (Array.isArray(profile.unlocked_characters) && profile.unlocked_characters.length > 0) {
        try { localStorage.setItem('cyber_arena_unlocked_characters', JSON.stringify(profile.unlocked_characters)); } catch {}
    }

    if (profile.loadout && typeof profile.loadout === 'object') {
        try {
            localStorage.setItem('cyber_arena_loadout', JSON.stringify(profile.loadout));
            if (profile.loadout.primary) {
                localStorage.setItem('cyber_arena_weapon', profile.loadout.primary);
                if (game.weapons) game.weapons.startingWeaponId = profile.loadout.primary;
            }
        } catch {}
    }

    if (typeof profile.high_score === 'number' && profile.high_score > 0) {
        game.highScore = Math.max(game.highScore || 0, profile.high_score);
        try { localStorage.setItem('cyber_arena_highscore', game.highScore.toString()); } catch {}
    }

    // Làm mới UI đồng bộ
    game.updateCoinsUI?.();
    game.updateCharacterSelection?.();
    if (game.homeMenu?.showroom) {
        game.homeMenu.showroom.syncSelection();
        game.homeMenu.showroom.renderDetails();
        game.homeMenu.showroom.renderArmoryWeapons?.();
    }
    game.homeMenu?.preview();
}

/**
 * Đặt lại dữ liệu game về trạng thái Khách mặc định khi đăng xuất
 * @param {Object} game - Instance game chính
 */
export function resetGameProgressToGuest(game) {
    if (!game) return;
    game.coins = 1000;
    game.unlockedWeapons = ['blaster', 'repeater', 'scatter'];
    game.th_weaponTiers = {};
    game.th_weaponEnchants = {};
    game.th_weaponParts = {};
    game.characterId = 'police';
    game.highScore = 0;

    try {
        localStorage.setItem('arena_player_coins', '1000');
        localStorage.setItem('arena_unlocked_weapons', JSON.stringify(['blaster', 'repeater', 'scatter']));
        localStorage.setItem('th_arena_weapon_tiers', '{}');
        localStorage.setItem('th_arena_weapon_enchants', '{}');
        localStorage.setItem('th_weapon_parts', '{}');
        localStorage.setItem('cyber_arena_character', 'police');
        localStorage.setItem('cyber_arena_unlocked_characters', JSON.stringify(['police']));
        localStorage.setItem('cyber_arena_loadout', JSON.stringify({ primary: 'blaster_c', knife: 'tactical_knife' }));
        localStorage.setItem('cyber_arena_weapon', 'blaster_c');
        localStorage.setItem('cyber_arena_highscore', '0');
    } catch {}

    game.updateCoinsUI?.();
    game.updateCharacterSelection?.();
    if (game.homeMenu?.showroom) {
        game.homeMenu.showroom.syncSelection();
        game.homeMenu.showroom.renderDetails();
        game.homeMenu.showroom.renderArmoryWeapons?.();
    }
    game.homeMenu?.preview?.();
}

// ============================================================
// REALTIME PROFILE SUBSCRIPTION & AUTO REFRESH
// ============================================================

let _profileRealtimeChannel = null;

/**
 * Đăng ký lắng nghe các thay đổi thời gian thực trên bảng profiles của chính user
 * @param {string} userId
 */
export function subscribeProfileRealtime(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) return;

    if (_profileRealtimeChannel) {
        try { client.removeChannel(_profileRealtimeChannel); } catch {}
        _profileRealtimeChannel = null;
    }

    _profileRealtimeChannel = client
        .channel(`realtime-profile-${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`
            },
            (payload) => {
                const updated = payload.new;
                if (!updated) return;
                _currentProfile = { ...(_currentProfile || {}), ...updated };
                if (typeof window !== 'undefined' && window.game) {
                    applyProfileProgressToGame(_currentProfile, window.game);
                }
                notifyListeners();
            }
        )
        .subscribe();
}

/**
 * Hủy đăng ký kênh Realtime Profile khi đăng xuất
 */
export function unsubscribeProfileRealtime() {
    if (_profileRealtimeChannel) {
        const client = getSupabaseClient();
        if (client) {
            try { client.removeChannel(_profileRealtimeChannel); } catch {}
        }
        _profileRealtimeChannel = null;
    }
}

/**
 * Tải lại hồ sơ người dùng từ Supabase và làm mới giao diện game
 */
export async function refreshCurrentProfile() {
    if (!_currentUser) return null;
    const profile = await fetchProfile(_currentUser.id);
    if (profile) {
        _currentProfile = { ...(_currentProfile || {}), ...profile };
        if (typeof window !== 'undefined' && window.game) {
            applyProfileProgressToGame(_currentProfile, window.game);
        }
        notifyListeners();
    }
    return _currentProfile;
}

// Tự động nạp lại dữ liệu mới nhất từ database khi người chơi quay lại tab game
if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
        if (_currentUser) refreshCurrentProfile();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && _currentUser) {
            refreshCurrentProfile();
        }
    });
}

