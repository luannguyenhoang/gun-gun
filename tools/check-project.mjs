import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({ resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c);
} });
function walk(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
const required = new Set();
const errors = [];
function requireFile(file, from) {
    file = path.posix.normalize(file.split('?')[0]);
    if (!fs.existsSync(path.join(root, file))) errors.push(`${from}: missing ${file}`);
    required.add(file);
}
for (const file of [...walk('src'), ...walk('vendor'), ...walk('tests')].filter(f => /\.(js|mjs|cjs)$/.test(f))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|new URL\(\s*)['"](\.[^'"]+)['"]/g)) {
        requireFile(path.posix.join(path.posix.dirname(file), match[1]), file);
    }
    // Literal asset URLs; templates are enumerated from their configs below.
    for (const match of source.matchAll(/['"](assets\/[^'"\s]+\.(?:glb|png|ogg))['"]/g)) requireFile(match[1], file);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (!/^(?:https?:|data:)/.test(m[1])) requireFile(m[1], 'index.html');
}
const weapons = await import('../src/gameplay/combat/weapons.js');
const characters = await import('../src/gameplay/player/characters.js');
function configs(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.modelFile === 'string') requireFile(`assets/models/${value.modelFile}`, 'model config');
    if (typeof value.icon === 'string' && value.icon.startsWith('assets/')) requireFile(value.icon, 'icon config');
    for (const child of Object.values(value)) if (child && typeof child === 'object') configs(child);
}
for (const value of Object.values(weapons)) configs(value);
configs(characters.CHARACTER_CONFIGS);
const arena = fs.readFileSync(path.join(root, 'src/world/arena.js'), 'utf8');
const names = arena.match(/const modelNames = \[([\s\S]*?)\]/)?.[1] || '';
for (const m of names.matchAll(/'([^']+)'/g)) requireFile(`assets/models/${m[1]}.glb`, 'arena modelNames');
const enemies = fs.readFileSync(path.join(root, 'src/gameplay/combat/enemies.js'), 'utf8');
for (const m of enemies.matchAll(/load\('[^']+',\s*'([^']+\.glb)'\)/g)) requireFile(`assets/models/${m[1]}`, 'enemy models');
// GLB files may reference textures outside the binary; never infer their use from JS alone.
for (const file of [...required].filter(f => f.endsWith('.glb') && fs.existsSync(path.join(root, f)))) {
    const bytes = fs.readFileSync(path.join(root, file));
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    for (const entry of [...(json.images || []), ...(json.buffers || [])]) {
        if (entry.uri && !entry.uri.startsWith('data:')) requireFile(path.posix.join(path.posix.dirname(file), entry.uri), file);
    }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`OK: module imports, HTML, configured models and GLB dependencies (${required.size} files).`);
if (process.argv.includes('--unused')) {
    const unused = walk('assets').filter(f => /\.(glb|png|ogg)$/.test(f) && !required.has(f));
    console.log(JSON.stringify(unused, null, 2));
}
if (process.argv.includes('--unused-json')) {
    const unused = walk('assets').filter(f => /\.(glb|png|ogg)$/.test(f) && !required.has(f));
    fs.writeFileSync(path.join(root, 'docs/unused-assets.json'), JSON.stringify(unused.map(file => ({path: file, bytes: fs.statSync(path.join(root, file)).size, reason: 'not in verified runtime asset graph'})), null, 2) + '\n');
}
