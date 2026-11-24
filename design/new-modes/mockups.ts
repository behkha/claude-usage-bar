// Mockups for the five new card modes, drawn with the mod's own card and tab
// helpers at the band's real size. Design work, not mod code: nothing in
// hooks/ imports this. `bun design/new-modes/mockups.ts` writes page.html.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ART_HEIGHT, CARD_HEIGHT, EDGE_SIDE, EDGE_TOP, leftEnd, rightEnd } from '../../hooks/card'
import type { Gauge } from '../../hooks/card'
import { ARRIVAL_MS, LIFT, lift, projectRoom, tabbedArt, updateTab } from '../../hooks/tab'
import type { TabArt, TabStyle } from '../../hooks/tab'
import { RAIL, clock, dollars, short } from '../../hooks/glass'
import type { UsageBarNotice, UsageBarProject } from '../../types'

const H = CARD_HEIGHT

// ---------- the example sessions (docs/pictures.ts) ----------

type Numbers = {
  five: Gauge | null
  seven: Gauge | null
  model: { name: string; gauge: Gauge } | null
  context: { percent: number; tokens: number; window: number }
  written: number
  read: number
  cache: number | null
  usd: number | null
  turns: number
  tools: number
  minutes: number
}
const limit = (percent: number, pace: number, left: string, level: Gauge['level'] = 'ok'): Gauge => ({ percent, pace, left, level })
const SESSIONS: Record<'eco' | 'normal' | 'sport', Numbers> = {
  normal: { context: { percent: 62, tokens: 620_000, window: 1_000_000 }, five: limit(34, 0.357, '3h 13m'), seven: limit(58, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(41, 0.679, '2d 6h') }, usd: 21.37, minutes: 318, turns: 61, written: 148_000, read: 2_400_000, cache: 91, tools: 212 },
  eco: { context: { percent: 18, tokens: 180_000, window: 1_000_000 }, five: limit(12, 0.5, '2h 30m'), seven: limit(31, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(22, 0.679, '2d 6h') }, usd: 3.42, minutes: 41, turns: 9, written: 21_400, read: 310_000, cache: 84, tools: 31 },
  sport: { context: { percent: 91, tokens: 910_000, window: 1_000_000 }, five: limit(81, 0.6, '2h 0m', 'ahead'), seven: limit(74, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(88, 0.679, '2d 6h', 'ahead') }, usd: 64.1, minutes: 505, turns: 118, written: 392_000, read: 6_100_000, cache: 93, tools: 455 },
}
type Session = keyof typeof SESSIONS

// ---------- drawing helpers ----------

const f = (n: number) => String(+n.toFixed(2))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const HN = '"Helvetica Neue",-apple-system,sans-serif'
const SANS = '-apple-system,system-ui,sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'
type TO = { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; spacing?: number; fill?: string; opacity?: number; font?: string; extra?: string }
const T = (x: number, y: number, s: string, o: TO = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family='${o.font ?? SANS}' font-size="${o.size ?? 10}" font-weight="${o.weight ?? 400}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''} fill="${o.fill ?? '#fff'}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}${o.extra ?? ''}>${esc(s)}</text>`
const rad = (d: number) => (d * Math.PI) / 180
/** A point `r` from (cx, cy) at `a` degrees, 0 straight up, clockwise. */
const P = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))]
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = P(cx, cy, r, a0)
  const [x1, y1] = P(cx, cy, r, a1)
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(x1)} ${f(y1)}`
}
const pct = (g: Gauge) => cl(g.percent, 0, 100)
const hot = (g: Gauge) => g.level !== 'ok'
type Lim = { key: string; label: string; g: Gauge }
const limitsOf = (n: Numbers): Lim[] => {
  const out: Lim[] = []
  if (n.five) out.push({ key: '5H', label: '5-HOUR', g: n.five })
  if (n.seven) out.push({ key: 'WK', label: 'WEEK', g: n.seven })
  if (n.model) out.push({ key: n.model.name.slice(0, 3), label: n.model.name, g: n.model.gauge })
  return out
}
/** The session's numbers, as each mode prints them, in the order they give way (last first). */
const stations = (n: Numbers): Array<[string, string]> => {
  const s: Array<[string, string]> = []
  if (n.usd !== null) s.push(['COST', dollars(n.usd)])
  s.push(['TIME', clock(n.minutes)], ['TURNS', String(n.turns)])
  if (n.cache !== null) s.push(['CACHE', `${Math.round(n.cache)}%`])
  s.push(['WRITTEN', short(n.written)])
  return s
}
const ctxHot = (n: Numbers) => n.context.percent >= 90

type In = { n: Numbers; narrow: number; wide: boolean }
type Drawn = { source: string; width: number; height: number }
type Card = { art: TabArt; plate: Drawn }
type Option = {
  mode: string
  id: string
  name: string
  glyph: string
  tab: TabStyle
  draw: (i: In) => Card
  /** The page round the card, where it is not the app's black. */
  page?: string
}

const plateFor = (i: In, wide: number, narrow: number) => (i.wide ? wide : narrow)
/** The room the art has left of the plate, on the narrowest card. */
const roomOf = (i: In, body: number) => i.narrow - body - RAIL - 8
const artW = (i: In) => i.narrow + 40

// ============ VU ============

const VU_AMBER = { ground: '#120d08', print: '#f6d9a0', dim: '#a87f4c', edge: 'rgba(246,217,160,.26)', rule: 'rgba(246,217,160,.12)' }

/** A backlit meter face: cream-amber, an arc scale with the last fifth red, a needle, a blue pace mark, a peak lamp. */
const vuFace = (id: string, x: number, y: number, w: number, h: number, label: string, v: number, pace: number | null, peak: boolean) => {
  const cx = x + w / 2
  const cy = y + h + 26
  const r = h + 4
  const sweep = Math.min(42, (Math.asin(Math.min(0.95, (w / 2 - 14) / r)) * 180) / Math.PI)
  const A = (t: number) => -sweep + (2 * sweep * t) / 100
  let s = `<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/></clipPath><g clip-path="url(#${id}c)">`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#vuGlow)"/>`
  s += `<path d="${arc(cx, cy, r, A(0), A(80))}" fill="none" stroke="#2a1d10" stroke-width="1.1"/>`
  s += `<path d="${arc(cx, cy, r + 2.5, A(80), A(100))}" fill="none" stroke="#c4321c" stroke-width="4.5"/>`
  for (let t = 0; t <= 100; t += 10) {
    const [a, b] = P(cx, cy, r, A(t))
    const [c, d] = P(cx, cy, r + (t % 20 ? 5 : 8), A(t))
    const col = t >= 80 ? '#c4321c' : '#2a1d10'
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${col}" stroke-width="1"/>`
    if (t % 20 === 0 && w >= 120) {
      const [lx, ly] = P(cx, cy, r + 15, A(t))
      s += T(lx, ly + 2.5, String(t), { size: 7, anchor: 'middle', fill: col, font: HN })
    }
  }
  if (pace !== null) {
    const [a, b] = P(cx, cy, r - 9, A(pace))
    const [c, d] = P(cx, cy, r - 1, A(pace))
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="#1f5fbf" stroke-width="2.6" stroke-linecap="round"/>`
  }
  const [nx, ny] = P(cx, cy, r + 10, A(v))
  s += `<line x1="${f(cx + 1.5)}" y1="${f(cy + 1.5)}" x2="${f(nx + 1.5)}" y2="${f(ny + 2)}" stroke="#000" stroke-opacity=".2" stroke-width="1.6"/>`
  s += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(nx)}" y2="${f(ny)}" stroke="#17110a" stroke-width="1.3"/>`
  // the print keeps a halo of the face, so the needle passes behind it
  const halo = ' stroke="#f4dca4" stroke-width="5" paint-order="stroke" stroke-linejoin="round"'
  s += T(x + 8, y + h - 7, label, { size: 6.8, spacing: 1.1, weight: 600, fill: '#5a4326', extra: halo })
  s += T(x + w - 8, y + h - 7, `${Math.round(v)}%`, { size: 10.5, weight: 700, anchor: 'end', fill: peak ? '#b3261e' : '#2a1d10', font: HN, extra: halo })
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.42}" fill="#fff" opacity=".08"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3.5"/></g>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="#3a2a18" stroke-width="1.4"/>`
  // the peak lamp
  s += `<circle cx="${x + w - 9}" cy="${y + 9}" r="2.6" fill="${peak ? '#ff3a1c' : '#5a2a1a'}"${peak ? ' filter="url(#vuLed)"' : ''}/>`
  return s
}
/** A small edgewise meter: a backlit window, ticks, a needle moving across, a blue pace caret. */
const edgewise = (x: number, y: number, w: number, h: number, v: number, pace: number | null, peak: boolean) => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#vuEdge)" stroke="#3a2a18"/>`
  for (let k = 0; k <= 10; k++) {
    const tx = x + 3 + ((w - 6) * k) / 10
    s += `<line x1="${f(tx)}" y1="${y + 1.5}" x2="${f(tx)}" y2="${y + (k % 5 ? 4 : 6)}" stroke="${k >= 8 ? '#c4321c' : '#2a1d10'}" stroke-width=".8"/>`
  }
  s += `<rect x="${f(x + 3 + (w - 6) * 0.8)}" y="${y + 1}" width="${f((w - 6) * 0.2)}" height="1.6" fill="#c4321c"/>`
  const nx = x + 3 + ((w - 6) * v) / 100
  s += `<line x1="${f(nx)}" y1="${y + 2}" x2="${f(nx)}" y2="${y + h - 1.5}" stroke="${peak ? '#b3261e' : '#17110a'}" stroke-width="1.4"/>`
  if (pace !== null) {
    const px = x + 3 + (w - 6) * pace
    s += `<path d="M${f(px - 3)} ${y - 4}h6l-3 3.6z" fill="#6fa4ff"/>`
  }
  return s
}
const vuDefs =
  `<radialGradient id="vuGlow" cx="50%" cy="95%" r="90%"><stop offset="0" stop-color="#fff3d4"/><stop offset=".55" stop-color="#f2d595"/><stop offset="1" stop-color="#c3924a"/></radialGradient>` +
  `<linearGradient id="vuEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dfa8"/><stop offset="1" stop-color="#d3a25a"/></linearGradient>` +
  `<filter id="vuLed" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<radialGradient id="vuSpill" cx="160" cy="70" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb24a" stop-opacity=".16"/><stop offset="1" stop-color="#ffb24a" stop-opacity="0"/></radialGradient>`

/** The plate: limits as edgewise meters, reset times on the wide plate. */
const vuPlate = (i: In, rows: Lim[], body: number, ground: string, extra = '') => {
  const inner = body + RAIL
  const ys = rows.length >= 3 ? [24, 48, 72] : rows.length === 2 ? [33, 63] : [48]
  const mw = i.wide ? 58 : 40
  const s = rows
    .map((r, k) => {
      const c = ys[k] ?? 0
      return (
        T(8, c + 3, r.key, { size: 7.5, weight: 700, spacing: 0.6, fill: VU_AMBER.dim }) +
        edgewise(30, c - 7, mw, 12, pct(r.g), r.g.pace, hot(r.g)) +
        T(30 + mw + 5, c + 4, `${Math.round(r.g.percent)}%`, { size: 11, font: HN, fill: hot(r.g) ? '#ff6a4a' : VU_AMBER.print }) +
        (i.wide && r.g.left ? T(body - 6, c + 4, r.g.left.replace(/ /g, ''), { size: 10, anchor: 'end', fill: VU_AMBER.print, opacity: 0.8, font: HN }) : '')
      )
    })
    .join('')
  return rightEnd(inner, body, ground, `<rect width="${inner}" height="${H}" fill="url(#vuSpill)"/>` + extra + s, { defs: vuDefs, edge: VU_AMBER.edge, rule: VU_AMBER.rule })
}
const stationRow = (x0: number, room: number, n: Numbers, o: { label: string; value: string; pitch?: number; y: number; size: number; font?: string; glow?: string; withTokens?: boolean }) => {
  const list = stations(n)
  if (o.withTokens) list.splice(0, 0, ['TOKENS', `${short(n.context.tokens)}/${short(n.context.window)}`])
  const widthOf = ([k, v]: [string, string]) => Math.max(k.length * 6.2, v.length * o.size * 0.56) + 24
  const shown: Array<[string, string]> = []
  let used = 0
  for (const it of list) {
    if (x0 + used + widthOf(it) > room) break
    shown.push(it)
    used += widthOf(it)
  }
  const spare = shown.length > 1 ? Math.max(0, Math.min(56, (room - x0 - used) / (shown.length - 1))) : 0
  let s = ''
  let x = x0
  for (const it of shown) {
    s += T(x, o.y - 22, it[0], { size: 7.5, spacing: 1.2, weight: 600, fill: o.label }) + T(x, o.y, it[1], { size: o.size, weight: 300, font: o.font ?? HN, fill: o.value, extra: o.glow ? ` filter="url(#${o.glow})"` : '' })
    x += widthOf(it) + spare
  }
  return s
}

const vuTwin: Option = {
  mode: 'vu',
  id: 'vu-twin',
  name: 'Twin meters',
  glyph: '◠',
  tab: { ink: 0.26, fill: ['#2a1f14', '#170f09'], line: '#f6d9a0' },
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const two = room >= 10 + 2 * 150 + 8
    const ctx = i.n.context.percent
    const [five, ...rest] = limitsOf(i.n)
    let s = `<rect x="-9" width="${artW(i)}" height="${H}" fill="url(#vuSpill)"/>`
    s += vuFace('m1', 10, 11, 146, 71, 'CONTEXT', ctx, null, ctxHot(i.n))
    if (two && five) s += vuFace('m2', 164, 11, 146, 71, five.label, pct(five.g), five.g.pace, hot(five.g))
    const x0 = (two ? 310 : 156) + 22
    s += stationRow(x0, room, i.n, { label: VU_AMBER.dim, value: VU_AMBER.print, pitch: 84, y: 58, size: 20, withTokens: true })
    const art = leftEnd(artW(i), VU_AMBER.ground, s, { defs: vuDefs, edge: VU_AMBER.edge })
    const plateRows = two ? rest : limitsOf(i.n)
    return { art: { source: art, width: artW(i) }, plate: vuPlate(i, plateRows, body, VU_AMBER.ground) }
  },
}

/** Night dial: a black window with cyan print in stacked segmented arcs, the last zone recoloured, a copper needle for context. */
const NIGHT = { ground: '#070807', cyan: '#22d8d0', core: '#8ff7f0', ghost: '#0c2a28', warm: '#e8933a', edge: 'rgba(143,247,240,.22)', rule: 'rgba(143,247,240,.1)' }
const nightDefs =
  `<filter id="ng" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<radialGradient id="nbz" cx="50%" cy="50%" r="75%"><stop offset=".6" stop-color="${NIGHT.warm}" stop-opacity="0"/><stop offset="1" stop-color="${NIGHT.warm}" stop-opacity=".55"/></radialGradient>`
const segArc = (cx: number, cy: number, r: number, a0: number, a1: number, v: number, n: number, hotFrom: number, warn: string) => {
  let s = ''
  const step = (a1 - a0) / n
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) / n) * 100
    const lit = t <= v
    const col = t >= hotFrom ? warn : NIGHT.cyan
    s += `<path d="${arc(cx, cy, r, a0 + k * step + 0.6, a0 + (k + 1) * step - 0.6)}" fill="none" stroke="${lit ? col : NIGHT.ghost}" stroke-width="3.2"${lit ? ' filter="url(#ng)"' : ''}/>`
  }
  return s
}
const vuNight: Option = {
  mode: 'vu',
  id: 'vu-night',
  name: 'Night dial',
  glyph: '◠',
  tab: { ink: 0.22, fill: ['#141614', '#0a0b0a'], line: '#8ff7f0' },
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const L = limitsOf(i.n)
    const x = 10
    const y = 8
    const w = 236
    const h = 77
    const cx = x + w / 2
    const cy = y + h + 62
    const sw = 40
    let s = `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="8" fill="url(#nbz)"/>`
    s += `<clipPath id="nw"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/></clipPath><g clip-path="url(#nw)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#030404"/>`
    // three stacked scales, outermost the context, then the 5-hour and the week
    const scales: Array<[number, number, number | null, string]> = [[ctx(i), 132, null, 'CONTEXT'], ...L.slice(0, 2).map((l, k) => [pct(l.g), 120 - k * 11, l.g.pace, l.key] as [number, number, number | null, string])]
    scales.forEach(([v, r, pace, k]) => {
      s += segArc(cx, cy, r, -sw, sw, v, 24, 80, '#3ce87a')
      if (pace !== null) {
        const [a, b] = P(cx, cy, r - 3, -sw + 2 * sw * pace)
        const [c, d] = P(cx, cy, r + 3, -sw + 2 * sw * pace)
        s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${NIGHT.warm}" stroke-width="1.6"/>`
      }
    })
    // the needle: the context, a thin copper wire over the print
    const [nx, ny] = P(cx, cy, 140, -sw + (2 * sw * ctx(i)) / 100)
    s += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(nx)}" y2="${f(ny)}" stroke="#b5643a" stroke-width="1.3"/>`
    // the key, outermost scale first, along the window's foot
    const legend: Array<[string, number]> = [['CTX', ctx(i)], ...L.slice(0, 2).map(l => [l.key, l.g.percent] as [string, number])]
    legend.forEach(([k, v], j) => {
      const lx = j === 0 ? x + 12 : x + w - 214 + j * 70
      s += T(lx, y + h - 8, k, { size: 7, weight: 700, spacing: 0.8, fill: NIGHT.cyan, opacity: 0.7 }) + T(lx + 24, y + h - 8, `${Math.round(v)}%`, { size: j ? 12 : 15, weight: 300, font: HN, fill: NIGHT.core, extra: ' filter="url(#ng)"' })
    })
    s += `</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="#2a1c10" stroke-width="1.4"/>`
    s += stationRow(x + w + 22, room, i.n, { label: '#5f9f9b', value: NIGHT.core, pitch: 84, y: 58, size: 20, withTokens: true })
    const art = leftEnd(artW(i), NIGHT.ground, s, { defs: nightDefs, edge: NIGHT.edge })
    // the plate: the model limit as a short arc, reset times
    const inner = body + RAIL
    const fab = L[2]
    let p = ''
    if (fab) {
      p += T(10, 24, fab.key, { size: 7.5, weight: 700, spacing: 0.6, fill: NIGHT.cyan, opacity: 0.75 })
      const nseg = i.wide ? 12 : 9
      for (let k = 0; k < nseg; k++) {
        const t = ((k + 0.5) / nseg) * 100
        const lit = t <= pct(fab.g)
        p += `<rect x="${10 + k * 6}" y="32" width="4.4" height="9" rx="1" fill="${lit ? (t >= 80 ? '#3ce87a' : NIGHT.cyan) : NIGHT.ghost}"${lit ? ' filter="url(#ng)"' : ''}/>`
      }
      p += `<line x1="${f(10 + nseg * 6 * fab.g.pace!)}" y1="29" x2="${f(10 + nseg * 6 * fab.g.pace!)}" y2="44" stroke="${NIGHT.warm}" stroke-width="1.4"/>`
      p += T(14 + nseg * 6, 41, `${Math.round(fab.g.percent)}%`, { size: 11, font: HN, fill: NIGHT.core })
    }
    if (i.wide)
      L.slice(0, 2).forEach((l, k) => {
        p += T(10, 62 + k * 14, l.key, { size: 7.5, weight: 700, fill: NIGHT.cyan, opacity: 0.7 }) + T(body - 8, 62 + k * 14, l.g.left?.replace(/ /g, '') ?? '', { size: 10, anchor: 'end', fill: NIGHT.core, opacity: 0.8, font: HN })
      })
    return { art: { source: art, width: artW(i) }, plate: rightEnd(inner, body, NIGHT.ground, p, { defs: nightDefs, edge: NIGHT.edge, rule: NIGHT.rule }) }
  },
}
function ctx(i: In) {
  return cl(i.n.context.percent, 0, 100)
}

const vuBridge: Option = {
  mode: 'vu',
  id: 'vu-bridge',
  name: 'Meter bridge',
  glyph: '◠',
  tab: vuTwin.tab,
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const L = limitsOf(i.n)
    const meters: Array<[string, number, number | null, boolean]> = [['CONTEXT', ctx(i), null, ctxHot(i.n)], ...L.map(l => [l.label, pct(l.g), l.g.pace, hot(l.g)] as [string, number, number | null, boolean])]
    let s = `<rect x="-9" width="${artW(i)}" height="${H}" fill="url(#vuSpill)"/>`
    let x = 10
    const shown: number[] = []
    meters.forEach((m, k) => {
      if (x + 100 > room && k > 0) return
      s += vuFace(`b${k}`, x, 11, 100, 71, m[0], m[1], m[2], m[3])
      shown.push(k)
      x += 106
    })
    s += stationRow(x + 16, room, i.n, { label: VU_AMBER.dim, value: VU_AMBER.print, pitch: 84, y: 58, size: 20 })
    const art = leftEnd(artW(i), VU_AMBER.ground, s, { defs: vuDefs, edge: VU_AMBER.edge })
    // what did not fit as a meter moves onto the plate
    const left = L.filter((_, k) => !shown.includes(k + 1))
    let plate: Drawn
    if (left.length) plate = vuPlate(i, left, body, VU_AMBER.ground)
    else {
      const inner = body + RAIL
      const p = L.map((l, n) => T(10, 27 + n * 22, l.key, { size: 7.5, weight: 700, spacing: 0.6, fill: VU_AMBER.dim }) + T(body - 8, 28 + n * 22, i.wide ? `${Math.round(l.g.percent)}%  ${(l.g.left ?? '').replace(/ /g, '')}` : `${Math.round(l.g.percent)}%`, { size: 12, anchor: 'end', font: HN, weight: 300, fill: hot(l.g) ? '#ff6a4a' : VU_AMBER.print })).join('')
      plate = rightEnd(inner, body, VU_AMBER.ground, `<rect width="${inner}" height="${H}" fill="url(#vuSpill)"/>` + p, { defs: vuDefs, edge: VU_AMBER.edge, rule: VU_AMBER.rule })
    }
    return { art: { source: art, width: artW(i) }, plate }
  },
}

// ============ NIXIE ============

const NX = { ground: '#0b0908', lit: '#ffb15a', core: '#ffd9a8', glow: '#ff6a1e', ghost: '#6b4a38', label: '#b08868', edge: 'rgba(255,177,90,.2)', rule: 'rgba(255,177,90,.1)' }
const nxDefs =
  `<filter id="nxg" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<filter id="nxs" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `<linearGradient id="nxGlass" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".3" stop-color="#fff" stop-opacity=".02"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>` +
  `<pattern id="nxMesh" width="5" height="8.66" patternUnits="userSpaceOnUse"><path d="M0 0l2.5 4.33L0 8.66M5 0L2.5 4.33L5 8.66M2.5 4.33h0" fill="none" stroke="#8a6a50" stroke-width=".35"/></pattern>`
/** One tube: glass, the hex mesh, every cathode as a ghost, the lit one as glowing wire, and its caps. */
const tube = (x: number, y: number, w: number, h: number, ch: string, size: number, o: { dot?: boolean; red?: boolean } = {}) => {
  const cx = x + w / 2
  const base = y + h * 0.5 + size * 0.36
  const ghosts = /\d/.test(ch) ? '0123456789'.split('').filter(g => g !== ch) : []
  const wire = (g: string, ghost: boolean) =>
    `<text x="${f(cx)}" y="${f(base)}" text-anchor="middle" font-family='${HN}' font-weight="200" font-size="${size}" fill="none" stroke="${ghost ? NX.ghost : o.red ? '#ff5a3a' : NX.lit}" stroke-width="${ghost ? 0.5 : 1.5}"${ghost ? ' stroke-opacity=".32"' : ' filter="url(#nxg)"'}>${esc(g)}</text>`
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${f(Math.min(w * 0.42, 12))}" fill="#110c0a" stroke="#3d342d" stroke-width=".8"/>`
  s += `<rect x="${x + 3}" y="${y + 6}" width="${w - 6}" height="${h - 12}" rx="3" fill="url(#nxMesh)" opacity=".5"/>`
  s += ghosts.map(g => wire(g, true)).join('') + wire(ch, false)
  if (o.dot) s += `<circle cx="${x + w + 1}" cy="${f(y + h - 8)}" r="3" fill="${NX.lit}" filter="url(#nxs)"/>`
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${f(Math.min(w * 0.42, 12))}" fill="url(#nxGlass)"/>`
  s += `<rect x="${x + 3}" y="${y + h - 3}" width="${w - 6}" height="3" rx="1" fill="#2a2420"/>`
  return s
}
/** An INS-1 neon lamp: a tiny bulb, lit or not. */
const lamp = (x: number, y: number, on: boolean, red = false) =>
  `<ellipse cx="${x}" cy="${y}" rx="4" ry="5.5" fill="#1a130f" stroke="#5a4a3d" stroke-width=".8"/>` + (on ? `<circle cx="${x}" cy="${y}" r="2.4" fill="${red ? '#ff4a2a' : NX.lit}" filter="url(#nxs)"/>` : `<circle cx="${x}" cy="${y}" r="1.8" fill="#4a3628"/>`)
/** An IN-13 bar tube: a thin glass tube, a glowing column for what is used, a cold mark at the pace. */
const in13 = (x: number, y: number, w: number, v: number, pace: number | null, red: boolean) =>
  `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4.5" fill="#17110e" stroke="#3d342d" stroke-width=".8"/>` +
  `<line x1="${x + 4}" y1="${y + 4.5}" x2="${x + w - 4}" y2="${y + 4.5}" stroke="${NX.ghost}" stroke-opacity=".5" stroke-width="2"/>` +
  `<rect x="${x + 4}" y="${y + 3}" width="${f(Math.max(1, ((w - 8) * v) / 100))}" height="3" rx="1.5" fill="${red ? '#ff4a2a' : '#ff8a2e'}" filter="url(#nxs)"/>` +
  (pace !== null ? `<line x1="${f(x + 4 + (w - 8) * pace)}" y1="${y - 3}" x2="${f(x + 4 + (w - 8) * pace)}" y2="${y + 1}" stroke="#d8c8b8" stroke-width="1.2"/>` : '') +
  `<rect x="${x}" y="${y}" width="${w}" height="4" rx="2" fill="#fff" opacity=".06"/>`

const nixieTubes: Option = {
  mode: 'nixie',
  id: 'nixie-tubes',
  name: 'Tubes and bars',
  glyph: '◍',
  tab: { ink: 0.2, fill: ['#1d1612', '#0d0a09'], line: '#ffb15a' },
  draw: i => {
    const body = plateFor(i, 160, 112)
    const room = roomOf(i, body)
    const c = String(Math.round(ctx(i))).padStart(2, ' ')
    let s = `<radialGradient id="nxSpill" cx="60" cy="50" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff7a1e" stop-opacity=".12"/><stop offset="1" stop-color="#ff7a1e" stop-opacity="0"/></radialGradient><rect x="-9" width="${artW(i)}" height="${H}" fill="url(#nxSpill)"/>`
    s += tube(10, 8, 34, 72, c[0] ?? ' ', 54, { red: ctxHot(i.n) }) + tube(46, 8, 34, 72, c[1] ?? '0', 54, { red: ctxHot(i.n) }) + tube(82, 22, 24, 48, '%', 30)
    s += lamp(112, 66, ctxHot(i.n), true)
    s += stationRow(128, room, i.n, { label: NX.label, value: NX.lit, pitch: 84, y: 58, size: 20, glow: 'nxs', withTokens: true })
    const art = leftEnd(artW(i), NX.ground, s, { defs: nxDefs, edge: NX.edge })
    const inner = body + RAIL
    const tw = i.wide ? 54 : 46
    const p = limitsOf(i.n)
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
    return { art: { source: art, width: artW(i) }, plate: rightEnd(inner, body, NX.ground, p, { defs: nxDefs, edge: NX.edge, rule: NX.rule }) }
  },
}

const nixieClock: Option = {
  mode: 'nixie',
  id: 'nixie-clock',
  name: 'Tube clock',
  glyph: '◍',
  tab: nixieTubes.tab,
  draw: i => {
    const body = plateFor(i, 160, 112)
    const room = roomOf(i, body)
    const n = i.n
    const tw = 25
    const th = 60
    const y = 7
    const fs = 42
    type G = { label: string; chars: Array<{ ch: string; dot?: boolean; colon?: boolean; small?: boolean }> }
    const c = String(Math.round(ctx(i)))
    const usd = n.usd !== null ? n.usd.toFixed(2) : '0.00'
    const [ui, uf] = usd.split('.')
    const hh = String(Math.floor(n.minutes / 60))
    const mm = String(n.minutes % 60).padStart(2, '0')
    const groups: G[] = [
      { label: 'CONTEXT', chars: [...c.split('').map(ch => ({ ch })), { ch: '%', small: true }] },
      { label: 'COST', chars: [{ ch: '$', small: true }, ...(ui ?? '0').split('').map((ch, k, a) => ({ ch, dot: k === a.length - 1 })), ...(uf ?? '00').split('').map(ch => ({ ch }))] },
      { label: 'TIME', chars: [...hh.split('').map(ch => ({ ch })), { ch: ':', colon: true }, ...mm.split('').map(ch => ({ ch }))] },
      { label: 'TURNS', chars: String(n.turns).split('').map(ch => ({ ch })) },
    ]
    let s = `<radialGradient id="nxSpill" cx="200" cy="50" r="320" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff7a1e" stop-opacity=".1"/><stop offset="1" stop-color="#ff7a1e" stop-opacity="0"/></radialGradient><rect x="-9" width="${artW(i)}" height="${H}" fill="url(#nxSpill)"/>`
    const widths = groups.map(g => g.chars.reduce((a, ch) => a + (ch.colon ? 12 : ch.small ? 22 : tw + 2), -2))
    let fit = 1
    while (fit < groups.length && 10 + widths.slice(0, fit + 1).reduce((a, b) => a + b + 14, 0) <= room - 22) fit++
    const gap = fit > 1 ? Math.min(70, (room - 32 - widths.slice(0, fit).reduce((a, b) => a + b, 0)) / (fit - 1)) : 14
    let x = 10
    groups.forEach((g, gi) => {
      if (gi >= fit) return
      const x0 = x
      g.chars.forEach(ch => {
        if (ch.colon) {
          s += lamp(x + 5, y + 22, true) + lamp(x + 5, y + 40, true)
          x += 12
        } else if (ch.small) {
          s += tube(x, y + 14, 20, th - 14, ch.ch, 24)
          x += 22
        } else {
          s += tube(x, y, tw, th, ch.ch, fs, { dot: ch.dot, red: gi === 0 && ctxHot(n) })
          x += tw + 2
        }
      })
      s += T(x0 + (x - 2 - x0) / 2, 83, g.label, { size: 7.5, spacing: 1.2, weight: 600, anchor: 'middle', fill: NX.label })
      x += gap
    })
    const art = leftEnd(artW(i), NX.ground, s, { defs: nxDefs, edge: NX.edge })
    const inner = body + RAIL
    const L = limitsOf(n)
    const colW = (body - 8) / 3
    const p = L.map((l, k) => {
      const cx = 8 + colW * k + colW / 2
      const d = String(Math.round(l.g.percent)).padStart(2, '0')
      const sw = i.wide ? 15 : 13
      return (
        tube(cx - sw - 1, 10, sw, 34, d[0] ?? '0', 24, { red: hot(l.g) }) +
        tube(cx + 1, 10, sw, 34, d[1] ?? '0', 24, { red: hot(l.g) }) +
        T(cx, 56, l.key, { size: 7, weight: 700, spacing: 0.8, anchor: 'middle', fill: NX.label }) +
        lamp(cx, 68, hot(l.g), true) +
        (i.wide && l.g.left ? T(cx, 86, l.g.left.replace(/ /g, ''), { size: 9, anchor: 'middle', fill: NX.lit, opacity: 0.75, font: HN }) : '')
      )
    }).join('')
    return { art: { source: art, width: artW(i) }, plate: rightEnd(inner, body, NX.ground, p, { defs: nxDefs, edge: NX.edge, rule: NX.rule }) }
  },
}

// ============ COCKPIT ============

const CK = { ground: '#0b0e11', panel: '#151a1f', line: '#2f363e', white: '#e8ecef', cyan: '#29d6e6', green: '#3fe05a', magenta: '#ff4fd8', amber: '#f5b800', red: '#ff3b30', edge: 'rgba(232,236,239,.24)', rule: 'rgba(232,236,239,.1)' }
const ckFill = (g: Gauge) => (g.percent >= 90 ? CK.red : hot(g) ? CK.amber : CK.green)
/** A data block: cyan captions, white values, in columns. */
const ckData = (x0: number, room: number, n: Numbers, rows = 2) => {
  const st = stations(n)
  const cols = Math.ceil(st.length / rows)
  const fit = Math.max(0, Math.min(cols, Math.floor((room - x0 + 14) / 84)))
  const spare = fit > 1 ? Math.min(120, (room - x0 + 14 - fit * 84) / (fit - 1)) : 0
  let s = ''
  for (let c = 0; c < fit; c++)
    for (let r = 0; r < rows; r++) {
      const item = st[c * rows + r]
      if (!item) continue
      const x = x0 + c * (84 + spare)
      const y = 32 + r * 34
      s += T(x, y - 13, item[0], { size: 7.5, font: MONO, fill: CK.cyan, spacing: 0.6 }) + T(x, y + 4, item[1], { size: 15, font: MONO, fill: CK.white })
    }
  return s
}
const ckCaution = (n: Numbers) => {
  if (ctxHot(n)) return { word: 'CTX', color: CK.red }
  if (limitsOf(n).some(l => hot(l.g))) return { word: 'LIMIT', color: CK.amber }
  return null
}

const cockpitTapes: Option = {
  mode: 'cockpit',
  id: 'cockpit-tapes',
  name: 'Flight tapes',
  glyph: '△',
  tab: { ink: 0.24, fill: ['#191e23', '#0e1114'], line: '#e8ecef' },
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const n = i.n
    const c = ctx(i)
    // the context tape: the scale rolls past a fixed window
    const ty = (v: number) => 46.5 - (v - c) * 1.5
    let s = `<clipPath id="tp"><rect x="10" y="6" width="56" height="81" rx="3"/></clipPath><rect x="10" y="6" width="56" height="81" rx="3" fill="${CK.panel}" stroke="${CK.line}"/><g clip-path="url(#tp)">`
    s += `<rect x="62" y="${f(ty(90))}" width="4" height="${f(ty(80) - ty(90))}" fill="${CK.amber}"/><rect x="62" y="${f(ty(100))}" width="4" height="${f(ty(90) - ty(100))}" fill="${CK.red}"/><rect x="62" y="${f(ty(80))}" width="4" height="${f(ty(0) - ty(80))}" fill="${CK.green}" fill-opacity=".8"/>`
    for (let v = 0; v <= 100; v += 5) {
      const y = ty(v)
      if (y < 0 || y > H) continue
      s += `<line x1="${v % 10 ? 55 : 50}" y1="${f(y)}" x2="61" y2="${f(y)}" stroke="${CK.white}" stroke-width="1"/>`
      if (v % 10 === 0) s += T(47, y + 3.2, String(v), { size: 9, anchor: 'end', font: MONO, fill: CK.white })
    }
    s += `</g>`
    // the boxed current value, with the last digit on a drum
    const v = String(Math.round(c))
    const last = Number(v.slice(-1))
    s += `<path d="M10 36H50L58 46.5L50 57H10Z" fill="#000" stroke="${CK.white}" stroke-width="1"/>`
    s += `<clipPath id="dr"><rect x="12" y="37" width="38" height="19"/></clipPath><g clip-path="url(#dr)">`
    s += T(15, 52.5, v.slice(0, -1), { size: 16, weight: 700, font: MONO, fill: ctxHot(n) ? CK.red : CK.green })
    const dx = 15 + 9.6 * (v.length - 1)
    s += T(dx, 52.5 - 15, String((last + 1) % 10), { size: 16, weight: 700, font: MONO, fill: CK.green, opacity: 0.5 }) + T(dx, 52.5, String(last), { size: 16, weight: 700, font: MONO, fill: ctxHot(n) ? CK.red : CK.green }) + T(dx, 52.5 + 15, String((last + 9) % 10), { size: 16, weight: 700, font: MONO, fill: CK.green, opacity: 0.5 })
    s += `</g>`
    s += `<rect x="10" y="6" width="28" height="12" fill="#000"/>` + T(13, 15, 'CTX', { size: 8, font: MONO, fill: CK.cyan })
    s += `<rect x="10" y="75" width="40" height="12" fill="#000"/>` + T(13, 84, short(n.context.tokens).toUpperCase(), { size: 8, font: MONO, fill: CK.cyan })
    // the limit tapes
    const L = limitsOf(n)
    const tapes = L.slice(0, 2)
    const tw = cl(room - 78 - 110 - 2 * 84, 120, 300)
    tapes.forEach((l, k) => {
      const cy = 27 + k * 38
      const x0 = 96
      s += T(76, cy + 3.5, l.key, { size: 9, font: MONO, fill: CK.cyan })
      s += `<rect x="${x0}" y="${cy - 12}" width="${tw}" height="24" rx="2" fill="${CK.panel}" stroke="${CK.line}"/>`
      for (let t = 0; t <= 100; t += 10) {
        const tx = x0 + (tw * t) / 100
        s += `<line x1="${f(tx)}" y1="${t % 50 ? cy + 7 : cy + 3}" x2="${f(tx)}" y2="${cy + 12}" stroke="#9aa3ad" stroke-width=".9"/>`
      }
      s += `<rect x="${f(x0 + tw * 0.8)}" y="${cy + 10}" width="${f(tw * 0.1)}" height="2" fill="${CK.amber}"/><rect x="${f(x0 + tw * 0.9)}" y="${cy + 10}" width="${f(tw * 0.1)}" height="2" fill="${CK.red}"/>`
      s += `<rect x="${x0}" y="${cy - 3}" width="${f((tw * pct(l.g)) / 100)}" height="6" fill="${ckFill(l.g)}"/>`
      if (l.g.pace !== null) {
        const px = x0 + tw * l.g.pace
        s += `<path d="M${f(px - 5)} ${cy - 11}H${f(px + 5)}V${cy - 7}L${f(px)} ${cy - 3.5}L${f(px - 5)} ${cy - 7}Z" fill="none" stroke="${CK.magenta}" stroke-width="1.5"/>`
      }
      s += `<rect x="${x0 + tw + 6}" y="${cy - 11}" width="44" height="22" fill="#000" stroke="${CK.white}"/>` + T(x0 + tw + 28, cy + 5, `${Math.round(l.g.percent)}`, { size: 14, weight: 700, anchor: 'middle', font: MONO, fill: ckFill(l.g) })
      s += T(x0 + tw + 56, cy + 4, (l.g.left ?? '').replace(/ /g, '').toUpperCase(), { size: 9, font: MONO, fill: CK.white })
    })
    s += ckData(96 + tw + 118, room, n)
    const art = leftEnd(artW(i), CK.ground, s, { edge: CK.edge })
    // the plate: the model limit, and the caution light
    const inner = body + RAIL
    const fab = L[2]
    let p = ''
    if (fab) {
      const w = i.wide ? 70 : 44
      p += T(8, 22, fab.key, { size: 8, font: MONO, fill: CK.cyan }) + `<rect x="8" y="28" width="${w}" height="14" rx="2" fill="${CK.panel}" stroke="${CK.line}"/><rect x="8" y="32" width="${f((w * pct(fab.g)) / 100)}" height="6" fill="${ckFill(fab.g)}"/>`
      p += `<path d="M${f(8 + w * fab.g.pace! - 4)} 24h8v4l-4 3l-4-3z" fill="none" stroke="${CK.magenta}" stroke-width="1.3"/>`
      p += `<rect x="${w + 13}" y="26" width="34" height="18" fill="#000" stroke="${CK.white}"/>` + T(w + 30, 39, String(Math.round(fab.g.percent)), { size: 12, weight: 700, anchor: 'middle', font: MONO, fill: ckFill(fab.g) })
    }
    const caution = ckCaution(n)
    if (caution) p += `<rect x="8" y="58" width="${i.wide ? 70 : 52}" height="20" rx="2" fill="${caution.color}"/>` + T(8 + (i.wide ? 35 : 26), 72, caution.word, { size: 10, weight: 800, anchor: 'middle', font: MONO, fill: '#000' })
    else p += T(8, 72, `RST ${(fab?.g.left ?? '').replace(/ /g, '').toUpperCase()}`, { size: 9.5, font: MONO, fill: CK.white, opacity: 0.8 })
    return { art: { source: art, width: artW(i) }, plate: rightEnd(inner, body, CK.ground, p, { edge: CK.edge, rule: CK.rule }) }
  },
}

/** An EICAS dial: a white arc, the used part filled grey, a needle, a boxed value, a magenta pace bug. */
const eicas = (cx: number, cy: number, r: number, v: number, pace: number | null, label: string, color: string, box = true) => {
  const a0 = -130
  const a1 = 90
  const A = (t: number) => a0 + ((a1 - a0) * t) / 100
  const [sx, sy] = P(cx, cy, r, a0)
  let s = `<path d="M${cx} ${cy}L${f(sx)} ${f(sy)}${arc(cx, cy, r, a0, A(v)).replace(/^M[^A]+/, '')}Z" fill="#6b7680" fill-opacity=".45"/>`
  s += `<path d="${arc(cx, cy, r, a0, A(80))}" fill="none" stroke="${CK.white}" stroke-width="1.6"/>`
  s += `<path d="${arc(cx, cy, r, A(80), A(100))}" fill="none" stroke="${CK.amber}" stroke-width="1.6"/>`
  const [ra, rb] = P(cx, cy, r - 3, A(100))
  const [rc, rd] = P(cx, cy, r + 4, A(100))
  s += `<line x1="${f(ra)}" y1="${f(rb)}" x2="${f(rc)}" y2="${f(rd)}" stroke="${CK.red}" stroke-width="2.2"/>`
  if (pace !== null) {
    const [pa, pb] = P(cx, cy, r + 2, A(pace * 100))
    const [pc, pd] = P(cx, cy, r + 8, A(pace * 100))
    s += `<line x1="${f(pa)}" y1="${f(pb)}" x2="${f(pc)}" y2="${f(pd)}" stroke="${CK.magenta}" stroke-width="3" stroke-linecap="round"/>`
  }
  const [nx, ny] = P(cx, cy, r - 1, A(v))
  s += `<line x1="${cx}" y1="${cy}" x2="${f(nx)}" y2="${f(ny)}" stroke="${CK.white}" stroke-width="1.8"/>`
  if (box) s += `<rect x="${cx + r - 3}" y="${cy - r - 6}" width="34" height="16" fill="#000" stroke="${CK.white}" stroke-width=".9"/>` + T(cx + r + 28, cy - r + 6, String(Math.round(v)), { size: 12, weight: 700, anchor: 'end', font: MONO, fill: color })
  s += T(cx, cy + r + 10, label, { size: 8, anchor: 'middle', font: MONO, fill: CK.cyan })
  return s
}
const cockpitDials: Option = {
  mode: 'cockpit',
  id: 'cockpit-dials',
  name: 'Engine dials',
  glyph: '△',
  tab: cockpitTapes.tab,
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const n = i.n
    const L = limitsOf(n)
    let s = ''
    const dials: Array<[number, number | null, string, string]> = [[ctx(i), null, 'CTX', ctxHot(n) ? CK.red : CK.green], ...L.slice(0, 2).map(l => [pct(l.g), l.g.pace, l.key, ckFill(l.g)] as [number, number | null, string, string])]
    let x = 36
    dials.forEach(d => {
      s += eicas(x, 50, 24, d[0], d[1], d[2], d[3])
      x += 96
    })
    s += ckData(x - 26, room, n)
    const art = leftEnd(artW(i), CK.ground, s, { edge: CK.edge })
    const inner = body + RAIL
    const fab = L[2]
    let p = ''
    if (fab) p += eicas(28, 42, 17, pct(fab.g), fab.g.pace, fab.key, ckFill(fab.g), false) + `<rect x="54" y="20" width="34" height="16" fill="#000" stroke="${CK.white}" stroke-width=".9"/>` + T(85, 32, String(Math.round(fab.g.percent)), { size: 12, weight: 700, anchor: 'end', font: MONO, fill: ckFill(fab.g) })
    const caution = ckCaution(n)
    if (caution) p += `<rect x="54" y="52" width="${i.wide ? 64 : 44}" height="18" rx="2" fill="${caution.color}"/>` + T(54 + (i.wide ? 32 : 22), 65, caution.word, { size: 9.5, weight: 800, anchor: 'middle', font: MONO, fill: '#000' })
    if (i.wide && !caution) L.forEach((l, k) => (p += T(body - 6, 56 + k * 12, `${l.key} ${(l.g.left ?? '').replace(/ /g, '').toUpperCase()}`, { size: 9, anchor: 'end', font: MONO, fill: CK.white, opacity: 0.8 })))
    return { art: { source: art, width: artW(i) }, plate: rightEnd(inner, body, CK.ground, p, { edge: CK.edge, rule: CK.rule }) }
  },
}

// ============ LCD ============

// A 5 x 7 character LCD font.
const FONT5: Record<string, string> = {
  '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100', '%': '11000110010001000100010001001100011', '$': '00100011111010001110001011111000100',
  '.': '00000000000000000000000000110001100', ':': '00000011000110000000011000110000000', '/': '00000000010001000100010001000000000',
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11100100101000110001100011001011100', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110', K: '10001100101010011000101001001010001',
  L: '10000100001000010000100001000011111', M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001',
  O: '01110100011000110001100011000101110', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110',
  T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110', W: '10001100011000110101101011010101010',
  X: '10001100010101000100010101000110001', ' ': '00000000000000000000000000000000000', '-': '00000000000000011111000000000000000',
}
type Px = { lit: string[]; ghost: string[] }
const dot = (x: number, y: number, d: number) => `M${f(x)} ${f(y)}h${f(d)}v${f(d)}h-${f(d)}z`
/** Text in 5 x 7 cells: every dot of every cell drawn, the unlit ones as ghosts. */
const lcdText = (px: Px, x: number, y: number, s: string, pitch: number) => {
  const d = pitch * 0.84
  ;[...s.toUpperCase()].forEach((ch, k) => {
    const bits = FONT5[ch] ?? FONT5[' ']!
    for (let b = 0; b < 35; b++) (bits[b] === '1' ? px.lit : px.ghost).push(dot(x + k * 6 * pitch + (b % 5) * pitch, y + Math.floor(b / 5) * pitch, d))
  })
  return x + s.length * 6 * pitch
}
/** A bar as a dot grid two dots high, filled to `v`, its head one dot taller: the stepped edge. */
const lcdBar = (px: Px, x: number, y: number, cols: number, v: number, pitch: number, skip: [number, number] = [0, 0]) => {
  const d = pitch * 0.84
  const lit = Math.round((cols * v) / 100)
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < 3; r++) {
      const on = c < lit && (r > 0 || c === lit - 1)
      if (c >= skip[0] && c < skip[1]) continue
      ;(on ? px.lit : px.ghost).push(dot(x + c * pitch, y + r * pitch, d))
    }
  return lit
}
const pxPaths = (px: Px, ink: string, ghost: string) => `<path d="${px.ghost.join('')}" fill="${ghost}"/><path d="${px.lit.join('')}" fill="${ink}"/>`
const LCD_GREEN = { bg0: '#c3da55', bg1: '#a6c13a', ink: '#1b2507', ghost: 'rgba(27,37,7,.075)' }
const LCD_AMBER = { bg0: '#f3c14a', bg1: '#dc9c2c', ink: '#2a1504', ghost: 'rgba(42,21,4,.08)' }
const LCD_PALE = { bg0: '#eef2f4', bg1: '#d7dee3', ink: '#0b0b0b', ghost: 'rgba(11,11,11,.06)' }
const lcdBack = (c: typeof LCD_GREEN, id: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg0}"/><stop offset="1" stop-color="${c.bg1}"/></linearGradient>`
/** The screen's content: the big context, then the limits as dot-grid bars with the percent riding the fill. */
const lcdScreen = (px: Px, n: Numbers, x0: number, room: number, wide: boolean, cols0: number, oy = 0) => {
  lcdText(px, x0, 10 + oy, 'CTX', 1.6)
  lcdText(px, x0, 27 + oy, `${Math.round(n.context.percent)}%`, 3.6)
  lcdText(px, x0, 63 + oy, `${short(n.context.tokens)}/${short(n.context.window)}`.toUpperCase(), 1.6)
  const bx = x0 + 96
  const L = limitsOf(n)
  const cols = cl(Math.floor((room - bx - 32 - (wide ? 60 : 8)) / 3.2), 20, cols0)
  L.forEach((l, k) => {
    const y = 10 + k * 24 + oy
    lcdText(px, bx, y + 1, l.key, 1.6)
    // the percent rides just past the fill's head, in a gap cut out of the unlit cells
    const label = `${Math.round(l.g.percent)}%`
    const lw = label.length * 6 * 1.3
    const head = Math.round((cols * pct(l.g)) / 100)
    const at = Math.min(head + 1, cols - Math.ceil(lw / 3.2) - 1)
    lcdBar(px, bx + 32, y + 1, cols, pct(l.g), 3.2, [at, at + Math.ceil((lw + 3) / 3.2)])
    lcdText(px, bx + 32 + at * 3.2 + 2, y + 0.4, label, 1.3)
    if (l.g.pace !== null) {
      const pc = bx + 32 + Math.floor(cols * l.g.pace) * 3.2
      px.lit.push(dot(pc, y + 12.4, 2.7), dot(pc - 3.2, y + 15.6, 2.7), dot(pc + 3.2, y + 15.6, 2.7))
    }
    if (wide && l.g.left) lcdText(px, bx + 40 + cols * 3.2, y + 1, l.g.left.replace(/ /g, ''), 1.6)
  })
  return bx + 40 + cols * 3.2 + (wide ? 60 : 0)
}
const lcdFull: Option = {
  mode: 'lcd',
  id: 'lcd-screen',
  name: 'Whole screen',
  glyph: '▤',
  tab: { ink: 0.2, fill: ['#1d1e1b', '#0f100e'], line: '#fff' },
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const c = limitsOf(i.n).some(l => hot(l.g)) || ctxHot(i.n) ? LCD_AMBER : LCD_GREEN
    const px: Px = { lit: [], ghost: [] }
    const end = lcdScreen(px, i.n, 14, room, i.wide, 140, 3)
    const W = artW(i)
    const s = `<rect x="3" y="3" width="${W}" height="${H - 6}" rx="9" fill="url(#lb)"/><rect x="3" y="3" width="${W}" height="${H - 6}" rx="9" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>` + pxPaths(px, c.ink, c.ghost) + `<rect x="3" y="3" width="${W}" height="30" rx="9" fill="#fff" opacity=".06"/>`
    void end
    const art = leftEnd(W, '#0f100e', s, { defs: lcdBack(c, 'lb'), edge: 'rgba(255,255,255,.16)' })
    // the plate: the screen runs on, the session's numbers on it; the rail stands on the black bezel
    const inner = body + RAIL
    const pp: Px = { lit: [], ghost: [] }
    stations(i.n)
      .slice(0, 3)
      .forEach(([k, v], r) => {
        const y = 13 + r * 25
        if (i.wide) {
          lcdText(pp, 8, y, k.slice(0, 4), 1.6)
          lcdText(pp, 58, y, v, 1.6)
        } else lcdText(pp, 6, y, `${k.slice(0, 4)} ${v}`, 1.3)
      })
    const p = `<rect x="-20" y="3" width="${body + 16}" height="${H - 6}" rx="9" fill="url(#lb)"/><rect x="-20" y="3" width="${body + 16}" height="${H - 6}" rx="9" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>` + pxPaths(pp, c.ink, c.ghost)
    return { art: { source: art, width: W }, plate: rightEnd(inner, body, '#0f100e', p, { defs: lcdBack(c, 'lb'), edge: 'rgba(255,255,255,.16)', rule: 'rgba(0,0,0,0)' }) }
  },
}
const lcdWindow: Option = {
  mode: 'lcd',
  id: 'lcd-window',
  name: 'Screen in a device',
  glyph: '▤',
  tab: { ink: 0.22, fill: ['#24252a', '#16171a'], line: '#fff' },
  draw: i => {
    const body = plateFor(i, 160, 110)
    const room = roomOf(i, body)
    const c = limitsOf(i.n).some(l => hot(l.g)) || ctxHot(i.n) ? LCD_AMBER : LCD_PALE
    const px: Px = { lit: [], ghost: [] }
    const ww = Math.min(420, room - 10)
    const end = lcdScreen(px, i.n, 18, 10 + ww, false, 60, 3)
    void end
    const W = artW(i)
    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#gl)"/>`
    s += `<rect x="8" y="8" width="${ww}" height="77" rx="5" fill="#050506"/><rect x="11" y="11" width="${ww - 6}" height="71" rx="3" fill="url(#lb)"/>` + pxPaths(px, c.ink, c.ghost) + `<rect x="11" y="11" width="${ww - 6}" height="71" rx="3" fill="none" stroke="#000" stroke-opacity=".3"/><rect x="11" y="11" width="${ww - 6}" height="22" rx="3" fill="#fff" opacity=".18"/>`
    s += stationRow(8 + ww + 22, room, i.n, { label: '#8e96a0', value: '#f2f2f2', pitch: 84, y: 58, size: 19 })
    const defs = lcdBack(c, 'lb') + `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2024"/><stop offset="1" stop-color="#0e0f11"/></linearGradient>`
    const art = leftEnd(W, '#16171a', s, { defs, edge: 'rgba(255,255,255,.2)' })
    const inner = body + RAIL
    const p =
      `<rect width="${inner}" height="${H}" fill="url(#gl)"/>` +
      limitsOf(i.n)
        .map((l, k) => T(10, 27 + k * 22, l.key, { size: 8, weight: 700, spacing: 0.8, fill: '#8e96a0' }) + T(i.wide ? 72 : body - 8, 27 + k * 22, `${Math.round(l.g.percent)}%`, { size: 12, anchor: 'end', fill: hot(l.g) ? '#ff8a3a' : '#f2f2f2' }) + (i.wide ? T(body - 8, 27 + k * 22, (l.g.left ?? '').replace(/ /g, ''), { size: 10, anchor: 'end', fill: '#f2f2f2', opacity: 0.7 }) : ''))
        .join('')
    return { art: { source: art, width: W }, plate: rightEnd(inner, body, '#16171a', p, { defs, edge: 'rgba(255,255,255,.2)', rule: 'rgba(255,255,255,.08)' }) }
  },
}

// ============ PANEL ============

type Metal = { m0: string; m1: string; ink: string; sub: string; screw: string; edge: string; dark: boolean }
const ALU: Metal = { m0: '#e6e6e1', m1: '#cfcfc9', ink: '#1d1d1b', sub: '#4f4f49', screw: '#b4b4ae', edge: 'rgba(0,0,0,.22)', dark: false }
const GREY: Metal = { m0: '#36373a', m1: '#26272a', ink: '#ededea', sub: '#a4a5a9', screw: '#4a4b4f', edge: 'rgba(255,255,255,.2)', dark: true }
const KNOB = { ctx: '#2f6fe4', five: '#22a86a', week: '#f4f4f0', model: '#ff6a1f' }
const metalDefs = (m: Metal) =>
  `<linearGradient id="al" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.m0}"/><stop offset="1" stop-color="${m.m1}"/></linearGradient>` +
  `<pattern id="br" width="400" height="3" patternUnits="userSpaceOnUse"><rect width="400" height="1" fill="${m.dark ? '#fff' : '#000'}" opacity=".025"/></pattern>` +
  `<filter id="ks" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>`
const screw = (x: number, y: number, m: Metal) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${m.screw}" stroke="${m.dark ? '#1c1d1f' : '#9c9c96'}" stroke-width=".6"/><path d="M${x - 1.6} ${y}h3.2" stroke="${m.dark ? '#1c1d1f' : '#8a8a84'}" stroke-width=".7"/>`
const knob = (cx: number, cy: number, v: number, pace: number | null, color: string, m: Metal, label: string, red: boolean) => {
  const A = (t: number) => -135 + (270 * t) / 100
  const ring = red ? '#ff3b30' : color === KNOB.week ? (m.dark ? '#f4f4f0' : '#1d1d1b') : color
  let s = ''
  for (let k = 0; k <= 10; k++) {
    const [a, b] = P(cx, cy, 25, A(k * 10))
    const [c, d] = P(cx, cy, 27.5, A(k * 10))
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${m.sub}" stroke-width=".9"/>`
  }
  s += `<path d="${arc(cx, cy, 21.5, A(0), A(100))}" fill="none" stroke="${m.dark ? '#1b1c1e' : '#bdbdb7'}" stroke-width="3" stroke-linecap="round"/>`
  s += `<path d="${arc(cx, cy, 21.5, A(0), A(Math.max(0.5, v)))}" fill="none" stroke="${ring}" stroke-width="3" stroke-linecap="round"/>`
  if (pace !== null) {
    const [a, b] = P(cx, cy, 21.5, A(pace * 100))
    s += `<circle cx="${f(a)}" cy="${f(b)}" r="2.2" fill="${m.dark ? '#fff' : '#1d1d1b'}" stroke="${m.m0}" stroke-width=".8"/>`
  }
  s += `<circle cx="${cx + 1}" cy="${cy + 2}" r="14.5" fill="#000" opacity=".3" filter="url(#ks)"/><circle cx="${cx}" cy="${cy}" r="14.5" fill="${color}"${color === KNOB.week ? ` stroke="${m.dark ? '#000' : '#b0b0aa'}" stroke-width=".8"` : ''}/><circle cx="${cx - 1.5}" cy="${cy - 2.5}" r="11" fill="#fff" opacity=".14"/>`
  const [a, b] = P(cx, cy, 5, A(v))
  const [c, d] = P(cx, cy, 12, A(v))
  s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${color === KNOB.week ? '#1d1d1b' : '#fff'}" stroke-width="2.4" stroke-linecap="round"/>`
  s += `<text x="${cx}" y="82" text-anchor="middle" font-family='${SANS}' font-size="8.5" letter-spacing=".6" fill="${m.sub}">${esc(label)} <tspan font-weight="700" fill="${red ? '#e0342a' : m.ink}">${Math.round(v)}</tspan></text>`
  return s
}
/** The rail's keys: dark caps under the app's own grey glyphs, lit at the rim. */
const keys = (x: number, n: Numbers, m: Metal) => {
  const sport = limitsOf(n).some(l => hot(l.g)) || ctxHot(n)
  const rims = ['#ff6a1f', sport ? '#ff3b30' : '#2f6fe4', m.dark ? '#8a8b8f' : '#8a8a84']
  return [18.5, 38, 57.5]
    .map((y, k) => `<rect x="${x + 3}" y="${y + 1.4}" width="26" height="17" rx="5" fill="#000" opacity=".25"/><rect x="${x + 3}" y="${y}" width="26" height="17" rx="5" fill="#1e1e1d" stroke="${rims[k]}" stroke-width="1.3"/><rect x="${x + 5}" y="${y + 1.5}" width="22" height="5" rx="3" fill="#fff" opacity=".06"/>`)
    .join('')
}
const panelPlate = (i: In, m: Metal, body: number) => {
  const inner = body + RAIL
  const L = limitsOf(i.n)
  const cols = [KNOB.five, KNOB.week, KNOB.model]
  let p = `<rect width="${inner}" height="${H}" fill="url(#al)"/><rect width="${inner}" height="${H}" fill="url(#br)"/>`
  if (i.wide)
    p += L.map((l, k) => `<rect x="10" y="${21 + k * 22}" width="7" height="7" rx="1.5" fill="${cols[k]}" stroke="${m.dark ? '#000' : '#6a6a64'}" stroke-width=".8"/>` + T(22, 28 + k * 22, l.key, { size: 8, weight: 600, spacing: 0.6, fill: m.sub }) + T(body - 8, 28 + k * 22, (l.g.left ?? '').replace(/ /g, ''), { size: 10.5, anchor: 'end', font: MONO, fill: m.ink })).join('')
  else
    stations(i.n)
      .slice(0, 3)
      .forEach(([k, v], r) => (p += T(10, 28 + r * 22, k, { size: 7.5, weight: 600, spacing: 0.6, fill: m.sub }) + T(body - 8, 28 + r * 22, v, { size: 10.5, anchor: 'end', font: MONO, fill: m.ink })))
  p += keys(body, i.n, m) + screw(body - 6, 8, m) + screw(body - 6, H - 8, m)
  return rightEnd(inner, body, m.m0, p, { defs: metalDefs(m), edge: m.edge, rule: 'rgba(0,0,0,0)' })
}
const panelKnobs = (m: Metal, id: string, name: string, tab: TabStyle): Option => ({
  mode: 'panel',
  id,
  name,
  glyph: '◎',
  tab,
  draw: i => {
    const body = plateFor(i, 150, 100)
    const room = roomOf(i, body)
    const n = i.n
    const L = limitsOf(n)
    let s = `<rect x="-9" width="${artW(i)}" height="${H}" fill="url(#al)"/><rect x="-9" width="${artW(i)}" height="${H}" fill="url(#br)"/>` + screw(9, 9, m) + screw(9, H - 9, m)
    const ks: Array<[number, number | null, string, string, boolean]> = [[ctx(i), null, KNOB.ctx, 'CTX', ctxHot(n)], ...L.map((l, k) => [pct(l.g), l.g.pace, [KNOB.five, KNOB.week, KNOB.model][k]!, l.key, hot(l.g)] as [number, number | null, string, string, boolean])]
    ks.forEach((k, j) => (s += knob(42 + j * 58, 40, k[0], k[1], k[2], m, k[3], k[4])))
    // the OLED
    const ox = 42 + ks.length * 58 - 12
    const ow = room - ox >= 120 ? Math.min(430, room - ox) : 0
    if (ow) {
      s += `<rect x="${ox}" y="9" width="${ow}" height="75" rx="7" fill="#0b0b0c" stroke="${m.dark ? '#000' : '#a9a9a3'}"/>`
      s += `<text x="${ox + 12}" y="52" font-family='${HN}' fill="#f2f2ee"><tspan font-size="36" font-weight="200">${Math.round(ctx(i))}</tspan><tspan font-size="13" dx="2" fill="#8a8a85">%</tspan></text>`
      s += T(ox + 13, 72, `${short(n.context.tokens)} / ${short(n.context.window)}`, { size: 9, font: MONO, fill: '#7d7d78' })
      if (ow >= 200) {
        const st = stations(n).slice(0, ow >= 380 ? 5 : 4)
        const cs = [KNOB.ctx, KNOB.five, KNOB.week, KNOB.model, '#9a9a95']
        const colW = ow >= 380 ? (ow - 148) / 2 : ow - 130
        st.forEach(([k, v], r) => {
          const c = ow >= 380 ? Math.floor(r / 3) : 0
          const y = 26 + (ow >= 380 ? r % 3 : r) * (ow >= 380 ? 20 : 15.5)
          const cx = ox + 118 + c * (colW + 18)
          s += `<rect x="${cx}" y="${y - 6}" width="5" height="5" fill="${cs[r]}"/>` + T(cx + 10, y, k, { size: 8, font: MONO, fill: '#8a8a85' }) + T(cx + colW, y, v, { size: 10.5, anchor: 'end', font: MONO, fill: '#f2f2ee' })
        })
      }
    }
    const art = leftEnd(artW(i), m.m0, s, { defs: metalDefs(m), edge: m.edge })
    return { art: { source: art, width: artW(i) }, plate: panelPlate(i, m, body) }
  },
})
const PANEL_TAB: TabStyle = { ink: 0.2, fill: ['#2a2a28', '#1c1c1b'], line: '#000' }
const panelLight = panelKnobs(ALU, 'panel-knobs', 'Knobs and screen', PANEL_TAB)
const panelDark = panelKnobs(GREY, 'panel-grey', 'Space grey', { ink: 0.2, fill: ['#3d3e41', '#36373a'], line: '#fff' })
const panelOled: Option = {
  mode: 'panel',
  id: 'panel-oled',
  name: 'Wide screen',
  glyph: '◎',
  tab: PANEL_TAB,
  draw: i => {
    const m = ALU
    const body = plateFor(i, 150, 100)
    const room = roomOf(i, body)
    const n = i.n
    const L = limitsOf(n)
    const W = artW(i)
    const ow = Math.max(160, room - 26)
    let s = `<rect x="-9" width="${W}" height="${H}" fill="url(#al)"/><rect x="-9" width="${W}" height="${H}" fill="url(#br)"/>` + screw(9, 9, m) + screw(9, H - 9, m)
    s += `<rect x="20" y="8" width="${ow}" height="77" rx="8" fill="#0b0b0c" stroke="#a9a9a3"/>`
    s += `<text x="32" y="50" font-family='${HN}' fill="#f2f2ee"><tspan font-size="36" font-weight="200">${Math.round(ctx(i))}</tspan><tspan font-size="13" dx="2" fill="#8a8a85">%</tspan></text>`
    s += T(33, 70, `${short(n.context.tokens)} / ${short(n.context.window)}`, { size: 9, font: MONO, fill: '#7d7d78' })
    // four bars in the knob colours, each an inset groove with its pace dot
    const rows: Array<[string, number, number | null, string, boolean]> = [['CTX', ctx(i), null, KNOB.ctx, ctxHot(n)], ...L.map((l, k) => [l.key, pct(l.g), l.g.pace, [KNOB.five, KNOB.week, KNOB.model][k]!, hot(l.g)] as [string, number, number | null, string, boolean])]
    const bx = 130
    const st = stations(n)
    const numbersW = ow >= 560 ? 170 : 0
    const bw = Math.max(80, ow - (bx - 20) - 58 - numbersW)
    rows.forEach(([k, v, pace, col, red], r) => {
      const y = 22 + r * 16
      s += T(bx, y + 3.5, k, { size: 7.5, font: MONO, fill: '#8a8a85' })
      s += `<rect x="${bx + 28}" y="${y - 3}" width="${bw}" height="6" rx="3" fill="#1d1d1d"/><rect x="${bx + 28}" y="${y - 3}" width="${f(Math.max(6, (bw * v) / 100))}" height="6" rx="3" fill="${red ? '#ff3b30' : col}"/>`
      if (pace !== null) s += `<circle cx="${f(bx + 28 + bw * pace)}" cy="${y}" r="2" fill="#fff" stroke="#0b0b0c" stroke-width="1"/>`
      s += T(bx + 34 + bw, y + 3.5, `${Math.round(v)}%`, { size: 9.5, font: MONO, fill: red ? '#ff6a5a' : '#f2f2ee' })
    })
    if (numbersW) st.slice(0, 4).forEach(([k, v], r) => (s += T(20 + ow - numbersW + 10, 25 + r * 16, k, { size: 8, font: MONO, fill: '#8a8a85' }) + T(20 + ow - 12, 25 + r * 16, v, { size: 10.5, anchor: 'end', font: MONO, fill: '#f2f2ee' })))
    const art = leftEnd(W, m.m0, s, { defs: metalDefs(m), edge: m.edge })
    return { art: { source: art, width: W }, plate: panelPlate(i, m, body) }
  },
}

const OPTIONS: Option[] = [vuTwin, vuNight, vuBridge, nixieTubes, nixieClock, cockpitTapes, cockpitDials, lcdFull, lcdWindow, panelLight, panelOled, panelDark]

// ---------- laying a card out, as the band does (docs/pictures.ts) ----------

const PROJECT: UsageBarProject = { name: 'claude-usage-bar', owner: 'behkha', branch: 'main', revision: null, worktree: null, repo: true }
const NOTICE: UsageBarNotice = { version: '0.2.0', phase: 'available', since: 0 }
const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const railButtons = (glyph: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${RAIL}" height="${H}" viewBox="0 0 ${RAIL} ${H}" font-family="-apple-system,system-ui,sans-serif" fill="${ink}">` +
  `<text x="16" y="31" font-size="12" text-anchor="middle">3▸</text><text x="16" y="51" font-size="13" text-anchor="middle">${esc(glyph)}</text><text x="16" y="71" font-size="13" text-anchor="middle">♪</text></svg>`

type Placed = { o: Option; session: Session; width: number; tabs: boolean; page: string }
const cardHtml = (p: Placed) => {
  const i: In = { n: SESSIONS[p.session], narrow: p.width, wide: p.width >= 768 }
  const drawn = p.o.draw(i)
  const up = p.tabs ? LIFT : 0
  const repaint = (svg: string) => (p.page === '#0a0a0a' ? svg : svg.replaceAll('fill="#0a0a0a"', `fill="${p.page}"`))
  const art = up ? repaint(tabbedArt(drawn.art, ART_HEIGHT, PROJECT, { elapsed: ARRIVAL_MS, now: 0, busy: false }, p.o.tab, projectRoom(NOTICE, p.width))) : drawn.art.source
  const plate = up ? repaint(lift(drawn.plate.source, drawn.plate.width, drawn.plate.height, true)) : drawn.plate.source
  const img = (src: string, w: number, h: number, style: string) => `<img alt="" src="${uri(src)}" width="${w}" height="${h}" style="${style}">`
  const update = p.tabs ? updateTab(NOTICE, p.o.tab, ARRIVAL_MS, true) : null
  return (
    `<div class="card" style="width:${p.width}px;height:${H + up}px">` +
    `<div style="position:absolute;top:${-EDGE_TOP}px;left:${-EDGE_SIDE}px;right:${RAIL * 2}px;height:${H + 2 * EDGE_TOP + up}px;overflow:hidden">${img(art, drawn.art.width, H + 2 * EDGE_TOP + 1 + up, 'max-width:none')}</div>` +
    img(plate, drawn.plate.width, drawn.plate.height + up, `position:absolute;top:${-EDGE_TOP}px;right:${-EDGE_SIDE}px;max-width:none`) +
    img(railButtons(p.o.glyph, '#9a9a9a'), RAIL, H, `position:absolute;top:${up}px;right:0;max-width:none`) +
    (update ? img(update.source, update.width, update.height, `position:absolute;top:0;right:${update.right - EDGE_SIDE}px;max-width:none`) : '') +
    '</div>'
  )
}
const shot = (p: Placed, cap: string) => `<figure class="shot"><div class="stage" style="background:${p.page}">${cardHtml(p)}</div><figcaption>${cap}</figcaption></figure>`

// ---------- the page ----------

type Copy = { pros: string[]; cons: string[]; narrow: string; states: string }
const COPY: Record<string, Copy> = {
  'vu-twin': {
    pros: ['The sketch the owner picked, made real: two backlit faces you read from across the room.', 'Peak lamp and red zone say "near the limit" without words.'],
    cons: ['Two meters take 300 px before any number shows.', 'Week and Fable only as small edgewise meters on the plate.'],
    narrow: 'The numbers go first, then the 5-hour meter moves onto the plate as a third edgewise row. The context meter stays.',
    states: 'Sport lights the peak lamps and turns the percent red. Eco and Normal look alike: needles low, lamps dark.',
  },
  'vu-night': {
    pros: ['Closest to the pin: cyan print on black, a warm bezel glow, a thin copper needle.', 'Three scales in one window: context, 5-hour and week, each a row of lit segments with its last fifth in green.'],
    cons: ['Segments read less precisely than a needle; the figures carry the detail.', 'Cooler colours than the amber sketch.'],
    narrow: 'The numbers go first. The dial keeps its 236 px; the plate keeps Fable.',
    states: 'Sport fills the green end segments on every scale. Eco leaves most segments as ghosts.',
  },
  'vu-bridge': {
    pros: ['Every limit gets a real needle: context, 5-hour, week and Fable side by side, like a tape machine\'s meter bridge.'],
    cons: ['Four faces at 100 px are busy and the scale numbers get small.', 'Numbers move to the plate or drop.'],
    narrow: 'Meters leave from the right (Fable, then week) and reappear on the plate as edgewise rows.',
    states: 'Sport: two peak lamps lit, percents red.',
  },
  'nixie-tubes': {
    pros: ['Context in two big wire-digit tubes with every other cathode visible behind.', 'Limits on IN-13 bar tubes: a glowing column, a cold mark at pace.', 'Session numbers stay readable as glowing text.'],
    cons: ['Only context is in tubes; the rest is styled text.'],
    narrow: 'The numbers go first, from the right. Tubes and the bar plate stay.',
    states: 'Sport: the context tubes and over-pace bars turn red and the neon lamp by the % lights.',
  },
  'nixie-clock': {
    pros: ['All in tubes, like a nixie clock: context, cost with its decimal dot, time with neon colon lamps, turns.', 'Each limit is a pair of small tubes with a neon lamp that lights when it runs ahead.'],
    cons: ['No bars, so pace is only the lamp.', 'Tokens, cache and written are left out.'],
    narrow: 'Groups leave from the right: turns, then time, then cost. Context stays.',
    states: 'Sport: tubes over pace glow red and their lamps light.',
  },
  'cockpit-tapes': {
    pros: ['The PFD language: a rolling context tape with a boxed value and a drum for the last digit.', 'Limit tapes with a green fill, amber and red range stripe, magenta pace bug.', 'A master caution box on the plate.'],
    cons: ['Dense. Many small parts at 93 px.'],
    narrow: 'The data block goes first, then the limit tapes shorten to 120 px. The context tape stays.',
    states: 'Sport: fills turn amber or red and the plate shows LIMIT (or CTX in red at 90%).',
  },
  'cockpit-dials': {
    pros: ['EICAS engine dials: three round gauges with filled arcs and boxed values.', 'Reads at a glance, like the engine page.'],
    cons: ['Dials are small (25 px radius).', 'Less like the Aspen pin, more like an airliner.'],
    narrow: 'The data block goes first; the three dials stay.',
    states: 'Sport: values amber or red, caution box on the plate.',
  },
  'lcd-screen': {
    pros: ['The whole card is a backlit character LCD; every cell shows its unlit dots.', 'Bars are dot grids with a stepped head and the percent riding on it, as in the charger pin.', 'The backlight turns amber in Sport: the strongest state change of the five.'],
    cons: ['The only bright card in the set besides Panel.', 'The rail needs the black bezel: grey glyphs on lime would not read.'],
    narrow: 'Reset times go first, then the bars shorten to 20 cells. The numbers stay on the plate.',
    states: 'Sport turns the backlight amber. Eco and Normal are green.',
  },
  'lcd-window': {
    pros: ['A pale, cool LCD set into a dark device, like the synth pin.', 'Dark card overall; only the window is bright.', 'Session numbers printed on the device face in white.'],
    cons: ['The screen is smaller; bars have 24 cells.'],
    narrow: 'The printed numbers go first, then the window narrows.',
    states: 'Sport turns the window amber.',
  },
  'panel-knobs': {
    pros: ['The sketch made real: one coloured knob per meter, a black OLED, keys lit at the rim.', 'The only light card in the set.'],
    cons: ['Tabs stay dark: the app writes the update label and rail glyphs in its own colours, which are light in the dark theme.', 'Bright against the black app.'],
    narrow: 'The OLED shrinks to the context figure, then goes. Knobs stay; cost, time and turns move onto the plate.',
    states: 'Sport turns over-pace knob rings and the mode key\'s rim red.',
  },
  'panel-oled': {
    pros: ['Aluminium frame round a wide OLED with OP-1 style colour bars.', 'More numbers fit; bars are inset grooves with pace dots.'],
    cons: ['Fewer physical knobs, so less of the TE feel.'],
    narrow: 'The OLED\'s number column goes first, then the bars shorten.',
    states: 'Sport turns over-pace bars red.',
  },
  'panel-grey': {
    pros: ['Same layout as Knobs and screen in space grey: fits the black app, tabs blend in.'],
    cons: ['Loses what makes Panel different from the other nine: being light.'],
    narrow: 'As Knobs and screen.',
    states: 'As Knobs and screen.',
  },
}
const MODES: Array<{ id: string; name: string; pins: Array<[string, string]>; rec: string }> = [
  { id: 'vu', name: 'VU', pins: [['835488168341613347', 'CB meter'], ['565412928223067383', 'Tuner dial']], rec: 'vu-twin' },
  { id: 'nixie', name: 'Nixie', pins: [['291819250830101365', 'Nixie digits']], rec: 'nixie-tubes' },
  { id: 'cockpit', name: 'Cockpit', pins: [['4590927354582834304', 'Aspen PFD'], ['854346991807030380', 'PFD concept']], rec: 'cockpit-tapes' },
  { id: 'lcd', name: 'LCD', pins: [['489273947040237938', 'Charger'], ['547961479674582076', 'Synth LCD']], rec: 'lcd-screen' },
  { id: 'panel', name: 'Panel', pins: [['560557484849837508', 'Synth UI'], ['658792251747993725', 'Control kit']], rec: 'panel-knobs' },
]
const LIGHT_PAGE = '#f4f4f2'
const optionHtml = (o: Option, rec: boolean) => {
  const c = COPY[o.id]!
  const page = '#0a0a0a'
  const light = o.mode === 'panel' && o.id !== 'panel-grey'
  return (
    `<article class="opt${rec ? ' rec' : ''}" id="${o.id}"><header><h3>${o.name}</h3>${rec ? '<span class="pill">Recommended</span>' : ''}</header>` +
    `<div class="notes"><ul class="pro">${c.pros.map(p => `<li>${esc(p)}</li>`).join('')}</ul><ul class="con">${c.cons.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` +
    `<div class="frame">${shot({ o, session: 'normal', width: 930, tabs: true, page }, 'Full card, 930 px, with the project tab and the update tab')}` +
    (light ? shot({ o, session: 'normal', width: 930, tabs: true, page: LIGHT_PAGE }, 'On the app\'s light theme') : '') +
    `<div class="row">${shot({ o, session: 'normal', width: 520, tabs: true, page }, 'Narrow pane, 520 px')}<p class="give">${esc(c.narrow)}</p></div>` +
    `<div class="states">${(['eco', 'normal', 'sport'] as Session[]).map(s => shot({ o, session: s, width: 620, tabs: false, page }, s[0]!.toUpperCase() + s.slice(1))).join('')}</div><p class="give">${esc(c.states)}</p></div></article>`
  )
}
const modeHtml = (m: (typeof MODES)[number]) => {
  const opts = OPTIONS.filter(o => o.mode === m.id).sort((a, b) => (a.id === m.rec ? -1 : b.id === m.rec ? 1 : 0))
  return (
    `<section class="mode" id="m-${m.id}"><header class="mh"><h2>${m.name}</h2><nav class="pins">${m.pins.map(([id, t]) => `<a href="https://www.pinterest.com/pin/${id}/" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</nav></header>` +
    opts.map(o => optionHtml(o, o.id === m.rec)).join('') +
    '</section>'
  )
}

const PICKER = `
<section class="mode" id="m-picker"><header class="mh"><h2>Picking among ten</h2></header>
<p class="lede">Today the mode button steps through five. With ten, a full round is nine presses.</p>
<div class="pick-grid">
<article class="opt rec"><header><h3>Picker on the card</h3><span class="pill">Recommended</span></header>
<div class="picker"><div class="pk-card">${['◐ Glass', '◒ Cluster', '◓ Tuner', '▦ Board', '◑ Classic', '◠ VU', '◍ Nixie', '△ Cockpit', '▤ LCD', '◎ Panel'].map((m, k) => `<span class="${k === 5 ? 'on' : ''}">${m}</span>`).join('')}</div></div>
<ul class="pro"><li>Press the mode button: the card turns into a row of the ten names. Press one to switch; the card comes back.</li><li>Any mode in one press, and the names teach what exists.</li></ul>
<ul class="con"><li>Ten buttons at 8 px per cell need about 700 px; a narrow pane wraps them onto two lines.</li></ul></article>
<article class="opt"><header><h3>Cycle through favourites</h3></header>
<div class="picker"><pre class="term">/usage-bar-modes
  ◐ Glass    ✓     ◠ VU       ✓
  ◒ Cluster  ✓     ◍ Nixie
  ◓ Tuner          △ Cockpit  ✓
  ▦ Board          ▤ LCD
  ◑ Classic  ✓     ◎ Panel</pre></div>
<ul class="pro"><li>The button keeps stepping, through the modes you ticked.</li></ul>
<ul class="con"><li>Ticking happens at the prompt, away from the card.</li></ul></article>
<article class="opt"><header><h3>Step both ways</h3></header>
<div class="picker"><div class="pk-rail"><span>3▸</span><span>‹ ◠ ›</span><span>♪</span></div></div>
<ul class="pro"><li>Back and forward on the rail: at most five presses to any mode.</li></ul>
<ul class="con"><li>The rail is 32 px wide; two arrows beside the glyph are small targets.</li></ul></article>
<article class="opt"><header><h3>Keep one cycle of ten</h3></header>
<ul class="pro"><li>No change.</li></ul><ul class="con"><li>Up to nine presses to reach a mode.</li></ul></article>
</div></section>`

const FINDINGS = `
<section class="mode" id="m-found"><header class="mh"><h2>Found while drawing</h2></header>
<ul class="found">
<li>The rail's three glyphs and the update tab's label are the app's own text, grey and white in the dark theme. A light card needs dark keys under the rail and a dark update tab, or they disappear. Panel and LCD do this.</li>
<li>The room above the card (where the tabs stand) is painted #0a0a0a in tab.ts, whatever the theme. On the light theme every mode shows a black strip there. The light-page pictures above repaint it; the build would take the page colour from the theme.</li>
<li>The project tab's name and branch are drawn white in tab.ts. Every new mode keeps a dark tab, Panel included.</li>
</ul></section>`

const page = `<title>New Card Modes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* One column of sections, one per mode; each option shows its card at the band's real size. A dark page, like the app. */
:root { --bg: #0e0e0f; --panel: #161618; --line: #2a2a2e; --ink: #ecebe6; --mute: #9a9993; --rec: #f2c14e; --pro: #7fc8a9; --con: #e58a7a;
  --f-head: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; --f-body: -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--f-body); }
.wrap { max-width: 1010px; margin: 0 auto; padding-block: 36px 80px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 64px; }
h1, h2, h3 { font-family: var(--f-head); margin: 0; text-wrap: balance; }
h1 { font-size: clamp(28px, 5vw, 40px); letter-spacing: -.02em; }
h2 { font-size: 26px; }
h3 { font-size: 18px; }
.top { display: grid; gap: 12px; }
.top p { margin: 0; color: var(--mute); max-width: 70ch; }
.jump { display: flex; flex-wrap: wrap; gap: 8px; }
.jump a, .pins a { color: var(--ink); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; font-size: 13px; }
.jump a:hover, .pins a:hover, .jump a:focus-visible, .pins a:focus-visible { border-color: var(--ink); outline: none; }
.mode { display: grid; gap: 28px; }
.mh { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 18px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.pins { display: flex; flex-wrap: wrap; gap: 6px; }
.pins a { font-size: 12px; color: var(--mute); }
.opt { display: grid; gap: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px; min-width: 0; }
.opt.rec { border-color: color-mix(in srgb, var(--rec) 55%, var(--line)); }
.opt > header { display: flex; align-items: center; gap: 10px; }
.pill { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #1a1406; background: var(--rec); border-radius: 999px; padding: 3px 9px; }
.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 6px 24px; }
ul.pro, ul.con, ul.found { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
ul.pro li::marker { color: var(--pro); content: "+  "; }
ul.con li::marker { color: var(--con); content: "–  "; }
.frame { display: grid; gap: 14px; overflow-x: auto; min-width: 0; }
.shot { margin: 0; display: grid; gap: 6px; }
.stage { padding: 18px 18px 22px; border-radius: 10px; width: max-content; }
.card { position: relative; overflow: hidden; }
.card img { display: block; }
figcaption { font-size: 12px; color: var(--mute); }
.row { display: flex; flex-wrap: wrap; gap: 14px 20px; align-items: center; }
.give { margin: 0; font-size: 14px; color: var(--mute); max-width: 52ch; }
.states { display: grid; gap: 8px; }
.states .stage { padding: 10px 18px; }
.lede { margin: 0; color: var(--mute); }
.pick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.picker { background: #0a0a0a; border-radius: 10px; padding: 16px; overflow-x: auto; }
.pk-card { display: flex; flex-wrap: wrap; gap: 6px; background: #121212; border: 1px solid #333; border-radius: 12px; padding: 12px; font: 12px -apple-system, system-ui, sans-serif; color: #9a9a9a; }
.pk-card span { padding: 4px 8px; border-radius: 6px; white-space: nowrap; }
.pk-card span.on { color: #fff; background: #2a2a2a; font-weight: 600; }
.pk-rail { display: grid; gap: 10px; justify-items: center; width: 70px; margin: 0 auto; font: 13px -apple-system, system-ui, sans-serif; color: #9a9a9a; background: #121212; border-radius: 10px; padding: 10px 0; }
pre.term { margin: 0; font: 12px/1.6 ui-monospace, Menlo, monospace; color: #d7d6d0; }
ul.found { font-size: 15px; gap: 8px; max-width: 75ch; }
</style>
<div class="wrap">
<header class="top"><h1>New Card Modes</h1>
<p>Five modes, two or three options each, drawn with the mod's own card and tab code at the band's real size. Every card shows the same session: 62% context, 5-hour 34%, week 58%, Fable 41%, $21.37, 61 turns.</p>
<nav class="jump">${MODES.map(m => `<a href="#m-${m.id}">${m.name}</a>`).join('')}<a href="#m-picker">Picking among ten</a><a href="#m-found">Found while drawing</a></nav></header>
${MODES.map(modeHtml).join('')}
${PICKER}
${FINDINGS}
</div>`

const out = join(import.meta.dir, 'page.html')
writeFileSync(out, page)
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB`)

// Check pictures: one page per option, for a look before publishing. `bun mockups.ts check`
if (process.argv[2] === 'check') {
  const { mkdirSync } = await import('node:fs')
  const { spawnSync } = await import('node:child_process')
  const dir = '/private/tmp/claude-501/-Users-behkha-Programming-claude-usage-bar/b7fb8764-654c-4719-a308-2ad8c888fc18/scratchpad/check'
  mkdirSync(dir, { recursive: true })
  const css = page.slice(page.indexOf('<style>'), page.indexOf('</style>') + 8)
  for (const o of OPTIONS) {
    const html = join(dir, `${o.id}.html`)
    writeFileSync(html, `<!doctype html><meta charset="utf-8">${css}<div class="wrap">${optionHtml(o, false)}</div>`)
    const tall = o.mode === 'panel' && o.id !== 'panel-grey' ? 1150 : 1000
    spawnSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1.5', `--window-size=1040,${tall}`, `--screenshot=${join(dir, `${o.id}.png`)}`, `file://${html}`])
    console.log(o.id)
  }
}
