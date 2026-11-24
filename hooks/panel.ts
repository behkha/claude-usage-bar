// The Panel mode of the band: the card as a synthesizer's front panel in
// light brushed aluminium. Each meter is a coloured knob, its pointer and lit
// ring standing at the value and a dot on the ring at the pace: blue for the
// context, green for the 5-hour limit, white for the week, orange for the
// model's. A black OLED beside them shows the context large, with the
// session's numbers. The plate is the same metal: the reset times on the wide
// plate, cost, time and turns on the narrow one, and the rail on dark keys lit
// at the rim, since the app's grey glyphs vanish on light metal.
//
// In a narrow pane the OLED shrinks to the context figure, then goes; the
// knobs stay, but in the narrowest a knob that would stand under the plate is
// left off.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import { RAIL, short } from './glass'
import type { InstrumentInput } from './instruments'
import { HN, MONO, P, SANS, T, arc, cl, contextHot, contextOf, esc, f, hot, limitsAlt, limitsOf, numbersAlt, pct, roomOf, stations } from './instruments'

const H = CARD_HEIGHT
const M = { m0: '#e6e6e1', m1: '#cfcfc9', ink: '#1d1d1b', sub: '#4f4f49', screw: '#b4b4ae', edge: 'rgba(0,0,0,.22)' }
const KNOB = { ctx: '#2f6fe4', five: '#22a86a', week: '#f4f4f0', model: '#ff6a1f' }
const RED = '#ff3b30'

const DEFS =
  `<linearGradient id="al" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${M.m0}"/><stop offset="1" stop-color="${M.m1}"/></linearGradient>` +
  `<pattern id="br" width="400" height="3" patternUnits="userSpaceOnUse"><rect width="400" height="1" fill="#000" opacity=".025"/></pattern>` +
  `<filter id="ks" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>`
const metal = (x: number, w: number) => `<rect x="${x}" width="${w}" height="${H}" fill="url(#al)"/><rect x="${x}" width="${w}" height="${H}" fill="url(#br)"/>`
const screw = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${M.screw}" stroke="#9c9c96" stroke-width=".6"/><path d="M${x - 1.6} ${y}h3.2" stroke="#8a8a84" stroke-width=".7"/>`

/** A knob: ticks, a groove with the lit ring to `v` (none before a reading), a dot at the pace, the cap with its pointer, and the label with the figure. */
const knob = (cx: number, cy: number, v: number | null, pace: number | null, color: string, label: string, red: boolean, shown = v) => {
  const A = (t: number) => -135 + (270 * t) / 100
  const white = color === KNOB.week
  const ring = red ? RED : white ? M.ink : color
  let s = ''
  for (let k = 0; k <= 10; k++) {
    const [a, b] = P(cx, cy, 25, A(k * 10))
    const [c, d] = P(cx, cy, 27.5, A(k * 10))
    s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${M.sub}" stroke-width=".9"/>`
  }
  s += `<path d="${arc(cx, cy, 21.5, A(0), A(100))}" fill="none" stroke="#bdbdb7" stroke-width="3" stroke-linecap="round"/>`
  if (v !== null) s += `<path d="${arc(cx, cy, 21.5, A(0), A(Math.max(0.5, v)))}" fill="none" stroke="${ring}" stroke-width="3" stroke-linecap="round"/>`
  if (pace !== null) {
    const [a, b] = P(cx, cy, 21.5, A(cl(pace, 0, 1) * 100))
    s += `<circle cx="${f(a)}" cy="${f(b)}" r="2.2" fill="${M.ink}" stroke="${M.m0}" stroke-width=".8"/>`
  }
  s += `<circle cx="${cx + 1}" cy="${cy + 2}" r="14.5" fill="#000" opacity=".3" filter="url(#ks)"/><circle cx="${cx}" cy="${cy}" r="14.5" fill="${color}"${white ? ' stroke="#b0b0aa" stroke-width=".8"' : ''}/><circle cx="${cx - 1.5}" cy="${cy - 2.5}" r="11" fill="#fff" opacity=".14"/>`
  const [a, b] = P(cx, cy, 5, A(v ?? 0))
  const [c, d] = P(cx, cy, 12, A(v ?? 0))
  s += `<line x1="${f(a)}" y1="${f(b)}" x2="${f(c)}" y2="${f(d)}" stroke="${white ? M.ink : '#fff'}" stroke-width="2.4" stroke-linecap="round"/>`
  s += `<text x="${cx}" y="82" text-anchor="middle" font-family='${SANS}' font-size="8.5" letter-spacing=".6" fill="${M.sub}">${esc(label)} <tspan font-weight="700" fill="${red ? '#e0342a' : M.ink}">${shown === null ? '–' : Math.round(shown)}</tspan></text>`
  return s
}

/**
 * Where the app's buttons stand on the rail, by their glyphs' centres in card coordinates, measured in the desktop
 * app: with the mode button and Claude FM alone at 29.5 and 49, the row below kept for Claude FM's equalizer; with
 * the child-sessions button above them at 20.5, 40 and 60. The keys sit a px lower, where the glyphs looked centred.
 */
const railRows = (family: boolean) => (family ? { family: 21.5, mode: 41, fm: 61 } : { family: null, mode: 30.5, fm: 50 })

/** The rail's keys: dark caps under the app's own grey glyphs, lit at the rim; the mode key's rim turns red when something runs hot. */
const keys = (x: number, i: InstrumentInput) => {
  const sport = limitsOf(i).some(l => hot(l.g)) || contextHot(i)
  const rows = railRows(!!i.family)
  const cap = (c: number, rim: string) => {
    const y = c - 8.5
    return `<rect x="${x + 3}" y="${f(y + 1.4)}" width="26" height="17" rx="5" fill="#000" opacity=".25"/><rect x="${x + 3}" y="${f(y)}" width="26" height="17" rx="5" fill="#1e1e1d" stroke="${rim}" stroke-width="1.3"/><rect x="${x + 5}" y="${f(y + 1.5)}" width="22" height="5" rx="3" fill="#fff" opacity=".06"/>`
  }
  return (rows.family !== null ? cap(rows.family, '#ff6a1f') : '') + cap(rows.mode, sport ? RED : '#2f6fe4') + cap(rows.fm, '#8a8a84')
}

/** The plate's width left of the rail: wide with the reset times, narrow with cost, time and turns. */
const plateBody = (i: InstrumentInput) => (i.wide ? 150 : 100)
/** Each limit's knob colour, by which limit it is, so the week stays white without a 5-hour reading. */
const LIMIT_KNOB = { five: KNOB.five, week: KNOB.week, model: KNOB.model }
/** The knobs' centres are this far apart, from the first at 42. */
const PITCH = 58

/** The card's left end: a knob for the context and each limit, and the OLED where there is room. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function panelArt(i: InstrumentInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const room = roomOf(i, plateBody(i))
  const p = contextOf(i)
  let s = metal(-9, W) + screw(9, 9) + screw(9, H - 9)
  s += knob(42, 40, p, null, KNOB.ctx, 'CTX', contextHot(i))
  const L = limitsOf(i)
  // In the narrowest panes a knob that would stand under the plate is left off, the model's first.
  const shown = L.filter((_, k) => 42 + (k + 1) * PITCH + 28 <= room)
  shown.forEach((l, k) => (s += knob(42 + (k + 1) * PITCH, 40, pct(l.g), l.g.pace, LIMIT_KNOB[l.kind], l.key, hot(l.g), l.g.percent)))
  // The OLED: the context figure from 120 px, the session's numbers beside it from 200.
  const ox = 42 + (shown.length + 1) * PITCH - 12
  const ow = room - ox >= 120 ? Math.min(430, room - ox) : 0
  if (ow) {
    s += `<rect x="${ox}" y="9" width="${ow}" height="75" rx="7" fill="#0b0b0c" stroke="#a9a9a3"/>`
    s += `<text x="${ox + 12}" y="52" font-family='${HN}' fill="#f2f2ee"><tspan font-size="36" font-weight="200">${p === null ? '–' : Math.round(p)}</tspan>${p === null ? '' : '<tspan font-size="13" dx="2" fill="#8a8a85">%</tspan>'}</text>`
    if (i.context && p !== null) s += T(ox + 13, 72, `${short(i.context.tokens)} / ${short(i.context.window)}`, { size: 9, font: MONO, fill: '#7d7d78' })
    if (ow >= 200) {
      const two = ow >= 380
      // The narrow plate already shows the first three numbers; the screen shows the rest.
      const st = stations(i).slice(i.wide ? 0 : 3).slice(0, two ? 5 : 4)
      const swatch = [KNOB.ctx, KNOB.five, KNOB.week, KNOB.model, '#9a9a95']
      const colW = two ? (ow - 148) / 2 : ow - 130
      st.forEach(([k, v], r) => {
        const c = two ? Math.floor(r / 3) : 0
        const y = 26 + (two ? r % 3 : r) * (two ? 20 : 15.5)
        const cx = ox + 118 + c * (colW + 18)
        s += `<rect x="${f(cx)}" y="${y - 6}" width="5" height="5" fill="${swatch[r]}"/>` + T(cx + 10, y, k, { size: 8, font: MONO, fill: '#8a8a85' }) + T(cx + colW, y, v, { size: 10.5, anchor: 'end', font: MONO, fill: '#f2f2ee' })
      })
    }
  }
  return { source: leftEnd(W, M.m0, s, { defs: DEFS, edge: M.edge }), width: W }
}

/** The card's right end: the reset times or the session's numbers, two screws, and the rail on dark keys. Drawn at its exact size, with the card's two right corners cut. */
export function panelPlate(i: InstrumentInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const inner = body + RAIL
  let p = metal(0, inner)
  if (i.wide)
    p += limitsOf(i)
      .map((l, k) => `<rect x="10" y="${21 + k * 22}" width="7" height="7" rx="1.5" fill="${LIMIT_KNOB[l.kind]}" stroke="#6a6a64" stroke-width=".8"/>` + T(22, 28 + k * 22, l.key, { size: 8, weight: 600, spacing: 0.6, fill: M.sub }) + T(body - 8, 28 + k * 22, (l.g.left ?? '').replace(/ /g, ''), { size: 10.5, anchor: 'end', font: MONO, fill: M.ink }))
      .join('')
  else
    p += stations(i)
      .slice(0, 3)
      .map(([k, v], r) => T(10, 28 + r * 22, k, { size: 7.5, weight: 600, spacing: 0.6, fill: M.sub }) + T(body - 8, 28 + r * 22, v, { size: 10.5, anchor: 'end', font: MONO, fill: M.ink }))
      .join('')
  p += keys(body, i) + screw(body - 6, 8) + screw(body - 6, H - 8)
  return rightEnd(inner, body, M.m0, p, { defs: DEFS, edge: M.edge, rule: 'rgba(0,0,0,0)' })
}

export const panelAlt = (i: InstrumentInput) => {
  const knobs = limitsOf(i)
  return knobs.length ? `${numbersAlt(i)}, ${limitsAlt(knobs).replace('Limits: ', '')}` : numbersAlt(i)
}
export const panelLimitsAlt = (i: InstrumentInput) => {
  const resets = i.wide ? limitsOf(i).filter(l => l.g.left).map(l => `${l.said} resets in ${l.g.left}`) : stations(i).slice(0, 3).map(([k, v]) => `${k.toLowerCase()} ${v}`)
  return resets.length ? resets.join(', ') : 'Limits'
}
