import { ROOM_FURNITURE, normalizeCompanionRoom, getRoomItemBounds, getRoomItemDepth, getRoomInteraction, renderRoomPlacedFurniture } from './companion-room.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const verbs = { rest: '在小床睡觉', sit: '坐上沙发', lie: '在软垫趴一会', feed: '在饭碗开饭', play: '玩玩具球', look: '看看窗外' };

/** Each floor object shares a depth plane with the pet; wall art stays in the backdrop. */
export function renderCompanionRoomLive(room) {
    const items = normalizeCompanionRoom(room).items;
    const furniture = items.filter(item => getRoomItemDepth(item) > 1).map(item => {
        const depth = 100 + Math.round(getRoomItemDepth(item) * 2);
        return `<span class="tf-room-live-furniture" data-room-furniture="${esc(item.id)}" style="z-index:${depth}" aria-hidden="true">${renderRoomPlacedFurniture(item)}</span>`;
    }).join('');
    const hits = items.map(item => {
        const interaction = getRoomInteraction(item);
        if (!interaction) return '';
        const bounds = getRoomItemBounds(item), name = ROOM_FURNITURE.find(type => type.id === item.type)?.name || '';
        const depth = 101 + Math.round(getRoomItemDepth(item) * 2);
        return `<button type="button" class="tf-room-live-hit" data-action="companion-room-interact" data-room-item-id="${esc(item.id)}" data-room-kind="${interaction.kind}" aria-label="${esc(verbs[interaction.kind] || name)}" title="${esc(verbs[interaction.kind] || name)}" style="--tf-room-hit-left:${bounds.x / 3.2}%;--tf-room-hit-top:${bounds.y / 2.4}%;--tf-room-hit-width:${bounds.width / 3.2}%;--tf-room-hit-height:${bounds.height / 2.4}%;z-index:${depth}"></button>`;
    }).join('');
    return `<span class="tf-room-foreground">${furniture}${hits}</span><span class="tf-room-live-caption" role="status" aria-live="polite" aria-atomic="true"></span>`;
}
