# Shared match state

The room creator remains the simulation authority (PeerJS/WebRTC). This change does
not introduce a dedicated server or host migration. All players must reload the
game and create a new room after updating; the wire protocol is version 3.

- Room updates target 60 Hz, including the worker fallback. Commands flush
  immediately and remain queued until acknowledged. This is a scheduling target,
  not a guarantee of 60 rendered frames or zero network latency.
- The host owns bomb flight, smoke/fire zones, damage, healing, loot and active
  skills. Persistent effects have stable IDs and remaining lifetime in snapshots.
  Joining clients reconstruct existing effects; missing IDs remove old effects.
- Clients predict movement and gun visuals. They do not resolve projectile damage,
  detonate their own copy of a grenade, or simulate skill damage/healing.
- All 12 active skills execute through host commands. Beacons, turrets, vortexes,
  cluster grenades, orbital strikes and lightning have replicated entities.
  Buffs/cooldowns and enemy burn/freeze/vulnerability/stun state also replicate.
- Shared bomb/zone arrays retain their identity across resets. Restart clears
  effects, skill entities and per-connection cosmetic events.
- When a channel has more than 64 KiB buffered, it skips sending another snapshot;
  the next send uses current state. Cosmetic events are retained up to 256 entries.
  Persistent gameplay is independent of cosmetic event delivery.

## Validation

`node --test tests/unit/shared-world.test.mjs` checks late join, duplicate state,
replica authority, shared-array resets, immediate commands and congestion handling.

`npm run test:multiplayer:timing` runs three Chrome game clients with the local
test transport. It checks guest smoke/molotov, all 12 guest skills, effect cleanup,
late join, movement in both directions, background tabs and restarting the room.
This exercises game logic and serialization, not Internet NAT traversal or
real-world latency. Host CPU load, browser suspension and network quality still
affect the match.
