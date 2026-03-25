import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { serializeFrontmatter } from '../../utils/frontmatter'
import type { AgentPayload } from '~/types'

export default defineEventHandler(async (event) => {
  const payload = await readBody<AgentPayload>(event)
  const slug = payload.frontmatter.name
  const filePath = resolveClaudePath('agents', `${slug}.md`)

  if (existsSync(filePath)) {
    throw createError({ statusCode: 409, message: `Agent already exists: ${slug}` })
  }

  const agentsDir = resolveClaudePath('agents')
  if (!existsSync(agentsDir)) {
    await mkdir(agentsDir, { recursive: true })
  }

  const content = serializeFrontmatter(payload.frontmatter, payload.body)
  await writeFile(filePath, content, 'utf-8')

  // Create memory directory if memory is enabled
  if (payload.frontmatter.memory && payload.frontmatter.memory !== 'none') {
    const memoryDir = resolveClaudePath('agent-memory', slug)
    if (!existsSync(memoryDir)) {
      await mkdir(memoryDir, { recursive: true })
    }
  }

  return {
    slug,
    filename: `${slug}.md`,
    frontmatter: payload.frontmatter,
    body: payload.body,
    hasMemory: payload.frontmatter.memory !== undefined && payload.frontmatter.memory !== 'none',
    filePath,
  }
})
