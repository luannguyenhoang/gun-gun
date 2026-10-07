// Deterministic transport for browser regression tests when PeerJS signaling is unavailable.
// Exercises the real NetworkRoom protocol and multiple independent game instances.
module.exports = function installLocalPeer() {
    class Emitter {
        on(event, callback) { (this.handlers ||= {})[event] ||= []; this.handlers[event].push(callback); }
        emit(event, data) { for (const callback of this.handlers?.[event] || []) callback(data); }
    }
    class Connection extends Emitter {
        constructor(peer, remote, id) { super(); this.peer = peer; this.remote = remote; this.id = id; this.open = false; }
        send(data) { this.peer.channel.postMessage({ to: this.remote, from: this.peer.id, id: this.id, type: 'data', data }); }
        close() { this.open = false; this.emit('close'); }
    }
    window.Peer = class extends Emitter {
        constructor(id = crypto.randomUUID()) {
            // PeerJS accepts options as its first argument for anonymous peers.
            if (typeof id !== 'string') id = crypto.randomUUID();
            super(); this.id = id; this.connections = new Map();
            this.channel = new BroadcastChannel('multiplayer-regression');
            this.channel.onmessage = ({ data: message }) => {
                if (message.to !== this.id) return;
                if (message.type === 'connect') {
                    const connection = new Connection(this, message.from, message.id);
                    connection.open = true; this.connections.set(message.id, connection);
                    this.emit('connection', connection);
                    this.channel.postMessage({ to: message.from, from: this.id, id: message.id, type: 'open' });
                } else {
                    const connection = this.connections.get(message.id);
                    if (message.type === 'open') { connection.open = true; connection.emit('open'); }
                    if (message.type === 'data') connection.emit('data', message.data);
                }
            };
            setTimeout(() => this.emit('open', id), 0);
        }
        connect(remote) {
            const id = crypto.randomUUID(), connection = new Connection(this, remote, id);
            this.connections.set(id, connection);
            this.channel.postMessage({ to: remote, from: this.id, id, type: 'connect' });
            return connection;
        }
        destroy() { this.channel.close(); }
    };
};
