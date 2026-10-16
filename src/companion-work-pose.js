import { renderHomesteadItemIcon } from './companion-homestead-ui.js';

// Foot pivots preserve each native silhouette while it quietly watches a task.
export const WORK_FITS = Object.freeze({
    frog: { foot: [32, 56.5] }, cat: { foot: [28.5, 57] }, rabbit: { foot: [32, 57] },
    fox: { foot: [28, 57] }, penguin: { foot: [32, 57] }, 'robo-bird': { foot: [32, 57] },
    octopus: { foot: [32, 57] }, goldfish: { foot: [26, 57] }, soot: { foot: [32, 57] }, mystery: { foot: [32, 56] },
});
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pointMix = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const rotate = (point, pivot, angle) => {
    const rad = angle * Math.PI / 180, x = point.x - pivot.x, y = point.y - pivot.y;
    return { x: pivot.x + x * Math.cos(rad) - y * Math.sin(rad), y: pivot.y + x * Math.sin(rad) + y * Math.cos(rad) };
};
export function getWorkFit(kind, stage = 'adult') {
    const aquatic = kind === 'goldfish' || kind === 'frog' && stage === 'baby';
    const behavior = aquatic ? 'water-watch' : ({ cat: 'sniff-watch', fox: 'quiet-sniff', rabbit: 'ear-listen', frog: 'crouch-watch', penguin: 'flipper-rest', 'robo-bird': 'wing-curious', octopus: 'tentacle-rest', soot: 'soft-settle' })[kind] || 'quiet-watch';
    const fit = { ...(WORK_FITS[kind] || WORK_FITS.mystery), kind, growthStage: stage, aquatic, behavior };
    if (!['baby', 'young'].includes(stage)) return fit;
    const baby = stage === 'baby';
    const feet = { cat: [32, 60], rabbit: [32, 60], fox: [32, 60], frog: baby ? [28, 56] : [33, 56],
        penguin: baby ? [33, 59] : [33, 60], 'robo-bird': [34, 60], octopus: [33, 57],
        goldfish: baby ? [29, 54] : [29, 55], soot: baby ? [33, 55] : [33, 60] };
    return { ...fit, foot: feet[kind] || [33, 56] };
}

const pulse = (p, from, to) => Math.sin(clamp((p - from) / (to - from)) * Math.PI);

/** The player operates scene tools; the companion reacts beside the activity. */
export function sampleWorkPose({ action, progress = 0, elapsed = 0, phase = '', itemId = '', geometry: g, reduced = false, kind = 'cat', growthStage = 'adult' }) {
    const p = clamp(progress), cooking = action === 'cook', casting = action === 'fishing';
    const fit = getWorkFit(kind, growthStage), aquatic = fit.aquatic;
    const body = { x: 0, y: 0, angle: 0, sx: 1, sy: 1 };
    // One deliberate reaction, with a quiet pause. No climbing or whole-body bob.
    const attention = reduced ? 0 : casting ? phase === 'bite' ? .65 : pulse(clamp(elapsed / 2200), .1, .9)
        : pulse(p, .12, .62) + pulse(p, .76, 1) * .28;
    let tailAngle = 0, earAngle = 0, limbAngle = 0;
    if (!reduced) {
        if (aquatic) { const swim = casting ? 1 : Math.sin(p * Math.PI); body.x = Math.sin(elapsed / 760) * .4 * g.unit * swim; body.angle = Math.sin(elapsed / 950) * .7 * attention; tailAngle = Math.sin(elapsed / 300) * (2 + 3 * attention) * swim; }
        else if (kind === 'cat') { body.angle = 1.6 * attention; tailAngle = -4 * attention; }
        else if (kind === 'fox') { body.angle = 1.1 * attention; body.sx = 1 + .008 * attention; tailAngle = 3 * attention; }
        else if (kind === 'rabbit') { body.sy = 1 - .008 * attention; earAngle = -4 * attention; }
        else if (kind === 'frog') { body.sy = 1 - .018 * attention; body.sx = 1 + .007 * attention; }
        else if (kind === 'penguin') { body.angle = .6 * attention; limbAngle = -3 * attention; }
        else if (kind === 'robo-bird') { body.angle = -.7 * attention; limbAngle = 2.5 * attention; }
        else if (kind === 'octopus') { body.sy = 1 - .01 * attention; body.sx = 1 + .012 * attention; limbAngle = 3 * attention; }
        else if (kind === 'soot') { body.sx = 1 + .018 * attention; body.sy = 1 - .018 * attention; }
    }
    const common = { body, behavior: fit.behavior, aquatic, support: aquatic ? 'water' : 'ground', tailAngle, earAngle, limbAngle, unit: g.unit };
    if (cooking) {
        const stage = p < .12 ? 'prepare' : p < .72 ? 'work' : p < .88 ? 'serve' : 'settle';
        const orbit = (p - .12) * Math.PI * 8, active = smooth((p - .12) / .1) * (1 - smooth((p - .65) / .07));
        const tip = { x: g.table.x + (reduced ? 0 : Math.sin(orbit) * (itemId === 'grilled-fish' ? 4 : 2.5) * g.unit * active), y: g.table.y - 6 * g.unit };
        const grip = { x: tip.x - 9 * g.unit, y: tip.y - 10 * g.unit };
        const toolOpacity = reduced ? 1 : smooth((p - .04) / .08) * (1 - smooth((p - .69) / .06));
        return { ...common, stage, grip, tip, toolOpacity, fish: 0,
            dish: reduced ? 0 : smooth((p - .72) / .06) * (1 - smooth((p - .88) / .08)),
            steam: itemId === 'bento' ? 0 : .5 * toolOpacity };
    }
    const castProgress = clamp(elapsed / 800);
    const stage = casting ? castProgress < 1 ? 'cast' : phase === 'bite' ? 'bite' : 'wait' : p < .3 ? 'pull' : p < .76 ? 'catch' : 'stow';
    // The player's rod remains at the bank, independent of the pet's anatomy.
    const grip = { x: g.water.x + 31 * g.unit, y: g.water.y + 42 * g.unit };
    const rodAngle = reduced ? 0 : casting ? castProgress < 1 ? -24 * Math.sin(castProgress * Math.PI) : phase === 'bite' ? Math.sin(elapsed / 170) : 0 : -20 * Math.sin(p * Math.PI);
    const tip = rotate({ x: grip.x - 17 * g.unit, y: grip.y - 42 * g.unit }, grip, rodAngle);
    let float = casting ? pointMix(tip, g.water, reduced ? 1 : smooth(castProgress))
        : pointMix(g.water, { x: tip.x + 4 * g.unit, y: tip.y + 20 * g.unit }, smooth(p / .65));
    if (casting && castProgress === 1 && !reduced) float.y += (phase === 'bite' ? 1.4 : .5) * g.unit * Math.sin(elapsed / (phase === 'bite' ? 110 : 540));
    if (!casting && p > .7) float = pointMix(float, { x: grip.x + 9 * g.unit, y: grip.y - 2 * g.unit }, smooth((p - .7) / .25));
    return { ...common, stage, grip, tip, float, dish: 0, steam: 0,
        fish: !casting && itemId ? smooth((p - .15) / .25) * (1 - smooth((p - .91) / .09)) : 0,
        toolOpacity: casting ? 1 : 1 - smooth((p - .9) / .1) };
}

const icon = id => renderHomesteadItemIcon(id).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
export function renderWorkPoseArt(action, itemId = '') {
    const cooking = action === 'cook';
    return `<span class="tf-homestead-motion-art tf-work-pose-art" data-player-operated="true" aria-hidden="true"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      ${cooking ? `<g data-work-pot>${itemId === 'bento' ? '<path d="M-12 -10H12V0H-12Z" fill="#b89670"/><path d="M-10 -9H10V-2H-10Z" fill="#efe0b8"/><path d="M-8 -8H-1V-3H-8Z" fill="#fcf0d1"/><path d="M2 -8H8V-3H2Z" fill="#93ae7c"/>' : itemId === 'grilled-fish' ? '<path d="M-14 -6H14V-2H10V1H-10V-2H-14Z" fill="#667b70"/><path d="M-11 -7H11V-4H-11Z" fill="#c4c5a0"/><path d="M-7 -7H5L9 -9V-4L5 -5H-7Z" fill="#d7b981"/>' : '<path d="M-12 -12H12V-3H9V0H-9V-3H-12Z" fill="#789b92"/><path d="M-12 -12H12V-10H-12Z" fill="#c4d3b6"/><path d="M-9 -10H9V-8H-9Z" fill="#e2bb83"/><path d="M-16 -10H-12V-7H-16ZM12 -10H16V-7H12Z" fill="#9b805a"/><path d="M-9 -7H-7V-3H-9Z" fill="#aec8b4"/>'}</g><g data-work-steam fill="none" stroke="#fff1d1" stroke-width="1.2"><path d="M-5 -17q-3 -3 0 -6t0 -6M5 -16q-3 -3 0 -6t0 -6"/></g><g data-work-dish>${icon(itemId || 'bento')}</g>` : '<path data-work-line fill="none" stroke="#eee5cd" stroke-width=".75"/><g data-work-float><path d="M-7 3H7M-4 5H5" fill="none" stroke="#d7e9d4" stroke-width=".7"/><rect x="-1.5" y="-3" width="3" height="4" fill="#cb8b75"/><rect x="-1.5" y="1" width="3" height="2" fill="#f8e3b4"/></g><g data-work-catch>' + (itemId ? icon(itemId) : '<path d="M15 12v9q0 4 -3 2" fill="none" stroke="#aaa68a"/>') + '</g>'}
      <path data-work-tool fill="none" stroke="${cooking ? '#b39367' : '#b18d5c'}" stroke-width="${cooking ? '2.1' : '1.7'}" stroke-linecap="round"/>
      <path data-work-tool-light fill="none" stroke="#e4c796" stroke-width=".65"/>
      ${cooking ? `<path data-work-tool-head d="${itemId === 'grilled-fish' ? 'M-2 -2H2V3H-2Z' : itemId === 'bento' ? 'M2 -5H3V2H2Z' : 'M-2 -1Q-3 4 0 4Q3 4 2 -1Z'}" fill="${itemId === 'grilled-fish' ? '#889c8b' : '#b39367'}"/>` : ''}
    </svg></span>`;
}

const write = (node, attrs) => { if (node) for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); };
const coords = p => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
function measure(control, fit) {
    const avatar = control.querySelector(':scope > .tf-pixel-avatar, :scope > .tf-companion-photo');
    const svg = avatar?.querySelector('.tf-pixel-pet'), art = control.querySelector('.tf-work-pose-art');
    const stage = control.closest('.tf-pet-stage');
    if (!avatar || !art || !stage) return null;
    avatar.style.setProperty('--tf-work-x', '0px'); avatar.style.setProperty('--tf-work-y', '0px'); avatar.style.setProperty('--tf-work-angle', '0deg');
    avatar.style.setProperty('--tf-work-scale-x', '1'); avatar.style.setProperty('--tf-work-scale-y', '1');
    const box = art.getBoundingClientRect(), room = stage.getBoundingClientRect(), a = avatar.getBoundingClientRect();
    if (!box.width || !room.width) return null;
    const toArt = p => ({ x: (p.x - box.left) * 100 / box.width, y: (p.y - box.top) * 100 / box.height });
    const matrix = svg?.getScreenCTM();
    const fromSvg = ([x, y]) => matrix ? toArt({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f })
        : toArt({ x: a.left + a.width * x / 64, y: a.top + a.height * y / 64 });
    const foot = fromSvg(fit.foot);
    const roomPoint = (x, y) => toArt({ x: room.left + room.width * x / 320, y: room.top + room.height * y / 240 });
    const footScreen = { x: box.left + foot.x * box.width / 100, y: box.top + foot.y * box.height / 100 };
    avatar.style.transformOrigin = `${footScreen.x - a.left}px ${footScreen.y - a.top}px`;
    const unit = room.width / 320 * 100 / box.width;
    return { avatar, svg, art, stage, foot, table: roomPoint(218, 98), water: roomPoint(264, 116), unit, size: box.width,
        roomWidth: room.width, roomHeight: room.height, artHeight: box.height };
}

function paint(context, elapsed) {
    const { control, fit, geometry: g, action, duration, itemId, phase, reduced } = context;
    const pose = sampleWorkPose({ action, progress: elapsed / duration, elapsed, phase: phase(), itemId, geometry: g, reduced, kind: fit.kind, growthStage: fit.growthStage });
    const { body, grip, tip, unit } = pose;
    g.avatar.style.setProperty('--tf-work-x', `${body.x * g.size / 100}px`);
    g.avatar.style.setProperty('--tf-work-y', `${body.y * g.size / 100}px`);
    g.avatar.style.setProperty('--tf-work-angle', `${body.angle}deg`);
    g.avatar.style.setProperty('--tf-work-scale-x', String(body.sx)); g.avatar.style.setProperty('--tf-work-scale-y', String(body.sy));
    for (const part of context.secondaryParts) {
        const value = part.type === 'ear' ? pose.earAngle : part.type === 'limb' ? pose.limbAngle : pose.tailAngle;
        part.node.style.setProperty('rotate', `${value * (part.index % 2 ? -.7 : 1)}deg`);
    }
    const q = selector => control.querySelector(selector);
    const toolPath = `M${coords(grip)}L${coords(tip)}`;
    write(q('[data-work-tool]'), { d: toolPath, opacity: pose.toolOpacity });
    write(q('[data-work-tool-light]'), { d: toolPath, opacity: pose.toolOpacity * .5 });
    const angle = Math.atan2(tip.y - grip.y, tip.x - grip.x) * 180 / Math.PI;
    write(q('[data-work-tool-head]'), { transform: `translate(${coords(tip)}) rotate(${angle - 90}) scale(${unit})`, opacity: pose.toolOpacity });
    if (action === 'cook') {
        write(q('[data-work-pot]'), { transform: `translate(${coords(g.table)}) scale(${unit})` });
        write(q('[data-work-steam]'), { transform: `translate(${g.table.x} ${g.table.y - (reduced ? 0 : elapsed % 800 / 160) * unit}) scale(${unit})`, opacity: pose.steam });
        write(q('[data-work-dish]'), { transform: `translate(${g.table.x - 12 * unit} ${g.table.y - 24 * unit}) scale(${.75 * unit})`, opacity: pose.dish });
    } else {
        write(q('[data-work-line]'), { d: `M${coords(tip)}Q${tip.x + 8 * unit} ${tip.y - 4 * unit} ${coords(pose.float)}`, opacity: pose.toolOpacity });
        write(q('[data-work-float]'), { transform: `translate(${coords(pose.float)}) scale(${unit})`, opacity: action === 'fishing' ? 1 : (1 - pose.fish) * pose.toolOpacity });
        write(q('[data-work-catch]'), { transform: `translate(${pose.float.x - 9 * unit} ${pose.float.y - 4 * unit}) scale(${.55 * unit})`, opacity: pose.fish });
    }
    control.dataset.workPhase = pose.stage;
    control.dataset.workProgress = String(clamp(elapsed / duration));
    control.dataset.workGrip = `${grip.x.toFixed(3)},${grip.y.toFixed(3)}`;
    control.dataset.workBehavior = pose.behavior; control.dataset.workSupport = pose.support;
    const label = control.closest('.tf-pet-stage')?.querySelector('.tf-homestead-working');
    const company = fit.aquatic ? '它轻摆尾鳍陪着你' : ({ cat: '它凑近闻闻香气', fox: '它抬头闻了闻', rabbit: '它竖起耳朵等开饭', frog: '它蹲在一旁安静等候', penguin: '它收好双翅陪着你', octopus: '它轻卷触手在旁等候', 'robo-bird': '它歪头看着小锅', soot: '它软软地窝在旁边' })[fit.kind] || '它在旁边陪着你';
    const labels = { prepare: `你在备菜，${company}`, work: `你在${itemId === 'bento' ? '装便当' : itemId === 'grilled-fish' ? '给小鱼翻面' : '慢慢搅拌'}，${company}`,
        serve: '你盛好料理，它等着尝一口', settle: '你收好餐具，它安心等开饭', cast: '你抛出鱼线，它望向水面', wait: '你静候鱼儿，它安静陪着你', bite: '鱼漂动了，它也注意到了',
        pull: '你轻轻提竿，它望向鱼线', catch: itemId ? '你钓到小鱼啦，它好奇地看着' : '你收回空钩，它仍陪在旁边', stow: '你收好鱼竿，它陪你歇一会儿' };
    if (label?.firstChild?.nodeType === 3) label.firstChild.textContent = labels[pose.stage] || company;

}

/** Decorative only: the existing action controller still owns all commits. */
export function createWorkPosePlayer() {
    let frame = 0, active = null, resizeObserver = null;
    function stop() {
        cancelAnimationFrame(frame); frame = 0;
        resizeObserver?.disconnect(); resizeObserver = null;
        if (active) {
            for (const part of active.secondaryParts) for (const [key, value] of Object.entries(part.previous)) {
                if (value) part.node.style.setProperty(key, value); else part.node.style.removeProperty(key);
            }
            for (const key of ['--tf-work-x', '--tf-work-y', '--tf-work-angle', '--tf-work-scale-x', '--tf-work-scale-y']) active.geometry.avatar.style.removeProperty(key);
            active.geometry.avatar.style.removeProperty('transform-origin');
            for (const key of ['workPose', 'workKind', 'workPhase', 'workProgress', 'workGrip', 'workBehavior', 'workSupport']) delete active.control.dataset[key];
        }
        active = null;
    }
    function sync({ control, action, itemId = '', startedAt, duration = 1, phase = () => '', reduced = false }) {
        stop();
        if (!control?.querySelector('.tf-work-pose-art')) return;
        const pet = control.querySelector('.tf-pixel-pet');
        const kind = [...(pet?.classList || [])].find(name => name.startsWith('is-kind-'))?.slice(8) || 'mystery';
        const stage = [...(pet?.classList || [])].find(name => name.startsWith('is-growth-'))?.slice(10) || 'adult';
        const fit = getWorkFit(kind, stage);
        control.dataset.workPose = action; control.dataset.workKind = kind;
        const geometry = measure(control, fit);
        if (!geometry) {
            delete control.dataset.workPose; delete control.dataset.workKind;
            return;
        }
        const secondarySelector = '.tf-raster-part[data-part="tail"],.tf-raster-part[data-part$="fin"],.tf-pixel-tail,.tf-betta-fin,.tf-rabbit-ear,.tf-raster-part[data-part^="ear"],.tf-octopus-arm,.tf-raster-part[data-part^="arm"],.tf-penguin-wing,.tf-robo-wing,.tf-raster-part[data-part^="wing"]';
        const secondaryParts = [...control.querySelectorAll(secondarySelector)].filter(node => node.style?.setProperty).map((node, index) => {
            const previous = Object.fromEntries(['rotate', 'transform-origin', 'transform-box'].map(key => [key, node.style.getPropertyValue?.(key) || '']));
            if (!previous['transform-origin']) { node.style.setProperty('transform-box', 'fill-box'); node.style.setProperty('transform-origin', '50% 80%'); }
            return { node, index, previous, type: node.matches('[data-part^="ear"],.tf-rabbit-ear') ? 'ear' : ['octopus', 'penguin', 'robo-bird'].includes(fit.kind) ? 'limb' : 'tail' };
        });
        const context = { control, action, itemId, startedAt, duration, phase, reduced, fit, geometry, secondaryParts };
        active = context;
        const elapsed = () => reduced ? action === 'fishing' ? 1000 : duration * .5 : Math.max(0, Date.now() - startedAt);
        // A resized device changes both the sprite fit and scene contact points.
        // Re-measure without restarting the action's clock or moving its floor anchor.
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                if (active !== context || !control.isConnected) return;
                const g = context.geometry, room = g.stage.getBoundingClientRect(), box = g.art.getBoundingClientRect();
                if (Math.abs(room.width - g.roomWidth) < .1 && Math.abs(room.height - g.roomHeight) < .1
                    && Math.abs(box.width - g.size) < .1 && Math.abs(box.height - g.artHeight) < .1) return;
                const next = measure(control, fit);
                if (next) { context.geometry = next; paint(context, elapsed()); }
            });
            resizeObserver.observe(geometry.stage); resizeObserver.observe(geometry.art);
        }
        const tick = () => {
            if (active !== context || !control.isConnected || document.visibilityState === 'hidden') return;
            paint(context, elapsed());
            if (!reduced) frame = requestAnimationFrame(tick);
        };
        tick();
    }
    return { sync, stop };
}
