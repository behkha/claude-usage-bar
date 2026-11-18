import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} }

// The host beneath: a Chrome whose tabs AppleScript opens, counts and closes, and a
// store that remembers the control was used.
const host = (on: On, ran: string[][]) => {
  let tabs = 0
  const store = new Map<string, unknown>()
  const done = (code: number, stdout = '') => ({ value: { exitCode: code, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => (store.set(e.key, e.value), { value: undefined }) as never)
  on('process.run', (_$, e) => {
    ran.push([...e.argv])
    if (e.argv[0] === 'osascript') {
      const script = e.argv[2] ?? ''
      const n = tabs
      if (script.includes('close t')) tabs = 0
      if (script.includes('make new window')) tabs += 1
      return done(0, `${n}\n`)
    }
    return done(0)
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 200_000, percent: 1 }, rateLimits: [] } }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

test('Claude FM plays in a minimized Chrome window from the panel and stops by closing it', async ($, on) => {
  const ran: string[][] = []
  host(on, ran)
  const ui = await $.ui.mount({ plugin: 'usage-bar', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ type: 'Text', text: '♪ Claude FM' })).toBeDefined()
  // Nothing has talked to Chrome before the first press.
  expect(ran.some(a => a[0] === 'osascript')).toBe(false)

  await ui.press({ key: 'claude-fm' })
  const play = ran.find(a => a[0] === 'osascript' && (a[2] ?? '').includes('make new window'))?.[2] ?? ''
  expect(play).toContain('https://www.youtube.com/watch?v=tRsQsTMvPNg')
  expect(play).toContain('set minimized of fm to true')
  const svgs = (await ui.findAll({ type: 'Svg' })).map(p => String(p.props.alt))
  expect(svgs).toContain('Claude FM playing')
  expect(svgs).toContain('Clawd, listening to Claude FM')

  await ui.press({ key: 'claude-fm' })
  expect(ran.some(a => a[0] === 'osascript' && (a[2] ?? '').includes('close t'))).toBe(true)
  expect(await ui.find({ type: 'Text', text: '♪ Claude FM' })).toBeDefined()
  await ui.unmount()
})
