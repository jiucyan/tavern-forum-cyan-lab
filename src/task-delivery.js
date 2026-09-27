import { createId } from './prompt.js';
import { syncStoryEventLinks } from './events.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim().slice(0, 500) : '';
const key = value => text(value).normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase();
const quantity = value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 9999 ? Number(value) : 0;

export function normalizeDeliveryRequirements(value) {
    const requirements = new Map();
    for (const item of list(value).slice(0, 12)) {
        const name = text(item?.name); const amount = quantity(item?.quantity);
        if (!name || !amount) continue;
        const old = requirements.get(key(name));
        requirements.set(key(name), { name, quantity: Math.min(9999, (old?.quantity || 0) + amount) });
    }
    return [...requirements.values()];
}

export function normalizeTaskReceipt(value) {
    if (!value || typeof value !== 'object' || !value.id) return null;
    const items = field => list(value[field]).map(item => ({ id: text(item?.id), name: text(item?.name), quantity: quantity(item?.quantity) })).filter(item => item.name && item.quantity).slice(0, 100);
    return { id: text(value.id), createdAt: Number(value.createdAt) || 0, method: value.method === 'inventory' ? 'inventory' : 'story', items: items('items'), rewards: items('rewards') };
}

export function getTaskRewards(task) {
    const rewards = normalizeDeliveryRequirements(task.rewardItems);
    return rewards.length ? rewards : task.reward ? [{ name: task.reward, quantity: 1 }] : [];
}

export function buildTaskDeliveryPlan(data, taskId, selection = {}) {
    const task = list(data.world?.tasks).find(item => item.id === taskId);
    const requirements = normalizeDeliveryRequirements(task?.deliveryRequirements?.length ? task.deliveryRequirements : [{ name: task?.objectiveTarget, quantity: task?.objectiveQuantity }]);
    let reason = !task || !['item', 'delivery'].includes(task.objectiveType) ? '此委托需要正文证据验收'
        : task.status !== 'accepted' || task.deliveryReceipt ? '请先接受委托；已完成的委托不能重复交付'
            : !requirements.length ? '委托未写明可交付的物品名称与数量'
                : list(task.steps).some(step => !requirements.some(item => key(item.name) === key(step))) ? '此委托包含额外步骤，请使用正文证据验收' : '';
    const traveling = new Set(list(data.world?.trips).filter(trip => trip.status === 'away').flatMap(trip => list(trip.packingItems).filter(item => !item.consumed).map(item => item.id)));
    const candidates = list(data.world?.inventory).filter(item => !item.consumed && item.quantity > 0 && item.usable !== false && requirements.some(required => key(required.name) === key(item.name))).map(item => ({ id: item.id, name: item.name, quantity: Number(item.quantity), available: !traveling.has(item.id) }));
    const selected = [];
    for (const [id, amount] of Object.entries(selection || {})) {
        if (Number(amount) === 0) continue;
        const item = candidates.find(entry => entry.id === id);
        if (!item || !item.available || !quantity(amount) || Number(amount) > item.quantity) { reason ||= '所选物品已不足、正在旅行或数量无效'; continue; }
        selected.push({ id: item.id, name: item.name, quantity: Number(amount) });
    }
    const rows = requirements.map(required => ({ ...required,
        available: candidates.filter(item => item.available && key(item.name) === key(required.name)).reduce((sum, item) => sum + item.quantity, 0),
        selected: selected.filter(item => key(item.name) === key(required.name)).reduce((sum, item) => sum + item.quantity, 0),
    }));
    const balanced = rows.length > 0 && rows.every(item => item.selected === item.quantity);
    const rewards = task ? getTaskRewards(task) : [];
    const signature = JSON.stringify([task?.id, task?.status, task?.objectiveType, requirements, task?.steps, candidates, selected, rewards]);
    return { task, requirements: rows, candidates, selected, rewards, reason, ready: !reason && balanced, signature };
}

export function grantTaskRewards(data, task, timestamp = Date.now()) {
    const rewards = getTaskRewards(task);
    const source = `任务奖励 · ${task.id}`;
    const existing = list(data.world.inventory).filter(item => item.source === source);
    if (task.deliveryReceipt || task.verifiedAt || existing.length) return existing.map(item => ({ id: item.id, name: item.name, quantity: item.quantity }));
    return rewards.map(reward => {
        const item = { id: createId('item'), ...reward, description: `完成“${task.title}”获得的约定奖励。`, effect: '按委托约定在合适的情境中使用。', source, usable: true, consumed: false, createdAt: timestamp, updatedAt: timestamp };
        data.world.inventory.push(item); return { id: item.id, name: item.name, quantity: item.quantity };
    });
}

export function commitTaskDelivery(data, taskId, selection, expectedSignature) {
    const plan = buildTaskDeliveryPlan(data, taskId, selection);
    if (!plan.ready) throw new Error(plan.reason || '所选数量必须与每项要求完全一致');
    if (!expectedSignature || expectedSignature !== plan.signature) throw new Error('物品或委托已变化，请重新查看交付预览');
    const timestamp = Date.now();
    for (const item of plan.selected) {
        const stored = data.world.inventory.find(entry => entry.id === item.id);
        stored.quantity -= item.quantity; stored.consumed = stored.quantity === 0; stored.updatedAt = timestamp;
    }
    const task = plan.task;
    const rewards = grantTaskRewards(data, task, timestamp);
    task.deliveryReceipt = { id: createId('receipt'), createdAt: timestamp, method: 'inventory', items: plan.selected, rewards };
    Object.assign(task, { status: 'completed', verificationStatus: 'verified', verificationMethod: 'inventory', verificationReason: '已按委托清单从背包交付', verifiedAt: timestamp, updatedAt: timestamp, evidenceMessageIndex: -1, evidenceExcerpt: plan.selected.map(item => `${item.name} ×${item.quantity}`).join('、') });
    syncStoryEventLinks(data);
    return task.deliveryReceipt;
}
