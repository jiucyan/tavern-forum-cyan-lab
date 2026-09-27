const lines = value => Array.isArray(value) ? [...new Set(value.map(String).map(item => item.trim()).filter(Boolean))] : [];
const clean = value => String(value || '').trim();
const handle = value => clean(value).replace(/^@/, '').toLocaleLowerCase();

export function normalizeMemoryContinuity(memory) {
    memory.importantMemories = lines(memory.importantMemories);
    memory.unresolvedEvents = lines(memory.unresolvedEvents);
    memory.privateImportantMemories = lines(memory.privateImportantMemories);
    memory.privateUnresolvedEvents = lines(memory.privateUnresolvedEvents);
    memory.peerRelationships = Array.isArray(memory.peerRelationships) ? memory.peerRelationships.filter(item => item && item.targetHandle).map(item => ({
        targetHandle: handle(item.targetHandle), state: ['normal', 'quarrel', 'reconciled'].includes(item.state) ? item.state : 'normal', reason: clean(item.reason), updatedAt: Number(item.updatedAt || 0),
    })) : [];
    memory.publicSummary = clean(memory.publicSummary);
    memory.privateSummary = clean(memory.privateSummary);
    memory.summaryUpdatedAt = Number(memory.summaryUpdatedAt || 0);
    memory.summaryPending = Number(memory.summaryPending || 0);
    memory.autoSummarize = memory.autoSummarize !== false;
    return memory;
}

function excerpts(items, maximum = 5) {
    return lines(items).slice(-maximum).map(item => item.length > 180 ? item.slice(0, 180) + '…' : item).join('\n');
}

// Extractive local summaries: original records and pinned items are never deleted.
export function refreshMemorySummary(npc, { force = false, changed = false } = {}) {
    if (!npc?.memory) return false;
    const memory = normalizeMemoryContinuity(npc.memory);
    if (changed) memory.summaryPending++;
    if (!force && (!memory.autoSummarize || (memory.summaryUpdatedAt && memory.summaryPending < 8))) return false;
    memory.publicSummary = [
        `与用户：${clean(memory.relationshipToUser) || '陌生人'}；当前状态：${({ normal: '普通', friendly: '亲近', quarrel: '争执中', blocked: '已拉黑' })[npc.socialState] || '普通'}。`,
        memory.importantMemories.length && `重要记忆：\n${memory.importantMemories.join('\n')}`,
        memory.unresolvedEvents.length && `未解决事项：\n${memory.unresolvedEvents.join('\n')}`,
        memory.peerRelationships.length && `角色关系：\n${memory.peerRelationships.map(item => `@${item.targetHandle}：${item.state === 'quarrel' ? '争执尚未解决' : item.state === 'reconciled' ? '已经和解，仍保留前因' : '正常'}；${item.reason}`).join('\n')}`,
        memory.publicHistory?.length && `近期公开经历摘录：\n${excerpts(memory.publicHistory)}`,
    ].filter(Boolean).join('\n\n');
    memory.privateSummary = [
        memory.privateImportantMemories.length && `私密重要记忆：\n${memory.privateImportantMemories.join('\n')}`,
        memory.privateUnresolvedEvents.length && `私密未解决事项：\n${memory.privateUnresolvedEvents.join('\n')}`,
        memory.privateTalks?.length && `近期私信摘录：\n${excerpts(memory.privateTalks)}`,
    ].filter(Boolean).join('\n\n');
    memory.summaryUpdatedAt = Date.now(); memory.summaryPending = 0;
    return true;
}

export function recordRelationshipEvent(npc, reason, delta = 0, { privateEvent = false } = {}) {
    if (!npc?.memory) return;
    const memory = npc.memory;
    memory.relationshipScore = Math.max(-100, Math.min(100, Number(memory.relationshipScore || 0) + delta));
    memory.relationshipEvents ||= [];
    memory.relationshipEvents.push({ reason, delta, private: privateEvent, createdAt: Date.now() });
    memory.relationshipEvents = memory.relationshipEvents.slice(-30);
    npc.updatedAt = Date.now();
    refreshMemorySummary(npc, { changed: true });
}

export function applyRelationshipTransition(npc, targetHandle, action, reason, { userTarget = false } = {}) {
    if (!npc?.memory || npc.blocked || !['quarrel', 'reconcile'].includes(action) || !clean(reason)) return false;
    const memory = normalizeMemoryContinuity(npc.memory);
    const key = userTarget ? 'me' : handle(targetHandle);
    if (!key || key === handle(npc.handle)) return false;
    let relationship = memory.peerRelationships.find(item => item.targetHandle === key);
    const previous = userTarget ? npc.socialState : relationship?.state || 'normal';
    const next = action === 'quarrel' ? 'quarrel' : 'reconciled';
    if (next === 'quarrel' && previous === 'quarrel') return false;
    if (next === 'reconciled' && previous !== 'quarrel') return false;
    if (!relationship) { relationship = { targetHandle: key }; memory.peerRelationships.push(relationship); }
    Object.assign(relationship, { state: next, reason: clean(reason).slice(0, 600), updatedAt: Date.now() });
    if (userTarget) npc.socialState = next === 'quarrel' ? 'quarrel' : 'normal';
    recordRelationshipEvent(npc, `与${userTarget ? '用户' : '@' + key}${action === 'quarrel' ? '发生争执' : '达成和解'}：${relationship.reason}`, userTarget ? (action === 'quarrel' ? -2 : 2) : 0);
    refreshMemorySummary(npc, { force: true });
    return true;
}

export function compactRoleMemory(npc) {
    if (!npc?.memory) return 0;
    let removed = 0;
    for (const field of ['publicHistory', 'privateTalks', 'knownFacts', 'unknownFacts', 'attitudes']) {
        const original = npc.memory[field] || [];
        npc.memory[field] = lines(original);
        removed += original.length - npc.memory[field].length;
    }
    refreshMemorySummary(npc, { force: true });
    return removed;
}

export function formatMemoryContinuity(npc, { privateChannel = false } = {}) {
    if (!npc?.memory) return '';
    const memory = normalizeMemoryContinuity(npc.memory);
    const publicEvents = (memory.relationshipEvents || []).filter(event => !event.private).slice(-5);
    return [
        memory.publicSummary && `公开经历摘要（可能早于最新记录，以当前状态和下列事项为准）：\n${memory.publicSummary}`,
        memory.importantMemories.length && `必须保留的重要关系与经历：\n${memory.importantMemories.join('\n')}`,
        memory.unresolvedEvents.length && `尚待解决，不得自行视为结束：\n${memory.unresolvedEvents.join('\n')}`,
        memory.peerRelationships.length && `当前各账号关系：\n${memory.peerRelationships.map(item => `@${item.targetHandle} [${item.state}]：${item.reason}`).join('\n')}`,
        publicEvents.length && `最近关系变化：${publicEvents.map(event => event.reason).join('；')}`,
        privateChannel && memory.privateSummary && `仅当前角色可知的私密摘要：\n${memory.privateSummary}`,
        privateChannel && memory.privateImportantMemories.length && `私密重要经历：${memory.privateImportantMemories.join('；')}`,
        privateChannel && memory.privateUnresolvedEvents.length && `私密未解决事项：${memory.privateUnresolvedEvents.join('；')}`,
        privateChannel && memory.privateTalks?.length && `最近私信记忆：\n${excerpts(memory.privateTalks, 8)}`,
        '延续已有关系：争执未解决时保留戒备与具体分歧；和解后缓和态度但不抹掉前因。普通关注或一次私信不代表信任、亲密或恋爱。先回应当前话题，不重复讲述摘要中的旧经历，不擅自完成未解决事项，不公开私密信息。',
    ].filter(Boolean).join('\n\n');
}
