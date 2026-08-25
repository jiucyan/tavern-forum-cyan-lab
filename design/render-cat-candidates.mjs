import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const systemEdge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
    headless: true,
    ...(existsSync(systemEdge) ? { executablePath: systemEdge } : {}),
});
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve('design/companion-cat-anatomy-v4.html')).href, { waitUntil: 'load' });
    await page.screenshot({ path: 'preview-companion-cat-anatomy-v4.png', fullPage: true });
} finally {
    await browser.close();
}
