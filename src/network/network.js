import * as THREE from 'three';
import * as SkeletonUtils from '../../vendor/SkeletonUtils.js';
import { HealthBar3D } from '../rendering/healthbar.js';
import { CHARACTER_CONFIGS, normalizeCharacter } from '../gameplay/player/characters.js';
import { getStartingWeapon } from '../gameplay/combat/weapons.js';
import { createRoomTicker } from './room-ticker.js';

// Cấu hình STUN Server của Google giúp đục lỗ NAT khi chơi qua mạng Internet (4G, Wifi khác nhà)
const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
};

const MAX_ROOM_PLAYERS = 4;
const PROTOCOL_VERSION = 2;

export class NetworkRoom {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.host = false;
        this.code = '';
        this.playerId = '';
        this.seq = 0;
        this.pendingCommands = [];
        this.pollTimer = 0;
        this.error = '';
        
        this.peer = null;
        this.conn = null;
        this.connections = [];
        this.players = [];
        this.startedEpoch = null;
        this.inputSeq = 0;
        this.snapshotSeq = 0;
        this.lastSnapshotSeq = 0;
        this.stopTicker = null;
    }

    startTicker() {
        this.stopTicker?.();
        this.pollTimer = 0;
        this.stopTicker = createRoomTicker(delta => {
            if (!this.active) return;
            this.game.updateRoomBackground?.(delta);
            this.update(delta);
        });
    }

    async create(name, character = 'police') {
        return new Promise((resolve, reject) => {
            const code = Math.random().toString(36).substring(2, 6).toUpperCase();
            this.peer = new window.Peer('gungun-room-' + code, PEER_CONFIG);
            
            this.peer.on('open', (id) => {
                this.active = true;
                this.host = true;
                this.code = code;
                this.playerId = 'host';
                this.startedEpoch = null;
                this.epoch = Date.now();
                this.connections = [];
                this.players = [{ id: 'host', name, character, weapon: this.game.weapons.startingWeaponId }];
                
                this.game.player.setCharacter(character);
                this.game.player.cooperative = true;
                this.game.weapons.onCommand = null;
                const roomData = { code, host: 'host', you: 'host', players: this.players, isHost: true };
                this.game.showRoomState(roomData);
                this.startTicker();
                resolve(roomData);
            });

            this.peer.on('error', (err) => {
                reject(new Error("Không thể tạo phòng, có thể lỗi mạng: " + err.message));
            });
            
            this.peer.on('connection', (conn) => {
                let pId = 'p' + Math.random().toString(36).substring(2, 8);
                let pName = 'Player';
                let pChar = 'police';
                let clientState = { id: pId, conn, input: {}, commands: [], ack: 0 };
                this.connections.push(clientState);
                
                conn.on('data', (data) => {
                    if (data.type === 'join') {
                        if (data.protocol !== PROTOCOL_VERSION) {
                            conn.send({ type: 'reject', reason: 'Khác phiên bản game. Hãy tải lại trang trên tất cả máy rồi tạo phòng mới.' });
                            setTimeout(() => { try { conn.close(); } catch {} }, 500);
                            return;
                        }
                        if (this.players.some(p => p.id === pId)) return;
                        if (this.players.length >= MAX_ROOM_PLAYERS) {
                            conn.send({ type: 'reject', reason: `Phòng đã đầy (tối đa ${MAX_ROOM_PLAYERS} người)!` });
                            setTimeout(() => { try { conn.close(); } catch {} }, 500);
                            return;
                        }
                        pName = data.name;
                        pChar = data.character;
                        this.players.push({ id: pId, name: pName, character: pChar, weapon: getStartingWeapon(data.weapon).id, loadout: data.loadout });
                        clientState.joined = true;
                        conn.send({ type: 'accept', protocol: PROTOCOL_VERSION, you: pId, epoch: this.epoch, players: this.players, host: 'host' });
                        this.broadcastRoster();
                    } else if (data.type === 'character') {
                        const p = this.players.find(pl => pl.id === pId);
                        if (p) {
                            p.character = data.character;
                            this.broadcastRoster();
                        }
                    } else if (data.type === 'weapon' && this.game.state === 'MENU') {
                        const p = this.players.find(pl => pl.id === pId);
                        if (p) { p.weapon = getStartingWeapon(data.weapon).id; p.loadout = data.loadout; this.broadcastRoster(); }
                    } else if (data.type === 'sync') {
                        if (data.epoch !== this.startedEpoch) return;
                        if (!this.players.some(p => p.id === pId)) return;
                        if (!Number.isSafeInteger(data.inputSeq) || data.inputSeq <= (clientState.inputSeq || 0)) return;
                        clientState.inputSeq = data.inputSeq;
                        clientState.input = data.input;
                        // Apply immediately, even if the host is not rendering.
                        this.applyInputs({ [pId]: data.input });
                        if (data.commands && data.commands.length > 0) {
                            this.applyCommands([{ player: pId, commands: data.commands }]);
                        }
                    }
                });
                
                conn.on('close', () => {
                    this.connections = this.connections.filter(c => c.conn !== conn);
                    this.players = this.players.filter(p => p.id !== pId);
                    this.broadcastRoster();
                });
            });
        });
    }

    broadcastRoster() {
        const data = { type: 'roster', players: this.players, host: 'host' };
        for (const c of this.connections) {
            if (c.joined && c.conn.open) {
                try { c.conn.send(data); } catch (e) { console.warn('[NetworkHost] Lỗi gửi roster:', e); }
            }
        }
        this.updateRoster(this.players);
        this.game.showRoomState({ code: this.code, host: 'host', you: 'host', players: this.players, isHost: true });
    }

    async join(code, name, character = 'police') {
        return new Promise((resolve, reject) => {
            code = code.toUpperCase();
            this.peer = new window.Peer(PEER_CONFIG);
            
            this.peer.on('open', (id) => {
                this.conn = this.peer.connect('gungun-room-' + code, { reliable: true });
                
                this.conn.on('open', () => {
                    this.conn.send({ type: 'join', protocol: PROTOCOL_VERSION, name, character, weapon: this.game.weapons.startingWeaponId, loadout: this.game.getLoadout?.() });
                });
                
                this.conn.on('data', (data) => {
                    if (data.type === 'reject') {
                        this.game.showRoomError(data.reason || 'Không thể vào phòng!');
                        reject(new Error(data.reason || 'Phòng đã đầy!'));
                        return;
                    }
                    if (data.type === 'accept') {
                        if (data.protocol !== PROTOCOL_VERSION) {
                            const reason = 'Khác phiên bản game. Hãy tải lại trang trên tất cả máy rồi tạo phòng mới.';
                            this.game.showRoomError(reason);
                            reject(new Error(reason));
                            this.conn.close();
                            this.peer.destroy();
                            return;
                        }
                        this.active = true;
                        this.host = false;
                        this.code = code;
                        this.playerId = data.you;
                        this.startedEpoch = null;
                        this.epoch = data.epoch;
                        
                        this.game.player.setCharacter(character);
                        this.game.player.cooperative = true;
                        this.game.weapons.onCommand = (cmd) => this.sendCommand(cmd);
                        
                        this.updateRoster(data.players || []);
                        const roomData = { code, host: data.host || 'host', you: data.you, players: data.players || [], isHost: false };
                        this.game.showRoomState(roomData);
                        this.startTicker();
                        resolve(roomData);
                    } else if (data.type === 'roster') {
                        this.updateRoster(data.players || []);
                        this.game.showRoomState({ code: this.code, host: data.host || 'host', you: this.playerId, players: data.players || [], isHost: false });
                    } else if (data.type === 'start') {
                        this.beginMatch(data.epoch);
                    } else if (data.type === 'snapshot') {
                        if (!data.started || !data.snapshot) return;
                        if (!this.beginMatch(data.epoch)) return;
                        if (!Number.isSafeInteger(data.snapshotSeq) || data.snapshotSeq <= this.lastSnapshotSeq) return;
                        this.lastSnapshotSeq = data.snapshotSeq;
                        try {
                            this.game.applyCoopSnapshot(data.snapshot, this.playerId);
                        } catch (err) {
                            console.warn('[NetworkClient] Lỗi khi áp dụng snapshot:', err);
                        }
                        if (data.ack) {
                            this.pendingCommands = this.pendingCommands.filter(c => c.seq > data.ack);
                        }
                    }
                });
                
                this.conn.on('close', () => {
                    this.active = false;
                    this.stopTicker?.();
                    this.stopTicker = null;
                    this.game.showRoomError('Mất kết nối với Host.');
                });
                
                this.conn.on('error', (err) => reject(new Error("Lỗi kết nối: " + err.message)));
            });
            this.peer.on('error', (err) => reject(new Error("Lỗi mạng PeerJS: " + err.message)));
        });
    }

    beginMatch(epoch) {
        if (!Number.isSafeInteger(epoch) || (this.startedEpoch !== null && epoch < this.startedEpoch)) return false;
        if (this.startedEpoch === epoch) return true;
        this.epoch = epoch;
        this.startedEpoch = epoch;
        this.pendingCommands = [];
        this.seq = 0;
        this.inputSeq = 0;
        this.snapshotSeq = 0;
        this.lastSnapshotSeq = 0;
        this.pollTimer = 0;
        this.game.startGame(true);
        return true;
    }

    async start() {
        if (!this.host) return;
        this.beginMatch(Math.max(Date.now(), (this.epoch || 0) + 1));
        for (const c of this.connections) { c.input = {}; c.ack = 0; c.inputSeq = 0; }
        this.game.showRoomState({ code: this.code, host: 'host', you: 'host', players: this.players, isHost: true, started: true });
        const data = { type: 'start', epoch: this.epoch };
        for (const c of this.connections) {
            if (c.joined && c.conn.open) {
                try { c.conn.send(data); } catch (e) { console.warn('[NetworkHost] Lỗi gửi start:', e); }
            }
        }
    }

    sendCommand(command) {
        if (!this.active || this.host) return;
        command.seq = ++this.seq;
        this.pendingCommands.push(command);
    }

    update(delta) {
        if (!this.active) return;
        this.pollTimer -= delta;
        if (this.pollTimer > 0) return;
        
        // Polling rate of 33ms (30fps) for syncing
        this.pollTimer = Math.max(0, this.pollTimer + 0.033);
        
        if (this.host) {
            const inputs = {};
            for (const c of this.connections) {
                if (c.input && c.input.position) inputs[c.id] = c.input;
            }
            this.applyInputs(inputs);
            
            const started = this.game.state === 'PLAYING' || this.game.state === 'GAMEOVER';
            if (!started) return;
            const snapshot = this.game.makeCoopSnapshot();
            const snapshotSeq = ++this.snapshotSeq;
            for (const c of this.connections) {
                if (c.joined && c.conn.open) {
                    try {
                        c.conn.send({ type: 'snapshot', snapshot, snapshotSeq, started, epoch: this.epoch, ack: c.ack });
                    } catch (err) {
                        console.warn('[NetworkHost] Lỗi khi gửi snapshot cho client:', c.id, err);
                    }
                }
            }
        } else {
            if (!this.conn || !this.conn.open) return;
            if (this.startedEpoch === null) return;
            const local = this.game.player;
            const body = {
                type: 'sync',
                epoch: this.startedEpoch,
                inputSeq: ++this.inputSeq,
                input: {
                    position: local.position.toArray(),
                    aim: local.aimYaw,
                    ads: !!local.isADS,
                    revive: !!local.reviveRequested,
                    moving: local.velocity.lengthSq() > 0.1,
                    isDodging: !!local.isDodging
                },
                commands: this.pendingCommands.slice(0, 30)
            };
            local.reviveRequested = false;
            try {
                this.conn.send(body);
            } catch (err) {
                console.warn('[NetworkClient] Lỗi khi gửi sync input:', err);
            }
        }
    }

    applyInputs(inputs) {
        for (const [id, input] of Object.entries(inputs)) {
            if (id === this.playerId) continue;
            const player = this.game.getCoopPlayer(id);
            if (!player || !Array.isArray(input?.position)) continue;
            if (!player.isDead && input.position.length === 3 && input.position.every(Number.isFinite)) player.position.fromArray(input.position);
            if (Number.isFinite(input.aim)) player.aimYaw = input.aim;
            player.isADS = !!input.ads;
            player.isDodging = !!input.isDodging;
            player.moving = !!input.moving;
            if (input.revive) { this.game.reviveNearest(player); input.revive = false; }
        }
    }

    applyCommands(commandsList) {
        for (const item of commandsList) {
            const player = this.game.getCoopPlayer(item.player);
            if (!player) continue;
            const connState = this.connections.find(c => c.id === item.player);
            const commands = Array.isArray(item.commands) ? item.commands : (item.command ? [item.command] : []);
            for (const command of commands) {
                if (!player.weapons || !Number.isSafeInteger(command.seq) || command.seq <= (player.lastCommandId || 0)) continue;
                player.lastCommandId = command.seq;
                if (connState) connState.ack = command.seq;
                (player.commandQueue ||= []).push(command);
            }
        }
    }

    processCommands(player) {
        const queue = player.commandQueue || [];
        while (queue.length) {
            const command = queue[0];
            if (!player.isDead && !player.isDowned && command.type === 'shoot' &&
                (player.weapons.fireCooldown > 0 || player.weapons.isReloading)) break;
            queue.shift();
            player.processedSeq = command.seq;
            if (player.isDead || player.isDowned) continue;
            const weapons = player.weapons;
            const validVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
            if (command.type === 'reload') weapons.reload();
            else if (command.type === 'switch') weapons.switchWeapon(command.slot, player);
            else if (command.type === 'medkit') weapons.startMedkitUse(player, command.itemType);
            else if (command.type === 'cancel_medkit') weapons.cancelMedkitUse();
            else if (command.type === 'revive') this.game.reviveNearest(player);
            else if (command.type === 'shoot' && validVector(command.target)) {
                const current = weapons.getCurrentWeapon();
                if (command.weaponId && current?.id !== command.weaponId) continue;
                const origin = weapons.getMuzzlePosition?.() || player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                const target = new THREE.Vector3().fromArray(command.target);
                player.isADS = !!command.ads;
                if (weapons.shoot(origin, target, player.isADS, true, 1, player)) {
                    (this.game.networkEvents ||= []).push({ type: 'shot', shooterId: player.id,
                        origin: origin.toArray(), target: target.toArray(), weaponId: current.id, ads: player.isADS });
                }
            } else if (command.type === 'throw_bomb' && validVector(command.target)) {
                const current = weapons.getCurrentWeapon();
                if (command.weaponId !== current?.id) continue;
                const origin = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                if (weapons.throwBomb(origin, new THREE.Vector3().fromArray(command.target), player, this.game.waveManager.enemies)) {
                    (this.game.networkEvents ||= []).push({ type: 'throw_bomb', throwerId: player.id,
                        origin: origin.toArray(), target: command.target, weaponId: current.id });
                }
            } else if (command.type === 'drop_weapon') {
                const gun = weapons.weaponSlots[command.slot];
                if ((command.slot === 0 || command.slot === 1) && gun?.instanceId && gun.instanceId === command.instanceId) {
                    weapons.switchWeapon(command.slot, player);
                    weapons.dropCurrentWeapon(player, this.game.lootingSystem);
                }
            } else {
                // Loot requests identify existing host items; clients never supply item contents or damage.
                this.game.lootingSystem?.processRemoteCommand?.(player, command);
            }
        }
    }

    updateRoster(players) {
        const ids = new Set(players.map(p => p.id));
        for (const player of players) {
            if (player.id !== this.playerId) {
                const isNew = !this.game.remotePlayers.has(player.id);
                const remote = this.game.ensureCoopPlayer(player.id, player.name, player.character);
                if (remote) remote.loadout = player.loadout || { primary: player.weapon };
                if ((this.game.state === 'MENU' || isNew) && remote?.weapons) {
                    const weapon = getStartingWeapon(player.weapon);
                    remote.weapons.resetRun(weapon.id, remote.loadout.secondary, remote.loadout.bomb1, remote.loadout.bomb2);
                }
            }
        }
        for (const [id] of this.game.remotePlayers) {
            if (!ids.has(id)) this.game.removeCoopPlayer(id);
        }
    }

    changeCharacter(character) {
        if (!this.active) return;
        if (this.host) {
            const hostPlayer = this.players.find(p => p.id === 'host');
            if (hostPlayer) {
                hostPlayer.character = character;
                this.broadcastRoster();
            }
        } else if (this.conn && this.conn.open) {
            this.conn.send({ type: 'character', character });
        }
    }

    changeWeapon(id) {
        if (!this.active || this.game.state !== 'MENU') return;
        const weapon = getStartingWeapon(id).id;
        if (this.host) {
            const player = this.players.find(p => p.id === this.playerId);
            if (player) { player.weapon = weapon; this.broadcastRoster(); }
        } else if (this.conn?.open) this.conn.send({ type: 'weapon', weapon, loadout: this.game.getLoadout?.() });
    }

    leave() {
        this.stopTicker?.();
        this.stopTicker = null;
        if (!this.active) return;
        this.active = false;
        this.startedEpoch = null;
        this.pendingCommands = [];
        this.seq = 0;
        this.game.weapons.onCommand = null;
        if (this.conn) this.conn.close();
        if (this.peer) this.peer.destroy();
        this.connections = [];
        this.players = [];
        this.game.resetRoomUI?.();
    }
}

export function makeRemotePlayer(scene, loader, id, name, characterId = 'police') {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x113355 }));
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.53, 24), new THREE.MeshBasicMaterial({ color: 0x44ddff, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -0.48;
    group.add(body, marker);
    scene.add(group);
    const healthBar = new HealthBar3D(scene, { width: 1.25, offsetY: 2.15, color: 0x44ddff });
    let characterModel = null;
    let loadingCharacter = null;
    let mixer = null;
    let actions = {};
    let action = null;
    let disposed = false;
    let initialized = false;
    const remote = { id, name, characterId: normalizeCharacter(characterId), position: new THREE.Vector3(0, 0, 8), velocity: new THREE.Vector3(), netTarget: null, netVelocity: new THREE.Vector3(), netSampleTime: 0, aimYaw: Math.PI, isADS: false,
        isDead: false, isDowned: false, bleedOutTimer: 30.0, health: 100, maxHealth: 100, shield: 100, maxShield: 100,
        radius: 0.55, height: 1.6, mesh: group, healthBar,
        updateSimulation(delta) {
            this.invulnerability = Math.max(0, (this.invulnerability || 0) - delta);
            this.shieldRegenTimer = Math.max(0, (this.shieldRegenTimer || 0) - delta);
            if (!this.isDead && !this.isDowned && !this.shieldRegenTimer) this.shield = Math.min(this.maxShield, this.shield + 25 * delta);
            if (this.isDowned && !this.isDead) {
                this.bleedOutTimer = Math.max(0, (this.bleedOutTimer ?? 30.0) - delta);
                if (this.bleedOutTimer <= 0) {
                    this.isDead = true;
                    this.isDowned = false;
                }
            }
        },
        updateVisual(delta = 1 / 60) {
            const blend = 1 - Math.exp(-12 * delta);
            let visualTarget = this.position;
            if (this.netTarget && this.netSampleTime) {
                const age = Math.min(0.16, Math.max(0, (performance.now() - this.netSampleTime) / 1000));
                visualTarget = this.netTarget.clone().addScaledVector(this.netVelocity || new THREE.Vector3(), age);
            }
            if (!initialized || group.position.distanceTo(visualTarget) > 12) { group.position.copy(visualTarget); initialized = true; }
            else group.position.lerp(visualTarget, blend);
            const angle = Math.atan2(Math.sin(this.aimYaw - group.rotation.y), Math.cos(this.aimYaw - group.rotation.y));
            group.rotation.y += angle * blend;
            group.visible = true;
            if (this.isDowned || this.isDead) {
                group.rotation.x = -Math.PI / 2.2;
            } else {
                group.rotation.x = 0;
            }
            const next = actions[this.moving && !this.isDead && !this.isDowned ? 'walk' : 'idle'];
            if (next && action !== next) { action?.fadeOut(0.15); next.reset().fadeIn(0.15).play(); action = next; }
            mixer?.update(delta);
            this.weapons?.updateEquippedMesh();
            this.weapons?.updateHeldPose(group);
            healthBar.update(group.position, this.isDowned ? (this.bleedOutTimer || 30.0) : this.health, this.isDowned ? 30.0 : this.maxHealth, group.visible);
        },
        checkHit(start, end, ray) {
            if (this.isDead || this.isDowned) return { hit: false };
            const bulletRadius = 0.18;
            const effRadius = 0.55 + bulletRadius;
            const box = new THREE.Box3(
                this.position.clone().add(new THREE.Vector3(-effRadius, 0, -effRadius)),
                this.position.clone().add(new THREE.Vector3(effRadius, 1.6 + bulletRadius, effRadius))
            );
            if (box.containsPoint(start)) return { hit: true, point: start.clone() };
            if (box.containsPoint(end)) return { hit: true, point: end.clone() };
            const point = ray.intersectBox(box, new THREE.Vector3());
            const stepDist = start.distanceTo(end);
            return point && start.distanceTo(point) <= stepDist + 0.15
                ? { hit: true, point } : { hit: false };
        },
        takeDamage(amount) {
            if (this.isDead || this.isDowned || this.isDodging || this.invulnerability > 0) return;
            this.shieldRegenTimer = 4;
            const absorbed = Math.min(this.shield, amount);
            this.shield -= absorbed;
            this.health -= amount - absorbed;
            if (this.health <= 0) {
                this.health = 0;
                this.isDowned = true;
                this.isDead = false;
                this.bleedOutTimer = 30.0;
            } else {
                // Khóa nhận sát thương 0.8 giây (i-frame) cho người chơi từ xa
                this.invulnerability = Math.max(this.invulnerability || 0, 0.8);
            }
        },
        heal(amount) {
            this.health = Math.min(this.maxHealth, this.health + amount);
            if (this.health > 0 && this.isDowned) {
                this.isDowned = false;
                this.isDead = false;
            }
        },
        rechargeShield(amount) { this.shield = Math.min(this.maxShield, this.shield + amount); },
        revive() {
            if (!this.isDowned && !this.isDead) return false;
            this.health = 60;
            this.shield = 0;
            this.invulnerability = 2.5;
            this.isBeingRevived = false;
            this.isDowned = false;
            this.isDead = false;
            this.reviveProgress = 0.0;
            this.bleedOutTimer = 30.0;
            return true;
        },
        setCharacter(nextCharacter) {
            const next = normalizeCharacter(nextCharacter);
            if (next === this.characterId && (characterModel || loadingCharacter === next)) return;
            this.characterId = next;
            if (!loader) return;
            const config = CHARACTER_CONFIGS[next];
            loadingCharacter = next;
            loader.load(`assets/models/${config.modelFile}`, gltf => {
                loadingCharacter = null;
                if (disposed || remote.characterId !== next) return;
                mixer?.stopAllAction();
                if (characterModel) mixer?.uncacheRoot(characterModel);
                characterModel?.removeFromParent();
                characterModel = SkeletonUtils.clone(gltf.scene);
                characterModel.scale.set(1.7, 1.7, 1.7);
                characterModel.traverse(child => {
                    if (!child.isMesh) return;
                    child.castShadow = true;
                    child.receiveShadow = true;
                });
                body.visible = false;
                group.add(characterModel);
                mixer = new THREE.AnimationMixer(characterModel);
                actions = {}; action = null;
                for (const source of gltf.animations || []) {
                    const clip = source.clone();
                    if (['idle', 'walk'].includes(clip.name)) clip.tracks = clip.tracks.filter(t => !t.name.includes('arm-right'));
                    actions[clip.name] = mixer.clipAction(clip);
                }
                actions['holding-right']?.play();
                const hand = characterModel.getObjectByName('arm-right');
                remote.handNode = hand || null;
                if (hand) remote.weapons?.attachToArm(hand);
            }, undefined, () => { if (loadingCharacter === next) loadingCharacter = null; });
        },
        dispose() { disposed = true; mixer?.stopAllAction(); this.weapons?.clear(); group.removeFromParent(); healthBar.dispose(); }
    };
    remote.setCharacter(characterId);
    return remote;
}
