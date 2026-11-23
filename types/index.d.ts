/** One rate-limit window as the engine reports it. */
export type UsageBarWindow = { kind: string; percentUsed: number; resetsAt?: string }

/** The weekly limits the account keeps per model (Fable's), as its usage report last gave them, and when it was read (epoch ms). */
export type UsageBarModelLimits = { at: number; windows: UsageBarWindow[] }

/** One child session of this one, as the desktop app's records and the live session files say. */
export type UsageBarChild = {
  id: string
  title: string
  state: 'working' | 'needs' | 'idle' | 'stopped'
  /** What it is doing now (working), what it asks for (needs), or its last summary. */
  doing: string
  /** When it entered its state, epoch ms. */
  since: number
  children: UsageBarChild[]
}

/** The session's children, nested, with counts over every descendant. */
export type UsageBarFamily = { children: UsageBarChild[]; working: number; needs: number; idle: number }

/** Clawd's state: what the session is doing, a reaction playing out, when the last turn ended. */
export type UsageBarMood = {
  activity: string
  since: number
  shipped: boolean
  reaction: string | null
  until: number
  lastTurnEnd: number
}

/** What the Glass mode counts for the session: tokens by kind and tool calls as the events report them, and the engine's own totals. */
export type UsageBarLedger = {
  written: number
  read: number
  cacheRead: number
  cacheWritten: number
  tools: number
  /** US dollars so far; null where the host keeps no ledger. */
  usd: number | null
  /** When the session began, epoch ms; 0 before the first read. */
  startedAt: number
  turns: number
}

/** The project the session runs in: the repository (the main one for a worktree), its owner on the remote, the branch, and the worktree's folder name; outside a repository, the folder. */
export type UsageBarProject = {
  name: string
  owner: string | null
  /** Null on a detached checkout. */
  branch: string | null
  /** The checked-out commit, 7 characters. */
  revision: string | null
  worktree: string | null
  repo: boolean
}

/** One reading of the context window's fill, after a main-loop turn. */
export type UsageBarReading = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': {
      windows: UsageBarWindow[]
      modelLimits: UsageBarModelLimits | null
      now: number
      readings: UsageBarReading[]
      family: UsageBarFamily | null
      familyOpen: boolean
      mood: UsageBarMood | null
      fmOn: boolean
      /** Which mode the band draws: `glass`, `cluster` or `classic`. */
      scene: string
      ledger: UsageBarLedger | null
      project: UsageBarProject | null
      /** When the project or its branch last changed, epoch ms: the tab plays its arrival for a moment after. */
      projectSince: number
    }
  }
}
