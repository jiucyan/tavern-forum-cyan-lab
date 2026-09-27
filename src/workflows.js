import { normalizeThreadReplies, parseJsonResponse } from './prompt.js';

export const GENERATION_MODES = Object.freeze({ all: '常规刷新', posts: '只发新帖', threads: '继续旧帖讨论', world: '推进世界事件' });

export function selectWorldUpdates(updates, settings, allowedModules = null) {
    const selected = {};
    const fields = { tasks: 'tasks', fortune: 'fortune', travel: 'travel', companion: 'travel', inventory: 'inventory', health: 'health', reports: 'moderation', moderationActions: 'moderation', permissionAssignments: 'moderation' };
    for (const [key, value] of Object.entries(updates || {})) {
        const module = fields[key];
        if (module && settings.modules?.[module]?.enabled && (!allowedModules || allowedModules.includes(module))) selected[key] = value;
        if (key === 'socialActions' && (!allowedModules || allowedModules.includes('social'))) selected[key] = value;
    }
    return selected;
}

export function parseThreadUpdates(raw, data, maximum = 3) {
    const parsed = parseJsonResponse(raw);
    const updates = [];
    for (const entry of (Array.isArray(parsed.threadUpdates) ? parsed.threadUpdates : []).slice(0, 6)) {
        const post = data.posts.find(item => item.id === entry.postId && !item.moderation?.hidden);
        if (!post) continue;
        const replies = normalizeThreadReplies(JSON.stringify({ replies: entry.comments || entry.replies || [] }))
            .filter(reply => !data.npcs.some(npc => npc.blocked && (npc.handle === reply.handle || npc.name === reply.author)))
            .slice(0, maximum);
        if (replies.length) updates.push({ post, replies });
    }
    return updates;
}

export { recordRelationshipEvent, compactRoleMemory } from './memory.js';
