import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const read = file => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const stripImports = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '');
const Game = vm.runInNewContext(stripImports(read('app/main.js')).split('// Instantiate game on page load')[0] + '\nCyberArenaGame;');

function friendsHarness(send) {
    const channels = [], removed = [];
    const user = { id: 'sender', email: 'sender@example.com' };
    const client = {
        channel(name) {
            const channel = { name, listeners: [], subscriptions: 0, unsubscribed: 0,
                on(type, filter, callback) { this.listeners.push({ type, callback }); return this; },
                subscribe() { this.subscriptions++; return this; },
                unsubscribe() { this.unsubscribed++; },
                httpSend: send,
            };
            channels.push(channel);
            return channel;
        },
        async removeChannel(channel) { removed.push(channel); },
        from() { return { select() { return { or: async () => ({ data: [] }) }; } }; }
    };
    const source = stripImports(read('network/friends.js')).replace(/^export /gm, '');
    const api = vm.runInNewContext(source + '\n({sendGameInvite,initFriendsSystem,cleanupFriendsSystem,onGameInvite});', {
        getSupabaseClient: () => client, getCurrentUser: () => user, getCurrentProfile: () => null,
        setTimeout, clearTimeout, console
    });
    return { ...api, channels, removed };
}

test('invites send immediately without subscribing and report success only after the HTTP response', async () => {
    let finish, payload;
    const friends = friendsHarness((event, body) => {
        assert.equal(event, 'room-invite');
        payload = body;
        return new Promise(resolve => { finish = resolve; });
    });
    let done = false;
    const result = friends.sendGameInvite('recipient', ' ab12 ').then(value => { done = true; return value; });
    const duplicate = friends.sendGameInvite('recipient', 'AB12');
    await Promise.resolve();
    assert.equal(done, false);
    assert.equal(friends.channels.length, 1);
    assert.equal(friends.channels[0].subscriptions, 0);
    assert.equal(payload.roomCode, 'AB12');
    finish({ success: true });
    assert.equal((await result).success, true);
    assert.equal((await duplicate).success, true);
    assert.equal(friends.removed.length, 1);
});

test('failed invite reports an error, releases its channel, and permits retry', async () => {
    let attempt = 0;
    const friends = friendsHarness(async () => ++attempt === 1 ? { success: false } : { success: true });
    assert.ok((await friends.sendGameInvite('recipient', 'AB12')).error);
    assert.equal((await friends.sendGameInvite('recipient', 'AB12')).success, true);
    assert.equal(friends.removed.length, 2);
});

test('profile refresh preserves invitation subscription; sign-out closes all listeners', () => {
    const friends = friendsHarness(async () => ({ success: true }));
    friends.initFriendsSystem();
    friends.initFriendsSystem();
    assert.equal(friends.channels.length, 3);
    const inviteChannel = friends.channels.find(channel => channel.name === 'gun-invites-sender');
    let received = 0;
    friends.onGameInvite(() => received++);
    inviteChannel.listeners[0].callback({ payload: { roomCode: 'AB12' } });
    assert.equal(received, 1);
    friends.cleanupFriendsSystem();
    assert.ok(friends.channels.every(channel => channel.unsubscribed === 1));
    inviteChannel.listeners[0].callback({ payload: { roomCode: 'AB12' } });
    assert.equal(received, 1);
});

test('accept joins directly even when the manual join button is disabled, retaining errors for retry', async () => {
    const status = { textContent: '' };
    const Home = vm.runInNewContext(stripImports(read('ui/home.js')).replace('export class', 'class') + '\nHomeMenu;', {
        document: { getElementById: () => status }, sounds: { play() {} }
    });
    let finish, calls = 0;
    const home = Object.assign(Object.create(Home.prototype), {
        incomingRoomCode: 'AB12', incomingInviteTime: Date.now(),
        btnInviteAccept: {}, inviteModal: { style: { display: 'block' } },
        dialog: { open: true, close() { this.open = false; } },
        game: {
            roomJoin: { disabled: true, click() { assert.fail('must not click disabled join button'); } },
            roomStatus: { textContent: 'Phòng đã đầy' },
            joinRoom(code) { assert.equal(code, 'AB12'); calls++; return new Promise(resolve => { finish = resolve; }); }
        }
    });
    const joining = home.acceptGameInvite();
    await home.acceptGameInvite();
    assert.equal(calls, 1);
    assert.equal(home.btnInviteAccept.disabled, true);
    finish(null);
    await joining;
    assert.equal(status.textContent, 'Phòng đã đầy');
    assert.equal(home.inviteModal.style.display, 'block');
    assert.equal(home.btnInviteAccept.disabled, false);
    const retry = home.acceptGameInvite();
    finish({ code: 'AB12' });
    await retry;
    assert.equal(home.inviteModal.style.display, 'none');
});

test('joining another room leaves the old room before connecting and blocks double acceptance', async () => {
    const calls = [];
    let finish;
    const game = {
        state: 'MENU', roomCode: {}, roomName: { value: 'Guest' },
        showRoomError() {},
        network: {
            active: true, code: 'OLD1',
            leave() { calls.push('leave'); this.active = false; },
            join(code) { calls.push(code); return new Promise(resolve => { finish = resolve; }); }
        }
    };
    const pending = Game.prototype.joinRoom.call(game, ' ab12 ');
    assert.deepEqual(calls, ['leave', 'AB12']);
    assert.equal(await Game.prototype.joinRoom.call(game, 'AB12'), null);
    finish({ code: 'AB12' });
    assert.equal((await pending).code, 'AB12');
    assert.equal(game.roomActionPending, false);
});

test('room reset strips the room URL even when no connection is active', () => {
    let url = '/?room=AB12';
    const GameWithBrowser = vm.runInNewContext(stripImports(read('app/main.js')).split('// Instantiate game on page load')[0] + '\nCyberArenaGame;', {
        window: { location: { pathname: '/' }, history: { replaceState(_state, _title, path) { url = path; } } },
        document: { getElementById: () => null }
    });
    let reset = false;
    GameWithBrowser.prototype.resetRoomUI.call({ homeMenu: { room(data) { assert.equal(data, null); reset = true; } } });
    assert.equal(url, '/');
    assert.equal(reset, true);
});

function networkHarness(joinDbRoom = async () => { throw new Error('Room not found'); }) {
    const timers = new Set(), peers = [], shown = [], left = [];
    class Peer {
        handlers = {};
        constructor() { peers.push(this); }
        on(event, fn) { this.handlers[event] = fn; }
        connect() { return this.connection = new Peer(); }
        send() {}
        close() { this.handlers.close?.(); }
        destroy() { this.destroyed = true; }
    }
    const Network = vm.runInNewContext(stripImports(read('network/network.js')).replace(/^export /gm, '') + '\nNetworkRoom;', {
        getClientUserId: () => 'guest', deduplicatePlayers: players => players,
        joinDbRoom, createDbRoom: async () => ({}),
        leaveDbRoom: async (...args) => left.push(args),
        subscribeDbRoom: () => null, unsubscribeDbRoom() {},
        setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); },
        window: { Peer }, console
    });
    const game = { selectedGameMode: 'SURVIVAL', player: { setCharacter() {} }, weapons: {},
        resetRoomUI() { shown.push(null); }, showRoomState(data) { shown.push(data); }, showRoomError(message) { game.error = message; }
    };
    const room = new Network(game);
    room.updateRoster = () => {};
    room.startTicker = () => {};
    return { room, peers, shown, left, timers, game };
}

test('failed DB registration cannot turn into a successful empty lobby on timeout', async () => {
    const { room, timers, shown } = networkHarness();
    const joining = room.join('AB12', 'Guest');
    const failure = assert.rejects(joining, /Không thể kết nối tới chủ phòng/);
    await new Promise(setImmediate);
    assert.equal(shown.length, 0);
    for (const timeout of [...timers]) timeout();
    await failure;
    assert.equal(room.active, false);
    assert.equal(room.code, '');
});

test('host rejection rejects the invitation instead of resolving it as accepted', async () => {
    const { room, peers } = networkHarness();
    const joining = room.join('AB12', 'Guest');
    const failure = assert.rejects(joining, /Phòng đã đầy/);
    await new Promise(setImmediate);
    peers[0].handlers.open();
    peers[0].connection.handlers.data({ type: 'reject', reason: 'Phòng đã đầy' });
    await failure;
    assert.equal(room.active, false);
});

test('a database roster without a host connection cannot be reported as a successful join', async () => {
    const { room, peers, shown } = networkHarness(async () => ({
        room: { code: 'AB12', players: [{ id: 'host' }, { id: 'guest' }] }, player: { id: 'guest' }
    }));
    const joining = room.join('AB12', 'Guest');
    const failure = assert.rejects(joining, /Không thể kết nối tới chủ phòng/);
    await new Promise(setImmediate);
    assert.equal(shown.length, 0);
    peers[0].handlers.error(new Error('peer unavailable'));
    await failure;
    assert.equal(room.active, false);
});

test('host acceptance returns the latest roster, without restoring the original DB snapshot', async () => {
    const { room, peers, shown } = networkHarness();
    const joining = room.join('AB12', 'Guest');
    await new Promise(setImmediate);
    peers[0].handlers.open();
    const players = [{ id: 'host' }, { id: 'guest' }];
    peers[0].connection.handlers.data({ type: 'accept', players, you: 'guest', mode: 'SURVIVAL' });
    assert.equal((await joining).players, players);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].players, players);
    room.leave();
});

test('returning home cancels pending joins and ignores late peer events', async () => {
    const { room, peers, shown, timers } = networkHarness();
    const joining = room.join('AB12', 'Guest');
    const failure = assert.rejects(joining, /Đã hủy vào phòng/);
    await new Promise(setImmediate);
    peers[0].handlers.open();
    const connection = peers[0].connection;
    room.leave();
    connection.handlers.data({ type: 'accept', players: [{ id: 'guest' }] });
    await failure;
    assert.equal(room.active, false);
    assert.equal(room.code, '');
    assert.deepEqual(shown, [null]);
    assert.equal(timers.size, 0);
});

test('returning home while the DB join is pending cleans up the eventual registration', async () => {
    let finish;
    const { room, peers, left } = networkHarness(() => new Promise(resolve => { finish = resolve; }));
    const joining = room.join('AB12', 'Guest');
    const failure = assert.rejects(joining, /Đã hủy vào phòng/);
    room.leave();
    finish({ room: { code: 'AB12' }, player: { id: 'guest' } });
    await failure;
    assert.equal(peers.length, 0);
    assert.deepEqual(left, [['AB12', 'guest']]);
});

test('known closed/full/playing rooms fail immediately without creating a peer', async () => {
    const { room, peers } = networkHarness(async () => {
        throw Object.assign(new Error('Phòng đã đóng'), { code: 'ROOM_UNAVAILABLE' });
    });
    await assert.rejects(room.join('AB12', 'Guest'), /Phòng đã đóng/);
    assert.equal(peers.length, 0);
    assert.equal(room.active, false);
});

test('leaving an inactive room still resets the homepage URL and UI', () => {
    const { room, shown } = networkHarness();
    room.leave();
    assert.deepEqual(shown, [null]);
});
