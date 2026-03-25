import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath, getClaudeDir } from '../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body must be a JSON object' })
  }

  const claudeDir = getClaudeDir()
  if (!existsSync(claudeDir)) {
    throw createError({ statusCode: 400, message: `Claude directory does not exist: ${claudeDir}` })
  }

  const filePath = resolveClaudePath('settings.json')
  try {
    await writeFile(filePath, JSON.stringify(body, null, 2), 'utf-8')
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to write settings.json' })
  }
  return body
})
