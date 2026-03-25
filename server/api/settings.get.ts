import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../utils/claudeDir'

export default defineEventHandler(async () => {
  const filePath = resolveClaudePath('settings.json')
  if (!existsSync(filePath)) return {}

  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to read settings.json — file may be malformed' })
  }
})
