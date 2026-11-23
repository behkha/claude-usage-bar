// Which project the session is in: the repository's name, its owner on the
// remote, the branch, and the worktree when the session runs in one. Outside a
// repository, the folder's name. The tab on the band draws from this.

import type { EngineInterface } from 'claude-code'

import type { UsageBarProject } from '../types'

const base = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

/** `git@github.com:behkha/claude-usage-bar.git`, `https://github.com/behkha/x` → `behkha`; null where the remote names no owner. */
const ownerOf = (remote: string | null): string | null => {
  // A remote on this machine (a path, file://) names a folder, not an owner.
  if (!remote || remote.startsWith('/') || remote.startsWith('file:') || !/^[a-z+]+:\/\/|^[^@/]+@[^:/]+:/i.test(remote)) return null
  const path = remote.replace(/\.git$/, '').replace(/^[a-z+]+:\/\/[^/]+\//i, '').replace(/^[^@/]+@[^:/]+:/, '')
  const parts = path.split('/').filter(Boolean)
  return parts.length >= 2 ? (parts[parts.length - 2] ?? null) : null
}

type Copy = { root: string; mainRoot: string | null; branch: string | null; revision: string | null; remote: string | null }

/**
 * Git's answer, asked directly: for an engine without `$.vcs` (before 2.1.330), and where it answers nothing.
 * One run for the root, the main checkout's git folder and the branch; one for the remote; the commit only on a
 * detached HEAD (`--abbrev-ref` carries over to every name after it, so it cannot share the first run).
 */
async function askGit($: EngineInterface, cwd: string): Promise<Copy | null> {
  const git = (...args: string[]) => $.process.run(['git', '-C', cwd, ...args], { timeoutMs: 5_000 })
  const found = await git('rev-parse', '--show-toplevel', '--path-format=absolute', '--git-common-dir', '--abbrev-ref', 'HEAD')
  const [root, common, ref] = found.stdout.split('\n').map(l => l.trim())
  if (found.exitCode !== 0 || !root || !common) return null
  const branch = ref && ref !== 'HEAD' ? ref : null
  const sha = branch ? null : await git('rev-parse', '--short', 'HEAD')
  const remote = await git('config', '--get', 'remote.origin.url')
  return {
    root,
    mainRoot: common.endsWith('/.git') ? common.slice(0, -'/.git'.length) : root,
    branch,
    revision: sha && sha.exitCode === 0 ? sha.stdout.trim() || null : null,
    remote: remote.exitCode === 0 ? remote.stdout.trim() || null : null,
  }
}

/** The project of the folder the session runs in; null where nothing can be read (the files are on another machine). */
export async function detectProject($: EngineInterface): Promise<UsageBarProject | null> {
  const cwd = await $.session.cwd().catch(() => '')
  if (!cwd) return null
  let copy: Copy | null
  try {
    copy = await $.vcs.detect({ path: cwd })
  } catch {
    // `$.vcs` arrived in 2.1.330; an engine before it throws here, and git is asked instead
    copy = await askGit($, cwd).catch(() => null)
  }
  if (!copy) return { name: base(cwd), owner: null, branch: null, revision: null, worktree: null, repo: false }
  const main = copy.mainRoot ?? copy.root
  return {
    name: base(main),
    owner: ownerOf(copy.remote),
    branch: copy.branch,
    revision: copy.revision ? copy.revision.slice(0, 7) : null,
    worktree: main !== copy.root ? base(copy.root) : null,
    repo: true,
  }
}

export const sameProject = (a: UsageBarProject | null, b: UsageBarProject | null) =>
  a === b ||
  (!!a && !!b && a.name === b.name && a.owner === b.owner && a.branch === b.branch && a.worktree === b.worktree && a.repo === b.repo && (a.branch !== null || a.revision === b.revision))

/**
 * The project's hue, 0..359, from its name: the same name has the same colour in every session.
 * It skips 10–50°, the card's own clay and heat glow, so a project never reads as a warning.
 */
export const hueOf = (name: string) => {
  let x = 2166136261
  for (const c of name.toLowerCase()) {
    x ^= c.charCodeAt(0)
    x = Math.imul(x, 16777619) >>> 0
  }
  return (50 + (x % 320)) % 360
}

const S = 0.72
const L = 0.63
/** The project's colour as CSS, for a drawing. */
export const colorOf = (name: string) => `hsl(${hueOf(name)},${S * 100}%,${L * 100}%)`
/** The same colour as hex, for the terminal's text. */
export const hexOf = (name: string) => {
  const h = hueOf(name)
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Two letters for the project: the first of its first two words (`claude-usage-bar` → CU, `iBridge` → IB). */
export const monogram = (name: string) => {
  const words = name.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const a = [...(words[0] ?? '?')]
  return ((a[0] ?? '?') + ([...(words[1] ?? '')][0] ?? a[1] ?? '')).toUpperCase()
}

/** Text cut with `…` past `max` characters. */
export const cut = (s: string, max: number) => {
  const chars = [...s]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : s
}

/** The branch as the tab prints it: `folder` outside a repository, `HEAD <sha>` on a detached checkout. */
export const branchLabel = (p: UsageBarProject, max = 24) => (p.repo ? cut(p.branch ?? (p.revision ? `HEAD ${p.revision}` : 'HEAD'), max) : 'folder')

/** What the tab says, for a screen reader and the terminal. */
export const projectAlt = (p: UsageBarProject) =>
  `Project ${p.owner ? `${p.owner}/` : ''}${p.name}, ${p.repo ? `branch ${branchLabel(p, 200)}` : 'not a repository'}${p.worktree ? `, worktree ${p.worktree}` : ''}`
