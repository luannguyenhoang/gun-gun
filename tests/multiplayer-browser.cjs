// Real PeerJS/WebRTC regression: requires Playwright, Chrome and access to PeerJS signaling/CDN.
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const root = path.resolve(__dirname, '..');
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try {
            const body = await fs.readFile(file);
            const mime = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.glb': 'model/gltf-binary' };
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const errors = [];
    const timeout = setTimeout(() => { console.error('Multiplayer browser test timed out'); process.exit(1); }, 120000);
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--disable-background-timer-throttling', '--disable-renderer-backgrounding'
        ] });
        const host = await browser.newPage(), guest = await browser.newPage();
        for (const [i, page] of [host, guest].entries()) {
            page.on('pageerror', error => { errors.push(`${i}: ${error.message}`); });
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.game?.state === 'MENU', { timeout: 60000 });
        }
        const code = await host.evaluate(async () => { await game.network.create('Host'); return game.network.code; });
        await guest.evaluate(code => game.network.join(code, 'Guest'), code);
        await host.evaluate(() => game.network.start());
        await host.waitForFunction(() => game.waveManager.enemies.length > 0);
        const enemyId = await host.evaluate(() => game.waveManager.enemies[0].id);
        await guest.waitForFunction(id => game.waveManager.enemies.some(e => e.id === id && e.mesh?.visible && e.mesh.parent === game.scene), enemyId);
        console.log('PASS: guest receives and renders the host zombie through real PeerJS');
        await host.evaluate(() => {
            game.waveManager.spawnSingleEnemy(game.player,0,'spitter');
            game.waveManager.spawnSingleEnemy(game.player,0,'bomber');
            game.waveManager.bombs.spawn(game.player.position,35);
        });
        await guest.waitForFunction(() => game.waveManager.bombs.items.size > 0);
        await guest.waitForFunction(() => ['spitter','bomber'].every(type => game.waveManager.enemies.some(e => e.type === type && e.mesh?.visible)));
        console.log('PASS: acid/bomber species and bomb warnings replicate to guest');

        for (const [sender, receiver] of [[host, guest], [guest, host]]) {
            const id = await sender.evaluate(() => game.network.playerId);
            const before = await receiver.evaluate(id => game.remotePlayers.get(id).position.toArray(), id);
            await sender.keyboard.down('d');
            try {
                await receiver.waitForFunction(({id, before}) => {
                    const p = game.remotePlayers.get(id);
                    return p.position.distanceTo({x: before[0], y: before[1], z: before[2]}) > 1 &&
                        p.mesh.position.distanceTo({x: before[0], y: before[1], z: before[2]}) > .5;
                }, {id, before}, {timeout: 10000});
            } finally { await sender.keyboard.up('d'); }
        }
        console.log('PASS: movement and visible teammate models synchronize in both directions');
        assert.equal(await guest.evaluate(() => Object.values(game.weapons.reserve).every(n => n === Infinity)), true);
        assert.deepEqual(errors, []);
        console.log('PASS: unlimited ammo preserved; no JavaScript or BinaryPack errors');
    } finally {
        clearTimeout(timeout);
        await browser?.close();
        server.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
