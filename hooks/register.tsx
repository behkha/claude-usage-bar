import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { UsageBarChild, UsageBarFamily, UsageBarLedger, UsageBarModelLimits, UsageBarMood, UsageBarReading, UsageBarWindow } from '../types'
import { BLACK_LOOK, BLACK_PROBLEM } from './black'
import { RAIL, glassAlt, glassArt, glassPlate, limitsAlt } from './glass'
import type { GlassInput } from './glass'
import { ART_HEIGHT, SPACER, ZONE_HEIGHT } from './card'
import type { Gauge } from './card'

const windows = atom({ plugin: 'usage-bar', key: 'windows' } as const, [])
const modelLimits = atom({ plugin: 'usage-bar', key: 'modelLimits' } as const, null)
const now = atom({ plugin: 'usage-bar', key: 'now' } as const, 0)
const readings = atom({ plugin: 'usage-bar', key: 'readings' } as const, [])
const family = atom({ plugin: 'usage-bar', key: 'family' } as const, null)
const familyOpen = atom({ plugin: 'usage-bar', key: 'familyOpen' } as const, false)
const mood = atom({ plugin: 'usage-bar', key: 'mood' } as const, null)
const fmOn = atom({ plugin: 'usage-bar', key: 'fmOn' } as const, false)
const scene = atom({ plugin: 'usage-bar', key: 'scene' } as const, 'glass')
// What the Glass mode counts: tokens and tool calls as the session's events report them, and what the engine totals itself.
const LEDGER_START: UsageBarLedger = { written: 0, read: 0, cacheRead: 0, cacheWritten: 0, tools: 0, usd: null, startedAt: 0, turns: 0 }
const ledger = atom({ plugin: 'usage-bar', key: 'ledger' } as const, null)
const ledgerOf = async ($: EngineInterface): Promise<UsageBarLedger> => ((await read($, ledger)) as UsageBarLedger | null) ?? LEDGER_START

// ---------- the two modes ----------
// The band draws the Glass card or the classic meters. The ◐ control switches
// between them; the choice is shared by every session through the store.
const CLASSIC = 'classic'
const GLASS = 'glass'
const SCENE_STORE = 'scene'
const isScene = (v: unknown): v is string => v === GLASS || v === CLASSIC
/** The mode in force: anything else, such as a scene an earlier version stored, reads as Glass. */
const modeOf = (v: unknown) => (v === CLASSIC ? CLASSIC : GLASS)

const switchScene = async ($: EngineInterface) => {
  const to = modeOf(await read($, scene)) === GLASS ? CLASSIC : GLASS
  await update($, scene, () => to)
  await $.store.set(SCENE_STORE, to).catch(() => undefined)
}

// What another session chose, picked up here within a poll.
const pollScene = async ($: EngineInterface) => {
  const stored = await $.store.get(SCENE_STORE).catch(() => undefined)
  if (isScene(stored) && stored !== (await read($, scene))) await update($, scene, () => stored)
}

// The band's width is given in cells of the code font, not in pixels, and the
// font's advance is not known here. So the card is drawn for the widest the
// pane could be and cropped by it, while everything that matters is placed
// within the narrowest it could be. The limits plate is a drawing of its own,
// at its exact size, pinned to the card's right end.
//
// The art is laid behind the band's content and reaches past the card's own
// padding on every side (BLEED, in cells), where the card crops it: the whole
// card is the drawing, with no margin of the app's around it.
const BLEED_X = 2
const BLEED_Y = 1
// Cells from the content's right edge at which the art stops; the plate, at least 128 px wide with its rail, covers that.
const SCENE_STOP = 8
const WIDEST_CELL = 8.8
// Measured in the desktop app: a 767 px card drew the narrow plate, so it was under 96 cells wide and a cell
// over 7.99 px. At 6.8 the card was taken for a fifth narrower than it is, and columns that fit were dropped.
const NARROWEST_CELL = 8
const stripShape = (bodyColumns: number) => {
  const cells = Math.max(20, bodyColumns + 5)
  // The plate carries the reset times once the pane has room for them.
  const wide = cells >= 96
  const plate = (wide ? 160 : 96) + RAIL
  // Drawn for the widest the pane could be, up to 2400 px; placed for the narrowest.
  const cols = clamp(Math.round((cells * WIDEST_CELL + 48) / 2), 150, 1200)
  const layout = clamp(Math.round((cells * NARROWEST_CELL - plate - 16) / 2), 56, cols)
  return { cols, layout, wide }
}

type Strip = { art: { source: string; width: number }; alt: string; plate: { source: string; width: number; height: number }; limits: string }
const strips = new Map<string, Strip>()
const glassFor = (input: GlassInput): Strip => {
  const key = JSON.stringify(input)
  let hit = strips.get(key)
  if (!hit) {
    hit = { art: glassArt(input), alt: glassAlt(input), plate: glassPlate(input), limits: limitsAlt(input) }
    if (strips.size >= 8) strips.delete(strips.keys().next().value as string)
    strips.set(key, hit)
  }
  return hit
}

const HOUR = 3_600_000
const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * HOUR,
  seven_day: 7 * 24 * HOUR,
  seven_day_opus: 7 * 24 * HOUR,
  seven_day_sonnet: 7 * 24 * HOUR,
}
const ORDER = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet']

// ---------- formatting ----------

const label = (kind: string) =>
  kind === 'five_hour'
    ? '5h'
    : kind === 'seven_day'
      ? '7d'
      : kind.startsWith('seven_day_')
        ? `7d ${kind.slice('seven_day_'.length).replace(/_/g, ' ')}`
        : kind === 'spend_limit'
          ? 'spend'
          : kind.replace(/_/g, ' ')

const fmtLeft = (ms: number) => {
  if (ms <= 0) return 'now'
  const mins = Math.ceil(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

type Row = {
  kind: string
  label: string
  percent: number
  /** Share of the window already elapsed, 0..1; null when unknown. */
  pace: number | null
  left: string | null
  level: 'ok' | 'ahead' | 'high'
}

const toRow = (w: UsageBarWindow, at: number): Row => {
  const resetsAt = w.resetsAt ? Date.parse(w.resetsAt) : NaN
  const length = WINDOW_MS[w.kind] ?? (w.kind.startsWith('seven_day') ? WINDOW_MS.seven_day : undefined)
  const hasReset = Number.isFinite(resetsAt)
  const pace = hasReset && length ? clamp(1 - (resetsAt - at) / length, 0, 1) : null
  const level =
    w.percentUsed >= 90 ? 'high' : pace !== null && w.percentUsed > pace * 100 + 10 ? 'ahead' : 'ok'
  return {
    kind: w.kind,
    label: label(w.kind),
    percent: Math.round(w.percentUsed),
    pace,
    left: hasReset ? fmtLeft(resetsAt - at) : null,
    level,
  }
}

const sortWindows = (list: readonly SessionRateLimit[]): UsageBarWindow[] =>
  [...list]
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.kind)
      const ib = ORDER.indexOf(b.kind)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

// ---------- drawing ----------
// Box and Text on the terminal; on the desktop, one Svg per usage figure and
// the app's own Box and Text for the child sessions. Everything stays neutral
// until it needs attention: a limit turns yellow when it runs more than 10
// points ahead of its pace and red at 90%, a child asking you turns amber.

type Seg = { text: string; kind: 'fill' | 'rest' | 'tick' }

const barSegments = (row: Row, cells = 10): Seg[] => {
  const filled = Math.round((clamp(row.percent, 0, 100) / 100) * cells)
  const tickAt = row.pace === null ? -1 : Math.min(cells - 1, Math.floor(row.pace * cells))
  const segs: Seg[] = []
  for (let i = 0; i < cells; i++) {
    const kind = i === tickAt ? 'tick' : i < filled ? 'fill' : 'rest'
    const ch = kind === 'tick' ? '┃' : kind === 'fill' ? '█' : '░'
    const last = segs[segs.length - 1]
    if (last && last.kind === kind) last.text += ch
    else segs.push({ text: ch, kind })
  }
  return segs
}

const fillColor = (row: Row) => (row.level === 'high' ? 'red' : row.level === 'ahead' ? 'yellow' : undefined)

// ---------- context forecast ----------
// Adapted from token-weather (anthropics/claude-code-playground, Apache-2.0):
// the context window's fill as a weather word, with a chart of recent turns.

const HISTORY = 12
const BARS = '▁▂▃▄▅▆▇█'
const FORECAST = [
  { upTo: 25, icon: '☀', word: 'Clear', level: 'ok' },
  { upTo: 50, icon: '☁', word: 'Cloudy', level: 'ok' },
  { upTo: 75, icon: '☂', word: 'Showers', level: 'ok' },
  { upTo: 90, icon: '☇', word: 'Storm', level: 'ahead' },
  { upTo: Infinity, icon: '↯', word: 'Compact soon', level: 'high' },
] as const

const FORECAST_COLOR = { ok: undefined, ahead: 'yellow', high: 'red' } as const

const forecastFor = (percent: number) =>
  FORECAST.find(band => percent < band.upTo) ?? FORECAST[FORECAST.length - 1]!

const short = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
      : String(n)

// Bars scale to the busiest reading shown, so growth shows at any fill level.
const chart = (list: readonly UsageBarReading[]) => {
  const top = Math.max(...list.map(r => r.tokens), 1)
  return list
    .map(r => BARS[Math.min(BARS.length - 1, Math.floor((r.tokens / top) * (BARS.length - 1)))])
    .join('')
}

const trendWord = (list: readonly UsageBarReading[]) => {
  const last = list[list.length - 1]
  const prev = list[list.length - 2]
  if (!last || !prev) return ''
  const delta = last.tokens - prev.tokens
  return delta > 0 ? `▲ +${short(delta)} last turn` : delta < 0 ? `▼ ${short(-delta)} last turn` : 'steady'
}

// ---------- desktop usage line (one Svg per figure) ----------
// Drawn like the app's own status text under the prompt: no fills, values in
// primary text, the rest muted, short meters. Each figure is its own Svg so
// the band's row wraps between figures; the space after one is drawn inside
// it, transparent. The weather word shows from Storm up; below that the icon
// carries it (and the alt text names it).
//
// Motion: only what is alive moves (the Claude spark while something works),
// and a value that changes moves once (the number rolls, the meter eases, the
// newest turn's bar grows). The host animates an Svg only when it is
// `isInteractive` (its own sandboxed frame), so a figure asks for that only
// while it moves. Reduced motion holds every figure still.

const FONT = '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif'
const FS = 12
const SVG_H = 22
const MID = SVG_H / 2
const ICON = 12
const METER_W = 80
const SPARK_BAR = 2
const SPARK_STEP = 3
const GAP = 5
const GAP_GROUP = 15
const MOTION_MS = 2_500

// Advance widths of the app's UI face (SF Pro Text at 12px, tabular figures),
// in em, regular then semibold, measured in Chromium. Other glyphs use AVG.
const ADVANCE: Record<string, readonly [number, number]> = {
  ' ': [0.281, 0.266], '0': [0.630, 0.658], '1': [0.630, 0.658], '2': [0.630, 0.658], '3': [0.630, 0.658],
  '4': [0.630, 0.658], '5': [0.630, 0.658], '6': [0.630, 0.658], '7': [0.630, 0.658], '8': [0.630, 0.658],
  '9': [0.630, 0.658], '.': [0.297, 0.331], ',': [0.297, 0.331], ':': [0.297, 0.331], '%': [0.925, 0.999],
  '$': [0.630, 0.658], '/': [0.305, 0.325], '+': [0.630, 0.658], '-': [0.472, 0.480], 'a': [0.552, 0.577],
  'b': [0.614, 0.639], 'c': [0.560, 0.578], 'd': [0.614, 0.639], 'e': [0.571, 0.591], 'f': [0.362, 0.396],
  'g': [0.609, 0.633], 'h': [0.588, 0.618], 'i': [0.247, 0.274], 'j': [0.247, 0.273], 'k': [0.543, 0.582],
  'l': [0.253, 0.281], 'm': [0.870, 0.912], 'n': [0.584, 0.613], 'o': [0.591, 0.610], 'p': [0.610, 0.635],
  'q': [0.609, 0.635], 'r': [0.391, 0.423], 's': [0.514, 0.542], 't': [0.363, 0.399], 'u': [0.584, 0.613],
  'v': [0.542, 0.569], 'w': [0.774, 0.823], 'x': [0.524, 0.562], 'y': [0.543, 0.579], 'z': [0.539, 0.557],
  'A': [0.674, 0.713], 'B': [0.657, 0.681], 'C': [0.716, 0.733], 'D': [0.727, 0.740], 'E': [0.596, 0.613],
  'F': [0.572, 0.589], 'G': [0.747, 0.756], 'H': [0.742, 0.769], 'I': [0.268, 0.301], 'J': [0.538, 0.580],
  'K': [0.659, 0.692], 'L': [0.568, 0.586], 'M': [0.874, 0.895], 'N': [0.742, 0.759], 'O': [0.771, 0.781],
  'P': [0.635, 0.661], 'Q': [0.771, 0.781], 'R': [0.653, 0.681], 'S': [0.637, 0.663], 'T': [0.634, 0.651],
  'U': [0.737, 0.752], 'V': [0.674, 0.706], 'W': [0.968, 0.996], 'X': [0.679, 0.712], 'Y': [0.655, 0.690],
  'Z': [0.662, 0.671],
}
const AVG = [0.62, 0.65] as const
// Arrows, dashes, symbols and other scripts run wider; count them as a full em.
const WIDE = [1, 1] as const

const textWidth = (text: string, bold: boolean) =>
  [...text].reduce((sum, ch) => sum + (ADVANCE[ch] ?? (ch.charCodeAt(0) > 0x7e ? WIDE : AVG))[bold ? 1 : 0], 0) * FS

// The app's colours, light then dark. Light is the claude.ai theme (text-100,
// text-500, border, warning-100, danger-100, clay); dark is sampled from the
// Claude Code window, with warning-000, danger-000 and clay. The desktop app
// sets Chromium's color scheme from its own theme setting, so
// `prefers-color-scheme` inside each Svg follows the app's theme.
const PALETTE = {
  ink: ['#141413', '#e9e9e9'],
  muted: ['#73726c', '#9a9a9a'],
  faint: ['#a3a29b', '#666666'],
  track: ['rgba(31,30,29,.13)', 'rgba(255,255,255,.14)'],
  pace: ['rgba(31,30,29,.2)', 'rgba(255,255,255,.22)'],
  mark: ['#141413', '#f2f2f2'],
  band: ['#f0eee6', '#212121'],
  warn: ['#875a08', '#da9e25'],
  bad: ['#b53333', '#fe8181'],
  clay: ['#c6613f', '#d97757'],
} as const satisfies Record<string, readonly [string, string]>

type Tone = keyof typeof PALETTE

const LEVEL_TONE: Record<Row['level'], Tone | null> = { ok: null, ahead: 'warn', high: 'bad' }

// Keyframes by name, added to a figure that uses them. Reduced motion stops
// them all; each one's resting frame is its final state.
const MOTION: Record<string, string> = {
  roll: '.ro{animation:ro .38s cubic-bezier(.22,.61,.36,1) both}.ri{animation:ri .38s cubic-bezier(.22,.61,.36,1) both}@keyframes ro{to{transform:translateY(-9px);opacity:0}}@keyframes ri{from{transform:translateY(9px);opacity:0}}',
  ease: '.ez{transform-box:fill-box;transform-origin:left center;animation:ez .7s cubic-bezier(.22,.61,.36,1) both}@keyframes ez{from{transform:scaleX(var(--from))}}',
  grow: '.gr{transform-box:fill-box;transform-origin:50% 100%;animation:gr .5s cubic-bezier(.22,.61,.36,1) both}@keyframes gr{from{transform:scaleY(0)}}',
}
const REDUCED = '@media (prefers-reduced-motion: reduce){*{animation:none!important}.ro{display:none}}'

// A figure's stylesheet: the tokens it uses as fill (`f-`) and stroke (`s-`)
// classes, light first, then dark under the media query, then its motion.
const styleFor = (fills: ReadonlySet<Tone>, strokes: ReadonlySet<Tone>, motion: ReadonlySet<string>) => {
  const rules = (i: 0 | 1) =>
    [...[...fills].map(k => `.f-${k}{fill:${PALETTE[k][i]}}`), ...[...strokes].map(k => `.s-${k}{stroke:${PALETTE[k][i]}}`)].join('')
  const moving = motion.size ? `${[...motion].map(m => MOTION[m] ?? '').join('')}${REDUCED}` : ''
  return `<style>${rules(0)}@media (prefers-color-scheme: dark){${rules(1)}}${moving}</style>`
}

const ICONS: Record<string, string> = {
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  Clear:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  Cloudy: '<path d="M7 19h10a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.2 10.9 4 4 0 0 0 7 19z"/>',
  Showers:
    '<path d="M7 15h10a4 4 0 0 0 .5-7.96A5.5 5.5 0 0 0 6.6 8.4 3.6 3.6 0 0 0 7 15z"/><path d="M8 18v2M12 18v2M16 18v2"/>',
  Storm: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  'Compact soon':
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Part =
  | { type: 'icon'; name: string; color: Tone; size?: number }
  | { type: 'text'; text: string; color: Tone; bold?: boolean; from?: string }
  | { type: 'meter'; percent: number; pace: number | null; level: Row['level']; from?: number }
  | { type: 'spark'; values: number[]; color: Tone; grow?: boolean }
  | { type: 'gap'; w: number }

const partWidth = (p: Part) => {
  switch (p.type) {
    case 'icon':
      return p.size ?? ICON
    case 'text':
      return Math.max(textWidth(p.text, p.bold === true), p.from === undefined ? 0 : textWidth(p.from, p.bold === true)) + 1
    case 'meter':
      return METER_W
    case 'spark':
      return Math.max(1, p.values.length) * SPARK_STEP - (SPARK_STEP - SPARK_BAR)
    case 'gap':
      return p.w
  }
}

type Used = { fills: Set<Tone>; strokes: Set<Tone>; motion: Set<string>; clips: string[] }

const newUsed = (): Used => ({ fills: new Set<Tone>(), strokes: new Set<Tone>(), motion: new Set<string>(), clips: [] })

const textAt = (text: string, x: number, color: Tone, bold: boolean | undefined, cls = '') =>
  `<text x="${x.toFixed(1)}" y="${MID}" dominant-baseline="central" class="f-${color}${cls ? ` ${cls}` : ''}"${bold ? ' font-weight="600"' : ''}>${esc(text)}</text>`

const drawPart = (p: Part, x: number, used: Used) => {
  switch (p.type) {
    case 'icon': {
      used.strokes.add(p.color)
      const size = p.size ?? ICON
      return `<g transform="translate(${x.toFixed(1)} ${MID - size / 2}) scale(${size / 24})" fill="none" class="s-${p.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.name] ?? ''}</g>`
    }
    case 'text': {
      used.fills.add(p.color)
      if (p.from === undefined || p.from === p.text) return textAt(p.text, x, p.color, p.bold)
      // The old value rolls up and out as the new one rolls in, clipped to the line.
      used.motion.add('roll')
      const id = `c${used.clips.length}`
      used.clips.push(`<clipPath id="${id}"><rect x="${x.toFixed(1)}" y="${MID - 8}" width="${partWidth(p).toFixed(1)}" height="16"/></clipPath>`)
      return `<g clip-path="url(#${id})">${textAt(p.from, x, p.color, p.bold, 'ro')}${textAt(p.text, x, p.color, p.bold, 'ri')}</g>`
    }
    case 'meter': {
      // Time as a shadow: the share of the window already passed is a soft
      // band, the usage a solid bar over it. Usage past the band runs ahead of
      // time, and only that overhang turns amber; at the cap all of it is red.
      // Right of the "now" mark is the time left until the reset.
      used.fills.add('track')
      const y = MID - 3
      const usedW = (clamp(p.percent, 0, 100) / 100) * METER_W
      const paceW = p.pace === null ? METER_W : clamp(p.pace, 0, 1) * METER_W
      const under = Math.min(usedW, paceW)
      const over = Math.max(0, usedW - paceW)
      const high = p.level === 'high'
      let shadow = ''
      if (p.pace !== null && paceW > 0) {
        used.fills.add('pace')
        shadow = `<rect x="${x.toFixed(1)}" y="${y}" width="${paceW.toFixed(1)}" height="6" rx="3" class="f-pace"/>`
      }
      const mainTone: Tone = high ? 'bad' : 'ink'
      used.fills.add(mainTone)
      let bar = under > 0 ? `<rect x="${x.toFixed(1)}" y="${y + 1}" width="${Math.max(under, 2).toFixed(1)}" height="4" rx="2" class="f-${mainTone}"${high ? '' : ' opacity=".85"'}/>` : ''
      if (over > 0) {
        const overTone: Tone = high ? 'bad' : 'warn'
        used.fills.add(overTone)
        const from = Math.max(0, paceW - 2)
        bar += `<rect x="${(x + from).toFixed(1)}" y="${y + 1}" width="${(usedW - from).toFixed(1)}" height="4" rx="2" class="f-${overTone}"/>`
      }
      if (bar && p.from !== undefined && p.from !== p.percent && p.percent > 0) {
        used.motion.add('ease')
        bar = `<g class="ez" style="--from:${(clamp(p.from, 0, 100) / clamp(p.percent, 1, 100)).toFixed(3)}">${bar}</g>`
      }
      // "Now": a slim upright mark where the time passed ends, above the bar and
      // cut out of it in the band's colour, so it reads over ink, amber or red.
      let nowMark = ''
      if (p.pace !== null) {
        used.fills.add('band').add('mark')
        const nx = x + clamp(paceW, 1, METER_W - 1)
        nowMark = `<rect x="${(nx - 1.5).toFixed(1)}" y="${y}" width="3" height="6" class="f-band"/><rect x="${(nx - 0.5).toFixed(1)}" y="${MID - 6}" width="1" height="12" rx=".5" class="f-mark"/>`
      }
      return `<rect x="${x.toFixed(1)}" y="${y}" width="${METER_W}" height="6" rx="3" class="f-track"/>${shadow}${bar}${nowMark}`
    }
    case 'spark': {
      // The latest turn in the figure's tone, the earlier ones as track, all
      // scaled to the busiest turn shown; a new turn's bar grows in.
      used.fills.add('track').add(p.color)
      if (p.grow) used.motion.add('grow')
      const top = Math.max(...p.values, 1)
      return p.values
        .map((v, i) => {
          const h = Math.max(1.5, (v / top) * 10)
          const last = i === p.values.length - 1
          const cls = `f-${last ? p.color : 'track'}${last && p.grow ? ' gr' : ''}`
          return `<rect x="${(x + i * SPARK_STEP).toFixed(1)}" y="${(MID + 5 - h).toFixed(1)}" width="${SPARK_BAR}" height="${h.toFixed(1)}" rx="1" class="${cls}"/>`
        })
        .join('')
    }
    case 'gap':
      return ''
  }
}

type Figure = { source: string; alt: string; width: number; height: number; animated: boolean }

const svgDoc = (width: number, height: number, used: Used, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family='${FONT}' font-size="${FS}" style="font-variant-numeric:tabular-nums">${styleFor(used.fills, used.strokes, used.motion)}${used.clips.length ? `<defs>${used.clips.join('')}</defs>` : ''}${body}</svg>`

const figure = (parts: Part[], alt: string, after: number): Figure => {
  const used = newUsed()
  let x = 0
  const body = parts
    .map(p => {
      const out = drawPart(p, x, used)
      x += partWidth(p)
      return out
    })
    .join('')
  // Text widths carry a pixel of slack each: they are measured, not read from the font here.
  const width = Math.ceil(x + after)
  return { source: svgDoc(width, SVG_H, used, body), alt, width, height: SVG_H, animated: used.motion.size > 0 }
}

// What the band last drew per figure, so a change rolls or eases once: the
// previous value for MOTION_MS after a change, else undefined.
const drawn = new Map<string, { value: string | number; prev?: string | number; at: number }>()
const changeOf = <T extends string | number>(key: string, value: T): T | undefined => {
  const last = drawn.get(key)
  if (!last) {
    drawn.set(key, { value, at: 0 })
    return undefined
  }
  if (last.value !== value) drawn.set(key, { value, prev: last.value, at: Date.now() })
  const cur = drawn.get(key)!
  return cur.prev !== undefined && Date.now() - cur.at < MOTION_MS ? (cur.prev as T) : undefined
}

const windowFigure = (row: Row, after: number) => {
  const tone = LEVEL_TONE[row.level]
  const from = changeOf(`window:${row.kind}`, row.percent)
  const parts: Part[] = [
    { type: 'text', text: row.label, color: tone ?? 'muted' },
    { type: 'gap', w: GAP },
    { type: 'meter', percent: row.percent, pace: row.pace, level: row.level, from },
    { type: 'gap', w: GAP },
    { type: 'text', text: `${row.percent}%`, color: tone ?? 'ink', bold: true, from: from === undefined ? undefined : `${from}%` },
  ]
  if (row.left) {
    parts.push(
      { type: 'gap', w: GAP },
      { type: 'icon', name: 'reset', color: 'muted', size: 11 },
      { type: 'gap', w: 3 },
      { type: 'text', text: row.left, color: 'muted' },
    )
  }
  const alt = `${row.label} ${row.percent}% used${row.left ? `, resets in ${row.left}` : ''}`
  return figure(parts, alt, after)
}

const weatherFigure = (history: readonly UsageBarReading[], after: number): Figure | null => {
  const latest = history[history.length - 1]
  if (!latest) return null
  const f = forecastFor(latest.percent)
  const tone = LEVEL_TONE[f.level]
  const from = changeOf('context', latest.percent)
  const grew = changeOf('context:tokens', latest.tokens) !== undefined
  const parts: Part[] = [
    { type: 'icon', name: f.word, color: tone ?? 'muted' },
    { type: 'gap', w: GAP },
  ]
  if (tone) parts.push({ type: 'text', text: f.word, color: tone }, { type: 'gap', w: GAP })
  parts.push(
    { type: 'spark', values: history.map(r => r.tokens), color: tone ?? 'muted', grow: grew },
    { type: 'gap', w: GAP },
    { type: 'text', text: `${latest.percent}%`, color: tone ?? 'ink', bold: true, from: from === undefined ? undefined : `${from}%` },
    { type: 'gap', w: GAP },
    { type: 'text', text: `${short(latest.tokens)}/${short(latest.window)}`, color: 'muted' },
  )
  const alt = `Context ${f.word}: ${latest.percent}% of the window, ${short(latest.tokens)} of ${short(latest.window)}`
  return figure(parts, alt, 0)
}

const desktopFigures = (rows: Row[], history: readonly UsageBarReading[]): Figure[] => {
  // Each figure carries the space after it, so the next one follows at the
  // same rhythm, or starts a row flush when it wraps.
  const weather = weatherFigure(history, GAP_GROUP)
  return [...rows.map(r => windowFigure(r, GAP_GROUP)), ...(weather ? [weather] : [])]
}

// ---------- marks for the family line and the list ----------
// The Claude spark: the frames the CLI's own spinner turns through while it
// works, forward then back, in the Claude clay colour. A child's mark is the moving spark while it works, an amber dot while it
// asks you, a muted dot while idle, an empty ring once its process ended.

const SPARK_FRAMES = ['·', '✢', '✳︎', '✶', '✻', '✽']
const SPARK_SEQ = [...SPARK_FRAMES, ...[...SPARK_FRAMES].reverse()]
const SPARK_MS = 120
const MARK = 14

type MarkKind = 'working' | 'needs' | 'idle' | 'stopped'

const mark = (kind: MarkKind, alt: string): Figure => {
  const used = newUsed()
  const c = MARK / 2
  const glyph = (ch: string, tone: Tone, cls = '', style = '') => {
    used.fills.add(tone)
    return `<text x="${c}" y="${c + 0.5}" text-anchor="middle" dominant-baseline="central" font-size="13" class="f-${tone}${cls ? ` ${cls}` : ''}"${style ? ` style="${style}"` : ''}>${ch}</text>`
  }
  let body: string
  let animated = false
  if (kind === 'working') {
    // One frame shows per step; reduced motion shows the still ✻ alone.
    const cycle = SPARK_SEQ.length * SPARK_MS
    const step = (100 / SPARK_SEQ.length).toFixed(3)
    body =
      `<style>.sf{opacity:0;animation:sf ${cycle}ms steps(1) infinite}@keyframes sf{0%{opacity:1}${step}%{opacity:0}}.still{opacity:0}@media (prefers-reduced-motion: reduce){.sf{animation:none}.still{opacity:1}}</style>` +
      SPARK_SEQ.map((ch, i) => glyph(ch, 'clay', 'sf', `animation-delay:${i * SPARK_MS}ms`)).join('') +
      glyph('✻', 'clay', 'still')
    animated = true
  } else if (kind === 'stopped') {
    used.strokes.add('faint')
    body = `<circle cx="${c}" cy="${c}" r="2.6" fill="none" class="s-faint" stroke-width="1.2"/>`
  } else {
    const tone: Tone = kind === 'needs' ? 'warn' : 'muted'
    used.fills.add(tone)
    body = `<circle cx="${c}" cy="${c}" r="3" class="f-${tone}"/>`
  }
  return { source: svgDoc(MARK, MARK, used, body), alt, width: MARK, height: MARK, animated }
}

const age = (since: number, at: number) => {
  const mins = Math.max(0, Math.round((at - since) / 60_000))
  return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
}

const liveIn = (c: UsageBarChild): boolean => c.state !== 'stopped' || c.children.some(liveIn)
const sizeOf = (c: UsageBarChild): number => 1 + c.children.reduce((n, k) => n + sizeOf(k), 0)

// Children with nothing live beneath them fold into one "finished" count.
const finishedOf = (list: readonly UsageBarChild[]): number =>
  list.reduce((n, c) => n + (liveIn(c) ? finishedOf(c.children) : sizeOf(c)), 0)

const STATE_WORD: Record<UsageBarChild['state'], string> = { working: 'working', needs: 'needs you', idle: 'idle', stopped: 'finished' }

// ---------- child sessions ----------
// The desktop app keeps one record per session (`spawnedFrom.sessionId` names
// the session that started it, `postTurnSummary` its last turn), and every
// running session writes ~/.claude/sessions/<pid>.json with its live status.
// Neither is a mod API: when they cannot be read, or a field is missing, the
// family line stays hidden rather than showing a wrong state.

type AppRecord = {
  title: string
  parent: string | null
  archived: boolean
  detail: string
  needs: string
  activity: number
  mtime: number
}
type LiveSession = { cli: string; cwd: string; status: string; waitingFor: string; since: number; pid: number }

const POLL_MS = 5_000
const MAX_DEPTH = 6
const RANK: Record<UsageBarChild['state'], number> = { needs: 0, working: 1, idle: 2, stopped: 3 }

// Per process: this session's id in the app, and where the app keeps records.
const known = { home: '', host: '', store: '' }
const records = new Map<string, AppRecord>()
let polling = false

const text = (v: unknown) => (typeof v === 'string' ? v : '')
const parse = (raw: string): Record<string, unknown> | null => {
  try {
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
const capital = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

const readLive = async ($: EngineInterface) => {
  const dir = `${known.home}/.claude/sessions`
  const out = new Map<string, LiveSession>()
  for (const entry of await $.fs.list(dir)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    const j = parse(await $.fs.read(`${dir}/${entry.name}`).catch(() => ''))
    const host = text(j?.hostSessionId)
    if (!j || !host) continue
    out.set(host, {
      cli: text(j.sessionId),
      cwd: text(j.cwd),
      status: text(j.status),
      waitingFor: text(j.waitingFor),
      since: Number(j.statusUpdatedAt) || 0,
      pid: Number(j.pid) || 0,
    })
  }
  return out
}

// The app's records sit two folders down, under its data folder or a profile's.
const findStore = async ($: EngineInterface, host: string) => {
  const base = `${known.home}/Library/Application Support/Claude`
  const roots = [`${base}/claude-code-sessions`]
  for (const e of await $.fs.list(base).catch(() => [])) if (e.kind === 'dir') roots.push(`${base}/${e.name}/claude-code-sessions`)
  for (const root of roots) {
    if (!(await $.fs.exists(root).catch(() => false))) continue
    for (const a of await $.fs.list(root)) {
      if (a.kind !== 'dir') continue
      for (const b of await $.fs.list(`${root}/${a.name}`)) {
        const dir = `${root}/${a.name}/${b.name}`
        if (b.kind === 'dir' && (await $.fs.exists(`${dir}/${host}.json`))) return dir
      }
    }
  }
  return ''
}

// Reads only the records whose file changed since the last poll.
const syncRecords = async ($: EngineInterface) => {
  const seen = new Set<string>()
  for (const e of await $.fs.list(known.store)) {
    if (e.kind !== 'file' || !e.name.startsWith('local_') || !e.name.endsWith('.json')) continue
    const id = e.name.slice(0, -'.json'.length)
    seen.add(id)
    if (records.get(id)?.mtime === e.mtimeMs) continue
    const j = parse(await $.fs.read(`${known.store}/${e.name}`).catch(() => ''))
    if (!j) continue
    const spawned = (j.spawnedFrom ?? {}) as Record<string, unknown>
    const summary = (j.postTurnSummary ?? {}) as Record<string, unknown>
    records.set(id, {
      title: text(j.title) || 'Untitled',
      parent: text(spawned.sessionId) || null,
      archived: j.isArchived === true,
      detail: text(summary.status_detail),
      needs: text(summary.needs_action),
      activity: Number(j.lastActivityAt) || 0,
      mtime: e.mtimeMs,
    })
  }
  for (const id of records.keys()) if (!seen.has(id)) records.delete(id)
}

// A session file can outlive a crashed process; `ps` names the live ones.
const alivePids = async ($: EngineInterface, pids: number[]) => {
  if (!pids.length) return new Set<number>()
  const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')])
  return new Set(stdout.split(/\s+/).filter(Boolean).map(Number))
}

// A working child's latest step: its newest progress line or tool
// description, from the end of its transcript (which can pass the 4 MiB a
// read takes, so `tail` reads the last 64 KiB).
const latestStep = async ($: EngineInterface, live: LiveSession) => {
  const path = `${known.home}/.claude/projects/${live.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${live.cli}.jsonl`
  const { stdout } = await $.process.run(['tail', '-c', '65536', path])
  for (const line of stdout.split('\n').slice(1).reverse()) {
    const j = parse(line)
    const content = (j?.message as { content?: unknown } | undefined)?.content
    if (j?.type !== 'assistant' || !Array.isArray(content)) continue
    for (const block of [...(content as Record<string, unknown>[])].reverse()) {
      const said =
        block.type === 'text' ? text(block.text) : block.type === 'tool_use' ? text((block.input as Record<string, unknown> | undefined)?.description) : ''
      // First line, without Markdown marks or a leading form of address.
      const first = (said.trim().split('\n')[0] ?? '').replace(/[*`_#>]/g, '').replace(/^[A-Z][a-z]+, /, '').trim()
      if (first) return capital(first.length > 160 ? `${first.slice(0, 159)}…` : first)
    }
  }
  return ''
}

const sortChildren = (list: UsageBarChild[]) => list.sort((a, b) => RANK[a.state] - RANK[b.state] || b.since - a.since)

const buildFamily = async (
  $: EngineInterface,
  live: ReadonlyMap<string, LiveSession>,
  alive: ReadonlySet<number>,
): Promise<UsageBarFamily | null> => {
  const kids = new Map<string, string[]>()
  for (const [id, r] of records) if (r.parent && !r.archived) kids.set(r.parent, [...(kids.get(r.parent) ?? []), id])
  const top = kids.get(known.host) ?? []
  if (!top.length) return null
  const counts = { working: 0, needs: 0, idle: 0 }
  const node = async (id: string, depth: number): Promise<UsageBarChild> => {
    const r = records.get(id)!
    const l = live.get(id)
    const running = l !== undefined && alive.has(l.pid)
    // Needs you only while a question or permission prompt is open in it: the
    // app's after-turn summary also says "blocked" when the child handed its
    // work back, or asks for something in another session.
    const waiting = running && l.status === 'waiting'
    const state: UsageBarChild['state'] = running && l.status === 'busy' ? 'working' : waiting ? 'needs' : running ? 'idle' : 'stopped'
    counts[state === 'working' ? 'working' : state === 'needs' ? 'needs' : 'idle'] += 1
    const doing =
      state === 'working'
        ? (await latestStep($, l!).catch(() => '')) || r.detail
        : state === 'needs'
          ? r.needs || capital(l!.waitingFor) || r.detail
          : r.detail
    const since = state === 'working' || waiting ? l!.since : r.activity
    const children = depth < MAX_DEPTH ? await Promise.all((kids.get(id) ?? []).map(k => node(k, depth + 1))) : []
    return { id, title: r.title, state, doing, since, children: sortChildren(children) }
  }
  const children = sortChildren(await Promise.all(top.map(k => node(k, 1))))
  return { children, ...counts }
}

const pollFamily = async ($: EngineInterface) => {
  if (polling || known.store === '-') return
  polling = true
  try {
    known.home ||= (await $.env.get('HOME')) ?? ''
    const live = await readLive($)
    if (!known.host) {
      const me = await $.session.id()
      known.host = [...live].find(([, l]) => l.cli === me)?.[0] ?? ''
      if (!known.host) return
    }
    // '-': no app records on this machine (a plain terminal, another OS); stop looking.
    known.store ||= (await findStore($, known.host)) || '-'
    if (known.store === '-') return
    await syncRecords($)
    const hasKids = [...records.values()].some(r => r.parent === known.host && !r.archived)
    const pids = [...live.values()].map(l => l.pid).filter(Boolean)
    const alive = hasKids ? await alivePids($, pids).catch(() => new Set(pids)) : new Set<number>()
    const next = hasKids ? await buildFamily($, live, alive) : null
    if (JSON.stringify(await read($, family)) !== JSON.stringify(next)) await update($, family, () => next)
  } catch {
    // Keep the last family; the next poll tries again.
  } finally {
    polling = false
  }
}

// ---------- Clawd ----------
// The mascot as Claude Code 2.1.295 draws him: nine columns by three rows of
// block characters, body `clawd_body` rgb(215,119,87), eyes cut out on
// `clawd_background` black. His eyes, arms, feet and turn-around frames are
// the CLI's own glyph tables; a quadrant of a cell is one 1 × 2 pixel, as a
// terminal cell is twice as tall as it is wide. Props and emotes are square
// pixels on the same grid. He is drawn at exactly two screen pixels per unit,
// so he stays sharp at any display scale.
//
// What he does follows what the session does (the tool it runs and on what
// kind of file, how a turn ends, children waiting, limits, context, idle
// time), so the same rules hold for any project. A behaviour is a loop of
// poses sampled at 10 frames a second and compiled into one Svg whose
// frames take turns through CSS steps: no script runs in it.

const CLAWD_ARMS = {
  down: [' ▐', '', '▝▜', '█▀'],
  up: ['▗▟', '▄', ' ▜', '█▘'],
  'one-up': [' ▐', '▄', '▝▜', '█▘'],
} as const
type Arms = keyof typeof CLAWD_ARMS
const CLAWD_EYES = {
  open: [['▛███▛█', false]],
  left: [['▟███▟█', false]],
  right: [['█▟███▟', false]],
  closed: [['▂', true], ['███', false], ['▂', true], ['█', false]],
  wink: [['▛███', false], ['▂', true], ['█', false]],
} as const
type Eyes = keyof typeof CLAWD_EYES
const CLAWD_FEET = { both: ' ▝▝   ▝▝ ', left: ' ▝▝      ', right: '      ▝▝ ' } as const
type Feet = keyof typeof CLAWD_FEET
// Turn-around frames: the row's glyphs and, for the two body rows, the
// columns the eye background spans.
const CLAWD_FACING = {
  'right-30': [['  █▛██▛▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
  edge: [['   ▐██   ', 4, 6], ['   ▐██   ', 4, 6], ['   ▝ ▝   ', 0, 0]],
  back: [[' ▐██████ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
} as const
type Facing = keyof typeof CLAWD_FACING
const QUADRANTS: Record<string, readonly number[]> = {
  ' ': [0, 0, 0, 0], '█': [1, 1, 1, 1], '▐': [0, 1, 0, 1], '▌': [1, 0, 1, 0], '▀': [1, 1, 0, 0], '▄': [0, 0, 1, 1],
  '▛': [1, 1, 1, 0], '▜': [1, 1, 0, 1], '▙': [1, 0, 1, 1], '▟': [0, 1, 1, 1], '▝': [0, 1, 0, 0], '▘': [1, 0, 0, 0],
  '▗': [0, 0, 0, 1], '▖': [0, 0, 1, 0],
}

// Props and emotes: '#' outline, 'w' paper, 's' screen, 'l' rule, 'o' clay,
// 'a' amber, 'b' blue, 'g' glass, 'h' wood.
const PROPS: Record<string, readonly string[]> = {
  laptop: ['###########', '#sssssssss#', '#swwwssoss#', '#ssoobbbss#', '#swwssssss#', '#sssssssss#', '###########', '.#########.', '###########'],
  laptop2: ['###########', '#sssssssss#', '#swwwssoss#', '#ssoobbbss#', '#swwsoobbs#', '#sswssssss#', '###########', '.#########.', '###########'],
  book: ['.###..###.', '#www##www#', '#wll##wll#', '#www##www#', '#wll##wll#', '#www##www#', '.########.'],
  book2: ['.###..###.', '#www##ww#.', '#wll##wl#.', '#www##ww#.', '#wll##w#..', '#www###...', '.######...'],
  lens: ['..####...', '.#gggg#..', '#gg..gg#.', '#g.ww.g#.', '#gg..gg#.', '.#gggg#..', '..####h..', '......hh.', '.......hh'],
  palette: ['..######..', '.#owwaaw#.', '#wwwwwwbb#', '#ww##wwww#', '#wwwwwwww#', '.########.'],
  brush: ['....oo', '...oo.', '..##..', '.hh...', 'hh....', 'h.....'],
  pencil: ['.....oo', '....aao', '...aaa.', '..aaa..', '.aaa...', '#aa....', 's#.....'],
  paper: ['#########', '#wwwwwww#', '#wlllllw#', '#wwwwwww#', '#wlllwww#', '#wwwwwww#', '#########'],
  paper2: ['#########', '#wwwwwww#', '#wlllllw#', '#wwwwwww#', '#wllllww#', '#wwwwwww#', '#########'],
  term: ['############', '#oab########', '############', '#ssssssssss#', '#swssssssss#', '#sswsssssss#', '#swsswwssss#', '#ssssssssss#', '############'],
  term2: ['############', '#oab########', '############', '#ssssssssss#', '#swssssssss#', '#sswsssssss#', '#swssssssss#', '#ssssssssss#', '############'],
  browser: ['############', '#oab#llllll#', '############', '#wwwwwwwwww#', '#wbbbwwllww#', '#wbbbwwwwww#', '#wwwwwllllw#', '#wwwwwwwwww#', '############'],
  flag: ['#ooooo.', '#oooooo', '#ooooo.', '#......', '#......', '#......', '#......', '#......'],
  flag2: ['#oooooo', '#ooooo.', '#oooooo', '#......', '#......', '#......', '#......', '#......'],
  rocket: ['..#..', '.#w#.', '.#w#.', '.#o#.', '#####', '#.#.#', '.aaa.', '..a..'],
  rocket2: ['..#..', '.#w#.', '.#w#.', '.#o#.', '#####', '#.#.#', '.a.a.', '.aaa.'],
}
const EMOTES: Record<string, readonly string[]> = {
  dots1: ['o....'],
  dots2: ['o.o..'],
  dots3: ['o.o.o'],
  bang: ['a', 'a', 'a', '.', 'a'],
  q: ['.bb.', 'b..b', '...b', '..b.', '....', '..b.'],
  heart: ['oo.oo', 'ooooo', '.ooo.', '..o..'],
  z: ['####', '..#.', '.#..', '####'],
  zs: ['###', '.#.', '###'],
  spark: ['..a..', '..a..', 'aaaaa', '..a..', '..a..'],
  spark2: ['a...a', '.a.a.', '..a..', '.a.a.', 'a...a'],
  drop: ['.b.', 'bbb', 'bbb', '.b.'],
  note: ['..##', '..#.', '..#.', '###.', '##..'],
}
const BUBBLED = new Set(['dots1', 'dots2', 'dots3', 'bang', 'q', 'heart'])
const PIXEL_CLASS: Record<string, string> = { '#': 'k', w: 'w', s: 's', l: 'l', o: 'o', a: 'a', b: 'bl', g: 'g', h: 'h' }
// Light then dark, the app's tokens where it has them.
const CLAWD_PALETTE: Record<string, readonly [string, string]> = {
  cb: ['#d97757', '#d97757'],
  ce: ['#000000', '#000000'],
  k: ['#5f5e58', '#8f8f8f'],
  w: ['#ffffff', '#e9e9e9'],
  s: ['#2b2a27', '#121212'],
  l: ['#b8b6ad', '#6b6b6b'],
  o: ['#c6613f', '#d97757'],
  a: ['#c98a1d', '#da9e25'],
  bl: ['#3b74c7', '#6aa6e6'],
  g: ['#cfe1f5', '#3a5a7a'],
  h: ['#8a5a3c', '#a0694a'],
  bub: ['#ffffff', '#3a3a3a'],
}

// The stage is as tall as the two lines beside it: emotes sit to his left,
// props to his right, so he can be drawn at 3 screen pixels a unit.
const STAGE_W = 40
const STAGE_H = 14
const STAGE_SCALE = 3
const BODY_X = 8
const BODY_Y = 2
const PROP_X = 27
const FRAME_MS = 100

type Pose = {
  eyes?: Eyes
  arms?: Arms
  feet?: Feet
  facing?: Facing
  dy?: number
  prop?: readonly [string, number, number]
  prop2?: readonly [string, number, number]
  emote?: string | null
  emoteDy?: number
  emoteFaded?: boolean
  phones?: boolean
}

type Pixel = { x: number; y: number; w: number; h: number; c: string }

const quadPixels = (glyphs: string, col: number, row: number, mode: 'eyes' | 'lid' | null, ox: number, oy: number, out: Pixel[]) => {
  ;[...glyphs].forEach((ch, i) => {
    const x = ox + (col + i) * 2
    const y = oy + row * 4
    if (mode === 'lid') {
      out.push({ x, y, w: 2, h: 3, c: 'cb' }, { x, y: y + 3, w: 2, h: 1, c: 'ce' })
      return
    }
    if (mode === 'eyes') out.push({ x, y, w: 2, h: 4, c: 'ce' })
    const q = QUADRANTS[ch] ?? [0, 0, 0, 0]
    q.forEach((on, k) => {
      if (on) out.push({ x: x + (k % 2), y: y + (k > 1 ? 2 : 0), w: 1, h: 2, c: 'cb' })
    })
  })
}

const bodyPixels = (p: Pose, ox: number, oy: number, out: Pixel[]) => {
  if (p.facing) {
    CLAWD_FACING[p.facing].forEach(([glyphs, from, to], row) => {
      ;[...glyphs].forEach((ch, col) => quadPixels(ch, col, row, row < 2 && col >= from && col < to ? 'eyes' : null, ox, oy, out))
    })
    return
  }
  const arms = CLAWD_ARMS[p.arms ?? 'down']
  quadPixels('█████', 2, 1, 'eyes', ox, oy, out)
  quadPixels(CLAWD_FEET[p.feet ?? 'both'], 0, 2, null, ox, oy, out)
  let col = 2
  for (const [glyphs, lid] of CLAWD_EYES[p.eyes ?? 'open']) {
    quadPixels(glyphs, col, 0, lid ? 'lid' : 'eyes', ox, oy, out)
    col += [...glyphs].length
  }
  quadPixels(arms[0], 0, 0, null, ox, oy, out)
  quadPixels(arms[1], 8, 0, null, ox, oy, out)
  quadPixels(arms[2], 0, 1, null, ox, oy, out)
  quadPixels(arms[3], 7, 1, null, ox, oy, out)
}

const bitmapPixels = (rows: readonly string[], ox: number, oy: number, out: Pixel[]) =>
  rows.forEach((r, y) => [...r].forEach((ch, x) => PIXEL_CLASS[ch] && out.push({ x: ox + x, y: oy + y, w: 1, h: 1, c: PIXEL_CLASS[ch]! })))

const posePixels = (p: Pose): Pixel[] => {
  const out: Pixel[] = []
  const dy = p.dy ?? 0
  bodyPixels(p, BODY_X, BODY_Y + dy, out)
  // Headphones while Claude FM plays: a band over his head, a cup at each side.
  if (p.phones && !p.facing) {
    const top = BODY_Y + dy - 2
    out.push(
      { x: BODY_X + 3, y: top, w: 12, h: 1, c: 'k' },
      { x: BODY_X + 2, y: top + 1, w: 1, h: 2, c: 'k' },
      { x: BODY_X + 15, y: top + 1, w: 1, h: 2, c: 'k' },
      { x: BODY_X, y: top + 2, w: 3, h: 4, c: 's' },
      { x: BODY_X + 15, y: top + 2, w: 3, h: 4, c: 's' },
    )
  }
  if (p.prop) bitmapPixels(PROPS[p.prop[0]] ?? [], p.prop[1], p.prop[2], out)
  if (p.prop2) bitmapPixels(PROPS[p.prop2[0]] ?? [], p.prop2[1], p.prop2[2], out)
  if (p.emote) {
    const rows = EMOTES[p.emote] ?? []
    if (BUBBLED.has(p.emote)) {
      // A bubble at his left, its tail pointing at him.
      const w = (rows[0]?.length ?? 1) + 2
      const h = rows.length + 2
      const x = BODY_X - w - 1
      const top = 1
      out.push({ x, y: top, w, h, c: 'bub' }, { x: x + w, y: top + Math.floor(h / 2), w: 1, h: 1, c: 'bub' })
      bitmapPixels(rows, x + 1, top + 1, out)
    } else {
      bitmapPixels(rows, 1, 3 + (p.emoteDy ?? 0) + dy, out)
    }
  }
  return out
}

// One pose as Svg rects, runs of one colour on a row merged.
const poseSvg = (p: Pose) => {
  const px = posePixels(p)
  const faded = p.emoteFaded ? new Set(px.slice(-((EMOTES[p.emote ?? ''] ?? []).join('').replace(/\./g, '').length))) : null
  // Eye backgrounds first, under the body that cuts the eyes out of them;
  // then the rest by row, so runs of one colour merge.
  const under = (q: Pixel) => (q.c === 'ce' && q.h === 4 ? 0 : 1)
  const sorted = [...px].sort((a, b) => under(a) - under(b) || a.y - b.y || a.h - b.h || a.x - b.x)
  const merged: Pixel[] = []
  for (const q of sorted) {
    const last = merged[merged.length - 1]
    if (last && !faded?.has(q) && under(last) === under(q) && last.y === q.y && last.h === q.h && last.c === q.c && last.x + last.w === q.x) last.w += q.w
    else merged.push({ ...q })
  }
  return merged.map(q => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" class="${q.c}"${faded?.has(q) ? ' opacity=".35"' : ''}/>`).join('')
}

// ---------- behaviours: a pose at time t (seconds), looping every `period` ----------

type Behaviour =
  | 'idle' | 'thinking' | 'coding' | 'focused' | 'reading' | 'research' | 'design' | 'writing' | 'terminal'
  | 'browser' | 'leading' | 'shipping' | 'happy' | 'proud' | 'worried' | 'alert' | 'tired' | 'asleep' | 'greeting' | 'listening'

const flip = (t: number, every: number) => Math.floor(t / every + 1e-6) % 2 === 1

const BEHAVIOURS: Record<Behaviour, { period: number; word: string; pose: (t: number) => Pose }> = {
  // Lively idle: blinks and glances, and now and then stretches, taps his
  // feet or turns round to look behind him.
  idle: {
    period: 24,
    word: 'idle',
    pose: t => {
      const p: Pose = { eyes: t % 4 < 0.15 ? 'closed' : t % 12 >= 8 && t % 12 < 9 ? 'left' : t % 12 >= 9 && t % 12 < 10 ? 'right' : 'open' }
      if (t >= 14 && t < 15.6) p.arms = 'up'
      if (t >= 18 && t < 20) p.feet = flip(t, 0.25) ? 'left' : 'right'
      if (t >= 21 && t < 23) p.facing = t < 21.3 || t >= 22.7 ? 'right-30' : t < 21.6 || t >= 22.4 ? 'edge' : 'back'
      return p
    },
  },
  thinking: { period: 3.6, word: 'thinking', pose: t => ({ eyes: flip(t, 0.9) ? 'left' : 'right', emote: ['dots1', 'dots2', 'dots3'][Math.floor(t / 0.4 + 1e-6) % 3] }) },
  coding: { period: 3.6, word: 'coding', pose: t => ({ eyes: 'right', arms: flip(t, 0.2) ? 'one-up' : 'down', prop: [flip(t, 0.6) ? 'laptop2' : 'laptop', PROP_X, 5] }) },
  focused: { period: 1.2, word: 'heads-down', pose: t => ({ facing: 'back', prop: [flip(t, 0.6) ? 'laptop2' : 'laptop', PROP_X, 5] }) },
  reading: { period: 7, word: 'reading', pose: t => ({ eyes: flip(t, 0.7) ? 'left' : 'right', arms: 'one-up', prop: [t % 7 < 0.4 ? 'book2' : 'book', PROP_X, 1] }) },
  research: { period: 4, word: 'researching', pose: t => ({ eyes: 'right', arms: 'one-up', prop: ['lens', PROP_X, flip(t, 0.5) ? 1 : 0], emote: t % 4 < 1 ? 'q' : null }) },
  design: { period: 2, word: 'designing', pose: t => ({ eyes: 'right', arms: flip(t, 0.5) ? 'one-up' : 'down', prop: ['palette', PROP_X + 3, 8], prop2: ['brush', PROP_X - 1, flip(t, 0.5) ? 2 : 0], emote: t % 2 < 0.5 ? 'spark2' : null }) },
  writing: { period: 2.4, word: 'writing', pose: t => ({ eyes: 'right', arms: flip(t, 0.3) ? 'one-up' : 'down', prop: [flip(t, 1.2) ? 'paper2' : 'paper', PROP_X + 2, 7], prop2: ['pencil', PROP_X + 5, flip(t, 0.3) ? 1 : 0] }) },
  terminal: { period: 1, word: 'at the terminal', pose: t => ({ eyes: 'right', feet: flip(t, 0.5) ? 'left' : 'both', prop: [flip(t, 0.5) ? 'term2' : 'term', PROP_X, 5] }) },
  browser: { period: 2.2, word: 'testing in the browser', pose: t => ({ eyes: flip(t, 1.1) ? 'right' : 'open', arms: 'one-up', prop: ['browser', PROP_X, 3] }) },
  leading: { period: 0.8, word: 'leading', pose: t => ({ eyes: 'open', arms: flip(t, 0.4) ? 'one-up' : 'down', prop: [flip(t, 0.4) ? 'flag2' : 'flag', PROP_X, flip(t, 0.4) ? 0 : 2] }) },
  shipping: {
    period: 2.4,
    word: 'shipping',
    pose: t => ({ eyes: 'right', arms: t > 0.6 ? 'up' : 'down', prop: [flip(t, 0.2) ? 'rocket2' : 'rocket', PROP_X + 5, Math.round(Math.max(-10, 6 - Math.max(0, t - 0.6) * 14))] }),
  },
  happy: { period: 2.4, word: 'happy', pose: t => ({ eyes: 'open', arms: 'up', dy: t < 0.2 || (t >= 0.4 && t < 0.6) ? -2 : 0, emote: flip(t, 0.3) ? 'spark' : 'spark2' }) },
  proud: { period: 3, word: 'proud', pose: t => ({ eyes: t < 0.3 ? 'wink' : 'open', arms: 'up', emote: 'heart' }) },
  worried: { period: 4.8, word: 'worried', pose: t => ({ eyes: t % 1.6 < 0.3 ? 'closed' : 'open', emote: 'drop', emoteDy: Math.floor(t / 0.4 + 1e-6) % 3 }) },
  alert: { period: 1.6, word: 'needs you', pose: t => ({ eyes: 'open', arms: 'up', dy: t < 0.2 ? -2 : 0, emote: t % 0.8 < 0.5 ? 'bang' : null }) },
  tired: { period: 6, word: 'tired', pose: t => ({ eyes: t % 3 < 1.3 ? 'closed' : 'open', emote: t < 2 ? 'drop' : null }) },
  asleep: { period: 2.4, word: 'asleep', pose: t => ({ eyes: 'closed', emote: t < 1.2 ? 'zs' : 'z', emoteDy: -Math.floor(t / 0.6 + 1e-6), emoteFaded: t >= 1.8 }) },
  // Idle with Claude FM on: he nods along, eyes half shut, a note drifting up.
  listening: {
    period: 2,
    word: 'listening to Claude FM',
    pose: t => ({ eyes: t % 2 < 1.2 ? 'closed' : 'open', dy: flip(t, 0.5) ? -1 : 0, feet: flip(t, 0.5) ? 'left' : 'both', emote: 'note', emoteDy: -Math.floor(t / 0.5 + 1e-6) }),
  },
  greeting: { period: 2.4, word: 'waving', pose: t => ({ eyes: 'open', arms: flip(t, 0.3) ? 'one-up' : 'down', emote: t < 1.2 ? 'heart' : null }) },
}

// A behaviour's loop as frames and their timeline: each distinct pose once
// in <defs>, each run of it a <use> shown for its share of the loop.
const timeline = (b: Behaviour, phones: boolean) => {
  const { period, pose } = BEHAVIOURS[b]
  const steps = Math.round((period * 1000) / FRAME_MS)
  const frames: string[] = []
  const runs: { frame: number; from: number; to: number }[] = []
  for (let i = 0; i < steps; i++) {
    const svg = poseSvg({ ...pose((i * FRAME_MS) / 1000), phones })
    let f = frames.indexOf(svg)
    if (f < 0) f = frames.push(svg) - 1
    const last = runs[runs.length - 1]
    if (last && last.frame === f) last.to = i + 1
    else runs.push({ frame: f, from: i, to: i + 1 })
  }
  return { frames, runs, steps }
}

const pct = (n: number) => `${+n.toFixed(3)}%`

const clawdLayer = (b: Behaviour, prefix: string, phones: boolean) => {
  const { frames, runs, steps } = timeline(b, phones)
  const ms = steps * FRAME_MS
  const defs = frames.map((f, i) => `<g id="${prefix}f${i}">${f}</g>`).join('')
  if (runs.length === 1) return { defs, body: `<use href="#${prefix}f0"/>`, css: '' }
  const css = runs
    .map((r, i) => {
      const from = (r.from / steps) * 100
      const to = (r.to / steps) * 100
      const keys = `${from > 0 ? `0%{opacity:0}${pct(from)}{opacity:1}` : '0%{opacity:1}'}${to < 100 ? `${pct(to)}{opacity:0}` : ''}`
      return `@keyframes ${prefix}${i}{${keys}}.${prefix}${i}{opacity:0;animation:${prefix}${i} ${ms}ms step-end infinite}`
    })
    .join('')
  const body = runs.map((r, i) => `<use href="#${prefix}f${r.frame}" class="${prefix}${i}"/>`).join('')
  return { defs, body, css }
}

// The stage: his behaviour, a wave while the pointer is over him, and the
// first frame alone under reduced motion.
const clawdStage = (b: Behaviour, phones: boolean) => {
  const main = clawdLayer(b, 'm', phones)
  const wave = clawdLayer('greeting', 'h', phones)
  const colours = (i: 0 | 1) => Object.entries(CLAWD_PALETTE).map(([k, v]) => `.${k}{fill:${v[i]}}`).join('')
  const css =
    `${colours(0)}@media (prefers-color-scheme: dark){${colours(1)}}` +
    main.css +
    wave.css +
    '.hover{display:none}svg:hover .main{display:none}svg:hover .hover{display:inline}.rest{display:none}' +
    '@media (prefers-reduced-motion: reduce){.main,.hover,svg:hover .hover{display:none!important}.rest{display:inline}}'
  const w = STAGE_W * STAGE_SCALE
  const h = STAGE_H * STAGE_SCALE
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${STAGE_W} ${STAGE_H}" shape-rendering="crispEdges">` +
    `<style>${css}</style><defs>${main.defs}${wave.defs}</defs>` +
    `<g class="main">${main.body}</g><g class="hover">${wave.body}</g><use class="rest" href="#mf0"/></svg>`
  return { source, alt: `Clawd, ${BEHAVIOURS[b].word}`, width: w, height: h }
}

// ---------- what he is doing: read from the session ----------

const CODE_FILE = /\.(c|cc|cpp|cxx|h|hh|hpp|cs|go|rs|java|kt|kts|swift|m|mm|py|pyi|rb|php|js|jsx|ts|tsx|mjs|cjs|vue|svelte|scala|clj|ex|exs|erl|hs|lua|dart|r|jl|sh|bash|zsh|fish|ps1|sql|toml|ya?ml|json|lock|gradle|ini|cfg|conf|env|proto|graphql|tf)$/i
const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc|org|tex|docx?|odt|rtf)$/i
const DESIGN_FILE = /\.(css|scss|sass|less|styl|html?|svg|png|jpe?g|gif|webp|avif|ico|fig|sketch|xd|psd|ai)$/i
const SHIP_COMMAND = /\b(git\s+push|(npm|pnpm|yarn|cargo|gem|twine|poetry)\s+publish|gh\s+release|docker\s+push|deploy|release|railway\s+up|vercel|netlify|fly\s+deploy|kubectl\s+apply|helm\s+(upgrade|install))\b/i
const BUILD_COMMAND = /\b(test|tests|pytest|jest|vitest|mocha|rspec|go\s+(test|build|vet)|cargo\s+(test|build|check|clippy)|tsc|typecheck|lint|eslint|ruff|mypy|make|cmake|gradle|mvn|build|compile)\b/i

type Activity = Exclude<Behaviour, 'idle' | 'focused' | 'happy' | 'proud' | 'worried' | 'alert' | 'tired' | 'asleep' | 'greeting'>

const fileKind = (path: string): Activity => (PROSE_FILE.test(path) ? 'writing' : DESIGN_FILE.test(path) ? 'design' : 'coding')

// The tool a call runs, and its arguments, to one of his work styles; null
// keeps what he was doing.
const activityOf = (tool: string, args: Record<string, unknown>): Activity | null => {
  const name = tool.toLowerCase()
  const path = text(args.file_path) || text(args.notebook_path) || text(args.path)
  if (/^(edit|write|multiedit|notebookedit)$/.test(name)) return fileKind(path)
  if (/^(read|grep|glob|ls|notebookread)$/.test(name)) return 'reading'
  if (/^(websearch|webfetch)$/.test(name) || /(search|fetch|get_page_text|read_page|research)/.test(name)) return 'research'
  if (name === 'bash' || /(run_in_terminal|shell|exec)/.test(name)) {
    const command = text(args.command)
    return SHIP_COMMAND.test(command) ? 'shipping' : BUILD_COMMAND.test(command) ? 'coding' : 'terminal'
  }
  if (/^(agent|task)$/.test(name) || /(start_session|sendmessage|hand_off|spawn|subagent)/.test(name)) return 'leading'
  if (/(artifact|widget|visual|figma|design|image|diagram)/.test(name)) return 'design'
  if (/(browser|chrome|navigate|computer|click|screenshot|form_input|preview|simulator)/.test(name)) return 'browser'
  if (/(doc|write|draft|note)/.test(name)) return 'writing'
  return null
}

// His state, per session: what he is doing, a reaction playing out, and when
// the last turn ended (for sleep).
type ClawdMood = {
  activity: Activity
  since: number
  shipped: boolean
  reaction: Behaviour | null
  until: number
  lastTurnEnd: number
}
const CLAWD_START: ClawdMood = { activity: 'thinking', since: 0, shipped: false, reaction: null, until: 0, lastTurnEnd: 0 }
const ACTIVITY_DWELL_MS = 2_500
const REACTION_MS = 2_400
const FOCUS_MS = 60_000
const SLEEP_MS = 10 * 60_000

const clawdBehaviour = (
  m: ClawdMood,
  at: number,
  isWorking: boolean,
  alert: boolean,
  tired: boolean,
  childrenWorking: boolean,
  listening = false,
): Behaviour => {
  if (alert) return 'alert'
  if (m.reaction && at < m.until) return m.reaction
  if (isWorking) return m.activity === 'coding' && m.since && at - m.since > FOCUS_MS ? 'focused' : m.activity
  // A leader whose children are working watches over them; he never naps then.
  if (childrenWorking) return 'leading'
  if (m.lastTurnEnd && at - m.lastTurnEnd > SLEEP_MS) return 'asleep'
  if (listening) return 'listening'
  if (tired) return 'tired'
  return 'idle'
}

// ---------- Claude FM ----------
// Claude FM is a YouTube live stream (Claude Code's own /radio opens the same
// page). A mod cannot embed YouTube's player, and YouTube serves no stream to
// a hidden or headless browser, nor starts one in a window that was never on
// screen. So the panel opens it in a window of the person's Chrome, lets the
// player start, minimizes the window (it keeps playing) and stops it by
// closing the tab, through AppleScript.
// Nothing talks to Chrome until the person first presses the control, so
// macOS asks for that permission only when it is wanted.

const FM_VIDEO = 'tRsQsTMvPNg'
const FM_URL = `https://www.youtube.com/watch?v=${FM_VIDEO}`
const FM_USED = 'claudeFmUsed'

// AppleScript over Chrome's tabs: count the ones playing Claude FM, or close
// them. It never starts Chrome.
const fmScript = (verb: 'count' | 'close') => `if application "Google Chrome" is running then
  tell application "Google Chrome"
    set n to 0
    repeat with w in windows
      set found to (tabs of w whose URL contains "${FM_VIDEO}")
      set n to n + (count of found)
      ${verb === 'close' ? 'repeat with t in found\n        close t\n      end repeat' : ''}
    end repeat
    return n
  end tell
end if
return 0`

// A new window, on screen just until macOS reports Chrome playing audio (at
// most 10 s; a fixed 5 s when another tab already plays), then minimized.
const FM_PLAY = `set wasPlaying to (do shell script "pmset -g assertions | grep -c 'Google Chrome.*Playing audio' || true") is not "0"
tell application "Google Chrome"
  set fm to make new window
  set URL of active tab of fm to "${FM_URL}"
end tell
if wasPlaying then
  delay 5
else
  repeat 20 times
    delay 0.5
    if (do shell script "pmset -g assertions | grep -c 'Google Chrome.*Playing audio' || true") is not "0" then exit repeat
  end repeat
end if
tell application "Google Chrome" to set minimized of fm to true`

const fmTabs = async ($: EngineInterface, verb: 'count' | 'close') => {
  const { exitCode, stdout } = await $.process.run(['osascript', '-e', fmScript(verb)])
  return exitCode === 0 ? Number(stdout.trim()) || 0 : 0
}

const pollFm = async ($: EngineInterface) => {
  if (!(await $.store.get(FM_USED).catch(() => false))) return
  const on = (await fmTabs($, 'count').catch(() => 0)) > 0
  if ((await read($, fmOn)) !== on) await update($, fmOn, () => on)
}

const toggleFm = async ($: EngineInterface) => {
  await $.store.set(FM_USED, true).catch(() => undefined)
  const playing = (await fmTabs($, 'count').catch(() => 0)) > 0
  await update($, fmOn, () => !playing)
  if (playing) {
    await fmTabs($, 'close')
    return
  }
  const opened = await $.process.run(['osascript', '-e', FM_PLAY], { timeoutMs: 30_000 })
  if (opened.exitCode !== 0) await $.process.run(['open', '-g', FM_URL])
}

// A small equalizer beside the station's name while it plays.
const fmEqualizer = (): Figure => {
  const used = newUsed()
  used.fills.add('clay')
  const bars = [0, 1, 2, 3]
    .map(i => `<rect x="${1 + i * 3}" y="1" width="2" height="10" rx="1" class="f-clay eq" style="animation-delay:-${[0, 0.35, 0.7, 0.2][i]}s"/>`)
    .join('')
  const css = '<style>.eq{transform-box:fill-box;transform-origin:50% 100%;animation:eq 1s ease-in-out infinite}@keyframes eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}@media (prefers-reduced-motion: reduce){.eq{animation:none;transform:scaleY(.6)}}</style>'
  return { source: svgDoc(14, 12, used, css + bars), alt: 'Claude FM playing', width: 14, height: 12, animated: true }
}

// ---------- a model's own weekly limit ----------
// The engine reports the 5-hour and weekly windows. A limit the account keeps
// for one model (Fable's) is only in the account's usage report, read here
// with the session's own credential, which stays with the host. The reading
// is kept per session and never in the store: the terminal and the desktop
// app can be signed in to different accounts, and the store is shared.

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const MODEL_AFTER_TURN_MS = 60_000
const MODEL_IDLE_MS = 10 * 60_000
/** Past this age a reading is not shown: its window may have reset since. */
const MODEL_STALE_MS = 30 * 60_000
const MODEL_KIND = 'seven_day_'
let modelAskedAt = 0

/** The report's model-scoped weekly limits as windows (`seven_day_fable`); null when the text is not a usage report. */
const modelWindows = (raw: string): UsageBarWindow[] | null => {
  const limits = parse(raw)?.limits
  if (!Array.isArray(limits)) return null
  const out: UsageBarWindow[] = []
  for (const entry of limits as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const l = entry as Record<string, unknown>
    const scope = (l.scope ?? {}) as Record<string, unknown>
    const model = (scope.model ?? {}) as Record<string, unknown>
    const slug = text(model.display_name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (l.kind !== 'weekly_scoped' || !slug || typeof l.percent !== 'number' || !Number.isFinite(l.percent)) continue
    // The report times its resets to the microsecond; a date takes three decimals.
    const resetsAt = text(l.resets_at).replace(/(\.\d{3})\d+/, '$1')
    out.push(resetsAt ? { kind: `${MODEL_KIND}${slug}`, percentUsed: l.percent, resetsAt } : { kind: `${MODEL_KIND}${slug}`, percentUsed: l.percent })
  }
  return out
}

/** Reads the report unless it was asked for within `maxAge` ms. A failure keeps the last reading, which stops showing once stale. */
const syncModelLimits = async ($: EngineInterface, maxAge: number) => {
  const at = Date.now()
  if (at - modelAskedAt < maxAge) return
  modelAskedAt = at
  try {
    const auth = await $.session.authorize()
    // The report is a subscription's: a session on an API key has none.
    if (auth?.kind !== 'bearer') return
    const res = await $.http.fetch(USAGE_URL, { auth: auth.handle, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
    const found = res.ok ? modelWindows(res.text) : null
    if (found) await update($, modelLimits, () => ({ at: Date.now(), windows: found }))
  } catch {
    // no credential to hold, no network, or a host that refuses the request
  }
}

/** The windows the band draws: the engine's, then the fresh model limits the engine does not report itself. */
const allWindows = (engine: readonly UsageBarWindow[], model: UsageBarModelLimits | null, at: number): UsageBarWindow[] => [
  ...engine,
  ...(model && at - model.at < MODEL_STALE_MS ? model.windows.filter(m => !engine.some(w => w.kind === m.kind)) : []),
]

// ---------- engine plumbing ----------

const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage()
  await update($, windows, () => sortWindows(usage.rateLimits))
  await update($, now, () => Date.now())
  // The Glass mode's totals: cost, the session's start and its turns are the engine's own.
  // Merged inside `update`, so a count made meanwhile is kept; a failure here stays here.
  try {
    const turns = await $.session.turns()
    await update($, ledger, prev => ({ ...((prev as UsageBarLedger | null) ?? LEDGER_START), usd: usage.cost ? usage.cost.usd : null, startedAt: usage.startedAt, turns }))
  } catch {
    // the band draws without these
  }
}

// Token counts of one finished turn, added to the session's ledger.
const countTurn = async ($: EngineInterface, usage: unknown) => {
  if (!usage || typeof usage !== 'object') return
  const u = usage as Record<string, unknown>
  const n = (k: string) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? (u[k] as number) : 0)
  await update($, ledger, prev => {
    const before = (prev as UsageBarLedger | null) ?? LEDGER_START
    return {
      ...before,
      written: before.written + n('output_tokens'),
      read: before.read + n('input_tokens'),
      cacheRead: before.cacheRead + n('cache_read_input_tokens'),
      cacheWritten: before.cacheWritten + n('cache_creation_input_tokens'),
    }
  })
}

// The counts are kept per session in the store, so a session reopened after the app restarts carries on from
// where it stood: without this its tokens and tool calls would restart at zero beside a cost and a time that do not.
const LEDGER_KEY = 'ledger:'
const LEDGER_KEEP = 30
type SavedLedger = { at: number; written: number; read: number; cacheRead: number; cacheWritten: number; tools: number }
const saveLedger = async ($: EngineInterface) => {
  const l = await ledgerOf($)
  const key = `${LEDGER_KEY}${await $.session.id()}`
  const saved: SavedLedger = { at: Date.now(), written: l.written, read: l.read, cacheRead: l.cacheRead, cacheWritten: l.cacheWritten, tools: l.tools }
  await $.store.set(key, saved)
  // Now and then, forget the oldest sessions' counts.
  const keys = (await $.store.keys()).filter(k => k.startsWith(LEDGER_KEY))
  if (keys.length <= LEDGER_KEEP + 10) return
  const aged = await Promise.all(keys.map(async k => ({ k, at: ((await $.store.get(k)) as SavedLedger | undefined)?.at ?? 0 })))
  aged.sort((a, b) => a.at - b.at)
  for (const old of aged.slice(0, aged.length - LEDGER_KEEP)) await $.store.delete(old.k)
}
const loadLedger = async ($: EngineInterface) => {
  if ((await read($, ledger)) !== null) return
  const saved = (await $.store.get(`${LEDGER_KEY}${await $.session.id()}`)) as Partial<SavedLedger> | undefined
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  if (!saved || typeof saved !== 'object') return
  await update($, ledger, prev => (prev as UsageBarLedger | null) ?? { ...LEDGER_START, written: n(saved.written), read: n(saved.read), cacheRead: n(saved.cacheRead), cacheWritten: n(saved.cacheWritten), tools: n(saved.tools) })
}

const takeReading = async ($: EngineInterface) => {
  const { context } = await $.session.usage()
  if (!context.window) return
  const tokens = context.tokens ?? 0
  const reading: UsageBarReading = {
    tokens,
    window: context.window,
    percent: Math.round(context.percent ?? (tokens / context.window) * 100),
  }
  // The session.start reading is 0 before any response; drop it once real readings arrive.
  await update($, readings, list => [...list.filter(r => r.tokens > 0), reading].slice(-HISTORY))
}

const moodOf = async ($: EngineInterface): Promise<ClawdMood> => ((await read($, mood)) as ClawdMood | null) ?? CLAWD_START

// A reaction plays for a while, then the band draws him at his work again.
const react = async ($: EngineInterface, reaction: Behaviour, ms = REACTION_MS) => {
  await update($, mood, m => ({ ...((m as ClawdMood | null) ?? CLAWD_START), reaction, until: Date.now() + ms }))
  $.clock.after(ms + 50, () => void update($, now, () => Date.now()))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The black look. An engine without themes throws as the call is reached for; the band carries on.
    try {
      if (BLACK_PROBLEM !== undefined) $.ui.toast(BLACK_PROBLEM)
      await $.theme.set(BLACK_LOOK)
    } catch {
      // no theme on this engine or surface
    }
    await loadLedger($).catch(() => undefined)
    await refresh($)
    if ((await read($, readings)).length === 0) await takeReading($).catch(() => undefined)
    void syncModelLimits($, 0)
    // Keeps the reset countdowns moving between turns, and the model limit current in a session left idle.
    $.clock.every(30_000, () => {
      void refresh($)
      void syncModelLimits($, MODEL_IDLE_MS)
    })
    // Children and their live states, for a session that started others.
    void pollFamily($)
    void pollFm($)
    void pollScene($)
    $.clock.every(POLL_MS, () => {
      void pollFamily($)
      void pollFm($)
      void pollScene($)
    })

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const at = Date.now()
    const m = await moodOf($)
    // Back after a long pause: he wakes and waves first.
    const waking = m.lastTurnEnd > 0 && at - m.lastTurnEnd > SLEEP_MS
    await update($, mood, () => ({ ...m, activity: 'thinking', since: at, shipped: false, reaction: waking ? 'greeting' : null, until: waking ? at + REACTION_MS : 0 }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // The main conversation's tool calls, the same scope as its turns. Counting must never stand between a tool and its run.
    if (!e.agentId) {
      await update($, ledger, prev => {
        const before = (prev as UsageBarLedger | null) ?? LEDGER_START
        return { ...before, tools: before.tools + 1 }
      }).catch(() => undefined)
    }
    // His work follows the main conversation's tools, not a subagent's.
    if (!e.agentId) {
      const activity = activityOf(e.tool, e as unknown as Record<string, unknown>)
      if (activity) {
        const at = Date.now()
        const m = await moodOf($)
        // A new style holds for a moment, so quick reads between edits do not flicker.
        if (activity !== m.activity && (m.activity === 'thinking' || at - m.since >= ACTIVITY_DWELL_MS)) {
          await update($, mood, () => ({ ...m, activity, since: at, shipped: m.shipped || activity === 'shipping' }))
        }
      }
    }
    const result = await next(e)
    if (!e.agentId && 'isError' in result && result.isError) await react($, 'worried').catch(() => undefined)

    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, windows, () => sortWindows(e.rateLimits))
    await update($, now, () => Date.now())

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Tokens count for every turn, subagents' too, as the cost does.
    await countTurn($, (e as { usage?: unknown }).usage).catch(() => undefined)
    if (!e.agentId) {
      await refresh($).catch(() => undefined)
      await saveLedger($).catch(() => undefined)
      // Not awaited: the report is a request, and the turn does not wait for it.
      void syncModelLimits($, MODEL_AFTER_TURN_MS)
    }
    // The forecast follows the main conversation's window, not a subagent's.
    if (!e.agentId) {
      await takeReading($).catch(() => undefined)
      const m = await moodOf($)
      const reaction: Behaviour | null = e.reason === 'answer' ? (m.shipped ? 'proud' : 'happy') : e.reason === 'refusal' ? null : 'worried'
      await update($, mood, () => ({ ...m, lastTurnEnd: Date.now() }))
      if (reaction) await react($, reaction, reaction === 'proud' ? 3_000 : REACTION_MS).catch(() => undefined)
    }

    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, readings, () => [])
      await update($, ledger, () => LEDGER_START).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const at = (await read($, now)) || Date.now()
    const rows = allWindows(await read($, windows), (await read($, modelLimits)) as UsageBarModelLimits | null, at).map(w => toRow(w, at))
    const history = await read($, readings)
    const latest = history[history.length - 1]
    const fam = await read($, family)
    const open = fam !== null && (await read($, familyOpen))
    const toggle = () => void update($, familyOpen, v => !v)
    const fm = await read($, fmOn)
    const eq = fmEqualizer()
    // Whatever another plugin beneath draws here stays under ours.
    const below = await next(e)
    const clock = Date.now()

    // The counts, needs-you first: "1 needs you · 2 working · 7 idle".
    const counts = fam
      ? ([
          [fam.needs, fam.needs === 1 ? 'needs you' : 'need you', 'needs'],
          [fam.working, 'working', 'working'],
          [fam.idle, 'idle', 'idle'],
        ] as const).filter(([n]) => n > 0)
      : []

    if (e.surface !== 'terminal') {
      const { Box, Svg, Button, Text } = $.ui.resolve(e)
      const Mark = (m: Figure) => <Svg source={m.source} alt={m.alt} width={m.width} height={m.height} isInteractive={m.animated} />

      const childRows = (list: readonly UsageBarChild[], depth: number): JSX.Element[] =>
        list.flatMap(c => {
          if (!liveIn(c)) return []
          const asks = c.state === 'needs'
          const detail = (c.state === 'working' || asks) && c.doing
          return [
            <Box flexDirection="column" paddingLeft={depth * 2}>
              <Box flexDirection="row" alignItems="center">
                {Mark(mark(c.state, `${c.title}, ${STATE_WORD[c.state]}`))}
                <Box flexGrow={1} flexShrink={1} minWidth={0} marginLeft={1}>
                  <Text color={asks ? 'warning' : undefined} dimColor={c.state === 'stopped'} wrap="truncate-end">
                    {c.title}
                  </Text>
                </Box>
                <Box marginLeft={2}>
                  <Text dimColor>{age(c.since, clock)}</Text>
                </Box>
              </Box>
              {detail ? (
                <Box paddingLeft={3}>
                  <Text color={asks ? 'warning' : undefined} dimColor={!asks} wrap="truncate-end">
                    {c.doing}
                  </Text>
                </Box>
              ) : null}
            </Box>,
            ...childRows(c.children, depth + 1),
          ]
        })

      const finished = fam ? finishedOf(fam.children) : 0
      const current = modeOf(await read($, scene))
      // The two controls, the same in both modes. The half-disc turns over with the mode: ◐ on the Glass card,
      // ◑ on the classic meters. Claude FM is a note at rest; while it plays, a clay stop and a moving equalizer.
      // No `label` on these: the desktop app draws a label in place of the children, as words across the plate.
      const sceneButton = (
        <Button key="scene" plain onPress={() => void switchScene($)}>
          <Text dimColor>{current === GLASS ? '◐' : '◑'}</Text>
        </Button>
      )
      const fmButton = (
        <Button key="claude-fm" plain onPress={() => void toggleFm($)}>
          {fm ? <Text color="claude">■</Text> : <Text dimColor>♪</Text>}
        </Button>
      )
      const fmPlaying = fm ? <Svg source={eq.source} alt={eq.alt} width={eq.width} height={eq.height} isInteractive /> : null

      if (current === GLASS) {
        const gauge = (kind: string): Gauge | null => {
          const r = rows.find(row => row.kind === kind)
          return r ? { percent: r.percent, pace: r.pace, left: r.left, level: r.level } : null
        }
        const shape = stripShape(e.props.bodyColumns ?? 80)
        // The first limit kept for one model: Fable's, as the account's report names it.
        const modelRow = rows.find(row => row.kind.startsWith(MODEL_KIND))
        const modelGauge = modelRow ? gauge(modelRow.kind) : null
        const book = await ledgerOf($)
        const allRead = book.read + book.cacheRead + book.cacheWritten
        const strip = glassFor({
          width: shape.cols * 2,
          seen: shape.layout * 2,
          wide: shape.wide,
          five: gauge('five_hour'),
          seven: gauge('seven_day'),
          model: modelRow && modelGauge ? { name: modelRow.kind.slice(MODEL_KIND.length).replace(/_/g, ' ').toUpperCase().slice(0, 6).trim(), gauge: modelGauge } : null,
          context: latest ? { percent: latest.percent, tokens: latest.tokens, window: latest.window } : null,
          written: book.written,
          read: book.read + book.cacheWritten,
          cache: allRead > 0 ? (book.cacheRead / allRead) * 100 : null,
          usd: book.usd,
          turns: book.turns,
          tools: book.tools,
          minutes: book.startedAt > 0 ? Math.max(0, Math.floor((at - book.startedAt) / 60_000)) : 0,
          busy: e.props.isWorking,
        })

        const others = fam ? fam.needs + fam.working + fam.idle : 0

        return (
          <Box flexDirection="column">
            {/* The zone ends a row early, so the card closes on the art and not on its own bottom padding. */}
            <Box position="relative" marginBottom={-BLEED_Y}>
              {/* The card's art, behind everything; it starts above and left of the card and the card crops it.
                  It stops under the plate, so the card's right corners are the plate's alone to round. */}
              <Box position="absolute" top={-BLEED_Y} bottom={-BLEED_Y} left={-BLEED_X} right={SCENE_STOP} overflow="hidden">
                {/* In a row that may not shrink: the art keeps its own width and this box crops it. Left to
                    itself the app narrows a drawing to its box, and the drawing then scales down to fit. */}
                <Box flexDirection="row" flexWrap="nowrap">
                  <Box flexShrink={0}>
                    <Svg source={strip.art.source} alt={strip.alt} width={strip.art.width} height={ART_HEIGHT} isInteractive />
                  </Box>
                </Box>
              </Box>
              {/* The limits plate, over the art's right end. */}
              <Box position="absolute" top={-BLEED_Y} right={-BLEED_X}>
                <Svg source={strip.plate.source} alt={strip.limits} width={strip.plate.width} height={strip.plate.height} />
              </Box>
              {/* What gives the zone its height. */}
              <Svg source={SPACER} alt="Band" width={16} height={ZONE_HEIGHT} />
              {/* The controls, one above the other over the plate's rail and centred in its height. The rail is the
                  card's last RAIL px; the zone ends a cell short of the card's edge, so the column reaches a cell past it. */}
              <Box position="absolute" top={0} bottom={0} right={-1} flexDirection="column" alignItems="center" justifyContent="center">
                {fam && others > 0 ? (
                  <Button key="family" plain onPress={toggle}>
                    <Text color={fam.needs > 0 ? 'warning' : undefined} dimColor={fam.needs === 0}>{`${others}${open ? '▾' : '▸'}`}</Text>
                  </Button>
                ) : null}
                {sceneButton}
                {fmButton}
                {/* A row kept for the equalizer whether or not it shows, so the buttons stay put when Claude FM starts. */}
                <Box height={1} alignItems="center">
                  {fmPlaying}
                </Box>
              </Box>
            </Box>
            {open && fam ? (
              <Box flexDirection="column">
                {childRows(fam.children, 0)}
                {finished ? (
                  <Box paddingLeft={3}>
                    <Text dimColor>{`${finished} finished`}</Text>
                  </Box>
                ) : null}
              </Box>
            ) : null}
            {below}
          </Box>
        )
      }

      const context = latest?.percent ?? 0
      const behaviour = clawdBehaviour(
        ((await read($, mood)) as ClawdMood | null) ?? CLAWD_START,
        clock,
        e.props.isWorking,
        (fam?.needs ?? 0) > 0 || rows.some(r => r.level === 'high') || context >= 90,
        context >= 75,
        (fam?.working ?? 0) > 0,
        fm,
      )
      const stage = clawdStage(behaviour, fm)

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" alignItems="center">
            <Svg source={stage.source} alt={stage.alt} width={stage.width} height={stage.height} isInteractive />
            <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} marginLeft={1}>
              {fam ? (
                <Box flexDirection="column">
                  {/* The whole line opens the list: counts and chevron are one button,
                      pulled left by the button's own padding so its text lines up. */}
                  <Box flexDirection="row" marginLeft={-1}>
                    <Button key="family" plain onPress={toggle}>
                      {counts.map(([n, word, kind], i) => (
                        <Text color={kind === 'needs' ? 'warning' : undefined} dimColor={kind === 'idle'}>
                          {`${i > 0 ? ' · ' : ''}${n} ${word}`}
                        </Text>
                      ))}
                      <Text dimColor>{open ? '  ▾' : '  ▸'}</Text>
                    </Button>
                  </Box>
                  {open ? (
                    <Box flexDirection="column">
                      {childRows(fam.children, 0)}
                      {finished ? (
                        <Box paddingLeft={3}>
                          <Text dimColor>{`${finished} finished`}</Text>
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
              ) : null}
              {/* The meters wrap in their own box; the controls keep the row's right end however the meters wrap. */}
              <Box flexDirection="row" alignItems="flex-start">
                <Box flexDirection="row" flexWrap="wrap" alignItems="center" flexGrow={1} flexShrink={1} minWidth={0}>
                  {desktopFigures(rows, history).map(p => (
                    <Svg source={p.source} alt={p.alt} width={p.width} height={p.height} isInteractive={p.animated} />
                  ))}
                </Box>
                <Box flexDirection="row" alignItems="center" flexShrink={0}>
                  {/* The equalizer leads, so neither button moves when it appears. */}
                  {fmPlaying}
                  {sceneButton}
                  {fmButton}
                </Box>
              </Box>
            </Box>
          </Box>
          {below}
        </Box>
      )
    }

    const { Box, Text, Button } = $.ui.resolve(e)

    const pills = (
      <Box flexDirection="row" flexWrap="wrap">
        {rows.map(r => (
          <Box flexDirection="row" marginRight={3}>
            <Text dimColor>{r.kind === 'five_hour' ? '◔ ' : '▦ '}</Text>
            <Text>{`${r.label} `}</Text>
            {barSegments(r).map(seg =>
              seg.kind === 'fill' ? (
                <Text color={fillColor(r)}>{seg.text}</Text>
              ) : seg.kind === 'tick' ? (
                <Text bold>{seg.text}</Text>
              ) : (
                <Text dimColor>{seg.text}</Text>
              ),
            )}
            <Text bold>{` ${r.percent}%`}</Text>
            {r.left ? <Text dimColor>{`  ↻ ${r.left}`}</Text> : null}
          </Box>
        ))}
      </Box>
    )

    const f = latest ? forecastFor(latest.percent) : null
    const trend = trendWord(history)
    const forecast =
      latest && f ? (
        <Box flexDirection="row">
          <Text color={FORECAST_COLOR[f.level]} bold>{`${f.icon}  ${f.word}`}</Text>
          <Text>{`  ${latest.percent}% of context`}</Text>
          <Text dimColor>{`  ${short(latest.tokens)} / ${short(latest.window)}`}</Text>
          {(e.props.bodyColumns ?? 80) >= 60 ? <Text dimColor>{'   last turns '}</Text> : null}
          {(e.props.bodyColumns ?? 80) >= 60 ? <Text color={FORECAST_COLOR[f.level]} dimColor={f.level === 'ok'}>{chart(history)}</Text> : null}
          {(e.props.bodyColumns ?? 80) >= 60 && trend ? <Text dimColor>{`  ${trend}`}</Text> : null}
        </Box>
      ) : null

    const childLines = (list: readonly UsageBarChild[], depth: number): JSX.Element[] =>
      list.flatMap(c => {
        if (!liveIn(c)) return []
        const asks = c.state === 'needs'
        return [
          <Box flexDirection="row" paddingLeft={depth * 2}>
            <Text color={asks ? 'yellow' : c.state === 'working' ? 'claude' : undefined} dimColor={c.state === 'idle' || c.state === 'stopped'}>
              {c.state === 'working' ? '✻ ' : c.state === 'stopped' ? '○ ' : '● '}
            </Text>
            <Text color={asks ? 'yellow' : undefined} dimColor={c.state === 'stopped'} wrap="truncate-end">
              {c.title}
            </Text>
            <Text dimColor>{`  ${age(c.since, clock)}`}</Text>
          </Box>,
          ...((c.state === 'working' || asks) && c.doing
            ? [
                <Box paddingLeft={depth * 2 + 2}>
                  <Text color={asks ? 'yellow' : undefined} dimColor={!asks} wrap="truncate-end">
                    {c.doing}
                  </Text>
                </Box>,
              ]
            : []),
          ...childLines(c.children, depth + 1),
        ]
      })
    const finished = fam ? finishedOf(fam.children) : 0
    const familyBlock = fam ? (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color={e.props.isWorking ? 'claude' : fam.needs ? 'yellow' : undefined} dimColor={!e.props.isWorking && !fam.needs}>
            {'✻ '}
          </Text>
          {counts.map(([n, word, kind], i) => (
            <Text color={kind === 'needs' ? 'yellow' : undefined} dimColor={kind === 'idle'}>
              {`${i > 0 ? ' · ' : ''}${n} ${word}`}
            </Text>
          ))}
          <Text>{'  '}</Text>
          <Button key="family" plain dimColor label={open ? '▾' : '▸'} onPress={toggle} />
        </Box>
        {open ? childLines(fam.children, 0) : null}
        {open && finished ? <Text dimColor>{`  ${finished} finished`}</Text> : null}
      </Box>
    ) : null

    return (
      <Box flexDirection="column" paddingX={1}>
        {familyBlock}
        {pills}
        {forecast}
        {below}
      </Box>
    )
  })
}
