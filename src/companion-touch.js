import { renderCompanionFoodArt } from './companion-food-art.js';

// Pointer interactions are transient UI state; persistence stays in the care handlers.
export function bindCompanionTouch(root, { captureScope, allowed, isCleaning, scrub, commit }) {
    let gesture = null, ghost = null, suppressClick = false;
    const navigationSelector = '.tf-device-menu-toggle, .tf-device-icon-menu button, .tf-pet-device-page > header button';
    const inside = (node, x, y) => {
        if (!node?.isConnected) return false;
        const rect = node.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };
    function reset() {
        gesture?.pet?.classList.remove('is-touching', 'is-snack-target');
        ghost?.remove(); ghost = null; gesture = null;
    }
    root.addEventListener('click', event => {
        if (!suppressClick || event.detail === 0) return;
        suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    root.addEventListener('pointerdown', event => {
        suppressClick = false;
        if (event.isPrimary === false || (event.button !== 0 && event.pointerType !== 'touch')) return;
        const target = event.target.closest('[data-action="companion-feed-food"], .tf-pet-sprite-control, .tf-pet-room-tool, ' + navigationSelector);
        const navigation = target?.matches(navigationSelector);
        if (!target || (!navigation && !allowed(target))) return;
        reset();
        const pet = root.querySelector('.tf-companion-v4 .tf-pet-sprite-control');
        if (!pet && !navigation) return;
        const kind = navigation ? 'navigation' : target.matches('.tf-pet-room-tool') || (target.matches('.tf-pet-sprite-control') && target.dataset.action !== 'companion-care') ? 'tool' : target.dataset.foodId ? 'food' : isCleaning() ? 'clean' : 'pet';
        gesture = { id: event.pointerId, target, pet, kind, foodId: target.dataset.foodId, x: event.clientX, y: event.clientY, distance: 0, current: captureScope() };
        try { target.setPointerCapture?.(event.pointerId); } catch { /* Synthetic or cancelled pointers may not support capture. */ }
        if (!navigation) pet.classList.add('is-touching');
    });
    root.addEventListener('pointermove', event => {
        const g = gesture;
        if (!g || g.id !== event.pointerId) return;
        if (!g.current() || !g.target.isConnected) { reset(); return; }
        const distance = Math.hypot(event.clientX - g.x, event.clientY - g.y);
        g.distance += distance; g.x = event.clientX; g.y = event.clientY;
        if (g.distance < 8) return;
        event.preventDefault();
        if (g.kind === 'food') {
            if (!ghost) {
                ghost = document.createElement('span'); ghost.className = 'tf-pet-drag-snack';
                ghost.innerHTML = renderCompanionFoodArt(g.foodId);
                ghost.setAttribute('aria-hidden', 'true'); root.append(ghost);
            }
            ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
            g.pet.classList.toggle('is-snack-target', inside(g.pet, event.clientX, event.clientY));
        } else if (g.kind === 'clean' && inside(g.pet, event.clientX, event.clientY) && scrub(Math.min(distance, 45) / 220)) {
            suppressClick = true; reset(); commit('clean');
        }
    }, { passive: false });
    root.addEventListener('pointerup', event => {
        const g = gesture;
        if (!g || g.id !== event.pointerId) return;
        const valid = g.current() && g.target.isConnected && (g.kind === 'navigation' || allowed(g.target));
        const hit = inside(g.pet, event.clientX, event.clientY);
        const toolHit = inside(g.target, event.clientX, event.clientY);
        reset();
        if (!valid) { suppressClick = true; return; }
        if (g.kind === 'tool' || g.kind === 'navigation') {
            if (event.pointerType === 'touch') {
                suppressClick = true;
                if (toolHit && g.distance < 8) g.target.click();
            }
        } else if (g.kind === 'clean') {
            suppressClick = true;
            if (hit && g.distance < 8 && scrub(.34)) commit('clean');
        } else if (g.distance >= 8) {
            suppressClick = true;
            if (hit) requestAnimationFrame(() => { if (g.current()) commit(g.kind, g.foodId); });
        } else if (event.pointerType === 'touch' && toolHit) {
            suppressClick = true; g.target.click();
        }
    });
    root.addEventListener('pointercancel', event => {
        if (gesture?.id === event.pointerId) { suppressClick = true; reset(); }
    });
    root.addEventListener('dragstart', event => {
        if (event.target.closest('[data-action="companion-feed-food"], .tf-pet-sprite-control')) event.preventDefault();
    });
    return reset;
}
