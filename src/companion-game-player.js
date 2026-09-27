import { advanceArcadeGame, arcadeInput, arcadeFrame, pauseArcadeGame } from './companion-games.js';

// One canvas and one animation loop per visible game. No DOM rebuilds or metadata writes per input/frame.
export function createCompanionGamePlayer(root, { finish, checkpoint }) {
    let session = null, raf = 0, lastSave = 0, pointer = null, controlPointer = null, held = null, ignoreClickUntil = 0;
    const keys = new Set();
    const owned = () => session && session.current() && session.data.world.companion === session.companion && session.companion.life.game === session.game;
    const valid = () => owned() && session.canvas.isConnected;
    const active = () => valid() && !session.game.paused && !session.game.done;
    const save = () => { if (valid()) { lastSave = Date.now(); void checkpoint(session.data); } };
    function stop(pause = true) {
        cancelAnimationFrame(raf); raf = 0;
        if (owned() && pause && !session.game.done) { pauseArcadeGame(session.game, true); void checkpoint(session.data); }
        session = null; pointer = null; controlPointer = null; held = null; keys.clear();
    }
    function pause(value) {
        if (!valid() || session.game.paused === value) return;
        pauseArcadeGame(session.game, value); pointer = null; controlPointer = null; held = null; keys.clear(); save();
        if (!value) session.canvas.focus({ preventScroll: true });
    }
    const press = direction => { if (active()) arcadeInput(session.game, { type: 'press', direction }); };
    function control(event) {
        const target = event.target.closest('[data-action="companion-menu-nav"], [data-action="companion-menu-confirm"]');
        return target ? Number(target.dataset.direction || 0) : null;
    }
    root.addEventListener('pointerdown', event => {
        if (!active() || event.isPrimary === false || (event.button !== 0 && event.pointerType !== 'touch')) return;
        const direction = control(event);
        if (direction !== null) {
            controlPointer = event.pointerId;
            if (session.game.kind === 'memory' || direction === 0) press(direction);
            else { held = { id: event.pointerId, direction, at: performance.now(), target: event.target }; }
            try { event.target.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
            ignoreClickUntil = Date.now() + 500; return;
        }
        if (event.target !== session.canvas || session.game.kind === 'memory') return;
        pointer = event.pointerId; session.canvas.setPointerCapture(event.pointerId);
        const box = session.canvas.getBoundingClientRect(); arcadeInput(session.game, { type: 'aim', x: (event.clientX - box.left) / box.width });
        event.preventDefault();
    });
    root.addEventListener('pointermove', event => {
        if (!active() || pointer !== event.pointerId) return;
        const box = session.canvas.getBoundingClientRect(); arcadeInput(session.game, { type: 'aim', x: (event.clientX - box.left) / box.width });
        event.preventDefault();
    }, { passive: false });
    const release = event => {
        if (controlPointer === event.pointerId) { controlPointer = null; ignoreClickUntil = Date.now() + 350; }
        if (pointer === event.pointerId) pointer = null;
        if (held?.id !== event.pointerId) return;
        if (active()) {
            arcadeInput(session.game, { type: 'axis', value: 0 });
            if (event.type !== 'pointercancel' && performance.now() - held.at < 160) press(held.direction);
        }
        held = null; ignoreClickUntil = Date.now() + 350;
    };
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', release);
    root.addEventListener('click', event => {
        if (!active()) return;
        const answer = event.target.closest('[data-arcade-answer]');
        if (answer) press(Number(answer.dataset.arcadeAnswer));
        if (event.target.closest('[data-arcade-skill]')) press(0);
    });
    root.addEventListener('keydown', event => {
        if (!valid() || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
        if (['Escape', 'p', 'P'].includes(event.key)) { event.preventDefault(); if (!event.repeat) pause(!session.game.paused); return; }
        const direction = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1, ArrowUp: 0, ArrowDown: 0, ' ': 0, Enter: 0 }[event.key];
        if (direction === undefined || !active()) return;
        // Keep Enter/Space activation on actual buttons accessible and avoid a second action.
        if (event.target.closest('button') && ['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        if (event.repeat) return;
        if (session.game.kind === 'memory' || direction === 0) press(direction);
        else { keys.add(direction); arcadeInput(session.game, { type: 'axis', value: [...keys].reduce((a, b) => a + b, 0) }); }
    });
    window.addEventListener('keyup', event => {
        const direction = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 }[event.key];
        if (direction === undefined) return;
        keys.delete(direction);
        if (active() && session.game.kind !== 'memory') arcadeInput(session.game, { type: 'axis', value: [...keys].reduce((a, b) => a + b, 0) });
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
    window.addEventListener('blur', () => pause(true));

    function paint() {
        const { game, canvas, context: ctx, ink, screen, shell } = session, frame = arcadeFrame(game);
        const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
        const pixel = (x, y, w, h, alpha = 1) => { ctx.globalAlpha = alpha; ctx.fillStyle = ink; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; };
        for (let i = 0; i < 9; i++) { const y = ((game.elapsed * .008 + i * 37) % Math.max(1, height)); pixel((i * 43 + 19) % Math.max(1, width), y, 2, 2, .12); }
        if (game.kind !== 'memory') {
            pixel(0, height * .89, width, 1, .18);
            for (const object of game.objects) {
                const x = object.x * width, y = object.y * height;
                ctx.fillStyle = ink;
                if (object.type === 'rain') { ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x, y + 6); ctx.lineTo(x + 4, y + 2); ctx.closePath(); ctx.fill(); }
                else {
                    const radius = object.type === 'gold' ? 9 : 6;
                    ctx.beginPath();
                    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .43 : radius; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
                    ctx.closePath(); if (object.type === 'gold') { ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); } else ctx.fill();
                }
            }
            const x = game.x * width, y = height * .82;
            if (game.elapsed < game.invincibleUntil) ctx.globalAlpha = Math.floor(game.elapsed / 100) % 2 ? .35 : 1;
            ctx.fillStyle = ink;
            if (game.kind === 'catch') { ctx.fillRect(x - 13, y, 26, 5); ctx.fillRect(x - 10, y + 5, 20, 6); ctx.fillStyle = screen; ctx.fillRect(x - 7, y + 5, 14, 2); }
            else { ctx.fillRect(x - 8, y - 8, 16, 16); ctx.fillStyle = screen; ctx.fillRect(x - 5, y - 4, 3, 3); ctx.fillRect(x + 2, y - 4, 3, 3); }
            ctx.globalAlpha = 1;
            if (game.skillUntil > game.elapsed) { ctx.beginPath(); ctx.arc(x, y, game.kind === 'catch' ? 28 : 21, Math.PI, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke(); }
        }
        for (const p of game.particles) pixel(p.x * width, p.y * height, p.good ? 3 : 4, 3, Math.max(0, p.ttl / 500));
        const set = (selector, value) => { const node = shell.querySelector(selector); if (node && node.textContent !== value) node.textContent = value; };
        const pauseButton = shell.querySelector('header [data-action="pet-game-pause"]');
        pauseButton.setAttribute('aria-label', game.paused ? '继续游戏' : '暂停游戏');
        pauseButton.setAttribute('aria-pressed', String(game.paused));
        set('[data-game-score]', `${game.score} 分`); set('[data-game-time]', `${Math.min(30, frame.remaining)} 秒`);
        set('[data-game-hearts]', '♥'.repeat(Math.max(0, game.hearts))); set('[data-game-combo]', game.combo ? `${game.combo} 连击 ×${frame.multiplier}` : '连击 0');
        const showing = game.kind === 'memory' && game.phase === 'show';
        const prompt = game.noticeUntil > game.elapsed ? game.notice : game.kind === 'memory' ? showing ? `记住 ${game.sequence.length} 个方向` : game.phase === 'answer' ? `轮到你了 ${game.answer}/${game.sequence.length}` : '准备下一组' : '拖动 / 长按左右 · 确认使用技能';
        set('[data-game-notice]', prompt); set('[data-game-round]', `第 ${game.round || 1} 组`);
        const skill = shell.querySelector('[data-arcade-skill]');
        if (skill) { skill.disabled = !frame.skillReady || Boolean(frame.countdown) || game.paused; set('[data-arcade-skill]', `${game.kind === 'catch' ? '磁铁' : '护盾'} · ${frame.skillReady ? '就绪' : frame.cooldown + 's'}`); }
        shell.querySelectorAll('[data-arcade-answer]').forEach((button, i) => { button.classList.toggle('is-lit', frame.lit === i); button.disabled = game.paused || showing || Boolean(frame.countdown); });
        const pausePanel = shell.querySelector('.tf-arcade-pause'); pausePanel.hidden = !game.paused;
        const countdown = shell.querySelector('.tf-arcade-countdown'); countdown.hidden = !frame.countdown || game.paused; countdown.textContent = String(frame.countdown || '');
    }
    function tick() {
        if (!valid()) { stop(false); return; }
        if ((document.hidden || root.hidden) && !session.game.paused) pause(true);
        const game = session.game, now = Date.now();
        if (held && performance.now() - held.at >= 160 && active() && game.axis !== held.direction) arcadeInput(game, { type: 'axis', value: held.direction });
        const result = advanceArcadeGame(game, now);
        paint();
        if (result.completed) { const done = session; stop(false); void finish(done.data, done.companion, done.current); return; }
        if (result.paused || (!game.paused && now - lastSave >= 2000)) save();
        raf = requestAnimationFrame(tick);
    }
    return {
        sync(data, current) {
            const game = data.world.companion.life.game, canvas = root.querySelector('.tf-pet-arcade canvas');
            if (!game || !canvas || root.hidden) { stop(); return; }
            if (session?.game === game && session.canvas === canvas) return;
            const same = session?.game === game;
            if (!same) stop(); else {
                cancelAnimationFrame(raf); pointer = null; controlPointer = null; held = null; keys.clear();
                arcadeInput(game, { type: 'axis', value: 0 });
            }
            if (Date.now() - game.lastTickAt > 1000) pauseArcadeGame(game, true);
            const shell = canvas.closest('.tf-pet-arcade'), style = getComputedStyle(shell);
            session = { data, companion: data.world.companion, game, canvas, context: canvas.getContext('2d'), shell, current, ink: style.getPropertyValue('--pet-ink').trim() || '#465c3b', screen: style.getPropertyValue('--pet-screen').trim() || '#dce8c1' };
            lastSave = Date.now(); paint(); raf = requestAnimationFrame(tick);
        },
        press(direction, event) { if (event?.detail === 0 || Date.now() >= ignoreClickUntil) press(direction); },
        togglePause() { if (valid()) pause(!session.game.paused); },
        stop,
    };
}
