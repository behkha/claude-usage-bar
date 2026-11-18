// The Cluster mode of the band: the card as a car's instrument cluster. Two
// gauges stand at its ends, each a bar that runs straight and then bends,
// beside a chamfered tile with its figures: context at the left; at the right
// the weekly limit and, side by side with it, the limit the account keeps for
// one model. Between them is the drive mode list, and the session's other
// numbers in two stacks beside it, the 5-hour limit among them. The whole card takes one colour from
// the drive mode: teal in eco, gold in normal, red in sport, where the bars
// bend at the top instead of the bottom.
//
// Three drawings: the card's left end (cropped by the card, as in Glass), the
// list (centred by the band), and a plate pinned to the card's right end.

import { ART_HEIGHT, CARD_HEIGHT, EDGE_SIDE, EDGE_TOP, cutLeft, cutRight, edgeLeft, edgeRight } from './card'
import type { Gauge } from './card'
import { RAIL, clock, dollars, short } from './glass'

export type ClusterInput = {
  /** CSS px drawn across, and the narrowest the card could be. */
  width: number
  narrow: number
  five: Gauge | null
  seven: Gauge | null
  /** The weekly limit the account keeps for one model, under that model's name in capitals (`FABLE`); null when it has none. */
  model: { name: string; gauge: Gauge } | null
  /** This session's context: fill 0..100, tokens in the window, the window's size; null before the first reading. */
  context: { percent: number; tokens: number; window: number } | null
  written: number
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  turns: number
  /** Minutes since the session began. */
  minutes: number
}

export type DriveMode = 'eco' | 'normal' | 'sport'

const H = CARD_HEIGHT
const FONT = '-apple-system,system-ui,sans-serif'
const BLACK = '#050505'
const GREY = '#9a9a9e'
/** Bright edge, body and deep end of a filled bar, the ink of a label, the rules round the mode in force, a tile's hairline. */
const TONE: Record<DriveMode, { hi: string; body: string; deep: string; ink: string; rule: string; edge: string }> = {
  eco: { hi: '#d9fff5', body: '#2fc7ad', deep: '#0c5f52', ink: '#4fd8c0', rule: '#ffffff', edge: 'rgba(255,255,255,.22)' },
  normal: { hi: '#fff4cf', body: '#f0b83c', deep: '#946512', ink: '#f0b83c', rule: '#ffffff', edge: 'rgba(255,255,255,.22)' },
  sport: { hi: '#ff9a8c', body: '#f0281c', deep: '#860a06', ink: '#ff4b3e', rule: '#ff5246', edge: 'rgba(255,120,110,.55)' },
}

const f = (n: number) => String(+n.toFixed(1))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
/** Ids must be unique within one drawing; each drawing starts its own count. */
type Ids = { n: number }
const id = (ids: Ids, p: string) => `${p}${ids.n++}`

type WordOptions = { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; spacing?: number; fill?: string; opacity?: number }
const words = (x: number, y: number, s: string, o: WordOptions = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${o.size ?? 10}" font-weight="${o.weight ?? 400}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''} fill="${o.fill ?? '#fff'}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}>${esc(s)}</text>`

/** A value with its unit after it, smaller and grey, as a cluster writes `1576km`. */
const pair = (x: number, y: number, value: string, unit: string, anchor: 'start' | 'end' = 'start') =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}"${anchor === 'end' ? ' text-anchor="end"' : ''}><tspan font-size="13" fill="#fff">${esc(value)}</tspan>${unit ? `<tspan font-size="9.4" fill="${GREY}" dx="2.6">${esc(unit)}</tspan>` : ''}</text>`

type Point = readonly [number, number]
/** A closed outline through the points, each corner rounded by its radius. It has no arcs, so a mirrored outline needs no code of its own. */
const outline = (pts: readonly Point[], radii: readonly number[]) => {
  const n = pts.length
  let d = ''
  pts.forEach((p, i) => {
    const a = pts[(i + n - 1) % n]!
    const b = pts[(i + 1) % n]!
    const r = radii[i] ?? 0
    const la = Math.hypot(a[0] - p[0], a[1] - p[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    if (!r || !la || !lb) {
      d += `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`
      return
    }
    const ra = Math.min(r, la / 2)
    const rb = Math.min(r, lb / 2)
    d += `${i ? 'L' : 'M'}${f(p[0] + ((a[0] - p[0]) * ra) / la)} ${f(p[1] + ((a[1] - p[1]) * ra) / la)}Q${f(p[0])} ${f(p[1])} ${f(p[0] + ((b[0] - p[0]) * rb) / lb)} ${f(p[1] + ((b[1] - p[1]) * rb) / lb)}`
  })
  return `${d}Z`
}

// ---------- a gauge ----------
// In card coordinates, with the bar at the left: the bar is BAR wide, runs
// straight from TOP_Y to BEND_Y and then down at 45 degrees to END_Y. Beside
// it runs a thinner echo of it, and then the tile, whose cut corner is
// parallel to the bend. A mirrored gauge has its bar at the right; a flipped
// one bends at the top.

/** A gauge's width in px. */
const GAUGE_W = 156
const BAR_X = 14
const BAR = 12
const TOP_Y = 10
const BEND_Y = 56
const END_Y = 82
const GAP = 1.5
const ECHO = 5
const TILE_X = BAR_X + BAR + GAP + ECHO + GAP
const TILE_Y = 20
const TILE_W = 112
const TILE_H = 60
const CHAMFER = 16
/** Where the tile's left edge meets its cut corner: the bend's line, moved right past the echo. */
const CUT_Y = TILE_X + BEND_Y - BAR_X - BAR - 2 * GAP - 1.414 * ECHO

type GaugeOptions = {
  /** The gauge's left edge. */
  x: number
  tone: DriveMode
  mirror: boolean
  /** 0..1; null draws an empty bar and no percent sign. */
  level: number | null
  /** The share of the window gone by, 0..1, as a notch outside the bar. */
  pace: number | null
  /** A level of its own for the echo beside the bar, 0..1, when the gauge reads two limits; left out, the echo follows the bar. */
  echoLevel?: number
  /** Two limits side by side on the tile, in place of the one figure and its unit. */
  twin?: readonly [Twin, Twin]
  figure: string
  unit: string
  head: string
  headInk?: string
  hasBolt?: boolean
}

type Twin = { name: string; percent: number }

/** Two limits on one tile, each a figure over its name; `left` is the tile's left edge. The first takes the tone's ink, as the gauge's head does. */
const twinFace = (twin: readonly [Twin, Twin], left: number, ink: string) => {
  const [a, b] = [Math.round(twin[0].percent), Math.round(twin[1].percent)]
  // Three figures a side do not fit at full size: a limit at 100 makes both smaller.
  const size = a >= 100 || b >= 100 ? 19 : 24
  const half = (x: number, n: number, name: string, nameInk?: string) =>
    `<text x="${f(x)}" y="${TILE_Y + 35}" font-family="${FONT}" text-anchor="middle" font-weight="300" fill="#fff"><tspan font-size="${size}">${n}</tspan><tspan font-size="${f(size * 0.42)}" dx="1" fill-opacity=".8">%</tspan></text>` +
    words(x, TILE_Y + 50, name, { size: 8.5, weight: 600, spacing: 1, anchor: 'middle', fill: nameInk ?? '#fff', opacity: nameInk ? 1 : 0.6 })
  return (
    half(left + TILE_W * 0.27, a, twin[0].name, ink) +
    `<line x1="${f(left + TILE_W * 0.47)}" y1="${TILE_Y + 14}" x2="${f(left + TILE_W * 0.47)}" y2="${TILE_Y + 50}" stroke="#fff" stroke-opacity=".12"/>` +
    half(left + TILE_W * 0.68, b, twin[1].name)
  )
}

function gauge(ids: Ids, o: GaugeOptions): { defs: string; svg: string } {
  const t = TONE[o.tone]
  const flip = o.tone === 'sport'
  const X = (x: number) => o.x + (o.mirror ? GAUGE_W - x : x)
  const Y = (y: number) => (flip ? TOP_Y + END_Y - y : y)
  const band = (bx: number, b: number, bend: number) =>
    `M${(
      [
        [bx, TOP_Y],
        [bx + b, TOP_Y],
        [bx + b, bend],
        [bx + b + (END_Y - bend), END_Y],
        [bx + b + (END_Y - bend) - b * 1.414, END_Y],
        [bx, bend + b * 0.414],
      ] as const
    )
      .map(([x, y]) => `${f(X(x))} ${f(Y(y))}`)
      .join('L')}Z`
  const bar = band(BAR_X, BAR, BEND_Y)
  const echo = band(BAR_X + BAR + GAP, ECHO, BEND_Y - ECHO * 0.414)
  const top = TILE_Y
  const bottom = TILE_Y + TILE_H
  const tile = flip
    ? outline(
        [
          [X(TILE_X + TOP_Y + END_Y - CUT_Y - TILE_Y), top],
          [X(TILE_X + TILE_W), top],
          [X(TILE_X + TILE_W), bottom - CHAMFER],
          [X(TILE_X + TILE_W - CHAMFER), bottom],
          [X(TILE_X), bottom],
          [X(TILE_X), TOP_Y + END_Y - CUT_Y],
        ],
        [2, 7, 2, 2, 7, 2],
      )
    : outline(
        [
          [X(TILE_X), top],
          [X(TILE_X + TILE_W - CHAMFER), top],
          [X(TILE_X + TILE_W), top + CHAMFER],
          [X(TILE_X + TILE_W), bottom],
          [X(TILE_X + bottom - CUT_Y), bottom],
          [X(TILE_X), CUT_Y],
        ],
        [7, 2, 2, 7, 2, 2],
      )

  const level = o.level === null ? 0 : cl(o.level, 0, 1)
  // A level is a height on the card, whichever way the bar bends.
  const at = (lv: number) => END_Y - lv * (END_Y - TOP_Y)
  // The bar's outer edge at a height, in the gauge's own unmirrored x.
  const outer = (y: number) => {
    const u = Y(y)
    return u <= BEND_Y + BAR * 0.414 ? BAR_X : BAR_X + (u - BEND_Y - BAR * 0.414)
  }
  const yL = at(level)
  const clip = id(ids, 'k')
  const fill = id(ids, 'g')
  const glass = id(ids, 't')
  const glow = id(ids, 'o')
  const echoClip = id(ids, 'e')
  const yE = o.echoLevel === undefined ? yL : at(cl(o.echoLevel, 0, 1))
  const defs =
    `<clipPath id="${clip}"><rect x="${f(o.x)}" y="${f(yL)}" width="${GAUGE_W}" height="${f(END_Y - yL + 1)}"/></clipPath>` +
    `<clipPath id="${echoClip}"><rect x="${f(o.x)}" y="${f(yE)}" width="${GAUGE_W}" height="${f(END_Y - yE + 1)}"/></clipPath>` +
    `<linearGradient id="${fill}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(yL)}" x2="0" y2="${END_Y}"><stop offset="0" stop-color="${t.hi}"/><stop offset=".22" stop-color="${t.body}"/><stop offset="1" stop-color="${t.deep}"/></linearGradient>` +
    `<linearGradient id="${glass}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2f31"/><stop offset="1" stop-color="#1b1b1c"/></linearGradient>` +
    `<radialGradient id="${glow}"><stop offset="0" stop-color="${t.body}" stop-opacity="${f(0.1 + level * 0.22)}"/><stop offset="1" stop-color="${t.body}" stop-opacity="0"/></radialGradient>`

  // The head stands clear of the bar: beside its straight top, or past the echo's tip when the bar bends at the top.
  const headX = flip ? BAR_X + BAR + GAP + ECHO + (END_Y - BEND_Y) + ECHO * 0.414 + 5 : BAR_X + BAR + GAP
  const xm = outer(yL)
  // The level's rule runs from the bar's outer edge to the tile; a full bar that bends at the top stops short of the head.
  const tucked = xm + BAR + 2 * GAP + ECHO + 5
  const reach = flip ? Math.min(tucked, headX - 3) : tucked
  const marker = o.level === null ? '' : `<line x1="${f(X(xm - 2))}" y1="${f(yL)}" x2="${f(X(reach))}" y2="${f(yL)}" stroke="${t.rule}" stroke-width="1.1"/>`
  let pace = ''
  if (o.pace !== null) {
    const yP = at(cl(o.pace, 0, 1))
    const xp = outer(yP)
    pace = `<line x1="${f(X(xp - 6))}" y1="${f(yP)}" x2="${f(X(xp - 1.5))}" y2="${f(yP)}" stroke="#fff" stroke-width="1.4"/>`
  }
  const cx = X(TILE_X + TILE_W / 2)
  const figure =
    `<text x="${f(cx + (o.hasBolt ? 7 : 0))}" y="${f(TILE_Y + TILE_H * 0.64)}" font-family="${FONT}" text-anchor="middle" font-weight="300" fill="#fff"><tspan font-size="32">${esc(o.figure)}</tspan>` +
    `${o.level === null ? '' : '<tspan font-size="13" dx="1.5" fill-opacity=".8">%</tspan>'}</text>`
  // The bolt stands at the tile's left, where a car's cluster has its plug.
  const tileLeft = o.mirror ? X(TILE_X + TILE_W) : X(TILE_X)
  const bolt = o.hasBolt ? `<path transform="translate(${f(tileLeft + 11)} ${f(TILE_Y + TILE_H * 0.3)})" d="M6.2 0 0 9.4h4.3L3.2 16 9.6 6.4H5.2Z" fill="#fff" fill-opacity=".92"/>` : ''

  return {
    defs,
    svg:
      `<ellipse cx="${f(X(BAR_X + BAR))}" cy="${END_Y}" rx="70" ry="46" fill="url(#${glow})"/>` +
      `<path d="${bar}" fill="#343436"/><path d="${echo}" fill="#fff" fill-opacity=".07"/>` +
      `<g clip-path="url(#${clip})"><path d="${bar}" fill="url(#${fill})"/></g>` +
      // An echo with a level of its own is a reading, so it is drawn stronger than one that only follows the bar.
      `<g clip-path="url(#${echoClip})"><path d="${echo}" fill="${t.body}" fill-opacity="${o.echoLevel === undefined ? '.34' : '.7'}"/></g>` +
      marker +
      pace +
      `<path d="${tile}" fill="url(#${glass})" stroke="${t.edge}" stroke-width="1"/>` +
      (o.twin ? twinFace(o.twin, tileLeft, t.ink) : bolt + figure + (o.unit ? words(cx, TILE_Y + TILE_H * 0.87, o.unit, { size: 9.5, anchor: 'middle', fill: '#c9c9cc' }) : '')) +
      words(X(headX), 15.5, o.head, { size: 8.5, weight: 600, spacing: 1.2, anchor: o.mirror ? 'end' : 'start', fill: o.headInk ?? '#fff', opacity: o.headInk ? 1 : 0.6 }),
  }
}

// ---------- the drive mode ----------

/** How hard the session pushes: sport when a limit runs ahead of its pace or anything nears its end, eco when every limit runs well under its pace. */
export const driveMode = (i: ClusterInput): DriveMode => {
  const gauges = [i.five, i.seven, i.model?.gauge ?? null].filter((g): g is Gauge => g !== null)
  if (gauges.some(g => g.level !== 'ok') || (contextOf(i) ?? 0) >= 90) return 'sport'
  if (gauges.length > 0 && gauges.every(g => g.pace !== null && g.percent <= g.pace * 100 - 10)) return 'eco'
  return 'normal'
}

/** The context's fill, 0..100; null before the first reading. */
const contextOf = (i: ClusterInput) => (i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : null)

const MODES: readonly DriveMode[] = ['eco', 'normal', 'sport']
// Each on a 14 x 10 box: a leaf, a car, a chequered flag.
const MODE_ICON: Record<DriveMode, string> = {
  eco: '<path d="M2 9.6C1.4 4.6 5.6 1 12.6 1c.3 5.6-3.1 9.2-8.2 8.5M1.6 10.8 7.6 5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  normal:
    '<path d="M.5 8V6.2c0-.5.3-.9.8-1l1.3-.3 1.6-2.2c.3-.4.7-.6 1.2-.6h3.6c.5 0 .9.2 1.2.5l2 2.2 1.6.4c.5.1.8.5.8 1V8Z" fill="#fff"/>' +
    '<circle cx="3.6" cy="8.3" r="1.5" fill="#fff" stroke="#151516" stroke-width=".7"/><circle cx="11.5" cy="8.3" r="1.5" fill="#fff" stroke="#151516" stroke-width=".7"/>',
  sport:
    '<g transform="skewX(-14)" fill="#fff"><rect x="4" y=".5" width="2.7" height="2.4"/><rect x="9.4" y=".5" width="2.7" height="2.4"/><rect x="6.7" y="2.9" width="2.7" height="2.4"/>' +
    '<rect x="12.1" y="2.9" width="2.7" height="2.4"/><rect x="4" y="5.3" width="2.7" height="2.4"/><rect x="9.4" y="5.3" width="2.7" height="2.4"/><rect x="3.2" y=".5" width=".8" height="10"/></g>',
}

// ---------- what fits ----------
// The list stands between the gauges and the stacks beside it. In a narrow
// pane the stacks go first, then the list; the gauges and the rail stay.

/** The list's width, and the room each stack takes beside it. */
const PANEL_W = 140
const LEFT_STACK = 88
const RIGHT_STACK = 96
const fits = (i: ClusterInput) => {
  const free = i.narrow - 2 * GAUGE_W - RAIL
  // The list is centred, so each side of it must hold the wider stack.
  return { panel: free >= PANEL_W + 16, stacks: free >= PANEL_W + 2 * Math.max(LEFT_STACK, RIGHT_STACK) + 8 }
}

const sheen = (ids: Ids, x: number, w: number) => {
  const g = id(ids, 's')
  return (
    `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<rect x="${x}" y="0" width="${w}" height="${H}" fill="url(#${g})"/>`
  )
}
const hairline = (path: string) => `<path d="${path}" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="1.2"/>`

/** The baseline of a stack's row. */
const rowY = (n: number) => 34 + n * 20

/** The card's left end: the context gauge and, where they fit, the session's numbers. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function clusterArt(i: ClusterInput): { source: string; width: number } {
  const ids: Ids = { n: 0 }
  const W = Math.round(i.width)
  const percent = contextOf(i)
  const g = gauge(ids, {
    x: 0,
    tone: driveMode(i),
    mirror: false,
    level: percent === null ? null : percent / 100,
    pace: null,
    figure: percent === null ? '–' : String(Math.round(percent)),
    unit: i.context && percent !== null ? `${short(i.context.tokens)} / ${short(i.context.window)}` : '',
    head: 'CONTEXT',
  })
  let stack = ''
  if (fits(i).stacks) {
    const rows: Array<[string, string]> = []
    if (i.usd !== null) rows.push([dollars(i.usd), ''])
    rows.push([clock(i.minutes), i.minutes >= 6000 ? 'hours' : 'elapsed'], [short(i.turns), i.turns === 1 ? 'turn' : 'turns'])
    stack = rows.map((row, n) => pair(GAUGE_W + 12, rowY(n), row[0], row[1])).join('')
  }
  return {
    source:
      // `slice` from the top left: where the app gives the drawing a narrower box, it is cropped at the right, never scaled to fit.
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ART_HEIGHT}" viewBox="0 0 ${W} ${ART_HEIGHT}" preserveAspectRatio="xMinYMin slice"><defs>${g.defs}<clipPath id="cut"><path d="${cutLeft(W)}"/></clipPath></defs>` +
      `<g clip-path="url(#cut)"><rect width="${W}" height="${ART_HEIGHT}" fill="${BLACK}"/><g transform="translate(${EDGE_SIDE} ${EDGE_TOP})">` +
      sheen(ids, -EDGE_SIDE, W) +
      g.svg +
      stack +
      hairline(edgeLeft(W)) +
      '</g></g></svg>',
    width: W,
  }
}

/** The drive mode list, drawn at its exact size on nothing: the band centres it between the gauges. Null where the pane has no room for it. */
export function clusterCentre(i: ClusterInput): { source: string; width: number; height: number } | null {
  if (!fits(i).panel) return null
  const mode = driveMode(i)
  const t = TONE[mode]
  const pitch = 18
  const top = 6
  let rows = ''
  MODES.forEach((m, n) => {
    const yc = top + 33 + n * pitch
    const isOn = m === mode
    if (isOn) {
      rows +=
        `<rect x="${f(PANEL_W * 0.1)}" y="${f(yc - pitch / 2 + 0.5)}" width="${f(PANEL_W * 0.8)}" height="${pitch - 1}" fill="#fff" fill-opacity=".06"/>` +
        [-1, 1].map(s => `<line x1="${f(PANEL_W * 0.1)}" y1="${f(yc + s * (pitch / 2 - 0.5))}" x2="${f(PANEL_W * 0.9)}" y2="${f(yc + s * (pitch / 2 - 0.5))}" stroke="${t.rule}" stroke-width="1"/>`).join('') +
        `<g transform="translate(${f(PANEL_W * 0.17)} ${yc - 5})">${MODE_ICON[m]}</g>`
    }
    rows += words(PANEL_W * 0.36, yc + 4.2, m.toUpperCase(), { size: isOn ? 12.5 : 11.5, fill: isOn ? '#fff' : '#5e5e62', spacing: 0.3 })
  })
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}" height="${ART_HEIGHT}" viewBox="0 0 ${PANEL_W} ${ART_HEIGHT}"><g transform="translate(0 ${EDGE_TOP})">` +
      `<rect x="0" y="${top}" width="${PANEL_W}" height="81" fill="#141415"/>` +
      words(PANEL_W / 2, top + 15, 'DRIVE MODE', { size: 9.5, anchor: 'middle', spacing: 1.1, fill: '#d6d6d9' }) +
      rows +
      '</g></svg>',
    width: PANEL_W,
    height: ART_HEIGHT,
  }
}

/** A limit as a cluster's battery, drawn leftwards from `right`: its name, a short bar, the percent. */
const battery = (right: number, y: number, name: string, g: Gauge) => {
  const ink = g.level === 'high' ? '#ff4b3e' : g.level === 'ahead' ? '#ffb347' : '#2fc7ad'
  const x = right - 37 - 22
  return (
    pair(right, y, String(Math.round(g.percent)), '%', 'end') +
    `<rect x="${f(x)}" y="${f(y - 8.5)}" width="22" height="9" fill="#3a3a3c"/><rect x="${f(x)}" y="${f(y - 8.5)}" width="${f((22 * cl(g.percent, 0, 100)) / 100)}" height="9" fill="${ink}"/>` +
    words(x - 5, y - 0.5, name, { size: 8.5, weight: 600, spacing: 1, anchor: 'end', opacity: 0.6 })
  )
}

/** The card's right end: the 5-hour limit and the tokens written where they fit, the weekly gauge, and the rail the band's buttons stand over. Drawn at its exact size, with the card's two right corners cut. */
export function clusterPlate(i: ClusterInput): { source: string; width: number; height: number } {
  const ids: Ids = { n: 0 }
  const mode = driveMode(i)
  const stackW = fits(i).stacks ? RIGHT_STACK : 0
  const rail = stackW + GAUGE_W + 0.5
  const inner = stackW + GAUGE_W + RAIL
  const W = inner + EDGE_SIDE
  const base = { x: stackW, tone: mode, mirror: true, headInk: TONE[mode].ink }
  // The bar is the weekly limit and the echo beside it the model's, the two side by side on the tile.
  // An account with one of them alone shows that one as the tile's single figure, over its reset time.
  const one = i.seven ? { name: '7D', gauge: i.seven } : i.model
  const g =
    i.seven && i.model
      ? gauge(ids, {
          ...base,
          level: i.seven.percent / 100,
          pace: i.seven.pace,
          echoLevel: i.model.gauge.percent / 100,
          twin: [{ name: '7D', percent: i.seven.percent }, { name: i.model.name, percent: i.model.gauge.percent }],
          figure: '',
          unit: '',
          head: 'WEEKLY',
        })
      : gauge(ids, {
          ...base,
          level: one ? one.gauge.percent / 100 : null,
          pace: one ? one.gauge.pace : null,
          figure: one ? String(Math.round(one.gauge.percent)) : '–',
          unit: one?.gauge.left ? `↻ ${one.gauge.left}` : '',
          head: one?.name ?? '7D',
          hasBolt: true,
        })
  let stack = ''
  if (stackW > 0) {
    // The 5-hour limit and its reset, then the tokens written.
    const right = stackW - 12
    const rows: string[] = []
    if (i.five) rows.push(battery(right, rowY(rows.length), '5H', i.five))
    if (i.five?.left) rows.push(pair(right, rowY(rows.length), `↻ ${i.five.left}`, '', 'end'))
    rows.push(pair(right, rowY(rows.length), short(i.written), 'written', 'end'))
    stack = rows.join('')
  }
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ART_HEIGHT}" viewBox="0 0 ${W} ${ART_HEIGHT}" preserveAspectRatio="xMaxYMin slice"><defs>${g.defs}<clipPath id="cut"><path d="${cutRight(inner)}"/></clipPath></defs>` +
      `<g clip-path="url(#cut)"><rect width="${W}" height="${ART_HEIGHT}" fill="${BLACK}"/><g transform="translate(0 ${EDGE_TOP})">` +
      sheen(ids, 0, W) +
      g.svg +
      stack +
      // the rail's own edge: the buttons stand right of it
      `<line x1="${rail}" y1="10" x2="${rail}" y2="83" stroke="#fff" stroke-opacity=".12"/>` +
      hairline(edgeRight(inner)) +
      '</g></g></svg>',
    width: W,
    height: ART_HEIGHT,
  }
}

/** What the card's left end and the list show, for a screen reader. */
export const clusterAlt = (i: ClusterInput) =>
  [
    i.context ? `Context ${Math.round(i.context.percent)}%, ${short(i.context.tokens)} of ${short(i.context.window)} tokens` : 'Context not read yet',
    i.usd !== null ? `${dollars(i.usd)} so far` : null,
    `${i.turns} turn${i.turns === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ')

export const driveModeAlt = (i: ClusterInput) => `Drive mode ${driveMode(i)}`

/** What the plate shows, for a screen reader. */
export const clusterLimitsAlt = (i: ClusterInput) => {
  const said = [
    i.five ? `5-hour ${Math.round(i.five.percent)}%` : null,
    i.seven ? `weekly ${Math.round(i.seven.percent)}%` : null,
    i.model ? `${i.model.name} weekly ${Math.round(i.model.gauge.percent)}%` : null,
  ].filter(Boolean)
  return `${said.length ? `Limits: ${said.join(', ')}` : 'Limits'}, ${short(i.written)} tokens written`
}
