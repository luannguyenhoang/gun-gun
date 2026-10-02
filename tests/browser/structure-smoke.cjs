const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

(async () => {
    // Deny audited candidates even before deleting them, to exercise the retained assets only.
    const manifest = [
        ...JSON.parse(await fs.readFile(path.join(root, 'docs/cleanup-manifest.json'), 'utf8')),
        ...JSON.parse(await fs.readFile(path.join(root, 'docs/unused-assets.json'), 'utf8'))
    ];
    const removed = new Set(manifest.map(item => '/' + item.path));
    const errors = [];
    const missing = [];
    const server = createServer(async (req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try {
            if (removed.has(name)) throw Error('Removed asset requested');
            const data = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': ({ '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.glb': 'model/gltf-binary', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' });
            res.end(data);
        } catch {
            if (name !== '/favicon.ico') missing.push(name);
            res.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.game?.state === 'MENU');
        await page.evaluate(async () => {
            const { WEAPON_CONFIGS, ALL_KENNEY_ACCESSORIES, BOMB_CONFIGS } = await import('/src/gameplay/combat/weapons.js');
            const { CHARACTER_CONFIGS } = await import('/src/gameplay/player/characters.js');
            const urls = new Set();
            for (const c of [...WEAPON_CONFIGS, ...ALL_KENNEY_ACCESSORIES, ...Object.values(BOMB_CONFIGS || {}), ...Object.values(CHARACTER_CONFIGS)]) {
                if (c.modelFile) urls.add('assets/models/' + c.modelFile);
                if (c.icon) urls.add(c.icon);
            }
            for (const url of urls) { const response = await fetch(url); if (!response.ok) throw Error('Missing ' + url); }
        });
        await page.locator('[data-open="characters"]').first().click();
        await page.keyboard.press('Escape');
        await page.locator('[data-open="weapons"]').first().click();
        await page.keyboard.press('Escape');
        await page.evaluate(() => game.startGame());
        await page.waitForFunction(() => game.waveManager.enemies.length > 0);
        await page.keyboard.down('d');
        await page.waitForTimeout(250);
        await page.keyboard.up('d');
        await page.mouse.move(800, 380);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.keyboard.press('b');
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 390, height: 844 });
        await fs.mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'tests/artifacts/structure-mobile.png') });
        assert.deepEqual(missing, [], 'No missing or removed resources may be requested');
        assert.deepEqual(errors, [], 'No browser JS errors');
        console.log('PASS: menu, characters, armory, configured assets, combat, backpack and mobile; no missing resources.');
    } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
