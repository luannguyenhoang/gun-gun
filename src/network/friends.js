// Quản lý hệ thống Bạn bè, Trạng thái Online thời gian thực và Mời chơi (Supabase Presence & Broadcast)
import { getSupabaseClient, getCurrentUser, getCurrentProfile } from './auth.js';

let _presenceChannel = null;
let _inviteChannel = null;
let _onlineUserIds = new Set();
let _friendsList = [];
let _pendingRequests = [];
const _presenceListeners = new Set();
const _friendsListeners = new Set();
const _inviteListeners = new Set();

/**
 * Khởi tạo hệ thống bạn bè, Presence (Online/Offline) và lắng nghe lời mời chơi thời gian thực
 */
export function initFriendsSystem() {
    const client = getSupabaseClient();
    const user = getCurrentUser();
    if (!client || !user) {
        cleanupFriendsSystem();
        return;
    }

    setupPresenceChannel(client, user);
    setupInviteChannel(client, user);
    setupRealtimeFriendships(client, user);
    refreshFriendsData();
}

/**
 * Hủy các kênh realtime khi đăng xuất
 */
export function cleanupFriendsSystem() {
    if (_presenceChannel) {
        _presenceChannel.unsubscribe();
        _presenceChannel = null;
    }
    if (_inviteChannel) {
        _inviteChannel.unsubscribe();
        _inviteChannel = null;
    }
    _onlineUserIds.clear();
    _friendsList = [];
    _pendingRequests = [];
    notifyFriendsListeners();
    notifyPresenceListeners();
}

/**
 * Thiết lập kênh Supabase Presence để theo dõi ai đang online
 */
function setupPresenceChannel(client, user) {
    if (_presenceChannel) _presenceChannel.unsubscribe();

    const profile = getCurrentProfile();
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Người chơi';

    _presenceChannel = client.channel('gun-online-lobby', {
        config: { presence: { key: user.id } }
    });

    _presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = _presenceChannel.presenceState();
            const currentOnline = new Set();
            for (const key in state) {
                currentOnline.add(key);
            }
            _onlineUserIds = currentOnline;
            notifyPresenceListeners();
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await _presenceChannel.track({
                    user_id: user.id,
                    name: displayName,
                    avatar_url: profile?.avatar_url || '',
                    online_at: new Date().toISOString()
                });
            }
        });
}

/**
 * Thiết lập kênh nhận lời mời chơi cá nhân (Broadcast channel)
 */
function setupInviteChannel(client, user) {
    if (_inviteChannel) _inviteChannel.unsubscribe();

    _inviteChannel = client.channel(`gun-invites-${user.id}`);
    _inviteChannel
        .on('broadcast', { event: 'room-invite' }, ({ payload }) => {
            if (payload && payload.roomCode) {
                notifyInviteListeners(payload);
            }
        })
        .subscribe();
}

/**
 * Lắng nghe thay đổi dữ liệu bảng friendships thời gian thực (Postgres changes)
 */
function setupRealtimeFriendships(client, user) {
    client.channel(`friendships-changes-${user.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'friendships'
        }, () => {
            refreshFriendsData();
        })
        .subscribe();
}

/**
 * Nạp lại danh sách bạn bè và lời mời kết bạn từ cơ sở dữ liệu
 */
export async function refreshFriendsData() {
    const client = getSupabaseClient();
    const user = getCurrentUser();
    if (!client || !user) return;

    try {
        // Lấy tất cả các quan hệ kết bạn liên quan đến user hiện tại
        const { data, error } = await client
            .from('friendships')
            .select(`
                id,
                user_id,
                friend_id,
                status,
                created_at,
                updated_at
            `)
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (error) {
            console.warn('[Friends] Lỗi tải friendships:', error.message);
            return;
        }

        if (!data || data.length === 0) {
            _friendsList = [];
            _pendingRequests = [];
            notifyFriendsListeners();
            return;
        }

        // Lấy danh sách ID đối phương để query profile
        const otherUserIds = data.map(rel => rel.user_id === user.id ? rel.friend_id : rel.user_id);
        const { data: profiles, error: pError } = await client
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .in('id', otherUserIds);

        const profileMap = new Map();
        if (!pError && profiles) {
            for (const p of profiles) {
                profileMap.set(p.id, p);
            }
        }

        const accepted = [];
        const pending = [];

        for (const rel of data) {
            const isSender = rel.user_id === user.id;
            const targetId = isSender ? rel.friend_id : rel.user_id;
            const targetProfile = profileMap.get(targetId) || {
                id: targetId,
                email: 'Ẩn danh',
                full_name: 'Người chơi'
            };

            const item = {
                friendshipId: rel.id,
                targetUserId: targetId,
                email: targetProfile.email,
                fullName: targetProfile.full_name || targetProfile.email?.split('@')[0] || 'Người chơi',
                avatarUrl: targetProfile.avatar_url || '',
                isSender,
                status: rel.status,
                createdAt: rel.created_at
            };

            if (rel.status === 'accepted') {
                accepted.push(item);
            } else if (rel.status === 'pending') {
                pending.push(item);
            }
        }

        _friendsList = accepted;
        _pendingRequests = pending;
        notifyFriendsListeners();
    } catch (err) {
        console.warn('[Friends] Ngoại lệ khi làm mới bạn bè:', err);
    }
}

/**
 * Tìm kiếm người chơi theo email hoặc tên hiển thị
 */
export async function searchPlayers(query) {
    const client = getSupabaseClient();
    const user = getCurrentUser();
    if (!client || !user) return [];

    const keyword = query.trim();
    if (!keyword) return [];

    try {
        const { data, error } = await client
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .neq('id', user.id)
            .or(`email.ilike.%${keyword}%,full_name.ilike.%${keyword}%`)
            .limit(10);

        if (error) {
            console.warn('[Friends] Lỗi tìm kiếm người chơi:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.warn('[Friends] Ngoại lệ tìm kiếm:', err);
        return [];
    }
}

/**
 * Gửi lời mời kết bạn
 */
export async function sendFriendRequest(targetUserId) {
    const client = getSupabaseClient();
    const user = getCurrentUser();
    if (!client || !user) return { error: new Error('Bạn cần đăng nhập để kết bạn.') };
    if (user.id === targetUserId) return { error: new Error('Không thể tự kết bạn với chính mình.') };

    try {
        const { data, error } = await client
            .from('friendships')
            .insert({
                user_id: user.id,
                friend_id: targetUserId,
                status: 'pending'
            })
            .select()
            .single();

        if (!error) {
            refreshFriendsData();
        }
        return { data, error };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Chấp nhận lời mời kết bạn
 */
export async function acceptFriendRequest(friendshipId) {
    const client = getSupabaseClient();
    if (!client) return { error: new Error('Chưa đăng nhập.') };

    try {
        const { data, error } = await client
            .from('friendships')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', friendshipId)
            .select()
            .single();

        if (!error) {
            refreshFriendsData();
        }
        return { data, error };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Từ chối hoặc hủy kết bạn
 */
export async function removeFriendship(friendshipId) {
    const client = getSupabaseClient();
    if (!client) return { error: new Error('Chưa đăng nhập.') };

    try {
        const { error } = await client
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (!error) {
            refreshFriendsData();
        }
        return { error };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Gửi lời mời chơi thời gian thực tới bạn bè qua Supabase Realtime Broadcast
 */
export async function sendGameInvite(targetFriendId, roomCode) {
    const client = getSupabaseClient();
    const user = getCurrentUser();
    const profile = getCurrentProfile();
    if (!client || !user || !roomCode) {
        return { error: new Error('Thiếu thông tin phòng hoặc chưa đăng nhập.') };
    }

    try {
        const senderName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Chiến binh';
        const senderAvatar = profile?.avatar_url || '';

        const targetChannel = client.channel(`gun-invites-${targetFriendId}`);
        await targetChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await targetChannel.send({
                    type: 'broadcast',
                    event: 'room-invite',
                    payload: {
                        fromId: user.id,
                        fromName: senderName,
                        fromAvatar: senderAvatar,
                        roomCode: roomCode,
                        timestamp: Date.now()
                    }
                });
            }
        });

        return { success: true };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Kiểm tra xem một người chơi có đang Online không
 */
export function isUserOnline(userId) {
    return _onlineUserIds.has(userId);
}

/**
 * Lấy danh sách bạn bè đã chấp nhận
 */
export function getFriendsList() {
    return _friendsList;
}

/**
 * Lấy danh sách lời mời kết bạn đang chờ
 */
export function getPendingRequests() {
    return _pendingRequests;
}

/**
 * Đăng ký lắng nghe thay đổi trạng thái Online (Presence)
 */
export function onPresenceUpdate(listener) {
    _presenceListeners.add(listener);
    listener(_onlineUserIds);
    return () => _presenceListeners.delete(listener);
}

/**
 * Đăng ký lắng nghe thay đổi danh sách bạn bè / lời mời
 */
export function onFriendsUpdate(listener) {
    _friendsListeners.add(listener);
    listener({ friends: _friendsList, pending: _pendingRequests });
    return () => _friendsListeners.delete(listener);
}

/**
 * Đăng ký lắng nghe lời mời chơi thời gian thực
 */
export function onGameInvite(listener) {
    _inviteListeners.add(listener);
    return () => _inviteListeners.delete(listener);
}

function notifyPresenceListeners() {
    for (const listener of _presenceListeners) {
        try {
            listener(_onlineUserIds);
        } catch (err) {
            console.error('[Friends] Presence listener error:', err);
        }
    }
}

function notifyFriendsListeners() {
    for (const listener of _friendsListeners) {
        try {
            listener({ friends: _friendsList, pending: _pendingRequests });
        } catch (err) {
            console.error('[Friends] Friends listener error:', err);
        }
    }
}

function notifyInviteListeners(inviteData) {
    for (const listener of _inviteListeners) {
        try {
            listener(inviteData);
        } catch (err) {
            console.error('[Friends] Invite listener error:', err);
        }
    }
}
