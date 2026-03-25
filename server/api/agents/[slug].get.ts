import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { AgentFrontmatter } from '~/types'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const filePath = resolveClaudePath('agents', `${slug}.md`)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: `Agent not found: ${slug}` })
  }

  const [raw, fileStat] = await Promise.all([
    readFile(filePath, 'utf-8'),
    stat(filePath),
  ])
  const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(raw)
  const memoryDir = resolveClaudePath('agent-memory', slug)

  return {
    slug,
    filename: `${slug}.md`,
    frontmatter: { name: slug, ...frontmatter },
    body,
    hasMemory: existsSync(memoryDir),
    filePath,
    lastModified: fileStat.mtimeMs,
  }
})
