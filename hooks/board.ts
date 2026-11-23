// The Board mode of the band: the card as a split-flap departure board. Each
// of the session's numbers is a row of flaps under its heading, with a line
// under it: context, cost, time, turns, tokens written, cache, as many as the
// pane holds, the room left over shared out between them. The plate lists the
// limits like flights: the percent in flaps and, on the wide plate, how the
// limit runs against its pace, ON TIME, AHEAD or FINAL CALL.
//
// When a figure changes, its flaps turn over, one character after another:
// the old top half falls to the split, then the new bottom half falls over the
// old one. The turn is timed from the moment of the change, not from the
// drawing's own start, so a redraw meanwhile picks it up where it stands.
// Reduced motion shows the new figure at once.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { leftEnd, rightEnd } from './card'
import type { Gauge } from './card'
import { RAIL, clock, dollars, short } from './glass'

export type BoardInput = {
  /** CSS px drawn across, and the narrowest the card could be. */
  width: number
  narrow: number
  /** The pane has room for the wide plate, with the status words. */
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
  tools: number
  /** Minutes since the session began. */
  minutes: number
  /** The faces the board showed before its last change (`boardFaces`), and the ms since that change; null when nothing is turning. */
  flip: { was: Faces; elapsed: number } | null
}

/** What each row of flaps shows, by the row's name: the board's figures and the plate's percents. */
export type Faces = Record<string, string>

const SANS = '-apple-system,system-ui,sans-serif'
/** The flaps' print. The system's own condensed face is hidden from drawings, so the flaps are set in Helvetica Neue. */
const PRINT = '"Helvetica Neue",-apple-system,sans-serif'
const GROUND = '#0b0b0c'
const EDGE = 'rgba(255,255,255,.24)'
const RULE = 'rgba(255,255,255,.12)'
const HEAD = '#8d8d92'
const INK = '#f2f2f2'
/** How a limit runs against its pace, as a board calls a flight. */
const STATUS: Record<Gauge['level'], readonly [string, string]> = { ok: ['ON TIME', '#f0f0f0'], ahead: ['AHEAD', '#ffb300'], high: ['FINAL CALL', '#ff5a3c'] }

const f = (n: number) => String(+n.toFixed(1))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cl = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

const words = (x: number, y: number, s: string, o: { size: number; spacing: number; fill: string; weight?: number; opacity?: number }) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${SANS}" font-size="${o.size}" font-weight="${o.weight ?? 700}" letter-spacing="${o.spacing}" fill="${o.fill}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}>${esc(s)}</text>`

// ---------- a flap ----------
// Drawn round its split: y 0 is the line between the halves, so a half turns
// over by scaling its height about the drawing's own origin.

type Flap = { w: number; h: number; size: number; split: number }
/** The board's flaps, and the plate's smaller ones. */
const BIG: Flap = { w: 21, h: 34, size: 25, split: 1.1 }
const SMALL: Flap = { w: 13, h: 20, size: 14, split: 0.8 }
const PITCH = 2

/** How long one half takes to fall, how far apart the characters of a row start, and how far apart the rows. */
const HALF_MS = 150
const CHAR_MS = 55
const ROW_MS = 90
/** How long after a change the board may still be turning: the band draws it still once this is past. */
export const FLIP_MS = 1_600

/** The flap's two halves, as clips, in the flap's own coordinates; one pair per drawing, since a drawing has one size of flap. */
const halves = (s: Flap) =>
  `<clipPath id="up"><rect x="0" y="${-s.h / 2}" width="${s.w}" height="${s.h / 2}"/></clipPath>` +
  `<clipPath id="dn"><rect x="0" y="0" width="${s.w}" height="${s.h / 2}"/></clipPath>`
/** The flaps' face: lighter above the split than below, as a lit board is. */
const FACE = `<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset=".5" stop-color="#202023"/><stop offset=".5" stop-color="#18181a"/><stop offset="1" stop-color="#121214"/></linearGradient>`

const card = (s: Flap, ch: string, ink: string) =>
  `<rect x="0" y="${-s.h / 2}" width="${s.w}" height="${s.h}" rx="2.2" fill="url(#fl)"/>` +
  (ch.trim() ? `<text x="${f(s.w / 2)}" y="${f(s.size * 0.36)}" font-family='${PRINT}' font-size="${s.size}" font-weight="700" text-anchor="middle" fill="${ink}">${esc(ch)}</text>` : '')

/** The turns a drawing plays, gathered as its flaps are drawn: one rule per start, with the delay from the change. */
type Turns = { elapsed: number; at: Set<number> }

/**
 * A row of flaps with its top left at (`x`, `y`), showing `value`. Where `was` differs in a character, that flap
 * turns over from the old character to the new one, starting `start` ms after the change.
 */
const flaps = (x: number, y: number, value: string, s: Flap, ink: string, was: string | null, turns: Turns | null, start: number) => {
  let svg = ''
  ;[...value].forEach((ch, n) => {
    const at = `translate(${f(x + n * (s.w + PITCH))} ${f(y + s.h / 2)})`
    const old = was === null ? ch : ([...was][n] ?? ' ')
    if (old === ch || !turns) {
      svg += `<g transform="${at}">${card(s, ch, ink)}</g>`
    } else {
      const ms = Math.round(start + n * CHAR_MS)
      turns.at.add(ms)
      // Back to front: the new face whole, the old bottom half, the new bottom half falling over it, the old top half falling away.
      svg +=
        `<g transform="${at}">${card(s, ch, ink)}` +
        `<g class="fo" clip-path="url(#dn)">${card(s, old, ink)}</g>` +
        `<g class="fb b${ms}" clip-path="url(#dn)">${card(s, ch, ink)}</g>` +
        `<g class="ft t${ms}" clip-path="url(#up)">${card(s, old, ink)}</g></g>`
    }
    svg += `<line x1="${f(x + n * (s.w + PITCH))}" y1="${f(y + s.h / 2)}" x2="${f(x + n * (s.w + PITCH) + s.w)}" y2="${f(y + s.h / 2)}" stroke="#000" stroke-width="${s.split}" stroke-opacity=".85"/>`
  })
  return { svg, w: [...value].length * (s.w + PITCH) - PITCH }
}

/** The turns' timing, each delay counted from the change: negative once it is past, so a turn resumes mid-way. */
const turnStyle = (t: Turns) => {
  if (!t.at.size) return ''
  const rules = [...t.at].map(ms => `.t${ms}{animation-delay:${ms - t.elapsed}ms}.b${ms}{animation-delay:${ms + HALF_MS - t.elapsed}ms}`).join('')
  return (
    '<style>' +
    // Each half scales about its group's own origin, the split line.
    `.ft,.fb{transform-box:view-box;transform-origin:0 0}` +
    `.ft{animation:ft ${HALF_MS}ms ease-in both}@keyframes ft{to{transform:scaleY(0)}}` +
    `.fb{animation:fb ${HALF_MS}ms ease-out both}@keyframes fb{from{transform:scaleY(0)}}` +
    rules +
    '@media (prefers-reduced-motion: reduce){.ft,.fo{display:none}.fb{animation:none}}</style>'
  )
}
const turnsOf = (i: BoardInput): Turns | null => (i.flip && i.flip.elapsed < FLIP_MS ? { elapsed: i.flip.elapsed, at: new Set() } : null)
const wasOf = (i: BoardInput, key: string) => (i.flip ? (i.flip.was[key] ?? null) : null)

// ---------- what it shows ----------

type Group = { head: string; value: string; sub: string }
const groupsOf = (i: BoardInput): Group[] => {
  const p = i.context && Number.isFinite(i.context.percent) ? cl(i.context.percent, 0, 100) : null
  const groups: Group[] = [
    { head: 'CONTEXT', value: i.context && p !== null ? `${Math.round(p)}%` : '--', sub: i.context && p !== null ? `${short(i.context.tokens)} / ${short(i.context.window)}`.toUpperCase() : '' },
  ]
  if (i.usd !== null) groups.push({ head: 'COST', value: dollars(i.usd), sub: 'SESSION' })
  groups.push(
    { head: 'TIME', value: clock(i.minutes), sub: 'ELAPSED' },
    { head: 'TURNS', value: short(i.turns), sub: `${short(i.tools)} TOOLS` },
    { head: 'WRITTEN', value: short(i.written).toUpperCase(), sub: 'TOKENS' },
  )
  if (i.cache !== null) groups.push({ head: 'CACHE', value: `${Math.round(i.cache)}%`, sub: 'OF READS' })
  return groups
}
type Row = [string, Gauge]
const limitRows = (i: BoardInput): Row[] => {
  const rows: Row[] = []
  if (i.five) rows.push(['5H', i.five])
  if (i.seven) rows.push(['7D', i.seven])
  if (i.model) rows.push([i.model.name, i.model.gauge])
  return rows
}
/** A limit's row is named apart from the board's groups, which a model's name could match. */
const limitKey = (name: string) => `limit ${name}`
const percent = (g: Gauge) => `${Math.round(g.percent)}%`

/** What every row of flaps shows: kept by the band, so the next drawing knows which flaps to turn. */
export const boardFaces = (i: BoardInput): Faces => {
  const faces: Faces = {}
  for (const g of groupsOf(i)) faces[g.head] = g.value
  for (const [name, g] of limitRows(i)) faces[limitKey(name)] = percent(g)
  return faces
}

// ---------- the sizes ----------

/** The plate's width left of the rail: wide with the status words, narrow without. */
const plateBody = (i: BoardInput) => (i.wide ? 160 : 104)
/** The room left of the plate, in the narrowest card the pane could hold. */
const roomOf = (i: BoardInput) => i.narrow - plateBody(i) - RAIL
/** Where the first group starts, the gap between groups, the most spare room one gap takes, and the room kept clear of the plate. */
const START = 18
const GAP = 20
const SPARE = 60
const CLEAR = 14
/** A group is as wide as its flaps, and never narrower than its heading and its line. */
const groupW = (value: string) => Math.max([...value].length * (BIG.w + PITCH) - PITCH, 64)

/** The card's left end: as many groups as fit, the room left shared between them. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function boardArt(i: BoardInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const room = roomOf(i) - CLEAR
  const fit: Group[] = []
  let used = START
  for (const g of groupsOf(i)) {
    if (used + groupW(g.value) > room) break
    fit.push(g)
    used += groupW(g.value) + GAP
  }
  // The row runs on to the plate: what is left over goes into the gaps, up to SPARE each.
  const spare = fit.length > 1 ? cl((room - (used - GAP)) / (fit.length - 1), 0, SPARE) : 0
  const turns = turnsOf(i)
  let x = START
  let body = ''
  fit.forEach((g, n) => {
    body +=
      words(x, 17, g.head, { size: 8, spacing: 1.3, fill: HEAD }) +
      flaps(x, 24, g.value, BIG, INK, wasOf(i, g.head), turns, n * ROW_MS).svg +
      (g.sub ? words(x, 74, g.sub, { size: 9, weight: 600, spacing: 0.9, fill: '#b5b5ba', opacity: 0.85 }) : '')
    x += groupW(g.value) + GAP + spare
  })
  return { source: leftEnd(W, GROUND, body, { defs: FACE + halves(BIG), edge: EDGE, head: turns ? turnStyle(turns) : '' }), width: W }
}

/** The card's right end: each limit's name, its percent in flaps and, on the wide plate, its status; and the rail the band's buttons stand over. Drawn at its exact size, with the card's two right corners cut. */
export function boardPlate(i: BoardInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const turns = turnsOf(i)
  const fx = i.wide ? 34 : 30
  const rows = limitRows(i)
    .map(([name, g], n) => {
      const y = 15 + n * 23.5
      const [word, ink] = STATUS[g.level]
      const fl = flaps(fx, y, percent(g), SMALL, g.level === 'ok' ? INK : ink, wasOf(i, limitKey(name)), turns, n * ROW_MS)
      return words(9, y + 14, name.slice(0, 3), { size: 8, spacing: 0.6, fill: HEAD }) + fl.svg + (i.wide ? words(fx + fl.w + 8, y + 14, word, { size: 8.5, spacing: 0.8, fill: ink }) : '')
    })
    .join('')
  return rightEnd(body + RAIL, body, GROUND, `<line x1=".5" y1="10" x2=".5" y2="83" stroke="#fff" stroke-opacity=".1"/>` + rows, {
    defs: FACE + halves(SMALL),
    edge: EDGE,
    rule: RULE,
    head: turns ? turnStyle(turns) : '',
  })
}

/** What the card's left end shows, for a screen reader. */
export const boardAlt = (i: BoardInput) => groupsOf(i).map(g => `${g.head.toLowerCase()} ${g.value}${g.sub ? ` ${g.sub.toLowerCase()}` : ''}`).join(', ')

/** What the plate shows, for a screen reader. */
export const boardLimitsAlt = (i: BoardInput) => {
  const said = limitRows(i).map(([name, g]) => `${name === '5H' ? '5-hour' : name === '7D' ? 'weekly' : `${name} weekly`} ${percent(g)}, ${STATUS[g.level][0].toLowerCase()}`)
  return said.length ? `Limits: ${said.join(', ')}` : 'Limits'
}
