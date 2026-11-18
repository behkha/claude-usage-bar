import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const MIN = 60_000
const SURFACES = ['terminal', 'desktop'] as const

// What the engine does beneath the plugin: echo the measure, end the turn,
// and draw the band as `band` says (another plugin's line, or nothing).
const engine = (on: On, band: 'empty' | 'weather') => {
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 36_000, window: 200_000, percent: 18 }, rateLimits: RATE_LIMITS(), cost: { usd: 4.32 } },
  }))
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return band === 'weather' ? <Text>weather line</Text> : <Box />
  })
}

type Engine = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[0]

const RATE_LIMITS = () => {
  const at = Date.now()
  return [
    { kind: 'seven_day', percentUsed: 58, resetsAt: new Date(at + 31 * 60 * MIN + 30_000).toISOString() },
    { kind: 'five_hour', percentUsed: 20, resetsAt: new Date(at + 160 * MIN - 30_000).toISOString() },
  ]
}

const feed = async ($: Engine) => {
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: RATE_LIMITS(),
    cost: { usd: 4.32 },
    changed: ['rateLimits', 'cost'],
  })
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5-5',
      input_tokens: 15_600,
      output_tokens: 3_000,
      cache_read_input_tokens: 900_000,
      cache_creation_input_tokens: 54_200,
    },
  })
}

test('terminal band shows the windows and the forecast', async ($, on) => {
  engine(on, 'empty')
  await feed($)

  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: ' 20%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 58%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  ↻ 2h 40m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  ↻ 1d 7h' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '☀  Clear' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  18% of context' })).toBeDefined()
  await ui.unmount()
})

test('desktop band draws one figure per limit and the context, in order', async ($, on) => {
  engine(on, 'empty')
  await feed($)

  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'desktop', ...BAND })
  const alts = (await ui.findAll({ type: 'Svg' })).map(p => String(p.props.alt)).filter(a => !a.startsWith('Clawd'))
  expect(alts).toEqual([
    '5h 20% used, resets in 2h 40m',
    '7d 58% used, resets in 1d 7h',
    'Context Clear: 18% of the window, 36k of 200k',
  ])
  await ui.unmount()
})

test('another plugin band stays below ours', async ($, on) => {
  engine(on, 'weather')
  await feed($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'usage-bar', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'weather line' })).toBeDefined()
    expect((await ui.findAll(surface === 'terminal' ? { type: 'Text', text: ' 20%' } : { type: 'Svg' })).length).toBeGreaterThan(0)
    await ui.unmount()
  }
})

test('band yields to a survey', async ($, on) => {
  engine(on, 'empty')
  const ui = await $.ui.mount({
    plugin: 'usage-bar',
    surface: 'terminal',
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
  })
  expect(await ui.find({ type: 'Text', text: ' 20%' })).toBeUndefined()
  await ui.unmount()
})
