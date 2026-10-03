const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const phases = { greet: ['hello'], meal: ['prepare', 'eat', 'thanks'], bedtime: ['settle', 'sleep'] };

/** A transient, non-interactive layer. Its phases never alter the pet's action clock. */
export function renderCompanionRitual(companion, ritual) {
    if (!ritual || !Object.hasOwn(phases, ritual.kind)) return '';
    const kind = ritual.kind;
    const phase = phases[kind].includes(ritual.phase) ? ritual.phase : phases[kind][0];
    const name = String(companion?.name || '小旅伴');
    const days = Number.isFinite(Number(ritual.days)) ? Math.max(1, Math.floor(Number(ritual.days))) : 1;
    const defaults = {
        hello: `${name}抬起头，等到你啦。`,
        prepare: '把小碗摆好，开饭啦。',
        eat: '一口一口，慢慢吃。',
        thanks: `${name}吃饱了，满足地看着你。`,
        settle: '摸摸脑袋，盖好小被子。',
        sleep: '晚安，明天再一起玩。',
    };
    const detail = kind === 'greet' ? `我们一起生活的第 ${days} 天`
        : kind === 'meal' ? phase === 'thanks' ? ritual.favorite ? '是它最喜欢的味道 ♡' : '小碗空了，肚子暖暖的'
            : ritual.foodName ? `今天的小餐：${ritual.foodName}` : '今天的小餐，慢慢享用'
        : phase === 'sleep' ? '星星夜灯陪着它' : '小窝也慢慢安静下来';
    const finished = kind === 'greet' || phase === 'thanks' || phase === 'sleep';
    const message = finished && ritual.message ? ritual.message : defaults[phase];
    const decor = kind === 'greet'
        ? '<span class="tf-pet-ritual-welcome" aria-hidden="true"><i>♡</i><i>✧</i><i>·</i></span>'
        : kind === 'meal'
            ? '<span class="tf-pet-ritual-bowl" aria-hidden="true"><svg viewBox="0 0 48 34"><ellipse class="tf-ritual-bowl-shadow" cx="24" cy="30" rx="19" ry="3"/><path class="tf-ritual-bowl-body" d="M5 13h38l-4 13a5 5 0 0 1-5 4H14a5 5 0 0 1-5-4Z"/><ellipse class="tf-ritual-bowl-rim" cx="24" cy="13" rx="19" ry="5"/><g class="tf-ritual-bowl-food"><ellipse cx="24" cy="12" rx="14" ry="3"/><circle cx="17" cy="10" r="3"/><circle cx="24" cy="8" r="4"/><circle cx="31" cy="10" r="3"/></g><path class="tf-ritual-bowl-shine" d="M12 19h4m2 0h2"/></svg><i>♡</i></span>'
            : '<span class="tf-pet-ritual-night" aria-hidden="true"><span class="tf-ritual-night-lamp"><svg viewBox="0 0 32 40"><path class="tf-ritual-lamp-star" d="m16 3 3.4 7 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6L5 11.1l7.6-1.1Z"/><path class="tf-ritual-lamp-stand" d="M15 23h2v10h7v3H8v-3h7Z"/></svg></span><span class="tf-ritual-night-stars"><i>✦</i><i>·</i><i>✧</i></span><span class="tf-ritual-blanket"><i>✧</i><i>·</i><i>✦</i></span></span>';
    return `<div class="tf-pet-ritual${ritual.favorite && kind === 'meal' ? ' is-favorite' : ''}" data-ritual-kind="${kind}" data-ritual-phase="${phase}">${decor}<span class="tf-pet-ritual-caption" role="status" aria-atomic="true"><b>${esc(message)}</b><small>${esc(detail)}</small></span></div>`;
}
