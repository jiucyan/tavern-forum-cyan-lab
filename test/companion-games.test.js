import test from 'node:test';
import assert from 'node:assert/strict';
import { createArcadeGame, normalizeArcadeGame, advanceArcadeGame, arcadeInput, arcadeFrame, pauseArcadeGame } from '../src/companion-games.js';

const make = (kind = 'catch') => createArcadeGame(kind, 'test-game', 100000, 42);
function run(game, duration, interval = 10) {
    const start = game.lastTickAt;
    for (let t = interval; t < duration; t += interval) advanceArcadeGame(game, start + t);
    advanceArcadeGame(game, start + duration);
}
const hit = (game, type, x = game.x) => {
    game.objects = [{ id: ++game.serial, type, x, y: .77, speed: .3, drift: 0 }];
    run(game, 10);
};

test('fixed simulation gives equivalent outcomes at 30, 60 and 120 FPS', () => {
    const games = [30, 60, 120].map(fps => {
        const game = make(); arcadeInput(game, { type: 'aim', x: .7 }); run(game, 15000, 1000 / fps); return game;
    });
    for (const game of games.slice(1)) {
        for (const key of ['score', 'hearts', 'seed', 'serial', 'combo', 'x']) assert.equal(game[key], games[0][key], key);
        assert.ok(Math.abs(game.elapsed - games[0].elapsed) < .001);
        assert.deepEqual(game.objects, games[0].objects);
    }
});

test('held and aimed movement is continuous, bounded, and stops on release', () => {
    const game = make(); arcadeInput(game, { type: 'axis', value: 1 }); run(game, 100);
    assert.ok(game.x > .55 && game.x < .7);
    arcadeInput(game, { type: 'axis', value: 0 }); const x = game.x; run(game, 100); assert.equal(game.x, x);
    arcadeInput(game, { type: 'aim', x: -10 }); run(game, 100); assert.ok(game.x > .06 && game.x < x);
    run(game, 2000); assert.ok(Math.abs(game.x - .06) < .00001);
    arcadeInput(game, { type: 'axis', value: 1 }); run(game, 1000); assert.equal(game.x, .94);
});

test('catch collision scores stars, gold and combo multiplier; misses break combo', () => {
    const game = make(); run(game, 2100); game.spawnAt = 1e9;
    for (let i = 0; i < 4; i++) hit(game, 'star');
    assert.equal(game.score, 40); hit(game, 'gold'); assert.equal(game.score, 90); assert.equal(game.bestCombo, 5);
    game.objects = [{ id: 20, type: 'star', x: .06, y: 1.079, speed: 1, drift: 0 }]; run(game, 10); assert.equal(game.combo, 0);
    hit(game, 'rain'); assert.equal(game.hearts, 2); hit(game, 'rain'); assert.equal(game.hearts, 2);
});

test('skills have cooldowns and the dodge shield prevents one-second collisions', () => {
    const game = make('dodge'); run(game, 2100); game.spawnAt = 1e9;
    arcadeInput(game, { type: 'press', direction: 0 }); const until = game.skillUntil;
    run(game, 100); arcadeInput(game, { type: 'press', direction: 0 }); assert.equal(game.skillUntil, until);
    hit(game, 'rain'); assert.equal(game.hearts, 3); assert.equal(arcadeFrame(game).skillReady, false);
    run(game, 1100); hit(game, 'rain'); assert.equal(game.hearts, 2);
    run(game, 5000); assert.equal(arcadeFrame(game).skillReady, true);
    const catchGame = make(); run(catchGame, 2100); catchGame.spawnAt = 1e9;
    catchGame.objects = [{ type: 'gold', x: .8, y: .4, speed: .3, drift: 0 }];
    arcadeInput(catchGame, { type: 'press', direction: 0 }); run(catchGame, 200);
    assert.ok(catchGame.objects[0].x < .8);
});

test('memory plays the whole sequence, rejects early input, and lengthens each round', () => {
    const game = make('memory'); run(game, 2100); assert.equal(game.sequence.length, 2);
    assert.equal(arcadeInput(game, { type: 'press', direction: 0 }), false); assert.equal(game.moves, 0);
    run(game, 2000); assert.equal(game.phase, 'answer');
    for (const choice of game.sequence) arcadeInput(game, { type: 'press', direction: choice - 1 });
    assert.equal(game.score, 10); assert.equal(game.phase, 'between');
    assert.equal(arcadeInput(game, { type: 'press', direction: 0 }), false);
    run(game, 900); assert.equal(game.sequence.length, 3);
    run(game, 2500); arcadeInput(game, { type: 'press', direction: (game.sequence[0] + 1) % 3 - 1 });
    assert.equal(game.hearts, 2); assert.equal(game.combo, 0);
});

test('memory timeouts consume lives and stop the game; objects and particles remain bounded', () => {
    const game = make('memory'); run(game, 33000); assert.ok(game.done); assert.equal(game.score, 0);
    const rain = make('dodge'); run(rain, 32000); assert.ok(rain.objects.length < 40); assert.ok(rain.particles.length <= 35);
});

test('suspended or paused games never catch up; resume excludes paused time', () => {
    const game = make(); run(game, 2500); const elapsed = game.elapsed;
    assert.equal(advanceArcadeGame(game, game.lastTickAt + 15000).paused, true); assert.equal(game.elapsed, elapsed);
    run(game, 3000); assert.equal(game.elapsed, elapsed);
    pauseArcadeGame(game, false, game.lastTickAt); run(game, 500); assert.ok(Math.abs(game.elapsed - elapsed - 500) < .001);
    pauseArcadeGame(game, true, game.lastTickAt); assert.equal(game.axis, 0);
});

test('serialized simulation resumes deterministically and legacy games are discarded', () => {
    const game = make(); run(game, 6500);
    const copy = normalizeArcadeGame(JSON.parse(JSON.stringify(game)));
    run(game, 2000); run(copy, 2000);
    for (const key of ['score', 'hearts', 'seed', 'serial', 'combo', 'x', 'elapsed']) assert.equal(copy[key], game[key], key);
    assert.deepEqual(copy.objects, game.objects);
    assert.equal(normalizeArcadeGame({ id: 'old', kind: 'catch', player: 1 }), null);
    assert.equal(normalizeArcadeGame({ ...game, kind: 'unknown' }), null);
    const bounded = normalizeArcadeGame({ ...game, hearts: 3.8, x: -999, score: NaN, objects: [null] });
    assert.equal(bounded.hearts, 3); assert.equal(bounded.x, .06); assert.equal(bounded.score, 0); assert.equal(bounded.objects.length, 0);
});
