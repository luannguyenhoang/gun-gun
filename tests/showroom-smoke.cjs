const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        try {
            const body = await fs.readFile(file);
            res.writeHead(200, { 'Content-Type': ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.game?.state === 'MENU');
        await page.locator('[data-open="characters"]').click();
        await page.waitForFunction(() => [...window.game.homeMenu.showroom.entries.values()].filter(e => e?.thumbnail).length === 3);
        assert.equal(await page.locator('#home-dialog').evaluate(el => el.open), false);
        assert.equal(await page.locator('#character-stage canvas').count(), 1);
        assert.equal(await page.evaluate(() => window.game.homeMenu.showroom.renderer === window.game.roomLobby.renderer), true);
        const directions = await page.evaluate(async () => {
            const T = await import('/libs/three.module.js');
            const view = window.game.homeMenu.showroom;
            const values = [];
            for (const character of ['soldier', 'skeleton', 'vampire']) {
                view.preview(character);
                for (const weapon of ['blaster', 'repeater', 'scatter']) {
                    view.previewWeapon(weapon);
                    for (const yaw of [-0.35, 1.2, -2.4]) {
                        const entry = view.entries.get(character);
                        entry.model.rotation.y = yaw;
                        view.render(0.12);
                        const barrel = new T.Vector3(0, 0, -1).applyQuaternion(entry.gun.getWorldQuaternion(new T.Quaternion()));
                        const facing = new T.Vector3(0, 0, 1).applyQuaternion(entry.model.getWorldQuaternion(new T.Quaternion()));
                        values.push(barrel.dot(facing));
                    }
                    view.entries.get(character).model.rotation.y = -0.35;
                }
            }
            view.previewWeapon(window.game.weapons.startingWeaponId);
            view.preview(window.game.characterId);
            view.render(0);
            return values;
        });
        assert.ok(directions.every(dot => dot > 0.999), 'all 3 guns face forward for all 3 animated characters and rotations');
        await page.screenshot({ path: path.join(__dirname, 'artifacts', 'characters-desktop.png') });
        await page.setViewportSize({ width: 1366, height: 565 });
        const compactInfo = await page.locator('.character-info:visible').boundingBox();
        const compactAction = await page.locator('.character-action').boundingBox();
        assert.ok(compactInfo.y + compactInfo.height < compactAction.y, 'compact screen keeps details above action');
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const id of ['vampire', 'skeleton', 'soldier']) {
            await page.locator(`[data-preview-character="${id}"]`).click();
            await page.waitForFunction(id => window.game.homeMenu.showroom.entries.get(id)?.model.visible, id);
            if (await page.locator('#character-confirm').isEnabled()) await page.locator('#character-confirm').click();
            assert.equal(await page.evaluate(() => window.game.characterId), id);
            assert.equal(await page.evaluate(() => localStorage.getItem('cyber_arena_character')), id);
        }
        const rotation = await page.evaluate(() => window.game.homeMenu.showroom.entries.get('soldier').model.rotation.y);
        await page.locator('#character-stage').focus();
        await page.keyboard.press('ArrowRight');
        assert.ok((await page.evaluate(() => window.game.homeMenu.showroom.entries.get('soldier').model.rotation.y)) > rotation);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#character-screen').open);
        await page.waitForFunction(() => document.querySelector('#room-lobby canvas'));
        assert.equal(await page.locator('#room-lobby canvas').count(), 1);
        await page.locator('[data-open="characters"]').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => window.game.homeMenu.showroom.width === document.querySelector('#character-stage').clientWidth && window.game.homeMenu.showroom.width < 390);
        await page.screenshot({ path: path.join(__dirname, 'artifacts', 'characters-mobile.png') });
        for (const selector of ['.character-info:visible', '.character-cards:visible', '.character-action']) {
            const box = await page.locator(selector).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= 390, selector);
        }
        await page.locator('[data-preview-character="vampire"]').click();
        await page.locator('#character-confirm').click();
        await page.locator('[data-showroom-tab="weapons"]').click();
        for (const id of ['repeater', 'scatter', 'blaster', 'repeater']) {
            await page.locator(`[data-preview-weapon="${id}"]`).click();
            assert.equal(await page.evaluate(() => window.game.homeMenu.showroom.entries.get(window.game.homeMenu.showroom.selected).gun.name), `showroom-${id}`);
            await page.locator('#character-confirm').click();
            assert.equal(await page.evaluate(() => localStorage.getItem('cyber_arena_weapon')), id);
        }
        await page.screenshot({ path: path.join(__dirname, 'artifacts', 'armory-mobile.png') });
        await page.setViewportSize({ width:1440, height:900 });
        await page.locator('#character-stage').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => window.game.homeMenu.showroom.width > 500);
        await page.screenshot({ path: path.join(__dirname, 'artifacts', 'armory-desktop.png') });
        await page.locator('[data-character-back]').click();
        await page.reload();
        await page.waitForFunction(() => window.game?.state === 'MENU');
        assert.equal(await page.evaluate(() => window.game.weapons.startingWeaponId), 'repeater');
        await page.locator('#btn-start').click();
        await page.waitForFunction(() => window.game.state === 'PLAYING');
        assert.equal(await page.locator('#character-screen').evaluate(el => el.open), false);
        assert.equal(await page.evaluate(() => window.game.weapons.getCurrentWeapon().id), 'repeater');
        assert.equal(await page.evaluate(() => window.game.weapons.ammo.repeater), 32);
        assert.deepEqual(errors, []);
        console.log('PASS: 3D portraits, shared renderer, preview/equip/save all characters, keyboard rotation, Escape/back, mobile fit, start game, no browser errors.');
    } finally {
        if (browser) await browser.close();
        await new Promise(r => server.close(r));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
