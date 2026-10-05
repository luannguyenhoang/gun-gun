// Real PeerJS/WebRTC regression: requires Playwright, Chrome and access to PeerJS signaling/CDN.
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
        const context = await browser.newContext();
        if (process.env.MULTIPLAYER_LOCAL_TRANSPORT) {
            await context.route('https://**/*', route => route.abort());
            await context.addInitScript(require('./local-peer.cjs'));
        }
        const host = await context.newPage(), guest = await context.newPage();
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
        console.log('PASS: guest receives and renders the host zombie');
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
        // Freeze spawning so regression scenarios have deterministic health and loot.
        await host.evaluate(() => {
            game.waveManager.clear(); game.nextWaveTimer = 9999;
            game.lootingSystem.clearAll();
            game.player.developerMode = false; window.developerMode = false;
            game.player.position.set(0, 0, 8);
        });
        await guest.evaluate(() => { game.player.position.set(0, 0, 8); game.player.developerMode = false; window.developerMode = false; });
        await guest.waitForFunction(() => game.waveManager.enemies.length === 0);
        const guestPlayerId = await guest.evaluate(() => game.network.playerId);
        await host.evaluate(id => {
            game.player.position.set(-3,0,8);
            game.player.health=73; game.player.shield=42; game.player.maxShield=120; game.player.shieldRegenTimer=999;
            const mate=game.remotePlayers.get(id); mate.health=68; mate.shield=30; mate.maxShield=150; mate.shieldRegenTimer=999;
        },guestPlayerId);
        await guest.waitForFunction(() => game.player.health===68 && game.player.shield===30 && game.remotePlayers.get('host').maxShield===120);
        for (const [page,id,hp,shieldPct] of [[host,guestPlayerId,'68','20%'],[guest,'host','73','35%']]) {
            await page.waitForFunction(({id,hp,shieldPct}) => {
                const meter=game.ui.teammateVitals.get(id);
                return meter && !meter.hidden && meter.querySelector('.overhead-health strong').textContent===hp && meter.querySelector('.overhead-shield > div').style.width===shieldPct;
            },{id,hp,shieldPct});
            assert.equal(await page.evaluate(id => {
                const meter=game.ui.teammateVitals.get(id), local=game.ui.overheadVitals;
                return getComputedStyle(meter).width===getComputedStyle(local).width && !game.remotePlayers.get(id).healthBar.group.visible && meter.querySelectorAll('[id]').length===0;
            },id),true);
        }
        await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
        await guest.waitForFunction(()=>game.remotePlayers.get('host').mesh.position.x < -2.8);
        await guest.evaluate(()=>game.particles.clear());
        await guest.screenshot({path:path.join(root,'tests/artifacts/multiplayer-vitals.png')});
        console.log('PASS: both screens show matching health/shield meters and authoritative values');

        for (const page of [host,guest]) await page.evaluate(() => {
            game.testDamage=[];game.testMarkers=0;
            const display=game.ui.showDamageNumber.bind(game.ui),marker=game.ui.triggerHitmarker.bind(game.ui);
            game.ui.showDamageNumber=(amount,crit,pos,camera,result)=>{game.testDamage.push({amount,crit,result});display(amount,crit,pos,camera,result);};
            game.ui.triggerHitmarker=crit=>{game.testMarkers++;marker(crit);};
        });
        await host.evaluate(id => {
            const point=game.player.position.clone();point.z-=2;
            game.onHitEnemy(37,false,point,{healthDamage:12,armorDamage:25,isBlunt:true},id);
            game.onHitEnemy(20,true,point,{healthDamage:20,armorDamage:0,isBlunt:false},'host');
        },guestPlayerId);
        await guest.waitForFunction(() => game.testDamage.length===2);
        assert.deepEqual(await guest.evaluate(()=>game.testDamage),await host.evaluate(()=>game.testDamage));
        assert.equal(await host.evaluate(()=>game.testMarkers),1);
        assert.equal(await guest.evaluate(()=>game.testMarkers),1);
        console.log('PASS: host and guest damage numbers replicate; hitmarker belongs to the shooter');

        const targetId=await host.evaluate(()=>{
            game.testDamage=[];game.testMarkers=0;
            game.waveManager.spawnSingleEnemy(game.player,0,'walker');
            const enemy=game.waveManager.enemies.at(-1);
            enemy.position.set(3,0,8);enemy.mesh.position.copy(enemy.position);
            enemy.health=enemy.maxHealth=1000;enemy.armor=0;enemy.update=()=>{};
            return enemy.id;
        });
        await guest.waitForFunction(id=>game.waveManager.enemies.some(e=>e.id===id),targetId);
        await guest.evaluate(()=>{
            game.testDamage=[];game.testMarkers=0;
            game.weapons.fireCooldown=0;
            const target=game.player.position.clone().set(3,1,8);
            game.weapons.shoot(game.player.position.clone().add({x:0,y:1.2,z:0}),target,false,true,1,game.player);
        });
        await host.waitForFunction(()=>game.testDamage.length>0);
        await guest.waitForFunction(()=>game.testDamage.length>0);
        assert.deepEqual(await guest.evaluate(()=>game.testDamage),await host.evaluate(()=>game.testDamage));
        assert.equal(await host.evaluate(()=>game.testMarkers),0);
        assert.ok(await guest.evaluate(()=>game.testMarkers)>0);
        await host.evaluate(()=>game.waveManager.clear());
        console.log('PASS: a real guest projectile damages a zombie and displays the same damage on both screens');

        await guest.evaluate(()=>game.player.position.set(8,0,8));
        await host.waitForFunction(id=>game.remotePlayers.get(id).position.x>7,guestPlayerId);
        await host.evaluate(()=>{game.player.health=0;game.player.die(true);game.gameOver();});
        await guest.waitForFunction(()=>game.remotePlayers.get('host').isDead);
        assert.equal(await host.evaluate(()=>game.state),'PLAYING');
        assert.equal(await guest.evaluate(()=>game.state==='PLAYING' && !game.player.isDead && game.player.health===68 && game.player.inputEnabled),true);
        await guest.keyboard.down('d');
        try { await host.waitForFunction(id=>game.remotePlayers.get(id).position.x>9,guestPlayerId); }
        finally { await guest.keyboard.up('d'); }
        await guest.evaluate(()=>{game.weapons.fireCooldown=0;game.weapons.shoot(game.player.position.clone().add({x:0,y:1.2,z:0}),game.player.position.clone().add({x:0,y:1,z:-10}),false,true,1,game.player);});
        await host.waitForFunction(id=>game.remotePlayers.get(id).processedSeq>0,guestPlayerId);
        assert.equal(await host.evaluate(()=>game.state),'PLAYING');
        await host.evaluate(()=>{game.player.revive();game.player.position.set(0,0,8);});
        await guest.evaluate(()=>game.player.position.set(0,0,8));
        console.log('PASS: host death leaves the guest alive, moving and able to shoot');
        await guest.evaluate(() => game.lootingSystem.openBackpack());
        await guest.keyboard.press('Escape');
        await guest.waitForFunction(() => !game.lootingSystem.isBackpackOpen && !game.player.isBackpackOpen);
        await guest.keyboard.press('Escape');
        await guest.waitForFunction(() => game.pauseMenuOpen && game.state === 'PLAYING');
        const timer = await host.evaluate(() => game.nextWaveTimer);
        await host.waitForFunction(t => game.nextWaveTimer < t - .2, timer);
        await guest.keyboard.press('Escape');
        await guest.waitForFunction(() => !game.pauseMenuOpen && game.player.inputEnabled);
        await host.keyboard.press('Escape');
        await host.waitForFunction(() => game.pauseMenuOpen && game.state === 'PLAYING');
        await host.keyboard.press('Escape');
        console.log('PASS: Escape opens/closes menus without pausing the shared simulation');

        const gunId = await guest.evaluate(() => game.weapons.weaponSlots[0].instanceId);
        await guest.evaluate(() => {
            game.weapons.switchWeapon(0, game.player);
            for (let i = 0; i < 12; i++) game.weapons.dropCurrentWeapon(game.player, game.lootingSystem);
        });
        await host.waitForFunction(id => game.lootingSystem.droppedWeapons.some(w => w.gunData.instanceId === id), gunId);
        await guest.waitForFunction(() => game.weapons.weaponSlots[0] === null);
        assert.equal(await host.evaluate(id => game.lootingSystem.droppedWeapons.filter(w => w.gunData.instanceId === id).length, gunId), 1);
        const dropId = await host.evaluate(id => game.lootingSystem.droppedWeapons.find(w => w.gunData.instanceId === id).id, gunId);
        await guest.evaluate(id => { for (let i = 0; i < 10; i++) game.network.sendCommand({ type: 'pickup_weapon', weaponDropId: id }); }, dropId);
        await guest.waitForFunction(id => game.weapons.weaponSlots[0]?.instanceId === id, gunId);
        await host.waitForFunction(id => !game.lootingSystem.droppedWeapons.some(w => w.id === id), dropId);
        console.log('PASS: repeated drop/pickup requests conserve one gun identity');

        const guestId = await guest.evaluate(() => game.network.playerId);
        await host.evaluate(id => { const p = game.remotePlayers.get(id); p.reviveTimeRequired = .25; p.invulnerability = 0; p.shield = 0; p.takeDamage(500); game.player.position.set(15, 0, 8); }, guestId);
        await guest.waitForFunction(() => game.player.isDowned);
        await guest.evaluate(() => { game.player.health = 100; game.player.isDowned = false; });
        await guest.waitForFunction(() => game.player.isDowned && game.player.health === 0);
        await host.evaluate(() => game.player.position.set(0, 0, 8));
        await guest.waitForFunction(() => !game.player.isDowned && !game.player.isDead && game.player.health === 60, null, { timeout: 15000 }).catch(async error => {
            console.log('host', await host.evaluate(() => ({ state: game.state, players: game.coopPlayers.map(p => ({ id:p.id, pos:p.position.toArray(), dead:p.isDead, down:p.isDowned, health:p.health, progress:p.reviveProgress })) })));
            console.log('guest', await guest.evaluate(() => ({ state:game.state, pos:game.player.position.toArray(), health:game.player.health, progress:game.player.reviveProgress })), errors);
            throw error;
        });
        await host.evaluate(id => { const p = game.remotePlayers.get(id); p.invulnerability = 0; p.shield = 0; p.takeDamage(500); p.bleedOutTimer = .01; game.player.position.set(15, 0, 8); }, guestId);
        await guest.waitForFunction(() => game.player.isDead);
        await host.evaluate(() => game.player.position.set(0, 0, 8));
        await guest.waitForFunction(() => !game.player.isDead && game.player.health === 60, null, { timeout: 15000 });
        console.log('PASS: host health overrides stale guest input; downed and dead teammates revive on both clients');

        await host.evaluate(id => { const p = game.remotePlayers.get(id); p.isDead = true; p.isDowned = false; game.player.invulnerability = 0; game.player.shield = 0; game.player.takeDamage(500); }, guestId);
        await guest.waitForFunction(() => game.state === 'GAMEOVER');
        console.log('PASS: team game over propagates to guest');
        assert.equal(await guest.evaluate(() => Object.values(game.weapons.reserve).every(n => n === Infinity)), true);
        assert.deepEqual(errors, []);
        console.log('PASS: unlimited ammo preserved; no JavaScript errors');
    } finally {
        clearTimeout(timeout);
        await browser?.close();
        server.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
