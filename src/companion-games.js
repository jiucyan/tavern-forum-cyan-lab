// Deterministic simulation; drawing, input devices and metadata saves are separate.
export const GAME_DURATION = 30000;
export const GAME_COUNTDOWN = 2000;
const STEP = 1000 / 120;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const n = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;
const kinds = ['catch', 'memory', 'dodge'];
const random = game => { game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0; return game.seed / 4294967296; };

export function createArcadeGame(kind, id, now, seed) {
    return { version: 2, id, kind, startedAt: now, lastTickAt: now, seed: Math.max(1, seed >>> 0), elapsed: 0, accumulator: 0,
        paused: false, done: false, score: 0, moves: 0, combo: 0, bestCombo: 0, hearts: 3, x: .5, previousX: .5, axis: 0, target: .5,
        spawnAt: 350, serial: 0, objects: [], particles: [], cooldown: 0, skillUntil: 0, invincibleUntil: 0, engagedMs: 0,
        notice: '', noticeUntil: 0, safeLane: 2, round: 0, phase: 'show', phaseAt: 0, sequence: [], answer: 0, lit: -1, litUntil: 0 };
}

export function normalizeArcadeGame(value) {
    if (!value || value.version !== 2 || !kinds.includes(value.kind) || typeof value.id !== 'string') return null;
    const game = createArcadeGame(value.kind, value.id.slice(0, 100), n(value.startedAt), n(value.seed, 1));
    for (const key of ['lastTickAt', 'elapsed', 'score', 'moves', 'combo', 'bestCombo', 'spawnAt', 'serial', 'cooldown', 'skillUntil', 'invincibleUntil', 'engagedMs', 'noticeUntil', 'round', 'phaseAt', 'litUntil']) game[key] = n(value[key]);
    game.elapsed = Math.min(GAME_COUNTDOWN + GAME_DURATION, game.elapsed);
    game.accumulator = n(value.accumulator, 0, 0, STEP); game.hearts = Math.floor(n(value.hearts, 3, 0, 3));
    game.x = n(value.x, .5, .06, .94); game.previousX = game.x;
    game.axis = n(value.axis, 0, -1, 1); game.target = value.target === null ? null : n(value.target, game.x, .06, .94);
    game.paused = Boolean(value.paused); game.done = Boolean(value.done); game.safeLane = n(value.safeLane, 2, 0, 4);
    game.notice = typeof value.notice === 'string' ? value.notice.slice(0, 60) : '';
    game.phase = ['show', 'answer', 'between'].includes(value.phase) ? value.phase : 'show';
    game.sequence = Array.isArray(value.sequence) ? value.sequence.slice(0, 6).map(v => Math.floor(n(v, 0, 0, 2))) : [];
    game.answer = n(value.answer, 0, 0, 6); game.lit = n(value.lit, -1, -1, 2);
    game.objects = (Array.isArray(value.objects) ? value.objects : []).slice(-40).filter(o => ['star', 'gold', 'rain', 'sun'].includes(o?.type)).map(o => ({ id: n(o.id), type: o.type, x: n(o.x, .5, -.1, 1.1), y: n(o.y, 0, -.2, 1.2), previousY: n(o.y, 0, -.2, 1.2), speed: n(o.speed, .4, .1, 1), drift: n(o.drift, 0, -.12, .12) }));
    // Particles are purely visual and are not restored from disk.
    return game;
}

function notice(game, text, duration = 850) { game.notice = text; game.noticeUntil = game.elapsed + duration; }
function burst(game, x, y, good) {
    for (let i = 0; i < 7; i++) game.particles.push({ x, y, vx: Math.cos(i * .9) * .13, vy: Math.sin(i * .9) * .2 - .12, ttl: 500, good });
    game.particles = game.particles.slice(-35);
}
function scored(game, x, y, points) {
    game.combo++; game.bestCombo = Math.max(game.bestCombo, game.combo);
    const earned = points * (1 + Math.min(2, Math.floor(game.combo / 5)));
    game.score += earned; burst(game, x, y, true); notice(game, `+${earned}${game.combo > 1 ? ` · ${game.combo} 连击` : ''}`);
}
function hurt(game, x, y) {
    if (game.elapsed < game.invincibleUntil) return;
    game.hearts--; game.combo = 0; game.invincibleUntil = game.elapsed + 1000;
    burst(game, x, y, false); notice(game, '碰到雨滴了 · 换个位置');
}
function nextSequence(game) {
    game.round++; game.sequence = Array.from({ length: Math.min(6, 1 + game.round) }, () => Math.floor(random(game) * 3));
    game.phase = 'show'; game.phaseAt = game.elapsed; game.answer = 0; game.lit = -1;
}

export function arcadeInput(game, command) {
    if (!game || game.done || game.paused || !command) return false;
    const active = game.elapsed >= GAME_COUNTDOWN;
    if (game.kind === 'memory') {
        if (command.type !== 'press' || !active || game.phase !== 'answer') return false;
        const choice = Math.floor(clamp(command.direction + 1, 0, 2));
        game.moves++; game.engagedMs += 300; game.lit = choice; game.litUntil = game.elapsed + 180;
        if (choice !== game.sequence[game.answer]) {
            game.hearts--; game.combo = 0; game.phase = 'between'; game.phaseAt = game.elapsed; notice(game, '记错啦，下一组再来', 1000);
        } else {
            game.answer++;
            if (game.answer === game.sequence.length) { scored(game, .5, .5, game.sequence.length * 5); game.phase = 'between'; game.phaseAt = game.elapsed; }
        }
        return true;
    }
    if (command.type === 'axis') { game.axis = clamp(command.value, -1, 1); if (game.axis) { game.target = null; game.moves++; } return true; }
    if (command.type === 'aim') { game.axis = 0; game.target = clamp(command.x, .06, .94); game.moves++; return true; }
    if (command.type !== 'press') return false;
    game.moves++;
    if (command.direction) { game.axis = 0; game.target = clamp((game.target ?? game.x) + command.direction * .22, .06, .94); }
    else if (active && game.elapsed >= game.cooldown) {
        game.skillUntil = game.elapsed + (game.kind === 'catch' ? 1400 : 1000); game.cooldown = game.elapsed + 6000; game.engagedMs += 500;
        notice(game, game.kind === 'catch' ? '星星磁铁！' : '护盾开启！');
    }
    return true;
}

export function pauseArcadeGame(game, paused, now = Date.now()) {
    if (!game || game.done) return;
    game.paused = paused; game.lastTickAt = now; game.axis = 0; game.target = game.x; game.accumulator = 0;
}

function spawn(game, elapsed, difficulty) {
    const add = (type, x, speed, drift = 0) => game.objects.push({ id: ++game.serial, type, x, y: -.06, previousY: -.06, speed, drift });
    if (game.kind === 'catch') {
        const type = game.serial % 6 === 5 ? 'gold' : random(game) < .2 && elapsed > 4000 ? 'rain' : 'star';
        add(type, .1 + random(game) * .8, .3 + difficulty * .08);
        game.spawnAt += 800 - difficulty * 100;
    } else {
        game.safeLane = clamp(game.safeLane + (random(game) < .5 ? -1 : 1), 0, 4);
        for (let lane = 0; lane < 5; lane++) if (Math.abs(lane - game.safeLane) > .1 && (difficulty >= 1 || random(game) < .72)) add('rain', .1 + lane * .2, .32 + difficulty * .07);
        if (game.serial % 3 === 0) add('sun', .1 + game.safeLane * .2, .32 + difficulty * .07);
        game.spawnAt += 1100 - difficulty * 120;
    }
}

function simulate(game, dt) {
    game.elapsed = Math.min(GAME_COUNTDOWN + GAME_DURATION, game.elapsed + dt);
    const elapsed = game.elapsed - GAME_COUNTDOWN, seconds = dt / 1000;
    game.previousX = game.x;
    const move = game.axis ? game.axis * 1.15 * seconds : game.target === null ? 0 : clamp((game.target - game.x) * 16 * seconds, -1.65 * seconds, 1.65 * seconds);
    game.x = clamp(game.x + move, .06, .94);
    if (Math.abs(move) > .0001 && elapsed >= 0) game.engagedMs += dt;
    for (const p of game.particles) { p.x += p.vx * seconds; p.y += p.vy * seconds; p.ttl -= dt; }
    game.particles = game.particles.filter(p => p.ttl > 0);
    if (elapsed < 0) return;
    if (game.kind === 'memory') {
        if (!game.sequence.length) nextSequence(game);
        if (game.phase === 'show' && game.elapsed - game.phaseAt >= game.sequence.length * 650 + 350) { game.phase = 'answer'; game.phaseAt = game.elapsed; }
        if (game.phase === 'answer' && game.elapsed - game.phaseAt > game.sequence.length * 1600 + 2200) { game.hearts--; game.combo = 0; game.phase = 'between'; game.phaseAt = game.elapsed; notice(game, '时间到了，下组继续'); }
        if (game.phase === 'between' && game.elapsed - game.phaseAt > 850) nextSequence(game);
    } else {
        const difficulty = Math.min(2, Math.floor(elapsed / 10000));
        if (elapsed >= game.spawnAt) spawn(game, elapsed, difficulty);
        if (game.kind === 'dodge') game.score += Math.floor(elapsed / 1000) - Math.floor(Math.max(0, elapsed - dt) / 1000);
        game.objects = game.objects.filter(object => {
            const previous = object.y; object.previousY = previous; object.y += object.speed * seconds; object.x += object.drift * seconds;
            const good = object.type !== 'rain';
            if (game.kind === 'catch' && good && game.elapsed < game.skillUntil && object.y > .25) object.x += clamp(game.x - object.x, -.45 * seconds, .45 * seconds);
            const contact = previous <= .85 && object.y >= .77 && Math.abs(object.x - game.x) < (good ? .09 : .068);
            if (contact) {
                if (good) scored(game, object.x, .8, object.type === 'gold' ? 25 : 10);
                else if (game.kind === 'dodge' && game.elapsed < game.skillUntil) { burst(game, object.x, .8, true); notice(game, '护盾挡住了雨滴'); }
                else hurt(game, object.x, .8);
                return false;
            }
            if (object.y > 1.08) { if (game.kind === 'catch' && good) game.combo = 0; return false; }
            return true;
        });
    }
    if (game.hearts <= 0 || elapsed >= GAME_DURATION - .01) { game.done = true; game.axis = 0; }
}

export function advanceArcadeGame(game, now = Date.now()) {
    if (!game || game.done) return { completed: Boolean(game?.done) };
    const elapsed = now - game.lastTickAt;
    if (elapsed < 0) { game.lastTickAt = now; return {}; }
    game.lastTickAt = now;
    if (game.paused) return {};
    // A suspended tab must never catch up collisions, score or rewards in the background.
    if (elapsed > 1000) { pauseArcadeGame(game, true, now); return { paused: true }; }
    game.accumulator += Math.min(elapsed, 250);
    while (game.accumulator + .00001 >= STEP && !game.done) { simulate(game, STEP); game.accumulator -= STEP; }
    return { completed: game.done };
}

export function arcadeFrame(game) {
    if (!game) return null;
    const showing = game.phase === 'show', sequenceIndex = Math.floor((game.elapsed - game.phaseAt) / 650);
    const phase = (game.elapsed - game.phaseAt) % 650;
    const lit = showing && sequenceIndex < game.sequence.length && phase < 450 ? game.sequence[sequenceIndex] : !showing && game.litUntil > game.elapsed ? game.lit : -1;
    return { game, remaining: Math.max(0, Math.ceil((GAME_COUNTDOWN + GAME_DURATION - game.elapsed) / 1000)), countdown: Math.max(0, Math.ceil((GAME_COUNTDOWN - game.elapsed) / 1000)), lit,
        skillReady: game.elapsed >= game.cooldown, cooldown: Math.max(0, Math.ceil((game.cooldown - game.elapsed) / 1000)), multiplier: 1 + Math.min(2, Math.floor(game.combo / 5)) };
}
