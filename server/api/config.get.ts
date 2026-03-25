import { existsSync } from 'node:fs'
import { getClaudeDir } from '../utils/claudeDir'

export default defineEventHandler(() => {
  const claudeDir = getClaudeDir()
  return {
    claudeDir,
    exists: existsSync(claudeDir),
  }
})
