// The picker and saved-data validation share the same scene catalogue.
export const COMPANION_HABITATS = Object.freeze([
    { id: 'meadow', name: '风吹草地', symbol: '≋', note: '风车与野餐篮', arrival: '走过柔软的草坡，在小风车旁发现了野餐篮。' },
    { id: 'pond', name: '荷叶池塘', symbol: '≈', note: '木桥与睡莲', arrival: '沿着木桥来到池塘，望着荷叶边漾开的水纹。' },
    { id: 'bedroom', name: '暖灯卧室', symbol: '▤', note: '小床与夜灯', indoor: true, arrival: '走进暖暖的卧室，靠在小床边打了个哈欠。' },
    { id: 'forest', name: '林间树屋', symbol: '♧', note: '树屋与蘑菇', arrival: '踩着落叶走进树林，抬头看了看树屋里的小灯。' },
    { id: 'snowfield', name: '雪原营地', symbol: '·', note: '帐篷与营火', arrival: '在雪地留下浅浅的脚印，凑到营火旁暖了暖。' },
    { id: 'city', name: '城市天台', symbol: '▥', note: '屋顶花圃与灯串', arrival: '绕过天台花圃，趴在栏杆旁看远处的城市。' },
    { id: 'space', name: '星际舷窗', symbol: '✦', note: '行星与观测台', indoor: true, arrival: '来到观测舷窗前，追着缓缓漂过的星光看了好久。' },
    { id: 'arcade', name: '像素街机厅', symbol: '▦', note: '街机与奖券', indoor: true, arrival: '跑进小小街机厅，盯着屏幕上的像素星星跃跃欲试。' },
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
const grass = (x, y, color = '#a1b38b') => group(path('M0 9H3V2H5V9H8V5H10V14H0Z', color), `transform="translate(${x} ${y})"`);
const flower = (x, y, color = '#dbc4ab') => group(rect(4, 7, 2, 10, '#91a77e') + path('M2 1H7V3H9V8H7V10H2V8H0V3H2Z', color) + rect(3, 4, 3, 3, '#f2deae'), `transform="translate(${x} ${y})"`);
const pine = (x, y, scale = 1, color = '#a4b7a8') => group(rect(15, 39, 7, 19, '#ab9e85') + path('M15 0H22V7H26V14H31V21H26V24H33V31H38V40H0V31H5V24H12V21H7V14H12V7H15Z', color) + path('M16 3H20V10H24V14H13V11H16ZM8 25H12V22H17V26H26V31H6Z', '#dce2c9', 'opacity=".35"'), `transform="translate(${x} ${y}) scale(${scale})"`);

const scenes = Object.freeze({
    meadow: () => sky(0, 0, 320, 240) + cloud(99, 22, .85) + cloud(231, 33, .65) +
        path('M0 105H18V95H43V86H69V90H91V100H123V119H0ZM182 112H205V99H230V90H257V84H282V96H307V103H320V127H182Z', '#b8cba3') +
        path('M0 130H26V119H52V121H84V130H112V140H157V132H191V122H216V114H249V125H283V128H320V240H0Z', '#b1c399') +
        rect(0, 161, 320, 79, '#bfcca5') + path('M0 160H41V157H79V162H130V165H185V162H234V158H277V162H320V165H0Z', '#c7d1ad') +
        group(gleam('M90 17H177L232 174H66Z', .06), 'class="tf-scene-daylight"') +
        shadow('M23 138H79L90 146H28Z', .08) + path('M37 76H65L74 139H29Z', '#c4b99a') +
        path('M37 78H43L38 134H31ZM60 78H64L72 137H67Z', '#a8a386') + rect(45, 112, 13, 27, '#8e9e85') + rect(47, 115, 9, 23, '#a9b496') +
        path('M35 72H68V79H35ZM42 64H60V71H42Z', '#a2a78b') + rect(49, 53, 4, 37, '#afad90') +
        group(group(path('M-3 -4H3V-35H-3ZM4 -3H35V3H4ZM-3 4H3V35H-3ZM-35 -3H-4V3H-35Z', '#dfd5b6') +
            path('M-2 -33H2V-9H-2ZM9 -2H33V2H9ZM-2 9H2V33H-2ZM-33 -2H-9V2H-33Z', '#c4c7a5') + rect(-5, -5, 10, 10, '#aaab8d') + rect(-2, -2, 4, 4, '#e8ddbf'), 'class="tf-scene-windmill"'), 'transform="translate(51 70)"') +
        rect(0, 144, 83, 3, '#d7d9b5') + rect(233, 140, 87, 3, '#d7d9b5') +
        [6, 27, 48, 69, 242, 266, 290, 314].map(x => path(`M${x} 135H${x + 2}V132H${x + 5}V135H${x + 7}V154H${x}Z`, '#dddcc0') + rect(x + 5, 137, 2, 17, '#b9c5a1')).join('') +
        group([grass(8, 172), grass(34, 186), grass(63, 167), grass(289, 174), grass(301, 207)].join(''), 'class="tf-scene-wind"') +
        [flower(16, 181, '#d6b3ab'), flower(42, 171), flower(67, 191, '#c5b5cd'), flower(280, 156), flower(298, 183, '#d6b3ab')].join('') +
        shadow('M248 192H303L315 202H254Z', .08) + path('M243 177H285V194H300V204H257V198H243Z', '#d8c9ac') +
        path('M249 180H280V188H293V199H260V194H249Z', '#e8dbbd') + path('M251 182H257V197H251ZM273 180H279V199H273ZM247 187H289V190H247Z', '#c7b6a2') +
        path('M266 168H273V165H284V168H291V183H266Z', '#ad9879') + rect(264, 173, 29, 4, '#d0b592') + rect(267, 177, 23, 9, '#c4a885') +
        path('M272 167V161H286V167H283V164H275V167Z', '#b39a79') + rect(271, 178, 2, 7, '#ab9578') + rect(280, 178, 2, 7, '#ab9578') +
        group(path('M0 0H6V6H10V1H16V8H10V11H6V8H0Z', '#d6bf92') + rect(7, 4, 2, 9, '#899378'), 'transform="translate(233 70)"') +
        [[20, 221], [55, 215], [82, 233], [243, 227], [293, 235]].map(([x, y]) => rect(x, y, 3, 1, '#aabb96')).join(''),

    pond: () => sky(0, 0, 320, 240) + cloud(134, 24, .8) +
        path('M0 99H24V89H43V91H67V100H96V109H140V111H192V104H224V88H247V82H268V91H293V95H320V143H0Z', '#abc5a7') +
        rect(0, 115, 320, 125, '#9bc3bb') + rect(0, 115, 320, 3, '#c1dacc') +
        path('M0 153H29V151H51V144H74V137H113V143H197V137H240V149H268V163H289V178H320V240H0Z', '#b8c7a3') +
        path('M0 168H25V166H53V157H78V151H110V155H204V151H237V164H261V176H284V187H320V240H0Z', '#c8d2ae') +
        path('M0 168H25V165H50V157H75V150H107V153H202V149H235V160H258V174H282V185H320V189H279V179H255V166H232V156H205V157H105V156H79V162H55V171H28V173H0Z', '#e3dec1') +
        group(path('M7 126H39V128H7ZM89 119H109V121H89ZM219 120H249V122H219ZM278 141H309V143H278Z', '#d9e8d8', 'opacity=".64"'), 'class="tf-scene-pond-ripple"') +
        path('M11 0H22V135H11ZM22 17H29V100H22Z', '#a8a48a') + path('M12 5H16V131H12ZM24 21H26V93H24Z', '#c5c0a0') +
        path('M0 0H64V9H76V23H82V37H67V29H47V34H31V27H12V31H0Z', '#8fae93') +
        group(path('M33 18H39V47H36V68H30V83H27V73H31V46H33ZM51 22H57V55H54V79H48V103H45V92H49V52H51ZM69 27H75V53H71V72H65V90H62V78H67V49H69Z', '#9fbb99') +
            path('M32 43H38V48H32ZM48 63H55V68H48ZM63 59H71V64H63Z', '#bfd0a7'), 'class="tf-scene-wind"') +
        shadow('M0 144H69L76 154H0Z', .1) + path('M0 115H66V121H0ZM0 130H72V140H0Z', '#ae9a7b') +
        [0, 13, 26, 39, 52, 65].map(x => rect(x, 125, 11, 17, '#d1b997') + rect(x, 125, 11, 2, '#e4cdab')).join('') +
        [6, 55].map(x => rect(x, 103, 5, 47, '#a38f73') + rect(x, 103, 5, 3, '#d2b999')).join('') + rect(6, 111, 53, 3, '#c6b18e') +
        [group(path('M0 5H6V1H23V5H29V12H23V16H6V12H0Z', '#88ac91') + path('M12 1H16V10H12Z', '#b8cbb0'), 'transform="translate(247 121)"'),
            group(path('M0 4H6V0H20V4H26V11H20V14H6V11H0Z', '#95b69c') + path('M11 0H14V8H11Z', '#c2d4b6'), 'transform="translate(289 145)"')].join('') +
        path('M258 113H262V108H268V113H272V118H269V121H261V118H258Z', '#d6acb1') + rect(263, 114, 4, 3, '#f1d6b4') +
        group(path('M6 10H0V6H7V1H15V5H22V11H17V15H7Z', '#ded1ad') + rect(17, 4, 7, 3, '#c7a383') + rect(14, 3, 2, 2, '#8d9e89') + rect(1, 10, 15, 2, '#f0e3c1'), 'transform="translate(277 99)"') +
        group(rect(263, 118, 22, 1, '#cde1d0') + rect(277, 121, 15, 1, '#cde1d0') + rect(247, 136, 34, 1, '#d8e7d8'), 'class="tf-scene-pond-ripple"') +
        [grass(5, 180), grass(27, 192), grass(293, 190), grass(304, 214)].join('') + flower(42, 184, '#d9bdad') + flower(284, 211) +
        path('M24 220H34V217H46V221H51V225H26ZM277 230H286V226H299V230H306V234H278Z', '#afbea3') + rect(28, 219, 15, 2, '#d4dbc0') + rect(282, 228, 13, 2, '#d4dbc0'),

    bedroom: () => rect(0, 0, 320, 240, '#e6dbc5') + woodFloor(160, '#d2b99e') + rect(0, 154, 320, 7, '#b9a38a') + rect(0, 154, 320, 2, '#e3ccb0') +
        group(gleam('M117 90H201L226 175H93Z', .16), 'class="tf-scene-daylight"') +
        shadow('M106 91H213V98H106Z', .08) + rect(110, 17, 102, 75, '#bfa98c') + rect(115, 22, 92, 65, '#f3e6cc') +
        rect(120, 27, 82, 55, '#c5dedd', 'class="tf-scene-sky tf-scene-window-light"') + cloud(143, 36, .6) +
        path('M120 70H134V66H150V73H174V65H190V70H202V82H120Z', '#b0c4a5') + rect(159, 27, 3, 55, '#f0e4cb') + rect(120, 52, 82, 3, '#f0e4cb') +
        curtain(106, 19, 14, 65) + curtain(202, 19, 14, 65) + rect(101, 14, 120, 4, '#ad977e') + rect(105, 89, 113, 5, '#dfc5a3') +
        shadow('M0 169H81L91 181H0Z') + rect(4, 94, 68, 60, '#ae967c') + rect(4, 94, 68, 4, '#d6ba98') +
        [11, 25, 39, 53].map(x => rect(x, 101, 8, 30, '#c9ad8d') + rect(x, 102, 8, 2, '#e2c6a3')).join('') +
        path('M0 127H78V161H72V171H5V161H0Z', '#c9b99f') + rect(2, 126, 74, 10, '#f4e7cf') + rect(9, 128, 24, 9, '#e2d3ba') + rect(11, 128, 20, 2, '#fbefd8') +
        rect(0, 137, 78, 23, '#aeb79e') + rect(0, 137, 78, 3, '#cad0b3') +
        path('M13 140H20V158H13ZM40 140H47V158H40ZM67 140H74V158H67ZM0 148H78V151H0Z', '#bec7a7') + rect(5, 163, 7, 14, '#a58d72') + rect(65, 163, 7, 14, '#a58d72') +
        shadow('M245 174H301L310 183H249Z') + rect(245, 138, 56, 7, '#bfa27e') + rect(250, 145, 47, 27, '#d0b38e') + rect(254, 149, 39, 18, '#dcc3a0') + rect(269, 154, 8, 2, '#9f8b6e') +
        [251, 289].map(x => rect(x, 171, 5, 11, '#ad9271')).join('') + rect(275, 109, 3, 24, '#9b937a') + rect(267, 132, 19, 3, '#a49a7d') +
        path('M267 93H287L292 110H262Z', '#d3bf96') + rect(263, 109, 28, 3, '#b19f7b') + rect(270, 95, 3, 13, '#e9d4ac') +
        group(path('M264 112H290L304 146H250Z', '#fff0bc', 'opacity=".16"'), 'class="tf-scene-lamplight"') +
        rect(244, 35, 44, 33, '#b8a284') + rect(247, 38, 38, 27, '#efe1c5') + rect(254, 43, 4, 17, '#acb798') + rect(254, 54, 13, 4, '#acb798') + rect(262, 45, 12, 3, '#ccb696') +
        rect(10, 39, 68, 4, '#bfa688') + rect(18, 21, 10, 18, '#b8c3a5') + rect(30, 25, 9, 14, '#c8ac9f') + rect(43, 22, 10, 17, '#adbdb4') + rect(56, 27, 12, 12, '#ddc9a5') +
        plant(14, 45) + rect(99, 209, 121, 22, '#b6b7a0') + rect(103, 212, 113, 16, '#d4cbb0') + rect(110, 216, 98, 8, '#c4c3a7') +
        [105, 113, 202, 210].map(x => rect(x, 206, 2, 3, '#d5ccb1') + rect(x, 231, 2, 3, '#d5ccb1')).join('') +
        path('M249 207H257V203H268V207H271V215H249ZM275 214H283V209H294V214H297V221H275Z', '#c3ada0') + rect(252, 207, 15, 2, '#dbc7b7') + rect(278, 214, 15, 2, '#dbc7b7'),

    forest: () => sky(0, 0, 320, 240) + path('M78 68H96V42H106V72H129V63H144V94H170V77H194V50H204V79H234V102H255V149H72Z', '#b5c5a1') +
        rect(0, 149, 320, 91, '#b8bea0') + path('M127 145H192V165H205V194H220V240H98V209H110V176H127Z', '#d1c6a8') +
        path('M0 0H88V12H99V33H90V51H73V62H46V55H20V64H0ZM237 0H320V84H308V79H287V63H259V48H244V24H237Z', '#879f85') +
        path('M0 3H34V10H54V8H77V19H91V33H73V41H48V34H22V47H0ZM264 2H290V11H320V35H303V30H282V39H255V25H246V13H264Z', '#a5b794') +
        path('M15 47H35V193H27V205H4V197H15ZM282 54H300V203H316V210H282V197H276V156H282Z', '#aaa184') +
        path('M17 49H21V190H17ZM28 122H31V181H28ZM285 69H289V197H285ZM296 150H299V204H296Z', '#c4b79a') +
        shadow('M3 137H83L90 146H6Z', .1) + rect(7, 77, 72, 56, '#b39d7c') + rect(10, 80, 66, 51, '#c9b18d') +
        path('M0 73H6V65H18V58H61V65H78V72H86V80H0Z', '#889c7d') + path('M5 72H14V66H22V61H57V66H72V73Z', '#a9b58b') +
        rect(5, 80, 76, 4, '#d4bd95') + rect(14, 90, 26, 25, '#927e61') + rect(17, 93, 20, 19, '#d8d4ab', 'class="tf-scene-window-light"') + rect(25, 93, 3, 19, '#bba47f') + rect(17, 101, 20, 2, '#bba47f') +
        rect(53, 93, 18, 39, '#ac9270') + rect(56, 97, 12, 32, '#bdac88') + rect(64, 111, 2, 4, '#8a7f61') +
        path('M10 115H42V117H10ZM8 124H47V126H8ZM48 88H75V90H48Z', '#b5a17d') + rect(4, 131, 80, 5, '#927f62') + rect(4, 131, 80, 2, '#ddc29a') +
        path('M58 135H62V188H58ZM72 135H76V188H72Z', '#a48f70') + [141, 152, 163, 174, 185].map(y => rect(59, y, 16, 3, '#c0a984') + rect(59, y, 16, 1, '#deca9f')).join('') +
        path('M266 62H282V67H276V71H250V74H238V69H250V66H266Z', '#aa9f81') +
        group(path('M250 49H263V42H279V47H289V59H279V62H263V57H247Z', '#9cae8a') + rect(254, 49, 18, 3, '#b7c3a0'), 'class="tf-scene-wind"') +
        group(path('M0 0H9V3H13V7H6V9H0Z', '#c7b58d'), 'transform="translate(77 99)"') +
        group(group(path('M0 0H7V2H11V6H5V8H0Z', '#c8ae92'), 'class="tf-scene-floating-leaves"'), 'transform="translate(261 130)"') +
        group(rect(86, 65, 2, 2, '#ede3b2') + rect(236, 103, 2, 2, '#ede3b2') + rect(66, 166, 2, 2, '#ede3b2'), 'class="tf-scene-fireflies"') +
        path('M0 188H22V196H35V203H54V211H45V208H30V203H9V197H0ZM276 204H290V198H302V204H320V215H305V210H282Z', '#aaa78a') +
        [group(path('M3 0H15V3H20V11H0V3H3Z', '#c1a69b') + rect(7, 11, 6, 12, '#e4d8bd') + rect(4, 3, 3, 3, '#eee0c3') + rect(13, 5, 3, 3, '#eee0c3'), 'transform="translate(10 194)"'),
            group(path('M3 0H13V3H17V9H0V3H3Z', '#c7b397') + rect(6, 9, 5, 10, '#e5dcc1') + rect(4, 2, 3, 3, '#f2e8d1'), 'transform="translate(272 186)"')].join('') +
        grass(47, 214, '#a2ad8d') + grass(297, 218, '#a2ad8d') + path('M69 225H77V228H83V231H75V229H69ZM252 225H260V223H266V227H260V229H252Z', '#c3b597') + rect(100, 216, 13, 1, '#c1b899') + rect(198, 202, 14, 1, '#c1b899'),

    snowfield: () => rect(0, 0, 320, 240, '#d6e5e1', 'class="tf-scene-sky"') + cloud(119, 25, .85) + cloud(247, 42, .6) +
        path('M0 121H13V104H26V87H43V68H56V79H71V96H85V109H108V119H132V104H147V89H165V78H179V97H194V110H219V101H237V87H250V65H264V77H279V99H296V112H320V156H0Z', '#b4c8c4') +
        path('M26 87H43V70H55V82H64V93H54V88H44V96H36V91H26ZM149 89H165V79H177V95H165V93H158V98H149ZM237 87H250V67H264V78H270V88H260V85H251V92H243Z', '#edf0de') +
        path('M0 139H22V133H69V144H112V140H157V144H205V138H249V131H292V140H320V240H0Z', '#e8eddf') +
        path('M0 165H40V169H79V165H112V168H195V164H233V167H283V162H320V166H287V171H231V170H191V172H109V172H75V174H38V169H0Z', '#d3dfd1') +
        pine(4, 75, 1.1, '#a6bbb0') + pine(280, 80, .88, '#a6bbb0') +
        shadow('M0 170H88L96 178H4Z', .1) + path('M0 156H11V134H23V115H36V94H46V110H58V128H71V148H85V169H0Z', '#b5bba9') +
        path('M6 156H18V136H30V117H39V102H43V118H54V138H65V157H75V166H6Z', '#c5cbb6') +
        path('M33 126H49V138H58V166H24V142H33Z', '#94a395') + path('M37 127H42V165H29V143H37Z', '#b5c0aa') +
        path('M40 97H43V120H40ZM42 123H45V161H42Z', '#e0ddc0') + rect(4, 166, 75, 3, '#a5af9d') +
        path('M12 134H20V128H26V134H20V139H12ZM25 116H33V112H38V117H34V122H25Z', '#eef1e0') +
        rect(69, 140, 3, 15, '#9ea48e') + rect(63, 156, 14, 5, '#9ba58f') + rect(64, 143, 12, 13, '#b6b9a0') + rect(67, 146, 6, 7, '#eddbaf') + rect(66, 140, 8, 3, '#919d8a') +
        group(path('M64 157H76L85 171H55Z', '#f7dfb0', 'opacity=".2"'), 'class="tf-scene-lamplight"') +
        shadow('M266 169H303L311 175H274Z', .08) + path('M276 128H290V132H296V147H301V165H269V147H272V132H276Z', '#f5f4e5') +
        path('M277 110H288V114H293V127H288V132H277V127H272V114H277Z', '#f5f4e5') + rect(277, 107, 13, 5, '#a0a79b') + rect(275, 110, 17, 3, '#9a9f94') +
        rect(278, 118, 2, 2, '#81938a') + rect(286, 118, 2, 2, '#81938a') + path('M280 122H289V124H280Z', '#d1b18e') +
        path('M272 130H293V134H286V147H281V134H272Z', '#c7aca6') + rect(283, 141, 3, 3, '#e0c8b5') +
        path('M270 140H261V138H254V141H261V144H270ZM294 142H302V137H308V140H305V144H294Z', '#af9f85') + rect(280, 145, 2, 2, '#a0a79b') + rect(280, 153, 2, 2, '#a0a79b') +
        shadow('M244 210H291V215H249Z', .08) + path('M249 207H287V211H249ZM252 204H285V207H252Z', '#a8997e') +
        path('M253 208H259V205H278V210H253ZM273 205H280V211H287V214H274Z', '#bdaa89') +
        group(group(path('M0 22V14H4V9H7V3H10V9H14V0H18V11H23V18H20V26H4V23Z', '#d5b38b') +
            path('M7 24V16H11V10H14V17H17V25Z', '#f0d2a2'), 'class="tf-scene-campfire"'), 'transform="translate(257 178)"') +
        [[100, 227], [108, 217], [242, 174], [236, 183]].map(([x, y]) => rect(x, y, 4, 2, '#c9d7ca')).join('') + path('M9 220H45V222H9ZM280 234H311V236H280Z', '#d8e1d3'),

    city: () => sky(0, 0, 320, 240) + cloud(145, 19, .75) +
        path('M0 84H17V73H49V87H63V105H82V91H109V103H125V112H151V98H172V89H197V105H224V82H250V95H275V79H302V87H320V160H0Z', '#afc2b8') +
        path('M0 112H27V95H59V117H77V129H108V117H131V135H159V123H187V133H221V112H249V130H270V103H299V119H320V171H0Z', '#94ada7') +
        group([[6, 101], [18, 119], [39, 100], [50, 129], [85, 103], [99, 103], [177, 113], [197, 144], [230, 100], [246, 140], [280, 118], [292, 135]].map(([x, y], i) =>
            rect(x, y, 4, 6, i % 3 ? '#c6d3b7' : '#dcd7b3', 'class="tf-scene-window-light"')).join(''), 'class="tf-scene-city-window"') +
        rect(0, 159, 320, 81, '#c6c4b1') + rect(0, 158, 320, 3, '#b0b6a3') +
        path('M0 192H320V193H0ZM0 221H320V222H0ZM49 161H50V192H49ZM263 193H264V222H263ZM80 222H81V240H80Z', '#b6b9a8') +
        rect(0, 143, 250, 4, '#d1d0b9') + rect(0, 154, 250, 3, '#a8b2a1') +
        [9, 36, 63, 90, 230].map(x => rect(x, 145, 3, 14, '#b3bcaa')).join('') +
        shadow('M254 155H320V168H263Z', .1) + rect(259, 82, 61, 75, '#bfc6b6') + rect(255, 78, 65, 7, '#96aaa0') + rect(255, 78, 65, 2, '#d6dbc4') +
        rect(274, 100, 35, 57, '#a6b5a8') + rect(278, 104, 27, 52, '#bdc8b6') + rect(281, 109, 21, 15, '#a1bdb6') + rect(281, 109, 21, 2, '#8da89e') + rect(297, 132, 3, 6, '#8f9e8d') +
        rect(286, 48, 3, 31, '#97a69a') + path('M278 48H299V51H278ZM285 36H289V42H294V45H289V48H285Z', '#9dab9e') +
        path('M0 26L111 45L242 27V29L111 47L0 28Z', '#a7b39c') +
        group([[20, 30], [55, 36], [92, 42], [135, 42], [173, 37], [211, 31]].map(([x, y]) => rect(x, y, 3, 3, '#a4ab92') + rect(x - 1, y + 3, 5, 5, '#ede4bd')).join(''), 'class="tf-scene-lights"') +
        shadow('M3 178H76L86 186H9Z') + rect(3, 156, 73, 22, '#b39f86') + rect(0, 153, 79, 5, '#d6bea0') + rect(6, 157, 67, 3, '#c6ae8f') +
        [9, 33, 55].map((x, i) => group(group(path('M0 18H4V8H8V1H12V9H17V5H22V15H15V19H11V28H6V19H0Z', ['#98ad8c', '#abc09b', '#9bb4a0'][i]) + rect(7, 9, 2, 17, '#c4cfaa'), 'class="tf-scene-wind"'), `transform="translate(${x} ${127 - i % 2 * 6})"`)).join('') +
        shadow('M13 214H55L65 220H19Z', .08) + rect(18, 190, 34, 5, '#b5a68a') + rect(21, 195, 5, 21, '#a69c84') + rect(44, 195, 5, 21, '#a69c84') +
        path('M30 179H42V188H30ZM42 181H47V186H42Z', '#e4d7b9') + rect(32, 179, 8, 2, '#b4a28a') + rect(20, 191, 30, 1, '#dac7a6') +
        shadow('M277 219H307V225H281Z', .08) + path('M277 205H297V210H306V214H297V221H277Z', '#a6b5a2') +
        path('M282 205V200H292V205H289V203H285V205Z', '#8fa491') + rect(280, 209, 4, 9, '#c9d0b6') + path('M300 210H310V207H313V212H306V216H302Z', '#a6b5a2'),

    space: () => rect(0, 0, 320, 240, '#c3cfd0') + rect(0, 0, 320, 6, '#dce2d8') +
        path('M65 10H254V19H263V115H254V126H65V117H56V21H65Z', '#a2b6b7') +
        path('M69 16H250V24H257V111H249V119H69V111H62V25H69Z', '#526a7a') +
        path('M72 19H246V27H253V107H246V115H72V107H66V29H72Z', '#728595') +
        path('M78 22H244V27H249V70H80V66H72V29H78Z', '#627a8d') +
        [[89, 31], [128, 25], [174, 37], [226, 26], [236, 86], [87, 100], [112, 84], [201, 103]].map(([x, y], i) => rect(x, y, i % 2 ? 2 : 3, i % 2 ? 2 : 3, '#e2e7ce', 'opacity=".72"')).join('') +
        path('M100 51H108V46H124V51H132V59H136V76H131V84H124V89H108V84H100V76H95V59H100Z', '#b2b4a0') +
        path('M103 52H110V48H120V52H127V57H119V61H106V69H100V59H103ZM120 72H133V79H127V85H119V81H112V76H120Z', '#c9c8ac') +
        path('M95 70H107V66H116V71H128V67H133V74H127V79H117V75H106V79H99V75H95Z', '#a1aa9b') +
        path('M210 45H217V40H227V45H234V52H238V63H231V69H217V64H210V56H206V48H210Z', '#b9a5a5') +
        path('M212 47H219V43H225V47H231V53H220V56H210V50H212Z', '#d7bfb0') +
        path('M201 57H212V55H223V52H243V56H230V60H218V64H201V61H196V59H201Z', '#c9c8b3') + rect(212, 61, 15, 2, '#9ba6a0') +
        group(group(path('M0 3H5V0H9V3H14V7H9V10H5V7H0Z', '#cbd3c1') + rect(-8, 3, 6, 5, '#8eabb1') + rect(16, 3, 6, 5, '#8eabb1') + rect(5, 4, 4, 3, '#8eaaa9'), 'class="tf-scene-star-orbit"'), 'transform="translate(220 94)"') +
        rect(65, 120, 190, 3, '#dce3d5') + rect(64, 22, 3, 86, '#b7c8c4') + rect(253, 24, 3, 84, '#829d9f') +
        rect(0, 173, 320, 67, '#b0c2c0') + rect(0, 169, 320, 6, '#8ba8a6') + rect(0, 171, 320, 2, '#cfdbce') +
        path('M0 203H320V205H0ZM0 232H320V234H0ZM52 175H54L41 240H39ZM268 175H270L283 240H281Z', '#c6d3c9') +
        shadow('M0 175H72L82 184H0ZM250 175H320V186H260Z', .09) +
        path('M0 125H64V130H72V173H0Z', '#a0b6b6') + rect(0, 124, 62, 6, '#d4ded3') + rect(7, 135, 49, 26, '#6f9294') + rect(11, 139, 41, 17, '#a6c8b7') +
        path('M14 150H20V146H24V148H28V143H34V146H38V150H48V152H14Z', '#759c93') + rect(11, 163, 17, 2, '#d4d8bc') + rect(35, 163, 5, 2, '#bdb695') + rect(46, 163, 5, 2, '#d4d8bc') +
        path('M257 130H267V123H320V175H250V138H257Z', '#9eb5b4') + rect(266, 125, 54, 4, '#d4dfd1') + rect(271, 136, 41, 22, '#6c9293') + rect(275, 140, 33, 14, '#adc8bb') +
        path('M278 147H284V143H292V147H305V149H278Z', '#81a495') + [272, 285, 299].map(x => rect(x, 164, 6, 3, '#dfd2aa')).join('') +
        rect(7, 45, 32, 29, '#a1b6b6') + rect(11, 49, 24, 21, '#d5dcc8') + path('M15 63H20V58H25V54H30V64H15Z', '#a9ba9f') +
        rect(284, 31, 27, 50, '#a6bbb9') + [39, 50, 61].map((y, i) => rect(290, y, 5, 4, ['#cbd7ad', '#d4c4ad', '#bcd4bd'][i]) + rect(299, y + 1, 7, 2, '#d9dfcb')).join('') +
        plant(17, 77) + path('M96 224H106V218H214V224H224V232H96Z', '#bbcdca') + path('M102 225H109V222H211V225H218V229H102Z', '#d2ddd1') + rect(151, 225, 18, 2, '#b1c4bb'),

    arcade: () => rect(0, 0, 320, 240, '#d8cdd0') + rect(0, 0, 320, 6, '#c1b3bd') + rect(0, 6, 320, 2, '#e6d9d6') +
        rect(0, 91, 320, 3, '#c8bac3') + rect(0, 161, 320, 79, '#c4bcc1') + rect(0, 158, 320, 5, '#a7a5af') +
        path('M0 188H320V190H0ZM0 218H320V220H0ZM54 164H56L40 240H38ZM263 164H265L283 240H281ZM158 164H160V240H158Z', '#d2c9cb') +
        rect(115, 25, 90, 50, '#b3a7b9') + rect(119, 29, 82, 42, '#e6dad1') + rect(124, 34, 72, 32, '#bfc0b2') +
        path('M145 42H151V37H160V42H166V48H172V57H165V62H144V57H137V48H145Z', '#d4c3a2') +
        path('M152 44H157V50H163V54H156V59H152V53H146V49H152Z', '#ede0bc') + rect(177, 41, 5, 5, '#c9aaa9') + rect(130, 55, 4, 4, '#b3a6bc') +
        shadow('M0 177H74L84 188H0ZM244 177H320V189H254Z') +
        path('M4 61H67V68H73V109H62V125H76V177H0V125H10V110H4Z', '#9fafa7') +
        rect(8, 61, 55, 14, '#b9c5b3') + rect(12, 64, 47, 8, '#dae0c1') +
        path('M18 66H22V69H18ZM28 66H32V69H28ZM38 66H42V69H38ZM48 66H52V69H48Z', '#9fac96') +
        rect(12, 80, 49, 39, '#7b8e87') + rect(16, 84, 41, 31, '#68867e') + rect(17, 85, 39, 2, '#516f6a') +
        group(path('M23 96H27V92H31V96H41V92H45V96H49V106H45V110H41V105H31V110H27V106H23Z', '#c7cf9f') + rect(28, 98, 4, 4, '#6a8577') + rect(40, 98, 4, 4, '#6a8577') + rect(24, 112, 5, 1, '#a3b8a0') + rect(42, 112, 5, 1, '#a3b8a0'), 'class="tf-scene-arcade-screen"') +
        path('M10 123H62L69 136H3Z', '#c5c9ae') + rect(3, 136, 66, 3, '#929e8c') + rect(24, 118, 3, 10, '#8c8e77') + rect(21, 117, 9, 4, '#d0b29f') +
        rect(47, 130, 6, 3, '#bea5a0') + rect(57, 130, 6, 3, '#dbc9a5') + rect(12, 145, 46, 27, '#b5bba3') + rect(31, 151, 12, 3, '#829281') + rect(34, 159, 6, 5, '#98a38d') +
        path('M253 64H313V75H320V113H308V129H320V177H244V128H255V111H249V75H253Z', '#b8a9b7') +
        rect(258, 64, 51, 14, '#cfbdc2') + rect(262, 67, 43, 8, '#e9d8c8') +
        path('M268 69H274V72H268ZM281 69H287V72H281ZM294 69H300V72H294Z', '#a895a8') +
        rect(257, 83, 54, 40, '#8f7f98') + rect(261, 87, 46, 32, '#80758b') + rect(262, 88, 44, 2, '#6d687f') +
        group(path('M276 98H281V94H287V99H293V104H288V111H281V106H275Z', '#e2c6aa') + rect(265, 111, 6, 2, '#bda5b7') + rect(295, 95, 3, 3, '#bbaeb9') + rect(296, 109, 5, 3, '#bbaeb9'), 'class="tf-scene-arcade-screen"') +
        path('M255 128H309L320 138H246Z', '#d1bbc3') + rect(246, 138, 74, 3, '#a18d9f') + rect(274, 123, 3, 9, '#9c8894') + rect(271, 121, 9, 4, '#d7b29d') +
        rect(293, 133, 6, 3, '#bea0b6') + rect(304, 133, 6, 3, '#d7c499') + rect(257, 146, 47, 27, '#c4b0bb') + rect(274, 152, 13, 3, '#9b8797') + rect(278, 160, 5, 5, '#a88f9f') +
        rect(13, 31, 61, 5, '#c8bcae') + [20, 37, 54].map((x, i) => rect(x, 14 + i % 2 * 4, 12, 17 - i % 2 * 4, ['#bbc5ac', '#d4b6ad', '#b9b1c7'][i]) + rect(x + 3, 16 + i % 2 * 4, 6, 3, '#e9dec4')).join('') +
        rect(248, 25, 62, 5, '#c8b4b4') + path('M257 10H266V13H270V22H252V13H257ZM284 8H293V12H297V22H280V12H284Z', '#c7c3a8') + rect(258, 12, 6, 4, '#ede0bf') + rect(285, 10, 6, 4, '#ede0bf') +
        shadow('M7 211H42L50 217H13Z', .08) + rect(10, 190, 30, 22, '#c9b7a5') + rect(13, 193, 24, 15, '#dfcdb3') +
        path('M17 189H29V195H33V201H22V205H16V200H20V196H17Z', '#f0e0bd') + rect(22, 196, 5, 1, '#b8a78c') + rect(24, 200, 5, 1, '#b8a78c') +
        path('M277 206H283V202H292V207H298V212H292V216H282V212H277Z', '#d0bfa3') + rect(282, 205, 9, 2, '#e7d5b5') + rect(285, 209, 4, 3, '#b6a790'),

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
