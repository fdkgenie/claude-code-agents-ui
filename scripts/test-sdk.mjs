/**
 * SDK Proof-of-concept: verify @anthropic-ai/claude-agent-sdk works,
 * streams responses, and uses the user's existing Claude auth.
 *
 * Run: node scripts/test-sdk.mjs
 */
import { query } from '@anthropic-ai/claude-agent-sdk'

async function main() {
  console.log('Starting Claude Agent SDK test...\n')

  let sessionId = null

  for await (const message of query({
    prompt: 'Say "Hello from the Agent SDK!" and nothing else.',
    options: {
      maxTurns: 1,
      allowedTools: [],
    },
  })) {
    if (message.type === 'system' && message.subtype === 'init') {
      sessionId = message.session_id
      console.log(`Session ID: ${sessionId}`)
    }

    if ('result' in message) {
      console.log(`\nResult: ${message.result}`)
      console.log(`Stop reason: ${message.stop_reason}`)
    }
  }

  console.log('\nSDK test complete!')
}

main().catch((err) => {
  console.error('SDK test failed:', err.message)
  process.exit(1)
})
