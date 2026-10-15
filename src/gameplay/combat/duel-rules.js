export const SPAWN_PROTECTION_SECONDS = 5;
export const SHOT_REVEAL_SECONDS = 1.5;

export function isDuelMode(game = globalThis.window?.game) {
    return game?.gameMode === 'FPS_SOLO' || (game?.gameMode === 'TDM' && !!game.matchManager?.is1v1);
}

export function protectSpawn(entity) {
    entity.invulnerability = SPAWN_PROTECTION_SECONDS;
    entity.spawnProtected = true;
    entity.radarRevealTimer = 0;
    entity.isSprinting = false;
    entity.isCrouching = false;
    entity._footstepPosition = null;
    entity._footstepClock = 0;
}

// Called only after the weapon has accepted an attack, on both prediction and host.
export function registerDuelAttack(entity, kind, game = globalThis.window?.game) {
    if (!entity || !isDuelMode(game)) return;
    if (entity.spawnProtected) {
        entity.invulnerability = 0;
        entity.spawnProtected = false;
    }
    if (kind === 'gun') entity.radarRevealTimer = SHOT_REVEAL_SECONDS;
}

export function isRevealedOnRadar(entity) {
    return !!entity && !entity.isDead && !entity.isDowned &&
        ((entity.radarRevealTimer || 0) > 0 || (!!entity.isSprinting && !entity.isCrouching));
}

export function duelMovement(keys, moving, ads = false) {
    const crouching = !!(keys.ControlLeft || keys.ControlRight || keys.KeyC);
    const sprinting = moving && !crouching && !ads && !!(keys.ShiftLeft || keys.ShiftRight);
    return { crouching, sprinting, multiplier: crouching ? 0.45 : sprinting ? 1.5 : 1 };
}
