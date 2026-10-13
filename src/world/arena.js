import { BaseArena } from './arena-base.js';
import { SurvivalArena } from './survival-arena.js';
import { SpaceArena } from './space-arena.js';
import { FPSArena } from './fps-arena.js';

// Danh sách toàn bộ model GLB của cả 3 bản đồ để công cụ kiểm tra tài nguyên check-project.mjs xác thực
const modelNames = [
    'floor', 'floor-detail', 'wall', 'wall-corner', 'wall-high', 'wall-low', 'wall-gate',
    'column', 'column-damaged', 'tree', 'stairs', 'platform', 'platform-large-grass',
    'banner', 'block', 'statue', 'trophy', 'weapon-rack',
    'forest/tree', 'forest/tree-high', 'forest/plant', 'forest/rocks-low', 'forest/rocks-high',
    'forest/fence', 'forest/tent', 'forest/patch-grass',
    'forest/building-structure', 'forest/building-roof', 'forest/building-platform', 'forest/bridge',
    'graveyard/pine', 'graveyard/pine-crooked', 'graveyard/stone-wall', 'graveyard/stone-wall-damaged',
    'graveyard/stone-wall-column', 'graveyard/pillar-large', 'graveyard/pillar-obelisk', 'graveyard/crypt-door',
    'graveyard/crypt-large', 'graveyard/crypt-small',
    'fantasy/fountain-round', 'fantasy/fountain-center', 'fantasy/hedge', 'fantasy/hedge-large',
    'fantasy/hedge-gate', 'fantasy/tree-high-round', 'fantasy/wall', 'fantasy/wall-half',
    'fantasy/wall-broken', 'fantasy/wall-arch', 'fantasy/cart', 'fantasy/stairs-stone',
    'fantasy/banner-green', 'fantasy/banner-red', 'fantasy/rock-large', 'fantasy/rock-wide',
    'fantasy/windmill', 'fantasy/watermill', 'fantasy/stall-green', 'fantasy/stall-red', 'fantasy/stall',
    'space/template-floor', 'space/template-floor-detail', 'space/template-wall',
    'space/template-wall-corner', 'space/template-wall-half', 'space/template-wall-detail-a',
    'space/gate', 'space/gate-lasers', 'space/template-detail', 'space/template-floor-layer-raised',
    'space/cables',
    'kenney-blaster/crate-small', 'kenney-blaster/crate-medium', 'kenney-blaster/crate-wide',
    'kenney-blaster/target-detail'
];

/**
 * Lớp Arena mặc định đại diện cho bản đồ Sinh tồn Zombie (tương thích ngược các import cũ)
 */
export class Arena extends SurvivalArena {}

export { BaseArena, SurvivalArena, SpaceArena, FPSArena };
