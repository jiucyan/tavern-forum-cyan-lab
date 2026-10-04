let poseSequence = 0;

/** A folded body with an unchanged, uniformly resized head, rather than a flattened standing sprite. */
export function renderCompanionRoomPose(kind, headArtwork, fit = {}, stage = 'adult', wearables = '') {
    const id = `tf-room-head-${++poseSequence}`;
    // Fish fold their fins, and soot balls settle as a ball; neither acquires mammal paws.
    if (kind === 'goldfish' || kind === 'soot') {
        return `<g class="tf-room-pose-art" data-pose-art="settled-${kind}" display="none"><g transform="translate(3 6) scale(.9)">${headArtwork}<g class="tf-room-pose-wearables">${wearables}</g></g></g>`;
    }
    const cutoff = Math.min(51, Math.max(36, Number(fit.neck || 40) - 1));
    const headScale = stage === 'baby' ? .76 : .72;
    const dx = 24 - Number(fit.cx || 32) * headScale;
    const dy = 53 - cutoff * headScale;
    const tail = ['cat', 'fox'].includes(kind)
        ? `<path class="tf-pixel-body-shadow" d="M48 44h7v-5h5v12h-5v5H37v-5h12z"/><path class="tf-pixel-body" d="M48 43h6v-5h5v12h-5v5H37v-5h12z"/>${kind === 'fox' ? '<path class="tf-pixel-light" d="M54 38h5v7h-5z"/>' : ''}`
        : kind === 'rabbit' ? '<rect class="tf-pixel-light" x="51" y="44" width="9" height="10" rx="3"/>' : '';
    const body = kind === 'robo-bird'
        ? '<path class="tf-pixel-body-shadow" d="M25 40h29v17H25z"/><path class="tf-pixel-body" d="M24 39h28v16H24z"/><path class="tf-pixel-accent" d="M34 43h12v5H34z"/>'
        : '<path class="tf-pixel-body-shadow" d="M29 39h18v3h7v5h4v8h-5v3H23V45h6z"/><path class="tf-pixel-body" d="M28 38h18v3h7v5h4v8h-5v3H22V44h6z"/><path class="tf-pixel-light" opacity=".18" d="M31 41h13v3h7v3H31z"/>';
    const paws = kind === 'octopus'
        ? '<path class="tf-pixel-body-shadow" d="M12 51h7v4h8v-4h5v4h7v-4h5v4h9v-4h5v7H12z"/><path class="tf-pixel-body" d="M11 50h7v4h8v-4h5v4h7v-4h5v4h9v-4h5v7H11z"/>'
        : '<path class="tf-pixel-body-shadow" d="M14 52h10v5H14zM30 53h11v5H30z"/><path class="tf-pixel-body" d="M13 51h10v5H13zM29 52h11v5H29z"/><path class="tf-pixel-light" d="M15 52h5v2h-5zM31 53h5v2h-5z"/>';
    return `<g class="tf-room-pose-art" data-pose-art="folded-${kind}" display="none"><defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="64" height="${cutoff}"/></clipPath></defs><g class="tf-room-pose-breath">${tail}${body}<g transform="translate(${dx} ${dy}) scale(${headScale})"><g clip-path="url(#${id})">${headArtwork}</g><g class="tf-room-pose-wearables">${wearables}</g></g>${paws}</g></g>`;
}
