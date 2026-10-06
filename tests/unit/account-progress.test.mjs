import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProfileProgressToGame, resetGameProgressToGuest } from '../../src/network/auth.js';

test('applyProfileProgressToGame updates game and localStorage with cloud progress', () => {
    // Giả lập môi trường localStorage và game instance
    const store = {};
    global.localStorage = {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };

    const mockGame = {
        coins: 1000,
        unlockedWeapons: ['blaster'],
        th_weaponTiers: {},
        th_weaponEnchants: {},
        th_weaponParts: {},
        characterId: 'police',
        highScore: 0,
        updateCoinsUI: () => { mockGame._uiUpdated = true; },
        updateCharacterSelection: () => {},
        homeMenu: {
            preview: () => {},
            showroom: {
                syncSelection: () => {},
                renderDetails: () => {},
                renderArmoryWeapons: () => {}
            }
        }
    };

    const mockProfile = {
        id: 'user-123',
        coins: 7500,
        unlocked_weapons: ['blaster', 'repeater', 'scatter', 'ak47', 'sniper'],
        weapon_tiers: { ak47: 3, sniper: 2 },
        weapon_enchants: { ak47: 'fire' },
        weapon_parts: { ak47: { optic: 2, barrel: 3 } },
        character_id: 'swat',
        unlocked_characters: ['police', 'swat'],
        high_score: 12000,
        loadout: { primary: 'ak47', knife: 'tactical_knife' }
    };

    applyProfileProgressToGame(mockProfile, mockGame);

    assert.equal(mockGame.coins, 7500);
    assert.deepEqual(mockGame.unlockedWeapons, ['blaster', 'repeater', 'scatter', 'ak47', 'sniper']);
    assert.deepEqual(mockGame.th_weaponTiers, { ak47: 3, sniper: 2 });
    assert.deepEqual(mockGame.th_weaponEnchants, { ak47: 'fire' });
    assert.deepEqual(mockGame.th_weaponParts, { ak47: { optic: 2, barrel: 3 } });
    assert.equal(mockGame.characterId, 'swat');
    assert.equal(mockGame.highScore, 12000);
    assert.equal(mockGame._uiUpdated, true);

    assert.equal(store['arena_player_coins'], '7500');
    assert.equal(store['cyber_arena_weapon'], 'ak47');
});

test('resetGameProgressToGuest restores default guest values', () => {
    const store = {
        arena_player_coins: '50000',
        cyber_arena_character: 'swat'
    };
    global.localStorage = {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };

    const mockGame = {
        coins: 50000,
        unlockedWeapons: ['ak47'],
        th_weaponTiers: { ak47: 5 },
        th_weaponEnchants: {},
        th_weaponParts: {},
        characterId: 'swat',
        highScore: 9999,
        updateCoinsUI: () => {},
        updateCharacterSelection: () => {},
        homeMenu: {
            preview: () => {},
            showroom: {
                syncSelection: () => {},
                renderDetails: () => {},
                renderArmoryWeapons: () => {}
            }
        }
    };

    resetGameProgressToGuest(mockGame);

    assert.equal(mockGame.coins, 1000);
    assert.deepEqual(mockGame.unlockedWeapons, ['blaster', 'repeater', 'scatter']);
    assert.deepEqual(mockGame.th_weaponTiers, {});
    assert.equal(mockGame.characterId, 'police');
    assert.equal(mockGame.highScore, 0);

    assert.equal(store['arena_player_coins'], '1000');
    assert.equal(store['cyber_arena_character'], 'police');
});
