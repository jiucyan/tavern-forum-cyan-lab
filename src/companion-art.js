const SPECIES_ART = Object.freeze({
    frog: {
        back: '',
        body: `
            <g class="tf-pixel-legs">
                <path class="tf-pixel-body-shadow" d="M9 43h10v7h-5v3H6v-5h3zM45 43h10v5h3v5h-8v-3h-5z"/>
                <path class="tf-pixel-body" d="M7 41h12v7h-5v3H5v-5h2zM45 41h12v5h2v5h-9v-3h-5z"/>
            </g>
            <path class="tf-pixel-body-shadow" d="M13 24h4v-7h4v-4h8v3h6v-3h8v4h4v7h4v20h-4v6h-8v4H25v-4h-8v-6h-4z"/>
            <path class="tf-pixel-body" d="M11 22h5v-7h5v-4h9v4h4v-4h9v4h5v7h5v20h-5v6h-8v4H24v-4h-8v-6h-5z"/>
            <path class="tf-pixel-light" d="M18 33h28v4h3v8h-5v4H20v-4h-5v-8h3z"/>
            <rect class="tf-pixel-light" x="18" y="17" width="9" height="9"/>
            <rect class="tf-pixel-light" x="37" y="17" width="9" height="9"/>
            <g class="tf-pixel-cheeks"><rect class="tf-pixel-accent" x="15" y="29" width="5" height="2"/><rect class="tf-pixel-accent" x="44" y="29" width="5" height="2"/></g>
        `,
        eyes: { left: 21, right: 39, y: 18 },
        faces: {
            default: '<path class="tf-pixel-ink" d="M25 31h3v2h8v-2h3v4h-3v2h-8v-2h-3z"/>',
            feed: '<path class="tf-pixel-ink" d="M27 31h10v3h2v5H25v-5h2z"/><rect class="tf-pixel-mouth-tongue" x="28" y="36" width="8" height="2"/>',
            sleep: '<rect class="tf-pixel-ink" x="28" y="33" width="8" height="2"/>',
        },
    },
    cat: {
        back: '<g class="tf-pixel-tail"><path class="tf-pixel-body-shadow" d="M47 38h9v-6h7v-8h6v22h-4v5H54v-5h8v-9h-5v6H47z"/></g>',
        body: `
            <path class="tf-pixel-body" d="M27 35h28v5h6v12H48v4H24v-8h3z"/>
            <path class="tf-pixel-body" d="M8 24V10h8l7 8h8l7-8h8v14h4v18h-5v6h-8v4H17v-4H9v-6H5V24z"/>
            <g class="tf-cat-ear-details"><g class="tf-cat-ear is-left"><path class="tf-pixel-body-shadow" d="M13 14v8h8z"/></g><g class="tf-cat-ear is-right"><path class="tf-pixel-body-shadow" d="M41 14v8h-8z"/></g></g>
            <g class="tf-pixel-legs"><path class="tf-pixel-body-shadow" d="M15 50h18v7H12v-4h3zM34 50h17v4h3v3H34z"/><path class="tf-pixel-light" d="M17 53h9v2h-9zM37 53h9v2h-9z"/></g>
        `,
        eyesMarkup: `
            <g class="tf-pixel-eyes tf-pixel-eyes-open">
                <path class="tf-pixel-accent" d="M15 27h9v3h2v8h-2v3h-9v-3h-2v-8h2zM32 27h9v3h2v8h-2v3h-9v-3h-2v-8h2z"/>
                <g class="tf-pixel-pupils"><path class="tf-pixel-ink" d="M18 30h5v8h-5zM35 30h5v8h-5z"/><path class="tf-pixel-light" d="M18 29h3v3h-3zM35 29h3v3h-3z"/></g>
            </g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-light" d="M14 34h3v-3h7v3h3v3h-3v-2h-7v2h-3zM30 34h3v-3h7v3h3v3h-3v-2h-7v2h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-light" x="14" y="35" width="12" height="2"/><rect class="tf-pixel-light" x="31" y="35" width="12" height="2"/></g>
        `,
        faces: {
            default: '<path class="tf-pixel-mouth-tongue" d="M26 40h5v3h-5z"/><path class="tf-pixel-light" d="M22 44h4v2h2v-2h4v3h-3v3h-4v-3h-3z"/>',
            feed: '<path class="tf-pixel-mouth-tongue" d="M26 40h5v3h-5z"/><path class="tf-pixel-light" d="M22 44h4v2h2v-2h4v3h-2v4h-6v-4h-2z"/><rect class="tf-pixel-mouth-tongue" x="25" y="48" width="4" height="2"/>',
            sleep: '<path class="tf-pixel-mouth-tongue" d="M26 40h5v3h-5z"/><rect class="tf-pixel-light" x="23" y="46" width="9" height="2"/>',
        },
    },
    rabbit: {
        back: '<g class="tf-pixel-tail"><path class="tf-pixel-body-shadow" d="M48 43h8v3h4v8h-4v4h-9v-4h-3v-7h4z"/><path class="tf-pixel-light" d="M49 42h7v3h4v8h-4v4h-8v-4h-3v-6h4z"/></g>',
        body: `
            <g class="tf-pixel-ears">
                <g class="tf-rabbit-ear is-left"><path class="tf-pixel-body-shadow" d="M14 13h10v10h-4v15h-3v11h-4v5H6v-3H2V31h3v-9h4v-5h5z"/><path class="tf-pixel-body" d="M15 15h7v8h-4v15h-3v10h-3v3H8v-3H5V32h3v-9h3v-5h4z"/><path class="tf-pixel-accent" d="M12 22h3v5h-1v12h-2v7H9V33h1v-7h2z"/></g>
                <g class="tf-rabbit-ear is-right"><path class="tf-pixel-body-shadow" d="M40 13h10v4h5v5h4v9h3v17h-4v4h-8v-4h-4V37h-3V24h-3z"/><path class="tf-pixel-body" d="M42 15h7v4h4v5h3v8h3v14h-3v3h-5v-3h-3V36h-3V24h-3z"/><path class="tf-pixel-accent" d="M48 22h3v4h2v7h2v12h-3v-7h-2V27h-2z"/></g>
            </g>
            <path class="tf-pixel-body-shadow" d="M23 40h18v3h5v5h2v9h-4v4H19v-4h-4v-9h2v-5h6z"/>
            <path class="tf-pixel-body" d="M24 40h16v3h5v5h2v8h-4v3H20v-3h-4v-8h2v-5h6z"/>
            <path class="tf-pixel-body-shadow" d="M24 8h16v3h7v4h5v6h4v16h-4v7h-6v5h-8v3H25v-3h-8v-5h-6v-7H8V23h3v-6h6v-4h7z"/>
            <path class="tf-pixel-body" d="M24 10h16v3h6v4h4v5h3v14h-3v6h-5v4h-8v3H26v-3h-8v-4h-5v-6h-3V24h3v-6h5v-3h6z"/>
            <g class="tf-rabbit-ear-seams"><path class="tf-pixel-body-shadow" d="M15 18h2v7h-1v12h-2V24h1z"/><path class="tf-pixel-body-shadow" d="M47 18h2v6h1v13h-2V25h-1z"/></g>
            <g class="tf-pixel-cheeks"><rect class="tf-pixel-accent" x="14" y="34" width="4" height="2" opacity=".42"/><rect class="tf-pixel-accent" x="46" y="34" width="4" height="2" opacity=".42"/></g>
            <g class="tf-pixel-paws"><path class="tf-pixel-body-shadow" d="M23 49h8v8H21v-6h2zM34 49h8v2h2v6H33v-8z"/><path class="tf-pixel-light" d="M24 50h6v5h-8v-4h2zM35 50h6v2h2v3h-9v-5z"/></g>
            <g class="tf-pixel-nose"><path class="tf-pixel-accent" d="M29 35h7v3h-2v2h-3v-2h-2z"/><rect class="tf-pixel-light" x="30" y="35" width="2" height="1"/></g>
        `,
        eyes: { left: 17, right: 40, y: 24, rabbit: true },
        faces: {
            default: '<path class="tf-pixel-ink" d="M30 40h3v2h2v-2h3v3h-3v2h-2v-2h-3z"/>',
            feed: '<path class="tf-pixel-ink" d="M29 40h7v2h2v4H27v-4h2z"/><rect class="tf-pixel-mouth-tongue" x="30" y="43" width="5" height="2"/>',
            sleep: '<path class="tf-pixel-ink" d="M30 41h3v2h2v-2h3v3h-3v2h-2v-2h-3z"/>',
        },
    },
    fox: {
        back: '<g class="tf-pixel-tail"><path class="tf-pixel-body-shadow" d="M36 39h6v-8h5v-6h7v-4h6v4h3v8h1v13h-3v7h-7v4H43v-5h-8z"/><path class="tf-pixel-body" d="M35 37h6v-8h5v-6h8v-4h6v4h3v8h1v14h-3v6h-7v4H42v-5h-8z"/><path class="tf-pixel-light" d="M54 21h6v3h3v8h-3v4h-6v-4h-3v-7h3z"/></g>',
        body: `
            <g class="tf-pixel-ears"><g class="tf-fox-ear is-left"><path class="tf-pixel-body-shadow" d="M10 21V7h8l10 10h4v11z"/><path class="tf-pixel-body" d="M8 20V5h10l11 12v9z"/><path class="tf-pixel-accent" d="M13 11h5l8 9H13z"/></g><g class="tf-fox-ear is-right"><path class="tf-pixel-body-shadow" d="M34 27V17h3L47 7h8v15z"/><path class="tf-pixel-body" d="M35 26v-9L46 5h10v16z"/><path class="tf-pixel-accent" d="M38 20l8-9h5v9z"/></g></g>
            <path class="tf-pixel-body-shadow" d="M22 36h21v3h5v6h3v12h-5v4H18v-4h-4V45h3v-6h5z"/>
            <path class="tf-pixel-body" d="M23 35h19v3h5v6h3v11h-5v4H19v-4h-4V45h3v-6h5z"/>
            <g class="tf-pixel-legs"><path class="tf-pixel-accent" d="M17 49h13v9h-3v3H14v-4h3zM36 49h12v8h3v4H36z"/><path class="tf-pixel-body" d="M19 47h10v8H17v-5h2zM37 47h9v3h3v5H36v-8z"/><rect class="tf-pixel-light" x="19" y="56" width="8" height="2"/><rect class="tf-pixel-light" x="39" y="56" width="8" height="2"/></g>
            <path class="tf-pixel-body-shadow" d="M18 16h7v-3h15v3h7v4h5v6h3v13h-4v6h-7v5h-8v3H28v-3h-8v-5h-7v-6H9V26h3v-6h6z"/>
            <path class="tf-pixel-body" d="M18 14h7v-3h15v3h7v4h5v6h3v13h-4v6h-7v5h-8v3H28v-3h-8v-5h-7v-6H9V24h3v-6h6z"/>
            <path class="tf-pixel-light" d="M14 32h11v3h4v4h6v-4h4v-3h11v10h-4v5h-8v4H26v-4h-8v-5h-4z"/>
            <g class="tf-pixel-cheeks"><rect class="tf-pixel-light" x="12" y="36" width="7" height="4"/><rect class="tf-pixel-light" x="46" y="36" width="7" height="4"/></g>
            <rect class="tf-pixel-ink" x="30" y="35" width="5" height="4"/>
        `,
        eyes: { left: 18, right: 40, y: 24, fox: true },
        faces: {
            default: '<path class="tf-pixel-ink" d="M27 40h4v2h3v-2h4v3h-3v3h-5v-3h-3z"/>',
            feed: '<path class="tf-pixel-ink" d="M28 40h9v2h2v5H26v-5h2z"/><rect class="tf-pixel-mouth-tongue" x="30" y="44" width="5" height="2"/>',
            sleep: '<path class="tf-pixel-ink" d="M28 42h9v2h-9z"/>',
        },
    },
    penguin: {
        back: '',
        body: `
            <g class="tf-pixel-wings"><g class="tf-penguin-wing is-left"><path class="tf-pixel-body-shadow" d="M11 26h9v20h-3v6H9v-4H6V32h3v-6z"/><path class="tf-pixel-body" d="M10 24h9v20h-3v6H9v-4H7V31h3z"/></g><g class="tf-penguin-wing is-right"><path class="tf-pixel-body-shadow" d="M45 24h9v4h4v14h-3v6h-8v-4h-2z"/><path class="tf-pixel-body" d="M46 22h8v4h4v14h-3v6h-7v-4h-2z"/></g></g>
            <path class="tf-pixel-body-shadow" d="M24 9h16v3h6v4h5v6h4v20h-3v7h-5v6h-8v4H25v-4h-8v-6h-5v-7H9V22h4v-6h5v-4h6z"/>
            <path class="tf-pixel-body" d="M24 7h16v3h6v4h5v6h4v20h-3v7h-5v6h-8v4H25v-4h-8v-6h-5v-7H9V20h4v-6h5v-4h6z"/>
            <path class="tf-pixel-light" d="M20 18h9v2h3v3h3v-3h3v-2h8v3h3v10h-3v4h-8v3H27v-3h-8v-4h-3V21h4z"/>
            <path class="tf-pixel-light" d="M23 35h18v3h4v5h2v7h-4v5H21v-5h-4v-7h2v-5h4z"/>
            <path class="tf-pixel-accent" d="M30 31h6v2h2v3h-2v2h-6v-2h-2v-3h2z"/>
            <g class="tf-pixel-legs"><path class="tf-pixel-accent" d="M17 52h12v3h3v4h-5v2H12v-4h5zM36 52h11v3h5v4H38v-2h-5v-4h3z"/></g>
        `,
        eyes: { left: 22, right: 38, y: 22 },
        faces: {
            default: '<rect class="tf-pixel-ink" x="31" y="35" width="4" height="1"/>',
            feed: '<path class="tf-pixel-ink" d="M30 34h6v2h2v3h-2v2h-6v-2h-2v-3h2z"/><rect class="tf-pixel-mouth-tongue" x="31" y="38" width="4" height="2"/>',
            sleep: '<rect class="tf-pixel-ink" x="31" y="35" width="4" height="1"/>',
        },
    },
    octopus: {
        back: `
            <g class="tf-pixel-tentacles tf-octopus-arms-back">
                <g class="tf-octopus-arm is-left"><path class="tf-pixel-body-shadow" d="M18 35H9v4H4v10h3v5h9v-3h5v-8h-5v4h-5v-6h7z"/><path class="tf-pixel-body" d="M17 33H8v4H3v10h3v5h9v-3h5v-8h-5v4h-5v-6h7z"/><rect class="tf-pixel-light" x="6" y="39" width="3" height="7"/></g>
                <g class="tf-octopus-arm is-right"><path class="tf-pixel-body-shadow" d="M46 35h9v4h5v10h-3v5h-9v-3h-5v-8h5v4h5v-6h-7z"/><path class="tf-pixel-body" d="M47 33h9v4h5v10h-3v5h-9v-3h-5v-8h5v4h5v-6h-7z"/><rect class="tf-pixel-light" x="55" y="39" width="3" height="7"/></g>
            </g>
        `,
        body: `
            <g class="tf-pixel-tentacles tf-octopus-arms-front">
                <g class="tf-octopus-arm is-front-left"><path class="tf-pixel-body-shadow" d="M14 39h12v5h3v8h-4v5H14v-4h-4v-8h4z"/><path class="tf-pixel-body" d="M13 37h12v5h3v8h-4v5H13v-4H9v-8h4z"/><rect class="tf-pixel-accent" x="14" y="49" width="7" height="2"/></g>
                <g class="tf-octopus-arm is-front-mid"><path class="tf-pixel-body-shadow" d="M26 40h13v5h3v8h-4v5H27v-4h-4v-9h3z"/><path class="tf-pixel-body" d="M25 38h13v5h3v8h-4v5H26v-4h-4v-9h3z"/><rect class="tf-pixel-accent" x="29" y="51" width="6" height="2"/></g>
                <g class="tf-octopus-arm is-front-right"><path class="tf-pixel-body-shadow" d="M39 39h12v4h4v9h-4v5H40v-4h-4v-9h3z"/><path class="tf-pixel-body" d="M38 37h12v4h4v9h-4v5H39v-4h-4v-9h3z"/><rect class="tf-pixel-accent" x="43" y="49" width="6" height="2"/></g>
            </g>
            <path class="tf-pixel-body-shadow" d="M21 10h22v3h6v5h5v7h3v14h-4v5h-7v4H18v-4h-7v-5H7V25h3v-7h5v-5h6z"/>
            <path class="tf-pixel-body" d="M20 8h22v3h6v5h5v7h3v14h-4v5h-7v4H18v-4h-7v-5H7V23h3v-7h5v-5h5z"/>
            <path class="tf-pixel-light" d="M19 12h8v3h-5v3h-4v11h-4V19h2v-4h3zM20 39h24v3h-5v2H25v-2h-5z"/>
            <g class="tf-pixel-cheeks"><rect class="tf-pixel-accent" x="15" y="31" width="5" height="3"/><rect class="tf-pixel-accent" x="44" y="31" width="5" height="3"/></g>
        `,
        eyes: { left: 19, right: 38, y: 21, octopus: true },
        faces: {
            default: '<path class="tf-pixel-ink" d="M28 34h3v2h3v-2h3v3h-2v2h-6v-2h-1z"/>',
            feed: '<path class="tf-pixel-ink" d="M29 34h7v2h2v4h-2v2h-8v-2h-2v-4h3z"/><rect class="tf-pixel-mouth-tongue" x="30" y="38" width="5" height="2"/>',
            sleep: '<path class="tf-pixel-ink" d="M28 36h3v1h3v-1h3v3h-9z"/>',
        },
    },
    goldfish: {
        back: `
            <g class="tf-pixel-tail tf-betta-tail">
                <path class="tf-pixel-body-shadow" d="M38 22h7v-5h5v-5h5V7h7v16h2v18h-2v17h-7v-5h-5v-5h-5v-5h-7z"/>
                <path class="tf-pixel-accent" d="M37 20h7v-5h5v-5h5V5h8v16h2v18h-2v17h-8v-5h-5v-5h-5v-5h-7z"/>
                <path class="tf-pixel-light" d="M43 21h5v-5h5v-4h5v12h3v12h-3v12h-5v-4h-5v-5h-5z"/>
                <path class="tf-pixel-body" d="M43 27h8v-4h5v5h5v6h-5v5h-5v-4h-8z"/>
            </g>
        `,
        body: `
            <g class="tf-pixel-fins">
                <g class="tf-betta-fin is-dorsal"><path class="tf-pixel-body-shadow" d="M21 23v-8h5V9h5v3h6v3h6v10z"/><path class="tf-pixel-accent" d="M20 21v-8h5V7h5v3h6v3h6v10z"/><path class="tf-pixel-light" d="M26 12h4v3h6v3H24z"/></g>
                <g class="tf-betta-fin is-ventral"><path class="tf-pixel-body-shadow" d="M21 42h23v6h-4v6h-5v6h-5V49h-4v8h-5z"/><path class="tf-pixel-accent" d="M20 40h23v6h-4v6h-5v6h-5V47h-4v8h-5z"/><path class="tf-pixel-light" d="M26 44h11v4h-3v5h-3v-6h-5z"/></g>
            </g>
            <path class="tf-pixel-body-shadow" d="M13 20h19v3h7v5h5v13h-5v5h-7v4H13v-4H8v-5H4V28h4v-5h5z"/>
            <path class="tf-pixel-body" d="M12 18h19v3h7v5h5v13h-5v5h-7v4H12v-4H7v-5H3V26h4v-5h5z"/>
            <path class="tf-pixel-light" d="M13 22h8v3h-4v3h-3v11h4v4h-6v-3H8V28h3v-4h2z"/>
            <g class="tf-pixel-scales"><path class="tf-pixel-accent" d="M28 25h5v5h-5zM34 31h5v5h-5zM28 37h5v5h-5z"/></g>
            <g class="tf-betta-fin is-pectoral"><path class="tf-pixel-accent" d="M24 32h9v4h4v5h-5v4h-8z"/><path class="tf-pixel-light" d="M26 35h5v3h3v2h-8z"/></g>
            <g class="tf-betta-bubble-mouth"><path class="tf-pixel-ink" d="M2 33h4v1h2v4H6v2H2v-2H0v-4h2z"/><rect class="tf-pixel-light" x="2" y="35" width="3" height="2"/></g>
        `,
        eyes: { left: 11, right: 0, y: 25, fish: true },
        faces: {
            default: '<path class="tf-pixel-ink" d="M3 34h4v-2h4v3H8v3H3z"/>',
            feed: '<path class="tf-pixel-ink" d="M2 32h7v2h2v5H9v2H2z"/><rect class="tf-pixel-mouth-tongue" x="3" y="36" width="5" height="2"/>',
            sleep: '<rect class="tf-pixel-ink" x="3" y="35" width="7" height="2"/>',
        },
    },
    soot: {
        back: '',
        body: `
            <g class="tf-pixel-legs"><path class="tf-pixel-ink" d="M19 47h4v8h-3v4h-7v-4h5v-8zM42 47h4v8h5v4h-7v-4h-3v-8z"/></g>
            <g class="tf-pixel-soot-fuzz">
                <path class="tf-pixel-body-shadow" d="M23 9h5V5h11v4h8v4h6v6h5v7h4v15h-5v7h-7v5h-9v4H23v-4h-9v-5H7v-7H3V27h4v-8h5v-6h6V9z"/>
                <path class="tf-pixel-body" d="M22 7h5V3h13v4h8v4h7v6h5v8h4v15h-5v8h-8v5h-9v4H22v-4h-9v-5H5v-8H1V25h4v-8h5v-6h7V7z"/>
                <path class="tf-pixel-body" d="M8 21H3v-5h8zM54 15h7v6h-5zM3 43H0v-8h6zM57 42h7v6h-9zM14 8h7v5h-9zM43 5h6v8h-4z"/>
                <g class="tf-pixel-soot-dust"><rect class="tf-pixel-accent" x="9" y="18" width="2" height="2"/><rect class="tf-pixel-accent" x="51" y="13" width="2" height="2"/><rect class="tf-pixel-accent" x="58" y="33" width="2" height="2"/><rect class="tf-pixel-accent" x="6" y="46" width="2" height="2"/></g>
            </g>
            <g class="tf-pixel-arms"><path class="tf-pixel-ink" d="M7 32H2v4h-2v3h9zM57 32h5v4h2v3h-9z"/></g>
        `,
        eyes: { left: 18, right: 37, y: 24, soot: true },
        faces: {
            default: '',
            feed: '<path class="tf-pixel-light" d="M29 39h7v2h2v5H27v-5h2z"/><rect class="tf-pixel-mouth-tongue" x="30" y="43" width="5" height="2"/>',
            sleep: '',
        },
    },
    'robo-bird': {
        back: '<g class="tf-pixel-tail"><path class="tf-pixel-body-shadow" d="M23 31H7v5H2v5h20zM24 38H4v5H0v5h23zM25 45H9v5H5v5h18z"/><path class="tf-pixel-body" d="M22 29H7v5H2v5h20zM23 36H4v5H0v5h23zM24 43H9v5H5v5h18z"/><path class="tf-pixel-light" d="M8 32h11v3H8zM5 39h14v3H5z"/><rect class="tf-pixel-accent" x="10" y="46" width="10" height="3"/></g>',
        body: `
            <g class="tf-pixel-antenna"><path class="tf-pixel-body-shadow" d="M43 14h-3V8h3V4h5v5h-3z"/><path class="tf-pixel-accent" d="M41 12h-3V7h3V3h5v5h-3z"/><rect class="tf-pixel-light" x="42" y="4" width="3" height="3"/></g>
            <path class="tf-pixel-body-shadow" d="M20 22h21v3h7v6h4v11h-4v6h-7v5H20v-4h-6v-6h-4V32h4v-6h6z"/>
            <path class="tf-pixel-body" d="M19 20h21v3h7v6h4v11h-4v6h-7v5H19v-4h-6v-6H9V30h4v-6h6z"/>
            <path class="tf-pixel-body-shadow" d="M39 13h12v3h5v5h3v13h-3v5h-6v3H37v-4h-4V21h3v-5h3z"/>
            <path class="tf-pixel-body" d="M38 11h12v3h5v5h3v13h-3v5h-6v3H36v-4h-4V19h3v-5h3z"/>
            <path class="tf-pixel-accent" d="M55 23h5v3h4v4h-4v3h-5z"/><rect class="tf-pixel-light" x="57" y="25" width="3" height="2"/>
            <g class="tf-pixel-wings"><g class="tf-robo-wing is-left"><path class="tf-pixel-body-shadow" d="M17 26h18v3h5v12h-4v5h-7v4H17v-4h-4V31h4z"/><path class="tf-pixel-light" d="M17 24h17v3h5v12h-4v5h-7v4H17v-4h-3V29h3z"/><path class="tf-pixel-body" d="M20 29h12v3h4v6h-4v4H20v-3h-3v-6h3z"/><rect class="tf-pixel-accent" x="22" y="31" width="6" height="6"/><rect class="tf-pixel-body-shadow" x="24" y="33" width="3" height="3"/></g></g>
            <path class="tf-pixel-light" d="M38 32h10v3h4v4H35v-4h3z"/>
            <g class="tf-pixel-legs"><path class="tf-pixel-accent" d="M23 47h4v9h-5v3h11v-3h-5v-9zM38 46h4v10h5v3H35v-3h4V46z"/><rect class="tf-pixel-body-shadow" x="24" y="47" width="3" height="8"/><rect class="tf-pixel-body-shadow" x="39" y="46" width="3" height="9"/></g>
        `,
        eyes: { left: 42, right: 0, y: 20, bird: true },
        faces: {
            default: '<rect class="tf-pixel-ink" x="56" y="29" width="4" height="1"/>',
            feed: '<path class="tf-pixel-ink" d="M55 27h6v2h3v3h-3v2h-6z"/><rect class="tf-pixel-mouth-tongue" x="58" y="30" width="4" height="2"/>',
            sleep: '<rect class="tf-pixel-ink" x="56" y="29" width="4" height="1"/>',
        },
    },
    mystery: {
        back: '',
        body: '<path class="tf-pixel-body-shadow" d="M16 20h5v-5h22v5h5v5h5v21h-5v6h-9v4H25v-4h-9v-6h-5V25h5z"/><path class="tf-pixel-body" d="M14 18h6v-5h24v5h6v5h5v21h-5v6h-10v4H24v-4H14v-6H9V23h5z"/><path class="tf-pixel-light" d="M20 34h24v13H20z"/>',
        eyes: { left: 22, right: 39, y: 25 },
        faces: {
            default: '<rect class="tf-pixel-ink" x="27" y="39" width="10" height="2"/>',
            feed: '<rect class="tf-pixel-ink" x="27" y="38" width="10" height="6"/>',
            sleep: '<rect class="tf-pixel-ink" x="27" y="40" width="10" height="2"/>',
        },
    },
});

const ACCESSORY_KEYS = Object.freeze(['scarf', 'satchel', 'flower', 'charm', 'ribbon', 'glasses', 'crown', 'leaf', 'headphones', 'cape', 'bell']);

function wearable(slot, anchor, material, layers) {
    return Object.freeze({ slot, anchor, material, ...layers });
}

function flowerPin(x, y) {
    return `<g class="tf-wearable-detail is-flower-pin" transform="translate(${x} ${y})"><rect class="tf-pixel-accessory-stem" x="5" y="7" width="2" height="7"/><path class="tf-pixel-accessory-shadow" d="M3 1h5v2h3v5H8v3H3V8H0V3h3z" transform="translate(1 1)"/><path d="M3 1h5v2h3v5H8v3H3V8H0V3h3z"/><rect class="tf-pixel-accessory-light" x="4" y="4" width="3" height="3"/></g>`;
}

function ribbonPin(x, y) {
    return `<g class="tf-wearable-detail is-ribbon-pin" transform="translate(${x} ${y})"><path class="tf-pixel-accessory-shadow" d="M1 1h5l3 3 3-3h5l3 3v5l-3 3h-5l-3-3-3 3H1l-3-3V4z" transform="translate(1 1)"/><path d="M1 1h5l3 3 3-3h5l3 3v5l-3 3h-5l-3-3-3 3H1l-3-3V4z"/><rect class="tf-pixel-accessory-light" x="6" y="4" width="6" height="5"/></g>`;
}

function crownPin(x, y) {
    return `<g class="tf-wearable-detail is-crown-pin" transform="translate(${x} ${y})"><path class="tf-pixel-accessory-shadow" d="M0 3l4 3 3-6 4 6 5-3v10H0z" transform="translate(1 1)"/><path d="M0 3l4 3 3-6 4 6 5-3v10H0z"/><rect class="tf-pixel-accessory-light" x="2" y="9" width="12" height="2"/><rect class="tf-pixel-accessory-jewel" x="6" y="6" width="3" height="3"/></g>`;
}

function leafPin(x, y) {
    return `<g class="tf-wearable-detail is-leaf-pin" transform="translate(${x} ${y})"><path class="tf-pixel-accessory-shadow" d="M1 4h3V1h10v3h3v6h-5v3H3v-3H1z" transform="translate(1 1)"/><path d="M1 4h3V1h10v3h3v6h-5v3H3v-3H1z"/><path class="tf-pixel-accessory-light" d="M5 4h7v2H9v3H5z"/><rect class="tf-pixel-accessory-stem" x="1" y="11" width="13" height="2"/></g>`;
}

function pairGlasses(left, right, y, width = 11, height = 9) {
    const bridgeStart = left + width;
    const bridgeWidth = right - bridgeStart;
    return `<path class="tf-pixel-accessory-line is-thin" d="M${left - 4} ${y + 3}h4M${bridgeStart} ${y + 3}h${bridgeWidth}M${right + width} ${y + 3}h4"/><rect class="tf-pixel-accessory-frame" x="${left}" y="${y}" width="${width}" height="${height}"/><rect class="tf-pixel-accessory-frame" x="${right}" y="${y}" width="${width}" height="${height}"/><rect class="tf-pixel-accessory-glint" x="${left + 2}" y="${y + 2}" width="3" height="2"/><rect class="tf-pixel-accessory-glint" x="${right + 2}" y="${y + 2}" width="3" height="2"/>`;
}

function charmDrop(x, y, cordStart, cordEnd, cordY) {
    return `<path class="tf-pixel-accessory-line is-thin" d="M${cordStart} ${cordY}h${cordEnd - cordStart}"/><path class="tf-pixel-accessory-shadow" d="M${x} ${y}h5v3h3v5h-3v3h-5v-3h-3v-5h3z" transform="translate(1 1)"/><path d="M${x} ${y}h5v3h3v5h-3v3h-5v-3h-3v-5h3z"/><rect class="tf-pixel-accessory-light" x="${x + 1}" y="${y + 3}" width="3" height="3"/>`;
}

function bellDrop(x, y, cordStart, cordEnd, cordY) {
    return `<path class="tf-pixel-accessory-line is-thin" d="M${cordStart} ${cordY}h${cordEnd - cordStart}"/><path class="tf-pixel-accessory-shadow" d="M${x} ${y}h7v3h3v6h3v3h-19v-3h3v-6h3z" transform="translate(1 1)"/><path d="M${x} ${y}h7v3h3v6h3v3h-19v-3h3v-6h3z"/><rect class="tf-pixel-accessory-light" x="${x + 1}" y="${y + 3}" width="4" height="3"/><rect class="tf-pixel-accessory-shadow" x="${x + 1}" y="${y + 12}" width="5" height="2"/>`;
}

function headphones(left, right, top, padY, padHeight = 15) {
    return {
        back: `<path class="tf-pixel-accessory-line is-wide" d="M${left + 4} ${padY + 4}V${top + 8}C${left + 4} ${top + 1} ${right - 4} ${top + 1} ${right - 4} ${padY + 4}"/>`,
        front: `<path class="tf-pixel-accessory-shadow" d="M${left} ${padY}h9v${padHeight}h-9zM${right - 9} ${padY}h9v${padHeight}h-9z" transform="translate(1 1)"/><path d="M${left} ${padY}h9v${padHeight}h-9zM${right - 9} ${padY}h9v${padHeight}h-9z"/><rect class="tf-pixel-accessory-light" x="${left + 3}" y="${padY + 3}" width="3" height="${Math.max(4, padHeight - 6)}"/><rect class="tf-pixel-accessory-light" x="${right - 6}" y="${padY + 3}" width="3" height="${Math.max(4, padHeight - 6)}"/>`,
    };
}

const SPECIES_ACCESSORIES = Object.freeze({
    frog: Object.freeze({
        scarf: wearable('neck', 'collar', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M18 39h28v5H18zM39 43h7v13h-4v-6h-3z" transform="translate(1 1)"/><path d="M18 39h28v5H18zM39 43h7v13h-4v-6h-3z"/><rect class="tf-pixel-accessory-light" x="21" y="40" width="15" height="2"/>' }),
        satchel: wearable('side', 'right-flank', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M24 31l24 19"/>', front: '<path class="tf-pixel-accessory-shadow" d="M40 43h14v12H40z" transform="translate(1 1)"/><path d="M40 43h14v12H40z"/><rect class="tf-pixel-accessory-light" x="43" y="45" width="8" height="2"/><rect class="tf-pixel-accessory-shadow" x="46" y="49" width="3" height="3"/>' }),
        flower: wearable('head', 'right-eye-ridge', 'botanical', { front: flowerPin(41, 8) }),
        charm: wearable('neck', 'belly-cord', 'crystal', { front: charmDrop(30, 44, 22, 43, 42) }),
        ribbon: wearable('head', 'between-eyes', 'ribbon', { front: ribbonPin(23, 7) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(16, 36, 17, 12, 10) }),
        crown: wearable('head', 'between-eyes', 'royal', { front: crownPin(24, 4) }),
        leaf: wearable('head', 'right-eye-ridge', 'botanical', { front: leafPin(38, 7) }),
        headphones: wearable('head', 'eye-ridges', 'tech', headphones(8, 57, 6, 19, 15)),
        cape: wearable('back', 'left-shoulder', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M14 28h14l5 6-8 24H5l5-23z" transform="translate(1 1)"/><path d="M14 28h14l5 6-8 24H5l5-23z"/><path class="tf-pixel-accessory-light" d="M15 30h10l3 4-15 4z"/>', front: '<path d="M10 34h8v4h-5v3H9v-5zM47 34h8v2h2v5h-4v-3h-6z"/><rect class="tf-pixel-accessory-jewel" x="30" y="39" width="4" height="3"/>' }),
        bell: wearable('neck', 'belly-cord', 'metal', { front: bellDrop(30, 44, 21, 44, 41) }),
    }),
    cat: Object.freeze({
        scarf: wearable('neck', 'chest', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M22 49h28v4H22zM42 52h7v9h-4v-4h-3z" transform="translate(1 1)"/><path d="M22 49h28v4H22zM42 52h7v9h-4v-4h-3z"/><rect class="tf-pixel-accessory-light" x="25" y="50" width="14" height="2"/>' }),
        satchel: wearable('side', 'right-hip', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M25 35l26 18"/>', front: '<path class="tf-pixel-accessory-shadow" d="M45 47h13v11H45z" transform="translate(1 1)"/><path d="M45 47h13v11H45z"/><rect class="tf-pixel-accessory-light" x="48" y="49" width="7" height="2"/><rect class="tf-pixel-accessory-shadow" x="50" y="53" width="3" height="3"/>' }),
        flower: wearable('head', 'right-ear', 'botanical', { front: flowerPin(44, 8) }),
        charm: wearable('neck', 'collar', 'crystal', { front: charmDrop(32, 49, 25, 47, 46) }),
        ribbon: wearable('head', 'right-ear', 'ribbon', { front: ribbonPin(42, 8) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(15, 37, 25, 12, 10) }),
        crown: wearable('head', 'forehead', 'royal', { front: crownPin(25, 5) }),
        leaf: wearable('head', 'right-ear', 'botanical', { front: leafPin(42, 7) }),
        headphones: wearable('head', 'ear-pair', 'tech', headphones(8, 59, 5, 24, 16)),
        cape: wearable('back', 'left-shoulder', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M18 31h14l5 7-8 23H9l5-23z" transform="translate(1 1)"/><path d="M18 31h14l5 7-8 23H9l5-23z"/><path class="tf-pixel-accessory-light" d="M19 33h10l3 4-15 5z"/>', front: '<path d="M13 40h8v5h-5v3h-4v-6zM49 40h8v2h2v6h-4v-3h-6z"/><rect class="tf-pixel-accessory-jewel" x="31" y="50" width="4" height="3"/>' }),
        bell: wearable('neck', 'collar', 'metal', { front: bellDrop(32, 49, 24, 48, 46) }),
    }),
    rabbit: Object.freeze({
        scarf: wearable('neck', 'under-chin', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M19 47h27v4H19zM39 50h7v10h-4v-5h-3z" transform="translate(1 1)"/><path d="M19 47h27v4H19zM39 50h7v10h-4v-5h-3z"/><rect class="tf-pixel-accessory-light" x="22" y="48" width="14" height="2"/>' }),
        satchel: wearable('side', 'right-paw', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M24 39l24 16"/>', front: '<path class="tf-pixel-accessory-shadow" d="M42 48h13v10H42z" transform="translate(1 1)"/><path d="M42 48h13v10H42z"/><rect class="tf-pixel-accessory-light" x="45" y="50" width="7" height="2"/>' }),
        flower: wearable('head', 'right-ear-root', 'botanical', { front: flowerPin(43, 13) }),
        charm: wearable('neck', 'under-chin', 'crystal', { front: charmDrop(31, 47, 24, 43, 45) }),
        ribbon: wearable('head', 'left-ear-root', 'ribbon', { front: ribbonPin(10, 17) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(13, 39, 24, 11, 9) }),
        crown: wearable('head', 'between-ears', 'royal', { front: crownPin(24, 9) }),
        leaf: wearable('head', 'left-ear-root', 'botanical', { front: leafPin(8, 18) }),
        headphones: wearable('head', 'cheek-pair', 'tech', headphones(6, 58, 14, 29, 14)),
        cape: wearable('back', 'left-shoulder', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M17 34h13l5 6-8 20H8l5-20z" transform="translate(1 1)"/><path d="M17 34h13l5 6-8 20H8l5-20z"/><path class="tf-pixel-accessory-light" d="M18 36h9l3 4-14 4z"/>', front: '<path d="M11 40h8v5h-4v3h-4zM46 40h8v3h2v5h-5v-3h-5z"/><rect class="tf-pixel-accessory-jewel" x="31" y="50" width="4" height="3"/>' }),
        bell: wearable('neck', 'under-chin', 'metal', { front: bellDrop(31, 47, 23, 44, 45) }),
    }),
    fox: Object.freeze({
        scarf: wearable('neck', 'chest', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M20 47h29v4H20zM41 50h8v10h-4v-5h-4z" transform="translate(1 1)"/><path d="M20 47h29v4H20zM41 50h8v10h-4v-5h-4z"/><rect class="tf-pixel-accessory-light" x="23" y="48" width="15" height="2"/>' }),
        satchel: wearable('side', 'right-hip', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M23 34l29 20"/>', front: '<path class="tf-pixel-accessory-shadow" d="M45 47h14v11H45z" transform="translate(1 1)"/><path d="M45 47h14v11H45z"/><rect class="tf-pixel-accessory-light" x="48" y="49" width="8" height="2"/><rect class="tf-pixel-accessory-shadow" x="51" y="53" width="3" height="3"/>' }),
        flower: wearable('head', 'right-ear', 'botanical', { front: flowerPin(44, 7) }),
        charm: wearable('neck', 'chest', 'crystal', { front: charmDrop(32, 48, 24, 46, 45) }),
        ribbon: wearable('head', 'right-ear', 'ribbon', { front: ribbonPin(42, 8) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(14, 38, 24, 11, 9) }),
        crown: wearable('head', 'forehead', 'royal', { front: crownPin(24, 4) }),
        leaf: wearable('head', 'right-ear', 'botanical', { front: leafPin(42, 7) }),
        headphones: wearable('head', 'ear-pair', 'tech', headphones(7, 58, 4, 23, 16)),
        cape: wearable('back', 'left-shoulder', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M16 30h16l5 7-9 24H7l5-24z" transform="translate(1 1)"/><path d="M16 30h16l5 7-9 24H7l5-24z"/><path class="tf-pixel-accessory-light" d="M17 32h11l3 4-16 5z"/>', front: '<path d="M10 38h8v5h-4v3h-4zM49 38h8v3h2v5h-5v-3h-5z"/><rect class="tf-pixel-accessory-jewel" x="31" y="49" width="4" height="3"/>' }),
        bell: wearable('neck', 'chest', 'metal', { front: bellDrop(32, 48, 23, 47, 45) }),
    }),
    penguin: Object.freeze({
        scarf: wearable('neck', 'white-bib', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M20 39h27v5H20zM39 43h7v12h-4v-6h-3z" transform="translate(1 1)"/><path d="M20 39h27v5H20zM39 43h7v12h-4v-6h-3z"/><rect class="tf-pixel-accessory-light" x="23" y="40" width="14" height="2"/>' }),
        satchel: wearable('side', 'right-wing', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M24 31l26 21"/>', front: '<path class="tf-pixel-accessory-shadow" d="M43 45h14v11H43z" transform="translate(1 1)"/><path d="M43 45h14v11H43z"/><rect class="tf-pixel-accessory-light" x="46" y="47" width="8" height="2"/>' }),
        flower: wearable('head', 'right-temple', 'botanical', { front: flowerPin(40, 10) }),
        charm: wearable('neck', 'white-bib', 'crystal', { front: charmDrop(31, 43, 24, 43, 40) }),
        ribbon: wearable('head', 'right-temple', 'ribbon', { front: ribbonPin(40, 10) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(18, 36, 21, 11, 9) }),
        crown: wearable('head', 'forehead', 'royal', { front: crownPin(25, 4) }),
        leaf: wearable('head', 'right-temple', 'botanical', { front: leafPin(39, 9) }),
        headphones: wearable('head', 'side-pair', 'tech', headphones(8, 57, 5, 23, 16)),
        cape: wearable('back', 'left-wing', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M15 27h14l5 7-8 25H6l5-25z" transform="translate(1 1)"/><path d="M15 27h14l5 7-8 25H6l5-25z"/><path class="tf-pixel-accessory-light" d="M16 29h10l3 4-15 5z"/>', front: '<path d="M9 34h8v6h-4v3H9zM48 34h8v3h2v6h-5v-3h-5z"/><rect class="tf-pixel-accessory-jewel" x="31" y="42" width="4" height="3"/>' }),
        bell: wearable('neck', 'white-bib', 'metal', { front: bellDrop(31, 43, 23, 44, 40) }),
    }),
    'robo-bird': Object.freeze({
        scarf: wearable('neck', 'neck-joint', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M34 32h19v5h-6v4h-4v13h-6V40h-4z" transform="translate(1 1)"/><path d="M34 32h19v5h-6v4h-4v13h-6V40h-4z"/><rect class="tf-pixel-accessory-light" x="37" y="33" width="11" height="2"/>' }),
        satchel: wearable('side', 'cargo-rail', 'tech', { back: '<path class="tf-pixel-accessory-line is-thin" d="M15 27h20v18"/>', front: '<path class="tf-pixel-accessory-shadow" d="M15 36h18v14H15z" transform="translate(1 1)"/><path d="M15 36h18v14H15z"/><rect class="tf-pixel-accessory-light" x="18" y="39" width="12" height="3"/><rect class="tf-pixel-accessory-jewel" x="21" y="44" width="4" height="3"/>' }),
        flower: wearable('head', 'antenna-port', 'tech', { front: '<g class="tf-wearable-detail is-solar-bloom"><rect class="tf-pixel-accessory-line" x="42" y="4" width="2" height="9"/><path class="tf-pixel-accessory-shadow" d="M38 1h4v3h3V1h4v4h3v4h-5v4H40V9h-5V5h3z"/><path d="M37 0h4v3h3V0h4v4h3v4h-5v4h-7V8h-5V4h3z"/><rect class="tf-pixel-accessory-jewel" x="41" y="4" width="4" height="4"/></g>' }),
        charm: wearable('neck', 'wing-port', 'tech', { front: '<path class="tf-pixel-accessory-line is-thin" d="M25 43h18"/><path class="tf-pixel-accessory-shadow" d="M31 45h7v7h-7z" transform="translate(1 1)"/><path d="M31 45h7v7h-7z"/><rect class="tf-pixel-accessory-jewel" x="33" y="47" width="3" height="3"/>' }),
        ribbon: wearable('head', 'wing-badge', 'tech', { front: '<path class="tf-pixel-accessory-shadow" d="M18 29h6l4 3 4-3h6v9h-6l-4-3-4 3h-6z" transform="translate(1 1)"/><path d="M18 29h6l4 3 4-3h6v9h-6l-4-3-4 3h-6z"/><rect class="tf-pixel-accessory-light" x="26" y="31" width="4" height="4"/>' }),
        glasses: wearable('face', 'optic-port', 'tech', { front: '<path class="tf-pixel-accessory-line is-thin" d="M36 24h5m13 0h7M52 29l6 8"/><rect class="tf-pixel-accessory-frame" x="40" y="17" width="15" height="14"/><rect class="tf-pixel-accessory-glint" x="43" y="20" width="5" height="3"/><rect class="tf-pixel-accessory-jewel" x="52" y="31" width="4" height="3"/>' }),
        crown: wearable('head', 'signal-mast', 'tech', { front: '<path class="tf-pixel-accessory-shadow" d="M34 7l5 3 4-7 5 7 6-3v11H34z" transform="translate(1 1)"/><path d="M34 7l5 3 4-7 5 7 6-3v11H34z"/><rect class="tf-pixel-accessory-light" x="37" y="14" width="14" height="2"/><rect class="tf-pixel-accessory-jewel" x="42" y="10" width="4" height="3"/>' }),
        leaf: wearable('head', 'solar-port', 'botanical', { front: '<path class="tf-pixel-accessory-shadow" d="M34 6h4V3h13v4h4v7h-6v4H37v-4h-3z" transform="translate(1 1)"/><path d="M34 6h4V3h13v4h4v7h-6v4H37v-4h-3z"/><path class="tf-pixel-accessory-light" d="M39 6h9v3h-4v3h-5z"/><rect class="tf-pixel-accessory-line" x="37" y="16" width="14" height="2"/>' }),
        headphones: wearable('head', 'audio-port', 'tech', { back: '<path class="tf-pixel-accessory-line is-wide" d="M37 28V18c0-8 4-12 11-12s11 4 11 12v9"/>', front: '<path class="tf-pixel-accessory-shadow" d="M51 21h10v17H51z" transform="translate(1 1)"/><path d="M51 21h10v17H51z"/><rect class="tf-pixel-accessory-light" x="54" y="25" width="4" height="9"/><path class="tf-pixel-accessory-line is-thin" d="M55 38v5h6"/>' }),
        cape: wearable('back', 'stabilizer-rail', 'tech', { back: '<path class="tf-pixel-accessory-shadow" d="M10 27h18l6 7-8 24H3l5-24z" transform="translate(1 1)"/><path d="M10 27h18l6 7-8 24H3l5-24z"/><path class="tf-pixel-accessory-light" d="M11 30h13l4 4-19 5z"/><rect class="tf-pixel-accessory-jewel" x="10" y="48" width="4" height="3"/>' }),
        bell: wearable('neck', 'ping-port', 'metal', { front: '<path class="tf-pixel-accessory-line is-thin" d="M32 43h18"/><path class="tf-pixel-accessory-shadow" d="M39 45h7v3h3v7h-13v-7h3z" transform="translate(1 1)"/><path d="M39 45h7v3h3v7h-13v-7h3z"/><rect class="tf-pixel-accessory-jewel" x="41" y="49" width="3" height="3"/>' }),
    }),
    octopus: Object.freeze({
        scarf: wearable('neck', 'mantle-base', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M18 41h29v4H35l-4 4-5-4h-3v4h-3v9h-6V48h4z" transform="translate(1 1)"/><path d="M18 41h29v4H35l-4 4-5-4h-3v4h-3v9h-6V48h4z"/><rect class="tf-pixel-accessory-light" x="21" y="42" width="17" height="2"/>' }),
        satchel: wearable('side', 'left-tentacle', 'leather', { front: '<path class="tf-pixel-accessory-line is-thin" d="M6 40v-4c0-4 3-7 7-7s7 3 7 7v4"/><path class="tf-pixel-accessory-shadow" d="M5 40h17v14H5z" transform="translate(1 1)"/><path d="M5 40h17v14H5z"/><rect class="tf-pixel-accessory-light" x="8" y="42" width="11" height="3"/><rect class="tf-pixel-accessory-shadow" x="12" y="47" width="4" height="3"/>' }),
        flower: wearable('head', 'right-mantle', 'botanical', { front: flowerPin(41, 7) }),
        charm: wearable('neck', 'front-tentacle', 'pearl', { front: charmDrop(31, 46, 24, 44, 43) }),
        ribbon: wearable('head', 'right-mantle', 'ribbon', { front: ribbonPin(41, 8) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(15, 37, 21, 12, 10) }),
        crown: wearable('head', 'mantle-top', 'royal', { front: crownPin(24, 3) }),
        leaf: wearable('head', 'right-mantle', 'botanical', { front: leafPin(40, 7) }),
        headphones: wearable('head', 'mantle-sides', 'pearl', headphones(5, 59, 4, 23, 15)),
        cape: wearable('back', 'left-mantle', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M13 24h15l5 7-8 27H3l6-27z" transform="translate(1 1)"/><path d="M13 24h15l5 7-8 27H3l6-27z"/><path class="tf-pixel-accessory-light" d="M14 26h11l3 4-17 6z"/>', front: '<path d="M7 34h8v5h-4v3H7zM50 34h8v3h2v5h-5v-3h-5z"/><rect class="tf-pixel-accessory-jewel" x="31" y="43" width="4" height="3"/>' }),
        bell: wearable('neck', 'front-tentacle', 'pearl', { front: bellDrop(31, 45, 22, 45, 42) }),
    }),
    goldfish: Object.freeze({
        scarf: wearable('neck', 'tail-base', 'ribbon', { back: '<path class="tf-pixel-accessory-shadow" d="M37 20h6v24h-6z" transform="translate(1 1)"/><path d="M37 20h6v24h-6z"/><path d="M40 39h5v15h-3v-6h-2z"/><rect class="tf-pixel-accessory-light" x="38" y="23" width="2" height="13"/>' }),
        satchel: wearable('side', 'belly-harness', 'pearl', { back: '<path class="tf-pixel-accessory-line is-thin" d="M19 21l18 25"/>', front: '<path class="tf-pixel-accessory-shadow" d="M27 39h14v11H27z" transform="translate(1 1)"/><path d="M27 39h14v11H27z"/><path class="tf-pixel-accessory-light" d="M30 41h8v3h-8z"/><rect class="tf-pixel-accessory-jewel" x="33" y="46" width="3" height="2"/>' }),
        flower: wearable('head', 'dorsal-fin', 'botanical', { front: flowerPin(22, 6) }),
        charm: wearable('neck', 'pectoral-fin', 'pearl', { front: '<path class="tf-pixel-accessory-line is-thin" d="M29 38v8"/><path class="tf-pixel-accessory-shadow" d="M26 45h7v3h3v6h-3v3h-7v-3h-3v-6h3z" transform="translate(1 1)"/><path d="M26 45h7v3h3v6h-3v3h-7v-3h-3v-6h3z"/><rect class="tf-pixel-accessory-light" x="28" y="48" width="3" height="3"/>' }),
        ribbon: wearable('head', 'tail-base', 'ribbon', { back: '<path class="tf-pixel-accessory-shadow" d="M36 24h6l4 4 4-4h6v10h-6l-4-4-4 4h-6z" transform="translate(1 1)"/><path d="M36 24h6l4 4 4-4h6v10h-6l-4-4-4 4h-6z"/><rect class="tf-pixel-accessory-light" x="43" y="27" width="5" height="4"/>' }),
        glasses: wearable('face', 'visible-eye', 'glass', { front: '<path class="tf-pixel-accessory-line is-thin" d="M7 29h4m12 0h12"/><rect class="tf-pixel-accessory-frame" x="10" y="23" width="14" height="13"/><rect class="tf-pixel-accessory-glint" x="13" y="26" width="4" height="3"/>' }),
        crown: wearable('head', 'forehead', 'pearl', { front: '<path class="tf-pixel-accessory-shadow" d="M11 18l4 3 3-7 4 7 5-3v11H11z" transform="translate(1 1)"/><path d="M11 18l4 3 3-7 4 7 5-3v11H11z"/><rect class="tf-pixel-accessory-light" x="14" y="25" width="10" height="2"/><rect class="tf-pixel-accessory-jewel" x="17" y="21" width="3" height="3"/>' }),
        leaf: wearable('head', 'dorsal-fin', 'botanical', { front: leafPin(23, 7) }),
        headphones: wearable('head', 'gill-hydrophone', 'tech', { front: '<path class="tf-pixel-accessory-line is-thin" d="M13 20c8-5 17-3 21 5v7"/><path class="tf-pixel-accessory-shadow" d="M28 24h10v15H28z" transform="translate(1 1)"/><path d="M28 24h10v15H28z"/><path class="tf-pixel-accessory-light" d="M31 27h4v8h-4z"/><rect class="tf-pixel-accessory-jewel" x="35" y="31" width="4" height="3"/>' }),
        cape: wearable('back', 'dorsal-veil', 'crystal', { back: '<path class="tf-pixel-accessory-shadow" d="M27 14h11l5 5 12-8v9l6 5-7 6 7 6-7 6 5 9-16-8-6 4V25l-10-4z" transform="translate(1 1)"/><path d="M27 14h11l5 5 12-8v9l6 5-7 6 7 6-7 6 5 9-16-8-6 4V25l-10-4z"/><path class="tf-pixel-accessory-light" d="M33 17h5l5 5 9-5-5 10 7 4-9 3 7 8-10-5-7 4V25l-6-4z"/>' }),
        bell: wearable('neck', 'belly-pearl', 'pearl', { front: '<path class="tf-pixel-accessory-line is-thin" d="M18 41v6"/><path class="tf-pixel-accessory-shadow" d="M15 46h7v3h3v6h-3v3h-7v-3h-3v-6h3z" transform="translate(1 1)"/><path d="M15 46h7v3h3v6h-3v3h-7v-3h-3v-6h3z"/><rect class="tf-pixel-accessory-light" x="17" y="49" width="3" height="3"/>' }),
    }),
    soot: Object.freeze({
        scarf: wearable('neck', 'lower-fuzz', 'cloth', { front: '<path class="tf-pixel-accessory-shadow" d="M18 46h29v4H18zM40 49h7v11h-4v-5h-3z" transform="translate(1 1)"/><path d="M18 46h29v4H18zM40 49h7v11h-4v-5h-3z"/><rect class="tf-pixel-accessory-light" x="22" y="47" width="14" height="2"/>' }),
        satchel: wearable('side', 'right-fuzz', 'leather', { back: '<path class="tf-pixel-accessory-line is-thin" d="M22 35l27 20"/>', front: '<path class="tf-pixel-accessory-shadow" d="M43 47h14v11H43z" transform="translate(1 1)"/><path d="M43 47h14v11H43z"/><rect class="tf-pixel-accessory-light" x="46" y="49" width="8" height="2"/>' }),
        flower: wearable('head', 'right-fuzz', 'botanical', { front: flowerPin(43, 7) }),
        charm: wearable('neck', 'lower-fuzz', 'crystal', { front: charmDrop(31, 48, 23, 45, 45) }),
        ribbon: wearable('head', 'right-fuzz', 'ribbon', { front: ribbonPin(42, 8) }),
        glasses: wearable('face', 'eye-pair', 'glass', { front: pairGlasses(14, 37, 24, 12, 10) }),
        crown: wearable('head', 'top-fuzz', 'royal', { front: crownPin(24, 2) }),
        leaf: wearable('head', 'right-fuzz', 'botanical', { front: leafPin(42, 6) }),
        headphones: wearable('head', 'side-fuzz', 'tech', headphones(5, 60, 4, 23, 17)),
        cape: wearable('back', 'left-fuzz', 'cloth', { back: '<path class="tf-pixel-accessory-shadow" d="M12 27h16l6 7-9 27H2l6-27z" transform="translate(1 1)"/><path d="M12 27h16l6 7-9 27H2l6-27z"/><path class="tf-pixel-accessory-light" d="M13 29h11l4 4-17 6z"/>', front: '<path d="M6 37h9v6h-5v3H6zM51 37h9v3h2v6h-5v-3h-6z"/><rect class="tf-pixel-accessory-jewel" x="31" y="48" width="4" height="3"/>' }),
        bell: wearable('neck', 'lower-fuzz', 'metal', { front: bellDrop(31, 47, 22, 46, 44) }),
    }),
});

function renderEyes({ left, right, y, robot = false, soot = false, cat = false, rabbit = false, fox = false, bird = false, octopus = false, fish = false }) {
    if (soot) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><rect class="tf-pixel-light" x="${left}" y="${y}" width="11" height="11"/><rect class="tf-pixel-light" x="${right}" y="${y}" width="11" height="11"/><g class="tf-pixel-pupils"><rect class="tf-pixel-ink" x="${left + 4}" y="${y + 3}" width="4" height="6"/><rect class="tf-pixel-ink" x="${right + 3}" y="${y + 3}" width="4" height="6"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-light" d="M${left} ${y + 6}h2v-3h7v3h2v4h-3V${y + 7}h-5v3h-3zM${right} ${y + 6}h2v-3h7v3h2v4h-3V${y + 7}h-5v3h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-light" x="${left}" y="${y + 7}" width="11" height="3"/><rect class="tf-pixel-light" x="${right}" y="${y + 7}" width="11" height="3"/></g>
        `;
    }
    if (cat) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><path class="tf-pixel-accent" d="M${left + 2} ${y}h6v2h2v7h-2v2h-6v-2h-2v-7h2zM${right + 2} ${y}h6v2h2v7h-2v2h-6v-2h-2v-7h2z"/><path class="tf-pixel-ink" d="M${left + 3} ${y + 3}h5v6h-5zM${right + 3} ${y + 3}h5v6h-5z"/><rect class="tf-pixel-light" x="${left + 3}" y="${y + 2}" width="3" height="3"/><rect class="tf-pixel-light" x="${right + 3}" y="${y + 2}" width="3" height="3"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-accent" d="M${left} ${y + 5}h3v-3h5v3h3v3h-3v-2h-5v2h-3zM${right} ${y + 5}h3v-3h5v3h3v3h-3v-2h-5v2h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><path class="tf-pixel-accent" d="M${left} ${y + 5}h3v2h5v-2h3v4h-11zM${right} ${y + 5}h3v2h5v-2h3v4h-11z"/></g>
        `;
    }
    if (rabbit) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><g class="tf-pixel-pupils"><rect class="tf-pixel-ink" x="${left}" y="${y}" width="7" height="8"/><rect class="tf-pixel-ink" x="${right}" y="${y}" width="7" height="8"/><rect class="tf-pixel-light" x="${left + 1}" y="${y + 1}" width="2" height="2"/><rect class="tf-pixel-light" x="${right + 1}" y="${y + 1}" width="2" height="2"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-ink" d="M${left - 1} ${y + 4}h2v-2h5v2h2v3h-2v-2h-5v2h-2zM${right - 1} ${y + 4}h2v-2h5v2h2v3h-2v-2h-5v2h-2z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-ink" x="${left - 1}" y="${y + 5}" width="9" height="2"/><rect class="tf-pixel-ink" x="${right - 1}" y="${y + 5}" width="9" height="2"/></g>
        `;
    }
    if (fox) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><g class="tf-pixel-pupils"><path class="tf-pixel-ink" d="M${left - 1} ${y + 4}h2v-2h6v2h2v2h-2v-1h-6v1h-2zM${right - 1} ${y + 4}h2v-2h6v2h2v2h-2v-1h-6v1h-2z"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-ink" d="M${left - 1} ${y + 5}h2v-3h6v3h2v2h-3v-2h-4v2h-3zM${right - 1} ${y + 5}h2v-3h6v3h2v2h-3v-2h-4v2h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-ink" x="${left - 1}" y="${y + 5}" width="10" height="2"/><rect class="tf-pixel-ink" x="${right - 1}" y="${y + 5}" width="10" height="2"/></g>
        `;
    }
    if (bird) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><rect class="tf-pixel-ink" x="${left}" y="${y}" width="9" height="9"/><g class="tf-pixel-pupils"><rect class="tf-pixel-robo-eye" x="${left + 2}" y="${y + 2}" width="5" height="5"/><rect class="tf-pixel-light" x="${left + 2}" y="${y + 2}" width="2" height="2"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-robo-eye" d="M${left} ${y + 5}h2v-3h5v3h2v3h-2v-2h-5v2h-2z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-robo-eye" x="${left}" y="${y + 5}" width="9" height="2"/></g>
        `;
    }
    if (octopus) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><g class="tf-pixel-pupils"><path class="tf-pixel-ink" d="M${left + 2} ${y}h5v2h2v7h-2v2h-5v-2h-2v-7h2zM${right + 2} ${y}h5v2h2v7h-2v2h-5v-2h-2v-7h2z"/><rect class="tf-pixel-light" x="${left + 2}" y="${y + 2}" width="3" height="3"/><rect class="tf-pixel-light" x="${right + 2}" y="${y + 2}" width="3" height="3"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-ink" d="M${left} ${y + 6}h2v-3h7v3h2v3h-3v-2h-5v2h-3zM${right} ${y + 6}h2v-3h7v3h2v3h-3v-2h-5v2h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><path class="tf-pixel-ink" d="M${left} ${y + 6}h3v2h5v-2h3v4H${left}zM${right} ${y + 6}h3v2h5v-2h3v4H${right}z"/></g>
        `;
    }
    if (fish) {
        return `
            <g class="tf-pixel-eyes tf-pixel-eyes-open"><g class="tf-pixel-pupils"><path class="tf-pixel-ink" d="M${left + 2} ${y}h5v2h2v7h-2v2h-5v-2h-2v-7h2z"/><rect class="tf-pixel-light" x="${left + 2}" y="${y + 2}" width="3" height="3"/></g></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="tf-pixel-ink" d="M${left} ${y + 6}h2v-3h7v3h2v3h-3v-2h-5v2h-3z"/></g>
            <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="tf-pixel-ink" x="${left}" y="${y + 7}" width="11" height="2"/></g>
        `;
    }
    const width = robot ? 6 : 5;
    const height = robot ? 5 : 6;
    const eyeClass = robot ? 'tf-pixel-accent' : 'tf-pixel-ink';
    const glint = robot ? '' : `<rect class="tf-pixel-light" x="${left}" y="${y}" width="2" height="2"/><rect class="tf-pixel-light" x="${right}" y="${y}" width="2" height="2"/>`;
    return `
        <g class="tf-pixel-eyes tf-pixel-eyes-open"><g class="tf-pixel-pupils"><rect class="${eyeClass}" x="${left}" y="${y}" width="${width}" height="${height}"/><rect class="${eyeClass}" x="${right}" y="${y}" width="${width}" height="${height}"/>${glint}</g></g>
        <g class="tf-pixel-eyes tf-pixel-eyes-happy"><path class="${eyeClass}" d="M${left - 1} ${y + 3}h2v-2h${width - 1}v2h2v3h-2v-2h-${width - 1}v2h-2zM${right - 1} ${y + 3}h2v-2h${width - 1}v2h2v3h-2v-2h-${width - 1}v2h-2z"/></g>
        <g class="tf-pixel-eyes tf-pixel-eyes-sleep"><rect class="${eyeClass}" x="${left - 1}" y="${y + 4}" width="${width + 2}" height="2"/><rect class="${eyeClass}" x="${right - 1}" y="${y + 4}" width="${width + 2}" height="2"/></g>
    `;
}

function renderAccessory(kind, accessory, layer) {
    const species = SPECIES_ACCESSORIES[kind] || SPECIES_ACCESSORIES.frog;
    const definition = species?.[accessory];
    const art = definition?.[layer];
    if (!art) return '';
    return `<g class="tf-pixel-accessory is-${accessory} is-slot-${definition.slot} is-layer-${layer}" data-accessory="${accessory}" data-slot="${definition.slot}" data-fit="${kind}" data-anchor="${definition.anchor}" data-material="${definition.material}" data-design="${kind}:${accessory}"><g class="tf-pixel-accessory-art">${art}</g></g>`;
}

export function renderCompanionArtwork(kind = 'mystery', accessory = 'none') {
    const species = SPECIES_ART[kind] || SPECIES_ART.mystery;
    const selectedAccessory = ACCESSORY_KEYS.includes(accessory) && SPECIES_ACCESSORIES[kind]?.[accessory] ? accessory : 'none';
    const scale = Number(species.canvas || 64) / 64;
    const scaleLegacyLayer = markup => markup && scale !== 1 ? `<g transform="scale(${scale})">${markup}</g>` : markup;
    const eyes = species.eyesMarkup || renderEyes(species.eyes);
    const faces = `<g class="tf-pixel-mouth tf-pixel-mouth-default">${species.faces.default}</g><g class="tf-pixel-mouth tf-pixel-mouth-feed">${species.faces.feed}</g><g class="tf-pixel-mouth tf-pixel-mouth-sleep">${species.faces.sleep}</g>`;
    const travelKit = '<g class="tf-pixel-travel-kit"><path class="tf-pixel-body-shadow" d="M45 23h11v21H45z"/><path class="tf-pixel-accent" d="M43 21h12v21H43z"/><rect class="tf-pixel-light" x="46" y="25" width="6" height="5"/><rect class="tf-pixel-ink" x="41" y="27" width="4" height="12"/></g>';
    return `<g class="tf-pixel-wearable-rig is-back-rig">${scaleLegacyLayer(renderAccessory(kind, selectedAccessory, 'back'))}</g><g class="tf-pixel-character"><g class="tf-pixel-back-rig">${species.back}</g><g class="tf-pixel-body-rig">${species.body}</g><g class="tf-pixel-face-rig">${eyes}${faces}</g></g><g class="tf-pixel-carry-rig">${scaleLegacyLayer(travelKit)}</g><g class="tf-pixel-wearable-rig is-front-rig">${scaleLegacyLayer(renderAccessory(kind, selectedAccessory, 'front'))}</g>`;
}
