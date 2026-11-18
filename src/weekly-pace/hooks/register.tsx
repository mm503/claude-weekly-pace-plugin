import { atom, read, update } from 'claude-code'
import type { Register, RenderChildren } from 'claude-code'

import type { Week } from '../types'

// Bump a shape tag whenever that value's form changes: it discards what an
// earlier version stored, which outlives a reload.
const week = atom({ plugin: 'weekly-pace', key: 'week' } as const, null as Week, { shape: 'week-2' })
const effort = atom({ plugin: 'weekly-pace', key: 'effort' } as const, '', { shape: 'effort-2' })
const model = atom({ plugin: 'weekly-pace', key: 'model' } as const, '', { shape: 'model-2' })
// Last main-thread response per model family: the prompt cache is per model.
const warmAt = atom({ plugin: 'weekly-pace', key: 'warmAt' } as const, {} as Record<string, number>, {
  shape: 'warmAt-1',
})
// Bumped by a timer so the time bar and the cache countdown move between turns.
const tick = atom({ plugin: 'weekly-pace', key: 'tick' } as const, 0, { shape: 'tick-1' })

// Prompt-cache lifetime: warm while the last response is newer than this.
const CACHE_TTL_MS = 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 3600 * 1000
const TICK_MS = 30 * 1000

const MODELS = [
  ['Fable', 'claude-fable-5-2'],
  ['Opus', 'claude-opus-5-5'],
  ['Sonnet', 'claude-sonnet-5-5'],
  ['Haiku', 'claude-haiku-5-5'],
] as const
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

// The track matches the unselected buttons beside it in the desktop's dark
// theme (no theme key names that color); the fills are theme keys: a cool
// fill for time and Claude's own orange for usage.
const TRACK = '#454545'
const TIME_FILL = 'suggestion'
const USAGE_FILL = 'claude'

const LABEL_W = 11
const PCT_W = 5
const VERDICT_W = 10

// Kept across sessions in $.store: the last weekly reading any session saw.
const LAST_WEEK = 'last-week-1'

function asWeek(v: unknown): Week {
  if (typeof v !== 'object' || v === null) return null
  const { used, resetsAt } = v as Record<string, unknown>
  if (typeof used !== 'number' || typeof resetsAt !== 'string') return null
  return { used, resetsAt }
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

// Model ids come as full ids, aliases or with a suffix ("[1m]"): compare families.
function family(id: string): string {
  const s = id.toLowerCase()
  return MODELS.find(([label]) => s.includes(label.toLowerCase()))?.[0] ?? ''
}

// Once the reset passes, the window moves a week on and the old reading no
// longer applies; show it as fresh until the next reading arrives.
function currentWindow(w: NonNullable<Week>, now: number) {
  let resetsAt = Date.parse(w.resetsAt)
  if (!Number.isFinite(resetsAt)) return null
  let used = w.used
  if (now >= resetsAt) {
    resetsAt += Math.ceil((now - resetsAt + 1) / WEEK_MS) * WEEK_MS
    used = 0
  }
  return { used, elapsed: clamp(((now - (resetsAt - WEEK_MS)) / WEEK_MS) * 100) }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      const w = usage.rateLimits.find(r => r.kind === 'seven_day')
      if (w?.resetsAt) {
        const reading = { used: w.percentUsed, resetsAt: w.resetsAt }
        await update($, week, () => reading)
        await $.store.set(LAST_WEEK, reading).catch(() => {})
      } else {
        // A new conversation has no reading until its first response: start
        // from the last one any session saw, which the first response replaces.
        const saved = asWeek(await $.store.get(LAST_WEEK).catch(() => null))
        if (saved) await update($, week, () => saved)
      }
      const m = await $.session.model()
      await update($, model, () => m)
      $.clock.every(TICK_MS, () => {
        update($, tick, n => n + 1).catch(() => {})
      })
    } catch {
      // The band still draws its buttons without a reading.
    }
    return next(e)
  })

  // Every main-thread request: its model and effort are what the session runs
  // on now, and its response warms that model's cache.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    const level = typeof e.effort === 'string' ? e.effort : ''
    await update($, effort, () => level).catch(() => {})
    await update($, model, () => e.model).catch(() => {})
    const result = yield* next(e)
    try {
      const t = await $.clock.now()
      const key = family(e.model) || e.model
      await update($, warmAt, map => ({ ...map, [key]: t }))
    } catch {
      // A missed stamp only makes the cache read cold.
    }
    return result
  })

  // /model typed by hand, the picker, or a button: the band follows at once.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    await update($, model, () => e.to_model).catch(() => {})
    return result
  })

  // /effort typed by hand or from a button.
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const result = await next(e)
    const level = e.args.trim().toLowerCase()
    if ((EFFORTS as readonly string[]).includes(level)) {
      await update($, effort, () => level).catch(() => {})
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const w = e.rateLimits.find(r => r.kind === 'seven_day')
    if (w?.resetsAt) {
      const reading = { used: w.percentUsed, resetsAt: w.resetsAt }
      await update($, week, () => reading).catch(() => {})
      await $.store.set(LAST_WEEK, reading).catch(() => {})
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, tick)
    const now = await $.clock.now()
    const w = await read($, week)
    const win = w ? currentWindow(w, now) : null
    const cur = family(await read($, model))
    const eff = await read($, effort)
    const last = (await read($, warmAt))[cur] ?? 0
    const left = CACHE_TTL_MS - (now - last)
    const isWarm = last > 0 && left > 0
    const mins = Math.max(1, Math.ceil(left / 60000))

    const cells = Math.max(10, Math.min(40, e.props.bodyColumns - LABEL_W - PCT_W - VERDICT_W - 2))

    // A fixed-width track with a filled Box inside: both bars start and end at
    // the same place whatever the fill, with no glyphs to differ in width.
    const bar = (id: string, label: string, pct: number, color: string, tail: RenderChildren) => {
      const fill = Math.round((clamp(pct) / 100) * cells)
      return (
        <Box key={label} flexDirection="row" alignItems="center">
          <Box width={LABEL_W} flexShrink={0}>
            <Text dimColor wrap="truncate">
              {label}
            </Text>
          </Box>
          <Box key={`track-${id}`} width={cells} height={1} flexShrink={0} backgroundColor={TRACK} flexDirection="row">
            {fill > 0 && <Box key={`fill-${id}`} width={fill} height={1} flexShrink={0} backgroundColor={color} />}
          </Box>
          <Box width={PCT_W} flexShrink={0} justifyContent="flex-end">
            <Text>{`${Math.round(pct)}%`}</Text>
          </Box>
          <Box width={VERDICT_W} flexShrink={0} paddingLeft={1}>
            {tail}
          </Box>
        </Box>
      )
    }

    let verdict = <Text> </Text>
    if (win) {
      const gap = Math.round(win.used - win.elapsed)
      const color = gap > 5 ? 'error' : gap < -5 ? 'success' : 'warning'
      const text = gap > 5 ? `+${gap} over` : gap < -5 ? `${gap} under` : 'on pace'
      verdict = (
        <Text color={color} wrap="truncate">
          {text}
        </Text>
      )
    }

    const run = (command: string, args: string) => async () => {
      try {
        await $.command.run({ command, args })
        if (command === 'model') {
          const m = await $.session.model()
          await update($, model, () => m)
        }
      } catch (err) {
        $.ui.toast(`/${command} ${args} failed: ${String(err)}`)
      }
    }

    return (
      <Box flexDirection="column">
        {win && (
          <Box flexDirection="column" rowGap="xs">
            {bar('time', 'Week time', win.elapsed, TIME_FILL, <Text> </Text>)}
            {bar('usage', 'Week usage', win.used, USAGE_FILL, verdict)}
          </Box>
        )}
        {win && <Text> </Text>}
        <Box flexDirection="row" alignItems="center" flexWrap="wrap">
          {MODELS.map(([label, id]) => (
            <Button key={id} variant={cur === label ? 'primary' : undefined} label={label} onPress={run('model', id)} />
          ))}
          <Text dimColor> │ </Text>
          {EFFORTS.map(l => (
            <Button key={l} variant={eff === l ? 'primary' : undefined} label={l} onPress={run('effort', l)} />
          ))}
          <Text dimColor> │ </Text>
          <Text color={isWarm ? 'success' : 'error'}>{isWarm ? `warm ${mins}m` : 'cold'}</Text>
        </Box>
      </Box>
    )
  })
}
