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
            page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.game?.state === 'MENU', { timeout: 60000 });
            console.log(`Loaded player ${i + 1}`);
        }
        const [host, guest, observer] = pages;
        const code = await host.evaluate(async () => { await game.network.create('Host'); return game.network.code; });
        await guest.evaluate(code => game.network.join(code, 'Guest'), code);
        await host.evaluate(() => game.network.start());
        await host.evaluate(() => {
            game.waveManager.clear(); game.nextWaveTimer = 999;
            game.weapons.createSmokeZone(game.player.position.clone(), 5, 60);
            game.player.triggerAutoTurret(60);
        });
        // Joining an already running room must enter exactly the same match.
        await observer.evaluate(code => game.network.join(code, 'Observer'), code);
        for (const page of pages) await page.waitForFunction(() => game.state === 'PLAYING' && game.coopPlayers.length === 3);
        await host.evaluate(() => { game.waveManager.clear(); game.nextWaveTimer = 999; });
        const ids = await Promise.all(pages.map(p => p.evaluate(() => game.network.playerId)));
        await observer.waitForFunction(() => game.weapons.activeZones.length === 1 && game.remotePlayers.get('host')?.activeTurrets.length === 1);
        console.log('PASS: late join reconstructs existing smoke and turret');
        for (const weaponId of ['grenade_smoke', 'grenade_fire']) {
            await host.evaluate(async ({id, weaponId}) => {
                const {getBombConfig} = await import('/src/gameplay/combat/weapons.js');
                const w = game.remotePlayers.get(id).weapons;
                w.weaponSlots[2] = {...getBombConfig(weaponId), count: 2}; w.currentSlotIndex = 2;
            }, {id: ids[1], weaponId});
            await guest.waitForFunction(id => game.weapons.getCurrentWeapon()?.id === id, weaponId);
            const zoneType = weaponId === 'grenade_fire' ? 'fire' : 'smoke';
            const oldCount = await host.evaluate(type => game.weapons.activeZones.filter(z => z.type === type).length, zoneType);
            await guest.evaluate(() => game.weapons.throwBomb(game.player.position.clone().setY(1), game.player.position.clone(), game.player));
            for (const page of pages) await page.waitForFunction(({type,count}) => game.weapons.activeZones.filter(z => z.type === type).length === count + 1, {type: zoneType,count:oldCount});
            const signatures = await Promise.all(pages.map(p => p.evaluate(() => game.weapons.activeZones.map(z => [z.netId,z.type,z.pos.toArray()]))));
            assert.deepEqual(signatures[1],signatures[0]); assert.deepEqual(signatures[2],signatures[0]);
        }
        console.log('PASS: guest smoke/molotov produce exactly the same shared zones on all three clients');
        for (const character of ['police','commando','medic','analyst','engineer','agent','miner','schoolgirl','secretary','athlete','cyber_girl','assassin']) {
            const before = await host.evaluate(({id,character}) => {
                const p = game.remotePlayers.get(id); p.characterId = character; p.activeSkillCooldownTimer = 0;
                return p.skillActivationSeq || 0;
            }, {id:ids[1],character});
            await guest.waitForFunction(() => game.player.activeSkillCooldownTimer === 0);
            await guest.evaluate(() => game.player.tryActiveSkill());
            await host.waitForFunction(({id,before}) => game.remotePlayers.get(id).skillActivationSeq === before + 1,{id:ids[1],before});
            await observer.waitForFunction(({id,before}) => game.remotePlayers.get(id).skillActivationSeq === before + 1,{id:ids[1],before});
        }
        console.log('PASS: all 12 guest skills execute on host and synchronize to observer');
        await host.evaluate(() => {
            for (const z of game.weapons.activeZones) z.life = 0.001;
            for (const p of game.coopPlayers) p.clearSharedSkills();
        });
        for (const page of pages) await page.waitForFunction(() => game.weapons.activeZones.length === 0 && game.coopPlayers.every(p => !p.activeTurrets?.length && !p.activeBeacons?.length && !p.activeVortexes?.length));
        console.log('PASS: host expiration removes world effects and skill entities everywhere');
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
