import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, EMPTY_FORUM_DATA } from '../src/constants.js';
import { buildForumBackup, readForumBackup, remapBackupAssets } from '../src/backup.js';
import { isImageDataUrl, storeImageAsset } from '../src/image-assets.js';

const image = 'data:image/png;base64,aW1hZ2U=';

function createStorage(initial = []) {
    const values = new Map(initial);
    return { values, getItem: async key => values.get(key), setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
}

test('separate image writes remain independent even with the same content and prefix', async () => {
    const storage = createStorage([['shared-old', image]]), cache = new Map();
    const first = await storeImageAsset(image, { storage, cache, prefix: 'post' });
    const second = await storeImageAsset('data:image/avif;base64,b3RoZXI=', { storage, cache, prefix: 'post' });
    assert.notEqual(first, second);
    assert.equal(storage.values.get(first), image);
    assert.equal(storage.values.get('shared-old'), image);
    assert.equal(cache.get(first), image);
});

test('a scope change during persistence removes only the unattached new asset', async () => {
    const storage = createStorage([['shared-old', image]]), cache = new Map();
    let current = true, releaseWrite, started;
    const writing = new Promise(resolve => { started = resolve; });
    storage.setItem = async (key, value) => {
        storage.values.set(key, value);
        started();
        await new Promise(resolve => { releaseWrite = resolve; });
    };
    const pending = storeImageAsset(image, { storage, cache, isCurrent: () => current });
    await writing;
    current = false;
    releaseWrite();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.deepEqual([...storage.values.keys()], ['shared-old']);
    assert.equal(cache.size, 0);
});

test('cancelled targets and non-image data never start a storage write', async () => {
    const storage = createStorage();
    await assert.rejects(storeImageAsset(image, { storage, isCurrent: () => false }), { name: 'AbortError' });
    await assert.rejects(storeImageAsset('data:text/html,<script>x</script>', { storage }), /图片数据无效/);
    assert.equal(storage.values.size, 0);
});

test('a rejected partial write preserves all previous stored images', async () => {
    const storage = createStorage([['shared-old', image]]);
    storage.setItem = async (key, value) => { storage.values.set(key, value); throw new Error('disk full'); };
    await assert.rejects(storeImageAsset(image, { storage }), /disk full/);
    assert.deepEqual([...storage.values.keys()], ['shared-old']);
});

test('complete backups restore AVIF, BMP and icon assets as well as PNG and SVG', async () => {
    const settings = structuredClone(DEFAULT_SETTINGS), data = structuredClone(EMPTY_FORUM_DATA);
    const formats = ['avif', 'bmp', 'x-icon', 'png', 'svg+xml'];
    settings.avatarLibrary = formats.map((format, index) => ({ id: `avatar-${index}`, imageKey: `asset-${index}`, name: format, url: '' }));
    const storage = createStorage(formats.map((format, index) => [`asset-${index}`, `data:image/${format};base64,aW1hZ2U=`]));
    const exported = await buildForumBackup(data, settings, storage);
    const imported = remapBackupAssets(readForumBackup(exported));
    assert.deepEqual(exported.missingAssets, []);
    assert.deepEqual(imported.missingAssets, []);
    for (const item of imported.presentation.avatarLibrary) {
        assert.ok(imported.assets[item.imageKey].startsWith(`data:image/${item.name};`));
        assert.equal(storage.values.has(item.imageKey), false);
    }
    assert.equal(isImageDataUrl('data:text/html;base64,aA=='), false);
    assert.equal(isImageDataUrl('data:image/;base64,aA=='), false);
});
