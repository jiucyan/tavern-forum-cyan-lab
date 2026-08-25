import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function readProjectFile(path) {
    return readFile(new URL(path, projectRoot), 'utf8');
}

test('release metadata uses one valid SemVer version', async () => {
    const manifest = JSON.parse(await readProjectFile('manifest.json'));
    const packageJson = JSON.parse(await readProjectFile('package.json'));

    assert.match(manifest.version, semverPattern);
    assert.equal(packageJson.version, manifest.version);
    assert.match(manifest.minimum_client_version, semverPattern);
});

test('public version labels match the manifest', async () => {
    const manifest = JSON.parse(await readProjectFile('manifest.json'));
    const [readme, preview] = await Promise.all([
        readProjectFile('README.md'),
        readProjectFile('preview.html'),
    ]);

    assert.ok(readme.includes(`当前扩展版本为 \`${manifest.version}\``));
    assert.ok(preview.includes(`v${manifest.version} 预览</title>`));
});
