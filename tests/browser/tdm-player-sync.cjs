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
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'
        ] });
        const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
        await context.route('https://**/*', route => route.abort());
        await context.addInitScript(require('./local-peer.cjs'));
        await context.addInitScript(() => {
            const id = `guest_${crypto.randomUUID()}`, read = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) { return key === 'arena_client_user_id' ? id : read.call(this, key); };
        });
        const errors = [];
        const pages = [];
        for (let i = 0; i < 3; i++) {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.stack));
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.game?.state === 'MENU', null, { timeout: 60000 });
            await page.evaluate(() => { game.selectedGameMode = 'TDM'; game.roomName.value = 'Người chơi'; });
            pages.push(page);
        }
        const [host, guest, teammate] = pages;
        const code = await host.evaluate(async () => { game.selectedTDMTeam = 'blue'; return (await game.createRoom()).code; });
        await guest.evaluate(async code => { game.selectedTDMTeam = 'red'; await game.joinRoom(code); }, code);
        await teammate.evaluate(async code => { game.selectedTDMTeam = 'blue'; await game.joinRoom(code); }, code);
        const ids = await Promise.all(pages.map(page => page.evaluate(() => game.network.playerId)));
        assert.equal(new Set(ids).size, 3, 'same display names must not merge different players');
        await host.waitForFunction(() => game.network.players.length === 3);
        // A previous solo/room life counter must not freeze movement in a new match.
        await guest.evaluate(() => { game.player.spawnSeq = 7; });
        await host.evaluate(() => game.network.start());
        for (const page of pages) {
            await page.waitForFunction(() => game.state === 'PLAYING' && game.gameMode === 'TDM' && game.coopPlayers.length === 8);
            await page.waitForFunction(() => [...game.remotePlayers.values()].every(p => p.model));
            assert.deepEqual(await page.evaluate(() => [game.matchManager.teamBlue.length, game.matchManager.teamRed.length]), [4, 4]);
            assert.equal(await page.evaluate(() => game.remotePlayers.has(game.network.playerId)), false);
            // Hold players still and stop bot combat so visibility assertions are deterministic.
            await page.evaluate(() => {
                game.player.update = function() {
                    this.model.position.copy(this.position);
                    this.model.rotation.y = this.aimYaw;
                    this.updateCamera(0);
                };
                game.player.invulnerability = 999;
                for (const remote of game.remotePlayers.values()) remote.invulnerability = 999;
                for (const bot of game.matchManager.bots) bot.update = () => {};
            });
        }
        const origin = await host.evaluate(() => {
            const a = game.player.position.clone(), b = a.clone();
            for (let x = -16; x <= 16; x += 2) for (let z = -12; z <= 12; z += 2) {
                a.set(x, 0, z); b.set(x, 0, z + 4);
                if (![a, b].some(p => game.arena.checkCollision(p, 1)) && game.arena.hasLineOfSight(a, b)) return a.toArray();
            }
        });
        assert.ok(origin, 'there must be a clear lane for both players');
        await host.evaluate(position => { game.player.position.fromArray(position); game.player.aimYaw = 0; }, origin);
        await guest.evaluate(position => { game.player.position.fromArray(position); game.player.position.z += 4; game.player.aimYaw = Math.PI; }, origin);
        await host.waitForFunction(id => {
            const enemy = game.remotePlayers.get(id);
            return enemy?.mesh.visible && enemy.isVisibleToObserver && Math.abs(enemy.position.z - game.player.position.z - 4) < 0.1;
        }, ids[1]);
        await guest.waitForFunction(() => {
            const enemy = game.remotePlayers.get('host');
            return enemy?.mesh.visible && enemy.isVisibleToObserver && Math.abs(game.player.position.z - enemy.position.z - 4) < 0.1;
        });
        // Move the guest; both the host and the other guest must follow the same entity.
        await guest.evaluate(() => { game.player.position.z -= 0.5; });
        for (const page of [host, teammate]) {
            await page.waitForFunction(({ id, z }) => Math.abs(game.remotePlayers.get(id)?.position.z - z) < 0.1, { id: ids[1], z: origin[2] + 3.5 });
        }
        for (const page of pages) {
            assert.equal(await page.evaluate(() => game.coopPlayers.length), 8);
            assert.equal(await page.evaluate(() => game.scene.children.filter(node => node.getObjectByName('arm-right')).length), 8, 'no orphan avatar roots');
        }
        assert.deepEqual(errors, []);
        console.log('PASS: three same-name players retain distinct identities, 4v4 has eight avatars, both teams see each other in view, movement reaches both peers, no orphan models or browser errors.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
