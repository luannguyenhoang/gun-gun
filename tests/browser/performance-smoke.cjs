const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const server = createServer(async (req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        try {
            const body = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.game?.state === 'MENU', { timeout: 60000 });
        const quality = await page.evaluate(() => {
            const g = window.game;
            const initial = { antialias: g.renderer.getContext().getContextAttributes().antialias,
                lights: g.arena.tacticalLights.filter(light => light.visible).length };
            g.applyPerformanceSettings({ mode: 'full', shadows: true });
            const fullLights = g.arena.tacticalLights.filter(light => light.visible).length;
            g.applyPerformanceSettings({ mode: 'optimized', shadows: false });
            return { ...initial, fullLights, optimizedLights: g.arena.tacticalLights.filter(light => light.visible).length };
        });
        assert.deepEqual(quality, { antialias: false, lights: 0, fullLights: 5, optimizedLights: 0 });
        const results = [];
        for (const mode of ['SURVIVAL', 'TDM']) {
            results.push(await page.evaluate(async mode => {
                const g = window.game;
                if (mode === 'SURVIVAL') await g.startGame();
                else await g.startTDM('blue');
                g.player.setInputEnabled(false);
                g.player.invulnerability = 1000;
                g.ui.updateOverheadVitals(g.player, g.camera, g.canvas);
                const vitals = new MutationObserver(() => {});
                vitals.observe(g.ui.overheadVitals, { subtree: true, childList: true, attributes: true, characterData: true });
                g.ui.updateOverheadVitals(g.player, g.camera, g.canvas);
                const unchangedVitalsMutations = vitals.takeRecords().length;
                vitals.disconnect();
                let hiddenHudUpdates = 0;
                const updateStats = g.ui.updateStats;
                g.ui.updateStats = () => hiddenHudUpdates++;
                g.weapons.fireCooldown = 1;
                g.updateFrame(1 / 60, false);
                const hiddenSimulationAdvanced = g.weapons.fireCooldown < 1;
                g.ui.updateStats = updateStats;
                // Synchronous steps isolate JS work from software GPU frame pacing.
                const timings = {};
                const restores = [];
                for (const [object, name, label] of [
                    [g.renderer, 'render', 'render'], [g.ui, 'updateStats', 'hud'],
                    [g.ui, 'updateTeammateIndicators', 'indicators'],
                    [g.visionCone, 'render', 'vision'], [g.waveManager, 'update', 'enemies'],
                    [g.lootingSystem, 'update', 'loot'], [g.tdmManager, 'update', 'bots']
                ]) {
                    const original = object[name];
                    object[name] = function (...args) {
                        const start = performance.now();
                        const result = original.apply(this, args);
                        timings[label] = (timings[label] || 0) + performance.now() - start;
                        return result;
                    };
                    restores.push(() => object[name] = original);
                }
                let mutations = 0;
                const observer = new MutationObserver(records => mutations += records.length);
                observer.observe(document.getElementById('hud'), { subtree: true, childList: true, attributes: true, characterData: true });
                const start = performance.now();
                for (let i = 0; i < 120; i++) g.updateFrame(1 / 60);
                const elapsed = performance.now() - start;
                mutations += observer.takeRecords().length;
                observer.disconnect();
                restores.forEach(restore => restore());
                const result = { mode, elapsedMs: Math.round(elapsed), timings, hudMutations: mutations,
                    drawCalls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles,
                    ratio: g.renderer.getPixelRatio(), state: g.state,
                    unchangedVitalsMutations, hiddenHudUpdates, hiddenSimulationAdvanced };
                if (mode === 'SURVIVAL') {
                    for (let i = 0; i < 20; i++) g.waveManager.spawnSingleEnemy(g.player, 0, 'walker');
                    result.stressEnemyCount = g.waveManager.enemies.length;
                    const target = g.player.position.clone();
                    target.z -= 10;
                    target.y = 1;
                    for (let i = 0; i < 60; i++) {
                        const muzzle = g.weapons.getMuzzlePosition();
                        if (muzzle) g.weapons.shoot(muzzle, target, false, true, 1, g.player);
                        g.updateFrame(1 / 60);
                    }
                }
                g.state = 'PAUSED';
                return result;
            }, mode));
            await fs.mkdir(path.join(__dirname, '../artifacts'), { recursive: true });
            await page.screenshot({ path: path.join(__dirname, '../artifacts', `performance-${mode}.png`) });
            await page.evaluate(() => window.game.returnToMenu());
        }
        assert.deepEqual(errors, []);
        assert.ok(results.every(result => result.state === 'PLAYING' && result.drawCalls > 0));
        assert.ok(results.every(result => result.unchangedVitalsMutations === 0 && result.hiddenHudUpdates === 0 && result.hiddenSimulationAdvanced));
        assert.ok(results[0].stressEnemyCount >= 20);
        console.log(JSON.stringify({ results, errors }, null, 2));
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
