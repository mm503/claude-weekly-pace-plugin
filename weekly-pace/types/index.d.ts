// A rate-limit reading: the week's, or the 5-hour window's on plans with one.
export type Week = { used: number; resetsAt: string } | null

declare module 'claude-code' {
  interface PluginState {
    'weekly-pace': {
      week: Shaped<Week>
      fiveHour: Shaped<Week>
      effort: Shaped<string>
      model: Shaped<string>
      warmAt: Shaped<Record<string, number>>
      tick: Shaped<number>
    }
  }
}
