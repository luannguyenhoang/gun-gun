const {chromium} = require('playwright');
const {createServer} = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

(async () => {
    const server = createServer(async (req,res) => {
        const url = new URL(req.url,'http://localhost');
        const file = path.resolve(root,'.'+(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(root+path.sep)) return res.writeHead(403).end();
        try { const body = await fs.readFile(file); res.writeHead(200,{'Content-Type':({'.js':'application/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)] || 'application/octet-stream'}); res.end(body); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0,'127.0.0.1',r));
    let browser;
    const errors=[];
    try {
        browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
        const context = await browser.newContext({viewport:{width:640,height:360}});
        await context.route('https://**/*',r=>r.abort());
        await context.addInitScript(require('./local-peer.cjs'));
        await context.addInitScript(() => {
            // BroadcastChannel requires a shared context; emulate separate device identities.
            const deviceId = `guest_${crypto.randomUUID()}`, getItem = Storage.prototype.getItem;
            Storage.prototype.getItem = function(key) {
                return key === 'arena_client_user_id' ? deviceId : getItem.call(this, key);
            };
        });
        const makePage = async () => {
            const p=await context.newPage(); p.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
            await p.goto(`http://127.0.0.1:${server.address().port}`);
            await p.waitForFunction(()=>window.game?.state==='MENU'); return p;
        };
        const host=await makePage(), guest=await makePage();
        await host.locator('.mode-card').click();
        await host.locator('.th_mode-item[data-mode="FPS_SOLO"]').click();
        const code=await host.evaluate(async()=>{game.soloFillBots=false;await game.network.create('Host');return game.network.code;});
        await guest.evaluate(code=>{game.selectedTDMTeam='red';return game.network.join(code,'Guest');},code);
        await host.locator('#room-start').click();
        await guest.waitForFunction(()=>game.gameMode==='FPS_SOLO' && game.firstPersonView.active && game.coopPlayers.length===2);
        const guestId=await guest.evaluate(()=>game.network.playerId);
        assert.equal(await host.evaluate(()=>game.network.active && game.firstPersonView.active),true);
        assert.equal(await host.evaluate(()=>{
            const snapshot=game.makeCoopSnapshot();
            const score=game.fpsManager.scoreBlue;
            game.applyCoopSnapshot({mode:'TDM',tdm:{scoreBlue:999}},game.network.playerId);
            return snapshot.mode==='FPS_SOLO' && !!snapshot.fps && !snapshot.tdm && game.fpsManager.scoreBlue===score && game.tdmManager.state==='IDLE';
        }),true);
        assert.equal(await guest.evaluate(()=>game.player.team),'red');
        assert.equal(await host.evaluate(()=>game.fpsManager.bots.length),0);
        // Silent walking/crouching and noisy sprinting must replicate to the host.
        await guest.evaluate(() => {
            Object.defineProperty(game.firstPersonView, 'locked', { configurable: true, get: () => true });
            game.player.keys = { KeyW: true, ShiftLeft: true };
        });
        await host.waitForFunction(id => game.remotePlayers.get(id).isSprinting, guestId);
        await guest.evaluate(() => { game.player.keys = { KeyW: true, ShiftLeft: true, ControlLeft: true }; });
        await host.waitForFunction(id => game.remotePlayers.get(id).isCrouching && !game.remotePlayers.get(id).isSprinting, guestId);
        await guest.evaluate(() => { game.player.keys = {}; delete game.firstPersonView.locked; });
        await host.waitForFunction(id => !game.remotePlayers.get(id).isSprinting, guestId);
        console.log('PASS: sprint/crouch state replicates and crouching overrides sprint.');
        const candidates=await host.evaluate(()=>{
            const result=[], probe=game.player.position.clone();
            for(let x=-20;x<=20;x+=2) for(let z=-16;z<=16;z+=2) {
                let clear=true;
                for(let offset=0;offset<=4;offset+=0.5) {
                    probe.set(x,0,z+offset);
                    if(game.arena.checkCollision(probe,0.8)) {clear=false;break;}
                    probe.y=1.55;
                    if(game.arena.colliders.some(b=>b.distanceToPoint(probe)<0.4)) {clear=false;break;}
                }
                if(clear) result.push([x,0,z]);
            }
            return result;
        });
        const origin=await guest.evaluate(candidates=>candidates.find(v=>{
            const probe=game.player.position.clone();
            for(let offset=0;offset<=4;offset+=0.5) {
                probe.set(v[0],0,v[2]+offset);
                if(game.arena.checkCollision(probe,0.8)) return false;
                probe.y=1.55;
                if(game.arena.colliders.some(b=>b.distanceToPoint(probe)<0.4)) return false;
            }
            return true;
        }),candidates);
        assert.ok(origin,'Both arenas must have a clear shooting lane');
        await host.evaluate(v=>{game.player.position.fromArray(v);game.player.velocity.set(0,0,0);game.player.health=1000;game.player.shield=0;game.player.invulnerability=0;},origin);
        await guest.evaluate(v=>{game.player.position.set(v[0],0,v[2]+4);game.player.velocity.set(0,0,0);},origin);
        await host.waitForFunction(({id,v})=>game.remotePlayers.get(id).position.distanceTo({x:v[0],y:0,z:v[2]+4})<0.1,{id:guestId,v:origin});
        await guest.evaluate(v=>{
            game.player.spawnProtected=true; game.player.invulnerability=5;
            game.weapons.fireCooldown=0;
            game.weapons.shoot(game.player.position.clone().add({x:0,y:1.55,z:0}),game.player.position.clone().set(v[0],1.55,v[2]),false,true,1,game.player);
        },origin);
        await host.waitForFunction(id => game.remotePlayers.get(id).radarRevealTimer > 0, guestId);
        assert.equal(await guest.evaluate(() => game.player.spawnProtected), false);
        assert.equal(await host.evaluate(id => game.remotePlayers.get(id).invulnerability, guestId), 0);
        await host.waitForFunction(()=>game.player.health<1000);
        await guest.waitForFunction(()=>game.remotePlayers.get('host').health<1000);
        assert.equal(await host.evaluate(()=>Number.isFinite(game.player.position.x)&&Number.isFinite(game.player.velocity.x)),true);
        await host.waitForFunction(id => game.remotePlayers.get(id).radarRevealTimer === 0, guestId);
        console.log('PASS: FPS guest fire cancels protection, reveals radar temporarily and damages host.');
        await host.evaluate(id=>{
            const p=game.remotePlayers.get(id);p.health=1000;p.shield=0;p.invulnerability=0;
            game.weapons.fireCooldown=0;
            game.weapons.shoot(game.player.position.clone().add({x:0,y:1.55,z:0}),p.position.clone().add({x:0,y:1.55,z:0}),false,true,1,game.player);
        },guestId);
        await host.waitForFunction(id=>game.remotePlayers.get(id).health<1000,guestId);
        await guest.waitForFunction(()=>game.player.health<1000);
        console.log('PASS: host FPS projectile damages guest and health replicates.');
        await host.evaluate(id=>{const p=game.remotePlayers.get(id);p.invulnerability=0;p.takeDamage(10000);},guestId);
        await guest.waitForFunction(()=>game.player.isDead);
        await guest.waitForFunction(()=>!game.player.isDead && game.player.spawnSeq>0);
        await host.waitForFunction(id=>game.remotePlayers.get(id).position.z<0,guestId);
        assert.equal(await guest.evaluate(()=>game.fpsManager.scoreBlue),1);
        assert.ok(await guest.evaluate(() => game.player.spawnProtected && game.player.invulnerability > 3.5 && game.player.invulnerability <= 5));
        assert.equal(await guest.locator('#duel-score-enemy').textContent(), '1');
        assert.equal(await guest.locator('#duel-score-you').textContent(), '0');
        console.log('PASS: five-second respawn protection and score from the red player perspective.');
        await guest.evaluate(()=>game.pauseGame());
        assert.equal(await guest.evaluate(()=>game.state),'PLAYING');
        const tick=await host.evaluate(()=>game.fpsManager.matchTimer);
        await host.waitForFunction(t=>game.fpsManager.matchTimer>t+0.1,tick);
        await guest.evaluate(()=>game.resumeGame());
        const late=await makePage();
        await late.evaluate(code=>game.network.join(code,'Late'),code);
        await late.waitForFunction(()=>game.gameMode==='FPS_SOLO' && game.firstPersonView.active && game.coopPlayers.length===3);
        console.log('PASS: authoritative respawn/score, online pause and FPS late join.');
        await host.evaluate(()=>{game.fpsManager.scoreBlue=game.fpsManager.targetKills;game.fpsManager.endMatch('blue');});
        await guest.waitForFunction(()=>game.fpsManager.state==='MATCH_OVER');
        assert.equal(await guest.evaluate(()=>game.ui.tdmBtnRestart.disabled),true);
        await host.evaluate(()=>game.restartGame());
        await guest.waitForFunction(()=>game.fpsManager.state==='ACTIVE' && game.fpsManager.scoreBlue===0);
        assert.equal(await guest.evaluate(()=>game.firstPersonView.active),true);
        await host.evaluate(()=>{game.network.fillBots=true;game.restartGame();});
        await guest.waitForFunction(()=>game.coopPlayers.length===8 && game.fpsManager.teamBlue.length===4 && game.fpsManager.teamRed.length===4);
        assert.equal(await guest.evaluate(()=>game.fpsManager.bots.length),0);
        assert.equal(await host.evaluate(()=>game.fpsManager.bots.length),5);
        const mateId=await host.evaluate(()=>game.fpsManager.teamBlue.find(p=>p.isBot).id);
        await host.evaluate(id=>{
            const mate=game.remotePlayers.get(id);mate.health=73;mate.maxHealth=100;mate.shield=30;mate.maxShield=150;
            mate.invulnerability=999;
            for(const bot of game.fpsManager.bots) bot.update=()=>{};
        },mateId);
        await late.waitForFunction(id=>game.remotePlayers.get(id)?.health===73 && game.remotePlayers.get(id)?.maxShield===150,mateId);
        const meterState=async page=>page.evaluate(id=>{
            const mate=game.remotePlayers.get(id), camera=game.firstPersonView.overhead;
            camera.position.copy(mate.mesh.position).add({x:0,y:15,z:15});camera.lookAt(mate.mesh.position);camera.updateMatrixWorld(true);
            game.ui.updateOverheadVitals(game.player,camera,game.canvas,[mate]);
            const meter=game.ui.teammateVitals.get(id), position=mate.mesh.position.clone();
            mate.mesh.getWorldPosition(position);position.y+=2.35;position.project(camera);
            const rect=game.canvas.getBoundingClientRect();
            const assertPosition=Math.round(rect.left+(position.x+1)*rect.width/2);
            return {hp:meter.querySelector('.overhead-health strong').textContent,shield:meter.querySelector('.overhead-shield > div').style.width,
                hpWidth:meter.querySelector('.overhead-health > div').style.width,aligned:meter.style.transform.includes(`${assertPosition}px`)};
        },mateId);
        const meters=await Promise.all([meterState(host),meterState(late)]);
        assert.deepEqual(meters[0],{hp:'73',shield:'20%',hpWidth:'73%',aligned:true});
        assert.deepEqual(meters[0],meters[1]);
        console.log('PASS: teammate HP/shield match on both clients and the HUD follows the visible world-space model.');
        assert.deepEqual(errors,[]);
        console.log('PASS: shared result/restart and host-only bots replicated to FPS guests; no JavaScript errors.');
    } finally { await browser?.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
