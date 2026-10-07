// Three real game instances; deterministic transport isolates scheduling from signaling.
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try {
            const body = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const timeout = setTimeout(() => { console.error('Multiplayer timing test timed out'); browser?.close(); }, 120000);
    const errors = [];
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const context = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
        context.setDefaultTimeout(15000);
        await context.route('https://**/*', route => route.abort());
        await context.addInitScript(require('./local-peer.cjs'));
        await context.addInitScript(() => {
            // Deterministically reproduce a hidden tab: no RAF callbacks, while
            // worker messages still arrive.
            const raf = window.requestAnimationFrame.bind(window);
            let held;
            window.requestAnimationFrame = callback => raf(time => {
                if (window.testHidden) held = callback;
                else callback(time);
            });
            const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
            Object.defineProperty(document, 'hidden', { get: () => window.testHidden || descriptor.get.call(document) });
            window.restoreTestFrames = () => { window.testHidden = false; if (held) { raf(held); held = null; } };
        });
        const pages = [];
        for (let i = 0; i < 3; i++) {
            const page = await context.newPage(); pages.push(page);
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.game?.state === 'MENU', { timeout: 60000 });
            console.log(`Loaded player ${i + 1}`);
        }
        const [host, guest, observer] = pages;
        const code = await host.evaluate(async () => { await game.network.create('Host'); return game.network.code; });
        await guest.evaluate(code => game.network.join(code, 'Guest'), code);
        await host.evaluate(() => game.network.start());
        // Joining an already running room must enter exactly the same match.
        await observer.evaluate(code => game.network.join(code, 'Observer'), code);
        for (const page of pages) await page.waitForFunction(() => game.state === 'PLAYING' && game.coopPlayers.length === 3);
        await host.evaluate(() => { game.waveManager.clear(); game.nextWaveTimer = 999; });
        const ids = await Promise.all(pages.map(p => p.evaluate(() => game.network.playerId)));
        for (let sender = 0; sender < 3; sender++) {
            const target = [sender * 3 - 3, 0, 8];
            await pages[sender].evaluate(pos => game.player.position.fromArray(pos), target);
            for (let receiver = 0; receiver < 3; receiver++) {
                if (receiver === sender) continue;
                await pages[receiver].waitForFunction(({ id, target }) => {
                    const p = game.remotePlayers.get(id);
                    const v = { x: target[0], y: target[1], z: target[2] };
                    return p.position.distanceTo(v) < .1 && p.mesh.position.distanceTo(v) < .2;
                }, { id: ids[sender], target });
            }
        }
        console.log('PASS: three players see the same positions/models in all six directions, including late join');
        const before = await host.evaluate(() => { window.testHidden = true; return game.nextWaveTimer; });
        await guest.evaluate(() => { window.testHidden = true; game.player.position.set(6, 0, 8); });
        await observer.waitForFunction(id => Math.abs(game.remotePlayers.get(id).position.x - 6) < .1, ids[1]);
        await host.waitForFunction(t => game.nextWaveTimer < t - .3, before, { polling: 50 });
        await observer.waitForFunction(t => game.nextWaveTimer < t - .3, before);
        console.log('PASS: hidden guest sends movement; hidden host simulates and relays it to the third player without RAF');
        for (const page of [host, guest]) await page.evaluate(() => window.restoreTestFrames());
        await host.evaluate(() => game.network.start());
        const epoch = await host.evaluate(() => game.network.startedEpoch);
        for (const page of [guest, observer]) await page.waitForFunction(e => game.network.startedEpoch === e, epoch);
        await guest.evaluate(() => game.player.position.set(-6, 0, 8));
        await observer.waitForFunction(id => Math.abs(game.remotePlayers.get(id).position.x + 6) < .1, ids[1]);
        console.log('PASS: restart resets sequencing and guests continue synchronizing');
        await guest.evaluate(() => game.network.leave());
        assert.equal(await guest.evaluate(() => game.network.stopTicker), null);
        assert.deepEqual(errors, []);
        console.log('PASS: leaving stops the ticker; no JavaScript errors');
    } finally { clearTimeout(timeout); await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
