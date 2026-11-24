// The VU mode of the band: two backlit meter faces, the context and the
// 5-hour limit, with a needle each, the last fifth of the scale in red, a blue
// pace mark and a peak lamp that lights near the top. The session's numbers
// run along the card in warm print. The plate gives the other limits small
// edgewise meters. In a narrow pane the numbers go first, then the 5-hour
// meter moves onto the plate as a third edgewise row; the context stays.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import { RAIL } from './glass'
import type { InstrumentInput, Limit } from './instruments'
import { HN, P, T, arc, contextHot, contextOf, f, hot, limitsAlt, limitsOf, numbersAlt, pct, roomOf, stationRow } from './instruments'

const H = CARD_HEIGHT
const VU = { ground: '#120d08', print: '#f6d9a0', dim: '#a87f4c', edge: 'rgba(246,217,160,.26)', rule: 'rgba(246,217,160,.12)' }
const INK = '#2a1d10'
const RED = '#c4321c'

const DEFS =
  `<radialGradient id="vuGlow" cx="50%" cy="95%" r="90%"><stop offset="0" stop-color="#fff3d4"/><stop offset=".55" stop-color="#f2d595"/><stop offset="1" stop-color="#c3924a"/></radialGradient>` +
  `<linearGradient id="vuEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dfa8"/><stop offset="1" stop-color="#d3a25a"/></linearGradient>` +
  `<filter id="vuLed" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
const spill = (cx: number) =>
  `<radialGradient id="vuSpill" cx="${f(cx)}" cy="70" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb24a" stop-opacity=".16"/><stop offset="1" stop-color="#ffb24a" stop-opacity="0"/></radialGradient>`

/** A backlit meter face: an arc scale with the last fifth red, a needle at `v` (none before a reading), a blue pace mark, a peak lamp. */
const face = (id: string, x: number, y: number, w: number, h: number, label: string, v: number | null, pace: number | null, peak: boolean, shown = v) => {
  const cx = x + w / 2
  const cy = y + h + 26
  const r = h + 4
  const sweep = Math.min(42, (Math.asin(Math.min(0.95, (w / 2 - 14) / r)) * 180) / Math.PI)
  const A = (t: number) => -sweep + (2 * sweep * t) / 100
  let s = `<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/></clipPath><g clip-path="url(#${id}c)">`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#vuGlow)"/>`
  s += `<path d="${arc(cx, cy, r, A(0), A(80))}" fill="none" stroke="${INK}" stroke-width="1.1"/>`
  s += `<path d="${arc(cx, cy, r + 2.5, A(80), A(100))}" fill="none" stroke="${RED}" stroke-width="4.5"/>`
  for (let t = 0; t <= 100; t += 10) {
    const [a, b] = P(cx, cy, r, A(t))
    const [c, d] = P(cx, cy, r + (t % 20 ? 5 : 8), A(t))
    const col = t >= 80 ? RED : INK
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${col}" stroke-width="1"/>`
    if (t % 20 === 0 && w >= 120) {
      const [lx, ly] = P(cx, cy, r + 15, A(t))
      s += T(lx, ly + 2.5, String(t), { size: 7, anchor: 'middle', fill: col, font: HN })
    }
  }
  if (pace !== null) {
    const [a, b] = P(cx, cy, r - 9, A(Math.min(1, Math.max(0, pace)) * 100))
    const [c, d] = P(cx, cy, r - 1, A(Math.min(1, Math.max(0, pace)) * 100))
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="#1f5fbf" stroke-width="2.6" stroke-linecap="round"/>`
  }
  // At rest before a reading, the needle lies at zero.
  const [nx, ny] = P(cx, cy, r + 10, A(v ?? 0))
  s += `<line x1="${f(cx + 1.5)}" y1="${f(cy + 1.5)}" x2="${f(nx + 1.5)}" y2="${f(ny + 2)}" stroke="#000" stroke-opacity=".2" stroke-width="1.6"/>`
  s += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(nx)}" y2="${f(ny)}" stroke="#17110a" stroke-width="1.3"/>`
  // The print keeps a halo of the face, so the needle passes behind it.
  const halo = ' stroke="#f4dca4" stroke-width="5" paint-order="stroke" stroke-linejoin="round"'
  s += T(x + 8, y + h - 7, label, { size: 6.8, spacing: 1.1, weight: 600, fill: '#5a4326', extra: halo })
  s += T(x + w - 8, y + h - 7, shown === null ? '–' : `${Math.round(shown)}%`, { size: 10.5, weight: 700, anchor: 'end', fill: peak ? '#b3261e' : INK, font: HN, extra: halo })
  s += `<rect x="${x}" y="${y}" width="${w}" height="${f(h * 0.42)}" fill="#fff" opacity=".08"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3.5"/></g>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="#3a2a18" stroke-width="1.4"/>`
  s += `<circle cx="${x + w - 9}" cy="${y + 9}" r="2.6" fill="${peak ? '#ff3a1c' : '#5a2a1a'}"${peak ? ' filter="url(#vuLed)"' : ''}/>`
  return s
}

/** A small edgewise meter: a backlit window, ticks, a needle moving across, a blue pace caret. */
const edgewise = (x: number, y: number, w: number, h: number, v: number, pace: number | null, peak: boolean) => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#vuEdge)" stroke="#3a2a18"/>`
  for (let k = 0; k <= 10; k++) {
    const tx = x + 3 + ((w - 6) * k) / 10
    s += `<line x1="${f(tx)}" y1="${y + 1.5}" x2="${f(tx)}" y2="${y + (k % 5 ? 4 : 6)}" stroke="${k >= 8 ? RED : INK}" stroke-width=".8"/>`
  }
  s += `<rect x="${f(x + 3 + (w - 6) * 0.8)}" y="${y + 1}" width="${f((w - 6) * 0.2)}" height="1.6" fill="${RED}"/>`
  const nx = x + 3 + ((w - 6) * v) / 100
  s += `<line x1="${f(nx)}" y1="${y + 2}" x2="${f(nx)}" y2="${y + h - 1.5}" stroke="${peak ? '#b3261e' : '#17110a'}" stroke-width="1.4"/>`
  if (pace !== null) s += `<path d="M${f(x + 3 + (w - 6) * Math.min(1, Math.max(0, pace)) - 3)} ${y - 4}h6l-3 3.6z" fill="#6fa4ff"/>`
  return s
}

/** The plate's width left of the rail: wide with the reset times, narrow without. */
const plateBody = (i: InstrumentInput) => (i.wide ? 160 : 110)
const FACE_W = 146
/** The pane has room for both faces: the 5-hour meter stays on the card. */
const twoFaces = (i: InstrumentInput) => !!i.five && roomOf(i, plateBody(i)) >= 10 + 2 * (FACE_W + 4) + 8
/** The limits the plate shows: all but the 5-hour while it has its face on the card. */
const plateRows = (i: InstrumentInput): Limit[] => (twoFaces(i) ? limitsOf(i).filter(l => l.kind !== 'five') : limitsOf(i))

/** The card's left end: the context meter, the 5-hour meter where there is room, and the session's numbers. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function vuArt(i: InstrumentInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const two = twoFaces(i)
  let s = `<rect x="-9" width="${W}" height="${H}" fill="url(#vuSpill)"/>`
  s += face('m1', 10, 11, FACE_W, 71, 'CONTEXT', contextOf(i), null, contextHot(i))
  if (two && i.five) s += face('m2', 164, 11, FACE_W, 71, '5-HOUR', pct(i.five), i.five.pace, hot(i.five), i.five.percent)
  s += stationRow(i, (two ? 310 : 156) + 22, roomOf(i, plateBody(i)), { label: VU.dim, value: VU.print, y: 58, size: 20, withTokens: true })
  return { source: leftEnd(W, VU.ground, s, { defs: DEFS + spill(160), edge: VU.edge }), width: W }
}

/** The card's right end: the limits as edgewise meters, the reset times on the wide plate, and the rail. Drawn at its exact size, with the card's two right corners cut. */
export function vuPlate(i: InstrumentInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const inner = body + RAIL
  const rows = plateRows(i)
  const ys = rows.length >= 3 ? [24, 48, 72] : rows.length === 2 ? [33, 63] : [48]
  const mw = i.wide ? 58 : 40
  const s = rows
    .map((r, k) => {
      const c = ys[k] ?? 0
      return (
        T(8, c + 3, r.key, { size: 7.5, weight: 700, spacing: 0.6, fill: VU.dim }) +
        edgewise(30, c - 7, mw, 12, pct(r.g), r.g.pace, hot(r.g)) +
        T(30 + mw + 5, c + 4, `${Math.round(r.g.percent)}%`, { size: 11, font: HN, fill: hot(r.g) ? '#ff6a4a' : VU.print }) +
        (i.wide && r.g.left ? T(body - 6, c + 4, r.g.left.replace(/ /g, ''), { size: 10, anchor: 'end', fill: VU.print, opacity: 0.8, font: HN }) : '')
      )
    })
    .join('')
  // The spill is centred where it is on the card, so it runs on across the plate.
  return rightEnd(inner, body, VU.ground, `<rect width="${inner}" height="${H}" fill="url(#vuSpill)"/>` + s, { defs: DEFS + spill(160 - (i.narrow - inner)), edge: VU.edge, rule: VU.rule })
}

/** What the card's left end shows, for a screen reader: the 5-hour meter too, while it is there. */
export const vuAlt = (i: InstrumentInput) => {
  const five = twoFaces(i) ? limitsOf(i).find(l => l.kind === 'five') : undefined
  return five ? `${numbersAlt(i)}, ${limitsAlt([five]).replace('Limits: ', '')}` : numbersAlt(i)
}
export const vuLimitsAlt = (i: InstrumentInput) => limitsAlt(plateRows(i))
