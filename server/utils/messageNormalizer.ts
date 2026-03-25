import { randomUUID } from 'node:crypto'
import type { NormalizedMessage } from '~/types'

/**
 * Normalize Claude SDK messages into our unified format
 * Following the pattern from claudecodeui's adapter
 */
export function normalizeSDKMessage(
  sdkMessage: any,
  sessionId: string
): NormalizedMessage[] {
  const timestamp = new Date().toISOString()
  const messages: NormalizedMessage[] = []

  // Handle stream events (real-time streaming)
  if (sdkMessage.type === 'stream_event' && sdkMessage.event) {
    const evt = sdkMessage.event

    // Text delta
    if (evt.type === 'content_block_delta') {
      if (evt.delta?.type === 'text_delta' && evt.delta.text) {
        messages.push({
          kind: 'stream_delta',
          id: randomUUID(),
          sessionId,
          timestamp,
          role: 'assistant',
          content: evt.delta.text,
        })
      } else if (evt.delta?.type === 'thinking_delta' && evt.delta.thinking) {
        messages.push({
          kind: 'thinking',
          id: randomUUID(),
          sessionId,
          timestamp,
          content: evt.delta.thinking,
        })
      }
    }

    // Content block start (for thinking)
    if (evt.type === 'content_block_start' && evt.content_block?.type === 'thinking') {
      messages.push({
        kind: 'thinking',
        id: randomUUID(),
        sessionId,
        timestamp,
        content: '',
      })
    }

    // Stream end
    if (evt.type === 'content_block_stop') {
      messages.push({
        kind: 'stream_end',
        id: randomUUID(),
        sessionId,
        timestamp,
      })
    }
  }

  // Handle tool progress
  if (sdkMessage.type === 'tool_progress') {
    messages.push({
      kind: 'tool_use',
      id: randomUUID(),
      sessionId,
      timestamp,
      toolName: sdkMessage.tool_name,
      toolInput: undefined,
      metadata: {
        elapsed: sdkMessage.elapsed_time_seconds,
        status: 'running',
      },
    })
  }

  // Handle result (final result with full content)
  if (sdkMessage.type === 'result' || 'result' in sdkMessage) {
    const resultText = sdkMessage.result || ''
    if (resultText && !isInternalContent(resultText)) {
      messages.push({
        kind: 'text',
        id: randomUUID(),
        sessionId,
        timestamp,
        role: 'assistant',
        content: resultText,
      })
    }

    // Add stop reason as complete message
    if (sdkMessage.stop_reason) {
      messages.push({
        kind: 'complete',
        id: randomUUID(),
        sessionId,
        timestamp,
        content: '',
        metadata: {
          stopReason: sdkMessage.stop_reason,
          modelUsage: sdkMessage.modelUsage,
        },
      })
    }
  }

  return messages
}

/**
 * Check if content should be filtered out (internal system messages)
 */
export function isInternalContent(content: string): boolean {
  if (!content) return false

  const internalPatterns = [
    /<system-reminder>/i,
    /<\/system-reminder>/i,
    /<claude_background_info>/i,
    /<\/claude_background_info>/i,
  ]

  return internalPatterns.some((pattern) => pattern.test(content))
}

/**
 * Filter internal content from a message
 */
export function filterInternalContent(message: NormalizedMessage): NormalizedMessage {
  if (message.content && isInternalContent(message.content)) {
    // Remove or redact internal content
    return {
      ...message,
      content: message.content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, ''),
    }
  }
  return message
}

/**
 * Merge tool results with their corresponding tool uses
 * This makes it easier to display them together in the UI
 */
export function attachToolResults(messages: NormalizedMessage[]): NormalizedMessage[] {
  const result: NormalizedMessage[] = []
  const toolUseMap = new Map<string, NormalizedMessage>()

  for (const message of messages) {
    if (message.kind === 'tool_use') {
      const toolUseId = message.metadata?.toolUseId || message.id
      toolUseMap.set(toolUseId, message)
      result.push(message)
    } else if (message.kind === 'tool_result') {
      const toolUseId = message.metadata?.toolUseId
      const toolUse = toolUseId ? toolUseMap.get(toolUseId) : null

      if (toolUse) {
        // Attach result to the tool use message
        result[result.indexOf(toolUse)] = {
          ...toolUse,
          toolResult: message.toolResult,
          isError: message.isError,
          metadata: {
            ...toolUse.metadata,
            resultId: message.id,
            resultTimestamp: message.timestamp,
          },
        }
      } else {
        // Orphaned tool result, add it anyway
        result.push(message)
      }
    } else {
      result.push(message)
    }
  }

  return result
}
