// What the instrument modes (Nixie, VU, Cockpit, Panel) share: the numbers
// they draw from, the limits as rows, the session's numbers as a row of
// stations along the card, and the SVG print helpers.

import type { Gauge } from './card'
import { RAIL, clock, dollars, short } from './glass'

/** What an instrument mode draws from. */
export type InstrumentInput = {
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
  written: number
  /** The share of reads served from cache, 0..100; null before the first read. */
  cache: number | null
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  turns: number
  /** Minutes since the session began. */
  minutes: number
  /** The rail shows the child-sessions button above the mode button: the app's buttons stand a row higher. */
  family?: boolean
}

export const f = (n: number) => String(+n.toFixed(2))
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
/** The print. The system's own condensed face is hidden from drawings, so figures are set in Helvetica Neue. */
export const HN = '"Helvetica Neue",-apple-system,sans-serif'
export const SANS = '-apple-system,system-ui,sans-serif'
export const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'

export type TextOptions = { size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; spacing?: number; fill?: string; opacity?: number; font?: string; extra?: string }
/** A line of print; `extra` goes into the element as it is (a halo, a filter). */
export const T = (x: number, y: number, s: string, o: TextOptions = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family='${o.font ?? SANS}' font-size="${o.size ?? 10}" font-weight="${o.weight ?? 400}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''} fill="${o.fill ?? '#fff'}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}${o.extra ?? ''}>${esc(s)}</text>`

const rad = (d: number) => (d * Math.PI) / 180
/** A point `r` from (cx, cy) at `a` degrees, 0 straight up, clockwise. */
export const P = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))]
/** An arc of radius `r` from `a0` to `a1` degrees. */
export const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = P(cx, cy, r, a0)
  const [x1, y1] = P(cx, cy, r, a1)
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(x1)} ${f(y1)}`
}

/** A limit's fill, 0..100. */
export const pct = (g: Gauge) => cl(g.percent, 0, 100)
/** A limit running ahead of its pace or nearly used up. */
export const hot = (g: Gauge) => g.level !== 'ok'
/** The context's fill, 0..100, or null before the first reading. */
export const contextOf = (i: InstrumentInput) => (i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : null)
/** The context is nearly full: by the figure the card prints, so a 90 never shows without its warning. */
export const contextHot = (i: InstrumentInput) => Math.round(contextOf(i) ?? 0) >= 90

/** A limit as the modes print it: a short key, the name on a meter's face, the name read aloud. */
export type Limit = { kind: 'five' | 'week' | 'model'; key: string; label: string; said: string; g: Gauge }
export const limitsOf = (i: InstrumentInput): Limit[] => {
  const out: Limit[] = []
  if (i.five) out.push({ kind: 'five', key: '5H', label: '5-HOUR', said: '5-hour', g: i.five })
  if (i.seven) out.push({ kind: 'week', key: 'WK', label: 'WEEK', said: 'weekly', g: i.seven })
  if (i.model) out.push({ kind: 'model', key: i.model.name.slice(0, 3), label: i.model.name, said: `${i.model.name} weekly`, g: i.model.gauge })
  return out
}

/** The session's numbers, as the modes print them, in the order they give way (last first). */
export const stations = (i: InstrumentInput): Array<[string, string]> => {
  const s: Array<[string, string]> = []
  if (i.usd !== null) s.push(['COST', dollars(i.usd)])
  s.push(['TIME', clock(i.minutes)], ['TURNS', String(i.turns)])
  if (i.cache !== null) s.push(['CACHE', `${Math.round(i.cache)}%`])
  s.push(['WRITTEN', short(i.written)])
  return s
}

/** The room a mode's art has left of a plate `body` px wide, on the narrowest card the pane could hold. */
export const roomOf = (i: InstrumentInput, body: number) => i.narrow - body - RAIL - 8

/**
 * The session's numbers as a row from `x0`, a name over each figure, as many as fit before `room`, the room left
 * over shared out between them. `withTokens` leads with the context's tokens.
 */
export const stationRow = (i: InstrumentInput, x0: number, room: number, o: { label: string; value: string; y: number; size: number; font?: string; glow?: string; withTokens?: boolean }) => {
  const list = stations(i)
  if (o.withTokens && i.context) list.splice(0, 0, ['TOKENS', `${short(i.context.tokens)}/${short(i.context.window)}`])
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

/** The card's numbers read aloud: the context, and the session's numbers. */
export const numbersAlt = (i: InstrumentInput) => {
  const p = contextOf(i)
  return [
    i.context && p !== null ? `Context ${Math.round(p)}%, ${short(i.context.tokens)} of ${short(i.context.window)} tokens` : 'Context not read yet',
    i.usd !== null ? `${dollars(i.usd)} so far` : null,
    `${i.turns} turn${i.turns === 1 ? '' : 's'}`,
    `${short(i.written)} tokens written`,
  ]
    .filter(Boolean)
    .join(', ')
}
/** Limits read aloud. */
export const limitsAlt = (list: Limit[]) => {
  const said = list.map(l => `${l.said} ${Math.round(l.g.percent)}%${l.g.level === 'ahead' ? ', ahead of pace' : l.g.level === 'high' ? ', nearly used up' : ''}`)
  return said.length ? `Limits: ${said.join(', ')}` : 'Limits'
}
