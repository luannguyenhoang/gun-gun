import assert from 'node:assert/strict';
import { test } from 'node:test';

let mockData = null;
let updatedPayload = null;
let deletedCode = null;

const unifiedMockClient = {
    from(table) {
        assert.equal(table, 'rooms');
        return {
            select() {
                return {
                    eq() {
                        return {
                            maybeSingle: async () => ({ data: mockData, error: null }),
                            single: async () => ({ data: mockData, error: null })
                        };
                    }
                };
            },
            insert(payload) {
                return {
                    select() {
                        return {
                            single: async () => ({ data: payload, error: null })
                        };
                    }
                };
            },
            update(payload) {
                updatedPayload = payload;
                return {
                    eq() {
                        return {
                            select() {
                                return {
                                    single: async () => ({
                                        data: { ...mockData, ...updatedPayload },
                                        error: null
                                    })
                                };
                            },
                            then(resolve) {
                                resolve({ error: null });
                            }
                        };
                    }
                };
            },
            delete() {
                return {
                    eq(col, val) {
                        deletedCode = val;
                        return Promise.resolve({ error: null });
                    }
                };
            }
        };
    }
};

globalThis.document = { addEventListener() {} };
globalThis.window = {
    addEventListener() {},
    supabase: { createClient: () => unifiedMockClient }
};

const {
    createDbRoom,
    joinDbRoom,
    leaveDbRoom
} = await import('../../src/network/supabase-room.js?v=2');

test('createDbRoom tao phong thanh cong voi du lieu mac dinh', async () => {
    const res = await createDbRoom({
        code: 'TEST01',
        hostName: 'Chủ phòng Test',
        character: 'soldier',
        team: 'blue',
        mode: 'TDM',
        fillBots: false
    });

    assert.equal(res.room.code, 'TEST01');
    assert.equal(res.room.host_name, 'Chủ phòng Test');
    assert.equal(res.room.players.length, 1);
    assert.equal(res.room.players[0].is_host, true);
    assert.equal(res.room.players[0].team, 'blue');
});

test('joinDbRoom bao loi khi phong khong ton tai hoac ma phong rong', async () => {
    await assert.rejects(
        async () => {
            await joinDbRoom({ code: '' });
        },
        /Vui lòng nhập mã phòng hợp lệ/
    );
});

test('joinDbRoom kiem tra cac edge case: closed, playing, day nguoi va can bang doi', async () => {
    // Edge case 1: Phong khong ton tai
    mockData = null;
    await assert.rejects(
        async () => {
            await joinDbRoom({ code: 'ABCD', playerName: 'Khách' });
        },
        /Không tìm thấy phòng/
    );

    // Edge case 2: Phong da dong
    mockData = { code: 'ABCD', status: 'closed', players: [] };
    await assert.rejects(
        async () => {
            await joinDbRoom({ code: 'ABCD', playerName: 'Khách' });
        },
        /Phòng này đã đóng/
    );

    // Edge case 3: Tran da bat dau
    mockData = { code: 'ABCD', status: 'playing', players: [] };
    await assert.rejects(
        async () => {
            await joinDbRoom({ code: 'ABCD', playerName: 'Khách' });
        },
        /Trận đấu đã bắt đầu/
    );

    // Edge case 4: Phong da day 8 nguoi
    mockData = {
        code: 'ABCD',
        status: 'waiting',
        max_players: 8,
        players: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` }))
    };
    await assert.rejects(
        async () => {
            await joinDbRoom({ code: 'ABCD', playerName: 'Khách' });
        },
        /Phòng đã đủ số lượng tối đa/
    );

    // Edge case 5: Can bang doi hop le khi tham gia
    mockData = {
        code: 'ABCD',
        status: 'waiting',
        max_players: 8,
        players: [
            { id: 'host', name: 'Host', team: 'blue', is_host: true }
        ]
    };
    const joinResult = await joinDbRoom({ code: 'ABCD', playerName: 'BanMoi', team: 'blue' });
    assert.equal(joinResult.player.name, 'BanMoi');
    assert.equal(joinResult.player.team, 'blue');
    assert.equal(updatedPayload.players.length, 2);
});

test('leaveDbRoom chuyen giao chu phong khi host roi phong va xoa phong khi khong con ai', async () => {
    // Truong hop 1: Nguoi cuoi cung roi phong -> xoa phong
    deletedCode = null;
    mockData = {
        code: 'ROOM01',
        host_id: 'host',
        players: [{ id: 'host', is_host: true }]
    };
    const leave1 = await leaveDbRoom('ROOM01', 'host');
    assert.equal(leave1.closed, true);
    assert.equal(deletedCode, 'ROOM01');

    // Truong hop 2: Host roi phong khi con dong doi -> bau Tan Chu Phong
    deletedCode = null;
    mockData = {
        code: 'ROOM02',
        host_id: 'host',
        players: [
            { id: 'host', name: 'ChuPhongCu', is_host: true },
            { id: 'p2', name: 'DongDoiA', is_host: false }
        ]
    };
    const leave2 = await leaveDbRoom('ROOM02', 'host');
    assert.equal(leave2.closed, false);
    assert.equal(leave2.newHost.id, 'p2');
    assert.equal(leave2.newHost.is_host, true);
    assert.equal(updatedPayload.host_id, 'p2');
    assert.equal(updatedPayload.players.length, 1);
});
