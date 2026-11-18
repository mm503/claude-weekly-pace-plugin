export type Week = { used: number; resetsAt: string } | null

declare module 'claude-code' {
  interface PluginState {
    'weekly-pace': {
      week: Shaped<Week>
      effort: Shaped<string>
      model: Shaped<string>
      warmAt: Shaped<Record<string, number>>
      tick: Shaped<number>
    }
  }
}
