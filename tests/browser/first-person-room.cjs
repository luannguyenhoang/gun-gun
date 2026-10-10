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
        const makePage = async () => {
            const p=await context.newPage(); p.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
            await p.goto(`http://127.0.0.1:${server.address().port}`);
            await p.waitForFunction(()=>window.game?.state==='MENU'); return p;
        };
        const host=await makePage(), guest=await makePage();
        await host.locator('#mode-tab-fps').click();
        const code=await host.evaluate(async()=>{await game.network.create('Host');return game.network.code;});
        await guest.evaluate(code=>game.network.join(code,'Guest'),code);
        await host.locator('#room-start').click();
        await guest.waitForFunction(()=>game.gameMode==='TDM' && game.firstPersonView.active && game.coopPlayers.length===2);
        const guestId=await guest.evaluate(()=>game.network.playerId);
        assert.equal(await host.evaluate(()=>game.network.active && game.firstPersonView.active),true);
        assert.equal(await guest.evaluate(()=>game.player.team),'red');
        assert.equal(await host.evaluate(()=>game.tdmManager.bots.length),0);
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
            game.weapons.fireCooldown=0;
            game.weapons.shoot(game.player.position.clone().add({x:0,y:1.55,z:0}),game.player.position.clone().set(v[0],1.55,v[2]),false,true,1,game.player);
        },origin);
        await host.waitForFunction(()=>game.player.health<1000);
        await guest.waitForFunction(()=>game.remotePlayers.get('host').health<1000);
        assert.equal(await host.evaluate(()=>Number.isFinite(game.player.position.x)&&Number.isFinite(game.player.velocity.x)),true);
        console.log('PASS: FPS room joins on opposite teams; guest shot damages host without corrupting movement.');
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
        assert.equal(await guest.evaluate(()=>game.tdmManager.scoreBlue),1);
        await guest.evaluate(()=>game.pauseGame());
        assert.equal(await guest.evaluate(()=>game.state),'PLAYING');
        const tick=await host.evaluate(()=>game.tdmManager.matchTimer);
        await host.waitForFunction(t=>game.tdmManager.matchTimer>t+0.1,tick);
        await guest.evaluate(()=>game.resumeGame());
        const late=await makePage();
        await late.evaluate(code=>game.network.join(code,'Late'),code);
        await late.waitForFunction(()=>game.gameMode==='TDM' && game.firstPersonView.active && game.coopPlayers.length===3);
        console.log('PASS: authoritative respawn/score, online pause and FPS late join.');
        await host.evaluate(()=>{game.tdmManager.scoreBlue=game.tdmManager.targetKills;game.tdmManager.endMatch('blue');});
        await guest.waitForFunction(()=>game.tdmManager.state==='MATCH_OVER');
        assert.equal(await guest.evaluate(()=>game.ui.tdmBtnRestart.disabled),true);
        await host.evaluate(()=>game.restartGame());
        await guest.waitForFunction(()=>game.tdmManager.state==='ACTIVE' && game.tdmManager.scoreBlue===0);
        assert.equal(await guest.evaluate(()=>game.firstPersonView.active),true);
        await host.evaluate(()=>{game.network.fillBots=true;game.restartGame();});
        await guest.waitForFunction(()=>game.coopPlayers.length===8 && game.tdmManager.teamBlue.length===4 && game.tdmManager.teamRed.length===4);
        assert.equal(await guest.evaluate(()=>game.tdmManager.bots.length),0);
        assert.equal(await host.evaluate(()=>game.tdmManager.bots.length),5);
        assert.deepEqual(errors,[]);
        console.log('PASS: shared result/restart and host-only bots replicated to FPS guests; no JavaScript errors.');
    } finally { await browser?.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
