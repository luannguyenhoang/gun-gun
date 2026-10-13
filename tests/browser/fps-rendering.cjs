const { chromium } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

(async () => {
    const server = createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
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
        const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
        await page.route('https://**/*', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.game?.state === 'MENU');
        await page.evaluate(() => {
            game.applyPerformanceSettings({ mode: 'optimized', shadows: false });
            game.startFPS('blue', { fillBots: false });
            game.animate = () => {};
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const quality = await page.evaluate(() => {
            for (let i = 0; i < 600; i++) game.renderQuality.sample(1 / 30);
            game.renderer.setPixelRatio(game.renderQuality.ratio);
            return {
                antialias: game.renderer.getContext().getContextAttributes().antialias,
                ratio: game.renderer.getPixelRatio(), width: game.canvas.width, height: game.canvas.height,
                mipmaps: game.scene.getObjectByName('courtyard-paving').material.map.generateMipmaps,
            };
        });
        assert.deepEqual(quality, { antialias: true, ratio: 1, width: 1920, height: 900, mipmaps: true });
        await fs.mkdir(path.join(root, 'tests/artifacts'), { recursive: true });
        await page.evaluate(() => {
            for (const element of document.body.children) {
                if (element !== game.canvas && element.tagName !== 'SCRIPT') element.style.display = 'none';
            }
            game.player.position.set(6, 0, 23);
            // Match updateFrame's world pass, which hides the local third-person model.
            if (game.player.model) game.player.model.visible = false;
            game.firstPersonView.yaw = -Math.PI / 2;
            game.firstPersonView.pitch = -0.04;
        });
        for (const mode of ['optimized', 'full']) {
            await page.evaluate(mode => {
                game.applyPerformanceSettings({ mode, shadows: mode === 'full' });
                game.firstPersonView.updateCamera();
                game.renderer.render(game.scene, game.camera);
                game.firstPersonView.render(game.renderer);
                game.firstPersonView.hint.style.display = 'none';
            }, mode);
            await page.screenshot({ path: path.join(root, `tests/artifacts/fps-rendering-${mode}.png`) });
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForFunction(() => game.canvas.width >= 1280 && game.canvas.height >= 720);
        assert.equal(await page.evaluate(() => game.renderQuality.minRatio), 1);
        await page.evaluate(() => game.returnToMenu());
        assert.equal(await page.evaluate(() => game.renderQuality.minRatio), 0.75);
        assert.deepEqual(errors, []);
        console.log('PASS: FPS antialiasing, native resolution under load, filtered paving, preset changes, resize and overhead restoration.');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
