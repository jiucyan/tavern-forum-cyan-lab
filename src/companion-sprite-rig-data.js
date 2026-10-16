// Paths are anatomical regions in the rendered 64 × 64 character viewport.
// Each clip reaches behind the body farther than its cut: the static body covers
// the moving joint while ears, tails, fins and feet remain free to articulate.
const part = (name, motion, pivot, clip, cut = clip) => ({ name, motion, pivot, clip, cut });
// Mouth windows contain the painted mouth, with a larger skin-colored overlap
// behind the fixed face. The overlap stays covered by the core while chewing.
const muzzle = (pivot, clip, cut, direction = 'front') => ({ pivot, clip, cut, direction });

export const COMPANION_SPRITE_RIGS = Object.freeze({
    cat: { muzzle: muzzle([28.5, 34.8], 'M22 28H35V42H22Z', 'M25.8 32.2H31.2V37.6H25.8Z'), parts: [
        part('tail', 'cat-tail', [45, 50], 'M43 48L48 44L48 41L46 37L47 34L50 32H64V61H43Z', 'M46 48L48 44L48 41L46 37L47 34L50 32H64V61H46Z'),
        part('ear-left', 'cat-ear-left', [15, 17], 'M3 0H20L25 17L16 20L6 25Z', 'M3 0H20L23 14L16 17L6 22Z'),
        part('ear-right', 'cat-ear-right', [43, 17], 'M34 14L42 1H53V26L43 21Z', 'M37 13L42 1H53V22L45 18Z'),
        // Only the lower paws leave the core; the upper overlap stays under the torso.
        part('foot-left', 'cat-foot-left', [22, 49], 'M17 47H27V61H17Z', 'M17.5 52H27V61H17.5Z'),
        part('foot-right', 'cat-foot-right', [35, 49], 'M30 47H40V61H30Z', 'M30 52H40V61H30Z'),
    ] },
    rabbit: { muzzle: muzzle([32, 35.8], 'M24 29H40V44H24Z', 'M28.1 33.8H35.9V38.8H28.1Z'), parts: [
        part('ear-left', 'rabbit-ear-left', [17, 22], 'M0 16L18 15L22 21L18 27L16.4 32V37L17.2 39L16.2 40L15.5 43L13 46V51H0Z', 'M0 22L17 21L17.3 27L15.8 32V37L16.6 39L16.2 40L15.5 43L13 46V51H0Z'),
        part('ear-right', 'rabbit-ear-right', [47, 22], 'M64 16L46 15L42 21L46 27L47.6 32V37L46.8 39L47.8 40L48.5 43L51 46V51H64Z', 'M64 22L47 21L46.7 27L48.2 32V37L47.4 39L47.8 40L48.5 43L51 46V51H64Z'),
    ] },
    fox: { muzzle: muzzle([27.25, 33.2], 'M20 26H35V41H20Z', 'M23.7 30.8H30.8V35.8H23.7Z'), parts: [
        part('tail', 'fox-tail', [44, 48], 'M40 43L44 29H64V62H40Z', 'M44 44L46 29H64V62H44Z'),
        part('ear-left', 'fox-ear-left', [15, 17], 'M4 0H24L25 15L17 20L6 26Z', 'M4 0H24L22 12L16 17L7 23Z'),
        part('ear-right', 'fox-ear-right', [42, 17], 'M32 14L39 0H51V26L41 22Z', 'M36 13L39 0H51V22L43 18Z'),
        part('foot-left', 'fox-foot-left', [22, 49], 'M17 47H27V61H17Z', 'M18 52H27V61H18Z'),
        part('foot-right', 'fox-foot-right', [32, 49], 'M28 47H37V61H28Z', 'M28 52H36V61H28Z'),
    ] },
    penguin: { muzzle: muzzle([32, 30.6], 'M25 24H39V38H25Z', 'M28.5 28.7H35.5V33.6H28.5Z'), parts: [
        part('wing-left', 'penguin-wing-left', [17, 36], 'M5 33L18 34L22 37L20.5 39L18.5 41L17.2 43L15.5 45V48.5H5Z', 'M5 36L17 36L19.5 38L18 40L16.5 42L15.2 44L15 46.5V48.5H5Z'),
        part('wing-right', 'penguin-wing-right', [47, 36], 'M59 33L46 34L42 37L43.5 39L45.5 41L46.8 43L48.5 45V48.5H59Z', 'M59 36L47 36L44.5 38L46 40L47.5 42L48.8 44L49 46.5V48.5H59Z'),
        part('foot-left', 'penguin-foot-left', [22, 51], 'M16 49H28V61H16Z', 'M16 52H28V61H16Z'),
        part('foot-right', 'penguin-foot-right', [42, 51], 'M36 49H49V61H36Z', 'M36 52H49V61H36Z'),
    ] },
    'robo-bird': { muzzle: muzzle([32, 33.7], 'M25 27H39V40H25Z', 'M29.1 32.3H34.9V36.3H29.1Z'), parts: [
        part('wing-left', 'robo-wing-left', [19, 35], 'M4 29L19 30L22 37L20 45L22 53H4Z', 'M4 32L17 33L20 37L18 45L20 53H4Z'),
        part('wing-right', 'robo-wing-right', [45, 35], 'M60 29L45 30L42 37L44 45L42 53H60Z', 'M60 32L47 33L44 37L46 45L44 53H60Z'),
        part('antenna', 'robo-antenna', [38, 15], 'M34 0H48V19L35 17Z', 'M35 0H48V14L37 15Z'),
        part('foot-left', 'robo-foot-left', [21, 50], 'M14 48H28V61H14Z', 'M15 52H28V61H15Z'),
        part('foot-right', 'robo-foot-right', [43, 50], 'M36 48H50V61H36Z', 'M36 52H50V61H36Z'),
    ] },
    octopus: { muzzle: muzzle([32, 33.9], 'M25 27H39V41H25Z', 'M28.8 31.8H35.2V36.6H28.8Z'), parts: [
        part('arm-left', 'octopus-arm-left', [20, 43], 'M0 33L13 33L18 38L25 41L22 50L20 61H0Z', 'M0 35L13 35L16 39L22 43L20 50L19 61H0Z'),
        part('arm-right', 'octopus-arm-right', [44, 43], 'M64 33L51 33L46 38L39 41L42 50L44 61H64Z', 'M64 35L51 35L48 39L42 43L44 50L45 61H64Z'),
        part('arm-front-left', 'octopus-arm-front-left', [27, 43], 'M21 40H33V61H18L20 49Z', 'M23 44H32V61H19L21 49Z'),
        part('arm-front-right', 'octopus-arm-front-right', [37, 43], 'M43 40H31V61H46L44 49Z', 'M41 44H32V61H45L43 49Z'),
    ] },
    goldfish: { muzzle: muzzle([6.1, 30.8], 'M2 25H12V37H2Z', 'M4.3 29H8.5V33.1H4.3Z', 'side'), parts: [
        part('tail', 'fish-tail', [40, 30], 'M36 5H64V62H39L35 49L30 38L36 32L41 29L35 21Z', 'M39 5H64V62H40L37 49L33 39L38 34L43 29L37 21Z'),
        part('dorsal-fin', 'fish-dorsal', [28, 19], 'M15 3H37L40 24L31 23L22 19L15 21Z', 'M17 3H35L38 21L30 20L22 17L17 19Z'),
        part('ventral-fin', 'fish-ventral', [23, 37], 'M6 33L23 35L31 33L33 39L37 49L40 62H6Z', 'M8 37L25 39L32 36L33 39L37 49L40 62H8Z'),
        part('pectoral-fin', 'fish-pectoral', [22, 33], 'M19 30L25 30L31 34L31 40L24 43L18 39Z', 'M21 33L25 33L29 35L29 39L24 41L20 38Z'),
    ] },
    soot: { muzzle: muzzle([32, 40.7], 'M25 34H39V47H25Z', 'M29 38.7H35V43H29Z'), parts: [
        part('foot-left', 'soot-foot-left', [25, 51], 'M18 48H31V62H18Z', 'M19 52H30V62H19Z'),
        part('foot-right', 'soot-foot-right', [39, 51], 'M33 48H47V62H33Z', 'M34 52H46V62H34Z'),
    ] },
    frog: { muzzle: muzzle([32.5, 27.3], 'M23 20H42V35H23Z', 'M26.5 24.3H38.3V30.2H26.5Z'), parts: [
        part('leg-left', 'frog-leg-left', [16, 44], 'M0 34H16L18 45L25 49L26 62H0Z', 'M0 37H14L15 45L22 51L24 62H0Z'),
        part('leg-right', 'frog-leg-right', [48, 44], 'M64 34H48L46 45L39 49L38 62H64Z', 'M64 37H50L49 45L42 51L40 62H64Z'),
    ] },
});
