// Shared 320 × 240 pixel scenery. Interactive crops, resources and the pet are
// drawn by the caller so their hit areas and saved world state stay in sync.
const r = (x, y, width, height, fill, extra = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const g = (x, y, html, extra = '') => `<g transform="translate(${x} ${y})" ${extra}>${html}</g>`;

function tuft(x, y, color = '#739460') {
    return g(x, y, p('M0 6V3H1V5H3V0H4V5H6V2H7V6Z', color) + r(4, 3, 1, 2, '#c7d795'));
}

function flower(x, y, color = '#e8afa0') {
    return g(x, y, p('M2 10V4H3V8H5V6H6V9H3V10Z', '#688b59') + p('M1 0H4V1H5V4H4V5H1V4H0V1H1Z', color) + r(2, 2, 1, 1, '#fff0b5'));
}

function stone(x, y, size = 1) {
    return g(x, y, `<g transform="scale(${size})">` + p('M0 5H2V2H5V0H11V2H15V5H17V8H1V7H0Z', '#859989') + p('M2 4H5V1H10V3H14V5H9V6H2Z', '#c8ceac') + r(5, 2, 4, 1, '#e5dfb8') + r(2, 8, 14, 1, '#6c8770', 'opacity=".28"') + '</g>');
}

function fern(x, y, color = '#699361') {
    return g(x, y, p('M9 18V6H10V18ZM8 14H4V11H1V9H5V11H8ZM11 14H15V11H18V9H14V11H11ZM8 10H5V7H3V5H6V7H8ZM11 10H14V7H16V5H13V7H11ZM8 6H6V3H5V1H8ZM11 6H13V3H14V1H11Z', color) + r(9, 3, 1, 3, '#b8ca83') + r(5, 8, 2, 1, '#9db671') + r(12, 12, 2, 1, '#a8bc7a'));
}

function leaf(x, y, fill = '#c9b778') {
    return g(x, y, p('M0 2H2V0H6V1H7V3H4V4H1V3H0Z', fill) + r(3, 2, 4, 1, '#a29d65'));
}

function shrub(x, y, width = 34, berries = false) {
    return g(x, y, `<g transform="scale(${width / 34} 1)">` + p('M0 18V10H3V5H9V2H17V0H25V4H30V8H34V19H30V22H5V20Z', '#547d56') + p('M2 10H5V5H11V3H17V2H24V6H30V10H32V17H26V19H5V16H2Z', '#829f62') + p('M5 8H10V5H17V4H22V7H16V9H11V13H5Z', '#b1c67b') + p('M17 13H23V9H30V12H25V16H17Z', '#96b46e') + r(10, 5, 4, 1, '#d0da94') + r(3, 15, 3, 1, '#a6bf77') + r(17, 18, 4, 1, '#456e50') + (berries ? [[7, 12], [16, 8], [24, 14]].map(([bx, by]) => r(bx, by, 3, 3, '#cc927a') + r(bx, by, 1, 1, '#f0c095')).join('') : '') + '</g>');
}

function broadleaf(x, y, scale = 1, variant = 0) {
    const hi = variant === 1 ? '#b5c77b' : variant === 2 ? '#c3cb82' : '#bdcd82';
    const mid = variant === 2 ? '#8ba268' : '#83a268';
    return g(x, y, `<g transform="scale(${scale})">` +
        p('M9 76H41V79H50V81H45V83H13V81H3V79H9Z', '#4b7656', 'opacity=".2"') +
        p('M25 35H35V64H39V72H44V76H31V72H27V78H18V75H22V69H25Z', '#6f6648') +
        p('M26 40H31V63H29V72H24V74H23V71H26Z', '#b38a57') + r(27, 44, 2, 19, '#d3ac70') +
        p('M27 58L16 46L18 43L29 52ZM32 51L44 41L46 43L34 57Z', '#8d7850') +
        r(31, 59, 1, 10, '#544f3b') + r(29, 67, 1, 5, '#d3ab70') + r(26, 73, 3, 1, '#d0a66c') +
        p('M15 0H36V3H44V8H51V14H56V24H60V38H56V46H48V51H38V55H22V53H13V49H5V43H0V30H3V18H7V9H15Z', '#426d51') +
        p('M15 2H35V5H43V10H50V17H55V27H57V38H52V45H43V49H24V47H15V43H7V36H4V24H8V13H15Z', mid) +
        p('M16 3H32V6H39V10H43V16H35V20H24V16H14V21H7V15H11V10H16Z', hi) +
        p('M16 3H29V5H24V7H17V10H12V12H9V10H15Z', '#d7dfa0') +
        p('M8 24H16V20H24V24H30V31H25V37H16V40H9V35H5V29H8Z', '#9fba75') +
        p('M8 25H14V22H20V24H17V28H10V31H6V28H8Z', '#c0d18b') +
        p('M34 21H43V18H49V23H54V29H53V35H48V39H36V37H28V31H31V25H34Z', '#628b58') +
        p('M35 21H42V20H46V23H49V28H43V31H35V29H30V26H35Z', '#a3bd75') +
        p('M22 40H30V36H35V38H41V42H47V44H43V48H28V46H20Z', '#739759') +
        [[17, 8, 5], [29, 11, 4], [11, 18, 3], [8, 30, 4], [20, 27, 4], [37, 24, 4], [47, 30, 3], [30, 42, 5]].map(([lx, ly, w], i) => r(lx, ly, w, 1, i % 2 ? '#c4d18b' : '#d5dfa1') + r(lx + w - 1, ly + 1, 2, 1, '#94b06b')).join('') +
        p('M15 44H20V46H27V48H24V50H18V48H13V45ZM43 40H47V37H51V40H49V43H43Z', '#436f4e') + '</g>');
}

function birch(x, y, height = 78, faded = false) {
    return g(x, y, r(0, 0, 8, height, faded ? '#a5b592' : '#bfb998') + r(0, 0, 5, height, faded ? '#c1ccb0' : '#eee1b8') + r(1, 0, 1, height, faded ? '#d2d8b7' : '#fcf0c9') +
        [[8, 0], [20, 4], [34, 1], [47, 5], [62, 0]].filter(([py]) => py < height).map(([py, px]) => r(px, py, 8 - px, 1, faded ? '#9bad8a' : '#9b9d79') + r(px, py + 1, 3, 1, faded ? '#aebd99' : '#6f8265')).join('') +
        p('M1 28L-7 18L-6 16L3 24ZM6 41L15 28L17 28L8 44Z', faded ? '#afbd98' : '#c4bb95') + r(-2, height, 13, 2, '#74906a', 'opacity=".2"'));
}

function sign(x, y, left = false) {
    return g(x, y, r(-8, 20, 18, 2, '#587e59', 'opacity=".2"') + r(-2, 1, 4, 20, '#947650') + r(-2, 2, 1, 18, '#c9a06b') + p(left ? 'M-17 -6H16V6H-17L-23 0Z' : 'M-16 -6H17L23 0L17 6H-16Z', '#987951') + p(left ? 'M-17 -6H16V3H-17L-22 -1Z' : 'M-16 -6H17L22 -1L17 3H-16Z', '#d9b982') + r(left ? -15 : -14, -5, 28, 1, '#f4dba4') + p(left ? 'M-12 -1L-8 -4V-2H9V0H-8V2Z' : 'M12 -1L8 -4V-2H-9V0H8V2Z', '#657b53') + r(left ? 12 : -13, -1, 1, 1, '#91744e'));
}

function pot(x, y, plant = true, color = '#bd8862') {
    return g(x, y, r(1, 10, 13, 2, '#6c815a', 'opacity=".2"') + p('M0 0H14V3H13V8H11V11H3V9H1V3H0Z', color) + r(0, 0, 14, 2, '#e3b182') + r(2, 3, 2, 6, '#db9f72') + r(4, -1, 6, 1, '#6e6447') + (plant ? p('M6 1V-9H8V1ZM6 -3H2V-5H0V-8H4V-6H6ZM8 -5H12V-8H14V-11H10V-8H8ZM6 -8H3V-12H5V-14H8V-10H6Z', '#658b53') + r(3, -7, 2, 1, '#b0c775') + r(10, -10, 2, 1, '#bace80') : ''));
}

function fence(x, y, count, gap = 16) {
    return g(x, y, r(0, 13, count * gap, 3, '#987d54') + r(0, 13, count * gap, 1, '#f1d9a4') + r(0, 26, count * gap, 3, '#a0875e') +
        Array.from({ length: count }, (_, i) => g(i * gap, 0, p('M2 3H4V1H6V3H8V36H1V3Z', '#d0ae77') + r(2, 4, 4, 30, '#ead09a') + r(2, 4, 1, 27, '#f7e7b8') + r(7, 6, 1, 28, '#ad8b5a') + r(4, 14, 1, 1, '#9e8059') + r(4, 26, 1, 1, '#9e8059') + r(3, 30, 2, 1, '#c5a56f'))).join(''));
}

function garden() {
    let art = r(0, 0, 320, 240, '#b9cc91') + r(0, 0, 320, 57, '#e2e7c2') +
        p('M0 37H24V32H61V38H85V34H122V45H188V31H224V35H262V28H291V35H320V72H0Z', '#c4d3a4') +
        p('M0 57H38V49H62V53H89V66H121V59H202V57H228V48H254V54H285V45H320V82H0Z', '#8faa73') +
        p('M0 71H320V82H0Z', '#98b279') + r(0, 81, 320, 3, '#aabd87') +
        // Broad, clear paths give the little beds breathing room.
        p('M0 145H320V164H0ZM107 83H119V240H107ZM202 83H214V240H202Z', '#dcd0a3') +
        r(0, 163, 320, 2, '#aab18a') + r(0, 145, 320, 1, '#e8deb3') +
        [[107, 89, 52], [202, 86, 58], [107, 167, 61], [202, 168, 67]].map(([x, y, h]) => r(x, y, 1, h, '#9fb080') + r(x + 11, y, 1, h, '#eee2b7')).join('') +
        p('M21 84H82V88H99V98H87V102H33V97H20ZM229 87H291V91H303V98H285V101H230Z', '#a5bd81') +
        // Fence and a small potting shed anchor the rear of the garden.
        fence(0, 47, 7) + fence(218, 47, 7) +
        r(117, 73, 93, 6, '#718b60', 'opacity=".25"') + r(120, 33, 82, 40, '#a68159') + r(123, 35, 76, 38, '#dfbc83') +
        [41, 49, 57, 65].map(y => r(123, y, 75, 1, '#c39d68') + r(124, y + 1, 73, 1, '#eed3a0')).join('') +
        p('M112 35H209V40H112ZM120 29H202V35H120ZM131 22H191V29H131ZM143 16H179V22H143Z', '#7f7152') +
        [[143, 16, 36], [131, 22, 60], [120, 29, 82], [112, 35, 97]].map(([x, y, w]) => r(x, y, w, 2, '#c19c6b') + r(x + 1, y + 2, w - 2, 1, '#d9b986') + Array.from({ length: Math.floor(w / 10) }, (_, i) => r(x + i * 10 + 5, y + 3, 1, 2, '#968060')).join('')).join('') +
        r(151, 42, 24, 31, '#92744f') + r(153, 43, 20, 29, '#f0d4a0') + r(155, 46, 16, 12, '#658c81') + r(156, 47, 14, 10, '#a8cbb0') + p('M156 47H164L156 55Z', '#e1edd0') + r(162, 46, 2, 12, '#eedbb2') + r(155, 51, 16, 1, '#eedbb2') + r(155, 61, 16, 8, '#d6b781') + r(155, 61, 16, 1, '#b28a5e') + r(168, 61, 2, 3, '#9a8759') +
        r(126, 44, 18, 17, '#9b855b') + r(127, 45, 16, 14, '#a3b894') + r(128, 46, 14, 12, '#c8dbc0') + r(134, 45, 2, 14, '#eddcb3') + r(127, 51, 16, 2, '#eddcb3') + r(125, 60, 20, 3, '#b58d5d') + r(125, 60, 20, 1, '#efd1a0') +
        r(150, 73, 27, 3, '#e8d3a3') + r(150, 76, 27, 1, '#a9976b') + r(154, 79, 21, 7, '#c7ba8d') + r(155, 79, 19, 1, '#eee3bb') +
        // Leaning garden tools, water barrel and terracotta herb pots.
        g(183, 51, p('M0 21L5 0H7L2 22Z', '#aa8955') + p('M4 20H12V25H10V29H6V25H4Z', '#7f9480') + r(5, 21, 2, 4, '#c4ccb0') + r(13, 3, 2, 26, '#bc945f') + p('M9 0H19V2H17V7H16V2H14V7H13V2H11V7H10V2H9Z', '#829782')) +
        g(229, 59, r(0, 2, 19, 22, '#947955') + r(1, 3, 17, 18, '#ba9666') + r(2, 3, 2, 18, '#d5b37c') + r(7, 4, 1, 17, '#8d7551') + r(13, 4, 1, 17, '#8d7551') + r(0, 6, 19, 2, '#6f8474') + r(0, 18, 19, 2, '#6f8474') + r(2, 0, 15, 4, '#89aa97') + r(4, 1, 10, 1, '#dce5bc') + r(18, 12, 5, 3, '#ad9868') + r(22, 14, 2, 2, '#d9bb82')) +
        pot(82, 72) + pot(95, 77, true, '#c99b71') + pot(255, 77) +
        g(53, 57, r(0, 4, 21, 18, '#829e78') + r(2, 5, 16, 14, '#9fba91') + r(3, 6, 4, 10, '#c2d0a5') + p('M18 11L27 7V10L20 16Z', '#8daa85') + p('M3 3V-1H17V4H15V1H5V3Z', '#708d6b') + r(4, 4, 13, 2, '#d2dab0')) +
        broadleaf(-25, -29, 1.18, 0) + broadleaf(279, -30, 1.2, 1);
    // Flowers frame the beds; small clusters leave their centres uncluttered.
    art += [[9, 93], [20, 88], [299, 93], [290, 85], [6, 224], [304, 225], [22, 231], [294, 231]].map(([x, y], i) => flower(x, y, i % 2 ? '#e6b3aa' : '#f0d386') + tuft(x + 5, y + 6)).join('') +
        [[7, 109], [15, 130], [99, 112], [222, 101], [306, 130], [18, 189], [98, 204], [222, 187], [306, 208], [74, 231], [234, 230]].map(([x, y]) => tuft(x, y)).join('') +
        [[128, 94], [193, 178], [20, 218], [289, 215]].map(([x, y]) => leaf(x, y)).join('') +
        [[18, 150], [41, 155], [90, 151], [121, 156], [178, 150], [246, 155], [281, 151], [109, 105], [110, 181], [204, 117], [205, 220]].map(([x, y]) => r(x, y, 4, 1, '#bcb48a') + r(x + 4, y + 2, 3, 1, '#f0e4bb')).join('') +
        sign(16, 145, true) + sign(304, 145) +
        // A loose stepping stone and flower shadow finish the front border.
        r(126, 234, 67, 3, '#aabc87') + r(133, 237, 56, 2, '#96ac77') + stone(147, 226, .7) + flower(186, 227, '#edc390');
    return art;
}

function woodland() {
    let art = r(0, 0, 320, 240, '#a8c28c') + r(0, 0, 320, 89, '#cfdfb5') +
        p('M0 8H33V0H72V16H103V4H128V21H182V8H208V0H244V14H280V4H320V71H0Z', '#b6cea4') +
        [birch(84, 0, 68, true), birch(114, 7, 55, true), birch(175, 0, 66, true), birch(217, 9, 61, true)].join('') +
        p('M0 57H40V53H75V62H103V57H121V69H176V58H201V52H235V58H275V47H320V105H0Z', '#8baa78') +
        p('M0 87H34V95H56V103H29V113H0ZM253 84H290V77H320V115H300V123H279V111H253Z', '#7c9f6c') +
        // An S-shaped clearing is bounded by moss, not a hard square path.
        p('M127 64H173V79H187V97H194V121H184V151H177V167H183V181H194V203H183V223H204V240H119V222H128V204H118V182H109V159H116V134H119V111H111V89H121V74H127Z', '#bfca98') +
        p('M132 66H165V83H178V102H180V121H171V146H163V164H170V187H182V205H170V224H189V240H133V219H143V200H133V181H126V160H133V132H134V113H125V93H132Z', '#dfd4a7') +
        p('M137 76H152V92H162V111H150V142H145V165H149V183H159V204H153V225H163V240H144V221H150V202H140V181H136V160H141V131H142V112H134V94H137Z', '#e9dfb4') +
        // Dappled pools of warm light break up the mossy floor.
        p('M82 96H105V109H122V123H113V132H81V121H63V107H82ZM195 98H218V109H236V123H224V131H194V122H184V109H195ZM19 175H37V182H48V197H32V204H12V192H19Z', '#bdcd8e') +
        [shrub(-10, 87, 49), shrub(42, 67, 34), shrub(94, 53, 31), shrub(187, 58, 39), shrub(262, 87, 51)].join('') +
        broadleaf(-16, -15, 1.4, 0) + broadleaf(39, -36, 1.18, 1) + broadleaf(117, -54, 1.16, 2) + broadleaf(202, -39, 1.18, 0) + broadleaf(272, -12, 1.4, 1) +
        birch(91, 14, 65) + birch(249, 17, 68) +
        // A resting bench, trimmed with warm wood and a mossy stone foot.
        g(212, 70, r(-2, 27, 53, 3, '#51794f', 'opacity=".25"') + r(2, 2, 3, 24, '#7d714c') + r(43, 2, 3, 24, '#7d714c') + r(0, 1, 48, 6, '#b99462') + r(1, 1, 46, 1, '#e6c58c') + r(2, 4, 44, 1, '#a08457') + r(-2, 13, 52, 7, '#9d7e51') + r(-2, 13, 52, 2, '#d6b37a') + r(1, 16, 46, 1, '#bb9964') + r(3, 20, 4, 10, '#8d7450') + r(40, 20, 4, 10, '#8d7450') + r(5, 20, 1, 9, '#c0a06b') + r(12, 24, 28, 2, '#9c8356') + r(7, 9, 10, 1, '#74915f')) +
        // A stump with growth rings and tiny bracket mushrooms.
        g(71, 84, p('M1 7H20V20H17V23H3V20H1Z', '#89724d') + r(3, 9, 4, 11, '#ba9362') + r(8, 11, 1, 9, '#6a6447') + r(15, 9, 2, 11, '#a28257') + p('M0 4H3V1H17V3H21V8H17V10H4V8H0Z', '#d7b681') + p('M4 3H15V4H18V7H15V8H6V7H3V5H5V4H13V5H15V6H7V5H6V6H7V7H14V6H16V5H14V4H5V5H4Z', '#9d8656') + r(1, 14, 4, 2, '#d6bc8d') + r(0, 13, 6, 2, '#b78865')) +
        // Window-like sunbeams come through the canopy gap and fade into soil.
        p('M91 50H98L132 119H112Z', '#f3e6ac', 'opacity=".22"') + p('M106 48H111L144 119H133Z', '#fff0c5', 'opacity=".18"') + p('M235 62H241L264 107H251Z', '#f5e7b3', 'opacity=".17"');
    art += [[10, 119], [33, 102], [96, 127], [214, 129], [289, 109], [17, 207], [283, 206], [92, 227]].map(([x, y]) => fern(x, y)).join('') +
        [[39, 184], [110, 195], [204, 183], [286, 141], [13, 150], [300, 229], [207, 221], [58, 223]].map(([x, y]) => tuft(x, y)).join('') +
        [[109, 109], [184, 164], [107, 215], [227, 224]].map(([x, y], i) => stone(x, y, i % 2 ? .7 : .9)).join('') +
        [[17, 193], [27, 193], [294, 190], [288, 199], [234, 232]].map(([x, y], i) => flower(x, y, i % 2 ? '#dfbaa6' : '#ead493')).join('') +
        [[104, 116], [98, 166], [127, 171], [181, 130], [192, 213], [107, 228], [253, 205], [77, 208], [273, 120], [17, 234]].map(([x, y], i) => leaf(x, y, i % 3 ? '#c0b77a' : '#d7ba7e')).join('') +
        [[140, 103], [158, 133], [139, 187], [165, 217], [132, 233]].map(([x, y]) => r(x, y, 5, 1, '#bdb68c') + r(x + 9, y + 3, 3, 1, '#f2e7be')).join('') +
        // Bright-edged patches of moss sit around roots and stones.
        p('M7 96H24V98H33V101H27V104H11V102H4V99H7ZM268 106H286V108H292V111H277V113H267V110H261V108H268Z', '#97b775') +
        r(11, 97, 8, 1, '#c6d58d') + r(273, 108, 6, 1, '#c6d58d') + sign(16, 216, true) + sign(304, 216);
    return art;
}

function waterside() {
    let art = r(0, 0, 320, 240, '#b7ca96') + r(0, 0, 320, 58, '#dce6c9') +
        p('M43 10H50V7H62V5H71V8H82V11H43ZM184 7H193V4H206V6H216V9H184Z', '#eff0d6') +
        p('M0 24H23V18H53V27H88V18H117V25H153V13H183V19H222V25H250V17H284V24H320V66H0Z', '#bfd2b2') +
        p('M0 43H30V35H62V43H98V37H138V47H166V35H203V43H237V36H264V47H293V36H320V74H0Z', '#89b2a0') +
        p('M0 52H20V49H42V56H66V50H96V57H123V51H153V59H179V50H212V55H239V49H274V55H301V51H320V73H0Z', '#759d86') +
        // Small, hazy crowns break the distant bank into trees without competing
        // with the fishing spot. Their reflected shapes continue below the shore.
        [[-8, 37, 1], [24, 43, .85], [52, 36, 1.08], [91, 42, .88], [122, 39, .94], [158, 36, 1.06], [196, 41, .9], [232, 37, 1], [264, 42, .85]].map(([x, y, scale], i) =>
            g(x, y, `<g transform="scale(${scale})">` + r(17, 20, 3, 12, '#769581') +
                p('M8 1H22V4H28V8H32V15H30V20H24V23H9V21H3V16H0V10H4V5H8Z', i % 3 === 0 ? '#8caa8d' : '#81a68f') +
                p('M9 2H21V5H27V9H24V12H16V10H7V13H2V10H5V6H9Z', i % 3 === 0 ? '#b1c39c' : '#a4bda0') +
                p('M18 13H28V17H24V21H14V19H9V16H18Z', '#729e87') + r(10, 5, 6, 1, '#c0ceab') + r(22, 9, 4, 1, '#b1c6a6') + '</g>')
        ).join('') +
        p('M0 66H39V69H77V64H118V71H155V65H201V72H238V64H280V69H320V147H0Z', '#72aea5') +
        // Reflections follow the far tree line, while the shallows turn jade.
        p('M0 68H39V73H76V67H118V75H155V69H201V77H238V69H280V74H320V85H288V81H264V88H242V81H216V90H195V83H176V88H159V80H139V85H118V79H92V86H76V79H58V85H37V78H17V81H0Z', '#568f88', 'opacity=".65"') +
        p('M0 110H42V116H74V106H106V119H151V111H185V120H218V112H255V121H291V110H320V148H0Z', '#8fbeac') +
        p('M0 129H39V126H73V133H110V128H147V134H192V126H230V135H267V129H300V135H320V149H0Z', '#afceaf') +
        p('M0 139H38V134H75V140H109V137H146V141H189V136H230V141H268V137H300V141H320V147H299V145H267V142H229V146H190V142H146V147H111V143H74V146H38V141H0Z', '#ecdfb8') +
        p('M0 145H38V141H74V146H110V143H146V148H190V143H229V148H268V143H299V147H320V152H299V151H269V148H230V154H190V149H146V153H110V149H74V151H38V146H0Z', '#c7bd91') +
        // The near bank and paths keep every resource stand on dry land.
        p('M0 151H40V149H74V154H110V152H146V157H190V152H230V157H268V151H299V154H320V240H0Z', '#b9cc96') +
        r(0, 218, 320, 22, '#ded3a6') + r(0, 218, 320, 1, '#eee4b7') +
        p('M141 151H163V181H170V204H182V218H143V202H145V182H139Z', '#dad0a4') +
        p('M203 146H225V158H232V175H228V188H215V176H210V164H203Z', '#d3cca0') +
        // Ripples are thin and irregular, with reflected sunlight in short runs.
        `<g class="tf-scene-pond-ripple">${[[5, 87, 31], [40, 99, 20], [100, 87, 39], [161, 105, 24], [182, 91, 17], [264, 87, 32], [287, 113, 24], [66, 124, 24], [127, 122, 17], [5, 129, 29]].map(([x, y, w]) => r(x, y, w, 1, '#c9e1cc') + r(x + 6, y + 3, Math.max(6, w - 15), 1, '#aad6c1')).join('')}</g>` +
        [[52, 80, 9], [82, 103, 17], [113, 109, 22], [142, 94, 14], [188, 119, 8], [276, 102, 13], [304, 91, 8]].map(([x, y, w]) => r(x, y, w, 1, '#e0edd2') + r(x + 3, y - 2, 3, 1, '#bfdeca')).join('') +
        // Lily pads and a tiny pink blossom lend the river a lived-in rhythm.
        g(89, 112, p('M0 3H4V0H12V2H16V6H13V8H3V6H0Z', '#77a77d') + p('M3 2H10V4H8V7H3Z', '#b6ce91') + p('M7 1H9V6H8V4H7Z', '#70a69a') + r(-4, 9, 24, 1, '#badac1')) +
        g(164, 81, p('M0 3H4V1H13V3H17V6H14V8H4V6H0Z', '#8bb78b') + r(3, 2, 9, 1, '#c6d69d') + p('M6 0V-3H8V-5H10V-3H12V0H10V1H8V0Z', '#e9bbb0') + r(8, -1, 2, 1, '#fff0b8')) +
        // Short, connected fishing pier: the bottom end lands on the bank.
        p('M209 108H247V147H255V151H215V148H209Z', '#477f78', 'opacity=".35"') +
        r(210, 97, 35, 48, '#8a7654') +
        Array.from({ length: 8 }, (_, i) => g(208, 96 + i * 6, r(0, 0, 39, 5, i % 2 ? '#c2a476' : '#d0b386') + r(1, 0, 37, 1, '#edcf9a') + r(1, 4, 36, 1, '#a38960') + r(5 + i % 3 * 6, 2, 10, 1, '#ab9166') + r(3, 2, 1, 1, '#856f4f') + r(34, 2, 1, 1, '#856f4f'))).join('') +
        [208, 244].map(x => r(x, 89, 4, 16, '#8b7451') + r(x, 90, 2, 13, '#c7a371') + r(x - 1, 88, 6, 2, '#e4c895') + r(x, 102, 4, 1, '#637f69')).join('') +
        r(209, 143, 37, 3, '#e7c992') + r(210, 146, 35, 2, '#ad9163') + r(216, 148, 25, 3, '#dfd4a6') +
        // A wicker creel, rod rest and enamel bucket sit off the pet's approach.
        g(271, 119, p('M0 8H15V20H12V22H3V20H0Z', '#a98857') + r(1, 9, 13, 10, '#c6a673') + [11, 14, 17].map(y => r(2, y, 11, 1, '#947d50')).join('') + [4, 8, 12].map(x => r(x, 10, 1, 9, '#dcc08a')).join('') + r(0, 7, 15, 3, '#dcc08a') + p('M3 7V3H12V7H10V5H5V7Z', '#a38a5c') + r(17, 2, 2, 22, '#98794c') + p('M13 -4H15V0H21V-4H23V2H13Z', '#c09c69') + p('M15 13L24 -13L25 -12L17 15Z', '#826d4d') + r(23, -13, 1, 7, '#dde3bf')) +
        g(250, 139, p('M0 0H13V10H11V13H3V10H1Z', '#749c97') + r(1, 1, 11, 8, '#a7c5b1') + r(2, 2, 2, 7, '#d5e1c5') + r(0, 0, 13, 2, '#d4dbc0') + p('M1 1V-4H3V-6H10V-4H12V1H11V-3H9V-5H4V-3H2V1Z', '#8a9274')) +
        // A small willow on the far edge, reflected in the water below.
        broadleaf(272, -20, 1.06, 1) + r(299, 67, 3, 8, '#6d9b8b', 'opacity=".5"') + r(295, 78, 11, 1, '#63988c') +
        g(13, 117, r(0, -10, 1, 29, '#69875b') + r(7, -15, 1, 34, '#7a9664') + r(12, -4, 1, 23, '#739461') + r(-1, -15, 3, 8, '#a08758') + r(6, -20, 3, 9, '#b39761') + p('M0 9L-6 1H-4L1 7ZM7 12L15 0H16L8 15Z', '#95ac73'));
    art += stone(33, 141, .65) + stone(109, 143, .65) + stone(179, 138, .7) + stone(300, 144, .7) +
        [[2, 178], [291, 178], [106, 182], [210, 201], [45, 207], [302, 211]].map(([x, y]) => tuft(x, y)).join('') +
        [[19, 200], [29, 206], [282, 203], [275, 211], [94, 231]].map(([x, y], i) => flower(x, y, i % 2 ? '#e9c68c' : '#e7b0a1')).join('') +
        [[16, 152], [83, 143], [119, 158], [177, 149], [262, 150], [305, 159]].map(([x, y]) => r(x, y, 4, 1, '#e7ddb0') + r(x + 6, y + 3, 2, 1, '#9daa7c')).join('') +
        leaf(113, 205) + leaf(231, 231) + sign(16, 216, true) +
        [[50, 225], [86, 232], [183, 228], [274, 227]].map(([x, y]) => r(x, y, 6, 1, '#c5bb90') + r(x + 3, y + 3, 4, 1, '#f0e3b6')).join('');
    return art;
}

function jar(x, y, fill = '#c5a175', width = 8) {
    return g(x, y, r(1, 2, width - 2, 10, '#a2b39c') + r(2, 3, width - 4, 8, '#d6ddbb') + r(2, 6, width - 4, 5, fill) + r(2, 4, 1, 5, '#eef0d2') + r(0, 0, width, 3, '#b19162') + r(1, 0, width - 2, 1, '#e3c697') + r(3, 7, Math.max(2, width - 6), 3, '#eee2bd'));
}

function cabinet(x, y, width, height, drawer = false) {
    return g(x, y, r(0, 0, width, height, '#9b7852') + r(1, 1, width - 2, height - 2, '#c59a67') + r(2, 2, width - 4, 1, '#e5bd83') + r(2, 3, 1, height - 5, '#d6ad75') + r(4, 5, width - 8, height - 10, '#b28a59') + r(5, 6, width - 10, height - 12, '#cea371') + r(5, 6, width - 10, 1, '#ae8556') + r(5, height - 6, width - 10, 1, '#e2bb81') +
        (drawer ? r(Math.floor(width / 2) - 4, 7, 8, 2, '#7d7954') + r(Math.floor(width / 2) - 3, 7, 6, 1, '#e0ca8a') : r(width - 9, 11, 2, 5, '#7b7955') + r(width - 9, 11, 1, 4, '#e4c88b')) +
        r(7, height - 9, Math.max(4, Math.floor(width / 3)), 1, '#bc9261'));
}

function kitchen() {
    let art = r(0, 0, 320, 240, '#f0dfb8') + r(0, 0, 320, 17, '#e1cba0') + r(0, 0, 320, 3, '#ba9b71') + r(0, 3, 320, 1, '#f5e5bd') +
        // Hand-glazed backsplash: warm grout, alternating quiet cream tiles.
        r(0, 18, 320, 86, '#d5c9a6') +
        Array.from({ length: 5 }, (_, row) => Array.from({ length: 20 }, (_, col) => {
            const x = col * 18 - (row % 2 ? 9 : 0), y = 19 + row * 17;
            return r(x, y, 17, 16, (row + col) % 4 === 0 ? '#ece1c1' : '#f5e9cb') + r(x + 1, y + 1, 15, 1, '#fff2d5') + r(x + 16, y + 3, 1, 12, '#e0d4b3');
        }).join('')).join('') +
        r(0, 17, 320, 1, '#bba783') + r(0, 99, 320, 3, '#c2ad88') +
        // Soft perspective is carried by the floor boards and their joinery.
        r(0, 134, 320, 106, '#d9b585') +
        [[134, 15], [149, 18], [167, 21], [188, 24], [212, 28]].map(([y, h], row) => r(0, y, 320, h - 1, row % 2 ? '#dfbf90' : '#d7b285') + r(0, y + h - 1, 320, 1, '#b8956a') + r(0, y, 320, 1, '#efd2a3') + Array.from({ length: 6 }, (_, col) => {
            const x = col * 69 - (row % 2 ? 33 : 0);
            return r(x, y, 1, h - 1, '#bd996d') + r(x + 5, y + 5, 26, 1, '#c8a477') + r(x + 23, y + h - 5, 29, 1, '#e8c89b') + r(x + 42, y + 7, 9, 1, '#cba779');
        }).join('')).join('') +
        r(0, 131, 320, 4, '#a88a64') + r(0, 130, 320, 1, '#f1d5a3') +
        // Left open pantry: little jars, stacked bowls, basket and linen.
        r(14, 29, 67, 66, '#bd9c6e') + r(17, 31, 61, 61, '#a3845c') + r(19, 33, 57, 57, '#c7b08a') +
        [49, 72, 93].map(y => r(13, y, 70, 3, '#a77e50') + r(13, y, 70, 1, '#e8c28a') + r(17, y + 3, 62, 2, '#9c845f', 'opacity=".4"')).join('') +
        jar(24, 36, '#b1b887') + jar(37, 36, '#cd9a6d', 9) + jar(53, 36, '#b78b73', 9) + jar(66, 36, '#d7bf83', 7) +
        g(23, 60, p('M0 0H18V3H15V5H3V3H0Z', '#7d9b8d') + r(1, 0, 16, 1, '#e5e8c8') + p('M0 4H18V7H15V9H3V7H0Z', '#9bb7a0') + r(1, 4, 16, 1, '#e6e9ca') + r(2, 9, 14, 1, '#6d8879')) +
        g(51, 57, r(0, 0, 6, 12, '#e9dec0') + r(1, 1, 4, 1, '#fff2d4') + r(6, 3, 3, 1, '#e9dec0') + r(8, 4, 1, 4, '#e9dec0') + r(6, 8, 3, 1, '#e9dec0') + r(0, 10, 6, 2, '#b9b6a0') + r(15, 2, 6, 10, '#a5b894') + r(16, 3, 4, 1, '#cdd8b5')) +
        g(23, 79, r(0, 1, 29, 12, '#aa8557') + r(1, 2, 27, 9, '#cfaa74') + [4, 7, 10].map(y => r(1, y, 27, 1, '#9d7e52')).join('') + [5, 12, 19, 25].map(x => r(x, 2, 1, 9, '#e4c38c')).join('') + r(-1, 0, 31, 2, '#dfbf89')) +
        r(60, 79, 13, 11, '#e9dfc1') + r(61, 80, 11, 1, '#fff0d1') + r(62, 83, 2, 7, '#b4bc9a') + r(67, 82, 2, 8, '#b4bc9a') +
        // The window holds a garden view rather than a flat blue rectangle.
        r(91, 20, 87, 67, '#a2855e') + r(93, 22, 83, 62, '#d6b183') + r(98, 26, 73, 54, '#83b4ab') + r(99, 27, 71, 35, '#c5deca') +
        p('M99 47H109V43H123V48H136V40H151V47H171V66H99Z', '#9cb886') + p('M99 57H112V51H125V56H143V50H159V57H171V78H99Z', '#789b6c') +
        p('M102 32H112V30H123V32H132V34H102Z', '#eff0d1') + r(99, 65, 72, 2, '#d0c594') + r(102, 67, 4, 12, '#e3d19d') + r(121, 67, 4, 12, '#e3d19d') + r(148, 67, 4, 12, '#e3d19d') + r(166, 67, 4, 12, '#e3d19d') +
        r(132, 24, 5, 57, '#f2e0b9') + r(97, 50, 76, 4, '#f2e0b9') + r(132, 24, 1, 57, '#fff0d0') + r(97, 50, 76, 1, '#fff0d0') + r(96, 26, 2, 55, '#f7e7c2') +
        r(89, 83, 91, 5, '#ae865b') + r(89, 83, 91, 2, '#ecd0a3') + r(94, 88, 83, 3, '#bfa47c', 'opacity=".45"') +
        // Gingham curtains hang in short folds, preserving the visible view.
        r(86, 18, 97, 2, '#917a58') + r(85, 17, 3, 4, '#c5a474') + r(182, 17, 3, 4, '#c5a474') +
        p('M92 21H107V27H105V36H102V46H99V60H90V50H92Z', '#c3977f') + p('M94 21H107V26H104V36H101V46H98V58H91V49H94Z', '#e4bca1') +
        p('M162 21H177V50H179V60H170V46H167V36H164V27H162Z', '#d3a48a') + p('M162 21H174V48H177V58H171V45H169V34H165V26H162Z', '#edc7ac') +
        [27, 35, 43, 51].map(y => r(93, y, y > 43 ? 6 : 10, 2, '#f5dec0') + r(y > 43 ? 172 : 167, y, y > 43 ? 5 : 8, 2, '#f8e1c5')).join('') + r(96, 24, 2, 33, '#efd1b3') + r(171, 24, 2, 30, '#f6dac0') + r(89, 50, 12, 2, '#96794f') + r(169, 50, 12, 2, '#96794f') +
        // Hanging herbs and utensils give the work wall practical detail.
        r(186, 25, 25, 3, '#a2875c') + r(189, 28, 1, 8, '#806e4d') + r(201, 28, 1, 9, '#806e4d') +
        g(185, 35, p('M4 0H6V4H9V12H7V17H2V13H0V6H4Z', '#789560') + r(4, 4, 1, 9, '#acc079') + r(1, 7, 2, 2, '#9eb16f') + r(6, 10, 2, 2, '#4e764e')) +
        g(198, 36, p('M3 0H5V5H8V11H6V16H1V12H0V6H3Z', '#8b9f67') + r(3, 4, 1, 9, '#c0c587')) +
        r(248, 55, 49, 3, '#957d58') + r(250, 55, 45, 1, '#d7bb8d') +
        g(254, 57, r(1, 1, 1, 12, '#907e56') + p('M0 12H4V19H3V21H1V19H0Z', '#b3bbaa') + r(1, 13, 1, 5, '#d8dfc8')) +
        g(266, 57, r(2, 1, 2, 14, '#b69a6c') + p('M0 13H6V20H5V23H1V20H0Z', '#ba9d6f') + r(2, 16, 1, 4, '#dac393')) +
        g(280, 57, r(2, 1, 2, 11, '#899b8c') + p('M0 12H6V22H0Z', '#a4b5a4') + r(1, 14, 1, 6, '#dae0c4') + r(3, 14, 1, 6, '#dae0c4')) +
        // A cream cooker hood, with copper trim and warm task light.
        r(218, 19, 10, 21, '#cbb891') + r(219, 20, 8, 18, '#ead8b3') + p('M215 39H231V44H235V49H240V53H204V49H209V44H215Z', '#bba584') + p('M216 39H230V44H234V49H237V51H207V49H211V44H216Z', '#f1e0bb') + r(203, 52, 38, 4, '#a88b62') + r(204, 52, 36, 1, '#e8c795') + r(208, 56, 29, 2, '#7f765a') + r(215, 56, 14, 2, '#f5d991') + p('M212 58H233L244 94H197Z', '#fff0c3', 'opacity=".28"') +
        // Continuous counter, drawers, oven and sink cupboard.
        r(13, 102, 288, 35, '#8a7254') + r(15, 104, 284, 28, '#b59165') +
        cabinet(17, 106, 36, 27) + cabinet(55, 106, 38, 27) + cabinet(95, 106, 41, 13, true) + cabinet(95, 120, 41, 13, true) + cabinet(138, 106, 43, 27) +
        cabinet(244, 106, 25, 27) + cabinet(271, 106, 25, 27) + r(15, 135, 284, 4, '#9b7c54') + r(16, 135, 282, 1, '#d0a575') +
        r(184, 103, 57, 31, '#65776c') + r(186, 104, 53, 28, '#e2d5b1') + r(187, 105, 51, 7, '#f3e7c7') +
        [192, 204, 222, 234].map(x => r(x, 107, 3, 3, '#839180') + r(x, 107, 2, 1, '#c3c7a8')).join('') +
        r(191, 115, 42, 15, '#877d60') + r(192, 116, 40, 13, '#485d54') + r(194, 118, 36, 9, '#708577') + p('M195 119H218L211 125H195Z', '#9eae94') + r(195, 115, 34, 2, '#c7c3a1') + r(202, 131, 21, 1, '#b8ad8b') +
        r(10, 99, 294, 6, '#ac8e63') + r(10, 98, 294, 4, '#edd5a9') + r(12, 98, 290, 1, '#fff0c9') + r(13, 103, 288, 1, '#c5a16f') +
        // An inset sink and drying rack occupy the right end of the worktop.
        r(251, 94, 36, 7, '#7e9c92') + r(254, 95, 30, 4, '#a8c5b2') + r(256, 96, 27, 2, '#6d9b95') + r(255, 94, 28, 1, '#d5e0c4') +
        p('M266 93V81H269V79H274V81H276V86H273V82H270V94Z', '#8ba596') + r(267, 83, 1, 8, '#d8e2c8') + r(272, 80, 2, 1, '#e1e6cb') + r(261, 92, 3, 3, '#b8c6ad') +
        r(289, 94, 12, 5, '#bdab7d') + [290, 294, 298].map((x, i) => r(x, 86 + i % 2, 2, 10 - i % 2, '#a0b6a0') + r(x, 86 + i % 2, 1, 8, '#f1e9cc')).join('') + r(288, 95, 14, 1, '#e6cd9b') +
        // A cutting board, knife, vegetables and oil invite actual cooking.
        g(56, 88, r(-2, 10, 38, 2, '#b4976a') + r(0, 3, 33, 8, '#b18455') + r(1, 3, 31, 6, '#d9b17b') + r(1, 3, 31, 1, '#efd19a') + r(32, 5, 6, 3, '#cfaa72') + r(35, 6, 1, 1, '#916f4c') + p('M4 4L14 6L13 8L3 6Z', '#da9b63') + p('M4 4L1 1H4L6 4ZM5 3V0H7V4Z', '#7fa16a') + r(18, 2, 10, 2, '#b4c8b2') + r(18, 2, 1, 3, '#d6e2c7') + r(28, 2, 4, 2, '#846f4b') + r(18, 6, 3, 2, '#dfb77b') + r(23, 6, 3, 2, '#e9c58d')) +
        jar(36, 85, '#c6a56c', 9) + g(100, 81, r(2, 0, 5, 4, '#a38656') + r(2, 4, 5, 3, '#d3ca86') + p('M0 7H9V17H0Z', '#92a477') + r(1, 7, 2, 9, '#d0d6a3') + r(3, 10, 5, 5, '#ece1b5')) +
        g(115, 92, p('M0 0H18V3H16V6H13V8H5V6H2V3H0Z', '#7d9f91') + r(1, 0, 16, 1, '#edf0cf') + r(4, 2, 11, 2, '#b7cbbb') + p('M4 0V-4H7V-5H10V-3H13V0Z', '#8ea66d') + r(7, -3, 2, 2, '#c2d084')) +
        // Stove burner and a copper-bottomed enamel pot with lid and handles.
        r(187, 94, 52, 8, '#7f8c7c') + r(188, 94, 50, 2, '#bec7ac') + r(191, 97, 15, 2, '#586e61') + r(220, 97, 15, 2, '#586e61') +
        g(207, 80, r(0, 4, 22, 13, '#6d958d') + r(1, 5, 20, 10, '#a9c4b0') + r(2, 6, 3, 8, '#dce6c8') + r(1, 15, 20, 2, '#bc9969') + r(-4, 7, 5, 3, '#718879') + r(21, 7, 5, 3, '#718879') + p('M-1 3H3V1H18V3H23V5H-1Z', '#bfd1b9') + r(8, -1, 6, 3, '#9b8c65') + r(9, -1, 4, 1, '#d5be8c') + r(4, 2, 12, 1, '#e5ecd0'), 'class="tf-kitchen-stove-pot"') +
        // A linen apron and folded towels make the room feel occupied.
        g(145, 105, r(0, 0, 17, 3, '#857e5c') + p('M2 2H15V6H17V21H0V6H2Z', '#e7dcc0') + r(2, 3, 2, 16, '#b5bd9b') + r(12, 3, 2, 16, '#b5bd9b') + r(2, 17, 13, 1, '#c2c5a5') + r(6, 8, 5, 4, '#d2cbb0')) +
        r(305, 46, 4, 40, '#b28e5b') + r(302, 48, 10, 2, '#d9b67d') + r(305, 52, 6, 24, '#ece0bd') + r(306, 55, 1, 18, '#b7bc99') + r(309, 57, 1, 16, '#b7bc99') +
        // Warm pools of light and a small washable runner soften the floor.
        p('M102 88H146L206 205H155Z', '#fff0c4', 'opacity=".24"') + p('M134 90H142L199 203H188Z', '#fff6dc', 'opacity=".18"') +
        r(87, 151, 157, 33, '#b59e7a', 'opacity=".25"') + r(84, 148, 157, 33, '#a3ae88') + r(86, 150, 153, 29, '#ccd0a2') + r(88, 152, 149, 25, '#dfdab0') +
        [151, 176].map(y => r(89, y, 147, 1, '#899f79')).join('') + [94, 101, 224, 231].map(x => r(x, 153, 2, 23, '#b8c19a')).join('') +
        Array.from({ length: 14 }, (_, i) => r(85 + i * 11, 146, 1, 2, '#b4b18d') + r(85 + i * 11, 181, 1, 2, '#b4b18d')).join('') +
        // Exit at the left lower edge; nothing tall blocks the walking floor.
        r(0, 139, 4, 68, '#907751') + r(4, 140, 3, 65, '#e5c28b') + r(0, 204, 29, 5, '#a2845c') + r(0, 204, 29, 1, '#edcc97') +
        r(7, 183, 31, 15, '#a49270') + r(8, 184, 29, 12, '#c3b893') + [185, 189, 193].map(y => r(10, y, 25, 1, '#b0a47d')).join('') +
        // A quiet wall lamp casts an amber halo above the pantry.
        r(42, 8, 2, 10, '#a28a60') + p('M36 15H50V18H54V22H32V18H36Z', '#c6a06b') + r(32, 21, 22, 2, '#a98b60') + r(36, 23, 14, 2, '#f3d59a') +
        pot(299, 120) +
        // A few broad sunlit grain strokes finish the spacious foreground.
        r(66, 222, 17, 1, '#caa577') + r(226, 203, 13, 1, '#bda072') + r(283, 231, 15, 1, '#eaca9d');
    return art;
}

/** SVG contents only; the caller owns the viewport and interaction layers. */
export function renderDetailedHomesteadBackdrop(location) {
    if (location === 'kitchen') return kitchen();
    if (location === 'yard') return garden();
    if (location === 'forest') return woodland();
    if (location === 'river') return waterside();
    return '';
}
