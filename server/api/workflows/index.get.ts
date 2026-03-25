import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import type { Workflow } from '~/types'

export default defineEventHandler(async () => {
  const dir = resolveClaudePath('workflows')
  if (!existsSync(dir)) return []

  const files = await readdir(dir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  const workflows: Workflow[] = await Promise.all(
    jsonFiles.map(async (filename) => {
      const filePath = join(dir, filename)
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      const slug = filename.replace(/\.json$/, '')
      return { slug, filePath, ...data }
    })
  )

  return workflows.sort((a, b) => a.name.localeCompare(b.name))
})
