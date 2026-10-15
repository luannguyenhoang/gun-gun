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
        await page.locator('.mode-card').click();
        await page.locator('.th_mode-item[data-mode="FPS_SOLO"]').click();
        await page.locator('#btn-start').click();
        await page.waitForFunction(() => game.firstPersonView.active && game.fpsManager.bots.length === 7);
        if (!await page.evaluate(() => game.firstPersonView.locked)) await page.locator('#fps-capture').click();
        await page.waitForFunction(() => game.firstPersonView.locked);
        assert.equal(await page.evaluate(() => game.camera.isPerspectiveCamera), true);
        assert.equal(await page.evaluate(() => game.gameMode === 'FPS_SOLO' && game.tdmManager.state === 'IDLE' && game.fpsManager !== game.tdmManager), true);
        const controls = await page.evaluate(() => {
            const view = game.firstPersonView, p = game.player;
            const slider = document.querySelector('[data-fps-setting="sensitivity"]');
            slider.value = '1.5'; slider.dispatchEvent(new Event('input', {bubbles:true}));
            p.isADS = false;
            const yaw = view.yaw;
            view.look({movementX:100, movementY:0});
            const turn = yaw - view.yaw;
            const arena = game.arena, originalMove = arena.moveCharacter;
            arena.moveCharacter = (position, x, z) => { position.x += x; position.z += z; };
            const results = [];
            try {
                for (const hz of [30, 60, 144]) {
                    view.yaw = 0; p.position.set(0,0,0); p.velocity.set(0,0,0);
                    p.keys = {KeyW:true,KeyD:true}; p.mouseButtons.right = false; p.th_toggleADS = false;
                    for (let i=0;i<hz;i++) p.update(1/hz,arena,[]);
                    results.push(Math.hypot(p.velocity.x,p.velocity.z));
                    p.keys = {};
                    for (let i=0;i<Math.ceil(hz*0.2);i++) p.update(1/hz,arena,[]);
                    results.push(Math.hypot(p.velocity.x,p.velocity.z));
                }
            } finally { arena.moveCharacter = originalMove; p.keys = {}; }
            return {turn, results, speed:p.speed*0.6, saved:JSON.parse(localStorage.getItem('fps-controls')).sensitivity,
                copies:[...document.querySelectorAll('[data-fps-setting="sensitivity"]')].map(e=>e.value)};
        });
        assert.ok(Math.abs(controls.turn-0.225)<1e-8);
        assert.equal(controls.saved,1.5);
        assert.deepEqual(controls.copies,['1.5','1.5']);
        for(let i=0;i<controls.results.length;i+=2) {
            assert.ok(Math.abs(controls.results[i]-controls.speed)<1e-6, 'Diagonal speed must stay capped at every frame rate');
            assert.ok(controls.results[i+1]<0.02, 'Releasing movement must stop promptly');
        }
        await page.evaluate(() => { game.player.invulnerability = 999; game.player.position.set(3.5,0,0); });
        const recoil = await page.evaluate(() => {
            const p = game.player, view = game.firstPersonView, w = game.weapons;
            const results = [];
            for (const ads of [false,true]) {
                p.isADS = ads; p.mouseButtons.right = ads; p.mouseButtons.left = true;
                view.yaw = 0; view.pitch = 0; view.lastShotTime = undefined;
                let rise = 0;
                for (let i=0;i<12;i++) {
                    w.fireCooldown = 0;
                    w.ammo[w.getCurrentWeapon().id] = w.getModifiedStats(w.getCurrentWeapon()).magSize;
                    view.updateCamera(); view.updateAim();
                    const before = w.ammo[w.getCurrentWeapon().id];
                    p.handleShooting();
                    if(w.ammo[w.getCurrentWeapon().id] !== before-1) throw Error('Shot was not accepted');
                    rise += view.pitch;
                    const scale = 0.0015 * view.sensitivity * (ads ? view.adsSensitivity : 1);
                    view.look({movementX:view.yaw/scale, movementY:view.pitch/scale});
                    view.updateAim();
                }
                game.ui.updateStats(p,game.waveManager,game.score);
                results.push({rise,pitch:view.pitch,yaw:view.yaw,aimY:p.aimPoint.y-view.camera.position.y,
                    reticle:!game.ui.crosshair.classList.contains('th_reticle_hidden')});
            }
            p.mouseButtons = {left:false,right:false}; p.isADS = false;
            return results;
        });
        for (const result of recoil) {
            assert.ok(result.rise>0, 'Firing must produce recoil');
            assert.ok(Math.abs(result.pitch)<1e-9 && Math.abs(result.yaw)<1e-9 && Math.abs(result.aimY)<1e-7, 'Mouse compensation must restore the actual firing direction');
            assert.equal(result.reticle,true,'FPS needs a hip-fire and ADS reticle');
        }
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
            for (const bot of game.fpsManager.bots) bot.update = () => {};
            game.player.position.set(-19,0,0); game.player.velocity.set(0,0,0);
            game.firstPersonView.yaw = 0; game.firstPersonView.pitch = 0;
            game.testFpsTarget = game.fpsManager.teamRed[0];
            game.testFpsTarget.position.set(-19,0,-4);
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
        const duelPresentation = await page.evaluate(async () => {
            const { sounds } = await import('/src/audio/audio.js?v=63');
            const p = game.player, enemy = game.testFpsTarget;
            const saved = new Map([...game.remotePlayers.values()].map(e => [e, e.isDead]));
            for (const entity of saved.keys()) entity.isDead = true;
            enemy.isDead = false; enemy.team = p.team === 'blue' ? 'red' : 'blue';
            enemy.health = 73; enemy.maxHealth = 100;
            const place = (px, pz, ex, ez) => {
                p.position.set(px, 0, pz); p.isDead = false;
                enemy.position.set(ex, 0, ez); enemy.mesh.position.copy(enemy.position);
                game.firstPersonView.yaw = 0; game.firstPersonView.pitch = 0;
                game.firstPersonView.updateCamera(); game.updateDuelPresentation(1/60);
                return !document.getElementById('duel-enemy-vitals').hidden;
            };
            const front = place(-19, 4, -19, 0);
            const hp = document.getElementById('duel-enemy-hp').textContent;
            const behind = place(-19, 4, -19, 8);
            const wall = place(0, 18, 0, 10);
            const ctx = sounds.ctx;
            await ctx.resume();
            const create = ctx.createPanner.bind(ctx), nodes = [];
            ctx.createPanner = () => { const node = create(); nodes.push(node); return node; };
            sounds.playSpatialFootstep({ x: -22, y: 0, z: 4 });
            sounds.playSpatialFootstep({ x: -16, y: 0, z: 4 }, { sprinting: true, occluded: true });
            ctx.createPanner = create;
            await new Promise(resolve => setTimeout(resolve, 40));
            const spatial = nodes.length === 2 && nodes.every(n => n.panningModel === 'HRTF' && n.distanceModel === 'inverse') && nodes[0].positionX.value < nodes[1].positionX.value;
            for (const [entity, dead] of saved) entity.isDead = dead;
            return { front, behind, wall, hp, spatial };
        });
        assert.deepEqual(duelPresentation, { front: true, behind: false, wall: false, hp: 'ĐỐI THỦ · 73 / 100 HP', spatial: true });
        console.log('PASS: enemy health respects view and walls; independent HRTF footsteps retain their 3D positions.');
        await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
        await page.screenshot({path:path.join(root,'tests/artifacts/solo-fps.png')});
        await page.setViewportSize({width:640,height:360});
        const hudBounds = await page.locator('#duel-hud').boundingBox();
        const radarBounds = await page.locator('.combat-radar').boundingBox();
        assert.ok(hudBounds.x > 0 && hudBounds.x + hudBounds.width < radarBounds.x);
        await page.screenshot({path:path.join(root,'tests/artifacts/duel-small.png')});
        await page.setViewportSize({width:1440,height:900});
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => game.state === 'PAUSED');
        assert.equal(await page.locator('.pause-actions .fps-settings').isVisible(), true);
        await page.screenshot({path:path.join(root,'tests/artifacts/fps-settings.png')});
        assert.equal(await page.evaluate(() => game.player.mouseButtons.left), false);
        await page.locator('#btn-resume').click();
        await page.waitForFunction(() => game.state === 'PLAYING' && game.firstPersonView.locked);
        await page.evaluate(() => { game.player.die(true); });
        await page.waitForFunction(() => !game.player.isDead);
        assert.equal(await page.evaluate(() => game.camera.isPerspectiveCamera), true);
        await page.evaluate(() => game.fpsManager.endMatch('blue'));
        await page.waitForFunction(() => !game.firstPersonView.locked);
        assert.equal(await page.evaluate(() => game.state), 'PLAYING');
        assert.equal(await page.evaluate(() => game.player.inputEnabled), false);
        await page.evaluate(() => game.returnToMenu());
        await page.evaluate(() => game.startTDM('blue', {fillBots:true}));
        assert.equal(await page.evaluate(() => game.gameMode === 'TDM' && !game.firstPersonView.active && game.fpsManager.state === 'IDLE' && game.fpsManager.bots.length === 0 && game.tdmManager.bots.length === 7), true);
        await page.evaluate(() => game.startFPS('blue', {fillBots:true}));
        assert.equal(await page.evaluate(() => game.gameMode === 'FPS_SOLO' && game.tdmManager.state === 'IDLE' && game.tdmManager.bots.length === 0 && game.fpsManager.bots.length === 7 && game.fpsManager.scoreBlue === 0), true);
        await page.evaluate(() => game.returnToMenu());
        assert.equal(await page.evaluate(() => game.camera.isOrthographicCamera && !game.firstPersonView.active), true);
        await page.evaluate(() => { game.selectedGameMode = 'SURVIVAL'; game.startGame(); });
        await page.waitForFunction(() => game.waveManager.enemies.length > 0);
        await page.reload();
        await page.waitForFunction(() => window.game?.state === 'MENU');
        assert.equal(await page.evaluate(() => game.firstPersonView.sensitivity), 1.5);
        assert.deepEqual(errors, []);
        console.log('PASS: solo FPS menu, 7 bots, pointer lock, look, movement, ADS, firing, reload, jump, resize, pause and overhead restoration.');
    } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => {console.error(e);process.exitCode=1;});
