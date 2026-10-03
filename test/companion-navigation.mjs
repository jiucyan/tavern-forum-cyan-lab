// Follow the same on-demand menu path available to mouse and touch users.
export async function openCompanionMenu(page, panel, method = 'click') {
    await page.locator('.tf-device-menu-toggle')[method]();
    if (panel && panel !== 'menu') await page.locator(`.tf-device-icon-menu [data-panel="${panel}"]`)[method]();
}

// C cancels a care overlay to its origin; one more C returns from any page to home.
export async function returnCompanionHome(page, method = 'click') {
    for (let step = 0; step < 3; step++) {
        const device = page.locator('.tf-companion-device');
        const transient = await device.locator('.tf-pet-food-select').count() || await device.evaluate(node => node.classList.contains('is-washing'));
        if (await device.getAttribute('data-device-page') === 'home' && !transient) return;
        await page.locator('[data-action="companion-menu-nav"][data-direction="1"]')[method]();
    }
    throw Error('Companion return chain did not reach home');
}
