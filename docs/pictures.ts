// Draws the README's pictures of the card modes: the mod's own drawing code,
// laid out as the band lays it, with the numbers of one example session.
// They are not screenshots of the app.
//
//   bun docs/pictures.ts            every picture
//   bun docs/pictures.ts cluster    the pictures whose file name starts with "cluster"
//
// It needs Google Chrome, which takes the pictures; set CHROME to its binary
// where it is not in the usual place on macOS.
//
// A new card mode adds one line to MODES and its pictures to SHOTS.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ART_HEIGHT, CARD_HEIGHT, EDGE_SIDE, EDGE_TOP } from '../hooks/card'
import type { Gauge } from '../hooks/card'
import { clusterArt, clusterCentre, clusterPlate } from '../hooks/cluster'
import { RAIL, glassArt, glassPlate } from '../hooks/glass'
import { tunerArt, tunerPlate } from '../hooks/tuner'
import { boardArt, boardPlate } from '../hooks/board'
import { lcdArt, lcdPlate } from '../hooks/lcd'
import { vuArt, vuPlate } from '../hooks/vu'
import { cockpitArt, cockpitPlate } from '../hooks/cockpit'
import { panelArt, panelPlate } from '../hooks/panel'
import { nixieArt, nixiePlate } from '../hooks/nixie'
import { ARRIVAL_MS, LIFT, TAB_STYLE, lift, projectRoom, tabbedArt, updateTab } from '../hooks/tab'
import type { TabArt } from '../hooks/tab'
import type { UsageBarNotice, UsageBarProject } from '../types'

// ---------- the example session ----------

type Numbers = {
  five: Gauge | null
  seven: Gauge | null
  model: { name: string; gauge: Gauge } | null
  context: { percent: number; tokens: number; window: number } | null
  written: number
  read: number
  cache: number | null
  usd: number | null
  turns: number
  tools: number
  minutes: number
}
const limit = (percent: number, pace: number, left: string, level: Gauge['level'] = 'ok'): Gauge => ({ percent, pace, left, level })
// The session the README shows everywhere, then the same session with its limits barely touched, and pushed hard.
const SESSIONS = {
  normal: { context: { percent: 62, tokens: 620_000, window: 1_000_000 }, five: limit(34, 0.357, '3h 13m'), seven: limit(58, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(41, 0.679, '2d 6h') }, usd: 21.37, minutes: 318, turns: 61, written: 148_000, read: 2_400_000, cache: 91, tools: 212 },
  eco: { context: { percent: 18, tokens: 180_000, window: 1_000_000 }, five: limit(12, 0.5, '2h 30m'), seven: limit(31, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(22, 0.679, '2d 6h') }, usd: 3.42, minutes: 41, turns: 9, written: 21_400, read: 310_000, cache: 84, tools: 31 },
  sport: { context: { percent: 91, tokens: 910_000, window: 1_000_000 }, five: limit(81, 0.6, '2h 0m', 'ahead'), seven: limit(74, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(88, 0.679, '2d 6h', 'ahead') }, usd: 64.1, minutes: 505, turns: 118, written: 392_000, read: 6_100_000, cache: 93, tools: 455 },
} satisfies Record<string, Numbers>
type Session = keyof typeof SESSIONS

// ---------- the modes ----------

/** A card's drawings: the art behind, the plate at the right end and, in a mode that has one, the drawing centred between them. */
type Card = {
  art: TabArt
  plate: { source: string; width: number; height: number }
  centre: { source: string; width: number; height: number } | null
}
/** How each card mode draws a session on a card `width` px wide. */
const MODES = {
  glass: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, seen: width - 300, wide: width >= 768, busy: false }
    return { art: glassArt(input), plate: glassPlate(input), centre: null }
  },
  cluster: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width }
    return { art: clusterArt(input), plate: clusterPlate(input), centre: clusterCentre(input) }
  },
  tuner: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768 }
    return { art: tunerArt(input), plate: tunerPlate(input), centre: null }
  },
  board: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768, flip: null }
    return { art: boardArt(input), plate: boardPlate(input), centre: null }
  },
  vu: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768 }
    return { art: vuArt(input), plate: vuPlate(input), centre: null }
  },
  nixie: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768 }
    return { art: nixieArt(input), plate: nixiePlate(input), centre: null }
  },
  cockpit: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768 }
    return { art: cockpitArt(input), plate: cockpitPlate(input), centre: null }
  },
  panel: (n: Numbers, width: number): Card => {
    // The pictures' rail shows the child-sessions button.
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768, family: true }
    return { art: panelArt(input), plate: panelPlate(input), centre: null }
  },
  lcd: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width, wide: width >= 768 }
    return { art: lcdArt(input), plate: lcdPlate(input), centre: null }
  },
} satisfies Record<string, (n: Numbers, width: number) => Card>
type Mode = keyof typeof MODES

// ---------- the pictures ----------

type Placed = { mode: Mode; session: Session; width: number; left: number; top: number; project?: UsageBarProject; notice?: UsageBarNotice }
type Shot = {
  /** The file under docs/images. */
  file: string
  /** The picture's size in CSS px, and how many pixels a CSS px takes. */
  width: number
  height: number
  scale: number
  /** The side a close-up fades out on, where the card runs on past the picture. */
  fade?: 'left' | 'right'
  /** The ground round the cards, where it is not the black of the other pictures: the app's page, which the tab's room is painted in. */
  ground?: string
  /** Taken under the app's light theme: the drawings follow it through `prefers-color-scheme`. Dark otherwise. */
  light?: boolean
  cards: Placed[]
}

/** The margin round a card that is shown whole. */
const MARGIN_X = 31
const MARGIN_Y = 29
const WHOLE = 930
const whole = (mode: Mode, session: Session, top = MARGIN_Y): Placed => ({ mode, session, width: WHOLE, left: MARGIN_X, top })
/** Three sessions of one mode, one above the other on narrower cards. */
const stack = (mode: Mode, sessions: Session[], width: number, gap: number): Pick<Shot, 'width' | 'height' | 'cards'> => ({
  width: width + 2 * MARGIN_X,
  height: sessions.length * CARD_HEIGHT + (sessions.length - 1) * gap + 2 * MARGIN_Y,
  cards: sessions.map((session, n) => ({ mode, session, width, left: MARGIN_X, top: MARGIN_Y + n * (CARD_HEIGHT + gap) })),
})

// Three sessions in three projects, for the project tab: a branch, a worktree, a folder outside any repository.
const PROJECTS: UsageBarProject[] = [
  { name: 'claude-usage-bar', owner: 'behkha', branch: 'main', revision: null, worktree: null, repo: true },
  { name: 'dr-assistant', owner: 'behkha', branch: 'feat/intake-form', revision: null, worktree: 'intake-form', repo: true },
  { name: 'SketchyDude', owner: null, branch: null, revision: null, worktree: null, repo: false },
]
const TABBED_W = 760
const TABBED_GAP = 22
/** A mode's whole card with the project tab above it, on the app's page, as the band shows it. */
const tabbed = (mode: Mode, file: string): Shot => ({
  file,
  scale: 2,
  ground: '#0a0a0a',
  width: WHOLE + 2 * MARGIN_X,
  height: CARD_HEIGHT + LIFT + 2 * MARGIN_Y,
  cards: [{ ...whole(mode, 'normal'), project: PROJECTS[0] }],
})

/** A mode's card in a narrow pane, with the project tab and the update tab, as the band shows it. */
const NARROW_W = 520
const narrowTabbed = (mode: Mode, file: string, width = NARROW_W): Shot => ({
  file,
  scale: 2,
  ground: '#0a0a0a',
  width: width + 2 * MARGIN_X,
  height: CARD_HEIGHT + LIFT + 2 * MARGIN_Y,
  cards: [{ mode, session: 'normal', width, left: MARGIN_X, top: MARGIN_Y, project: PROJECTS[0], notice: NOTICE }],
})

/** The update notice: a newer version is out. */
const NOTICE: UsageBarNotice = { version: '0.2.0', phase: 'available', since: 0 }
const CLOSE_W = 430

const SHOTS: Shot[] = [
  { file: 'cluster.png', width: WHOLE + 2 * MARGIN_X, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 2, cards: [whole('cluster', 'normal')] },
  // Close-ups: the same card three times as large, cut where the picture ends.
  { file: 'cluster-context.png', width: 480, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 3, fade: 'right', cards: [whole('cluster', 'normal')] },
  { file: 'cluster-limits.png', width: 430, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 3, fade: 'left', cards: [{ ...whole('cluster', 'normal'), left: 430 - MARGIN_X - WHOLE }] },
  { file: 'cluster-modes.png', scale: 2, ...stack('cluster', ['eco', 'normal', 'sport'], 620, 18) },
  tabbed('tuner', 'tuner.png'),
  { file: 'tuner-sessions.png', scale: 2, ...stack('tuner', ['eco', 'normal', 'sport'], 780, 18) },
  tabbed('board', 'board.png'),
  { file: 'board-sessions.png', scale: 2, ...stack('board', ['eco', 'normal', 'sport'], 780, 18) },
  tabbed('vu', 'vu.png'),
  { file: 'vu-sessions.png', scale: 2, ...stack('vu', ['eco', 'normal', 'sport'], 780, 18) },
  narrowTabbed('vu', 'vu-narrow.png'),
  // Narrower still: the 5-hour meter has moved onto the plate.
  narrowTabbed('vu', 'vu-narrowest.png', 440),
  tabbed('nixie', 'nixie.png'),
  { file: 'nixie-sessions.png', scale: 2, ...stack('nixie', ['eco', 'normal', 'sport'], 780, 18) },
  narrowTabbed('nixie', 'nixie-narrow.png'),
  tabbed('cockpit', 'cockpit.png'),
  { file: 'cockpit-sessions.png', scale: 2, ...stack('cockpit', ['eco', 'normal', 'sport'], 780, 18) },
  narrowTabbed('cockpit', 'cockpit-narrow.png'),
  // Narrower still: the reset times gone, the tapes shorter.
  narrowTabbed('cockpit', 'cockpit-narrowest.png', 420),
  tabbed('lcd', 'lcd.png'),
  { file: 'lcd-sessions.png', scale: 2, ...stack('lcd', ['eco', 'normal', 'sport'], 780, 18) },
  narrowTabbed('lcd', 'lcd-narrow.png'),
  tabbed('panel', 'panel.png'),
  // Under the app's light theme: the room above the card takes the page's light colour.
  { ...tabbed('panel', 'panel-light.png'), ground: '#faf9f5', light: true },
  { file: 'panel-sessions.png', scale: 2, ...stack('panel', ['eco', 'normal', 'sport'], 780, 18) },
  narrowTabbed('panel', 'panel-narrow.png'),
  {
    file: 'tab.png',
    scale: 2,
    ground: '#0a0a0a',
    width: TABBED_W + 2 * MARGIN_X,
    height: PROJECTS.length * (CARD_HEIGHT + LIFT) + (PROJECTS.length - 1) * TABBED_GAP + 2 * MARGIN_Y,
    cards: PROJECTS.map((project, n) => ({ mode: n === 1 ? 'cluster' : 'glass', session: 'normal', width: TABBED_W, left: MARGIN_X, top: MARGIN_Y + n * (CARD_HEIGHT + LIFT + TABBED_GAP), project })),
  },
  // Close-up: the Glass card's right end with the update tab, three times as large.
  {
    file: 'update.png',
    scale: 3,
    fade: 'left',
    ground: '#0a0a0a',
    width: CLOSE_W,
    height: CARD_HEIGHT + LIFT + 2 * MARGIN_Y,
    cards: [{ ...whole('glass', 'normal'), left: CLOSE_W - MARGIN_X - WHOLE, project: PROJECTS[0], notice: NOTICE }],
  },
]

// ---------- laying a card out, as the band does ----------

const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

// The rail's buttons are the app's own, not drawings of the mod: child sessions, the mode switch, Claude FM.
// The mode switch shows the mode's glyph: a disc with the half filled that each mode fills, or Board's grid.
const HALF: Partial<Record<Mode, number>> = { glass: 90, cluster: 0, tuner: 180 }
/** The modes whose glyph is drawn as the app's text, not as a shape. */
const TEXT_GLYPH: Partial<Record<Mode, string>> = { vu: '◠', nixie: '◍', cockpit: '△', lcd: '▤', panel: '◎' }
const modeGlyph = (mode: Mode) =>
  TEXT_GLYPH[mode]
    ? `<text x="16" y="51" font-size="13" text-anchor="middle">${TEXT_GLYPH[mode]}</text>`
    : mode === 'board'
    ? '<g fill="none" stroke="#9a9a9a" stroke-width="1.1"><rect x="10.8" y="41.3" width="10.4" height="10.4"/><path d="M14.3 41.3v10.4M17.7 41.3v10.4M10.8 44.8h10.4M10.8 48.2h10.4"/></g>'
    : `<circle cx="16" cy="46.5" r="5.2" fill="none" stroke="#9a9a9a" stroke-width="1.1"/><path d="M10.8 46.5a5.2 5.2 0 0 0 10.4 0Z" transform="rotate(${HALF[mode] ?? 0} 16 46.5)"/>`
// Drawn round 27, 46.5 and 66, then raised to where the app stands them: their centres measured at 20.5, 40 and 60.
const RAIL_RISE = 6.5
const railButtons = (mode: Mode) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${RAIL}" height="${CARD_HEIGHT}" viewBox="0 0 ${RAIL} ${CARD_HEIGHT}" font-family="-apple-system,system-ui,sans-serif" fill="#9a9a9a"><g transform="translate(0 -${RAIL_RISE})">` +
  '<text x="16" y="31" font-size="12" text-anchor="middle">3▸</text>' +
  modeGlyph(mode) +
  '<text x="16" y="71" font-size="13" text-anchor="middle">♪</text></g></svg>'

const cardHtml = (p: Placed) => {
  const drawn = MODES[p.mode](SESSIONS[p.session], p.width)
  // With a project or an update notice, every drawing is lowered by the tab's height and the tabs stand above, as the band lays them.
  const up = p.project || p.notice ? LIFT : 0
  const card: Card = up
    ? {
        art: { source: tabbedArt(drawn.art, ART_HEIGHT, p.project ?? null, { elapsed: ARRIVAL_MS, now: 0, busy: false }, TAB_STYLE[p.mode], projectRoom(p.notice ?? null, p.width)), width: drawn.art.width },
        plate: { ...drawn.plate, source: lift(drawn.plate.source, drawn.plate.width, drawn.plate.height, true), height: drawn.plate.height + up },
        centre: drawn.centre ? { ...drawn.centre, source: lift(drawn.centre.source, drawn.centre.width, drawn.centre.height, false), height: drawn.centre.height + up } : null,
      }
    : drawn
  const img = (d: { source: string; width: number }, height: number, style: string) => `<img src="${uri(d.source)}" width="${d.width}" height="${height}" style="${style}">`
  // The update tab, laid from the plate's outer edge with its base on the card's top edge; its label drawn in, where the band lays a Button.
  const update = p.notice ? updateTab(p.notice, TAB_STYLE[p.mode], ARRIVAL_MS, true) : null
  return (
    // The card crops its art to a plain rectangle; the art cuts the corners itself.
    `<div style="position:absolute;left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${CARD_HEIGHT + up}px;overflow:hidden">` +
    `<div style="position:absolute;top:${-EDGE_TOP}px;left:${-EDGE_SIDE}px;right:${RAIL * 2}px;height:${CARD_HEIGHT + 2 * EDGE_TOP + up}px;overflow:hidden">${img(card.art, CARD_HEIGHT + 2 * EDGE_TOP + 1 + up, 'max-width:none')}</div>` +
    (card.centre ? `<div style="position:absolute;top:${-EDGE_TOP}px;left:0;right:${RAIL}px;display:flex;justify-content:center">${img(card.centre, card.centre.height, '')}</div>` : '') +
    img(card.plate, card.plate.height, `position:absolute;top:${-EDGE_TOP}px;right:${-EDGE_SIDE}px`) +
    `<img src="${uri(railButtons(p.mode))}" width="${RAIL}" height="${CARD_HEIGHT}" style="position:absolute;top:${up}px;right:0">` +
    (update ? img(update, update.height, `position:absolute;top:0;right:${update.right - EDGE_SIDE}px`) : '') +
    '</div>'
  )
}

const FADE = 110
const page = (s: Shot) => {
  const fade = s.fade ? `<div style="position:absolute;top:0;bottom:0;${s.fade}:0;width:${FADE}px;background:linear-gradient(to ${s.fade},transparent,${s.ground ?? '#000'} 78%)"></div>` : ''
  return (
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${s.ground ?? '#000'}}img{display:block}</style>` +
    `<div style="position:relative;width:${s.width}px;height:${s.height}px;overflow:hidden">${s.cards.map(cardHtml).join('')}${fade}</div>`
  )
}

// ---------- taking them ----------

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const only = process.argv[2]
const work = mkdtempSync(join(tmpdir(), 'usage-bar-pictures-'))
const out = join(import.meta.dir, 'images')

for (const shot of SHOTS) {
  if (only && !shot.file.startsWith(only)) continue
  const html = join(work, `${shot.file}.html`)
  writeFileSync(html, page(shot))
  const run = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--force-device-scale-factor=${shot.scale}`,
    // The scheme the drawings see, so a picture does not follow this machine's setting.
    `--blink-settings=preferredColorScheme=${shot.light ? 1 : 0}`,
    `--window-size=${shot.width},${shot.height}`,
    `--screenshot=${join(out, shot.file)}`,
    `file://${html}`,
  ])
  if (run.status !== 0) {
    console.error(`${shot.file}: Chrome did not take the picture (${run.error?.message ?? `exit ${run.status}`})`)
    process.exit(1)
  }
  console.log(`${shot.file}  ${shot.width * shot.scale} x ${shot.height * shot.scale}`)
}
