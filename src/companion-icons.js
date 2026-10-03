// One pixel grid for the pet device, its care tools, and its small controls.
// The outline inherits the device ink; the second layer uses its soft accent.
const path = d => `<path fill-rule="evenodd" d="${d}"/>`;
const accent = d => `<path class="tf-pet-icon-accent" fill="var(--tf-pet-icon-accent, currentColor)" d="${d}"/>`;
const pixel = (x, y, width = 2, height = 2) => `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;

const icons = Object.freeze({
    status: accent('M5 6h5v2h4V6h5v3h2v5h-3v3h-3v2H9v-2H6v-3H3V9h2Z')
        + path('M5 4h5v2h4V4h5v2h3v8h-3v3h-3v3h-3v2h-2v-2H8v-3H5v-3H2V6h3Zm0 4H4v5h3v3h3v3h4v-3h3v-3h3V8h-3V6h-2v2H9V6H7v2Z'),
    feed: accent('M6 8h4V6h4v2h4v3H6ZM5 14h14v3h-3v2H8v-2H5Z')
        + path('M8 4h8v2h4v4h2v5h-2v3h-3v3H7v-3H4v-3H2v-5h2V6h4ZM8 6v2H6v2h12V8h-2V6ZM4 12v2h16v-2Zm2 4v1h3v2h6v-2h3v-1Z'),
    games: accent('M6 8h12v2h2v8h-3v-3H7v3H4v-8h2Z')
        + path('M6 6h12v2h3v3h1v9h-6v-3H8v3H2v-9h1V8h3ZM6 8v2H5v2H4v6h2v-3h12v3h2v-6h-1v-2h-1V8Z')
        + path('M7 10h2v2h2v2H9v2H7v-2H5v-2h2ZM15 10h2v2h-2ZM17 13h2v2h-2Z'),
    clean: accent('M5 13h14v4h-3v2H8v-2H5ZM9 4h2v2H9ZM15 7h2v2h-2Z')
        + path('M2 11h20v4h-2v4h-3v3h-2v-2H9v2H7v-3H4v-4H2Zm2 2v2h2v2h2v1h8v-1h2v-2h2v-2ZM3 4h3v2H5v4H3ZM8 2h4v1h1v4h-1v1H8V7H7V3h1Zm1 2v2h2V4ZM14 5h4v1h1v4h-1v1h-4v-1h-1V6h1Zm1 2v2h2V7Z'),
    rest: accent('M9 5v7h3v3h7v3h-3v2H8v-2H5v-3H3V9h2V6h3Z')
        + path('M8 2h5v2h-3v7h3v3h7v-3h2v7h-3v3h-4v1H8v-2H4v-4H2V9h2V5h4ZM8 5H6v5H4v5h2v3h3v2h6v-1h3v-2h1v-1h-7v-3H9V5Z')
        + path('M18 2h2v2h2v2h-2v2h-2V6h-2V4h2Z'),
    album: accent('M7 5h13v14H7ZM8 13h3v-3h3v3h4v4H8Z')
        + path('M5 3h17v18H5Zm2 2v14h13V5ZM2 7h2v15h13v2H2ZM8 15h2v-3h3v-2h2v3h3v4H8Z') + pixel(9, 7),
    travel: accent('M5 9h14v11H5Z')
        + path('M8 2h8v5h5v14H3V7h5Zm2 2v3h4V4ZM5 9v10h14V9ZM7 10h2v8H7ZM15 10h2v8h-2Z')
        + pixel(6, 21, 3, 2) + pixel(15, 21, 3, 2),
    dress: accent('M8 5h2v3h4V5h2v2h4v4h-4v9H8v-9H4V7h4Z')
        + path('M7 3h4v3h2V3h4v2h3v2h2v6h-5v9H7v-9H2V7h2V5h3Zm1 3H6v2H4v3h5v9h6v-9h5V8h-2V6h-2v2h-2v1h-4V8H8Z'),
    home: accent('M6 10h12v10H6Z')
        + path('M10 2h4v2h3v3h3v3h2v2h-3v10H5V12H2v-2h2V7h3V4h3Zm0 4v2H7v3H5v1h2v8h3v-6h4v6h3v-8h2v-1h-2V8h-3V6Z'),
    menu: accent('M4 4h5v5H4ZM15 4h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5Z')
        + path('M2 2h9v9H2Zm2 2v5h5V4ZM13 2h9v9h-9Zm2 2v5h5V4ZM2 13h9v9H2Zm2 2v5h5v-5ZM13 13h9v9h-9Zm2 2v5h5v-5Z'),
    pet: accent('M9 12h6v2h3v5h-3v2H9v-2H6v-5h3Z')
        + path('M8 10h8v3h3v7h-3v3H8v-3H5v-7h3Zm2 2v3H7v3h3v3h4v-3h3v-3h-3v-3ZM3 6h4v6H3ZM8 2h4v6H8ZM14 2h4v6h-4ZM19 6h4v6h-4Z'),
    resume: accent('M7 4h3v2h3v2h3v2h3v4h-3v2h-3v2h-3v2H7Z')
        + path('M5 2h5v3h4v3h4v3h3v2h-3v3h-4v3h-4v3H5Zm2 2v16h1v-3h4v-3h4v-4h-4V7H8V4Z'),
    left: path('M11 3h3v3h-3v3H8v2h13v2H8v2h3v3h3v3h-3v-3H8v-3H5v-2H2v-2h3V9h3V6h3Z'),
    right: path('M10 3h3v3h3v3h3v2h3v2h-3v2h-3v3h-3v3h-3v-3h3v-3h3v-2H3v-2h13V9h-3V6h-3Z'),
    check: path('M19 4h3v4h-3v3h-3v3h-3v3h-3v3H7v-3H4v-3H2v-3h3v2h3v3h2v-3h3v-3h3V7h3Z'),
    back: path('M8 3h3v3H8v3h10v2h3v9H10v-3h8v-5H8v3h3v3H8v-3H5v-3H2V9h3V6h3Z'),
    coin: accent('M7 4h10v3h3v10h-3v3H7v-3H4V7h3Z')
        + path('M7 2h10v3h4v14h-4v3H7v-3H3V5h4Zm1 2v3H5v10h3v3h8v-3h3V7h-3V4ZM11 7h2v10h-2ZM8 10h8v2H8Z'),
    battery: accent('M5 8h13v8H5Z')
        + path('M2 5h19v4h2v6h-2v4H2Zm2 2v10h15V7ZM6 9h3v6H6ZM11 9h3v6h-3Z'),
    smile: accent('M7 4h10v3h3v10h-3v3H7v-3H4V7h3Z')
        + path('M7 2h10v3h4v14h-4v3H7v-3H3V5h4Zm1 2v3H5v10h3v3h8v-3h3V7h-3V4ZM7 8h3v3H7ZM14 8h3v3h-3ZM7 14h3v2h4v-2h3v3h-3v2h-4v-2H7Z'),
    pause: accent('M6 5h3v14H6ZM15 5h3v14h-3Z')
        + path('M4 3h7v18H4Zm2 2v14h3V5ZM13 3h7v18h-7Zm2 2v14h3V5Z'),
    sparkles: accent('M10 6h4v4h4v4h-4v4h-4v-4H6v-4h4Z')
        + path('M10 2h4v6h2v2h6v4h-6v2h-2v6h-4v-6H8v-2H2v-4h6V8h2Zm0 8v2H6v1h4v3h3v-3h4v-1h-4v-2Z'),
    ball: accent('M7 4h10v3h3v10h-3v3H7v-3H4V7h3Z')
        + path('M7 2h10v3h4v14h-4v3H7v-3H3V5h4Zm1 2v3H5v4h5V4Zm4 0v7h7V7h-3V4ZM5 13v4h3v3h2v-7Zm7 0v7h4v-3h3v-4Z'),
    catch: accent('M10 4h4v5h5v4h-5v5h-4v-5H5V9h5Z')
        + path('M10 2h4v5h6v2h2v4h-6v3h-2v5h-4v-5H8v-3H2V9h2V7h6Zm0 7v2H6v1h4v4h4v-4h4v-1h-4V9Z')
        + pixel(1, 21, 6, 2) + pixel(17, 21, 6, 2),
    memory: accent('M4 5h6v6H4ZM14 13h6v6h-6Z')
        + path('M2 3h10v10H2Zm2 2v6h6V5ZM12 11h10v10H12Zm2 2v6h6v-6ZM15 3h5v5h-5ZM3 16h5v5H3Z'),
    dodge: accent('M10 4h4v2h4v3h3v2H3V9h3V6h4Z')
        + path('M10 2h4v2h5v3h3v6H2V7h3V4h5Zm0 4H7v3H4v2h16V9h-3V6ZM11 13h2v7h-2v2H7v-2H5v-3h2v3h4Z'),
    snack: accent('M8 4h8v3h4v10h-4v3H8v-3H4V7h4Z')
        + path('M7 2h10v3h4v14h-4v3H7v-3H3V5h4Zm1 2v3H5v10h3v3h8v-3h3V7h-3V4Z')
        + pixel(8, 8, 3, 3) + pixel(14, 11, 3, 3) + pixel(8, 15),
    blocks: accent('M4 12h7v8H4ZM13 4h7v8h-7ZM13 14h7v6h-7Z')
        + path('M2 10h11v12H2Zm2 2v8h7v-8ZM11 2h11v12H11Zm2 2v8h7V4ZM13 14h9v8h-9v-2h7v-6Z')
        + pixel(6, 14, 3, 2) + pixel(15, 6, 3, 2),
    cushion: accent('M5 7h14v3h2v7h-2v3H5v-3H3v-7h2Z')
        + path('M4 5h16v3h3v11h-3v3H4v-3H1V8h3Zm2 2v3H3v7h3v3h12v-3h3v-7h-3V7ZM8 11h8v2H8ZM6 16h12v2H6Z'),
    lamp: accent('M9 4h6v3h3v5H6V7h3Z')
        + path('M8 2h8v3h3v4h2v5H3V9h2V5h3Zm2 2v3H7v4H5v1h14v-1h-2V7h-3V4ZM11 14h2v5h5v3H6v-3h5Z'),
    brush: accent('M5 4h14v7H5Z')
        + path('M3 2h18v11h-6v9H9v-9H3Zm2 2v7h14V4ZM11 13v7h2v-7ZM6 5h2v4H6ZM10 5h2v4h-2ZM14 5h2v4h-2Z'),
    dance: accent('M6 15h4v4H6ZM16 12h4v4h-4Z')
        + path('M9 3h12v14h-2v2h-5v-2h-2v-5h2v-2h5V5h-8v15H9v2H4v-2H2v-5h2v-2h5Zm-5 12v3h4v-3ZM14 12v3h5v-3Z'),
    train: accent('M5 6h3v12H5ZM16 6h3v12h-3Z')
        + path('M3 4h7v6h4V4h7v3h2v10h-2v3h-7v-6h-4v6H3v-3H1V7h2Zm2 2v12h3V6ZM16 6v12h3V6ZM10 12v1h4v-1Z'),
    hide: accent('M5 11h14v10H5Z')
        + path('M6 3h5v2h2V3h5v2h2v5h2v12H2V10h2V5h2Zm0 4v3h12V7h-2V5h-1v2H9V5H8v2ZM4 12v8h16v-8Z')
        + pixel(7, 7) + pixel(15, 7) + pixel(11, 15, 2, 4),
    talk: accent('M4 5h16v12H9v3H6v-3H4Z')
        + path('M2 3h20v16H10v3H4v-3H2Zm2 2v12h2v3h2v-3h12V5Z')
        + pixel(6, 9) + pixel(11, 9) + pixel(16, 9),
    daycare: accent('M6 10h12v10H6Z')
        + path('M10 2h4v2h3v3h3v3h2v2h-3v10H5V12H2v-2h2V7h3V4h3Zm0 4v2H7v3H5v1h2v8h10v-8h2v-1h-2V8h-3V6ZM11 12h2v2h2v2h-2v2h-2v-2H9v-2h2Z'),
    wake: accent('M7 8h10v3h3v7h-3v3H7v-3H4v-7h3Z')
        + path('M7 6h10v3h4v11h-4v3H7v-3H3V9h4Zm1 2v3H5v7h3v3h8v-3h3v-7h-3V8ZM11 11h2v5h3v2h-5ZM1 4h5v2H1ZM18 4h5v2h-5ZM5 1h3v3H5ZM16 1h3v3h-3Z'),
    auto: accent('M7 4h10v3h3v10h-3v3H7v-3H4V7h3Z')
        + path('M7 2h10v3h4v14h-4v3H7v-3H3V5h4Zm1 2v3H5v10h3v3h8v-3h3V7h-3V4ZM11 6h2v6h4v2h-6Z'),
    sunny: accent('M8 8h8v8H8Z')
        + path('M8 6h8v2h2v8h-2v2H8v-2H6V8h2Zm0 4v4h2v2h4v-2h2v-4h-2V8h-4v2Z')
        + pixel(11, 1, 2, 3) + pixel(11, 20, 2, 3) + pixel(1, 11, 3, 2) + pixel(20, 11, 3, 2)
        + pixel(3, 3, 3, 3) + pixel(18, 3, 3, 3) + pixel(3, 18, 3, 3) + pixel(18, 18, 3, 3),
    cloudy: accent('M8 6h8v3h4v3h2v6H2v-6h3V9h3Z')
        + path('M8 4h8v3h4v3h3v10H1V10h3V7h4Zm2 2v3H6v3H3v6h18v-6h-3V9h-4V6Z'),
    rain: accent('M8 4h8v3h4v3h2v5H2v-5h3V7h3Z')
        + path('M8 2h8v3h4v3h3v9H1V8h3V5h4Zm2 2v3H6v3H3v5h18v-5h-3V7h-4V4ZM5 18h3v3H5ZM11 20h3v3h-3ZM17 18h3v3h-3Z'),
    wind: path('M14 2h6v2h2v5h-2v2H2V9h18V5h-6V3h-2ZM2 13h16v2h3v5h-2v2h-6v-2h5v-5H2ZM2 18h7v2H2Z'),
    snow: path('M11 1h2v5h2V4h2v2h-2v2h-2v3h3V9h2V7h2v2h-2v2h5v2h-5v2h2v2h-2v-2h-2v-2h-3v3h2v2h2v2h-2v-2h-2v5h-2v-5H9v2H7v-2h2v-2h2v-3H8v2H6v2H4v-2h2v-2H1v-2h5V9H4V7h2v2h2v2h3V8H9V6H7V4h2v2h2Z'),
    dawn: accent('M9 10h6v3h3v5H6v-5h3Z')
        + path('M9 8h6v3h4v7h4v2H1v-2h4v-7h4Zm2 2v3H7v5h10v-5h-4v-3ZM11 2h2v4h-2ZM2 9h3v2H2ZM19 9h3v2h-3ZM4 4h3v3H4ZM17 4h3v3h-3Z'),
    dusk: accent('M9 10h6v3h3v5H6v-5h3Z')
        + path('M9 8h6v3h4v7h4v2H1v-2h4v-7h4Zm2 2v3H7v5h10v-5h-4v-3ZM11 1h2v2h2v2h-2v2h-2V5H9V3h2ZM2 9h3v2H2ZM19 9h3v2h-3Z'),
});

const aliases = Object.freeze({
    heart: 'status', energy: 'battery', happiness: 'smile', message: 'talk',
    day: 'sunny', night: 'rest', bowl: 'feed', soap: 'clean', active: 'pet', play: 'ball',
});
export const COMPANION_ICON_NAMES = Object.freeze([...Object.keys(icons), ...Object.keys(aliases)]);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function renderCompanionIcon(name, className = '') {
    const requested = String(name ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const key = Object.hasOwn(icons, requested) || Object.hasOwn(aliases, requested) ? requested : 'sparkles';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="tf-pet-icon tf-pet-icon-${key}${className ? ` ${esc(className)}` : ''}" data-pet-icon="${key}" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${icons[aliases[key] || key]}</svg>`;
}
