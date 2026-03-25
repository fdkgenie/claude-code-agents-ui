import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { Agent, AgentFrontmatter } from '~/types'

export default defineEventHandler(async () => {
  const agentsDir = resolveClaudePath('agents')
  if (!existsSync(agentsDir)) return []

  const files = await readdir(agentsDir)
  const mdFiles = files.filter(f => f.endsWith('.md'))

  const agents: Agent[] = await Promise.all(
    mdFiles.map(async (filename) => {
      const filePath = join(agentsDir, filename)
      const raw = await readFile(filePath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(raw)
      const slug = filename.replace(/\.md$/, '')
      const memoryDir = resolveClaudePath('agent-memory', slug)
      const hasMemory = existsSync(memoryDir)

      return {
        slug,
        filename,
        frontmatter: { name: slug, ...frontmatter },
        body,
        hasMemory,
        filePath,
      }
    })
  )

  return agents.sort((a, b) => a.slug.localeCompare(b.slug))
})
