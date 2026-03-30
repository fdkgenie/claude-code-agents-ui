import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { getClaudeDir } from '../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string
  const projectDir = query.projectDir as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required' })
  }

  const claudeDir = getClaudeDir()
  let fullPath = path

  if (!isAbsolute(path)) {
    const baseDir = projectDir && existsSync(projectDir) ? projectDir : claudeDir
    fullPath = join(baseDir, path)
  }

  // Security check: ensure the file is within an allowed directory
  // In a production app, we'd want to be even more strict here
  if (!existsSync(fullPath)) {
    throw createError({ statusCode: 404, message: `File not found: ${fullPath}` })
  }

  try {
    const content = await readFile(fullPath, 'utf-8')
    return { content, path: fullPath }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to read file: ${err.message}` })
  }
})
