import { getCompanionLifeView, PET_GAMES, PET_SHOP, PET_STAGES, canCareForCompanion } from './companion-life.js';
import { renderCompanionRitual } from './companion-ritual-ui.js';
import { renderCompanionIcon } from './companion-icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const stages = Object.keys(PET_STAGES);
const button = (action, text, attrs = '') => `<button type="button" data-action="${action}" ${attrs}>${text}</button>`;

export function renderCompanionGame(companion) {
    const game = companion.life?.game;
    if (!game) return '';
    const definition = PET_GAMES.find(item => item.id === game.kind);
    return `<div class="tf-pet-game tf-pet-arcade" data-game-id="${esc(game.id)}" role="group" aria-label="${definition.name}"><header><b>${definition.name}</b><span data-game-score>${game.score} 分</span><span data-game-time>30 秒</span><button type="button" data-action="pet-game-pause" aria-label="暂停游戏" aria-pressed="false">${renderCompanionIcon('pause')}${renderCompanionIcon('resume')}</button></header><div class="tf-arcade-field"><canvas tabindex="0" aria-label="${esc(definition.note)}"></canvas><span class="tf-arcade-countdown" aria-hidden="true"></span><div class="tf-arcade-pause" hidden><b>游戏已暂停</b><small>准备好了再继续</small><button type="button" data-action="pet-game-pause">继续游戏</button><button type="button" data-action="pet-game-stop">回到小窝</button></div>${game.kind === 'memory' ? '<div class="tf-arcade-pads">' + ['左', '中', '右'].map((label, i) => '<button type="button" data-arcade-answer="' + (i - 1) + '" aria-label="记忆按钮' + label + '">' + label + '</button>').join('') + '</div>' : ''}</div><footer><span data-game-hearts>♥♥♥</span><span data-game-combo>连击 0</span>${game.kind === 'memory' ? '<span data-game-round>第 1 组</span>' : '<button type="button" data-arcade-skill>' + (game.kind === 'catch' ? '磁铁' : '护盾') + ' · 空格</button>'}</footer><p class="tf-arcade-notice" data-game-notice>${game.kind === 'memory' ? '先记住顺序，再依次按键' : '拖动 / 按住左右移动 · 确认使用技能'}</p></div>`;
}

function renderGameResult(result) {
    return `<div class="tf-arcade-result" role="status"><small>${result.best ? '新的个人纪录' : '一起玩的时光'}</small><strong>${result.score}<small>分</small></strong><p>最高连击 ${result.combo} · +${result.coins} 陪伴币</p><div>${button('pet-game-retry', '再玩一次')}${button('pet-game-dismiss', '回到小窝')}</div></div>`;
}

function renderGrowthAlbum(companion, renderPortrait) {
    if (!renderPortrait) return '';
    const life = companion.life, currentIndex = stages.indexOf(life.stage), album = life.growthAlbum || [];
    const portrait = (stage, fallback = companion) => renderPortrait(album.find(photo => photo.stage === stage) || fallback, stage);
    const notice = life.growthNotice;
    const celebration = notice ? `<div class="tf-pet-growth-news" role="status"><span class="tf-growth-kicker">一起长大的瞬间</span><div class="tf-growth-reveal"><span class="tf-growth-before">${portrait(notice.from)}<small>${PET_STAGES[notice.from]}</small></span><span aria-hidden="true">✧</span><span class="tf-growth-after">${portrait(notice.to)}<small>${PET_STAGES[notice.to]}</small></span></div><b>${esc(companion.name)}长大啦，进入${PET_STAGES[notice.to]}了！</b><p>${notice.to === 'young' ? '学会了记方向，也更喜欢探索小窝了。' : '可以一起玩躲雨滴了，继续留下新的回忆。'}</p>${button('pet-growth-ack', '收好纪念照')}</div>` : '';
    return celebration + `<details open class="tf-pet-life-details tf-pet-growth-album"><summary>成长相册 · ${album.length} 张留影</summary><p>留住每个阶段初见时的样子。未留影的旧阶段按当前配色示意。</p><div class="tf-growth-photos">${stages.map((stage, index) => {
        const photo = album.find(item => item.stage === stage), reached = index <= currentIndex;
        return `<figure class="${reached ? 'is-reached' : 'is-future'} ${stage === life.stage ? 'is-current' : ''}"><div class="tf-growth-photo" role="img" aria-label="${PET_STAGES[stage]}${photo ? '留影' : reached ? '形象示意' : '尚未解锁'}">${reached ? portrait(stage) : '<span class="tf-growth-unknown">?</span>'}</div><figcaption><b>${PET_STAGES[stage]}${stage === life.stage ? ' · 现在' : ''}</b><small>${photo ? esc(new Date(photo.at).toLocaleDateString('zh-CN')) : reached ? '阶段示意' : '等待长大'}</small>${photo ? '<small>' + esc(photo.species) + '</small>' : ''}</figcaption></figure>`;
    }).join('')}</div></details>`;
}


export function renderCompanionNavigation(data, panel = 'home') {
    const pet = data.world.companion;
    const links = [['home', '小窝', '陪在身边'], ['album', '相册', '一起长大'], ['travel', '旅行', pet.status === 'away' ? '旅途中' : '出发看看'], ['dress', '装扮', '布置小窝']];
    return '<nav class="tf-pet-navigation" aria-label="旅伴页面">' + links.map(([id, label, note]) => button('companion-panel', '<i aria-hidden="true">' + renderCompanionIcon(id) + '</i><span><b>' + label + '</b><small>' + note + '</small></span>' + (id === 'album' && pet.life.growthNotice ? '<em aria-label="新的成长留影"></em>' : ''), 'data-panel="' + id + '" aria-current="' + (panel === id ? 'page' : 'false') + '"')).join('') + '</nav>';
}

export function renderCompanionSummary(data) {
    const pet = data.world.companion, view = getCompanionLifeView(pet), life = view.life;
    const needs = {
        hungry: ['肚子有点饿', 'companion-care', '去喂食', 'data-care="feed"'],
        dirty: ['想洗个澡', 'pet-soap', '拿起肥皂', ''],
        tired: ['想休息一会儿', 'pet-tend', '睡一小时', 'data-tend="rest"'],
        lonely: ['想让你陪一会儿', 'companion-care', '摸摸它', 'data-care="pet"'],
        sleep: ['正在安心睡觉', 'pet-tend', '轻轻叫醒', 'data-tend="wake"'],
        paused: ['照顾已暂停', 'pet-mode', '继续照顾', 'data-mode="active"'],
        daycare: ['正在托管小屋', 'pet-mode', '接回小窝', 'data-mode="active"'],
        away: ['正在外面旅行', 'companion-panel', '看看行程', 'data-panel="travel"'],
    };
    const need = needs[view.activity] || ['状态不错，想和你待在一起', 'companion-care', '摸摸它', 'data-care="pet"'];
    const stat = (name, label, value, threshold) => '<div class="' + (value < threshold ? 'is-low' : '') + '"><span>' + renderCompanionIcon(name) + '<span>' + label + '</span><b>' + Math.round(value) + '</b></span><progress max="100" value="' + value + '" aria-label="' + label + '"></progress></div>';
    return '<div class="tf-companion-status tf-pet-dashboard"><span class="tf-pet-kicker">POCKET FRIEND · 每天多一点陪伴</span><div class="tf-companion-title"><div><h2>' + esc(pet.name) + '</h2><small>' + esc(pet.species) + ' · ' + view.stageLabel + ' · ' + esc(view.personality) + '</small></div><b>♥ ' + Math.round(pet.bond || 0) + '</b></div><div class="tf-pet-need" role="status"><span><small>此刻的心情</small><b>' + need[0] + '</b></span>' + button(need[1], need[2] + ' ›', need[3] + (life.game ? ' disabled' : '')) + '</div><div class="tf-pet-message"><p>' + esc(view.message || pet.message || '它正安静地看着你。') + '</p></div><div class="tf-pet-vitals">' + stat('feed', '饱腹', pet.satiety ?? 75, 30) + stat('energy', '体力', pet.energy ?? 80, 25) + stat('happiness', '快乐', pet.happiness ?? 70, 40) + stat('clean', '清洁', life.cleanliness, 35) + '</div><div class="tf-pet-pocket-meta"><span>' + renderCompanionIcon('coin') + ' ' + life.coins + ' 陪伴币</span>' + button('focus-companion-field', renderCompanionIcon('travel') + '<span>行囊 ›</span>', 'data-field="carrying" class="tf-pet-pack-shortcut"') + '</div>' + renderCompanionLife(data, { area: 'home' }) + '</div>';
}

export function renderCompanionLife(data, { renderPortrait, area = 'album' } = {}) {
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
    if (area === 'home') return `<section class="tf-pet-life tf-pet-home-care"><div class="tf-pet-games"><h4>一起玩 · 每局 30 秒</h4><p>${unavailable ? esc(unavailable) : '拖动屏幕或按住左右移动，确认 / 空格使用技能。切到后台会暂停，每天最多获得 30 枚陪伴币。'}</p><div>${PET_GAMES.map(game => button('pet-game-start', `${renderCompanionIcon(game.id)}<span>${game.name}${life.gameRecords?.[game.id]?.best ? ` · 最高 ${life.gameRecords[game.id].best} 分` : ''}${stageIndex < stages.indexOf(game.stage) ? ` · ${PET_STAGES[game.stage]}解锁` : ''}</span>`, `data-game="${game.id}" ${unavailable || life.game || stageIndex < stages.indexOf(game.stage) ? 'disabled' : ''}`)).join('')}${life.game ? button('pet-game-stop', '结束这一局') : ''}</div></div><details class="tf-pet-life-details tf-pet-care-settings"><summary>照顾与作息 <span>休息 · 暂停 · 托管</span></summary><div class="tf-pet-life-actions">${button('pet-tend', renderCompanionIcon('clean') + '<span>洗澡与整理</span>', `data-tend="clean" ${unavailable ? 'disabled' : ''}`)}${button('pet-tend', renderCompanionIcon(view.sleeping ? 'wake' : 'rest') + '<span>' + (view.sleeping ? '轻轻叫醒' : '睡一小时') + '</span>', `data-tend="${view.sleeping ? 'wake' : 'rest'}" ${life.mode !== 'active' || companion.status === 'away' || life.game ? 'disabled' : ''}`)}${['active', 'paused', 'daycare'].map(mode => button('pet-mode', renderCompanionIcon({ active: 'pet', paused: 'pause', daycare: 'daycare' }[mode]) + '<span>' + { active: '正常照顾', paused: '暂停养成', daycare: '托管' }[mode] + '</span>', `data-mode="${mode}" aria-pressed="${life.mode === mode}"`)).join('')}</div>
      <p class="tf-pet-life-note">暂停冻结需求与成长；托管维持需求并继续成长。离线最多结算 8 小时，已有旅行仍按时返家。</p>
      <details class="tf-pet-life-details"><summary>作息与照顾说明</summary><div class="tf-pet-sleep-settings"><label><input type="checkbox" data-pet-setting="autoSleep" ${life.autoSleep ? 'checked' : ''}> 按本机时间睡觉</label><label>入睡 <select data-pet-setting="sleepStart">${hours(life.sleepStart)}</select></label><label>醒来 <select data-pet-setting="sleepEnd">${hours(life.sleepEnd)}</select></label></div><p>需求缓慢变化，最低保留 10；低于 10 的旧状态需照顾恢复。喂食每 10 分钟、其他互动每 5 分钟累计一次养成收益。作息起止相同则不自动睡觉。</p></details></details></section>`;
    if (area === 'dress') return `<section class="tf-card tf-pet-life tf-pet-decorate"><header><div><small>ROOM COLLECTION</small><h3>布置小窝</h3></div><b class="tf-pet-coins">${renderCompanionIcon('coin')} ${life.coins} 陪伴币</b></header><details class="tf-pet-life-details"><summary>陪伴小铺 · 玩具与小窝</summary><div class="tf-pet-shop">${PET_SHOP.map(item => `<div><span aria-hidden="true">${renderCompanionIcon(item.id)}</span><b>${item.name}</b><small>${item.cost} 陪伴币</small>${life.owned.includes(item.id) ? button(item.kind === 'toy' ? 'pet-toy' : 'pet-furniture', item.kind === 'toy' ? '一起玩' : life.furniture === item.id ? '正在摆放' : '摆进小窝', `data-item="${item.id}" ${item.kind === 'toy' && unavailable ? 'disabled' : ''}`) : button('pet-buy', '兑换', `data-item="${item.id}" ${life.coins < item.cost ? 'disabled' : ''}`)}</div>`).join('')}</div><p>点心进入背包；玩具可反复使用，家具可在小窝中切换。</p></details>
      <details class="tf-pet-life-details"><summary>纪念品陈列 · ${display ? esc(display.name) : '还没有摆放'}</summary><label>从旅行收获中挑一件 <select data-pet-setting="displayItemId"><option value="">暂不摆放</option>${souvenirs.map(item => `<option value="${esc(item.id)}" ${selected(item.id, life.displayItemId)}>${esc(item.name)}</option>`).join('')}</select></label><p>陈列不消耗物品；物品交付或用完后自动收起。</p></details></section>`;
    return `<section class="tf-card tf-pet-life tf-pet-memory-book"><header><div><small>OUR LITTLE DAYS</small><h3>${esc(companion.name)}的成长相册</h3></div><b class="tf-pet-coins">${view.stageLabel}</b></header><div class="tf-pet-life-facts"><span>清洁 <b>${Math.round(life.cleanliness)}</b><meter min="0" max="100" value="${life.cleanliness}" aria-label="清洁"></meter></span><span>喜欢的食物 <b>${esc(view.favoriteFood?.name || '慢慢了解中')}</b></span><span>喜欢的玩具 <b>${esc(toy?.name || '还在尝试')}</b></span></div>
      <div class="tf-pet-growth"><progress max="100" value="${progress}" aria-label="成长进度"></progress><p>${next ? `距离${PET_STAGES[next]}：累计生活 ${Math.min(Math.floor(life.growthMinutes / 60), requiredMinutes / 60)} / ${requiredMinutes / 60} 小时，照顾 ${Math.min(life.careDays.length, requiredDays)} / ${requiredDays} 天` : '已经长大了，仍会慢慢形成新的喜好。'}</p></div>
      ${renderGrowthAlbum(companion, renderPortrait)}<details class="tf-pet-life-details"><summary>成长日记 · ${life.diary.length} 条</summary><ol class="tf-pet-diary">${[...life.diary].reverse().map(note => `<li><time>${esc(new Date(note.at).toLocaleDateString('zh-CN'))}</time><span>${esc(note.text)}</span></li>`).join('') || '<li>从第一次照顾开始，记下你们的小小里程碑。</li>'}</ol></details></section>`;
}

export function decorateCompanionLife(html, data, touch = {}) {
    const companion = data.world.companion, view = getCompanionLifeView(companion), life = view.life;
    const ritual = touch.ritual?.until > Date.now() ? touch.ritual : null;
    const display = data.world.inventory.find(item => item.id === life.displayItemId && !item.consumed && item.quantity > 0 && /返程/.test(item.source));
    const prop = { hungry: '◡', dirty: '✧', sleep: 'z Z', tired: 'z', lonely: '♡', cuddle: '♡', toy: '◉', paused: 'Ⅱ', daycare: '⌂' }[view.activity] || '';
    const interactive = !canCareForCompanion(companion, 'pet') && !life.game;
    const cleaning = interactive && touch.cleaning;
    const feedback = touch.feedback?.until > Date.now() ? touch.feedback : null;
    const tools = interactive && !touch.gameResultOpen ? `<div class="tf-pet-room-tools">${button('companion-care', `${renderCompanionIcon('feed')}<span>喂食</span>`, 'class="tf-pet-room-tool is-bowl" data-care="feed" aria-label="食盆：选择食物，可以拖给旅伴"')}${button('pet-soap', `${renderCompanionIcon('clean')}<span>${cleaning ? '收起' : '洗澡'}</span>`, `class="tf-pet-room-tool is-soap" aria-pressed="${Boolean(cleaning)}" aria-label="${cleaning ? '收起肥皂' : '拿起肥皂，擦洗旅伴'}"`)}${button('pet-room-play', `${renderCompanionIcon('ball')}<span>玩耍</span>`, 'class="tf-pet-room-tool is-ball" aria-label="玩具：一起玩接星星"')}</div>` : '';
    const growthInvitation = life.growthNotice && !life.game && !cleaning && !touch.foodMenu && !feedback && !ritual ? button('pet-growth-show', '长大啦 · 看看变化 ✧', 'class="tf-pet-growth-invitation"') : '';
    const guide = growthInvitation ? '' : cleaning ? `擦洗 ${Math.round((touch.progress || 0) * 100)}% · 划动或轻点旅伴` : touch.foodMenu ? '把食物拖给旅伴，也可轻点喂食' : view.sleeping ? '点旅伴轻轻叫醒' : life.mode !== 'active' ? '点旅伴继续照顾' : interactive ? '摸摸我，陪我待一会儿' : '';
    const props = `<div class="tf-pet-life-scene">${ritual ? renderCompanionRitual(companion, ritual) : ''}<span class="tf-pet-thought" aria-hidden="true">${prop}</span>${life.furniture ? `<span class="tf-pet-room-furniture" aria-hidden="true">${life.furniture === 'lamp' ? '✦' : '▰'}</span>` : ''}${display ? `<span class="tf-pet-keepsake" title="${esc(display.name)}">◇<small>${esc(display.name)}</small></span>` : ''}${tools}${growthInvitation}<span class="tf-pet-touch-guide">${guide}</span>${feedback ? `<span class="tf-pet-touch-feedback" ${ritual ? '' : 'role="status"'}>${esc(feedback.message)}</span>` : ''}<span class="tf-pet-bath-bubbles" aria-hidden="true"><i>○</i><i>○</i><i>○</i><i>✧</i></span><span class="tf-pet-touch-heart" aria-hidden="true">♥</span></div>`;
    html = html.replace('tf-companion-page ', `tf-companion-page ${ritual ? 'is-ritual-' + ritual.kind + ' is-ritual-phase-' + ritual.phase + ' ' : ''}${life.game ? 'is-playing-game ' : ''}${cleaning ? 'is-washing ' : ''}${feedback?.kind === 'clean' ? 'is-bath-done ' : ''}is-growing-${view.stage} is-living-${view.activity} `)
        .replace(`<small>${esc(companion.species)}</small>`, `<small>${esc(companion.species)} · ${view.stageLabel} · ${view.personality}</small>`)
        .replace('<div class="tf-pet-stage">', `<div class="tf-pet-stage">${props}`)
        .replace('<!-- companion-album -->', renderCompanionLife(data, { ...touch, area: 'album' }))
        .replace('<!-- companion-decorate -->', renderCompanionLife(data, { ...touch, area: 'dress' }));
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
