// Follow the same on-demand menu path available to mouse and touch users.
export async function openCompanionMenu(page, panel, method = 'click') {
    await page.locator('.tf-device-menu-toggle')[method]();
    if (panel && panel !== 'menu') await page.locator(`.tf-device-icon-menu [data-panel="${panel}"]`)[method]();
}
