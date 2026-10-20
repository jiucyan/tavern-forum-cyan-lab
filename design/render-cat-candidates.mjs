import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const systemEdge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const output = resolve('test-output/design');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    ...(existsSync(systemEdge) ? { executablePath: systemEdge } : {}),
});
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve('design/companion-cat-anatomy-v4.html')).href, { waitUntil: 'load' });
    await page.screenshot({ path: resolve(output, 'preview-companion-cat-anatomy-v4.png'), fullPage: true });
    console.log(`Screenshot: ${resolve(output, 'preview-companion-cat-anatomy-v4.png')}`);
} finally {
    await browser.close();
}
