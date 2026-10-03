// Each bite removes part of the original drawing, retaining its size and position.
// The exposed edge gets an outline so the remaining food reads at device scale.
const FOODS = Object.freeze({
    'bug-cookie': {
        fill: '#d9a35e', edge: '#765137', crumb: '#f7d99a',
        shape: 'M9 4H22V6H26V10H28V22H25V26H21V28H10V26H6V23H4V11H6V7H9Z',
        detail: '<path d="M9 9H21M7 12V21M11 25H21" stroke="#f3ca85" stroke-width="2"/><path d="M12 15H16V18H20V21H16V19H12Z" fill="#728351"/><path d="M12 15V13M15 15V13M18 19V23" stroke="#566343" stroke-width="1.5"/><path d="M10 11H12M21 11H23M8 21H10M22 21H24" stroke="#8c623f" stroke-width="2"/>',
    },
    'fish-flake': {
        fill: '#e8b581', edge: '#826044', crumb: '#ffdcac',
        shape: 'M3 15H5V12H9V9H18V11H22V13H24V9H28V24H24V20H22V22H18V24H9V21H5V18H3Z',
        detail: '<path d="M9 11H17V13H9Z" fill="#ffe1b4"/><path d="M9 21H18V23H9Z" fill="#c98e64"/><path d="M15 14V19M18 15V19M25 13V20" fill="none" stroke="#bc815d" stroke-width="1.6"/><path d="M7 15H9V17H7Z" fill="#765039"/>',
    },
    'carrot-cube': {
        fill: '#ec9a57', edge: '#875737', crumb: '#ffd6a0',
        shape: 'M8 11H14V6H12V3H16V7H18V3H22V7H20V11H24V14H27V25L18 29L6 25V14Z',
        detail: '<path d="M13 3H16V9H18V3H22V7H20V12H15V8H13Z" fill="#7f9c57"/><path d="M8 13L18 17L25 13L18 11Z" fill="#ffd28d"/><path d="M18 17V28L26 24V15Z" fill="#d77c45"/><path d="M10 18L14 19M10 22L13 23M21 20L24 19" stroke="#b66b39" stroke-width="1.5"/>',
    },
    berry: {
        fill: '#ce7480', edge: '#804955', crumb: '#f6b6b8',
        shape: 'M10 6H14V4H19V6H23V9H27V14H28V22H25V26H21V28H11V26H7V23H4V15H6V10H10Z',
        detail: '<path d="M10 7H15V5H18V8H23V11H19L16 14L13 11H9Z" fill="#849758"/><path d="M9 14H12V18H8V16H9Z" fill="#f4b4b9"/><path d="M9 23H12V25H21V23H25V20H27V24H24V27H11Z" fill="#b76272"/><path d="M15 18V20M21 16V18M18 23V25M8 20V22" stroke="#f2c293" stroke-width="1.5"/>',
    },
    'seed-mix': {
        fill: '#dfc187', edge: '#7a6748', crumb: '#f6dfae',
        shape: 'M13 4H18V7H21V12H24V15H27V19H28V25H25V28H19V26H13V28H7V26H4V20H6V16H9V11H11V7H13Z',
        detail: '<path d="M13 6H17V10H19V16L16 20L12 17V10Z" fill="#f1dba6" stroke="#9f8559" stroke-width="1.3"/><path d="M15 8V17" stroke="#b49761" stroke-width="1.4"/><path d="M9 16L14 20L12 26H7L5 23L6 19Z" fill="#c59a66"/><path d="M8 23L11 19M20 18L24 25" stroke="#927047" stroke-width="1.5"/><path d="M19 18L23 16L27 22L25 26H21L18 22Z" fill="#e8cb90"/><path d="M21 19L24 24" stroke="#a88450" stroke-width="1.4"/>',
    },
    battery: {
        fill: '#a5c4bb', edge: '#536e66', crumb: '#d8e9d7',
        shape: 'M12 3H20V7H24V10H25V26H23V28H9V26H7V10H9V7H12Z',
        detail: '<path d="M13 4H19V7H13Z" fill="#ddd8bc"/><path d="M9 9H23V13H9Z" fill="#dce4c7"/><path d="M9 24H23V26H9Z" fill="#759c92"/><path d="M10 15V22" stroke="#d3e4d7" stroke-width="2"/><path d="M17 14L12 20H16L15 25L21 18H17Z" fill="#fcdfa0" stroke="#8f9869" stroke-width="1"/>',
    },
    'melon-jelly': {
        fill: '#a5c887', edge: '#698151', crumb: '#def0b3',
        shape: 'M11 5H21V7H24V11H26V17H28V24H25V27H7V24H4V18H6V11H8V7H11Z',
        detail: '<path d="M11 7H21V9H24V12H8V10H11Z" fill="#d5e9a9"/><path d="M7 20H10V24H23V21H26V24H24V26H8V24H6Z" fill="#87ae6b"/><path d="M9 14V18M12 9H16" stroke="#eff6cf" stroke-width="2"/><path d="M16 16V18M21 19V21M13 21V23" stroke="#789955" stroke-width="1.5"/>',
    },
    'honey-drop': {
        fill: '#e7b254', edge: '#96713d', crumb: '#ffe6a2',
        shape: 'M15 3H18V7H20V10H23V13H25V17H27V22H25V25H22V27H11V25H7V22H5V18H7V14H10V11H12V7H15Z',
        detail: '<path d="M11 13H14V16H11V20H8V16H10V14H11Z" fill="#fff0b4"/><path d="M9 23H12V25H21V23H25V20H26V23H24V26H11Z" fill="#cb943c"/><path d="M17 8V12" stroke="#f8d887" stroke-width="2"/>',
    },
    'ice-fish': {
        fill: '#b8d4d7', edge: '#66878e', crumb: '#e6f2e6',
        shape: 'M3 15H5V12H10V9H16V6H20V10H22V13H24V10H29V24H25V21H22V23H18V26H13V23H9V21H5V18H3Z',
        detail: '<path d="M10 11H17V13H10Z" fill="#edf1df"/><path d="M10 20H17V23H12V22H10Z" fill="#94b8c3"/><path d="M17 8H19V11H17ZM25 13H28V20H25Z" fill="#8fafbf"/><path d="M7 15H9V17H7Z" fill="#557c84"/><path d="M16 14V20M13 17H19" stroke="#eff9ea" stroke-width="1.5"/>',
    },
    'oil-nut': {
        fill: '#b88e61', edge: '#705640', crumb: '#dfb884',
        shape: 'M11 4H21V7H25V11H28V21H25V25H21V28H11V25H7V21H4V11H7V7H11Z',
        detail: '<path d="M11 6H21V9H25V12H22V10H11V12H8V10H11Z" fill="#d8b17d"/><path d="M8 21H11V24H21V21H25V24H22V27H11V25H8Z" fill="#946b4a"/><path d="M13 11H19V13H21V19H19V21H13V19H11V13H13Z" fill="#6d6c61" stroke="#e5bf83" stroke-width="1.5"/><path d="M15 12H18L16 16H19L14 21L15 17H13Z" fill="#e4c280"/>',
    },
});

const BITES = Object.freeze({
    bitten: {
        cut: 'M9 0H32V10H27V13H23V10H20V13H16V10H12V7H9Z',
        edge: 'M9 0V7H12V10H16V13H20V10H23V13H27V10H32',
    },
    last: {
        cut: 'M0 0H32V19H26V22H23V19H19V22H16V19H12V16H8V19H0Z',
        edge: 'M0 19H8V16H12V19H16V22H19V19H23V22H26V19H32',
    },
});

let foodArtSequence = 0;

export function renderCompanionFoodArt(foodId) {
    const id = Object.hasOwn(FOODS, foodId) ? foodId : 'bug-cookie';
    const food = FOODS[id];
    const key = `tf-food-${++foodArtSequence}`;
    const drawing = `<path d="${food.shape}" fill="${food.fill}" stroke="${food.edge}" stroke-width="1.8" stroke-linejoin="round"/>${food.detail}`;
    const defs = `<defs><clipPath id="${key}-shape"><path d="${food.shape}"/></clipPath>${Object.entries(BITES).map(([state, bite]) => `<mask id="${key}-${state}" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><path d="M0 0H32V32H0Z" fill="white"/><path d="${bite.cut}" fill="black"/></mask>`).join('')}</defs>`;
    const bitten = Object.entries(BITES).map(([state, bite]) => `<g class="tf-feed-food-${state}" opacity="0"><g mask="url(#${key}-${state})">${drawing}</g><g clip-path="url(#${key}-shape)"><path d="${bite.edge}" fill="none" stroke="${food.crumb}" stroke-width="3.5"/><path d="${bite.edge}" fill="none" stroke="${food.edge}" stroke-width="1.8" stroke-linejoin="round"/></g></g>`).join('');
    return `<svg class="tf-feed-food-art" data-food-art="${id}" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true" focusable="false">${defs}<g class="tf-feed-food-whole" opacity="1">${drawing}</g>${bitten}</svg>`;
}
