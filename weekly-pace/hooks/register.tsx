import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { Week } from '../types'

// Bump a shape tag whenever that value's form changes: it discards what an
// earlier version stored, which outlives a reload.
const week = atom({ plugin: 'weekly-pace', key: 'week' } as const, null as Week, { shape: 'week-2' })
const effort = atom({ plugin: 'weekly-pace', key: 'effort' } as const, '', { shape: 'effort-2' })
// The 5-hour window, on plans that have one; null where responses report none.
const fiveHour = atom({ plugin: 'weekly-pace', key: 'fiveHour' } as const, null as Week, { shape: 'fiveHour-1' })
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
const FIVE_HOUR_MS = 5 * 3600 * 1000
const TICK_MS = 30 * 1000

// Weakest to strongest, left to right.
const MODELS = [
  ['Haiku', 'claude-haiku-5-5'],
  ['Sonnet', 'claude-sonnet-5-5'],
  ['Opus', 'claude-opus-5-5'],
  ['Fable', 'claude-fable-5-2'],
] as const
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

// One track per window (the week, and 5 hours where the plan has one): usage
// fills it in Claude's own orange, and the gap between usage and the window's
// elapsed time is green while usage trails time (room to spare) or red past
// it (spending ahead). The track matches the
// unselected buttons beside it in the desktop's dark theme, and no theme key
// names the dark green, so those two are raw colors.
const TRACK = '#454545'
const USAGE_FILL = 'claude'
const HEADROOM_FILL = '#2f5a2a'
const OVER_FILL = 'error'

const LABEL_W = 6
const PCT_W = 11
const VERDICT_W = 10

// Kept across sessions in $.store: the last readings any session saw.
const LAST_WEEK = 'last-week-1'
const LAST_FIVE = 'last-five-1'

function asWeek(v: unknown): Week {
  if (typeof v !== 'object' || v === null) return null
  const { used, resetsAt } = v as Record<string, unknown>
  if (typeof used !== 'number' || typeof resetsAt !== 'string') return null
  return { used, resetsAt }
}

function reading(limits: readonly SessionRateLimit[], kind: string): Week {
  const r = limits.find(l => l.kind === kind)
  return r?.resetsAt ? { used: r.percentUsed, resetsAt: r.resetsAt } : null
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

// Model ids come as full ids, aliases or with a suffix ("[1m]"): compare families.
function family(id: string): string {
  const s = id.toLowerCase()
  return MODELS.find(([label]) => s.includes(label.toLowerCase()))?.[0] ?? ''
}

// How far `now` is through the window of `period` ms that ends at the reset.
// Past the reset the reading no longer applies. A week rolls on to the next
// one, shown fresh until a reading arrives; a 5-hour window opens again only
// with the next request, so until then there is none to show.
function currentWindow(w: NonNullable<Week>, now: number, period: number, rolls: boolean) {
  let resetsAt = Date.parse(w.resetsAt)
  if (!Number.isFinite(resetsAt)) return null
  let used = w.used
  if (now >= resetsAt) {
    if (!rolls) return null
    resetsAt += Math.ceil((now - resetsAt + 1) / period) * period
    used = 0
  }
  return { used, elapsed: clamp(((now - (resetsAt - period)) / period) * 100) }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const { rateLimits } = await $.session.usage()
      const w = reading(rateLimits, 'seven_day')
      if (w) {
        const f = reading(rateLimits, 'five_hour')
        await update($, week, () => w)
        await update($, fiveHour, () => f)
        await $.store.set(LAST_WEEK, w).catch(() => {})
        await $.store.set(LAST_FIVE, f).catch(() => {})
      } else {
        // A new conversation has no reading until its first response: start
        // from the last ones any session saw, which the first response replaces.
        const saved = asWeek(await $.store.get(LAST_WEEK).catch(() => null))
        if (saved) await update($, week, () => saved)
        const savedFive = asWeek(await $.store.get(LAST_FIVE).catch(() => null))
        if (savedFive) await update($, fiveHour, () => savedFive)
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
  // Both hooks only observe: on a failure, .catch passes the event through
  // (next replays what it already settled to; nothing runs twice).
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    await update($, model, () => e.to_model).catch(() => {})
    return result
  }).catch(($, e, next) => next(e))

  // /effort typed by hand or from a button.
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const result = await next(e)
    const level = e.args.trim().toLowerCase()
    if ((EFFORTS as readonly string[]).includes(level)) {
      await update($, effort, () => level).catch(() => {})
    }
    return result
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    // A response that reports the week but no 5-hour window comes from a plan
    // without one: that clears the 5-hour row.
    const w = reading(e.rateLimits, 'seven_day')
    if (w) {
      const f = reading(e.rateLimits, 'five_hour')
      await update($, week, () => w).catch(() => {})
      await update($, fiveHour, () => f).catch(() => {})
      await $.store.set(LAST_WEEK, w).catch(() => {})
      await $.store.set(LAST_FIVE, f).catch(() => {})
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, tick)
    const now = await $.clock.now()
    const w = await read($, week)
    const win = w ? currentWindow(w, now, WEEK_MS, true) : null
    const f = await read($, fiveHour)
    const five = f ? currentWindow(f, now, FIVE_HOUR_MS, false) : null
    const cur = family(await read($, model))
    const eff = await read($, effort)
    const last = (await read($, warmAt))[cur] ?? 0
    const left = CACHE_TTL_MS - (now - last)
    const isWarm = last > 0 && left > 0
    const mins = Math.max(1, Math.ceil(left / 60000))

    const cells = Math.max(10, Math.min(40, e.props.bodyColumns - LABEL_W - PCT_W - VERDICT_W - 2))

    // A fixed-width track holding usage, then the gap to elapsed time: Boxes
    // of whole cells, with no glyphs to differ in width between surfaces.
    const paceRow = (id: string, label: string, win: { used: number; elapsed: number }) => {
      const u = Math.round((clamp(win.used) / 100) * cells)
      const t = Math.round((clamp(win.elapsed) / 100) * cells)
      const gap = Math.abs(u - t)
      const pace = Math.round(win.used - win.elapsed)
      const color = pace > 5 ? 'error' : pace < -5 ? 'success' : 'warning'
      const verdict = pace > 5 ? `+${pace} over` : pace < -5 ? `${pace} under` : 'on pace'
      return (
        <Box key={id} flexDirection="row" alignItems="center">
          <Box width={LABEL_W} flexShrink={0}>
            <Text dimColor wrap="truncate">
              {label}
            </Text>
          </Box>
          <Box key={`track-${id}`} width={cells} height={1} flexShrink={0} backgroundColor={TRACK} flexDirection="row">
            {Math.min(u, t) > 0 && (
              <Box
                key={`fill-usage-${id}`}
                width={Math.min(u, t)}
                height={1}
                flexShrink={0}
                backgroundColor={USAGE_FILL}
              />
            )}
            {gap > 0 && (
              <Box
                key={u < t ? `fill-headroom-${id}` : `fill-over-${id}`}
                width={gap}
                height={1}
                flexShrink={0}
                backgroundColor={u < t ? HEADROOM_FILL : OVER_FILL}
              />
            )}
          </Box>
          <Box width={PCT_W} flexShrink={0} flexDirection="row" justifyContent="flex-end">
            <Text>{`${Math.round(win.used)}%`}</Text>
            <Text dimColor>{` / ${Math.round(win.elapsed)}%`}</Text>
          </Box>
          <Box width={VERDICT_W} flexShrink={0} paddingLeft={1}>
            <Text color={color} wrap="truncate">
              {verdict}
            </Text>
          </Box>
        </Box>
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
        {(win || five) && (
          <Box flexDirection="column" rowGap="xs">
            {win && paceRow('week', 'Week', win)}
            {five && paceRow('five', '5h', five)}
          </Box>
        )}
        {(win || five) && <Text> </Text>}
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
