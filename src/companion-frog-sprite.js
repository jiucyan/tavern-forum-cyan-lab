import { renderArticulatedSprite } from './companion-sprite-rig.js';

// Original pixel artwork is used directly. Frames share the same measured alpha bounds.
const atlas = new URL('../assets/companions/frog-pixel-a-v1.png', import.meta.url).href;
const frames = Object.freeze([
    ['idle', 368, 77], ['happy', 952, 77],
    ['feed', 368, 479], ['sleep', 952, 479],
]);
let filterSequence = 0;

function tintFilter(id, kind) {
    // Green dominance selects skin; red chroma plus brightness selects cheeks/tongue.
    // The cream belly, eye glints, dark outlines and transparent margins stay untouched.
    const chroma = kind === 'body' ? '-36 36 0 0 -.1' : '8 -8 0 0 -1';
    return `<filter id="${id}" x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${chroma}" result="chroma"/>
        ${kind === 'accent' ? '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 0 0 0 -2" result="bright"/><feComposite in="chroma" in2="bright" operator="in" result="chroma"/>' : ''}
        <feComposite in="chroma" in2="SourceAlpha" operator="in" result="mask"/>
        <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="light"/>
        <feComponentTransfer in="light" result="shade"><feFuncR type="linear" slope=".5" intercept=".5"/><feFuncG type="linear" slope=".5" intercept=".5"/><feFuncB type="linear" slope=".5" intercept=".5"/></feComponentTransfer>
        <feFlood class="tf-frog-${kind}-color" result="color"/>
        <feBlend in="color" in2="shade" mode="multiply" result="tinted"/>
        <feComposite in="tinted" in2="mask" operator="in"/>
    </filter>`;
}

export function renderFrogSpriteBody() {
    const id = `tf-frog-tint-${++filterSequence}`;
    const defs = `<defs>${tintFilter(`${id}-body`, 'body')}${tintFilter(`${id}-accent`, 'accent')}</defs>`;
    const cells = frames.map(([name, x, y]) => {
        const cell = `<svg x="4" y="11" width="56" height="45.5" viewBox="${x} ${y} 448 364" preserveAspectRatio="none" style="width:56px!important;height:45.5px!important;overflow:hidden!important"><image href="${atlas}" width="1774" height="887"/></svg>`;
        const paint = `<g class="tf-frog-source">${cell}</g><g class="tf-frog-tint-body" filter="url(#${id}-body)">${cell}</g><g class="tf-frog-tint-accent" filter="url(#${id}-accent)">${cell}</g>`;
        return `<g class="tf-raster-frame is-${name}" data-frame="${name}">${renderArticulatedSprite('frog', paint, `${id}-${name}`)}</g>`;
    }).join('');
    return `<g class="tf-frog-raster" data-art="frog-pixel-a-v1">${defs}${cells}</g>`;
}
