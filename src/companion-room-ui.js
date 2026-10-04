import { ROOM_FURNITURE, ROOM_WALLS, ROOM_FLOORS, ROOM_COLORS, ROOM_MAX_ITEMS, normalizeCompanionRoom, getRoomItemBounds, renderRoomFurniture, renderCompanionRoom, createCompanionRoomPreset } from './companion-room.js';
import { renderCompanionIcon } from './companion-icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const button = (action, text, attributes = '') => `<button type="button" data-action="room-${action}" ${attributes}>${text}</button>`;

export function renderCompanionRoomEditor(saved, draft) {
    const room = normalizeCompanionRoom(draft?.data || saved), selected = room.items.find(item => item.id === draft?.selected);
    const selectedType = ROOM_FURNITURE.find(item => item.id === selected?.type);
    const category = draft?.category || 'all', color = selected?.color || draft?.color || 'natural';
    const pickedType = ROOM_FURNITURE.find(item => item.id === draft?.type);
    const guide = draft?.notice || (pickedType ? `点${pickedType.category === 'wall' ? '墙面' : '地板'}放下${pickedType.name}。` : selected ? '点新位置移动，方向按钮可以微调。' : '从下方挑家具，点画布放下。已有家具也能重新摆放。');
    const layer = item => ROOM_FURNITURE.find(type => type.id === item.type).category === 'wall' ? 0 : item.type === 'rug' ? 1 : 2;
    const placed = [...room.items].sort((a, b) => layer(a) - layer(b) || a.y - b.y);
    const items = placed.map(item => {
        const bounds = getRoomItemBounds(item), type = ROOM_FURNITURE.find(value => value.id === item.type);
        return button('select', '', `class="tf-room-item ${selected?.id === item.id ? 'is-selected' : ''}" data-room-item="${esc(item.id)}" aria-label="选择${esc(type.name)}" aria-pressed="${selected?.id === item.id}" style="left:${item.x / 3.2}%;top:${item.y / 2.4}%;width:${bounds.width / 3.2}%;height:${bounds.height / 2.4}%"`);
    }).join('');
    const disabled = selected ? '' : 'disabled';
    const swatches = (action, options, value) => `<div class="tf-room-swatches" role="group" aria-label="${action === 'wall' ? '墙面' : action === 'floor' ? '地板' : '家具配色'}">${options.map(option => button(action, `<i aria-hidden="true" style="background:${esc(option.color || option.wall || option.main || '#c6b399')}"></i><span>${esc(option.name)}</span>`, `data-room-value="${option.id}" class="${value === option.id ? 'is-selected' : ''}" aria-pressed="${value === option.id}"`)).join('')}</div>`;
    const types = ROOM_FURNITURE.filter(item => category === 'all' || item.category === category);
    const previewType = selectedType || pickedType;
    const selection = `<section class="tf-room-selection ${selected ? 'has-selection' : ''}">
        <header><i aria-hidden="true">${previewType ? renderRoomFurniture(previewType.id, color, selected?.rotation || 0) : renderCompanionIcon('home')}</i><div><b>${esc(previewType?.name || '给它布置一个家')}</b><span>${selected ? '已选中' : pickedType ? '待放置' : '挑一件家具'}</span></div></header>
        <div class="tf-room-tools"><div class="tf-room-tool-actions">${button('rotate', '转向', disabled)}${button('remove', '收回', disabled)}</div><div class="tf-room-nudge" role="group" aria-label="微调家具位置">${[['←', -8, 0, '向左移动'], ['↑', 0, -8, '向上移动'], ['↓', 0, 8, '向下移动'], ['→', 8, 0, '向右移动']].map(([symbol, dx, dy, label]) => button('step', symbol, `data-dx="${dx}" data-dy="${dy}" aria-label="${label}" ${disabled}`)).join('')}</div></div>
    </section>`;
    const html = `<section class="tf-room-editor" aria-busy="${Boolean(draft?.saving)}">
        <header class="tf-room-heading"><div><b>我的小窝</b><span>把喜欢的日常，放进小房间</span></div><span class="tf-room-save-state">${draft?.saving ? '保存中' : draft?.dirty ? '待保存' : '已保存'}</span></header>
        <div class="tf-room-preview"><div class="tf-room-canvas" tabindex="0" role="group" aria-label="装修画布，选择家具后点空处放置；选中家具可用方向键移动">${renderCompanionRoom(room)}<div class="tf-room-item-controls">${items}</div></div><p class="tf-room-guide" role="status" aria-live="polite">${esc(guide)}</p></div>
        ${selection}
        <section class="tf-room-tray"><header class="tf-room-tray-heading"><b>家具托盘</b><span>${room.items.length}/${ROOM_MAX_ITEMS} 件 · 左右滑动</span></header><div class="tf-room-tabs" role="group" aria-label="家具分类">${[['all', '全部'], ['furniture', '家具'], ['decor', '装饰'], ['wall', '墙饰']].map(([id, name]) => button('category', name, `data-room-value="${id}" class="${category === id ? 'is-selected' : ''}" aria-pressed="${category === id}"`)).join('')}</div><div class="tf-room-catalog" tabindex="0" role="group" aria-label="家具托盘，可左右滚动">${types.map(item => button('pick', `<i aria-hidden="true">${renderRoomFurniture(item.id, draft?.color || 'natural')}</i><span>${esc(item.name)}</span>`, `class="tf-room-catalog-item ${draft?.type === item.id ? 'is-selected' : ''}" data-room-type="${item.id}" aria-pressed="${draft?.type === item.id}"`)).join('')}</div></section>
        <div class="tf-room-options"><details class="tf-room-surfaces"><summary>墙面、地板与配色</summary><b>墙面</b>${swatches('wall', ROOM_WALLS, room.wall)}<b>地板</b>${swatches('floor', ROOM_FLOORS, room.floor)}<b>${selected ? '选中家具的配色' : '下一件家具的配色'}</b>${swatches('color', ROOM_COLORS, color)}</details><details class="tf-room-presets"><summary>布置灵感</summary><p>把范例放进草稿，每一件都能重新摆放；保存后才会入住。</p><div class="tf-room-preset-cards">${[['cozy', '暖暖卧室'], ['garden', '绿意小窝'], ['study', '安静书房']].map(([id, label]) => button('preset', `<i aria-hidden="true">${renderCompanionRoom(createCompanionRoomPreset(id))}</i><span>${label}</span>`, `data-room-preset="${id}"`)).join('')}</div></details><details class="tf-room-placed"><summary>已摆放 ${room.items.length} 件家具</summary><div class="tf-room-placed-list">${room.items.map((item, i) => button('select', `${i + 1} · ${esc(ROOM_FURNITURE.find(type => type.id === item.type).name)}`, `data-room-item="${esc(item.id)}" aria-pressed="${selected?.id === item.id}" class="${selected?.id === item.id ? 'is-selected' : ''}"`)).join('') || '<p>还没有家具，来布置第一件吧。</p>'}</div></details></div>
        <footer class="tf-room-footer">${button('save', `${renderCompanionIcon('check')}<span>保存入住</span>`, 'class="tf-primary-button" aria-label="保存装修并入住小窝"')}${button('cancel', '取消', 'aria-label="取消修改"')}${button('use-scene', '切回场景', 'aria-label="切回场景小窝，保留已保存的装修"')}</footer>
    </section>`;
    return draft?.saving ? html.replace(/<button\b(?![^>]*\bdisabled\b)/g, '<button disabled') : html;
}
