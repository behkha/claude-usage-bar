import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const HOME = '/home/someone'
const STORE = `${HOME}/Library/Application Support/Claude/claude-code-sessions/org/account`
const LIVE = `${HOME}/.claude/sessions`

type Fake = { id: string; parent?: string; title: string; status?: 'busy' | 'idle' | 'waiting'; category?: string; detail?: string; archived?: boolean }

// A small family under `lead`: one child working, one waiting on the person,
// one idle whose last turn was marked blocked after it reported back (not
// waiting on the person), one stopped with a stopped child, one archived.
const FAMILY: Fake[] = [
  { id: 'local_lead', title: 'Plan the release', status: 'idle' },
  { id: 'local_a', parent: 'local_lead', title: 'Write the changelog', status: 'busy', detail: 'drafted' },
  { id: 'local_b', parent: 'local_lead', title: 'Check the invoices', status: 'waiting', category: 'blocked', detail: 'two totals differ' },
  { id: 'local_c', parent: 'local_lead', title: 'Tidy the garden notes', detail: 'done' },
  { id: 'local_f', parent: 'local_lead', title: 'Hand the totals back', status: 'idle', category: 'blocked', detail: 'reported to the lead' },
  { id: 'local_d', parent: 'local_c', title: 'Sort the seed list', detail: 'sorted' },
  { id: 'local_e', parent: 'local_lead', title: 'Old draft', archived: true },
]

const fakeFs = (on: On, family: readonly Fake[]) => {
  const running = family.filter(f => f.status)
  const files: Record<string, string> = {}
  running.forEach((f, i) => {
    files[`${LIVE}/${100 + i}.json`] = JSON.stringify({
      pid: 100 + i,
      sessionId: f.id === 'local_lead' ? 'test-session' : `cli-${f.id}`,
      cwd: '/work/project',
      hostSessionId: f.id,
      status: f.status,
      waitingFor: f.status === 'waiting' ? 'input needed' : undefined,
      statusUpdatedAt: Date.now() - 5 * 60_000,
    })
  })
  for (const f of family) {
    files[`${STORE}/${f.id}.json`] = JSON.stringify({
      sessionId: f.id,
      title: f.title,
      isArchived: f.archived === true,
      lastActivityAt: Date.now() - 60 * 60_000,
      ...(f.parent ? { spawnedFrom: { sessionId: f.parent } } : {}),
      ...(f.detail || f.category ? { postTurnSummary: { status_category: f.category ?? 'completed', status_detail: f.detail ?? '' } } : {}),
    })
  }
  const dirs: Record<string, string[]> = {
    [`${HOME}/Library/Application Support/Claude`]: ['claude-code-sessions'],
    [`${HOME}/Library/Application Support/Claude/claude-code-sessions`]: ['org'],
    [`${HOME}/Library/Application Support/Claude/claude-code-sessions/org`]: ['account'],
  }
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files || e.path in dirs || e.path === STORE }))
  on('fs.read', (_$, e) => {
    const text = files[e.path]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.list', (_$, e) => {
    const entry = (name: string, kind: 'file' | 'dir') => ({ name, kind, size: 1, mtimeMs: 1, isLink: false })
    if (e.path in dirs) return { value: dirs[e.path]!.map(n => entry(n, 'dir')) }
    const inDir = Object.keys(files).filter(p => p.startsWith(`${e.path}/`) && !p.slice(e.path.length + 1).includes('/'))
    return { value: inDir.map(p => entry(p.slice(e.path.length + 1), 'file')) }
  })
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'ps') return { value: { exitCode: 0, stdout: running.map((_, i) => `${100 + i}`).join('\n'), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    const line = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Someone, checking the version numbers' }] } })
    return { value: { exitCode: 0, stdout: `partial\n${line}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

// The test environment has timers but its types list no DOM.
declare const setTimeout: (fn: () => void, ms: number) => unknown

// The first poll runs beside session.start; let it land.
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 50))

const engine = (on: On) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 0, window: 200_000, percent: 0 }, rateLimits: [], cost: { usd: 1 } } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

test('a session with children shows them, counted by state, and opens the list', async ($, on) => {
  engine(on)
  fakeFs(on, FAMILY)
  await $.session.start({ source: 'startup', cwd: '/work/project' } as never)
  await settle()

  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'desktop', ...BAND })
  const texts = async () => (await ui.findAll({ type: 'Text' })).map(t => String(t.text))
  expect(await texts()).toEqual(expect.arrayContaining(['1 needs you', ' · 1 working', ' · 3 idle']))
  expect(await ui.find({ type: 'Text', text: 'Write the changelog' })).toBeUndefined()

  await ui.press({ key: 'family' })
  const open = await texts()
  // Asking first, then working, then idle; only those two get a second line.
  const order = ['Check the invoices', 'Write the changelog', 'Hand the totals back'].map(t => open.indexOf(t))
  expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true)
  expect(open).toContain('Input needed')
  expect(open).toContain('Checking the version numbers')
  expect(open).not.toContain('reported to the lead')
  expect(open).toContain('2 finished')
  expect(open).not.toContain('Old draft')
  await ui.unmount()
})

test('a session without children draws no family line', async ($, on) => {
  engine(on)
  fakeFs(on, [{ id: 'local_lead', title: 'Alone', status: 'busy' }])
  await $.session.start({ source: 'startup', cwd: '/work/project' } as never)
  await settle()

  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /working|idle/ })).toBeUndefined()
  expect(await ui.find({ key: 'family' })).toBeUndefined()
  await ui.unmount()
})
