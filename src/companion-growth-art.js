// Juvenile silhouettes use the same palette and expression/animation layers as adults.
// Coordinates are hand-drawn in the 64 px character canvas; adult artwork stays intact.
const path = (d, tone = 'body') => `<path class="tf-pixel-${tone}" d="${d}"/>`;
const rect = (x, y, w, h, tone = 'body') => `<rect class="tf-pixel-${tone}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const group = (name, art) => `<g class="${name}">${art}</g>`;
const solid = d => `<g transform="translate(1 1)">${path(d, 'body-shadow')}</g>${path(d)}`;
const cheeks = (left, right, y) => group('tf-pixel-cheeks', rect(left, y, 4, 2, 'accent') + rect(right, y, 4, 2, 'accent'));
function faces(x, y, light = false) {
    const tone = light ? 'light' : 'ink';
    return { default: path(`M${x - 4} ${y}h2v2h4v-2h2v3h-2v1h-4v-1h-2z`, tone),
        feed: path(`M${x - 3} ${y}h6v2h2v4h-10v-4h2z`, tone) + rect(x - 2, y + 4, 4, 2, 'mouth-tongue'),
        sleep: rect(x - 3, y + 2, 6, 2, tone) };
}
function kittenEyes(left, right, y) {
    return `<g class="tf-pixel-eyes tf-pixel-eyes-open">${[left, right].map(x => path(`M${x} ${y}h7v2h2v7h-2v2h-7v-2h-2v-7h2z`, 'accent')).join('')}<g class="tf-pixel-pupils">${[left, right].map(x => rect(x + 2, y + 2, 4, 7, 'ink') + rect(x + 1, y + 1, 3, 3, 'light')).join('')}</g></g>
      <g class="tf-pixel-eyes tf-pixel-eyes-happy">${[left, right].map(x => path(`M${x - 1} ${y + 6}h2v-3h5v3h2v2h-2v-1h-5v1h-2z`, 'light')).join('')}</g>
      <g class="tf-pixel-eyes tf-pixel-eyes-sleep">${[left, right].map(x => rect(x - 1, y + 7, 9, 2, 'light')).join('')}</g>`;
}

function mammal(kind, baby) {
    const cat = kind === 'cat', rabbit = kind === 'rabbit', fox = kind === 'fox';
    const left = baby ? 21 : 23, right = baby ? 38 : 37, eyeY = baby ? 31 : 26;
    let back = '', ears = '';
    if (cat) {
        back = group('tf-pixel-tail', solid(baby ? 'M43 45h8v-8h5v14h-4v4H41z' : 'M42 39h10V26h5v-7h4v12h-3v17h-7v5h-9z'));
        ears = group('tf-cat-ear is-left', solid(baby ? 'M16 28V17h6l7 11z' : 'M20 22V9h5l6 13z'))
            + group('tf-cat-ear is-right', solid(baby ? 'M36 28l7-11h6v11z' : 'M34 22l6-13h5v13z'));
        ears += path(baby ? 'M19 22h3l4 6h-7zM40 28l4-6h2v6z' : 'M23 14h2l3 7h-5zM37 21l5-7v7z', 'body-shadow');
    } else if (rabbit) {
        back = group('tf-pixel-tail', solid(baby ? 'M43 45h8v9h-8z' : 'M45 44h9v4h3v7H45z'));
        ears = group('tf-pixel-ears', group('tf-rabbit-ear is-left', solid(baby ? 'M20 27V13h8v14z' : 'M18 22V4h7v18z') + path(baby ? 'M23 16h2v10h-2z' : 'M21 7h2v13h-2z', 'accent'))
            + group('tf-rabbit-ear is-right', solid(baby ? 'M37 27V13h8v14z' : 'M39 22V4h7v18z') + path(baby ? 'M40 16h2v10h-2z' : 'M42 7h2v13h-2z', 'accent')));
    } else {
        back = group('tf-pixel-tail', solid(baby ? 'M42 43h6v-7h9v6h3v10h-7v5H40z' : 'M41 35h7v-8h6v-7h6v6h3v17h-5v10H40z')
            + path(baby ? 'M49 37h7v5h3v5h-10z' : 'M55 22h5v5h2v9h-7v-4h-3v-5h3z', 'light'));
        ears = group('tf-pixel-ears', group('tf-fox-ear is-left', solid(baby ? 'M15 29V14h7l9 15z' : 'M18 23V5h6l9 18z'))
            + group('tf-fox-ear is-right', solid(baby ? 'M34 29l9-15h7v15z' : 'M33 23l9-18h6v18z')));
        ears += path(baby ? 'M19 20h3l5 8h-8zM38 28l6-8h2v8z' : 'M22 12h2l4 10h-6zM38 22l6-10v10z', 'accent');
    }
    const torso = solid(baby ? 'M25 43h16v3h5v10h-4v4H22v-4h-3V46h6z' : 'M25 33h15v4h6v18h-4v6H23v-6h-5V39h7z');
    const paws = group(rabbit ? 'tf-pixel-paws' : 'tf-pixel-legs', path(baby ? 'M19 54h11v6H17v-4h2zM35 54h11v2h2v4H35z' : 'M20 51h9v9H17v-5h3zM36 51h9v4h3v5H36z', cat ? 'body-shadow' : 'accent')
        + rect(21, 57, 6, 2, 'light') + rect(37, 57, 6, 2, 'light'));
    const head = solid(baby ? 'M23 22h19v3h8v5h4v14h-4v5h-8v4H22v-4h-8v-5h-3V30h4v-5h8z' : 'M25 17h15v3h7v5h4v13h-4v5h-8v4H26v-4h-8v-5h-3V25h4v-5h6z');
    const muzzle = fox ? path(baby ? 'M16 39h11v4h11v-4h11v8h-9v5H24v-5h-8z' : 'M19 34h9v5h9v-5h10v8h-9v4H27v-4h-8z', 'light') : '';
    const nose = rect(30, baby ? 43 : 37, 5, 3, cat || rabbit ? 'mouth-tongue' : 'ink');
    return { back, body: torso + ears + head + muzzle + paws + nose + (rabbit ? cheeks(16, 46, baby ? 42 : 36) : ''),
        eyes: { left, right, y: eyeY, rabbit: !cat }, eyesMarkup: cat ? kittenEyes(left - 1, right - 1, eyeY - 1) : '', faces: faces(32, baby ? 47 : 41, cat),
        fit: { cx: 32, top: baby ? 23 : 18, width: baby ? 38 : 32, neck: baby ? 52 : 47, left, right, eyeY, bagX: baby ? 44 : 43, bagY: baby ? 48 : 46 } };
}

function frog(baby) {
    return baby ? {
        back: group('tf-pixel-tail tf-growth-swim-tail', solid('M39 39h8v-4h7v-7h6v15h-5v6h-8v4H36z') + path('M47 40h6v-5h3v7h-5v5h-6z', 'light')),
        body: solid('M22 27h14v3h7v5h3v13h-4v5h-8v3H21v-3h-7v-5h-3V36h4v-5h7z') + path('M17 45h22v7H20v-3h-3z', 'light') + cheeks(14, 37, 44),
        eyes: { left: 20, right: 32, y: 36 }, faces: faces(28, 47), fit: { cx: 28, top: 27, width: 30, neck: 52, left: 20, right: 32, eyeY: 36, bagX: 39, bagY: 46 },
    } : {
        back: group('tf-pixel-tail', path('M42 43h9v-5h6v7h-5v6H41z', 'body-shadow')),
        body: group('tf-pixel-legs', solid('M13 43h10v8h-5v5H9v-5h4zM42 43h10v8h4v5H45v-5h-3z'))
            + solid('M19 29v-9h10v5h7v-5h10v9h5v16h-6v7H20v-7h-5V29z')
            + path('M22 39h21v5h3v5H19v-5h3zM22 22h5v8h-5zM38 22h5v8h-5z', 'light') + cheeks(18, 44, 35),
        eyes: { left: 22, right: 38, y: 25 }, faces: faces(33, 38), fit: { cx: 33, top: 22, width: 34, neck: 45, left: 22, right: 38, eyeY: 25, bagX: 43, bagY: 44 },
    };
}

function penguin(baby) {
    return { back: '', body: group('tf-pixel-wings', group('tf-penguin-wing is-left', solid(baby ? 'M15 38h7v14h-7z' : 'M13 29h8v22h-8v-5h-3V34h3z'))
            + group('tf-penguin-wing is-right', solid(baby ? 'M43 38h7v14h-7z' : 'M44 29h8v5h3v12h-3v5h-8z')))
            + solid(baby ? 'M26 20h13v4h7v7h3v20h-5v6H21v-6h-5V32h3v-8h7z' : 'M25 12h15v4h6v9h4v24h-4v8H20v-8h-4V26h3V16h6z')
            + path(baby ? 'M26 17h4v6h4v-6h4v9H24z' : 'M26 12h13v4H26z', 'body-shadow')
            + path(baby ? 'M22 29h9v3h3v-3h9v11h-8v4h-5v-4h-8zM26 44h13v9H26z' : 'M22 23h9v3h3v-3h10v13h-7v3h-8v-3h-7zM25 39h15v4h4v10H21V43h4z', 'light')
            + group('tf-pixel-legs', path(baby ? 'M22 54h9v5H18v-3h4zM35 54h9v2h4v3H35z' : 'M21 54h10v6H16v-3h5zM35 54h10v3h5v3H35z', 'accent')),
        eyes: { left: 24, right: 37, y: baby ? 31 : 26 }, faces: { default: path(`M29 ${baby ? 40 : 35}h8v3h-2v2h-4v-2h-2z`, 'accent'), feed: path(`M28 ${baby ? 39 : 34}h10v6H28z`, 'accent') + rect(30, baby ? 41 : 36, 6, 2, 'ink'), sleep: rect(29, baby ? 41 : 36, 8, 2, 'accent') },
        fit: { cx: 33, top: baby ? 22 : 14, width: 30, neck: baby ? 46 : 41, left: 24, right: 37, eyeY: baby ? 31 : 26, bagX: 43, bagY: 47 } };
}

function octopus(baby) {
    const arms = baby ? ['M19 45h7v9h-7v-4h-4v-4z', 'M29 45h7v12h-7z', 'M39 45h7v2h4v6h-4v3h-7z']
        : ['M13 40h10v5h-4v7h-8v-5H7v-5h6z', 'M24 43h8v13h-9v-4h-4v-5h5z', 'M34 43h8v5h4v8H34z', 'M44 40h8v4h6v8h-9v-5h-5z'];
    return { back: '', body: group('tf-pixel-tentacles', arms.map((d, i) => group(`tf-octopus-arm ${['is-front-left', 'is-front-mid', 'is-front-right', 'is-right'][i]}`, solid(d))).join(''))
        + solid(baby ? 'M25 23h15v3h7v6h4v14h-7v5H22v-5h-8V32h4v-6h7z' : 'M23 14h19v4h7v7h4v16h-6v6H19v-6h-7V25h4v-7h7z')
        + path(baby ? 'M23 28h5v3h-4v7h-4v-6h3z' : 'M21 20h7v3h-5v9h-4v-9h2z', 'light') + cheeks(19, 43, baby ? 43 : 37),
        eyes: { left: baby ? 22 : 21, right: 36, y: baby ? 33 : 27, octopus: true }, faces: faces(33, baby ? 46 : 40),
        fit: { cx: 33, top: baby ? 25 : 16, width: 32, neck: baby ? 49 : 45, left: baby ? 22 : 21, right: 36, eyeY: baby ? 33 : 27, bagX: 43, bagY: 45 } };
}

function fish(baby) {
    return { back: group('tf-pixel-tail tf-betta-tail', solid(baby ? 'M37 36h8v-5h9v19h-9v-5h-8z' : 'M39 29h8v-7h6v-7h7v33h-7v-7h-6v-5h-8z')
            + path(baby ? 'M46 35h5v11h-5z' : 'M50 24h6v18h-4v-6h-5v-7h3z', 'accent')),
        body: group('tf-pixel-fins', group('tf-betta-fin is-dorsal', path(baby ? 'M25 34v-6h10v6z' : 'M24 28V16h5v-5h4v6h6v11z', 'accent'))
            + group('tf-betta-fin is-ventral', path(baby ? 'M25 47h9v7h-9z' : 'M25 42h15v7h-5v6h-5v-7h-5z', 'accent')))
            + solid(baby ? 'M20 32h15v3h6v13h-6v4H20v-4h-6V36h6z' : 'M18 25h16v3h8v6h3v9h-6v5H18v-4h-7V31h7z')
            + path(baby ? 'M20 36h5v11h-5z' : 'M18 29h5v12h-5z', 'light')
            + group('tf-betta-fin is-pectoral', path(baby ? 'M31 40h7v7h-7z' : 'M29 35h9v9h-9z', 'accent')),
        eyes: { left: baby ? 19 : 16, right: 0, y: baby ? 36 : 30, fish: true }, faces: { default: rect(baby ? 13 : 10, baby ? 44 : 39, 5, 2, 'ink'), feed: rect(baby ? 12 : 9, baby ? 43 : 38, 6, 5, 'ink'), sleep: rect(baby ? 13 : 10, baby ? 45 : 40, 5, 2, 'ink') },
        fit: { cx: 27, top: baby ? 32 : 25, width: 26, neck: baby ? 47 : 43, left: baby ? 19 : 16, right: 0, eyeY: baby ? 36 : 30, bagX: 32, bagY: 44, single: true } };
}

function bird(baby) {
    return { back: group('tf-pixel-tail', solid(baby ? 'M22 43H11v8h14z' : 'M24 37H8v6H3v6h22z') + rect(baby ? 13 : 7, baby ? 46 : 40, 9, 2, 'accent')),
        body: group('tf-pixel-antenna', rect(39, baby ? 19 : 9, 3, 9, 'accent') + rect(37, baby ? 18 : 7, 7, 4, 'light'))
            + solid(baby ? 'M24 35h18v3h7v15h-6v5H23v-5h-7V41h8z' : 'M21 28h23v5h7v18h-8v6H21v-6h-8V35h8z')
            + solid(baby ? 'M35 26h13v4h5v14h-5v4H33v-5h-4V31h6z' : 'M37 17h13v4h6v16h-6v5H35v-5h-4V23h6z')
            + path(baby ? 'M51 36h8v7h-8z' : 'M54 28h8v8h-8z', 'accent')
            + group('tf-pixel-wings', group('tf-robo-wing is-left', path(baby ? 'M22 42h12v11H22z' : 'M19 35h17v5h4v8H19z', 'light') + rect(25, baby ? 45 : 39, 5, 5, 'accent')))
            + group('tf-pixel-legs', path(baby ? 'M25 55h4v5h-7v-2h3zM39 55h4v3h4v2h-8z' : 'M24 53h4v7h-9v-3h5zM40 53h4v4h5v3h-9z', 'accent')),
        eyes: { left: baby ? 38 : 41, right: 0, y: baby ? 32 : 24, bird: true }, faces: { default: rect(baby ? 52 : 56, baby ? 40 : 33, 4, 1, 'ink'), feed: rect(baby ? 52 : 56, baby ? 38 : 31, 5, 4, 'ink'), sleep: rect(baby ? 52 : 56, baby ? 40 : 33, 4, 1, 'ink') },
        fit: { cx: 42, top: baby ? 26 : 17, width: 24, neck: baby ? 47 : 42, left: baby ? 38 : 41, right: 0, eyeY: baby ? 32 : 24, bagX: 20, bagY: 43, single: true } };
}

function spirit(baby, soot) {
    return { back: '', body: group('tf-pixel-arms', path(baby ? 'M17 40h-5v9h6zM47 40h5v9h-6z' : 'M14 35H6v12h8zM49 35h8v12h-8z', 'body-shadow'))
        + solid(baby ? 'M25 24h14v4h7v6h4v15h-5v6H20v-6h-5V34h4v-6h6z' : 'M24 15h17v4h7v7h6v21h-6v9H18v-9h-7V26h6v-7h7z')
        + (soot ? path(baby ? 'M23 21h5v7h-5zM39 22h4v8h-4zM16 46h5v8h-5zM43 48h6v7h-6z' : 'M23 10h5v10h-5zM37 11h5v10h-5zM12 25h8v6h-8zM45 21h9v7h-9zM18 51h7v9h-7zM40 50h7v10h-7z') : path(baby ? 'M22 45h20v7H22z' : 'M21 40h23v12H21z', 'light')),
        eyes: { left: baby ? 22 : 19, right: baby ? 35 : 37, y: baby ? 34 : 27, soot }, faces: faces(33, baby ? 48 : 43, soot),
        fit: { cx: 33, top: baby ? 26 : 17, width: 32, neck: baby ? 51 : 49, left: baby ? 22 : 19, right: baby ? 35 : 37, eyeY: baby ? 34 : 27, bagX: 44, bagY: 47 } };
}

export function getCompanionGrowthArt(kind, stage) {
    if (!['baby', 'young'].includes(stage)) return null;
    const baby = stage === 'baby';
    if (['cat', 'rabbit', 'fox'].includes(kind)) return mammal(kind, baby);
    if (kind === 'frog') return frog(baby);
    if (kind === 'penguin') return penguin(baby);
    if (kind === 'octopus') return octopus(baby);
    if (kind === 'goldfish') return fish(baby);
    if (kind === 'robo-bird') return bird(baby);
    return spirit(baby, kind === 'soot');
}
