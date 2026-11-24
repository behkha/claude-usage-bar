// The project tab: a folder tab rising from the card's top-left edge, with the
// project's name, its branch and, in a worktree, a WORKTREE chip. The
// monogram and the worktree chip are in the project's colour, which comes from
// the name, so a project looks the same in every session. The tab's outline
// and fill are the card's own (`TAB_STYLE`), so it reads as part of the card.
//
// The app draws the band in a box of its own and crops whatever is drawn past
// it, so the tab cannot stand above that box. Instead the card is lowered by
// the tab's height and the room that opens above it is painted in the page's
// colour: the app's box disappears there, and the tab reads as standing above
// the card. The card modes lower their drawings (`lift`); Classic, which has no
// drawing behind it, gets a top edge of its own (`classicTop`).
//
// Arrival, for a moment after the project or branch changes: the tab rises out
// of the card, the monogram pops, and a sheen crosses the name once. While
// Claude works a light runs along the tab's top edge, in the edge's colour.
// Every animation is timed from the moment of the change, not from the
// drawing's own start, so a redraw meanwhile picks it up where it stands.
//
// The update tab (`updateTab`) is its twin at the card's top-right, there while a newer version of the mod is
// out: a lamp, a word and the version, in the card's own colours, with the lamp in the notice's colour.

import { CORNER, EDGE_SIDE, EDGE_TOP } from './card'
import { textWidth as measure } from './measure'
import { branchLabel, colorOf, cut, monogram } from './project'
import type { UsageBarNotice, UsageBarProject } from '../types'

/** The tab's height. */
export const TAB_H = 32
/** The px the band adds above the card: the tab's height. */
export const LIFT = TAB_H
/** The room inside the tab between its top edge and the tops of its chips; less sits below them, on the card. */
const PAD_TOP = 9
/** How long the arrival plays after the project changes. */
export const ARRIVAL_MS = 2_500
/** Where the tab is in time: ms since the project changed, the clock now, and whether Claude works. */
export type TabMotion = { elapsed: number; now: number; busy: boolean }

/**
 * The page's colour around the band, measured in the desktop app under the mod's black look. The room above
 * the lowered card is painted in it, so the app's box behind the band does not show there.
 */
const PAGE = '#0a0a0a'
/**
 * The page's colour under the app's light theme, where the black look is not painted: claude.ai's light
 * background (bg-100). Not measured in the desktop app. A drawing follows the app's theme through
 * `prefers-color-scheme`, so the room above the card takes the page's colour in either theme.
 */
const LIGHT_PAGE = '#faf9f5'
/** A shape in the page's colour: the style that picks the theme's, then the shape. */
const pageShape = (shape: string) => `<style>@media (prefers-color-scheme: light){.pb-page{fill:${LIGHT_PAGE}}}</style><${shape} fill="${PAGE}" class="pb-page"/>`
/** The fill of the app's box: Classic's card body, which its tab has to meet. */
const BAND = '#161616'
/** The card's top edge in Classic, as bright as the card modes' rim where it starts. */
const RIM = '#8f8f8f'

const FONT = '-apple-system,system-ui,sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'
const NAME_PX = 12.5
const BRANCH_PX = 11
// SF Mono's advance; heavy text runs about 6% wider than the measured semibold.
const MONO_EM = 0.6
const HEAVY = 1.06
/** The radius of the tab's top corners and of the fillets at its base. */
const R = 8
const F = 8
/** Where the tab starts, from the card's left edge: past the card's rounded corner, a short straight run of edge, and the fillet. */
const INSET = CORNER + 10 + F
/** The line of the card's top edge, below the card's top: where `edgeLeft` draws it, 1.2 px wide. */
const EDGE_Y = 1.4
const EDGE_W = 1.2
/**
 * How the tab looks on each mode, so it reads as part of the card it stands on:
 * - `ink`: how bright the mode draws its top edge (the opacity of `line`), so the tab's outline meets it at the
 *   same brightness: Glass's rim where it starts (glass.ts `rim`), the hairlines of Cluster, Tuner and Board
 *   (each file's `hairline` or `EDGE`), and Classic's opaque edge over the page.
 * - `fill`: the tab's fill, top to foot. The foot is the card's colour along its top edge, so the two meet
 *   without a seam, and the top a little lighter. Where a mode lays a sheen over its ground, the foot is the two
 *   together: Glass and Cluster's #050505 under 6-7% white, Tuner's warm #0c0b09 under 7%. Board has no sheen,
 *   and Classic's tab stands on the app's box.
 * - `line`: the outline's colour, the card's own edge colour, and the colour of the light that runs along the
 *   tab's top edge while Claude works, where the tab is dark.
 * - `print`: `'dark'` on a light card (Panel), whose tab is the card's metal: dark print (`PRINTS`), a white light
 *   along the top edge, and the worktree chip in the print's grey.
 */
export type TabStyle = { ink: number; fill: readonly [string, string]; line: string; print?: 'dark' }
/**
 * The tab's print: white on the dark cards; `print: 'dark'` on a light card, whose tab is as light as the card.
 * The update tab's label is the app's own text, which the app colours itself; on a light tab the drawing prints the
 * label instead (`updateTab`'s `withText`) and the band's Button over it is blank.
 */
const PRINTS = {
  // `sheen` crosses the name once on arrival; on dark print it is a mid grey, so the letters glint and stay legible.
  light: { name: '#fff', sub: '#b9b9be', icon: '#a6a6ab', rule: '#fff', sheen: '#fff' },
  dark: { name: '#1d1d1b', sub: '#4f4f49', icon: '#5f5f59', rule: '#000', sheen: '#9a9a95' },
} as const
export const printOf = (look: TabStyle) => PRINTS[look.print ?? 'light']
export const TAB_STYLE = {
  glass: { ink: 0.55, fill: ['#1c1c1c', '#141414'], line: '#fff' },
  cluster: { ink: 0.24, fill: ['#1c1c1c', '#141414'], line: '#fff' },
  tuner: { ink: 0.28, fill: ['#252421', '#1d1c1a'], line: '#efe6cf' },
  board: { ink: 0.24, fill: ['#131314', '#0b0b0c'], line: '#fff' },
  classic: { ink: 0.53, fill: ['#202020', BAND], line: '#fff' },
  vu: { ink: 0.26, fill: ['#2a1f14', '#170f09'], line: '#f6d9a0' },
  nixie: { ink: 0.2, fill: ['#1d1612', '#0d0a09'], line: '#ffb15a' },
  cockpit: { ink: 0.24, fill: ['#191e23', '#0e1114'], line: '#e8ecef' },
  // LCD's top edge is its black bezel, so its tab is dark. Panel's is the aluminium, under 22% black at its rim,
  // so its tab is the metal, a little lighter at the top, with dark print.
  lcd: { ink: 0.2, fill: ['#1d1e1b', '#0f100e'], line: '#fff' },
  panel: { ink: 0.22, fill: ['#efefeb', '#e6e6e1'], line: '#000', print: 'dark' },
} as const satisfies Record<string, TabStyle>
/** A light on the card under the tab, in card coordinates, that carries up into it: Tuner's backlight round its needle. */
export type TabLight = { x: number; y: number; r: number; color: string; opacity: number }
/** A mode's art, with what of it reaches the tab: its light. */
export type TabArt = { source: string; width: number; light?: TabLight }
const RUN_MS = 2_400

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BRANCH_ICON = 'M3 4v4M9 5.5c0 2-2.5 2-6 2.5'
const branchIcon = (x: number, y: number, ink: string) =>
  `<g transform="translate(${x} ${y})" fill="none" stroke="${ink}" stroke-width="1.3"><circle cx="3" cy="2.5" r="1.4"/><circle cx="3" cy="9.5" r="1.4"/><circle cx="9" cy="4" r="1.4"/><path d="${BRANCH_ICON}"/></g>`
const FOLDER_ICON = 'M1 3h3.5l1 1.2H11v5.8H1z'

/** Each animation's delay, counted from the change: negative once the change is past, so it resumes mid-way. */
const motionStyle = (m: TabMotion, arriving: boolean, sheenTo: number, runFrom: number, runTo: number) => {
  const at = (ms: number) => `${Math.round(ms - m.elapsed)}ms`
  return (
    '<style>' +
    (arriving
      ? `.pb-rise{animation:pbr .32s cubic-bezier(.2,.9,.25,1) ${at(0)} both}@keyframes pbr{from{transform:translateY(${TAB_H}px)}}` +
        `.pb-pop{transform-box:fill-box;transform-origin:50% 50%;animation:pbp .4s cubic-bezier(.3,1.6,.5,1) ${at(300)} both}@keyframes pbp{from{transform:scale(.3);opacity:0}}` +
        `.pb-sheen{animation:pbh 1.1s ease-out ${at(700)} both}@keyframes pbh{from{transform:translateX(-40px)}to{transform:translateX(${sheenTo}px)}}`
      : '') +
    (m.busy ? `.pb-run{animation:pbt ${RUN_MS}ms linear -${m.now % RUN_MS}ms infinite}@keyframes pbt{from{transform:translateX(${runFrom}px)}to{transform:translateX(${runTo}px)}}` : '') +
    '@media (prefers-reduced-motion: reduce){.pb-rise,.pb-pop{animation:none}.pb-sheen,.pb-run{display:none}}</style>'
  )
}

/**
 * The tab, drawn with its left edge at `x` and its base on the card's top edge `base`, as an SVG fragment.
 * Fillets join it to the edge, and it rises from behind the card. `look` is the mode's style (`TAB_STYLE`),
 * and `light` a light on the card that carries up into it.
 */
/**
 * Where the project tab's parts go, left to right: monogram, name, a rule, the branch chip, the worktree chip.
 * With `maxRight`, the tab's right end, the tab gives way until it ends there: it drops the worktree chip, then
 * the branch chip and its rule, then cuts the name shorter; where even its first letter does not fit, null.
 */
function layoutTab(p: UsageBarProject, x: number, maxRight = Infinity) {
  const place = (name: string, branch: string | null, worktree: boolean) => {
    const mgX = x + 9
    const nameX = mgX + 16 + 8
    const nameW = measure(name, true) * (NAME_PX / 12) * HEAVY
    const ruleX = nameX + nameW + 9
    const chipX = ruleX + 10
    const chipW = branch === null ? 0 : 6 + 10 + 5 + [...branch].length * BRANCH_PX * MONO_EM + 6
    const wtX = chipX + chipW + 6
    const wtW = worktree ? measure('WORKTREE', true) * (9 / 12) + 8 * 0.6 + 14 : 0
    const right = (branch === null ? nameX + nameW : worktree ? wtX + wtW : chipX + chipW) + 11
    return { name, branch, worktree, mgX, nameX, nameW, ruleX, chipX, chipW, wtX, wtW, right }
  }
  const full = cut(p.name, 28)
  const tries = [place(full, branchLabel(p), !!p.worktree), place(full, branchLabel(p), false)]
  for (let n = [...full].length; n >= 2; n--) tries.push(place(cut(p.name, n), null, false))
  return tries.find(t => t.right <= maxRight) ?? null
}

function tab(p: UsageBarProject, m: TabMotion, x: number, base: number, look: TabStyle, light?: TabLight, maxRight?: number): string {
  const fit = layoutTab(p, x, maxRight)
  // Too narrow for any of it beside the update tab: the project tab steps aside.
  if (!fit) return ''
  const hue = colorOf(p.name)
  const { name, branch, worktree, mgX, nameX, nameW, ruleX, chipX, chipW, wtX, wtW, right } = fit
  const top = base - TAB_H + 2
  // The row's middle: the chips are 16 px tall, so their tops sit PAD_TOP under the tab's top edge.
  const mid = top + PAD_TOP + 8
  const width = right - x

  const [fillTop, fillFoot] = look.fill
  // On a light tab the print is dark, the light along the top edge white, and the worktree chip the print's grey:
  // the project's colour is chosen to stand out on dark tabs.
  const ink = printOf(look)
  const sheen = ink.sheen
  const run = look.print === 'dark' ? '#fff' : look.line
  const chip = look.print === 'dark' ? ink.sub : hue
  // The outline: up from the card's top edge with a fillet, round the top corners, down to the edge with a fillet.
  // The fillets leave and meet the edge on its own line, level with it, so edge and outline are one stroke. The
  // fill runs a little below that line, so it hides the card's edge under the tab.
  const edge = base + EDGE_Y
  const foot = base + 2.4
  // Where the two meet, the card's edge is covered (`under`) and the outline takes over a little before the
  // fillet, on the same line: the strokes butt end to end instead of overlapping into a brighter spot.
  const outline = `M${x - F - 2} ${edge}H${x - F}A${F} ${F} 0 0 0 ${x} ${edge - F}V${top + R}A${R} ${R} 0 0 1 ${x + R} ${top}H${right - R}A${R} ${R} 0 0 1 ${right} ${top + R}V${edge - F}A${F} ${F} 0 0 0 ${right + F} ${edge}H${right + F + 2}`
  const under = `<rect x="${x - F - 2}" y="${edge - EDGE_W / 2 - 0.1}" width="${width + 2 * F + 4}" height="${foot - edge + EDGE_W / 2 + 0.1}" fill="${fillFoot}"/>`

  const arriving = m.elapsed < ARRIVAL_MS
  const cls = (c: string) => (arriving ? ` class="${c}"` : '')
  // The straight run of the tab's top edge, between its corners: where the light runs while Claude works.
  const runL = x + R
  const runR = right - R

  const defs =
    `<linearGradient id="pbf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fillTop}"/><stop offset="1" stop-color="${fillFoot}"/></linearGradient>` +
    // The card's light, at the same place and strength as on the card: the card's coordinates start EDGE_SIDE right of the drawing's and at `base`.
    (light
      ? `<radialGradient id="pbb" gradientUnits="userSpaceOnUse" cx="${light.x + EDGE_SIDE}" cy="${base + light.y}" r="${light.r}"><stop offset="0" stop-color="${light.color}" stop-opacity="${light.opacity}"/><stop offset="1" stop-color="${light.color}" stop-opacity="0"/></radialGradient>`
      : '') +
    // The outline is as bright as the card's own top edge where the two meet, so the edge runs up and round the tab as one line.
    `<linearGradient id="pbe" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${edge}"><stop offset="0" stop-color="${look.line}" stop-opacity=".5"/><stop offset="1" stop-color="${look.line}" stop-opacity="${look.ink}"/></linearGradient>` +
    // the sheen across the name, and the light along the top edge in the edge's own colour
    `<linearGradient id="pbs"><stop offset="0" stop-color="${sheen}" stop-opacity="0"/><stop offset=".5" stop-color="${sheen}" stop-opacity=".95"/><stop offset="1" stop-color="${sheen}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="pbr"><stop offset="0" stop-color="${run}" stop-opacity="0"/><stop offset=".5" stop-color="${run}" stop-opacity=".95"/><stop offset="1" stop-color="${run}" stop-opacity="0"/></linearGradient>` +
    // The tab rises from behind the card: nothing of it shows below the card's top edge.
    `<clipPath id="pbk"><rect x="${x - F - 3}" y="-99" width="${width + 2 * F + 6}" height="${foot + 99}"/></clipPath>` +
    `<clipPath id="pbn"><text x="${nameX}" y="${mid + 4.4}" font-family="${FONT}" font-size="${NAME_PX}" font-weight="800">${esc(name)}</text></clipPath>` +
    `<clipPath id="pbl"><rect x="${runL}" y="${top - 2}" width="${runR - runL}" height="4"/></clipPath>`

  const branchMark = p.repo ? branchIcon(chipX + 6, mid - 6, ink.icon) : `<path d="${FOLDER_ICON}" transform="translate(${chipX + 6} ${mid - 6.5})" fill="none" stroke="${ink.icon}" stroke-width="1.3"/>`

  const drawn =
    under +
    `<path d="${outline}V${foot}H${x - F - 2}Z" fill="url(#pbf)"/>` +
    (light ? `<path d="${outline}V${foot}H${x - F - 2}Z" fill="url(#pbb)"/>` : '') +
    `<path d="${outline}" fill="none" stroke="url(#pbe)" stroke-width="${EDGE_W}"/>` +
    // while Claude works, a light runs along the top edge
    (m.busy ? `<g clip-path="url(#pbl)"><rect class="pb-run" x="0" y="${top - 1.6}" width="34" height="3.2" fill="url(#pbr)"/></g>` : '') +
    // the monogram
    `<g${cls('pb-pop')}><rect x="${mgX}" y="${mid - 8}" width="16" height="16" rx="4" fill="${hue}"/>` +
    `<text x="${mgX + 8}" y="${mid + 3}" text-anchor="middle" font-family="${FONT}" font-size="8.5" font-weight="800" fill="#000">${esc(monogram(p.name))}</text></g>` +
    // the name, and the sheen that crosses it once
    `<text x="${nameX}" y="${mid + 4.4}" font-family="${FONT}" font-size="${NAME_PX}" font-weight="800" fill="${ink.name}">${esc(name)}</text>` +
    (arriving ? `<g clip-path="url(#pbn)"><rect class="pb-sheen" x="${nameX}" y="${top}" width="36" height="${TAB_H}" fill="url(#pbs)"/></g>` : '') +
    // the rule and the branch chip
    (branch !== null
      ? `<line x1="${ruleX}" y1="${mid - 6}" x2="${ruleX}" y2="${mid + 6}" stroke="${ink.rule}" stroke-opacity=".16"/>` +
        `<rect x="${chipX}" y="${mid - 8}" width="${chipW}" height="16" rx="4" fill="none" stroke="${ink.rule}" stroke-opacity=".18"/>` +
        branchMark +
        `<text x="${chipX + 21}" y="${mid + 3.8}" font-family="${MONO}" font-size="${BRANCH_PX}" font-weight="500" fill="${ink.sub}">${esc(branch)}</text>`
      : '') +
    (worktree
      ? `<rect x="${wtX}" y="${mid - 6.5}" width="${wtW}" height="13" rx="3" fill="none" stroke="${chip}" stroke-opacity=".6"/>` +
        `<text x="${wtX + 6}" y="${mid + 3.2}" font-family="${FONT}" font-size="9" font-weight="700" letter-spacing=".6" fill="${chip}">WORKTREE</text>`
      : '')

  const style = arriving || m.busy ? motionStyle(m, arriving, nameW + 40, runL - 34, runR) : ''
  return `${style}<defs>${defs}</defs><g clip-path="url(#pbk)"><g${cls('pb-rise')}>${drawn}</g></g>`
}

/** The card's top edge in the lowered drawings' own coordinates. */
const CARD_TOP = LIFT + EDGE_TOP

/**
 * A card drawing lowered by the tab's height, with `above` drawn over it. `clip` keeps the drawing to the card
 * and paints the room above it in the page's colour (the art and the plate fill the whole band); the centre
 * drawing, which stands on the card, is only lowered.
 */
export function lift(source: string, width: number, height: number, clip: boolean, above = ''): string {
  const inner = source.replace(/^<svg /, `<svg y="${LIFT}" `)
  // The page's colour reaches a corner's depth into the card, so the card's cut top corners show it too.
  const page = pageShape(`rect x="-1" y="-1" width="${width + 2}" height="${CARD_TOP + CORNER + 1}"`)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + LIFT}" viewBox="0 0 ${width} ${height + LIFT}">` +
    (clip ? `${page}<clipPath id="pbcard"><rect x="-1" y="${CARD_TOP + 0.5}" width="${width + 2}" height="${height + 2}"/></clipPath><g clip-path="url(#pbcard)">${inner}</g>` : inner) +
    above +
    '</svg>'
  )
}

/** The card's art with the tab above its left end: the lowered art and the tab, in one drawing, the tab in the mode's `style` and with the art's light; without a project, the lowered art alone. */
export const tabbedArt = (art: TabArt, height: number, p: UsageBarProject | null, m: TabMotion, style: TabStyle, maxRight?: number) =>
  lift(art.source, art.width, height, true, p ? tab(p, m, EDGE_SIDE + INSET, CARD_TOP, style, art.light, maxRight) : '')

/** Classic's drawings' height: the room above, the edge, and the corners' sweep down the sides. */
const CLASSIC_H = CARD_TOP + CORNER + 12
/** The width of Classic's right end, pinned to the band's right edge. */
export const CLASSIC_END = 140

/**
 * Classic's top edge, as the card modes have it: the page's colour above, the edge with its rounded corners,
 * and the project tab, if any, rising from it. Two drawings: a wide one from the left, cropped by the band, with the tab and the
 * left corner; and the right end, pinned to the band's right edge, with the right corner. In both, the edge is
 * drawn opaque, so where the two overlap nothing doubles.
 */
export function classicTop(p: UsageBarProject | null, m: TabMotion, width: number, maxRight?: number): { left: string; right: string; height: number } {
  const r = CORNER
  const y = CARD_TOP + 0.5
  // the edge fades down the sides as the card modes' rim does
  const fade = `<linearGradient id="pbrim" gradientUnits="userSpaceOnUse" x1="0" y1="${y}" x2="0" y2="${y + r + 12}"><stop offset="0" stop-color="${RIM}"/><stop offset="1" stop-color="${RIM}" stop-opacity="0"/></linearGradient>`
  const svg = (w: number, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CLASSIC_H}" viewBox="0 0 ${w} ${CLASSIC_H}"><defs>${fade}</defs>${body}</svg>`

  const l = EDGE_SIDE + 0.5
  const left =
    pageShape(`path d="M-1 -1H${width + 1}V${y}H${l + r}A${r} ${r} 0 0 0 ${l} ${y + r}V${CLASSIC_H + 1}H-1Z"`) +
    `<path d="M${width + 1} ${y + 0.9}H${l + r}A${r - 0.9} ${r - 0.9} 0 0 0 ${l + 0.9} ${y + r}V${y + r + 12}" fill="none" stroke="url(#pbrim)" stroke-width="${EDGE_W}"/>` +
    (p ? tab(p, m, EDGE_SIDE + INSET, CARD_TOP, TAB_STYLE.classic, undefined, maxRight) : '')

  const e = CLASSIC_END - EDGE_SIDE - 0.5
  const right =
    pageShape(`path d="M-1 -1H${CLASSIC_END + 1}V${CLASSIC_H + 1}H${e}V${y + r}A${r} ${r} 0 0 0 ${e - r} ${y}H-1Z"`) +
    `<path d="M-1 ${y + 0.9}H${e - r}A${r - 0.9} ${r - 0.9} 0 0 1 ${e - 0.9} ${y + r}V${y + r + 12}" fill="none" stroke="url(#pbrim)" stroke-width="${EDGE_W}"/>`

  return { left: svg(width, left), right: svg(CLASSIC_END, right), height: CLASSIC_H }
}

// ---------- the update tab ----------

/** The notice's colours: sky for news (amber and red mean limits in this mod), green to restart, red to retry. */
export const SKY = '#6fb7ff'
const OK = '#63d297'
const BAD = '#ff5f5f'

const WORD: Record<UsageBarNotice['phase'], string> = { available: 'Update', updating: 'Updating', restart: 'Restart', failed: 'Retry' }
const LAMP: Record<UsageBarNotice['phase'], string> = { available: SKY, updating: SKY, restart: OK, failed: BAD }
const ALT: Record<UsageBarNotice['phase'], (v: string) => string> = {
  available: v => `Update usage-bar to ${v}`,
  updating: v => `Updating usage-bar to ${v}`,
  restart: v => `usage-bar ${v} is installed; restart to run it`,
  failed: v => `Updating usage-bar to ${v} failed; retry`,
}
/** From the card's right edge to the update tab's right end: the card's corner, a short straight run, the fillet. */
const INSET_RIGHT = CORNER + 10 + F
/** The room inside the update tab at each end. */
const UPDATE_PAD = 11
/** The label's room: the word in bold and the version, at the band's 12 px, and a little over for the app's own face. */
const labelWidth = (word: string, version: string) => (measure(`${word} `, true) + measure(version, false)) * 1.04 + 2
const UPDATE_RUN_MS = 1_600
const SPIN_MS = 1_000

/** The room between the lamp and the label: about 13 px from the lamp's dot to the word, clear of its glow. */
const LAMP_GAP = 13
/** The update tab's body, between its two sides: the label's room, the lamp, and the padding at each end. */
const updateBody = (n: UsageBarNotice) => {
  const { word, version } = updateWords(n)
  return UPDATE_PAD + 8 + LAMP_GAP + labelWidth(word, version) + UPDATE_PAD
}
/** The least room between the two tabs, fillets included. */
const TABS_APART = 12
/**
 * Where the project tab must end, in the drawings' own coordinates (the card's left edge `EDGE_SIDE` in), on a
 * card `cardWidth` px wide with the update tab at its right end: 12 px clear of that tab, each counted with its
 * fillets. Without a notice, no limit.
 */
export const projectRoom = (n: UsageBarNotice | null, cardWidth: number): number | undefined => {
  if (!n) return undefined
  const updateLeft = cardWidth - INSET_RIGHT - updateBody(n) - F - 2
  return EDGE_SIDE + updateLeft - TABS_APART - F - 2
}

/** The update tab's words: what its label says. */
export const updateWords = (n: UsageBarNotice) => ({ word: WORD[n.phase], version: n.version, color: LAMP[n.phase] })

/**
 * The update tab, as its own drawing, its base level with the card's top edge where it is laid `EDGE_TOP` below
 * the top of a plate (a lowered plate's card edge is `LIFT + EDGE_TOP` down, the drawing's base `TAB_H`).
 * - `right`: px from the drawing's right edge to the outer edge of a plate laid at the band's right end, where
 *   the card's own edge is `EDGE_SIDE` inside.
 * - `label`: where the label goes, from the same edge: its right end, its width and its middle from the top.
 * `withText` draws the word and the version too, for pictures; in the band they are a Button laid over it.
 * Arrival (it rises, the lamp pops) is timed from `n.since`, the spinner and the running light from the clock.
 */
export function updateTab(n: UsageBarNotice, look: TabStyle, at: number, withText = false) {
  const { word, version, color: lamp } = updateWords(n)
  const labelW = labelWidth(word, version)
  const w = updateBody(n)
  const x = F + 3
  const right = x + w
  const W = Math.ceil(w + 2 * F + 6)
  const H = TAB_H + 4
  const base = TAB_H
  const top = base - TAB_H + 2
  const edge = base + EDGE_Y
  const foot = base + 2.4
  const mid = top + PAD_TOP + 8
  const outline = `M${x - F - 2} ${edge}H${x - F}A${F} ${F} 0 0 0 ${x} ${edge - F}V${top + R}A${R} ${R} 0 0 1 ${x + R} ${top}H${right - R}A${R} ${R} 0 0 1 ${right} ${top + R}V${edge - F}A${F} ${F} 0 0 0 ${right + F} ${edge}H${right + F + 2}`
  const lx = x + UPDATE_PAD + 4
  const busy = n.phase === 'updating'
  const elapsed = at - n.since
  const arriving = elapsed < ARRIVAL_MS
  const delay = (ms: number) => `${Math.round(ms - elapsed)}ms`
  const style =
    arriving || busy
      ? '<style>' +
        (arriving
          ? `.ut-rise{animation:utr .32s cubic-bezier(.2,.9,.25,1) ${delay(0)} both}@keyframes utr{from{transform:translateY(${TAB_H}px)}}` +
            `.ut-pop{transform-box:fill-box;transform-origin:50% 50%;animation:utp .4s cubic-bezier(.3,1.6,.5,1) ${delay(300)} both}@keyframes utp{from{transform:scale(.2);opacity:0}}`
          : '') +
        (busy
          ? `.ut-run{animation:utt ${UPDATE_RUN_MS}ms linear -${at % UPDATE_RUN_MS}ms infinite}@keyframes utt{from{transform:translateX(${x + R - 34}px)}to{transform:translateX(${right - R}px)}}` +
            `.ut-spin{transform-box:fill-box;transform-origin:50% 50%;animation:uts ${SPIN_MS}ms linear -${at % SPIN_MS}ms infinite}@keyframes uts{to{transform:rotate(360deg)}}`
          : '') +
        '@media (prefers-reduced-motion: reduce){.ut-rise,.ut-pop,.ut-spin{animation:none}.ut-run{display:none}}</style>'
      : ''
  const lampSvg = busy
    ? `<circle class="ut-spin" cx="${lx}" cy="${mid}" r="4.2" fill="none" stroke="${lamp}" stroke-width="1.6" stroke-dasharray="16 11" stroke-linecap="round"/>`
    : `<g${arriving ? ' class="ut-pop"' : ''}><circle cx="${lx}" cy="${mid}" r="9" fill="url(#utg)"/><circle cx="${lx}" cy="${mid}" r="3.6" fill="${lamp}"/><circle cx="${lx - 1}" cy="${mid - 1.1}" r="1.1" fill="#fff" fill-opacity=".7"/></g>`
  // Right-aligned, as the band's Button stands: anchored at the label's right end, any slack falls by the lamp.
  const text = withText
    ? `<text x="${right - UPDATE_PAD}" y="${mid + 4.2}" text-anchor="end" font-family="${FONT}" font-size="12" fill="${printOf(look).name}"><tspan font-weight="700"${busy ? (look.print === 'dark' ? ` fill="${printOf(look).sub}"` : ' fill-opacity=".7"') : ''}>${esc(word)}</tspan><tspan fill="${printOf(look).sub}"> ${esc(version)}</tspan></text>`
    : ''
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${style}<defs>` +
    `<linearGradient id="utf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${look.fill[0]}"/><stop offset="1" stop-color="${look.fill[1]}"/></linearGradient>` +
    `<linearGradient id="ute" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${edge}"><stop offset="0" stop-color="${look.line}" stop-opacity=".5"/><stop offset="1" stop-color="${look.line}" stop-opacity="${look.ink}"/></linearGradient>` +
    `<radialGradient id="utg"><stop offset="0" stop-color="${lamp}" stop-opacity=".55"/><stop offset="1" stop-color="${lamp}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="utl"><stop offset="0" stop-color="${lamp}" stop-opacity="0"/><stop offset=".5" stop-color="${lamp}"/><stop offset="1" stop-color="${lamp}" stop-opacity="0"/></linearGradient>` +
    // It rises from behind the card: nothing of it shows below the card's top edge.
    `<clipPath id="utk"><rect x="0" y="-9" width="${W}" height="${foot + 9}"/></clipPath><clipPath id="utc"><rect x="${x + R}" y="${top - 2}" width="${right - x - 2 * R}" height="4"/></clipPath></defs>` +
    `<g clip-path="url(#utk)"><g${arriving ? ' class="ut-rise"' : ''}>` +
    // The fill covers the card's edge under the tab; the outline meets that edge on its own line, as the project tab's does.
    `<rect x="${x - F - 2}" y="${edge - EDGE_W / 2 - 0.1}" width="${w + 2 * F + 4}" height="${foot - edge + EDGE_W / 2 + 0.1}" fill="${look.fill[1]}"/>` +
    `<path d="${outline}V${foot}H${x - F - 2}Z" fill="url(#utf)"/><path d="${outline}" fill="none" stroke="url(#ute)" stroke-width="${EDGE_W}"/>` +
    (busy ? `<g clip-path="url(#utc)"><rect class="ut-run" x="0" y="${top - 1.6}" width="34" height="3.2" fill="url(#utl)"/></g>` : '') +
    lampSvg +
    text +
    '</g></g></svg>'
  const outer = EDGE_SIDE + INSET_RIGHT - (W - right)
  return {
    source,
    alt: ALT[n.phase](version),
    width: W,
    height: H,
    animated: arriving || busy,
    right: outer,
    label: { right: outer + (W - right) + UPDATE_PAD, width: labelW, mid },
  }
}
