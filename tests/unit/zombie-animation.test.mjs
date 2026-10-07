import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(s, c, next) { return s === 'three' ? { url: new URL('../../vendor/three.module.js', import.meta.url).href, shortCircuit: true } : next(s, c); } });
const T = await import('three');
const { Zombie, ZombieCombatState } = await import('../../src/gameplay/combat/enemies.js');

function fixture(type = 'walker') {
    const scene = new T.Group();
    for (const name of ['arm-right', 'leg-right']) { const node = new T.Group(); node.name = name; scene.add(node); }
    const clips = [
        new T.AnimationClip('idle', 1, [new T.NumberKeyframeTrack('arm-right.rotation[x]', [0, 1], [0, 0])]),
        new T.AnimationClip('walk', 1, [new T.NumberKeyframeTrack('leg-right.rotation[x]', [0, .5, 1], [-.5, .5, -.5])]),
        new T.AnimationClip('sprint', 1, [new T.NumberKeyframeTrack('leg-right.rotation[x]', [0, .5, 1], [-1, 1, -1])]),
        new T.AnimationClip('attack-melee-right', .4, [new T.NumberKeyframeTrack('arm-right.rotation[x]', [0, .2, .4], [0, -1.5, 0])])
    ];
    const zombie = new Zombie(new T.Scene(), type, new T.Vector3(), { 'mini-male-f': { scene, animations: clips } }, null, 1, { isPositionInSmoke: () => false });
    return zombie;
}

test('melee stops locomotion, moves the hand once, then holds the end pose', () => {
    for (const type of ['walker', 'sprinter']) {
        const z = fixture(type);
        z.mixer.update(.1);
        z.startMeleeAttack();
        assert.equal(z.animationName, 'attack-melee-right');
        assert.equal(z.currentAction.loop, T.LoopOnce);
        assert.equal(z.animations.walk.isRunning(), false);
        assert.equal(z.animations.sprint.isRunning(), false);
        z.mixer.update(.2);
        assert.ok(z.mesh.getObjectByName('arm-right').rotation.x < -1);
        assert.ok(Math.abs(z.mesh.getObjectByName('leg-right').rotation.x) < .001);
        z.mixer.update(.3);
        assert.equal(z.currentAction.paused, true);
        const sequence = z.animationSeq;
        z.startMeleeAttack();
        assert.ok(z.animationSeq > sequence);
        assert.equal(z.currentAction.paused, false);
        assert.equal(z.currentAction.time, 0);
    }
});

test('combat windup plays a strike before damage; recovery resumes pursuit', () => {
    const previous = globalThis.window; globalThis.window = {};
    try {
        const z = fixture(), p = { position: new T.Vector3(0, 0, 1), hits: 0, takeDamage() { this.hits++; } };
        z.update(.01, p, {}, [z]);
        assert.equal(z.combatState, ZombieCombatState.WINDUP);
        assert.equal(z.animationName, 'attack-melee-right');
        const atStart = z.position.clone();
        z.update(.1, p, {}, [z]); assert.equal(p.hits, 0);
        z.update(.11, p, {}, [z]); assert.equal(p.hits, 1);
        assert.equal(z.combatState, ZombieCombatState.RECOVERY);
        assert.deepEqual(z.position.toArray(), atStart.toArray());
        p.position.z = 10;
        z.update(.51, p, {}, [z]); z.update(.01, p, {}, [z]);
        assert.equal(z.animationName, 'walk');
        assert.ok(z.position.z > atStart.z);
        z.startMeleeAttack(); z.takeDamage(1);
        assert.equal(z.animationName, 'idle');
        assert.equal(z.combatState, ZombieCombatState.STUNNED);
    } finally { globalThis.window = previous; }
});

test('guest samples the host strike phase and restarts consecutive strikes of the same clip', () => {
    const host = fixture(), guest = fixture();
    host.startMeleeAttack(.8); host.mixer.update(.4);
    const snapshot = () => ({ animation: host.animationName, animationSeq: host.animationSeq,
        animationTime: host.currentAction.time, animationRate: host.currentAction.getEffectiveTimeScale(), animationPaused: host.currentAction.paused });
    guest.applyAnimationSnapshot(snapshot());
    assert.equal(guest.currentAction.time, host.currentAction.time);
    assert.equal(guest.mesh.getObjectByName('arm-right').rotation.x, host.mesh.getObjectByName('arm-right').rotation.x);
    host.mixer.update(2); guest.applyAnimationSnapshot(snapshot());
    assert.equal(guest.currentAction.paused, true);
    host.startMeleeAttack(); host.mixer.update(.05); guest.applyAnimationSnapshot(snapshot());
    assert.equal(guest.currentAction.paused, false);
    assert.equal(guest.currentAction.time, host.currentAction.time);
    host.deactivate(); host.activate(new T.Vector3(), 'sprinter');
    assert.equal(host.animationName, 'sprint');
    assert.equal(host.currentAction.getRoot(), host.mesh);
});
