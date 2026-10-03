// The picker and saved-data validation share the same scene catalogue.
export const COMPANION_HABITATS = Object.freeze([
    { id: 'meadow', name: '风吹草地', symbol: '≋', note: '柔软草坡' },
    { id: 'pond', name: '荷叶池塘', symbol: '≈', note: '水光与荷叶' },
    { id: 'bedroom', name: '暖灯卧室', symbol: '▤', note: '安静暖光' },
    { id: 'forest', name: '林间树屋', symbol: '♧', note: '枝叶木屋' },
    { id: 'snowfield', name: '雪原营地', symbol: '·', note: '雪地帐篷' },
    { id: 'city', name: '城市天台', symbol: '▥', note: '城市灯火' },
    { id: 'space', name: '星际舷窗', symbol: '✦', note: '缓慢星轨' },
    { id: 'arcade', name: '像素街机厅', symbol: '▦', note: '霓虹格栅' },
    { id: 'kitchen', name: '暖香厨房', symbol: '♨', note: '炉火与热茶', indoor: true, arrival: '凑到小炉灶旁，闻了闻热茶的香气。' },
    { id: 'bathroom', name: '泡泡浴室', symbol: '◌', note: '瓷砖与泡泡', indoor: true, arrival: '追着一颗泡泡，看它慢慢飘过浴缸。' },
    { id: 'library', name: '午后书房', symbol: '▥', note: '书架与窗光', indoor: true, arrival: '在书架边转了一圈，坐到窗下等你读故事。' },
    { id: 'garden', name: '花信庭院', symbol: '✿', note: '花架与蝴蝶', arrival: '沿着小石路走进花园，停下来追看蝴蝶。' },
    { id: 'beach', name: '贝壳海滩', symbol: '≈', note: '浪花与帆船', arrival: '踩上软软的沙滩，发现了一枚小贝壳。' },
    { id: 'fairground', name: '星灯乐园', symbol: '✧', note: '摩天轮与彩旗', arrival: '仰头望着慢悠悠的摩天轮，开心地晃了晃身子。' },
].map(scene => Object.freeze(scene)));

export function normalizeCompanionHabitat(value) {
    return COMPANION_HABITATS.some(scene => scene.id === value) ? value : 'meadow';
}

// Scene changes belong to the current interaction, never to the saved habitat.
// The caller supplies the already-resolved sleep/feedback state so this module
// stays independent of life progression and does not need a clock or API call.
export function resolveCompanionScene(companion, {
    action = 'idle', cleaning = false, foodMenu = false, game = false,
    feedbackKind = '', sleeping = false,
} = {}) {
    const selected = normalizeCompanionHabitat(companion?.habitat);
    const scene = (habitat = selected, reason = '') => ({ habitat, temporary: habitat !== selected, reason });
    if (companion?.status === 'away' || ['paused', 'daycare'].includes(companion?.life?.mode) || foodMenu) return scene();
    if (game) return scene('garden', 'play');
    if (cleaning || feedbackKind === 'clean') return scene('bathroom', 'clean');
    if (action === 'feed') return scene('kitchen', 'feed');
    if (sleeping || companion?.status === 'resting') return scene('bedroom', 'sleep');
    if (action === 'play' || action === 'dance') return scene('garden', 'play');
    return scene();
}

// Small, code-native pixel sets keep the foreground clear for the pet.
const rect = (x, y, width, height, fill, extra = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const group = (content, attributes = '') => `<g ${attributes}>${content}</g>`;
const sky = (x, y, w, h) => rect(x, y, w, h, '#c5dedd', 'class="tf-scene-sky"');
const tile = (width, height, y, color) => Array.from({ length: Math.ceil(height / 24) }, (_, row) =>
    Array.from({ length: Math.ceil(width / 32) }, (_, col) => rect(col * 32, y + row * 24, 30, 22, color)).join('')).join('');
const plant = (x, y, flower = false) => group(
    rect(8, 14, 4, 18, '#789277') + path('M8 22H0V14H8ZM12 16V6H20V16Z', '#8fa781') + rect(2, 14, 5, 3, '#acbc95') + rect(13, 6, 5, 3, '#acbc95') +
    (flower ? path('M2 6H6V2H12V6H16V12H12V16H6V12H2Z', '#dca5a4') + rect(7, 7, 4, 4, '#efd298') : '') +
    path('M0 30H22V36H19V48H3V36H0Z', '#be9277') + rect(0, 30, 22, 3, '#ddb395') + rect(4, 36, 4, 10, '#d6ad8f') + rect(17, 36, 2, 12, '#a87e67'), `transform="translate(${x} ${y})"`);
const shadow = (d, opacity = .12) => path(d, '#526356', `opacity="${opacity}"`);
const gleam = (d, opacity = .35) => path(d, '#fff7df', `opacity="${opacity}"`);
const woodFloor = (y, base = '#d3b99c') => rect(0, y, 320, 240 - y, base) +
    Array.from({ length: Math.ceil((240 - y) / 25) }, (_, row) => {
        const top = y + row * 25;
        return rect(0, top, 320, 1, '#b99f83') + rect(0, top + 1, 320, 1, '#e4cdb0') +
            [row % 2 ? 35 : 92, row % 2 ? 215 : 270].map(x => rect(x, top, 1, 25, '#baa48c')).join('') +
            rect(20 + row * 17, top + 11, 23, 1, '#c1a789') + rect(270 - row * 6, top + 16, 16, 1, '#c1a789');
    }).join('');
const curtain = (x, y, width, height) => rect(x, y, width, height, '#d5baa4') +
    rect(x + 3, y, 4, height, '#eddbc1') + rect(x + width - 4, y, 3, height, '#bfa38e') +
    rect(x - 1, y + height - 15, width + 2, 4, '#ac9380');
const cloud = (x, y, scale = 1) => group(path('M0 10H8V4H18V0H30V5H39V10H47V16H0Z', '#edf2df', 'opacity=".66"'), `transform="translate(${x} ${y}) scale(${scale})"`);

const scenes = Object.freeze({
    kitchen: () => rect(0, 0, 320, 240, '#e4d7b9') + tile(320, 150, 0, '#f1e7d0') +
        rect(0, 0, 320, 5, '#dfd0b3') + woodFloor(151) + rect(0, 148, 320, 4, '#b9a285') +
        group(gleam('M127 82H194L225 165H102Z', .2), 'class="tf-scene-daylight"') +
        shadow('M7 67H89V73H7ZM113 88H207V94H113Z', .08) +
        rect(116, 16, 88, 74, '#c8ad8b') + rect(120, 20, 80, 66, '#f8ecd4') + sky(125, 25, 70, 55) +
        cloud(146, 34, .55) + path('M125 68H136V63H154V71H175V60H195V80H125Z', '#b5c9a0') +
        rect(158, 25, 4, 55, '#f5e9cc') + rect(125, 50, 70, 3, '#f5e9cc') + gleam('M128 29H131V47H128ZM165 55H188V58H165Z') +
        curtain(112, 18, 13, 57) + curtain(195, 18, 13, 57) + rect(108, 13, 104, 4, '#ad957b') + rect(112, 86, 96, 5, '#e0c7a5') +
        rect(8, 18, 78, 48, '#b3a584') + rect(8, 18, 78, 3, '#e3d6b7') +
        [13, 49].map(x => rect(x, 23, 32, 38, '#d6cbae') + rect(x + 3, 26, 26, 32, '#c6bf9f') + rect(x + 5, 28, 22, 27, '#e0d5b6') + rect(x + (x === 13 ? 23 : 6), 40, 3, 8, '#a99473')).join('') +
        shadow('M0 170H82L94 181H0ZM242 170H320V181H251Z') +
        rect(0, 112, 82, 62, '#a6af91') + rect(0, 106, 86, 8, '#958c76') + rect(0, 106, 86, 3, '#e7d7b7') + rect(78, 114, 4, 60, '#8c987c') +
        [8, 42].map(x => rect(x, 119, 30, 47, '#c4c7a5') + rect(x + 3, 123, 24, 38, '#b7bf9b') + rect(x + 6, 125, 19, 32, '#cdd0af') + rect(x + 21, 139, 3, 7, '#918d6d')).join('') +
        rect(6, 170, 8, 8, '#8f9075') + rect(66, 170, 8, 8, '#8f9075') +
        rect(241, 111, 79, 63, '#c0a383') + rect(236, 106, 84, 8, '#918875') + rect(236, 106, 84, 3, '#eadfc3') +
        rect(249, 119, 61, 43, '#8e8c7b') + rect(252, 122, 55, 3, '#bab7a0') + rect(255, 128, 49, 28, '#6f7e73') +
        rect(258, 130, 42, 2, '#b3c4a8') + gleam('M259 134H275L281 149H265Z', .17) + rect(260, 150, 35, 2, '#a9a88d') +
        [254, 267, 280, 296].map(x => rect(x, 114, 4, 3, '#787a67')).join('') +
        rect(256, 97, 38, 6, '#797566') + path('M260 83H291V98H260ZM291 87H298V94H291Z', '#9fad99') + rect(264, 82, 4, 13, '#c6d2b9') + rect(266, 79, 20, 4, '#7e937e') + rect(273, 76, 7, 3, '#637d68') +
        group(path('M270 72V65H274V57H270V50H273V44H276V53H274V61H277V69H274V74Z', '#faf3e1'), 'class="tf-scene-steam"') +
        rect(247, 36, 52, 4, '#b59b7e') + rect(247, 40, 52, 2, '#cfb69a') + rect(251, 25, 12, 11, '#d1ad97') + rect(272, 23, 13, 13, '#abc0ac') + rect(274, 20, 9, 3, '#8fa68f') +
        plant(16, 60) + path('M54 91H68V103H54ZM68 93H73V100H68Z', '#e8d0b3') + rect(56, 91, 10, 2, '#a58e73') +
        rect(241, 167, 62, 4, '#aa947b'),

    bathroom: () => rect(0, 0, 320, 240, '#bed5cd') + tile(320, 160, 0, '#e5eee1') +
        rect(0, 86, 320, 7, '#b3cebd') + rect(0, 89, 320, 2, '#d6e5cd') +
        Array.from({ length: 16 }, (_, i) => rect(i * 20 + 7, 86, 5, 5, '#9abbaa')).join('') +
        rect(0, 164, 320, 76, '#a9c5c3') + path('M0 189H320V191H0ZM0 220H320V222H0Z', '#d0e1d2') +
        path('M75 164H77L47 240H45ZM244 164H246L276 240H274ZM159 164H161V240H159Z', '#c9ddd0') + rect(0, 160, 320, 5, '#94b3aa') +
        shadow('M132 84H195V88H132ZM225 164H312L319 176H239Z', .1) +
        rect(128, 17, 67, 68, '#8facaa') + rect(132, 21, 59, 60, '#c3d6cb') + rect(136, 25, 51, 52, '#adcbd0') +
        path('M139 63V52H143V44H147V36H151V28H159V36H155V44H151V52H147V63ZM161 55H166V49H171V43H176V51H172V57H167V63H161Z', '#eaf3e8') + rect(132, 81, 59, 3, '#73958f') +
        rect(18, 26, 64, 5, '#88a69f') + rect(18, 26, 64, 1, '#e2edda') + rect(24, 31, 26, 49, '#ead6b8') + rect(52, 31, 23, 42, '#b9c9ac') +
        rect(28, 31, 3, 44, '#f6e7cb') + rect(46, 31, 3, 47, '#d2b99a') + rect(56, 31, 3, 38, '#d5dec4') + rect(25, 71, 24, 3, '#c7b08f') + rect(53, 65, 21, 3, '#95ae94') +
        rect(241, 30, 65, 5, '#b3bfa5') + rect(248, 16, 11, 14, '#c7acb8') + rect(251, 12, 5, 4, '#947f93') + rect(268, 19, 13, 11, '#ced6aa') + rect(271, 15, 7, 4, '#a7b086') + rect(248, 22, 11, 4, '#efe2d5') +
        path('M253 98V74H261V70H277V75H260V98Z', '#81a49e') + rect(255, 76, 2, 20, '#c9dbcb') + rect(271, 75, 12, 4, '#6f948d') +
        path('M226 116H312V132H307V153H297V163H244V155H234V134H226Z', '#cbded3') +
        path('M228 117H310V131H304V149H297V156H246V150H239V133H228Z', '#f1f1df') +
        rect(225, 111, 90, 11, '#f8f4e5') + rect(234, 111, 70, 6, '#acd4cf') + rect(237, 114, 63, 2, '#e1efdc') +
        rect(243, 163, 8, 10, '#91aba0') + rect(291, 163, 8, 10, '#91aba0') + gleam('M241 130H245V148H241ZM248 150H291V153H248Z') +
        shadow('M13 159H59L65 166H17Z') + rect(14, 125, 44, 8, '#b3a287') + rect(14, 125, 44, 2, '#dbc9aa') + rect(18, 133, 6, 26, '#a18d74') + rect(47, 133, 6, 26, '#a18d74') + rect(24, 117, 22, 8, '#e5d5b6') + rect(26, 116, 17, 4, '#f2e8cd') +
        group(path('M248 91H256V94H260V102H256V105H248V102H244V94H248ZM276 76H282V79H285V85H282V88H276V85H273V79H276Z', '#edf5e7', 'fill-opacity=".72"') + rect(247, 94, 3, 4, '#ffffff') + rect(276, 79, 3, 3, '#ffffff'), 'class="tf-scene-bubbles"') +
        plant(20, 68) + shadow('M103 227H218V231H103Z', .08) + rect(105, 211, 110, 16, '#dcd8b8') + rect(109, 214, 102, 2, '#f1e7c8') + rect(109, 222, 102, 2, '#b9c19e') +
        [110, 121, 199, 210].map(x => rect(x, 207, 2, 4, '#dbd7b7') + rect(x, 227, 2, 4, '#dbd7b7')).join(''),

    library: () => rect(0, 0, 320, 240, '#e8dfc9') + rect(0, 0, 320, 5, '#d7c7ac') + woodFloor(158, '#c7ac8e') + rect(0, 153, 320, 6, '#a99377') +
        group(gleam('M113 104H191L223 174H92Z', .18), 'class="tf-scene-daylight"') +
        shadow('M101 108H222V115H101Z', .08) + rect(105, 16, 110, 91, '#b6a27e') + rect(110, 21, 100, 81, '#f1e6cb') + sky(114, 25, 92, 73) +
        cloud(136, 35, .65) + path('M114 79H131V72H149V82H182V70H196V76H206V98H114Z', '#aebf96') + rect(159, 25, 3, 73, '#f1e6cb') + rect(114, 59, 92, 3, '#f1e6cb') +
        gleam('M117 27H120V54H117ZM166 64H201V66H166Z', .45) + curtain(101, 20, 13, 72) + curtain(206, 20, 13, 72) + rect(98, 13, 124, 4, '#a98e71') + rect(100, 103, 120, 7, '#d9bd98') +
        [8, 250].map(x => group(shadow('M1 164H62L69 175H7Z') + rect(0, 25, 62, 142, '#9e8367') + rect(-2, 22, 66, 5, '#ceb08c') +
            [32, 74, 116].map((y, row) => rect(5, y, 52, 34, '#806f5c') + rect(7, y + 3, 50, 31, '#a39274') +
                ['#97aa8b', '#c2a08d', '#8faeab', '#b4a0b4', '#ccba81'].map((color, i) => {
                    const bookY = y + 5 + (i + row) % 3 * 3, bookH = 27 - (i + row) % 3 * 3;
                    return rect(8 + i * 9, bookY, 7, bookH, color) + rect(8 + i * 9, bookY, 1, bookH, '#dacfb0', 'opacity=".48"') + rect(10 + i * 9, y + 21, 3, 2, '#f0e3c4') + rect(10 + i * 9, y + 10, 3, 1, '#e3d9bf');
                }).join('') + rect(4, y + 33, 54, 3, '#d5b58c')).join('') + rect(1, 28, 3, 136, '#c1a27e') + rect(59, 27, 3, 140, '#876d55'), `transform="translate(${x} 0)"`)).join('') +
        shadow('M241 217H300L310 226H244Z') + path('M235 181H304V190H235ZM241 190H248V220H241ZM293 190H299V220H293Z', '#a68b6c') + rect(235, 181, 69, 3, '#d4b78f') + rect(245, 190, 49, 9, '#ba9b77') + rect(265, 194, 9, 2, '#86775c') +
        path('M246 175H267V170H289V182H268V180H246Z', '#c7af8e') + path('M247 173H266V169H287V178H268V177H247Z', '#f4ead0') + rect(266, 170, 2, 8, '#bda789') + rect(272, 172, 11, 1, '#c8b99a') + rect(249, 175, 12, 1, '#c8b99a') +
        rect(284, 135, 3, 32, '#91866e') + path('M277 122H291L297 139H270Z', '#b4bf95') + rect(272, 138, 23, 3, '#8a9c77') + rect(277, 166, 17, 3, '#8d886f') +
        group(path('M275 142H294L302 174H265Z', '#fff0bc', 'opacity=".12"'), 'class="tf-scene-lamplight"') +
        group(rect(224, 45, 2, 2, '#fff8d6') + rect(90, 79, 2, 2, '#fff8d6') + rect(227, 112, 2, 2, '#fff8d6'), 'class="tf-scene-dust"') +
        rect(98, 211, 119, 21, '#a2aa88') + rect(102, 214, 111, 15, '#c8c6a0') + rect(108, 217, 99, 9, '#b4ba91') +
        [105, 113, 199, 207].map(x => rect(x, 208, 2, 3, '#c8c6a0') + rect(x, 232, 2, 3, '#c8c6a0')).join(''),

    garden: () => sky(0, 0, 320, 240) + cloud(36, 25, .75) + cloud(247, 18, .9) + rect(0, 103, 320, 137, '#c0cda1') +
        path('M0 84H15V76H34V70H53V76H73V89H97V118H0ZM226 90H246V75H269V70H288V81H311V89H320V118H226Z', '#a6be95') +
        path('M0 104H27V96H51V104H74V112H98V143H0ZM229 117H247V104H272V100H292V112H320V146H229Z', '#93af87') +
        rect(0, 118, 88, 4, '#dee0bb') + rect(234, 118, 86, 4, '#dee0bb') +
        [7, 31, 55, 79, 240, 264, 288, 312].map(x => path(`M${x} 105H${x + 3}V102H${x + 6}V105H${x + 9}V147H${x}Z`, '#e8e4c5') + rect(x + 7, 109, 2, 38, '#c2c8a2')).join('') +
        path('M146 141H179V161H190V187H205V214H224V240H98V214H114V188H129V160H146Z', '#b4b994') +
        path('M148 141H178V161H187V187H202V214H218V240H105V214H119V188H134V160H148Z', '#e1d3b2') +
        path('M143 158H183V160H143ZM129 184H195V186H129ZM116 211H210V213H116ZM106 236H219V238H106ZM156 160H158V184H156ZM175 213H177V235H175Z', '#c8bd9d') +
        shadow('M98 150H109L118 163H101ZM215 150H225L233 163H219Z') +
        path('M97 41H105V157H97ZM215 41H223V157H215ZM94 37H226V44H94Z', '#ab9f7b') +
        path('M98 44H100V156H98ZM216 44H218V156H216ZM96 37H224V39H96Z', '#ded3aa') +
        [112, 135, 179, 202].map(x => rect(x, 34, 5, 25, '#c0b590')).join('') +
        path('M91 47H99V35H110V28H130V31H145V40H157V49H140V45H125V40H113V52H107V79H98V102H91V83H94V59H91ZM184 40H198V33H218V39H230V54H235V78H229V99H220V73H224V57H214V50H203V46H184Z', '#839f76') +
        path('M103 36H116V31H130V36H139V39H120V44H104ZM205 39H216V43H225V51H216V46H205ZM95 73H100V92H95Z', '#aec194') +
        [[110, 29], [135, 37], [196, 35], [222, 51], [95, 64]].map(([x, y], i) => path(`M${x + 2} ${y}H${x + 8}V${y + 2}H${x + 10}V${y + 8}H${x + 8}V${y + 10}H${x + 2}V${y + 8}H${x}V${y + 2}H${x + 2}Z`, i % 2 ? '#e1b3a4' : '#d2a4b2') + rect(x + 3, y + 3, 4, 3, '#f5dac0')).join('') +
        rect(7, 167, 67, 14, '#b29779') + rect(243, 167, 70, 14, '#b29779') + rect(7, 164, 67, 4, '#d0b696') + rect(243, 164, 70, 4, '#d0b696') +
        [14, 38, 258, 283].map((x, i) => plant(x, 121 + i % 2 * 6, true)).join('') +
        shadow('M250 214H310L316 222H257Z') + rect(253, 175, 55, 4, '#b49d7d') + rect(253, 182, 55, 4, '#b49d7d') +
        path('M249 191H312V197H249ZM257 179H261V217H257ZM301 179H305V217H301Z', '#9d886c') + rect(249, 191, 63, 2, '#d4bd97') +
        group(path('M64 69H71V76H74V71H80V80H74V83H70V80H64Z', '#dfbd8e') + rect(71, 74, 2, 10, '#8d9177') + rect(66, 71, 3, 3, '#f3dab0'), 'class="tf-scene-butterfly"') +
        path('M20 209H22V204H24V213H20ZM50 226H52V221H54V230H50ZM293 231H295V225H297V234H293Z', '#a3b88d') + rect(26, 207, 3, 3, '#f2dec2') + rect(64, 233, 3, 3, '#d9b3a3') + rect(286, 223, 3, 3, '#f2dec2'),

    beach: () => sky(0, 0, 320, 240) + cloud(94, 23, .85) + cloud(222, 15, .7) +
        path('M149 81H159V76H172V80H179V77H191V84H206V91H144V86H149Z', '#a0bfb3') +
        rect(0, 90, 320, 86, '#81b5b9') + rect(0, 92, 320, 2, '#c0dcd1') + rect(0, 109, 320, 51, '#98c8c5') + rect(0, 138, 320, 30, '#b3d8cf') +
        path('M0 158H66V164H140V168H219V157H280V150H320V240H0Z', '#ead9b6') +
        path('M0 167H64V175H132V179H222V168H280V160H320V167H284V176H226V186H128V181H60V174H0Z', '#d9cbae') +
        group(path('M0 151H59V157H139V162H213V151H277V145H320V149H280V155H217V166H136V162H56V156H0Z', '#f6f4df') + rect(85, 152, 23, 2, '#e3efe0') + rect(234, 143, 16, 2, '#e3efe0'), 'class="tf-scene-surf"') +
        group(path('M13 102H47V104H13ZM72 120H104V122H72ZM136 100H153V102H136ZM223 116H248V118H223ZM290 129H314V131H290Z', '#d4e7dc', 'opacity=".72"'), 'class="tf-scene-water-glints"') +
        shadow('M15 158H69L79 166H23Z', .1) + rect(47, 74, 4, 90, '#b29776') + rect(47, 74, 1, 90, '#e3ceb0') +
        path('M20 63H37V55H58V60H72V67H82V74H88V83H12V73H20Z', '#c6a19c') +
        path('M38 55H48V63H43V73H40V82H24V75H28V65H38ZM53 55H58V60H67V69H73V81H57V72H55Z', '#f1dec0') +
        path('M12 81H25V85H12ZM26 81H40V86H26ZM42 81H57V85H42ZM59 81H73V86H59ZM75 81H88V84H75Z', '#ab8e89') +
        gleam('M23 65H27V72H23ZM39 57H48V59H39Z', .6) +
        shadow('M15 192H71L85 208H27Z', .09) + path('M12 170H62L78 199H25Z', '#c3ad8e') + path('M18 171H57L70 194H29Z', '#f0ddba') +
        path('M24 172H31L44 194H37ZM40 172H47L60 194H53Z', '#d9b8a4') + rect(24, 199, 7, 6, '#aa977c') + rect(68, 198, 7, 6, '#aa977c') +
        group(path('M257 79H302V83H296V88H264Z', '#9e8f73') + rect(260, 78, 40, 3, '#eedbb7') + rect(279, 43, 2, 36, '#8c9681') +
            path('M276 44V74H253Z', '#fff0d2') + path('M274 52V72H259Z', '#e3d3b2') + path('M284 50V74H302Z', '#d3a499') + rect(283, 70, 15, 3, '#efd7bc'), 'class="tf-scene-boat"') +
        rect(263, 92, 33, 2, '#c5dfd3') + rect(274, 96, 15, 1, '#c5dfd3') +
        shadow('M260 216H283V221H264Z', .09) + path('M265 203H279V206H284V214H279V219H265V214H260V206H265Z', '#fbebcc') +
        path('M268 206H270V216H268ZM275 206H277V215H275ZM262 208H264V212H262ZM280 208H282V212H280Z', '#d0ae94') + rect(266, 204, 11, 2, '#fff5db') +
        [[286, 181], [280, 190], [292, 188], [286, 197]].map(([x, y]) => rect(x, y, 3, 4, '#c4b290')).join('') +
        [[18, 218], [44, 228], [76, 215], [247, 235], [304, 225]].map(([x, y], i) => rect(x, y, 2, 2, i % 2 ? '#cdb795' : '#f7e7c7')).join(''),

    fairground: () => sky(0, 0, 320, 240) + cloud(117, 23, .85) + rect(0, 148, 320, 92, '#c2c8a3') +
        path('M0 128H20V119H40V128H63V113H92V131H233V119H267V128H295V116H320V157H0Z', '#aabd9d') +
        rect(0, 171, 320, 69, '#d9ccb0') + rect(0, 170, 320, 3, '#b6bd99') +
        path('M0 196H320V198H0ZM0 226H320V228H0ZM43 171H45V195H43ZM268 198H270V225H268ZM85 228H87V240H85Z', '#c4b99e') +
        shadow('M217 166H279L290 174H223Z') + path('M241 96H247L226 169H218ZM248 96H254L277 169H269Z', '#92a49a') +
        path('M241 101H243L224 165H222ZM253 105H255L273 165H271Z', '#c2d0b7') + rect(229, 148, 36, 3, '#8fa092') +
        group('<circle cx="248" cy="71" r="44" fill="none" stroke="#8aa39a" stroke-width="3"/><circle cx="248" cy="71" r="40" fill="none" stroke="#bdd0b6" stroke-width="2"/>' +
            path('M247 27H249V115H247ZM204 70H292V72H204Z', '#97afa1') +
            '<path d="M217 40L279 102M217 102L279 40" stroke="#97afa1" stroke-width="2"/>' +
            [[248, 27], [279, 40], [292, 71], [279, 102], [248, 115], [217, 102], [204, 71], [217, 40]].map(([x, y], i) =>
                group(group(rect(0, 0, 14, 3, '#829b90') + rect(1, 3, 12, 11, i % 2 ? '#d4aa97' : '#aea1b7') + rect(3, 4, 8, 4, '#f7e9c8') + rect(2, 12, 10, 2, i % 2 ? '#b98f80' : '#92869e'), 'class="tf-scene-cabin"'), `transform="translate(${x - 7} ${y - 3})"`)).join(''), 'class="tf-scene-wheel"') +
        rect(243, 66, 10, 10, '#d9c8a4') + rect(246, 69, 4, 4, '#f9e8bd') +
        shadow('M13 163H85L97 173H22Z') + rect(16, 97, 65, 68, '#c5af8e') + rect(19, 102, 59, 60, '#dfc7a5') +
        path('M28 147H30V162H28ZM43 147H45V162H43ZM61 147H63V162H61Z', '#c5aa86') +
        rect(22, 109, 53, 33, '#a3ad96') + rect(25, 112, 47, 27, '#768c7d') + rect(25, 112, 47, 2, '#637e71') +
        rect(28, 127, 15, 11, '#e1cca8') + rect(31, 124, 9, 3, '#eddaba') + rect(53, 117, 13, 20, '#d6c6a8') + rect(55, 120, 9, 2, '#9fa88c') + rect(55, 125, 7, 2, '#9fa88c') +
        rect(11, 141, 75, 7, '#ac8e70') + rect(11, 141, 75, 2, '#e4c6a0') +
        path('M17 78H78V83H84V89H89V97H9V89H14V83H17Z', '#c49499') +
        path('M25 78H37V96H21V89H25ZM55 78H65V85H69V97H53V88H55Z', '#f4e0ba') +
        [10, 26, 42, 58, 74].map((x, i) => rect(x, 96, 14, 5, i % 2 ? '#ecd6b1' : '#ab858e')).join('') +
        path('M0 30L166 55L166 57L0 32Z', '#9fa98d') +
        [18, 53, 88, 123].map((x, i) => path(`M${x} ${34 + i * 5}H${x + 16}L${x + 8} ${49 + i * 5}Z`, ['#d4a8a6', '#cab787', '#99b8a6', '#bcabc1'][i]) + rect(x + 3, 35 + i * 5, 9, 1, '#ebd9b9')).join('') +
        group([20, 58, 96, 134].map((x, i) => rect(x, 31 + i * 6, 3, 2, '#8f947e') + rect(x - 1, 33 + i * 6, 5, 4, '#fff0bf')).join(''), 'class="tf-scene-lights"') +
        shadow('M260 224H308L315 230H266Z') + path('M260 199H306V205H260ZM266 205H271V226H266ZM295 205H300V226H295Z', '#ac9475') +
        rect(260, 199, 46, 2, '#d5bb94') + rect(262, 184, 43, 4, '#bea17c') + rect(262, 190, 43, 4, '#bea17c') + rect(266, 188, 3, 10, '#9f886b') + rect(298, 188, 3, 10, '#9f886b') + rect(24, 227, 7, 2, '#c1b89d'),
});

const sceneMarkup = new Map();
export function renderCompanionScene(id) {
    if (!Object.hasOwn(scenes, id)) return '';
    if (!sceneMarkup.has(id)) {
        const scene = COMPANION_HABITATS.find(item => item.id === id);
        sceneMarkup.set(id, `<svg class="tf-scene-art" data-scene="${id}" data-indoor="${Boolean(scene.indoor)}" viewBox="0 0 320 240" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${scenes[id]()}</svg>`);
    }
    return sceneMarkup.get(id);
}
