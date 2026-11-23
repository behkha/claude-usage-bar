// The project tab: a folder tab rising from the card's top-left edge, with the
// project's name, its branch and, in a worktree, a WORKTREE chip. A strip in
// the project's colour runs along its top; the colour comes from the name, so a
// project looks the same in every session.
//
// The app draws the band in a box of its own and crops whatever is drawn past
// it, so the tab cannot stand above that box. Instead the card is lowered by
// the tab's height and the room that opens above it is painted in the page's
// colour: the app's box disappears there, and the tab reads as standing above
// the card. The card modes lower their drawings (`lift`); Classic, which has no
// drawing behind it, gets a top edge of its own (`classicTop`).
//
// Arrival, for a moment after the project or branch changes: the tab rises out
// of the card, the strip draws in from its middle, the monogram pops, and a
// sheen crosses the name once. While Claude works a light runs along the strip.
// Every animation is timed from the moment of the change, not from the
// drawing's own start, so a redraw meanwhile picks it up where it stands.

import { CORNER, EDGE_SIDE, EDGE_TOP } from './card'
import { textWidth as measure } from './measure'
import { branchLabel, colorOf, cut, monogram } from './project'
import type { UsageBarProject } from '../types'

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
 * How bright each card mode draws its top edge (white's opacity), so the tab's outline meets it at the same
 * brightness: Glass's rim where it starts (glass.ts `rim`), Cluster's hairline (cluster.ts `hairline`), and
 * Classic's opaque edge over the page.
 */
export const EDGE_INK = { glass: 0.55, cluster: 0.24, classic: 0.53 } as const
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
        `.pb-strip{transform-box:fill-box;transform-origin:50% 50%;animation:pbs .5s ease-out ${at(250)} both}@keyframes pbs{from{transform:scaleX(0);opacity:0}}` +
        `.pb-pop{transform-box:fill-box;transform-origin:50% 50%;animation:pbp .4s cubic-bezier(.3,1.6,.5,1) ${at(300)} both}@keyframes pbp{from{transform:scale(.3);opacity:0}}` +
        `.pb-sheen{animation:pbh 1.1s ease-out ${at(700)} both}@keyframes pbh{from{transform:translateX(-40px)}to{transform:translateX(${sheenTo}px)}}`
      : '') +
    (m.busy ? `.pb-run{animation:pbt ${RUN_MS}ms linear -${m.now % RUN_MS}ms infinite}@keyframes pbt{from{transform:translateX(${runFrom}px)}to{transform:translateX(${runTo}px)}}` : '') +
    '@media (prefers-reduced-motion: reduce){.pb-rise,.pb-strip,.pb-pop{animation:none}.pb-sheen,.pb-run{display:none}}</style>'
  )
}

/**
 * The tab, drawn with its left edge at `x` and its base on the card's top edge `base`, as an SVG fragment.
 * Fillets join it to the edge, and it rises from behind the card. `body` is the colour of the card it stands
 * on, so the two meet without a seam: the card modes' glass, or the app's box under Classic.
 */
function tab(p: UsageBarProject, m: TabMotion, x: number, base: number, body: 'glass' | 'band', edgeInk: number): string {
  const hue = colorOf(p.name)
  const name = cut(p.name, 28)
  const branch = branchLabel(p)
  const top = base - TAB_H + 2
  // The row's middle: the chips are 16 px tall, so their tops sit PAD_TOP under the tab's top edge.
  const mid = top + PAD_TOP + 8

  // Left to right: monogram, name, a rule, the branch chip, the worktree chip.
  const mgX = x + 9
  const nameX = mgX + 16 + 8
  const nameW = measure(name, true) * (NAME_PX / 12) * HEAVY
  const ruleX = nameX + nameW + 9
  const chipX = ruleX + 10
  const chipW = 6 + 10 + 5 + [...branch].length * BRANCH_PX * MONO_EM + 6
  const wtX = chipX + chipW + 6
  const wtW = p.worktree ? measure('WORKTREE', true) * (9 / 12) + 8 * 0.6 + 14 : 0
  const right = (p.worktree ? wtX + wtW : chipX + chipW) + 11
  const width = right - x

  const [fillTop, fillFoot] = body === 'glass' ? ['#1c1c1c', '#141414'] : ['#202020', BAND]
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
  const stripL = x + R
  const stripR = right - R
  // The strip is the tab's own top edge in the project's colour: along the top, round both corners and a little
  // way down each side, where the grey edge takes over. Drawn over the edge, so the two are one line.
  const cap = `M${x} ${top + R + 4}V${top + R}A${R} ${R} 0 0 1 ${x + R} ${top}H${right - R}A${R} ${R} 0 0 1 ${right} ${top + R}V${top + R + 4}`

  const defs =
    `<linearGradient id="pbf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fillTop}"/><stop offset="1" stop-color="${fillFoot}"/></linearGradient>` +
    // The outline is as bright as the card's own top edge where the two meet, so the edge runs up and round the tab as one line.
    `<linearGradient id="pbe" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${edge}"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="${edgeInk}"/></linearGradient>` +
    // In px: a level line has no height, so a region measured from its box would hold no glow.
    `<filter id="pbg" filterUnits="userSpaceOnUse" x="${x - 10}" y="${top - 10}" width="${width + 20}" height="${R + 26}"><feGaussianBlur stdDeviation="2.4"/></filter>` +
    `<linearGradient id="pbs"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    // The tab rises from behind the card: nothing of it shows below the card's top edge.
    `<clipPath id="pbk"><rect x="${x - F - 3}" y="-99" width="${width + 2 * F + 6}" height="${foot + 99}"/></clipPath>` +
    `<clipPath id="pbn"><text x="${nameX}" y="${mid + 4.4}" font-family="${FONT}" font-size="${NAME_PX}" font-weight="800">${esc(name)}</text></clipPath>` +
    `<clipPath id="pbl"><rect x="${stripL}" y="${top - 2}" width="${stripR - stripL}" height="4"/></clipPath>`

  const branchMark = p.repo ? branchIcon(chipX + 6, mid - 6, '#a6a6ab') : `<path d="${FOLDER_ICON}" transform="translate(${chipX + 6} ${mid - 6.5})" fill="none" stroke="#a6a6ab" stroke-width="1.3"/>`

  const drawn =
    under +
    `<path d="${outline}V${foot}H${x - F - 2}Z" fill="url(#pbf)"/>` +
    `<path d="${outline}" fill="none" stroke="url(#pbe)" stroke-width="${EDGE_W}"/>` +
    // the strip in the project's colour, with its glow
    `<g${cls('pb-strip')}><path d="${cap}" fill="none" stroke="${hue}" stroke-width="3" filter="url(#pbg)" opacity=".9"/>` +
    `<path d="${cap}" fill="none" stroke="${hue}" stroke-width="2"/></g>` +
    (m.busy ? `<g clip-path="url(#pbl)"><rect class="pb-run" x="0" y="${top - 1.6}" width="34" height="3.2" fill="url(#pbs)"/></g>` : '') +
    // the monogram
    `<g${cls('pb-pop')}><rect x="${mgX}" y="${mid - 8}" width="16" height="16" rx="4" fill="${hue}"/>` +
    `<text x="${mgX + 8}" y="${mid + 3}" text-anchor="middle" font-family="${FONT}" font-size="8.5" font-weight="800" fill="#000">${esc(monogram(p.name))}</text></g>` +
    // the name, and the sheen that crosses it once
    `<text x="${nameX}" y="${mid + 4.4}" font-family="${FONT}" font-size="${NAME_PX}" font-weight="800" fill="#fff">${esc(name)}</text>` +
    (arriving ? `<g clip-path="url(#pbn)"><rect class="pb-sheen" x="${nameX}" y="${top}" width="36" height="${TAB_H}" fill="url(#pbs)"/></g>` : '') +
    `<line x1="${ruleX}" y1="${mid - 6}" x2="${ruleX}" y2="${mid + 6}" stroke="#fff" stroke-opacity=".16"/>` +
    // the branch chip
    `<rect x="${chipX}" y="${mid - 8}" width="${chipW}" height="16" rx="4" fill="none" stroke="#fff" stroke-opacity=".18"/>` +
    branchMark +
    `<text x="${chipX + 21}" y="${mid + 3.8}" font-family="${MONO}" font-size="${BRANCH_PX}" font-weight="500" fill="#b9b9be">${esc(branch)}</text>` +
    (p.worktree
      ? `<rect x="${wtX}" y="${mid - 6.5}" width="${wtW}" height="13" rx="3" fill="none" stroke="${hue}" stroke-opacity=".6"/>` +
        `<text x="${wtX + 6}" y="${mid + 3.2}" font-family="${FONT}" font-size="9" font-weight="700" letter-spacing=".6" fill="${hue}">WORKTREE</text>`
      : '')

  const style = arriving || m.busy ? motionStyle(m, arriving, nameW + 40, stripL - 34, stripR) : ''
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
  const page = `<rect x="-1" y="-1" width="${width + 2}" height="${CARD_TOP + CORNER + 1}" fill="${PAGE}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + LIFT}" viewBox="0 0 ${width} ${height + LIFT}">` +
    (clip ? `${page}<clipPath id="pbcard"><rect x="-1" y="${CARD_TOP + 0.5}" width="${width + 2}" height="${height + 2}"/></clipPath><g clip-path="url(#pbcard)">${inner}</g>` : inner) +
    above +
    '</svg>'
  )
}

/** The card's art with the tab above its left end: the lowered art and the tab, in one drawing. */
export const tabbedArt = (art: { source: string; width: number }, height: number, p: UsageBarProject, m: TabMotion, edgeInk: number) =>
  lift(art.source, art.width, height, true, tab(p, m, EDGE_SIDE + INSET, CARD_TOP, 'glass', edgeInk))

/** Classic's drawings' height: the room above, the edge, and the corners' sweep down the sides. */
const CLASSIC_H = CARD_TOP + CORNER + 12
/** The width of Classic's right end, pinned to the band's right edge. */
export const CLASSIC_END = 140

/**
 * Classic's top edge, as the card modes have it: the page's colour above, the edge with its rounded corners,
 * and the tab rising from it. Two drawings: a wide one from the left, cropped by the band, with the tab and the
 * left corner; and the right end, pinned to the band's right edge, with the right corner. In both, the edge is
 * drawn opaque, so where the two overlap nothing doubles.
 */
export function classicTop(p: UsageBarProject, m: TabMotion, width: number): { left: string; right: string; height: number } {
  const r = CORNER
  const y = CARD_TOP + 0.5
  // the edge fades down the sides as the card modes' rim does
  const fade = `<linearGradient id="pbrim" gradientUnits="userSpaceOnUse" x1="0" y1="${y}" x2="0" y2="${y + r + 12}"><stop offset="0" stop-color="${RIM}"/><stop offset="1" stop-color="${RIM}" stop-opacity="0"/></linearGradient>`
  const svg = (w: number, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${CLASSIC_H}" viewBox="0 0 ${w} ${CLASSIC_H}"><defs>${fade}</defs>${body}</svg>`

  const l = EDGE_SIDE + 0.5
  const left =
    `<path d="M-1 -1H${width + 1}V${y}H${l + r}A${r} ${r} 0 0 0 ${l} ${y + r}V${CLASSIC_H + 1}H-1Z" fill="${PAGE}"/>` +
    `<path d="M${width + 1} ${y + 0.9}H${l + r}A${r - 0.9} ${r - 0.9} 0 0 0 ${l + 0.9} ${y + r}V${y + r + 12}" fill="none" stroke="url(#pbrim)" stroke-width="${EDGE_W}"/>` +
    tab(p, m, EDGE_SIDE + INSET, CARD_TOP, 'band', EDGE_INK.classic)

  const e = CLASSIC_END - EDGE_SIDE - 0.5
  const right =
    `<path d="M-1 -1H${CLASSIC_END + 1}V${CLASSIC_H + 1}H${e}V${y + r}A${r} ${r} 0 0 0 ${e - r} ${y}H-1Z" fill="${PAGE}"/>` +
    `<path d="M-1 ${y + 0.9}H${e - r}A${r - 0.9} ${r - 0.9} 0 0 1 ${e - 0.9} ${y + r}V${y + r + 12}" fill="none" stroke="url(#pbrim)" stroke-width="${EDGE_W}"/>`

  return { left: svg(width, left), right: svg(CLASSIC_END, right), height: CLASSIC_H }
}
