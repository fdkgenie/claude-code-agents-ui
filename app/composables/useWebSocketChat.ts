import type { ChatWebSocketMessage, ChatWebSocketEvent, NormalizedMessage } from '~/types'

export function useWebSocketChat() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isStreaming = ref(false)
  const streamingText = ref('')
  const currentStreamSessionId = ref<string | null>(null)
  const error = ref<string | null>(null)

  // Get sessions store (with new session store)
  const { addMessage, sessionStore } = useChatSessions()

  // Reconnection logic
  let reconnectTimer: NodeJS.Timeout | null = null
  const RECONNECT_DELAY = 3000

  /**
   * Connect to WebSocket
   */
  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.log('[WS Chat] Already connected')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/chat-ws/ws`

    console.log('[WS Chat] Connecting to:', wsUrl)

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[WS Chat] Connected')
      isConnected.value = true
      error.value = null
    }

    ws.value.onmessage = (event) => {
      try {
        const data: ChatWebSocketEvent = JSON.parse(event.data)

        // Handle connection event
        if ('type' in data && data.type === 'connected') {
          console.log('[WS Chat] Session:', data.sessionId)
          return
        }

        // Handle disconnection event
        if ('type' in data && data.type === 'disconnected') {
          isConnected.value = false
          return
        }

        // Handle normalized messages (they have 'kind' property)
        if ('kind' in data) {
          handleMessage(data as NormalizedMessage)
        }
      } catch (e) {
        console.error('[WS Chat] Error parsing message:', e)
      }
    }

    ws.value.onerror = (event) => {
      console.error('[WS Chat] Error:', event)
      error.value = 'WebSocket connection error'
    }

    ws.value.onclose = () => {
      console.log('[WS Chat] Disconnected')
      isConnected.value = false

      // Auto-reconnect after delay
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, RECONNECT_DELAY)
      }
    }
  }

  /**
   * Disconnect WebSocket
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    isConnected.value = false
  }

  /**
   * Send a message
   */
  function sendMessage(message: ChatWebSocketMessage) {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      error.value = 'WebSocket not connected'
      return false
    }

    try {
      ws.value.send(JSON.stringify(message))
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to send message'
      return false
    }
  }

  /**
   * Handle incoming normalized messages
   */
  function handleMessage(message: NormalizedMessage) {
    switch (message.kind) {
      case 'session_created':
        // Session ID is returned, no action needed
        break

      case 'status':
        // Status update (like "Thinking...")
        // Could show in UI but not add to permanent messages
        break

      case 'text':
        // Final text message
        addMessage(message)
        break

      case 'tool_use':
        // Tool being called
        addMessage(message)
        break

      case 'tool_result':
        // Tool result (could be attached to tool_use)
        addMessage(message)
        break

      case 'thinking':
        // Thinking block
        addMessage(message)
        break

      case 'stream_delta':
        // Streaming text chunk
        handleStreamDelta(message)
        break

      case 'stream_end':
        // Stream complete
        finalizeStream(message)
        break

      case 'complete':
        // Query complete
        isStreaming.value = false
        streamingText.value = ''
        currentStreamSessionId.value = null
        addMessage(message)
        break

      case 'error':
        // Error occurred
        isStreaming.value = false
        error.value = message.content || 'An error occurred'
        addMessage(message)
        break

      default:
        console.log('[WS Chat] Unknown message kind:', (message as any).kind)
    }
  }

  /**
   * Handle streaming text delta
   */
  function handleStreamDelta(message: NormalizedMessage) {
    if (!isStreaming.value) {
      isStreaming.value = true
      streamingText.value = ''
      currentStreamSessionId.value = message.sessionId
    }

    // Accumulate text
    if (message.content) {
      streamingText.value += message.content

      // Update streaming message in session store
      sessionStore.updateStreaming(message.sessionId, streamingText.value)
    }
  }

  /**
   * Finalize streaming (convert to final message)
   */
  function finalizeStream(message: NormalizedMessage) {
    if (streamingText.value && currentStreamSessionId.value) {
      // Finalize streaming message in session store
      sessionStore.finalizeStreaming(currentStreamSessionId.value)
    }

    // Reset streaming state
    isStreaming.value = false
    streamingText.value = ''
    currentStreamSessionId.value = null
  }

  /**
   * Send a chat message
   */
  function sendChat(text: string, options: { sessionId?: string; agentSlug?: string; workingDir?: string } = {}) {
    const message: ChatWebSocketMessage = {
      type: 'start',
      message: text,
      sessionId: options.sessionId,
      agentSlug: options.agentSlug,
      workingDir: options.workingDir,
    }

    return sendMessage(message)
  }

  /**
   * Abort current query
   */
  function abort(sessionId: string) {
    const message: ChatWebSocketMessage = {
      type: 'abort',
      sessionId,
    }

    return sendMessage(message)
  }

  // Auto-connect on mount
  onMounted(() => {
    connect()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    isConnected,
    isStreaming,
    streamingText,
    error,

    // Actions
    connect,
    disconnect,
    sendChat,
    abort,
  }
}
