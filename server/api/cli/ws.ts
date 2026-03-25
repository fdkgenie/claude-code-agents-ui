import type { Peer } from 'crossws'
import {
  createCliSession,
  getCliSession,
  writeToSession,
  resizeSession,
  terminateSession,
  updateSessionTokens,
  updateSessionCost,
} from '../../utils/cliSession'
import {
  watchDirectory,
  parseTokenUsage,
  parseToolCalls,
  calculateCost,
  createEmptyMetrics,
  updateMetricsWithTokens,
  addFileChange,
  addToolCall,
  type ContextMetrics,
  type FileChange,
} from '../../utils/contextMonitor'
import type { CliWebSocketMessage, CliWebSocketEvent } from '~/types'

// Store context metrics per session
const sessionMetrics = new Map<string, ContextMetrics>()

export default defineWebSocketHandler({
  open(peer: Peer) {
    console.log('[CLI WebSocket] Client connected', peer.id)
  },

  async message(peer: Peer, message) {
    try {
      const msg: CliWebSocketMessage = JSON.parse(message.text())

      switch (msg.type) {
        case 'execute': {
          // Create new CLI session
          console.log('[CLI WebSocket] Creating session with options:', {
            agentSlug: msg.agentSlug,
            workingDir: msg.workingDir,
            cols: msg.cols,
            rows: msg.rows,
          })

          const session = await createCliSession({
            agentSlug: msg.agentSlug,
            workingDir: msg.workingDir,
            cols: msg.cols,
            rows: msg.rows,
          })

          console.log('[CLI WebSocket] Session created:', session.id)

          // Initialize context metrics
          const metrics = createEmptyMetrics()
          sessionMetrics.set(session.id, metrics)

          // Send session ID back to client
          peer.send(JSON.stringify({
            type: 'session',
            sessionId: session.id,
          } satisfies CliWebSocketEvent))

          // Set up PTY output listener
          const sessionData = getCliSession(session.id)
          if (sessionData) {
            // Buffer for accumulating output to parse
            let outputBuffer = ''

            sessionData.pty.onData((data) => {
              // Send output to client
              peer.send(JSON.stringify({
                type: 'output',
                data,
              } satisfies CliWebSocketEvent))

              // Accumulate output for parsing
              outputBuffer += data

              // Parse token usage (look for patterns in output)
              const tokens = parseTokenUsage(outputBuffer)
              if (tokens) {
                updateMetricsWithTokens(metrics, tokens)

                // Update session
                updateSessionTokens(session.id, metrics.tokens)
                updateSessionCost(session.id, metrics.cost.total)

                // Send token update to client
                peer.send(JSON.stringify({
                  type: 'token_update',
                  tokens,
                } satisfies CliWebSocketEvent))

                // Send full context update
                peer.send(JSON.stringify({
                  type: 'context_update',
                  metrics,
                } satisfies CliWebSocketEvent))
              }

              // Parse tool calls
              const tools = parseToolCalls(data)
              for (const tool of tools) {
                addToolCall(metrics, tool)

                peer.send(JSON.stringify({
                  type: 'tool_call',
                  tool,
                } satisfies CliWebSocketEvent))
              }

              // Keep buffer manageable (last 50KB)
              if (outputBuffer.length > 50000) {
                outputBuffer = outputBuffer.slice(-50000)
              }
            })

            // Set up file system watcher
            const watcher = watchDirectory(
              sessionData.metadata.workingDir,
              (change: FileChange) => {
                addFileChange(metrics, change)

                peer.send(JSON.stringify({
                  type: 'file_change',
                  change,
                } satisfies CliWebSocketEvent))

                // Send updated metrics
                peer.send(JSON.stringify({
                  type: 'context_update',
                  metrics,
                } satisfies CliWebSocketEvent))
              }
            )

            // Store watcher for cleanup
            sessionData.watchers.push(watcher)

            // Handle PTY exit
            sessionData.pty.onExit(({ exitCode }) => {
              peer.send(JSON.stringify({
                type: 'exit',
                exitCode,
              } satisfies CliWebSocketEvent))

              // Cleanup
              sessionMetrics.delete(session.id)
            })
          }

          break
        }

        case 'input': {
          // Write input to PTY
          if (!msg.sessionId) {
            peer.send(JSON.stringify({
              type: 'error',
              error: 'Session ID required for input',
            } satisfies CliWebSocketEvent))
            break
          }

          writeToSession(msg.sessionId, msg.data)
          break
        }

        case 'resize': {
          // Resize PTY
          if (!msg.sessionId) {
            peer.send(JSON.stringify({
              type: 'error',
              error: 'Session ID required for resize',
            } satisfies CliWebSocketEvent))
            break
          }

          resizeSession(msg.sessionId, msg.cols, msg.rows)
          break
        }

        case 'kill': {
          // Terminate session
          if (!msg.sessionId) {
            peer.send(JSON.stringify({
              type: 'error',
              error: 'Session ID required for kill',
            } satisfies CliWebSocketEvent))
            break
          }

          await terminateSession(msg.sessionId)
          sessionMetrics.delete(msg.sessionId)

          peer.send(JSON.stringify({
            type: 'exit',
            exitCode: 0,
          } satisfies CliWebSocketEvent))

          break
        }

        default: {
          peer.send(JSON.stringify({
            type: 'error',
            error: `Unknown message type: ${(msg as any).type}`,
          } satisfies CliWebSocketEvent))
        }
      }
    } catch (error: any) {
      console.error('[CLI WebSocket] Error handling message:', error)
      console.error('[CLI WebSocket] Error stack:', error.stack)
      peer.send(JSON.stringify({
        type: 'error',
        error: error.message || error.toString() || 'Internal server error',
      } satisfies CliWebSocketEvent))
    }
  },

  close(peer: Peer) {
    console.log('[CLI WebSocket] Client disconnected', peer.id)
    // Note: Sessions are not automatically terminated on disconnect
    // They will timeout after 30 minutes of inactivity
  },

  error(peer: Peer, error) {
    console.error('[CLI WebSocket] Error:', error)
  },
})
