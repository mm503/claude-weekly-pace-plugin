import { expect, mock, test } from 'claude-code/testing'

const DAY = 24 * 3600 * 1000
// The week resets at RESET; the clock starts 2 days into it (~28.6% elapsed).
const RESET = Date.parse('2026-11-23T01:00:00.000Z')
const START = RESET - 5 * DAY

const BAND = {
  plugin: 'weekly-pace',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// A 5-hour window that resets 3 hours from START, so 40% of it has passed.
const FIVE_RESET = START + 3 * 3600 * 1000

function engine(on: any, used: number | null, model = 'claude-fable-5-2', five: number | null = null) {
  const limits =
    used === null ? [] : [{ kind: 'seven_day', percentUsed: used, resetsAt: new Date(RESET).toISOString() }]
  if (used !== null && five !== null) {
    limits.push({ kind: 'five_hour', percentUsed: five, resetsAt: new Date(FIVE_RESET).toISOString() })
  }
  on('session.usage', () => ({
    value: { startedAt: START, context: { contextWindow: 1000000 }, rateLimits: limits },
  }))
  on('session.model', () => ({ value: model }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.measure', (_: unknown, e: any) => ({ changed: e.changed }))
}

const surfaces = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('before a usage reading the band shows the buttons alone', async ($, on) => {
  mock.clock(on, { now: START })
  mock.store(on)
  engine(on, null)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'track-week' })).toBeUndefined()
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(9)
    expect((await ui.find({ type: 'Text', text: /cold/ }))?.text).toBe('cold')
    await ui.unmount()
  }
})

// The track's cells and how many of them a percentage fills.
async function track(ui: any, id = 'week') {
  const cells = (await ui.find({ key: `track-${id}` }))?.props.width as number
  return { cells, of: (pct: number) => Math.round((pct / 100) * cells) }
}

test('usage ahead of the week fills to the time mark, then red to usage', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 50)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const { of } = await track(ui)
    const t = of((2 / 7) * 100)
    expect((await ui.find({ key: 'fill-usage-week' }))?.props.width).toBe(t)
    expect((await ui.find({ key: 'fill-over-week' }))?.props.width).toBe(of(50) - t)
    expect((await ui.find({ key: 'fill-over-week' }))?.props.backgroundColor).toBe('error')
    expect(await ui.find({ key: 'fill-headroom-week' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /over/ }))?.text).toBe('+21 over')
    await ui.unmount()
  }
})

test('usage behind the week fills to usage, then green to the time mark', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 10)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const { of } = await track(ui)
    expect((await ui.find({ key: 'fill-usage-week' }))?.props.width).toBe(of(10))
    expect((await ui.find({ key: 'fill-headroom-week' }))?.props.width).toBe(of((2 / 7) * 100) - of(10))
    expect((await ui.find({ key: 'fill-headroom-week' }))?.props.backgroundColor).toBe('#2f5a2a')
    expect(await ui.find({ key: 'fill-over-week' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /under/ }))?.text).toBe('-19 under')
    expect(await ui.find({ key: 'track-five' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /\/ 29%/ }))?.text).toBe(' / 29%')
    await ui.unmount()
  }
})

test('a narrow band still draws the track', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 0)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 20 }, surface: 'terminal' })
  const { cells, of } = await track(ui)
  expect(cells).toBe(10)
  expect(await ui.find({ key: 'fill-usage-week' })).toBeUndefined()
  expect((await ui.find({ key: 'fill-headroom-week' }))?.props.width).toBe(of((2 / 7) * 100))
  await ui.unmount()
})

test('a reading arriving later replaces the figures', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 10)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { contextWindow: 1000000 } as any,
    rateLimits: [{ kind: 'seven_day', percentUsed: 28, resetsAt: new Date(RESET).toISOString() }],
    changed: ['rateLimits'],
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /pace/ }))?.text).toBe('on pace')
  await ui.unmount()
})

test('past the reset the week starts over until a new reading comes', async ($, on) => {
  // The last reading (90%) is from the week that ended half a day ago.
  mock.clock(on, { now: RESET + DAY / 2 })
  engine(on, 90)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const { of } = await track(ui)
  expect(await ui.find({ key: 'fill-usage-week' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^0%$/ }))?.text).toBe('0%')
  expect((await ui.find({ key: 'fill-headroom-week' }))?.props.width).toBe(of((0.5 / 7) * 100))
  await ui.unmount()
})

test('a model switched by hand and an effort typed are highlighted', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 10)
  on('command.run', () => ({ text: '' }))
  on('classic.PostModelSwitch', () => ({}))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.classic.PostModelSwitch({
    from_model: 'claude-fable-5-2',
    to_model: 'claude-opus-5-5[1m]',
    requested_model: 'opus',
    source: 'command',
  } as any)
  await $.command.run({
    command: 'effort',
    args: 'high',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ key: 'claude-opus-5-5' }))?.props.variant).toBe('primary')
  expect((await ui.find({ key: 'claude-fable-5-2' }))?.props.variant).toBeUndefined()
  expect((await ui.find({ key: 'high' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('the cache is warm per model and counts down', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, 10)
  on('classic.PostModelSwitch', () => ({}))
  on('turn.step', async function* (_: unknown, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as any
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const step = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1 } as any)
  for await (const _ of step) {
    // drain
  }
  const switchTo = (to: string) =>
    $.classic.PostModelSwitch({ from_model: '', to_model: to, requested_model: to, source: 'command' } as any)

  await switchTo('claude-opus-5-5')
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /warm/ }))?.text).toBe('warm 60m')
  expect((await ui.find({ key: 'medium' }))?.props.variant).toBe('primary')
  await ui.unmount()

  await switchTo('claude-sonnet-5-5')
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /cold/ }))?.text).toBe('cold')
  await ui.unmount()

  await switchTo('claude-opus-5-5')
  await clock.advance(20 * 60 * 1000)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /warm/ }))?.text).toBe('warm 40m')
  await ui.unmount()
})

test('a new conversation starts from the reading an earlier session saved', async ($, on) => {
  mock.clock(on, { now: START })
  mock.store(on, { 'last-week-1': { used: 40, resetsAt: new Date(RESET).toISOString() } })
  engine(on, null)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const { of } = await track(ui)
  const t = of((2 / 7) * 100)
  expect((await ui.find({ key: 'fill-usage-week' }))?.props.width).toBe(t)
  expect((await ui.find({ key: 'fill-over-week' }))?.props.width).toBe(of(40) - t)
  await ui.unmount()
})

test('a live reading is saved for the next conversation', async ($, on) => {
  mock.clock(on, { now: START })
  const saved: unknown[] = []
  on('store.set', (_: unknown, e: any) => {
    saved.push(e)
    return { value: undefined }
  })
  engine(on, 33)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(JSON.stringify(saved)).toContain('"used":33')
})

test('a plan with a 5-hour window gets a second row for it', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 10, undefined, 70)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of surfaces) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const week = await track(ui)
    const five = await track(ui, 'five')
    expect(five.cells).toBe(week.cells)
    expect((await ui.find({ key: 'fill-usage-five' }))?.props.width).toBe(five.of(40))
    expect((await ui.find({ key: 'fill-over-five' }))?.props.width).toBe(five.of(70) - five.of(40))
    expect((await ui.find({ type: 'Text', text: /^5h$/ }))?.text).toBe('5h')
    expect((await ui.find({ type: 'Text', text: /over/ }))?.text).toBe('+30 over')
    await ui.unmount()
  }
})

test('past its reset the 5-hour row goes until a new reading opens one', async ($, on) => {
  mock.clock(on, { now: FIVE_RESET + 60 * 1000 })
  engine(on, 10, undefined, 70)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'track-week' })).toBeDefined()
  expect(await ui.find({ key: 'track-five' })).toBeUndefined()
  await ui.unmount()
})

test('a reading without a 5-hour window clears the row', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, 10, undefined, 70)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { contextWindow: 1000000 } as any,
    rateLimits: [{ kind: 'seven_day', percentUsed: 12, resetsAt: new Date(RESET).toISOString() }],
    changed: ['rateLimits'],
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'track-five' })).toBeUndefined()
  await ui.unmount()
})

test('a new conversation starts from a saved 5-hour reading too', async ($, on) => {
  mock.clock(on, { now: START })
  mock.store(on, {
    'last-week-1': { used: 40, resetsAt: new Date(RESET).toISOString() },
    'last-five-1': { used: 20, resetsAt: new Date(FIVE_RESET).toISOString() },
  })
  engine(on, null)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const five = await track(ui, 'five')
  expect((await ui.find({ key: 'fill-usage-five' }))?.props.width).toBe(five.of(20))
  expect((await ui.find({ key: 'fill-headroom-five' }))?.props.width).toBe(five.of(40) - five.of(20))
  await ui.unmount()
})
