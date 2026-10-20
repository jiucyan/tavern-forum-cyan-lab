import { normalizeForumDataShape } from './forum.js';
import { createId } from './prompt.js';
import { isImageDataUrl } from './image-assets.js';

const arrayFields = ['posts', 'npcs', 'conversations', 'notifications', 'facts', 'generationLogs', 'deletedPosts', 'events'];
const worldArrays = ['tasks', 'trips', 'inventory', 'pendingInventoryRewards', 'health', 'reports', 'proposals', 'auditLog', 'fortuneHistory'];
const assetFields = new Set(['imageKey', 'avatarKey', 'backgroundKey', 'wallpaperKey', 'brandIconKey', 'floatingButtonImageKey']);

function visit(value, callback) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('备份包含不支持的属性');
        if (assetFields.has(key) && typeof item === 'string' && item) callback(value, key, item);
        else if (item && typeof item === 'object') visit(item, callback);
    }
}

export async function buildForumBackup(data, settings, storage) {
    const bundle = { format: 'tavern-forum-backup', version: 1, createdAt: Date.now(), data: structuredClone(data), presentation: structuredClone({ profile: settings.profile, appearance: settings.appearance, avatarLibrary: settings.avatarLibrary, ui: { floatingButtonImageKey: settings.ui.floatingButtonImageKey, floatingButtonImageUrl: settings.ui.floatingButtonImageUrl } }), assets: {}, missingAssets: [] };
    const keys = new Set();
    visit(bundle.data, (_, __, key) => keys.add(key));
    visit(bundle.presentation, (_, __, key) => keys.add(key));
    for (const key of keys) {
        const value = await storage?.getItem(key);
        if (isImageDataUrl(value)) bundle.assets[key] = value;
        else bundle.missingAssets.push(key);
    }
    return bundle;
}

export function readForumBackup(payload) {
    visit(payload, () => {});
    const bundle = payload?.format === 'tavern-forum-backup';
    if (bundle && payload.version !== 1) throw new Error('暂不支持这个备份格式版本');
    const source = bundle ? payload.data : payload;
    if (!source || !Array.isArray(source.posts)) throw new Error('文件中没有有效的论坛数据');
    for (const field of arrayFields) {
        if (source[field] !== undefined && (!Array.isArray(source[field]) || source[field].some(item => !item || typeof item !== 'object' || Array.isArray(item)))) throw new Error(`无效的数据列表：${field}`);
    }
    const data = normalizeForumDataShape(structuredClone(source));
    const assets = {};
    const supplied = bundle && payload.assets && typeof payload.assets === 'object' ? payload.assets : {};
    const presentation = bundle && payload.presentation && typeof payload.presentation === 'object' ? structuredClone(payload.presentation) : null;
    const keys = new Set();
    visit(data, (_, __, key) => keys.add(key));
    visit(presentation, (_, __, key) => keys.add(key));
    for (const key of keys) if (isImageDataUrl(supplied[key])) assets[key] = supplied[key];
    return { data, presentation, assets, missingAssets: [...keys].filter(key => !assets[key]) };
}

function mergeItems(current = [], incoming = [], nestedField = '') {
    const result = structuredClone(current);
    for (const item of incoming) {
        const existing = result.find(entry => item.id && entry.id === item.id);
        if (!existing) result.push(structuredClone(item));
        else if (nestedField) existing[nestedField] = mergeItems(existing[nestedField], item[nestedField]);
    }
    return result;
}

export function mergeForumBackup(current, incoming) {
    const merged = structuredClone(current);
    for (const field of arrayFields) merged[field] = mergeItems(current[field], incoming[field], field === 'posts' ? 'comments' : field === 'conversations' ? 'messages' : field === 'events' ? 'entries' : '');
    merged.world ||= {};
    for (const field of worldArrays) merged.world[field] = mergeItems(current.world?.[field], incoming.world?.[field]);
    // A reward receipt is monotonic even when the rest of a local trip is kept.
    // Merging an older pending snapshot must never make a paid reward collectible again.
    for (const trip of merged.world.trips) {
        const other = incoming.world?.trips?.find(item => item.id === trip.id);
        if (!other) continue;
        for (const field of ['souvenirClaimedAt', 'homesteadRewardClaimedAt']) {
            trip[field] = Math.max(Number(trip[field] || 0), Number(other[field] || 0));
        }
    }
    // Keep the current companion and fortune when merging two separate worlds.
    return normalizeForumDataShape(merged);
}

export function previewForumImport(current, backup) {
    return ['posts', 'npcs', 'conversations'].map(field => ({ field, incoming: backup.data[field].length, added: backup.data[field].filter(item => !current[field].some(existing => existing.id === item.id)).length, existing: current[field].length }));
}

export function remapBackupAssets(backup) {
    const result = structuredClone(backup);
    const keys = new Map(Object.keys(result.assets).map(key => [key, `tavern-forum:import:${createId('asset')}`]));
    for (const value of [result.data, result.presentation]) visit(value, (object, field, key) => { if (keys.has(key)) object[field] = keys.get(key); });
    result.assets = Object.fromEntries(Object.entries(result.assets).map(([key, value]) => [keys.get(key), value]));
    return result;
}
