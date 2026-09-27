import { createId, parseJsonResponse } from './prompt.js';

const list = value => Array.isArray(value) ? value : [];
const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const key = value => text(value).normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase();

export function normalizeStoryEvents(value) {
    const ids = new Set();
    return list(value).filter(item => item && typeof item === 'object').map(item => ({
        id: text(item.id, 100) || createId('event'), title: text(item.title, 80) || '未命名事件',
        status: item.status === 'resolved' ? 'resolved' : 'active',
        nextStep: text(item.nextStep, 200), createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.updatedAt) || Date.now(),
        entries: list(item.entries).filter(entry => entry && typeof entry === 'object').slice(-160).map(entry => ({
            id: text(entry.id, 160) || createId('event-entry'), kind: ['post', 'comment', 'task', 'message', 'status'].includes(entry.kind) ? entry.kind : 'status',
            refId: text(entry.refId, 100), parentId: text(entry.parentId, 100), summary: text(entry.summary, 400),
            private: Boolean(entry.private) || ['message', 'task'].includes(entry.kind), createdAt: Number(entry.createdAt) || Date.now(),
        })),
    })).filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
}

function appendEntry(event, entry) {
    if (event.entries.some(item => item.id === entry.id)) return;
    event.entries.push(entry);
    event.entries = event.entries.slice(-160);
    event.updatedAt = Math.max(event.updatedAt, entry.createdAt);
}

export function trackPostEvent(data, postId, title = '') {
    const post = list(data.posts).find(item => item.id === postId && !item.moderation?.hidden);
    if (!post) throw new Error('帖子已不存在或不可见');
    data.events ||= [];
    let event = data.events.find(item => item.id === post.eventId);
    if (!event) {
        event = { id: createId('event'), title: text(title || post.content, 80), status: 'active', nextStep: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() };
        data.events.push(event); post.eventId = event.id;
    }
    syncStoryEventLinks(data);
    return event;
}

export function syncStoryEventLinks(data) {
    const events = new Map(list(data.events).map(event => [event.id, event]));
    for (const post of list(data.posts)) {
        const event = events.get(post.eventId);
        if (!event || post.moderation?.hidden) continue;
        appendEntry(event, { id: `post:${post.id}`, kind: 'post', refId: post.id, parentId: '', summary: text(post.content, 400), private: false, createdAt: post.createdAt || Date.now() });
        for (const comment of list(post.comments).filter(item => !item.moderation?.hidden)) appendEntry(event, { id: `comment:${comment.id}`, kind: 'comment', refId: comment.id, parentId: post.id, summary: text(comment.content, 400), private: false, createdAt: comment.createdAt || Date.now() });
    }
    for (const task of list(data.world?.tasks)) {
        const event = events.get(task.eventId);
        if (!event) continue;
        appendEntry(event, { id: `task:${task.id}:${task.status}`, kind: 'task', refId: task.id, parentId: '', summary: `${task.title} · ${{ offered: '待接受', accepted: '进行中', completed: '已完成', failed: '未完成', abandoned: '已放弃' }[task.status] || task.status}`, private: true, createdAt: task.updatedAt || Date.now() });
    }
    for (const conversation of list(data.conversations)) for (const message of list(conversation.messages)) {
        const event = events.get(message.eventId);
        if (event) appendEntry(event, { id: `message:${message.id}`, kind: 'message', refId: message.id, parentId: conversation.id, summary: text(message.content, 400), private: true, createdAt: message.createdAt || Date.now() });
    }
}

// Read public progress from live posts, so deleted/hidden text and private entries never leak through an old snapshot.
export function publicEventProgress(data, event) {
    return list(data.posts).filter(post => post.eventId === event.id && !post.moderation?.hidden).flatMap(post => [
        { id: post.id, parentId: post.id, content: text(post.content, 220), createdAt: post.createdAt || 0 },
        ...list(post.comments).filter(comment => !comment.moderation?.hidden).map(comment => ({ id: comment.id, parentId: post.id, content: text(comment.content, 220), createdAt: comment.createdAt || 0 })),
    ]).sort((a, b) => a.createdAt - b.createdAt);
}

export function getEventProtectedPostIds(data) {
    const active = new Set(list(data.events).filter(event => event.status === 'active').map(event => event.id));
    const ids = new Set();
    for (const id of active) for (const post of list(data.posts).filter(post => post.eventId === id && !post.moderation?.hidden).slice(-3)) ids.add(post.id);
    return ids;
}

export function buildStoryEventInstruction(data, { allowNew = true, eventId = '', privateReply = false } = {}) {
    const events = list(data.events).filter(event => eventId ? event.id === eventId : event.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
    const context = events.map(event => {
        const progress = publicEventProgress(data, event).slice(-3);
        return progress.length ? `事件 ${event.id}「${event.title}」[${event.status}]\n${progress.map(item => `[帖子 ${item.parentId}] ${item.content}`).join('\n')}` : '';
    }).filter(Boolean).join('\n\n').slice(0, 4600);
    if (!context && !allowNew) return '';
    if (privateReply) return `【本次私信关联的公开事件】\n${context}\n仅作为当前对话的公开背景。仍按私信格式回复，不生成帖子、任务或事件更新结构，不引用其他私信里的秘密。`;
    return `【持续事件 · 共用本轮请求】\n${context || '暂无已追踪事件。'}\n有自然进展时优先延续上述事件，不要重复开篇或机械复述。可以让相关帖子出现新线索、讨论、结果和角色反馈；没有进展就保持原状。相关新帖、允许生成的委托和主动私信可填写 eventId 为准确事件ID。不要因此生成未获准的模块或额外私信。${allowNew ? '新求助或持续事件可在 eventUpdates 中填写 {"id":"new:本轮唯一短名","title":"事件标题"}，同一事件的本轮帖子、委托、私信用这个临时ID关联；至少有一篇公开帖子作为起点。相同主题请复用已有事件。' : '本轮不创建事件。'}\n已有事件有公开的新结果时，可返回根字段 eventUpdates:[{"id":"已有事件ID","status":"resolved"}]。未完成的委托仍保留，事件收尾不等于完成任务、扣物品或发奖励。私信内容和私下交付记录不得写入公开帖子或公开事件摘要。`;
}

export function applyStoryEventUpdates(data, raw, { newPosts = [], allowNew = true } = {}) {
    let parsed;
    try { parsed = typeof raw === 'string' ? parseJsonResponse(raw) : raw; } catch { parsed = {}; }
    const updates = list(parsed?.eventUpdates).slice(0, 6);
    data.events ||= [];
    const aliases = new Map();
    for (const update of updates) {
        if (!update || typeof update !== 'object') continue;
        const id = text(update.id, 100);
        let event = data.events.find(item => item.id === id);
        const linkedPosts = newPosts.filter(post => post.eventId === id && !post.moderation?.hidden);
        if (!event && allowNew && id.startsWith('new:') && text(update.title) && linkedPosts.length) {
            event = data.events.find(item => key(item.title) === key(update.title));
            if (!event) {
                event = { id: createId('event'), title: text(update.title, 80), status: 'active', nextStep: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() };
                data.events.push(event);
            }
            aliases.set(id, event.id);
        }
        if (!event) continue;
        const unfinished = list(data.world?.tasks).some(task => [id, event.id].includes(task.eventId) && ['offered', 'accepted'].includes(task.status));
        if (update.status === 'resolved' && event.status !== 'resolved' && linkedPosts.length && !unfinished) setStoryEventStatus(data, event.id, 'resolved');
    }
    for (const item of [...list(data.posts), ...list(data.world?.tasks), ...list(data.conversations).flatMap(conversation => list(conversation.messages))]) {
        if (!item.eventId) continue;
        item.eventId = aliases.get(item.eventId) || item.eventId;
        if (!data.events.some(event => event.id === item.eventId)) item.eventId = '';
    }
    syncStoryEventLinks(data);
    return data.events;
}

export function setStoryEventStatus(data, eventId, status) {
    const event = list(data.events).find(item => item.id === eventId);
    if (!event || !['active', 'resolved'].includes(status) || event.status === status) return false;
    event.status = status; event.updatedAt = Date.now();
    appendEntry(event, { id: createId('event-status'), kind: 'status', refId: '', parentId: '', summary: status === 'resolved' ? '事件已收尾，相关委托仍按各自进度处理' : '重新追踪事件', private: false, createdAt: event.updatedAt });
    return true;
}
