import { COMPANION_SPRITE_RIGS } from './companion-sprite-rig-data.js';

/**
 * Articulate the existing atlas artwork in the shared 64 × 64 pet coordinate space.
 * Every moving part keeps the complete paint stack, including custom color filters.
 * Parts extend into their joints and sit behind the core so movement cannot expose
 * a seam along the original cut. The source PNG and expression frames stay intact.
 */
export function renderArticulatedSprite(kind, paint, uniqueFrameId) {
    const rig = COMPANION_SPRITE_RIGS[kind];
    const parts = rig?.parts;
    if (!parts?.length) return `<g class="tf-raster-core">${paint}</g>`;

    const coreMask = `${uniqueFrameId}-core-mask`;
    const muzzle = rig.muzzle;
    const muzzleClip = `${uniqueFrameId}-muzzle`;
    const clips = parts.map((part, index) => `<clipPath id="${uniqueFrameId}-part-${index}" clipPathUnits="userSpaceOnUse"><path d="${part.clip}"/></clipPath>`).join('')
        + (muzzle ? `<clipPath id="${muzzleClip}" clipPathUnits="userSpaceOnUse"><path d="${muzzle.clip}"/></clipPath>` : '');
    // A luminance mask subtracts the union of all cuts. Unlike an even-odd compound
    // path, overlapping cuts never restore a patch of the original fixed artwork.
    const cuts = parts.map(part => `<path d="${part.cut || part.clip}" fill="black"/>`).join('')
        + (muzzle ? `<path class="tf-raster-muzzle-cut" d="${muzzle.cut}" fill="white"/>` : '');
    const defs = `<defs>${clips}<mask id="${coreMask}" x="0" y="0" width="64" height="64" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect x="0" y="0" width="64" height="64" fill="white"/>${cuts}</mask></defs>`;
    const moving = parts.map((part, index) => `<g class="tf-raster-part" data-part="${part.name}" data-motion="${part.motion}" style="transform-origin:${part.pivot[0]}px ${part.pivot[1]}px;transform-box:view-box"><g clip-path="url(#${uniqueFrameId}-part-${index})">${paint}</g></g>`).join('');
    // These presentation attributes make non-feeding artwork unchanged, including
    // previews without the game stylesheet. Feeding CSS opens only the mouth
    // window; the core covers its moving overlap so no rectangular edge appears.
    const mouth = muzzle ? `<g class="tf-raster-muzzle" data-muzzle="${muzzle.direction}" display="none" style="transform-origin:${muzzle.pivot[0]}px ${muzzle.pivot[1]}px;transform-box:view-box"><g clip-path="url(#${muzzleClip})">${paint}</g></g>` : '';
    return `${defs}${moving}${mouth}<g class="tf-raster-core" mask="url(#${coreMask})">${paint}</g>`;
}
