import { getCompanionLifeView, PET_GAMES, PET_SHOP, PET_STAGES, canCareForCompanion } from './companion-life.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const stages = Object.keys(PET_STAGES);
const button = (action, text, attrs = '') => `<button type="button" data-action="${action}" ${attrs}>${text}</button>`;

export function renderCompanionGame(companion) {
    const game = companion.life?.game;
    if (!game) return '';
    const definition = PET_GAMES.find(item => item.id === game.kind);
    return `<div class="tf-pet-game tf-pet-arcade" data-game-id="${esc(game.id)}" role="group" aria-label="${definition.name}"><header><b>${definition.name}</b><span data-game-score>${game.score} 分</span><span data-game-time>30 秒</span><button type="button" data-action="pet-game-pause" aria-label="暂停游戏">Ⅱ</button></header><div class="tf-arcade-field"><canvas tabindex="0" aria-label="${esc(definition.note)}"></canvas><span class="tf-arcade-countdown" aria-hidden="true"></span><div class="tf-arcade-pause" hidden><b>游戏已暂停</b><small>准备好了再继续</small><button type="button" data-action="pet-game-pause">继续游戏</button><button type="button" data-action="pet-game-stop">回到小窝</button></div>${game.kind === 'memory' ? '<div class="tf-arcade-pads">' + ['左', '中', '右'].map((label, i) => '<button type="button" data-arcade-answer="' + (i - 1) + '" aria-label="记忆按钮' + label + '">' + label + '</button>').join('') + '</div>' : ''}</div><footer><span data-game-hearts>♥♥♥</span><span data-game-combo>连击 0</span>${game.kind === 'memory' ? '<span data-game-round>第 1 组</span>' : '<button type="button" data-arcade-skill>' + (game.kind === 'catch' ? '磁铁' : '护盾') + ' · 空格</button>'}</footer><p class="tf-arcade-notice" data-game-notice>${game.kind === 'memory' ? '先记住顺序，再依次按键' : '拖动 / 按住左右移动 · 确认使用技能'}</p></div>`;
}

function renderGameResult(result) {
    return `<div class="tf-arcade-result" role="status"><small>${result.best ? '新的个人纪录' : '一起玩的时光'}</small><strong>${result.score}<small>分</small></strong><p>最高连击 ${result.combo} · +${result.coins} 陪伴币</p><div>${button('pet-game-retry', '再玩一次')}${button('pet-game-dismiss', '回到小窝')}</div></div>`;
}

export function renderCompanionLife(data) {
    const companion = data.world.companion, view = getCompanionLifeView(companion), life = view.life;
    const unavailable = canCareForCompanion(companion, 'play');
    const stageIndex = stages.indexOf(life.stage), next = stages[stageIndex + 1];
    const requiredMinutes = next === 'young' ? 720 : 2880, requiredDays = next === 'young' ? 2 : 4;
    const progress = next ? Math.min(100, Math.floor(Math.min(life.growthMinutes / requiredMinutes, life.careDays.length / requiredDays) * 100)) : 100;
    const souvenirs = data.world.inventory.filter(item => !item.consumed && item.quantity > 0 && /返程/.test(item.source));
    const display = souvenirs.find(item => item.id === life.displayItemId);
    const toy = PET_SHOP.find(item => item.id === view.favoriteToy);
    const selected = (value, expected) => value === expected ? 'selected' : '';
    const hours = value => Array.from({ length: 24 }, (_, hour) => `<option value="${hour}" ${selected(hour, value)}>${String(hour).padStart(2, '0')}:00</option>`).join('');
    return `<section class="tf-card tf-pet-life"><header><div><small>一起生活</small><h3>${view.stageLabel} · ${esc(view.personality)}</h3></div><b class="tf-pet-coins">◉ ${life.coins} 陪伴币</b></header>
      <div class="tf-pet-life-facts"><span>清洁 <b>${Math.round(life.cleanliness)}</b><meter min="0" max="100" value="${life.cleanliness}" aria-label="清洁"></meter></span><span>喜欢的食物 <b>${esc(view.favoriteFood?.name || '慢慢了解中')}</b></span><span>喜欢的玩具 <b>${esc(toy?.name || '还在尝试')}</b></span></div>
      <div class="tf-pet-growth"><progress max="100" value="${progress}" aria-label="成长进度"></progress><p>${next ? `距离${PET_STAGES[next]}：累计生活 ${Math.min(Math.floor(life.growthMinutes / 60), requiredMinutes / 60)} / ${requiredMinutes / 60} 小时，照顾 ${Math.min(life.careDays.length, requiredDays)} / ${requiredDays} 天` : '已经长大了，仍会慢慢形成新的喜好。'}</p></div>
      <div class="tf-pet-life-actions">${button('pet-tend', '洗澡与整理', `data-tend="clean" ${unavailable ? 'disabled' : ''}`)}${button('pet-tend', view.sleeping ? '轻轻叫醒' : '睡一小时', `data-tend="${view.sleeping ? 'wake' : 'rest'}" ${life.mode !== 'active' || companion.status === 'away' || life.game ? 'disabled' : ''}`)}${['active', 'paused', 'daycare'].map(mode => button('pet-mode', { active: '正常照顾', paused: '暂停养成', daycare: '托管' }[mode], `data-mode="${mode}" aria-pressed="${life.mode === mode}"`)).join('')}</div>
      <p class="tf-pet-life-note">暂停冻结需求与成长；托管维持需求并继续成长。离线最多结算 8 小时，已有旅行仍按时返家。</p>
      <details class="tf-pet-life-details"><summary>作息与照顾说明</summary><div class="tf-pet-sleep-settings"><label><input type="checkbox" data-pet-setting="autoSleep" ${life.autoSleep ? 'checked' : ''}> 按本机时间睡觉</label><label>入睡 <select data-pet-setting="sleepStart">${hours(life.sleepStart)}</select></label><label>醒来 <select data-pet-setting="sleepEnd">${hours(life.sleepEnd)}</select></label></div><p>需求缓慢变化，最低保留 10；低于 10 的旧状态需照顾恢复。喂食每 10 分钟、其他互动每 5 分钟累计一次养成收益。作息起止相同则不自动睡觉。</p></details>
      <div class="tf-pet-games"><h4>一起玩 · 每局 30 秒</h4><p>${unavailable ? esc(unavailable) : '拖动屏幕或按住左右移动，确认 / 空格使用技能。切到后台会暂停，每天最多获得 30 枚陪伴币。'}</p><div>${PET_GAMES.map(game => button('pet-game-start', `${game.symbol} ${game.name}${life.gameRecords?.[game.id]?.best ? ` · 最高 ${life.gameRecords[game.id].best} 分` : ''}${stageIndex < stages.indexOf(game.stage) ? ` · ${PET_STAGES[game.stage]}解锁` : ''}`, `data-game="${game.id}" ${unavailable || life.game || stageIndex < stages.indexOf(game.stage) ? 'disabled' : ''}`)).join('')}${life.game ? button('pet-game-stop', '结束这一局') : ''}</div></div>
      <details class="tf-pet-life-details"><summary>陪伴小铺 · 玩具与小窝</summary><div class="tf-pet-shop">${PET_SHOP.map(item => `<div><span>${item.symbol}</span><b>${item.name}</b><small>${item.cost} 陪伴币</small>${life.owned.includes(item.id) ? button(item.kind === 'toy' ? 'pet-toy' : 'pet-furniture', item.kind === 'toy' ? '一起玩' : life.furniture === item.id ? '正在摆放' : '摆进小窝', `data-item="${item.id}" ${item.kind === 'toy' && unavailable ? 'disabled' : ''}`) : button('pet-buy', '兑换', `data-item="${item.id}" ${life.coins < item.cost ? 'disabled' : ''}`)}</div>`).join('')}</div><p>点心进入背包；玩具可反复使用，家具可在小窝中切换。</p></details>
      <details class="tf-pet-life-details"><summary>纪念品陈列 · ${display ? esc(display.name) : '还没有摆放'}</summary><label>从旅行收获中挑一件 <select data-pet-setting="displayItemId"><option value="">暂不摆放</option>${souvenirs.map(item => `<option value="${esc(item.id)}" ${selected(item.id, life.displayItemId)}>${esc(item.name)}</option>`).join('')}</select></label><p>陈列不消耗物品；物品交付或用完后自动收起。</p></details>
      <details class="tf-pet-life-details"><summary>成长日记 · ${life.diary.length} 条</summary><ol class="tf-pet-diary">${[...life.diary].reverse().map(note => `<li><time>${esc(new Date(note.at).toLocaleDateString('zh-CN'))}</time><span>${esc(note.text)}</span></li>`).join('') || '<li>从第一次照顾开始，记下你们的小小里程碑。</li>'}</ol></details></section>`;
}

export function decorateCompanionLife(html, data, touch = {}) {
    const companion = data.world.companion, view = getCompanionLifeView(companion), life = view.life;
    const display = data.world.inventory.find(item => item.id === life.displayItemId && !item.consumed && item.quantity > 0 && /返程/.test(item.source));
    const prop = { hungry: '◡', dirty: '✧', sleep: 'z Z', tired: 'z', lonely: '♡', cuddle: '♡', toy: '◉', paused: 'Ⅱ', daycare: '⌂' }[view.activity] || '';
    const interactive = !canCareForCompanion(companion, 'pet') && !life.game;
    const cleaning = interactive && touch.cleaning;
    const feedback = touch.feedback?.until > Date.now() ? touch.feedback : null;
    const glyph = type => `<svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges">${{
        bowl: '<path fill="currentColor" d="M2 10h20v5h-2v4H4v-4H2z"/><path fill="var(--pet-screen)" d="M4 11h16v2H4z"/><path fill="currentColor" d="M7 5h4v4H7zm7-2h3v5h-3z"/>',
        soap: '<path fill="currentColor" d="M4 9h16v11H4zM6 7h12v2H6zM3 2h4v4H3zm13 0h3v4h-3zm5 5h2v3h-2z"/><path fill="var(--pet-screen)" d="M8 12h8v2H8z"/>',
        ball: '<path fill="currentColor" d="M7 2h10v3h4v14h-4v3H7v-3H3V5h4z"/><path fill="var(--pet-screen)" d="M7 5h4v5h8v3h-8v6H8v-6H5v-3h3z"/>',
    }[type]}</svg>`;
    const tools = interactive && !touch.gameResultOpen ? `<div class="tf-pet-room-tools">${button('companion-care', `${glyph('bowl')}<span>喂食</span>`, 'class="tf-pet-room-tool is-bowl" data-care="feed" aria-label="食盆：选择食物，可以拖给旅伴"')}${button('pet-soap', `${glyph('soap')}<span>${cleaning ? '收起' : '洗澡'}</span>`, `class="tf-pet-room-tool is-soap" aria-pressed="${Boolean(cleaning)}" aria-label="${cleaning ? '收起肥皂' : '拿起肥皂，擦洗旅伴'}"`)}${button('pet-room-play', `${glyph('ball')}<span>玩耍</span>`, 'class="tf-pet-room-tool is-ball" aria-label="玩具：一起玩接星星"')}</div>` : '';
    const guide = cleaning ? `擦洗 ${Math.round((touch.progress || 0) * 100)}% · 划动或轻点旅伴` : touch.foodMenu ? '把食物拖给旅伴，也可轻点喂食' : view.sleeping ? '点旅伴轻轻叫醒' : life.mode !== 'active' ? '点旅伴继续照顾' : interactive ? '摸摸我，或点食盆、肥皂和玩具' : '';
    const props = `<div class="tf-pet-life-scene"><span class="tf-pet-thought" aria-hidden="true">${prop}</span>${life.furniture ? `<span class="tf-pet-room-furniture" aria-hidden="true">${life.furniture === 'lamp' ? '✦' : '▰'}</span>` : ''}${display ? `<span class="tf-pet-keepsake" title="${esc(display.name)}">◇<small>${esc(display.name)}</small></span>` : ''}${tools}<span class="tf-pet-touch-guide">${guide}</span>${feedback ? `<span class="tf-pet-touch-feedback" role="status">${esc(feedback.message)}</span>` : ''}<span class="tf-pet-bath-bubbles" aria-hidden="true"><i>○</i><i>○</i><i>○</i><i>✧</i></span><span class="tf-pet-touch-heart" aria-hidden="true">♥</span></div>`;
    html = html.replace('tf-companion-page ', `tf-companion-page ${life.game ? 'is-playing-game ' : ''}${cleaning ? 'is-washing ' : ''}${feedback?.kind === 'clean' ? 'is-bath-done ' : ''}is-growing-${view.stage} is-living-${view.activity} `)
        .replace(`<small>${esc(companion.species)}</small>`, `<small>${esc(companion.species)} · ${view.stageLabel} · ${view.personality}</small>`)
        .replace('<div class="tf-pet-stage">', `<div class="tf-pet-stage">${props}`)
        .replace('<section class="tf-card tf-packing">', `${renderCompanionLife(data)}<section class="tf-card tf-packing">`);
    if (companion.status !== 'away') {
        const label = life.mode === 'paused' ? '养成已暂停' : life.mode === 'daycare' ? '托管中' : view.sleeping ? '正在小窝休息' : '在小窝等你';
        html = html.replace(/<b>(在小窝等你|正在小窝休息)<\/b>/, `<b>${label}</b>`);
        if (life.mode !== 'active') html = html.replace(`data-action="companion-care" data-care="pet" title="摸摸${esc(companion.name)}"`, 'data-action="pet-mode" data-mode="active" title="继续照顾" aria-label="继续照顾旅伴"');
        else if (view.sleeping) html = html.replace(`data-action="companion-care" data-care="pet" title="摸摸${esc(companion.name)}"`, 'data-action="pet-tend" data-tend="wake" title="轻轻叫醒" aria-label="轻轻叫醒旅伴"');
    }
    if (!life.game && touch.gameResultOpen && life.lastGameResult) html = html.replace('<div class="tf-pet-stage">', `<div class="tf-pet-stage"><div class="tf-pet-game-host">${renderGameResult(life.lastGameResult)}</div>`)
        .replace('<span>上一项<small>PREV</small></span>', '<span>回窝<small>HOME</small></span>').replace('<span>下一项<small>NEXT</small></span>', '<span>回窝<small>HOME</small></span>')
        .replace('<span>确认<small>OK</small></span>', '<span>再玩<small>AGAIN</small></span>')
        .replace('aria-label="上一个功能"', 'aria-label="回到小窝"').replace('aria-label="下一个功能"', 'aria-label="回到小窝"').replace('aria-label="确认当前功能"', 'aria-label="再玩一次"');
    if (life.game) html = html.replace('<div class="tf-pet-stage">', `<div class="tf-pet-stage"><div class="tf-pet-game-host">${renderCompanionGame(companion)}</div>`)
        .replace('<span>上一项<small>PREV</small></span>', '<span>左<small>LEFT</small></span>').replace('<span>下一项<small>NEXT</small></span>', '<span>右<small>RIGHT</small></span>')
        .replace('<span>确认<small>OK</small></span>', `<span>${life.game.kind === 'memory' ? '中' : life.game.kind === 'catch' ? '磁铁' : '护盾'}<small>OK</small></span>`)
        .replace('aria-label="上一个功能"', 'aria-label="游戏向左"').replace('aria-label="下一个功能"', 'aria-label="游戏向右"').replace('aria-label="确认当前功能"', 'aria-label="游戏确认中间"');
    return html;
}
