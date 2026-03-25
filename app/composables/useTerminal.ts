import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import type { CliWebSocketMessage, CliWebSocketEvent } from '~/types'

export function useTerminal() {
  const terminal = ref<Terminal | null>(null)
  const fitAddon = ref<FitAddon | null>(null)
  const webLinksAddon = ref<WebLinksAddon | null>(null)
  const searchAddon = ref<SearchAddon | null>(null)

  const ws = ref<WebSocket | null>(null)
  const sessionId = ref<string | null>(null)
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)

  /**
   * Initialize terminal with addons
   */
  function initTerminal(container: HTMLElement, options?: {
    fontSize?: number
    fontFamily?: string
    cursorStyle?: 'block' | 'underline' | 'bar'
    scrollback?: number
  }) {
    // Create terminal
    terminal.value = new Terminal({
      cursorBlink: true,
      cursorStyle: options?.cursorStyle || 'block',
      fontSize: options?.fontSize || 14,
      fontFamily: options?.fontFamily || 'Menlo, Monaco, "Courier New", monospace',
      scrollback: options?.scrollback || 10000,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    })

    // Add fit addon for auto-sizing
    fitAddon.value = new FitAddon()
    terminal.value.loadAddon(fitAddon.value)

    // Add web links addon for clickable URLs
    webLinksAddon.value = new WebLinksAddon()
    terminal.value.loadAddon(webLinksAddon.value)

    // Add search addon
    searchAddon.value = new SearchAddon()
    terminal.value.loadAddon(searchAddon.value)

    // Open terminal in container
    terminal.value.open(container)

    // Fit to container
    fitAddon.value.fit()

    // Handle terminal input
    terminal.value.onData((data) => {
      if (ws.value && sessionId.value) {
        const message: CliWebSocketMessage = {
          type: 'input',
          sessionId: sessionId.value,
          data,
        }
        ws.value.send(JSON.stringify(message))
      }
    })

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.value) {
        fitAddon.value.fit()

        // Send resize event to server
        if (ws.value && sessionId.value && terminal.value) {
          const message: CliWebSocketMessage = {
            type: 'resize',
            sessionId: sessionId.value,
            cols: terminal.value.cols,
            rows: terminal.value.rows,
          }
          ws.value.send(JSON.stringify(message))
        }
      }
    })
    resizeObserver.observe(container)

    return terminal.value
  }

  /**
   * Connect to WebSocket and create CLI session
   */
  function connect(options?: {
    agentSlug?: string
    workingDir?: string
    onMessage?: (event: CliWebSocketEvent) => void
  }) {
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/cli/ws`

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      isConnected.value = true
      connectionError.value = null

      // Send execute message to create session
      if (ws.value && terminal.value) {
        const message: CliWebSocketMessage = {
          type: 'execute',
          agentSlug: options?.agentSlug,
          workingDir: options?.workingDir,
          cols: terminal.value.cols,
          rows: terminal.value.rows,
        }
        ws.value.send(JSON.stringify(message))

        // Show welcome message in terminal
        terminal.value.writeln('\x1b[1;36m╔══════════════════════════════════════════════════╗\x1b[0m')
        terminal.value.writeln('\x1b[1;36m║\x1b[0m  \x1b[1mClaude Code CLI Ready\x1b[0m                        \x1b[1;36m║\x1b[0m')
        terminal.value.writeln('\x1b[1;36m║\x1b[0m  Connected to Claude Code                       \x1b[1;36m║\x1b[0m')
        terminal.value.writeln('\x1b[1;36m╚══════════════════════════════════════════════════╝\x1b[0m')
        terminal.value.writeln('')
      }
    }

    ws.value.onmessage = (event) => {
      try {
        const message: CliWebSocketEvent = JSON.parse(event.data)

        // Handle different message types
        switch (message.type) {
          case 'session':
            sessionId.value = message.sessionId
            break

          case 'output':
            if (terminal.value) {
              terminal.value.write(message.data)
            }
            break

          case 'error':
            connectionError.value = message.error
            console.error('[Terminal] Error:', message.error)

            // If Claude CLI not found, show helpful message
            if (message.error?.includes('Claude CLI not found')) {
              connectionError.value = 'Claude CLI not found. Check /api/debug/claude-cli for details or set CLAUDE_CLI_PATH env var.'
            }
            break

          case 'exit':
            console.log('[Terminal] Session exited with code:', message.exitCode)
            break
        }

        // Call custom message handler
        if (options?.onMessage) {
          options.onMessage(message)
        }
      } catch (error) {
        console.error('[Terminal] Failed to parse message:', error)
      }
    }

    ws.value.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error)
      connectionError.value = 'WebSocket connection error'
      isConnected.value = false
    }

    ws.value.onclose = () => {
      isConnected.value = false
      sessionId.value = null
      console.log('[Terminal] WebSocket closed')
    }
  }

  /**
   * Disconnect from WebSocket and terminate session
   */
  function disconnect() {
    if (ws.value && sessionId.value) {
      const message: CliWebSocketMessage = {
        type: 'kill',
        sessionId: sessionId.value,
      }
      ws.value.send(JSON.stringify(message))
    }

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    isConnected.value = false
    sessionId.value = null
  }

  /**
   * Clear terminal screen
   */
  function clear() {
    if (terminal.value) {
      terminal.value.clear()
    }
  }

  /**
   * Write text to terminal
   */
  function write(text: string) {
    if (terminal.value) {
      terminal.value.write(text)
    }
  }

  /**
   * Fit terminal to container
   */
  function fit() {
    if (fitAddon.value) {
      fitAddon.value.fit()
    }
  }

  /**
   * Search in terminal
   */
  function search(text: string, options?: {
    incremental?: boolean
    caseSensitive?: boolean
    wholeWord?: boolean
    regex?: boolean
  }) {
    if (searchAddon.value) {
      return searchAddon.value.findNext(text, options)
    }
    return false
  }

  /**
   * Dispose terminal and cleanup
   */
  function dispose() {
    disconnect()

    if (terminal.value) {
      try {
        terminal.value.dispose()
      } catch (error) {
        // Ignore addon disposal errors - they may not have been loaded yet
        console.debug('[Terminal] Cleanup error (safe to ignore):', error)
      }
      terminal.value = null
    }

    fitAddon.value = null
    webLinksAddon.value = null
    searchAddon.value = null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    dispose()
  })

  return {
    terminal,
    sessionId,
    isConnected,
    connectionError,
    initTerminal,
    connect,
    disconnect,
    clear,
    write,
    fit,
    search,
    dispose,
  }
}
