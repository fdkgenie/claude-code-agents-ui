import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const filePath = resolveClaudePath('agents', `${slug}.md`)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: `Agent not found: ${slug}` })
  }

  try {
    await unlink(filePath)
  } catch {
    throw createError({ statusCode: 500, message: `Failed to delete agent: ${slug}` })
  }

  return { deleted: true, slug }
})
