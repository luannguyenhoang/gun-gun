// Quản lý lưu trữ và đồng bộ trạng thái phòng nhiều người chơi qua Supabase Database
import { getSupabaseClient } from './auth.js?v=49';

/**
 * Đọc thông tin phòng từ cơ sở dữ liệu Supabase theo mã phòng
 * @param {string} code Mã phòng 4-6 ký tự
 * @returns {Promise<object|null>}
 */
export async function getDbRoom(code) {
    const client = getSupabaseClient();
    if (!client || !code) return null;
    try {
        const { data, error } = await client
            .from('rooms')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle();
        if (error) {
            console.warn('[DbRoom] Lỗi truy vấn phòng:', error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('[DbRoom] Ngoại lệ khi lấy phòng:', err);
        return null;
    }
}

/**
 * Tạo bản ghi phòng mới trên cơ sở dữ liệu Supabase
 * @param {object} params Thông tin phòng và chủ phòng
 * @returns {Promise<{ room: object, player: object }>}
 */
export async function createDbRoom({ code, hostName, character = 'soldier', team = 'blue', weapon = 'blaster_c', loadout = null, mode = 'TDM', fillBots = false }) {
    const client = getSupabaseClient();
    const cleanCode = code.trim().toUpperCase();
    const cleanHostName = (hostName || 'Chủ phòng').trim().slice(0, 24) || 'Chủ phòng';

    const hostPlayer = {
        id: 'host',
        name: cleanHostName,
        character: character || 'soldier',
        team: team === 'red' ? 'red' : 'blue',
        weapon: weapon || 'blaster_c',
        loadout: loadout || null,
        is_host: true,
        joined_at: new Date().toISOString()
    };

    const roomData = {
        code: cleanCode,
        host_id: 'host',
        host_name: cleanHostName,
        mode: mode || 'TDM',
        status: 'waiting',
        max_players: 8,
        fill_bots: !!fillBots,
        players: [hostPlayer],
        epoch: Date.now(),
        updated_at: new Date().toISOString()
    };

    if (!client) {
        // Fallback khi không có kết nối cơ sở dữ liệu
        return { room: roomData, player: hostPlayer };
    }

    try {
        // Xóa phòng cũ nếu bị trùng mã hoặc ghi đè
        await client.from('rooms').delete().eq('code', cleanCode);

        const { data, error } = await client
            .from('rooms')
            .insert(roomData)
            .select()
            .single();

        if (error) {
            console.warn('[DbRoom] Không thể lưu phòng vào DB, sử dụng chế độ cục bộ:', error.message);
            return { room: roomData, player: hostPlayer };
        }
        return { room: data, player: hostPlayer };
    } catch (err) {
        console.warn('[DbRoom] Ngoại lệ khi tạo phòng DB:', err);
        return { room: roomData, player: hostPlayer };
    }
}

/**
 * Tham gia vào phòng đã lưu trên cơ sở dữ liệu Supabase
 * @param {object} params Thông tin người chơi tham gia
 * @returns {Promise<{ room: object, player: object }>}
 */
export async function joinDbRoom({ code, playerName, character = 'soldier', team = null, weapon = 'blaster_c', loadout = null }) {
    const client = getSupabaseClient();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
        throw new Error('Vui lòng nhập mã phòng hợp lệ.');
    }

    if (!client) {
        throw new Error('Chưa kết nối dịch vụ cơ sở dữ liệu.');
    }

    // 1. Kiểm tra sự tồn tại và trạng thái phòng trong DB
    const { data: room, error } = await client
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

    if (error || !room) {
        throw new Error('Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng.');
    }

    if (room.status === 'closed') {
        throw new Error('Phòng này đã đóng hoặc chủ phòng đã hủy phòng.');
    }

    if (room.status === 'playing') {
        throw new Error('Trận đấu đã bắt đầu. Vui lòng chờ trận mới hoặc chọn phòng khác.');
    }

    const currentPlayers = Array.isArray(room.players) ? [...room.players] : [];
    if (currentPlayers.length >= (room.max_players || 8)) {
        throw new Error(`Phòng đã đủ số lượng tối đa (${room.max_players || 8} người).`);
    }

    // 2. Tính toán phân bổ đội cân bằng
    const blueCount = currentPlayers.filter(p => p.team === 'blue').length;
    const redCount = currentPlayers.filter(p => p.team === 'red').length;
    let preferredTeam = team || (blueCount <= redCount ? 'blue' : 'red');
    if (preferredTeam === 'blue' && blueCount >= 4 && redCount < 4) {
        preferredTeam = 'red';
    } else if (preferredTeam === 'red' && redCount >= 4 && blueCount < 4) {
        preferredTeam = 'blue';
    }

    // 3. Khởi tạo thông tin người chơi mới
    const guestId = 'p' + Math.random().toString(36).substring(2, 8);
    const cleanName = (playerName || 'Đồng đội').trim().slice(0, 24) || 'Đồng đội';

    const newPlayer = {
        id: guestId,
        name: cleanName,
        character: character || 'soldier',
        team: preferredTeam,
        weapon: weapon || 'blaster_c',
        loadout: loadout || null,
        is_host: false,
        joined_at: new Date().toISOString()
    };

    currentPlayers.push(newPlayer);

    // 4. Cập nhật danh sách người chơi vào DB
    const { data: updatedRoom, error: updateErr } = await client
        .from('rooms')
        .update({
            players: currentPlayers,
            updated_at: new Date().toISOString()
        })
        .eq('code', cleanCode)
        .select()
        .single();

    if (updateErr) {
        console.warn('[DbRoom] Lỗi cập nhật danh sách người chơi DB:', updateErr.message);
        throw new Error('Không thể ghi danh vào phòng trên hệ thống.');
    }

    return { room: updatedRoom, player: newPlayer };
}

/**
 * Cập nhật danh sách đội hình và cấu hình phòng lên DB
 * @param {string} code Mã phòng
 * @param {object} updates Dữ liệu cần cập nhật (players, fillBots, mode)
 */
export async function updateDbRoomRoster(code, { players, fillBots, mode }) {
    const client = getSupabaseClient();
    if (!client || !code) return;
    try {
        const payload = { updated_at: new Date().toISOString() };
        if (Array.isArray(players)) payload.players = players;
        if (typeof fillBots === 'boolean') payload.fill_bots = fillBots;
        if (mode) payload.mode = mode;

        await client
            .from('rooms')
            .update(payload)
            .eq('code', code.trim().toUpperCase());
    } catch (err) {
        console.warn('[DbRoom] Lỗi cập nhật đội hình DB:', err);
    }
}

/**
 * Đánh dấu bắt đầu trận đấu trên DB
 * @param {string} code Mã phòng
 * @param {number} epoch Thời điểm bắt đầu trận
 */
export async function startDbRoom(code, epoch) {
    const client = getSupabaseClient();
    if (!client || !code) return;
    try {
        await client
            .from('rooms')
            .update({
                status: 'playing',
                epoch: epoch || Date.now(),
                updated_at: new Date().toISOString()
            })
            .eq('code', code.trim().toUpperCase());
    } catch (err) {
        console.warn('[DbRoom] Lỗi cập nhật bắt đầu trận DB:', err);
    }
}

/**
 * Rời phòng trên cơ sở dữ liệu Supabase
 * @param {string} code Mã phòng
 * @param {string} playerId Mã định danh người chơi
 * @returns {Promise<{ closed: boolean, newHost: object|null }>}
 */
export async function leaveDbRoom(code, playerId) {
    const client = getSupabaseClient();
    if (!client || !code || !playerId) return { closed: false, newHost: null };

    try {
        const cleanCode = code.trim().toUpperCase();
        const { data: room } = await client
            .from('rooms')
            .select('*')
            .eq('code', cleanCode)
            .maybeSingle();

        if (!room) return { closed: true, newHost: null };

        const currentPlayers = Array.isArray(room.players) ? room.players : [];
        const remainingPlayers = currentPlayers.filter(p => p.id !== playerId);

        // Nếu không còn ai trong phòng: đóng hoặc xóa phòng
        if (remainingPlayers.length === 0) {
            await client.from('rooms').delete().eq('code', cleanCode);
            return { closed: true, newHost: null };
        }

        // Nếu người rời phòng là chủ phòng: chuyển giao quyền chủ phòng cho người tiếp theo
        let newHost = null;
        const wasHost = (room.host_id === playerId) || (playerId === 'host');
        if (wasHost) {
            newHost = remainingPlayers[0];
            newHost.is_host = true;
            await client
                .from('rooms')
                .update({
                    host_id: newHost.id,
                    host_name: newHost.name,
                    players: remainingPlayers,
                    updated_at: new Date().toISOString()
                })
                .eq('code', cleanCode);
            return { closed: false, newHost };
        }

        // Người chơi thông thường rời phòng
        await client
            .from('rooms')
            .update({
                players: remainingPlayers,
                updated_at: new Date().toISOString()
            })
            .eq('code', cleanCode);

        return { closed: false, newHost: null };
    } catch (err) {
        console.warn('[DbRoom] Ngoại lệ khi rời phòng DB:', err);
        return { closed: false, newHost: null };
    }
}

/**
 * Lắng nghe thay đổi dữ liệu phòng thời gian thực qua Supabase Realtime
 * @param {string} code Mã phòng
 * @param {Function} onUpdate Hàm gọi khi có cập nhật dữ liệu phòng
 * @param {Function} onClosed Hàm gọi khi phòng bị đóng hoặc giải tán
 * @returns {object|null} Kênh realtime
 */
export function subscribeDbRoom(code, onUpdate, onClosed) {
    const client = getSupabaseClient();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!client || !cleanCode) return null;

    const channelName = `realtime-room-${cleanCode}-${Date.now()}`;
    const channel = client.channel(channelName);

    channel
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'rooms',
                filter: `code=eq.${cleanCode}`
            },
            (payload) => {
                if (payload.eventType === 'DELETE') {
                    onClosed?.();
                    return;
                }
                const record = payload.new;
                if (!record || record.status === 'closed') {
                    onClosed?.();
                    return;
                }
                onUpdate?.(record);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[DbRoom] Đã kết nối kênh Realtime DB cho phòng ${cleanCode}`);
            }
        });

    return channel;
}

/**
 * Hủy đăng ký kênh phòng Realtime
 * @param {object} channel Kênh Supabase Realtime
 */
export function unsubscribeDbRoom(channel) {
    if (channel && typeof channel.unsubscribe === 'function') {
        try {
            channel.unsubscribe();
        } catch (e) {
            console.warn('[DbRoom] Lỗi hủy kênh:', e);
        }
    }
}

/**
 * Lấy danh sách các phòng đang chờ mở công khai
 * @returns {Promise<Array>} Danh sách phòng chờ
 */
export async function listPublicRooms() {
    const client = getSupabaseClient();
    if (!client) return [];
    try {
        const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data, error } = await client
            .from('rooms')
            .select('code, host_name, mode, players, max_players, fill_bots, updated_at')
            .eq('status', 'waiting')
            .gt('updated_at', threshold)
            .order('updated_at', { ascending: false })
            .limit(10);

        if (error) {
            console.warn('[DbRoom] Lỗi tải danh sách phòng:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('[DbRoom] Ngoại lệ khi tải danh sách phòng:', err);
        return [];
    }
}
