import { setClaudeDir } from '../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const { claudeDir } = await readBody<{ claudeDir: string }>(event)
  setClaudeDir(claudeDir)
  return { claudeDir }
})
