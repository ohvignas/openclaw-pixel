import type { OpenClawEvent } from '../openclaw/types.ts'
import { useEconomyStore } from '../store/economyStore.ts'

/**
 * Extrait le nombre de tokens consommes depuis un event OpenClaw.
 */
function extractTokens(event: OpenClawEvent): { agentId: string; tokens: number } | null {
  if (event.type !== 'event') return null

  const payload = (event.payload ?? {}) as Record<string, unknown>

  // Format 1: event "agent" avec usage dans data
  if (event.event === 'agent') {
    const data = (payload.data ?? {}) as Record<string, unknown>
    const usage = data.usage as Record<string, number> | undefined
    if (usage) {
      const total = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
      if (total > 0) {
        const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : ''
        const agentId = sessionKey.split(':')[1] || 'default'
        return { agentId, tokens: total }
      }
    }
  }

  // Format 2: tokens direct dans payload
  if (typeof payload.tokens === 'number' && payload.tokens > 0) {
    const agentId = typeof payload.agentId === 'string' ? payload.agentId : 'default'
    return { agentId, tokens: payload.tokens }
  }

  return null
}

export function processCoinEvent(event: OpenClawEvent): void {
  const result = extractTokens(event)
  if (!result) return
  const { addCoins } = useEconomyStore.getState()
  addCoins(result.agentId, result.tokens)
}
