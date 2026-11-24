// The Cockpit mode of the band: the card as a flight display. The context is
// a rolling tape like an airspeed tape, its scale sliding past a fixed window
// with the value boxed and its last digit on a drum. The 5-hour and weekly
// limits are horizontal tapes with a green fill, an amber and red range
// stripe and a magenta pace bug, their percent boxed. A data block of the
// session's numbers sits right of them. The plate carries the model's limit
// and a master caution box: LIMIT in amber when a limit runs ahead of its
// pace, CTX in red when the context is nearly full.
//
// In a narrower pane the data block's columns go and the limit tapes shorten
// to 120 px; narrower still, the reset times go and the tapes shorten further.
// The context tape stays.
//
// Two drawings: the card's left end (cropped by the card, as in Glass) and a
// plate pinned to the card's right end.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import type { Gauge } from './card'
import { RAIL, short } from './glass'
import type { InstrumentInput } from './instruments'
import { MONO, T, cl, contextHot, contextOf, f, hot, limitsAlt, limitsOf, numbersAlt, pct, roomOf, stations } from './instruments'

const H = CARD_HEIGHT
const CK = { ground: '#0b0e11', panel: '#151a1f', line: '#2f363e', white: '#e8ecef', cyan: '#29d6e6', green: '#3fe05a', magenta: '#ff4fd8', amber: '#f5b800', red: '#ff3b30', edge: 'rgba(232,236,239,.24)', rule: 'rgba(232,236,239,.1)' }
const fillOf = (g: Gauge) => (g.percent >= 90 ? CK.red : hot(g) ? CK.amber : CK.green)
const paceOf = (g: Gauge) => (g.pace === null ? null : cl(g.pace, 0, 1))

/** The plate's width left of the rail: wide with the longer tape and caution box, narrow with the short ones. */
const plateBody = (i: InstrumentInput) => (i.wide ? 160 : 110)

/** The data block: cyan captions over white values, two rows to a column, as many columns as fit before `room`. */
const dataBlock = (i: InstrumentInput, x0: number, room: number) => {
  const st = stations(i)
  const rows = 2
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

/** The master caution: CTX in red when the context is nearly full, LIMIT in amber when a limit runs hot; none otherwise. */
const caution = (i: InstrumentInput) => (contextHot(i) ? { word: 'CTX', color: CK.red } : limitsOf(i).some(l => hot(l.g)) ? { word: 'LIMIT', color: CK.amber } : null)

/** The context tape: the scale rolls past a fixed window, the value boxed with its last digit on a drum. */
const contextTape = (i: InstrumentInput) => {
  const p = contextOf(i)
  const c = p ?? 0
  const ty = (v: number) => 46.5 - (v - c) * 1.5
  const tokens = !!i.context && p !== null
  let s = `<clipPath id="tp"><rect x="10" y="6" width="56" height="81" rx="3"/></clipPath><rect x="10" y="6" width="56" height="81" rx="3" fill="${CK.panel}" stroke="${CK.line}"/><g clip-path="url(#tp)">`
  // Before the first reading the tape is blank: a scale at zero would read as a real zero.
  if (p !== null) s += `<rect x="62" y="${f(ty(90))}" width="4" height="${f(ty(80) - ty(90))}" fill="${CK.amber}"/><rect x="62" y="${f(ty(100))}" width="4" height="${f(ty(90) - ty(100))}" fill="${CK.red}"/><rect x="62" y="${f(ty(80))}" width="4" height="${f(ty(0) - ty(80))}" fill="${CK.green}" fill-opacity=".8"/>`
  for (let v = 0; v <= 100; v += 5) {
    const y = ty(v)
    if (p === null || y < 0 || y > H) continue
    s += `<line x1="${v % 10 ? 55 : 50}" y1="${f(y)}" x2="61" y2="${f(y)}" stroke="${CK.white}" stroke-width="1"/>`
    // A number is left off where the value box or a caption box would cut it.
    // The drum's taller window reaches under the numbers only at 100, with three digits.
    const notch = p !== null && Math.round(p) >= 100 ? 20 : 14
    const covered = Math.abs(y - 46.5) < notch || y < 22 || (tokens && y > 71)
    if (v % 10 === 0 && !covered) s += T(47, y + 3.2, String(v), { size: 9, anchor: 'end', font: MONO, fill: CK.white })
  }
  s += '</g>'
  const ink = contextHot(i) ? CK.red : CK.green
  if (p === null) s += `<path d="M10 36H50L58 46.5L50 57H10Z" fill="#000" stroke="${CK.white}" stroke-width="1"/>` + T(15, 52.5, '--', { size: 16, weight: 700, font: MONO, fill: CK.cyan })
  else {
    const v = String(Math.round(p))
    const last = Number(v.slice(-1))
    const dx = 15 + 9.6 * (v.length - 1)
    // The box, taller round the last digit: the drum's window, where the digits above and below show in part.
    const a = f(dx - 2)
    const b = f(dx + 11.6)
    s += `<path d="M10 36H${a}V30H${b}V36H50L58 46.5L50 57H${b}V63H${a}V57H10Z" fill="#000" stroke="${CK.white}" stroke-width="1"/>`
    s += T(15, 52.5, v.slice(0, -1), { size: 16, weight: 700, font: MONO, fill: ink })
    s += `<clipPath id="dr"><rect x="${a}" y="31" width="13.6" height="31"/></clipPath><g clip-path="url(#dr)">`
    s += T(dx, 37.5, String((last + 1) % 10), { size: 16, weight: 700, font: MONO, fill: ink, opacity: 0.45 }) + T(dx, 52.5, String(last), { size: 16, weight: 700, font: MONO, fill: ink }) + T(dx, 67.5, String((last + 9) % 10), { size: 16, weight: 700, font: MONO, fill: ink, opacity: 0.45 })
    s += '</g>'
  }
  s += `<rect x="10" y="6" width="28" height="12" fill="#000"/>` + T(13, 15, 'CTX', { size: 8, font: MONO, fill: CK.cyan })
  if (tokens && i.context) s += `<rect x="10" y="75" width="40" height="12" fill="#000"/>` + T(13, 84, short(i.context.tokens).toUpperCase(), { size: 8, font: MONO, fill: CK.cyan })
  return s
}

/** Where the limit tapes start, and their least and most length. */
const TAPE_X = 96
const TAPE_MIN = 120
const TAPE_MAX = 300
/** The shortest a tape gets once the reset times are gone. */
const TAPE_LEAST = 50
/** What a tape's percent box and reset time take past its end. */
const BOX_W = 50
const RESET_W = 62

/** The card's left end: the context tape, the 5-hour and weekly tapes, and the data block. One SVG, `ART_HEIGHT` tall, with the card's two left corners cut. */
export function cockpitArt(i: InstrumentInput): { source: string; width: number } {
  const W = Math.round(i.width)
  const room = roomOf(i, plateBody(i))
  const resets = room >= TAPE_X + TAPE_MIN + BOX_W + RESET_W
  const tw = resets ? cl(room - 78 - 110 - 2 * 84, TAPE_MIN, TAPE_MAX) : cl(room - TAPE_X - BOX_W - 6, TAPE_LEAST, TAPE_MIN)
  let s = contextTape(i)
  limitsOf(i)
    .slice(0, 2)
    .forEach((l, k) => {
      const cy = 27 + k * 38
      const x0 = TAPE_X
      s += T(76, cy + 3.5, l.key, { size: 9, font: MONO, fill: CK.cyan })
      s += `<rect x="${x0}" y="${cy - 12}" width="${tw}" height="24" rx="2" fill="${CK.panel}" stroke="${CK.line}"/>`
      for (let t = 0; t <= 100; t += 10) {
        const tx = x0 + (tw * t) / 100
        s += `<line x1="${f(tx)}" y1="${t % 50 ? cy + 7 : cy + 3}" x2="${f(tx)}" y2="${cy + 12}" stroke="#9aa3ad" stroke-width=".9"/>`
      }
      s += `<rect x="${f(x0 + tw * 0.8)}" y="${cy + 10}" width="${f(tw * 0.1)}" height="2" fill="${CK.amber}"/><rect x="${f(x0 + tw * 0.9)}" y="${cy + 10}" width="${f(tw * 0.1)}" height="2" fill="${CK.red}"/>`
      s += `<rect x="${x0}" y="${cy - 3}" width="${f((tw * pct(l.g)) / 100)}" height="6" fill="${fillOf(l.g)}"/>`
      const pace = paceOf(l.g)
      if (pace !== null) {
        const px = x0 + tw * pace
        s += `<path d="M${f(px - 5)} ${cy - 11}H${f(px + 5)}V${cy - 7}L${f(px)} ${cy - 3.5}L${f(px - 5)} ${cy - 7}Z" fill="none" stroke="${CK.magenta}" stroke-width="1.5"/>`
      }
      s += `<rect x="${x0 + tw + 6}" y="${cy - 11}" width="44" height="22" fill="#000" stroke="${CK.white}"/>` + T(x0 + tw + 28, cy + 5, `${Math.round(l.g.percent)}`, { size: 14, weight: 700, anchor: 'middle', font: MONO, fill: fillOf(l.g) })
      if (resets) s += T(x0 + tw + 56, cy + 4, (l.g.left ?? '').replace(/ /g, '').toUpperCase(), { size: 9, font: MONO, fill: CK.white })
    })
  s += dataBlock(i, TAPE_X + tw + 118, room)
  return { source: leftEnd(W, CK.ground, s, { edge: CK.edge }), width: W }
}

/** The card's right end: the model's limit as a short tape, the master caution or the reset time, and the rail. Drawn at its exact size, with the card's two right corners cut. */
export function cockpitPlate(i: InstrumentInput): { source: string; width: number; height: number } {
  const body = plateBody(i)
  const all = limitsOf(i)
  const third = all[2]
  let p = ''
  if (third) {
    const w = i.wide ? 70 : 44
    p += T(8, 22, third.key, { size: 8, font: MONO, fill: CK.cyan }) + `<rect x="8" y="28" width="${w}" height="14" rx="2" fill="${CK.panel}" stroke="${CK.line}"/><rect x="8" y="32" width="${f((w * pct(third.g)) / 100)}" height="6" fill="${fillOf(third.g)}"/>`
    const pace = paceOf(third.g)
    if (pace !== null) p += `<path d="M${f(8 + w * pace - 4)} 24h8v4l-4 3l-4-3z" fill="none" stroke="${CK.magenta}" stroke-width="1.3"/>`
    p += `<rect x="${w + 13}" y="26" width="34" height="18" fill="#000" stroke="${CK.white}"/>` + T(w + 30, 39, String(Math.round(third.g.percent)), { size: 12, weight: 700, anchor: 'middle', font: MONO, fill: fillOf(third.g) })
  }
  const c = caution(i)
  const reset = third?.g.left
  if (c) p += `<rect x="8" y="58" width="${i.wide ? 70 : 52}" height="20" rx="2" fill="${c.color}"/>` + T(8 + (i.wide ? 35 : 26), 72, c.word, { size: 10, weight: 800, anchor: 'middle', font: MONO, fill: '#000' })
  else if (reset) p += T(8, 72, `RST ${reset.replace(/ /g, '').toUpperCase()}`, { size: 9.5, font: MONO, fill: CK.white, opacity: 0.8 })
  return rightEnd(body + RAIL, body, CK.ground, p, { edge: CK.edge, rule: CK.rule })
}

export const cockpitAlt = (i: InstrumentInput) => {
  const tapes = limitsOf(i).slice(0, 2)
  return tapes.length ? `${numbersAlt(i)}, ${limitsAlt(tapes).replace('Limits: ', '')}` : numbersAlt(i)
}
export const cockpitLimitsAlt = (i: InstrumentInput) => {
  const c = caution(i)
  const third = limitsOf(i).slice(2)
  return [third.length ? limitsAlt(third) : null, c ? (c.word === 'CTX' ? 'Caution: context nearly full' : 'Caution: a limit is ahead of pace') : null].filter(Boolean).join('. ') || 'Limits'
}
