import { createId } from './prompt.js';

export function isImageDataUrl(value) {
    return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+[;,]/i.test(value);
}

export function assertImageOperationCurrent(isCurrent) {
    if (!isCurrent()) throw new DOMException('聊天或图片目标已改变，本次图片操作已取消。', 'AbortError');
}

// Only use this for a new asset that has never been attached to saved content.
// Existing assets may also be referenced by another chat and must be retained.
export async function discardNewImageAsset(key, storage, cache) {
    if (!key) return;
    await storage?.removeItem(key);
    cache?.delete(key);
}

export async function storeImageAsset(value, { storage, cache, isCurrent = () => true, prefix = 'image' } = {}) {
    assertImageOperationCurrent(isCurrent);
    if (!isImageDataUrl(value)) throw new Error('图片数据无效');
    if (!storage) throw new Error('当前酒馆不支持本地图片存储');
    const key = `tavern-forum:asset:${prefix}:${createId('image')}`;
    try {
        await storage.setItem(key, value);
        assertImageOperationCurrent(isCurrent);
        cache?.set(key, value);
        return key;
    } catch (error) {
        try { await discardNewImageAsset(key, storage, cache); } catch { /* A failed cleanup must not hide the original error. */ }
        throw error;
    }
}
