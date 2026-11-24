// The update notice's engine: which copy of the mod this is, whether a newer version is out, and taking it.
//
// A release is a `version` bump in `.claude-plugin/plugin.json` on the repository's default branch. At most once
// a day a session reads that one file from GitHub and keeps what it found in the store, where every session
// sees it. A copy installed from a marketplace updates with the two commands the CLI has for it, run against the
// config folder it is installed in, then reloads itself where the session can; a copy run from a folder is its
// own source and is never updated from here. Nothing happens without a press or `/usage-bar-update`.

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { UsageBarNotice } from '../types'

const DAY = 24 * 3_600_000
const HOUR = 3_600_000
/** Each CLI command may fetch a marketplace's repository: a slow network gets a few minutes. */
const CLI_MS = 180_000
const CHECK_KEY = 'update'
const TOLD_KEY = 'updateToasted'
const RELOAD = 'reload-plugins'
/** As long as the tab's arrival plays (tab.ts's ARRIVAL_MS, not imported: tab.ts is drawn without the engine too). */
const ARRIVAL_MS = 2_500

/** The notice this session shows, or null; and the version it reloaded for, so a reload that kept the old code says Restart. */
const notice = atom({ plugin: 'usage-bar', key: 'notice' } as const, null)
const reloadedFor = atom({ plugin: 'usage-bar', key: 'reloadedFor' } as const, null)
/** The band's clock: a write redraws it, so the tab drops its arrival once that is over. */
const now = atom({ plugin: 'usage-bar', key: 'now' } as const, 0)

/** This copy: its version, its repository on GitHub (`owner/name`), and where it is installed, null for a copy run from a folder. */
type Copy = { root: string; version: string; repo: string | null; config: string | null; marketplace: string | null; plugin: string | null }

const VERSION = /^\d+(\.\d+)*$/
const valid = (v: unknown): v is string => typeof v === 'string' && VERSION.test(v)
const parts = (v: string) => v.split('.').map(n => Number.parseInt(n, 10))
/** Whether dotted version `a` is past `b`. */
export const newer = (a: string, b: string) => {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** A path with forward slashes and no trailing one, so paths from either separator compare equal. */
const slashed = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')

let copy: Copy | null = null
export async function copyOf($: EngineInterface): Promise<Copy> {
  if (copy) return copy
  const root = $.plugin.root.replace(/[\\/]+$/, '')
  let version = '0'
  let repo: string | null = null
  try {
    const manifest = JSON.parse(await $.fs.read(`${root}/.claude-plugin/plugin.json`)) as { version?: unknown; repository?: unknown }
    if (valid(manifest.version)) version = manifest.version
    const url = typeof manifest.repository === 'string' ? manifest.repository : (manifest.repository as { url?: unknown } | undefined)?.url
    const m = typeof url === 'string' ? /github\.com[/:]([^/]+)\/([^/#?]+?)(\.git)?\/?$/.exec(url) : null
    if (m) repo = `${m[1]}/${m[2]}`
  } catch {
    // a copy without a readable manifest has no updates
  }
  // <config>/plugins/cache/<marketplace>/<plugin>/<version>, with either separator (Windows gives backslashes)
  const at = /^(.+)\/plugins\/cache\/([^/]+)\/([^/]+)\/[^/]+$/.exec(slashed(root))
  copy = { root, version, repo, config: at?.[1] ?? null, marketplace: at?.[2] ?? null, plugin: at?.[3] ?? null }
  return copy
}

// ---------- the check ----------
type Check = { latest: string | null; checkedAt: number; triedAt: number }
async function readCheck($: EngineInterface): Promise<Check> {
  const v = (await $.store.get(CHECK_KEY).catch(() => undefined)) as Partial<Check> | undefined
  return {
    latest: valid(v?.latest) ? v.latest : null,
    checkedAt: typeof v?.checkedAt === 'number' ? v.checkedAt : 0,
    triedAt: typeof v?.triedAt === 'number' ? v.triedAt : 0,
  }
}

/**
 * Reads the newest version from GitHub, at most once a day and, after a failure, at most once an hour; `force`
 * reads now. Every session shares the result; a failure leaves what was known and says nothing.
 */
/** Whether the last read this module made failed: the command says so instead of "latest". */
let checkFailed = false

export async function checkUpdate($: EngineInterface, force = false): Promise<string | null> {
  const me = await copyOf($)
  const c = await readCheck($)
  const at = Date.now()
  if (!me.repo || (!force && (at - c.checkedAt < DAY || at - c.triedAt < HOUR))) return c.latest
  await $.store.set(CHECK_KEY, { ...c, triedAt: at }).catch(() => undefined)
  try {
    const r = await $.http.fetch(`https://raw.githubusercontent.com/${me.repo}/HEAD/.claude-plugin/plugin.json`)
    const latest = r.ok ? (JSON.parse(r.text) as { version?: unknown }).version : null
    checkFailed = !valid(latest)
    if (!valid(latest)) return c.latest
    await $.store.set(CHECK_KEY, { latest, checkedAt: at, triedAt: at }).catch(() => undefined)
    return latest
  } catch {
    checkFailed = true
    return c.latest
  }
}

/** The version the CLI has installed for this copy's plugin and marketplace, or null. */
async function installedOf($: EngineInterface, me: Copy): Promise<string | null> {
  if (!me.config) return null
  try {
    const file = JSON.parse(await $.fs.read(`${me.config}/plugins/installed_plugins.json`)) as { plugins?: Record<string, { version?: unknown }[]> }
    const found = (file.plugins?.[`${me.plugin}@${me.marketplace}`] ?? []).map(p => p.version).filter(valid)
    return found.reduce<string | null>((best, v) => (best && !newer(v, best) ? best : v), null)
  } catch {
    return null
  }
}

let reloadable: boolean | null = null
async function canReload($: EngineInterface) {
  if (reloadable !== null) return reloadable
  // A failed listing is not kept: the next ask tries again.
  const list = await $.command.list().catch(() => null)
  if (list) reloadable = list.some(c => c.name === RELOAD)
  return reloadable ?? false
}

// ---------- the notice ----------
/** A press in flight, and a reload asked for: both end with the module, which a reload starts over. */
let applying = false
let reloading = false

/**
 * Brings the session's notice in line with what is known: the newest version in the store and the one installed.
 * Called at the session's start, on the clock and after a check; an Updating left by a reload is dropped here.
 */
export async function syncNotice($: EngineInterface) {
  const me = await copyOf($)
  const was = (await read($, notice)) as UsageBarNotice | null
  if (applying || reloading) return
  const latest = (await readCheck($)).latest
  const installed = await installedOf($, me)
  let next: Pick<UsageBarNotice, 'version' | 'phase'> | null = null
  if (installed && newer(installed, me.version)) {
    // The new version is in place and this session runs the old one: a press reloads, unless a reload already
    // kept the old code (a copy pinned with --plugin-dir) or the session has no reload.
    const pinned = (await read($, reloadedFor)) === installed
    next = { version: installed, phase: pinned || !(await canReload($)) ? 'restart' : 'available' }
  } else if (latest && newer(latest, me.version)) {
    next = { version: latest, phase: was?.version === latest && was.phase === 'failed' ? 'failed' : 'available' }
  }
  if (!next) {
    if (was) await update($, notice, () => null)
    return
  }
  if (was && was.version === next.version && was.phase === next.phase) return
  const fresh = !was || was.version !== next.version
  await update($, notice, () => ({ ...next, since: fresh ? Date.now() : was.since }))
  if (fresh) $.clock.after(ARRIVAL_MS + 50, () => void update($, now, () => Date.now()).catch(() => undefined))
  // News is toasted; a version already installed by another session is not news.
  if (fresh && next.phase === 'available' && !(installed && newer(installed, me.version))) await toastOnce($, next.version)
}

/**
 * One toast per version, on whichever session sees it first. The engine shows every toast and command line
 * under the mod's name, so no text here names it again.
 */
async function toastOnce($: EngineInterface, version: string) {
  if ((await $.store.get(TOLD_KEY).catch(() => undefined)) === version) return
  await $.store.set(TOLD_KEY, version).catch(() => undefined)
  $.ui.toast(`${version} is out`)
}

function setPhase($: EngineInterface, phase: UsageBarNotice['phase']) {
  return update($, notice, n => (n ? { ...(n as UsageBarNotice), phase } : n))
}

/** The CLI's own reason, from its JSON answer or its last line. */
const reasonOf = (r: { stdout: string; stderr: string }) => {
  const json = lastJson(r.stdout)
  const said = typeof json?.message === 'string' ? json.message : `${r.stderr}\n${r.stdout}`.trim().split('\n').pop() ?? ''
  return said.replace(/^.*✘\s*/, '').trim() || 'the update command failed'
}
const lastJson = (out: string): Record<string, unknown> | null => {
  for (const line of out.trim().split('\n').reverse()) {
    try {
      const v = JSON.parse(line) as unknown
      if (v && typeof v === 'object') return v as Record<string, unknown>
    } catch {
      // not a JSON line
    }
  }
  return null
}

/** Runs the marketplace's update, then the plugin's, against the config folder this copy is installed in. */
async function runUpdate($: EngineInterface, me: Copy): Promise<{ ok: true; version: string | null } | { ok: false; reason: string }> {
  // The running CLI where it is the claude binary itself (the desktop app's bundled one); an install run by a
  // runtime (node) names that runtime here, so then `claude` from PATH.
  const exec = (await $.env.get('CLAUDE_CODE_EXECPATH')) ?? ''
  const cli = /(^|\/)claude(\.exe)?$/.test(exec) ? exec : 'claude'
  const home = (await $.env.get('HOME')) ?? ''
  const own = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${home}/.claude`
  // Only a copy installed under another config folder than the session's needs the folder named.
  const env = me.config && me.config !== slashed(own) ? { CLAUDE_CONFIG_DIR: me.config } : undefined
  const run = (args: string[]) => $.process.run([cli, 'plugin', ...args], { env, timeoutMs: CLI_MS })
  try {
    const market = await run(['marketplace', 'update', me.marketplace!])
    if (market.exitCode !== 0) return { ok: false, reason: reasonOf(market) }
    const plugin = await run(['update', `${me.plugin}@${me.marketplace}`, '--json'])
    const json = lastJson(plugin.stdout)
    if (plugin.exitCode !== 0 || json?.outcome !== 'ok') return { ok: false, reason: reasonOf(plugin) }
    return { ok: true, version: valid(json.newVersion) ? json.newVersion : null }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * What the tab's press and `/usage-bar-update` do: install the newer version and reload into it, and say how it
 * went in a line, which the command prints after the engine's own `usage-bar:`. A failure is toasted once and
 * leaves Retry.
 */
export async function press($: EngineInterface): Promise<string> {
  // Taken before the first await, so a double press runs one update.
  if (applying || reloading) return 'already updating.'
  applying = true
  try {
    return await take($)
  } finally {
    applying = false
  }
}

async function take($: EngineInterface): Promise<string> {
  const me = await copyOf($)
  const n = (await read($, notice)) as UsageBarNotice | null
  if (!me.marketplace) {
    const said = `runs from ${me.root}; update it there.`
    $.ui.toast(said)
    return said
  }
  if (n?.phase === 'restart') {
    const said = `${n.version} is installed and runs from the next session.`
    $.ui.toast(said)
    return said
  }
  await setPhase($, 'updating').catch(() => undefined)
  {
    let installed = await installedOf($, me)
    if (!installed || !newer(installed, me.version)) {
      const r = await runUpdate($, me)
      if (!r.ok) return await fail($, r.reason)
      installed = (await installedOf($, me)) ?? r.version
    }
    if (!installed || !newer(installed, me.version)) return await fail($, `no version past ${me.version} in the marketplace ${me.marketplace} yet`)
    if (!(await canReload($))) {
      await setPhase($, 'restart').catch(() => undefined)
      return `${installed} is installed and runs from the next session.`
    }
    await update($, reloadedFor, () => installed)
    reloading = true
    $.ui.toast(`${installed} installed`)
    // Off the hook that pressed: a reload is refused inside a hook the session waits on, and runs once it is idle.
    // A reload that brings the new code starts this module over; one that keeps it (a copy pinned with
    // --plugin-dir) or is refused leaves it here, where the notice turns to Restart.
    $.clock.after(50, () => {
      void $.command
        .run({ command: RELOAD })
        .catch(() => undefined)
        .then(async () => {
          reloading = false
          // A module the reload started has already put its own notice in place of Updating; only this one's is left to settle.
          const left = (await read($, notice).catch(() => null)) as UsageBarNotice | null
          if (left?.phase === 'updating') await syncNotice($).catch(() => undefined)
        })
    })
    return `${installed} installed; reloading.`
  }
}

async function fail($: EngineInterface, reason: string) {
  await setPhase($, 'failed').catch(() => undefined)
  // One short line: the CLI's reason, cut at its first line and at 80 characters.
  const first = reason.split('\n')[0]!.trim()
  const said = `update failed: ${first.length > 80 ? `${first.slice(0, 79)}…` : first}`
  $.ui.toast(said)
  return said
}

/** `/usage-bar-update`: reads GitHub now, then does what the press does when there is something to take. */
export async function runCommand($: EngineInterface): Promise<string> {
  const me = await copyOf($)
  await checkUpdate($, true)
  await syncNotice($)
  const n = (await read($, notice)) as UsageBarNotice | null
  if (!n) return !me.repo ? `${me.version}; no repository to check.` : checkFailed ? `${me.version}; GitHub could not be read, try again later.` : `${me.version} is the latest version.`
  return press($)
}
