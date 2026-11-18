// The Glass mode of the band: the whole card as one piece of black glass, with
// the running session in numbers. Context is the hero, a heavy figure over a
// dial of fine ticks, and a heat glow rises from the bottom edge as it fills.
// Tokens, cache, cost, turns and time sit in columns beside it; the limits
// are on a plate of their own at the right end, which closes on the rail the
// band's buttons stand over.
//
// The drawing is larger than the card and laid behind it: the card crops it,
// and the corners are cut in the drawing itself (see card.ts).

import { ART_HEIGHT, CARD_HEIGHT, CORNER, EDGE_SIDE, EDGE_TOP } from './card'
import type { Gauge } from './card'

export type GlassInput = {
  /** CSS px drawn across, and the part of it sure to be seen left of the plate. */
  width: number
  seen: number
  /** Room for the wider plate. */
  wide: boolean
  five: Gauge | null
  seven: Gauge | null
  /** The weekly limit the account keeps for one model, under that model's name in capitals (`FABLE`); null when it has none. */
  model: { name: string; gauge: Gauge } | null
  /** This session's context: fill 0..100, tokens in the window, the window's size; null before the first reading. */
  context: { percent: number; tokens: number; window: number } | null
  /** Tokens the session wrote and read since the mod began counting, and how much of what it read came from cache, 0..100. */
  written: number
  read: number
  cache: number | null
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  turns: number
  tools: number
  /** Minutes since the session began. */
  minutes: number
  busy: boolean
}

const H = CARD_HEIGHT
const FONT = '-apple-system,system-ui,sans-serif'
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const trim = (v: string) => v.replace(/\.0$/, '')
/** 85.7k, 1.2M: three figures at most. */
export const short = (n: number) =>
  n >= 1e6 ? `${trim((n / 1e6).toFixed(n >= 1e7 ? 0 : 1))}M` : n >= 1e3 ? `${trim((n / 1e3).toFixed(n >= 1e5 ? 0 : 1))}k` : String(Math.round(n))
// Both stay within five figures, so a column never outgrows its width.
const clock = (minutes: number) => (minutes >= 6000 ? `${Math.floor(minutes / 60)}` : `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`)
const dollars = (usd: number) => `$${usd < 99.995 ? usd.toFixed(2) : Math.round(usd)}`

// Numerals: heavy rounded strokes on a 5 x 9 box. A mod cannot load a font, so the figures are drawn.
const GLYPH: Record<string, string> = {
  '0': 'M1.6 0H3.4A1.6 1.6 0 0 1 5 1.6V7.4A1.6 1.6 0 0 1 3.4 9H1.6A1.6 1.6 0 0 1 0 7.4V1.6A1.6 1.6 0 0 1 1.6 0Z',
  '1': 'M.6 1.7L2.6 0V9',
  '2': 'M0 0H3.4A1.6 1.6 0 0 1 5 1.6V2.9A1.6 1.6 0 0 1 3.4 4.5H1.6A1.6 1.6 0 0 0 0 6.1V9H5',
  '3': 'M0 0H3.4A1.6 1.6 0 0 1 5 1.6V2.9A1.6 1.6 0 0 1 3.4 4.5H1.4M3.4 4.5A1.6 1.6 0 0 1 5 6.1V7.4A1.6 1.6 0 0 1 3.4 9H0',
  '4': 'M0 0V3.2A1.3 1.3 0 0 0 1.3 4.5H5M5 0V9',
  '5': 'M5 0H0V4.5H3.4A1.6 1.6 0 0 1 5 6.1V7.4A1.6 1.6 0 0 1 3.4 9H0',
  '6': 'M5 0H1.6A1.6 1.6 0 0 0 0 1.6V7.4A1.6 1.6 0 0 0 1.6 9H3.4A1.6 1.6 0 0 0 5 7.4V6.1A1.6 1.6 0 0 0 3.4 4.5H0',
  '7': 'M0 0H5L2 9',
  '8': 'M1.9 0H3.1A1.5 1.5 0 0 1 4.6 1.5V3A1.5 1.5 0 0 1 3.1 4.5H1.9A1.5 1.5 0 0 1 .4 3V1.5A1.5 1.5 0 0 1 1.9 0ZM1.7 4.5H3.3A1.7 1.7 0 0 1 5 6.2V7.3A1.7 1.7 0 0 1 3.3 9H1.7A1.7 1.7 0 0 1 0 7.3V6.2A1.7 1.7 0 0 1 1.7 4.5Z',
  '9': 'M5 4.5H1.6A1.6 1.6 0 0 1 0 2.9V1.6A1.6 1.6 0 0 1 1.6 0H3.4A1.6 1.6 0 0 1 5 1.6V7.4A1.6 1.6 0 0 1 3.4 9H0',
  '%': 'M1.2 0A1.2 1.2 0 1 0 1.21 0ZM5 0L0 9M3.8 6.6A1.2 1.2 0 1 0 3.81 6.6Z',
  k: 'M0 0V9M4.4 3.2L0 6.6M1.9 5.2L4.6 9',
  M: 'M0 9V0L2.5 4.6L5 0V9',
  $: 'M5 1H1.6A1.6 1.6 0 0 0 0 2.6V2.9A1.6 1.6 0 0 0 1.6 4.5H3.4A1.6 1.6 0 0 1 5 6.1V6.4A1.6 1.6 0 0 1 3.4 8H0M2.5 -.8V9.8',
  '.': 'M.5 8.6V8.9',
  ':': 'M.5 2.6V2.9M.5 6.4V6.7',
}
const ADVANCE: Record<string, number> = { '1': 2.9, '.': 1, ':': 1 }

/** Ids must be unique within one drawing; each drawing starts its own count. */
type Ids = { n: number }
const id = (ids: Ids, p: string) => `${p}${ids.n++}`

type NumOptions = { ink?: string; weight?: number; melt?: number }
/** A run of numerals with its top at `y`; `cap` is a figure's height in px. Returns the drawing and its width. */
function num(ids: Ids, str: string, x: number, y: number, cap: number, o: NumOptions = {}) {
  const k = cap / 9
  const sw = o.weight ?? 2
  const ink = o.ink ?? '#fff'
  const g = id(ids, 'n')
  let cx = x
  let out = ''
  for (const ch of str) {
    const small = ch === 'k' || ch === 'M' || ch === '%'
    const kk = small ? k * 0.56 : k
    const d = GLYPH[ch]
    const ty = ch === '%' ? y : y + cap - 9 * kk
    if (d)
      out +=
        `<g transform="translate(${cx.toFixed(1)} ${ty.toFixed(1)}) scale(${kk.toFixed(3)})">` +
        `<path d="${d}" stroke="#000" stroke-opacity=".55" stroke-width="${sw + 1.3}"/><path d="${d}" stroke="url(#${g})" stroke-width="${sw}"/></g>`
    cx += (ADVANCE[ch] ?? 5) * kk + 2.1 * kk * (small ? 0.9 : 1)
  }
  return {
    svg:
      `<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="9"><stop offset="0" stop-color="${ink}"/><stop offset=".55" stop-color="${ink}"/>` +
      `<stop offset="1" stop-color="${ink}" stop-opacity="${o.melt ?? 0.5}"/></linearGradient><g fill="none" stroke-linecap="round" stroke-linejoin="round">${out}</g>`,
    w: cx - x - 2.1 * k,
  }
}

type LabelOptions = { size?: number; weight?: number; spacing?: number; opacity?: number }
const label = (x: number, y: number, text: string, o: LabelOptions = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 9}" font-weight="${o.weight ?? 600}" letter-spacing="${o.spacing ?? 1.5}" fill="#fff" fill-opacity="${o.opacity ?? 0.6}">${text}</text>`

/** How hot a level reads: bright edge, body, ember. */
const heat = (level: number): readonly [string, string, string] =>
  level >= 0.9 ? ['#ffd0a0', '#ff3b1f', '#a8080a'] : level >= 0.6 ? ['#ffc070', '#ff5a1f', '#9a1408'] : ['#ffd08a', '#ff7a2b', '#7a2a08']

/** The steady part of the glow: it rises with the level, the same in the scene and on the plate, so the two meet without a seam. */
function glowBand(ids: Ids, x: number, w: number, level: number) {
  const g = id(ids, 'g')
  const c = heat(level)
  const gh = 10 + level * (H - 18)
  return (
    `<linearGradient id="${g}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c[0]}"/><stop offset=".1" stop-color="${c[1]}"/>` +
    `<stop offset=".5" stop-color="${c[2]}" stop-opacity=".8"/><stop offset="1" stop-color="${c[2]}" stop-opacity="0"/></linearGradient>` +
    `<rect x="${x}" y="${(H - gh).toFixed(1)}" width="${w}" height="${gh.toFixed(1)}" fill="url(#${g})" opacity="${(0.55 + level * 0.45).toFixed(2)}"/>` +
    // the card may be a pixel or two taller than measured: the edge colour carries on below it
    `<rect x="${x}" y="${H - 1.5}" width="${w}" height="${ART_HEIGHT - H - EDGE_TOP + 1.5}" fill="${c[0]}" opacity=".9"/>`
  )
}

/** The hairline along the card's edge: white at the top, the glow's colour at the bottom. */
function rim(ids: Ids, path: string, level: number) {
  const g = id(ids, 'r')
  const hot = heat(level)[1]
  return (
    `<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity=".1"/>` +
    `<stop offset=".7" stop-color="${hot}" stop-opacity=".25"/><stop offset="1" stop-color="${hot}" stop-opacity=".95"/></linearGradient>` +
    `<path d="${path}" fill="none" stroke="url(#${g})" stroke-width="1.2"/>`
  )
}

const sheen = (ids: Ids, x: number, w: number) => {
  const g = id(ids, 's')
  return (
    `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<rect x="${x}" y="0" width="${w}" height="${H}" fill="url(#${g})"/>`
  )
}

const STYLE =
  '.b{animation:b 3.6s ease-in-out infinite}.b.f{animation-duration:1.5s}@keyframes b{50%{opacity:.6}}' +
  '.p{animation:p 1s steps(2,jump-none) infinite}@keyframes p{to{opacity:.35}}' +
  '.s{transform-box:fill-box;transform-origin:50% 100%;animation:s 2.2s ease-in-out infinite alternate}@keyframes s{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}' +
  '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'

// Half a pixel inside the measured edges, so a small error shows as a sliver of the card and never as a square tip of art.
const TOP = EDGE_TOP + 0.5
const BOTTOM = EDGE_TOP + CARD_HEIGHT - 0.5

/** The card's left end and everything up to the plate: one SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function glassArt(i: GlassInput): { source: string; width: number } {
  const ids: Ids = { n: 0 }
  const W = Math.round(i.width)
  const percent = i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : 0
  const level = percent / 100
  const c = heat(level)
  const figure = String(Math.round(percent))
  // Card coordinates from here: the card's top left is the origin.
  const hero = num(ids, figure, 22, 31, 46, { melt: 0.28 })
  const pct = num(ids, '%', 22 + hero.w + 10, 31, 46, { melt: 0.9 })
  const hc = 22 + hero.w / 2

  // the dial behind the figure, and its needle
  let dial = ''
  for (let t = 0; t <= 40; t++) {
    const a = ((202 + (136 * t) / 40) * Math.PI) / 180
    const len = t % 5 === 0 ? 10 : 7
    dial += `<line x1="${(hc + Math.cos(a) * (86 - len)).toFixed(1)}" y1="${(112 + Math.sin(a) * (86 - len)).toFixed(1)}" x2="${(hc + Math.cos(a) * 86).toFixed(1)}" y2="${(112 + Math.sin(a) * 86).toFixed(1)}" stroke="#fff" stroke-opacity="${t / 40 <= level ? 0.5 : 0.16}" stroke-width="${t % 5 === 0 ? 1.1 : 0.8}"/>`
  }
  const na = ((202 + 136 * level) * Math.PI) / 180
  const needle = `<g${i.busy ? ' class="s"' : ''}><line x1="${(hc + Math.cos(na) * 52).toFixed(1)}" y1="${(112 + Math.sin(na) * 52).toFixed(1)}" x2="${(hc + Math.cos(na) * 91).toFixed(1)}" y2="${(112 + Math.sin(na) * 91).toFixed(1)}" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></g>`

  // the hot core under the figure: the part of the glow that breathes, faster while the session works
  const core = id(ids, 'c')
  const blur = id(ids, 'f')
  const coreDefs =
    `<radialGradient id="${core}" cx=".5" cy="1" r=".5" gradientTransform="translate(0 .5) scale(1 .5)"><stop offset="0" stop-color="${c[0]}" stop-opacity=".95"/><stop offset=".45" stop-color="${c[1]}" stop-opacity=".6"/><stop offset="1" stop-color="${c[1]}" stop-opacity="0"/></radialGradient>` +
    `<filter id="${blur}" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>`
  const coreSvg = `<g class="b${i.busy ? ' f' : ''}${level >= 0.9 ? ' p' : ''}"><ellipse cx="${hc.toFixed(1)}" cy="${H}" rx="${(70 + level * 80).toFixed(0)}" ry="${(14 + level * 46).toFixed(0)}" fill="url(#${core})" filter="url(#${blur})"/></g>`

  // the other numbers, in as many columns as are sure to be seen
  // Captions are kept short: a column is 92 px, and its neighbour's rule stands 78 px along.
  const stats: Array<[string, string, string]> = [['WRITTEN', short(i.written), 'tokens']]
  if (i.cache !== null) stats.push(['CACHE', `${Math.round(cl(i.cache, 0, 100))}%`, 'of reads'])
  if (i.usd !== null) stats.push(['COST', dollars(i.usd), 'session'])
  stats.push(['TURNS', short(i.turns), `${short(i.tools)} tools`], ['TIME', clock(i.minutes), i.minutes >= 6000 ? 'hours' : 'elapsed'], ['READ', short(i.read), 'new tokens'])
  const x0 = Math.max(204, 22 + hero.w + 104)
  const columns = Math.max(0, Math.floor((i.seen - EDGE_SIDE - x0) / 92))
  let cols = ''
  stats.slice(0, columns).forEach((st, n) => {
    const x = x0 + n * 92
    cols +=
      `<line x1="${x - 14}" y1="18" x2="${x - 14}" y2="74" stroke="#fff" stroke-opacity=".1"/>` +
      label(x, 24, st[0]) +
      num(ids, st[1], x, 33, 19, { weight: 1.9 }).svg +
      label(x, 70, st[2], { size: 9.5, spacing: 0.2, opacity: 0.5, weight: 500 })
  })

  const sub = i.context ? label(22 + hero.w + 16, 76, `${short(i.context.tokens)} / ${short(i.context.window)}`, { size: 10, spacing: 0.3, opacity: 0.8 }) : ''
  const r = CORNER
  // the rim's path in card coordinates: along the top, round the two left corners, along the bottom
  const edge = `M${W} 1.4H${r}A${r - 1.4} ${r - 1.4} 0 0 0 1.4 ${r}V${H - r}A${r - 1.4} ${r - 1.4} 0 0 0 ${r} ${H - 1.4}H${W}`
  const l = EDGE_SIDE + 0.5
  const cut = `M-99 ${TOP + r}H${l}A${r} ${r} 0 0 1 ${l + r} ${TOP}V-99H${W + 99}V999H${l + r}V${BOTTOM}A${r} ${r} 0 0 1 ${l} ${BOTTOM - r}H-99Z`

  return {
    source:
      // `slice` from the top left: where the app gives the drawing a narrower box, it is cropped at the right, never scaled to fit.
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ART_HEIGHT}" viewBox="0 0 ${W} ${ART_HEIGHT}" preserveAspectRatio="xMinYMin slice"><style>${STYLE}</style><defs>${coreDefs}<clipPath id="cut"><path d="${cut}"/></clipPath></defs>` +
      `<g clip-path="url(#cut)"><rect width="${W}" height="${ART_HEIGHT}" fill="#050505"/><g transform="translate(${EDGE_SIDE} ${EDGE_TOP})">` +
      sheen(ids, -EDGE_SIDE, W) +
      dial +
      needle +
      glowBand(ids, -EDGE_SIDE, W, level) +
      coreSvg +
      label(22, 21, 'CONTEXT') +
      hero.svg +
      pct.svg +
      sub +
      cols +
      rim(ids, edge, level) +
      '</g></g></svg>',
    width: W,
  }
}

/** The control rail at the plate's right end, in px: the band lays its buttons over it, one above the other. */
export const RAIL = 32
/** Where a limit's figure starts: past the longest name a row carries. */
const FIGURE_X = 56

/** The limits plate for the Glass mode: the card's right end, with its two right corners cut. Drawn at its exact size. */
export function glassPlate(i: GlassInput): { source: string; width: number; height: number } {
  const ids: Ids = { n: 0 }
  const rail = (i.wide ? 152 : 96) + 0.5
  const inner = rail - 0.5 + RAIL
  const W = inner + EDGE_SIDE
  const level = i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) / 100 : 0
  const bar = i.wide ? 128 : 72
  const row = (y: number, name: string, g: Gauge) => {
    const ink = g.level === 'high' ? '#ff5f5f' : g.level === 'ahead' ? '#ffb347' : '#fff'
    const p = cl(g.percent, 0, 100)
    return (
      label(12, y + 10, name, name.length > 5 ? { spacing: 0.4 } : {}) +
      num(ids, `${Math.round(g.percent)}%`, FIGURE_X, y, 11, { ink, weight: 1.9 }).svg +
      (i.wide && g.left ? label(100, y + 10, g.left, { size: 9.5, spacing: 0.2, opacity: 0.55, weight: 500 }) : '') +
      `<rect x="12" y="${y + 17}" width="${bar}" height="1.6" fill="#fff" fill-opacity=".16"/><rect x="12" y="${y + 17}" width="${((bar * p) / 100).toFixed(1)}" height="1.6" fill="${ink}"/>` +
      (g.pace !== null ? `<rect x="${(12 + bar * cl(g.pace, 0, 1) - 0.6).toFixed(1)}" y="${y + 14}" width="1.2" height="7" fill="#fff"/>` : '')
    )
  }
  const rows: Array<[string, Gauge]> = []
  if (i.five) rows.push(['5H', i.five])
  if (i.seven) rows.push(['7D', i.seven])
  if (i.model) rows.push([i.model.name, i.model.gauge])
  const r = CORNER
  const edge = `M0 1.4H${inner - r}A${r - 1.4} ${r - 1.4} 0 0 1 ${inner - 1.4} ${r}V${H - r}A${r - 1.4} ${r - 1.4} 0 0 1 ${inner - r} ${H - 1.4}H0`
  const x = inner - 0.5
  const cut = `M999 ${TOP + r}H${x}A${r} ${r} 0 0 0 ${x - r} ${TOP}V-99H-99V999H${x - r}V${BOTTOM}A${r} ${r} 0 0 0 ${x} ${BOTTOM - r}H999Z`
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ART_HEIGHT}" viewBox="0 0 ${W} ${ART_HEIGHT}" preserveAspectRatio="xMaxYMin slice"><clipPath id="cut"><path d="${cut}"/></clipPath>` +
      `<g clip-path="url(#cut)"><rect width="${W}" height="${ART_HEIGHT}" fill="#050505"/><g transform="translate(0 ${EDGE_TOP})">` +
      sheen(ids, 0, W) +
      glowBand(ids, 0, W, level) +
      '<line x1=".5" y1="10" x2=".5" y2="83" stroke="#fff" stroke-opacity=".12"/>' +
      rows.map((v, n) => row(11 + n * 26, v[0], v[1])).join('') +
      // the rail's own edge: the buttons stand right of it
      `<line x1="${rail}" y1="10" x2="${rail}" y2="83" stroke="#fff" stroke-opacity=".12"/>` +
      rim(ids, edge, level) +
      '</g></g></svg>',
    width: W,
    height: ART_HEIGHT,
  }
}

/** What the plate shows, for a screen reader. */
export const limitsAlt = (i: GlassInput) => {
  const said = [
    i.five ? `5-hour ${Math.round(i.five.percent)}%` : null,
    i.seven ? `weekly ${Math.round(i.seven.percent)}%` : null,
    i.model ? `${i.model.name} weekly ${Math.round(i.model.gauge.percent)}%` : null,
  ].filter(Boolean)
  return said.length ? `Limits: ${said.join(', ')}` : 'Limits'
}

/** What the card shows, for a screen reader. */
export const glassAlt = (i: GlassInput) =>
  [
    i.context ? `Context ${Math.round(i.context.percent)}%, ${short(i.context.tokens)} of ${short(i.context.window)} tokens` : 'Context not read yet',
    `${short(i.written)} tokens written`,
    i.usd !== null ? `${dollars(i.usd)} so far` : null,
    `${i.turns} turn${i.turns === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ')
