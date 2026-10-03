import { COMPANION_RASTER_DATA } from './companion-raster-data.js';
import { renderArticulatedSprite } from './companion-sprite-rig.js';

const FRAME_NAMES = ['idle', 'happy', 'feed', 'sleep'];
let filterSequence = 0;

export function getCompanionRasterData(kind) {
    return Object.hasOwn(COMPANION_RASTER_DATA, kind) ? COMPANION_RASTER_DATA[kind] : null;
}

function alphaMask(config, kind) {
    const rows = [config[`${kind}Chroma`] || '0 0 0 1 0', ...(config[`${kind}Gates`] || [])];
    return rows.map((row, index) => `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${row}" result="${kind}-gate-${index}"/>
        ${index ? `<feComposite in="${kind}-gate-${index}" in2="${kind}-selected-${index - 1}" operator="in" result="${kind}-selected-${index}"/>` : `<feComposite in="${kind}-gate-0" in2="SourceAlpha" operator="in" result="${kind}-selected-0"/>`}`).join('')
        + `<feComposite in="${kind}-selected-${rows.length - 1}" in2="SourceAlpha" operator="in" result="${kind}-mask"/>`;
}

function tintFilter(id, kind, config) {
    // Separate color masks retain the original shading, highlights and outlines.
    // Accent pixels are excluded from the body mask so the two controls remain independent.
    const mask = kind === 'body'
        ? `${alphaMask(config, 'body')}${alphaMask(config, 'accent')}<feComposite in="body-mask" in2="accent-mask" operator="out" result="mask"/>`
        : `${alphaMask(config, 'accent')}<feComposite in="accent-mask" in2="SourceAlpha" operator="in" result="mask"/>`;
    return `<filter id="${id}" x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        ${mask}
        <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="light"/>
        <feComponentTransfer in="light" result="shade"><feFuncR type="linear" slope=".5" intercept=".5"/><feFuncG type="linear" slope=".5" intercept=".5"/><feFuncB type="linear" slope=".5" intercept=".5"/></feComponentTransfer>
        <feFlood class="tf-animal-${kind}-color" result="color"/>
        <feBlend in="color" in2="shade" mode="multiply" result="tinted"/>
        <feComposite in="tinted" in2="mask" operator="in"/>
    </filter>`;
}

export function renderCompanionRasterBody(kind) {
    const config = getCompanionRasterData(kind);
    if (!config) return '';
    const atlas = new URL(`../assets/companions/${config.file}`, import.meta.url).href;
    const id = `tf-animal-tint-${++filterSequence}`;
    const [x, y, width, height] = config.target;
    const defs = `<defs>${tintFilter(`${id}-body`, 'body', config)}${tintFilter(`${id}-accent`, 'accent', config)}</defs>`;
    const frames = FRAME_NAMES.map(name => {
        const cell = `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${config.frames[name].join(' ')}" preserveAspectRatio="none" style="width:${width}px!important;height:${height}px!important;overflow:hidden!important"><image href="${atlas}" width="${config.width}" height="${config.height}"/></svg>`;
        const paint = `<g class="tf-animal-source">${cell}</g><g class="tf-animal-tint-body" filter="url(#${id}-body)">${cell}</g><g class="tf-animal-tint-accent" filter="url(#${id}-accent)">${cell}</g>`;
        return `<g class="tf-raster-frame is-${name}" data-frame="${name}">${renderArticulatedSprite(kind, paint, `${id}-${name}`)}</g>`;
    }).join('');
    return `<g class="tf-animal-raster" data-art="${kind}-pixel-a-v1">${defs}${frames}</g>`;
}
