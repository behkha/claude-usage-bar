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
import { ARRIVAL_MS, EDGE_INK, LIFT, lift, tabbedArt } from '../hooks/tab'
import type { UsageBarProject } from '../types'

// ---------- the example session ----------

type Numbers = {
  five: Gauge | null
  seven: Gauge | null
  model: { name: string; gauge: Gauge } | null
  context: { percent: number; tokens: number; window: number } | null
  written: number
  usd: number | null
  turns: number
  minutes: number
}
const limit = (percent: number, pace: number, left: string, level: Gauge['level'] = 'ok'): Gauge => ({ percent, pace, left, level })
// The session the README shows everywhere, then the same session with its limits barely touched, and pushed hard.
const SESSIONS = {
  normal: { context: { percent: 62, tokens: 620_000, window: 1_000_000 }, five: limit(34, 0.357, '3h 13m'), seven: limit(58, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(41, 0.679, '2d 6h') }, usd: 21.37, minutes: 318, turns: 61, written: 148_000 },
  eco: { context: { percent: 18, tokens: 180_000, window: 1_000_000 }, five: limit(12, 0.5, '2h 30m'), seven: limit(31, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(22, 0.679, '2d 6h') }, usd: 3.42, minutes: 41, turns: 9, written: 21_400 },
  sport: { context: { percent: 91, tokens: 910_000, window: 1_000_000 }, five: limit(81, 0.6, '2h 0m', 'ahead'), seven: limit(74, 0.679, '2d 6h'), model: { name: 'FABLE', gauge: limit(88, 0.679, '2d 6h', 'ahead') }, usd: 64.1, minutes: 505, turns: 118, written: 392_000 },
} satisfies Record<string, Numbers>
type Session = keyof typeof SESSIONS

// ---------- the modes ----------

/** A card's drawings: the art behind, the plate at the right end and, in a mode that has one, the drawing centred between them. */
type Card = {
  art: { source: string; width: number }
  plate: { source: string; width: number; height: number }
  centre: { source: string; width: number; height: number } | null
}
/** How each card mode draws a session on a card `width` px wide. */
const MODES = {
  glass: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, seen: width - 300, wide: width >= 768, read: 2_400_000, cache: 91, tools: 212, busy: false }
    return { art: glassArt(input), plate: glassPlate(input), centre: null }
  },
  cluster: (n: Numbers, width: number): Card => {
    const input = { ...n, width: 2400, narrow: width }
    return { art: clusterArt(input), plate: clusterPlate(input), centre: clusterCentre(input) }
  },
} satisfies Record<string, (n: Numbers, width: number) => Card>
type Mode = keyof typeof MODES

// ---------- the pictures ----------

type Placed = { mode: Mode; session: Session; width: number; left: number; top: number; project?: UsageBarProject }
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

const SHOTS: Shot[] = [
  { file: 'cluster.png', width: WHOLE + 2 * MARGIN_X, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 2, cards: [whole('cluster', 'normal')] },
  // Close-ups: the same card three times as large, cut where the picture ends.
  { file: 'cluster-context.png', width: 480, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 3, fade: 'right', cards: [whole('cluster', 'normal')] },
  { file: 'cluster-limits.png', width: 430, height: CARD_HEIGHT + 2 * MARGIN_Y, scale: 3, fade: 'left', cards: [{ ...whole('cluster', 'normal'), left: 430 - MARGIN_X - WHOLE }] },
  { file: 'cluster-modes.png', scale: 2, ...stack('cluster', ['eco', 'normal', 'sport'], 620, 18) },
  {
    file: 'tab.png',
    scale: 2,
    ground: '#0a0a0a',
    width: TABBED_W + 2 * MARGIN_X,
    height: PROJECTS.length * (CARD_HEIGHT + LIFT) + (PROJECTS.length - 1) * TABBED_GAP + 2 * MARGIN_Y,
    cards: PROJECTS.map((project, n) => ({ mode: n === 1 ? 'cluster' : 'glass', session: 'normal', width: TABBED_W, left: MARGIN_X, top: MARGIN_Y + n * (CARD_HEIGHT + LIFT + TABBED_GAP), project })),
  },
]

// ---------- laying a card out, as the band does ----------

const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

// The rail's buttons are the app's own, not drawings of the mod: child sessions, the mode switch, Claude FM.
const RAIL_BUTTONS =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${RAIL}" height="${CARD_HEIGHT}" viewBox="0 0 ${RAIL} ${CARD_HEIGHT}" font-family="-apple-system,system-ui,sans-serif" fill="#9a9a9a">` +
  '<text x="16" y="31" font-size="12" text-anchor="middle">3▸</text>' +
  '<circle cx="16" cy="46.5" r="5.2" fill="none" stroke="#9a9a9a" stroke-width="1.1"/><path d="M10.8 46.5a5.2 5.2 0 0 0 10.4 0Z"/>' +
  '<text x="16" y="71" font-size="13" text-anchor="middle">♪</text></svg>'

const cardHtml = (p: Placed) => {
  const drawn = MODES[p.mode](SESSIONS[p.session], p.width)
  // With a project, every drawing is lowered by the tab's height and the tab stands above, as the band lays it.
  const up = p.project ? LIFT : 0
  const card: Card = p.project
    ? {
        art: { source: tabbedArt(drawn.art, ART_HEIGHT, p.project, { elapsed: ARRIVAL_MS, now: 0, busy: false }, EDGE_INK[p.mode]), width: drawn.art.width },
        plate: { ...drawn.plate, source: lift(drawn.plate.source, drawn.plate.width, drawn.plate.height, true), height: drawn.plate.height + up },
        centre: drawn.centre ? { ...drawn.centre, source: lift(drawn.centre.source, drawn.centre.width, drawn.centre.height, false), height: drawn.centre.height + up } : null,
      }
    : drawn
  const img = (d: { source: string; width: number }, height: number, style: string) => `<img src="${uri(d.source)}" width="${d.width}" height="${height}" style="${style}">`
  return (
    // The card crops its art to a plain rectangle; the art cuts the corners itself.
    `<div style="position:absolute;left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${CARD_HEIGHT + up}px;overflow:hidden">` +
    `<div style="position:absolute;top:${-EDGE_TOP}px;left:${-EDGE_SIDE}px;right:${RAIL * 2}px;height:${CARD_HEIGHT + 2 * EDGE_TOP + up}px;overflow:hidden">${img(card.art, CARD_HEIGHT + 2 * EDGE_TOP + 1 + up, 'max-width:none')}</div>` +
    (card.centre ? `<div style="position:absolute;top:${-EDGE_TOP}px;left:0;right:${RAIL}px;display:flex;justify-content:center">${img(card.centre, card.centre.height, '')}</div>` : '') +
    img(card.plate, card.plate.height, `position:absolute;top:${-EDGE_TOP}px;right:${-EDGE_SIDE}px`) +
    `<img src="${uri(RAIL_BUTTONS)}" width="${RAIL}" height="${CARD_HEIGHT}" style="position:absolute;top:${up}px;right:0">` +
    '</div>'
  )
}

const FADE = 110
const page = (s: Shot) => {
  const fade = s.fade ? `<div style="position:absolute;top:0;bottom:0;${s.fade}:0;width:${FADE}px;background:linear-gradient(to ${s.fade},transparent,#000 78%)"></div>` : ''
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
