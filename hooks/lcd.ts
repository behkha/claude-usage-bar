// The LCD mode of the band: the whole card as a backlit character LCD, the
// kind on a battery charger. Every character sits in a 5 x 7 cell, and the
// cell's unlit dots show faintly behind the lit ones. The context is the big
// figure at the left; each limit is a bar of dots, two dots high with a head
// one dot taller, its percent riding just past the head and a small caret of
// dots under the bar where its pace stands. The plate is the same screen run
// on, with the session's numbers on it; the rail stands on the black bezel.
//
// The backlight is green, and turns amber when a limit runs ahead of its pace
// or the context passes 90%.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import type { Gauge } from './card'
import { RAIL, clock, dollars, short } from './glass'

export type LcdInput = {
  /** CSS px drawn across, and the narrowest the card could be. */
  width: number
  narrow: number
  /** The pane has room for the wide plate and the reset times. */
  wide: boolean
  five: Gauge | null
  seven: Gauge | null
  /** The weekly limit the account keeps for one model, under that model's name in capitals (`FABLE`); null when it has none. */
  model: { name: string; gauge: Gauge } | null
  /** This session's context: fill 0..100, tokens in the window, the window's size; null before the first reading. */
  context: { percent: number; tokens: number; window: number } | null
  /** The share of reads served from cache, 0..100; null before the first read. */
  cache: number | null
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  turns: number
  /** Minutes since the session began. */
  minutes: number
}

const H = CARD_HEIGHT
/** The bezel round the screen. */
const BEZEL = '#0f100e'
const EDGE = 'rgba(255,255,255,.16)'
/** The two backlights: green at rest, amber when something runs hot. */
const GREEN = { top: '#c3da55', foot: '#a6c13a', ink: '#1b2507', ghost: 'rgba(27,37,7,.075)' }
const AMBER = { top: '#f3c14a', foot: '#dc9c2c', ink: '#2a1504', ghost: 'rgba(42,21,4,.08)' }
type Light = typeof GREEN

const f = (n: number) => String(+n.toFixed(2))
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

// ---------- the dots ----------

/** A 5 x 7 character font, row by row from the top; a character missing here shows as an empty cell. */
const FONT: Record<string, string> = {
  '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100', '%': '11000110010001000100010001001100011', '$': '00100011111010001110001011111000100',
  '.': '00000000000000000000000000110001100', ':': '00000011000110000000011000110000000', '/': '00000000010001000100010001000000000',
  '-': '00000000000000011111000000000000000', ' ': '00000000000000000000000000000000000',
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11100100101000110001100011001011100', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
}

/** The dots of one drawing, lit and unlit, each a list of path pieces: two paths in the end, however many dots. */
type Dots = { lit: string[]; ghost: string[] }
/** A dot `pitch` apart from the next is this share of the pitch: the gap between dots is what makes them read as dots. */
const DOT = 0.84
const dot = (x: number, y: number, d: number) => `M${f(x)} ${f(y)}h${f(d)}v${f(d)}h-${f(d)}z`

/** Text in 5 x 7 cells, a cell's pitch apart, every dot of every cell drawn and the unlit ones as ghosts. */
const text = (px: Dots, x: number, y: number, s: string, pitch: number) => {
  const d = pitch * DOT
  ;[...s.toUpperCase()].forEach((ch, k) => {
    const bits = FONT[ch] ?? FONT[' ']!
    for (let b = 0; b < 35; b++) (bits[b] === '1' ? px.lit : px.ghost).push(dot(x + k * 6 * pitch + (b % 5) * pitch, y + Math.floor(b / 5) * pitch, d))
  })
}
/** The width of `s` in cells of `pitch`. */
const textWidth = (s: string, pitch: number) => s.length * 6 * pitch

/** The bar's dot pitch. */
const BAR = 3.2
/** A bar `cols` dots long, filled to `v` percent: two dots high and the head a dot taller. Columns `skip[0]` to `skip[1]` are left out, for the percent. */
const bar = (px: Dots, x: number, y: number, cols: number, v: number, skip: [number, number]) => {
  const d = BAR * DOT
  const lit = Math.round((cols * v) / 100)
  for (let c = 0; c < cols; c++) {
    if (c >= skip[0] && c < skip[1]) continue
    for (let r = 0; r < 3; r++) (c < lit && (r > 0 || c === lit - 1) ? px.lit : px.ghost).push(dot(x + c * BAR, y + r * BAR, d))
  }
}

const paths = (px: Dots, c: Light) => `<path d="${px.ghost.join('')}" fill="${c.ghost}"/><path d="${px.lit.join('')}" fill="${c.ink}"/>`
const backlight = (c: Light) => `<linearGradient id="lb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.foot}"/></linearGradient>`
/** The screen: the backlit glass `w` px wide from `x`, inset from the card's edge, with a dark lip round it. */
const screen = (x: number, w: number) =>
  `<rect x="${x}" y="3" width="${f(w)}" height="${H - 6}" rx="9" fill="url(#lb)"/><rect x="${x}" y="3" width="${f(w)}" height="${H - 6}" rx="9" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`

/** The glare across the screen's top, on the card and the plate alike, so it runs on unbroken. */
const glare = (x: number, w: number) => `<rect x="${x}" y="3" width="${f(w)}" height="30" rx="9" fill="#fff" opacity=".06"/>`

// ---------- the numbers ----------

type Row = { key: string; name: string; g: Gauge }
const limitRows = (i: LcdInput): Row[] => {
  const rows: Row[] = []
  if (i.five) rows.push({ key: '5H', name: '5-hour', g: i.five })
  if (i.seven) rows.push({ key: 'WK', name: 'weekly', g: i.seven })
  if (i.model) rows.push({ key: i.model.name.slice(0, 3), name: `${i.model.name} weekly`, g: i.model.gauge })
  return rows
}
const contextOf = (i: LcdInput) => (i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : null)
/** Amber when a limit runs ahead of its pace or the context is nearly full. */
const lightOf = (i: LcdInput): Light => (limitRows(i).some(r => r.g.level !== 'ok') || Math.round(contextOf(i) ?? 0) >= 90 ? AMBER : GREEN)

/** The plate's width left of the rail: wide with the keys apart from their values, narrow with the two run together. */
const plateBody = (i: LcdInput) => (i.wide ? 160 : 110)
/** The room the screen has left of the plate, on the narrowest card the pane could hold. */
const roomOf = (i: LcdInput) => i.narrow - plateBody(i) - RAIL - 8

// ---------- the screen ----------

/** Where the context's figure starts, and where the bars' keys start, right of it. */
const X0 = 14
const BARS_X = X0 + 100
/** Where a bar starts past its key: a three-letter key (FAB) keeps clear of it. */
const KEY_W = 36
/** The bars' least and most dots. */
const COLS_MIN = 20
const COLS_MAX = 140
/** The room the reset time takes at a bar's end, on the wide card. */
const LEFT_W = 60

/** The card's left end: the context, and each limit as a bar of dots. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function lcdArt(i: LcdInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const c = lightOf(i)
  const px: Dots = { lit: [], ghost: [] }
  const p = contextOf(i)
  const oy = 3
  text(px, X0, 10 + oy, 'CTX', 1.6)
  text(px, X0, 27 + oy, p === null ? '--%' : `${Math.round(p)}%`, 3.6)
  if (i.context && p !== null) text(px, X0, 63 + oy, `${short(i.context.tokens)}/${short(i.context.window)}`, 1.6)

  // Narrower panes lose the reset times first, then the bars shorten to their least.
  const cols = cl(Math.floor((roomOf(i) - BARS_X - KEY_W - (i.wide ? LEFT_W : 8)) / BAR), COLS_MIN, COLS_MAX)
  limitRows(i).forEach((r, k) => {
    const y = 10 + k * 24 + oy
    const v = cl(r.g.percent, 0, 100)
    text(px, BARS_X, y + 1, r.key, 1.6)
    // The percent rides just past the fill's head, in a gap cut out of the unlit dots.
    const label = `${Math.round(r.g.percent)}%`
    const head = Math.round((cols * v) / 100)
    const at = Math.max(0, Math.min(head + 1, cols - Math.ceil(textWidth(label, 1.3) / BAR) - 1))
    bar(px, BARS_X + KEY_W, y + 1, cols, v, [at, at + Math.ceil((textWidth(label, 1.3) + 3) / BAR)])
    text(px, BARS_X + KEY_W + at * BAR + 2, y + 0.4, label, 1.3)
    if (r.g.pace !== null) {
      const x = BARS_X + KEY_W + Math.floor(cols * cl(r.g.pace, 0, 1)) * BAR
      px.lit.push(dot(x, y + 12.4, 2.7), dot(x - BAR, y + 15.6, 2.7), dot(x + BAR, y + 15.6, 2.7))
    }
    if (i.wide && r.g.left) text(px, BARS_X + KEY_W + 8 + cols * BAR, y + 1, r.g.left.replace(/ /g, ''), 1.6)
  })

  const body = screen(3, W) + paths(px, c) + glare(3, W)
  return { source: leftEnd(W, BEZEL, body, { defs: backlight(c), edge: EDGE }), width: W }
}

/** The session's numbers the plate shows, three at most, in the order they give way. */
const stations = (i: LcdInput): Array<[string, string]> => {
  const s: Array<[string, string]> = []
  if (i.usd !== null) s.push(['COST', dollars(i.usd)])
  s.push(['TIME', clock(i.minutes)], ['TURN', String(i.turns)])
  if (i.cache !== null) s.push(['CACH', `${Math.round(i.cache)}%`])
  return s.slice(0, 3)
}

/** The card's right end: the screen run on, with cost, time and turns on it, and the rail on the black bezel. Drawn at its exact size, with the card's two right corners cut. */
export function lcdPlate(i: LcdInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const c = lightOf(i)
  const px: Dots = { lit: [], ghost: [] }
  stations(i).forEach(([key, value], r) => {
    const y = 13 + r * 25
    if (i.wide) {
      text(px, 8, y, key, 1.6)
      text(px, 58, y, value, 1.6)
    } else text(px, 6, y, `${key} ${value}`, 1.3)
  })
  // The screen starts left of the plate, so its rounded end is cut off and it reads as the art's screen run on.
  return rightEnd(body + RAIL, body, BEZEL, screen(-20, body + 16) + paths(px, c) + glare(-20, body + 16), { defs: backlight(c), edge: EDGE, rule: 'rgba(0,0,0,0)' })
}

/** What the card's left end shows, for a screen reader. */
export const lcdAlt = (i: LcdInput) => {
  const p = contextOf(i)
  return [
    i.context && p !== null ? `Context ${Math.round(p)}%, ${short(i.context.tokens)} of ${short(i.context.window)} tokens` : 'Context not read yet',
    ...limitRows(i).map(r => `${r.name} ${Math.round(r.g.percent)}%${r.g.level === 'ahead' ? ', ahead of pace' : r.g.level === 'high' ? ', nearly used up' : ''}`),
  ].join(', ')
}

/** What the plate shows, for a screen reader. */
export const lcdLimitsAlt = (i: LcdInput) => {
  const said: Record<string, string> = { COST: 'so far', TIME: 'elapsed', TURN: 'turns', CACH: 'of reads from cache' }
  return stations(i)
    .map(([key, value]) => `${value} ${said[key] ?? ''}`.trim())
    .join(', ')
}
