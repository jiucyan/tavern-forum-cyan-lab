let poseSequence = 0;

const paint = (d, tone = 'body', extra = '') => `<path class="tf-pixel-${tone}" d="${d}"${extra}/>`;
const solid = d => `<g transform="translate(0 1)">${paint(d, 'body-shadow')}</g>${paint(d, 'body', ' stroke="var(--tf-rest-edge, transparent)" stroke-width=".65" stroke-linejoin="round"')}`;

// The baseline is shared with standing art; each species supports its weight in
// its own way. Heads and accessories retain their original palette.
function restingAnatomy(kind) {
    if (kind === 'cat') return {
        name: 'curled-paws', headX: 24, headBottom: 50, scale: .74,
        back: solid('M31 39h10v2h7v4h4v5h2v4h-6v3H25v-4h-3v-8h3v-4h6z'),
        front: `<g data-rest-part="curled-tail">${solid('M49 45h6v9h-5v4H26v-4h19v-3h4z')}${paint('M31 54h12v2H31z', 'body-shadow')}</g><g data-rest-part="tucked-paws">${solid('M15 51h9v5H13v-3h2z')}${paint('M16 53h5v1h-5z', 'body-shadow')}</g>`,
    };
    if (kind === 'fox') return {
        name: 'tail-wrap', headX: 25, headBottom: 49, scale: .73,
        back: solid('M29 38h12v3h9v6h4v7H23V45h6z'),
        front: `<g data-rest-part="wrapped-tail">${solid('M47 42h7v5h5v8h-6v4H20v-4h17v-4h10z')}${paint('M19 54h16v5H19zM23 51h7v3h-7z', 'light')}</g>`,
    };
    if (kind === 'rabbit') return {
        name: 'tucked-loaf', headX: 27, headBottom: 49, scale: .74,
        back: `<g data-rest-part="round-tail">${solid('M48 46h8v8h-8z')}${paint('M50 47h5v5h-5z', 'light')}</g><g data-rest-part="loaf-body">${solid('M27 39h16v4h7v5h3v7h-6v3H20v-4h-3V45h10z')}</g>`,
        front: `<g data-rest-part="tucked-paws">${paint('M20 54h7v2h-7zM32 55h7v1h-7z', 'body-shadow')}</g>`,
    };
    if (kind === 'penguin') return {
        name: 'flippers-folded', headX: 32, headBottom: 44, scale: .8,
        back: `<g data-rest-part="seated-body">${solid('M24 35h16v4h6v6h3v9h-6v4H21v-4h-5v-9h3v-6h5z')}${paint('M25 41h14v4h5v9H21v-9h4z', 'light')}</g>`,
        front: `<g data-rest-part="folded-flippers">${solid('M18 40h5v7h3v6h-5v-4h-3zM41 40h5v9h-3v4h-5v-6h3z')}</g><g data-rest-part="webbed-feet">${paint('M23 55h7v3H20v-2h3zM35 55h7v1h3v2H35z', 'accent')}</g>`,
    };
    if (kind === 'frog') return {
        name: 'crouched-webbed', headX: 32, headBottom: 48, scale: .84,
        back: `<g data-rest-part="folded-hindlegs">${solid('M14 43h11v8h-5v5H9v-5h5zM40 43h10v8h5v5H44v-5h-4z')}</g>${solid('M23 42h17v6h5v9H19v-9h4z')}${paint('M26 45h11v4h5v6H22v-6h4z', 'light')}`,
        front: `<g data-rest-part="webbed-hands">${paint('M20 50h4v5h4v2H16v-3h4zM40 50h4v4h4v3H36v-2h4z')}</g>`,
    };
    if (kind === 'octopus') return {
        name: 'tentacles-gathered', headX: 32, headBottom: 50, scale: .84,
        back: '',
        front: `<g data-rest-part="resting-tentacles">${solid('M18 46h6v5h-6v4h-8v-4h4v-3h4zM25 47h6v8h-4v3h-9v-3h7zM34 47h6v8h7v3h-9v-3h-4zM42 46h6v3h5v3h4v4h-9v-4h-6z')}${paint('M12 53h3v1h-3zM20 56h4v1h-4zM40 56h4v1h-4zM50 53h3v1h-3z', 'light', ' opacity=".48"')}</g>`,
    };
    if (kind === 'robo-bird') return {
        name: 'perched-folded', headX: 39, headBottom: 45, scale: .78,
        back: `<g data-rest-part="folded-tail">${solid('M23 45H9v6h17z')}${paint('M12 47h10v2H12z', 'accent')}</g>${solid('M23 38h17v4h6v12H21v-4h-5v-7h7z')}`,
        front: `<g data-rest-part="folded-wing">${paint('M22 43h13v3h4v6H22z', 'light')}${paint('M27 46h5v3h-5z', 'accent')}</g><g data-rest-part="perching-feet">${paint('M24 54h4v2h5v2H21v-2h3zM38 54h4v2h5v2H36v-2h2z', 'accent')}</g>`,
    };
    return null;
}

/** Draw a supported resting posture without stretching the standing sprite. */
export function renderCompanionRoomPose(kind, headArtwork, fit = {}, stage = 'adult', wearables = '') {
    const id = `tf-room-head-${++poseSequence}`;
    const anatomy = restingAnatomy(kind);
    if (!anatomy || kind === 'frog' && stage === 'baby') {
        const poseKind = kind === 'frog' ? 'tadpole' : kind;
        return `<g class="tf-room-pose-art" data-pose-art="settled-${poseKind}" data-pose-anatomy="native-rest" display="none"><g transform="translate(3 6) scale(.9)">${headArtwork}<g class="tf-room-pose-wearables">${wearables}</g></g></g>`;
    }
    const cutoff = Math.min(51, Math.max(36, Number(fit.neck || 40) - 1));
    const headScale = anatomy.scale + (stage === 'baby' ? .025 : 0);
    const dx = anatomy.headX - Number(fit.cx || 32) * headScale;
    const dy = anatomy.headBottom - cutoff * headScale;
    return `<g class="tf-room-pose-art" data-pose-art="folded-${kind}" data-pose-anatomy="${anatomy.name}" display="none"><defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="72" height="${cutoff}"/></clipPath></defs><g class="tf-room-pose-breath">${anatomy.back}<g class="tf-room-rest-head" transform="translate(${dx} ${dy}) scale(${headScale})"><g clip-path="url(#${id})">${headArtwork}</g><g class="tf-room-pose-wearables">${wearables}</g></g>${anatomy.front}</g></g>`;
}
