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

        const result = await page.evaluate(async () => {
            const THREE = await import('/vendor/three.module.js');
            const { BaseArena } = await import('/src/world/arena-base.js');
            game.startTDM('blue', { fillBots: true });
            game.animate = () => {};
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const overlay = game.visionCone;
            const camera = overlay.camera;
            const savedPosition = camera.position.clone(), savedQuaternion = camera.quaternion.clone();
            camera.position.set(0,26,18);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
            const observer = { position: new THREE.Vector3(), aimYaw: 0, weapons: {getCurrentWeapon:()=>({id:'carbine'})} };
            const arena = new BaseArena(new THREE.Scene());
            arena.colliders.push(new THREE.Box3(new THREE.Vector3(-1,0,4),new THREE.Vector3(1,3,5)));
            arena.buildSpatialGrid();
            overlay.update(observer,0);
            const sample=(x,z)=>{
                const p=new THREE.Vector3(x,0,z).project(camera);
                return overlay.ctx.getImageData(Math.round((p.x+1)*overlay.canvas.width/2),Math.round((1-p.y)*overlay.canvas.height/2),1,1).data[0];
            };
            overlay.render(observer,true,[],arena);
            const beforeWall=sample(0,3),behindWall=sample(0,8),outsideCone=sample(8,0);
            const brightness=sample(0,2);
            overlay.render(observer,true,[{...observer}],arena);
            const overlapped=sample(0,2);
            overlay.render({...observer,isDead:true},true,[observer],arena);
            const teamBehindWall=sample(0,8),teamBeforeWall=sample(0,3);
            overlay.currentRange=0.1;overlay.currentAngle=1;overlay.currentProximity=10;
            overlay.render(observer,true,[],null);
            const eastRadius=sample(5,0),northRadius=sample(0,5);
            camera.position.copy(savedPosition);camera.quaternion.copy(savedQuaternion);camera.updateMatrixWorld(true);
            game.player.position.set(0,0,12); game.player.cameraFocus.set(0,0.7,12);
            game.player.pointer.set(0.2,0.8);game.player.updateCamera(1);game.player.updateAim([],1/60);
            overlay.clear();overlay.update(game.player,1);
            for(const bot of game.tdmManager.bots)bot.update=()=>{};
            const mates=game.tdmManager.teamBlue.filter(p=>p!==game.player);
            const times=[];
            for(let i=0;i<120;i++){
                game.player.aimYaw=Math.PI+i*0.01;
                const start=performance.now();overlay.render(game.player,true,mates,game.arena);times.push(performance.now()-start);
            }
            times.sort((a,b)=>a-b);
            return {beforeWall,behindWall,outsideCone,brightness,overlapped,teamBehindWall,teamBeforeWall,eastRadius,northRadius,
                p50:times[60],p95:times[114],blend:getComputedStyle(overlay.canvas).mixBlendMode};
        });
        assert.ok(result.beforeWall > 225);
        assert.equal(result.behindWall,140);
        assert.equal(result.outsideCone,140);
        assert.ok(Math.abs(result.brightness-result.overlapped)<=1,'overlapping cones must not brighten');
        assert.equal(result.teamBehindWall,140,'teammate light must stop at walls');
        assert.ok(result.teamBeforeWall>225);
        assert.ok(Math.abs(result.eastRadius-result.northRadius)<=2,'world-space falloff must be direction independent');
        assert.equal(result.blend,'multiply');
        await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});
        await page.evaluate(()=>{
            game.player.aimYaw=Math.PI;
            game.renderer.render(game.scene,game.camera);
            game.visionCone.render(game.player,true,game.tdmManager.teamBlue,game.arena);
        });
        await page.screenshot({path:path.join(root,'tests/artifacts/tdm-vision-fixed.png')});
        assert.deepEqual(errors,[]);
        console.log('PASS: projected falloff, local/team wall occlusion and non-additive shared vision. '+JSON.stringify(result));
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
