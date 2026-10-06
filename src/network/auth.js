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
            .select('id, email, full_name, avatar_url, role, created_at')
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
                // Dọn sạch hash chứa token sau khi đã lưu phiên an toàn
                if (typeof window !== 'undefined' && (window.location.hash?.includes('access_token') || window.location.search?.includes('code='))) {
                    setTimeout(() => {
                        window.history.replaceState(null, '', window.location.pathname);
                    }, 500);
                }
            } else {
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
