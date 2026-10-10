const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

(async () => {
    const errors = [];
    const server = createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        try {
            const body = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': ({'.js':'application/javascript', '.html':'text/html', '.css':'text/css'})[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    let browser;
    try {
        browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
        const page = await browser.newPage({viewport:{width:1280,height:720}});
        page.on('pageerror', e => errors.push(e.stack));
        await page.route('https://**/*', r => r.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.game?.state === 'MENU');
        await page.locator('#mode-tab-fps').click();
        await page.locator('#btn-start').click();
        await page.waitForFunction(() => game.firstPersonView.active && game.tdmManager.bots.length === 7);
        if (!await page.evaluate(() => game.firstPersonView.locked)) await page.locator('#fps-capture').click();
        await page.waitForFunction(() => game.firstPersonView.locked);
        assert.equal(await page.evaluate(() => game.camera.isPerspectiveCamera), true);
        await page.evaluate(() => { game.player.invulnerability = 999; game.player.position.set(0,0,0); });
        const yaw = await page.evaluate(() => game.firstPersonView.yaw);
        await page.mouse.move(800, 360);
        await page.mouse.move(950, 390);
        await page.waitForFunction(y => game.firstPersonView.yaw !== y, yaw);
        const start = await page.evaluate(() => game.player.position.toArray());
        await page.keyboard.down('w');
        await page.waitForFunction(v => game.player.position.distanceTo({x:v[0],y:v[1],z:v[2]}) > 0.4, start);
        await page.keyboard.up('w');
        await page.mouse.down({button:'right'});
        await page.waitForFunction(() => game.camera.fov === 58);
        await page.mouse.up({button:'right'});
        await page.waitForFunction(() => game.camera.fov === 80);
        const ammo = await page.evaluate(() => game.weapons.ammo[game.weapons.getCurrentWeapon().id]);
        await page.mouse.down();
        await page.waitForFunction(a => game.weapons.ammo[game.weapons.getCurrentWeapon().id] < a, ammo);
        await page.mouse.up();
        await page.keyboard.press('r');
        await page.waitForFunction(() => game.weapons.isReloading);
        await page.waitForFunction(() => !game.weapons.isReloading);
        await page.keyboard.press('Space');
        await page.waitForFunction(() => game.player.position.y > 0.1);
        await page.waitForFunction(() => game.player.isGrounded);
        // An actual center-screen projectile must hit the opponent, not merely consume ammo.
        await page.evaluate(() => {
            for (const bot of game.tdmManager.bots) bot.update = () => {};
            game.player.position.set(-12,0,0); game.player.velocity.set(0,0,0);
            game.firstPersonView.yaw = 0; game.firstPersonView.pitch = 0;
            game.testFpsTarget = game.tdmManager.teamRed[0];
            game.testFpsTarget.position.set(-12,0,-4);
            game.testFpsTarget.invulnerability = 0;
            game.testFpsTarget.health = 100; game.testFpsTarget.shield = 0;
            game.weapons.fireCooldown = 0;
        });
        await page.mouse.down();
        await page.waitForFunction(() => game.testFpsTarget.health < 100);
        await page.mouse.up();
        await page.setViewportSize({width:1440,height:900});
        await page.waitForFunction(() => game.camera.aspect === 1.6);
        assert.equal(await page.evaluate(() => game.camera.aspect), 1.6);
        await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
        await page.screenshot({path:path.join(root,'tests/artifacts/solo-fps.png')});
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => game.state === 'PAUSED');
        assert.equal(await page.evaluate(() => game.player.mouseButtons.left), false);
        await page.locator('#btn-resume').click();
        await page.waitForFunction(() => game.state === 'PLAYING' && game.firstPersonView.locked);
        await page.evaluate(() => { game.player.die(true); });
        await page.waitForFunction(() => !game.player.isDead);
        assert.equal(await page.evaluate(() => game.camera.isPerspectiveCamera), true);
        await page.evaluate(() => game.tdmManager.endMatch('blue'));
        await page.waitForFunction(() => !game.firstPersonView.locked);
        assert.equal(await page.evaluate(() => game.state), 'PLAYING');
        assert.equal(await page.evaluate(() => game.player.inputEnabled), false);
        await page.evaluate(() => game.returnToMenu());
        assert.equal(await page.evaluate(() => game.camera.isOrthographicCamera && !game.firstPersonView.active), true);
        await page.evaluate(() => { game.selectedGameMode = 'SURVIVAL'; game.startGame(); });
        await page.waitForFunction(() => game.waveManager.enemies.length > 0);
        assert.deepEqual(errors, []);
        console.log('PASS: solo FPS menu, 7 bots, pointer lock, look, movement, ADS, firing, reload, jump, resize, pause and overhead restoration.');
    } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => {console.error(e);process.exitCode=1;});
