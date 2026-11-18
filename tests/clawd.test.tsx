import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = (isWorking: boolean, percent = 18) =>
  ({
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
    percent,
  }) as const

// The engine beneath the plugin: usage at a given context fill and 5h use,
// tools that answer (or fail), turns that end.
const engine = (on: On, opts: { context?: number; fiveHour?: number; failTools?: boolean } = {}) => {
  const window = 200_000
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: ((opts.context ?? 18) / 100) * window, window, percent: opts.context ?? 18 },
      rateLimits: [{ kind: 'five_hour', percentUsed: opts.fiveHour ?? 10, resetsAt: new Date(Date.now() + 3 * 3_600_000).toISOString() }],
    },
  }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', () => (opts.failTools ? { result: 'failed', isError: true } : { result: 'ok' }) as never)
  on('clock.after', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

const clawd = async ($: Engine, isWorking: boolean) => {
  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'desktop', component: 'AbovePrompt', props: BAND(isWorking).props })
  const stage = (await ui.findAll({ type: 'Svg' })).find(p => String(p.props.alt).startsWith('Clawd'))
  await ui.unmount()
  return { alt: String(stage?.props.alt), size: String(stage?.props.source).length }
}

type Engine = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[0]

const SVG_LIMIT = 131_072

const turn = ($: Engine) => $.turn.start({ text: 'go', turnId: 't1' })
const call = ($: Engine, tool: string, args: Record<string, unknown>) =>
  $.tool.call({ tool, ...args } as never).catch(() => undefined)
const end = ($: Engine, reason: 'answer' | 'aborted' | 'error') =>
  $.turn.complete({ answer: 'done', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason } as never)

test('his work follows the tool the session runs and the kind of file', async ($, on) => {
  engine(on)
  const cases: [string, Record<string, unknown>, string][] = [
    ['Edit', { file_path: 'src/app/main.rs' }, 'coding'],
    ['Write', { file_path: 'notes/plan.md' }, 'writing'],
    ['Edit', { file_path: 'site/theme.css' }, 'designing'],
    ['Read', { file_path: 'any/file.txt' }, 'reading'],
    ['WebSearch', { query: 'anything' }, 'researching'],
    ['Bash', { command: 'pytest -q' }, 'coding'],
    ['Bash', { command: 'ls -la' }, 'at the terminal'],
    ['Agent', { prompt: 'look into it' }, 'leading'],
  ]
  for (const [tool, args, word] of cases) {
    await turn($)
    await call($, tool, args)
    const { alt, size } = await clawd($, true)
    expect(alt).toBe(`Clawd, ${word}`)
    expect(size).toBeLessThan(SVG_LIMIT)
  }
})

test('a turn that ends with an answer makes him happy, a shipped one proud, a cut one worried', async ($, on) => {
  engine(on)
  await turn($)
  await end($, 'answer')
  expect((await clawd($, false)).alt).toBe('Clawd, happy')

  await turn($)
  await call($, 'Bash', { command: 'git push origin main' })
  expect((await clawd($, true)).alt).toBe('Clawd, shipping')
  await end($, 'answer')
  expect((await clawd($, false)).alt).toBe('Clawd, proud')

  await turn($)
  await end($, 'aborted')
  expect((await clawd($, false)).alt).toBe('Clawd, worried')
})

test('a failing tool worries him', async ($, on) => {
  engine(on, { failTools: true })
  await turn($)
  await call($, 'Bash', { command: 'make' })
  expect((await clawd($, true)).alt).toBe('Clawd, worried')
})

test('a limit at its cap puts his arms up', async ($, on) => {
  engine(on, { fiveHour: 95 })
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 95 }], changed: ['rateLimits'] } as never)
  const { alt, size } = await clawd($, false)
  expect(alt).toBe('Clawd, needs you')
  expect(size).toBeLessThan(SVG_LIMIT)
})

test('a context past three quarters tires him between turns', async ($, on) => {
  engine(on, { context: 80 })
  await turn($)
  await end($, 'refusal' as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'refusal' } as never)
  expect((await clawd($, false)).alt).toBe('Clawd, tired')
})

test('before any turn he idles, and every stage fits the host', async ($, on) => {
  engine(on)
  const { alt, size } = await clawd($, false)
  expect(alt).toBe('Clawd, idle')
  expect(size).toBeLessThan(SVG_LIMIT)
})
