import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import { parseFrontmatter } from '../../utils/frontmatter'
import type { CommandFrontmatter } from '~/types'

function slugToPath(slug: string): { directory: string; filename: string } {
  const parts = slug.split('--')
  if (parts.length === 1) {
    return { directory: '', filename: `${parts[0]}.md` }
  }
  const filename = `${parts.pop()}.md`
  const directory = parts.join('/')
  return { directory, filename }
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const { directory, filename } = slugToPath(slug)
  const filePath = directory
    ? resolveClaudePath('commands', directory, filename)
    : resolveClaudePath('commands', filename)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: `Command not found: ${slug}` })
  }

  const raw = await readFile(filePath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter<CommandFrontmatter>(raw)

  return {
    slug,
    filename,
    directory,
    frontmatter: { name: slug, ...frontmatter },
    body,
    filePath,
  }
})
