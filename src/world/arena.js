import { BaseArena } from './arena-base.js';
import { SurvivalArena } from './survival-arena.js';
import { SpaceArena } from './space-arena.js';

// Danh sách toàn bộ model GLB của cả 2 bản đồ để công cụ kiểm tra tài nguyên check-project.mjs xác thực
const modelNames = [
    'floor', 'floor-detail', 'wall', 'wall-corner', 'wall-high', 'wall-low', 'wall-gate',
    'column', 'column-damaged', 'tree', 'stairs', 'platform', 'platform-large-grass',
    'banner', 'block', 'statue', 'trophy', 'weapon-rack',
    'space/template-floor', 'space/template-floor-detail', 'space/template-wall',
    'space/template-wall-corner', 'space/template-wall-half', 'space/gate',
    'space/gate-lasers', 'space/template-detail', 'space/template-floor-layer-raised',
    'space/cables'
];

/**
 * Lớp Arena mặc định đại diện cho bản đồ Sinh tồn Zombie (tương thích ngược các import cũ)
 */
export class Arena extends SurvivalArena {}

export { BaseArena, SurvivalArena, SpaceArena };
