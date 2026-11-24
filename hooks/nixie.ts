// The Nixie mode of the band: the context in glowing wire digits behind
// glass, every other cathode of each tube faintly visible behind the lit one,
// and a neon lamp by the percent sign that lights when the context is nearly
// full. The session's numbers run along the card as glowing figures. The plate
// gives each limit an IN-13 bar tube: a glowing column for what is used and a
// cold mark at the pace. Over pace, the column and its percent turn red.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import { RAIL } from './glass'
import type { InstrumentInput } from './instruments'
import { HN, T, contextHot, contextOf, esc, f, hot, limitsAlt, limitsOf, numbersAlt, pct, roomOf, stationRow } from './instruments'

const H = CARD_HEIGHT
const NX = { ground: '#0b0908', lit: '#ffb15a', ghost: '#6b4a38', label: '#b08868', red: '#ff5a3a', edge: 'rgba(255,177,90,.2)', rule: 'rgba(255,177,90,.1)' }

// The glows are on text, circles and rects with height, never on a bare line, whose box has no height to blur in.
const DEFS =
  `<filter id="nxg" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<filter id="nxs" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<linearGradient id="nxGlass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".3" stop-color="#fff" stop-opacity=".02"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>` +
  `<pattern id="nxMesh" width="5" height="8.66" patternUnits="userSpaceOnUse"><path d="M0 0l2.5 4.33L0 8.66M5 0L2.5 4.33L5 8.66" fill="none" stroke="#8a6a50" stroke-width=".35"/></pattern>`

/** One tube: glass, the hex mesh, every cathode as a ghost, the lit one as glowing wire, and its cap. An unlit tube shows all ten ghosts. */
const tube = (x: number, y: number, w: number, h: number, ch: string, size: number, red = false) => {
  const cx = x + w / 2
  const base = y + h * 0.5 + size * 0.36
  const ghosts = /[\d ]/.test(ch) ? '0123456789'.split('').filter(g => g !== ch) : []
  const wire = (g: string, ghost: boolean) =>
    `<text x="${f(cx)}" y="${f(base)}" text-anchor="middle" font-family='${HN}' font-weight="200" font-size="${size}" fill="none" stroke="${ghost ? NX.ghost : red ? NX.red : NX.lit}" stroke-width="${ghost ? 0.5 : 1.5}"${ghost ? ' stroke-opacity=".32"' : ' filter="url(#nxg)"'}>${esc(g)}</text>`
  const rx = f(Math.min(w * 0.42, 12))
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#110c0a" stroke="#3d342d" stroke-width=".8"/>` +
    `<rect x="${x + 3}" y="${y + 6}" width="${w - 6}" height="${h - 12}" rx="3" fill="url(#nxMesh)" opacity=".5"/>` +
    ghosts.map(g => wire(g, true)).join('') +
    (ch === ' ' ? '' : wire(ch, false)) +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#nxGlass)"/>` +
    `<rect x="${x + 3}" y="${y + h - 3}" width="${w - 6}" height="3" rx="1" fill="#2a2420"/>`
  )
}
/** An INS-1 neon lamp: a tiny bulb, lit red or dark. */
const lamp = (x: number, y: number, on: boolean) =>
  `<ellipse cx="${x}" cy="${y}" rx="4" ry="5.5" fill="#1a130f" stroke="#5a4a3d" stroke-width=".8"/>` + (on ? `<circle cx="${x}" cy="${y}" r="2.4" fill="#ff4a2a" filter="url(#nxs)"/>` : `<circle cx="${x}" cy="${y}" r="1.8" fill="#4a3628"/>`)
/** An IN-13 bar tube: a thin glass tube, a glowing column for what is used, a cold mark at the pace. */
const in13 = (x: number, y: number, w: number, v: number, pace: number | null, red: boolean) =>
  `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4.5" fill="#17110e" stroke="#3d342d" stroke-width=".8"/>` +
  `<rect x="${x + 4}" y="${y + 3.5}" width="${w - 8}" height="2" fill="${NX.ghost}" fill-opacity=".5"/>` +
  `<rect x="${x + 4}" y="${y + 3}" width="${f(Math.max(1, ((w - 8) * v) / 100))}" height="3" rx="1.5" fill="${red ? '#ff4a2a' : '#ff8a2e'}" filter="url(#nxs)"/>` +
  (pace !== null ? `<rect x="${f(x + 3.4 + (w - 8) * Math.min(1, Math.max(0, pace)))}" y="${y - 3}" width="1.2" height="4" fill="#d8c8b8"/>` : '') +
  `<rect x="${x}" y="${y}" width="${w}" height="4" rx="2" fill="#fff" opacity=".06"/>`

/** The plate's width left of the rail: wide with the reset times, narrow without. */
const plateBody = (i: InstrumentInput) => (i.wide ? 160 : 112)

/** The tubes for the context: two digits, or three at 100, then the percent sign. */
const contextTubes = (i: InstrumentInput) => {
  const p = contextOf(i)
  const red = contextHot(i)
  if (p !== null && Math.round(p) >= 100)
    return tube(10, 8, 24, 72, '1', 40, red) + tube(36, 8, 24, 72, '0', 40, red) + tube(62, 8, 24, 72, '0', 40, red) + tube(88, 26, 18, 44, '%', 18)
  // Before the first reading both tubes are unlit, their ten cathodes all ghosts.
  const c = p === null ? '  ' : String(Math.round(p)).padStart(2, ' ')
  return tube(10, 8, 34, 72, c[0] ?? ' ', 54, red) + tube(46, 8, 34, 72, c[1] ?? '0', 54, red) + tube(82, 22, 24, 48, '%', 30)
}

/** The card's left end: the context in tubes, the neon lamp, and the session's numbers. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function nixieArt(i: InstrumentInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const body =
    `<radialGradient id="nxSpill" cx="60" cy="50" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff7a1e" stop-opacity=".12"/><stop offset="1" stop-color="#ff7a1e" stop-opacity="0"/></radialGradient><rect x="-9" width="${W}" height="${H}" fill="url(#nxSpill)"/>` +
    contextTubes(i) +
    lamp(112, 66, contextHot(i)) +
    // Narrower panes lose the numbers from the right; the tubes stay.
    stationRow(i, 128, roomOf(i, plateBody(i)), { label: NX.label, value: NX.lit, y: 58, size: 20, glow: 'nxs', withTokens: true })
  return { source: leftEnd(W, NX.ground, body, { defs: DEFS, edge: NX.edge }), width: W }
}

/** The card's right end: each limit an IN-13 bar tube with its percent, the reset times on the wide plate, and the rail. Drawn at its exact size, with the card's two right corners cut. */
export function nixiePlate(i: InstrumentInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const tw = i.wide ? 54 : 46
  const rows = limitsOf(i)
    .map((l, k) => {
      const y = 18 + k * 24
      return (
        T(8, y + 8, l.key, { size: 7.5, weight: 700, spacing: 0.6, fill: NX.label }) +
        in13(30, y, tw, pct(l.g), l.g.pace, hot(l.g)) +
        T(30 + tw + 6, y + 8.5, `${Math.round(l.g.percent)}%`, { size: 11, font: HN, weight: 300, fill: hot(l.g) ? '#ff6a4a' : NX.lit }) +
        (i.wide && l.g.left ? T(body - 6, y + 8.5, l.g.left.replace(/ /g, ''), { size: 10, anchor: 'end', fill: NX.lit, opacity: 0.75, font: HN }) : '')
      )
    })
    .join('')
  return rightEnd(body + RAIL, body, NX.ground, rows, { defs: DEFS, edge: NX.edge, rule: NX.rule })
}

export const nixieAlt = numbersAlt
export const nixieLimitsAlt = (i: InstrumentInput) => limitsAlt(limitsOf(i))
