const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

(async () => {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
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
        const context = await browser.newContext({ viewport: { width: 1120, height: 720 } });
        // Isolate regression testing from production auth/database/signaling.
        await context.route('https://**/*', route => route.abort());
        await context.addInitScript(require('./local-peer.cjs'));
        await context.addInitScript(() => {
            const deviceId = `guest_${crypto.randomUUID()}`, getItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function (key) {
                return key === 'arena_client_user_id' ? deviceId : getItem.call(this, key);
            };
        });
        const errors = [];
        const makePage = async () => {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.game?.state === 'MENU', null, { timeout: 60000 });
            return page;
        };
        const host = await makePage(), guest = await makePage();
        const code = await host.evaluate(async () => (await game.createRoom()).code);
        await guest.evaluate(async () => { game.roomName.value = 'Guest'; await game.createRoom(); });
        assert.equal(await guest.locator('#room-join').isDisabled(), true);
        await guest.locator('[data-open="friends"]').first().click();
        await guest.evaluate(code => game.homeMenu.showGameInvite({ roomCode: code, fromName: 'Host', timestamp: Date.now() }), code);
        assert.equal(await guest.locator('#realtime-invite-modal').isVisible(), true);
        assert.equal(await guest.locator('#home-dialog').evaluate(element => element.open), false);
        await guest.locator('#btn-invite-accept').click();
        await guest.waitForFunction(code => game.network.code === code && !game.homeMenu.acceptingInvite, code);
        await host.waitForFunction(() => game.network.players.length === 2);
        assert.equal(await guest.locator('#realtime-invite-modal').isVisible(), false);
        assert.equal(new URL(guest.url()).searchParams.get('room'), code);
        await guest.evaluate(() => game.returnToMenu());
        assert.equal(new URL(guest.url()).search, '');
        assert.equal(await guest.evaluate(() => game.network.active), false);
        assert.equal(await guest.locator('#room-join').isDisabled(), false);
        assert.equal(await guest.locator('#friends-label').textContent(), 'BẠN BÈ');
        // Stale URLs must clear even if transport already disconnected.
        await guest.evaluate(() => { history.replaceState(null, '', '?room=OLD1'); game.returnToMenu(); });
        assert.equal(new URL(guest.url()).search, '');
        await guest.evaluate(() => game.homeMenu.showGameInvite({ roomCode: 'NONE', fromName: 'Host', timestamp: Date.now() }));
        await guest.locator('#btn-invite-accept').click();
        await guest.waitForFunction(() => !game.homeMenu.acceptingInvite);
        assert.equal(await guest.locator('#realtime-invite-modal').isVisible(), true);
        assert.match(await guest.locator('#invite-status').textContent(), /Không thể kết nối/);
        assert.equal(new URL(guest.url()).search, '');
        assert.deepEqual(errors, []);
        console.log('PASS: visible invite over friends dialog, switch rooms, accept, missing room error, leave and stale URL cleanup; no browser exceptions.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
