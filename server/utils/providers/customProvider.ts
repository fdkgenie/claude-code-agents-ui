// server/utils/providers/customProvider.ts
import { randomUUID } from 'node:crypto'
import type { Peer } from 'crossws'
import type { ProviderAdapter, ProviderInfo, ProviderQueryOptions } from './types'
import type { NormalizedMessage, ProviderFetchOptions, ProviderFetchResult } from '~/types'
import { MODEL_ALIAS } from '../models'
import type { ProviderEntry } from './providerConfig'

export class CustomAnthropicProvider implements ProviderAdapter {
  name: string
  private entry: ProviderEntry
  private activeControllers = new Map<string, AbortController>()

  constructor(entry: ProviderEntry) {
    this.entry = entry
    this.name = entry.name
  }

  private resolveModel(tier: string): string {
    const mappings = this.entry.modelMappings ?? {}
    return mappings[tier as keyof typeof mappings] ?? MODEL_ALIAS[tier] ?? tier
  }

  async query(prompt: string, options: ProviderQueryOptions, ws: Peer): Promise<void> {
    const sessionId = options.sessionId ?? randomUUID()
    const controller = new AbortController()
    this.activeControllers.set(sessionId, controller)

    const model = this.resolveModel(options.model ?? 'sonnet')
    const baseUrl = this.entry.baseUrl?.replace(/\/$/, '') ?? ''

    const send = (msg: NormalizedMessage) => ws.send(JSON.stringify(msg))

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.entry.authToken}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8096,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
          ...(options.agentInstructions ? { system: options.agentInstructions } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`${response.status} ${body || response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              send({
                kind: 'stream_delta',
                id: randomUUID(),
                sessionId,
                timestamp: new Date().toISOString(),
                content: parsed.delta.text,
                provider: this.name,
              })
            }
          }
          catch {
            // skip malformed SSE lines
          }
        }
      }

      send({ kind: 'stream_end', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: '', provider: this.name })
      send({ kind: 'complete', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: '', provider: this.name })
    }
    catch (err: any) {
      if (err.name !== 'AbortError') {
        send({ kind: 'error', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: err.message ?? 'Unknown error', provider: this.name })
      }
    }
    finally {
      this.activeControllers.delete(sessionId)
    }
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const controller = this.activeControllers.get(sessionId)
    if (!controller) return false
    controller.abort()
    this.activeControllers.delete(sessionId)
    return true
  }

  normalizeMessage(_raw: any, _sessionId: string): NormalizedMessage[] {
    return []
  }

  async fetchHistory(_sessionId: string, _options: ProviderFetchOptions): Promise<ProviderFetchResult> {
    return { messages: [], total: 0, hasMore: false }
  }
}

export function customProviderInfo(entry: ProviderEntry): ProviderInfo {
  return {
    name: entry.name,
    displayName: entry.displayName || 'Custom Provider',
    description: `Custom Anthropic-compatible provider at ${entry.baseUrl ?? ''}`,
    models: ['opus', 'sonnet', 'haiku'],
    supportsPermissions: false,
    supportsImages: false,
    supportsInterrupt: true,
  }
}
