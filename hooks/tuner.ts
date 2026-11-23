// The Tuner mode of the band: the card as the backlit scale of an old radio.
// The whole card is one tuning dial for the context window, read in tokens,
// with a glowing amber needle where the window stands. The session's other
// numbers are printed along the dial's foot like station names. The plate
// gives each limit a short scale of its own: an amber needle for what is used,
// a hollow pointer above it for the pace, so the gap between them is the
// warning. A warm backlight sits round the needle and runs onto the plate.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import type { Gauge } from './card'
import type { TabLight } from './tab'
import { RAIL, clock, dollars, short } from './glass'

export type TunerInput = {
  /** CSS px drawn across, and the narrowest the card could be. */
  width: number
  narrow: number
  /** The pane has room for the wide plate, with the reset times. */
  wide: boolean
  five: Gauge | null
  seven: Gauge | null
  /** The weekly limit the account keeps for one model, under that model's name in capitals (`FABLE`); null when it has none. */
  model: { name: string; gauge: Gauge } | null
  /** This session's context: fill 0..100, tokens in the window, the window's size; null before the first reading. */
  context: { percent: number; tokens: number; window: number } | null
  written: number
  /** The share of reads served from cache, 0..100; null before the first read. */
  cache: number | null
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  turns: number
  /** Minutes since the session began. */
  minutes: number
}

const H = CARD_HEIGHT
const SANS = '-apple-system,system-ui,sans-serif'
/** The dial's print. The system's own condensed face is hidden from drawings, so the dial is set in Helvetica Neue. */
const PRINT = '"Helvetica Neue",-apple-system,sans-serif'
const CREAM = '#efe6cf'
const AMBER = '#ffb21e'
const GROUND = '#0c0b09'
/** The hairline round the card, and the plate's rules. */
const EDGE = 'rgba(239,230,207,.28)'
const RULE = 'rgba(239,230,207,.12)'
/** Print on the dial keeps a halo of the ground, so the needle passes behind it. */
const HALO = `stroke="${GROUND}" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round"`

const f = (n: number) => String(+n.toFixed(1))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
/** Ids must be unique within one drawing; each drawing starts its own count. */
type Ids = { n: number }
const id = (ids: Ids, p: string) => `${p}${ids.n++}`

type WordOptions = { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; spacing?: number; fill?: string; opacity?: number; font?: string }
const words = (x: number, y: number, s: string, o: WordOptions = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family='${o.font ?? SANS}' font-size="${o.size ?? 10}" font-weight="${o.weight ?? 400}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''} fill="${o.fill ?? CREAM}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}>${esc(s)}</text>`

// ---------- the sizes ----------

/** The plate's width left of the rail: wide with the reset times, narrow without. */
const plateBody = (i: TunerInput) => (i.wide ? 160 : 104)
/** The room left of the plate, in the narrowest card the pane could hold. */
const roomOf = (i: TunerInput) => i.narrow - plateBody(i) - RAIL
/** Where the dial's scale starts, past the readout, and how far short of the plate it stops. */
const SCALE_X = 128
const SCALE_END = 26
/** The least scale worth drawing; a narrower pane shows the readout alone. */
const SCALE_MIN = 60
/** The room a station's figure and name take. */
const STATION_W = 100
/** The room a printed number on the scale needs. */
const NUMBER_W = 46

const contextOf = (i: TunerInput) => (i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : null)

/** Where the needle stands across the card, in card coordinates: the backlight is centred on it, on the card and the plate. */
const needleX = (i: TunerInput) => {
  const x1 = roomOf(i) - SCALE_END
  // With no room for the dial, the light stays behind the readout.
  return x1 - SCALE_X >= SCALE_MIN ? SCALE_X + ((x1 - SCALE_X) * (contextOf(i) ?? 0)) / 100 : 60
}

/** The warm backlight round the needle: where it is centred, below the card's top edge, its reach, colour and strength. */
const LIGHT = { y: 40, r: 200, color: '#ff9a1e', opacity: 0.2 }
/** The backlight centred at `cx` in a drawing's own coordinates, and the faint sheen at the card's top. */
const backlight = (cx: number) =>
  `<radialGradient id="bl" cx="${f(cx)}" cy="${LIGHT.y}" r="${LIGHT.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${LIGHT.color}" stop-opacity="${LIGHT.opacity}"/><stop offset="1" stop-color="${LIGHT.color}" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>`

/** A needle's glow: a blurred copy under it. In px round the needle, since a vertical line's own box has no width to measure a region from. */
const glowAt = (ids: Ids, x: number, y: number, h: number) => {
  const g = id(ids, 'g')
  return { id: g, def: `<filter id="${g}" filterUnits="userSpaceOnUse" x="${f(x - 12)}" y="${f(y - 10)}" width="24" height="${f(h + 20)}"><feGaussianBlur stdDeviation="2.6"/></filter>` }
}

// ---------- the dial ----------

/**
 * The card's left end: the readout, the dial with its needle, and the stations. One SVG, `ART_HEIGHT` tall, with
 * the card's two left corners cut; and the backlight, which carries up into the project tab.
 */
export function tunerArt(i: TunerInput): { source: string; width: number; light: TabLight } {
  const ids: Ids = { n: 0 }
  const W = Math.round(i.width)
  const p = contextOf(i)
  const readout =
    words(22, 22, 'CONTEXT', { size: 8.5, weight: 600, spacing: 1.4, opacity: 0.55 }) +
    `<text x="20" y="62" font-family='${PRINT}' fill="${CREAM}"><tspan font-size="40" font-weight="300">${p === null ? '–' : Math.round(p)}</tspan>${p === null ? '' : '<tspan font-size="14" dx="2" fill-opacity=".7">%</tspan>'}</text>` +
    (i.context && p !== null ? words(22, 78, `${short(i.context.tokens)} / ${short(i.context.window)}`, { size: 9.5, opacity: 0.7, font: PRINT }) : '') +
    `<line x1="112" y1="16" x2="112" y2="78" stroke="${CREAM}" stroke-opacity=".12"/>`

  const x0 = SCALE_X
  const x1 = roomOf(i) - SCALE_END
  const span = x1 - x0
  let dial = ''
  let defs = backlight(needleX(i))
  if (span >= SCALE_MIN) {
    const xn = needleX(i)
    const win = i.context?.window ?? 1_000_000
    // A number on every tenth of the scale where there is room, on every second or fifth where there is not.
    const every = [1, 2, 5].find(k => (span / 10) * k >= NUMBER_W) ?? 10
    let ticks = ''
    for (let t = 0; t <= 50; t++) {
      const x = x0 + (span * t) / 50
      const major = t % 5 === 0
      ticks += `<line x1="${f(x)}" y1="${major ? 31 : 35}" x2="${f(x)}" y2="40" stroke="${CREAM}" stroke-opacity="${major ? 0.75 : 0.32}" stroke-width="${major ? 1.1 : 0.8}"/>`
      if (major && (t / 5) % every === 0) ticks += `<text x="${f(x)}" y="25" font-family='${PRINT}' font-size="9.5" text-anchor="middle" fill="${CREAM}" fill-opacity=".72" ${HALO}>${short((win * t) / 50)}</text>`
    }
    const stripe = `<rect x="${x0}" y="44" width="${f(span)}" height="2" fill="${CREAM}" fill-opacity=".14"/><rect x="${x0}" y="44" width="${f(xn - x0)}" height="2" fill="${AMBER}" fill-opacity=".6"/>`
    // The needle stands over the scale and the stripe and starts below the printed numbers, so it never crosses them.
    const glow = glowAt(ids, xn, 30, 22)
    defs += glow.def
    const needle =
      `<line x1="${f(xn)}" y1="30" x2="${f(xn)}" y2="52" stroke="${AMBER}" stroke-width="4" filter="url(#${glow.id})" opacity=".9"/><line x1="${f(xn)}" y1="30" x2="${f(xn)}" y2="52" stroke="#ffe3a0" stroke-width="1.6"/>` +
      `<path d="M${f(xn - 3.5)} 52h7l-3.5 4.5z" fill="${AMBER}"/>`
    // The session's numbers as station names along the dial's foot, as many as fit, spread over it.
    const stations: Array<[string, string]> = []
    if (i.usd !== null) stations.push([dollars(i.usd), 'COST'])
    stations.push([clock(i.minutes), 'TIME'], [short(i.turns), 'TURNS'], [short(i.written), 'WRITTEN'])
    if (i.cache !== null) stations.push([`${Math.round(i.cache)}%`, 'CACHE'])
    const shown = stations.slice(0, Math.max(0, Math.floor(span / STATION_W)))
    const pitch = span / Math.max(1, shown.length)
    const foot = shown
      .map(([value, name], n) => {
        const x = x0 + n * pitch
        return `<circle cx="${f(x + 2)}" cy="65" r="1.6" fill="${CREAM}" fill-opacity=".5"/><text x="${f(x + 9)}" y="69" font-family='${PRINT}'><tspan font-size="13.5" fill="${CREAM}">${esc(value)}</tspan><tspan dx="4" font-size="8.5" letter-spacing="1" fill="${CREAM}" fill-opacity=".55">${name}</tspan></text>`
      })
      .join('')
    dial = needle + ticks + stripe + foot
  }
  return {
    source: leftEnd(W, GROUND, `<rect x="-9" y="0" width="${W}" height="${H}" fill="url(#bl)"/><rect x="-9" y="0" width="${W}" height="${H}" fill="url(#sh)"/>` + readout + dial, { defs, edge: EDGE }),
    width: W,
    light: { ...LIGHT, x: needleX(i) },
  }
}

// ---------- the plate ----------

type Row = [string, Gauge]
const limitRows = (i: TunerInput): Row[] => {
  const rows: Row[] = []
  if (i.five) rows.push(['5H', i.five])
  if (i.seven) rows.push(['7D', i.seven])
  if (i.model) rows.push([i.model.name, i.model.gauge])
  return rows
}

/** The card's right end: each limit a short scale with its needle, pace and percent, the reset times on the wide plate, and the rail the band's buttons stand over. Drawn at its exact size, with the card's two right corners cut. */
export function tunerPlate(i: TunerInput): { source: string; width: number; height: number } {
  const ids: Ids = { n: 0 }
  const body = plateBody(i)
  const inner = body + RAIL
  const sx = 34
  const sw = i.wide ? 50 : 32
  let defs = backlight(needleX(i) - roomOf(i))
  const rows = limitRows(i)
    .map(([name, g], n) => {
      const c = 23 + n * 24
      const hot = g.level === 'high' ? '#ff5a3c' : g.level === 'ahead' ? '#ff8a2a' : AMBER
      let scale = ''
      for (let k = 0; k <= 10; k++)
        scale += `<line x1="${f(sx + (sw * k) / 10)}" y1="${k % 5 ? c + 1 : c - 2}" x2="${f(sx + (sw * k) / 10)}" y2="${c + 4}" stroke="${CREAM}" stroke-opacity="${k % 5 ? 0.3 : 0.6}" stroke-width=".8"/>`
      const xu = sx + (sw * cl(g.percent, 0, 100)) / 100
      const pace = g.pace !== null ? `<path d="M${f(sx + sw * cl(g.pace, 0, 1) - 3)} ${c - 7}h6l-3 4z" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".9"/>` : ''
      const glow = glowAt(ids, xu, c - 2, 9)
      defs += glow.def
      return (
        words(9, c + 4, name.slice(0, 3), { size: 8, weight: 700, spacing: 0.6, opacity: 0.6 }) +
        scale +
        pace +
        `<line x1="${f(xu)}" y1="${c - 2}" x2="${f(xu)}" y2="${c + 7}" stroke="${hot}" stroke-width="3.4" filter="url(#${glow.id})" opacity=".85"/><line x1="${f(xu)}" y1="${c - 2}" x2="${f(xu)}" y2="${c + 7}" stroke="#ffe3a0" stroke-width="1.3"/>` +
        words(sx + sw + 7, c + 4, `${Math.round(g.percent)}%`, { size: 12, fill: g.level === 'ok' ? CREAM : hot, font: PRINT }) +
        (i.wide && g.left ? words(body - 6, c + 4, g.left.replace(/ /g, ''), { size: 9, anchor: 'end', opacity: 0.5, font: PRINT }) : '')
      )
    })
    .join('')
  return rightEnd(
    inner,
    body,
    GROUND,
    `<rect width="${inner}" height="${H}" fill="url(#bl)"/><rect width="${inner}" height="${H}" fill="url(#sh)"/><line x1=".5" y1="10" x2=".5" y2="83" stroke="${CREAM}" stroke-opacity=".12"/>` + rows,
    { defs, edge: EDGE, rule: RULE },
  )
}

/** What the card's left end shows, for a screen reader. */
export const tunerAlt = (i: TunerInput) =>
  [
    i.context && contextOf(i) !== null ? `Context ${Math.round(contextOf(i) ?? 0)}%, ${short(i.context.tokens)} of ${short(i.context.window)} tokens` : 'Context not read yet',
    i.usd !== null ? `${dollars(i.usd)} so far` : null,
    `${i.turns} turn${i.turns === 1 ? '' : 's'}`,
    `${short(i.written)} tokens written`,
  ]
    .filter(Boolean)
    .join(', ')

/** What the plate shows, for a screen reader. */
export const tunerLimitsAlt = (i: TunerInput) => {
  const said = limitRows(i).map(([name, g]) => `${name === '5H' ? '5-hour' : name === '7D' ? 'weekly' : `${name} weekly`} ${Math.round(g.percent)}%${g.level === 'ahead' ? ', ahead of pace' : g.level === 'high' ? ', nearly used up' : ''}`)
  return said.length ? `Limits: ${said.join(', ')}` : 'Limits'
}
